# AgentRouter — 第三期及后续规划

> 本规划基于 [ProjectVision](../ProjectVision/) 愿景文档体系重新编排。
> 原有 PHASE3.md（推理气泡/记忆/回放/MCP）已合并入对应阶段。

---

## 概述

Phase 1-2 完成了平台底座跑通。Phase 3-6 的目标是将 AgentRouter 从"能用的 MVP"演进为"产品级的调度中心"，完全对齐 ProjectVision 定义的概念模型。

```
ProjectVision 定义                          代码实现过程
╔══════════════════════════╗         ┌──────────────────────────┐
║  CONCEPT.md              ║         │ Phase 3: 协议基础 + 标签   │
║  概念模型 + 核心机制      ║  ──→   │ Phase 4: 调度智能          │
║  ARCHITECTURE.md         ║         │ Phase 5: 动态调整          │
║  架构设计 + 协同模型      ║  ──→   │ Phase 6: 高级协议           │
║  PROTOCOL.md             ║         └──────────────────────────┘
║  通信协议 + Metadata      ║  ──→   (按阶段逐步对 Protocol 落地)
║  SCENARIO.md             ║
║  全流程场景推演           ║  ──→   终极目标：跑通 Step 1-9 完整链路
╚══════════════════════════╝
```

---

## Phase 3：协议基础 + Agent 标签注册

> **目标**：建立通信协议的基础设施，让每条消息有身份，每个 Agent 有标签。

### 3.1 `_sender` Metadata 注入

**现状**：当前平台事件没有 `_sender` 字段。AgentManager 转发事件时知道 agentName，但未包装为标准化 metadata。

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/agents/adapter.ts` | `AgentEvent` 接口增加 `_sender?: {...}` 字段 |
| `electron/agents/manager.ts` | stdout 事件解析后注入 `_sender: { label, id }` |
| `electron/agents/reasonix.ts` | 适配器提供身份声明 |
| `electron/agents/codewhale.ts` | 适配器提供身份声明 |
| `docs/PROTOCOL.md` | 更新当前实现匹配 ProjectVision 协议 |


### 3.2 Agent 标签注册系统

**需求**：每个 Agent 接入时声明 `best_for`、`not_for`、`execution_model`、`context_budget`。

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/agents/adapter.ts` | 新增 `manifest?: AgentManifest` 接口 |
| `electron/agents/manager.ts` | `list()` 返回 manifest 信息 |
| `electron/agents/codewhale.ts` | 实现 `manifest`（参照 ProjectVision/ARCHITECTURE.md） |
| `electron/agents/reasonix.ts` | 实现 `manifest`（参照 ProjectVision/ARCHITECTURE.md） |
| `electron/ipc/agents.ts` | 新增 `agent:manifest` IPC 通道 |
| `electron/preload.ts` | 暴露 `agent.getManifest()` |
| `src/App.vue` | Agent 选择器下拉增加标签辅助信息 |

### 3.3 协议文档更新

**改动范围**：

| 文件 | 改动 |
|---|---|
| `docs/PROTOCOL.md` | 用实际代码实现覆盖 ProjectVision 协议定义，标注已实现和待实现 |

---

## Phase 4：调度智能

> **目标**：让调度器真正"智能"起来——按标签匹配、并行度控制、上下文传递。

### 4.1 标签驱动调度

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/agents/manager.ts` | `exec()` 增加标签匹配检查 |
| `src/App.vue` | 模式选择器与标签系统联动 |
| 新增 `electron/scheduler/` | 调度器模块剥离独立逻辑 |

### 4.2 并行执行引擎

**现状**：`executeAllTasks()` 串行循环执行任务。parallel_group 信息由 PM 产出但未被利用。

**改动范围**：

| 文件 | 改动 |
|---|---|
| `src/App.vue` | `executeAllTasks()` 改为按 parallel_groups 分批，组内并行，组间串行 |
| `electron/agents/manager.ts` | 支持 `max_instances` 并发上限 |
| 新增 `electron/scheduler/executor.ts` | 并行执行引擎（信号量控制并发数） |

### 4.3 上下文传递

**需求**：任务执行的 context（scope、deltas）从 PM 产出 → 注入到下游 Agent。

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/agents/task-parser.ts` | 解析 PM 产出的 context 信息 |
| `electron/ipc/agents.ts` | completion 事件回收 deltas |
| `electron/agents/adapter.ts` | spawnExec 增加 context 参数 |
| `electron/agents/reasonix.ts` | 通过 `--context` 或环境变量注入 scope + deltas |

### 4.4 执行模式 UI

| 模式 | 行为 | 实现状态 |
|---|---|---|
| **YOLO** 🚀 | 全自动，审批跳过 | ⬜ 待实现 |
| **审批** ✅ | 任务列表 → 用户确认 → 执行 | ✅ 已有（审批 Plan） |
| **逐步** 👣 | 每组执行前询问 | ⬜ 待实现 |
| **预览** 👀 | 只看计划不执行 | ⬜ 待实现 |

