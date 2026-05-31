# AgentRouter — 全流程场景推演

> 平台路由三步骤：确定路径 → PM 拆解任务 → 平台分派执行

> **功能状态**
> 
> | 功能 | 状态 |
> |---|---|
> | 项目绑定 | ✅ 已实现 |
> | Agent 选择器 + 模式选择器 | ✅ 已实现 |
> | PM 拆解任务并输出结构化任务列表 | ✅ Phase 2 已完成 |
> | 任务审批模式（审批 Plan 按钮） | ✅ Phase 2 已完成 |
> | PM 验收汇总（汇总 Mission 按钮） | ✅ Phase 2 已完成 |
> | YOLO / 逐步 / 预览模式 | ⬜ 待实现 (Phase 3) |
> | parallel_groups 并行调度 | ⬜ Phase 2+ |
> | 任务依赖图 DAG 可视化 | ⬜ 规划中 |
> | 推理气泡 | ⬜ Phase 3 |

---

## 场景：给项目加用户权限系统

### Step 0: 项目已绑定

用户打开 AgentRouter，选中一个 Node.js 后端项目。平台记住了项目路径：

```
data：{ projectId: "proj_abc", path: "D:/workspace/my-backend" }
```

---

### Step 1: 用户选择 PM + 输入需求

顶部有个 **PM 下拉选择框**，默认是 Reasonix：

```
┌─ PM ──────────────────────────────────┐
│ [Reasonix ▼]   ← 默认                 │
│  CodeWhale                             │
│  (未来更多...)                         │
└────────────────────────────────────────┘

输入框: "给项目加一个基于角色的权限系统（RBAC）"
```

用户输入需求后，平台启动选定的 PM。

---

### Step 2: PM 拆解任务

```
reasonix --mode platform --role pm "给项目加一个基于角色的权限系统（RBAC），管理员可以管理用户角色"

stdout ← {"type":"event","event":"task:start","data":{}}
stdout ← {"type":"event","event":"progress","data":{"message":"分析项目结构..."}}
stdout ← {"type":"event","event":"progress","data":{"message":"梳理 RBAC 需求..."}}
stdout ← {"type":"event","event":"completion","data":{
  "summary":"需求分析完成，共拆解为 4 个任务",
  "tasks":[
    {
      "id":"t1",
      "title":"数据库：添加 roles 和 permissions 表",
      "assignee":"codewhale",
      "path":"./src/models/",
      "depends_on":[]
    },
    {
      "id":"t2",
      "title":"中间件：创建角色校验中间件",
      "assignee":"codewhale",
      "path":"./src/middleware/",
      "depends_on":["t1"]
    },
    {
      "id":"t3",
      "title":"API：用户角色管理接口",
      "assignee":"codewhale",
      "path":"./src/routes/",
      "depends_on":["t1"]
    },
    {
      "id":"t4",
      "title":"Review：整体安全审查",
      "assignee":"reasonix",
      "path":"./src/",
      "depends_on":["t2","t3"]
    }
  ],
  "parallel_groups":[["t1"],["t2","t3"],["t4"]]
}}
```

PM 的 prompt 中写明：
- 产出必须是结构化的任务列表
- 每个任务标注 assignee（哪个 CLI 执行）
- 任务间依赖关系（depends_on）
- 平台会按并行组（parallel_groups）调度
- 路径相对于项目根目录

---

### Step 3: 执行模式决定走哪条路

平台根据当前执行模式决定行为。

#### 模式 A：YOLO 模式（全自动）

```
平台拿到任务列表 → 不经过用户确认 → 直接并行调度

[第 1 组，并行] t1 → codewhale --mode platform --chdir ./src/models/ "添加 roles 和 permissions 表"
                 ← 等待所有完成

[第 2 组，并行] t2 → codewhale --mode platform --chdir ./src/middleware/ "创建角色校验中间件"
                 t3 → codewhale --mode platform --chdir ./src/routes/ "用户角色管理接口"
                 ← 等待所有完成

[第 3 组]      t4 → reasonix --mode platform --chdir ./src/ "做整体安全审查"
                 ← 完成
```

用户看到的是：
```
┌─────────────────────────────────────────────┐
│ [YOLO]  正在执行 (4/4)              0:32   │
│                                             │
│ ✅ t1  数据库：添加 roles 表               │
│ ✅ t2  中间件：角色校验                     │
│ 🔄 t3  API：角色管理接口                    │
│ ⏳ t4  安全审查（等待中）                    │
└─────────────────────────────────────────────┘
```

