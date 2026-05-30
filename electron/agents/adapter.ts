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
export interface AgentAdapter {
  /** 唯一标识名，如 'codewhale' */
  readonly name: string;

  /** 显示名称 */
  readonly displayName: string;

  /**
   * 生成 exec 子进程
   * @param command  用户输入的指令
   * @param options  spawn 选项（cwd 等）
   * @returns ChildProcess 实例
   */
  spawnExec(command: string, options?: SpawnOptions): ChildProcess;

  /**
   * 生成 doctor 诊断子进程
   * @returns ChildProcess 实例
   */
  spawnDoctor(options?: SpawnOptions): ChildProcess;
}
