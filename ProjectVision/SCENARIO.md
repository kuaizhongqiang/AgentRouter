# AgentRouter — 场景推演

---

## 核心场景：动态编排

> **Reasonix 当建筑师画图纸，CodeWhale 当施工队干活，过程中随时调整。**

---

## 场景：给项目加 RBAC 权限系统

### Step 0：项目已绑定

小B 打开 AgentRouter，选了一个 Node.js 后端项目。平台记住了路径和项目 ID。

### Step 1：选 PM + 输入需求

顶部选 Reasonix 当 PM（默认），输入：

```
"给项目加 RBAC 权限系统，支持管理员管理用户角色"
```

### Step 2：Reasonix 知情拆解

PM 先读项目结构，再拆任务：

```
读 package.json → 技术栈
读 src/routes/ → 现有路由风格
读 src/models/ → 现有数据库模型
```

拆解结果：

```json
{
  "_sender": { "label": "Reasonix-PM", "id": "pm-001" },
  "event": "completion",
  "data": {
    "summary": "需求分析完成，拆解为 4 个任务",
    "tasks": [
      {
        "id": "t1",
        "title": "数据库：添加 roles 和 permissions 表",
        "assignee": "codewhale",
        "path": "./src/models/",
        "depends_on": [],
        "output_contract": {
          "files": ["./src/models/role.ts", "./src/models/permission.ts"],
          "type": "create"
        }
      },
      {
        "id": "t2",
        "title": "中间件：创建角色校验中间件",
        "assignee": "codewhale",
        "path": "./src/middleware/",
        "depends_on": ["t1"]
      },
      {
        "id": "t3",
        "title": "API：用户角色管理接口",
        "assignee": "codewhale",
        "path": "./src/routes/",
        "depends_on": ["t1"]
      },
      {
        "id": "t4",
        "title": "安全审查",
        "assignee": "reasonix",
        "path": "./src/",
        "depends_on": ["t2", "t3"]
      }
    ],
    "parallel_groups": [["t1"], ["t2","t3"], ["t4"]]
  }
}
```

**标签系统在起作用：**
- CodeWhale → `best_for: ["代码生成"]`，`max_instances: 4` → t1/t2/t3 都派给它，并行没问题
- Reasonix → `best_for: ["安全审计"]`，`max_instances: 1` → t4 等前面干完再上

PM 同时为每个任务生成了 context 范围（省 Token 的基础）：

```
t1 → context: { scope: ["src/models/"], deltas: [] }       ← 全量读
t2 → context: { scope: ["src/middleware/"], deltas: [t1] }  ← 增量读
t3 → context: { scope: ["src/routes/"], deltas: [t1] }      ← 增量读
t4 → context: { scope: ["src/"], deltas: [t1+t2+t3] }       ← 只读增量
```

### Step 3：调度器按并行组执行

用户选了 YOLO 模式，调度器开始调度：

```
第1组（串行）→ t1 CodeWhale → spawn 进程 PID 1001
  等待 t1 完成
第2组（并行）→ t2 CodeWhale → spawn 进程 PID 1002
              t3 CodeWhale → spawn 进程 PID 1003
  等待全部完成
第3组（串行）→ t4 Reasonix → spawn 进程 PID 1004
```

### Step 4：执行中 Agent 提建议（动态调整）

**这是核心场景的关键转折点。**

t1 CodeWhale 在执行中发现了更好的方案：

```
t1 CodeWhale 正在建 roles 表
→ 发现当前项目没有统一的配置管理模块
→ alpha 脚本里写死了数据库配置
→ 如果 t3（API 接口）能顺便抽离一个配置模块，整体架构会更干净
```

t1 通过 suggestion 事件向 PM 提建议：

```json
{
  "_sender": {
    "label": "CodeWhale",
    "id": "cw-001",
    "context": { "scope": ["src/models/"], "deltas": [...] }
  },
  "event": "suggestion",
  "data": {
    "target_agent": "codewhale",
    "target_task": "t3",
    "suggestion": "建议在 t3 中增加一个配置加载模块 src/config/loader.ts",
    "reason": "当前项目中数据库配置写死在多个脚本里。如果 t3 抽离配置层，后续维护会方便很多，也符合单一职责原则"
  }
}
```

### Step 5：PM 评估并动态调整

平台收到 suggestion → 检查 PM 进程 → 还在 → 转发。

PM 评估：

```
PM 分析：
  ✅ 建议合理 — 确实缺少配置层
  ✅ 不冲突 — t3 还没开始执行
  ✅ 范围可控 — 加一个文件而已

PM 决策：
  → 修改 t3 的任务描述
  → 追加 scope
```

```json
{
  "_sender": { "label": "Reasonix-PM", "id": "pm-001" },
  "event": "task:update",
  "data": {
    "task_id": "t3",
    "changes": {
      "description": "API：用户角色管理接口 + 配置加载模块",
      "path": "./src/routes/, ./src/config/"
    },
    "reason": "采纳 CodeWhale 的建议，让 t3 同时抽离配置层"
  }
}
```

