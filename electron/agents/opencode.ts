/**
 * AgentRouter — OpenCode 适配器
 *
 * 负责生成 ar-opencode platform exec <command> 子进程
 * 并输出 NDJSON 格式的事件流
 *
 * 构建产物在 agents/opencode/ar-opencode 下（Go 编译结果）
 */
import { spawn } from 'child_process';
import path from 'path';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentExecOptions, AgentManifest } from './adapter';

const BINARY = path.join(
  __dirname, '..', '..', 'agents', 'opencode',
  process.platform === 'win32' ? 'ar-opencode.exe' : 'ar-opencode'
);

export class OpenCodeAdapter implements AgentAdapter {
  readonly name = 'opencode';
  readonly displayName = 'OpenCode';

  manifest(): AgentManifest {
    return {
      identity: { id: 'ar-opencode', label: 'OpenCode', version: '0.1.0' },
      tagline: '多模型通用终端编码助手',
      best_for: ['多模型编码（OpenAI/Claude/Gemini）', '终端交互', 'LSP 集成'],
      not_for: ['DeepSeek 特有推理优化'],
      execution_model: { parallel_mode: 'single', max_instances: 2 },
      context_budget: { preferred_read_mode: 'incremental', context_window: '64K' },
      capabilities: { can_suggest: false },
    };
  }

  spawnExec(command: string, options?: AgentExecOptions): ChildProcess {
    return spawn(BINARY, ['platform', 'exec', command], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }

  spawnDoctor(options?: SpawnOptions): ChildProcess {
    return spawn(BINARY, ['platform', 'doctor'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }
}
