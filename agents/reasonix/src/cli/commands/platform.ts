import { stdin } from "node:process";
import { createInterface } from "node:readline/promises";
import {
  bridgeEndpointEnv,
  defaultConfigPath,
  isPlausibleKey,
  loadApiKey,
  loadEndpoint,
  loadMaxIterPerTurn,
  loadToolRateLimit,
  normalizeMcpConfig,
  readConfig,
  saveApiKey,
} from "../../config.js";
import { loadDotenv } from "../../env.js";
import { t } from "../../i18n/index.js";
import {
  CacheFirstLoop,
  DeepSeekClient,
  ImmutablePrefix,
} from "../../index.js";
import { McpClient } from "../../mcp/client.js";
import { preflightStdioSpec } from "../../mcp/preflight.js";
import { bridgeMcpTools } from "../../mcp/registry.js";
import { buildTransportFromSpec } from "../../mcp/transport-from-spec.js";
import { ToolRegistry } from "../../tools.js";
import { formatMcpLifecycleEvent } from "../ui/mcp-lifecycle.js";
import { formatMcpSlowToast } from "../ui/mcp-toast.js";
import { formatEvent, loopEventToPlatform } from "../platform-output.js";

export interface PlatformOptions {
  task: string;
  role: "pm" | "executor";
  sessionId: string;
  model?: string;
  budgetUsd?: number;
  mcp?: string[];
  mcpPrefix?: string;
}

/** System-prompt suffix for PM mode: instructs the model to output a JSON task list at the end. */
const PM_PROMPT_SUFFIX = `
---
You are acting as a **Project Manager (PM)** in a multi-agent system.
Your job is to analyze the requirements and produce a structured task breakdown.

At the end of your response, output a JSON task list in this exact format:

\`\`\`json
[{"id":"t1","title":"...","assignee":"codewhale","path":"./src/","depends_on":[],"parallel_group":1}]
\`\`\`

Rules:
- Each task must have a unique id (t1, t2, ...).
- "assignee" is one of: "codewhale", "reasonix".
- "path" is the file or directory the task relates to.
- "depends_on" is an array of task ids this task depends on (empty if none).
- "parallel_group" groups tasks that can run in parallel (same group number = parallel).
- Break the work down into granular, actionable tasks.
- Do NOT put explanatory text inside the JSON block. The JSON block must be parseable.
- If there is only one task, still output it as a single-element array.
`;

async function ensureApiKey(): Promise<string> {
  const existing = loadApiKey();
  if (existing) return existing;

  if (!stdin.isTTY) {
    process.stderr.write(t("run.missingApiKey"));
    process.exit(1);
  }

  process.stdout.write(
    "DeepSeek API key not configured.\nGet one at https://platform.deepseek.com/api_keys\n",
  );
  const rl = createInterface({ input: stdin, output: process.stdout });
  try {
    while (true) {
      const answer = (await rl.question("API key › ")).trim();
      if (!answer) continue;
      if (!isPlausibleKey(answer)) {
        process.stdout.write("Key looks too short. Paste the full token (16+ chars, no spaces).\n");
        continue;
      }
      saveApiKey(answer);
      process.stdout.write(`Saved to ${defaultConfigPath()}\n\n`);
      return answer;
    }
  } finally {
    rl.close();
  }
}

/**
 * Extract a JSON task array from the end of assistant content.
 * Looks for the last JSON array block (```json [...] ```).
 */
function extractTasks(content: string): unknown[] | null {
  // Try to find a JSON block at the end of the content
  const jsonBlockMatch = content.match(/```json\s*(\[[\s\S]*?\])\s*```\s*$/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to next method
    }
  }

  // Try to find any JSON array at the end
  const arrayMatch = content.match(/\[[\s\S]*?\]\s*$/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not valid JSON
    }
  }

  return null;
}

