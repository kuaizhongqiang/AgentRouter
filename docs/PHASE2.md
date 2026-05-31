# AgentRouter — 第二期范围

> **文档状态**: 已归档 🗄️ — Phase 2 已于 2026-05-31 完成。后续规划请参考 [PHASE3.md](PHASE3.md)（基于 ProjectVision 重编）。
> 完整愿景详见 [ProjectVision/](../ProjectVision/)。

> 第二期目标：实现 Mission 驱动的多 Agent 协同闭环。用户与 PM 对话产出 Mission，PM 拆解为 Task 后多 Agent 并行执行，全程用户可审批和干预。

---

## 架构概览

```
用户 ↔ PM(Reasonix) ←→ Mission（需求规格书，存储在 type='mission' 的 session 中）
                               │
                               ├── Task 1 (assignee: codewhale)
                               ├── Task 2 (assignee: codewhale)
                               └── Task 3 (assignee: reasonix)
                               │
                ┌── [可选审批] ──┐
                [用户审批]  [审批Agent]
                               │
                          [并行执行]
                               │
                       [PM 验收汇总]
```

**三个核心概念**：
- **Mission** = PM 拆解模式下的 session（`sessions.type = 'mission'`），记录完整的需求规格
- **Task** = PM 产出的结构化执行单元（扩展 `tasks` 表），每个 Task 有 assignee、description、状态
- **对话驱动**：PM 在对话中产出任务 → 前端自动解析 → DB 写入 → 右面板展示

---

## 完整流程

### Step 1: 对话规划

用户选择 "PM 拆解" 模式、选择 Reasonix 作为 Agent，输入需求。

PM 与用户对话澄清需求 → 输出 Mission 描述（写在普通对话消息中）。

### Step 2: 任务拆解

PM 的回复末尾附带结构化任务块。前端自动解析。

结构化格式（约束到 PM prompt 中）：

```json
{
  "tasks": [
    {
      "title": "修改入口文件",
      "assignee": "codewhale",
      "description": "在 main.ts 中注册新路由"
    },
    {
      "title": "审查代码规范",
      "assignee": "reasonix",
      "description": "review 上一步的改动是否符合架构要求"
    }
  ]
}
```

解析后的任务写入 `tasks` 表，右面板即时刷新显示。

用户可继续与 PM 对话调整 Plan，任务列表会动态更新。

### Step 3: 审批（可选）

Plan 确定后：

- **默认**：用户在 UI 点击「审批 Plan」按钮 → 放行
- **扩展**：可指定审批 Agent（如 Reasonix 自己 review）审 Plan
- 审批通过后，任务状态批量从 `pending` → `approved`

### Step 4: 并行执行

审批通过后，所有任务自动按 assignee 分配，**并行**调用 `agent:exec` 执行。

每个 Task 的执行日志：
- 流式输出 → 右面板任务展开区域实时显示
- 写入 `events/` 目录下的 `.jsonl` 文件
- 执行完成后状态自动更新（`running` → `completed` / `failed`）

**并发支持**：AgentManager 已使用 Map 管理多进程，多个 `agent:exec` 不会冲突。

### Step 5: 汇总验收

所有任务完成后，用户可点击「汇总 Mission」。

系统自动将已完成任务的上下文（标题、结果摘要）发给 PM，PM 输出汇总报告 → Mission Complete。

---

## 修改清单

### 1. 数据库 Migration V3

**文件**: `electron/database/migrations.ts`

`sessions` 表变更：
- 新增 `type` TEXT, DEFAULT `'chat'`, CHECK (`'chat'` | `'mission'`)

`tasks` 表变更：
- 新增 `assignee` TEXT, DEFAULT `''`
- 新增 `description` TEXT, DEFAULT `''`
- 新增 `sort_order` INTEGER, DEFAULT `0`

### 2. IPC 新增通道

**文件**: `electron/ipc/tasks.ts` + `electron/preload.ts`

| 通道 | 功能 |
|---|---|
| `db:batchAddTasks` | 批量创建任务（解析 PM 输出后调用） |
| `db:updateTask` | 更新单个任务（assignee / status / description） |
| `db:approvePlan` | 标记 session 的 plan 已审批 |

### 3. 后端解析逻辑

**文件**: `electron/ipc/agents.ts`（或 `electron/agents/task-parser.ts`）

- mode === 'PM 拆解' 时，监听 `completion` 事件
- 解析 Agent 回复中的结构化任务块（JSON 优先，Markdown 列表 fallback）
- 解析后调用 `db:batchAddTasks`

### 4. 前端改造

**文件**: `src/App.vue`（或拆分组件）

Mission 模式：
- 创建 session 时 type='mission'，标题自动命名
- PM 回复后触发任务解析
- 展示「审批 Plan」和「汇总 Mission」按钮

任务面板增强：
- 每个任务可展开/收起
- 展开区域显示 description + 实时执行日志
- 状态：pending → approved → running → completed / failed
- 并行执行时多个日志流互不干扰

### 5. 组件抽取（可选推荐）

| 新文件 | 内容 |
|---|---|
| `src/components/TaskPanel.vue` | 右侧任务面板 |
| `src/components/TaskItem.vue` | 单个任务卡片（含展开详情） |
| `src/components/MissionToolbar.vue` | 审批/汇总按钮组 |

---

## 实现步骤

| # | 步骤 | 主要文件 | 估算 |
|---|---|---|---|
| 1 | Migration V3: 字段扩展 | `migrations.ts`, `repository.ts` | +50 行 |
| 2 | IPC 新通道 | `ipc/tasks.ts`, `preload.ts` | +40 行 |
| 3 | 输出解析器 | `agents/task-parser.ts` 或 `ipc/agents.ts` | +60 行 |
| 4 | 前端 Mission 模式 + 审批/汇总按钮 | `App.vue` | +100 行 |
| 5 | 任务展开 + 执行日志流 | `App.vue` | +80 行 |
| 6 | 组件抽取（可选） | `src/components/*.vue` | +150/-150 行 |

总计约 **330–480 行净增**。

---

## 边界情况

| 场景 | 处理方式 |
|---|---|
| PM 回复没有任务块 | 不走任务创建，走普通对话 |
| 任务执行过程中用户切换 session | 执行继续，切换回来时日志保留 |
| 并发执行多任务 | AgentManager 已支持，输出按 taskId 路由 |
| 审批前修改 Plan | 用户可继续对话，任务列表动态更新 |
| Mission 对应的 session 被删除 | 级联删除 tasks（已有 ON DELETE CASCADE） |

---

## 第二期不做

| 事项 | 原因 |
|---|---|
| 任务依赖图 DAG 可视化 | 后续增强，当前用 sort_order 表示顺序 |
| 长期记忆系统 | 第三期 |
| Session 回放 | 第三期 |
| 审批 Agent 实现 | 当前用用户审批，架构预留扩展点 |
| 端到端测试 | 当前无测试框架，后续补 |
