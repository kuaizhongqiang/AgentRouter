# AgentRouter 插件系统设计

## 1. 概述

插件系统允许第三方扩展 AgentRouter 的功能。插件通过声明式 `manifest.json` 定义自身能力，通过生命周期钩子接入平台运行时。

### 设计原则

- **轻量** — 插件是单个目录，无需编译步骤
- **安全** — 插件运行在受限环境，无权直接访问文件系统或系统 API
- **可发现** — 系统自动扫描约定目录加载插件
- **可管理** — 通过 IPC 支持 load / unload / reload

---

## 2. 目录结构

```
~/.agentrouter/plugins/
  my-plugin/
    manifest.json          # 插件清单（必需）
    index.js               # 入口文件（必需）
    assets/                # 静态资源（可选）
      icon.png
    styles/                # 前端样式（可选）
      overlay.css
```

### 搜索路径（按优先级）

| 路径 | 说明 |
|------|------|
| `~/.agentrouter/plugins/{name}/` | 用户全局插件（推荐安装位置） |
| `{project}/.agentrouter/plugins/{name}/` | 项目级插件 |
| 内置 `plugins/{name}/` | 应用内置插件 |

同名的项目级插件覆盖全局插件。

---

## 3. manifest.json 规范

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "这是插件的功能描述",
  "author": "Your Name",
  "license": "MIT",

  "main": "index.js",

  "hooks": [
    "onAppReady",
    "onSessionStart",
    "onAgentOutput",
    "onToolRegister"
  ],

  "permissions": [
    "storage:local",
    "mcp:read",
    "ui:toast"
  ],

  "tools": [
    {
      "name": "format_code",
      "description": "格式化指定文件",
      "parameters": {
        "type": "object",
        "properties": {
          "filePath": { "type": "string" }
        }
      }
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 插件唯一标识，kebab-case |
| `version` | string | 是 | SemVer 版本号 |
| `description` | string | 是 | 简短功能说明 |
| `author` | string | 否 | 作者信息 |
| `license` | string | 否 | 开源协议 |
| `main` | string | 是 | 入口文件路径，相对插件目录 |
| `hooks` | string[] | 是 | 声明的生命周期钩子列表 |
| `permissions` | string[] | 否 | 申请的权限列表 |
| `tools` | object[] | 否 | 插件注册的 MCP 工具 |

---

## 4. 生命周期钩子

### 4.1 `onAppReady(app)`

在 Electron 应用初始化完成后调用。

```ts
interface AppContext {
  version: string
  config: Record<string, any>
  registerTool: (tool: ToolDefinition) => void
  getPluginData: (key: string) => any
  setPluginData: (key: string, value: any) => void
}

function onAppReady(app: AppContext): void
```

**使用场景**：注册全局工具、读取配置、初始化 UI。

---

### 4.2 `onSessionStart(session)`

新对话创建时调用。

```ts
interface SessionContext {
  id: string
  projectId: string
  title: string
  agentType: 'chat' | 'mission'
}

function onSessionStart(session: SessionContext): void
```

**使用场景**：注入系统提示词、创建插件专属上下文。

---

### 4.3 `onAgentOutput(output)`

Agent 每次输出事件时调用。

```ts
interface AgentOutput {
  agent: string
  event: {
    event: string
    data?: {
      message?: string
      content?: string
      channel?: string
      error?: string
      tasks?: any[]
    }
    _sender?: {
      id: string
      label: string
    }
  }
}

function onAgentOutput(output: AgentOutput): void
```

**使用场景**：实时分析、日志记录、触发额外处理。

---

### 4.4 `onToolRegister(tools)`

平台收集已有工具列表时调用，插件在此注册自己的工具。

```ts
interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, any>
  handler: (params: any) => Promise<any>
}

function onToolRegister(tools: ToolDefinition[]): void
```

**使用场景**：给 Agent 提供自定义工具（代码格式化、API 调用等）。

---

### 4.5 `onUIReady(api)`

前端渲染完成时调用（仅前端钩子）。

```ts
interface UIApi {
  addSidebarTab: (tab: SidebarTab) => void
  showToast: (msg: string, type: 'info' | 'error' | 'success') => void
  addMessageAction: (action: MessageAction) => void
}

function onUIReady(api: UIApi): void
```

**使用场景**：添加自定义侧边栏标签页、注册消息操作按钮。

---

## 5. 插件加载流程

```
1. 应用启动
2. 扫描 ~/.agentrouter/plugins/ 和 {project}/.agentrouter/plugins/
3. 验证 manifest.json（必填字段、权限声明）
4. 沙箱加载 index.js（Node.js VM 沙箱或 Web Worker）
5. 注册 hooks → 注入到运行时对应生命周期
6. 调用 onAppReady(app)
7. 正常运行期间触发各钩子
8. 卸载时调用 onDispose（如果存在）
```

### 加载时序图

```
App Start
  │
  ├─ Scan plugin directories
  │   ├─ ~/.agentrouter/plugins/
  │   └─ {project}/.agentrouter/plugins/
  │
  ├─ Validate manifests
  ├─ Create sandbox for each plugin
  ├─ Register lifecycle hooks
  │
  └─ onAppReady(app)
       │
       ├─ User creates session → onSessionStart(session)
       ├─ Agent sends output → onAgentOutput(output)
       ├─ Tool registration → onToolRegister(tools)
       └─ App closes → onDispose()
```

---

## 6. 安全约束

### 6.1 沙箱隔离

插件在独立的执行环境中运行：

- **Node.js 端**：使用 `vm.Module` 创建沙箱，限制 `require` 访问
- **前端端**：插件代码运行在 Web Worker 或 ShadowDOM 中

### 6.2 权限声明

插件必须在 `manifest.json` 的 `permissions` 字段中声明所需权限：

| 权限 | 说明 |
|------|------|
| `storage:local` | 读取/写入插件本地存储 |
| `storage:global` | 读取/写入全局存储 |
| `mcp:read` | 调用 MCP 工具的读取操作 |
| `mcp:write` | 调用 MCP 工具的写入操作 |
| `ui:toast` | 显示 Toast 通知 |
| `ui:sidebar` | 添加侧边栏标签页 |
| `network:fetch` | 发起 HTTP 请求 |

未声明的权限在运行时会被拒绝。

### 6.3 禁止行为

- 禁止直接使用 `require('fs')` 或 Node.js 原生模块
- 禁止访问 `process.env`
- 禁止 `child_process` / `exec`
- 禁止加载原生扩展（`.node` 文件）
- 禁止修改运行时其他插件的内存

### 6.4 资源限制

| 维度 | 限制 |
|------|------|
| 单次钩子执行时间 | 500ms（超时自动终止） |
| 内存上限 | 32MB |
| 工具注册数量 | ≤ 20 个 |
| 存储空间 | ≤ 5MB |

---

## 7. IPC 接口（Electron 端）

```ts
// 主进程 → 渲染进程
ipcMain.handle('plugin:list', async () => {
  return pluginManager.list()  // { name, version, enabled, hooks }[]
})

ipcMain.handle('plugin:load', async (_e, pluginDir: string) => {
  return pluginManager.load(pluginDir)
})

ipcMain.handle('plugin:unload', async (_e, pluginName: string) => {
  return pluginManager.unload(pluginName)
})

ipcMain.handle('plugin:reload', async (_e, pluginName: string) => {
  return pluginManager.reload(pluginName)
})

ipcMain.handle('plugin:getData', async (_e, pluginName: string, key: string) => {
  return pluginManager.getPluginData(pluginName, key)
})

ipcMain.handle('plugin:setData', async (_e, pluginName: string, key: string, value: any) => {
  return pluginManager.setPluginData(pluginName, key, value)
})
```

### Preload 暴露

```ts
// window.plugins
contextBridge.exposeInMainWorld('plugins', {
  list: () => ipcRenderer.invoke('plugin:list'),
  load: (dir: string) => ipcRenderer.invoke('plugin:load', dir),
  unload: (name: string) => ipcRenderer.invoke('plugin:unload', name),
  reload: (name: string) => ipcRenderer.invoke('plugin:reload', name),
})
```

---

## 8. PluginManager 核心设计

```ts
class PluginManager {
  private plugins: Map<string, PluginInstance>

  async load(pluginDir: string): Promise<PluginInstance>
  async unload(name: string): Promise<void>
  async reload(name: string): Promise<void>

  list(): PluginManifest[]

  // 生命周期触发
  async emitHook(hook: string, ...args: any[]): Promise<void>

  // 沙箱创建
  private createSandbox(mainPath: string): Sandbox
}
```

### PluginInstance 结构

```ts
interface PluginInstance {
  manifest: PluginManifest
  dir: string
  sandbox: Sandbox
  enabled: boolean
  hooks: Map<string, Function>
}
```

---

## 9. 示例：一个简单的代码审查插件

### manifest.json

```json
{
  "name": "auto-reviewer",
  "version": "0.1.0",
  "description": "自动触发的代码审查插件",
  "main": "index.js",
  "hooks": ["onAgentOutput"],
  "permissions": ["storage:local", "ui:toast"]
}
```

### index.js

```js
function onAgentOutput(output) {
  const text = output?.event?.data?.message || ''

  // 检测是否含有代码块
  const codeBlocks = text.match(/```[\s\S]*?```/g)
  if (codeBlocks && codeBlocks.length > 2) {
    // 通知用户有大量代码输出
    if (typeof showToast === 'function') {
      showToast(`检测到 ${codeBlocks.length} 个代码块`, 'info')
    }
  }
}
```

---

## 10. 插件管理 UI（未来工作）

- **插件市场** — 浏览/安装社区插件
- **本地管理页面** — Settings 面板中查看已安装插件
- **启用/禁用开关** — 单个插件的开关
- **日志查看** — 查看插件运行日志和错误
