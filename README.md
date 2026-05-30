# AgentRouter

多 Agent 协同桌面平台。将多个开源 coding CLI 整合到统一界面中，实现项目、对话、任务的层级管理。

## 架构

```
AgentRouter/
├── electron/             Electron 主进程
│   ├── main.cjs          窗口管理 + IPC 桥梁
│   ├── preload.cjs       contextBridge API
│   ├── agent-manager.cjs CodeWhale 子进程管理
│   └── database.cjs      SQLite 数据层 (sql.js)
├── src/
│   └── App.vue           三栏 UI (项目 | 对话 | 任务)
├── agents/               Fork 的开源 CLI 源码
│   ├── reasonix/         DeepSeek-Reasonix
│   └── codewhale/        CodeWhale
└── package.json
```

## 功能

- **项目** — 绑定本地路径，管理多个代码仓库
- **对话** — 多标签页，SQLite 持久化
- **任务** — Agent 自动生成，只读归档
- **Agent 随启随停** — 桌面端开/关自动管理子进程

## 开发

```bash
npm run dev              # Vite 开发服务器
npm run electron:dev     # Electron + Vite 联调
npm run electron:build   # 打包为 Windows portable exe
```

## 数据存储

`~/.agentrouter/agentrouter.db` — SQLite 数据库 (sql.js WASM 引擎)
