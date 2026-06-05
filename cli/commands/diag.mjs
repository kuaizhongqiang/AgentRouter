/**
 * AgentRouter CLI — diag 命令处理器
 *
 * 深度诊断 — 全面的系统健康检查。
 *
 * 用法:
 *   ar diag                所有检查
 *   ar diag --db           仅数据库
 *   ar diag --agent        仅 Agent
 *   ar diag --env          仅环境
 *
 * 选项:
 *   --json    JSON 格式输出
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import * as output from '../lib/output.mjs';
import { getModules, isInitialized } from '../lib/bootstrap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export default async function handler(args, options) {
  // ── 检查分类过滤 ──
  const onlyDb = !!options.db;
  const onlyAgent = !!options.agent;
  const onlyEnv = !!options.env;
  const runAll = !onlyDb && !onlyAgent && !onlyEnv;

  const results = {};

  // 环境检查（独立，不需要 bootstrap）
  if (runAll || onlyEnv) {
    results.environment = checkEnvironment();
  }

  // 数据库检查
  if (runAll || onlyDb) {
    results.database = checkDatabase();
  }

  // Agent 检查
  if (runAll || onlyAgent) {
    results.agents = await checkAgents();
  }

  // 以下检查仅在无过滤时运行
  if (runAll) {
    results.mcp = checkMCP();
    results.build = checkBuild();
    results.credentials = checkCredentials();
  }

  // ── 输出 ──
  if (output.isJsonMode()) {
    output.json(results);
    return;
  }

  printHumanResults(results, runAll);
}

// ═══════════════════════════════════════════
//  检查实现
// ═══════════════════════════════════════════

/**
 * 环境信息 — Node.js 版本、平台、项目可写性
 */
function checkEnvironment() {
  const info = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    projectRoot: PROJECT_ROOT,
    writable: false,
  };

  try {
    fs.accessSync(PROJECT_ROOT, fs.constants.W_OK);
    info.writable = true;
  } catch {
    // 不可写
  }

  return info;
}

/**
 * 数据库健康 — 文件存在、大小、可查询性
 */
function checkDatabase() {
  const dbPath = path.join(os.homedir(), '.agentrouter', 'agentrouter.db');
  let exists = false;
  let sizeBytes = 0;
  let healthy = false;
  let mtime = null;

  try {
    if (fs.existsSync(dbPath)) {
      exists = true;
      const stat = fs.statSync(dbPath);
      sizeBytes = stat.size;
      mtime = stat.mtime;
    }
  } catch {
    // 文件检查失败
  }

  // 尝试通过 bootstrap 查询数据库验证健康
  try {
    if (isInitialized()) {
      const { repos } = getModules();
      repos.listProjects();
      healthy = true;
    } else {
      healthy = exists;
    }
  } catch {
    healthy = false;
  }

  return {
    path: dbPath,
    exists,
    sizeBytes,
    sizeFormatted: formatSize(sizeBytes),
    lastModified: mtime ? mtime.toISOString() : null,
    healthy,
  };
}

/**
 * Agent 健康 — 列出全部 6 个 Agent 及状态
 */
async function checkAgents() {
  const agents = [];

  try {
    if (isInitialized()) {
      const { manager } = getModules();

      // 优先使用 checkAllAgentsHealth（会执行实际检测）
      let healthResults;
      try {
        healthResults = await manager.checkAllAgentsHealth();
      } catch {
        // 回退到 listWithHealth（仅列出上次缓存的状态）
        healthResults = manager.listWithHealth().map(a => ({
          agentName: a.name,
          healthy: a.health ? a.health.healthy : false,
          status: a.health ? a.health.status : 'untested',
          error: a.health ? a.health.error : null,
        }));
      }

      for (const a of healthResults) {
        const healthy = !!a.healthy;
        agents.push({
          name: a.agentName || a.name || '?',
          healthy,
          status: healthy ? 'healthy' : (a.status || 'unhealthy'),
          ...(a.error ? { error: a.error } : {}),
        });
      }
    } else {
      // bootstrap 未初始化 — 仅做基础检测
      const agentNames = ['codewhale', 'reasonix', 'deepcode', 'opencode', 'cline', 'continue'];
      for (const name of agentNames) {
        agents.push({
          name,
          healthy: false,
          status: 'unknown',
          error: 'AgentManager 不可用',
        });
      }
    }
  } catch (err) {
    // 整体失败时返回错误信息
    agents.push({
      name: 'all',
      healthy: false,
      status: 'error',
      error: `Agent 检测失败: ${err.message}`,
    });
  }

  return agents;
}

/**
 * MCP 服务编译产物检查
 */
