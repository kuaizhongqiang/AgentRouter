# CodeWhale Fork

- **原项目**: CodeWhale
- **来源**: https://github.com/CodeWhaleTeam/codewhale
- **许可证**: MIT（见同级 LICENSE 文件）
- **Fork 版本**: v0.8.46
- **Fork 日期**: 2025-05-30
- **改动内容**:
  - 二进制名改为 ar-codewhale / ar-codewhale-tui（避免与系统安装版本路径冲突）
  - 新增 --mode platform 参数（平台集成模式）
  - 事件输出对齐 AgentRouter 协议格式（JSON Lines / NDJSON）
- **上游跟进方式**: git rebase 或手动合并 tag
- **内部逻辑**: 未修改。所有改动仅限于 I/O 接口层。
