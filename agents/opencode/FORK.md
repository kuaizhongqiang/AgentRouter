# OpenCode Fork

- **原项目**: OpenCode
- **来源**: https://github.com/opencode-ai/opencode
- **许可证**: Apache-2.0（见同级 LICENSE 文件）
- **Fork 版本**: 最新 commit（上游已归档，转向 Crush）
- **Fork 日期**: 2025-07-11
- **改动内容**:
  - 二进制名改为 ar-opencode（避免与系统安装版本路径冲突）
  - 新增 platform 子命令（平台集成模式）
  - 输出格式改为 NDJSON 事件流（对齐 AgentRouter 协议）
- **上游跟进方式**: 上游已归档，无进一步跟进计划
- **内部逻辑**: 未修改。所有改动仅限于 I/O 接口层。
