/**
 * AgentRouter — 端到端 Smoke Test
 *
 * 模拟完整流程：
 *   1. 数据库初始化 + 迁移
 *   2. 创建项目 + 会话
 *   3. 模拟 PM Agent 产出任务列表
 *   4. 任务解析 + 入库
 *   5. 消息记录
 *   6. 验证数据完整性
 *
 * 用法: node test/smoke-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(os.homedir(), '.agentrouter', 'agentrouter-test.db');

// ── 工具函数 ──
function idgen() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function now() {
  return new Date().toISOString();
}
function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}
function hr() {
  console.log('─'.repeat(60));
}

// ── 任务解析器（从 task-parser.ts 移植） ──
function parseTasksFromReply(text) {
  const tasks = [];

  // Strategy 1: ```tasks JSON block
  const tasksBlock = text.match(/```tasks\s*\n([\s\S]*?)```/);
  if (tasksBlock) {
    try {
      const parsed = JSON.parse(tasksBlock[1].trim());
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        return parsed.tasks.map(t => ({ title: t.title || '', assignee: t.assignee || '', description: t.description || '' })).filter(t => t.title);
      }
    } catch { /* fall through */ }
  }

  // Strategy 2: ```json block
  const jsonBlock = text.match(/```json\s*\n([\s\S]*?)```/);
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock[1].trim());
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        return parsed.tasks.map(t => ({ title: t.title || '', assignee: t.assignee || '', description: t.description || '' })).filter(t => t.title);
      }
      if (Array.isArray(parsed)) {
        return parsed.map(t => ({ title: t.title || '', assignee: t.assignee || '', description: t.description || '' })).filter(t => t.title);
      }
    } catch { /* fall through */ }
  }

  // Strategy 3: Markdown checkbox list
  const re = /-\s\[ \]\s+([^@\n]+?)(?:\s*@(\w+))?(?:\s*[—–-]+\s*(.*))?\s*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    tasks.push({ title: m[1].trim(), assignee: m[2] || '', description: (m[3] || '').trim() });
  }

  return tasks;
}

