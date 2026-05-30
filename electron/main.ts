/**
 * AgentRouter — Electron 主进程入口
 *
 * 职责:
 * - 窗口管理
 * - 数据库初始化 + 迁移
 * - IPC 处理器注册
 * - Agent 管理器初始化
 */
import path from 'path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { getDatabase } from './database/index';
import { runMigrations } from './database/migrations';
import { AgentManager } from './agents/manager';
import { CodeWhaleAdapter } from './agents/codewhale';
import { registerAllHandlers } from './ipc/index';

let mainWindow: BrowserWindow | null = null;
let agentManager: AgentManager | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

app.whenReady().then(async () => {
  // 初始化数据库
  try {
    const db = await getDatabase();
    runMigrations(db);
    console.log('[Main] Database initialized');
  } catch (err) {
    console.error('[Main] Database init failed:', err);
  }

  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'AgentRouter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 加载页面
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 初始化 Agent 管理器
  agentManager = new AgentManager(mainWindow);
  agentManager.register(new CodeWhaleAdapter());

  // 注册所有 IPC 处理器
  registerAllHandlers(ipcMain, agentManager, mainWindow);

  // 发送就绪状态
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('agent:status', { status: 'online', message: 'AgentRouter 已就绪' });
  });
});

app.on('window-all-closed', () => {
  if (agentManager) {
    agentManager.kill();
  }
  app.quit();
});

app.on('before-quit', () => {
  if (agentManager) {
    agentManager.kill();
  }
});
