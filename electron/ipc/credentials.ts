/**
 * AgentRouter — 凭证管理 IPC 处理器
 *
 * 提供统一 API Key / Base URL 的读写通道。
 */
import type { IpcMain } from 'electron';
import { getCredentials, setCredentials } from '../credentials';

export function registerCredentialsHandlers(ipcMain: IpcMain): void {
  /**
   * 读取凭证
   */
  ipcMain.handle('credentials:get', () => {
    return getCredentials();
  });

  /**
   * 保存凭证
   */
  ipcMain.handle('credentials:set', (_event, creds: { apiKey: string; baseUrl: string }) => {
    setCredentials({
      apiKey: creds.apiKey ?? '',
      baseUrl: creds.baseUrl ?? 'https://api.deepseek.com',
    });
    return { success: true };
  });
}
