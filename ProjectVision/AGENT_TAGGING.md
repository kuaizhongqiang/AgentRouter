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
  }
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
  }
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
  ]
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

### Metadata 的作用

| 作用 | 说明 |
|---|---|
| **消息溯源** | 每条消息都知道谁发的 |
| **路由判断** | 平台根据 sender 决定消息怎么处理 |
| **历史记录** | 对话日志里能区分哪个 Agent 说了什么 |
| **调度决策** | PM 看到 CodeWhale 干完了，知道接下来该谁上 |

---

## PM 如何根据标签做智能指派

### 指派流程

```
PM 拿到需求："给项目加 RBAC"
  │
  ├── 查标签库
  │   ├── Reasonix    → best_for: ["规划", "审查"]
  │   └── CodeWhale   → best_for: ["编码", "实现"]
  │
  ├── 匹配任务
  │   ├── "设计 RBAC 数据库结构"   → tag: "架构设计"     → Reasonix
  │   ├── "实现 roles 表"          → tag: "代码生成"     → CodeWhale
  │   ├── "实现权限中间件"         → tag: "功能开发"     → CodeWhale
  │   ├── "安全审查"              → tag: "安全审计"     → Reasonix
  │   └── "汇总结果"              → tag: "方案评估"     → Reasonix
  │
  └── 产出任务列表
```

### 为什么这么派

```
任务："安全审查整段代码"
  → Reasonix → 因为它 best_for 里有 "安全审计"
               而且 context_window 大，能读完整项目

任务："写一个用户登录接口"
  → CodeWhale → 因为它 best_for 里有 "代码生成"
                 而且编码快，适合这种明确的小任务

任务："评估用 RabbitMQ 还是 Kafka"
  → Reasonix → 因为它 best_for 里有 "技术选型调研"
               长上下文适合对比分析
```

---

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
