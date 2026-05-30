/**
 * AgentRouter — IPC 处理器注册入口
 */
import type { IpcMain, BrowserWindow } from 'electron';
import type { AgentManager } from '../agents/manager';
import { registerProjectHandlers } from './projects';
import { registerSessionHandlers } from './sessions';
import { registerMessageHandlers } from './messages';
import { registerTaskHandlers } from './tasks';
import { registerAgentHandlers } from './agents';

export function registerAllHandlers(
  ipcMain: IpcMain,
  manager: AgentManager,
  mainWindow: BrowserWindow
): void {
  registerProjectHandlers(ipcMain);
  registerSessionHandlers(ipcMain);
  registerMessageHandlers(ipcMain);
  registerTaskHandlers(ipcMain);
  registerAgentHandlers(ipcMain, manager, mainWindow);
}
