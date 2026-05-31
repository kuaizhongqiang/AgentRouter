# AgentRouter — 第一期范围

> 第一期目标：搭建平台底座，让"PM 拆任务 → 多 Agent 执行"的闭环能跑通。

---

## 第一期做什么

### 1. 后端基础设施（electron/）
- TypeScript 迁移：electron/ 下所有 .cjs → .ts，配置 tsconfig.node.json
- IPC 层重构：ipcMain.handle 按板块拆分到 ipc/ 目录
- 数据库规范化：repository 模式 + migration 机制
- Agent 适配器框架：定义 AgentAdapter 接口，实现 CodeWhale 适配器

### 2. CLI 改造
- CodeWhale：加 `--mode platform`、加 `task:start` 事件、改名 `ar-codewhale`
- Reasonix：加 `platform` 子命令、输出 NDJSON 事件、改名 `ar-reasonix`
- 每个 fork 目录下放 FORK.md

### 3. 前端最小适配
- 顶部加 PM 下拉选择器（默认 Reasonix）
- 顶部加模式选择器（YOLO / 审批 / 逐步 / 预览）
- 任务看板展示 PM 产出的任务列表 + 执行状态 → ⬜ 下放到 Phase 2
- 上述改动保留现有交互不破坏

### 4. Agent 产出管理
- stdout 事件流同时写入 `~/.agentrouter/projects/<id>/sessions/<id>/events/` 的 .jsonl
- agent_logs 表落地

### 5. 文档
- 项目根 README.md 更新：添加开源声明表
- docs/ 下已有 7 份文档归档

---

## 第一期不做

| 事项 | 原因 |
|---|---|
| 前端全面重构（组件拆分 + Pinia） | 优先级不高，当前单页够用 |
| MCP 集成 | 后续阶段，CLI 本身已支持 MCP |
| 跨 Agent 协同/上下文桥接 | 第三期 |
| 长期记忆系统 | 第三期 |
| Reasonix 的 PM 模式 prompt 调优 | 第二期细化 |
| 审批模式的任务编辑/取消 UI | 第一期用最简确认框实现 |
| 任务依赖图可视化 | 后续增强 |

## 搁置事项（未来参考）

以下是从文档审计中识别出的有用但不属于第一期的事项：

| 事项 | 来源 | 建议时机 |
|---|---|---|
| "零期"最小闭环：先选 Agent 再发消息，不改 CLI 快速验证多 Agent | 审计 E2 | 第一期开始前即可做 |
| 事件驱动的状态管理：前端按事件类型分类渲染 | 审计 E3 | 第二期 |
| 任务依赖图 DAG 可视化 | 审计 E4 | 第三期 |
| 日志归档 + 会话回放：从 .jsonl 重建对话 | 审计 E6 | 第三期 |
| 数据库 Schema 独立文档 | 审计 B-2 | 第一期完成后 |
| IPC API 独立文档 | 审计 B-3 | 第一期完成后 |
| 测试策略文档 | 审计 C-6 | 第一期完成后 |

---

## 交付标准

第一期的"完成"标志：

```
用户打开 AgentRouter
  → 绑定一个项目
  → 选 PM（默认 Reasonix）
  → 输入需求 "给项目加 RBAC"
  → PM 分析并返回任务列表（YOLO 模式直接执行 / 审批模式先展示）
  → 平台按 parallel_groups 调度各 CLI 执行
  → 所有事件实时显示在 UI 并写入 .jsonl 日志
  → 任务全部完成，对话可继续
```
