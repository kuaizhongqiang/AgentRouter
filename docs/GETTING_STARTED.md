# 快速开始

从零开始运行 AgentRouter。

---

## 环境要求

| 项目 | 要求 |
|---|---|
| **Node.js** | ≥ 18.x（推荐 22.x） |
| **npm** | ≥ 9.x（随 Node.js 自带） |
| **操作系统** | Windows 10+（构建产物为 win-unpacked） |
| **Git** | 用于克隆仓库和版本管理 |
| **VPN（可选）** | 访问 GitHub 和 npm registry 时需要 |

### 可选构建工具（按需，取决于你使用的 Agent）

| 工具 | 用途 | 安装 |
|---|---|---|
| **Rust 1.88+** | 构建 CodeWhale | `winget install Rustup` 或 [rustup.rs](https://rustup.rs) |
| **Go 1.24+** | 构建 OpenCode | `winget install Go` 或 [go.dev](https://go.dev) |
| **Python 3.x** | 部分 Agent 依赖 | [python.org](https://python.org) |

---

## 第一步：获取代码

```bash
git clone https://github.com/kuaizhongqiang/AgentRouter.git
cd AgentRouter
```

如果需要从国内加速：

```bash
git clone https://gitcode.com/m0_61563124/AgentRouter.git
cd AgentRouter
```

---

## 第二步：安装依赖

```bash
npm install
```

这将安装 Electron、Vue 3、Vite、sql.js 等所有核心依赖。

---

## 第三步：配置凭证

AgentRouter 需要一个 API Key 来调用底层 AI 服务。有两种配置方式：

### 方式一：在 App 内配置（推荐）

启动应用后，点击左侧边栏底部的 🔑 按钮，填写：

- **API Key** — 你的 API 密钥
- **Base URL** — API 端点地址（默认：`https://api.openai.com/v1`）
- **模型名称** — 使用的模型（如 `gpt-4o`、`deepseek-chat` 等）

### 方式二：手动编辑配置文件

```bash
# 创建凭证文件
mkdir -p ~/.agentrouter
```

创建 `~/.agentrouter/credentials.json`：

```json
{
  "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "baseUrl": "https://api.openai.com/v1",
  "modelName": "gpt-4o"
}
```

> 凭证文件一旦保存，所有 Agent 适配器自动共享，无需重复配置。

---

## 第四步：构建 Agent CLI

AgentRouter 集成了 6 个编码助手，其中部分需要自行编译：

### 一键构建（推荐）

如果已安装 Rust、Go 等工具链：

```bash
build.bat
```

### 逐个构建

```bash
# CodeWhale（需要 Rust 1.88+）
cd agents/codewhale
cargo build --release -p codewhale-cli -p codewhale-tui
cd ../..

# Reasonix（Node.js）
cd agents/reasonix
npm run build
cd ../..

# Deep Code CLI（Node.js）
cd agents/deepcode
npm install
npm run build
cd ../..

# OpenCode（需要 Go 1.24+）
cd agents/opencode
go build -o ar-opencode.exe .
cd ../..

# Cline（npm 预编译，无需构建）
npm install -g @cline/cli

# Continue（npm 预编译，无需构建）
npm install -g @continuedev/cli
```

> 只需要构建你想用的 Agent。首次建议至少构建 CodeWhale 和 Reasonix。

---

## 第五步：启动应用

```bash
# 开发模式（Electron + Vite 联调）
npm run dev
```

启动后你会看到：

1. **三栏界面**：左侧项目列表 / 中间对话区 / 右侧任务面板
2. **首次运行**自动弹出引导向导，带你完成创建第一个项目
3. 在工具栏选择 Agent 和执行模式，输入指令开始协作

如果只想编译前端预览：

```bash
npm run build      # 构建前端静态文件
```

---

## 生产构建

```bash
# 构建并打包为 Windows 桌面应用
build.bat
```

构建产物位于：

```
release/
└── AgentRouter-{version}/
    └── win-unpacked/
        └── AgentRouter.exe    ← 直接双击运行
```

> 构建使用 `--dir` 模式（unpacked），不下载额外依赖工具，无需管理员权限。
> 如需单一便携 exe：`npx electron-builder --win portable`（需要下载工具包）。

---

## 首次使用流程

1. **创建项目** — 输入项目名称和本地文件夹路径
2. **选择 Agent** — 选择已构建好的编码助手
3. **输入指令** — 在输入框输入你的需求
4. **切换模式** — 尝试"PM 拆解"模式让 Reasonix 自动规划任务
5. **查看 Diff** — Agent 执行后切换到右侧 Diff 标签查看变更

### 斜杠命令

在输入框中输入 `/` 弹出命令面板：

| 命令 | 用途 |
|---|---|
| `/fix` | 修复 Bug |
| `/feat` | 添加功能 |
| `/review` | 代码审查 |
| `/refactor` | 重构 |
| `/test` | 添加测试 |
| `/doc` | 更新文档 |

选中命令后自动补全到输入框，回车发送。

### 内置快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+Shift+A` | 唤出窗口 |
| `Ctrl+Shift+H` | 隐藏窗口 |
| `Ctrl+N` | 新建项目 |
| `Ctrl+T` | 切换主题 |

---

## 常见问题

### 启动后窗口空白

检查终端是否有报错，确保 `npm install` 和 `npm run build:electron` 已执行。

### Agent 执行无响应

- 检查 `~/.agentrouter/credentials.json` 中 API Key 是否正确
- 确认对应 Agent 已构建（`agents/{name}` 下存在可执行文件）
- 在工具栏点击"诊断"按钮查看状态

### 构建失败

- **Rust 相关错误**：确认 Rust 版本 ≥ 1.88，`rustup update`
- **Node.js 相关错误**：确认 Node.js ≥ 18.x，`node -v` 检查
- **Go 相关错误**：确认 Go 版本 ≥ 1.24，`go version` 检查

### 如何卸载

删除 `~/.agentrouter/` 目录即可清除所有本地数据（数据库、凭证、日志）：

```bash
rm -rf ~/.agentrouter
```

删除项目目录即完成卸载。

---

## 了解更多

| 文档 | 内容 |
|---|---|
| [`README.md`](../README.md) | 项目总览 |
| [`docs/PLUGIN_SYSTEM.md`](../docs/plugin-system.md) | 插件系统设计 |
| [`docs/PROTOCOL.md`](../docs/PROTOCOL.md) | CLI 通信协议 |
