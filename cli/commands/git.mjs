/**
 * AgentRouter CLI — git 命令处理器
 *
 * 用法:
 *   ar git diff                   Git diff 输出
 *   ar git diff --cached          暂存区变更
 *   ar git diff <file>            指定文件
 *   ar git log                    git log --oneline -20
 *   ar git log --all              所有分支
 *   ar git status                 git status --short
 *   ar git branch                 列出分支
 *
 * 选项:
 *   --json    JSON 格式输出
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import * as output from '../lib/output.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * 执行 git 命令
 */
function runGit(args) {
  return execSync(`git ${args.join(' ')}`, { cwd: PROJECT_ROOT, encoding: 'utf-8' });
}

export default async function handler(args, options) {
  const cmd = args[0];

  if (!cmd) {
    output.fatal('用法: ar git <subcommand> [args...]\n可用: diff, log, status, branch');
  }

  // 构建 git 参数
  let gitArgs;

  switch (cmd) {
    // ── git diff ──
    case 'diff': {
      gitArgs = ['diff'];
      if (options.cached) gitArgs.push('--cached');
      // 追加额外参数（文件路径等）
      gitArgs.push(...args.slice(1));
      break;
    }

    // ── git log ──
    case 'log': {
      gitArgs = ['log', '--oneline', '-20'];
      if (options.all) gitArgs.push('--all');
      gitArgs.push(...args.slice(1));
      break;
    }

    // ── git status ──
    case 'status': {
      gitArgs = ['status', '--short', ...args.slice(1)];
      break;
    }

    // ── git branch ──
    case 'branch': {
      gitArgs = ['branch', ...args.slice(1)];
      break;
    }

    default:
      output.fatal(`未知 git 子命令: ${cmd}\n可用: diff, log, status, branch`);
  }

  // 执行 git 命令并处理结果
  try {
    const result = runGit(gitArgs);

    if (output.isJsonMode()) {
      output.json({
        command: `git ${gitArgs.join(' ')}`,
        output: result.trim(),
        exitCode: 0,
      });
    } else {
      output.log(result.trimEnd());
    }
  } catch (err) {
    const stderr = err.stderr || '';
    const isNotRepo = /not a git repository/i.test(stderr) || /fatal: not a git/i.test(stderr);

    if (output.isJsonMode()) {
      output.json({
        command: `git ${gitArgs.join(' ')}`,
        output: '',
        exitCode: err.status || 1,
        error: isNotRepo ? 'Not a git repository' : (stderr || err.message),
      });
    } else if (isNotRepo) {
      output.error('当前目录不是一个 Git 仓库');
    } else {
      output.error(stderr || err.message);
    }
  }
}
