/**
 * AgentRouter — 消息 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import * as repo from '../database/repository';

type SafeHandle = (ipcMain: IpcMain, channel: string, handler: (...args: any[]) => Promise<any>) => void;

export function registerMessageHandlers(ipcMain: IpcMain, safeHandle?: SafeHandle): void {
  const h = safeHandle ?? ((ipc, channel, handler) => ipc.handle(channel, handler));

  h(ipcMain, 'db:listMessages', async (_e, sessionId: string) => {
    return repo.listMessages(sessionId);
  });

  h(ipcMain, 'db:addMessage', async (_e, sessionId: string, role: string, content: string) => {
    return repo.addMessage(sessionId, role as 'user' | 'agent' | 'system', content);
  });
}
