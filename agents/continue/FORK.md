# Continue 集成说明

- **原项目**: Continue CLI
- **来源**: https://github.com/continuedev/continue
- **许可证**: Apache-2.0（见同级 LICENSE 文件）
- **CLI 版本**: v1.5.45（npm 包 `@continuedev/cli`）
- **集成方式**: 包装层（Wrapper），非源码 Fork
- **集成日期**: 2026-06-02
- **集成方式说明**:
  - 通过 npm 安装的 CLI 二进制 `cn`，使用 `-p --format json --silent` 头等模式
  - `platform.cjs` 包装层将 Continue 的 headless JSON 输出转译为 AgentRouter NDJSON 事件流
  - 包装层自动从统一凭证系统生成临时 YAML 配置文件，无需手动配置 Continue
  - 支持通过 `CONTINUE_MODEL` 环境变量指定模型，默认使用 DeepSeek
  - 也支持 `cn serve` HTTP 模式（端口 8000），可用于持久会话场景
- **上游跟进方式**: 更新 npm 包版本 `npm install -g @continuedev/cli@latest`
- **内部逻辑**: 未修改。所有集成在包装层完成，不触及 Continue 源码。
