# Cline 集成说明

- **原项目**: Cline CLI
- **来源**: https://github.com/cline/cline
- **许可证**: Apache-2.0（见同级 LICENSE 文件）
- **CLI 版本**: v2.13.0（npm 包 `@cline/cli`）
- **集成方式**: 包装层（Wrapper），非源码 Fork
- **集成日期**: 2026-06-02
- **集成方式说明**:
  - 通过 npm 安装的预编译二进制 `cline`（内置 Bun 运行时），免本地编译
  - `platform.cjs` 包装层将 Cline 原生 `--json` 输出转译为 AgentRouter NDJSON 事件流
  - 包装层负责：启动子进程 → 解析 JSON Lines → 转发为 task:start/progress/completion 事件
  - 模型配置通过 `CLINE_MODEL` 环境变量注入，凭证通过统一凭证系统注入
- **上游跟进方式**: 更新 npm 包版本 `npm install -g @cline/cli@latest`
- **内部逻辑**: 未修改。所有集成在包装层完成，不触及 Cline 源码。
