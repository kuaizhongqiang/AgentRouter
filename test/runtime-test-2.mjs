/**
 * runtime-test-2.mjs — Phase 3–6 Runtime Integration Test
 *
 * Actually imports compiled dist-electron/ CommonJS modules and calls real functions.
 * Does NOT just check file existence — it exercises real code paths.
 */
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_ELECTRON = path.resolve(PROJECT_ROOT, 'dist-electron');

const require = createRequire(import.meta.url);

// ── Test counters ──
let passCount = 0;
let failCount = 0;

function assert(condition, label) {
  if (condition) {
    passCount++;
    console.log(`  ✅ ${label}`);
  } else {
    failCount++;
    console.log(`  ❌ ${label}`);
  }
}

function assertEq(actual, expected, label) {
  if (actual === expected) {
    passCount++;
    console.log(`  ✅ ${label}`);
  } else {
    failCount++;
    console.log(`  ❌ ${label}`);
    console.log(`       expected: ${JSON.stringify(expected)}`);
    console.log(`       actual:   ${JSON.stringify(actual)}`);
  }
}

function assertDeep(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passCount++;
    console.log(`  ✅ ${label}`);
  } else {
    failCount++;
    console.log(`  ❌ ${label}`);
    console.log(`       expected: ${e}`);
    console.log(`       actual:   ${a}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

function runBuild(cmd, args, label) {
  console.log(`  ▶ ${label}…`);
  const result = spawnSync(cmd, args, {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    timeout: 120000,
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (result.status !== 0) {
    console.log(`  ❌ ${label} — exit code ${result.status}`);
    const stderrText = result.stderr?.toString().slice(0, 800);
    if (stderrText) console.log(`     stderr: ${stderrText}`);
    return false;
  }
  return true;
}

// ── Main ──
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  AgentRouter Runtime Integration Test v2');
  console.log('═══════════════════════════════════════════');

  // ──────────────────────────────────────
  // 0. Compilation
  // ──────────────────────────────────────
  section('0. Compilation');

  const buildOk = runBuild(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'build:electron'],
    'npm run build:electron'
  );
  assert(buildOk, 'build:electron completes with exit code 0');

  const viteOk = runBuild(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'build'],
    'npx vite build'
  );
  assert(viteOk, 'vite build completes with exit code 0');

  // ──────────────────────────────────────
  // 1. Phase 3: Agent manifests
  // ──────────────────────────────────────
  section('1. Phase 3: Agent Manifests');

  // adapter.js — interface types (no runtime exports beyond __esModule)
  const adapter = require(path.join(DIST_ELECTRON, 'agents', 'adapter.js'));
  assert(typeof adapter === 'object', 'adapter.js loads as module');

  // CodeWhaleAdapter
  const { CodeWhaleAdapter } = require(path.join(DIST_ELECTRON, 'agents', 'codewhale.js'));
  const cw = new CodeWhaleAdapter();
  assertEq(cw.name, 'codewhale', 'CodeWhaleAdapter.name');
  assertEq(cw.displayName, 'CodeWhale', 'CodeWhaleAdapter.displayName');

  const cwm = cw.manifest();
  assertEq(cwm.identity.id, 'ar-codewhale', 'codewhale manifest identity.id');
  assertEq(cwm.identity.label, 'CodeWhale', 'codewhale manifest identity.label');
  assertEq(cwm.identity.version, '0.8.46', 'codewhale manifest identity.version');
  assertEq(cwm.tagline, 'DeepSeek 深度整合，推理型编码小能手', 'codewhale manifest tagline');
  assertDeep(cwm.best_for, ['代码生成与实现', '功能模块开发', '代码重构', '单元测试'], 'codewhale manifest best_for');
  assertDeep(cwm.not_for, ['长上下文综合分析', '安全审计'], 'codewhale manifest not_for');
  assertEq(cwm.execution_model.parallel_mode, 'multi-process', 'codewhale manifest execution_model.parallel_mode');
  assertEq(cwm.execution_model.max_instances, 4, 'codewhale manifest execution_model.max_instances');
  assertEq(cwm.context_budget.preferred_read_mode, 'incremental', 'codewhale manifest context_budget.preferred_read_mode');
  assertEq(cwm.context_budget.context_window, '64K', 'codewhale manifest context_budget.context_window');

  // ReasonixAdapter
  const { ReasonixAdapter } = require(path.join(DIST_ELECTRON, 'agents', 'reasonix.js'));
  const rx = new ReasonixAdapter();
  assertEq(rx.name, 'reasonix', 'ReasonixAdapter.name');
  assertEq(rx.displayName, 'Reasonix', 'ReasonixAdapter.displayName');

  const rxm = rx.manifest();
  assertEq(rxm.identity.id, 'ar-reasonix', 'reasonix manifest identity.id');
  assertEq(rxm.identity.label, 'Reasonix', 'reasonix manifest identity.label');
  assertEq(rxm.identity.version, '0.52.0', 'reasonix manifest identity.version');
  assertEq(rxm.tagline, '长上下文推理专家，适合规划和审查', 'reasonix manifest tagline');
  assertDeep(rxm.best_for, ['阅读分析大量代码', '需求拆解与规划', '代码审查与安全审计', '架构设计'], 'reasonix manifest best_for');
  assertDeep(rxm.not_for, ['快速编码迭代', '大规模重构执行'], 'reasonix manifest not_for');
  assertEq(rxm.execution_model.parallel_mode, 'sub-agent', 'reasonix manifest execution_model.parallel_mode');
  assertEq(rxm.execution_model.max_instances, 1, 'reasonix manifest execution_model.max_instances');
  assertEq(rxm.context_budget.preferred_read_mode, 'incremental', 'reasonix manifest context_budget.preferred_read_mode');
  assertEq(rxm.context_budget.context_window, '128K', 'reasonix manifest context_budget.context_window');
  assert(rxm.capabilities !== undefined, 'reasonix manifest has capabilities');
  assertEq(rxm.capabilities.can_suggest, true, 'reasonix manifest capabilities.can_suggest');
  assertEq(rxm.capabilities.suggestion_scope, 'related_tasks', 'reasonix manifest capabilities.suggestion_scope');

  // AgentManager — register + list + getManifest
  const { AgentManager } = require(path.join(DIST_ELECTRON, 'agents', 'manager.js'));
  const mgr = new AgentManager();
  assert(mgr !== null, 'AgentManager instantiates');

  mgr.register(cw);
  mgr.register(rx);

  const agentList = mgr.list();
  assertEq(agentList.length, 2, 'AgentManager.list() returns 2 agents');
  // list is ordered by insertion (Map insertion order)
  assertEq(agentList[0].name, 'codewhale', 'list[0].name');
  assertEq(agentList[0].label, 'CodeWhale', 'list[0].label');
  assertEq(agentList[0].manifest.identity.id, 'ar-codewhale', 'list[0].manifest.identity.id');
  assertEq(agentList[1].name, 'reasonix', 'list[1].name');
  assertEq(agentList[1].label, 'Reasonix', 'list[1].label');
  assertEq(agentList[1].manifest.identity.id, 'ar-reasonix', 'list[1].manifest.identity.id');

  const cwManifest = mgr.getManifest('codewhale');
  assert(cwManifest !== null, 'getManifest(codewhale) returns non-null');
  assertEq(cwManifest.identity.id, 'ar-codewhale', 'getManifest(codewhale) identity.id');

  const nullManifest = mgr.getManifest('nonexistent');
  assert(nullManifest === null, 'getManifest(nonexistent) returns null');

  // ──────────────────────────────────────
  // 2. Phase 4: Scheduler
  // ──────────────────────────────────────
  section('2. Phase 4: Scheduler (executor)');

  const executor = require(path.join(DIST_ELECTRON, 'scheduler', 'executor.js'));
  assert(typeof executor.detectFileConflicts === 'function', 'detectFileConflicts is exported');
  assert(typeof executor.groupByParallelGroup === 'function', 'groupByParallelGroup is exported');
  assert(typeof executor.Semaphore === 'function', 'Semaphore is exported');

  // groupByParallelGroup
  const groupTasks = [
    { id: 't1', title: 'Task 1', parallel_group: 0 },
    { id: 't2', title: 'Task 2', parallel_group: 0 },
    { id: 't3', title: 'Task 3', parallel_group: 1 },
    { id: 't4', title: 'Task 4' },
  ];
  const groups = executor.groupByParallelGroup(groupTasks);
  assertEq(groups.length, 3, 'groupByParallelGroup: 3 groups');
  assertEq(groups[0].length, 2, 'groupByParallelGroup: group 0 has 2 tasks');
  assertEq(groups[0][0].id, 't1', 'groupByParallelGroup: group 0 task 0 is t1');
  assertEq(groups[0][1].id, 't2', 'groupByParallelGroup: group 0 task 1 is t2');
  assertEq(groups[1].length, 1, 'groupByParallelGroup: group 1 has 1 task');
  assertEq(groups[1][0].id, 't3', 'groupByParallelGroup: group 1 task is t3');
  assertEq(groups[2].length, 1, 'groupByParallelGroup: ungrouped has 1 task');
  assertEq(groups[2][0].id, 't4', 'groupByParallelGroup: ungrouped task is t4');

  // detectFileConflicts
  const conflictTasks = [
    { id: 'a', title: 'A', context: { scope: ['src/main.ts', 'src/utils.ts'] } },
    { id: 'b', title: 'B', context: { scope: ['src/utils.ts', 'src/api.ts'] } },
    { id: 'c', title: 'C' },
  ];
  const foundConflicts = executor.detectFileConflicts(conflictTasks);
  assertEq(foundConflicts.length, 1, 'detectFileConflicts: 1 conflict found');
  assertEq(foundConflicts[0].file, 'src/utils.ts', 'detectFileConflicts: conflicted file');
  assertDeep(foundConflicts[0].tasks, ['a', 'b'], 'detectFileConflicts: conflicting tasks');

  // detectFileConflicts — no conflict case
  const noConflictTasks = [
    { id: 'x', title: 'X', context: { scope: ['a.ts'] } },
    { id: 'y', title: 'Y', context: { scope: ['b.ts'] } },
  ];
  const noConflicts = executor.detectFileConflicts(noConflictTasks);
  assertEq(noConflicts.length, 0, 'detectFileConflicts: no conflicts when scopes are disjoint');

  // Semaphore limits concurrency
  const sem = new executor.Semaphore(2);
  let concurrent = 0;
  let maxConcurrent = 0;
  const work = [10, 20, 30, 40].map(async (delay) => {
    return sem.run(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(r => setTimeout(r, delay));
      concurrent--;
    });
  });
  await Promise.all(work);
  assert(maxConcurrent >= 1, 'Semaphore(2): some concurrency occurred');
  assert(maxConcurrent <= 2, `Semaphore(2): max concurrency (${maxConcurrent}) ≤ 2`);

  // ──────────────────────────────────────
  // 3. Phase 5: PM lifecycle
  // ──────────────────────────────────────
  section('3. Phase 5: PM Lifecycle');

  const pm = require(path.join(DIST_ELECTRON, 'scheduler', 'pm-lifecycle.js'));
  assert(typeof pm.PMRegistry === 'function', 'PMRegistry is exported');

  const registry = new pm.PMRegistry();
  assert(registry !== null, 'PMRegistry instantiates');

  registry.register('sess-1', '55555');
  const got = registry.get('sess-1');
  assert(got !== undefined, 'PMRegistry.get returns entry for registered session');
  assertEq(got.processId, '55555', 'PMRegistry.get returns correct processId');
  assert(typeof got.spawnedAt === 'number', 'PMRegistry.get.spawnedAt is number');
  assert(got.contextSnapshot === null, 'PMRegistry.get.contextSnapshot is initially null');

  const snap = {
    completed: [{ id: 'c1', title: 'Done', assignee: 'alice' }],
    running: [],
    pending: [{ id: 'p1', title: 'Todo', assignee: 'bob' }],
  };
  registry.updateSnapshot('sess-1', snap);
  const updated = registry.get('sess-1');
  assertDeep(updated.contextSnapshot, snap, 'updateSnapshot stores the correct snapshot');

  registry.unregister('sess-1');
  const removed = registry.get('sess-1');
  assert(removed === undefined, 'unregister removes the session entry');

  const aliveFalse = registry.isProcessAlive(null);
  assert(aliveFalse === false, 'isProcessAlive(null) returns false');

  const aliveBad = registry.isProcessAlive('999999999');
  assert(aliveBad === false, 'isProcessAlive(bogus pid) returns false');

  // ──────────────────────────────────────
  // 4. Phase 6: Database & Memory
  // ──────────────────────────────────────
  section('4. Phase 6: Database & Memory CRUD');

  const dbIdx = require(path.join(DIST_ELECTRON, 'database', 'index.js'));
  const dbRepo = require(path.join(DIST_ELECTRON, 'database', 'repository.js'));
  const dbMigrate = require(path.join(DIST_ELECTRON, 'database', 'migrations.js'));

  assert(typeof dbIdx.getDatabase === 'function', 'database/index exports getDatabase');
  assert(typeof dbIdx.saveDatabase === 'function', 'database/index exports saveDatabase');
  assert(typeof dbIdx.getDatabasePath === 'function', 'database/index exports getDatabasePath');
  assert(typeof dbIdx.getDataDir === 'function', 'database/index exports getDataDir');

  assert(typeof dbRepo.saveMemory === 'function', 'repository exports saveMemory');
  assert(typeof dbRepo.loadMemories === 'function', 'repository exports loadMemories');
  assert(typeof dbRepo.deleteMemory === 'function', 'repository exports deleteMemory');
  assert(typeof dbRepo.createProject === 'function', 'repository exports createProject');
  assert(typeof dbRepo.removeProject === 'function', 'repository exports removeProject');
  assert(typeof dbRepo.createSession === 'function', 'repository exports createSession');
  assert(typeof dbRepo.addTask === 'function', 'repository exports addTask');
  assert(typeof dbRepo.batchAddTasks === 'function', 'repository exports batchAddTasks');

  const database = await dbIdx.getDatabase();
  assert(database !== null, 'getDatabase() returns a database instance');

  dbMigrate.runMigrations(database);
  console.log('  ✓ Migrations applied successfully');

  // Create project
  const testProj = await dbRepo.createProject('__test_proj_runtime__', '__test_path__');
  assert(testProj.id !== undefined, 'createProject returns project with id');
  assertEq(testProj.name, '__test_proj_runtime__', 'createProject stores name correctly');

  // Create session
  const testSess = await dbRepo.createSession(testProj.id, '__test_session__', 'test-agent');
  assert(testSess.id !== undefined, 'createSession returns session with id');
  assertEq(testSess.projectId, testProj.id, 'createSession links to project');

  // Create task via addTask
  const testTask = await dbRepo.addTask(testSess.id, testProj.id, '__test_task_add__');
  assert(testTask.id !== undefined, 'addTask returns task with id');
  assertEq(testTask.title, '__test_task_add__', 'addTask stores title');

  // batchAddTasks
  const batched = await dbRepo.batchAddTasks(testSess.id, testProj.id, [
    { title: '__batch_1__', assignee: 'tester' },
    { title: '__batch_2__' },
  ]);
  assertEq(batched.length, 2, 'batchAddTasks returns correct count');
  assertEq(batched[0].title, '__batch_1__', 'batchAddTasks[0] title');
  assertEq(batched[1].title, '__batch_2__', 'batchAddTasks[1] title');

  // Save a memory record
  const mem = await dbRepo.saveMemory(
    testProj.id, 'codewhale', '__test_mem_key__', '__test_mem_content__', testSess.id
  );
  assert(mem.id !== undefined, 'saveMemory returns memory with id');
  assertEq(mem.key, '__test_mem_key__', 'saveMemory stores key');
  assertEq(mem.content, '__test_mem_content__', 'saveMemory stores content');
  assertEq(mem.agentName, 'codewhale', 'saveMemory stores agentName');

  // Load memories
  const loaded = await dbRepo.loadMemories(testProj.id, 'codewhale');
  assert(loaded.length >= 1, 'loadMemories returns at least 1 record');
  const found = loaded.find(m => m.key === '__test_mem_key__');
  assert(found !== undefined, 'loadMemories contains the saved memory');
  assertEq(found.content, '__test_mem_content__', 'loadMemories returns correct content');

  // Delete memory
  await dbRepo.deleteMemory(mem.id);
  const afterDel = await dbRepo.loadMemories(testProj.id, 'codewhale');
  const stillPresent = afterDel.find(m => m.id === mem.id);
  assert(stillPresent === undefined, 'deleteMemory removes the record');

  // Cleanup test project (cascades: sessions → messages → tasks → memories)
  await dbRepo.removeProject(testProj.id);
  console.log('  ✓ Test data cleaned up');

  // ──────────────────────────────────────
  // 5. Phase 6: MCP Server
  // ──────────────────────────────────────
  section('5. Phase 6: MCP Server');

  const mcpServerPath = path.join(DIST_ELECTRON, 'mcp', 'server.js');
  assert(fs.existsSync(mcpServerPath), 'dist-electron/mcp/server.js exists on disk');

  try {
    verifyMcpModule(mcpServerPath);
    console.log('  ✅ MCP server module can be loaded and parsed');
    passCount++;
  } catch (err) {
    console.log(`  ❌ MCP server module load failed: ${err.message}`);
    failCount++;
  }

  // ──────────────────────────────────────
  // Summary
  // ──────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results:  ${passCount} passed,  ${failCount} failed`);
  console.log('═══════════════════════════════════════════\n');

  process.exit(failCount > 0 ? 1 : 0);
}

/**
 * Verify MCP server module can be loaded without error.
 * We require it and then detach stdin listeners so the process can exit cleanly.
 */
function verifyMcpModule(mcpPath) {
  // Loading the MCP server starts a stdin listener; we detach it afterward
  // so the test process can exit naturally.
  require(mcpPath);
  // The module attaches process.stdin.on('data', ...). Remove it so Node.js
  // doesn't hang waiting for stdin on an otherwise-finished script.
  process.stdin.removeAllListeners('data');
}

main().catch(err => {
  console.error('\n  💥 Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
