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

## 当前实现（Phase 1-2）

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

### 支持的事件

| 事件 | 含义 | data |
|---|---|---|
| `task:start` | 任务开始执行 | `{}` |
| `progress` | 运行中 | `{"message":"..."}` |
| `completion` | 任务完成 | `{"summary":"...", "tasks":[...]}`（PM 模式附带 tasks） |
| `error` | 出错 | `{"message":"..."}` |
| `cancelled` | 被取消 | `{"reason":"用户终止"}` |

### 通信流程示例

```
平台 spawn ar-reasonix platform "重构" --role pm
stdout ← {"event":"task:start","data":{},"session_id":"ses_abc",...}
stdout ← {"event":"progress","data":{"message":"分析代码结构..."},...}
stdout ← {"event":"completion","data":{"summary":"...","tasks":[...]},...}

平台 收到 completion → 解析 tasks → 入库 → 显示"审批 Plan"
```

---

## 与 ProjectVision 的差距

| 特性 | 当前实现 | ProjectVision 完整协议 |
|---|---|---|
| `_sender` metadata | ❌ 无 | ✅ 每条消息带 `{label, id, context}` |
| `suggestion` 事件 | ❌ 无 | ✅ Agent 可向 PM 提建议 |
| `task:update/add/cancel` | ❌ 无 | ✅ PM 可动态调整任务 |
| 上下文传递（scope/deltas） | ❌ 无 | ✅ 增量读取，省 Token |
| Tool Calling | ❌ 无 | ✅ 预留协议 |
| Q&A | ❌ 无 | ✅ 预留协议 |
| Sub-Agent | ❌ 无 | ✅ 预留协议 |

各特性的实现时间表见 [PHASE3.md](PHASE3.md)。

---

## 相关文档

- [ProjectVision/PROTOCOL.md](../ProjectVision/PROTOCOL.md) — 完整协议规范
- `PHASE3.md` — 协议实现阶段规划
- `electron/agents/` — 当前代码实现
