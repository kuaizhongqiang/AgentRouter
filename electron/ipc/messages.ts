/**
 * AgentRouter — 消息 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import * as repo from '../database/repository';

export function registerMessageHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('db:listMessages', async (_e, sessionId: string) => {
    return repo.listMessages(sessionId);
  });

  ipcMain.handle('db:addMessage', async (_e, sessionId: string, role: string, content: string) => {
    return repo.addMessage(sessionId, role as 'user' | 'agent' | 'system', content);
  });
}
