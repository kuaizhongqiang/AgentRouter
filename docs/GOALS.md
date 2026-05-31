# AgentRouter — 目标定义

> 本文档定义项目的核心目标与愿景。其他细节（架构、技术选型、实现阶段）后续逐步确定。

---

## 一句话定位

> **一个桌面平台，把多个独立的 coding CLI Agent 整合到一起，让它们协同完成同一个项目。**

---

## 核心问题

当前开发流程中，不同的 coding CLI（如 Reasonix、CodeWhale）各自独立运行，互不联通。开发者需要在不同终端窗口间切换，手动搬运上下文和结果。

**AgentRouter 要解决的是**：提供一个统一的桌面环境，像"调度中心"一样管理多个 Agent。

---

## 核心目标 (Goals)

### G1: 统一调度多 Agent
平台能够**注册、选择、调用**多个不同的 coding CLI Agent。当前先集成两个：

- **CodeWhale** (Rust CLI)
- **Reasonix** (Node.js TS CLI)

未来可扩展更多。

### G2: 平台模拟人调用 CLI
平台不侵入 CLI 内部逻辑。它像一个人一样：

- 向 CLI 下发任务（命令）
- 接收 CLI 的输出（结果）
- 处理 CLI 的中间状态（进度、错误）

### G3: Agent 之间可协同
一个 Agent 的产出可以作为另一个 Agent 的输入。比如：

- CodeWhale 写完代码 → Reasonix 做 code review
- Reasonix 分析完需求 → CodeWhale 实现

### G4: 项目级上下文管理
平台以"项目"为单位管理所有 Agent 的对话、任务、产物，提供持久化存储（当前基于 SQLite）。

---

## 非目标 (Non-Goals)

- ❌ 不是 IDE — 不代替 VS Code / WebStorm 等编辑器
- ❌ 不是新的 CLI Agent — 不重复造轮子，而是做"Agent 的调度器"
- ❌ 不做 Agent 内部的能力增强 — Agent 本身的能力由各自上游项目决定

---

## 当前状态 → 目标状态

| 维度 | 当前（Phase 2 完成） | 目标 |
|---|---|---|
| Agent 数量 | CodeWhale + Reasonix 双 Agent（适配器注册表） | 多 Agent 可扩展 |
| Agent 能力声明 | 无 | 标签系统：`best_for` / `not_for` / `max_instances` |
| 消息身份 | 无 `_sender` metadata | 每条消息带发送者身份标识 |
| 调度 | 顺序执行 + 基础 AgentManager | 标签驱动 + parallel_groups + 上下文传递 |
| 协同 | PM 拆解 → 审批 → 执行 → 汇总 | + 执行中动态调整（suggestion 机制） |
| 数据持久化 | SQLite sql.js + 项目/会话/消息/任务表 | + 记忆系统 |
| 前端 | App.vue 三栏面板 + 模式/Agent 选择器 | 组件化 + 执行模式 UI（YOLO/审批/逐步/预览） |
| 类型安全 | TypeScript（全部 electron/ 已迁移） | 同左 |
| 协议规范 | 基本事件流（task:start/progress/completion） | 全量协议（含 suggestion/task:update 等） |

---

## 后续步骤

1. ✅ 目标已确定（同步 ProjectVision 体系）
2. ✅ 架构设计（ProjectVision/ 含 5 份完整概念文档）
3. ✅ 分阶段实施计划（PHASE1.md + PHASE2.md + 重写 PHASE3.md）
4. ✅ Phase 1 已完成（后端 TypeScript/IPC 拆分/适配器框架/双 CLI 改造）
5. ✅ Phase 2 已完成（Mission 驱动协同 + 多 Agent 执行 + 审批汇总）
6. ⬜ Phase 3 — 协议基础 + 标签注册
7. ⬜ Phase 4 — 调度智能（parallel_groups + 上下文传递 + 4 种模式）
8. ⬜ Phase 5 — 动态调整（suggestion + PM 生命周期 + task 动态增删改）
9. ⬜ Phase 6 — 高级协议（推理气泡 + MCP + 记忆 + 回放）
