/**
 * AgentRouter — Continue 适配器
 *
 * 负责生成 node agents/continue/platform.js exec <command> 子进程
 * Continue CLI (npm @continuedev/cli) 的包装层，将 headless JSON 输出转译为 NDJSON 事件流
 */
import { spawn } from 'child_process';
import path from 'path';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentExecOptions, AgentManifest } from './adapter';

const WRAPPER = path.join(__dirname, '..', '..', 'agents', 'continue', 'platform.cjs');

export class ContinueAdapter implements AgentAdapter {
  readonly name = 'continue';
  readonly displayName = 'Continue';

  manifest(): AgentManifest {
    return {
      identity: { id: 'ar-continue', label: 'Continue', version: '1.5.45' },
      tagline: '代码库理解专家，35+ 模型提供商，丰富的内置工具链',
      best_for: [
        '代码库全局分析与理解',
        '大规模代码审查与重构规划',
        '跨文件复杂重构执行',
        '多模型灵活切换（OpenAI/Anthropic/DeepSeek/Gemini）',
        '代码库索引与搜索',
      ],
      not_for: [
        '快速简单编码迭代',
        '轻量单文件修改',
        '实时流式编码交互',
      ],
      execution_model: { parallel_mode: 'single', max_instances: 2 },
      context_budget: { preferred_read_mode: 'full', context_window: '128K' },
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
