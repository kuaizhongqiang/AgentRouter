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
import os from 'os';
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

/** Phase 7 #47: MCP 崩溃重启计数器（最多 3 次） */
let mcpRestartCount = 0;
const MCP_MAX_RESTARTS = 3;

/** Phase 7 #47: MCP 健康检查间隔（ms） */
const MCP_HEARTBEAT_INTERVAL = 30000;

let mcpHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// ── Phase 7 #42: 全局异常捕获 ──

function registerGlobalErrorHandlers(): void {
  process.on('uncaughtException', (err: Error) => {
    console.error('[FATAL] Uncaught Exception:', err);
    // 尝试保存数据库
    try {
      const { saveDatabase } = require('./database/index');
      saveDatabase();
    } catch {
      // 无法保存时静默处理
    }
    // 通知前端
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:error', {
          type: 'uncaughtException',
          message: err.message,
          stack: err.stack,
        });
      }
    } catch {
      // 窗口已销毁
    }
    console.error('[FATAL] Process will exit after uncaught exception');
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
    try {
      const { saveDatabase } = require('./database/index');
      saveDatabase();
    } catch {
      // 静默
    }
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:error', {
          type: 'unhandledRejection',
          message: String(reason),
        });
      }
    } catch {
      // 窗口已销毁
    }
  });
}

// ── Phase 7 #43, #47: MCP 进程管理 ──

function isMcpAlive(): boolean {
  return mcpServer !== null && mcpServer.exitCode === null && !mcpServer.killed;
}

function startMcpServer(): void {
  const mcpPath = path.join(__dirname, 'mcp', 'server.js');
  if (!fs.existsSync(mcpPath)) {
    console.warn('[MCP] Server not found at', mcpPath);
    return;
  }

  try {
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

    // Phase 7 #47: MCP 崩溃自动重启
    mcpServer.on('exit', (code, signal) => {
      console.log(`[MCP] Process exited (code=${code}, signal=${signal})`);
      if (!isQuitting && mcpRestartCount < MCP_MAX_RESTARTS) {
        mcpRestartCount++;
        console.log(`[MCP] Auto-restart attempt ${mcpRestartCount}/${MCP_MAX_RESTARTS}...`);
        setTimeout(startMcpServer, 1000);
      } else if (!isQuitting) {
        console.error('[MCP] Max restarts reached, giving up');
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('agent:status', {
              status: 'error',
              message: 'MCP Server 已崩溃且无法自动恢复，请重启应用',
            });
          }
        } catch { /* ignore */ }
      }
    });

    mcpServer.on('error', (err) => {
      console.error('[MCP] Failed to spawn:', err.message);
    });

    // Phase 7 #47: 健康检查 — 每 30s 检查 MCP 进程存活
    mcpRestartCount = 0;
    startMcpHeartbeat();

    console.log('[MCP] Server started');
  } catch (err) {
    console.error('[MCP] Failed to start:', err);
  }
}

function stopMcpServer(): void {
  stopMcpHeartbeat();
  if (!isMcpAlive()) {
    mcpServer = null;
    return;
  }
  const pid = mcpServer!.pid;
  if (pid) {
    try {
      process.kill(pid, 'SIGTERM');
      // 强制终止回退
      setTimeout(() => {
        try {
          if (mcpServer && mcpServer.exitCode === null) {
            process.kill(pid, 'SIGKILL');
          }
        } catch { /* already dead */ }
      }, 3000);
    } catch { /* may already be dead */ }
  }
  mcpServer = null;
}

function startMcpHeartbeat(): void {
  stopMcpHeartbeat();
  mcpHeartbeatTimer = setInterval(() => {
    if (!isMcpAlive()) {
      console.warn('[MCP] Heartbeat: process not alive');
      if (!isQuitting && mcpRestartCount < MCP_MAX_RESTARTS) {
        mcpRestartCount++;
        console.log(`[MCP] Heartbeat triggered restart ${mcpRestartCount}/${MCP_MAX_RESTARTS}`);
        startMcpServer();
      }
    }
  }, MCP_HEARTBEAT_INTERVAL);
}

function stopMcpHeartbeat(): void {
  if (mcpHeartbeatTimer !== null) {
    clearInterval(mcpHeartbeatTimer);
    mcpHeartbeatTimer = null;
  }
}

// ── Phase 7 #36: LeafWiki 进程管理 ──

let leafWikiProcess: import('child_process').ChildProcess | null = null;
let leafWikiPort = 18963;

function startLeafWiki(): void {
  const leafWikiWrapper = path.join(__dirname, '..', 'agents', 'leafwiki', 'platform.cjs');
  if (!fs.existsSync(leafWikiWrapper)) {
    console.log('[LeafWiki] Wrapper not found at', leafWikiWrapper, '- Wiki disabled');
    return;
  }

  const dataDir = path.join(os.homedir(), '.agentRouter', 'wiki');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    leafWikiProcess = spawn('node', [leafWikiWrapper, 'start', String(leafWikiPort), dataDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    leafWikiProcess.stdout?.on('data', (chunk: Buffer) => {
      console.log('[LeafWiki]', chunk.toString().trim());
    });

    leafWikiProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[LeafWiki]', chunk.toString().trim());
    });

    leafWikiProcess.on('exit', (code) => {
      console.log(`[LeafWiki] Process exited (code=${code})`);
      leafWikiProcess = null;
    });

    console.log('[LeafWiki] Started on port', leafWikiPort);
  } catch (err) {
    console.error('[LeafWiki] Failed to start:', err);
  }
}

