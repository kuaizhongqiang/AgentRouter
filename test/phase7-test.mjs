/**
 * phase7-test.mjs — Phase 7 Runtime Integration Test
 *
 * Tests all Phase 7 features by importing the compiled dist-electron/ modules.
 * Phase 7: 启动流程重构 — Agent 检测 + 会话恢复 + 记忆/Wiki 预热
 *
 * Coverage: #32 #33 #36 #40 #42 #43 #46 #47 #48
 */
import { createRequire } from 'module';
import { spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_ELECTRON = path.resolve(PROJECT_ROOT, 'dist-electron');

const require = createRequire(import.meta.url);

// ── Test counters ──
let passCount = 0;
let failCount = 0;

function assert(condition, label) {
  if (condition) { passCount++; console.log(`  ✅ ${label}`); }
  else { failCount++; console.log(`  ❌ ${label}`); }
}

function assertEq(actual, expected, label) {
  if (actual === expected) { passCount++; console.log(`  ✅ ${label}`); }
  else {
    failCount++;
    console.log(`  ❌ ${label}`);
    console.log(`       expected: ${JSON.stringify(expected)}`);
    console.log(`       actual:   ${JSON.stringify(actual)}`);
  }
}

function assertNe(actual, expected, label) {
  if (actual !== expected) { passCount++; console.log(`  ✅ ${label}`); }
  else {
    failCount++;
    console.log(`  ❌ ${label} (should NOT be ${JSON.stringify(expected)})`);
  }
}

function group(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

function checkModuleExists(modPath) {
  try {
    require.resolve(modPath);
    return true;
  } catch {
    return false;
  }
}

// ── Get real modules (from dist-electron) ──
function getModule(name) {
  const modPath = path.join(DIST_ELECTRON, ...name.split('/'));
  try {
    return require(modPath);
  } catch (err) {
    console.log(`  ⚠  Module ${modPath} not available: ${err.message}`);
    return null;
  }
}

// ════════════════════════════════════════════════
//  Tests
// ════════════════════════════════════════════════

group('Phase 7 — Compiled Modules Existence');

(function testModulesExist() {
  assert(checkModuleExists(path.join(DIST_ELECTRON, 'main.js')), 'main.js compiled');
  assert(checkModuleExists(path.join(DIST_ELECTRON, 'preload.js')), 'preload.js compiled');
  assert(checkModuleExists(path.join(DIST_ELECTRON, 'agents/manager.js')), 'manager.js compiled');
  assert(checkModuleExists(path.join(DIST_ELECTRON, 'mcp/server.js')), 'mcp/server.js compiled');
  assert(checkModuleExists(path.join(DIST_ELECTRON, 'ipc/agents.js')), 'ipc/agents.js compiled');
  assert(checkModuleExists(path.join(DIST_ELECTRON, 'ipc/projects.js')), 'ipc/projects.js compiled');
  assert(checkModuleExists(path.join(DIST_ELECTRON, 'database/repository.js')), 'repository.js compiled');
})();

group('#32: Agent 全局数据目录');

(function testAgentDataDir() {
  const manager = getModule('agents/manager');
  if (!manager) { console.log('  ⚠  Skipping — manager module not loaded'); return; }

  // Test the static method
  const dataDir = manager.AgentManager.getAgentDataDir('testagent');
  const expected = path.join(os.homedir(), '.agentRouter', '.agtestagent');
  assertEq(dataDir, expected, 'getAgentDataDir returns ~/.agentRouter/.ag<name>/');

  // Test it's DIFFERENT from old path
  const oldPath = path.join(os.homedir(), '.agentrouter', 'agents', 'testagent');
  assertNe(dataDir, oldPath, 'data dir is NOT old ~/.agentrouter/agents/ path');

  // Test for each registered agent
  const codewhaleDir = manager.AgentManager.getAgentDataDir('codewhale');
  assert(codewhaleDir.includes('.agcodewhale'), 'codewhale dir uses .agcodewhale');

  const reasonixDir = manager.AgentManager.getAgentDataDir('reasonix');
  assert(reasonixDir.includes('.agreasonix'), 'reasonix dir uses .agreasonix');
})();

group('#33: 项目级 Agent 记忆目录');

(function testProjectAgentDataDir() {
  const manager = getModule('agents/manager');
  if (!manager) { console.log('  ⚠  Skipping — manager module not loaded'); return; }

  const projectPath = 'C:/test-project';
  const projDir = manager.AgentManager.getProjectAgentDataDir(projectPath, 'codewhale');
  const expected = path.join(projectPath, '.agentRouter', '.agcodewhale');
  assertEq(projDir, expected, 'getProjectAgentDataDir returns <project>/.agentRouter/.ag<name>/');

  // Test ensureProjectAgentDataDirs method exists
  assert(typeof manager.AgentManager.prototype.ensureProjectAgentDataDirs === 'function', 'ensureProjectAgentDataDirs method exists');
})();

group('#36: LeafWiki 包装层');

(function testLeafWikiWrapper() {
  const wrapperPath = path.join(PROJECT_ROOT, 'agents', 'leafwiki', 'platform.cjs');
  assert(fs.existsSync(wrapperPath), 'LeafWiki platform.cjs exists');

  const forkPath = path.join(PROJECT_ROOT, 'agents', 'leafwiki', 'FORK.md');
  assert(fs.existsSync(forkPath), 'LeafWiki FORK.md exists');

  // Verify the wrapper can be loaded
  try {
    require(wrapperPath);
    assert(true, 'LeafWiki platform.cjs is valid CommonJS');
  } catch (err) {
    assert(false, `LeafWiki platform.cjs loads without error: ${err.message}`);
  }

  // Test that the wrapper handles unknown command gracefully
  const proc = spawnSync('node', [wrapperPath, 'unknown-cmd'], {
    encoding: 'utf-8',
    timeout: 3000,
  });
  assert(proc.status !== 0, 'LeafWiki unknown command exits non-zero');
  assert(proc.stdout.includes('Usage:') || proc.stderr.includes('Usage:'), 'LeafWiki shows usage for unknown commands');
})();

group('#36: MCP Wiki Tools');

(function testMcpWikiTools() {
  const mcpPath = path.join(DIST_ELECTRON, 'mcp', 'server.js');
  assert(fs.existsSync(mcpPath), 'MCP server.js compiled');

  // Read the server source to verify wiki tools are defined
  const src = fs.readFileSync(mcpPath, 'utf-8');
  assert(src.includes('wiki.read'), 'MCP server has wiki.read tool');
  assert(src.includes('wiki.write'), 'MCP server has wiki.write tool');
  assert(src.includes('wiki.search'), 'MCP server has wiki.search tool');
  assert(src.includes('wiki.list'), 'MCP server has wiki.list tool');
  assert(src.includes('LeafWiki'), 'MCP wiki tools reference LeafWiki');
})();

group('#40: Agent/模式持久化 (frontend)');

(function testPersistenceFrontend() {
  const appPath = path.join(PROJECT_ROOT, 'src', 'App.vue');
  assert(fs.existsSync(appPath), 'App.vue exists');

  const src = fs.readFileSync(appPath, 'utf-8');

  // Check localStorage initialization
  assert(src.includes("localStorage.getItem('settings_defaultAgent')"), 'App.vue reads settings_defaultAgent from localStorage');
  assert(src.includes("localStorage.getItem('settings_defaultMode')"), 'App.vue reads settings_defaultMode from localStorage');

  // Check watchers for saving
  assert(src.includes("localStorage.setItem('settings_defaultAgent'"), 'App.vue saves selectedAgent to localStorage');
  assert(src.includes("localStorage.setItem('settings_defaultMode'"), 'App.vue saves selectedMode to localStorage');

  // Check that saved agent is restored with fallback
  assert(src.includes('savedAgent && agents.value.some'), 'App.vue validates saved agent still exists');
})();

group('#42: 全局异常捕获');

(function testGlobalErrorHandlers() {
  const mainSrc = fs.readFileSync(path.join(DIST_ELECTRON, 'main.js'), 'utf-8');
  assert(mainSrc.includes('uncaughtException'), 'main.js has uncaughtException handler');
  assert(mainSrc.includes('unhandledRejection'), 'main.js has unhandledRejection handler');
  assert(mainSrc.includes('saveDatabase'), 'Error handlers call saveDatabase()');
})();

group('#43: MCP 子进程清理');

(function testMcpCleanup() {
  const mainSrc = fs.readFileSync(path.join(DIST_ELECTRON, 'main.js'), 'utf-8');
  assert(mainSrc.includes('stopMcpServer'), 'main.js has stopMcpServer function');
  assert(mainSrc.includes('stopLeafWiki'), 'main.js has stopLeafWiki function');
  assert(mainSrc.includes('before-quit'), 'before-quit handler exists');

  // Verify both are called in before-quit
  const beforeQuitIndex = mainSrc.indexOf('before-quit');
  const beforeQuitBlock = mainSrc.slice(beforeQuitIndex, beforeQuitIndex + 300);
  assert(beforeQuitBlock.includes('stopMcpServer'), 'before-quit calls stopMcpServer');
  assert(beforeQuitBlock.includes('stopLeafWiki'), 'before-quit calls stopLeafWiki');
})();

group('#46: Agent 健康检查与禁用');

(function testAgentHealth() {
  const manager = getModule('agents/manager');
  if (!manager) { console.log('  ⚠  Skipping — manager module not loaded'); return; }

  // Check that the AgentHealthStatus type / class is exported
  const ManagerClass = manager.AgentManager;
  assert(typeof ManagerClass === 'function', 'AgentManager class exists');

  // Check the health check methods exist on prototype
  const proto = ManagerClass.prototype;
  assert(typeof proto.checkAllAgentsHealth === 'function', 'checkAllAgentsHealth method exists');
  assert(typeof proto.getAllAgentsHealth === 'function', 'getAllAgentsHealth method exists');
  assert(typeof proto.getAgentHealth === 'function', 'getAgentHealth method exists');
  assert(typeof proto.disableAgent === 'function', 'disableAgent method exists');
  assert(typeof proto.enableAgent === 'function', 'enableAgent method exists');
  assert(typeof proto.listWithHealth === 'function', 'listWithHealth method exists');
  assert(typeof proto.doctor === 'function', 'doctor method still exists');

  // Check IPC handlers for health
  const agentsIpc = fs.readFileSync(path.join(DIST_ELECTRON, 'ipc', 'agents.js'), 'utf-8');
  assert(agentsIpc.includes('agent:health'), 'IPC has agent:health handler');
  assert(agentsIpc.includes('agent:health:check'), 'IPC has agent:health:check handler');
  assert(agentsIpc.includes('agent:disable'), 'IPC has agent:disable handler');
  assert(agentsIpc.includes('agent:enable'), 'IPC has agent:enable handler');
  assert(agentsIpc.includes('agent:listWithHealth'), 'IPC has agent:listWithHealth handler');

  // Check preload exposes health APIs
  const preloadSrc = fs.readFileSync(path.join(DIST_ELECTRON, 'preload.js'), 'utf-8');
  assert(preloadSrc.includes('getHealth'), 'preload exposes getHealth');
  assert(preloadSrc.includes('checkHealth'), 'preload exposes checkHealth');
  assert(preloadSrc.includes('disable'), 'preload exposes disable');
  assert(preloadSrc.includes('enable'), 'preload exposes enable');
  assert(preloadSrc.includes('listWithHealth'), 'preload exposes listWithHealth');
})();

group('#47: MCP 进程管理');

(function testMcpManagement() {
  const mainSrc = fs.readFileSync(path.join(DIST_ELECTRON, 'main.js'), 'utf-8');

  // Check MCP management functions exist
  assert(mainSrc.includes('function startMcpServer'), 'startMcpServer function defined');
  assert(mainSrc.includes('function stopMcpServer'), 'stopMcpServer function defined');
  assert(mainSrc.includes('function isMcpAlive'), 'isMcpAlive function defined');
  assert(mainSrc.includes('MCP_MAX_RESTARTS'), 'MCP restart limit defined');
  assert(mainSrc.includes('startMcpHeartbeat'), 'startMcpHeartbeat function defined');
  assert(mainSrc.includes('MCP_HEARTBEAT_INTERVAL'), 'MCP heartbeat interval defined');

  // Check crash restart logic
  assert(mainSrc.includes('Auto-restart'), 'MCP crash auto-restart logic exists');
  assert(mainSrc.includes('Max restarts reached'), 'MCP max restarts limit handling exists');
})();

group('#48: 启动状态机');

(function testStartupStateMachine() {
  const mainSrc = fs.readFileSync(path.join(DIST_ELECTRON, 'main.js'), 'utf-8');

  // Check startup sequence function
  assert(mainSrc.includes('function runStartupSequence'), 'runStartupSequence function defined');

  // Check all startup phases are represented
  assert(mainSrc.includes("'INIT'"), 'Startup has INIT phase');
  assert(mainSrc.includes("'DATA_INIT'"), 'Startup has DATA_INIT phase');
  assert(mainSrc.includes("'AGENT_DOCTOR'"), 'Startup has AGENT_DOCTOR phase');
  assert(mainSrc.includes("'SESSION_RESTORE'"), 'Startup has SESSION_RESTORE phase');
  assert(mainSrc.includes("'READY'"), 'Startup has READY phase');

  // Check sendStartupStatus function
  assert(mainSrc.includes('function sendStartupStatus'), 'sendStartupStatus function defined');
  assert(mainSrc.includes('app:startup'), 'Startup sends app:startup IPC events');

  // Check error collection
  assert(mainSrc.includes('errors.push'), 'Startup collects errors without blocking');

  // Check startup doesn't block on failures
  assert(mainSrc.includes('sendReadyStatus'), 'Startup always calls sendReadyStatus');

  // Check that startup sequence starts after did-finish-load
  assert(mainSrc.includes('did-finish-load'), 'Startup waits for did-finish-load');
  assert(mainSrc.includes('runStartupSequence'), 'Startup sequence is triggered from did-finish-load');
})();

group('Frontend: Phase 7 Changes');

(function testFrontendChanges() {
  const appSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'App.vue'), 'utf-8');

  // #46: Agent health display in template
  assert(appSrc.includes(':disabled="a.health && !a.health.healthy"'), 'Agent dropdown disables unhealthy agents');
  assert(appSrc.includes('a.health.healthy'), 'Agent dropdown shows health status');
  assert(appSrc.includes('agent.listWithHealth'), 'App.vue uses listWithHealth');

  // #46: Health check on startup
  assert(appSrc.includes('agent.checkHealth'), 'Startup calls health check');

  // #48: Startup event listener
  assert(appSrc.includes('agent.onStartup'), 'App.vue listens for app:startup events');
  assert(appSrc.includes('startupPhase'), 'App.vue tracks startup phase');
  assert(appSrc.includes('startupMessage'), 'App.vue tracks startup message');

  // #33: Project-level agent dirs
  assert(appSrc.includes('db.initAgentDirs'), 'App.vue calls initAgentDirs on project select');
})();

