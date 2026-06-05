/**
 * AgentRouter CLI — agent 命令处理器
 *
 * 用法:
 *   ar agent list                    列出 Agent 及健康状态
 *   ar agent info <name>             查看 Agent 详情
 *   ar agent disable <name>          禁用 Agent
 *   ar agent enable <name>           启用 Agent
 *   ar doctor                        诊断所有 Agent 健康
 *   ar doctor <name>                 诊断单个 Agent
 *   ar kill                          终止所有运行中的 Agent
 *   ar kill <name>                   终止指定 Agent
 *   ar list / ar ls                  agent list 的别名
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

export default async function handler(args, options) {
  const { manager } = getModules();

  // 首参为命令字，ar.mjs 已注入作为 args[0]
  // 例如: ar agent list → args = ['agent', 'list']，取 args[1] 作为 action
  //      ar doctor     → args = ['doctor']，取 args[0] 作为 action
  //      ar kill name  → args = ['kill', 'name']
  //      ar list       → args = ['list']

  const cmd = args[0];

  // 路由表
  switch (cmd) {
    // ── agent list / ar list / ar ls ──
    case 'list':
    case undefined:
    case null: {
      return handleList(manager);
    }

    // ── agent info <name> ──
    case 'info': {
      const name = args[1];
      if (!name) {
        output.fatal('用法: ar agent info <name>');
      }
      return handleInfo(manager, name);
    }

    // ── agent disable <name> ──
    case 'disable': {
      const name = args[1];
      if (!name) {
        output.fatal('用法: ar agent disable <name>');
      }
      return handleDisable(manager, name);
    }

    // ── agent enable <name> ──
    case 'enable': {
      const name = args[1];
      if (!name) {
        output.fatal('用法: ar agent enable <name>');
      }
      return handleEnable(manager, name);
    }

    // ── doctor / doctor <name> ──
    case 'doctor': {
      const name = args[1];
      return name ? handleDoctorSingle(manager, name) : handleDoctorAll(manager);
    }

    // ── kill / kill <name> ──
    case 'kill': {
      const name = args[1];
      return handleKill(manager, name);
    }

    default:
      output.fatal(`未知 agent 子命令: ${cmd}\n可用: list, info, disable, enable, doctor, kill`);
  }
}

// ── 命令实现 ──

/**
 * 列出所有 Agent 及其健康状态
 */
async function handleList(manager) {
  const agents = manager.listWithHealth();

  if (output.isJsonMode()) {
    output.json(agents);
    return;
  }

  if (agents.length === 0) {
    output.log('(无已注册的 Agent)');
    return;
  }

  const rows = agents.map(a => {
    const health = a.health;
    let status = 'unknown';
    if (!health) status = 'untested';
    else if (health.status === 'disabled') status = 'disabled';
    else if (health.healthy) status = 'healthy';
    else status = 'unhealthy';

    return {
      name: a.name,
      label: a.label,
      status,
      version: a.manifest?.identity?.version || '-',
    };
  });

  output.table(rows, ['name', 'label', 'status', 'version']);
}

/**
 * 查看单个 Agent 详情
 */
async function handleInfo(manager, name) {
  const manifest = manager.getManifest(name);
  if (!manifest) {
    output.fatal(`未知 Agent: ${name}`);
  }

  if (output.isJsonMode()) {
    output.json(manifest);
    return;
  }

  output.kv('Name', name);
  output.kv('Label', manifest.identity?.label || '-');
  output.kv('Version', manifest.identity?.version || '-');
  output.kv('Tagline', manifest.tagline || '-');
  output.kv('Best for', (manifest.best_for || []).join(', ') || '-');
  output.kv('Not for', (manifest.not_for || []).join(', ') || '-');
  output.kv('Parallel mode', manifest.execution_model?.parallel_mode || '-');
  output.kv('Max instances', String(manifest.execution_model?.max_instances ?? '-'));
  output.kv('Context window', manifest.context_budget?.context_window || '-');
  output.kv('Can suggest', manifest.capabilities?.can_suggest ? 'yes' : 'no');

  // 健康状态
  const health = manager.getAgentHealth(name);
  if (health) {
    const statusText = health.status === 'disabled' ? 'disabled'
      : health.healthy ? 'healthy'
      : 'unhealthy';
    output.kv('Health', statusText);
    if (health.error) {
      output.kv('Error', health.error);
    }
  }
}

/**
 * 禁用 Agent
 */
async function handleDisable(manager, name) {
  const manifest = manager.getManifest(name);
  if (!manifest) {
    output.fatal(`未知 Agent: ${name}`);
  }
  manager.disableAgent(name);
  output.success(`已禁用 Agent: ${name}`);
}

/**
 * 启用 Agent
 */
async function handleEnable(manager, name) {
  const manifest = manager.getManifest(name);
  if (!manifest) {
    output.fatal(`未知 Agent: ${name}`);
  }
  manager.enableAgent(name);
  output.success(`已启用 Agent: ${name}`);
}

/**
 * 诊断单个 Agent
 */
async function handleDoctorSingle(manager, name) {
  const manifest = manager.getManifest(name);
  if (!manifest) {
    output.fatal(`未知 Agent: ${name}`);
  }

  output.log(`诊断 ${name}...`);
  try {
    const result = await manager.doctor(name);
    if (output.isJsonMode()) {
      output.json({ agent: name, success: true, output: result });
    } else {
      output.success(`${name} 诊断通过`);
      if (result) output.log(result);
    }
  } catch (err) {
    if (output.isJsonMode()) {
      output.json({ agent: name, success: false, error: err.message });
    } else {
      output.error(`诊断失败: ${err.message}`);
    }
  }
}

/**
 * 诊断所有 Agent
 */
async function handleDoctorAll(manager) {
  output.log('诊断所有 Agent ...');
  try {
    const results = await manager.checkAllAgentsHealth();

    if (output.isJsonMode()) {
      output.json(results);
      return;
    }

    const healthy = results.filter(r => r.healthy).length;
    const total = results.length;
    output.log(`结果: ${healthy}/${total} 正常`);

    for (const r of results) {
      if (r.healthy) {
        output.success(`${r.agentName}: OK`);
      } else {
        output.error(`${r.agentName}: FAIL${r.error ? ` — ${r.error}` : ''}`);
      }
    }
  } catch (err) {
    output.fatal(`诊断失败: ${err.message}`);
  }
}

/**
 * 终止 Agent 进程
 */
async function handleKill(manager, name) {
  if (name) {
    const manifest = manager.getManifest(name);
    if (!manifest) {
      output.fatal(`未知 Agent: ${name}`);
    }
    manager.kill(name);
    output.success(`已终止: ${name}`);
  } else {
    manager.kill();
    output.success('已终止所有 Agent');
  }
}
