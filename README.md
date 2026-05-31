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
│       ├── task-parser.ts      任务块解析器（PM 拆解）
│       ├── codewhale.ts        CodeWhale 适配器
│       └── reasonix.ts         Reasonix 适配器
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
│   ├── PHASE2.md               第二期实施范围
│   ├── PHASE3.md               第三期规划
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
| **单 Agent 执行** | ✅ | 默认 CodeWhale，支持 Reasonix |
| **Agent 选择器** | ✅ | Web 端 + 后端多 Agent 路由 |
| **PM 任务拆解** | ✅ (Phase 2) | Reasonix 担任 PM，产出结构化任务列表 |
| **多 Agent 并行** | ✅ (Phase 2) | 按 parallel_groups 调度，并发执行 |
| **审批/汇总** | ✅ (Phase 2) | 审批 Plan + Mission 汇总验收 |
| **Reasonix 集成** | ✅ | 新增 `platform` 子命令 + `--role pm` |
| **CodeWhale 集成** | ✅ | 新增 `--platform-mode` 参数 |
| **执行模式** | 🚧 Phase 3 | YOLO / 审批 / 逐步 / 预览 |
| **推理气泡** | 🚧 Phase 3 | 实时显示 Agent 推理过程 |
| **长期记忆** | 🚧 Phase 3 | 跨会话 Agent 记忆持久化 |

---

## Agent 工作流程

### 对话模式

```
用户选择 Agent → 输入任务 → Agent 执行 → 结果返回对话
```

### PM 拆解模式（Phase 2）

```
用户选择 PM 拆解 → 自动切 Reasonix
                  │
                  ▼
        Reasonix(PM) 分析需求 → 产出结构化任务列表
                      {tasks: [{id, title, assignee, path, depends_on, parallel_group}]}
                  │
                  ▼
        用户审批 Plan → 平台按 parallel_groups 并发调度
                        t1 → codewhale (Group 1)
                        t2 → codewhale (Group 2, 并行)
                        t3 → reasonix (Group 2, 并行)
                  │
                  ▼
        任务完成 → 用户点"汇总 Mission" → PM 验收总结
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
