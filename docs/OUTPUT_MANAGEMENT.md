# AgentRouter — Agent 产出文件管理

> **文档状态**: 已更新 ✅ — 新增上下文传递参考。
> 
> **Phase 4 扩展**: Agent 产出将通过 `metadata.context.deltas` 在 Agent 之间传递上下文。下游 Agent 只读增量，不读全量。
> 详见 [ProjectVision/PROTOCOL.md](../ProjectVision/PROTOCOL.md) 上下文传递章节。

> 所有 Agent 在本地产生的日志、事件、产物统一归平台管理。
> Agent 内部怎么生成、生成什么格式，我们不动。

---

## 存储结构

统一放在数据库同一目录 `~/.agentrouter/` 下，按项目 + 会话组织：

```
~/.agentrouter/
├── agentrouter.db                # SQLite 数据库（已有）
├── projects/
│   └── <project-id>/             # 每个项目一个目录
│       ├── sessions/
│       │   └── <session-id>/     # 每次对话一个目录
│       │       ├── events/       # Agent stdout 事件日志（JSON Lines）
│       │       │   ├── 01-codewhale.jsonl
│       │       │   └── 02-reasonix.jsonl
│       │       ├── artifacts/    # Agent 生成的产物（文件、截图等）
│       │       └── workspace/    # Agent 执行时的工作目录（可选）
│       └── memory/               # 跨会话的长期记忆（后续阶段）
│           └── notes.jsonl
└── config/                       # 平台配置
    └── preferences.json
```

---

## 每层的用途

### events/ — 所有通信事件日志

每次 spawn Agent 时，平台同时做两件事：
1. 把 stdout 实时转发到前端 UI
2. 把全部事件流追加写入 `events/` 对应的 `.jsonl` 文件

```
01-codewhale.jsonl 内容：

{"type":"event","event":"task:start","data":{},"timestamp":"2025-05-30T10:00:00Z"}
{"type":"event","event":"progress","data":{"message":"分析中..."},"timestamp":"2025-05-30T10:00:02Z"}
{"type":"event","event":"completion","data":{"summary":"完成"},"timestamp":"2025-05-30T10:00:30Z"}
```

### artifacts/ — Agent 产出的重要文件

有些 Agent 会生成文件（截图、报告、diff 文件）。平台不做"收集"动作，而是**在 Agent 执行完成后，由平台扫描 workdir 中新增的文件**，记录下来供用户查阅。

### workspace/ — Agent 的临时工作目录

平台 spawn Agent 时，chdir 到这个目录。Agent 在这个目录下工作：

```
workspace/
├── src/              # Agent 修改的代码（从项目根软链或复制过来）
├── node_modules/     # 安装的依赖
└── ...               # Agent 产生的所有过程文件
```

> workspace 是可选的。最简单的方案是 Agent 直接在项目根目录工作，平台只记录 events。

---

## 数据流

```
平台 spawn Agent
  │
  ├── 设置 cwd = 项目路径（或 workspace 子目录）
  │
  ├── stdout → 实时转发到前端 UI
  │         → 追加写入 ~/.agentrouter/projects/<id>/sessions/<id>/events/ 下的 .jsonl
  │
  └── Agent 退出后
      ├── 将 events 文件路径存入数据库
      ├── 扫描工作目录中新文件（可选）
      └── 释放子进程
```

---

## 是否需要 workspace？

有两种选择：

### 选项 A：Agent 直接在工作项目路径下工作（简单）

```
平台 spawn codewhale --mode platform --chdir D:/workspace/my-backend "加权限系统"

Agent 直接在项目目录下读写文件。
平台只记录 events 日志。
```

- ✅ 最简单，当前已在用
- ✅ Agent 的 git diff 等工具正常工作
- ❌ Agent 产生的临时文件混在项目里（比如 node_modules、.reasonix/）

### 选项 B：Agent 在 workspace 子目录工作（隔离）

```
平台 spawn codewhale --mode platform --chdir ~/.agentrouter/projects/<id>/sessions/<id>/workspace "加权限系统"

Agent 在 workspace 中工作。
完成后平台把 workspace 里的产物归档到 artifacts/。
```

- ✅ Agent 的临时文件不污染项目
- ❌ Agent 读不到项目源代码（需要把项目文件复制/链接到 workspace）
- ❌ git diff 看不到仓库级别的变化

**我建议选项 A** — 简单直接。Agent 临时文件的问题可以在 `.gitignore` 中处理（`.reasonix/` 已加进去了）。

---

## 落地

第一阶段只需要做：

1. 确保 `spawn()` 时设置 `cwd` 为项目路径
2. 把 stdout 事件流同时写入 events/ 下的 .jsonl 文件
3. 后续可以通过 events 文件重放或调试

数据库增加一条记录：

```sql
CREATE TABLE agent_logs (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  agentType TEXT NOT NULL,
  command TEXT NOT NULL,
  logPath TEXT NOT NULL,           -- events/ 下的 .jsonl 文件路径
  exitCode INTEGER,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
);
```
