/**
 * AgentRouter — 项目 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import type { AgentManager } from '../agents/manager';
import * as repo from '../database/repository';
import fs from 'fs';
import path from 'path';

const CONFIG_FILENAME = 'agentrouter.json';

const DEFAULT_PROJECT_CONFIG = {
  defaultAgent: 'codewhale',
  defaultMode: '对话',
  theme: 'dark',
  credentials: null,
};

/** 递归扫描目录下的源文件 */
function scanSourceFiles(dir: string, baseDir: string): Array<{ path: string; name: string; isDir: boolean }> {
  const results: Array<{ path: string; name: string; isDir: boolean }> = [];
  if (!fs.existsSync(dir)) return results;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue // 跳过隐藏文件
      if (entry.name === 'node_modules') continue

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        results.push({ path: relPath, name: entry.name, isDir: true });
        results.push(...scanSourceFiles(fullPath, baseDir));
      } else {
        // 只包含常见的源文件扩展名
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.vue', '.css', '.scss', '.json', '.html', '.md'].includes(ext)) {
          results.push({ path: relPath, name: entry.name, isDir: false });
        }
      }
    }
  } catch { /* skip unreadable dirs */ }

  return results;
}

type SafeHandle = (ipcMain: IpcMain, channel: string, handler: (...args: any[]) => Promise<any>) => void;

export function registerProjectHandlers(ipcMain: IpcMain, manager?: AgentManager, safeHandle?: SafeHandle): void {
  const h = safeHandle ?? ((ipc, channel, handler) => ipc.handle(channel, handler));

  h(ipcMain, 'db:listProjects', async () => {
    return repo.listProjects();
  });

  h(ipcMain, 'db:createProject', async (_e, name: string, projectPath: string) => {
    const project = await repo.createProject(name, projectPath);
    if (manager) {
      try {
        manager.ensureProjectAgentDataDirs(projectPath);
      } catch (err) {
        console.warn('[Project] Failed to init agent data dirs:', err);
      }
    }
    return project;
  });

  h(ipcMain, 'db:removeProject', async (_e, id: string) => {
    return repo.removeProject(id);
  });

  h(ipcMain, 'db:getProject', async (_e, id: string) => {
    return repo.getProject(id);
  });

  h(ipcMain, 'project:initAgentDirs', async (_e, projectPath: string) => {
    if (manager) {
      manager.ensureProjectAgentDataDirs(projectPath);
      return { done: true };
    }
    return { done: false, error: 'Manager not ready' };
  });

  h(ipcMain, 'project:listSourceFiles', async (_e, projectPath: string) => {
    return scanSourceFiles(projectPath, projectPath);
  });

  h(ipcMain, 'project:getConfig', async (_e, projectPath: string) => {
    const configPath = path.join(projectPath, CONFIG_FILENAME);
    try {
      if (!fs.existsSync(configPath)) {
        return DEFAULT_PROJECT_CONFIG;
      }
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      return { ...DEFAULT_PROJECT_CONFIG, ...config };
    } catch {
      return DEFAULT_PROJECT_CONFIG;
    }
  });

  h(ipcMain, 'project:setConfig', async (_e, projectPath: string, config: Record<string, unknown>) => {
    const configPath = path.join(projectPath, CONFIG_FILENAME);
    const merged = { ...DEFAULT_PROJECT_CONFIG, ...config };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
    return { written: true };
  });
}
