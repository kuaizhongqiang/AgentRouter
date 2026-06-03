# AgentRouter

多 Agent 协同桌面平台。将多个开源编程助手 CLI（CodeWhale / Reasonix / Deep Code / OpenCode / Cline / Continue）整合到统一界面中，让它们协同完成同一个项目。

> **核心理念**：平台模拟"人"来调用 CLI。只做两件事：**调用**（spawn 子进程）和**维护**（记消息、记任务、存日志）。不做代码能力增强。

---

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发模式（Electron + Vite 联调）
npm run dev

# 构建生产版本
npm run build
build.bat          # 一键打包（产物: release/AgentRouter-{version}/win-unpacked/）
```

各 Agent CLI 的构建（Rust / Go / TypeScript / npm 预编译）见 `agents/` 下对应目录说明。

---

## 核心特性

### 🧠 多 Agent 调度
- 集成 6 个编码助手：CodeWhale / Reasonix / Deep Code / OpenCode / Cline / Continue
- 6 种执行模式：对话 / PM 拆解 / YOLO / 审批 / 逐步 / 预览
- Reasonix（PM）自动拆解需求 → 结构化任务列表 → 并行调度
- 执行中动态调整（suggestion）+ 冲突检测 + 信号量并发控制

### 🖥️ 桌面体验
- 三栏拖拽布局（Splitpanes）| 浅色/深色主题 | 系统托盘
- 全局快捷键（`Ctrl+Shift+A` 唤出 / `Ctrl+Shift+H` 隐藏）
- 原生通知 | 顶部菜单栏 | 国际化（中文/英文）
- 首次引导向导 | 全局设置页面 | 项目级配置 `agentrouter.json`

### 🔧 开发效率
- `/` 斜杠命令面板（`/fix` `/feat` `/review` `/refactor` `/test` `/doc`）
- 任务模板（修复 Bug / 添加功能 / 代码审查）
- Diff 审查面板 | 代码审查模式（文件选择 → 自动审查 → 接受/拒绝）
- Session 回放 | Token 用量统计

### 🏗️ 架构能力
- 统一凭证管理（`~/.agentrouter/credentials.json`）
- Agent 数据路径统一（`~/.agentrouter/agents/`）
- MCP 工具注入（file / git / web fetch）
- 插件系统设计（文档方案，生命周期钩子 + 安全沙箱）

---

## 架构概览

```
electron/           Electron 主进程（TypeScript）
  ├── main.ts        窗口管理 / Tray / 通知 / 快捷键 / 菜单栏
  ├── preload.ts     contextBridge API
  ├── ipc/           领域拆分 IPC 处理器（项目/对话/消息/任务/Agent/凭证）
  ├── database/      SQLite (sql.js WASM) + 迁移 v1-v6
  ├── agents/        Agent 适配器层（Adapter 模式，6 个 CLI 适配器）
  ├── scheduler/     并行调度引擎（冲突检测 + 信号量）
  └── mcp/           MCP Server（file / git / web 工具）

src/                Vue 3 前端
  ├── App.vue        三栏主界面
  ├── Settings.vue   设置面板
  ├── Onboarding.vue 首次引导
  ├── DiffPanel.vue  Diff 审查
  └── locales/       国际化（中文/英文）

agents/             开源 CLI 源码 Fork（仅 I/O 接口层改动）
ProjectVision/      愿景文档体系（架构基准）
docs/               设计文档（协议/场景/审计/测试/插件设计）
```

---

## 数据存储

| 位置 | 内容 |
|---|---|
| `~/.agentrouter/agentrouter.db` | SQLite 数据库：项目 / 对话 / 消息 / 任务 / Agent 日志 / 记忆 / 任务模板 / Token 用量 |
| `~/.agentrouter/credentials.json` | 统一凭证（API Key / Base URL） |
| `~/.agentrouter/projects/{id}/sessions/{id}/events/` | Agent 执行日志（JSON Lines） |
| `{project}/agentrouter.json` | 项目级配置（覆盖全局默认值） |

---

## 通信协议

平台与 CLI 之间通过 stdin/stdout 传输 [JSON Lines](https://jsonlines.org/) 事件流，协议对齐 MCP 标准。详见 [`docs/PROTOCOL.md`](docs/PROTOCOL.md)。

---

## 集成项目

| 项目 | 许可证 | 集成方式 |
|---|---|---|
| [CodeWhale](https://github.com/CodeWhaleTeam/codewhale) | MIT | 源码 Fork + `--platform-mode` |
| [DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix) | MIT | 源码 Fork + `platform` 子命令 |
| [Deep Code CLI](https://github.com/lessweb/deepcode-cli) | MIT | 源码 Fork + `platform` 子命令 |
| [OpenCode](https://github.com/opencode-ai/opencode) | Apache-2.0 | 源码 Fork + `platform` 子命令 |
| [Cline](https://github.com/cline/cline) | Apache-2.0 | 包装层 + npm 二进制 |
| [Continue](https://github.com/continuedev/continue) | Apache-2.0 | 包装层 + npm 二进制 |

各项目许可证见对应 `agents/{project}/LICENSE`，改动记录见 `FORK.md`。

---

## 代码仓库

本项目同步托管于两个平台：

| 平台 | 地址 |
|---|---|
| 🐙 **GitHub** | <https://github.com/kuaizhongqiang/AgentRouter> |
| 🟢 **GitCode** | <https://gitcode.com/m0_61563124/AgentRouter> |
