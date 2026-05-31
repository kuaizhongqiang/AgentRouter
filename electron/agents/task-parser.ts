/**
 * AgentRouter — 任务块解析器
 *
 * 从 Agent 回复文本中解析结构化任务列表。
 * 支持三种格式（按优先级）：
 *   1. ```tasks JSON 代码块
 *   2. ```json 代码块（含 tasks 数组）
 *   3. Markdown 复选框列表
 */

import { getDatabase, saveDatabase } from '../database/index';

export interface TaskSpec {
  title: string;
  assignee?: string;
  description?: string;
}

/**
 * 从 Agent 回复文本中解析任务列表。
 *
 * 优先级:
 *   1. ```tasks JSON 代码块
 *   2. ```json 代码块（含 tasks 数组）
 *   3. Markdown 复选框列表（忽略 [x] 已完成项）
 *
 * 未找到任务返回空数组。
 */
export function parseTasksFromReply(text: string): TaskSpec[] {
  const tasks: TaskSpec[] = [];

  // Strategy 1: ```tasks code block with JSON
  const tasksBlockMatch = text.match(/```tasks\s*\n([\s\S]*?)```/);
  if (tasksBlockMatch) {
    try {
      const parsed = JSON.parse(tasksBlockMatch[1].trim());
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        const result = parsed.tasks
          .map((t: any) => ({
            title: t.title || '',
            assignee: t.assignee || '',
            description: t.description || '',
          }))
          .filter((t: TaskSpec) => t.title);
        if (result.length > 0) return result;
      }
    } catch (e) {
      console.warn('[TaskParser] Failed to parse ```tasks block:', e);
    }
  }

  // Strategy 2: ```json code block
  const jsonBlockMatch = text.match(/```json\s*\n([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      // Format A: { tasks: [...] }
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        const result = parsed.tasks
          .map(normalizeTask)
          .filter((t: TaskSpec) => t.title);
        if (result.length > 0) return result;
      }
      // Format B: bare array [...] (used by Reasonix PM mode)
      if (Array.isArray(parsed)) {
        const result = parsed
          .map(normalizeTask)
          .filter((t: TaskSpec) => t.title);
        if (result.length > 0) return result;
      }
    } catch (e) {
      console.warn('[TaskParser] Failed to parse ```json block:', e);
    }
  }

  // Strategy 3: Markdown checkbox list
  // Matches: - [ ] title @assignee — description
  // Ignores: - [x] completed task @assignee — description
  const checkboxRegex = /-\s\[[ x]\]\s+([^@\n]+?)(?:\s*@(\w+))?(?:\s*[—–-]+\s*(.*))?\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = checkboxRegex.exec(text)) !== null) {
    const title = match[1].trim();
    if (title && !match[0].includes('[x]') && !match[0].includes('[X]')) {
      tasks.push({
        title,
        assignee: match[2] || '',
        description: (match[3] || '').trim(),
      });
    }
  }

  return tasks;
}

/**
 * 规范化任务对象：将 Reasonix/通用格式映射为 TaskSpec。
 *
 * 支持的输入格式:
 *   { title, assignee?, description? }
 *   { id, title, assignee?, path?, depends_on?, parallel_group? }  (Reasonix PM)
 */
function normalizeTask(t: any): TaskSpec {
  const description = t.description || '';
  const extra = [
    t.path ? `路径: ${t.path}` : '',
    Array.isArray(t.depends_on) && t.depends_on.length > 0
      ? `依赖: ${t.depends_on.join(', ')}`
      : '',
    t.parallel_group ? `并行组: ${t.parallel_group}` : '',
  ]
    .filter(Boolean)
    .join('; ');

  return {
    title: t.title || '',
    assignee: t.assignee || '',
    description: extra ? (description ? `${description}\n${extra}` : extra) : description,
  };
}

/**
 * 批量添加任务到数据库。
 * 作为副作用操作 —— 不阻塞主流程。
 *
 * @param sessionId  当前会话 ID
 * @param projectId  当前项目 ID
 * @param tasks      待插入的任务列表
 */
export async function batchAddTasks(
  sessionId: string,
  projectId: string,
  tasks: TaskSpec[]
): Promise<void> {
  if (tasks.length === 0) return;

  const db = await getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(
    `INSERT INTO tasks (id, sessionId, projectId, title, assignee, description, sort_order, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  );

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    stmt.run([id, sessionId, projectId, t.title, t.assignee || '', t.description || '', i, now, now]);
  }

  stmt.free();
  saveDatabase();

  console.log(`[TaskParser] Inserted ${tasks.length} task(s) for session ${sessionId}`);
}
