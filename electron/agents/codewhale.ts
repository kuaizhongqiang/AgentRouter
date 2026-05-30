/**
 * AgentRouter — CodeWhale 适配器
 *
 * 负责生成 ar-codewhale --mode platform exec <command> 子进程
 * 并输出 NDJSON 格式的事件流
 */
import { spawn } from 'child_process';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter } from './adapter';

const BINARY = process.platform === 'win32' ? 'ar-codewhale.cmd' : 'ar-codewhale';

export class CodeWhaleAdapter implements AgentAdapter {
  readonly name = 'codewhale';
  readonly displayName = 'CodeWhale';

  spawnExec(command: string, options?: SpawnOptions): ChildProcess {
    return spawn(BINARY, ['--mode', 'platform', 'exec', command], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }

  spawnDoctor(options?: SpawnOptions): ChildProcess {
    return spawn(BINARY, ['doctor', '--json'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }
}
