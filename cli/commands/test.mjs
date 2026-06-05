/**
 * AgentRouter CLI — test 命令处理器
 *
 * 用法:
 *   ar test list                列出测试文件
 *   ar test list --json         JSON 格式列出
 *   ar test run                 运行所有测试
 *   ar test run --cli           仅运行 CLI 集成测试
 *   ar test run --phase7        仅运行 Phase 7 测试
 *   ar test run --smoke         仅运行 Smoke 测试
 *   ar test run --runtime       仅运行 Runtime 测试
 *   ar test run <filename>      运行指定测试文件
 *   ar test run --json          JSON 格式输出结果
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as output from '../lib/output.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** 预定义的测试文件清单 */
const TEST_FILES = [
  {
    id: 'cli-test',
    file: 'test/cli-test.mjs',
    desc: 'CLI 集成测试 — 入口解析和命令路由',
    lines: 0,
  },
  {
    id: 'phase7-test',
    file: 'test/phase7-test.mjs',
    desc: 'Phase 7 启动流程重构 — Agent 检测 + 会话恢复 + 记忆/Wiki 预热',
    lines: 0,
  },
  {
    id: 'smoke-test',
    file: 'test/smoke-test.mjs',
    desc: '端到端 Smoke Test — 模拟完整流程',
    lines: 0,
  },
  {
    id: 'runtime-test-2',
    file: 'test/runtime-test-2.mjs',
    desc: 'Phase 3-6 Runtime Integration — 实际导入 dist-electron/ 模块执行',
    lines: 0,
  },
];

/**
 * 扫描测试文件，刷新行数信息
 */
function refreshLineCounts() {
  for (const t of TEST_FILES) {
    const testPath = path.join(PROJECT_ROOT, t.file);
    try {
      const content = fs.readFileSync(testPath, 'utf-8');
      t.lines = content.split('\n').length;
    } catch {
      t.lines = 0;
    }
  }
}

// ──────────────────────────────────────────────
//  list 子命令
// ──────────────────────────────────────────────

/**
 * 列出所有可用的测试文件
 */
function listTests() {
  refreshLineCounts();

  if (output.isJsonMode()) {
    output.json({
      tests: TEST_FILES.map(t => ({
        id: t.id,
        file: t.file,
        description: t.desc,
        lines: t.lines,
        exists: fs.existsSync(path.join(PROJECT_ROOT, t.file)),
      })),
    });
    return;
  }

  output.log('可用的测试文件:');
  output.log('');
  for (const t of TEST_FILES) {
    const exists = fs.existsSync(path.join(PROJECT_ROOT, t.file));
    const marker = exists ? ' ' : ' [缺失]';
    const lineStr = String(t.lines).padStart(5);
    output.log(`  ${t.file.padEnd(30)} ${lineStr} 行  ${t.desc}${marker}`);
  }
  output.log('');
  output.log(`共 ${TEST_FILES.length} 个测试文件`);
}

// ──────────────────────────────────────────────
//  run 子命令
// ──────────────────────────────────────────────

/**
 * 运行单个测试文件，返回结果对象。
 *
 * 测试自身的 stdout/stderr 通过 stdio: 'inherit' 直通终端。
 */
