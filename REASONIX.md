# AgentRouter

## Stack

- **Runtime:** Node.js v24, npm
- **UI:** Electron 33 + Vue 3 + Vite
- **Storage:** SQLite via sql.js (WASM, zero external deps) — `~/.agentrouter/agentrouter.db`

## Layout

```
├── agents/
│   ├── reasonix/      Forked DeepSeek-Reasonix 源码
│   └── codewhale/     Forked CodeWhale 源码
├── electron/
│   ├── main.cjs       主进程 (窗口管理 + IPC)
│   ├── preload.cjs    预加载脚本 (contextBridge API)
│   ├── agent-manager.cjs  CodeWhale 子进程管理
│   └── database.cjs   SQLite 数据层
├── src/
│   └── App.vue        三栏 UI (项目 | 对话 | 任务)
├── package.json        agent-router
├── vite.config.js
└── REASONIX.md
```

## Commands

| 命令 | 作用 |
|---|---|
| `npm run dev` | Vite 开发服务器 |
| `npm run electron:dev` | Electron + Vite 联调 |
| `npm run electron:build` | 打包为 Windows portable exe |

## Conventions

- Vue 3 SFC (`<template>` + `<script setup>` + `<style>`)
- Electron `.cjs` 文件用 CommonJS（因 `package.json` 设 `"type": "module"`）
- IPC 通信：preload 用 `contextBridge` 暴露 API，主进程用 `ipcMain.handle`
- 数据库操作通过 `db:xxx` 命名空间 IPC 暴露

## Watch out for

- `agents/reasonix` 和 `agents/codewhale` 是 fork 源码，修改前确认上游版本
- 子进程管理注意杀死整个进程树，避免孤儿进程（`agent-manager.cjs` 的 `SIGTERM` → `SIGKILL`）
- Electron `contextIsolation: true`，渲染进程不能直接访问 Node.js API
- `.cjs` vs `.js`：Electron 主进程必须用 `.cjs`，因 `package.json` 有 `"type": "module"`
- 端口 5173 被占用时需手动 `taskkill /F /PID <pid>` 释放
