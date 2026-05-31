# ProjectVision 审计报告

> **审计视角**：ProjectVision 愿景体系 vs docs/ 实现文档
> **审计日期**：2026-05-31
> **审计范围**：`docs/` 全部 12 份文档
> **参考愿景**：`ProjectVision/`（CONCEPT / ARCHITECTURE / PROTOCOL / SCENARIO / PERSONA）

---

## 一、概述

### ProjectVision 定义的愿景核心

```
定位：多开源 CLI 编程助手调度器
核心机制：
  1. Metadata 身份标识 — 每条消息带 _sender
  2. 标签系统 — Agent 能力说明书（best_for / max_instances）
  3. 协同模型 — 6 个维度（分解/指派/回收/质量/协同/动态调整）
  4. 上下文传递 — scope + baseline + deltas，增量省 Token
  5. 执行模型 — sub-agent / multi-process / single 三种模式
  6. 动态调整 — suggestion → PM 评估 → task:update/add/cancel
```

### docs/ 当前状态

coding agent 已完成大部分对齐工作。核心文档均引用了 ProjectVision 作为完整规范：

| docs/ 文档 | 状态 | 对齐情况 |
|---|---|---|
| `GOALS.md` | ✅ 已同步 | 目标表已更新至 Phase 6 |
| `ARCHITECTURE.md` | ✅ 已归档 | 标注为"被 ProjectVision/ARCHITECTURE.md 取代" |
| `PROTOCOL.md` | ✅ 已对齐 | 标注为"Phase 1-2 实现子集"，含差距表 |
| `SCENARIO.md` | ✅ 已标注 | 含功能状态表，每项标注阶段和实现状态 |
| `PHASE1.md` | ✅ 已完成 | Phase 1 已落地 |
| `PHASE2.md` | ✅ 已完成 | Phase 2 已落地 |
| `PHASE3.md` | ⚠️ 已更新 | 基于 ProjectVision 重写 |
| `CLI_MODIFICATION.md` | ✅ 已落地 | CodeWhale + Reasonix CLI 改造完成 |
| `FORK_MANAGEMENT.md` | ⚠️ 部分落地 | FORK.md 文件待创建 |
| `OUTPUT_MANAGEMENT.md` | ⚠️ 部分落地 | agent_logs 表待实现 |
| `AGENT_ADAPTATION_GUIDE.md` | ✅ 已更新 | |
| `DOCUMENTATION_AUDIT.md` | 历史归档 | 本文不对其评分，专注愿景对齐 |

---

## 二、逐项审计：docs/ 是否符合 ProjectVision 愿景

### 2.1 Metadata 身份标识（`_sender`）

| 标准 | docs/ 实现 | 差距 |
|---|---|---|
| 每条消息带 `_sender: {label, id}` | ❌ 未实现 | 差距在 Phase 3（已规划） |
| 消息头可扩展 `context` / `execution` | ❌ 未实现 | 差距在 Phase 3 |
| 消息溯源能力 | ❌ 无 | 靠日志间接实现 |

**结论**：`_sender` 机制是协议基础设施，docs/PROTOCOL.md 已标注为未实现。合理——属于 Phase 3。

### 2.2 标签系统

| 标准 | docs/ 实现 | 差距 |
|---|---|---|
| Agent 注册声明（best_for / not_for） | ❌ 无 | 未在任何 docs/ 中定义 |
| 执行模型声明（parallel_mode / max_instances） | ❌ 无 | 未在任何 docs/ 中定义 |
| 上下文预算声明（context_budget） | ❌ 无 | 未在任何 docs/ 中定义 |
| Agent 接入规范 | ❌ 无 | 未在任何 docs/ 中定义 |

**结论**：标签系统在 docs/ 中完全空白。GOALS.md 的"当前状态→目标状态"表已将"Agent 能力声明"列为待实现。属于 Phase 3-4。

### 2.3 协同模型（6 维度）

| 维度 | docs/ 覆盖 | 说明 |
|---|---|---|
| 任务分解 | ✅ PHASE2.md | Mission → Task 模型已落地 |
| Agent 指派 | ⚠️ 部分 | 有 assignee 字段，无标签驱动 |
| 任务回收 | ❌ 无 | 无回收包概念 |
| PM 拆解质量 | ⚠️ 部分 | PHASE2 有知情拆解，无审查清单 |
| 多 Agent 协同 | ✅ PHASE2.md | 并行执行已实现 |
| 动态调整 | ❌ 无 | 不在任何 Phase 文档中 |

**结论**：Phase 1-2 覆盖了基础协同（拆解+执行），高阶协同（标签驱动+回收+动态调整）属于 Phase 3-5。

### 2.4 上下文传递

| 标准 | docs/ 实现 | 差距 |
|---|---|---|
| scope（文件范围限制） | ❌ 无 | 未在任何 docs/ 中定义 |
| baseline（基准版本） | ❌ 无 | 未在任何 docs/ 中定义 |
| deltas（增量变更） | ❌ 无 | 未在任何 docs/ 中定义 |
| 三种读取模式（全量/增量/差异） | ❌ 无 | 未在任何 docs/ 中定义 |

**结论**：上下文传递是 docs/ 的完全空白。属于 Phase 4。

### 2.5 执行模型

| 标准 | docs/ 实现 | 差距 |
|---|---|---|
| multi-process 并行 | ✅ PHASE2.md | AgentManager 支持多进程 |
| sub-agent 模式 | ❌ 无 | Reasonix 内部未实现 |
| 资源限制（max_instances） | ❌ 无 | 无此概念 |
| 文件冲突处理 | ❌ 无 | 无此机制 |

