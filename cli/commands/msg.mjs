/**
 * AgentRouter CLI — 消息管理命令
 *
 * 用法: ar msg <subcommand> [args...]
 *
 * 子命令:
 *   list <sessionId>      列出会话消息
 *   send <sessionId> <content>  发送消息 (仅写入 DB)
 *
 * 别名: ar message <subcommand> ...
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

const USAGE = `
用法: ar msg <subcommand> [args...]

子命令:
  list <sessionId>         列出会话消息
  send <sessionId> <content>  发送一条用户消息 (仅写入数据库)

选项:
  --json        JSON 格式输出

别名:
  ar message ...            与 ar msg ... 相同
`;

const ROLE_LABELS = {
  user: '👤 用户',
  agent: '🤖 Agent',
  system: '⚙️ 系统',
};

const ROLE_LABELS_PLAIN = {
  user: '[用户]',
  agent: '[Agent]',
  system: '[系统]',
};

export default async function handler(args, options) {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === 'help' || subcommand === '--help') {
    output.log(USAGE);
    return;
  }

  try {
    switch (subcommand) {
      case 'list':
        return await listMessages(rest, options);
      case 'send':
        return await sendMessage(rest, options);
      default:
        output.error(`未知子命令: ${subcommand}`);
        output.log(USAGE);
    }
  } catch (err) {
    output.fatal(`msg ${subcommand} 失败: ${err.message}`);
  }
}

async function listMessages(args, options) {
  const [sessionId] = args;

  if (!sessionId) {
    output.fatal('用法: ar msg list <sessionId>');
  }

  const { repos } = getModules();

  // 验证会话存在
  const session = await repos.getSession(sessionId);
  if (!session) {
    output.fatal(`会话不存在: ${sessionId}`);
  }

  const messages = await repos.listMessages(sessionId);

  if (messages.length === 0) {
    output.log('(没有消息)');
    return;
  }

  if (output.isJsonMode()) {
    output.json(messages);
    return;
  }

  // human 模式: 格式化输出
  for (const msg of messages) {
    const label = ROLE_LABELS_PLAIN[msg.role] || `[${msg.role}]`;
    const time = msg.timestamp ? msg.timestamp.slice(11, 19) : '';
    console.log('');
    console.log(`━━━ ${label} ${time ? `(${time})` : ''} ━━━`);

    // 展示内容预览
    const content = msg.content || '(空)';
    console.log(content);
  }

  console.log('');
  console.log(`共 ${messages.length} 条消息`);
}

async function sendMessage(args, options) {
  const [sessionId, ...contentParts] = args;

  if (!sessionId || contentParts.length === 0) {
    output.fatal('用法: ar msg send <sessionId> <content>');
  }

  const content = contentParts.join(' ');
  const { repos } = getModules();

  // 验证会话存在
  const session = await repos.getSession(sessionId);
  if (!session) {
    output.fatal(`会话不存在: ${sessionId}`);
  }

  const message = await repos.addMessage(sessionId, 'user', content);

  if (output.isJsonMode()) {
    output.json(message);
    return;
  }

  output.success(`消息已发送 (ID: ${message.id})`);
  output.log(`内容: ${content.length > 100 ? content.slice(0, 100) + '…' : content}`);
}
