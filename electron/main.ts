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
import fs from 'fs';
import { spawn } from 'child_process';
import { app, BrowserWindow, ipcMain } from 'electron';
import { getDatabase } from './database/index';
import { runMigrations } from './database/migrations';
import { AgentManager } from './agents/manager';
import { CodeWhaleAdapter } from './agents/codewhale';
import { ReasonixAdapter } from './agents/reasonix';
import { DeepCodeAdapter } from './agents/deepcode';
import { OpenCodeAdapter } from './agents/opencode';
import { ClineAdapter } from './agents/cline';
import { ContinueAdapter } from './agents/continue';
import { registerAllHandlers } from './ipc/index';

let mainWindow: BrowserWindow | null = null;
let agentManager: AgentManager | null = null;
let mcpServer: import('child_process').ChildProcess | null = null;

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
  agentManager.register(new ReasonixAdapter());
  agentManager.register(new DeepCodeAdapter());
  agentManager.register(new OpenCodeAdapter());
  agentManager.register(new ClineAdapter());
  agentManager.register(new ContinueAdapter());

  // 注册所有 IPC 处理器
  registerAllHandlers(ipcMain, agentManager, mainWindow);

  // Phase 6: 启动 MCP Server（为 CLI Agent 提供文件工具）
  const mcpPath = path.join(__dirname, 'mcp', 'server.js');
  if (fs.existsSync(mcpPath)) {
    mcpServer = spawn('node', [mcpPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });
    mcpServer.stdout?.on('data', (chunk: Buffer) => {
      console.log('[MCP]', chunk.toString().trim());
    });
    mcpServer.stderr?.on('data', (chunk: Buffer) => {
      console.error('[MCP]', chunk.toString().trim());
    });
    console.log('[Main] MCP Server started');
  } else {
    console.warn('[Main] MCP Server not found at', mcpPath);
  }

  // 发送就绪状态（延时确保前端监听器就位）
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      mainWindow?.webContents.send('agent:status', { status: 'online', message: 'AgentRouter 已就绪' });
    }, 500);
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
