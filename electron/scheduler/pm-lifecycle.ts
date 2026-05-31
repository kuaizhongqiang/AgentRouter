/**
 * AgentRouter — PM 生命周期管理
 *
 * 追踪 PM 进程状态，处理 suggestion 路由：
 * - PM 存活 → 直接转发 suggestion
 * - PM 已退出 → 重建上下文快照，重新 spawn PM
 */

export interface PMContextSnapshot {
  completed: Array<{ id: string; title: string; assignee?: string }>;
  running: Array<{ id: string; title: string; assignee?: string }>;
  pending: Array<{ id: string; title: string; assignee?: string }>;
}

export interface SuggestionEvent {
  target_task: string;
  target_agent: string;
  suggestion: string;
  reason: string;
  severity?: 'enhancement' | 'blocker' | 'critical';
}

export interface TaskUpdateEvent {
  task_id: string;
  changes: Record<string, unknown>;
  reason: string;
}

export interface TaskAddEvent {
  task: { id: string; title: string; assignee: string; depends_on?: string[] };
  reason: string;
}

export interface TaskCancelEvent {
  task_id: string;
  reason: string;
}

export class PMRegistry {
  private sessions = new Map<string, {
    processId: string | null;
    spawnedAt: number;
    contextSnapshot: PMContextSnapshot | null;
  }>();

  register(sessionId: string, processId: string): void {
    this.sessions.set(sessionId, {
      processId,
      spawnedAt: Date.now(),
      contextSnapshot: null,
    });
  }

  get(sessionId: string): { processId: string | null; spawnedAt: number; contextSnapshot: PMContextSnapshot | null } | undefined {
    return this.sessions.get(sessionId);
  }

  unregister(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  isProcessAlive(processId: string | null): boolean {
    if (!processId) return false;
    try {
      // 发送信号 0 测试进程存活
      process.kill(parseInt(processId, 10), 0);
      return true;
    } catch {
      return false;
    }
  }

  updateSnapshot(sessionId: string, snapshot: PMContextSnapshot): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.contextSnapshot = snapshot;
    }
  }
}
