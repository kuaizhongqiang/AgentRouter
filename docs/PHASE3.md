# AgentRouter — 第三期及后续规划

> 本规划基于 [ProjectVision](../ProjectVision/) 愿景文档体系重新编排。
> 每阶段包含：协议定义 → 数据流 → 代码接口 → 文件改动。

---

## 概述

Phase 1-2 完成了平台底座跑通。Phase 3-6 的目标是将 AgentRouter 从"能用的 MVP"演进为"产品级的调度中心"。

```
ProjectVision 定义                          实现路径
╔══════════════════════════╗         ┌──────────────────────────────┐
║  CONCEPT.md              ║         │ Phase 3: `_sender` + 标签    │
║  概念模型 + 核心机制      ║  ──→   │ Phase 4: 调度智能             │
║  ARCHITECTURE.md         ║         │ Phase 5: 动态调整             │
║  架构设计 + 协同模型      ║  ──→   │ Phase 6: 高级协议              │
║  PROTOCOL.md             ║         └──────────────────────────────┘
║  通信协议 + Metadata      ║  ──→   各阶段产出对应协议增量
║  SCENARIO.md             ║
║  全流程场景推演           ║  ──→   最终目标：跑通 Step 1-9 完整链路
╚══════════════════════════╝
```

---

## Phase 3：协议基础 + Agent 标签注册

> **审计评价 P0**：`_sender` 是所有高阶协议的基础，标签系统是调度智能化的第一步。

### 3.1 `_sender` Metadata

#### 协议定义

每条平台转发的事件增加 `_sender` 字段，标识是谁产生的这条消息：

```json
{
  "_sender": {
    "label": "CodeWhale",
    "id": "codewhale-001"
  },
  "event": "progress",
  "data": { "message": "正在分析代码..." }
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `label` | string | 是 | 人可读的名称，如 `"Reasonix"`、`"CodeWhale"` |
| `id` | string | 是 | 实例标识，全局唯一，格式 `"{agent}-{seq}"` |
| `execution` | object | 否 | 执行模型标记（扩展用） |
| `context` | object | 否 | 上下文标记（Phase 4 扩展） |

#### 数据流

```
Agent 子进程 stdout → AgentManager 解析 NDJSON 行
  → 提取 event 内容 → 注入 _sender { label, id } → 转发到 IPC
    → electron/ipc/agents.ts → 携带 _sender 发送到渲染进程
      → App.vue 展示时根据 _sender.label 区分消息来源
```

#### 代码接口

```typescript
// electron/agents/adapter.ts
interface SenderMetadata {
  label: string;
  id: string;
  execution?: {
    instance_id: string;
    parallel_mode: 'sub-agent' | 'multi-process' | 'single';
  };
  context?: {
    scope: string[];
    baseline?: string;
    deltas: Array<{ file: string; type: string; diff?: string }>;
  };
}

