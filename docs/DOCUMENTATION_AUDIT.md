# AgentRouter 文档审计报告

> 审计日期：2026-05-30
> 审计范围：`docs/` 目录全部文件 + `AGENTS.md` + `README.md`
> 审计人：CodeWhale (DeepSeek V4 Flash)
> 审计目的：评估文档体系是否符合项目的核心定位——"轻量级平台，调度多个开源 CLI 协同完成同一项目"，并给出改进建议。

---

## 一、概览：文档清单与状态

### 已有文档

| 文件 | 长度 | 状态 | 作用 |
|---|---|---|---|
| `README.md` | ~80 行 | ✅ 基本完整 | 项目介绍、架构、开发命令 |
| `AGENTS.md` | ~60 行 | ❌ 空壳 | 给 AI 助手的项目指南 |
| `GOALS.md` | ~100 行 | ✅ 清晰 | 核心目标定义 |
| `ARCHITECTURE.md` | ~80 行 | ⚠️ 未决 | 架构模式讨论，无最终决策 |
| `PHASE1.md` | ~80 行 | ✅ 具体 | 第一期实施范围 |
| `SCENARIO.md` | ~240 行 | ✅ 详尽 | 全流程场景推演 |
| `PROTOCOL.md` | ~120 行 | ✅ 完整 | CLI↔平台通信协议 |
| `CLI_MODIFICATION.md` | ~200 行 | ✅ 详细 | 两个 CLI 的改造方案 |
| `FORK_MANAGEMENT.md` | ~100 行 | ⚠️ 未落地 | Fork 改名与署名规范 |
| `OUTPUT_MANAGEMENT.md` | ~100 行 | ✅ 完整 | Agent 产出文件管理 |

### 缺失的核心文档

| 应有文档 | 缺失影响 |
|---|---|
| 用户指南 / 如何上手 | 新用户不知道打开后怎么用 |
| 开发者指南 / CONTRIBUTING | 外部开发者无法参与 |
| 数据库 Schema 参考 | 改动 DB 全靠读代码 |
| IPC API 参考 | 前端-后端接口无独立文档 |
| 组件树 / 前端架构 | 前端逻辑全在 App.vue 里，无拆分解耦文档 |
| 测试策略 | npm test 跑什么？怎么测？ |
| 部署与发布清单 | 打包、分发、更新流程 |
| FORK.md（每个 agent 目录下） | 两处 fork 无来源声明 |
| 架构决策记录 (ADR) | 为什么选 B、不选 A/C？ |

---

## 二、逐一审计

### 1. README.md

**优点**：简洁，三栏架构图一目了然，开发命令覆盖面够。

**问题**：

1. **功能描述与实现脱节**。原文说"Agent 自动生成 \[任务\]"——当前代码中任务只能手动通过 IPC 创建 (`addTask`)，没有"自动生成"机制。UI 中任务面板展示的是静态列表，和 Agent 执行流程无任何联动。

2. **缺少 Agent 生态说明**。只说"整合多个 CLI"，但没有说明当前实际只接了 CodeWhale，Reasonix 还在规划中。用户下载后看不到 Reasonix 的影子，会产生困惑。

3. **缺少系统要求**。需要 Node.js 版本？需要 CodeWhale CLI 全局安装？这些依赖没有说明。

4. **无截图 / 界面预览**。这是桌面应用，一张截图胜千言。

### 2. AGENTS.md

**问题**：

整份文件是**空白模板**，所有 `<!-- ... -->` 注释内的内容都是占位符，没有填写任何实际信息。

- "Commands" 中 `npm test` 不存在（package.json 没有 `test` 脚本）
- "Architecture" 下 Entry Points、Key Modules、Data Flow 全空
- "Never edit"、"Always test with" 等 AI 协作字段全未填写
- Cache Stability 指南有用但被注释包裹，AI 读取时不会解析注释

**建议**：这是 AI 助手阅读频率最高的文件之一，应该立即填实。

### 3. GOALS.md

**优点**：定位清晰、边界明确。"非目标"部分写得特别好——不做 IDE、不做新 CLI、不做能力增强，这防止了范围蔓延。

