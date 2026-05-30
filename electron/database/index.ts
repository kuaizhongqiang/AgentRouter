/**
 * AgentRouter — SQLite 数据库初始化 (sql.js WASM)
 *
 * 数据文件: ~/.agentrouter/agentrouter.db
 * 默认启用 PRAGMA foreign_keys = ON
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import initSqlJs from 'sql.js';

type SqlJsDatabase = initSqlJs.Database;

const DATA_DIR = path.join(os.homedir(), '.agentrouter');
const DB_PATH = path.join(DATA_DIR, 'agentrouter.db');

let db: SqlJsDatabase | null = null;

/**
 * 获取或初始化数据库连接
 */
export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  try {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } catch {
    db = new SQL.Database();
  }

  // 启用外键约束 — 必须在同一连接上设置
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

/**
 * 持久化数据库到磁盘
 */
export function saveDatabase(): void {
  if (!db || !DB_PATH) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * 获取数据库文件路径
 */
export function getDatabasePath(): string {
  return DB_PATH;
}

/**
 * 获取数据目录路径
 */
export function getDataDir(): string {
  return DATA_DIR;
}
