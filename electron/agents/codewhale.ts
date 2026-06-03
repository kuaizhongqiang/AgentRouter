/**
 * AgentRouter — CodeWhale 适配器
 *
 * 负责生成 ar-codewhale --mode platform exec <command> 子进程
 * 并输出 NDJSON 格式的事件流
 */
import { spawn } from 'child_process';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentExecOptions, AgentManifest } from './adapter';
import { resolveAgentPath } from './paths';

// 构建产物在 agents/codewhale/target/release/ 下
const BINARY = resolveAgentPath('codewhale', 'target', 'release',
  process.platform === 'win32' ? 'ar-codewhale.exe' : 'ar-codewhale');

export class CodeWhaleAdapter implements AgentAdapter {
  readonly name = 'codewhale';
  readonly displayName = 'CodeWhale';

  manifest(): AgentManifest {
    return {
      identity: { id: 'ar-codewhale', label: 'CodeWhale', version: '0.8.46' },
      tagline: '快速编码执行器，多进程并行高效实现',
      best_for: ['快速功能模块开发', '代码生成与实现', '代码重构', '单元测试编写', 'Bug修复', '批量简单并行任务'],
      not_for: ['长上下文综合分析', '安全审计', '复杂架构设计', '多步骤复杂自主任务'],
      execution_model: { parallel_mode: 'multi-process', max_instances: 4 },
      context_budget: { preferred_read_mode: 'incremental', context_window: '64K' },
    };
  }

  spawnExec(command: string, options?: SpawnOptions): ChildProcess {
    return spawn(BINARY, ['exec', '--auto', '--output-format', 'stream-json', '--platform-mode', command], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }

  spawnDoctor(options?: SpawnOptions): ChildProcess {
    return spawn(BINARY, ['doctor', '--json'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }
}
