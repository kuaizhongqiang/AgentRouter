/**
 * AgentRouter — AgentAdapter 接口定义
 *
 * 每种 Agent CLI 实现此接口，平台通过 AgentManager 统一调度。
 */

import type { ChildProcess, SpawnOptions } from 'child_process';

/**
 * 发送者身份标识 metadata
 * 每条平台转发的事件携带此信息，让下游知道谁产生了这条消息。
 */
export interface SenderMetadata {
  label: string;
  id: string;
  execution?: {
    instance_id: string;
    parallel_mode: 'sub-agent' | 'multi-process' | 'single';
  };
  context?: {
    scope: string[];
    baseline?: string;
    deltas: Array<{ file: string; type: string; diff?: string }>;
  };
}

/**
 * Agent 标签声明 — 接入时声明身份和能力
 */
export interface AgentManifest {
  identity: {
    id: string;
    label: string;
    version: string;
  };
  tagline: string;
  best_for: string[];
  not_for: string[];
  execution_model: {
    parallel_mode: 'sub-agent' | 'multi-process' | 'single';
    max_instances: number;
  };
  context_budget: {
    preferred_read_mode: 'full' | 'incremental' | 'diff';
    context_window: string;
  };
  capabilities?: {
    can_suggest: boolean;
    suggestion_scope?: 'own_task' | 'related_tasks' | 'all';
  };
}

/**
 * 协议事件格式 (PROTOCOL.md)
 * 扩展 _sender 字段标识消息来源。
 */
export interface AgentEvent {
  protocol_version: string;
  id: string;
  session_id: string;
  type: 'event';
  event: 'task:start' | 'progress' | 'completion' | 'error' | 'cancelled'
  | 'suggestion' | 'task:update' | 'task:add' | 'task:cancel';
  data: Record<string, unknown>;
  timestamp: string;
  /** Phase 3: 消息来源身份标识 */
  _sender?: SenderMetadata;
}

/**
 * Agent 适配器接口
 */
export interface AgentExecOptions extends SpawnOptions {
  mode?: string;
  /** Phase 4: 上下文范围 — scope/deltas 用于增量读取 */
  context?: SenderMetadata['context'];
}

export interface AgentAdapter {
  readonly name: string;
  readonly displayName: string;

  /** Phase 3: Agent 标签声明 */
  manifest(): AgentManifest;

  /**
   * @param command  用户输入的指令
   * @param options  spawn 选项 + 执行模式
   */
  spawnExec(command: string, options?: AgentExecOptions): ChildProcess;

  spawnDoctor(options?: SpawnOptions): ChildProcess;
}
