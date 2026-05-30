/**
 * AgentRouter — 会话 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import * as repo from '../database/repository';

export function registerSessionHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('db:listSessions', async (_e, projectId: string) => {
    return repo.listSessions(projectId);
  });

  ipcMain.handle('db:createSession', async (_e, projectId: string, title?: string, agentType?: string) => {
    return repo.createSession(projectId, title, agentType);
  });

  ipcMain.handle('db:removeSession', async (_e, id: string) => {
    return repo.removeSession(id);
  });

  ipcMain.handle('db:renameSession', async (_e, id: string, title: string) => {
    return repo.renameSession(id, title);
  });

  ipcMain.handle('db:getSession', async (_e, id: string) => {
    return repo.getSession(id);
  });
}
