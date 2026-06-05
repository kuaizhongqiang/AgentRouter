/**
 * AgentRouter CLI — Bootstrap
 *
 * 加载 dist-electron/ 编译好的 CommonJS 模块，
 * 初始化 Database、AgentManager、Credentials。
 *
 * 所有命令处理器通过此模块获取后端能力。
 */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_ELECTRON = path.resolve(__dirname, '..', '..', 'dist-electron');

const require = createRequire(import.meta.url);

// ── 惰性加载的单例 ──

let _db = null;
let _manager = null;
let _credentials = null;
let _repos = null;
let _projectInit = null;
let _initialized = false;

/**
 * 初始化所有后端模块
 * 可多次调用，仅首次实际执行
 */
export async function init() {
  if (_initialized) return getModules();

  // 1. 检查 dist-electron 是否存在
  if (!fs.existsSync(DIST_ELECTRON)) {
    throw new Error(
      `dist-electron/ 不存在。请先执行 npm run build:electron 编译后端模块。`
    );
  }

  // 2. 加载数据库
  const dbMod = require(path.join(DIST_ELECTRON, 'database/index'));
  _db = await dbMod.getDatabase();

  // 3. 运行迁移
  const { runMigrations } = require(path.join(DIST_ELECTRON, 'database/migrations'));
  runMigrations(_db);

  // 4. 加载 AgentManager + 注册所有适配器
  const { AgentManager } = require(path.join(DIST_ELECTRON, 'agents/manager'));
  const { CodeWhaleAdapter } = require(path.join(DIST_ELECTRON, 'agents/codewhale'));
  const { ReasonixAdapter } = require(path.join(DIST_ELECTRON, 'agents/reasonix'));
  const { DeepCodeAdapter } = require(path.join(DIST_ELECTRON, 'agents/deepcode'));
  const { OpenCodeAdapter } = require(path.join(DIST_ELECTRON, 'agents/opencode'));
  const { ClineAdapter } = require(path.join(DIST_ELECTRON, 'agents/cline'));
  const { ContinueAdapter } = require(path.join(DIST_ELECTRON, 'agents/continue'));

  _manager = new AgentManager();
  _manager.register(new CodeWhaleAdapter());
  _manager.register(new ReasonixAdapter());
  _manager.register(new DeepCodeAdapter());
  _manager.register(new OpenCodeAdapter());
  _manager.register(new ClineAdapter());
  _manager.register(new ContinueAdapter());
  _manager.ensureAgentDataDirs();

  // 5. 加载凭证模块
  _credentials = require(path.join(DIST_ELECTRON, 'credentials'));

  // 6. 加载 repository
  _repos = require(path.join(DIST_ELECTRON, 'database/repository'));

  // 7. 加载 project-initializer
  _projectInit = require(path.join(DIST_ELECTRON, 'project-initializer'));

  _initialized = true;
  return getModules();
}

/**
 * 获取已加载的模块引用（不触发初始化）
 */
export function getModules() {
  return {
    db: _db,
    manager: _manager,
    credentials: _credentials,
    repos: _repos,
    projectInit: _projectInit,
  };
}

/**
 * 检查是否已初始化
 */
export function isInitialized() {
  return _initialized;
}
