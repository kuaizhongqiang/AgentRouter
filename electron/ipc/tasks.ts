/**
 * AgentRouter — 任务 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import * as repo from '../database/repository';

type SafeHandle = (ipcMain: IpcMain, channel: string, handler: (...args: any[]) => Promise<any>) => void;

export function registerTaskHandlers(ipcMain: IpcMain, safeHandle?: SafeHandle): void {
  const h = safeHandle ?? ((ipc, channel, handler) => ipc.handle(channel, handler));

  h(ipcMain, 'db:listTasks', async (_e, projectId: string, status?: string) => {
    return repo.listTasks(projectId, status);
  });

  h(ipcMain, 'db:addTask', async (_e, sessionId: string, projectId: string, title: string) => {
    return repo.addTask(sessionId, projectId, title);
  });

  h(ipcMain, 'db:updateTaskStatus', async (_e, id: string, status: string) => {
    return repo.updateTaskStatus(id, status as 'pending' | 'running' | 'completed' | 'archived');
  });

  h(ipcMain, 'db:archiveTask', async (_e, id: string) => {
    return repo.archiveTask(id);
  });

  h(ipcMain, 'db:getTask', async (_e, id: string) => {
    return repo.getTask(id);
  });

  h(ipcMain, 'db:listAgentLogs', async (_e, sessionId: string) => {
    return repo.listAgentLogs(sessionId);
  });

  h(ipcMain, 'db:batchAddTasks', async (_e, sessionId: string, projectId: string, tasks: { title: string; assignee?: string; description?: string }[]) => {
    return repo.batchAddTasks(sessionId, projectId, tasks);
  });

  h(ipcMain, 'db:updateTask', async (_e, id: string, fields: { assignee?: string; status?: string; description?: string }) => {
    return repo.updateTask(id, fields);
  });

  h(ipcMain, 'db:approvePlan', async (_e, sessionId: string) => {
    return repo.approveSessionPlan(sessionId);
  });

  // Phase 6: 记忆系统
  h(ipcMain, 'db:saveMemory', async (_e, projectId: string, agentName: string, key: string, content: string, sessionId?: string) => {
    return repo.saveMemory(projectId, agentName, key, content, sessionId);
  });

  h(ipcMain, 'db:loadMemories', async (_e, projectId: string, agentName: string) => {
    return repo.loadMemories(projectId, agentName);
  });

  h(ipcMain, 'db:deleteMemory', async (_e, id: string) => {
    return repo.deleteMemory(id);
  });

  // Phase 5: 动态任务调整
  h(ipcMain, 'db:updateTaskDescription', async (_e, id: string, description: string) => {
    return repo.updateTask(id, { description });
  });

  h(ipcMain, 'db:addTaskDynamic', async (_e, sessionId: string, projectId: string, title: string, assignee?: string) => {
    return repo.addTask(sessionId, projectId, title);
  });

  h(ipcMain, 'db:cancelTask', async (_e, id: string) => {
    return repo.archiveTask(id);
  });

  // M2: 任务模板 CRUD
  h(ipcMain, 'task-template:list', async () => {
    return repo.getTaskTemplates();
  });

  h(ipcMain, 'task-template:create', async (_e, name: string, description: string, tasks: string) => {
    return repo.createTaskTemplate(name, description, tasks);
  });

  h(ipcMain, 'task-template:delete', async (_e, id: string) => {
    return repo.deleteTaskTemplate(id);
  });
}
