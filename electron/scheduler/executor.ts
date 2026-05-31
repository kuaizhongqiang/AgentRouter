/**
 * AgentRouter — 并行执行引擎
 *
 * 按 parallel_groups 分批调度任务：
 * - 组内并行（受 max_instances 限制）
 * - 组间串行
 * - 文件冲突自动降级为串行
 */

export interface SchedulableTask {
  id: string;
  title: string;
  assignee?: string;
  parallel_group?: number;
  depends_on?: string[];
  context?: { scope?: string[]; deltas?: Array<{ file: string; type: string }> };
}

export interface Conflict {
  file: string;
  tasks: string[];
}

/**
 * 检测一组任务中是否有文件范围冲突。
 */
export function detectFileConflicts(tasks: SchedulableTask[]): Conflict[] {
  const fileMap = new Map<string, string>();
  const conflicts: Conflict[] = [];

  for (const task of tasks) {
    const scope = task.context?.scope || [];
    for (const file of scope) {
      const existing = fileMap.get(file);
      if (existing) {
        conflicts.push({ file, tasks: [existing, task.id] });
      } else {
        fileMap.set(file, task.id);
      }
    }
  }
  return conflicts;
}

/**
 * 按 parallel_group 分组，组内并行安全，组间串行。
 * 无 parallel_group 的任务各自为组（串行）。
 */
export function groupByParallelGroup(tasks: SchedulableTask[]): SchedulableTask[][] {
  const groups = new Map<number, SchedulableTask[]>();
  const ungrouped: SchedulableTask[] = [];

  for (const t of tasks) {
    if (t.parallel_group !== undefined && t.parallel_group !== null) {
      const list = groups.get(t.parallel_group) || [];
      list.push(t);
      groups.set(t.parallel_group, list);
    } else {
      ungrouped.push(t);
    }
  }

  const result: SchedulableTask[][] = [];
  // 按 parallel_group 升序输出
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
  for (const k of sortedKeys) {
    result.push(groups.get(k)!);
  }
  // 无分组的任务各自成组
  for (const t of ungrouped) {
    result.push([t]);
  }
  return result;
}

/**
 * 简单信号量 —— 限制并发数。
 */
export class Semaphore {
  private running = 0;
  private queue: (() => void)[] = [];

  constructor(private max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.max) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
