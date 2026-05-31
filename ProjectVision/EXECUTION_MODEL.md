# AgentRouter — 多实例执行模型

> **一个 CLI 能不能同时跑多个？怎么跑？有什么限制？**

---

## 问题的本质

主人问的是调度器的核心实现问题：

```
需求：t1 加数据库表 + t2 加 API 接口
      两个都是 CodeWhale 的任务，想并行执行
      
      能不能一次 spawn 两个 codewhale 进程？
      会不会打架？
      资源够不够？
```

答案分三层：

```
┌────────────────────────────────────────────┐
│  第1层：进程层 — 能不能 spawn 多个？        │
│  ✅ 能。每个子进程是独立的 OS 进程，互不干扰 │
├────────────────────────────────────────────┤
│  第2层：CLI 层 — CLI 本身支持子 Agent 吗？  │
│  ⚠️ 看 CLI 实现。有的支持，有的不支持       │
├────────────────────────────────────────────┤
│  第3层：资源层 — 同时跑多少个合适？         │
│  ⚠️ 取决于 CPU、内存、token 预算           │
└────────────────────────────────────────────┘
```

---

## 第1层：进程级并行

### 机制

AgentRouter 用 `child_process.spawn()` 启动 CLI。**每个 spawn 是一个独立的 OS 进程。**

```
AgentManager
  │
  ├── spawn('ar-codewhale', ['--mode', 'platform', 'exec', task1])
  │   → PID 1001  ← 独立进程，改它的文件
  │
  ├── spawn('ar-codewhale', ['--mode', 'platform', 'exec', task2])
  │   → PID 1002  ← 独立进程，改它的文件
  │
  ├── spawn('ar-reasonix', ['--mode', 'platform', 'review', task3])
  │   → PID 1003  ← 独立进程
  │
  └── 全部由 AgentManager 的 Map<taskId, ChildProcess> 管理
```

**结论：进程级并行完全可行。** 同类型 CLI 同时跑多个没有任何技术障碍。

### 进程管理

```
AgentManager 内部：
  activeProcesses = Map<taskId, ChildProcess>

  启动时：
    activeProcesses.set(taskId, spawn(cli, args))

  监控时：
    process.on('exit', (code) => {
      activeProcesses.delete(taskId)
      updateTaskStatus(taskId, code === 0 ? 'completed' : 'failed')
    })

  终止时：
    process.kill('SIGTERM')
    setTimeout(() => process.kill('SIGKILL'), 5000)
```

### 示例：两个 CodeWhale 并行

```
时间线：
t=0s   调度器决定并行执行 t1 + t2
t=0.1s spawn ar-codewhale t1 → PID 1001
t=0.2s spawn ar-codewhale t2 → PID 1002
t=3.5s t1 完成（PID 1001 退出，exitCode=0）
t=4.2s t2 完成（PID 1002 退出，exitCode=0）

实际体验：
┌──────────────────────────────────────────────┐
│ 🔄 t1  数据库：添加 roles 表    → CodeWhale  │
│ 🔄 t2  API：角色管理接口       → CodeWhale  │
│                                              │
│ 两条日志流并行展示，互不干扰                   │
└──────────────────────────────────────────────┘
```

---

## 第2层：CLI 的子 Agent 支持

### 两种模式

#### 模式 A：无子 Agent 支持（CodeWhale 模式）

CodeWhale 是一个**单体 CLI**——它接受一个任务，干完，退出。

```
ar-codewhale --mode platform exec "加 roles 表"
  → 启动 → 执行 → 完成 → 退出
  → 就是一个进程跑一个任务
```

**并行方式**：spawn 多个进程，每个进程干一个任务。

```
适合：明确的独立任务（加表、写接口、改文件）
限制：不能在一个进程内派生子任务
```

#### 模式 B：有子 Agent 支持（Reasonix 模式）

Reasonix 内部可能支持**子 Agent（sub-agent）机制**——一个 Reasonix 进程可以派生子任务给内部的子 Agent。

```
ar-reasonix --mode platform --role pm "拆解需求"
  → 启动
    → 子 Agent A：分析项目结构
    → 子 Agent B：梳理 RBAC 需求
    → 子 Agent C：产出任务列表
  → 完成 → 退出
```

**并行方式**：一个进程内多个子 Agent 并行推理。

```
适合：复杂任务内部的子任务并行
限制：子 Agent 不能跨进程操作文件系统
```

### 两种模式对比

