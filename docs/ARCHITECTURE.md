# AgentRouter — 架构决策记录

> **文档状态**: 已由 [ProjectVision/ARCHITECTURE.md](../ProjectVision/ARCHITECTURE.md) 取代 ✅
> 本文档保留作为 Phase 1-2 的选型记录。后续架构设计以 ProjectVision 为准。

---

## 架构决策记录

| 决策 | 值 |
|---|---|
| 架构模式 | 平台路由 |
| 决策日期 | 2025-05-30 |
| 决策人 | AgentRouter team |

> **文档状态**: 已落地 ✅ — Phase 1 已验证平台路由模式、适配器框架、IPC 拆分

---

## 平台路由的职责

### 调用（Call）
- 用户选 PM → 记住偏好 → 启动 PM
- PM 返回任务列表 → 按并行组调度各 CLI
- 执行中模式（YOLO / 审批 / 逐步 / 预览）控制调度行为
- 任务完成 → 释放子进程 → 记录结果

### 维护（Maintain）
- 项目路径绑定
- 对话历史（消息、任务、产出）
- Agent 产出事件日志（写入 .jsonl）
- 执行状态跟踪（任务级：pending → running → completed）

### 平台不做的事
- ❌ 不代替 PM 拆解需求
- ❌ 不修改任务内容
- ❌ 不干涉 CLI 执行过程
- ❌ 不自己调用 MCP / 工具（那是 CLI 的事）

---

## 与 CLI 的边界

```
平台路由                 CLI（--mode platform）
─────────                ─────────────────────
只管理"谁"和"什么时候"   只负责"怎么做"
不读/不写项目文件         直接操作项目文件
不修改 CLI 输出           输出 NDJSON 事件流
```

CLI 的内部逻辑完全不动。CLI 不依赖平台，把平台当作一个自动化的"人"来交互。

---

## 后续演进

ProjectVision 定义了完整的架构：

| 维度 | ProjectVision 参考 |
|---|---|
| **协同模型**（6 维度） | `ProjectVision/ARCHITECTURE.md` — 任务分解/Agent 指派/任务回收/PM 质量/多 Agent 协同/动态调整 |
| **标签系统** | Agent 注册声明：`best_for` / `not_for` / `execution_model` / `context_budget` |
| **执行模型** | sub-agent / multi-process / single 三种并行模式 |
| **上下文预算** | 全量/增量/差异三种读取模式，Token 经济核算 |

---

## 相关文档

- `GOALS.md` — 项目目标
- `PHASE3.md` — 后续阶段规划（基于 ProjectVision）
- `SCENARIO.md` — 全流程场景推演
- [ProjectVision/](../ProjectVision/) — 完整愿景文档体系
