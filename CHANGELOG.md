# Changelog

## v0.1.0-alpha.1 (2026-06-05)

AgentRouter 的首个 Alpha 版本。核心能力完整，CLI 可用，适合早期尝鲜者。

### 核心功能

- 集成 6 个 AI 编码 Agent：CodeWhale、Reasonix、Deep Code、OpenCode、Cline、Continue
- 多模式执行：对话、PM 拆解、YOLO、审批、逐步、预览
- CLI 命令行工具：`ar exec` / `ar project` / `ar session` / `ar task` 等 25+ 命令
- 项目管理：创建、切换、删除项目，自动初始化 Agent 记忆目录
- 会话管理：多会话、消息历史、任务追踪
- 任务模板：保存常用任务为模板一键复用

### 基础设施

- 启动流程重构：Agent 健康检测 + 会话恢复 + 数据目录初始化 + Wiki 预热
- 深度诊断：`ar diag` 一键体检（Agent / 数据库 / MCP / 凭证 / 环境）
- 6 个 Agent 健康检查与禁用机制
- 全局异常捕获 + MCP 进程清理
- 统一的 API 凭证管理系统
- 去抖持久化（sql.js 300ms debounce）
- IPC 异常统一包装与错误友好化

### CLI 命令

| 命令 | 功能 |
|------|------|
| `ar exec <agent> <cmd>` | 执行 Agent 指令 |
| `ar doctor [agent]` | 诊断 Agent 健康 |
| `ar status` | 全局状态概览 |
| `ar project list/create/rm` | 项目管理 |
| `ar session list/create/rm` | 会话管理 |
| `ar task list/approve` | 任务管理 |
| `ar build` / `ar test` | 编译与测试 |
| `ar db <sql>` | 直接查询数据库 |
| `ar log <agent>` | 查看 Agent 日志 |
| `ar git status/diff` | Git 集成 |
| `ar diag` | 全面体检 |
| `ar credential show/set` | 凭证管理 |
| `ar project init` | 项目初始化扫描 |

### 修复

- Electron 启动崩溃（P0）
- 6 个 Agent 通信链路中断（P1）
- Cline / Continue / OpenCode / Reasonix 集成 bug（4 个 P1）
- CLI `ar exec` 回复不捕获
- Token 统计始终为 0
- IPC 处理程序无异常边界
- 通知不分级（聊天模式也弹）
- 删除操作无确认
- 报错信息原始透传

### 已知问题

- 消息内容为纯文本（Markdown 渲染已实现，未启用）
-  Electron 包构建
- 无自动更新机制
