/**
 * AgentRouter CLI — remote 命令 (Phase B C/S 模式)
 *
 * 通过 HTTP API 连接到远程 AgentRouter 实例执行命令。
 * 不需要本地 dist-electron/ 编译产物。
 *
 * 用法:
 *   ar remote --host localhost:18080 status
 *   ar remote --host localhost:18080 --token xxx exec codewhale "指令"
 *   ar remote --host localhost:18080 agents
 *   ar remote --host localhost:18080 doctor
 */
import * as output from '../lib/output.mjs';

// ── 默认连接配置 ──

const DEFAULT_HOST = 'http://127.0.0.1:18080';

function getBaseUrl(options) {
  return options.host || options.h || process.env.AGENTROUTER_API_HOST || DEFAULT_HOST;
}

function getToken(options) {
  return options.token || options.t || process.env.AGENTROUTER_API_TOKEN || '';
}

// ── API 请求封装 ──

async function api(options, method, path, body = null) {
  const baseUrl = getBaseUrl(options);
  const token = getToken(options);
  const url = `${baseUrl}${path}`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}

// ── 子命令实现 ──

async function cmdStatus(options) {
  const data = await api(options, 'GET', '/api/status');
  if (output.isJsonMode()) return output.json(data);

  output.log(`AgentRouter (远程)`);
  output.log(`状态: ${data.status}`);
  output.log(`Agent: ${data.agents?.length || 0} 个`);
  for (const a of data.agents || []) {
    const icon = a.healthy ? '✅' : '❌';
    output.log(`  ${icon} ${a.label} (${a.name}): ${a.status}`);
  }
}

async function cmdAgents(options) {
  const data = await api(options, 'GET', '/api/agents');
  if (output.isJsonMode()) return output.json(data);

  const rows = data.map(a => ({
    name: a.name,
    label: a.label,
    status: a.health?.status || 'unknown',
    healthy: a.health?.healthy ? '✅' : '❌',
  }));
  output.table(rows, ['name', 'label', 'healthy', 'status']);
}

async function cmdExec(args, options) {
  const agent = args[0];
  const command = args.slice(1).join(' ');
  if (!agent || !command) {
    output.fatal('用法: ar remote exec <agent> <指令>');
  }

  const data = await api(options, 'POST', '/api/exec', { agent, command, mode: options.mode });
  if (output.isJsonMode()) return output.json(data);

  output.success(`已发送: ${agent}`);
  output.log(`执行 ID: ${data.logId}`);
}

async function cmdDoctor(args, options) {
  const agent = args[0] || null;
  const data = await api(options, 'POST', '/api/doctor', agent ? { agent } : {});
  if (output.isJsonMode()) return output.json(data);

  if (agent) {
    output.success(`${agent}: ${data.result || 'OK'}`);
  } else {
    for (const r of data.results || []) {
      const icon = r.healthy ? '✅' : '❌';
      output.log(`${icon} ${r.agentName}: ${r.status}`);
    }
  }
}

async function cmdKill(args, options) {
  const agent = args[0] || null;
  const data = await api(options, 'POST', '/api/kill', agent ? { agent } : {});
  output.success(`已终止: ${data.agent}`);
}

// ── 主入口 ──

export default async function handler(args, options) {
  const subcommand = args[0];

  // 没有子命令 → 显示连接信息
  if (!subcommand || subcommand === 'info') {
    const baseUrl = getBaseUrl(options);
    const token = getToken(options);
    output.log(`远程 AgentRouter API`);
    output.log(`地址: ${baseUrl}`);
    output.log(`鉴权: ${token ? '已配置 ✅' : '无 ❌（开发模式）'}`);
    output.log('');
    output.log('用法:');
    output.log('  ar remote status                 查看远端状态');
    output.log('  ar remote agents                 列出 Agent');
    output.log('  ar remote exec <agent> <指令>     远程执行');
    output.log('  ar remote doctor [agent]          远程诊断');
    output.log('  ar remote kill [agent]            终止进程');
    output.log('  ar remote --host <url> <命令>      指定远端地址');
    return;
  }

  // 先测试连接
  try {
    const health = await api(options, 'GET', '/api/health');
    if (!health.ok) throw new Error('Health check failed');
  } catch (err) {
    output.fatal(`无法连接到 ${getBaseUrl(options)}: ${err.message}`);
  }

  switch (subcommand) {
    case 'status':
      return cmdStatus(options);
    case 'agents':
    case 'list':
      return cmdAgents(options);
    case 'exec':
      return cmdExec(args.slice(1), options);
    case 'doctor':
      return cmdDoctor(args.slice(1), options);
    case 'kill':
      return cmdKill(args.slice(1), options);
    default:
      output.fatal(`未知 remote 子命令: ${subcommand}\n可用: status, agents, exec, doctor, kill`);
  }
}
