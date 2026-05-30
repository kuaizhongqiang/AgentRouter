# AgentRouter — CLI ↔ 平台协议

> 本文档是**活的协议定义**，随阶段逐步扩展。

---

## 设计原则

- 通信方式：stdin / stdout，行分隔 JSON（JSON Lines）
- 协议对齐 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 的**工具模型**
- CLI 内部逻辑不动，只改 I/O 层
- 双向：平台→CLI 走 stdin，CLI→平台 走 stdout

---

## 第一阶段（当前范围）

**只覆盖状态事件**：知道 CLI 有没有开始、在做什么、有没有完成。

### 方向：CLI → 平台 (stdout)

| type | 含义 | 何时发 |
|---|---|---|
| `event` | 状态事件 | 状态变化时 |

### 所有事件的公共字段

每条消息包含以下标准字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `protocol_version` | string | 是 | 协议版本号，当前为 `"1.0"` |
| `id` | string | 是 | 事件唯一 ID，用于追踪和去重 |
| `session_id` | string | 是 | 当前会话 ID |
| `type` | string | 是 | 消息类型，当前固定为 `"event"` |
| `event` | string | 是 | 事件名称 |
| `data` | object | 是 | 事件负载 |
| `timestamp` | string | 是 | ISO 8601 时间戳 |

**event 定义**：

```
{"protocol_version":"1.0","id":"evt_abc123","session_id":"ses_xyz","type":"event","event":"event_name","data":{...},"timestamp":"2025-05-30T10:00:00Z"}
```

**第一阶段支持的事件**：

| 事件 | 含义 | data |
|---|---|---|
| `task:start` | 任务开始执行 | `{}` |
| `progress` | 运行中 | `{"message":"正在分析代码结构..."}` |
| `completion` | 任务完成 | `{"summary":"重构完成"}` |
| `error` | 出错 | `{"message":"文件不存在"}` |
| `cancelled` | 被取消 | `{"reason":"用户终止"}` |

> 平台侧收到这些事件后，更新 UI、记日志。不做额外调度。

### 方向：平台 → CLI (stdin)

第一阶段不需要。平台只负责启动 CLI、传入初始参数、接收 stdout。

---

## 后续阶段（待定）

这些内容一期不实现，但协议格式预留空间。

### 工具调用 (Tool Calling)

```
CLI stdout → {"type":"tool_request","tool":"file.read","args":{"path":"..."}}
平台 stdin → {"type":"tool_result","request_id":"...","result":"..."}
```

工具模型对齐 MCP：

- `file.read` — 读取文件内容
- `file.write` — 写入文件
- `file.search` — 搜索代码
- `memory.save` — 保存记忆
- `memory.get` — 读取记忆

### 问答 (Q&A)

```
CLI stdout → {"type":"question","id":"q1","content":"确认修改这个文件？","options":["yes","no"]}
平台 stdin → {"type":"answer","id":"q1","answer":"yes"}
```

### 子Agent

```
CLI stdout → {"type":"subagent_request","agent":"reasonix","task":"review the diffs"}
平台 stdin → {"type":"subagent_result","agent":"reasonix","result":"..."}
```

### 与 MCP 的映射

| AgentRouter 协议 | MCP 对应 |
|---|---|
| `tool_request` | `tools/call` |
| `tool_result` | `tools/call` 响应 |
| event（progress） | `notifications/message` |
| 任务系统 | 自定义扩展（MCP 无内置任务模型） |

---

## CLI 改造方案

### CodeWhale (Rust CLI)

新增 `--mode platform` 参数：

```
codewhale --mode platform exec "重构登录模块"
```

改动点：
- 内部执行逻辑不变
- stdout 输出从 TUI 渲染改为 JSON Lines 事件流
- stderr 保持日志不变

### Reasonix (Node.js TS CLI)

新增 `--mode platform` 参数：

```
reasonix --mode platform "重构登录模块"
```

改动点：
- 内部推理逻辑不变
- 原本用 React Ink 渲染 TUI → 改为 JSON Lines 事件流输出
- CLI 以一次执行、一次退出的模式运行

---

## 通信流程示例

```
平台 启动 CodeWhale:
  spawn ar-codewhale --mode platform exec "给项目加 ESLint"

stdout ← {"protocol_version":"1.0","id":"evt_001","session_id":"ses_abc","type":"event","event":"task:start","data":{},"timestamp":"2025-05-30T10:00:00Z"}
stdout ← {"protocol_version":"1.0","id":"evt_002","session_id":"ses_abc","type":"event","event":"progress","data":{"message":"分析项目中..."},"timestamp":"2025-05-30T10:00:02Z"}
stdout ← {"protocol_version":"1.0","id":"evt_003","session_id":"ses_abc","type":"event","event":"progress","data":{"message":"创建 .eslintrc.json"},"timestamp":"2025-05-30T10:00:10Z"}
stdout ← {"protocol_version":"1.0","id":"evt_004","session_id":"ses_abc","type":"event","event":"completion","data":{"summary":"ESLint 配置完成，修改了 12 个文件"},"timestamp":"2025-05-30T10:00:30Z"}

平台 收到 completion → 显示结果 → 关闭子进程
```
