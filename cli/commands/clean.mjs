/**
 * AgentRouter CLI — clean 命令处理器
 *
 * 清理构建产物和缓存。
 *
 * 用法:
 *   ar clean               清理 dist-electron/
 *   ar clean --build       清理 dist-electron/ + dist/
 *   ar clean --logs        清理事件日志
 *   ar clean --all         清理所有
 *   ar clean --dry-run     预览（不实际删除）
 *
 * 选项:
 *   --dry-run   仅显示要删除的内容，不实际删除
 *   --json      JSON 格式输出
 *
 * 注意:
 *   永远不会删除 ~/.agentrouter/agentrouter.db 数据库文件。
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import * as output from '../lib/output.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export default async function handler(args, options) {
  const dryRun = !!options['dry-run'];
  const doBuild = !!options.build;
  const doLogs = !!options.logs;
  const doAll = !!options.all;
  // ar clean 不带参数 = 仅清理 dist-electron/
  const defaultClean = !doBuild && !doLogs && !doAll;

  const cleaned = [];
  const errors = [];

  // ── 清理 dist-electron/ ──
  if (defaultClean || doBuild || doAll) {
    const distElectron = path.join(PROJECT_ROOT, 'dist-electron');
    try {
      if (fs.existsSync(distElectron)) {
        if (dryRun) {
          cleaned.push(distElectron);
          // 列出目录内容
          listDirContents(distElectron, cleaned);
        } else {
          const size = getDirSize(distElectron);
          rmDir(distElectron);
          cleaned.push(distElectron);
        }
      }
    } catch (err) {
      errors.push(`dist-electron/: ${err.message}`);
    }
  }

  // ── 清理 dist/ ──
  if (doBuild || doAll) {
    const dist = path.join(PROJECT_ROOT, 'dist');
    try {
      if (fs.existsSync(dist)) {
        if (dryRun) {
          cleaned.push(dist);
          listDirContents(dist, cleaned);
        } else {
          rmDir(dist);
          cleaned.push(dist);
        }
      }
    } catch (err) {
      errors.push(`dist/: ${err.message}`);
    }
  }

  // ── 清理事件日志 ──
  if (doLogs || doAll) {
    const projectsDir = path.join(os.homedir(), '.agentrouter', 'projects');
    try {
      if (fs.existsSync(projectsDir)) {
        const logFiles = findJsonlFiles(projectsDir);
        if (dryRun) {
          cleaned.push(...logFiles);
        } else {
          for (const f of logFiles) {
            try {
              fs.unlinkSync(f);
              cleaned.push(f);
            } catch (err) {
              errors.push(`日志文件: ${f}: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      errors.push(`日志目录: ${err.message}`);
    }
  }

  // ── 输出结果 ──
  if (output.isJsonMode()) {
    output.json({ cleaned, errors });
    return;
  }

  // 人类可读输出
  if (dryRun) {
    output.log('═══ 清理预览 (--dry-run) ═══');
    if (cleaned.length === 0) {
      output.log('没有需要清理的内容。');
    } else {
      output.log(`将删除 ${cleaned.length} 个项目/文件:`);
      for (const item of cleaned) {
        output.log(`  ${item}`);
      }
    }
  } else {
    if (cleaned.length > 0) {
      output.log(`已清理 ${cleaned.length} 个项目:`);
      for (const item of cleaned) {
        output.log(`  ✅ ${item}`);
      }
    }
    if (errors.length > 0) {
      for (const err of errors) {
        output.error(err);
      }
    }
    if (cleaned.length === 0 && errors.length === 0) {
      output.log('没有需要清理的内容。');
    }
  }

  // ── 安全警告 ──
  const dbPath = path.join(os.homedir(), '.agentrouter', 'agentrouter.db');
  if (cleaned.some(c => c.includes('.agentrouter/agentrouter.db') || c.includes('agentrouter.db'))) {
    output.warn('检测到试图删除数据库文件！操作已被跳过。');
    output.warn(`数据库路径: ${dbPath}`);
    output.warn('请手动管理数据库文件。');
  }
}

// ═══════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════

/**
 * 递归删除目录
 */
function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 递归查找所有 .jsonl 文件
 */
function findJsonlFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonlFiles(fullPath));
    } else if (entry.name.endsWith('.jsonl')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 列出目录内容（用于 dry-run 预览）
 */
function listDirContents(dir, results) {
  try {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      results.push(fullPath);
      if (entry.isDirectory()) {
        listDirContents(fullPath, results);
      }
    }
  } catch {
    // 无法读取的目录跳过
  }
}

/**
 * 估算目录大小
 */
function getDirSize(dir) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += getDirSize(fullPath);
      } else {
        try {
          total += fs.statSync(fullPath).size;
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  } catch {
    // 跳过无法读取的目录
  }
  return total;
}