调度器将更新后的任务描述注入 t3 的进程上下文。

### Step 6：任务回收与上下文传递

t1 完成，产出回收包：

```json
{
  "_sender": {
    "label": "CodeWhale",
    "id": "cw-001",
    "context": {
      "scope": ["src/models/"],
      "deltas": [
        { "file": "src/models/role.ts", "type": "create", "size": 120 },
        { "file": "src/models/permission.ts", "type": "create", "size": 85 }
      ]
    }
  },
  "event": "completion",
  "data": { "summary": "roles 和 permissions 表创建完成" }
}
```

t2 启动，**不读全量，只读增量**：

```
t2 读取 metadata.context.deltas
  → 知道 t1 建了两个文件
  → 知道 role.ts 和 permission.ts 的结构
  → 不需要读这 205 行代码
  → 直接在自己的中间件中引用
  → Token 节省：205 行
```

同理 t3 启动时也拿到了 t1 的增量 + PM 更新后的任务描述。

### Step 7：多 Agent 并行执行

```
第2组执行中（并行）：

┌──────────────────────────────────────────────┐
│ [YOLO]  执行中 (2/4)                   0:45  │
│                                              │
│ ✅ t1  数据库：添加 roles 表   → CodeWhale   │
│ 🔄 t2  中间件：角色校验       → CodeWhale   │
│ 🔄 t3  API + 配置加载模块    → CodeWhale   │
│ ⏳ t4  安全审查（等待中）                     │
│                                              │
│ 🔔 t3 任务已更新（采纳了 A 的建议）          │
└──────────────────────────────────────────────┘
```

### Step 8：安全审查 + 最终汇总

t2/t3 完成后，t4 Reasonix 启动做安全审查。

t4 拿到的是 **全量增量**（t1 + t2 + t3 的所有变更），不需要重新读整个项目：

```json
{
  "_sender": {
    "label": "Reasonix-PM",
    "id": "pm-001",
    "context": {
      "scope": ["src/"],
      "baseline": "commit-def456",
      "deltas": [
        { "file": "src/models/role.ts", "type": "create" },
        { "file": "src/models/permission.ts", "type": "create" },
        { "file": "src/middleware/rbac.ts", "type": "create" },
        { "file": "src/routes/role.ts", "type": "create" },
        { "file": "src/config/loader.ts", "type": "create" }
      ]
    }
  },
  "event": "progress",
  "data": { "message": "审查新增的 5 个文件..." }
}
```

t4 审查发现一个问题 → 通过 suggestion 告知 PM → PM 决定追加一个小修复任务 t5 → t5 完成后全部通过。

### Step 9：全部完成

```
┌──────────────────────────────────────────────┐
│ ✅ 全部完成 (5/5)                       1:25  │
│                                              │
│ ✅ t1  数据库：添加 roles/permissions 表      │
│ ✅ t2  中间件：角色校验                       │
│ ✅ t3  API + 配置加载模块（按建议调整）       │
│ ✅ t4  安全审查 → 发现 1 个问题 → 已修复     │
│ ✅ t5  修复审查问题（动态追加）               │
│                                              │
│ 动态调整：                                    │
│   · t1 提建议 → PM 采纳 → t3 任务更新        │
│   · t4 提建议 → PM 采纳 → t5 追加            │
│                                              │
│ Token 消耗：                                  │
│   全量读取：t1(120行) + t4(审查摘要)          │
│   增量读取：t2(~30行) + t3(~50行) + t5(~20行)│
│   总计 ~220 行（无上下文传递则 ~500 行）      │
└──────────────────────────────────────────────┘
```

### 小B的感受

> 「以前用单个 CLI，改完代码发现架构问题就得重来。
> 现在 AgentRouter 里，Agent 干活时能互相提建议，PM 能动态调整——**就像真有一个团队在帮我写代码。**」

---

## 四种模式

| 模式 | 行为 | 适合 |
|---|---|---|
| **YOLO** 🚀 | 全自动，PM拆完直接执行 | 信心足的项目 |
| **审批** ✅ | 展示任务→用户确认→执行 | 重要生产环境 |
| **逐步** 👣 | 每组执行前询问 | 想跟进但不全审 |
| **预览** 👀 | 只看计划不执行 | 需求分析阶段 |

---

## 场景中的关键概念索引

| 概念 | 在场景中的体现 | 对应文档 |
|---|---|---|
| **Metadata** | 每条消息都带 `_sender` | PROTOCOL.md |
| **标签系统** | 调度器查 best_for 和 max_instances 做指派 | ARCHITECTURE.md |
| **执行模型** | t2/t3 多进程并行，t4 单进程 | ARCHITECTURE.md |
| **上下文传递** | context.deltas 让下游只读增量 | PROTOCOL.md |
| **Suggestion** | t1 提建议 → PM 调整 t3 | PROTOCOL.md + ARCHITECTURE.md |
| **动态调整** | PM 发出 task:update / task:add | PROTOCOL.md + ARCHITECTURE.md |
| **任务回收** | completion 事件携带 deltas | PROTOCOL.md |
