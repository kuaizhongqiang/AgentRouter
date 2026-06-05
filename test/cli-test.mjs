/**
 * cli-test.mjs — AgentRouter CLI 集成测试
 *
 * 测试 CLI 入口 + 各命令的解析和路由是否正确。
 * 不实际执行 Agent（那需要真实 API Key 和 Agent 二进制）。
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CLI_ENTRY = path.join(PROJECT_ROOT, 'cli', 'bin', 'ar.mjs');

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

function assertIncludes(str, substr, label) {
  if (str && str.includes(substr)) { passCount++; console.log(`  ✅ ${label}`); }
  else {
    failCount++;
    console.log(`  ❌ ${label} (missing: "${substr}")`);
    console.log(`       text: ${str ? str.slice(0, 200) : '(empty)'}`);
  }
}

function run(args, opts = {}) {
  const result = spawnSync('node', [CLI_ENTRY, ...args], {
    encoding: 'utf-8',
    timeout: opts.timeout || 10000,
    env: { ...process.env },
    cwd: PROJECT_ROOT,
  });
  return result;
}

function assertExitCode(args, expectedCode, label) {
  const r = run(args, { timeout: 5000 });
  assertEq(r.status, expectedCode, label);
}

function group(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

// ════════════════════════════════════════════
//  Tests
// ════════════════════════════════════════════

group('CLI 入口与帮助');

(function testEntry() {
  assert(fs.existsSync(CLI_ENTRY), 'ar.mjs entry exists');

  // --help
  const help = run(['--help']);
  assertEq(help.status, 0, 'ar --help exits 0');
  assertIncludes(help.stdout, 'AgentRouter CLI', 'ar --help shows title');
  assertIncludes(help.stdout, 'exec', 'ar --help lists exec command');

  // -h
  const h = run(['-h']);
  assertEq(h.status, 0, 'ar -h exits 0');

  // no args
  const noArgs = run([]);
  assertEq(noArgs.status, 0, 'ar (no args) exits 0');

  // version
  const ver = run(['version']);
  assertEq(ver.status, 0, 'ar version exits 0');
  assertIncludes(ver.stdout, 'v0.1.0', 'ar version shows version');

  // --version
  const verFlag = run(['--version']);
  assertEq(verFlag.status, 0, 'ar --version exits 0');
  assertIncludes(verFlag.stdout, 'v0.1.0', 'ar --version shows version');
})();

group('CLI 文件完整性');

(function testFileIntegrity() {
  const requiredFiles = [
    'cli/bin/ar.mjs',
    'cli/lib/bootstrap.mjs',
    'cli/lib/output.mjs',
    'cli/lib/parser.mjs',
    'cli/commands/exec.mjs',
    'cli/commands/agent.mjs',
    'cli/commands/project.mjs',
    'cli/commands/session.mjs',
    'cli/commands/task.mjs',
    'cli/commands/msg.mjs',
    'cli/commands/credential.mjs',
    'cli/commands/token.mjs',
    'cli/commands/memory.mjs',
    'cli/commands/replay.mjs',
    'cli/commands/status.mjs',
  ];

  for (const f of requiredFiles) {
    assert(fs.existsSync(path.join(PROJECT_ROOT, f)), `${f} exists`);
  }
})();

group('agent 命令');

(function testAgentCommands() {
  // ar list
  const list = run(['list'], { timeout: 15000 });
  assertEq(list.status, 0, 'ar list exits 0');
  assertIncludes(list.stdout, 'codewhale', 'ar list shows codewhale');
  assertIncludes(list.stdout, 'reasonix', 'ar list shows reasonix');
  assertIncludes(list.stdout, 'CodeWhale', 'ar list shows label');

  // ar agent list
  const agentList = run(['agent', 'list'], { timeout: 15000 });
  assertEq(agentList.status, 0, 'ar agent list exits 0');

  // ar agent list --json
  const jsonList = run(['agent', 'list', '--json'], { timeout: 15000 });
  assertEq(jsonList.status, 0, 'ar agent list --json exits 0');
  assertIncludes(jsonList.stdout, '"name"', 'JSON output has name field');

  // ar agent info
  const info = run(['agent', 'info', 'codewhale'], { timeout: 15000 });
  assertEq(info.status, 0, 'ar agent info codewhale exits 0');
  assertIncludes(info.stdout, 'CodeWhale', 'agent info shows label');
})();

group('status 命令');

(function testStatus() {
  // ar status
  const s = run(['status'], { timeout: 15000 });
  assertEq(s.status, 0, 'ar status exits 0');
  assertIncludes(s.stdout, 'AgentRouter', 'status shows title');
  assertIncludes(s.stdout, 'Agent', 'status shows Agent section');

  // ar status --json
  const json = run(['status', '--json'], { timeout: 15000 });
  assertEq(json.status, 0, 'ar status --json exits 0');
  // JSON output should parse
  try {
    JSON.parse(json.stdout);
    assert(true, 'status --json output is valid JSON');
  } catch {
    assert(false, 'status --json output is valid JSON');
  }
})();

group('doctor 命令');

(function testDoctor() {
  const d = run(['doctor'], { timeout: 30000 });
  // doctor may return non-zero if some agents fail, that's expected
  assertIncludes(d.stdout, 'codewhale', 'doctor checks codewhale');
  assertIncludes(d.stdout, 'reasonix', 'doctor checks reasonix');
  assertIncludes(d.stdout, '结果', 'doctor shows results summary');
})();

group('project 命令');

(function testProject() {
  const list = run(['project', 'list'], { timeout: 10000 });
  assertEq(list.status, 0, 'ar project list exits 0');
  assertIncludes(list.stdout, 'id', 'project list shows header');
})();

group('session 命令');

(function testSession() {
  // Get a project ID first
  const list = run(['project', 'list', '--json'], { timeout: 10000 });
  let projectId = null;
  try {
    const projects = JSON.parse(list.stdout);
    if (projects.length > 0) projectId = projects[0].id;
  } catch {}

  if (projectId) {
    const sessionList = run(['session', 'list', projectId], { timeout: 10000 });
    assertEq(sessionList.status, 0, 'ar session list exits 0');
  } else {
    console.log('  ⚠  No projects found, skipping session list test');
  }
})();

group('task 命令');

(function testTask() {
  const list = run(['project', 'list', '--json'], { timeout: 10000 });
  let projectId = null;
  try {
    const projects = JSON.parse(list.stdout);
    if (projects.length > 0) projectId = projects[0].id;
  } catch {}

  if (projectId) {
    const taskList = run(['task', 'list', projectId], { timeout: 10000 });
    assertEq(taskList.status, 0, 'ar task list exits 0');
  } else {
    console.log('  ⚠  No projects found, skipping task list test');
  }
})();

group('credential 命令');

(function testCredential() {
  const show = run(['credential', 'show'], { timeout: 10000 });
  assertEq(show.status, 0, 'ar credential show exits 0');
  assertIncludes(show.stdout, 'sk-', 'credential shows masked API key');
})();

group('help 命令');

(function testHelp() {
  const help = run(['help'], { timeout: 5000 });
  assertEq(help.status, 0, 'ar help exits 0');
  assertIncludes(help.stdout, 'exec', 'ar help lists commands');

  const execHelp = run(['exec', '--help'], { timeout: 5000 });
  assertEq(execHelp.status, 0, 'ar exec --help exits 0');
  assertIncludes(execHelp.stdout, 'agent', 'exec help mentions agent param');
})();

group('快捷命令解析');

(function testShortcuts() {
  // Verify the shortcut commands exist in the entry point
  const entry = fs.readFileSync(CLI_ENTRY, 'utf-8');
  assert(entry.includes("case 'fix':"), 'entry handles /fix');
  assert(entry.includes("case 'feat':"), 'entry handles /feat');
  assert(entry.includes("case 'review':"), 'entry handles /review');
  assert(entry.includes("case 'refactor':"), 'entry handles /refactor');
  assert(entry.includes("case 'test':"), 'entry handles /test');
  assert(entry.includes("case 'doc':"), 'entry handles /doc');
  assert(entry.includes("case 'goal':"), 'entry handles /goal');
  assert(entry.includes("case 'list':"), 'entry handles list shortcut');
})();

group('未知命令处理');

(function testUnknown() {
  const r = run(['nonexistent123']);
  assertEq(r.status, 1, 'unknown command exits 1');
  assertIncludes(r.stderr, '未知命令', 'unknown command shows error message');
})();

// ════════════════════════════════════════════
//  Summary
// ════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`);
console.log(`  CLI Test Results`);
console.log(`${'═'.repeat(60)}`);
const total = passCount + failCount;
console.log(`  Total:  ${total}`);
console.log(`  Passed: ${passCount} ✅`);
console.log(`  Failed: ${failCount} ${failCount === 0 ? '✅' : '❌'}`);
console.log(`  Rate:   ${(passCount / total * 100).toFixed(1)}%`);
console.log();

process.exit(failCount > 0 ? 1 : 0);
