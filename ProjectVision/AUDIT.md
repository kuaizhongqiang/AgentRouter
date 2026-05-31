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

### 更新：2026-05-31 13:25 — agent 补充 PHASE3.md 后

| 特性 | ProjectVision 定义 | docs/ 覆盖（更新后） | 差距 | 对应阶段 |
|---|---|---|---|---|
| `_sender` metadata | PROTOCOL.md | ✅ PHASE3.md 已详细规划（协议+数据流+接口+改动） | 代码待实现 | Phase 3 |
| 标签系统 | ARCHITECTURE.md | ✅ PHASE3.md 已详细规划（含 Reasonix/CodeWhale 真实值） | 代码待实现 | Phase 3 |
| Agent 接入规范 | — | ✅ **新增** PHASE3.md 含三步流程 + 适配器模板 | 文档已齐，代码待接入 | Phase 3 |
| 上下文传递 | PROTOCOL.md | ✅ PHASE3.md 已详细规划（scope/deltas + 三种读取模式） | 代码待实现 | Phase 4 |
| Token 经济核算 | ARCHITECTURE.md | ✅ **新增** PHASE3.md 含经济账示例（省 64%） | 文档已齐 | Phase 4 |
| 文件冲突检测 | ARCHITECTURE.md | ✅ **新增** PHASE3.md 含检测算法 + 解决策略 | 代码待实现 | Phase 4 |
| parallel_groups 调度 | ARCHITECTURE.md | ✅ PHASE3.md 已规划（信号量 + 分组 + 冲突降级） | 代码待实现 | Phase 4 |
| 四种执行模式 | SCENARIO.md | ✅ PHASE3.md 已规划（YOLO/审批/逐步/预览各有行为描述） | 代码待实现 | Phase 4 |
| 动态调整（suggestion） | ARCHITECTURE + PROTOCOL | ✅ PHASE3.md 已详细规划（协议+PM生命周期+决策矩阵） | 代码待实现 | Phase 5 |
| PM 生命周期管理 | ARCHITECTURE.md | ✅ **新增** PHASE3.md 含 PMState 接口 + 进程追踪 + 唤醒逻辑 | 代码待实现 | Phase 5 |
| 回收包模型 | ARCHITECTURE.md | ✅ PHASE3.md completion 事件携带 `_context.deltas` | 代码待实现 | Phase 5 |
| 子 Agent 模式 | ARCHITECTURE.md | ⚠️ 已规划但仅限 Reasonix 标签声明 | Phase 6 |
| 记忆系统 | ARCHITECTURE.md | ⚠️ Phase 6 已规划（memories 表 + IPC + 注入） | Phase 6 |
| MCP 集成 | PROTOCOL.md（预留） | ⚠️ Phase 6 已规划（MCP Server + read_file/write_file） | Phase 6 |

**关键变化**：此前标记为"完全缺失"的 5 项（Agent 接入规范、文件冲突检测、Token 经济核算、PM 生命周期管理、回收包模型）已全部补充。

---

## 五、更新结论

### 已对齐（✅）

- **Phase 1-2 实现**：平台路由、PM 拆解、审批/汇总、双 Agent 适配器
- **Phase 3-6 规划**：agent 已按 ProjectVision 体系完整重写 PHASE3.md
  - 每阶段含：协议定义 → 数据流 → 代码接口 → 文件改动 → 验收标准
  - 缺失项全部补充（接入规范、冲突检测、Token 核算、PM 生命周期、回收包）
  - Manifest 给出了 Reasonix 和 CodeWhale 的真实声明值

### 剩余差距

| 维度 | 状态 | 说明 |
|---|---|---|
| **文档对齐度** | 95% | PHASE3.md 完整覆盖 ProjectVision 全部概念 |
| **代码实现度** | ~30% | Phase 1-2 已落地，Phase 3-6 尚在文档阶段 |
| **AGENTS.md 空模板** | ❌ 未修复 | 仍需填充 |
| **FORK.md** | ❌ 未创建 | agents/ 目录下仍缺失 |

### 从"文档断层"到"实现断层"

首次审计（DOCUMENTATION_AUDIT.md）的核心发现是**文档与代码的 90% 断层**。

当前情况已逆转：文档已完整对齐 ProjectVision，断层转移到了 **文档与代码之间**——
Phase 3-6 在 PHASE3.md 中规划详尽，但代码尚未开始落地。

这是正常的项目推进节奏：**先对齐文档，再推进代码**。

---

## 六、建议优先级（更新）

| 优先级 | 事项 | 当前状态 |
|---|---|---|
| **P0** | `_sender` metadata 落地 | 文档已齐 → 需开始编码 |
| **P0** | Agent 标签系统注册 | 文档已齐 → 需开始编码 |
| **P1** | 上下文传递（scope + deltas） | 文档已齐 → 需开始编码 |
| **P1** | 四种执行模式 UI | 文档已齐 → 需开始编码 |
| **P2** | parallel_groups 智能调度 | 文档已齐 → 需开始编码 |
| **P2** | 动态调整（suggestion + PM 生命周期） | 文档已齐 → 需开始编码 |
| **P3** | 推理气泡 + MCP + 记忆 + 回放 | 文档已齐 → 需开始编码 |
| **P4** | AGENTS.md 填充 + FORK.md 创建 | 长期待修复 |

**核心建议**：文档体系已完整对齐。下一步的核心是**编码落地**，从 Phase 3 开始按优先级推进。

---

## 七、附录：审计方法

本次审计以 ProjectVision 五份文档为基准标准，逐一对照 docs/ 各文档的内容覆盖。

ProjectVision 文档：
- `CONCEPT.md` — 核心定义：定位、概念模型、核心机制
- `PERSONA.md` — 用户画像：深度用户、初学者、小团队
- `SCENARIO.md` — 场景推演：全链路 9 步 + 动态调整
- `ARCHITECTURE.md` — 系统架构：6 维度协同 + 标签 + 执行 + 预算
- `PROTOCOL.md` — 通信协议：metadata + 事件 + 上下文 + 动态调整
