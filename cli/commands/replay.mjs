/**
 * AgentRouter CLI — Session 回放命令
 *
 * 用法:
 *   ar replay <sessionId>             回放事件时间线
 *   ar replay <sessionId> --json      输出 JSON 事件数组
 *   ar replay <sessionId> --raw       输出原始 JSONL 内容
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

const EVENTS_BASE = path.join(os.homedir(), '.agentrouter', 'projects');

export default async function handler(args, options) {
  const sessionId = args[0];

  if (!sessionId) {
    output.fatal('请提供 sessionId\n用法: ar replay <sessionId> [--json] [--raw]');
  }

  try {
    const { repos } = getModules();

    // 通过 session 获取 projectId
    const session = await repos.getSession(sessionId);
    if (!session) {
      output.fatal(`Session 不存在: ${sessionId}`);
    }

    const eventsDir = path.join(EVENTS_BASE, session.projectId, 'sessions', sessionId, 'events');

    if (!fs.existsSync(eventsDir)) {
      output.log('(该会话暂无事件记录)');
      return;
    }

    // 读取所有 .jsonl 文件
    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.jsonl'));

    if (files.length === 0) {
      output.log('(该会话暂无事件记录)');
      return;
    }

    // --raw 模式：直接输出所有文件原始内容
    if (options.raw) {
      for (const file of files) {
        const content = fs.readFileSync(path.join(eventsDir, file), 'utf-8');
        console.log(content);
      }
      return;
    }

    // 解析所有事件
    const allEvents = [];
    for (const file of files) {
      const agentName = file.replace('.jsonl', '');
      const lines = fs.readFileSync(path.join(eventsDir, file), 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const evt = JSON.parse(line);
          evt._agentName = agentName;
          evt._sourceFile = file;
          allEvents.push(evt);
        } catch {
          // 跳过无法解析的行
        }
      }
    }

    // 按时间戳排序
    allEvents.sort((a, b) => {
      const ta = a.timestamp || a.ts || 0;
      const tb = b.timestamp || b.ts || 0;
      return new Date(ta).getTime() - new Date(tb).getTime();
    });

    // --json 模式：输出事件数组
    if (output.isJsonMode() || options.json) {
      output.json(allEvents);
      return;
    }

    // 人类可读的时间线
    for (const evt of allEvents) {
      const ts = evt.timestamp || evt.ts || '';
      const agent = evt._agentName || '?';
      const eventType = evt.event || evt.type || 'unknown';
      const timeStr = ts ? new Date(ts).toLocaleTimeString() : '?';
      const summary = formatEventSummary(eventType, evt.data || evt);

      output.log(`[${timeStr}] [${agent}] ${eventType}${summary ? ': ' + summary : ''}`);
    }
  } catch (err) {
    output.fatal(err.message);
  }
}

/**
 * 为常见事件类型生成摘要
 */
function formatEventSummary(eventType, data) {
  if (!data || typeof data !== 'object') return '';

  switch (eventType) {
    case 'task:start':
    case 'task_start':
      return data.description || data.name || data.task || '';

    case 'task:update':
    case 'task_update':
      return data.status
        ? `${data.status}${data.detail ? ' — ' + data.detail : ''}`
        : '';

    case 'completion':
    case 'task:completion':
      return data.summary || data.result || data.message || '已完成';

    case 'error':
    case 'task:error':
      return data.message || data.error || '';

    case 'progress':
      return data.message || data.progress || '';

    case 'suggestion':
      return data.content
        ? String(data.content).slice(0, 120)
        : '';

    case 'task:add':
      return Array.isArray(data.tasks)
        ? `添加 ${data.tasks.length} 个任务`
        : data.description || '';

    case 'task:cancel':
      return data.reason || '';

    default:
      // 尝试提取常见字段
      return data.message || data.description || data.content
        ? String(data.message || data.description || data.content).slice(0, 120)
        : '';
  }
}
