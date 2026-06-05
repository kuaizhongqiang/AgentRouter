# AgentRouter CLI

> 桌面端的终端等价物 — 所有桌面能做的事情，CLI 都能做。

```bash
ar exec codewhale "修复登录页 Bug"
ar review src/auth/login.ts
ar status --json
```

## 安装

```bash
# 确保已编译后端模块
npm run build:electron

# CLI 无需单独安装，直接通过 node 运行
node cli/bin/ar.mjs --help

# 或添加到 PATH
alias ar="node $(pwd)/cli/bin/ar.mjs"
```

## 依赖

- Node.js ≥ 18
- `dist-electron/`（通过 `npm run build:electron` 编译）

## 命令参考

### 核心执行

| 命令 | 说明 |
|------|------|
| `ar exec <agent> <指令>` | 发送指令给 Agent，等待完成 |
| `ar exec <agent> <指令> --mode PM 拆解` | 指定执行模式 |
| `ar exec <agent> <指令> --session <id>` | 指定已有会话 |
| `ar exec <agent> <指令> --project <id>` | 指定项目 |

### 快捷场景（带 Prompt 模板的 exec）

| 命令 | 等价于 | 默认 Agent |
|------|--------|-----------|
| `ar fix <描述>` | `ar exec codewhale "修复 Bug: <描述>"` | codewhale |
| `ar feat <描述>` | `ar exec codewhale "添加功能: <描述>"` | codewhale |
| `ar review <文件...>` | `ar exec reasonix "审查代码: <文件>"` | reasonix |
| `ar refactor <描述>` | `ar exec codewhale "重构: <描述>"` | codewhale |
| `ar test <描述>` | `ar exec codewhale "添加测试: <描述>"` | codewhale |
| `ar doc <描述>` | `ar exec codewhale "更新文档: <描述>"` | codewhale |
| `ar goal <需求>` | `ar exec reasonix "<需求>"` | reasonix |

### Agent 管理

| 命令 | 说明 |
|------|------|
| `ar list` | 列出 Agent + 健康状态 |
| `ar agent list` | 同上 |
| `ar agent info <name>` | 查看 Agent 详情 |
| `ar agent disable <name>` | 禁用 Agent |
| `ar agent enable <name>` | 启用 Agent |
| `ar doctor [agent]` | 诊断 Agent 健康 |
| `ar kill [agent]` | 终止运行中的 Agent |

### 项目

| 命令 | 说明 |
|------|------|
| `ar project list` | 列出所有项目 |
| `ar project create <name> <path>` | 创建项目 |
| `ar project show <id>` | 查看项目详情 |
| `ar project use <id>` | 选择当前项目 |
| `ar project rm <id>` | 删除项目 |
| `ar project config get [key]` | 读取配置 |
| `ar project config set <key> <value>` | 写入配置 |

### 会话

| 命令 | 说明 |
|------|------|
| `ar session list <projectId>` | 列出会话 |
| `ar session create <projectId> [title]` | 创建会话 |
| `ar session show <id>` | 查看会话详情 |
| `ar session rename <id> <title>` | 重命名 |
| `ar session rm <id>` | 删除会话 |

### 任务与消息

| 命令 | 说明 |
|------|------|
| `ar task list <projectId>` | 列出任务 |
| `ar task approve <sessionId>` | 批准计划 |
| `ar task summarize <sessionId>` | 汇总验收 |
| `ar msg list <sessionId>` | 查看消息历史 |

### 系统

| 命令 | 说明 |
|------|------|
| `ar status` | 全局状态概览 |
| `ar status --json` | JSON 格式状态 |
| `ar credential show` | 查看凭证状态 |
| `ar credential set --key <key>` | 设置 API 凭证 |
| `ar credential test` | 测试凭证有效性 |
| `ar token usage <sessionId>` | Token 用量 |
| `ar token stats [projectId]` | 项目级 Token 统计 |
| `ar memory list/get/set/rm` | 记忆操作 |
| `ar replay <sessionId>` | Session 回放 |
| `ar version` | 版本号 |
| `ar help [command]` | 帮助信息 |

## 全局选项

| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |
| `--quiet` | 静默模式（仅输出结果） |
| `--project <id>` | 指定项目上下文 |
| `--yes` | 自动确认（非交互模式） |
| `-h, --help` | 显示帮助 |

## 示例

```bash
# 列出所有 Agent
ar list

# 执行 Agent
ar exec codewhale "给登录页添加表单验证"

# 快捷场景
ar fix "提交按钮无响应"
ar review src/auth/login.ts

# PM 拆解模式
ar exec reasonix "设计用户权限系统" --mode "PM 拆解" --json

# 全面诊断
ar doctor

# 查看状态（JSON 格式）
ar status --json

# CI 环境使用
ar exec codewhale "修复所有 lint 错误" --quiet --json
```

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 执行错误 |
| 2 | 参数/语法错误 |

## 测试

```bash
node test/cli-test.mjs
```

## 架构说明

CLI 直接复用 `dist-electron/` 编译好的 CommonJS 模块（AgentManager、Database、Credentials），不依赖 Electron 运行时。

```
cli/
├── bin/ar.mjs            ← 入口
├── lib/
│   ├── bootstrap.mjs     ← 加载 dist-electron 模块
│   ├── output.mjs        ← 输出格式化
│   └── parser.mjs        ← 参数解析
└── commands/
    ├── exec.mjs          ← exec + 快捷命令
    ├── agent.mjs         ← agent list/doctor/kill
    ├── project.mjs       ← 项目 CRUD
    ├── session.mjs       ← 会话 CRUD
    ├── task.mjs          ← 任务操作
    ├── msg.mjs           ← 消息操作
    ├── credential.mjs    ← 凭证管理
    ├── token.mjs         ← Token 用量
    ├── memory.mjs        ← 记忆操作
    ├── replay.mjs        ← 会话回放
    └── status.mjs        ← 全局状态
```