| 维度 | 多进程并行（CodeWhale 风格） | 子 Agent 并行（Reasonix 风格） |
|---|---|---|
| **粒度** | 任务级 | 推理级 |
| **资源** | 每个进程独立内存 | 共享进程内存 |
| **隔离** | 完全隔离，互不影响 | 共享上下文 |
| **文件冲突** | 可能（两个进程改同个文件） | 内部协调 |
| **适用** | 独立模块并行开发 | 单任务内部推理并行 |

### 调度器如何处理差异

```
调度器查 Agent 标签 → 发现：
  CodeWhale  的子 Agent 支持 = false → 多进程并行
  Reasonix   的子 Agent 支持 = true  → 可内部并行

决策：
  t1（CodeWhale）→ spawn 新进程
  t2（CodeWhale）→ spawn 新进程  ← 两个不同进程
  t3（Reasonix） → spawn 单进程，内部走子 Agent
```

---

## 第3层：资源管理

### 同时跑多少个合适？

| 资源 | 限制 | 建议上限 |
|---|---|---|
| **CPU** | 每个进程消耗 CPU 核 | 不超过 CPU 核心数 × 2 |
| **内存** | 每个进程 ~200-500MB | 不超过可用内存的 70% |
| **Token** | API 调用频率限制 | 按模型限制 |
| **文件系统** | 多个 Agent 同时写文件 | 避免同路径并行 |

### 建议策略

```
轻量任务（改配置文件、写简单函数）→ 可并行 4-6 个
中等任务（加模块、重构函数）     → 可并行 2-3 个
重量任务（大规模重构、全量审查）  → 串行或最多 2 个
```

### 文件冲突处理

多个 Agent 并行时，最怕的是**两个进程改同一个文件**：

```
场景：
  t1（CodeWhale）：修改 src/auth/login.ts
  t2（CodeWhale）：同时修改 src/auth/login.ts
  → 后保存的覆盖先保存的 → 丢代码 💥
```

解决方案：

| 方案 | 做法 | 代价 |
|---|---|---|
| **PM 规划时避免** | 拆任务时确保文件不重叠 | 依赖 PM 的拆解质量 |
| **文件锁** | 平台层加锁，同一文件同时只能一个 Agent 写 | 增加复杂度 |
| **git diff 合并** | 并行执行后自动合并 diff | 冲突时需人工介入 |
| **串行兜底** | 检测到文件重叠时自动串行执行 | 损失并行效率 |

**推荐方案**：PM 规划时避免 + 串行兜底。

---

## 执行模型全景

```
                    ┌──────────────────────┐
                    │    并行执行组         │
                    │  parallel_group: 2    │
                    └────────┬─────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
┌─────────────────────┐ ┌─────────────┐ ┌─────────────┐
│  t1 CodeWhale       │ │ t2 CodeWhale│ │ t3 Reasonix │
│  spawn 进程 PID 1001│ │ spawn PID1002│ │ spawn PID1003│
│  改 src/models/     │ │ 改 src/api/ │ │ 子Agent内并行│
└──────────┬──────────┘ └──────┬──────┘ └──────┬──────┘
           │                   │               │
           ▼                   ▼               ▼
    ┌────────────┐     ┌────────────┐    ┌────────────┐
    │ stdout事件流│     │ stdout事件流│    │ stdout事件流│
    │ 写入events/ │     │ 写入events/ │    │ 写入events/ │
    └────────────┘     └────────────┘    └────────────┘
           │                   │               │
           └───────────────────┼───────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ 全部完成 → 触发下一组  │
                    └──────────────────────┘
```

---

## 与标签系统的关系

AGENT_TAGGING.md 中的标签可以增加一个字段：

```json
{
  "identity": { "id": "ar-codewhale", "label": "CodeWhale" },
  "execution_model": {
    "parallel_mode": "multi-process",    // multi-process | sub-agent | single
    "max_concurrent": 4,                  // 建议最大并行数
    "file_isolation": "task-level"        // task-level | session-level | global
  },
  ...
}
```

这样调度器就知道：
- CodeWhale → 多进程并行，最多 4 个同时跑
- Reasonix → 子 Agent 模式，单进程就够了

---

## 总结

| 主人问的问题 | 答案 |
|---|---|
| 能不能一次实例化两个 CodeWhale？ | ✅ 能，每个任务 spawn 独立进程 |
| 支持子 Agent 的 CLI 怎么处理？ | 走内部子 Agent 并行，不额外 spawn |
| 不支持子 Agent 的呢？ | 多进程并行，调度器统一管理 |
| 资源够吗？ | 轻量任务 4-6 个并行，重量任务串行 |
| 两个 Agent 改同一个文件怎么办？ | PM 拆解时避免 + 串行兜底 |
