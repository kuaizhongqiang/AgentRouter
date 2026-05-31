/**
 * AgentRouter — Agent 执行 IPC 处理器
 *
 * 处理 agent:exec, agent:list, agent:kill, agent:doctor
 * 转发事件到渲染进程 + 写入 .jsonl 事件日志
 * 在 completion 事件中解析任务块（PM 拆解模式）
 */
import type { IpcMain, BrowserWindow } from 'electron';
import type { AgentManager } from '../agents/manager';
import type { AgentEvent } from '../agents/adapter';
import { parseTasksFromReply, batchAddTasks } from '../agents/task-parser';

export function registerAgentHandlers(
  ipcMain: IpcMain,
  manager: AgentManager,
  mainWindow: BrowserWindow
): void {
  // 追踪活跃执行上下文（用于任务解析）
  const activeContexts = new Map<string, { sessionId: string; projectId: string; mode?: string }>();

  // 设置事件回调 — 接管 Manager 的事件转发
  manager.setOnEventCallback((agentName: string, event: AgentEvent) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:output', { agent: agentName, event });
    }

    // 副作用：PM 拆解模式的 completion 事件中解析并持久化任务
    if (event.event === 'completion') {
      const ctx = activeContexts.get(agentName);
      if (ctx && ctx.mode === 'PM 拆解') {
        let tasks: Array<{ title: string; assignee?: string; description?: string }> = [];

        // 1) 优先读取 Reasonix 预解析的 tasks（在 completionData.tasks 中）
        const rawTasks = event.data?.tasks;
        if (Array.isArray(rawTasks) && rawTasks.length > 0) {
          tasks = rawTasks.map((t: any) => ({
            title: t.title || '',
            assignee: t.assignee || '',
            description: [
              t.path ? `路径: ${t.path}` : '',
              Array.isArray(t.depends_on) && t.depends_on.length > 0
                ? `依赖: ${t.depends_on.join(', ')}`
                : '',
              t.parallel_group ? `并行组: ${t.parallel_group}` : '',
            ]
              .filter(Boolean)
              .join('; ') || (t.description || ''),
          })).filter(t => t.title);
        }

        // 2) 无预解析任务，回退到从回复文本中解析
        if (tasks.length === 0) {
          const text = String(event.data?.summary || event.data?.content || '');
          if (text) {
            tasks = parseTasksFromReply(text);
          }
        }

        // 3) 入库
        if (tasks.length > 0) {
          batchAddTasks(ctx.sessionId, ctx.projectId, tasks).catch(err => {
            console.error('[TaskParser] Failed to batch add tasks:', err);
          });
        }
      }
    }
  });

  ipcMain.handle('agent:exec', async (_e, payload: {
    agentName: string;
    command: string;
    sessionId: string;
    projectId: string;
    mode?: string;
  }) => {
    const { agentName, command, sessionId, projectId, mode } = payload;

    // 在 exec 启动前注册上下文
    activeContexts.set(agentName, { sessionId, projectId, mode });

    try {
      return await manager.exec(agentName, command, sessionId, projectId, undefined, mode);
    } finally {
      // exec 完成后清理上下文
      activeContexts.delete(agentName);
    }
  });

  ipcMain.handle('agent:list', async () => {
    return manager.list();
  });

  ipcMain.handle('agent:kill', async (_e, agentName?: string) => {
    manager.kill(agentName);
  });

  ipcMain.handle('agent:doctor', async (_e, agentName: string) => {
    return manager.doctor(agentName);
  });
}
