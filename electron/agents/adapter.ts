/**
 * AgentRouter — AgentAdapter 接口定义
 *
 * 每种 Agent CLI 实现此接口，平台通过 AgentManager 统一调度。
 */

import type { ChildProcess, SpawnOptions } from 'child_process';

/**
 * 协议事件格式 (PROTOCOL.md)
 */
export interface AgentEvent {
  protocol_version: string;
  id: string;
  session_id: string;
  type: 'event';
  event: 'task:start' | 'progress' | 'completion' | 'error' | 'cancelled';
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Agent 适配器接口
 */
export interface AgentExecOptions extends SpawnOptions {
  mode?: string;
}

export interface AgentAdapter {
  readonly name: string;
  readonly displayName: string;

  /**
   * @param command  用户输入的指令
   * @param options  spawn 选项 + 执行模式
   */
  spawnExec(command: string, options?: AgentExecOptions): ChildProcess;

  spawnDoctor(options?: SpawnOptions): ChildProcess;
}
