# AgentRouter — CLI ↔ 平台协议

> **文档状态**: Phase 1-2 实现子集 ✅ | 完整协议规范请参考 [ProjectVision/PROTOCOL.md](../ProjectVision/PROTOCOL.md)。

---

## 协议层级

```
ProjectVision/PROTOCOL.md（完整规范）
    └── docs/PROTOCOL.md（当前实现子集）
```

ProjectVision 定义了完整协议（含 `_sender` metadata、`suggestion` 事件、上下文传递等）。
本文档仅覆盖当前代码已实现的 Phase 1-2 子集。

---

## 设计原则

- 通信方式：stdin / stdout，行分隔 JSON（JSON Lines）
- CLI 内部逻辑不动，只改 I/O 层
- 方向：CLI → 平台（stdout）

---

## 当前实现（Phase 3-6）

### 事件格式

每条消息包含以下标准字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `protocol_version` | string | 是 | `"1.0"` |
| `id` | string | 是 | 事件唯一 ID |
| `session_id` | string | 是 | 当前会话 ID |
| `type` | string | 是 | 固定为 `"event"` |
| `event` | string | 是 | 事件名称 |
| `data` | object | 是 | 事件负载 |
| `timestamp` | string | 是 | ISO 8601 时间戳 |
| `_sender` | object | 否 | Phase 3: 消息来源身份标识 `{label, id}` |

### 支持的事件

| 事件 | 含义 | data | 阶段 |
|---|---|---|---|
| `task:start` | 任务开始执行 | `{}` | Phase 1 |
| `progress` | 运行中 | `{"message":"..."}` | Phase 1 |
| `completion` | 任务完成 | `{"summary":"...", "tasks":[...]}` | Phase 1-2 |
| `error` | 出错 | `{"message":"..."}` | Phase 1 |
| `cancelled` | 被取消 | `{"reason":"用户终止"}` | Phase 1 |
| `suggestion` | Agent 提建议 | `{"target_task","target_agent","suggestion","reason"}` | Phase 5 |
| `task:update` | PM 更新任务 | `{"task_id","changes","reason"}` | Phase 5 |
| `task:add` | PM 追加任务 | `{"task","reason"}` | Phase 5 |
| `task:cancel` | PM 取消任务 | `{"task_id","reason"}` | Phase 5 |

### 通信流程示例

```
平台 spawn ar-reasonix platform "重构" --role pm
stdout ← {"event":"task:start","data":{},"_sender":{"label":"Reasonix","id":"reasonix-1"},...}
stdout ← {"event":"progress","data":{"message":"分析代码结构..."},"_sender":{...},...}
stdout ← {"event":"completion","data":{"summary":"...","tasks":[...]},"_sender":{...},...}

平台 收到 completion → 注入 _sender → 解析 tasks → 入库 → 显示"审批 Plan"
```

---

## 与 ProjectVision 的差距

| 特性 | 当前实现 | ProjectVision 完整协议 |
|---|---|---|
| `_sender` metadata | ✅ 已实现 | ✅ 每条消息带 `{label, id, context}` |
| `suggestion` 事件 | ✅ 已实现（事件类型 + UI 指示器） | ✅ Agent 可向 PM 提建议 |
| `task:update/add/cancel` | ✅ 已实现（IPC + preload） | ✅ PM 可动态调整任务 |
| 上下文传递（scope/deltas） | ⚠️ 类型已定义，运行时未接线 | ✅ 增量读取，省 Token |
| 推理气泡 | ❌ 未实现（需 Reasonix CLI 配合） | ✅ 实时显示推理过程 |
| MCP 工具 | ⚠️ Server 已创建，未自动启动 | ✅ 平台提供文件工具 |
| Tool Calling | ❌ 无 | ✅ 预留协议 |
| Q&A | ❌ 无 | ✅ 预留协议 |
| Sub-Agent | ❌ 无 | ✅ 预留协议 |

各特性的实现时间表见 [PHASE3.md](PHASE3.md)。

---

## 相关文档

- [ProjectVision/PROTOCOL.md](../ProjectVision/PROTOCOL.md) — 完整协议规范
- `PHASE3.md` — 协议实现阶段规划
- `electron/agents/` — 当前代码实现
