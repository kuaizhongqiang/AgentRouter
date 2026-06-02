# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgentRouter is a multi-agent collaborative desktop platform that orchestrates multiple open-source CLI coding assistants into a unified Electron + Vue 3 interface. The platform does **not** write code — it only **calls** (spawns CLI subprocesses) and **maintains** (messages, tasks, logs, memory).

- **Stack**: Electron 33 + Vue 3 + Vite 8 + TypeScript 5.7 + sql.js (SQLite WASM)
- **6 Integrated Agents**: CodeWhale (Rust), Reasonix (Node.js/TS), Deep Code CLI (Node.js/TS), OpenCode (Go), Cline (npm binary), Continue (npm binary)
- **Target**: Windows desktop (`electron-builder --win --dir`)

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | Vite build frontend → `dist/` |
| `npm run build:electron` | Compile Electron TS → `dist-electron/` (CommonJS) |
| `npm run electron:dev` | Full dev: compile backend + concurrently Vite + Electron |
| `npm run electron:build` | Production build: backend + frontend + electron-builder `--win --dir` |
| `npm run preview` | Vite preview of built frontend |
| `build.bat` | Windows one-click build (seeds build-cache → compiles backend → builds agents → packages) |
| `node test/runtime-test-2.mjs` | 100-test runtime integration suite |
| `node test/smoke-test.mjs` | E2E smoke test (PM task parsing flow) |

### Building CLI Agents

```bash
# CodeWhale (Rust, requires Rust 1.88+)
cd agents/codewhale && cargo build --release -p codewhale-cli -p codewhale-tui

# Reasonix (Node.js)
cd agents/reasonix && npm run build

# Deep Code CLI (Node.js ≥22)
cd agents/deepcode && npm install && npm run build

# OpenCode (Go 1.24+)
cd agents/opencode && go build -o ar-opencode.exe .

# Cline (npm published binary — no local build needed)
npm install -g @cline/cli

# Continue (npm published binary — no local build needed)
npm install -g @continuedev/cli

# The platform.wrappers at agents/cline/platform.cjs and agents/continue/platform.cjs
# translate each CLI's native output to the AgentRouter NDJSON protocol.
```

## Architecture

```
Electron Main Process
├── Agent Layer (agents/)
│   ├── adapter.ts       — AgentAdapter interface (name, manifest(), spawnExec(), spawnDoctor())
│   ├── manager.ts       — Registry + subprocess lifecycle + NDJSON stdout parser + _sender injection
│   ├── codewhale.ts     — Spawns ar-codewhale (Rust binary, --platform-mode)
│   ├── reasonix.ts      — Spawns node dist/cli/index.js platform (--role pm|executor)
│   ├── deepcode.ts      — Spawns node dist/platform.js exec
│   ├── opencode.ts      — Spawns ar-opencode (Go binary) platform exec
│   ├── cline.ts         — Spawns node agents/cline/platform.cjs (wraps npm `cline` binary)
│   ├── continue.ts      — Spawns node agents/continue/platform.cjs (wraps npm `cn` binary)
│   └── task-parser.ts   — Parses structured tasks from agent reply (```tasks JSON / ```json / markdown checkboxes)
├── Data Layer (database/)
│   ├── index.ts         — sql.js WASM singleton, ~/.agentrouter/agentrouter.db
│   ├── migrations.ts    — Schema v1→v4 (projects, sessions, messages, tasks, agent_logs, memories)
│   └── repository.ts    — ~20 CRUD functions, all synchronously save after mutation
├── IPC Layer (ipc/)
│   ├── index.ts         — Registers all handlers
│   ├── agents.ts        — agent:exec|list|kill|doctor|manifest|replay + suggestion routing
│   ├── projects.ts      — db:listProjects|createProject|removeProject|getProject
│   ├── sessions.ts      — db:listSessions|createSession|removeSession|renameSession|getSession
│   ├── messages.ts      — db:listMessages|addMessage
│   ├── tasks.ts         — db:listTasks|addTask|updateTask|batchAddTasks|approvePlan + dynamic adjustment
│   └── credentials.ts   — credentials:get|set
├── Scheduler (scheduler/)
│   ├── executor.ts      — groupByParallelGroup(), detectFileConflicts(), Semaphore
│   └── pm-lifecycle.ts  — PMRegistry: tracks PM processes, handles suggestion routing
├── MCP (mcp/server.ts)  — Stdio MCP server exposing file.read/write/search to CLI agents
├── preload.ts           — contextBridge: window.agent.* + window.db.* + window.credentials.*
├── main.ts              — App entry: DB init, window, agent registration, IPC setup, MCP start
├── credentials.ts       — Unified credential store (~/.agentrouter/credentials.json), shared by all agents
└── types.ts             — Project, Session, Message, Task, AgentLog interfaces
```

