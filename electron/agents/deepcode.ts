/**
 * AgentRouter — DeepCode 适配器
 *
 * 负责生成 node agents/deepcode/dist/platform.js exec <command> 子进程
 * 并输出 NDJSON 格式的事件流
 */
import { spawn } from 'child_process';
import path from 'path';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentExecOptions, AgentManifest } from './adapter';

const CLI_ENTRY = path.join(
  __dirname, '..', '..', 'agents', 'deepcode', 'dist', 'platform.js'
);

export class DeepCodeAdapter implements AgentAdapter {
  readonly name = 'deepcode';
  readonly displayName = 'Deep Code';

  manifest(): AgentManifest {
    return {
      identity: { id: 'ar-deepcode', label: 'Deep Code', version: '0.1.27' },
      tagline: '深度推理编码助手，专为 DeepSeek-V4 优化',
      best_for: ['DeepSeek 深度思考编码', '推理强度可调开发', 'MCP 工具集成', 'Agent Skills'],
      not_for: ['多模型切换', '跨平台代码审查'],
      execution_model: { parallel_mode: 'single', max_instances: 2 },
      context_budget: { preferred_read_mode: 'incremental', context_window: '128K' },
    };
  }

  spawnExec(command: string, options?: AgentExecOptions): ChildProcess {
    return spawn('node', [CLI_ENTRY, 'exec', command], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }

  spawnDoctor(options?: SpawnOptions): ChildProcess {
    return spawn('node', [CLI_ENTRY, 'doctor'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }
}
