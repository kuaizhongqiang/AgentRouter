/**
 * AgentRouter CLI — status 命令处理器
 *
 * 用法:
 *   ar status         全局状态概览
 *   ar status --json  机器可读格式
 */
import path from 'path';
import os from 'os';
import fs from 'fs';

import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

export default async function handler(args, options) {
  const { manager, repos, credentials } = getModules();

  // ── 1. Agent 状态 ──
  const agents = manager.listWithHealth();
  const totalAgents = agents.length;
  const healthyCount = agents.filter(a => a.health && a.health.healthy).length;
  const disabledCount = agents.filter(a => a.health && a.health.status === 'disabled').length;
  const untestedCount = agents.filter(a => !a.health).length;

  // ── 2. 项目统计 ──
  const projects = await repos.listProjects();
  const projectCount = projects.length;

  // ── 3. 凭证状态 ──
  const creds = credentials.getCredentials();
  const hasApiKey = !!(creds.apiKey && creds.apiKey.length > 0);
  const baseUrl = creds.baseUrl || 'https://api.deepseek.com';

  // ── 4. DB 路径 ──
  const dbPath = path.join(os.homedir(), '.agentrouter', 'agentrouter.db');
  const dbExists = fs.existsSync(dbPath);

  // ── 5. 输出 ──
  if (output.isJsonMode()) {
    output.json({
      agents: {
        total: totalAgents,
        healthy: healthyCount,
        disabled: disabledCount,
        untested: untestedCount,
        list: agents.map(a => ({
          name: a.name,
          label: a.label,
          status: a.health ? a.health.status : 'untested',
          healthy: a.health ? a.health.healthy : false,
        })),
      },
      projects: {
        total: projectCount,
        list: projects.map(p => ({
          id: p.id,
          name: p.name,
          path: p.path,
        })),
      },
      credentials: {
        configured: hasApiKey,
        baseUrl,
      },
      database: {
        path: dbPath,
        exists: dbExists,
      },
    });
    return;
  }

  // ── 人类可读表格输出 ──
  output.log('═══════════════════════════════════════════');
  output.log('         AgentRouter 全局状态');
  output.log('═══════════════════════════════════════════');
  output.log('');

  // Agent 摘要
  output.log('── Agent ──');
  output.kv('总数', String(totalAgents));
  output.kv('健康', `${healthyCount}/${totalAgents}`);
  if (disabledCount > 0) output.kv('已禁用', String(disabledCount));
  if (untestedCount > 0) output.kv('未检测', String(untestedCount));

  // Agent 明细
  if (agents.length > 0) {
    output.log('');
    const rows = agents.map(a => {
      let status;
      if (a.health && a.health.status === 'disabled') status = 'disabled';
      else if (a.health && a.health.healthy) status = 'healthy';
      else if (a.health && !a.health.healthy) status = 'unhealthy';
      else status = 'untested';
      return { name: a.name, label: a.label, status };
    });
    output.table(rows, ['name', 'label', 'status']);
  }

  // 项目
  output.log('');
  output.log('── 项目 ──');
  output.kv('数量', `${projectCount}`);
  if (projectCount > 0 && !output.isQuietMode()) {
    const projRows = projects.slice(0, 10).map(p => ({
      id: p.id,
      name: p.name,
      path: p.path || '-',
    }));
    output.table(projRows, ['id', 'name', 'path']);
    if (projects.length > 10) {
      output.log(`  ... 还有 ${projects.length - 10} 个项目`);
    }
  }

  // 凭证
  output.log('');
  output.log('── 凭证 ──');
  if (hasApiKey) {
    const masked = creds.apiKey.length > 8
      ? creds.apiKey.slice(0, 4) + '****' + creds.apiKey.slice(-4)
      : '****';
    output.kv('API Key', masked);
    output.kv('Base URL', baseUrl);
  } else {
    output.warn('未配置 API Key (ar credential set --apiKey <key>)');
  }

  // 数据库
  output.log('');
  output.log('── 数据库 ──');
  output.kv('路径', dbPath);
  output.kv('状态', dbExists ? '存在' : '不存在');
}
