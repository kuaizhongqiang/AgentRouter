/**
 * AgentRouter — 数据库迁移
 *
 * Schema v1: 初始表 (projects, sessions, messages, tasks)
 * Schema v2: 添加 agent_logs 表, 添加 sessions.agentType 列
 */
import initSqlJs from 'sql.js';

type Database = initSqlJs.Database;

const SCHEMA_V1 = `
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
`;

const SCHEMA_V2 = `
-- Agent 执行日志表
CREATE TABLE IF NOT EXISTS agent_logs (
  id        TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  agentType TEXT NOT NULL,
  command   TEXT NOT NULL,
  logPath   TEXT NOT NULL,
  exitCode  INTEGER,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 为 sessions 表添加 agentType 列
ALTER TABLE sessions ADD COLUMN agentType TEXT NOT NULL DEFAULT '';
`;

const SCHEMA_V3 = `
-- sessions 表：添加 type 列 (chat / mission)
ALTER TABLE sessions ADD COLUMN type TEXT NOT NULL DEFAULT 'chat';

-- tasks 表：添加 assignee / description / sort_order 列
ALTER TABLE tasks ADD COLUMN assignee TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
`;

const SCHEMA_V4 = `
-- Phase 6: 长期记忆系统
CREATE TABLE IF NOT EXISTS memories (
  id        TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  sessionId TEXT,
  agentName TEXT NOT NULL,
  key       TEXT NOT NULL,
  content   TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_memories_project_agent ON memories(projectId, agentName);
`;

/**
 * 运行所有迁移
 */
export function runMigrations(db: Database): void {
  // 检查是否已有 meta 表
  const stmt = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
  );
  let hasMeta = false;
  if (stmt.step()) hasMeta = true;
  stmt.free();

  if (!hasMeta) {
    // 创建迁移跟踪表
    db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id        INTEGER PRIMARY KEY,
        name      TEXT NOT NULL,
        appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  // 获取已应用的迁移
  const applied = new Set<number>();
  try {
    const st = db.prepare('SELECT id FROM _migrations');
    while (st.step()) {
      const row = st.getAsObject() as { id: number };
      applied.add(row.id);
    }
    st.free();
  } catch {
    // _migrations 表可能尚不存在或为空
  }

  // 按顺序应用迁移
  const migrations: Array<{ id: number; name: string; sql: string }> = [
    { id: 1, name: 'v1-initial-schema', sql: SCHEMA_V1 },
    { id: 2, name: 'v2-agent-logs', sql: SCHEMA_V2 },
    { id: 3, name: 'v3-session-type-task-fields', sql: SCHEMA_V3 },
    { id: 4, name: 'v4-memories', sql: SCHEMA_V4 },
  ];

  for (const m of migrations) {
    if (applied.has(m.id)) continue;

    try {
      // 逐条执行 SQL（ALTER TABLE 不能与 CREATE 共用）
      const statements = m.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        db.run(stmt + ';');
      }

      // 记录迁移
      db.run('INSERT INTO _migrations (id, name) VALUES (?, ?)', [m.id, m.name]);
      console.log(`[DB] Migration applied: ${m.name}`);
    } catch (err) {
      console.error(`[DB] Migration failed: ${m.name}`, err);
      throw err;
    }
  }
}