### 4.5 文件冲突检测

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/scheduler/executor.ts` | 检查同一组内任务的 scope 文件是否有交集 |
| `src/App.vue` | 冲突时显示警告，自动降级为串行 |

---

## Phase 5：动态调整

> **目标**：Agent 执行中可向 PM 提建议，PM 动态增删改任务。**这是 ProjectVision 中最具差异化的能力。**

### 5.1 Suggestion 协议

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/agents/adapter.ts` | AgentEvent 增加 `suggestion` 事件类型 |
| `electron/agents/manager.ts` | stdout 解析 `suggestion` 事件，注入 `_sender` |
| `electron/ipc/agents.ts` | `suggestion` 事件处理：转发给 PM 或缓存 |
| `src/App.vue` | 前端 suggestion 指示（"Agent 正在提建议..."） |

### 5.2 PM 生命周期管理

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/ipc/agents.ts` | 收到 suggestion 时检查 PM 进程存活 |
| `electron/agents/manager.ts` | 查询 PM 进程状态 + 重新 spawn PM（注入当前上下文） |
| 新增 `electron/scheduler/pm-lifecycle.ts` | PM 状态追踪 + 上下文快照 |

### 5.3 任务动态调整

**改动范围**：

| 文件 | 改动 |
|---|---|
| `electron/ipc/agents.ts` | `task:update` / `task:add` / `task:cancel` 事件处理 |
| `electron/ipc/tasks.ts` | 新增 IPC 通道 `db:updateTaskDescription` |
| `src/App.vue` | 任务面板支持动态更新（修改描述 / 新增卡片 / 取消标记） |

---

## Phase 6：高级协议 + 生态

> **目标**：MCP 工具注入、子 Agent 调度、记忆系统、推理气泡。

### 6.1 推理气泡 (原 Phase 3 R1)

**说明**：让用户实时看到 Agent 的推理过程，解决输出断断续续问题。

| 文件 | 改动 |
|---|---|
| `agents/reasonix/src/cli/platform-output.ts` | 转发 `reasoningDelta` 带 `channel: "reasoning"` 标记 |
| `electron/ipc/agents.ts` | 透传 reasoning channel |
| `src/App.vue` | 推理气泡组件（灰色/蓝色，逐 token 流式） |

### 6.2 MCP 工具注入 (原 Phase 3 R4)

**说明**：平台提供 MCP Server，向 Agent 注入文件读/写/搜索等工具，使 Reasonix 在 platform 模式下具备实际环境交互能力。

| 文件 | 改动 |
|---|---|
| 新增 `electron/mcp/server.ts` | MCP 服务器（暴露 read_file / write_file / search_code） |
| `electron/agents/reasonix.ts` | spawnExec 增加 `--mcp` 参数指向平台 MCP Server |
| `electron/main.ts` | 启动 MCP Server |

### 6.3 长期记忆系统 (原 Phase 3 R2)

**说明**：跨会话的项目级 Agent 记忆持久化。

| 文件 | 改动 |
|---|---|
| `electron/database/migrations.ts` | 新增 `memories` 表 |
| `electron/database/repository.ts` | `saveMemory` / `loadMemories` |
| `electron/ipc/tasks.ts` | IPC 通道 |
| `electron/preload.ts` | 暴露到渲染进程 |

### 6.4 Session 回放 (原 Phase 3 R3)

| 文件 | 改动 |
|---|---|
| `electron/ipc/agents.ts` | `agent:replay` 通道 |
| `src/App.vue` | 播放/暂停/速度/进度条 |

### 6.5 Tool Calling / Q&A / Sub-Agent（预留）

详见 `ProjectVision/PROTOCOL.md` "后续阶段"章节。当前不纳入时间表。

---

## 阶段全景

| 阶段 | 主题 | 核心交付 | 依赖 |
|---|---|---|---|
| **Phase 1** ✅ | 平台底座 | Electron + IPC + SQLite + 双 CLI 适配 | — |
| **Phase 2** ✅ | Mission 协同 | PM 拆解 + 审批 + 并行执行 + 汇总 | Phase 1 |
| **Phase 3** | 协议基础 | `_sender` metadata + 标签注册 + 协议文档 | Phase 1-2 |
| **Phase 4** | 调度智能 | parallel_groups 调度 + 上下文传递 + 4 种模式 | Phase 3 |
| **Phase 5** | 动态调整 | suggestion + PM 生命周期 + task 动态增删改 | Phase 3-4 |
| **Phase 6** | 高级协议 | 推理气泡 + MCP + 记忆 + 回放 | Phase 1-5 |

各阶段之间不是严格的串行关系。Phase 3 是其余所有阶段的基础设施。Phase 4-6 可根据资源情况适当合并或调整顺序。

---

## 参考

- [ProjectVision/CONCEPT.md](../ProjectVision/CONCEPT.md) — 核心概念
- [ProjectVision/ARCHITECTURE.md](../ProjectVision/ARCHITECTURE.md) — 架构设计
- [ProjectVision/PROTOCOL.md](../ProjectVision/PROTOCOL.md) — 通信协议
- [ProjectVision/SCENARIO.md](../ProjectVision/SCENARIO.md) — 场景推演
- [ProjectVision/PERSONA.md](../ProjectVision/PERSONA.md) — 用户画像
