/**
 * platform.ts — AgentRouter 平台集成入口
 *
 * 将 DeepCode CLI 包装为非交互式 NDJSON 事件流模式
 * 供 AgentRouter Electron 主进程通过子进程调用。
 *
 * 用法:
 *   ar-deepcode exec <command>
 *   ar-deepcode doctor
 *   ar-deepcode --version
 *
 * 输出格式: NDJSON (JSON Lines), 符合 AgentRouter 协议
 */

import { createOpenAIClient } from "./common/openai-client";
import { resolveCurrentSettings, readSettings, readProjectSettings } from "./settings";
import type { SessionEntry, SessionMessage } from "./session";
import { SessionManager } from "./session";
import crypto from "crypto";
import fs from "fs";

// ─── 工具函数 ───────────────────────────────────────────────────────────

function readVersion(): string {
  try {
    const pkgPath = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version || "0.1.27";
  } catch {
    return "0.1.27";
  }
}

function emitEvent(sessionId: string, event: string, data: Record<string, unknown>): void {
  const msg = JSON.stringify({
    protocol_version: "1.0",
    id: crypto.randomUUID(),
    session_id: sessionId,
    type: "event",
    event,
    data,
    timestamp: new Date().toISOString(),
  });
  process.stdout.write(msg + "\n");
}

// ─── 参数解析 ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args[0] === "--version" || args[0] === "-v") {
  process.stdout.write(`ar-deepcode v${readVersion()}\n`);
  process.exit(0);
}

if (args[0] === "--help" || args[0] === "-h") {
  process.stdout.write(
    [
      "ar-deepcode — AgentRouter platform mode for Deep Code CLI",
      "",
      "Usage:",
      "  ar-deepcode exec <command>     Run a single command and emit NDJSON events",
      "  ar-deepcode doctor             Run diagnostics",
      "  ar-deepcode --version          Print version",
      "  ar-deepcode --help             Show this help",
      "",
      "Output: NDJSON (JSON Lines) to stdout",
      "  {protocol_version, id, session_id, type:'event', event, data, timestamp}",
      "",
      "Events:",
      "  task:start   Session started",
      "  progress     Assistant message, thinking, or tool execution",
      "  completion   Session completed successfully",
      "  error        Session failed",
    ].join("\n") + "\n"
  );
  process.exit(0);
}

if (args[0] === "doctor") {
  // 快速诊断：验证配置可读 + Node 可用
  const version = readVersion();
  const settings = resolveCurrentSettings(process.cwd());
  const diag = {
    version,
    node: process.version,
    platform: process.platform,
    model: settings.model,
    baseURL: settings.baseURL,
    hasApiKey: !!settings.apiKey,
    configFound: !!readSettings() || !!readProjectSettings(process.cwd()),
  };
  process.stdout.write(JSON.stringify(diag) + "\n");
  process.exit(diag.hasApiKey ? 0 : 1);
}

if (args[0] !== "exec") {
  process.stderr.write(`Unknown command: ${args[0]}\n`);
  process.exit(1);
}

const command = args.slice(1).join(" ").trim();
if (!command) {
  process.stderr.write("Error: No command provided\n");
  process.exit(1);
}

// ─── 主流程 ──────────────────────────────────────────────────────────────

const sessionId = crypto.randomUUID();
const projectRoot = process.cwd();

emitEvent(sessionId, "task:start", { command, projectRoot });

const settings = resolveCurrentSettings(projectRoot);

// 创建一个 Promise 来等待会话完成
let sessionError: Error | null = null;

const sessionManager = new SessionManager({
  projectRoot,
  createOpenAIClient,
  getResolvedSettings: () => ({
    model: settings.model,
    webSearchTool: settings.webSearchTool,
    mcpServers: settings.mcpServers,
    permissions: settings.permissions,
  }),
  renderMarkdown: (text: string) => text,
  onAssistantMessage: (message: SessionMessage, _shouldConnect: boolean) => {
    if (message.role === "assistant") {
      const content = message.content ?? "";
      // reasoning_content 存储在 messageParams 中
      const msgParams = message.messageParams as { reasoning_content?: string } | null;
      const reasoningContent = msgParams?.reasoning_content ?? "";
      if (reasoningContent) {
        emitEvent(sessionId, "progress", {
          channel: "reasoning",
          content: reasoningContent,
          sessionId,
        });
      }
      if (content) {
        emitEvent(sessionId, "progress", {
          type: "assistant_message",
          content,
          meta: message.meta ?? {},
          sessionId,
        });
      }
    } else if (message.role === "tool") {
      emitEvent(sessionId, "progress", {
        type: "tool_result",
        content: message.content ?? "",
        meta: message.meta ?? {},
        sessionId,
      });
    } else if (message.role === "system") {
      emitEvent(sessionId, "progress", {
        type: "system_message",
        content: message.content ?? "",
        sessionId,
      });
    }
  },
  onSessionEntryUpdated: (entry: SessionEntry) => {
    if (entry.status === "failed") {
      sessionError = new Error("Session failed");
    }
  },
});

async function run(): Promise<void> {
  try {
    await sessionManager.handleUserPrompt({ text: command });

    // 等待一小段时间让最后的状态更新回调执行
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (sessionError) {
      emitEvent(sessionId, "error", {
        error: sessionError.message,
        sessionId,
      });
      process.exit(1);
    }

    emitEvent(sessionId, "completion", {
      sessionId,
      status: "completed",
    });
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitEvent(sessionId, "error", { error: msg, sessionId });
    process.exit(1);
  }
}

run();