**问题**：

1. **目标-实现映射缺失**。G1（多 Agent 调度）描述得很好，但当前实现只接了一个 CodeWhale，且是 `agent-manager.cjs` 里硬编码的 `spawn('codewhale', ...)`，没有注册机制、没有适配器接口、没有选型 UI。目标状态表里写的是"多 Agent 可扩展"和"适配器模式，统一管理"——代码中这些都不存在。

2. **当前状态→目标状态表没有时间线**。从"仅 CodeWhale（硬编码）"到"多 Agent 可扩展"是个大跳跃，中间缺了中间状态的定义。

3. **缺少成功指标**。怎样才算"多 Agent 调度做好了"？没有一个可验证的定义。

### 4. ARCHITECTURE.md

**优点**：讨论了三种架构模式（A 内置协调、B 平台=基础设施、C 混合），并给出了倾向（模式 B）。

**问题**：

1. **这是一份讨论记录，不是架构决策**。最后的"我的建议"是对话语气，没有正式决策记录。推荐什么、谁决定的、什么时候决定的、为什么——这些结构化信息缺失。

2. **模式 B 的"平台=基础设施"与 SCENARIO.md 矛盾**。SCENARIO.md 描述的流程中平台做了大量调度决策（按 `parallel_groups` 调度、维护执行状态、模式切换），这些不是"纯基础设施"的职责。文档之间存在隐式矛盾。

3. **缺少数据流图 / 时序图**。用户→平台→Agent 之间的消息流转只有文字描述，没有形式化表达。

### 5. PHASE1.md

**优点**：交付标准写得好——有明确的"完成标志"场景，可验证。

**问题**：

1. **范围过宽，实现进度为零**。看代码：
   - TypeScript 迁移 → 所有文件仍然是 `.cjs` / `.js`
   - IPC 层拆分 → 所有 `ipcMain.handle` 仍在 `main.cjs` 一个文件中
   - Agent 适配器框架 → 不存在，`AgentManager` 是单一实现
   - CLI 改造 → 一个都没做，`codewhale` 作为系统命令被调用
   - 前端 PM 选择器 → 不存在
   - 模式选择器 → 不存在
   - `agent_logs` 表 → 不存在
   - 事件写入 `.jsonl` → 不存在

   **第一期的实际交付物为零**。文档定义了目标，但代码没有朝这个目标推进。

2. **"第一期不做"列表很好**，但对当前优先级判断有误——在最简能跑通之前，加 Pinia 组件拆分的确不应该做，但缺少一个更短的"第零期"：让当前的 Agent 选择和工作流先可用。

3. **交付标准依赖尚未存在的 CLI 改造**。"PM 拆解任务"依赖 Reasonix 的 `--role pm` 模式——这个模式本身是 PHASE1 的一部分，但需要先改造 Reasonix CLI。这变成了一个互相依赖的死锁。

### 6. SCENARIO.md

**优点**：最详尽的文档，把整个流程从用户输入到任务完成的每一步都推演了。YOLO/审批/逐步/预览四种模式的描述清晰。

**问题**：

1. **超卖严重**。描述的 244 行 UX 几乎全部**不存在于当前代码中**。当前 App.vue 只有：左侧项目列表、中间对话标签页+输入框+消息列表、右侧任务列表。没有 PM 下拉、没有模式选择器、没有任务确认对话框、没有并行执行、没有事件流展示。这份文档描述的是完全不同的产品。

2. **PM 角色定义模糊**。"PM 拆解任务"的功能到底由谁实现？
   - 如果是 Reasonix 的 `--role pm` 模式，那需要先完成 `CLI_MODIFICATION.md` 中的改造计划
   - 如果是平台内置的能力，那属于 ARCHITECTURE.md 中"模式 A"的范围——与建议的"模式 B"矛盾
   - 文档对此没有明确声明

3. **任务数据格式在 SCENARIO 和 PROTOCOL 之间重复**。两者都定义了类似的任务结构（`tasks`、`depends_on`、`parallel_groups`），但格式不完全一致，没有说哪一个为权威定义。

