# Reasonix Fork

- **原项目**: DeepSeek-Reasonix
- **来源**: https://github.com/esengine/DeepSeek-Reasonix
- **许可证**: MIT（见同级 LICENSE 文件）
- **Fork 版本**: v0.52.0
- **Fork 日期**: 2025-05-30
- **改动内容**:
  - 二进制名改为 ar-reasonix / ar-dsnix（避免与系统安装版本路径冲突）
  - 新增 platform 子命令（平台集成模式）
  - 输出格式改为 NDJSON 事件流（对齐 AgentRouter 协议）
  - platform-output.ts: 转发 `reasoningDelta` 为 `channel: "reasoning"` 的 progress 事件（推理气泡）
  - deepseek-tokenizer.json.gz: 从 `node_modules/reasonix/data/` 复制到仓库 `data/` 目录（原始 build 流程不生成此文件，tokenizer 后来自 npm 包而不是源码）
- **上游跟进方式**: git rebase 或手动合并 tag；tokenizer 文件需随 reasonix npm 版本更新同步
- **内部逻辑**: 未修改。所有改动仅限于 I/O 接口层和数据文件。
