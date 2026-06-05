/**
 * AgentRouter CLI — exec 命令处理器
 *
 * 用法:
 *   ar exec <agent> <command>         执行 Agent 指令
 *   ar fix <desc>                     修复 Bug（codewhale）
 *   ar feat <desc>                    添加功能（codewhale）
 *   ar review <files...>              代码审查（reasonix）
 *   ar refactor <desc>                重构（codewhale）
 *   ar test <desc>                    添加测试（codewhale）
 *   ar doc <desc>                     更新文档（codewhale）
 *   ar goal <req>                     完整需求（reasonix）
 */
import path from 'path';
import os from 'os';
import fs from 'fs';

import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

/** 快捷命令 → (agent, 指令前缀) 映射 */
const SHORTCUTS = {
  fix:     { agent: 'codewhale', prefix: '修复 Bug' },
  feat:    { agent: 'codewhale', prefix: '添加功能' },
  review:  { agent: 'reasonix', prefix: '审查代码' },
  refactor:{ agent: 'codewhale', prefix: '重构' },
  test:    { agent: 'codewhale', prefix: '添加测试' },
  doc:     { agent: 'codewhale', prefix: '更新文档' },
  goal:    { agent: 'reasonix', prefix: null },
};

export default async function handler(args, options) {
  const { manager, repos } = getModules();

  // ── 1. 解析参数：快捷模式 vs 普通 exec ──
  let agentName;
  let command;

  if (options._shortcut) {
    const shortcut = args[0];
    const config = SHORTCUTS[shortcut];
    if (!config) {
      output.fatal(`未知快捷命令: ${shortcut}`);
    }
    agentName = config.agent;
    const desc = args.slice(1).join(' ');
    if (!desc) {
      output.fatal(`缺少描述参数，用法: ar ${shortcut} <描述>`);
    }
    command = config.prefix ? `${config.prefix}: ${desc}` : desc;
  } else {
    agentName = args[0];
    command = args.slice(1).join(' ');
    if (!agentName || !command) {
      output.fatal('用法: ar exec <agent> <command>');
    }
  }

  // ── 2. 确定项目 ──
  let projectId = options.project;
  let cwd = options.cwd || undefined;

  if (options.session) {
    // 通过已有 session 确定项目
    const existingSession = await repos.getSession(options.session);
    if (!existingSession) {
      output.fatal(`会话不存在: ${options.session}`);
    }
    projectId = projectId || existingSession.projectId;
  }

  if (!projectId) {
    const projects = await repos.listProjects();
    if (projects.length > 0) {
      projectId = projects[0].id;
      cwd = cwd || projects[0].path;
    } else {
      const defaultProject = await repos.createProject('_default', process.cwd());
      projectId = defaultProject.id;
    }
  }

  // ── 3. 确定或创建会话 ──
  let sessionId = options.session;
  if (!sessionId) {
    const session = await repos.createSession(
      projectId,
      command.length > 60 ? command.slice(0, 57) + '...' : command,
      agentName
    );
    sessionId = session.id;
  }

  // ── 4. 添加用户消息 ──
  await repos.addMessage(sessionId, 'user', command);

  // ── 5. 执行 ──
  const mode = options.mode || '对话';

  output.log(`🚀 ${agentName} 开始执行 (mode: ${mode})`);

  try {
    const logId = await manager.exec(agentName, command, sessionId, projectId, cwd, mode);

    // ── 6. 读取事件文件，提取 Agent 回复 ──
    const eventsDir = path.join(
      os.homedir(),
      '.agentrouter', 'projects', projectId, 'sessions', sessionId, 'events'
    );
    const logPath = path.join(eventsDir, `${agentName}.jsonl`);

    let reply = '';

    if (fs.existsSync(logPath)) {
      const raw = fs.readFileSync(logPath, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim());

      // 从后向前查找首个 completion 事件
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const ev = JSON.parse(lines[i]);
          if (ev.type === 'event' && ev.event === 'completion') {
            reply = ev.data?.summary || ev.data?.content || ev.data?.response || '';
            if (reply) break;
          }
        } catch {
          // 跳过不可解析的行
        }
      }
    }

    // ── 7. 将 Agent 回复存入消息 ──
    if (reply) {
      await repos.addMessage(sessionId, 'agent', reply);
    }

    // ── 8. 输出 ──
    if (output.isJsonMode()) {
      output.json({
        sessionId,
        projectId,
        logId,
        agent: agentName,
        reply,
      });
    } else {
      output.success(`${agentName} 执行完成`);
      if (reply) {
        output.log('');
        output.log(reply);
      }
    }
  } catch (err) {
    output.fatal(`执行失败: ${err.message}`);
  }
}
