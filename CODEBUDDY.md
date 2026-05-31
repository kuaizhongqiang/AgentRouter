# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Development Commands

```bash
npm run dev              # Vite dev server (http://localhost:5173)
npm run build            # Vite production build
npm run electron:dev     # Electron + Vite 联调 (build:electron → concurrently vite + wait-on + electron)
npm run electron:build   # Vite build + electron-builder → Windows portable exe
npm run preview          # Vite preview server
```

There is no test runner configured yet.

## Architecture Overview

AgentRouter is a multi-agent collaborative desktop platform ("多开源 CLI 编程助手调度器").
It provides a unified three-panel UI that integrates external coding CLI tools via subprocess management.
The platform does NOT write code — it only dispatches (spawn CLI, maintain context).

### Vision Documents

The complete product vision is defined in `ProjectVision/` — these are the canonical design references:

| Document | Content |
|---|---|
| `ProjectVision/CONCEPT.md` | Core concepts — 4C framework (Call/Maintain/Coordinate/Adapt) |
| `ProjectVision/ARCHITECTURE.md` | System architecture — tag system, collaboration model, context budget |
| `ProjectVision/PROTOCOL.md` | Communication protocol — `_sender` metadata, dynamic adjustment events |
| `ProjectVision/PERSONA.md` | User personas — power user, beginner, small team |
| `ProjectVision/SCENARIO.md` | Full 9-step scenario with dynamic adjustment |

### Implementation Phases

| Phase | Status | Theme |
|---|---|---|
| Phase 1 | ✅ Complete | Platform foundation — Electron/IPC/SQLite/dual-CLI |
| Phase 2 | ✅ Complete | Mission collaboration — PM decomposition/approve/execute/summarize |
| Phase 3 | ⬜ Planned | Protocol foundation — `_sender` metadata, tag system |
| Phase 4 | ⬜ Planned | Scheduler intelligence — parallel_groups, context passing, 4 modes |
| Phase 5 | ⬜ Planned | Dynamic adjustment — suggestion loop, PM lifecycle |
| Phase 6 | ⬜ Planned | Advanced protocol — reasoning bubbles, MCP, memory, replay |

See `docs/PHASE3.md` for detailed scope of each phase.

### Top-level Layout

```
AgentRouter/
├── electron/             # Electron main process (TypeScript, compiled to dist-electron/)
│   ├── main.ts           # Window management + IPC handler registration
│   ├── preload.ts        # contextBridge — exposes `window.agent` and `window.db`
│   └── agents/           # Agent subprocess management
│       ├── adapter.ts    # AgentAdapter interface + AgentEvent type
│       ├── manager.ts    # AgentManager — spawn/monitor/kill subprocesses
│       ├── codewhale.ts  # CodeWhale adapter (Rust CLI)
│       ├── reasonix.ts   # Reasonix adapter (Node.js CLI, supports --role pm)
│       └── task-parser.ts # Structured task extraction from PM reply
├── ipc/                  # IPC handlers (domain-split)
│   ├── agents.ts         # Agent execution + PM task parsing
│   ├── projects.ts       # Project CRUD
│   ├── sessions.ts       # Session CRUD
│   ├── messages.ts       # Message CRUD
│   └── tasks.ts          # Task CRUD + batch ops + approve
├── database/             # Data layer (sql.js WASM)
│   ├── index.ts          # SQLite init
│   ├── migrations.ts     # Schema migrations
│   └── repository.ts     # CRUD operations
├── src/
│   └── App.vue           # Single-file Vue 3 component — three-panel UI + all logic
├── agents/               # Forked open-source CLI source trees
│   ├── reasonix/         # DeepSeek-Reasonix (MIT, v0.52.0)
│   └── codewhale/        # CodeWhale (MIT, v0.8.46)
├── ProjectVision/        # Canonical product vision (DO NOT MODIFY)
├── docs/                 # Implementation docs (phase plans, decisions, protocols)
├── public/               # Static assets (favicon.svg, icons.svg)
├── index.html            # Vite entry point
├── vite.config.js        # @vitejs/plugin-vue, port 5173
└── package.json          # type: "module"
```

### Data Flow

```
Vue 3 SFC (src/App.vue)
  ── calls → window.agent.exec() / window.db.*()
    ── IPC (contextBridge → ipcRenderer.invoke) ──→ electron/main.ts (ipcMain.handle)
      ├── database/*.ts (sql.js) for CRUD
      └── agents/manager.ts for subprocess: spawn via adapter
              ── streams NDJSON events back → mainWindow.webContents.send('agent:output')
                ── preload exposes onOutput() callback ──→ Vue component updates
```

### Three-Panel UI (src/App.vue)

| Panel | Position | Content |
|---|---|---|
| Left sidebar | 220px wide | Project list — CRUD via `window.db` |
| Main center | flex: 1 | Session tabs + conversation messages + Agent/mode selector + input bar + status bar |
| Right sidebar | 220px wide | Task list (pending/running/completed/archived) + approve/summarize buttons |

### Database Schema (sql.js WASM)

- `projects` — id, name, path, createdAt, updatedAt
- `sessions` — id, projectId (FK), title, type (chat/mission), createdAt, updatedAt
- `messages` — id, sessionId (FK), role (user/agent/system), content, timestamp
- `tasks` — id, sessionId (FK), projectId (FK), title, assignee, description, sort_order, status (pending/running/completed/archived), createdAt, updatedAt
- `agent_logs` — id, sessionId (FK), agentName, event (JSON), createdAt

### IPC Namespaces

- `agent:*` — Agent execution (exec, list, kill, doctor) and streaming events (output, status)
- `db:*` — All CRUD operations for projects, sessions, messages, tasks, and batch operations (batchAddTasks, updateTask, approvePlan)

### Agent Subprocess Management

`agents/manager.ts` spawns subprocesses via adapters (CodeWhaleAdapter, ReasonixAdapter).
Output is parsed as NDJSON event lines and forwarded to the renderer.
Each `exec()` call spawns a new process (not a long-running daemon).
SIGTERM → 3s timeout → SIGKILL prevents orphan processes.

### Key Conventions

- **TypeScript**: All `electron/` code is TypeScript (compiled to `dist-electron/` as CommonJS).
- **Vue 3 SFC**: `<template>` + `<script setup>` + `<style>` in single file.
- **contextIsolation: true**: Renderer cannot access Node.js APIs. Communication through `contextBridge`.
- **PM mode**: Selecting "PM 拆解" mode auto-switches agent to Reasonix (the only PM-capable agent).
- **port 5173**: Vite dev server default. If occupied, Vite auto-increments; start Electron with correct port via `VITE_DEV_SERVER_URL`.
- **agents/ forks**: `agents/reasonix` and `agents/codewhale` are forked from upstream. Do NOT modify unless adding protocol support.
- **No .cjs**: Phase 1 migration removed all .cjs files. Current codebase uses .ts + compile-to-CommonJS.
