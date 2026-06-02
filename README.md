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
│   │   ├── tasks.ts           任务 CRUD + 记忆 + 动态调整
│   │   ├── agents.ts          Agent 执行 IPC + suggestion 路由
│   │   └── credentials.ts     统一凭证 IPC（API Key / Base URL / 模型名）
│   ├── credentials.ts          统一凭证管理（读写 ~/.agentrouter/credentials.json）
│   ├── database/              数据层
│   │   ├── index.ts            SQLite 初始化 (sql.js)
│   │   ├── migrations.ts       Schema 迁移 (v1-v4)
│   │   └── repository.ts       CRUD 操作 + 记忆系统
│   ├── agents/                Agent 管理层
│   │   ├── adapter.ts          AgentAdapter 接口 (+ SenderMetadata/AgentManifest)
│   │   ├── manager.ts          AgentManager (+ _sender 注入 + PM 生命周期)
│   │   ├── task-parser.ts      任务块解析器（PM 拆解 + context）
│   │   ├── codewhale.ts        CodeWhale 适配器 (+ manifest)
│   │   ├── reasonix.ts         Reasonix 适配器 (+ manifest)
│   │   ├── deepcode.ts         Deep Code CLI 适配器
│   │   └── opencode.ts         OpenCode 适配器
│   ├── scheduler/              调度引擎 (Phase 4-5)
│   │   ├── executor.ts         并行执行 + 冲突检测 + 信号量
│   │   └── pm-lifecycle.ts     PM 生命周期 + suggestion 路由
│   └── mcp/                    MCP 服务器 (Phase 6)
│       └── server.ts           文件工具 (read/write/search)
├── src/                       Vue 3 前端
│   └── App.vue                三栏 UI + Agent 标签 + mode 选择 + 推理气泡
├── ProjectVision/              愿景文档体系（参阅基准）
├── docs/                      设计文档 & 报告
│   ├── GOALS.md                核心目标
│   ├── ARCHITECTURE.md         架构决策（已由 ProjectVision 取代）
│   ├── PROTOCOL.md             CLI↔平台通信协议
│   ├── PHASE1.md               第一期实施范围（已归档）
│   ├── PHASE2.md               第二期实施范围（已归档）
│   ├── PHASE3.md               第三期及后续规划（基于 ProjectVision）
│   ├── SCENARIO.md             全流程场景推演
│   ├── AUDIT_REPORT.md         审计报告（96% 对齐）
│   └── TEST_REPORT.md          测试报告（100/100 PASS）
├── test/                       运行时测试
│   ├── smoke-test.mjs          端到端冒烟测试
│   └── runtime-test-2.mjs      Phase 3-6 运行时集成测试（100 项）
├── agents/                    Fork 的开源 CLI 源码
│   ├── codewhale/             CodeWhale — Rust (MIT, v0.8.46)
│   ├── deepcode/              Deep Code CLI — TypeScript (MIT, v0.1.27)
│   ├── opencode/              OpenCode — Go (Apache-2.0)
│   └── reasonix/              DeepSeek-Reasonix — TypeScript (MIT, v0.52.0)
└── package.json
```

---

## 功能

| 功能 | 状态 | 说明 |
|---|---|---|
| **项目管理** | ✅ | 绑定本地路径，多仓库 |
| **对话/消息** | ✅ | 多标签页，SQLite 持久化 |
| **单 Agent 执行** | ✅ | 四个 Agent 可选：CodeWhale / Reasonix / Deep Code / OpenCode |
| **Agent 选择器 + 标签** | ✅ Phase 3 | 下拉选择 + tagline 工具提示 |
| **`_sender` 消息身份** | ✅ Phase 3 | 每条事件带 `{label, id}` 标识 |
| **PM 任务拆解** | ✅ Phase 2 | Reasonix 担任 PM，产出结构化任务列表 |
| **并行执行 + 冲突检测** | ✅ Phase 4 | parallel_groups 分组 + Semaphore 并发 + 文件冲突降级串行 |
| **审批/汇总** | ✅ Phase 2 | 审批 Plan + Mission 汇总验收 |
| **执行模式** | ✅ Phase 4 | YOLO / 审批 / 逐步 / 预览 |
| **动态调整 (suggestion)** | ✅ Phase 5 | Agent 提建议 → 模式驱动分发（YOLO 自动/审批暂停）|
| **PM 生命周期** | ✅ Phase 5 | PM 进程追踪 + stdin suggestion 转发 |
| **推理气泡** | ✅ Phase 6 | Reasonix reasoningDelta → 前端紫色气泡实时显示 |
| **长期记忆系统** | ✅ Phase 6 | memories 表 + CRUD IPC + preload 全链路 |
| **Session 回放** | ✅ Phase 6 | 读取 .jsonl 事件文件按时间戳回放 |
| **MCP 工具注入** | ✅ Phase 6 | 自动启动 MCP Server（file.read/write/search）|
| **统一凭证管理** | ✅ | 一次配置 API Key/Base URL/模型，所有 Agent 共享 |
| **Deep Code 集成** | ✅ | `platform exec` 子命令 + NDJSON 事件流 |
| **OpenCode 集成** | ✅ | `platform exec` 子命令 + reasoning 气泡支持 |
| **CodeWhale 集成** | ✅ | `--platform-mode` 参数 + `--role pm` |
| **Reasonix 集成** | ✅ | `platform` 子命令 + `--role pm` + reasoning 气泡 |

---

## Agent 工作流程

### 对话模式

```
用户选择 Agent → 输入任务 → Agent 执行 → 结果返回对话
```

### PM 拆解模式（完整链路）

```
用户选择 PM 拆解 → 自动切 Reasonix
                  │
                  ▼
        Reasonix(PM) 分析需求 → 产出结构化任务列表
           带 context(scope/deltas) + _sender 身份标识
                  │
                  ▼
        按执行模式分发：
          YOLO 🚀     → 自动审批 + 并行执行
          审批 ✅     → 展示任务列表 → 用户确认 → 执行
          逐步 👣     → 每组开始前确认
          预览 👀     → 只看计划不执行
                  │
                  ▼
        执行中动态调整（suggestion）：
          YOLO → Agent→PM 自动协商 → task:update
          审批 → UI 暂停 → 用户采纳/拒绝 → 恢复
                  │
                  ▼
        任务完成 → 汇总 Mission → PM 验收总结
