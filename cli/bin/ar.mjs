#!/usr/bin/env node

/**
 * AgentRouter CLI — 入口
 *
 * 参数解析 → 路由到命令处理器 → 输出结果
 *
 * 用法: ar <command> [subcommand] [args...] [options]
 */
import { parseArgs, getHelp } from '../lib/parser.mjs';
import { setJsonMode, setQuietMode, log, error, fatal } from '../lib/output.mjs';
import { init } from '../lib/bootstrap.mjs';

const { positional, options } = parseArgs(process.argv.slice(2));

// ── 全局选项 ──

if (options.json) setJsonMode(true);
if (options.quiet) setQuietMode(true);
if (options.help || options.h) {
  const cmd = positional[0];
  const sub = positional[1];
  console.log(getHelp(cmd, sub));
  process.exit(0);
}
if (options.version) {
  console.log('AgentRouter CLI v0.1.0');
  process.exit(0);
}

// ── 命令路由 ──

const command = positional[0];

// 不需要后端初始化的命令
if (command === 'help' || !command) {
  console.log(getHelp());
  process.exit(0);
}
if (command === 'version') {
  console.log('AgentRouter CLI v0.1.0');
  process.exit(0);
}

// 需要后端初始化的命令 — 延迟加载命令处理器
async function main() {
  try {
    await init();
  } catch (err) {
    fatal(`初始化失败: ${err.message}`);
  }

  switch (command) {
    // ── 核心执行 ──
    case 'exec': {
      const { default: handler } = await import('../commands/exec.mjs');
      await handler(positional.slice(1), options);
      break;
    }
    case 'fix':
    case 'feat':
    case 'review':
    case 'refactor':
    case 'doc':
    case 'goal': {
      const { default: handler } = await import('../commands/exec.mjs');
      await handler([command, ...positional.slice(1)], { ...options, _shortcut: true });
      break;
    }

    // ── Agent 管理 ──
    case 'agent': {
      const { default: handler } = await import('../commands/agent.mjs');
      await handler(positional.slice(1), options);
      break;
    }
    case 'doctor': {
      const { default: handler } = await import('../commands/agent.mjs');
      await handler(['doctor', ...positional.slice(1)], options);
      break;
    }
    case 'kill': {
      const { default: handler } = await import('../commands/agent.mjs');
      await handler(['kill', ...positional.slice(1)], options);
      break;
    }

    // ── 项目 ──
    case 'project': {
      const { default: handler } = await import('../commands/project.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 会话 ──
    case 'session': {
      const { default: handler } = await import('../commands/session.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 任务 ──
    case 'task': {
      const { default: handler } = await import('../commands/task.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 消息 ──
    case 'msg':
    case 'message': {
      const { default: handler } = await import('../commands/msg.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 凭证 ──
    case 'credential':
    case 'credentials': {
      const { default: handler } = await import('../commands/credential.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── Token ──
    case 'token': {
      const { default: handler } = await import('../commands/token.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 编译 (Issue #58) ──
    case 'build':
    case 'rebuild': {
      const { default: handler } = await import('../commands/build.mjs');
      await handler(positional.slice(0), options);
      break;
    }

    // ── 测试 (Issue #58) ──
    case 'test': {
      const { default: handler } = await import('../commands/test.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 记忆 ──
    case 'memory': {
      const { default: handler } = await import('../commands/memory.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 回放 ──
    case 'replay': {
      const { default: handler } = await import('../commands/replay.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 状态 ──
    case 'status': {
      const { default: handler } = await import('../commands/status.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 日志 (Issue #59) ──
    case 'log': {
      const { default: handler } = await import('../commands/log.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 数据库 (Issue #59) ──
    case 'db': {
      const { default: handler } = await import('../commands/db.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── Git (Issue #59) ──
    case 'git': {
      const { default: handler } = await import('../commands/git.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 深度诊断 (Issue #59) ──
    case 'diag': {
      const { default: handler } = await import('../commands/diag.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 清理 (Issue #59) ──
    case 'clean': {
      const { default: handler } = await import('../commands/clean.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 环境信息 (Issue #59) ──
    case 'env': {
      const { default: handler } = await import('../commands/env.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 监听模式 (Issue #59) ──
    case 'watch': {
      const { default: handler } = await import('../commands/watch.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── 远程连接 (Phase B) ──
    case 'remote': {
      const { default: handler } = await import('../commands/remote.mjs');
      await handler(positional.slice(1), options);
      break;
    }

    // ── list 简写 ──
    case 'list':
    case 'ls': {
      const { default: handler } = await import('../commands/agent.mjs');
      await handler(['list'], options);
      break;
    }

    default:
      error(`未知命令: ${command}\n输入 ar help 查看所有命令。`);
  }
}

main().catch(err => {
  fatal(`未捕获错误: ${err.message}`);
});
