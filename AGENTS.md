# Project Instructions

This file provides context for AI assistants working on this project.

## Project Type: Electron + Vue 3 + Vite

### Commands
- Install: `npm install`
- Dev server: `npm run dev` (Vite only, port 5173)
- Electron dev: `npm run electron:dev` (Vite + Electron concurrently)
- Build: `npm run build` (Vite only)
- Package: `npm run electron:build` (Vite build + Windows portable exe)
- Preview: `npm run preview`

### Key Dependencies
- electron 33, vue 3, pinia 3, vite 8, @vitejs/plugin-vue 6
- sql.js (SQLite WASM, zero external deps)
- typescript 5.7, vue-tsc 2.2 (configured but not yet in use)

### Framework: Vite + Electron

### Documentation
Design docs are in `docs/`:
- `GOALS.md` — Project vision and goals
- `ARCHITECTURE.md` — Architecture decisions
- `PROTOCOL.md` — CLI↔Platform communication protocol
- `PHASE1.md` — Phase 1 scope
- `SCENARIO.md` — Full UX scenario walkthrough
- `CLI_MODIFICATION.md` — CLI adaptation plans
- `FORK_MANAGEMENT.md` — Fork management and attribution

### Version Control
This project uses Git. See `.gitignore` for excluded files.

## Architecture

### Entry Points
- `electron/main.cjs` — Electron main process (window management + IPC handler registration)
- `src/main.js` — Vue 3 app bootstrap

### Key Modules
- `electron/` — Electron main process (CommonJS, .cjs files). Handles IPC, SQLite database, agent subprocess management.
- `src/` — Vue 3 frontend. Single-page app (`App.vue`) with three-panel layout.
- `agents/` — Forked open-source CLI source trees (codewhale, reasonix). Modifications are limited to I/O interface changes.
- `docs/` — Design documents for the refactoring project.

### Data Flow
```
User input → Vue 3 SFC (src/App.vue)
  → window.agent.exec() / window.db.* (contextBridge)
  → IPC (ipcRenderer.invoke → ipcMain.handle)
    → database.cjs (sql.js CRUD)
    → agent-manager.cjs (spawn CLI subprocess, stream output)
  → Output streamed back via webContents.send('agent:output')
```

## Agent Guidance

- **AGENTS.md also read by:** CodeWhale (as WHALE.md) and other AI-compatible tools
- **Read-only surface:** `node_modules/`, `agents/*/node_modules/`, `agents/*/target/`, `dist/`, `release/`
- **Never edit:** Files in `agents/*/` should only be modified as specified in `docs/CLI_MODIFICATION.md` (I/O interface only, not internal logic). `.codewhale/` is auto-generated.
- **Always test with:** `npm run electron:dev` for dev workflow; verify with `npm run build`
- **Planning docs in `docs/` are the source of truth** for ongoing refactoring. Always check `docs/PHASE1.md` before implementing.

## Cache Stability

- **Frequently-rebuilt files:** `dist/`, `release/`, `node_modules/`, `package-lock.json`
- **Stable scaffolding:** `electron/main.cjs`, `vite.config.js`, `package.json`, `docs/*.md`
- **Append, don't reorder:** New context should go at the end of the request to preserve cache

## Guidelines

- Follow existing code style and patterns
- Electron main process must use `.cjs` (CommonJS) due to `"type": "module"` in package.json
- Vue files use `<script setup>` SFC style
- All IPC communication goes through contextBridge (contextIsolation: true)
- Changes to `agents/` directory should maintain minimal diff from upstream
