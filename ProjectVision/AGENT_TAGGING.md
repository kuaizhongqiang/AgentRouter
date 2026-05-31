# AgentRouter — Agent 标签系统

> **让 PM 知道"谁适合干什么"，让平台知道"谁在说话"**

---

## 为什么需要标签

没有标签的调度器是瞎子：

```
PM 拿到需求："给项目加 RBAC"
  → Reasonix 和 CodeWhale 都能干，派给谁？
  → PM 不知道它们各自擅长什么
  → 随机派 or 永远派给同一个
  → 浪费了多 Agent 的优势
```

有了标签，PM 就能**知人善任**：

```
PM 查标签库：
  Reasonix    → 长上下文 + 便宜     → 适合读大量代码做规划
  CodeWhale   → DeepSeek 整合好     → 适合推理型编码

PM 指派：
  "架构设计 → Reasonix（它擅长分析全局）"
  "编码实现 → CodeWhale（它编码效率高）"
  "代码审查 → Reasonix（它能看完整个项目上下文）"
```

---

## 两层标签架构

```
┌────────────────────────────────────────────┐
│            Agent 标签系统                    │
├─────────────────────┬──────────────────────┤
│    第一层：注册声明   │    第二层：消息头      │
│  （静态 · 一次性）    │   （动态 · 每条消息）   │
│                     │                      │
│  Agent 接入时声明     │  消息发出时自报家门    │
│  自己是谁、擅长什么   │  告诉平台"我是谁"     │
│  不擅长什么           │  形成消息溯源链      │
│                     │                      │
│  存在数据库 / manifest │  嵌入每条消息的 header│
└─────────────────────┴──────────────────────┘
```

---

## 第一层：Agent 注册声明

Agent 接入平台时，声明自己的能力说明书。

### Reasonix

```json
{
  "identity": {
    "id": "ar-reasonix",
    "label": "Reasonix",
    "version": "0.52.0"
  },
  "tagline": "长上下文推理专家，适合规划和审查",
  "best_for": [
    "阅读分析大量代码文件",
    "需求拆解与任务规划（PM 角色）",
    "代码审查与安全审计",
    "架构设计与方案评估",
    "技术选型调研"
  ],
  "not_for": [
    "快速编码迭代",
    "大规模重构执行"
  ],
  "signature_features": {
    "context_window": "超大 — 能一次读完整个项目",
    "cost": "极低 — 适合大篇幅分析任务",
    "model": "DeepSeek 推理系列"
  },
  "execution_model": {
    "parallel_mode": "sub-agent",
    "description": "单进程内多个子 Agent 并行推理",
    "max_instances": 1
  }
```

### CodeWhale

```json
{
  "identity": {
    "id": "ar-codewhale",
    "label": "CodeWhale",
    "version": "0.8.46"
  },
  "tagline": "DeepSeek 深度整合，推理型编码小能手",
  "best_for": [
    "代码生成与实现",
    "功能模块开发",
    "代码重构",
    "单元测试编写",
    "Bug 修复"
  ],
  "not_for": [
    "长上下文综合分析",
    "安全审计"
  ],
  "signature_features": {
    "deepseek_integration": "深度整合 — 推理能力强",
    "cost": "低",
    "speed": "编码速度快"
  },
  "execution_model": {
    "parallel_mode": "multi-process",
    "description": "多进程并行，每个任务一个独立进程",
    "max_instances": 4
  }
```

### 未来 Agent X（示例）

```json
{
  "identity": {
    "id": "ar-cline",
    "label": "Cline"
  },
  "tagline": "终端操作专家，擅长文件操作和命令行任务",
  "best_for": [
    "文件批量操作",
    "Git 操作",
    "环境配置",
    "自动化脚本"
  ],
  "not_for": [
    "复杂推理",
    "代码审查"
  ],
  "execution_model": {
    "parallel_mode": "single",
    "description": "仅支持单实例串行执行",
    "max_instances": 1
  }
}
```

---

## 第二层：消息头 Metadata

**每条消息都要自报家门。** 主人给的格式：

```
Sender (untrusted metadata):
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui"
}
```

### 在消息流中的实际使用

```
平台收到消息流：
┌────────────────────────────────────────────┐
│ Sender: { label: "Reasonix", id: "reasonix-pm-001" } │
│ Event: task:start                                  │
│ Data: { tasks: [...] }                              │
├────────────────────────────────────────────┤
│ Sender: { label: "CodeWhale", id: "codewhale-001" } │
│ Event: progress                                      │
│ Data: { message: "正在修改 src/auth/login.ts" }     │
├────────────────────────────────────────────┤
│ Sender: { label: "Reasonix", id: "reasonix-pm-001" } │
│ Event: progress                                      │
│ Data: { message: "正在审查代码..." }                 │
└────────────────────────────────────────────┘
```

### 消息头中的执行模型标记

消息头不仅标明身份，还应携带该实例的执行模型信息，方便平台和 PM 做调度决策：

```
Sender (untrusted metadata):
{
  "label": "openclaw-control-ui",
  "id": "openclaw-control-ui",
  "execution": {
    "instance_id": "codewhale-001",
    "parallel_mode": "multi-process"
  }
}
```

这样消息流中的每条消息都自带两个信息：**我是谁** + **我这种 Agent 能不能并行**。