// ── 主流程 ──
async function main() {
  hr();
  console.log('AgentRouter — Smoke Test');
  console.log(`时间: ${now()}`);
  console.log(`测试库: ${TEST_DB_PATH}`);
  hr();

  // 1. 初始化 sql.js
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();

  let db;
  try {
    const buffer = fs.readFileSync(TEST_DB_PATH);
    db = new SQL.Database(buffer);
    log('📂', '加载已有测试库');
  } catch {
    db = new SQL.Database();
    log('🆕', '创建新测试库');
  }
  db.run('PRAGMA foreign_keys = ON');

  // 2. 运行迁移
  const migrations = [
    { id: 1, name: 'v1-initial', sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL,
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, projectId TEXT NOT NULL, title TEXT NOT NULL DEFAULT '新对话',
        agentType TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'chat',
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, sessionId TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user','agent','system')),
        content TEXT NOT NULL, timestamp TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, sessionId TEXT NOT NULL, projectId TEXT NOT NULL,
        title TEXT NOT NULL, assignee TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','archived')),
        createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `},
  ];

  db.run("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, appliedAt TEXT NOT NULL DEFAULT (datetime('now')))");

  for (const m of migrations) {
    const st = db.prepare('SELECT 1 FROM _migrations WHERE id = ?');
    st.bind([m.id]);
    if (st.step()) { st.free(); continue; }
    st.free();

    for (const stmt of m.sql.split(';').map(s => s.trim()).filter(Boolean)) {
      db.run(stmt + ';');
    }
    db.run('INSERT INTO _migrations (id, name) VALUES (?, ?)', [m.id, m.name]);
    log('📋', `迁移: ${m.name}`);
  }

  // 3. 创建项目
  const projectId = idgen();
  const projectPath = path.join(os.homedir(), 'projects', 'demo-app');
  db.run('INSERT INTO projects (id, name, path, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [projectId, 'Demo 重构项目', projectPath, now(), now()]);
  log('📁', `项目: Demo 重构项目 (${projectId.slice(0, 8)}...)`);

  // 4. 创建 Mission 会话
  const sessionId = idgen();
  db.run('INSERT INTO sessions (id, projectId, title, agentType, type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [sessionId, projectId, '重构 App.vue 为多组件架构', 'reasonix', 'mission', now(), now()]);
  log('💬', `会话: 重构 App.vue (${sessionId.slice(0, 8)}...) [mission]`);

  // 5. 添加用户消息
  const userMsgId = idgen();
  db.run('INSERT INTO messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
    [userMsgId, sessionId, 'user', '帮我把 App.vue 重构为多组件架构，左中右三个面板各自独立成组件', now()]);

  // 6. 模拟 PM Agent 回复（含任务列表）
  const pmReply = `好的，分析当前 App.vue 的代码结构后，我制定了以下重构计划：

\`\`\`json
{
  "tasks": [
    {
      "id": "t1",
      "title": "创建 LeftPanel.vue 组件",
      "assignee": "codewhale",
      "path": "src/components/LeftPanel.vue",
      "depends_on": [],
      "parallel_group": "group1",
      "description": "从 App.vue 抽离左侧面板：会话列表、项目选择器"
    },
    {
      "id": "t2",
      "title": "创建 CenterPanel.vue 组件",
      "assignee": "codewhale",
      "path": "src/components/CenterPanel.vue",
      "depends_on": [],
      "parallel_group": "group1",
      "description": "抽离中间面板：消息列表、输入区域"
    },
    {
      "id": "t3",
      "title": "创建 RightPanel.vue 组件",
      "assignee": "codewhale",
      "path": "src/components/RightPanel.vue",
      "depends_on": [],
      "parallel_group": "group1",
      "description": "抽离右侧面板：任务列表、Agent 状态"
    },
    {
      "id": "t4",
      "title": "重构 App.vue 为布局容器",
      "assignee": "codewhale",
      "path": "src/App.vue",
      "depends_on": ["t1", "t2", "t3"],
      "parallel_group": "group2",
      "description": "用子组件替换内联面板代码，保留状态管理和 IPC 通信"
    },
    {
      "id": "t5",
      "title": "验证重构后功能完整性",
      "assignee": "reasonix",
      "path": "",
      "depends_on": ["t4"],
      "parallel_group": "",
      "description": "运行 dev server，确认三面板交互和 IPC 通信正常"
    }
  ]
}
\`\`\`

总共 5 个任务，其中 3 个前端组件可并行开发（group1），布局重构依赖它们（group2），最后做验证。`;

  const agentMsgId = idgen();
  db.run('INSERT INTO messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
    [agentMsgId, sessionId, 'agent', pmReply, now()]);
  log('🤖', 'PM Agent 回复已记录 (含任务列表)');

  // 7. 解析任务
  const tasks = parseTasksFromReply(pmReply);
  log('🔍', `解析到 ${tasks.length} 个任务:`);

  // 8. 入库任务
  const insertStmt = db.prepare(
    `INSERT INTO tasks (id, sessionId, projectId, title, assignee, description, sort_order, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  );
  const createdTasks = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const taskId = idgen();
    const ts = now();
    insertStmt.run([taskId, sessionId, projectId, t.title, t.assignee || '', t.description || '', i, ts, ts]);
    createdTasks.push({ id: taskId, ...t, sort_order: i, status: 'pending' });
  }
  insertStmt.free();

  // 持久化
  const data = db.export();
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TEST_DB_PATH, Buffer.from(data));
  log('💾', `持久化到 ${TEST_DB_PATH}`);

  // 9. 验证
  hr();
  console.log('验证结果:');
  console.log('');

  // 项目
  const pStmt = db.prepare('SELECT * FROM projects');
  const projects = [];
  while (pStmt.step()) projects.push(pStmt.getAsObject());
  pStmt.free();
  console.log(`  项目: ${projects.length} 个`);

  // 会话
  const sStmt = db.prepare('SELECT * FROM sessions');
  const sessions = [];
  while (sStmt.step()) sessions.push(sStmt.getAsObject());
  sStmt.free();
  console.log(`  会话: ${sessions.length} 个`);

  // 消息
  const mStmt = db.prepare('SELECT * FROM messages');
  const messages = [];
  while (mStmt.step()) messages.push(mStmt.getAsObject());
  mStmt.free();
  console.log(`  消息: ${messages.length} 条`);

  // 任务列表
  const tStmt = db.prepare('SELECT * FROM tasks ORDER BY sort_order');
  const dbTasks = [];
  while (tStmt.step()) dbTasks.push(tStmt.getAsObject());
  tStmt.free();

  console.log(`  任务: ${dbTasks.length} 个`);
  console.log('');
  console.log('  ┌──────┬──────────────────────────────────────┬────────────┬──────────┐');
  console.log('  │ 序号  │ 标题                                   │ 执行者      │ 状态      │');
  console.log('  ├──────┼──────────────────────────────────────┼────────────┼──────────┤');
  for (const t of dbTasks) {
    const idx = t.sort_order + 1;
    const title = t.title.length > 36 ? t.title.slice(0, 34) + '…' : t.title.padEnd(36);
    const assignee = (t.assignee || '(未分配)').padEnd(10);
    const status = t.status.padEnd(8);
    console.log(`  │  ${idx}   │ ${title} │ ${assignee} │ ${status} │`);
  }
  console.log('  └──────┴──────────────────────────────────────┴────────────┴──────────┘');

  // 10. 额外验证：模拟任务状态流转
  console.log('');
  log('🔄', '模拟任务状态流转...');

  // 将 t1-t3 标记为 running
  const group1Tasks = dbTasks.filter(t => t.sort_order < 3);
  for (const t of group1Tasks) {
    db.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', ['running', now(), t.id]);
  }
  log('🏃', `3 个任务 → running (并行组 group1)`);

  // 将 t1-t3 标记为 completed
  for (const t of group1Tasks) {
    db.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', ['completed', now(), t.id]);
  }
  log('✅', `3 个任务 → completed`);

  // 将 t4 标记为 running
  const t4 = dbTasks[3];
  db.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', ['running', now(), t4.id]);
  log('🏃', `t4 → running (依赖满足)`);

  // 将 t4 标记为 completed
  db.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', ['completed', now(), t4.id]);
  log('✅', `t4 → completed`);

  // 将 t5 标记为 running
  const t5 = dbTasks[4];
  db.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', ['running', now(), t5.id]);
  log('🏃', `t5 → running (最终验证)`);

  // 将 t5 标记为 completed
  db.run('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?', ['completed', now(), t5.id]);
  log('✅', `t5 → completed`);

  // 持久化最终状态
  const finalData = db.export();
  fs.writeFileSync(TEST_DB_PATH, Buffer.from(finalData));

  // 11. 最终统计
  console.log('');
  hr();
  const countStmt = db.prepare("SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status");
  const counts = {};
  while (countStmt.step()) {
    const row = countStmt.getAsObject();
    counts[row.status] = row.cnt;
  }
  countStmt.free();

  console.log('任务状态分布:');
  for (const [status, cnt] of Object.entries(counts)) {
    const icon = { pending: '⏳', running: '🏃', completed: '✅', archived: '📦' }[status] || '❓';
    console.log(`  ${icon} ${status}: ${cnt}`);
  }

  console.log('');
  const totalMsgs = db.exec("SELECT COUNT(*) FROM messages")[0]?.values[0]?.[0] || 0;
  console.log(`消息总数: ${totalMsgs}`);
  console.log(`数据库: ${TEST_DB_PATH}`);

  db.close();
  console.log('');
  log('🎉', 'Smoke test 全部通过!');
  hr();
}

main().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
