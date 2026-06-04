# LeafWiki 集成说明

## 项目信息

| 项目 | 说明 |
|------|------|
| 原仓库 | https://github.com/perber/leafwiki |
| 许可证 | MIT |
| 集成方式 | 二进制调用 + Wrapper，不改源码 |

## 集成方式

**Wrapper 模式（不 Fork 源码）**

LeafWiki 使用 MIT 许可证，我们不修改其源代码，而是：

1. **首次启动引导下载** — 不打包进仓库
2. **Electron 启动时 spawn 子进程**，监听本地端口
3. **不启动 LeafWiki 自带 Web UI** — 只需 API，前端对我们无用
4. **通过 MCP 工具暴露** wiki:read / wiki:write / wiki:search / wiki:list

## 启动方式

```bash
# 手动下载后启动
leafwiki --port <port> --data-dir <project>/.agentRouter/wiki/
```

AgentRouter 通过 `agents/leafwiki/platform.cjs` 包装层管理子进程生命周期。

## 环境变量

| 变量 | 说明 |
|------|------|
| `LEAFWIKI_PORT` | Wiki 服务端口（默认 18963） |
| `LEAFWIKI_BIN` | LeafWiki 二进制路径 |
| `AGENTROUTER_WIKI_DIR` | Wiki 数据目录 |
