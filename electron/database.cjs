/**
 * AgentRouter 数据存储层 — 基于 sql.js (SQLite WASM)
 *
 * 数据目录: ~/.agentrouter/agentrouter.db
 */
const path = require('path')
const fs = require('fs')
const os = require('os')

let initSqlJs, db = null, dbPath = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  path      TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id        TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  title     TEXT NOT NULL DEFAULT '新对话',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id        TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  role      TEXT NOT NULL CHECK(role IN ('user','agent','system')),
  content   TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id        TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  projectId TEXT NOT NULL,
  title     TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','archived')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);
`

function idgen() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function now() {
  return new Date().toISOString()
}

// ── 初始化 ──

async function init() {
  if (db) return db

  const dataDir = path.join(os.homedir(), '.agentrouter')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  dbPath = path.join(dataDir, 'agentrouter.db')

  initSqlJs = require('sql.js')

  const SQL = await initSqlJs()

  try {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } catch {
    db = new SQL.Database()
  }

  db.run(SCHEMA)
  save()
  return db
}

function save() {
  if (db && dbPath) {
    fs.writeFileSync(dbPath, Buffer.from(db.export()))
  }
}

// ── 项目 CRUD ──

async function listProjects() {
  await ensure()
  const stmt = db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC')
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
}

async function createProject(name, projectPath) {
  await ensure()
  const p = { id: idgen(), name, path: projectPath, createdAt: now(), updatedAt: now() }
  db.run('INSERT INTO projects (id,name,path,createdAt,updatedAt) VALUES (?,?,?,?,?)',
    [p.id, p.name, p.path, p.createdAt, p.updatedAt])
  save()
  return p
}

async function removeProject(id) {
  await ensure()
  db.run('DELETE FROM tasks WHERE projectId = ?', [id])
  db.run('DELETE FROM messages WHERE sessionId IN (SELECT id FROM sessions WHERE projectId = ?)', [id])
  db.run('DELETE FROM sessions WHERE projectId = ?', [id])
  db.run('DELETE FROM projects WHERE id = ?', [id])
  save()
}

// ── 对话 CRUD ──

async function listSessions(projectId) {
  await ensure()
  const stmt = db.prepare('SELECT * FROM sessions WHERE projectId = ? ORDER BY updatedAt DESC')
  stmt.bind([projectId])
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
}

async function createSession(projectId, title) {
  await ensure()
  const s = { id: idgen(), projectId, title: title || '新对话', createdAt: now(), updatedAt: now() }
  db.run('INSERT INTO sessions (id,projectId,title,createdAt,updatedAt) VALUES (?,?,?,?,?)',
    [s.id, s.projectId, s.title, s.createdAt, s.updatedAt])
  save()
  return s
}

async function removeSession(id) {
  await ensure()
  db.run('DELETE FROM messages WHERE sessionId = ?', [id])
  db.run('DELETE FROM tasks WHERE sessionId = ?', [id])
  db.run('DELETE FROM sessions WHERE id = ?', [id])
  save()
}

async function renameSession(id, title) {
  await ensure()
  db.run('UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ?', [title, now(), id])
  save()
}

// ── 消息 CRUD ──

async function listMessages(sessionId) {
  await ensure()
  const stmt = db.prepare('SELECT * FROM messages WHERE sessionId = ? ORDER BY rowid')
  stmt.bind([sessionId])
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
}

async function addMessage(sessionId, role, content) {
  await ensure()
  const m = { id: idgen(), sessionId, role, content, timestamp: now() }
  db.run('INSERT INTO messages (id,sessionId,role,content,timestamp) VALUES (?,?,?,?,?)',
    [m.id, m.sessionId, m.role, m.content, m.timestamp])
  db.run('UPDATE sessions SET updatedAt = ? WHERE id = ?', [now(), sessionId])
  save()
  return m
}

// ── 任务 CRUD ──

async function listTasks(projectId, statusFilter) {
  await ensure()
  let sql = 'SELECT * FROM tasks WHERE projectId = ?'
  const params = [projectId]
  if (statusFilter && statusFilter !== 'all') {
    sql += ' AND status = ?'
    params.push(statusFilter)
  }
  sql += ' ORDER BY updatedAt DESC'
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results = []
  while (stmt.step()) results.push(stmt.getAsObject())
  stmt.free()
  return results
}

async function addTask(sessionId, projectId, title) {
  await ensure()
  const t = { id: idgen(), sessionId, projectId, title, status: 'pending', createdAt: now(), updatedAt: now() }
  db.run('INSERT INTO tasks (id,sessionId,projectId,title,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)',
    [t.id, t.sessionId, t.projectId, t.title, t.status, t.createdAt, t.updatedAt])
  save()
  return t
}

async function updateTaskStatus(id, status) {
  await ensure()
  db.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', [status, now(), id])
  save()
}

async function archiveTask(id) {
  return updateTaskStatus(id, 'archived')
}

// ── 辅助 ──

async function ensure() {
  if (!db) await init()
}

module.exports = {
  init,
  listProjects, createProject, removeProject,
  listSessions, createSession, removeSession, renameSession,
  listMessages, addMessage,
  listTasks, addTask, updateTaskStatus, archiveTask,
}
