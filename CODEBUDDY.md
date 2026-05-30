# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Development Commands

```bash
npm run dev              # Vite dev server (http://localhost:5173)
npm run build            # Vite production build
npm run electron:dev     # Electron + Vite 联调 (concurrently + wait-on)
npm run electron:build   # Vite build + electron-builder → Windows portable exe
npm run preview          # Vite preview server
```

There is no test runner configured yet.

## Architecture Overview

AgentRouter is a multi-agent collaborative desktop platform. It provides a unified three-panel UI that integrates external coding CLI tools (CodeWhale, Reasonix) via subprocess management.

### Top-level Layout

```
AgentRouter/
├── electron/             # Electron main process (CommonJS, .cjs)
│   ├── main.cjs          # Window management + IPC handler registration
│   ├── preload.cjs       # contextBridge — exposes `window.agent` and `window.db`
│   ├── agent-manager.cjs # Spawns `codewhale exec` subprocess, streams output
│   └── database.cjs      # SQLite via sql.js (WASM), stored at ~/.agentrouter/agentrouter.db
├── src/
│   └── App.vue           # Single-file Vue 3 component — three-panel UI + all logic
├── agents/               # Forked open-source CLI source trees
│   ├── reasonix/         # DeepSeek-Reasonix (Rust project, Cargo.toml)
│   └── codewhale/        # CodeWhale (Node.js project)
├── public/               # Static assets (favicon.svg, icons.svg)
├── index.html            # Vite entry point
├── vite.config.js        # @vitejs/plugin-vue, port 5173
└── package.json          # If package.json has "type": "module"
```

### Data Flow

```
Vue 3 SFC (src/App.vue)
  ── calls → window.agent.exec() / window.db.listProjects()
    ── IPC (contextBridge → ipcRenderer.invoke) ──→ electron/main.cjs (ipcMain.handle)
      ├── database.cjs (sql.js) for CRUD
      └── agent-manager.cjs for subprocess: spawn codewhale exec --output-format stream-json
              ── streams output back → mainWindow.webContents.send('agent:output')
                ── preload exposes onOutput() callback ──→ Vue component updates
```

### Three-Panel UI (src/App.vue)

| Panel | Position | Content |
|---|---|---|
| Left sidebar | 220px wide | Project list — CRUD via `window.db` |
| Main center | flex: 1 | Session tabs + conversation messages + input bar + status bar |
| Right sidebar | 220px wide | Task list (pending/running/completed/archived) |

### Database Schema (sql.js WASM)

- `projects` — id, name, path, createdAt, updatedAt
- `sessions` — id, projectId (FK), title, createdAt, updatedAt
- `messages` — id, sessionId (FK), role (user/agent/system), content, timestamp
- `tasks` — id, sessionId (FK), projectId (FK), title, status (pending/running/completed/archived), createdAt, updatedAt

### IPC Namespaces

- `agent:*` — Agent execution (exec, doctor) and streaming events (output, status)
- `db:*` — All CRUD operations for projects, sessions, messages, tasks

### Agent Subprocess Management

`agent-manager.cjs` spawns `codewhale exec --output-format stream-json` as a child process via `spawn()` with `shell: true`. Output is line-buffered and forwarded to the renderer via `webContents.send`. The subprocess is not a long-running daemon — each `exec()` call spawns a new process. The `SIGTERM → SIGKILL` fallback prevents orphan processes.

### Key Conventions

- **.cjs vs .js**: Because `package.json` sets `"type": "module"`, all Electron main-process files use `.cjs` extension with `require()` (CommonJS). Vue files under `src/` use ES modules.
- **Vue 3 SFC style**: `<template>` + `<script setup>` + `<style>` in a single file. No Vue Router, no Pinia stores yet — all state is managed via `ref()` in `App.vue`.
- **contextIsolation: true**: Renderer process cannot access Node.js APIs directly. Communication goes through `contextBridge`-exposed APIs.
- **port 5173**: Vite dev server default. If occupied, use `taskkill /F /PID <pid>` on Windows.
- **agents/ forks**: `agents/reasonix` and `agents/codewhale` are forked from upstream. Check upstream version before modifying.
- **Temp result files**: `.reasonix/` directory contains truncated result artifacts (generated). Not committed.
