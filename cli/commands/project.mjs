/**
 * AgentRouter CLI — 项目管理命令
 *
 * 用法: ar project <subcommand> [args...]
 *
 * 子命令:
 *   list                   列出所有项目
 *   create <name> <path>   创建项目
 *   show <id>              查看项目详情
 *   rm <id>                删除项目
 *   use <id>               选择当前项目
 *   config get [key]       读取项目配置
 *   config set <key> <value>  设置项目配置
 */
import { getModules } from '../lib/bootstrap.mjs';
import * as output from '../lib/output.mjs';
import path from 'path';
import fs from 'fs';

const USAGE = `
用法: ar project <subcommand> [args...]

子命令:
  list                          列出所有项目
  create <name> <path>          创建项目
  show <id>                     查看项目详情
  rm <id>                       删除项目 (--yes 跳过确认)
  use <id>                      选择当前项目
  config get [key]              读取项目配置
  config set <key> <value>      设置项目配置

选项:
  --json        JSON 格式输出
  --yes         自动确认
`;

export default async function handler(args, options) {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === 'help' || subcommand === '--help') {
    output.log(USAGE);
    return;
  }

  try {
    switch (subcommand) {
      case 'list':
        return await listProjects(options);
      case 'create':
        return await createProject(rest, options);
      case 'show':
        return await showProject(rest, options);
      case 'rm':
      case 'remove':
      case 'delete':
        return await removeProject(rest, options);
      case 'use':
        return await useProject(rest, options);
      case 'init':
        return await initProject(rest, options);
      case 'config':
        return await configProject(rest, options);
      default:
        output.error(`未知子命令: ${subcommand}`);
        output.log(USAGE);
    }
  } catch (err) {
    output.fatal(`project ${subcommand} 失败: ${err.message}`);
  }
}

async function listProjects(options) {
  const { repos } = getModules();
  const projects = await repos.listProjects();

  if (projects.length === 0) {
    output.log('(没有项目)');
    return;
  }

  if (output.isJsonMode()) {
    output.json(projects);
    return;
  }

  const rows = projects.map(p => ({
    id: p.id,
    name: p.name,
    path: p.path,
    updatedAt: p.updatedAt,
  }));
  output.table(rows, ['id', 'name', 'path', 'updatedAt']);
}

async function createProject(args, options) {
  const [name, projectPath] = args;

  if (!name || !projectPath) {
    output.fatal('用法: ar project create <name> <path>');
  }

  const { repos, manager } = getModules();
  const resolvedPath = path.resolve(projectPath);

  // 确保目标目录存在
  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(resolvedPath, { recursive: true });
  }

  const project = await repos.createProject(name, resolvedPath);

  // 创建项目级 Agent 数据目录
  if (manager && typeof manager.ensureProjectAgentDataDirs === 'function') {
    try {
      manager.ensureProjectAgentDataDirs(resolvedPath);
    } catch (_) {
      // 非致命: 目录创建失败不影响项目创建
    }
  }

  output.success(`项目 "${name}" 已创建 (ID: ${project.id})`);
}

async function showProject(args, options) {
  const [id] = args;

  if (!id) {
    output.fatal('用法: ar project show <id>');
  }

  const { repos } = getModules();
  const project = await repos.getProject(id);

  if (!project) {
    output.fatal(`项目不存在: ${id}`);
  }

  if (output.isJsonMode()) {
    output.json(project);
    return;
  }

  output.kv('ID', project.id);
  output.kv('名称', project.name);
  output.kv('路径', project.path);
  output.kv('创建时间', project.createdAt);
  output.kv('更新时间', project.updatedAt);
}

async function removeProject(args, options) {
  const [id] = args;

  if (!id) {
    output.fatal('用法: ar project rm <id> [--yes]');
  }

  const { repos } = getModules();
  const project = await repos.getProject(id);

  if (!project) {
    output.fatal(`项目不存在: ${id}`);
  }

  // 确认删除
  if (!options.yes && !options.y) {
    output.warn(`将永久删除项目 "${project.name}" (ID: ${id}) 及其所有数据。`);
    output.warn('使用 --yes 跳过确认。');
    // 这里无法交互等待，提示用户加 --yes
    output.fatal('请添加 --yes 参数确认删除。');
  }

  await repos.removeProject(id);
  output.success(`项目 "${project.name}" 已删除`);
}

