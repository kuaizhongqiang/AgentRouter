/**
 * AgentRouter — 数据库 Repository (CRUD 操作)
 */
import initSqlJs from 'sql.js';
import { getDatabase, saveDatabase } from './index';
import type { Project, Session, Message, Task, AgentLog } from '../types';

type Database = initSqlJs.Database;

function idgen(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function now(): string {
  return new Date().toISOString();
}

// ── 数据库连接 ──

async function db(): Promise<Database> {
  return getDatabase();
}

// ── 项目 CRUD ──

export async function listProjects(): Promise<Project[]> {
  const d = await db();
  const stmt = d.prepare('SELECT * FROM projects ORDER BY updatedAt DESC');
  const results: Project[] = [];
  while (stmt.step()) results.push(stmt.getAsObject() as unknown as Project);
  stmt.free();
  return results;
}

export async function createProject(name: string, projectPath: string): Promise<Project> {
  const d = await db();
  const p: Project = { id: idgen(), name, path: projectPath, createdAt: now(), updatedAt: now() };
  d.run(
    'INSERT INTO projects (id, name, path, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [p.id, p.name, p.path, p.createdAt, p.updatedAt]
  );
  saveDatabase();
  return p;
}

export async function removeProject(id: string): Promise<void> {
  const d = await db();
  d.run('DELETE FROM tasks WHERE projectId = ?', [id]);
  d.run('DELETE FROM messages WHERE sessionId IN (SELECT id FROM sessions WHERE projectId = ?)', [id]);
  d.run('DELETE FROM sessions WHERE projectId = ?', [id]);
  d.run('DELETE FROM projects WHERE id = ?', [id]);
  saveDatabase();
}

export async function getProject(id: string): Promise<Project | null> {
  const d = await db();
  const stmt = d.prepare('SELECT * FROM projects WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const result = stmt.getAsObject() as unknown as Project;
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
}

// ── 会话 CRUD ──

export async function listSessions(projectId: string): Promise<Session[]> {
  const d = await db();
  const stmt = d.prepare('SELECT * FROM sessions WHERE projectId = ? ORDER BY updatedAt DESC');
  stmt.bind([projectId]);
  const results: Session[] = [];
  while (stmt.step()) results.push(stmt.getAsObject() as unknown as Session);
  stmt.free();
  return results;
}

export async function createSession(projectId: string, title?: string, agentType?: string): Promise<Session> {
  const d = await db();
  const s: Session = {
    id: idgen(),
    projectId,
    title: title || '新对话',
    agentType: agentType || '',
    createdAt: now(),
    updatedAt: now(),
  };
  d.run(
    'INSERT INTO sessions (id, projectId, title, agentType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    [s.id, s.projectId, s.title, s.agentType, s.createdAt, s.updatedAt]
  );
  saveDatabase();
  return s;
}

export async function removeSession(id: string): Promise<void> {
  const d = await db();
  d.run('DELETE FROM agent_logs WHERE sessionId = ?', [id]);
  d.run('DELETE FROM messages WHERE sessionId = ?', [id]);
  d.run('DELETE FROM tasks WHERE sessionId = ?', [id]);
  d.run('DELETE FROM sessions WHERE id = ?', [id]);
  saveDatabase();
}

export async function renameSession(id: string, title: string): Promise<void> {
  const d = await db();
  d.run('UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ?', [title, now(), id]);
  saveDatabase();
}

export async function getSession(id: string): Promise<Session | null> {
  const d = await db();
  const stmt = d.prepare('SELECT * FROM sessions WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const result = stmt.getAsObject() as unknown as Session;
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
}

// ── 消息 CRUD ──

export async function listMessages(sessionId: string): Promise<Message[]> {
  const d = await db();
  const stmt = d.prepare('SELECT * FROM messages WHERE sessionId = ? ORDER BY rowid');
  stmt.bind([sessionId]);
  const results: Message[] = [];
  while (stmt.step()) results.push(stmt.getAsObject() as unknown as Message);
  stmt.free();
  return results;
}

export async function addMessage(sessionId: string, role: Message['role'], content: string): Promise<Message> {
  const d = await db();
  const m: Message = { id: idgen(), sessionId, role, content, timestamp: now() };
  d.run(
    'INSERT INTO messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
    [m.id, m.sessionId, m.role, m.content, m.timestamp]
  );
  d.run('UPDATE sessions SET updatedAt = ? WHERE id = ?', [now(), sessionId]);
  saveDatabase();
  return m;
}

// ── 任务 CRUD ──

export async function listTasks(projectId: string, statusFilter?: string): Promise<Task[]> {
  const d = await db();
  let sql = 'SELECT * FROM tasks WHERE projectId = ?';
  const params = [projectId] as initSqlJs.SqlValue[];
  if (statusFilter && statusFilter !== 'all') {
    sql += ' AND status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY updatedAt DESC';
  const stmt = d.prepare(sql);
  stmt.bind(params);
  const results: Task[] = [];
  while (stmt.step()) results.push(stmt.getAsObject() as unknown as Task);
  stmt.free();
  return results;
}

export async function addTask(sessionId: string, projectId: string, title: string): Promise<Task> {
  const d = await db();
  const t: Task = {
    id: idgen(),
    sessionId,
    projectId,
    title,
    status: 'pending',
    createdAt: now(),
    updatedAt: now(),
  };
  d.run(
    'INSERT INTO tasks (id, sessionId, projectId, title, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [t.id, t.sessionId, t.projectId, t.title, t.status, t.createdAt, t.updatedAt]
  );
  saveDatabase();
  return t;
}

export async function updateTaskStatus(id: string, status: Task['status']): Promise<void> {
  const d = await db();
  d.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', [status, now(), id]);
  saveDatabase();
}

export async function archiveTask(id: string): Promise<void> {
  return updateTaskStatus(id, 'archived');
}

export async function getTask(id: string): Promise<Task | null> {
  const d = await db();
  const stmt = d.prepare('SELECT * FROM tasks WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const result = stmt.getAsObject() as unknown as Task;
    stmt.free();
    return result;
  }
  stmt.free();
  return null;
}

// ── Agent 日志 CRUD ──

export async function createAgentLog(log: Omit<AgentLog, 'id'>): Promise<AgentLog> {
  const d = await db();
  const al: AgentLog = { id: idgen(), ...log };
  d.run(
    'INSERT INTO agent_logs (id, sessionId, agentType, command, logPath, exitCode, startedAt, finishedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [al.id, al.sessionId, al.agentType, al.command, al.logPath, al.exitCode, al.startedAt, al.finishedAt]
  );
  saveDatabase();
  return al;
}

export async function updateAgentLog(id: string, updates: Partial<Pick<AgentLog, 'exitCode' | 'finishedAt'>>): Promise<void> {
  const d = await db();
  if (updates.exitCode !== undefined) {
    d.run('UPDATE agent_logs SET exitCode = ?, finishedAt = ? WHERE id = ?', [updates.exitCode, updates.finishedAt || now(), id]);
  } else {
    d.run('UPDATE agent_logs SET finishedAt = ? WHERE id = ?', [updates.finishedAt || now(), id]);
  }
  saveDatabase();
}

export async function listAgentLogs(sessionId: string): Promise<AgentLog[]> {
  const d = await db();
  const stmt = d.prepare('SELECT * FROM agent_logs WHERE sessionId = ? ORDER BY startedAt ASC');
  stmt.bind([sessionId]);
  const results: AgentLog[] = [];
  while (stmt.step()) results.push(stmt.getAsObject() as unknown as AgentLog);
  stmt.free();
  return results;
}