// AgentEvent 增加 _sender
interface AgentEvent {
  ...existing,
  _sender?: SenderMetadata;
}
```

#### 改动清单

| 文件 | 改动 |
|---|---|
| `electron/agents/adapter.ts` | 新增 `SenderMetadata` 接口；`AgentEvent` 增加 `_sender?: SenderMetadata` |
| `electron/agents/manager.ts` | stdout 行解析后执行 `injectSender(event, agentName)` 注入 `{label, id}`。`id` 由 `"{agentName}-{seq}"` 生成，序列号递增 |
| `electron/agents/codewhale.ts` | 新增 `getSenderId(): string` 方法 |
| `electron/agents/reasonix.ts` | 新增 `getSenderId(): string` 方法 |
| `electron/ipc/agents.ts` | 转发事件时保留 `_sender` 不修改 |
| `docs/PROTOCOL.md` | 更新事件定义增加 `_sender` 字段 |

#### 验收标准

- 事件流中每条消息携带 `_sender`
- `_sender.id` 在 Agent 进程级别唯一
- UI 根据 `_sender.label` 显示消息来源徽章
- 向下兼容：无 `_sender` 的旧事件仍能正常处理

---

### 3.2 Agent 标签系统

#### 协议定义

每个适配器返回一份 Manifest，声明 Agent 的身份和能力：

```typescript
// electron/agents/adapter.ts
interface AgentManifest {
  identity: {
    id: string;          // 如 "ar-reasonix"
    label: string;       // 如 "Reasonix"
    version: string;     // 如 "0.52.0"
  };
  tagline: string;       // 一句话简介
  best_for: string[];    // 擅长领域
  not_for: string[];     // 不擅长领域
  execution_model: {
    parallel_mode: 'sub-agent' | 'multi-process' | 'single';
    max_instances: number;       // 最大并行实例数
  };
  context_budget: {
    preferred_read_mode: 'full' | 'incremental' | 'diff';
    context_window: string;      // 如 "128K"
  };
  capabilities?: {
    can_suggest: boolean;        // 是否能提建议
    suggestion_scope?: 'own_task' | 'related_tasks' | 'all';
  };
}
```

实际 Manifest 值（注册时硬编码在适配器中）：

**Reasonix**:

```typescript
{
  identity: { id: 'ar-reasonix', label: 'Reasonix', version: '0.52.0' },
  tagline: '长上下文推理专家，适合规划和审查',
  best_for: ['阅读分析大量代码', '需求拆解与规划', '代码审查与安全审计', '架构设计'],
  not_for: ['快速编码迭代', '大规模重构执行'],
  execution_model: { parallel_mode: 'sub-agent', max_instances: 1 },
  context_budget: { preferred_read_mode: 'incremental', context_window: '128K' },
  capabilities: { can_suggest: true, suggestion_scope: 'related_tasks' }
}
```

**CodeWhale**:

```typescript
{
  identity: { id: 'ar-codewhale', label: 'CodeWhale', version: '0.8.46' },
  tagline: 'DeepSeek 深度整合，推理型编码小能手',
  best_for: ['代码生成与实现', '功能模块开发', '代码重构', '单元测试'],
  not_for: ['长上下文综合分析', '安全审计'],
  execution_model: { parallel_mode: 'multi-process', max_instances: 4 },
  context_budget: { preferred_read_mode: 'incremental', context_window: '64K' },
  capabilities: { can_suggest: false }
}
```

#### 数据流

```
AgentAdapter.manifest() → AgentManager.list() 返回含 manifest 的列表
  → IPC handler (agent:list) → preload → App.vue
    → Agent 选择器下拉显示 tagline 作为辅助信息
    → PM 拆解时调度器参考 best_for 做 Agent 指派
```

#### 改动清单

| 文件 | 改动 |
|---|---|
| `electron/agents/adapter.ts` | 新增 `AgentManifest` 接口；`AgentAdapter` 增加 `manifest(): AgentManifest` |
| `electron/agents/codewhale.ts` | 实现 `manifest()` 返回 CodeWhale 标签 |
| `electron/agents/reasonix.ts` | 实现 `manifest()` 返回 Reasonix 标签 |
| `electron/agents/manager.ts` | `list()` 返回 `{name, label, manifest}` |
| `electron/preload.ts` | 暴露 `agent.getManifest(name)` |
| `src/App.vue` | Agent 下拉选项增加 `tagline` 工具提示 |

#### 验收标准

- `agent.list()` 返回含 manifest 的完整信息
- Agent 下拉可显示 tagline 辅助信息
- Manifest 在适配器中硬编码，运行时不可变

---

### 3.3 Agent 接入标准（新增）

审计指出 docs/ 中"Agent 接入规范"完全缺失。本节补充。

#### 接入三步流程

```
1. 创建适配器：实现 AgentAdapter 接口
   └─ 实现 manifest() 声明标签
2. 在 AgentManager 中注册
   └─ manager.register(new MyAgentAdapter())
3. 实现 spawnExec() 输出 NDJSON 事件流
   └─ 至少支持 task:start / progress / completion / error
```

#### 适配器模板

```typescript
import { spawn } from 'child_process';
import type { ChildProcess, SpawnOptions } from 'child_process';
import type { AgentAdapter, AgentManifest, AgentExecOptions } from './adapter';

export class MyAgentAdapter implements AgentAdapter {
  readonly name = 'my-agent';
  readonly displayName = 'My Agent';

  manifest(): AgentManifest {
    return {
      identity: { id: 'ar-my-agent', label: 'My Agent', version: '1.0.0' },
      tagline: '一句话描述',
      best_for: ['场景A', '场景B'],
      not_for: ['场景C'],
      execution_model: { parallel_mode: 'single', max_instances: 1 },
      context_budget: { preferred_read_mode: 'full', context_window: '64K' },
    };
  }