#### 模式 B：审批模式

```
平台拿到任务列表 → 展示给用户确认 → 用户点"执行"后才开始

用户看到：
┌─────────────────────────────────────────────┐
│ PM (Reasonix) 拆解了以下任务：               │
│                                             │
│ ☑ t1  数据库：添加 roles 表       → CodeWhale│
│ ☑ t2  中间件：角色校验           → CodeWhale│
│ ☑ t3  API：角色管理接口          → CodeWhale│
│ ☑ t4  安全审查                   → Reasonix │
│                                             │
│ 执行顺序：t1 → t2+t3（并行）→ t4           │
│                                             │
│  [修改任务]          [全部执行]              │
└─────────────────────────────────────────────┘

用户可以：
- 取消某些任务（取消勾选）
- 调整 assignee
- 直接修改任务描述
- 确认后点击"全部执行"

#### 模式 C：逐步模式（Step-by-Step）

```
平台拿到任务列表 → 按并行组分批执行，每组执行前询问用户
```

```
[第 1 组]
  平台：即将执行 → t1 数据库：添加 roles 表 → CodeWhale
  用户：⏎（回车继续）
  → 执行 t1 → 完成 → 显示结果

[第 2 组]
  平台：即将并行执行 → t2 中间件、t3 API → CodeWhale
  用户：⏎
  → 执行 t2 + t3 → 完成 → 显示结果

[第 3 组]
  平台：即将执行 → t4 安全审查 → Reasonix
  用户：⏎
  → 执行 t4 → 完成
```

适合场景：用户想跟进每个阶段的结果，但不希望像审批模式那样一次性审核所有任务。

#### 模式 D：预览模式（Dry Run）

```
平台拿到任务列表 → 展示给用户 → 不执行 → 用户手动决定下一步
```

```
┌─────────────────────────────────────────────┐
│ PM (Reasonix) 拆解了以下任务：               │
│                                             │
│ t1  数据库：添加 roles 表       → CodeWhale │
│ t2  中间件：角色校验           → CodeWhale │
│ t3  API：角色管理接口          → CodeWhale │
│ t4  安全审查                   → Reasonix │
│                                             │
│ 执行模式：[预览 - 仅查看，不执行]            │
│                                             │
│  [导出为 JSON]     [切换模式执行]             │
└─────────────────────────────────────────────┘
```

适合场景：用户只想看看 PM 的计划，不想马上执行，或者想把任务列表导出给其他人 review。

#### 模式切换

顶部显示当前模式，用户随时可切换：

```
┌─ PM: Reasonix ──┐ ┌─ 模式 ──────────────────────┐
│ [Reasonix ▼]    │ │ [YOLO ▼]                     │
│                  │ │  YOLO                        │
│                  │ │  审批                        │
│                  │ │  逐步                        │
│                  │ │  预览                        │
└──────────────────┘ └──────────────────────────────┘
```

模式切换不影响已生成的任务列表，只影响后续调度行为。

---

## 平台路由职责总结

### 调用（Call）

| 时机 | 做什么 |
|---|---|
| 用户选 PM | 下拉选择 → 记住偏好 → 默认 Reasonix |
| 用户输入需求 | 启动 PM → 等任务列表 |
| YOLO 模式 | 立即按并行组调度任务 |
| 审批模式 | 展示任务列表 → 用户确认后调度 |
| 逐步模式 | 每执行完一组，询问用户是否继续 |
| 预览模式 | 仅展示任务列表，不执行 |
| 并行执行 | 按 parallel_groups，组内并行、组间串行 |
| 执行中切换模式 | 下次调度时生效，不影响正在执行的任务 |
| 任务完成 | 释放进程，记录结果 |

### 维护（Maintain）

| 数据 | 维护方式 |
|---|---|
| 项目路径 | 绑定后全局生效 |
| PM 偏好 | 记住用户选的默认 PM |
| 执行模式 | YOLO / 审批 / 逐步 / 预览，可随时切换 |
| 任务列表 & 执行状态 | 存入数据库 |
| 对话历史 | 需求 + PM 分析 + 各任务执行结果，完整串联 |

### 平台不做的事

- ❌ 不代替 PM 拆解需求
- ❌ 不修改任务内容
- ❌ 不干涉 CLI 执行过程
- ❌ 不自己调用 MCP / 工具（那是 CLI 的事）
