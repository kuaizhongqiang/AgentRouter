/**
 * AgentRouter — Cline 适配器
 *
 * 负责生成 node agents/cline/platform.js exec <command> 子进程
 * Cline CLI v2 (npm @cline/cli) 的包装层，将 --json 输出转译为 NDJSON 事件流
 */
import { spawn } from 'child_process';
import path from 'path';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentExecOptions, AgentManifest } from './adapter';

const WRAPPER = path.join(__dirname, '..', '..', 'agents', 'cline', 'platform.cjs');

export class ClineAdapter implements AgentAdapter {
  readonly name = 'cline';
  readonly displayName = 'Cline';

  manifest(): AgentManifest {
    return {
      identity: { id: 'ar-cline', label: 'Cline', version: '2.13.0' },
      tagline: '全能自主编码 Agent，15+ 模型提供商，完整 MCP 生态',
      best_for: [
        '多步骤复杂自主任务',
        '跨模型提供商切换（Anthropic/OpenAI/Gemini/Bedrock）',
        '复杂重构需要完整 Agent 工具链',
        'MCP 工具集成扩展',
      ],
      not_for: [
        '简单单文件快速编辑',
        '大规模并行编码',
        'DeepSeek 推理优化场景',
      ],
      execution_model: { parallel_mode: 'single', max_instances: 2 },
      context_budget: { preferred_read_mode: 'incremental', context_window: '128K' },
      capabilities: { can_suggest: false },
    };
  }

  spawnExec(command: string, options?: AgentExecOptions): ChildProcess {
    return spawn('node', [WRAPPER, 'exec', command], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }

  spawnDoctor(options?: SpawnOptions): ChildProcess {
    return spawn('node', [WRAPPER, 'doctor'], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }
}