### Metadata 的作用

| 作用 | 说明 |
|---|---|
| **消息溯源** | 每条消息都知道谁发的 |
| **路由判断** | 平台根据 sender 决定消息怎么处理 |
| **历史记录** | 对话日志里能区分哪个 Agent 说了什么 |
| **调度决策** | PM 看到 CodeWhale 干完了，知道接下来该谁上 |

---

## PM 如何根据标签做智能指派

### 两步决策：派给谁 + 派几个

PM 的指派决策分为两步：

```
Step 1: 派给谁？
  → 根据 best_for / not_for 匹配能力

Step 2: 派几个？
  → 根据 execution_model 决定并行度
```

**两条信息缺一不可。**

### 完整指派流程

```
PM 拿到需求："给项目加 RBAC"
  │
  ├── 查标签库
  │   ├── Reasonix
  │   │   ├── best_for: ["规划", "审查"]
  │   │   └── execution: max_instances=1 → 只能串行
  │   │
  │   └── CodeWhale
  │       ├── best_for: ["编码", "实现"]
  │       └── execution: max_instances=4 → 可以并行 4 个
  │
  ├── 匹配任务（能力 + 并行度）
  │   ├── "设计 RBAC 数据库结构"  → Reasonix（1个实例就够了）
  │   ├── "实现 roles 表"         → CodeWhale
  │   ├── "实现权限中间件"        → CodeWhale  ← 并行 3 个，都在 max 以内
  │   ├── "实现 API 接口"         → CodeWhale
  │   ├── "安全审查"             → Reasonix（等上面干完）
  │   └── "汇总结果"             → Reasonix
  │
  └── 产出任务列表 + 并行组
```

### 并行度决策示例

```
场景一：CodeWhale 任务 ≤ 4 个
  → 全部并行，一步到位
  → max_instances=4，没问题

场景二：CodeWhale 任务 6 个
  → 分两批：第一批 4 个并行，第二批 2 个
  → 不超过 max_instances 限制

场景三：Reasonix 任务多个
  → 串行执行，因为它 max_instances=1
  → PM 拆任务时就知道不能并行
```

### 为什么这么派

```
任务："安全审查整段代码"
  → Reasonix → best_for 里有 "安全审计"
               而且 max_instances=1，串行没问题

任务："写用户登录 + 注册 + 鉴权三个接口"
  → CodeWhale × 3 → max_instances=4，可以并行
                     PM 放心拆三个任务

任务："全部代码做一次安全扫描"
  → 不给 CodeWhale → not_for 里有 "安全审计"
                      而且并行再多也不适合干这个
```

---

## 三种并行模式的标签差异

| 模式 | 代表 Agent | max_instances | PM 拆解策略 |
|---|---|---|---|
| **sub-agent** 🧩 | Reasonix | 1 | 只拆 1 个任务，任务内部的子任务由它自己并行 |
| **multi-process** 🚀 | CodeWhale | 4 | 可拆多个任务并行，不超过 max_instances |
| **single** 🐌 | 某些轻量 CLI | 1 | 只能串行，需要排队 |

PM 拆任务时必须同时考虑这三者：**能力匹配 + 并行度 + 串行兜底**。

## Agent 接入规范

新 Agent 接入平台时，必须提供标签声明：

```json
{
  "identity": {
    "id": "unique-agent-id",
    "label": "Human Readable Name",
    "version": "x.y.z"
  },
  "tagline": "一句话描述你的特色",
  "best_for": [
    "场景1",
    "场景2"
  ],
  "not_for": [
    "场景3",
    "场景4"
  ],
  "signature_features": {
    "feature_1": "描述",
    "feature_2": "描述"
  },
  "execution_model": {
    "parallel_mode": "multi-process | sub-agent | single",
    "description": "自然语言描述并行方式",
    "max_instances": 4
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `identity.id` | ✅ | 唯一标识，全局不可重复 |
| `identity.label` | ✅ | 人看的名字 |
| `tagline` | ✅ | 一句话特色，PM 第一眼看到的就是这个 |
| `best_for` | ✅ | 至少 1 个，告诉 PM 你最适合干什么 |
| `not_for` | ❌ | 可选，告诉 PM 别让你干什么 |
| `signature_features` | ❌ | 可选，你的独门绝技 |
| **`execution_model`** | ✅ | **并行模式 + 最大实例数**，PM 拆任务时必查 |

---

## 标签与协同模型的关系

标签系统与 COLLABORATION.md 中定义的协同模型无缝衔接：

```
COLLABORATION.md 说：
  "调度器按能力标签匹配"
  "PM 需要知道谁擅长什么"

AGENT_TAGGING.md 说：
  "标签在这——PM 照着这个指派"
  "每条消息带 metadata——平台知道谁在说话"
```

**没有标签系统，协同模型只是一个空壳。标签就是让调度变聪明的数据。**

---

## 未来扩展

| 方向 | 说明 |
|---|---|
| **动态标签** | Agent 运行中根据实际表现自动调整标签 |
| **用户自定义标签** | 用户可以覆盖/补充 Agent 的标签 |
| **社区标签库** | Agent 注册到社区市场时自动公开标签 |
| **标签冲突检测** | 两个 Agent 标签高度重叠时，调度器自动发现 |