export async function platformCommand(opts: PlatformOptions): Promise<void> {
  loadDotenv();
  await ensureApiKey();
  bridgeEndpointEnv();

  // Optional MCP setup
  const cfg = readConfig();
  const normalizedSpecs = normalizeMcpConfig(
    cfg,
    opts.mcp && opts.mcp.length > 0 ? opts.mcp : undefined,
  );
  const clients: McpClient[] = [];
  let tools: ToolRegistry | undefined;
  let successCount = 0;
  const workspaceDir = process.cwd();

  if (normalizedSpecs.length > 0) {
    tools = new ToolRegistry({ rateLimit: loadToolRateLimit() });
    for (const spec of normalizedSpecs) {
      let label = "anon";
      let mcp: McpClient | undefined;
      try {
        label = spec.name ?? "anon";
        if (spec.disabled) {
          process.stderr.write(`${formatMcpLifecycleEvent({ state: "disabled", name: label })}\n`);
          continue;
        }
        process.stderr.write(`${formatMcpLifecycleEvent({ state: "handshake", name: label })}\n`);
        const t0 = Date.now();
        const prefix = spec.name
          ? `${spec.name}_`
          : normalizedSpecs.length === 1 && opts.mcpPrefix
            ? opts.mcpPrefix
            : "";
        if (spec.transport === "stdio") preflightStdioSpec(spec);
        const transport = buildTransportFromSpec(spec, { cwd: workspaceDir });
        mcp = new McpClient({ transport, workspaceDir, requestTimeoutMs: spec.requestTimeoutMs });
        await mcp.initialize();
        const bridge = await bridgeMcpTools(mcp, {
          registry: tools,
          namePrefix: prefix,
          serverName: label,
          onSlow: (info) =>
            process.stderr.write(
              `${formatMcpSlowToast({ name: info.serverName, p95Ms: info.p95Ms, sampleSize: info.sampleSize })}\n`,
            ),
        });
        process.stderr.write(
          `${formatMcpLifecycleEvent({
            state: "connected",
            name: label,
            tools: bridge.registeredNames.length,
            ms: Date.now() - t0,
          })}\n`,
        );
        clients.push(mcp);
        successCount++;
      } catch (err) {
        await mcp?.close().catch(() => undefined);
        process.stderr.write(
          `${formatMcpLifecycleEvent({ state: "failed", name: label, reason: (err as Error).message })}\n  ${t("mcpLifecycle.failedSetupConfigHint")}\n`,
        );
      }
    }
    if (successCount === 0) tools = undefined;
  }

  const isPm = opts.role === "pm";
  const defaultSystem = `You are Reasonix, a helpful DeepSeek-powered assistant. Be concise and accurate.`;
  const systemPrompt = isPm ? defaultSystem + PM_PROMPT_SUFFIX : defaultSystem;

  const ep = loadEndpoint();
  const client = new DeepSeekClient({ apiKey: ep.apiKey, baseUrl: ep.baseUrl });
  const prefix = new ImmutablePrefix({
    system: systemPrompt,
    toolSpecs: tools?.specs(),
  });
  const loop = new CacheFirstLoop({
    client,
    prefix,
    tools,
    model: opts.model,
    budgetUsd: opts.budgetUsd,
    maxIterPerTurn: loadMaxIterPerTurn(),
  });

  // 1. Emit task:start
  const startLine = formatEvent(opts.sessionId, "task:start", {});
  process.stdout.write(startLine);

  let finalContent = "";

  try {
    for await (const ev of loop.step(opts.task)) {
      const lines = loopEventToPlatform(ev, opts.sessionId);
      for (const line of lines) {
        process.stdout.write(line);
      }
      // Track final assistant content — needed for PM task extraction
      if (ev.role === "assistant_delta" && ev.content) {
        finalContent += ev.content;
      }
      // Persist usage for stats (same as run.ts)
      if (ev.role === "assistant_final" && ev.stats?.usage) {
        const { appendUsage } = await import("../../telemetry/usage.js");
        appendUsage({ session: null, model: ev.stats.model, usage: ev.stats.usage });
      }
    }
  } catch (err) {
    const errLine = formatEvent(opts.sessionId, "error", {
      message: err instanceof Error ? err.message : String(err),
    });
    process.stdout.write(errLine);
  }

  // 2. Emit completion (with PM task extraction if applicable)
  const completionData: Record<string, unknown> = { summary: finalContent };
  if (isPm && finalContent) {
    const tasks = extractTasks(finalContent);
    if (tasks !== null && tasks.length > 0) {
      completionData.tasks = tasks;
    }
  }
  const doneLine = formatEvent(opts.sessionId, "completion", completionData);
  process.stdout.write(doneLine);

  // Close MCP clients
  for (const c of clients) await c.close();
}
