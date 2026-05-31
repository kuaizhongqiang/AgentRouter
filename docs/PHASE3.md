# AgentRouter — 第三期范围

> 第三期目标：提升平台交互体验与持久化能力。包括推理过程可视化、长期记忆系统、Session 回放等。

---

## 需求清单

### R0: PM 拆解模式 Agent 强制绑定 (Prerequisite)

**优先级**: P0 — 已修复 (2026-05-31)

**现状**: 用户在"PM 拆解"模式下仍可手动选择 CodeWhale 等不支持 PM 角色的 Agent，导致 Agent 错误地将需求当作编码任务处理，而非进行任务拆解。CodeWhale 适配器的 `spawnExec` 类型为 `SpawnOptions`，不识别 `mode` 参数。

**修复**: App.vue 添加 `watch(selectedMode)`，当切换到"PM 拆解"时自动将 `selectedAgent` 设为 `reasonix`。

**原则**: PM 拆解 → Reasonix（唯一 PM 角色实现）；对话 → 用户自由选择。

### R1: 推理气泡 (Reasoning Bubble)

**优先级**: P0

**现状**: Reasonix (DeepSeek) 在生成回复前有内部推理（reasoning）阶段，但当前 `platform-output.ts` 的 `loopEventToPlatform()` 只转发 `assistant_delta` 的可见 `content`，忽略了 `LoopEvent.reasoningDelta`。用户在前端看不到任何"思考中"的指示，输出感觉断断续续。

**技术桥接点**:
- Reasonix 侧：`src/loop/types.ts` 中 `LoopEvent` 已有 `reasoningDelta?: string` 字段
- Reasonix 侧：`src/core/eventize.ts` 中已将 reasoning 作为独立事件处理
- Reasonix 侧：`src/cli/platform-output.ts` 的 `loopEventToPlatform()` 需新增处理 `ev.reasoningDelta`，输出带 channel 标记的 progress 事件
- 平台侧：`electron/ipc/agents.ts` 收到带 `channel: "reasoning"` 的 progress 事件后，转发到渲染进程
- 前端侧：App.vue 消息区需新增"推理气泡"UI 组件：
  - 在 agent 消息气泡上方或内部，显示灰/蓝色的推理过程
  - 推理气泡在 agent 开始推理时出现，推理结束时收起或保留
  - 支持实时流式更新（逐 token 追加）

**事件协议扩展**:

```
// Reasonix → 平台 (stdout NDJSON)
{"event":"progress","data":{"message":"...","channel":"reasoning"}}

// 平台 → 渲染进程 (IPC)
{agent:"reasonix",event:{event:"progress",data:{message:"...",channel:"reasoning"}}}
```

**验收标准**:
- 用户发送消息后，立即出现"正在思考..."气泡
- 推理 token 逐字流式显示在气泡中
- 推理结束时，气泡保留或淡化为历史记录
- 可见内容开始输出后，推理气泡与内容气泡区分显示

---

### R2: 长期记忆系统 (Long-term Memory)

**优先级**: P1

**来源**: GOALS.md / PHASE2.md deferred

**描述**:
- 每个 Agent 维护自己的项目级持久化记忆
- 记忆写入 `.agentrouter/projects/{projectId}/memory/` 目录
- 记忆生命周期：创建 → 更新 → 过期/归档
- 支持记忆检索：Agent 启动时自动加载相关记忆作为 system prompt 前缀

**技术要点**:
- 数据库 `memories` 表（sessionId, projectId, agentName, content, key, createdAt, updatedAt）
- 记忆存取 IPC 通道：`db:saveMemory` / `db:loadMemories`
- 记忆注入：Agent 执行时通过 `--memory` 参数或环境变量注入
- 记忆压缩/蒸馏：当记忆过多时自动摘要

---

### R3: Session 回放 (Session Replay)

**优先级**: P1

**来源**: PHASE2.md deferred

**描述**:
- 允许用户回放任意历史会话的事件流
- 前端以原始速度或加速模式重放消息
- 支持"跳到检查点"功能（会话关键节点快照）

**技术要点**:
- 事件存储：`events/` 目录下的 `.jsonl` 文件已包含完整事件流
- 回放 IPC 通道：`agent:replay`
- 前端回放控件：播放/暂停/速度控制/进度条

---

### R4: 工具注入 (MCP 集成)

**优先级**: P1

**现状**: Reasonix `platform` 模式当前无内置文件系统工具；CodeWhale 自带文件读写能力。

**描述**: 平台通过 MCP 协议向 Agent 注入文件系统、代码搜索等工具，使 Reasonix 在 platform 模式下具备实际环境交互能力。

**技术要点**:
- 平台侧启动 MCP Server，暴露 `read_file` / `write_file` / `search_code` 等工具
- Reasonix 启动时通过 `--mcp` 参数连接平台 MCP Server
- 工具调用结果通过 progress 事件流式返回

---

## 各需求技术路径

| 需求 | 需改 Reasonix | 需改平台后端 | 需改前端 |
|---|---|---|---|
| R1 推理气泡 | `platform-output.ts`（新增 reasoning channel） | `ipc/agents.ts`（转发 channel） | `App.vue`（推理气泡组件） |
| R2 记忆系统 | 新增 `--memory` 参数支持 | `database/migrations.ts` + `repository.ts` | `App.vue`（记忆浏览） |
| R3 Session 回放 | 无 | `ipc/agents.ts`（replay 通道） | `App.vue`（回放控件） |
| R4 MCP 集成 | 通过 `--mcp` 参数（已有支持） | 新增 MCP Server 模块 | 无 |

---

## 实现顺序建议

1. **R1 推理气泡** — 改动量最小，体验提升最明显，适合作为 Phase 3 第一个迭代
2. **R4 MCP 集成** — 解锁 Reasonix 的文件读写能力，使 PM 模式更实用
3. **R2 长期记忆系统** — 跨会话上下文持久化，提升持续协作能力
4. **R3 Session 回放** — 开发调试与问题排查利器

---

## 不做

| 事项 | 原因 |
|---|---|
| Agent 内部能力增强 | 平台不侵入 CLI 内部逻辑，能力由 Agent 上游决定 |
| 端到端自动化测试 | 当前无测试框架，后续建立 |
| 多项目仪表盘 | 超出当前范围 |
