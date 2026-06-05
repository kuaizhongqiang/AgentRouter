/**
 * AgentRouter CLI — 日志查看命令
 *
 * 用法:
 *   ar log <agent>                  查看 Agent 日志（最近 50 行）
 *   ar log <agent> --lines 200      指定行数
 *   ar log <agent> --tail           持续监听模式
 *   ar log <agent> --session <id>   按会话筛选
 *   ar log <agent> --session <id> --json  按会话输出 JSON
 *   ar log <agent> --level error    按事件类型筛选
 *
 * 事件目录结构:
 *   ~/.agentrouter/projects/<project>/sessions/<session>/events/<agent>.jsonl
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

const EVENTS_DIR = path.join(os.homedir(), '.agentrouter', 'projects');
const DEFAULT_LINES = 50;

// ── 事件类型显示标签 ──

const EVENT_LABELS = {
  'task:start': 'task:start',
  'task:update': 'task:update',
  'task:add': 'task:add',
  'task:cancel': 'task:cancel',
  'completion': 'completion',
  'task:completion': 'completion',
  'error': 'error   ',
  'task:error': 'error   ',
  'progress': 'progress',
  'suggestion': 'suggest ',
  'cancelled': 'cancelled',
  'task:complete': 'complete',
};

const LEVEL_FILTER_MAP = {
  error: ['error', 'task:error'],
  completion: ['completion', 'task:completion', 'task:complete'],
  progress: ['progress'],
  start: ['task:start'],
  update: ['task:update'],
  suggestion: ['suggestion'],
};

export default async function handler(args, options) {
  const agentName = args[0];
  const lineCount = options.lines || DEFAULT_LINES;
  const sessionId = options.session || options.sessionId;
  const level = options.level;
  const isTail = options.tail;

  if (!agentName) {
    output.fatal('用法: ar log <agent> [--lines N] [--session <id>] [--level <type>] [--tail] [--json]');
  }

  // 验证 Agent 名称是否合法（通过 Manager 检查）
  try {
    const { manager } = getModules();
    const manifest = manager.getManifest(agentName);
    if (!manifest) {
      output.warn(`Agent "${agentName}" 未注册，但仍将尝试读取其日志文件。`);
    }
  } catch {
    // 管理器不可用时仍然尝试读取文件
  }

  // --tail 模式：持续监听
  if (isTail) {
    return tailLogs(agentName, sessionId, level);
  }

  // 一次性读取模式
  try {
    const files = findLogFiles(agentName, sessionId);

    if (files.length === 0) {
      output.log(`(没有找到 "${agentName}" 的日志文件${sessionId ? ` 会话: ${sessionId}` : ''})`);
      return;
    }

    // 从所有文件按修改时间排序，只取最新的文件
    // 但更好的是跨文件合并并排序
    const allEntries = readAllLogs(files, lineCount, level);

    if (allEntries.length === 0) {
      output.log('(没有匹配的日志条目)');
      return;
    }

    // 输出
    if (output.isJsonMode() || options.json) {
      output.json(allEntries);
      return;
    }

    for (const entry of allEntries) {
      const label = EVENT_LABELS[entry.event] || entry.event || '?';
      const timeStr = formatTimestamp(entry.timestamp);
      const summary = formatDataSummary(entry.event, entry.data || {});
      output.log(`${timeStr}  ${label}  ${summary}`);
    }
  } catch (err) {
    output.fatal(`读取日志失败: ${err.message}`);
  }
}

// ── 查找日志文件 ──

/**
 * 遍历事件目录，找到匹配 agentName 的 .jsonl 文件。
 * 如果指定 sessionId，则限定到该会话目录。
 */
function findLogFiles(agentName, sessionId) {
  const files = [];

  if (!fs.existsSync(EVENTS_DIR)) {
    return files;
  }

  const projectDirs = fs.readdirSync(EVENTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const projectDir of projectDirs) {
    const sessionsDir = path.join(EVENTS_DIR, projectDir.name, 'sessions');

    if (!fs.existsSync(sessionsDir)) continue;

    const sessionDirs = fs.readdirSync(sessionsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const sessionDir of sessionDirs) {
      // 如果指定了 sessionId，跳过不匹配的
      if (sessionId && sessionDir.name !== sessionId) continue;

      const eventsDir = path.join(sessionsDir, sessionDir.name, 'events');
      if (!fs.existsSync(eventsDir)) continue;

      const eventFiles = fs.readdirSync(eventsDir)
        .filter(f => f.endsWith('.jsonl') && f.replace('.jsonl', '') === agentName);

      for (const file of eventFiles) {
        files.push({
          filePath: path.join(eventsDir, file),
          projectId: projectDir.name,
          sessionId: sessionDir.name,
          agentName,
        });
      }
    }
  }

  // 按修改时间排序，最新的在前
  files.sort((a, b) => {
    try {
      return fs.statSync(b.filePath).mtimeMs - fs.statSync(a.filePath).mtimeMs;
    } catch {
      return 0;
    }
  });

  return files;
}

// ── 日志读取与解析 ──

/**
 * 从多个文件读取 NDJSON 行，解析、过滤、排序，返回最近 lineCount 条。
 */
