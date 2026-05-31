/**
 * AgentRouter — 数据模型定义
 */
export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  agentType: string;
  type: 'chat' | 'mission';
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;
  sessionId: string;
  projectId: string;
  title: string;
  assignee: string;
  description: string;
  sort_order: number;
  status: 'pending' | 'running' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface AgentLog {
  id: string;
  sessionId: string;
  agentType: string;
  command: string;
  logPath: string;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
}