### 7. PROTOCOL.md

**优点**：协议设计干净，JSON Lines 格式、与 MCP 对齐、预留后续扩展点。

**问题**：

1. **协议没有版本号**。一旦开始实施，协议迭代需要版本管理。缺少 `protocol_version` 字段。

2. **缺关键字段**。所有事件缺少 `id`（事件 ID，用于追踪）、`session_id`（会话 ID，多会话时区分）、`timestamp`。文档考虑到了但**协议定义中没加**。

3. **第二阶段（工具调用、问答、子 Agent）** 协议设计巧妙，但第一阶段的事件太薄——只有 `task:start` / `progress` / `completion` / `error` / `cancelled` 五个事件。Agent 实际执行中大量有价值的信息（思考过程、决策理由、中间产物）没有表达空间。

4. **Streaming vs. 批处理**。`progress` 事件定义为一次性消息，但如果 Agent 长时间执行（如 CodeWhale 生成多文件），缺乏细粒度的流式更新机制。

### 8. CLI_MODIFICATION.md

**优点**：改造方案具体到文件名、行号、代码片段。对两个 CLI 的分析到位。

**问题**：

1. **CodeWhale 改动量估计偏低**。说只有 ~30 行改动，但 CodeWhale 的主事件循环、输出格式、参数解析是分散在多个 crate 中的。`run_exec_agent()` 在 line 5126（一个 5000+ 行的主文件），简单加几行不如重构成模块化事件分发可靠。

2. **Reasonix 的 PM 模式缺少关键细节**。"方式 A（改 prompt 让 LLM 输出 JSON）" 是简单，但在实测中 LLM 输出格式不稳定，JSON 解析失败时没有错误恢复机制。建议改为"方式 A + 格式校验重试"或"方式 B（工具调用）"。

3. **缺少手动测试 / 验证步骤**。改造完成后怎么确认正确工作？没有验证 checklist。

4. **没有 fallback 策略**。如果 CLI 不支持 `--mode platform` 怎么办？应该有一个兼容模式退回到纯文本输出。

### 9. FORK_MANAGEMENT.md

**优点**：FORK.md 模板很好，改名方案完整。

**问题**：

1. **FORK.md 文件不存在**。`agents/codewhale/FORK.md` 和 `agents/reasonix/FORK.md` 都是目录中**没有的文件**。文档说"放一个 FORK.md"，但无实际落地。

2. **改名与上游解耦的矛盾**。改名 `ar-codewhale` / `ar-reasonix` 避免冲突是对的，但 fork 的维护成本没说清楚——每次上游发版，怎么 rebase？怎么处理冲突？文档提到"git rebase 或手动合并 tag"，但对项目的长期维护来说这不够。

3. **缺少许可证兼容性说明**。两个上游项目都是 MIT 许可证，`AgentRouter` 本身是 MIT 吗？LICENSE 文件需要明确。

### 10. OUTPUT_MANAGEMENT.md

**优点**：存储结构设计合理（`events/`、`artifacts/`、`workspace/`），推荐了选项 A（直接工作）。

**问题**：

1. **agent_logs 表只存在于文档中**。数据库的 schema 中没有这张表，代码中也没有对应的 CRUD。

2. **"扫描工作目录中新文件"过于乐观**。git 跟踪的文件、node_modules、临时文件如何区分？不做细化的话 artifact 目录会变成垃圾堆。

3. **events/ 文件命名不规范**。`01-codewhale.jsonl` 这种前缀编号在多 Agent 并行执行时会有竞争——应该用 `{agent_type}-{started_at}-{uuid}.jsonl`。

---

## 三、跨文档一致性问题

### 3.1 架构模式矛盾

| 文档 | 暗含的架构模式 | 矛盾点 |
|---|---|---|
| `ARCHITECTURE.md` | 模式 B（平台=基础设施，不做调度决策） | |
| `SCENARIO.md` | 模式 A/B 混合（平台做大量调度、状态管理、模式控制） | 平台做了远超"纯基础设施"的职责 |
| `PROTOCOL.md` | 模式 A（CLI 通过 tool_request 向平台要能力） | 第二阶段允许 CLI 调用平台能力，属于"CLI 依赖平台"模型 |
| 当前代码 | 单 Agent、无调度、无模式 | 三个文档中的任何一个都没有被实现 |

