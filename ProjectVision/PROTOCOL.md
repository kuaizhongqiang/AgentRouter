# AgentRouter — 通信协议

> **整合：消息头 Metadata · 事件协议 · 上下文传递机制**

---

## 消息头 Metadata（统一定义）

**每条消息都带发送者身份标识。** 这是协议的基础层，所有事件消息共享。

```
Sender (untrusted metadata):
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `label` | ✅ | 人看的名字，如 `"Reasonix"`、`"CodeWhale"` |
| `id` | ✅ | 实例唯一标识，如 `"reasonix-pm-001"`、`"codewhale-003"` |

### Metadata 的作用

| 作用 | 说明 |
|---|---|
| **消息溯源** | 每条消息都知道谁发的 |
| **路由判断** | 平台根据 sender 决定消息怎么处理 |
| **历史记录** | 对话日志里区分哪个 Agent 说了什么 |
| **调度决策** | PM 看到 CodeWhale 干完了，知道下一步该谁上 |

### 消息头扩展字段

根据场景，metadata 可携带扩展信息：

#### 带执行模型标记

```json
{
  "label": "ar-codewhale",
  "id": "codewhale-001",
  "execution": {
    "instance_id": "codewhale-001",
    "parallel_mode": "multi-process"
  }
}
```

#### 带上下文标记

```json
{
  "label": "ar-codewhale",
  "id": "codewhale-001",
  "context": {
    "scope": ["src/auth/login.ts", "src/auth/register.ts"],
    "baseline": "commit-abc123",
    "deltas": [
      { "file": "src/auth/login.ts", "type": "modify", "diff": "+15 -3" },
      { "file": "src/auth/register.ts", "type": "create", "size": 42 }
    ]
  }
}
```

| 字段 | 作用 |
|---|---|
| `scope` | 任务关心的文件范围，限制 Agent 读取范围 |
| `baseline` | 基准版本（commit hash），告诉 Agent 基于什么版本 |
| `deltas` | 变更清单，下游 Agent 只读增量，不读全量 |

---

## 事件协议

### 通信方式

```
平台 → CLI: stdin（命令行参数）
CLI → 平台: stdout（JSON Lines 事件流）
```

### 事件格式

每条事件消息包含发送者 metadata + 事件体：

```json
{
  "_sender": {
    "label": "ar-codewhale",
    "id": "codewhale-001"
  },
  "protocol_version": "1.0",
  "id": "evt_abc123",
  "session_id": "ses_xyz",
  "type": "event",
  "event": "event_name",
  "data": {},
  "timestamp": "2026-05-31T10:00:00Z"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `_sender` | ✅ | 发送者 metadata |
| `protocol_version` | ✅ | 当前为 `"1.0"` |
| `id` | ✅ | 事件唯一 ID |
| `session_id` | ✅ | 当前会话 ID |
| `type` | ✅ | 消息类型，当前固定为 `"event"` |
| `event` | ✅ | 事件名称 |
| `data` | ✅ | 事件负载 |
| `timestamp` | ✅ | ISO 8601 时间戳 |

### 第一阶段事件

| 事件 | 含义 | data |
|---|---|---|
| `task:start` | 任务开始 | `{}` |
| `progress` | 运行中 | `{"message":"分析代码结构..."}` |
| `completion` | 完成 | `{"summary":"重构完成", "tasks":[...]}` |
| `error` | 出错 | `{"message":"文件不存在"}` |
| `cancelled` | 取消 | `{"reason":"用户终止"}` |

---

## 消息流中的上下文传递

### 完整消息链

```
平台收到消息流：
┌─────────────────────────────────────────────────────┐
│ #1 PM 产出任务列表                                   │
│ _sender: { label: "Reasonix-PM", id: "pm-001" }     │
│ event: completion                                    │
│ data: { tasks: [...], parallel_groups: [...] }       │
├─────────────────────────────────────────────────────┤
│ #2 CodeWhale 执行 t1                                 │
│ _sender: { label: "CodeWhale", id: "cw-001",        │
│           context: { scope: ["src/models/"],         │
│                      deltas: [] } }                  │
│ event: progress                                      │
│ data: { message: "正在建 roles 表..." }              │
├─────────────────────────────────────────────────────┤
│ #3 CodeWhale t1 完成                                 │
│ _sender: { label: "CodeWhale", id: "cw-001",        │
│           context: { scope: ["src/models/"],         │
│                      deltas: [                       │
│                        {file: "src/models/role.ts",  │
│                         type: "create", size: 120}   │
│                      ] } }                           │
│ event: completion                                    │
│ data: { summary: "roles 表创建完成" }                │
├─────────────────────────────────────────────────────┤
│ #4 Reasonix 做安全审查                               │
│ _sender: { label: "Reasonix-PM", id: "pm-001",      │
│           context: { scope: ["src/models/"],         │
│                      baseline: "commit-def456",      │
│                      deltas: [ ← 引用 t1 的变更     │
│                        {file: "src/models/role.ts",  │
│                         type: "create", size: 120}   │
│                      ] } }                           │
│ event: progress                                      │
│ data: { message: "审查 CodeWhale 的产出..." }        │
└─────────────────────────────────────────────────────┘
```

**关键：审查时不需要重读全量，因为 metadata.context 携带了上游的增量信息。**

---

## Token 预算控制

### 消息头中的上下文范围

每条消息的 `metadata.context` 直接决定了下游 Agent 的 Token 消耗：

```
下游 Agent 启动时：
  读取 _sender.context
    → scope: ["src/auth/login.ts"]  → 只看这个文件
    → deltas: "+15 -3"              → 知道改了哪些行
    → baseline: "commit-abc123"     → 知道基于什么版本
  → 不需要读整个项目
  → 只读变更 + 相关上下文
  → Token 消耗从 2000 行 → ~200 行
```

### 三种读取模式在协议中的体现

| 模式 | context 内容 | Agent 行为 |
|---|---|---|
| **全量** | `deltas: []` | 读 scope 内全部文件 |
| **增量** | `deltas: [...]` | 只读 deltas 涉及的变更 |
| **差异** | `deltas: [...] + baseline: "xxx"` | 读最终文件 + 与 baseline 的 diff |

### PM 的粒度控制

```
PM 拆任务时，为每个任务生成对应的 context：
  t1 → scope: ["src/auth/"]         → 全量读 auth 目录
  t2 → deltas: [t1 的产出]          → 增量读
  t3 → deltas: [t1 + t2 的产出]     → 增量累积
```

---

## 后续阶段（预留）

### Tool Calling

```
CLI stdout → {"_sender":{...},"type":"tool_request","tool":"file.read","args":{...}}
平台 stdin  → {"type":"tool_result","request_id":"...","result":"..."}
```

### Q&A

```
CLI stdout → {"_sender":{...},"type":"question","id":"q1","content":"确认？","options":["yes","no"]}
平台 stdin  → {"type":"answer","id":"q1","answer":"yes"}
```

### Sub-Agent

```
CLI stdout → {"_sender":{...},"type":"subagent_request","agent":"reasonix","task":"..."}
```

---

## 协议全景

```
每条消息 = _sender（metadata）+ 事件体

_sender 告诉平台：谁在说话
事件体 告诉平台：说了什么
context 告诉平台：上下文范围
```

> **Metadata 是协议的灵魂。没有它，消息只是一堆无主的数据流。**
