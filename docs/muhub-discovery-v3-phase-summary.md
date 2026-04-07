# MUHUB Discovery V3 阶段总结

## 1. 阶段背景

MUHUB 在 Beta 阶段，需要建立以下关键能力：

- 项目发现能力
- 自动补全能力
- 内容智能能力

Discovery 系统的目标是：从多来源自动发现项目，进入队列，人工审核，导入项目库，再由内容智能体补全信息，形成可持续迭代的上游输入链路。

---

## 2. Discovery 系统总体架构

```text
Sources
  → Scheduler
  → Discovery Queue
  → Dedupe
  → Review
  → Import
  → Content Intelligence
  → Project Database
```

各模块作用如下：

### Sources

当前来源：

- Manual
- RSS
- GitHub Batch

### Scheduler

统一调度入口：

- `runDiscoveryScheduledJob()`

### Discovery Queue

当前实现：

- JSON Queue
- `data/discovery-items.json`

### Dedupe

规则型去重：

- `normalizedUrl`
- `githubRepoKey`
- `websiteHost + title`

### Review

后台入口：

- `/admin/discovery/items`

### Import

导入项目能力：

- create project
- 保存来源信息

### Content Intelligence

自动补全：

- AI enrichment
- scheduled job（导入后调度）

---

## 3. Discovery V2 阶段

### V2 目标

建立 Discovery 基础系统。

### V2 实现

- JSON Queue
- Review UI
- Import

### V2 结果

形成基础闭环：

`Discovery → Import → Project`

---

## 4. Discovery V2.x 阶段

增强能力：

### V2.2

`Import → Content Intelligence`

自动补全接入。

### V2.3

AI scheduled 状态可观测能力落地。

---

## 5. Discovery V3.1 — RSS Discovery

新增目录：

- `agents/discovery/rss/`

能力：

- 读取 RSS
- 写入 Discovery Queue

当前来源：

- Product Hunt

限制：

- 来源较少
- 不做 Import

---

## 6. Discovery V3.2 — GitHub Discovery

新增目录：

- `agents/discovery/github/`

能力：

- GitHub URL 解析
- 批量入队

支持：

- repo 根路径
- 深路径回退

---

## 7. Discovery V3.3 — 去重机制

新增：

- `discovery-dedupe.ts`

强去重：

- `normalizedUrl`
- `githubRepoKey`
- `websiteHost + title`

弱去重：

- 标记 `possibleDuplicate`

UI：

新增 Duplicate 列。

---

## 8. Discovery V3.4 — 定时调度

新增：

- `scheduler/`

能力：

统一调度入口：

`runDiscoveryScheduledJob()`

支持：

- RSS
- GitHub batch

脚本：

`pnpm discovery:scheduled-run`

---

## 9. 当前系统能力总结

当前 Discovery 系统已具备：

- 多来源发现
- 去重机制
- 队列管理
- Review UI
- Import Project
- Content Intelligence
- 定时调度入口

---

## 10. 当前系统边界

尚未实现：

- 真正 cron 调度
- GitHub API metadata
- RSS 来源扩展
- AI enrichment 完整闭环
- JSON Queue → Prisma 统一

---

## 11. 下一阶段建议

优先级建议：

### 优先级 A

稳定性增强：

- AI done/failed 回写
- Scheduler logs

### 优先级 B

来源扩展：

- 更多 RSS
- GitHub API

### 优先级 C

架构升级：

- JSON → Prisma

---

## 12. 阶段结论

MUHUB Discovery 已完成基础系统构建：

从：

手动录入

进化为：

半自动发现系统

当前系统：

具备扩展为自动发现平台的基础。

下一阶段：

稳定性 + 来源扩展 + 架构升级