**根源**：架构讨论从未正式做出决策，也没有记录决策理由。不同的文档基于不同的默认假设。

### 3.2 功能承诺差距

按 SCENARIO.md 描述的完整用户旅程，逐段对比当前实现：

| 步骤 | SCENARIO.md | 代码实现 |
|---|---|---|
| 绑定项目 | 有 | ✅ 有（createProject + selectProject） |
| 选 PM | Reasonix 下拉选择 | ❌ 无 |
| 选择模式 | YOLO/审批/逐步/预览 | ❌ 无，默认直接发送给 CodeWhale |
| PM 分析需求 | Reasonix 输出任务列表 | ❌ 无，只有用户→Agent 直接对话 |
| 展示任务列表 | 任务看板 + 确认 | ❌ 无，右侧任务列表无联动 |
| 按 parallel_groups 并行调度 | 多 Agent 并发 | ❌ 无，单 Agent 串行 |
| 事件实时展示 | 进度、状态、日志 | ❌ 无，只有文本消息 |
| 全部完成 | 对话可继续 | ❌ 无任务完成聚合视图 |

**结论**：功能承诺与实现之间的差距大约是 **90%**。

### 3.3 数据格式不一致

- `SCENARIO.md` 中任务结构：`id` / `title` / `assignee` / `path` / `depends_on` / `parallel_groups`
- `PROTOCOL.md` 中 completion data：`summary` / `tasks`（格式未严格定义）
- `OUTPUT_MANAGEMENT.md` 中日志事件：`type` / `event` / `data` / `timestamp`
- 数据库 `tasks` 表：`id` / `sessionId` / `projectId` / `title` / `status` / `createdAt` / `updatedAt`

**问题**：`assignee`、`depends_on`、`parallel_groups` 这些 SCENARIO 中的关键字段在数据库表中不存在。协议事件和数据库 Schema 之间没有映射关系。

---

## 四、代码中的增量问题（由审计触发发现）

### 4.1 AgentManager 是单 Agent 硬编码

```javascript
spawn('codewhale', ['exec', '--output-format', 'stream-json', command], { shell: true })
```

- 没有 Agent 注册表
- 没有适配器接口
- 没有错误回退（codewhale 命令不存在则报错）
- 所有输出用 `send('output', line)` 打平发送，丢失了事件结构
- `doctor()` 命令也不判断 CLI 是否安装

### 4.2 IPC 层集中且无错误边界

`main.cjs` 中的 14 个 `ipcMain.handle` 全部内联在一个文件中。每个 handler 没有独立的错误处理，异常会全部冒泡到 Electron 的未捕获异常。

### 4.3 数据库层缺少级联删除和约束

`removeProject` 中手工写了 4 条 `DELETE` 语句模拟级联删除，但后续 `removeSession` 只删 messages 和 sessions，没有删对应的 tasks。外键约束定义在 `CREATE TABLE` 中，但 sql.js 默认不检查外键（需要 `PRAGMA foreign_keys = ON`），当前代码未设置。

### 4.4 UI 中 Agent 选择缺失

当前输入框写着"输入命令给 **CodeWhale**…"，UI 中不存在选择 Agent 的控件。对话区上方的标签只管理"会话"（sessions），不管理"Agent 选择"或"执行模式"。

### 4.5 任务系统与执行流脱节

右侧任务面板展示所有任务，但没有"创建任务→关联对话→关联 Agent 执行"的 UI 流程。`addTask` 在 preload 中暴露了但 App.vue 中从未调用——任务永远不会被创建。

---

## 五、扩展建议（基于核心定位）

在修复上述问题的基础上，以下是对项目有意义的方向性扩展：

### E1：Agent Registry + 适配器接口（高优先级）

当前最缺的设施。定义 `AgentAdapter` 接口：

