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
}
