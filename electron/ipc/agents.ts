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
import fs from 'fs';
import path from 'path';
import os from 'os';

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

    // Phase 5: suggestion 事件 — 按模式分发
    if (event.event === 'suggestion') {
      const ctx = activeContexts.get(agentName);
      if (ctx) {
        if (ctx.mode === 'YOLO') {
          const sent = manager.writeToPm(ctx.sessionId, {
            type: 'event', event: 'suggestion',
            data: event.data, _sender: event._sender,
          });
          if (!sent) {
            console.warn('[Suggestion] PM not available for YOLO, falling back to UI');
            mainWindow.webContents.send('agent:output', {
              agent: agentName, event, _meta: { mode: ctx.mode, paused: false }
            });
          }
        } else {
          const shouldPause = ctx.mode === '审批' || ctx.mode === '逐步';
          mainWindow.webContents.send('agent:output', {
            agent: agentName, event, _meta: { mode: ctx.mode, paused: shouldPause }
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
    context?: import('../agents/adapter').SenderMetadata['context'];
  }) => {
    const { agentName, command, sessionId, projectId, mode, context } = payload;

    // 在 exec 启动前注册上下文
    activeContexts.set(agentName, { sessionId, projectId, mode });

    try {
      return await manager.exec(agentName, command, sessionId, projectId, undefined, mode, context);
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

  // Phase 3: 获取 Agent 标签声明
  ipcMain.handle('agent:manifest', async (_e, agentName: string) => {
    return manager.getManifest(agentName);
  });

  // Phase 6: Session 回放 — 读取 .jsonl 事件文件并逐行返回
  ipcMain.handle('agent:replay', async (_e, sessionId: string, projectId: string) => {
    const eventsDir = path.join(os.homedir(), '.agentrouter', 'projects', projectId, 'sessions', sessionId, 'events');
    if (!fs.existsSync(eventsDir)) return [];

    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.jsonl'));
    const allEvents: AgentEvent[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(eventsDir, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          allEvents.push(JSON.parse(line));
        } catch { /* skip malformed lines */ }
      }
    }

    return allEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  });

  // Phase 5: 用户审批或拒绝 suggestion
  ipcMain.handle('agent:suggestion:respond', async (_e, sessionId: string, approved: boolean) => {
    if (approved) {
      // 用户采纳 → 转发 suggestion 到 PM
      manager.writeToPm(sessionId, { type: 'event', event: 'suggestion:approved', data: {} });
    } else {
      // 用户拒绝 → 通知 PM 忽略
      manager.writeToPm(sessionId, { type: 'event', event: 'suggestion:rejected', data: {} });
    }
    // 通知前端恢复执行
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:output', { _meta: { resume: true, sessionId } });
    }
  });
}
