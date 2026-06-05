/**
 * AgentRouter — 凭证管理 IPC 处理器
 *
 * 提供统一 API Key / Base URL 的读写通道。
 */
import type { IpcMain } from 'electron';
import { getCredentials, setCredentials } from '../credentials';

type SafeHandle = (ipcMain: IpcMain, channel: string, handler: (...args: any[]) => Promise<any>) => void;

export function registerCredentialsHandlers(ipcMain: IpcMain, safeHandle?: SafeHandle): void {
  const h = safeHandle ?? ((ipc, channel, handler) => ipc.handle(channel, handler));

  h(ipcMain, 'credentials:get', async () => {
    return getCredentials();
  });

  h(ipcMain, 'credentials:set', async (_event, creds: { apiKey: string; baseUrl: string }) => {
    setCredentials({
      apiKey: creds.apiKey ?? '',
      baseUrl: creds.baseUrl ?? 'https://api.deepseek.com',
    });
    return { success: true };
  });
}
