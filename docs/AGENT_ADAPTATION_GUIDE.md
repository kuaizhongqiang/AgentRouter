# AgentRouter — Agent 改造方法论

> 规范化的流程：把任意一个开源 coding CLI 改造成兼容 AgentRouter 平台的 Agent。

---

## 改造原则

1. **主体功能不动** — Agent 的推理逻辑、代码生成能力、工具调用不修改
2. **只改 I/O 接口** — 输入从交互式终端改为结构化任务，输出从 TUI 改为 NDJSON 事件流
3. **不改 Agent 的独立性** — 改造后的 Agent 仍然可以独立在终端运行
4. **保持最小 diff** — 与上游的差异越小，越容易跟进新版本

---

## 改造步骤

### Step 1：确定入口

找到 Agent CLI 的主入口文件和参数解析方式：

| CLI 类型 | 常见入口 | 参数解析 |
|---|---|---|
| Rust (clap) | `src/main.rs` 或 `src/bin/*.rs` | `#[derive(Parser)]` |
| Node.js (commander) | `src/cli/index.ts` 或 `bin/` | `program.command(...)` |
| Python (click) | `cli.py` 或 `__main__.py` | `@click.command()` |

需要找到：
- 参数定义位置（加 `--mode platform` 的地方）
- 子命令分发逻辑（路由到具体执行函数的地方）
- 执行完退出还是循环等待

### Step 2：确定输出方式

找到 Agent 原本的输出机制，确定替换方案：

| 原始输出 | 改造方式 | 示例 |
|---|---|---|
| TUI 框架（React Ink、ratatui） | 增加非交互模式，跳过渲染 | Reasonix 的 Ink → 直接写 stdout |
| 终端流式输出（print/println） | 保留，再加 JSON Lines 副本 | CodeWhale 的 println! |
| 纯函数返回 | 在调用处加序列化 | 工具调用结果 → to_json |

### Step 3：加 platform 参数

添加统一的 `--mode platform` 或 `platform` 子命令：

```
# 方式 A：全局参数
myagent --mode platform exec "任务"

# 方式 B：子命令
myagent platform [--role pm|executor] "任务"
```

### Step 4：输出 NDJSON 事件流

在 Agent 的执行循环中，把原本的输出改为 NDJSON 事件，对齐 **[AgentRouter 协议](../docs/PROTOCOL.md)**：

```json
{"protocol_version":"1.0","id":"evt_xxx","session_id":"ses_xxx","type":"event","event":"task:start","data":{},"timestamp":"..."}
{"type":"event","event":"progress","data":{"message":"分析中..."},"timestamp":"..."}
{"type":"event","event":"completion","data":{"summary":"完成"},"timestamp":"..."}
{"type":"event","event":"error","data":{"message":"出错"},"timestamp":"..."}
```

### Step 5：改名

将二进制名加前缀 `ar-`，避免与系统已有版本冲突：

| 原名 | 改为 |
|---|---|
| `codewhale` | `ar-codewhale` |
| `reasonix` | `ar-reasonix` |

### Step 6：验证

改造完成后跑通以下场景：

1. `ar-myagent --version` — 能正确输出版本
2. `ar-myagent --mode platform "hello"` — 输出 NDJSON 事件流
3. `ar-myagent --mode platform --role pm "需求"` — PM 模式产出任务列表
4. 平台上通过适配器调用 Agent — 完整流程走通

---

## 平台适配器对接

改造完成后，在 `electron/agents/` 下实现适配器：

```typescript
class MyAgentAdapter implements AgentAdapter {
  name = 'my-agent'
  displayName = 'My Agent'
  
  async exec(task: string, options?: ExecOptions): Promise<AsyncIterable<AgentEvent>> {
    const proc = spawn('ar-myagent', ['--mode', 'platform', task], {
      cwd: options?.cwd,
    })
    // 解析 stdout 为 AgentEvent 流
    return parseEventStream(proc.stdout)
  }
}
```

---

## 需要了解的关键文件

### CodeWhale (Rust)

| 文件 | 作用 |
|---|---|
| `crates/cli/src/lib.rs` | Cli 参数解析、命令分发、delegate_to_tui |
| `crates/tui/src/main.rs` | TUI 入口、ExecArgs、run_exec_agent、ExecStreamEvent |
| `Cargo.toml` | Workspace 定义、binary name |

### Reasonix (Node.js)

| 文件 | 作用 |
|---|---|
| `src/cli/index.ts` | Commander 参数解析、子命令注册 |
| `src/cli/commands/run.ts` | 非交互式执行（最接近 platform 模式） |
| `src/cli/commands/desktop.ts` | 已有 NDJSON 输出模式的参考实现 |
| `src/loop.ts` | 核心执行循环、LoopEvent |
| `package.json` | bin 定义 |