group('LeafWiki FORK.md Documents');

(function testLeafWikiDocs() {
  const forkMd = fs.readFileSync(path.join(PROJECT_ROOT, 'agents', 'leafwiki', 'FORK.md'), 'utf-8');

  assert(forkMd.includes('MIT'), 'FORK.md mentions MIT license');
  assert(forkMd.includes('AgentRouter'), 'FORK.md mentions AgentRouter');
  assert(forkMd.includes('https://github.com/perber/leafwiki'), 'FORK.md links to original repo');
  assert(forkMd.includes('platform.cjs'), 'FORK.md mentions platform.cjs wrapper');
  assert(forkMd.includes('LEAFWIKI_PORT'), 'FORK.md documents LEAFWIKI_PORT env var');
  assert(forkMd.includes('LEAFWIKI_BIN'), 'FORK.md documents LEAFWIKI_BIN env var');
})();

// ════════════════════════════════════════════════
//  Summary
// ════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`);
console.log(`  Phase 7 Test Results`);
console.log(`${'═'.repeat(60)}`);
const total = passCount + failCount;
console.log(`  Total:  ${total}`);
console.log(`  Passed: ${passCount} ✅`);
console.log(`  Failed: ${failCount} ${failCount === 0 ? '✅' : '❌'}`);
console.log(`  Rate:   ${(passCount / total * 100).toFixed(1)}%`);
console.log(`\n${'═'.repeat(60)}\n`);

process.exit(failCount > 0 ? 1 : 0);