function runSingleTest(relPath) {
  const testPath = path.join(PROJECT_ROOT, relPath);

  if (!fs.existsSync(testPath)) {
    return Promise.resolve({
      file: relPath,
      passed: false,
      total: 0,
      failed: 1,
      error: '文件不存在',
    });
  }

  const proc = spawn('node', [testPath], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  return new Promise(resolve => {
    proc.on('close', code => {
      if (code === 0) {
        resolve({ file: relPath, passed: true, total: 1, failed: 0 });
      } else {
        resolve({ file: relPath, passed: false, total: 1, failed: 1, error: `Exit code ${code}` });
      }
    });
    proc.on('error', err => {
      resolve({ file: relPath, passed: false, total: 1, failed: 1, error: err.message });
    });
  });
}

/**
 * 运行一组测试文件，输出结果。
 *
 * @param {Array<{file:string}|string>} testEntries  要运行的测试项
 */
async function runTests(testEntries) {
  const results = [];

  for (const entry of testEntries) {
    const relPath = typeof entry === 'string' ? entry : entry.file;

    if (!output.isJsonMode()) {
      output.log('');
      output.log(`──── ${relPath} ────`);
    }

    const result = await runSingleTest(relPath);
    results.push(result);

    if (!output.isJsonMode()) {
      if (result.passed) {
        output.success(`${relPath} 通过`);
      } else {
        output.error(`${relPath} 失败 (${result.error || '未知错误'})`);
      }
    }
  }

  // ── 汇总 ──
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  if (output.isJsonMode()) {
    output.json({
      results: results.map(r => ({
        file: r.file,
        passed: r.passed,
        total: r.total,
        failed: r.failed,
        ...(r.error ? { error: r.error } : {}),
      })),
      total: { passed, failed },
    });
    return;
  }

  output.log('');
  output.log('════════════════════════════════════');
  if (failed === 0) {
    output.success(`${passed}/${total} 通过`);
  } else {
    output.error(`${passed}/${total} 通过, ${failed}/${total} 失败`);
  }
}

// ──────────────────────────────────────────────
//  子命令路由
// ──────────────────────────────────────────────

export default async function handler(args, options) {
  const subcommand = args[0];

  // ── help ──
  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    output.log('用法:');
    output.log('  ar test list                 列出测试文件');
    output.log('  ar test list --json          JSON 格式列出');
    output.log('  ar test run                  运行所有测试');
    output.log('  ar test run --cli            仅运行 CLI 集成测试');
    output.log('  ar test run --phase7         仅运行 Phase 7 测试');
    output.log('  ar test run --smoke          仅运行 Smoke 测试');
    output.log('  ar test run --runtime        仅运行 Runtime 测试');
    output.log('  ar test run <filename>       运行指定测试文件');
    return;
  }

  // ── list ──
  if (subcommand === 'list') {
    listTests();
    return;
  }

  // ── run (或省略 run 直接跟标志/文件名) ──
  if (subcommand === 'run' || subcommand === undefined || subcommand === null) {
    const isDirect =
      subcommand === undefined || subcommand === null
        ? args.length === 0 ||
          options.cli ||
          options.phase7 ||
          options.smoke ||
          options.runtime
        : false;

    // 处理 `ar test run` + 各种标志
    if (subcommand === 'run' || isDirect) {
      const restArgs = subcommand === 'run' ? args.slice(1) : args;

      // 检查 --cli / --phase7 / --smoke / --runtime 标志
      const hasCliFlag     = options.cli;
      const hasPhase7Flag  = options.phase7;
      const hasSmokeFlag   = options.smoke;
      const hasRuntimeFlag = options.runtime;
      const hasAnyFlag     = hasCliFlag || hasPhase7Flag || hasSmokeFlag || hasRuntimeFlag;

      // 标志模式：选择对应测试文件
      if (hasAnyFlag) {
        const entries = [];
        if (hasCliFlag) {
          const t = TEST_FILES.find(x => x.id === 'cli-test');
          if (t) entries.push(t);
        }
        if (hasPhase7Flag) {
          const t = TEST_FILES.find(x => x.id === 'phase7-test');
          if (t) entries.push(t);
        }
        if (hasSmokeFlag) {
          const t = TEST_FILES.find(x => x.id === 'smoke-test');
          if (t) entries.push(t);
        }
        if (hasRuntimeFlag) {
          const t = TEST_FILES.find(x => x.id === 'runtime-test-2');
          if (t) entries.push(t);
        }
        await runTests(entries);
        return;
      }

      // 指定文件名模式：ar test run <filename>
      if (restArgs.length > 0) {
        let targetPath = restArgs[0];
        // 如果只是裸文件名，自动补全 test/ 前缀
        if (!targetPath.includes('/') && !targetPath.includes('\\')) {
          targetPath = `test/${targetPath}`;
        }
        await runTests([{ file: targetPath }]);
        return;
      }

      // 无参数 + 无标志：运行全部
      await runTests(TEST_FILES);
      return;
    }

    // 处理 `ar test run ...` 情况已在上面覆盖，这里不会执行到
  }

  // ── 未知子命令 ──
  output.error(`未知子命令: ${subcommand}\n用法: ar test list|run [选项]`);
}