### Key Patterns

**Agent Adapter Pattern**: Each CLI implements `AgentAdapter` (name, displayName, manifest(), spawnExec(), spawnDoctor()). `AgentManager` maintains a registry maps agent name → adapter. All agents communicate via stdout NDJSON event stream.

**AgentManifest**: Each agent declares `identity`, `tagline`, `best_for`/`not_for`, `execution_model` (parallel_mode + max_instances), `context_budget`, and optional `capabilities.can_suggest` (marks PM-capable agents).

**NDJSON Protocol**: stdin/stdout JSON Lines event stream between platform and CLI. Event format: `{ protocol_version, id, session_id, type: 'event', event, data, timestamp, _sender? }`. Events: task:start, progress, completion, error, cancelled, suggestion, task:update, task:add, task:cancel.

**6 Execution Modes**: 对话 (Chat), PM 拆解 (PM decomposes tasks), YOLO (auto-approve + parallel), 审批 (approve plan first), 逐步 (confirm per group), 预览 (plan only, no execution).

**Task Scheduling**: Tasks grouped by `parallel_group` — within-group parallel, between-group serial. `detectFileConflicts()` compares file scopes, downgrades conflicting tasks to serial. `Semaphore` caps concurrency.

### Data Storage

- **DB**: `~/.agentrouter/agentrouter.db` (sql.js WASM, synchronous API — never in renderer)
- **Event logs**: `~/.agentrouter/projects/<id>/sessions/<id>/events/<agentName>.jsonl`
- **Credentials**: `~/.agentrouter/credentials.json`
- **Memories**: `memories` table, indexed by `(projectId, agentName)`

## Conventions

- **Filenames**: kebab-case (`task-parser.ts`, `pm-lifecycle.ts`)
- **Agent adapters**: implement `AgentAdapter`, register in `AgentManager`
- **IPC channels**: namespaced (`db:listProjects`, `agent:exec`, `agent:output`)
- **Fork convention**: CLI modifications prefixed with `ar-`, I/O interface layer only (see each agent's `FORK.md`)
- **No lint/format tools** configured — no ESLint, Prettier, or unit test framework
- **Credentials**: Unified store at `~/.agentrouter/credentials.json`; spawn injects `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `DEEPCODE_API_KEY`, etc.

## Important Notes

- **sql.js is synchronous** — cannot be used in renderer; always access via IPC
- **CodeWhale requires Rust 1.88+** (uses `let_chains` extensively)
- **OpenCode requires Go 1.24+**
- **npm install** — use `--ignore-scripts` on first install; postinstall copies tokenizer from reasonix dist
- **build.bat is Windows-only** (`chcp 65001` + `xcopy`)
- **Packaging is Windows-only** (`--win --dir` unpacked mode)
- **`npm run electron:dev`** waits for Vite (port 5173) before launching Electron
- **stderr is not forwarded** to frontend bubbles — only logged to console
- **`docs/ARCHITECTURE.md`** is superseded by `ProjectVision/` — refer to ProjectVision for authoritative architecture docs
- **`electron/mcp/server.js`** is auto-started as a child process in main.ts
- **Cline** (npm `@cline/cli`, v2.x) uses a precompiled binary with Bun embedded; run via `agents/cline/platform.cjs` wrapper that translates its JSON Lines output to NDJSON
- **Continue** (npm `@continuedev/cli`, v1.x) uses headless mode `-p --format json --silent`; run via `agents/continue/platform.cjs` wrapper that generates a temp DeepSeek config file
- **Wrapper convention**: Agents that don't natively speak the AgentRouter NDJSON protocol get a `platform.cjs` wrapper in their `agents/<name>/` directory that translates their output format
- **Cline model**: defaults to `deepseek-v4-flash` (respects `CLINE_MODEL` env var); the built-in `cline auth` command stores API credentials independently
- **Continue model**: defaults to `deepseek/deepseek-chat` (respects `CONTINUE_MODEL` env var); wrapper auto-generates YAML config from `~/.agentrouter/credentials.json`
- **`--output-format` vs `--json` vs `--format json`**: Each agent has its own output flag — CodeWhale uses `stream-json`, Cline uses `--json`, Continue uses `--format json`. The manager's ANSI-sanitizer catches escape codes regardless
