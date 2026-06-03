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
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, globalShortcut, dialog } from 'electron';
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
let tray: Tray | null = null;
let isQuitting = false;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// ── Issue #13: 系统托盘 ──

function createTray(): void {
  const iconPath = path.join(__dirname, '..', 'resources', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        showMainWindow();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        if (agentManager) agentManager.kill();
        app.quit();
      },
    },
  ]);

  tray.setToolTip('AgentRouter');
  tray.setContextMenu(contextMenu);

  // 单击托盘图标显示窗口
  tray.on('click', () => {
    showMainWindow();
  });
}

function showMainWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setSkipTaskbar(false);
  }
}

function hideMainWindow(): void {
  if (mainWindow) {
    mainWindow.hide();
    mainWindow.setSkipTaskbar(true);
  }
}

// ── Issue #9: 原生通知 ──

function registerNotificationIpc(): void {
  ipcMain.handle('notification:send', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({ title, body });
      notification.on('click', () => {
        showMainWindow();
      });
      notification.show();
      return true;
    }
    return false;
  });
}

// ── Issue #14: 全局快捷键 ──

function registerGlobalShortcuts(): void {
  // Ctrl+Shift+A 唤出窗口
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    showMainWindow();
  });

  // Ctrl+Shift+H 隐藏窗口
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    hideMainWindow();
  });
}

// ── Issue #12: 应用菜单栏 ──

function createAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: '新建项目', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:newProject') },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit() } },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: '切换主题', accelerator: 'CmdOrCtrl+T', click: () => mainWindow?.webContents.send('menu:toggleTheme') },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'reload', label: '重新加载' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: '关于 AgentRouter',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: 'AgentRouter v0.1.0\nAI 多 Agent 协作平台',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

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

  // M4 #16: 创建所有 Agent 的统一数据目录
  agentManager.ensureAgentDataDirs();

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

  // ── Issue #13: 创建系统托盘 ──
  createTray();

  // ── Issue #12: 创建应用菜单栏 ──
  createAppMenu();

  // ── Issue #9: 注册原生通知 IPC ──
  registerNotificationIpc();

  // ── Issue #14: 注册全局快捷键 ──
  registerGlobalShortcuts();

  // 窗口关闭时隐藏到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (agentManager) {
    agentManager.kill();
  }
  // 有托盘时不自动退出
  if (!tray) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (agentManager) {
    agentManager.kill();
  }
});

app.on('will-quit', () => {
  // Issue #14: 注销全局快捷键
  globalShortcut.unregisterAll();
});
