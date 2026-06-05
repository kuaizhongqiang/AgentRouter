/**
 * AgentRouter CLI — Token 用量查询命令
 *
 * 子命令:
 *   usage <sessionId>         查看指定会话的 Token 用量
 *   stats [projectId]         查看项目/全局 Token 统计
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';

export default async function handler(args, options) {
  const subcommand = args[0];

  try {
    switch (subcommand) {
      case 'usage':
        return await cmdUsage(args[1], options);
      case 'stats':
        return await cmdStats(args[1], options);
      default:
        output.fatal(
          `未知子命令: ${subcommand}\n用法: ar token usage <sessionId> | stats [projectId]`
        );
    }
  } catch (err) {
    output.fatal(err.message);
  }
}

async function cmdUsage(sessionId, options) {
  if (!sessionId) {
    output.fatal('请提供 sessionId\n用法: ar token usage <sessionId>');
  }

  const { repos } = getModules();
  const usage = await repos.getSessionTokenUsage(sessionId);

  if (output.isJsonMode()) {
    output.json(usage);
    return;
  }

  output.table(
    [
      {
        prompt: String(usage.totalPromptTokens),
        completion: String(usage.totalCompletionTokens),
        total: String(usage.totalTokens),
      },
    ],
    ['prompt', 'completion', 'total']
  );
}

async function cmdStats(projectId, options) {
  const { repos } = getModules();

  let projects;
  if (projectId) {
    const project = await repos.getProject(projectId);
    if (!project) {
      output.fatal(`项目不存在: ${projectId}`);
    }
    projects = [project];
  } else {
    projects = await repos.listProjects();
  }

  if (!projects || projects.length === 0) {
    output.log('(无项目)');
    return;
  }

  const rows = [];
  let grandTotalPrompt = 0;
  let grandTotalCompletion = 0;
  let grandTotalAll = 0;

  for (const project of projects) {
    const sessions = await repos.listSessions(project.id);
    let projectPrompt = 0;
    let projectCompletion = 0;
    let projectTotal = 0;

    for (const session of sessions) {
      const usage = await repos.getSessionTokenUsage(session.id);
      projectPrompt += Number(usage.totalPromptTokens);
      projectCompletion += Number(usage.totalCompletionTokens);
      projectTotal += Number(usage.totalTokens);
    }

    grandTotalPrompt += projectPrompt;
    grandTotalCompletion += projectCompletion;
    grandTotalAll += projectTotal;

    rows.push({
      project: project.name,
      sessions: String(sessions.length),
      prompt: String(projectPrompt),
      completion: String(projectCompletion),
      total: String(projectTotal),
    });
  }

  if (output.isJsonMode()) {
    output.json(rows);
    return;
  }

  output.table(rows, ['project', 'sessions', 'prompt', 'completion', 'total']);

  if (projects.length > 1) {
    output.log('');
    output.kv('总计 (Prompt)', String(grandTotalPrompt));
    output.kv('总计 (Completion)', String(grandTotalCompletion));
    output.kv('总计 (Total)', String(grandTotalAll));
  }
}
