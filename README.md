# AgentRouter

> 多 Agent 协作桌面平台——编排多个 AI 编码助手，统一管理、统一调度。

AgentRouter 将 6 个 AI 编码 CLI 工具集成到一个 Electron + Vue 3 桌面应用中，提供统一的界面和 CLI 接口。平台本身**不写代码**——它只负责**调用**（启动 CLI 子进程）和**管理**（消息、任务、日志、记忆）。

![CI](https://github.com/kuaizhongqiang/AgentRouter/actions/workflows/ci.yml/badge.svg)

## 快速开始

### 安装

```bash
# CLI 工具（推荐）
npm install -g @kuaizhongqiang/agent-router

# 或下载桌面端安装包
# 从 GitHub Releases 下载 AgentRouter-*.exe
```

### 配置 API Key

```bash
ar credential set --apiKey sk-xxx --baseUrl https://api.deepseek.com
```

### 创建项目并执行

```bash
# 创建项目
ar project create MyApp /path/to/myapp

# 运行 Agent
ar exec codewhale "分析项目结构并输出摘要"

# 诊断系统状态
ar diag
```

## 集成 Agent

| Agent | 类型 | 用途 |
|-------|------|------|
| **CodeWhale** | Rust 二进制 | 快速编码执行，多进程并行 |
| **Reasonix** | Node.js/TS | 长上下文推理，PM 模式 |
| **Deep Code** | Node.js/TS | 深度推理编码，推理强度可调 |
| **OpenCode** | Go 二进制 | 多模型通用编码，LSP 集成 |
| **Cline** | npm 二进制 | 全能自主编码，15+ 模型提供商 |
| **Continue** | npm 二进制 | 代码库理解，35+ 模型提供商 |

### 构建 Agent

```bash
# CodeWhale（需要 Rust 1.88+）
cd agents/codewhale && cargo build --release -p codewhale-cli -p codewhale-tui

# Reasonix
cd agents/reasonix && npm run build

# OpenCode（需要 Go 1.24+）
cd agents/opencode && go build -o ar-opencode.exe .

# Cline & Continue（npm 全局安装）
npm install -g @cline/cli @continuedev/cli
```

## CLI 命令

```
ar <command> [subcommand] [args...]

核心命令:
  exec <agent> <指令>      执行 Agent
  doctor [agent]           健康诊断
  status                   全局状态
  diag                     深度体检

项目管理:
  project list             列出项目
  project create <name> <path>  创建项目
  project init <id>        项目初始化扫描
  project rm <id>          删除项目

会话与任务:
  session list/create/rm   会话管理
  task list/approve        任务管理
  msg list <session>       消息历史

Agent 管理:
  agent list               列出 Agent
  agent info <name>        查看详情

构建与测试:
  build                    编译后端
  test run                 运行测试

工具:
  db <sql>                 查询数据库
  log <agent>              查看日志
  git status/diff          集成 Git
  credential show/set      凭证管理
  clean                    清理产物

全局选项:
  --json                   JSON 输出
  --project <id>           指定项目
```

## 执行模式

| 模式 | 说明 |
|------|------|
| 对话 | 直接与 Agent 对话 |
| PM 拆解 | PM 拆解需求 → 分派任务 → 并行执行 |
| YOLO | 自动审批，全速执行 |
| 审批 | 每步需用户确认 |
| 逐步 | 按并行组分步确认 |
| 预览 | 仅生成计划，不执行 |

## 开发

```bash
# 环境要求
node >= 22
npm >= 10

# 安装依赖
npm install --ignore-scripts

# 编译后端
npm run build:electron

# 开发模式（前端 + Electron 热更新）
npm run electron:dev

# 生产构建
npm run build && npm run build:electron && npm run electron:build

# 运行测试
node test/runtime-test-2.mjs   # 集成测试（100 项）
node cli/bin/ar.mjs test run --cli  # CLI 测试（82 项）
```

## 数据存储

- **数据库**: `~/.agentrouter/agentrouter.db` (sql.js WASM)
- **日志**: `~/.agentrouter/projects/<id>/sessions/<id>/events/*.jsonl`
- **凭证**: `~/.agentrouter/credentials.json`
- **记忆**: `memories` 表（按项目 + Agent 索引）

## 架构

```
Electron Main Process
├── Agent Layer — 6 个 Agent 适配器 + NDJSON 事件流
├── Data Layer — sql.js + 迁移 + CRUD
├── IPC Layer — 50+ 处理程序，错误统一包装
├── Scheduler — 并行组调度 + 文件冲突检测
├── MCP Server — 文件/搜索/Wiki/Git 工具
├── CLI — 独立于 Electron 的终端命令
└── Project Initializer — 技术栈检测 + 项目画像
```

## License

MIT
