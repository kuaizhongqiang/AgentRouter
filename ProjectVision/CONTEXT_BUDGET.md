# AgentRouter — 上下文预算与粒度控制

> **任务拆得越细，Token 不一定越省——关键在于上下文怎么传递.**

---

## 问题的本质

主人一针见血：每个 Agent 都通读全篇，Token 就炸了。

```
一个 2000 行的脚本，拆成 4 个任务
  → 4 个 Agent 各读 2000 行 = 8000 行输入
  → 实际有效输入只有第 1 次的 2000 行
  → 后 3 次 6000 行全是重复
```

**任务粒度 + 上下文传递方式 = Token 消耗的核心变量。**

```
        Token
         │
   8000  │  💥 4 Agent 各读全量
         │
   4000  │     ✅ 传递增量
         │
   2000  │        🎯 理想：只读一次 + 增量传递
         │
         └──────────────────→ 任务数量
              1      2      3      4
```

---

## Token 消耗模型

### 基础公式

```
单次执行消耗 = 系统提示词 + 用户提示词 + 代码上下文

其中：
  系统提示词 ≈ 固定值（Agent 的角色定义）
  用户提示词 ≈ 任务描述（随任务变化）
  代码上下文 ≈ 需要读取的代码量（决定性因素）
```

### 三种读取模式

#### 模式 A：全量读取（粗粒度）

```
t1 CodeWhale: 改 login.ts
  → 读取 login.ts（2000 行）
  → Token 消耗：2000 行

t2 CodeWhale: 改 register.ts
  → 读取 register.ts（1500 行）
  → Token 消耗：1500 行

✅ 适合：任务边界清晰，各 Agent 读不同的文件
❌ 浪费场景：多个 Agent 读同一个文件
```

#### 模式 B：增量读取（中粒度）

```
t1 CodeWhale: 改 login.ts
  → 读取 login.ts（2000 行）
  → 产出 Diff：+15 -3 行
  → Token 消耗：2000 行

t2 Reasonix: 审查 login.ts 的改动
  → 不读全量
  → 只读 t1 的 Diff（18 行）+ 相关上下文（200 行）
  → Token 消耗：218 行 ← 节省 90%
```

#### 模式 C：差异读取（细粒度）

```
t1 CodeWhale: 改 login.ts
  → 产出 Diff

t2 CodeWhale: 接着改 login.ts
  → 读取 Diff + 最终文件状态
  → 不读中间版本
  → Token 消耗 = Diff 行数 + 最终文件行数的一小部分
```

### 三种模式对比

| 模式 | 读取范围 | Token 效率 | 适用场景 |
|---|---|---|---|
| **全量** 🏋️ | 整个文件 | 低（重复） | 任务读不同文件 |
| **增量** 📊 | Diff + 相关上下文 | 高 | 接力任务、审查 |
| **差异** 🔍 | 最终状态 | 最高 | 迭代修改同一文件 |

---

## Metadata 中的上下文标记

上下文传递的核心：**下游 Agent 凭什么不读全量？因为它知道自己拿到的是增量。**

在消息头 metadata 中标记上下文范围：

```
Sender:
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui",
  "context": {
    "scope": ["src/auth/login.ts", "src/auth/register.ts"],
    "baseline": "commit-abc123",
    "deltas": [
      {"file": "src/auth/login.ts", "type": "modify", "diff": "+15 -3"},
      {"file": "src/auth/register.ts", "type": "create", "size": 42}
    ]
  }
}
```

| 字段 | 作用 |
|---|---|
| `scope` | 这个任务关心的文件范围，告诉 Agent 不用看外面的文件 |
| `baseline` | 基准版本，告诉 Agent 代码是基于哪个版本改的 |
| `deltas` | 上游 Agent 改了哪些文件、怎么改的，告诉 Agent 增量在哪 |

下游 Agent 拿到这个 metadata 后：

```
Agent B 启动
  → 读 metadata.context
  → scope = ["src/auth/login.ts"]  → 只看这个文件
  → deltas = "+15 -3"              → 知道改了哪些行
  → 不需要读整个项目 2000 行
  → 只读 login.ts 的变更部分 + 周边上下文
  → Token 消耗：从 2000 行 → ~200 行
```

---

## 消息流中的上下文传递