function stopLeafWiki(): void {
  if (leafWikiProcess && leafWikiProcess.exitCode === null) {
    try {
      process.kill(leafWikiProcess.pid!, 'SIGTERM');
      setTimeout(() => {
        try {
          if (leafWikiProcess && leafWikiProcess.exitCode === null) {
            process.kill(leafWikiProcess.pid!, 'SIGKILL');
          }
        } catch { /* already dead */ }
      }, 3000);
    } catch { /* may already be dead */ }
  }
  leafWikiProcess = null;
}

// ── Phase 7 #48: 启动状态机 ──

type StartupPhase = 'INIT' | 'AGENT_DOCTOR' | 'SESSION_RESTORE' | 'DATA_INIT' | 'READY';
type StartupError = { phase: StartupPhase; message: string; error: unknown };

function sendStartupStatus(phase: StartupPhase, status: 'running' | 'done' | 'skipped' | 'error', message: string): void {
  console.log(`[Startup] ${phase}: ${status} — ${message}`);
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:startup', { phase, status, message });
    }
  } catch { /* window not ready */ }
}

function sendReadyStatus(): void {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:status', { status: 'online', message: 'AgentRouter 已就绪' });
    }
  } catch { /* window not ready */ }
}

async function runStartupSequence(): Promise<void> {
  const errors: StartupError[] = [];

  // ═══ Phase: INIT — 基础设施 ═══
  sendStartupStatus('INIT', 'running', '正在初始化数据库...');

  try {
    const db = await getDatabase();
    runMigrations(db);
    console.log('[Main] Database initialized');
    sendStartupStatus('INIT', 'done', '数据库已就绪');
  } catch (err) {
    console.error('[Main] Database init failed:', err);
    errors.push({ phase: 'INIT', message: 'Database init failed', error: err });
    sendStartupStatus('INIT', 'error', '数据库初始化失败');
  }

  // ═══ Phase: INIT — Wiki 预热 ═══
  sendStartupStatus('INIT', 'running', '正在预热 Wiki...');
  startLeafWiki();
  sendStartupStatus('INIT', 'done', 'Wiki 预热完成');

  // ═══ Phase: INIT — MCP Server ═══
  sendStartupStatus('INIT', 'running', '正在启动 MCP Server...');
  startMcpServer();
  sendStartupStatus('INIT', 'done', 'MCP Server 已启动');

  // ═══ Phase: DATA_INIT — 数据目录初始化 ═══
  sendStartupStatus('DATA_INIT', 'running', '正在创建 Agent 数据目录...');
  if (agentManager) {
    try {
      agentManager.ensureAgentDataDirs();
      sendStartupStatus('DATA_INIT', 'done', 'Agent 数据目录已就绪');
    } catch (err) {
      errors.push({ phase: 'DATA_INIT', message: 'Failed to create data dirs', error: err });
      sendStartupStatus('DATA_INIT', 'error', '部分数据目录创建失败');
    }
  }

  // ═══ Phase: AGENT_DOCTOR — Agent 存活检测 ═══
  sendStartupStatus('AGENT_DOCTOR', 'running', '正在检测 Agent 状态...');
  if (agentManager) {
    try {
      const healthResults = await agentManager.checkAllAgentsHealth();
      const healthyCount = healthResults.filter(h => h.healthy).length;
      sendStartupStatus('AGENT_DOCTOR', 'done', `已检测 ${healthResults.length} 个 Agent，${healthyCount} 个正常`);
    } catch (err) {
      errors.push({ phase: 'AGENT_DOCTOR', message: 'Agent health check failed', error: err });
      sendStartupStatus('AGENT_DOCTOR', 'error', 'Agent 状态检测异常');
    }
  }

  // ═══ Phase: SESSION_RESTORE — 会话恢复主要是前端职责，后端提供数据支持 ═══
  sendStartupStatus('SESSION_RESTORE', 'skipped', '会话恢复由前端处理');

  // ═══ Phase: READY — 就绪 ═══
  if (errors.length > 0) {
    sendStartupStatus('READY', 'done', `启动完成（${errors.length} 个警告，详见日志）`);
  } else {
    sendStartupStatus('READY', 'done', 'AgentRouter 已完全就绪');
  }

  sendReadyStatus();
}

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

// Phase 7 #42: 注册全局异常捕获（在所有事件之前）
registerGlobalErrorHandlers();

app.whenReady().then(async () => {
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

  // 注册所有 IPC 处理器（必须在启动序列之前，以便前端能接收 app:startup 事件）
  registerAllHandlers(ipcMain, agentManager, mainWindow);

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

  // Phase 7 #48: 页面加载完成后启动状态机
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      runStartupSequence().catch((err) => {
        console.error('[Startup] Sequence failed:', err);
        sendReadyStatus();
      });
    }, 300);
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
  // Phase 7 #43: 清理后台子进程
  stopMcpServer();
  stopLeafWiki();
});

app.on('will-quit', () => {
  // Issue #14: 注销全局快捷键
  globalShortcut.unregisterAll();
});