```typescript
interface AgentAdapter {
  name: string
  type: 'cli' | 'builtin'
  spawn(task: TaskSpec): ChildProcess
  parseOutput(chunk: string): AgentEvent[]
  validate(): boolean  // 检查 CLI 是否可用
}
```

- CodeWhaleAdapter 和 ReasonixAdapter 各实现一个
- 平台通过适配器注册表管理所有 Agent
- `AgentManager` 重写为接受适配器的通用调度器

### E2："零期"最小闭环

不等完整的 CLI 改造，在第一期之前先做一个最小可用版本：

```
用户选项目 → 选 Agent（CodeWhale / Reasonix） → 发送消息 → 当前 Agent 回复
```

当前代码已经接近这个状态，只需要：
- 加一个 Agent 选择器（下拉框或按钮组）
- 让 `AgentManager` 能根据选择 spawn 不同的 CLI
- 规划中但未实现的 Reasonix `run` 命令可以直接用非交互模式接入

这个"零期"可以在**数小时**内完成，并能立即验证"多 Agent 调度"的核心命题。

### E3：事件驱动的状态管理

当前消息流是纯粹的文本拼接。建议改为事件驱动：

- 每个 Agent 输出是一个事件流（对应 PROTOCOL.md）
- 前端按事件类型分类渲染：进度条、代码 diff、状态徽章
- 事件同时写入 `.jsonl` 和数据库，可回溯、可重放

### E4：任务依赖图渲染

SCENARIO.md 中 `depends_on` + `parallel_groups` 是非常好的设计。前端可以增加简单的 DAG 可视化（用 SVG 或 Canvas），让用户直观看到任务调度顺序。

这不应该是第一期内容，但应在架构中预留数据模型支持。

### E5：对话→Agent 映射

当前所有消息都在一个平铺的消息列表中。在多 Agent 场景下，需要标注每条消息由哪个 Agent 产生：

```
[CodeWhale] 正在修改 src/auth/rbac.ts…
[Reasonix]  审查完成，发现 2 个问题
```

数据库的 messages 表可以增加一个 `agentType` 字段支持。

### E6：日志归档 + 会话重放

`OUTPUT_MANAGEMENT.md` 中的 events/ 目录设计很好。可以更进一步：
- 提供"回放"功能：从 `.jsonl` 文件重建一次对话的完整过程
- 提供"导出"功能：把对话导出为 Markdown / HTML 报告

---

## 六、修改建议汇总

### 优先级 P0（修了才能发布）

| # | 问题 | 文件 | 建议 |
|---|---|---|---|
| A-1 | AGENTS.md 为空模板 | `AGENTS.md` | 填写所有字段：命令、架构、AI 指导 |
| A-2 | FORK.md 不存在 | `agents/*/FORK.md` | 按 FORK_MANAGEMENT.md 模板创建 |
| A-3 | README.md 功能描述与代码脱节 | `README.md` | 如实反映当前状态，加"规划中"标记 |
| A-4 | 缺少许可证声明 | `LICENSE` + `README.md` | 明确 AGPL / MIT 等许可证 |

### 优先级 P1（影响开发效率）

| # | 问题 | 文件 | 建议 |
|---|---|---|---|
| B-1 | 缺少架构决策记录 | 新建 `docs/ADR-001-platform-architecture.md` | 把 ARCHITECTURE.md 的讨论固化为正式 ADR |
| B-2 | 数据库 Schema 无独立文档 | 新建 `docs/DATABASE_SCHEMA.md` | 描述所有表、字段、约束、迁移策略 |
| B-3 | IPC API 无文档 | 新建 `docs/IPC_API.md` | 列出所有 channel、参数、返回值 |
| B-4 | 缺少开发者指南 | 新建 `CONTRIBUTING.md` | 环境搭建、开发流程、PR 规范 |

### 优先级 P2（提升质量）

