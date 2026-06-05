/**
 * AgentRouter CLI — 记忆管理命令
 *
 * 子命令:
 *   list <projectId>           列出记忆（--agent <name> 过滤）
 *   get  <projectId> <key>     按 key 查找记忆
 *   set  <projectId> <key> <content>  保存记忆（--agent <name>）
 *   rm   <id>                  删除记忆
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

export default async function handler(args, options) {
  const subcommand = args[0];

  try {
    switch (subcommand) {
      case 'list':
        return await cmdList(args[1], options);
      case 'get':
        return await cmdGet(args[1], args[2], options);
      case 'set':
        return await cmdSet(args[1], args[2], args.slice(3).join(' '), options);
      case 'rm':
      case 'remove':
      case 'delete':
        return await cmdRm(args[1]);
      default:
        output.fatal(
          `未知子命令: ${subcommand}\n用法: ar memory list|get|set|rm`
        );
    }
  } catch (err) {
    output.fatal(err.message);
  }
}

async function cmdList(projectId, options) {
  if (!projectId) {
    output.fatal('请提供 projectId\n用法: ar memory list <projectId> [--agent <name>]');
  }

  const { repos, manager } = getModules();
  const agentFilter = options.agent || options.a;

  let agents;
  if (agentFilter) {
    agents = [{ name: agentFilter }];
  } else {
    agents = manager.list();
  }

  const allMemories = [];
  for (const agent of agents) {
    const memories = await repos.loadMemories(projectId, agent.name);
    allMemories.push(...memories);
  }

  // 按 updatedAt 降序排列
  allMemories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (output.isJsonMode()) {
    output.json(allMemories);
    return;
  }

  if (allMemories.length === 0) {
    output.log('(无记忆)');
    return;
  }

  const rows = allMemories.map(m => ({
    id: m.id,
    agentName: m.agentName,
    key: m.key,
    updatedAt: m.updatedAt,
  }));

  output.table(rows, ['id', 'agentName', 'key', 'updatedAt']);
}

async function cmdGet(projectId, key, options) {
  if (!projectId || !key) {
    output.fatal('请提供 projectId 和 key\n用法: ar memory get <projectId> <key>');
  }

  const { repos, manager } = getModules();
  const agents = manager.list();

  for (const agent of agents) {
    const memories = await repos.loadMemories(projectId, agent.name);
    const match = memories.find(m => m.key === key);
    if (match) {
      if (output.isJsonMode()) {
        output.json(match);
        return;
      }
      output.log(`[${match.agentName}] ${match.key}`);
      output.log('');
      output.log(match.content);
      return;
    }
  }

  output.log(`未找到 key 为 "${key}" 的记忆`);
}

async function cmdSet(projectId, key, content, options) {
  if (!projectId || !key) {
    output.fatal('请提供 projectId, key 和 content\n用法: ar memory set <projectId> <key> <content> [--agent <name>]');
  }

  if (!content) {
    output.fatal('请提供记忆内容');
  }

  const { repos } = getModules();
  const agentName = options.agent || options.a || 'cli';

  const memory = await repos.saveMemory(projectId, agentName, key, content);
  output.success(`记忆已保存 (id: ${memory.id})`);
}

async function cmdRm(id) {
  if (!id) {
    output.fatal('请提供记忆 id\n用法: ar memory rm <id>');
  }

  const { repos } = getModules();
  await repos.deleteMemory(id);
  output.success(`记忆已删除 (id: ${id})`);
}
