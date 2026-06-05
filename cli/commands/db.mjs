/**
 * AgentRouter CLI — 数据库命令
 *
 * 用法:
 *   ar db "<SQL>"                 执行 SQL 查询
 *   ar db stats                   表统计信息
 *   ar db --tables                列出所有表
 *   ar db --dump <table>          导出表全部数据
 *
 * 选项:
 *   --json        JSON 格式输出
 *
 * 注意:
 *   使用 getModules().db 获取 sql.js 数据库实例。
 *   仅支持 SELECT 查询的结果格式化输出；
 *   INSERT/UPDATE/DELETE 返回 "ok" 和受影响行数。
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

const USAGE = `
用法: ar db <subcommand|"<SQL>">

子命令:
  stats                     显示各表行数统计
  --tables                  列出数据库中所有表
  --dump <table>            导出指定表的全部数据

直接 SQL:
  ar db "SELECT * FROM messages"         执行 SQL 查询
  ar db "INSERT INTO ..."                执行非查询 SQL

选项:
  --json       JSON 格式输出
`;

// 统计信息中关注的表
const STATS_TABLES = [
  'projects',
  'sessions',
  'messages',
  'tasks',
  'agent_logs',
  'memories',
  'token_usage',
  'task_templates',
];

export default async function handler(args, options) {
  const [first, ...rest] = args;

  if (!first || first === 'help' || first === '--help') {
    output.log(USAGE);
    return;
  }

  try {
    const { db } = getModules();
    if (!db) {
      output.fatal('数据库未初始化。请先运行 `ar status` 确认后端已编译。');
    }

    // ── 子命令分发 ──

    // ar db stats
    if (first === 'stats') {
      return showStats(db);
    }

    // ar db --tables
    if (first === '--tables') {
      return listTables(db);
    }

    // ar db --dump <table>
    if (first === '--dump') {
      const tableName = rest[0];
      if (!tableName) {
        output.fatal('用法: ar db --dump <table>');
      }
      return dumpTable(db, tableName);
    }

    // ar db "<SQL>" — 直接执行 SQL
    return executeSQL(db, first);
  } catch (err) {
    output.fatal(`数据库操作失败: ${err.message}`);
  }
}

// ── SQL 执行 ──

/**
 * 执行任意 SQL，格式化输出结果。
 * SELECT 类查询输出表格，非查询输出受影响行数。
 */
function executeSQL(db, sql) {
  const trimmed = sql.trim().toUpperCase();

  try {
    // 检测是否为查询语句
    const isQuery = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN');

    const results = db.exec(sql);

    // 无返回结果（INSERT/UPDATE/DELETE/CREATE 等）
    if (!results || results.length === 0) {
      const modified = db.getRowsModified();
      if (output.isJsonMode()) {
        output.json({ status: 'ok', rowsAffected: modified });
      } else {
        output.success(`SQL 执行成功 (影响 ${modified} 行)`);
      }
      return;
    }

    // 有返回结果
    if (output.isJsonMode()) {
      // JSON 模式：直接输出结果集
      const jsonResult = results.map(r => {
        const rows = r.values.map(vals => {
          const row = {};
          r.columns.forEach((col, i) => {
            row[col] = vals[i];
          });
          return row;
        });
        return { columns: r.columns, rows };
      });
      output.json(jsonResult.length === 1 ? jsonResult[0] : jsonResult);
      return;
    }

    // Human 模式：表格输出
    for (const resultSet of results) {
      const { columns, values } = resultSet;

      if (!values || values.length === 0) {
        output.log('(查询结果为空)');
        continue;
      }

      // 将 values 数组转为对象数组供 output.table 使用
      const rows = values.map(vals => {
        const row = {};
        columns.forEach((col, i) => {
          row[col] = vals[i];
        });
        return row;
      });

      output.table(rows, columns);
      output.log(`(共 ${rows.length} 行)`);
    }
  } catch (err) {
    output.error(`SQL 错误: ${err.message}`);
  }
}

// ── 表统计 ──

/**
 * 显示各表行数统计
 */
function showStats(db) {
  const stats = [];

  for (const table of STATS_TABLES) {
    try {
      // 先检查表是否存在
      const checkResult = db.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );
      if (!checkResult || checkResult.length === 0 || checkResult[0].values.length === 0) {
        stats.push({ table, rows: 0, exists: false });
        continue;
      }

      const result = db.exec(`SELECT count(*) as count FROM \`${table}\``);
      if (result && result.length > 0 && result[0].values.length > 0) {
        const count = result[0].values[0][0];
        stats.push({ table, rows: count, exists: true });
      } else {
        stats.push({ table, rows: 0, exists: true });
      }
    } catch {
      stats.push({ table, rows: 0, exists: false });
    }
  }

  if (output.isJsonMode()) {
    output.json(stats);
    return;
  }

  const rows = stats.map(s => ({
    table: s.table,
    rows: s.exists ? String(s.rows) : '(不存在)',
  }));
  output.table(rows, ['table', 'rows']);
}

// ── 列出表 ──

/**
 * 列出数据库中所有用户表
 */
function listTables(db) {
  const result = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  );

  if (!result || result.length === 0 || result[0].values.length === 0) {
    output.log('(数据库中没有表)');
    return;
  }

  const tables = result[0].values.map(v => v[0]);

  if (output.isJsonMode()) {
    output.json({ tables });
    return;
  }

  output.log('数据库中的表:');
  for (const name of tables) {
    output.log(`  ${name}`);
  }
  output.log(`(共 ${tables.length} 个表)`);
}

// ── 导出表 ──

/**
 * 导出指定表的所有数据
 */
function dumpTable(db, tableName) {
  // 验证表存在
  const checkResult = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  if (!checkResult || checkResult.length === 0 || checkResult[0].values.length === 0) {
    output.fatal(`表不存在: ${tableName}`);
  }

  const result = db.exec(`SELECT * FROM \`${tableName}\``);

  if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
    if (output.isJsonMode()) {
      output.json({ table: tableName, columns: result?.[0]?.columns || [], rows: [] });
    } else {
      output.log(`表 "${tableName}" 为空`);
    }
    return;
  }

  const { columns, values } = result[0];

  if (output.isJsonMode()) {
    const rows = values.map(vals => {
      const row = {};
      columns.forEach((col, i) => {
        row[col] = vals[i];
      });
      return row;
    });
    output.json({ table: tableName, columns, rows });
    return;
  }

  const rows = values.map(vals => {
    const row = {};
    columns.forEach((col, i) => {
      row[col] = vals[i];
    });
    return row;
  });

  output.table(rows, columns);
  output.log(`(共 ${rows.length} 行)`);
}
