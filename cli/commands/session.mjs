/**
 * AgentRouter CLI — 会话管理命令
 *
 * 用法: ar session <subcommand> [args...]
 *
 * 子命令:
 *   list <projectId>       列出项目的所有会话
 *   create <projectId> [title]  创建新会话
 *   show <id>              查看会话详情
 *   rename <id> <title>    重命名会话
 *   rm <id>                删除会话
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

const USAGE = `
用法: ar session <subcommand> [args...]

子命令:
  list <projectId>              列出项目会话
  create <projectId> [title]    创建新会话
  show <id>                     查看会话详情
  rename <id> <title>           重命名会话
  rm <id>                       删除会话 (--yes 跳过确认)

选项:
  --json        JSON 格式输出
  --yes         自动确认
`;

export default async function handler(args, options) {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === 'help' || subcommand === '--help') {
    output.log(USAGE);
    return;
  }

  try {
    switch (subcommand) {
      case 'list':
        return await listSessions(rest, options);
      case 'create':
        return await createSession(rest, options);
      case 'show':
        return await showSession(rest, options);
      case 'rename':
        return await renameSession(rest, options);
      case 'rm':
      case 'remove':
      case 'delete':
        return await removeSession(rest, options);
      default:
        output.error(`未知子命令: ${subcommand}`);
        output.log(USAGE);
    }
  } catch (err) {
    output.fatal(`session ${subcommand} 失败: ${err.message}`);
  }
}

async function listSessions(args, options) {
  const [projectId] = args;

  if (!projectId) {
    output.fatal('用法: ar session list <projectId>');
  }

  const { repos } = getModules();

  // 验证项目存在
  const project = await repos.getProject(projectId);
  if (!project) {
    output.fatal(`项目不存在: ${projectId}`);
  }

  const sessions = await repos.listSessions(projectId);

  if (sessions.length === 0) {
    output.log('(没有会话)');
    return;
  }

  if (output.isJsonMode()) {
    output.json(sessions);
    return;
  }

  const rows = sessions.map(s => ({
    id: s.id,
    title: s.title,
    type: s.type,
    agentType: s.agentType,
    updatedAt: s.updatedAt,
  }));
  output.table(rows, ['id', 'title', 'type', 'agentType', 'updatedAt']);
}

async function createSession(args, options) {
  const [projectId, title] = args;

  if (!projectId) {
    output.fatal('用法: ar session create <projectId> [title]');
  }

  const { repos } = getModules();

  // 验证项目存在
  const project = await repos.getProject(projectId);
  if (!project) {
    output.fatal(`项目不存在: ${projectId}`);
  }

  const session = await repos.createSession(projectId, title || '新对话', 'chat');

  if (output.isJsonMode()) {
    output.json(session);
    return;
  }

  output.success(`会话已创建 (ID: ${session.id}, 标题: ${session.title})`);
}

async function showSession(args, options) {
  const [id] = args;

  if (!id) {
    output.fatal('用法: ar session show <id>');
  }

  const { repos } = getModules();
  const session = await repos.getSession(id);

  if (!session) {
    output.fatal(`会话不存在: ${id}`);
  }

  if (output.isJsonMode()) {
    output.json(session);
    return;
  }

  output.kv('ID', session.id);
  output.kv('项目 ID', session.projectId);
  output.kv('标题', session.title);
  output.kv('类型', session.type);
  output.kv('Agent 类型', session.agentType);
  output.kv('创建时间', session.createdAt);
  output.kv('更新时间', session.updatedAt);

  // 附带消息数
  const messages = await repos.listMessages(id);
  output.kv('消息数', String(messages.length));

  // 附带 Token 用量
  try {
    const tokenUsage = await repos.getSessionTokenUsage(id);
    output.kv('Token 用量', `${tokenUsage.totalTokens} (提示: ${tokenUsage.totalPromptTokens}, 补全: ${tokenUsage.totalCompletionTokens})`);
  } catch (_) {
    // Token 查询可选
  }
}

async function renameSession(args, options) {
  const [id, title] = args;

  if (!id || !title) {
    output.fatal('用法: ar session rename <id> <title>');
  }

  const { repos } = getModules();

  const session = await repos.getSession(id);
  if (!session) {
    output.fatal(`会话不存在: ${id}`);
  }

  await repos.renameSession(id, title);
  output.success(`会话已重命名为 "${title}"`);
}

async function removeSession(args, options) {
  const [id] = args;

  if (!id) {
    output.fatal('用法: ar session rm <id> [--yes]');
  }

  const { repos } = getModules();
  const session = await repos.getSession(id);

  if (!session) {
    output.fatal(`会话不存在: ${id}`);
  }

  if (!options.yes && !options.y) {
    output.warn(`将永久删除会话 "${session.title}" (ID: ${id}) 及其所有消息和任务。`);
    output.warn('使用 --yes 跳过确认。');
    output.fatal('请添加 --yes 参数确认删除。');
  }

  await repos.removeSession(id);
  output.success(`会话 "${session.title}" 已删除`);
}
