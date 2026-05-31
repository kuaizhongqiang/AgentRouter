import type { LoopEvent } from "../index.js";

let _idCounter = 0;
function nextId(): string {
  return `evt_${String(++_idCounter).padStart(3, "0")}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

/** Common fields for all NDJSON protocol events. */
export interface PlatformEvent {
  protocol_version: "1.0";
  id: string;
  session_id: string;
  type: "event";
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Create a base event skeleton with shared fields.
 */
function baseEvent(sessionId: string): Omit<PlatformEvent, "event" | "data"> {
  return {
    protocol_version: "1.0",
    id: nextId(),
    session_id: sessionId,
    type: "event",
    timestamp: timestamp(),
  };
}

/**
 * Format any event as an NDJSON line (newline-terminated).
 */
export function formatEvent(
  sessionId: string,
  event: string,
  data: Record<string, unknown>,
): string {
  return JSON.stringify({ ...baseEvent(sessionId), event, data }) + "\n";
}

/**
 * Convert a single LoopEvent into the appropriate platform NDJSON line(s).
 * Returns an array of NDJSON strings (may be empty for silent events).
 */
export function loopEventToPlatform(
  ev: LoopEvent,
  sessionId: string,
): string[] {
  switch (ev.role) {
    case "assistant_delta":
      const lines: string[] = [];
      // 推理 token → channel: reasoning
      if (ev.reasoningDelta) {
        lines.push(formatEvent(sessionId, "progress", { message: ev.reasoningDelta, channel: "reasoning" }));
      }
      // 可见 token → 普通 progress
      if (ev.content) {
        lines.push(formatEvent(sessionId, "progress", { message: ev.content }));
      }
      return lines;

    case "reasoning":
      return ev.reasoningDelta
        ? [formatEvent(sessionId, "progress", { message: ev.reasoningDelta, channel: "reasoning" })]
        : [];

    case "assistant_final":
      return [];

    case "error":
      return [
        formatEvent(sessionId, "error", {
          message: ev.error ?? ev.content,
        }),
      ];

    case "tool":
      return [formatEvent(sessionId, "progress", { message: `[tool ${ev.toolName}] ${ev.content}` })];

    // done, warning, status, steer, tool_start, tool_call_delta — not part of the protocol
    default:
      return [];
  }
}