```
平台收到消息流：
┌──────────────────────────────────────────────────┐
│ Sender: { label: "Reasonix-PM", id: "pm-001" }   │
│ Event: completion                                  │
│ Data: { tasks: [...] }                             │
│ Context: { scope: ["src/"], deltas: [] }           │
├──────────────────────────────────────────────────┤
│ Sender: { label: "CodeWhale", id: "cw-001" }      │
│ Event: completion                                  │
│ Data: { summary: "新增 roles 表" }                 │
│ Context: {                                          │
│   scope: ["src/models/role.ts"],                    │
│   deltas: [{"file": "src/models/role.ts", ...}]    │
│ }                                                   │
├──────────────────────────────────────────────────┤
│ Sender: { label: "Reasonix-PM", id: "pm-001" }   │
│ Event: progress                                     │
│ Data: { message: "审查 CodeWhale 的产出..." }      │
│ Context: {                                          │
│   scope: ["src/models/role.ts"],                   │
│   basline: "commit-def456",                         │
│   deltas: [← 直接引用 CodeWhale 的 delta]          │
│ }                                                   │
└──────────────────────────────────────────────────┘
```

**关键：PM 审查时不需要重读全量，因为它拿到了 CodeWhale 的增量上下文。**

---

## PM 的粒度控制策略

PM 拆任务时，需要同时考虑三个变量：

```
任务粒度  ↔  Token 成本
执行速度  ↔  并行度
上下文复用 ↔  增量传递效果
```

### 策略一：按文件边界拆（最基础）

```
文件 A（2000 行）→ t1 → Agent 1（全量读取）
文件 B（1500 行）→ t2 → Agent 2（全量读取）
文件 C（800 行） → t3 → Agent 3（全量读取）

✅ 各 Agent 读不同文件，没有重复消耗
✅ 可以并行
✅ PM 拆解时最容易
```

### 策略二：按变更链路拆（最优）

```
同一个文件（2000 行）
  → t1 → CodeWhale: 重构（全量读取 2000 行）
  → t2 → Reasonix: 审查（增量读取 ~200 行）
  → t3 → CodeWhale: 修问题（增量读取 ~50 行）

✅ 只有第一次全量
✅ 后续都是增量，Token 消耗极低
✅ 适合需要多轮打磨的任务
```

### 策略三：按模块切分（平衡）

```
模块 A（auth/ → ~3000 行）
  ├── t1 → CodeWhale: +login.ts
  ├── t2 → CodeWhale: +register.ts  ← 并行
  └── t3 → Reasonix: 审查 auth 模块（增量读取）

✅ 模块内并行
✅ 审查时只读增量
✅ Token 和速度的平衡点
```

### 策略选择矩阵

| 场景 | 推荐策略 | 理由 |
|---|---|---|
| 多个独立文件 | 按文件边界拆 | 简单、并行、无重复 |
| 单文件多轮修改 | 按变更链路拆 | 增量传递省 Token |
| 模块内多子任务 | 按模块切分 | 并行 + 增量兼顾 |
| 全量代码审查 | 单任务 | 必须读全量，拆了反而浪费 |

---

## Token 经济账示例

### 场景：1000 行脚本，拆 3 个任务

```
❌ 无上下文传递（每个 Agent 都读全量）

  t1 CodeWhale:  读 1000 行 → 1000 Token
  t2 CodeWhale:  读 1000 行 → 1000 Token
  t3 Reasonix:   读 1000 行 → 1000 Token
  ───────────────────────────────
  总计：3000 Token
  有效：1000 Token（只有第一次有用）
  浪费：2000 Token（67%）
```

```
✅ 有上下文传递（增量读取）

  t1 CodeWhale:  读 1000 行 → 1000 Token
  t2 CodeWhale:  读 Diff ~50 行 → 50 Token
  t3 Reasonix:   读 Diff ~30 行 → 30 Token
  ───────────────────────────────
  总计：1080 Token
  有效：1080 Token
  浪费：0 Token
```

**节省：64%。** 文件越大、任务越多，节省越明显。

---

## 与标签系统的关系

AGENT_TAGGING.md 中 Agent 的标签应补充上下文预算相关信息：

```json
{
  "identity": { "id": "ar-codewhale", "label": "CodeWhale" },
  "execution_model": {
    "parallel_mode": "multi-process",
    "max_instances": 4
  },
  "context_budget": {
    "preferred_read_mode": "incremental",
    "context_window": "128K",
    "cost_per_1k_tokens": 0.002
  }
}
```

PM 拆任务时：

```
查 CodeWhale 标签
  → context_budget.preferred_read_mode = "incremental"
  → 适合拆成变更链路，用增量传递

查另一个 Agent 标签
  → context_budget.preferred_read_mode = "full"
  → 尽量只拆全量任务给它，避免被插入链路中间
```

---

## 总结

| 问题 | 答案 |
|---|---|
| 每个 Agent 都通读全篇，Token 怎么省？ | 上下文传递：增量 Diff + scope 限制 |
| Metadata 怎么标记上下文？ | `context.scope` + `context.deltas` + `context.baseline` |
| PM 怎么避免 Token 浪费？ | 按文件边界/变更链路/模块切分三种策略 |
| 省多少？ | 典型场景省 60-80%，文件越大省越多 |
