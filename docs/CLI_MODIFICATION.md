# AgentRouter — CLI 改造方案

> **文档状态**: 已归档 🗄️ — Phase 1-2 的 CLI 改造记录。后续 Agent 接入指南请参考 [ProjectVision/ARCHITECTURE.md](../ProjectVision/ARCHITECTURE.md) 标签系统章节。
> 当前代码位于 `electron/agents/`。

> 原则：主体功能不动，只改输入输出接口。

---

## CodeWhale (Rust CLI)

### 当前已有的能力

```
codewhale exec --output-format stream-json "任务描述"
```

已经输出 NDJSON 事件：

| 现有事件 | 映射到我们的协议 | 状态 |
|---|---|---|
| `{"type":"content","content":"..."}` | ≈ `progress` | ✅ 已有 |
| `{"type":"tool_use","name":"...","input":{}}` | 工具调用 | ✅ 已有 |
| `{"type":"tool_result","id":"...","output":"..."}` | 工具结果 | ✅ 已有 |
| `{"type":"done"}` | ≈ `completion` | ✅ 已有 |
| `{"type":"error","error":"..."}` | ≈ `error` | ✅ 已有 |
| `task:start` 事件 | 开始执行 | ❌ 需要加 |
| `progress` 消息字段 | 进度消息 | ❌ 需要对齐格式 |

### 需要改什么

**1. 入口：加 `--mode platform` 参数**

文件：`agents/codewhale/crates/tui/src/main.rs`

在 `ExecArgs` 结构体（line 279）加一个 flag：

```rust
platform_mode: bool,   // --mode platform
```

**2. 事件循环：加 task:start、对齐事件格式**

文件：`agents/codewhale/crates/tui/src/main.rs`

在 `run_exec_agent()`（line 5126）开始处，先 emit 一个 `task:start`：

```rust
if args.platform_mode {
    emit_exec_stream_event(&ExecStreamEvent::Content { content: r#"{"type":"event","event":"task:start","data":{}}"# });
}
```

后续的 `content` 事件包装为我们的 `progress` 格式。

**3. 用 `--auto` 模式自动运行**

现有 `--auto` flag 已经自动批准所有 ToolCall，不需要改。

### 改动量

| 文件 | 改动 |
|---|---|
| `crates/tui/src/main.rs` 的 `ExecArgs` struct | +1 field |
| `crates/tui/src/main.rs` 的 `run_exec_agent()` | ~10 行 |
| `crates/cli/src/lib.rs` 的 `Cli` struct | +1 field（透传到 tui） |
| `crates/cli/src/lib.rs` 的 `delegate_to_tui()` | 透传 platform 参数 |

**总计大概 30 行改动。**

---

## Reasonix (Node.js TS CLI)

### 当前已有的能力

```
reasonix run "任务描述"                      # 非交互式，纯文本输出
reasonix acp                                 # JSON-RPC 协议，NDJSON 格式
reasonix desktop                             # 自定义 NDJSON 事件格式（最接近我们需求）
```

最接近我们需求的是 **`desktop` 模式** — 它已经在输出结构化 NDJSON 事件：

| desktop 现有事件 | 映射到我们的协议 |
|---|---|
| `{"$ready":true}` | — |
| `{"$turn_complete":{...}}` | ≈ `completion` |
| `{"$error":{"message":"..."}}` | ≈ `error` |
| `{"$confirm_required":{...}}` | Q&A 确认 |
| `{"event":"stream","data":{...}}` | ≈ `progress` |

不过它是为 Tauri 桌面客户端设计的，事件格式偏复杂。

更好的选择是——**基于 `run` 命令改造**：因为 `run` 已经是最简的非交互模式，我们只需要把输出从纯文本改为 NDJSON。

### 需要改什么

**1. 新建平台输出适配器**

文件：新建 `agents/reasonix/src/cli/platform-output.ts`

把 `CacheFirstLoop.step()` 产生的 `LoopEvent` 转换为我们的 NDJSON 协议：

```typescript
function emit(ev: LoopEvent) {
  switch (ev.role) {
    case 'assistant_delta':
      process.stdout.write(JSON.stringify({
        type: 'event', event: 'progress', data: { message: ev.content }
      }) + '\n')
      break
    case 'assistant_final':
      // 输出 completion
      break
    case 'error':
      // 输出 error
      break
    // 其他事件
  }
}
```

**2. 入口：加 `--mode platform` 子命令**

文件：`agents/reasonix/src/cli/index.ts`

在 Commander 定义中加一个 `platform` 子命令：

```typescript
program.command('platform')
  .argument('<task>', '任务描述')
  .option('--role <role>', 'pm | executor', 'executor')
  .action(async (task, options) => {
    // 类似 run 命令，但输出使用 platform-output.ts
    await platformCommand(task, options)
  })
```

**3. `--role pm` 特殊处理**

PM 模式下，在对话最后插入一个特殊的侧通道输出：

```typescript
// 在 assistant_final 后，LLM 返回了任务列表
// 需要以结构化方式输出 tasks 数组
emit({
  type: 'event', event: 'completion',
  data: {
    summary: '需求分析完成',
    tasks: [/* PM 产出的任务列表 */]
  }
})
```

这里的关键问题是：**PM 怎么产出结构化的任务列表？**

有两种方式：
- **方式 A**：在 System Prompt 中要求 LLM 以特定 JSON 格式输出 → loop 结束后解析最后一次 `assistant_final` 的 content
- **方式 B**：加一个 `output_tasks` 工具，让 LLM 调用这个工具来提交任务列表

我建议用方式 A——最简单，只需改 prompt，不涉及工具调用。

### 改动量

| 文件 | 改动 |
|---|---|
| `src/cli/platform.ts`（新建） | 平台模式入口逻辑 |
| `src/cli/platform-output.ts`（新建） | LoopEvent → NDJSON 转换 |
| `src/cli/index.ts` | +1 个 subcommand |

**总计大概 100-150 行代码。**

---

## 改造对比总结

| | CodeWhale (Rust) | Reasonix (Node.js TS) |
|---|---|---|
| 已有结构化输出 | `stream-json` ✅ | 3 种模式 ✅ |
| 需改入口 | + `--mode platform` flag | + `platform` 子命令 |
| 需加输出格式 | 微调已有事件 | 新建 NDJSON 转换层 |
| `--role pm` | 只需传不同 prompt | 需在 prompt 中定义任务列表格式 |
| 编译/运行 | `cargo build` | `tsx` 直接运行 |
| 预估改动量 | ~30 行 | ~150 行 |
| 难度 | 低 | 中 |
