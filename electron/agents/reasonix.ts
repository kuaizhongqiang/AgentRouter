/**
 * AgentRouter — Reasonix 适配器
 *
 * 负责生成 node agents/reasonix/dist/cli/index.js platform <command> 子进程
 * 并输出 NDJSON 格式的事件流
 */
import { spawn } from 'child_process';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentExecOptions, AgentManifest } from './adapter';
import { resolveAgentPath } from './paths';

const CLI_ENTRY = resolveAgentPath('reasonix', 'dist', 'cli', 'index.js');

export class ReasonixAdapter implements AgentAdapter {
  readonly name = 'reasonix';
  readonly displayName = 'Reasonix';

  manifest(): AgentManifest {
    return {
      identity: { id: 'ar-reasonix', label: 'Reasonix', version: '0.52.0' },
      tagline: '长上下文推理专家，适合规划和审查',
      best_for: ['阅读分析大量代码', '需求拆解与规划', '代码审查与安全审计', '架构设计'],
      not_for: ['快速编码迭代', '大规模重构执行'],
      execution_model: { parallel_mode: 'sub-agent', max_instances: 1 },
      context_budget: { preferred_read_mode: 'incremental', context_window: '128K' },
      capabilities: { can_suggest: true, suggestion_scope: 'related_tasks' },
    };
  }

  spawnExec(command: string, options?: AgentExecOptions): ChildProcess {
    const role = options?.mode === 'PM 拆解' ? 'pm' : 'executor';
    return spawn('node', [CLI_ENTRY, 'platform', command, '--role', role, '--session-id', 'default'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }

  spawnDoctor(options?: SpawnOptions): ChildProcess {
    return spawn('node', [CLI_ENTRY, '--version'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }
}
