/**
 * AgentRouter CLI — 任务管理命令
 *
 * 用法: ar task <subcommand> [args...]
 *
 * 子命令:
 *   list <projectId>            列出任务 (--status 过滤)
 *   show <id>                   查看任务详情
 *   add <sessionId> <projectId> <title>  添加任务
 *   update <id> --status <s>    更新任务状态
 *   approve <sessionId>         批准会话计划 (审批模式)
 *   batch <sessionId> <projectId> <json>  批量添加任务
 *   summarize <sessionId>       显示完成任务汇总
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

const USAGE = `
用法: ar task <subcommand> [args...]

子命令:
  list <projectId>              列出任务 (--status <status> 过滤)
  show <id>                     查看任务详情
  add <sessionId> <projectId> <title>  添加任务
  update <id> --status <status> 更新任务状态
  approve <sessionId>           批准计划 (审批模式)
  batch <sessionId> <projectId> <json>  批量添加任务 (JSON 字符串)
  summarize <sessionId>         显示完成任务汇总

选项:
  --json        JSON 格式输出
  --status      状态过滤 (pending|running|completed|archived)

示例:
  ar task list proj123
  ar task list proj123 --status pending
  ar task task123 --json
  ar task batch sess456 proj123 '[{"title":"任务1"},{"title":"任务2"}]'
`;

const STATUS_LABELS = {
  pending: '待处理',
  running: '进行中',
  completed: '已完成',
  archived: '已归档',
};

export default async function handler(args, options) {
  const [subcommand, ...rest] = args;

  // 没有子命令时，尝试默认行为: 如果 args[0] 看起来像 projectId 则 list
  if (!subcommand || subcommand === 'help' || subcommand === '--help') {
    output.log(USAGE);
    return;
  }

  try {
    switch (subcommand) {
      case 'list':
        return await listTasks(rest, options);
      case 'show':
        return await showTask(rest, options);
      case 'add':
        return await addTask(rest, options);
      case 'update':
        return await updateTask(rest, options);
      case 'approve':
        return await approveTasks(rest, options);
      case 'batch':
        return await batchAddTasks(rest, options);
      case 'summarize':
        return await summarizeTasks(rest, options);
      default:
        // 如果没有子命令且第一个参数可能是 projectId, 尝试作为 list
        if (subcommand && !rest.length) {
          // 假设用户输入了 projectId 作为唯一参数
          return await listTasks([subcommand, ...rest], options);
        }
        output.error(`未知子命令: ${subcommand}`);
        output.log(USAGE);
    }
  } catch (err) {
    output.fatal(`task ${subcommand} 失败: ${err.message}`);
  }
}

async function listTasks(args, options) {
  const [projectId] = args;

  if (!projectId) {
    output.fatal('用法: ar task list <projectId> [--status <status>]');
  }

  const { repos } = getModules();

  // 验证项目存在
  const project = await repos.getProject(projectId);
  if (!project) {
    output.fatal(`项目不存在: ${projectId}`);
  }

  const statusFilter = options.status || options.s || undefined;
  const tasks = await repos.listTasks(projectId, statusFilter);

  if (tasks.length === 0) {
    output.log(statusFilter
      ? `(没有状态为 "${statusFilter}" 的任务)`
      : '(没有任务)');
    return;
  }

  if (output.isJsonMode()) {
    output.json(tasks);
    return;
  }

  const rows = tasks.map(t => ({
    id: t.id,
    title: t.title.length > 60 ? t.title.slice(0, 60) + '…' : t.title,
    status: STATUS_LABELS[t.status] || t.status,
    assignee: t.assignee || '-',
    updatedAt: t.updatedAt,
  }));
  output.table(rows, ['id', 'title', 'status', 'assignee', 'updatedAt']);
}

async function showTask(args, options) {
  const [id] = args;

  if (!id) {
    output.fatal('用法: ar task show <id>');
  }

  const { repos } = getModules();
  const task = await repos.getTask(id);

  if (!task) {
    output.fatal(`任务不存在: ${id}`);
  }

  if (output.isJsonMode()) {
    output.json(task);
    return;
  }

  output.kv('ID', task.id);
  output.kv('标题', task.title);
  output.kv('描述', task.description || '(无)');
  output.kv('状态', STATUS_LABELS[task.status] || task.status);
  output.kv('负责人', task.assignee || '(未指派)');
  output.kv('排序', String(task.sort_order));
  output.kv('会话 ID', task.sessionId);
  output.kv('项目 ID', task.projectId);
  output.kv('创建时间', task.createdAt);
  output.kv('更新时间', task.updatedAt);
}

async function addTask(args, options) {
  const [sessionId, projectId, ...titleParts] = args;

  if (!sessionId || !projectId || titleParts.length === 0) {
    output.fatal('用法: ar task add <sessionId> <projectId> <title>');
  }

  const title = titleParts.join(' ');
  const { repos } = getModules();

  const task = await repos.addTask(sessionId, projectId, title);

  if (output.isJsonMode()) {
    output.json(task);
    return;
  }

  output.success(`任务已添加 (ID: ${task.id}, 标题: ${title})`);
}

async function updateTask(args, options) {
  const [id] = args;

  if (!id) {
    output.fatal('用法: ar task update <id> --status <status>');
  }

  const status = options.status || options.s;
  if (!status) {
    output.fatal('用法: ar task update <id> --status <status>');
  }

  const validStatuses = ['pending', 'running', 'completed', 'archived'];
  if (!validStatuses.includes(status)) {
    output.fatal(`无效状态: "${status}"。有效值: ${validStatuses.join(', ')}`);
  }

  const { repos } = getModules();

  const task = await repos.getTask(id);
  if (!task) {
    output.fatal(`任务不存在: ${id}`);
  }

  await repos.updateTaskStatus(id, status);

  if (output.isJsonMode()) {
    output.json({ id, status, previousStatus: task.status });
    return;
  }

  output.success(`任务状态已更新: "${task.title}" → ${STATUS_LABELS[status] || status}`);
}

async function approveTasks(args, options) {
  const [sessionId] = args;

  if (!sessionId) {
    output.fatal('用法: ar task approve <sessionId>');
  }

  const { repos } = getModules();

  // 验证会话存在
  const session = await repos.getSession(sessionId);
  if (!session) {
    output.fatal(`会话不存在: ${sessionId}`);
  }

  await repos.approveSessionPlan(sessionId);

  if (output.isJsonMode()) {
    output.json({ sessionId, approved: true });
    return;
  }

  output.success(`会话 "${session.title}" 的计划已批准，所有待处理任务已转为运行中`);
}

async function batchAddTasks(args, options) {
  const [sessionId, projectId, ...jsonParts] = args;

  if (!sessionId || !projectId || jsonParts.length === 0) {
    output.fatal('用法: ar task batch <sessionId> <projectId> <json>');
  }

  const jsonStr = jsonParts.join(' ');

  let tasks;
  try {
    tasks = JSON.parse(jsonStr);
  } catch (_) {
    output.fatal('JSON 解析失败，请提供有效的 JSON 数组字符串');
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    output.fatal('JSON 必须是非空数组，格式: [{ "title": "..." }, ...]');
  }

  // 验证每个任务项
  for (const t of tasks) {
    if (!t.title) {
      output.fatal('每个任务必须包含 title 字段');
    }
  }

  const { repos } = getModules();

  // 验证项目和会话存在
  const [project, session] = await Promise.all([
    repos.getProject(projectId),
    repos.getSession(sessionId),
  ]);

  if (!project) {
    output.fatal(`项目不存在: ${projectId}`);
  }
  if (!session) {
    output.fatal(`会话不存在: ${sessionId}`);
  }

  const created = await repos.batchAddTasks(sessionId, projectId, tasks);

  if (output.isJsonMode()) {
    output.json(created);
    return;
  }

  output.success(`已批量添加 ${created.length} 个任务`);
}

async function summarizeTasks(args, options) {
  const [sessionId] = args;

  if (!sessionId) {
    output.fatal('用法: ar task summarize <sessionId>');
  }

  const { repos } = getModules();

  const session = await repos.getSession(sessionId);
  if (!session) {
    output.fatal(`会话不存在: ${sessionId}`);
  }

  // 获取会话的所有任务
  const allTasks = await repos.listTasks(session.projectId);

  // 筛选属于该会话的任务
  const sessionTasks = allTasks.filter(t => t.sessionId === sessionId);

  if (sessionTasks.length === 0) {
    output.log('(该会话没有任务)');
    return;
  }

  const total = sessionTasks.length;
  const completed = sessionTasks.filter(t => t.status === 'completed').length;
  const running = sessionTasks.filter(t => t.status === 'running').length;
  const pending = sessionTasks.filter(t => t.status === 'pending').length;
  const archived = sessionTasks.filter(t => t.status === 'archived').length;

  if (output.isJsonMode()) {
    output.json({ total, completed, running, pending, archived, tasks: sessionTasks });
    return;
  }

  output.kv('会话', session.title);
  output.kv('任务总数', String(total));
  output.kv('已完成', String(completed));
  output.kv('进行中', String(running));
  output.kv('待处理', String(pending));
  output.kv('已归档', String(archived));

  if (total > 0) {
    const pct = Math.round((completed / total) * 100);
    output.kv('完成进度', `${pct}%`);
  }

  // 列出已完成任务
  const doneTasks = sessionTasks.filter(t => t.status === 'completed');
  if (doneTasks.length > 0) {
    output.log('');
    output.log('已完成任务:');
    for (const t of doneTasks) {
      output.log(`  [${t.id}] ${t.title}`);
    }
  }
}
