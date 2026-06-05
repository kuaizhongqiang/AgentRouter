/**
 * AgentRouter CLI — env 命令处理器
 *
 * 用法:
 *   ar env             显示所有环境信息
 *   ar env --json      以 JSON 格式输出
 *
 * 展示 Node.js、进程、AgentRouter、数据库、凭证、Git、磁盘、OS 等信息。
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

import * as output from '../lib/output.mjs';
import { getModules } from '../lib/bootstrap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export default async function handler(args, options) {
  const info = {
    node: getNodeInfo(),
    process: getProcessInfo(),
    agentrouter: getAgentRouterInfo(),
    database: getDatabaseInfo(),
    credentials: getCredentialsInfo(),
    git: getGitInfo(),
    disk: getDiskInfo(),
    os: getOsInfo(),
  };

  if (output.isJsonMode()) {
    output.json(info);
    return;
  }

  // ── 人类可读输出 ──
  output.log('═══════════════════════════════════════════');
  output.log('         AgentRouter 环境信息');
  output.log('═══════════════════════════════════════════');
  output.log('');

  output.log('── 1. Node.js ──');
  output.kv('版本', info.node.version);
  output.kv('平台', info.node.platform);
  output.kv('架构', info.node.arch);

  output.log('');
  output.log('── 2. 进程 ──');
  output.kv('工作目录', info.process.cwd);
  output.kv('PID', String(info.process.pid));
  output.kv('内存使用', info.process.memoryUsage);

  output.log('');
  output.log('── 3. AgentRouter ──');
  output.kv('项目根目录', info.agentrouter.projectRoot);
  output.kv('CLI 版本', info.agentrouter.version);
  if (info.agentrouter.distElectron) {
    output.kv('dist-electron', info.agentrouter.distElectron.exists
      ? `存在 (${info.agentrouter.distElectron.size}, ${info.agentrouter.distElectron.lastModified})`
      : '不存在');
  }

  output.log('');
  output.log('── 4. 数据库 ──');
  output.kv('路径', info.database.path);
  output.kv('状态', info.database.exists ? `存在` : '不存在');
  if (info.database.exists) {
    output.kv('大小', info.database.size);
    output.kv('修改时间', info.database.lastModified);
  }

  output.log('');
  output.log('── 5. 凭证 ──');
  output.kv('API Key', info.credentials.configured ? info.credentials.apiKeyMasked : '未配置');
  if (info.credentials.configured) {
    output.kv('Base URL', info.credentials.baseUrl);
  }

  output.log('');
  output.log('── 6. Git ──');
  if (info.git.isRepo) {
    output.kv('仓库', '是');
    output.kv('分支', info.git.branch);
    output.kv('未提交变更', info.git.hasUncommitted ? '有' : '无');
  } else {
    output.kv('仓库', '否');
  }

  output.log('');
  output.log('── 7. 磁盘 ──');
  output.kv('驱动器', info.disk.drive);
  output.kv('剩余空间', info.disk.free);

  output.log('');
  output.log('── 8. 操作系统 ──');
  output.kv('平台', info.os.platform);
  output.kv('版本', info.os.release);
  output.kv('主机名', info.os.hostname);
  output.kv('运行时间', info.os.uptime);
}

// ═══════════════════════════════════════════
//  信息采集函数
// ═══════════════════════════════════════════

function getNodeInfo() {
  return {
    version: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

function getProcessInfo() {
  const mem = process.memoryUsage();
  return {
    cwd: process.cwd(),
    pid: process.pid,
    memoryUsage: formatBytes(mem.rss),
  };
}

function getAgentRouterInfo() {
  const distElectronPath = path.join(PROJECT_ROOT, 'dist-electron');
  let distElectronInfo = null;

  if (fs.existsSync(distElectronPath)) {
    try {
      const stat = fs.statSync(distElectronPath);
      distElectronInfo = {
        exists: true,
        size: formatBytes(getDirSize(distElectronPath)),
        lastModified: stat.mtime.toISOString().replace('T', ' ').split('.')[0],
      };
    } catch {
      distElectronInfo = { exists: false };
    }
  } else {
    distElectronInfo = { exists: false };
  }

  // 尝试读取 CLI 版本
  let version = 'dev';
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      version = pkg.version || version;
    } catch {
      // ignore
    }
  }

  return {
    projectRoot: PROJECT_ROOT,
    version,
    distElectron: distElectronInfo,
  };
}

function getDatabaseInfo() {
  const dbPath = path.join(os.homedir(), '.agentrouter', 'agentrouter.db');
  const info = {
    path: dbPath,
    exists: false,
    size: null,
    lastModified: null,
  };

  if (fs.existsSync(dbPath)) {
    try {
      const stat = fs.statSync(dbPath);
      info.exists = true;
      info.size = formatBytes(stat.size);
      info.lastModified = stat.mtime.toISOString().replace('T', ' ').split('.')[0];
    } catch {
      // ignore
    }
  }

  return info;
}

function getCredentialsInfo() {
  let configured = false;
  let apiKeyMasked = '未配置';
  let baseUrl = '';

  try {
    const { credentials } = getModules();
    const creds = credentials.getCredentials();
    const apiKey = creds.apiKey;

    if (apiKey && apiKey.length > 0) {
      configured = true;
      baseUrl = creds.baseUrl || 'https://api.deepseek.com';
      apiKeyMasked = apiKey.length > 8
        ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
        : '****';
    }
  } catch {
    // dist-electron may not be built; fallback: check credentials.json directly
    const credsPath = path.join(os.homedir(), '.agentrouter', 'credentials.json');
    if (fs.existsSync(credsPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        const apiKey = creds.apiKey || creds.DEEPSEEK_API_KEY || '';
        if (apiKey.length > 0) {
          configured = true;
          baseUrl = creds.baseUrl || creds.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
          apiKeyMasked = apiKey.length > 8
            ? apiKey.slice(0, 4) + '****' + apiKey.slice(-4)
            : '****';
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    configured,
    apiKeyMasked,
    baseUrl,
  };
}

function getGitInfo() {
  const gitDir = path.join(PROJECT_ROOT, '.git');
  const info = {
    isRepo: false,
    branch: null,
    hasUncommitted: false,
  };

  if (!fs.existsSync(gitDir)) {
    return info;
  }

  info.isRepo = true;

  try {
    info.branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 3000,
    }).trim();
  } catch {
    info.branch = 'unknown';
  }

  try {
    const status = execSync('git status --porcelain', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 3000,
    }).trim();
    info.hasUncommitted = status.length > 0;
  } catch {
    info.hasUncommitted = false;
  }

  return info;
}

function getDiskInfo() {
  const drive = path.parse(PROJECT_ROOT).root;
  let free = 'N/A';

  try {
    if (process.platform === 'win32') {
      const output = execSync(
        `wmic logicaldisk where caption="${drive.replace('\\', '\\\\')}" get freespace /format:csv`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 5000 }
      );
      const lines = output.trim().split('\n');
      // Lines: Node,Drive,FreeSpace (skip header)
      for (const line of lines) {
        const cols = line.split(',');
        if (cols.length >= 2) {
          const val = cols[cols.length - 1].trim();
          if (val && /^\d+$/.test(val)) {
            free = formatBytes(parseInt(val, 10));
            break;
          }
        }
      }
    } else {
      // Unix-like: use df
      const output = execSync(`df -B1 "${drive}" 2>/dev/null | tail -1 | awk '{print $4}'`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 5000,
      }).trim();
      if (output && /^\d+$/.test(output)) {
        free = formatBytes(parseInt(output, 10));
      }
    }
  } catch {
    // fallback
  }

  return { drive, free };
}

function getOsInfo() {
  return {
    platform: process.platform,
    release: os.release(),
    hostname: os.hostname(),
    uptime: formatUptime(os.uptime()),
  };
}

// ═══════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════

/**
 * 格式化字节数为人类可读字符串
 */
function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return 'N/A';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);

  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * 格式化为 hh:mm:ss 或类似的可读运行时间
 */
function formatUptime(seconds) {
  if (!seconds || seconds < 0) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * 递归计算目录大小（字节）
 */
function getDirSize(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          total += getDirSize(fullPath);
        } else if (entry.isFile()) {
          total += fs.statSync(fullPath).size;
        }
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // skip inaccessible directories
  }
  return total;
}
