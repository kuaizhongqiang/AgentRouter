# AgentRouter — Fork 管理与署名

> **文档状态**: 已归档 🗄️ — Phase 1-2 的 Fork 管理记录。Agent 接入信息请参考 [ProjectVision/ARCHITECTURE.md](../ProjectVision/ARCHITECTURE.md) 标签系统。

> agents/ 目录下的 CLI 都是开源项目的 fork，需要规范化管理。

---

## 改名方案

避免跟系统已有的 `codewhale` 或 `reasonix` 冲突，所有二进制加前缀 `ar-`。

### CodeWhale (Rust)

| 原名 | 改名后 | 说明 |
|---|---|---|
| `codewhale` | `ar-codewhale` | CLI 入口 |
| `codewhale-tui` | `ar-codewhale-tui` | TUI（平台模式不需要，但保留） |
| `deepseek` | 不变 | 遗留 shim，内部使用 |

**改哪里**：

`agents/codewhale/crates/cli/Cargo.toml` — 改 binary name：

```toml
[[bin]]
-name = "codewhale"
+name = "ar-codewhale"
path = "src/main.rs"
```

`agents/codewhale/crates/tui/Cargo.toml` — 同理：

```toml
[[bin]]
-name = "codewhale-tui"
+name = "ar-codewhale-tui"
path = "src/main.rs"
```

`agents/codewhale/crates/cli/src/lib.rs` — `delegate_to_tui()` 中查找的二进制名也要改：

```rust
-let tui_bin = "codewhale-tui";
+let tui_bin = "ar-codewhale-tui";
```

### Reasonix (Node.js TS)

| 原名 | 改名后 | 说明 |
|---|---|---|
| `reasonix` | `ar-reasonix` | CLI 入口 |
| `dsnix` | `ar-dsnix` | 别名 |

**改哪里**：

`agents/reasonix/package.json` — 改 bin 名字：

```json
"bin": {
  "ar-reasonix": "dist/cli/index.js",
  "ar-dsnix": "dist/cli/index.js"
}
```

---

## 平台适配器使用改名后的二进制

`electron/agents/codewhale.ts` 和 `electron/agents/reasonix.ts` 中 spawn 时用新名字：

```typescript
// codewhale adapter
spawn('ar-codewhale', ['--mode', 'platform', 'exec', '--output-format', 'stream-json', command])

// reasonix adapter
spawn('ar-reasonix', ['--mode', 'platform', task])
```

---

## 署名与来源声明

每个 fork 目录根下放一个 `FORK.md`，记录来源和改动。

### agents/codewhale/FORK.md

```markdown
# CodeWhale Fork

- **原项目**: CodeWhale
- **来源**: https://github.com/CodeWhaleTeam/codewhale
- **许可证**: 见 LICENSE 文件
- **Fork 版本**: v0.8.46
- **Fork 日期**: 2025-05-30
- **改动内容**:
  - 二进制名改为 ar-codewhale / ar-codewhale-tui（避免路径冲突）
  - 新增 --mode platform 参数（平台集成模式）
  - 事件输出对齐 AgentRouter 协议格式
- **上游跟进方式**: git rebase 或手动合并 tag
```

### agents/reasonix/FORK.md

```markdown
# Reasonix Fork

- **原项目**: DeepSeek-Reasonix
- **来源**: https://github.com/esengine/DeepSeek-Reasonix
- **许可证**: 见 LICENSE 文件
- **Fork 版本**: v0.52.0
- **Fork 日期**: 2025-05-30
- **改动内容**:
  - 二进制名改为 ar-reasonix / ar-dsnix（避免路径冲突）
  - 新增 platform 子命令（平台集成模式）
  - 输出格式改为 NDJSON 事件流
- **上游跟进方式**: git rebase 或手动合并 tag
```

### 项目级声明

同时在项目根 README.md 或 LICENSE 文件中加一段全局声明：

```markdown
## 使用的开源项目

AgentRouter 集成了以下开源项目的修改版本：

| 项目 | 原仓库 | 许可证 | 自定义修改 |
|---|---|---|---|
| CodeWhale | https://github.com/CodeWhaleTeam/codewhale | MIT | 改名、加 platform 模式 |
| DeepSeek-Reasonix | https://github.com/esengine/DeepSeek-Reasonix | MIT | 改名、加 platform 子命令 |

各项目的完整许可证文本见对应 agents/{project}/LICENSE 文件。
```
