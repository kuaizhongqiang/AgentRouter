# AgentRouter

多 Agent 协同桌面平台。将多个开源 coding CLI 整合到统一界面中，让它们协同完成同一个项目。

> **核心理念**：平台模拟"人"来调用 CLI。平台只做两件事：**调用**（spawn CLI 子进程）和**维护**（记消息、记任务、存日志）。不做代码能力增强。

---

## 架构

```
AgentRouter/
├── electron/                  Electron 主进程 + TypeScript
│   ├── main.ts                窗口管理 + IPC 注册
│   ├── preload.ts             contextBridge API (多 Agent)
│   ├── ipc/                   IPC 处理器（按领域拆分）
│   │   ├── projects.ts        项目 CRUD
│   │   ├── sessions.ts        对话 CRUD
│   │   ├── messages.ts        消息 CRUD
│   │   ├── tasks.ts           任务 CRUD
│   │   └── agents.ts          Agent 执行 IPC
│   ├── database/              数据层
│   │   ├── index.ts            SQLite 初始化 (sql.js)
│   │   ├── migrations.ts       Schema 迁移
│   │   └── repository.ts       CRUD 操作
│   └── agents/                Agent 管理层
│       ├── adapter.ts          AgentAdapter 接口
│       ├── manager.ts          AgentManager (多 Agent 调度)
│       └── codewhale.ts        CodeWhale 适配器
├── src/                       Vue 3 前端
│   └── App.vue                三栏 UI + Agent/模式选择器
├── agents/                    Fork 的开源 CLI 源码
│   ├── reasonix/              DeepSeek-Reasonix (MIT, v0.52.0)
│   └── codewhale/             CodeWhale (MIT, v0.8.46)
├── docs/                      设计文档
│   ├── GOALS.md                核心目标
│   ├── ARCHITECTURE.md         架构决策
│   ├── PROTOCOL.md             CLI↔平台通信协议
│   ├── PHASE1.md               第一期实施范围
│   ├── SCENARIO.md             全流程场景推演
│   ├── CLI_MODIFICATION.md     CLI 改造方案
│   ├── FORK_MANAGEMENT.md      Fork 管理与署名
│   ├── OUTPUT_MANAGEMENT.md    产出文件管理
│   └── AGENT_ADAPTATION_GUIDE.md Agent 改造方法论
└── package.json
```

---

## 功能

| 功能 | 状态 | 说明 |
|---|---|---|
| **项目管理** | ✅ | 绑定本地路径，多仓库 |
| **对话/消息** | ✅ | 多标签页，SQLite 持久化 |
| **单 Agent 执行** | ✅ | 默认 CodeWhale |
| **Agent 选择器** | ✅ | Web 端已就绪，后端支持多 Agent 路由 |
| **执行模式** | 🚧 规划中 | YOLO / 审批 / 逐步 / 预览 |
| **PM 任务拆解** | 🚧 规划中 | Reasonix 担任 PM，产出结构化任务列表 |
| **多 Agent 并行** | 🚧 规划中 | 按 parallel_groups 调度 |
| **Reasonix 集成** | ✅ CLI 改造完成 | 新增 `platform` 子命令 |
| **CodeWhale 集成** | ✅ CLI 改造完成 | 新增 `--mode platform` 参数 |

---

## Agent 工作流程

```
绑定项目路径 → 用户输入需求
                  │
                  ▼
          [平台路由] → 选择 PM Agent（如 Reasonix）
           │      │
        spawn CLI   维护（记消息、记任务、存日志）
           │
           ▼
    PM Agent 分析需求 → 产出结构化任务列表
                        {tasks: [{id, title, assignee, path, depends_on, parallel_group}]}
                  │
                  ▼
          平台按 parallel_groups 调度
           t1 → ar-codewhale
           t2 → ar-codewhale  (并行)
           t3 → ar-reasonix
                  │
          结果汇聚到平台 UI
```

---

## 开发

```bash
# 编译 Electron 后端 TypeScript
npm run build:electron

# Vite 前端开发服务器
npm run dev

# Electron + Vite 联调
npm run electron:dev

# 打包为 Windows portable exe
npm run electron:build
```

### 构建 CLI Agent

```bash
# CodeWhale (Rust, 需要 MinGW-w64 或 VS Build Tools)
cd agents/codewhale
cargo build --release -p codewhale-cli -p codewhale-tui

# Reasonix (Node.js)
cd agents/reasonix
npm run build
```

---

## 数据存储

`~/.agentrouter/agentrouter.db` — SQLite 数据库 (sql.js WASM 引擎)

Agent 执行日志输出到 `~/.agentrouter/projects/<id>/sessions/<id>/events/`（JSON Lines 格式）

---

## 通信协议

平台与 CLI 之间通过 stdin/stdout 传输[JSON Lines](https://jsonlines.org/)事件流。协议对齐 MCP 标准。

详细定义见 [`docs/PROTOCOL.md`](docs/PROTOCOL.md)。

---

## 使用的开源项目

AgentRouter 集成了以下开源项目的修改版本，所有改动仅限于 I/O 接口层：

| 项目 | 原仓库 | 许可证 | Fork 版本 |
|---|---|---|---|
| CodeWhale | https://github.com/CodeWhaleTeam/codewhale | MIT | v0.8.46 |
| DeepSeek-Reasonix | https://github.com/esengine/DeepSeek-Reasonix | MIT | v0.52.0 |

各项目的完整许可证文本见对应 `agents/{project}/LICENSE` 文件。改动记录见各项目目录下的 `FORK.md`。