**结论**：进程级并行已实现，子 Agent 和资源管理属于未来阶段。

### 2.6 动态调整

| 标准 | docs/ 实现 | 差距 |
|---|---|---|
| suggestion 事件 | ❌ 无 | 未在任何 docs/ 中定义 |
| task:update/add/cancel 事件 | ❌ 无 | 未在任何 docs/ 中定义 |
| PM 生命周期管理 | ❌ 无 | 未在任何 docs/ 中定义 |
| 调整时序判断 | ❌ 无 | 未在任何 docs/ 中定义 |

**结论**：动态调整在 docs/ 中完全空白。属于 Phase 5。

---

## 三、蒸馏：原有审计的核心发现（DOCUMENTATION_AUDIT.md）

原有审计报告发现的核心问题（截至 Phase 1 前）：

| 问题 | 当前状态（Phase 2 完成后） |
|---|---|
| 文档-代码断层 90% | ✅ 已大幅缩小。Phase 1-2 落地了 PM 拆解、任务执行、审批汇总 |
| AGENTS.md 空模板 | ❌ 仍为空 |
| FORK.md 不存在 | ❌ 仍不存在 |
| 单 Agent 硬编码 | ✅ 已修复，双 Agent 适配器 |
| IPC 集中无错误边界 | ✅ 已修复，IPC 拆分 |
| 数据库外键约束 | ✅ 已修复，PRAGMA foreign_keys |
| UI 中 Agent 选择缺失 | ✅ 已修复，有 Agent 选择器 |
| 任务系统与执行流脱节 | ✅ 已修复，PM 产出自动解析为任务 |

**核心进步**：基础架构问题已修，现在是"有功能但不够智能"的阶段。

---

## 四、ProjectVision 视角的差距总表

| 特性 | ProjectVision 定义 | docs/ 覆盖 | 差距 | 对应阶段 |
|---|---|---|---|---|
| `_sender` metadata | PROTOCOL.md | ❌ 无 | 协议基础设施缺失 | Phase 3 |
| 标签系统 | ARCHITECTURE.md | ❌ 无 | Agent 能力无声明 | Phase 3 |
| 上下文传递 | PROTOCOL.md | ❌ 无 | Token 消耗无优化 | Phase 4 |
| parallel_groups 调度 | ARCHITECTURE.md | ⚠️ 基础 | 已拆任务，未按组调度 | Phase 4 |
| 动态调整 | ARCHITECTURE.md + PROTOCOL.md | ❌ 无 | 任务不可变 | Phase 5 |
| 子 Agent 模式 | ARCHITECTURE.md | ❌ 无 | Reasonix 内部未利用 | Phase 6 |
| 记忆系统 | ARCHITECTURE.md | ❌ 无 | 无跨会话记忆 | Phase 6 |
| MCP 集成 | PROTOCOL.md（预留） | ❌ 无 | 工具调用受限 | Phase 6 |

---

## 五、结论

### 已对齐（✅）

Phase 1-2 的功能在 docs/ 中已完整覆盖并与 ProjectVision 一致：
- 平台路由架构
- PM 拆解任务（Mission → Task）
- 审批/汇总验收
- 双 Agent 适配器
- 事件流协议（基础子集）

### 未对齐但已规划（⚠️）

以下特性在 ProjectVision 中定义，docs/ PHASE3.md 已规划但未实现：
- `_sender` metadata → Phase 3
- 标签系统 → Phase 3
- 上下文传递 → Phase 4
- parallel_groups 智能调度 → Phase 4
- 四种执行模式 → Phase 4
- 动态调整 → Phase 5

### 完全缺失（❌）

以下特性在 ProjectVision 中定义，但 docs/ 任何文档均未提及：
- Agent 接入规范（标签声明模板）
- 文件冲突检测机制
- Token 经济核算
- PM 生命周期管理
- 回收包模型

**建议**：在 PHASE3.md 或新增 PHASE4.md 中补充这些缺失项。

---

## 六、建议优先级

| 优先级 | 事项 | 理由 |
|---|---|---|
| **P0** | `_sender` metadata 落地 | 所有高阶协议的基础，没有它后面都做不了 |
| **P0** | Agent 标签系统注册 | 调度智能化的第一步 |
| **P1** | 上下文传递（scope + deltas） | Token 成本直接影响用户体验 |
| **P1** | 四种执行模式（YOLO/审批/逐步/预览） | 用户感知最强的功能 |
| **P2** | parallel_groups 智能调度 | 性能优化 |
| **P2** | 动态调整（suggestion 机制） | 差异化竞争力 |
| **P3** | 记忆系统 + MCP 集成 | 高阶体验 |

---

## 七、附录：审计方法

本次审计以 ProjectVision 五份文档为基准标准，逐一对照 docs/ 各文档的内容覆盖。

ProjectVision 文档：
- `CONCEPT.md` — 核心定义：定位、概念模型、核心机制
- `PERSONA.md` — 用户画像：深度用户、初学者、小团队
- `SCENARIO.md` — 场景推演：全链路 9 步 + 动态调整
- `ARCHITECTURE.md` — 系统架构：6 维度协同 + 标签 + 执行 + 预算
- `PROTOCOL.md` — 通信协议：metadata + 事件 + 上下文 + 动态调整
