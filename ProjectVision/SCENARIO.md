# AgentRouter — 场景推演

> **核心命题：把对的开源 CLI 放在对的位置上**

---

## 核心理念

没有哪个开源 CLI 是万能的。Reasonix 擅长推理规划，CodeWhale 擅长编码执行——**调度器的价值，就是把每个工具放在它最擅长的地方。**

```
Reasonix 🧠 — 建筑师：画图纸、拆任务、审质量
CodeWhale 💻 — 施工队：按图纸干活、实现代码

1+1 > 2，全是开源的，全是低成本的。
```

---

## 场景：给项目加 RBAC 权限系统

### 背景

独立开发者小B，维护一个 Node.js 后端项目。用户量上来了，需要加一套基于角色的权限系统。

### 使用 AgentRouter

---

#### Step 1：打开 AgentRouter，绑定项目

```
小B 打开桌面端
→ 选择项目：D:/workspace/my-backend
→ 平台记住项目路径
```

---

#### Step 2：选 PM + 输入需求

顶部选择 PM 为 Reasonix，输入需求：

```
"给项目加 RBAC 权限系统，支持管理员管理用户角色"
```

---

#### Step 3：Reasonix 拆解任务（建筑师出场）

```
reasonix --mode platform --role pm "..."

stdout → task:start
stdout → progress: "分析项目结构..."
stdout → progress: "梳理 RBAC 需求..."
stdout → completion: {
  summary: "需求分析完成，共拆解为 4 个任务",
  tasks: [
    {
      id: "t1",
      title: "数据库：添加 roles 和 permissions 表",
      assignee: "codewhale",
      path: "./src/models/"
    },
    {
      id: "t2",
      title: "中间件：创建角色校验中间件",
      assignee: "codewhale",
      path: "./src/middleware/",
      depends_on: ["t1"]
    },
    {
      id: "t3",
      title: "API：用户角色管理接口",
      assignee: "codewhale",
      path: "./src/routes/",
      depends_on: ["t1"]
    },
    {
      id: "t4",
      title: "安全审查",
      assignee: "reasonix",
      path: "./src/",
      depends_on: ["t2", "t3"]
    }
  ],
  parallel_groups: [["t1"], ["t2","t3"], ["t4"]]
}
```

**同时产出一份设计说明文档**，写明 RBAC 的表结构设计、API 设计、安全策略。

---

#### Step 4：调度器按依赖图分发（性价比编排）

用户选择 **YOLO 模式**（全自动），调度器开始干活：

```
             t1 (CodeWhale) ← 数据库
            /              \
    t2 (CodeWhale)    t3 (CodeWhale)
    中间件               API
            \              /
           t4 (Reasonix) ← 安全审查
```

| 组 | 任务 | Agent | 做什么 |
|---|---|---|---|
| 第1组 | t1 | CodeWhale | 建 roles 和 permissions 表 |
| 第2组 🚀 | t2 + t3 | CodeWhale × 2 | 并行写中间件 + API |
| 第3组 | t4 | Reasonix | 审查全部代码的安全漏洞 |

---

#### Step 5：实时进度展示

```
┌──────────────────────────────────────────────┐
│ [YOLO]  执行中 (3/4)                   0:28  │
│                                              │
│ ✅ t1  数据库：添加 roles 表   → CodeWhale   │
│ ✅ t2  中间件：角色校验       → CodeWhale   │
│ 🔄 t3  API：角色管理接口      → CodeWhale   │
│ ⏳ t4  安全审查（等待 t2,t3 完成）           │
└──────────────────────────────────────────────┘
```

---

#### Step 6：全部完成

```
┌──────────────────────────────────────────────┐
│ ✅ 全部完成 (4/4)                       1:12  │
│                                              │
│ ✅ t1  数据库：添加 roles 表                 │
│ ✅ t2  中间件：角色校验                      │
│ ✅ t3  API：角色管理接口                     │
│ ✅ t4  安全审查 — 发现 1 个问题 ✅ 已修复    │
│                                              │
│ 总花费（token 计费）：Reasonix ~$0.02        │
│                      CodeWhale ~$0.01        │
│                      ──────────────────      │
│                      总计 ~$0.03              │
└──────────────────────────────────────────────┘
```

### 小B的感受

> 「以前我自己写 RBAC 要半天，用单一 CLI 也要来回修 bug。
> 现在 Reasonix 规划、CodeWhale 执行、Reasonix 再把关——**三个臭皮匠，顶个诸葛亮。**」

---

## 场景二：技术选型调研

### 背景

小B想给项目引入消息队列，但不确定用 RabbitMQ 还是 Kafka。

### 使用 AgentRouter

1. 选 Reasonix 当 PM，输入：_"调研 RabbitMQ 和 Kafka，给出推荐方案"_
2. Reasonix 拆成 3 个子任务：

| 任务 | Agent | 产出 |
|---|---|---|
| RabbitMQ 实现方案 | CodeWhale | Demo 代码 + 部署说明 |
| Kafka 适用场景 | Reasonix | 分析报告 |
| 对比选型 | Reasonix | 综合推荐 + 决策树 |

3. 半小时后，小B拿到一份完整的调研报告+Demo代码。

---

## 模式切换（执行控制）

用户随时可以在四种模式间切换，不打断正在执行的任务：

| 模式 | 行为 | 适合 |
|---|---|---|
| **YOLO** 🚀 | PM拆完→直接执行 | 信心足的项目 |
| **审批** ✅ | 展示任务→确认→执行 | 重要生产环境 |
| **逐步** 👣 | 每组执行前询问 | 想跟进但不全审 |
| **预览** 👀 | 只看计划不执行 | 需求分析阶段 |

---

## 场景价值总结

| 维度 | 单 CLI | AgentRouter |
|---|---|---|
| **规划能力** | 看模型心情 | Reasonix 专职规划，稳定输出 |
| **执行效率** | 单线程串行 | 多 Agent 并行，按依赖图调度 |
| **质量保障** | 无内置审查 | Reasonix Review 兜底 |
| **成本** | 中等 | 开源 CLI 低成本 + 编排减少浪费 |
| **开放性** | 单一工具绑定 | 想换什么 CLI 就换什么 CLI |
