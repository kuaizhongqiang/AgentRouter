/**
 * AgentRouter — 任务 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import * as repo from '../database/repository';

export function registerTaskHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('db:listTasks', async (_e, projectId: string, status?: string) => {
    return repo.listTasks(projectId, status);
  });

  ipcMain.handle('db:addTask', async (_e, sessionId: string, projectId: string, title: string) => {
    return repo.addTask(sessionId, projectId, title);
  });

  ipcMain.handle('db:updateTaskStatus', async (_e, id: string, status: string) => {
    return repo.updateTaskStatus(id, status as 'pending' | 'running' | 'completed' | 'archived');
  });

  ipcMain.handle('db:archiveTask', async (_e, id: string) => {
    return repo.archiveTask(id);
  });

  ipcMain.handle('db:getTask', async (_e, id: string) => {
    return repo.getTask(id);
  });

  ipcMain.handle('db:listAgentLogs', async (_e, sessionId: string) => {
    return repo.listAgentLogs(sessionId);
  });

  ipcMain.handle('db:batchAddTasks', async (_e, sessionId: string, projectId: string, tasks: { title: string; assignee?: string; description?: string }[]) => {
    return repo.batchAddTasks(sessionId, projectId, tasks);
  });

  ipcMain.handle('db:updateTask', async (_e, id: string, fields: { assignee?: string; status?: string; description?: string }) => {
    return repo.updateTask(id, fields);
  });

  ipcMain.handle('db:approvePlan', async (_e, sessionId: string) => {
    return repo.approveSessionPlan(sessionId);
  });

  // Phase 6: 记忆系统
  ipcMain.handle('db:saveMemory', async (_e, projectId: string, agentName: string, key: string, content: string, sessionId?: string) => {
    return repo.saveMemory(projectId, agentName, key, content, sessionId);
  });

  ipcMain.handle('db:loadMemories', async (_e, projectId: string, agentName: string) => {
    return repo.loadMemories(projectId, agentName);
  });

  ipcMain.handle('db:deleteMemory', async (_e, id: string) => {
    return repo.deleteMemory(id);
  });

  // Phase 5: 动态任务调整
  ipcMain.handle('db:updateTaskDescription', async (_e, id: string, description: string) => {
    return repo.updateTask(id, { description });
  });

  ipcMain.handle('db:addTaskDynamic', async (_e, sessionId: string, projectId: string, title: string, assignee?: string) => {
    return repo.addTask(sessionId, projectId, title);
  });

  ipcMain.handle('db:cancelTask', async (_e, id: string) => {
    return repo.archiveTask(id);
  });

  // M2: 任务模板 CRUD
  ipcMain.handle('task-template:list', async () => {
    return repo.getTaskTemplates();
  });

  ipcMain.handle('task-template:create', async (_e, name: string, description: string, tasks: string) => {
    return repo.createTaskTemplate(name, description, tasks);
  });

  ipcMain.handle('task-template:delete', async (_e, id: string) => {
    return repo.deleteTaskTemplate(id);
  });
}
