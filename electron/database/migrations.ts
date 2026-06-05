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

const SCHEMA_V5 = `
-- M2: 任务模板表
CREATE TABLE IF NOT EXISTS task_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tasks       TEXT NOT NULL DEFAULT '[]',
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL
);

-- 预置 3 个模板（INSERT OR IGNORE 防止重复）
INSERT OR IGNORE INTO task_templates (id, name, description, tasks, createdAt, updatedAt) VALUES
(
  'tpl-fix-bug',
  '修复 Bug',
  '标准 Bug 修复流程：复现、定位、修复、验证',
  '[{"title":"复现 Bug","assignee":"","description":"确认 Bug 复现步骤和环境"},{"title":"定位根因","assignee":"","description":"分析代码定位问题根因"},{"title":"实现修复","assignee":"","description":"编写修复代码并自测"},{"title":"编写测试","assignee":"","description":"添加回归测试防止再次出现"},{"title":"Code Review","assignee":"","description":"提交 PR 并邀请同事审查"}]',
  datetime('now'),
  datetime('now')
),
(
  'tpl-add-feature',
  '添加功能',
  '标准功能开发流程：需求分析、设计、实现、测试',
  '[{"title":"需求分析","assignee":"","description":"明确功能需求和验收标准"},{"title":"技术设计","assignee":"","description":"编写技术方案和接口设计"},{"title":"实现功能","assignee":"","description":"编码实现核心逻辑"},{"title":"编写测试","assignee":"","description":"单元测试 + 集成测试"},{"title":"更新文档","assignee":"","description":"更新 README 和 API 文档"}]',
  datetime('now'),
  datetime('now')
),
(
  'tpl-code-review',
  '代码审查',
  '标准 Code Review 流程：逐文件审查、问题记录、修复跟进',
  '[{"title":"审查变更概览","assignee":"","description":"理解 PR 背景和变更范围"},{"title":"逐文件审查","assignee":"","description":"逐文件检查代码质量、安全性和性能"},{"title":"记录审查意见","assignee":"","description":"整理 Bug、改进建议和疑问"},{"title":"跟进修复","assignee":"","description":"确认所有审查意见已处理"}]',
  datetime('now'),
  datetime('now')
);
`;

const SCHEMA_V6 = `
-- M4 #8: Token 用量追踪表
CREATE TABLE IF NOT EXISTS token_usage (
  id              TEXT PRIMARY KEY,
  sessionId       TEXT NOT NULL,
  agentType       TEXT NOT NULL DEFAULT '',
  promptTokens    INTEGER NOT NULL DEFAULT 0,
  completionTokens INTEGER NOT NULL DEFAULT 0,
  totalTokens     INTEGER NOT NULL DEFAULT 0,
  model           TEXT NOT NULL DEFAULT '',
  createdAt       TEXT NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(sessionId);
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
    { id: 5, name: 'v5-task-templates', sql: SCHEMA_V5 },
    { id: 6, name: 'v6-token-usage', sql: SCHEMA_V6 },
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
      console.error(`[DB] Migration applied: ${m.name}`);
    } catch (err) {
      console.error(`[DB] Migration failed: ${m.name}`, err);
      throw err;
    }
  }
}
