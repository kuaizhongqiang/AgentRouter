/**
 * AgentRouter CLI — 输出格式化
 *
 * 统一管理 human-friendly 输出和 --json 模式。
 * 所有命令处理器通过此模块输出结果。
 */
let _jsonMode = false;
let _quietMode = false;

export function setJsonMode(v) { _jsonMode = v; }
export function isJsonMode() { return _jsonMode; }
export function setQuietMode(v) { _quietMode = v; }
export function isQuietMode() { return _quietMode; }

/**
 * 普通日志输出（--quiet 时抑制）
 */
export function log(msg, opts = {}) {
  if (_quietMode && !opts.force) return;
  console.log(msg);
}

/**
 * JSON 输出
 */
export function json(data) {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * 表格输出（仅 human 模式）
 */
export function table(rows, columns) {
  if (_jsonMode) return json(rows);

  if (!rows || rows.length === 0) {
    console.log('(空)');
    return;
  }

  // 计算列宽
  const colNames = columns || Object.keys(rows[0]);
  const colWidths = colNames.map(name => {
    let max = name.length;
    for (const row of rows) {
      const val = String(row[name] ?? '');
      if (val.length > max) max = val.length;
    }
    return max + 2;
  });

  // 表头
  const header = colNames.map((name, i) => name.padEnd(colWidths[i])).join('');
  console.log(header);
  console.log(colWidths.map(w => '─'.repeat(w)).join(''));

  // 行
  for (const row of rows) {
    const line = colNames.map((name, i) => String(row[name] ?? '').padEnd(colWidths[i])).join('');
    console.log(line);
  }
}

/**
 * 单行键值输出
 */
export function kv(key, value) {
  if (_jsonMode) return;
  console.log(`${String(key).padEnd(20)} ${value}`);
}

/**
 * 成功提示
 */
export function success(msg) {
  if (_jsonMode) return json({ success: true, message: msg });
  console.log(`✅ ${msg}`);
}

/**
 * 警告（stderr，不阻塞）
 */
export function warn(msg) {
  console.error(`⚠️  ${msg}`);
}

/**
 * 错误输出（stderr，设退出码）
 */
export function error(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

/**
 * 致命错误（stderr + 立即退出）
 */
export function fatal(msg, code = 1) {
  console.error(`❌ ${msg}`);
  process.exit(code);
}
