/**
 * AgentRouter — preload 脚本
 *
 * 通过 contextBridge 向渲染进程暴露安全 API:
 * - window.agent.* — Agent 执行、列表、事件订阅、kill
 * - window.db.* — 数据库 CRUD 操作
 */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// ── Agent API ──

contextBridge.exposeInMainWorld('agent', {
  /**
   * 执行 Agent 命令
   * @param agentName  Agent 名称 (如 'codewhale')
   * @param command    指令
   * @param sessionId  当前会话 ID
   * @param projectId  当前项目 ID
   * @param cwd        工作目录（可选）
   */
  exec: (agentName: string, command: string, sessionId: string, projectId: string, mode?: string) =>
    ipcRenderer.invoke('agent:exec', { agentName, command, sessionId, projectId, mode }),

  /** 列出可用 Agent */
  list: () => ipcRenderer.invoke('agent:list'),

  /** 终止 Agent 进程 */
  kill: (agentName?: string) => ipcRenderer.invoke('agent:kill', agentName),

  /** 运行诊断 */
  doctor: (agentName: string) => ipcRenderer.invoke('agent:doctor', agentName),

  /** Phase 3: 获取 Agent 标签声明 */
  getManifest: (agentName: string) => ipcRenderer.invoke('agent:manifest', agentName),

  /** Phase 5: 审批/拒绝 suggestion */
  respondSuggestion: (sessionId: string, approved: boolean) =>
    ipcRenderer.invoke('agent:suggestion:respond', sessionId, approved),

  /** Phase 6: Session 回放 */
  replay: (sessionId: string, projectId: string) => ipcRenderer.invoke('agent:replay', sessionId, projectId),

  /**
   * 监听 Agent 输出事件
   * @returns 取消监听的函数
   */
  onOutput: (fn: (data: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, data: unknown) => fn(data);
    ipcRenderer.on('agent:output', handler);
    return () => ipcRenderer.removeListener('agent:output', handler);
  },

  /**
   * 监听 Agent 状态事件
   * @returns 取消监听的函数
   */
  onStatus: (fn: (data: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, data: unknown) => fn(data);
    ipcRenderer.on('agent:status', handler);
    return () => ipcRenderer.removeListener('agent:status', handler);
  },
});

// ── Database API ──

contextBridge.exposeInMainWorld('db', {
  // 项目
  listProjects: () => ipcRenderer.invoke('db:listProjects'),
  createProject: (name: string, path: string) => ipcRenderer.invoke('db:createProject', name, path),
  removeProject: (id: string) => ipcRenderer.invoke('db:removeProject', id),
  getProject: (id: string) => ipcRenderer.invoke('db:getProject', id),

  // 会话
  listSessions: (projectId: string) => ipcRenderer.invoke('db:listSessions', projectId),
  createSession: (projectId: string, title?: string, agentType?: string) =>
    ipcRenderer.invoke('db:createSession', projectId, title, agentType),
  removeSession: (id: string) => ipcRenderer.invoke('db:removeSession', id),
  renameSession: (id: string, title: string) => ipcRenderer.invoke('db:renameSession', id, title),
  getSession: (id: string) => ipcRenderer.invoke('db:getSession', id),

  // 消息
  listMessages: (sessionId: string) => ipcRenderer.invoke('db:listMessages', sessionId),
  addMessage: (sessionId: string, role: string, content: string) =>
    ipcRenderer.invoke('db:addMessage', sessionId, role, content),

  // 任务
  listTasks: (projectId: string, status?: string) => ipcRenderer.invoke('db:listTasks', projectId, status),
  addTask: (sessionId: string, projectId: string, title: string) =>
    ipcRenderer.invoke('db:addTask', sessionId, projectId, title),
  updateTaskStatus: (id: string, status: string) => ipcRenderer.invoke('db:updateTaskStatus', id, status),
  archiveTask: (id: string) => ipcRenderer.invoke('db:archiveTask', id),
  getTask: (id: string) => ipcRenderer.invoke('db:getTask', id),

  // 批量任务操作
  batchAddTasks: (sessionId: string, projectId: string, tasks: { title: string; assignee?: string; description?: string }[]) =>
    ipcRenderer.invoke('db:batchAddTasks', sessionId, projectId, tasks),

  updateTask: (id: string, fields: { assignee?: string; status?: string; description?: string }) =>
    ipcRenderer.invoke('db:updateTask', id, fields),

  /** 批准会话计划 — 将计划中的任务批量插入 */
  approvePlan: (sessionId: string) =>
    ipcRenderer.invoke('db:approvePlan', sessionId),

  // Agent 日志
  listAgentLogs: (sessionId: string) => ipcRenderer.invoke('db:listAgentLogs', sessionId),

  // Phase 6: 记忆系统
  saveMemory: (projectId: string, agentName: string, key: string, content: string, sessionId?: string) =>
    ipcRenderer.invoke('db:saveMemory', projectId, agentName, key, content, sessionId),
  loadMemories: (projectId: string, agentName: string) =>
    ipcRenderer.invoke('db:loadMemories', projectId, agentName),
  deleteMemory: (id: string) => ipcRenderer.invoke('db:deleteMemory', id),

  // Phase 5: 动态任务调整
  updateTaskDescription: (id: string, description: string) =>
    ipcRenderer.invoke('db:updateTaskDescription', id, description),
  addTaskDynamic: (sessionId: string, projectId: string, title: string, assignee?: string) =>
    ipcRenderer.invoke('db:addTaskDynamic', sessionId, projectId, title, assignee),
  cancelTask: (id: string) => ipcRenderer.invoke('db:cancelTask', id),
});

// ── Credentials API ──

contextBridge.exposeInMainWorld('credentials', {
  /** 读取统一凭证（apiKey + baseUrl） */
  get: () => ipcRenderer.invoke('credentials:get'),

  /** 保存统一凭证 */
  set: (creds: { apiKey: string; baseUrl: string }) =>
    ipcRenderer.invoke('credentials:set', creds),
});
