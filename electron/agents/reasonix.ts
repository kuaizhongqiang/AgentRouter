/**
 * AgentRouter — Reasonix 适配器
 *
 * 负责生成 node agents/reasonix/dist/cli/index.js platform <command> 子进程
 * 并输出 NDJSON 格式的事件流
 */
import { spawn } from 'child_process';
import path from 'path';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentExecOptions } from './adapter';

const CLI_ENTRY = path.join(__dirname, '..', '..', 'agents', 'reasonix', 'dist', 'cli', 'index.js');

export class ReasonixAdapter implements AgentAdapter {
  readonly name = 'reasonix';
  readonly displayName = 'Reasonix';

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