| # | 问题 | 文件 | 建议 |
|---|---|---|---|
| C-1 | 协议事件缺少标准字段 | `PROTOCOL.md` | 加 `id`、`session_id`、`timestamp` |
| C-2 | 协议缺少版本号 | `PROTOCOL.md` | 加 `protocol_version: "1.0"` |
| C-3 | PHASE1 范围过宽 | `PHASE1.md` | 拆 P0 + P1，或缩窄到"零期"闭环 |
| C-4 | 数据格式多处重复定义 | `SCENARIO.md` / `PROTOCOL.md` | 统一到一个权威定义 |
| C-5 | 任务数据库缺少调度字段 | `electron/database.cjs` | 加 `assignee`、`dependsOn`、`parallelGroup` |
| C-6 | 缺少测试策略文档 | 新建 `docs/TESTING.md` | 单元测试、集成测试、E2E 测试范围 |

### 优先级 P3（锦上添花）

| # | 问题 | 文件 | 建议 |
|---|---|---|---|
| D-1 | SCENARIO 超卖 | `SCENARIO.md` | 加"当前状态"标记，区分规划与已实现 |
| D-2 | ARCHITECTURE 无结论 | `ARCHITECTURE.md` | 追加 ADR 引用和最终决策 |
| D-3 | 缺少截图 | `README.md` | 加当前界面的实机截图 |
| D-4 | 缺少用户指南 | 新建 `docs/USER_GUIDE.md` | 截图 + 步骤式说明 |

---

## 七、核心命题回归检查

> **项目的核心意义**：一个轻量级平台，实现调用多个不同开源 CLI 执行同一个项目。

围绕这个核心命题，审计的核心发现：

| 维度 | 评分 | 说明 |
|---|---|---|
| **目标定义** | A | GOALS.md 对核心命题的表述准确、边界清晰 |
| **架构设计** | B- | ARCHITECTURE.md 有深度讨论但未形成决策 |
| **协议定义** | A- | PROTOCOL.md 简洁、可扩展、与 MCP 对齐 |
| **场景推演** | A | SCENARIO.md 展示了核心命题的完整价值闭环 |
| **CLI 改造方案** | B+ | 具体到代码级，但低估了实践复杂度 |
| **代码实现** | D | 当前代码只完成了"单 CLI 对话"的最基础功能，与核心命题的"多 CLI 协同调度"差距巨大 |
| **文档-代码一致** | D- | 文档描述了一个产品，代码实现了另一个产品的 10% |
| **文档体系完整性** | C | 覆盖了"规划"层面，缺少"实现"和"使用"层面的文档 |

**最关键的发现并非文档的质量，而是文档与代码之间的断层。** 8 份规划文档构建了一个完整的产品愿景，但代码中只有零星的基础设施落地。如果不缩小这个差距，文档会从"指南"变成"幻象"——新加入的开发者读完后找不到文档中说的功能，会失去信任。

**建议的根因修复**：在 `docs/` 下新增一份 `ROADMAP.md`，跟踪每个文档中描述的功能的实现状态（planned / in progress / done / deferred），每次代码更新同步更新这张状态表。同时在 `README.md` 顶部加一个醒目的"功能状态"徽章行。

---

## 附录：文档健康检查表

| 检查项 | 通过 | 备注 |
|---|---|---|
| README 有明确的项目定位 | ✅ | "多 Agent 协同桌面平台" |
| README 有安装/使用步骤 | ⚠️ | 有开发命令，无安装说明 |
| README 有架构概览图 | ✅ | ASCII 目录树 |
| README 有功能列表 | ⚠️ | 功能列表与实际实现脱节 |
| AGENTS.md 内容完整 | ❌ | 全空白模板 |
| 所有文档的作者/日期清晰 | ❌ | 全部无审计追踪信息 |
| 跨文档链接有效 | ❌ | 无交叉引用 |
| 文档版本与代码版本一致 | ❌ | 多个文档描述尚未实现的功能 |
| 有开发者贡献指南 | ❌ | 不存在 |
| 数据库 Schema 有独立文档 | ❌ | 仅内嵌在代码中 |
| 有用户 FAQ 或常见问题 | ❌ | 不存在 |
| 文档有更新日期 | ❌ | 全部无日期信息 |
