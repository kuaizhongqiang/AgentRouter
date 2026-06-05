/**
 * AgentRouter CLI — watch 命令处理器
 *
 * 用法:
 *   ar watch             监视 electron/ 和 src/ 的变更
 *   ar watch --build     变更时自动编译后端 (npm run build:electron)
 *   ar watch --test      变更时自动运行测试
 *   ar watch --all       变更时编译后端 + 测试
 *
 * 按 Ctrl+C 退出。
 */
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import * as output from '../lib/output.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** 被监视的目录 (相对于 PROJECT_ROOT) */
const WATCH_DIRS = ['electron', 'src'];

/** 需要排除的目录名（不进入 watch） */
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', '.claude']);

/** execSync 统一配置 */
const EXEC_OPTS = {
  cwd: PROJECT_ROOT,
  stdio: 'pipe',
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
};

export default async function handler(args, options) {
  // ── 解析行为 ──
  const mode = options.all ? 'all' : options.build ? 'build' : options.test ? 'test' : null;

  // ── 检查监视目录 ──
  const watchPaths = resolveWatchPaths();
  if (watchPaths.length === 0) {
    output.fatal('没有可监视的目录。请在 AgentRouter 项目根目录运行此命令。');
    return;
  }

  const dirList = watchPaths
    .map(w => path.relative(PROJECT_ROOT, w.path))
    .join(', ');

  output.log(`正在监视 ${dirList} 的变更...`);
  if (mode) {
    output.log(`模式: ${mode}`);
  } else {
    output.log('提示: 使用 --build / --test / --all 指定变更时自动执行的操作');
  }
  output.log('按 Ctrl+C 停止监视');
  output.log('');

  // ── 启动 watch ──
  let debounceTimer = null;
  const DEBOUNCE_MS = 300;

  for (const wp of watchPaths) {
    try {
      const watcher = fs.watch(wp.path, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (shouldExclude(filename)) return;

        // 去抖动
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          handleChange(filename, mode);
        }, DEBOUNCE_MS);
      });
      watcher.on('error', (err) => {
        output.warn(`监视 ${wp.label} 出错: ${err.message}`);
        // 尝试使用 polling 作为 fallback
        startPollingFallback(wp, mode);
      });
    } catch (err) {
      output.warn(`无法通过 fs.watch 监视 ${wp.label}，尝试 polling 模式...`);
      startPollingFallback(wp, mode);
    }
  }

  // 保持进程存活，等待 Ctrl+C
  await new Promise(() => {});
}

// ═══════════════════════════════════════════
//  实现
// ═══════════════════════════════════════════

/**
 * 解析需要监视的目录路径
 */
function resolveWatchPaths() {
  const result = [];
  for (const dir of WATCH_DIRS) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(fullPath)) {
      result.push({ label: dir, path: fullPath });
    }
  }
  return result;
}

/**
 * 判断文件名是否需要排除
 */
function shouldExclude(filename) {
  // 检查文件名是否在排除列表中
  const parts = filename.split(/[/\\]/);
  for (const part of parts) {
    if (EXCLUDE_DIRS.has(part)) return true;
    if (part.startsWith('.')) return true;
  }
  // 排除常见的临时文件和隐藏文件
  const base = parts[parts.length - 1] || '';
  if (base.startsWith('.')) return true;
  if (/~$/.test(base)) return true;   // 编辑器临时文件
  if (/\.(swp|swo|tmp)$/.test(base)) return true;
  return false;
}

/**
 * 处理文件变更
 */
function handleChange(filename, mode) {
  const now = new Date();
  const timestamp = now.toTimeString().slice(0, 8);
  output.log(`[${timestamp}] 检测到变更: ${filename}`);

  if (!mode) {
    // 单纯监视模式，不执行操作
    return;
  }

  if (mode === 'build' || mode === 'all') {
    runBuild();
  }

  if (mode === 'test' || mode === 'all') {
    runTests();
  }
}

/**
 * 编译 Electron 后端
 */
function runBuild() {
  const start = Date.now();
  output.log('→ 开始编译...');

  try {
    execSync('npm run build:electron', EXEC_OPTS);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    output.success(`编译成功 (${elapsed}s)`);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    output.error(`编译失败 (${elapsed}s)`);
  }
}

/**
 * 运行测试
 */
function runTests() {
  const start = Date.now();
  output.log('→ 开始测试...');

  try {
    execSync('node test/runtime-test-2.mjs', EXEC_OPTS);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    output.success(`测试通过 (${elapsed}s)`);
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    output.error(`测试失败 (${elapsed}s)`);
  }
}

/**
 * 基于 polling 的监视 fallback（Windows fs.watch 可能不触发所有变更）
 */
function startPollingFallback(watchPath, mode) {
  const POLL_INTERVAL = 1500; // 1.5s
  const timestamps = new Map();

  // 只对 .mjs / .ts / .vue / .css 文件轮询
  const WATCHED_EXT = new Set(['.mjs', '.js', '.ts', '.vue', '.css', '.scss', '.cjs']);

  const intervalId = setInterval(() => {
    pollWalkDir(watchPath.path, watchPath.label, timestamps, mode);
  }, POLL_INTERVAL);

  // 不需要 clean up interval — 进程退出自然停止
  intervalId.unref();
}

/**
 * 递归扫描目录，检查文件修改时间是否发生变化
 */
function pollWalkDir(dirPath, label, timestamps, mode) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.name.startsWith('.')) continue;
      if (EXCLUDE_DIRS.has(entry.name)) continue;

      if (entry.isDirectory()) {
        pollWalkDir(fullPath, label, timestamps, mode);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!WATCHED_EXT.has(ext)) continue;

        try {
          const stat = fs.statSync(fullPath);
          const prev = timestamps.get(fullPath);
          if (prev !== undefined && stat.mtimeMs > prev) {
            const relative = path.relative(PROJECT_ROOT, fullPath);
            handleChange(relative, mode);
          }
          timestamps.set(fullPath, stat.mtimeMs);
        } catch {
          // file may have been removed during scanning
        }
      }
    }
  } catch {
    // directory may have been removed
  }
}
