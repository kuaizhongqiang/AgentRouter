/**
 * AgentRouter — IPC 处理器注册入口
 *
 * 所有 ipcMain.handle 通过 safeHandle 包装，提供统一的错误捕获和友好提示。
 */
import type { IpcMain, BrowserWindow } from 'electron';
import type { AgentManager } from '../agents/manager';
import { registerProjectHandlers } from './projects';
import { registerSessionHandlers } from './sessions';
import { registerMessageHandlers } from './messages';
import { registerTaskHandlers } from './tasks';
import { registerAgentHandlers } from './agents';
import { registerCredentialsHandlers } from './credentials';

/** 常见错误 → 友好中文提示映射 */
const ERROR_MESSAGES: Record<string, string> = {
  ENOENT: '文件或目录不存在，请检查路径配置',
  ECONNREFUSED: '连接被拒绝，请检查服务是否正在运行',
  ECONNRESET: '连接被重置，请检查网络状态',
  ETIMEDOUT: '连接超时，请检查网络或服务状态',
  EACCES: '权限不足，请检查文件/目录权限',
  EPERM: '权限不足，请以管理员身份运行',
  ENOTFOUND: 'DNS 解析失败，请检查网络连接',
  EEXIST: '文件或目录已存在',
  ENOSPC: '磁盘空间不足',
  'Unknown agent': '未知的 Agent，请检查 Agent 名称是否正确',
  'Session not found': '会话不存在或已被删除',
  'Project not found': '项目不存在或已被删除',
};

/** 将原始错误转为用户友好提示 */
function formatUserError(message: string): string {
  for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(key)) return friendly;
  }
  // 截断过长的技术错误
  if (message.length > 120) return message.slice(0, 117) + '...';
  return message;
}

/** 带错误捕获的 IPC 处理程序包装器 */
function safeHandle(ipcMain: IpcMain, channel: string, handler: (...args: any[]) => Promise<any>): void {
  ipcMain.handle(channel, async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[IPC Error] ${channel}:`, message);
      if (err instanceof Error && err.stack) {
        console.error(`[IPC Error] Stack:`, err.stack.split('\n').slice(0, 4).join('\n'));
      }
      throw new Error(formatUserError(message));
    }
  });
}

export function registerAllHandlers(
  ipcMain: IpcMain,
  manager: AgentManager,
  mainWindow: BrowserWindow
): void {
  // 传入 safeHandle 替代原始 ipcMain，使各模块能使用统一包装
  registerProjectHandlers(ipcMain, manager, safeHandle);
  registerSessionHandlers(ipcMain, safeHandle);
  registerMessageHandlers(ipcMain, safeHandle);
  registerTaskHandlers(ipcMain, safeHandle);
  registerAgentHandlers(ipcMain, manager, mainWindow, safeHandle);
  registerCredentialsHandlers(ipcMain, safeHandle);
}
