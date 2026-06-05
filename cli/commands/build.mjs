/**
 * AgentRouter CLI — build 命令处理器
 *
 * 用法:
 *   ar build                       编译 Electron 后端
 *   ar build --frontend            编译前端 (Vite)
 *   ar build --all                 编译后端 + 前端
 *   ar build --agent <name>        编译指定 Agent
 *   ar build --list                列出 Agent 构建状态
 *   ar rebuild                     重建后端 (build 别名)
 */
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as output from '../lib/output.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** execSync 统一配置 */
const EXEC_OPTS = {
  cwd: PROJECT_ROOT,
  stdio: 'inherit',
  encoding: 'utf-8',
  maxBuffer: 10 * 1024 * 1024,
};

/** Agent 构建配置 */
const AGENTS = [
  {
    name: 'codewhale',
    type: 'Rust',
    displayName: 'CodeWhale',
    buildCmd: 'cd agents/codewhale && cargo build --release -p codewhale-cli -p codewhale-tui',
    checkPath: path.join(PROJECT_ROOT, 'agents', 'codewhale', 'target', 'release', 'ar-codewhale.exe'),
  },
  {
    name: 'reasonix',
    type: 'Node.js/TS',
    displayName: 'Reasonix',
    buildCmd: 'cd agents/reasonix && npm run build',
    checkPath: path.join(PROJECT_ROOT, 'agents', 'reasonix', 'dist', 'cli', 'index.js'),
  },
  {
    name: 'deepcode',
    type: 'Node.js/TS',
    displayName: 'Deep Code',
    buildCmd: 'cd agents/deepcode && npm install && npm run build',
    checkPath: path.join(PROJECT_ROOT, 'agents', 'deepcode', 'dist', 'platform.js'),
  },
  {
    name: 'opencode',
    type: 'Go',
    displayName: 'OpenCode',
    buildCmd: 'cd agents/opencode && go build -o ar-opencode.exe .',
    checkPath: path.join(PROJECT_ROOT, 'agents', 'opencode', 'ar-opencode.exe'),
  },
  {
    name: 'cline',
    type: 'npm (global)',
    displayName: 'Cline',
    buildCmd: 'npm install -g @cline/cli',
    checkBinary: 'cline',
    global: true,
  },
  {
    name: 'continue',
    type: 'npm (global)',
    displayName: 'Continue',
    buildCmd: 'npm install -g @continuedev/cli',
    checkBinary: 'cn',
    global: true,
  },
];

export default async function handler(args, options) {
  const cmd = args[0];

  // --list: 列出所有 Agent 构建状态
  if (options.list) {
    return handleList();
  }

  // --agent <name>: 编译指定 Agent
  if (options.agent) {
    if (typeof options.agent !== 'string') {
      output.fatal(`用法: ar build --agent <name>\n可用: ${AGENTS.map(a => a.name).join(', ')}`);
    }
    return handleAgentBuild(options.agent);
  }

  // --all: 编译后端 + 前端
  if (options.all) {
    return handleAllBuild();
  }

  // --frontend: 仅编译前端
  if (options.frontend) {
    return runFrontendBuild();
  }

  // ar rebuild / ar build — 默认编译 Electron 后端
  return runElectronBuild();
}

// ═══════════════════════════════════════════
//  实现
// ═══════════════════════════════════════════

/**
 * 编译 Electron 后端
 */
function runElectronBuild() {
  output.log('正在编译 Electron 后端...');
  try {
    execSync('npm run build:electron', EXEC_OPTS);
    output.success('编译成功');
  } catch (err) {
    output.fatal(`编译失败: ${err.message}`);
  }
}

/**
 * 编译前端 (Vite)
 */
function runFrontendBuild() {
  output.log('正在编译前端 (Vite)...');
  try {
    execSync('npx vite build', EXEC_OPTS);
    output.success('前端编译成功');
  } catch (err) {
    output.fatal(`前端编译失败: ${err.message}`);
  }
}

/**
 * 编译后端 + 前端
 */
function handleAllBuild() {
  if (output.isJsonMode()) {
    // JSON 模式下收集各步骤结果后统一输出
    let electronOk = false;
    let frontendOk = false;

    try {
      execSync('npm run build:electron', EXEC_OPTS);
      electronOk = true;
    } catch (_) {
      // electron build failed
    }

    if (electronOk) {
      try {
        execSync('npx vite build', EXEC_OPTS);
        frontendOk = true;
      } catch (_) {
        // vite build failed
      }
    }

    output.json({
      electron: { success: electronOk },
      frontend: { success: frontendOk },
    });
    return;
  }

  // 人类可读输出
  output.log('═══════════════════════════════════════════');
  output.log('  步骤 1/2: 编译 Electron 后端');
  output.log('═══════════════════════════════════════════');
  try {
    execSync('npm run build:electron', EXEC_OPTS);
    output.success('Electron 编译成功');
  } catch (err) {
    output.fatal('Electron 编译失败，终止构建');
    return;
  }

  output.log('');
  output.log('═══════════════════════════════════════════');
  output.log('  步骤 2/2: 编译前端 (Vite)');
  output.log('═══════════════════════════════════════════');
  try {
    execSync('npx vite build', EXEC_OPTS);
    output.success('前端编译成功');
  } catch (err) {
    output.fatal('前端编译失败');
  }

  output.log('');
  output.success('全部编译完成');
}

/**
 * 构建指定 Agent
 */
async function handleAgentBuild(agentName) {
  const agent = AGENTS.find(a => a.name === agentName.toLowerCase());
  if (!agent) {
    output.fatal(`未知 Agent: ${agentName}\n可用: ${AGENTS.map(a => a.name).join(', ')}`);
  }

  if (output.isJsonMode()) {
    // JSON 模式: 用 execSync 捕获结果
    try {
      execSync(agent.buildCmd, EXEC_OPTS);
      output.json({ agent: agent.name, success: true });
    } catch (err) {
      output.json({ agent: agent.name, success: false, error: err.stderr || err.message });
    }
    return;
  }

  output.log(`正在构建 ${agent.displayName} ...`);
  output.log(`执行: ${agent.buildCmd}`);
  output.log('');

  // 使用 spawn 流式输出（构建过程可能耗时较长）
  return new Promise((resolve) => {
    const child = spawn(agent.buildCmd, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        output.success(`${agent.displayName} 构建成功`);
        resolve();
      } else {
        output.fatal(`${agent.displayName} 构建失败 (exit code: ${code})`);
      }
    });

    child.on('error', (err) => {
      output.fatal(`${agent.displayName} 构建失败: ${err.message}`);
    });
  });
}

/**
 * 列出所有 Agent 构建状态
 */
function handleList() {
  const results = AGENTS.map(agent => {
    const installed = isAgentInstalled(agent);
    return {
      name: agent.name,
      displayName: agent.displayName,
      type: agent.type,
      buildCommand: agent.buildCmd,
      installed,
    };
  });

  if (output.isJsonMode()) {
    output.json(results);
    return;
  }

  const rows = results.map(r => ({
    name: r.name,
    type: r.type,
    installed: r.installed ? 'yes' : 'no',
    command: r.buildCommand,
  }));
  output.table(rows, ['name', 'type', 'installed', 'command']);
}

/**
 * 检查 Agent 是否已安装/已构建
 */
function isAgentInstalled(agent) {
  if (agent.global) {
    // 检查全局 npm 包是否在 PATH 中
    try {
      execSync(`${agent.checkBinary} --version`, { stdio: 'pipe', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
  // 检查本地构建产物是否存在
  return fs.existsSync(agent.checkPath);
}
