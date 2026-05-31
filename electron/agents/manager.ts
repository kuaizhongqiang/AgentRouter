/**
 * AgentRouter — Agent Manager
 *
 * 职责:
 * 1. 维护 AgentAdapter 注册表
 * 2. 按名称调度 Agent 执行
 * 3. 解析 stdout NDJSON 事件流 → 转发 + 记录 .jsonl
 * 4. 支持 kill 单个/全部子进程
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import type { BrowserWindow } from 'electron';
import type { AgentAdapter, AgentEvent, AgentExecOptions, SenderMetadata } from './adapter';
import type { AgentLog } from '../types';

export class AgentManager {
  private adapters = new Map<string, AgentAdapter>();
  private runningProcesses = new Map<string, { proc: import('child_process').ChildProcess; logId: string }>();
  private mainWindow: BrowserWindow | null = null;
  private onEventCallback: ((agentName: string, event: AgentEvent) => void) | null = null;

  /** Phase 3: 全局递增 sender 序列号，确保 id 唯一 */
  private senderSeq = 0;

  constructor(mainWindow?: BrowserWindow) {
    if (mainWindow) {
      this.mainWindow = mainWindow;
    }
  }

  /** Phase 3: 获取指定 Agent 的标签声明 */
  getManifest(agentName: string): import('./adapter').AgentManifest | null {
    const adapter = this.adapters.get(agentName);
    return adapter ? adapter.manifest() : null;
  }

  /** Phase 3: 为事件注入 _sender metadata */
  private injectSender(event: AgentEvent, agentName: string): AgentEvent {
    const adapter = this.adapters.get(agentName);
    const label = adapter?.displayName || agentName;
    this.senderSeq++;
    const instanceId = `${agentName}-${this.senderSeq}`;
    return {
      ...event,
      _sender: { label, id: instanceId },
    };
  }

  /** 设置主窗口（延迟绑定） */
  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  /** 注册事件回调（用于 IPC 层接管事件处理） */
  setOnEventCallback(cb: (agentName: string, event: AgentEvent) => void): void {
    this.onEventCallback = cb;
  }

  /** 注册一个 Agent 适配器 */
  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  /** 列出所有已注册的 Agent（含 manifest） */
  list(): Array<{ name: string; label: string; manifest: import('./adapter').AgentManifest }> {
    return Array.from(this.adapters.values()).map(a => ({
      name: a.name,
      label: a.displayName,
      manifest: a.manifest(),
    }));
  }

  /** 获取已注册的适配器 */
  getAdapter(name: string): AgentAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * 执行 Agent 命令
   * @param agentName    Agent 名称
   * @param command      用户指令
   * @param sessionId    当前会话 ID
   * @param projectId    当前项目 ID
   * @param cwd          工作目录（项目路径）
   */
  async exec(
    agentName: string,
    command: string,
    sessionId: string,
    projectId: string,
    cwd?: string,
    mode?: string
  ): Promise<string> {
    const adapter = this.adapters.get(agentName);
    if (!adapter) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    // 确保 events 目录存在
    const eventsDir = this.getEventsDir(projectId, sessionId);
    if (!fs.existsSync(eventsDir)) {
      fs.mkdirSync(eventsDir, { recursive: true });
    }

    // 创建日志文件路径
    const logPath = path.join(eventsDir, `${agentName}.jsonl`);

    // 启动子进程
    const execOptions: AgentExecOptions = { ...(cwd ? { cwd } : {}) };
    if (mode) execOptions.mode = mode;
    const proc = adapter.spawnExec(command, execOptions);

    // 解析 stdout
    let buf = '';
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    proc.stdout?.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 过滤终端转义序列（CSI 和 OSC 控制码）
        const sanitized = trimmed
          .replace(/\x1B\[[\d;]*[A-Za-z@-~]/g, '')    // CSI 序列
          .replace(/\x1B\].*?(?:\x07|\x1B\\)/g, '')    // OSC 序列
          .replace(/\x1B[\x40-\x5F]/g, '')             // 单字节 C1 控制码
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // 其他控制字符
          .trim();
        if (!sanitized) continue;

        // 尝试解析为 NDJSON 事件
        let event: AgentEvent | null = null;
        try {
          const parsed = JSON.parse(sanitized);
          if (parsed && parsed.type === 'event') {
            event = parsed as AgentEvent;
          }
        } catch {
          // 非 JSON 行（如 stderr 混杂）— 当作原始输出处理
        }

        if (event) {
          // Phase 3: 注入 _sender metadata
          const enriched = this.injectSender(event, agentName);

          // 写入 .jsonl（带 _sender）
          logStream.write(JSON.stringify(enriched) + '\n');
          // 转发给回调或直接发送到渲染进程
          if (this.onEventCallback) {
            this.onEventCallback(agentName, enriched);
          } else {
            this.sendToRenderer('agent:output', { agent: agentName, event: enriched });
          }
        } else {
          // 原始文本行 — 发送到渲染进程作为非结构化消息
          this.sendToRenderer('agent:output', {
            agent: agentName,
            raw: trimmed,
            event: null,
          });
        }
      }
    });

    // stderr 作为原始输出转发
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      this.sendToRenderer('agent:output', { agent: agentName, raw: text, event: null });
    });

    // 记录进程
    const logId = this.generateLogId();

    return new Promise<string>((resolve, reject) => {
      proc.on('error', (err) => {
        logStream.end();
        this.runningProcesses.delete(logId);
        this.sendToRenderer('agent:status', { agent: agentName, status: 'error', message: err.message });
        reject(err);
      });

      proc.on('close', (code) => {
        logStream.end();
        this.runningProcesses.delete(logId);
        this.sendToRenderer('agent:status', {
          agent: agentName,
          status: 'completed',
          exitCode: code,
        });
        resolve(logId);
      });

      this.runningProcesses.set(logId, { proc, logId });
    });
  }

  /**
   * 终止运行中的进程
   * @param agentName 可选，不传则终止所有
   */
  kill(agentName?: string): void {
    if (agentName) {
      for (const [id, entry] of this.runningProcesses) {
        // 通过关联的 adapter 名判断 (logId 前缀包含 agentName)
        if (id.startsWith(agentName)) {
          this.killProcess(entry.proc);
          this.runningProcesses.delete(id);
        }
      }
    } else {
      for (const [, entry] of this.runningProcesses) {
        this.killProcess(entry.proc);
      }
      this.runningProcesses.clear();
    }
    this.sendToRenderer('agent:status', { status: 'killed', agent: agentName || 'all' });
  }

  /**
   * 运行诊断
   */
  async doctor(agentName: string): Promise<string> {
    const adapter = this.adapters.get(agentName);
    if (!adapter) throw new Error(`Unknown agent: ${agentName}`);

    return new Promise((resolve, reject) => {
      const proc = adapter.spawnDoctor();
      let output = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      proc.on('error', reject);
      proc.on('close', (code) => {
        resolve(code === 0 ? output : `Error (code=${code}): ${output}`);
      });
    });
  }

  // ── 私有方法 ──

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private getEventsDir(projectId: string, sessionId: string): string {
    return path.join(
      os.homedir(),
      '.agentrouter',
      'projects',
      projectId,
      'sessions',
      sessionId,
      'events'
    );
  }

  private generateLogId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  private killProcess(proc: import('child_process').ChildProcess): void {
    if (proc.exitCode !== null) return; // already exited
    const pid = proc.pid;
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM');
        // SIGKILL fallback after 3s
        setTimeout(() => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {
            // already dead
          }
        }, 3000);
      } catch {
        // process may already be dead
      }
    }
  }
}