  spawnExec(command: string, options?: AgentExecOptions): ChildProcess {
    // 根据 options.mode 决定 CLI 参数
    const args = this.buildArgs(command, options?.mode);
    return spawn('my-cli', args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  }

  spawnDoctor(options?: SpawnOptions): ChildProcess {
    return spawn('my-cli', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
  }

  private buildArgs(command: string, mode?: string): string[] {
    // 每种 Agent 的 CLI 参数映射逻辑
    return ['exec', '--json', command];
  }
}
```

---

## Phase 4：调度智能

> **审计评价 P1**：上下文传递和四种执行模式是用户感知最强的功能。

### 4.1 上下文传递（scope + baseline + deltas）

#### 协议定义

PM 拆解任务时，为每个任务附带 context 信息：

```json
{
  "tasks": [
    {
      "id": "t1",
      "title": "数据库：添加 roles 表",
      "assignee": "codewhale",
      "context": {
        "scope": ["src/models/"],
        "deltas": []
      }
    },
    {
      "id": "t2",
      "title": "中间件：角色校验",
      "assignee": "codewhale",
      "depends_on": ["t1"],
      "context": {
        "scope": ["src/middleware/"],
        "deltas": []
      }
    }
  ]
}
```

当 t1 完成时，其 completion 事件携带 deltas 回收包：

```json
{
  "_sender": { "label": "CodeWhale", "id": "cw-001" },
  "event": "completion",
  "data": {
    "summary": "roles 表创建完成",
    "_context": {
      "deltas": [
        { "file": "src/models/role.ts", "type": "create", "size": 120 },
        { "file": "src/models/permission.ts", "type": "create", "size": 85 }
      ]
    }
  }
}
```

平台将 t1 的 deltas 合并到 t2 的 context 中，注入 t2 子进程：

```json
{
  "scope": ["src/middleware/"],
  "deltas": [
    { "file": "src/models/role.ts", "type": "create", "size": 120 },
    { "file": "src/models/permission.ts", "type": "create", "size": 85 }
  ]
}
```

#### 三种读取模式

| 模式 | context 内容 | Token 效率 | 适用场景 |
|---|---|---|---|
| **全量** 🏋️ | `deltas: []` | 基准 | 初始任务、读不同文件 |
| **增量** 📊 | `deltas: [{file, type, ...}]` | 省 90% | 接力任务、审查 |
| **差异** 🔍 | `deltas` + `baseline: "commit-xxx"` | 最高 | 迭代改同一文件 |

#### Token 经济账（补充审计缺失）

```
场景：1000 行脚本，拆 3 个任务

❌ 无上下文传递（每个都读全量）
  t1: 1000 → t2: 1000 → t3: 1000 = 3000 行
  有效：1000 | 浪费：67%

✅ 有上下文传递（增量读取）
  t1: 1000 → t2: 50 → t3: 30 = 1080 行
  有效：1080 | 浪费：0

节省 64%
```

#### 改动清单

| 文件 | 改动 |
|---|---|
| `electron/agents/task-parser.ts` | 解析 PM 产出的 `task.context` 字段 |
| `electron/ipc/agents.ts` | completion 事件回收 `_context.deltas`；exec 时注入 `task.context.deltas` 到下游 |
| `electron/agents/manager.ts` | spawnExec 接受 context 参数（可选），通过环境变量 `AGENTROUTER_CONTEXT` 注入 |
| `electron/agents/adapter.ts` | `AgentExecOptions` 增加 `context?: SenderMetadata['context']` |
| `electron/agents/reasonix.ts` | 读取 `AGENTROUTER_CONTEXT` 环境变量，拼接 system prompt |
| `src/App.vue` | 任务展开区域显示 context 信息 |

#### 文件冲突检测（补充审计缺失）

```typescript
// electron/scheduler/executor.ts
function detectFileConflicts(tasks: Task[]): Conflict[] {
  const fileMap = new Map<string, Task[]>();
  for (const task of tasks) {
    for (const file of task.context?.scope || []) {
      const existing = fileMap.get(file);
      if (existing) return [{ file, tasks: [existing, task] }];
      fileMap.set(file, task);
    }
  }
  return [];
}
```

| 方案 | 做法 | 代价 |
|---|---|---|
| **PM 规划时避免** | 拆任务时确保文件不重叠 | 依赖 PM 质量 |
| **串行兜底** | 检测冲突时自动串行 | 损失并行效率 |

---

### 4.2 并行执行引擎

#### 调度算法

```
输入：tasks[{id, assignee, depends_on, parallel_group}]

1. 按 parallel_group 分组，组内并行，组间串行
2. 每组内检查 max_instances 上限
3. 每组内检测文件冲突 → 冲突自动降级串行
4. 下一组在所有任务完成后启动
```

```typescript
// electron/scheduler/executor.ts
async function executeParallel(
  tasks: Task[],
  maxInstances: number,
  execTask: (task: Task) => Promise<void>
): Promise<void> {
  const groups = groupByParallelGroup(tasks);
  for (const group of groups) {
    const safe = resolveConflicts(group);
    const semaphore = new Semaphore(maxInstances);
    await Promise.all(safe.map(task => semaphore.run(() => execTask(task))));
  }
}
```

#### 执行模式

| 模式 | 行为 | 前端表现 |
|---|---|---|
| **YOLO** 🚀 | 审批跳过，自动调度 | 任务直接进入 running，无审批步骤 |
| **审批** ✅ | 任务列表 → 用户确认 → 调度 | 现有"审批 Plan"按钮逻辑 |
| **逐步** 👣 | 每组开始前弹出确认 | 每组开始前显示对话框 `"第 N 组就绪，共 M 个任务，开始执行？"` |
| **预览** 👀 | 只展示任务列表和依赖图 | 不 spawn 任何进程，只展示"预览完成" |

#### 改动清单

| 文件 | 改动 |
|---|---|
| 新增 `electron/scheduler/` | 调度器模块入口 |
| `electron/scheduler/executor.ts` | `executeParallel()` 含分组/信号量/冲突检测 |
| `electron/scheduler/resolver.ts` | `resolveConflicts()` + `groupByParallelGroup()` |
| `src/App.vue` | `executeAllTasks()` → 调度走 scheduler；模式选择影响调度行为 |
| `electron/agents/manager.ts` | `exec()` 增加 `max_instances` 并发上限控制 |

---

## Phase 5：动态调整

> **审计评价 P2**：suggestion 机制是差异化竞争力。这是 ProjectVision 中最核心的创新。

### 5.1 Suggestion 事件

#### 协议定义

Agent 执行中发现可以优化时，发送 suggestion 事件：

```json
{
  "_sender": { "label": "CodeWhale", "id": "cw-001" },
  "event": "suggestion",
  "data": {
    "target_task": "t3",
    "target_agent": "codewhale",
    "suggestion": "建议在 t3 中增加配置加载模块",
    "reason": "当前项目没有统一配置管理，后续维护困难",
    "severity": "enhancement"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `target_task` | string | 建议影响的任务 ID |
| `target_agent` | string | 建议影响谁的 work |
| `suggestion` | string | 建议内容 |
| `reason` | string | 建议理由 |
| `severity` | `"enhancement"` / `"blocker"` / `"critical"` | 严重程度 |

#### PM 决策矩阵

| B 的状态 | PM 决策 | 发出事件 |
|---|---|---|
| 还没开始 | 直接修改任务描述 | `task:update` |
| 已开始，不冲突 | 追加补充任务 | `task:add` |
| 已开始，冲突 | 标记冲突，完成后人工介入 | `task:update`（标记冲突） |
| 已完成 | 追加新任务或忽略 | `task:add` 或不处理 |

#### PM 生命周期管理（补充审计缺失）

```typescript
// electron/scheduler/pm-lifecycle.ts
interface PMState {
  sessionId: string;
  processId: string;
  spawnedAt: number;
  lastHeartbeat: number;
  contextSnapshot: {
    completed: Task[];
    running: Task[];
    pending: Task[];
    thread: Message[];  // 最近 N 条对话
  };
}

async function handleSuggestion(suggestion: SuggestionEvent): Promise<void> {
  const pm = pmRegistry.get(suggestion.sessionId);
  if (pm && isProcessAlive(pm.processId)) {
    // PM 进程存活 → 直接转发 suggestion
    pm.process.stdin.write(JSON.stringify(suggestion) + '\n');
  } else {
    // PM 已退出 → 重新 spawn PM 并注入上下文
    const context = await buildContextSnapshot(suggestion.sessionId);
    const newPm = spawnPM(suggestion.sessionId, context);
    pmRegistry.set(suggestion.sessionId, {
      ...newPm,
      contextSnapshot: context,
    });
  }
}
```

#### 任务动态调整事件

PM 发出调整事件，平台 UI 即时响应：

```typescript
// task:update
{ "event": "task:update", "data": {
  "task_id": "t3",
  "changes": { "description": "...", "path": "..." },
  "reason": "采纳建议"
}}

// task:add
{ "event": "task:add", "data": {
  "task": { "id": "t5", "title": "...", "assignee": "codewhale" },
  "reason": "执行中发现新需求"
}}

// task:cancel
{ "event": "task:cancel", "data": {
  "task_id": "t2",
  "reason": "已不需要"
}}
```

#### 改动清单

| 文件 | 改动 |
|---|---|
| `electron/agents/adapter.ts` | AgentEvent 增加 `suggestion` / `task:update` / `task:add` / `task:cancel` 事件类型 |
| `electron/agents/manager.ts` | stdout 解析 suggestion 事件（携带 `_sender`）；增加 `getPmStatus(sessionId)` |
| `electron/ipc/agents.ts` | 收到 suggestion 时查询 PM 状态并转发；task 调整事件入库通知前端 |
| 新增 `electron/scheduler/pm-lifecycle.ts` | PM 进程注册表 + 上下文快照 + suggestion 路由 |
| `electron/ipc/tasks.ts` | 新增 `db:updateTaskDescription`, `db:addTaskDynamic`, `db:cancelTask` |
| `src/App.vue` | 任务面板支持即时更新；suggestion 指示器气泡 |

---

## Phase 6：高级协议 + 生态

### 6.1 推理气泡

**核心改动**：Reasonix `platform-output.ts` 将 `reasoningDelta` 作为 `channel: "reasoning"` 的 progress 事件输出。

```json
// Reasonix → 平台
{"event":"progress","data":{"message":"分析代码结构中...","channel":"reasoning"}}

// 平台 → 渲染进程 (IPC)
{agent:"reasonix",event:{event:"progress",data:{message:"...",channel:"reasoning"}}}
```

**前端**：灰色半透明推理气泡，逐 token 流式显示，推理结束时渐进淡出。

| 文件 | 改动 |
|---|---|
| `agents/reasonix/src/cli/platform-output.ts` | 处理 `ev.reasoningDelta` 输出 `channel: "reasoning"` |
| `electron/ipc/agents.ts` | 透传 channel 标记 |
| `src/App.vue` | 推理气泡组件 |

### 6.2 MCP 工具注入

| 文件 | 改动 |
|---|---|
| 新增 `electron/mcp/server.ts` | MCP 服务器暴露 `read_file` / `write_file` / `search_code` / `read_project_structure` |
| `electron/agents/reasonix.ts` | spawnExec 增加 `--mcp` 参数 |
| `electron/main.ts` | 初始化 MCP Server，端口可配置 |

### 6.3 长期记忆系统

| 文件 | 改动 |
|---|---|
| `electron/database/migrations.ts` | 新增 `memories` 表（id, sessionId, projectId, agentName, content, key, createdAt） |
| `electron/database/repository.ts` | `saveMemory()` + `loadMemories(projectId, agentName)` |
| `electron/preload.ts` | 暴露 `db.saveMemory` / `db.loadMemories` |
| `electron/ipc/agents.ts` | exec 时注入记忆作为 system prompt 前缀 |

### 6.4 Session 回放

| 文件 | 改动 |
|---|---|
| `electron/ipc/agents.ts` | `agent:replay(sessionId, speed)` 通道 |
| `src/App.vue` | 回放控件：播放/暂停/速度 0.5x-4x/进度条 |

---

## 阶段全景

| 阶段 | 核心交付 | 审计优先级 |
|---|---|---|
| **Phase 3** | `_sender` metadata + 标签注册 + 接入标准 | **P0** 所有高阶协议的基础 |
| **Phase 4** | 上下文传递 + 并行引擎 + 4 种模式 + 冲突检测 | P1 用户感知最强 |
| **Phase 5** | suggestion 协议 + PM 生命周期 + 动态任务调整 | P2 差异化竞争力 |
| **Phase 6** | 推理气泡 + MCP + 记忆 + 回放 | P3 高阶体验 |

各阶段之间有依赖关系：Phase 3 → Phase 4 → Phase 5，Phase 6 可与其他阶段部分并行。

---

## 后续规划（已识别，未排期）

| 事项 | 说明 |
|---|---|
| **Markdown 渲染** | Agent 输出为 Markdown 格式（代码块、表格、列表等），当前 App.vue 以纯文本 `{{ m.content }}` 直接显示。需引入 marked / markdown-it 等渲染器，支持代码高亮。 |
| **图表渲染（Mermaid）** | Agent 输出中可能包含 Mermaid 结构图（流程图、时序图、类图等），需引入 mermaid.js 渲染器，在对话中实时渲染为可视化图表。 |
| **前端组件化** | 将 App.vue 拆分为独立组件（MessageList, TaskPanel, AgentSelector 等），当前为单文件 SFC。 |

## 参考

- [ProjectVision/CONCEPT.md](../ProjectVision/CONCEPT.md) — 核心概念
- [ProjectVision/ARCHITECTURE.md](../ProjectVision/ARCHITECTURE.md) — 架构设计（标签系统、协同模型）
- [ProjectVision/PROTOCOL.md](../ProjectVision/PROTOCOL.md) — 通信协议（_sender、suggestion、上下文）
- [ProjectVision/SCENARIO.md](../ProjectVision/SCENARIO.md) — 场景推演（含动态调整 9 步）
- [ProjectVision/PERSONA.md](../ProjectVision/PERSONA.md) — 用户画像