function readAllLogs(files, lineCount, level) {
  // 每个文件读取最后的 lineCount * 2 行，然后跨文件合并排序
  const allEntries = [];
  const filterEvents = level ? (LEVEL_FILTER_MAP[level] || [level]) : null;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      // 只读需要的行数：取每文件最后 lineCount 行（乘系数以防单个文件行少）
      const batchSize = Math.min(lines.length, lineCount * 2);
      const lastLines = lines.slice(lines.length - batchSize);

      for (const line of lastLines) {
        try {
          const parsed = JSON.parse(line);
          const eventType = parsed.event || parsed.type || 'unknown';

          // 按事件类型过滤
          if (filterEvents && !filterEvents.includes(eventType)) {
            continue;
          }

          allEntries.push({
            timestamp: parsed.timestamp || parsed.ts || '',
            event: eventType,
            data: parsed.data || parsed,
            _agent: file.agentName,
            _session: file.sessionId,
            _project: file.projectId,
          });
        } catch {
          // 跳过无法解析的行
        }
      }
    } catch {
      // 跳过无法读取的文件
    }
  }

  // 按时间戳排序
  allEntries.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return ta - tb;
  });

  // 取最后的 lineCount 条
  return allEntries.slice(-lineCount);
}

// ── tail 模式 ──

/**
 * 持续监听最新的日志文件，输出新追加的行。
 * 使用 fs.watch 监听文件变化，然后读取新增行。
 */
async function tailLogs(agentName, sessionId, level) {
  // 先找所有文件，取最新那个
  const files = findLogFiles(agentName, sessionId);

  if (files.length === 0) {
    output.fatal(`没有找到 "${agentName}" 的日志文件`);
  }

  const targetFile = files[0]; // 最新修改的文件
  let fileSize = 0;

  // 读取已有内容，跳过输出（tail 通常只输出新内容）
  try {
    fileSize = fs.statSync(targetFile.filePath).size;
  } catch {
    // 文件可能暂时不可用
  }

  output.log(`正在监听 ${targetFile.filePath} ...`);
  output.log('(按 Ctrl+C 停止)');

  // 立即输出已有最后 10 行
  try {
    const content = fs.readFileSync(targetFile.filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const lastLines = lines.slice(-10);
    for (const line of lastLines) {
      try {
        const parsed = JSON.parse(line);
        const eventType = parsed.event || parsed.type || 'unknown';
        const filterEvents = level ? (LEVEL_FILTER_MAP[level] || [level]) : null;
        if (filterEvents && !filterEvents.includes(eventType)) continue;

        const label = EVENT_LABELS[eventType] || eventType || '?';
        const timeStr = formatTimestamp(parsed.timestamp || parsed.ts || '');
        const summary = formatDataSummary(eventType, parsed.data || {});
        output.log(`${timeStr}  ${label}  ${summary}`);
      } catch {
        // 跳过无法解析的行
      }
    }
  } catch {
    // 忽略
  }

  // 轮询监听（不支持 fs.watch 的跨平台 tail -f）
  let cachedSize = fileSize;
  const pollInterval = setInterval(() => {
    try {
      const stats = fs.statSync(targetFile.filePath);
      if (stats.size > cachedSize) {
        const buffer = Buffer.alloc(stats.size - cachedSize);
        const fd = fs.openSync(targetFile.filePath, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, cachedSize);
        fs.closeSync(fd);

        const newContent = buffer.toString('utf-8');
        const lines = newContent.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const eventType = parsed.event || parsed.type || 'unknown';
            const filterEvents = level ? (LEVEL_FILTER_MAP[level] || [level]) : null;
            if (filterEvents && !filterEvents.includes(eventType)) continue;

            const label = EVENT_LABELS[eventType] || eventType || '?';
            const timeStr = formatTimestamp(parsed.timestamp || parsed.ts || '');
            const summary = formatDataSummary(eventType, parsed.data || {});
            output.log(`${timeStr}  ${label}  ${summary}`);
          } catch {
            // 跳过无法解析的行
          }
        }

        cachedSize = stats.size;
      }
    } catch {
      // 文件可能被删除/移动
    }
  }, 1000);

  // 进程退出时清理
  process.on('SIGINT', () => {
    clearInterval(pollInterval);
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    clearInterval(pollInterval);
    process.exit(0);
  });
}

// ── 格式化辅助函数 ──

/**
 * 格式化时间戳为可读字符串
 */
function formatTimestamp(ts) {
  if (!ts) return '?'.repeat(19);
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts).slice(0, 19);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return String(ts).slice(0, 19);
  }
}

/**
 * 为常见事件类型生成数据摘要
 */
function formatDataSummary(eventType, data) {
  if (!data || typeof data !== 'object') return '';

  switch (eventType) {
    case 'task:start':
      return data.description || data.name || data.task || data.message || '';

    case 'task:update':
      return data.status
        ? `${data.status}${data.detail ? ' — ' + data.detail : ''}`
        : data.message || '';

    case 'completion':
    case 'task:completion':
    case 'task:complete':
      return data.summary || data.result || data.message || '已完成';

    case 'error':
    case 'task:error':
      return data.message || data.error || '';

    case 'progress':
      return data.message || data.progress || '';

    case 'suggestion':
      return data.content
        ? String(data.content).slice(0, 140)
        : '';

    case 'task:add':
      return Array.isArray(data.tasks)
        ? `添加 ${data.tasks.length} 个任务`
        : data.description || data.message || '';

    case 'task:cancel':
      return data.reason || data.message || '';

    default:
      return data.message || data.description || data.content
        ? String(data.message || data.description || data.content).slice(0, 140)
        : '';
  }
}
