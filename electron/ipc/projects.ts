/**
 * AgentRouter — 项目 CRUD IPC 处理器
 */
import type { IpcMain } from 'electron';
import * as repo from '../database/repository';

export function registerProjectHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('db:listProjects', async () => {
    return repo.listProjects();
  });

  ipcMain.handle('db:createProject', async (_e, name: string, projectPath: string) => {
    return repo.createProject(name, projectPath);
  });

  ipcMain.handle('db:removeProject', async (_e, id: string) => {
    return repo.removeProject(id);
  });

  ipcMain.handle('db:getProject', async (_e, id: string) => {
    return repo.getProject(id);
  });
}
