# MUHUB Discovery V3 规划文档

> **文档性质**：Discovery V3 阶段规划（内部工程文档）。  
> **范围说明**：本文件只描述规划与拆分，不包含代码实现承诺。

## 1. 阶段目标

Discovery V3 的核心目标是：从「手动发现」升级为「半自动发现」。

当前 Discovery V2 已具备：

- 手动输入 GitHub URL（Demo）
- JSON Queue
- Admin Import
- Content Intelligence 联动（Import 后触发）

Discovery V3 的目标是在此基础上扩展来源能力，支持：

- RSS
- GitHub Trending
- API 来源
- 手动补充

最终形成可运营的多来源 Discovery 系统，而不是一次性建设复杂自动化平台。

## 2. 当前 Discovery 架构回顾

当前主链路可概括为：

```text
DiscoveryItem (JSON)
  ↓
Admin Review
  ↓
Import Project
  ↓
Content Intelligence
  ↓
Project Database
```

V2 已形成基础闭环，但发现能力仍偏弱，主要问题：

- 来源单一（以手动 GitHub URL 为主）
- 发现入口依赖人工输入
- 缺少自动发现任务
- 去重仍以轻量规则为主

## 3. Discovery V3 设计目标

### 3.1 多来源发现

新增并统一以下来源入口：

- RSS Feed
- GitHub Trending / Topics
- API 来源
- 手动输入（保留）

### 3.2 自动发现

引入可控定时任务，优先覆盖：

- 每日 RSS 扫描
- 每日 GitHub Trending 扫描

### 3.3 去重机制

建立统一去重策略，减少重复候选：

- 同一 GitHub Repo
- 同一 Website
- 同名项目（保守匹配）

## 4. Discovery 来源设计

### 4.1 RSS Discovery

新增 RSS Source 配置与抓取流程，首批可选来源：

- Product Hunt RSS
- GitHub Releases（可作为补充渠道）
- 技术博客聚合源

流程：

```text
RSS
  ↓
Parse
  ↓
DiscoveryItem
```

### 4.2 GitHub Trending

新增 GitHub Trending / Topics 的发现流程：

- Trending 列表抓取
- Topic 定向抓取

流程：

```text
GitHub Trending / Topics
  ↓
Parse
  ↓
DiscoveryItem
```

### 4.3 API Discovery

未来扩展 API 来源（按成本逐步接入）：

- Product Hunt API
- Hacker News API
- 其他开放 API

本阶段不承诺一次性覆盖，优先做可稳定运行的少量来源。

## 5. 数据结构扩展

为适配多来源，建议在 `DiscoveryItem`（或未来统一模型）增加字段：

- `sourceName`
- `sourceUrl`
- `discoveredAt`
- `score`（预留，后续用于运营排序）

示例（概念层）：

```text
DiscoveryItem:
id
title
url
sourceType
sourceName
sourceUrl
discoveredAt
score (optional)
```

说明：字段落地形式应与后续「JSON Queue 与 Prisma Candidate 关系」同步决策，避免双端重复维护。

## 6. 去重机制设计

去重优先级建议：

1. GitHub URL（规范化后匹配）
2. Website URL（规范化后匹配）
3. 项目名称（保守匹配，仅作为辅助）

去重流程：

```text
发现项目
  ↓
查重（URL > 网站 > 名称）
  ↓
命中：标记 duplicate / 记录来源关系
未命中：加入队列
```

补充：对“疑似重复但不确定”的情况保留人工审核兜底，避免误合并。

## 7. Discovery 系统架构

V3 目标结构：

```text
RSS / GitHub / API / Manual
  ↓
Discovery Queue（统一入口）
  ↓
Admin Review
  ↓
Import
  ↓
Project
```

关于 JSON Queue 与 Prisma Candidate 的关系：

- 当前保持双轨并存（兼容历史实现）
- V3 需要明确“单一主写入面”（建议评估 Prisma Candidate 作为主存储）
- JSON 可保留为边缘缓冲或调试入口，而非长期主系统

## 8. 与 Content Intelligence 联动

V3 继续复用既有联动：

`Import -> scheduleProjectAiEnrichment`

当前无需新增联动机制，重点是保证多来源导入后仍能走同一触发路径。  
换言之，Discovery 与 Content 的职责边界维持解耦：Discovery 负责“发现与入库”，Content 负责“导入后补全”。

## 9. 阶段拆分

### V3.1

RSS Discovery（来源配置、抓取、解析、入队）

### V3.2

GitHub Trending / Topics Discovery

### V3.3

统一去重机制（规则、规范化、重复标记）

### V3.4

自动任务（定时执行、失败重试、基础可观测）

## 10. 开发优先级

建议优先级：

1. RSS Discovery
2. GitHub Trending
3. 去重机制
4. 定时任务

优先原则：先扩入口，再控质量，再提自动化稳定性。

## 11. 风险与边界

V3 需明确边界，避免目标膨胀：

- 不做复杂 AI 自动发现（本阶段重点仍是规则化发现）
- 不引入复杂评分/排序大系统
- 不追求全自动平台

Discovery V3 的定位仍是：**半自动发现系统**，强调可控、可审、可持续迭代。

## 12. 结论

Discovery V3 将把 MUHUB 从“手动发现”推进到“多来源半自动发现”，重点提升输入稳定性与来源覆盖。  
在不破坏现有 V2 闭环与 Content 联动的前提下，V3 通过来源扩展、去重和任务化能力，为 MUHUB AI 信息层提供更稳定、可运营的上游输入。

---

## 相关参考（相对路径）

- `./muhub-discovery-v2-phase-summary.md`
- `./muhub-discovery-content-linkage.md`
- `./discovery/discovery-architecture.md`