function checkMCP() {
  const serverPath = path.join(PROJECT_ROOT, 'dist-electron', 'mcp', 'server.js');
  let exists = false;
  let mtime = null;
  let sizeBytes = 0;

  try {
    if (fs.existsSync(serverPath)) {
      exists = true;
      const stat = fs.statSync(serverPath);
      mtime = stat.mtime;
      sizeBytes = stat.size;
    }
  } catch {
    // ignore
  }

  return {
    path: serverPath,
    exists,
    sizeBytes,
    lastModified: mtime ? mtime.toISOString() : null,
  };
}

/**
 * Electron 后端编译产物检查
 */
function checkBuild() {
  const mainPath = path.join(PROJECT_ROOT, 'dist-electron', 'main.js');
  let exists = false;
  let mtime = null;
  let sizeBytes = 0;

  try {
    if (fs.existsSync(mainPath)) {
      exists = true;
      const stat = fs.statSync(mainPath);
      mtime = stat.mtime;
      sizeBytes = stat.size;
    }
  } catch {
    // ignore
  }

  return {
    path: mainPath,
    exists,
    sizeBytes,
    lastModified: mtime ? mtime.toISOString() : null,
  };
}

/**
 * 凭证文件检查
 */
function checkCredentials() {
  const credPath = path.join(os.homedir(), '.agentrouter', 'credentials.json');
  let exists = false;
  let apiKeyConfigured = false;

  try {
    if (fs.existsSync(credPath)) {
      exists = true;
      const content = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      apiKeyConfigured = !!(content.apiKey || content.DEEPSEEK_API_KEY || content.OPENAI_API_KEY);
    }
  } catch {
    // ignore
  }

  return {
    path: credPath,
    exists,
    apiKeyConfigured,
  };
}

// ═══════════════════════════════════════════
//  人类可读输出
// ═══════════════════════════════════════════

function printHumanResults(results, runAll) {
  output.log('');
  output.log('═══════════════════════════════════════════');
  output.log('  AgentRouter 深度诊断');
  output.log('═══════════════════════════════════════════');
  output.log('');

  if (results.database) {
    printDbSection(results.database);
  }

  if (results.agents) {
    printAgentSection(results.agents);
  }

  if (results.mcp) {
    printMcpSection(results.mcp);
  }

  if (results.build) {
    printBuildSection(results.build);
  }

  if (results.credentials) {
    printCredSection(results.credentials);
  }

  if (results.environment) {
    printEnvSection(results.environment);
  }
}

function printDbSection(db) {
  output.log('── 数据库 ──');
  output.kv('路径', db.path);
  if (db.exists) {
    output.kv('大小', db.sizeFormatted);
    output.kv('状态', db.healthy ? '✅ 正常' : '⚠️  异常');
    if (db.lastModified) {
      output.kv('更新', db.lastModified.replace('T', ' ').split('.')[0]);
    }
  } else {
    output.kv('状态', '❌ 不存在');
  }
  output.log('');
}

function printAgentSection(agents) {
  output.log('── Agent ──');
  if (!agents || agents.length === 0) {
    output.kv('状态', '无数据');
    output.log('');
    return;
  }
  for (const a of agents) {
    const icon = a.healthy ? '✅' : '❌';
    const statusText = a.status || (a.healthy ? '正常' : '异常');
    const suffix = a.error ? ` — ${a.error}` : '';
    output.log(`  ${String(a.name).padEnd(15)} ${icon} ${statusText}${suffix}`);
  }
  output.log('');
}

function printMcpSection(mcp) {
  output.log('── MCP 服务 ──');
  if (mcp.exists) {
    output.kv('路径', mcp.path);
    output.kv('大小', formatSize(mcp.sizeBytes));
    output.kv('状态', '✅ 正常');
  } else {
    output.kv('状态', '❌ 未编译');
  }
  output.log('');
}

function printBuildSection(build) {
  output.log('── 构建产物 ──');
  if (build.exists) {
    output.kv('路径', build.path);
    output.kv('大小', formatSize(build.sizeBytes));
    if (build.lastModified) {
      output.kv('更新', build.lastModified.replace('T', ' ').split('.')[0]);
    }
    output.kv('状态', '✅ 正常');
  } else {
    output.kv('状态', '❌ 未编译 (请执行 ar build)');
  }
  output.log('');
}

function printCredSection(cred) {
  output.log('── 凭证 ──');
  if (cred.exists) {
    output.kv('路径', cred.path);
    output.kv('API Key', cred.apiKeyConfigured ? '✅ 已配置' : '⚠️  未配置');
  } else {
    output.kv('状态', '❌ 不存在');
  }
  output.log('');
}

function printEnvSection(env) {
  output.log('── 环境 ──');
  output.kv('Node.js', env.nodeVersion);
  output.kv('平台', `${env.platform} ${env.arch}`);
  output.kv('项目路径', env.projectRoot);
  output.kv('可写', env.writable ? '✅ 是' : '❌ 否');
  output.log('');
}

/**
 * 字节大小格式化
 */
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
