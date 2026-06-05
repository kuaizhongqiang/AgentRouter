/**
 * AgentRouter — 会话 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import * as repo from '../database/repository';

type SafeHandle = (ipcMain: IpcMain, channel: string, handler: (...args: any[]) => Promise<any>) => void;

export function registerSessionHandlers(ipcMain: IpcMain, safeHandle?: SafeHandle): void {
  const h = safeHandle ?? ((ipc, channel, handler) => ipc.handle(channel, handler));

  h(ipcMain, 'db:listSessions', async (_e, projectId: string) => {
    return repo.listSessions(projectId);
  });

  h(ipcMain, 'db:createSession', async (_e, projectId: string, title?: string, agentType?: string) => {
    return repo.createSession(projectId, title, agentType);
  });

  h(ipcMain, 'db:removeSession', async (_e, id: string) => {
    return repo.removeSession(id);
  });

  h(ipcMain, 'db:renameSession', async (_e, id: string, title: string) => {
    return repo.renameSession(id, title);
  });

  h(ipcMain, 'db:getSession', async (_e, id: string) => {
    return repo.getSession(id);
  });
}