async function useProject(args, options) {
  const [id] = args;

  if (!id) {
    output.fatal('用法: ar project use <id>');
  }

  const { repos } = getModules();
  const project = await repos.getProject(id);

  if (!project) {
    output.fatal(`项目不存在: ${id}`);
  }

  if (output.isJsonMode()) {
    output.json({ currentProject: project.id });
    return;
  }

  output.success(`当前项目已切换为: ${project.name} (ID: ${project.id})`);
}

async function configProject(args, options) {
  const [action, ...rest] = args;

  if (!action || action === 'help') {
    output.log(`
用法: ar project config <action> [args...]

操作:
  get [key]        读取全部配置或指定键
  set <key> <value>  设置配置项
`);
    return;
  }

  switch (action) {
    case 'get':
      return await configGet(rest, options);
    case 'set':
      return await configSet(rest, options);
    default:
      output.error(`未知配置操作: ${action}`);
  }
}

async function configGet(args, options) {
  const { repos } = getModules();

  // 需要项目 ID 来获取路径 — 通过 --project 或默认第一个
  // 这里要求 args 中传入 projectId 作为第一个参数
  const [projectId, key] = args;

  if (!projectId) {
    output.fatal('用法: ar project config get <projectId> [key]');
  }

  const project = await repos.getProject(projectId);
  if (!project) {
    output.fatal(`项目不存在: ${projectId}`);
  }

  const configPath = path.join(project.path, 'agentrouter.json');
  let config = {};

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (_) {
      config = {};
    }
  }

  if (key) {
    const value = config[key];
    if (value === undefined) {
      output.log(`(键 "${key}" 不存在)`);
      return;
    }
    if (output.isJsonMode()) {
      output.json({ [key]: value });
      return;
    }
    output.kv(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    return;
  }

  if (output.isJsonMode()) {
    output.json(config);
    return;
  }

  if (Object.keys(config).length === 0) {
    output.log('(配置为空)');
    return;
  }

  for (const [k, v] of Object.entries(config)) {
    output.kv(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
}

async function configSet(args, options) {
  const { repos } = getModules();

  const [projectId, key, value] = args;

  if (!projectId || !key || value === undefined) {
    output.fatal('用法: ar project config set <projectId> <key> <value>');
  }

  const project = await repos.getProject(projectId);
  if (!project) {
    output.fatal(`项目不存在: ${projectId}`);
  }

  const configPath = path.join(project.path, 'agentrouter.json');
  let config = {};

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (_) {
      config = {};
    }
  }

  // 尝试解析 value 为 JSON
  let parsedValue;
  try {
    parsedValue = JSON.parse(value);
  } catch (_) {
    parsedValue = value;
  }

  config[key] = parsedValue;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  output.success(`配置项 "${key}" 已设置`);
}

async function initProject(args, options) {
  const { repos, projectInit } = getModules();
  const [projectId] = args;

  if (!projectId) {
    output.fatal('用法: ar project init <projectId>');
  }

  const project = await repos.getProject(projectId);
  if (!project) {
    output.fatal(`项目不存在: ${projectId}`);
  }

  output.log(`🔍 正在初始化项目 "${project.name}" (${project.path})...`);
  const profile = await projectInit.quickInit(projectId, project.path);

  if (output.isJsonMode()) {
    output.json(profile);
  } else {
    output.success('初始化完成');
    output.log(`  技术栈: ${profile.techStack.join(', ') || '（未识别）'}`);
    output.log(`  文件数: ${profile.fileCount}  目录数: ${profile.dirCount}`);
    output.log(`  Git: ${profile.hasGit ? '✅' : '❌'}`);
    output.log(`  README: ${profile.hasReadme ? '✅' : '❌'}`);
    output.log(`  依赖: ${Object.keys(profile.dependencies).length} 个`);
  }
}
