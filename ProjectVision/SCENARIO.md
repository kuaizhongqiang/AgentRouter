# AgentRouter — 场景推演

---

## 核心场景：性价比编排

> **Reasonix 当建筑师画图纸，CodeWhale 当施工队干活。**

没有哪个开源 CLI 是万能的。AgentRouter 的价值在于：**把对的开源 CLI 放在对的位置上。**

---

## 场景：给项目加 RBAC 权限系统

### Step 1-2：绑项目 + 输入需求

小B 打开桌面端，选 Reasonix 当 PM，输入：

```
"给项目加 RBAC 权限系统，支持管理员管理用户角色"
```

### Step 3：Reasonix 拆解任务

```json
{
  "tasks": [
    { "id": "t1", "title": "数据库：添加 roles 和 permissions 表", "assignee": "codewhale" },
    { "id": "t2", "title": "中间件：创建角色校验中间件", "assignee": "codewhale", "depends_on": ["t1"] },
    { "id": "t3", "title": "API：用户角色管理接口", "assignee": "codewhale", "depends_on": ["t1"] },
    { "id": "t4", "title": "安全审查", "assignee": "reasonix", "depends_on": ["t2","t3"] }
  ],
  "parallel_groups": [["t1"], ["t2","t3"], ["t4"]]
}
```

同时产出设计说明文档。调度器查标签：
- CodeWhale → `max_instances=4` → t1/t2/t3 并行没问题
- Reasonix → `max_instances=1` → t4 等前面干完

### Step 4：并行执行（YOLO 模式）

```
第1组 → t1 CodeWhale（建表）
第2组 → t2 + t3 CodeWhale × 2 并行（中间件 + API）
第3组 → t4 Reasonix（安全审查 + 发现问题自动修复）
```

### Step 5：完成

```
总 Token 消耗：
  t1: 全量读 2000 行 → 2000
  t2: 增量读 ~200 行 → 200    ← 上下文传递
  t3: 增量读 ~200 行 → 200    ← 上下文传递
  t4: 增量读 ~100 行 → 100    ← 只读 diff
  ──────────────────────────
  总计 2500 Token（无传递则 8000）
```

---

## 模式切换

| 模式 | 行为 | 适合 |
|---|---|---|
| **YOLO** 🚀 | 全自动 | 信心足 |
| **审批** ✅ | 确认后执行 | 生产环境 |
| **逐步** 👣 | 每组确认 | 想跟进度 |
| **预览** 👀 | 只看不执行 | 需求分析 |