```

### 消息流

```
每条消息带 _sender: { label, id }   ← Phase 3
推理过程实时显示为紫色气泡           ← Phase 6
Agent 可在执行中提建议               ← Phase 5
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

# 打包为 Windows 便携版 exe
npm run electron:build
```

## 构建

使用 `build.bat` 一键构建：

```bash
# 双击运行，或：
build.bat
```

构建产物：

```
release/
└── AgentRouter-0.1.0/
    └── win-unpacked/
        └── AgentRouter.exe    ← 直接双击运行
```

> **注意**：构建使用 `--dir` 模式（unpacked），不下载任何依赖工具，不需要管理员权限。
> 如需打包为单一便携 exe 文件，可运行 `npx electron-builder --win portable`（需要下载工具包，中国大陆地区下载较慢）。

### 构建 CLI Agent

```bash
# CodeWhale (Rust, 需要 Rust 1.88+)
cd agents/codewhale
cargo build --release -p codewhale-cli -p codewhale-tui

# Reasonix (Node.js)
cd agents/reasonix
npm run build

# Deep Code CLI (Node.js)
cd agents/deepcode
npm install
npm run build

# OpenCode (Go, 需要 Go 1.24+)
cd agents/opencode
go build -o ar-opencode.exe .

# 或一键构建所有 Agent：
build.bat
```

---

## 数据存储

`~/.agentrouter/agentrouter.db` — SQLite 数据库 (sql.js WASM 引擎)，包含 `projects`、`sessions`、`messages`、`tasks`、`agent_logs`、`memories` 表。

`~/.agentrouter/credentials.json` — 统一凭证文件（API Key / Base URL），所有 Agent 共享。

Agent 执行日志输出到 `~/.agentrouter/projects/<id>/sessions/<id>/events/`（JSON Lines 格式）

Agent 记忆存储在同目录的 `memories` 表中，按项目+Agent 名索引。

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
| Deep Code CLI | https://github.com/lessweb/deepcode-cli | MIT | v0.1.27 |
| OpenCode | https://github.com/opencode-ai/opencode | Apache-2.0 | latest |

各项目的完整许可证文本见对应 `agents/{project}/LICENSE` 文件。改动记录见各项目目录下的 `FORK.md`。
