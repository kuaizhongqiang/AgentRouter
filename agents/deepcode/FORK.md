# Deep Code Fork

- **原项目**: Deep Code CLI
- **来源**: https://github.com/lessweb/deepcode-cli
- **许可证**: MIT（见同级 LICENSE 文件）
- **Fork 版本**: v0.1.27
- **Fork 日期**: 2025-07-11
- **改动内容**:
  - 二进制名改为 ar-deepcode（避免与系统安装版本路径冲突）
  - 新增 platform 子命令（平台集成模式）
  - 输出格式改为 NDJSON 事件流（对齐 AgentRouter 协议）
- **上游跟进方式**: git rebase 或手动合并 tag
- **内部逻辑**: 未修改。所有改动仅限于 I/O 接口层。
