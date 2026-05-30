/**
 * AgentRouter — CodeWhale 适配器
 *
 * 负责生成 ar-codewhale --mode platform exec <command> 子进程
 * 并输出 NDJSON 格式的事件流
 */
import { spawn } from 'child_process';
import path from 'path';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter } from './adapter';

// 构建产物在 agents/codewhale/target/release/ 下
// dist-electron/ 是编译输出目录，项目根在其上一级
const BINARY = path.join(
  __dirname, '..', '..', 'agents', 'codewhale', 'target', 'release',
  process.platform === 'win32' ? 'ar-codewhale.exe' : 'ar-codewhale'
);

export class CodeWhaleAdapter implements AgentAdapter {
  readonly name = 'codewhale';
  readonly displayName = 'CodeWhale';

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
