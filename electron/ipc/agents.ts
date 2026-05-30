/**
 * AgentRouter — Agent 执行 IPC 处理器
 *
 * 处理 agent:exec, agent:list, agent:kill, agent:doctor
 * 转发事件到渲染进程 + 写入 .jsonl 事件日志
 */
import type { IpcMain, BrowserWindow } from 'electron';
import type { AgentManager } from '../agents/manager';
import type { AgentEvent } from '../agents/adapter';

export function registerAgentHandlers(
  ipcMain: IpcMain,
  manager: AgentManager,
  mainWindow: BrowserWindow
): void {
  // 设置事件回调 — 接管 Manager 的事件转发
  manager.setOnEventCallback((agentName: string, event: AgentEvent) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:output', { agent: agentName, event });
    }
  });

  ipcMain.handle('agent:exec', async (_e, payload: {
    agentName: string;
    command: string;
    sessionId: string;
    projectId: string;
    mode?: string;
  }) => {
    const { agentName, command, sessionId, projectId, mode } = payload;
    return manager.exec(agentName, command, sessionId, projectId, undefined, mode);
  });

  ipcMain.handle('agent:list', async () => {
    return manager.list();
  });

  ipcMain.handle('agent:kill', async (_e, agentName?: string) => {
    manager.kill(agentName);
  });

  ipcMain.handle('agent:doctor', async (_e, agentName: string) => {
    return manager.doctor(agentName);
  });
}
