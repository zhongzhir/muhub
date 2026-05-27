# Discovery 运营 Runbook

> **版本**：2026-05-28  
> **受众**：运营、管理员、开发协作  
> **关联**：[架构审视](../architecture/muhub-architecture-review-2026-05.md)、[Entity Discovery 架构](./entity-discovery-architecture.md)、[Discovery V2 架构](./discovery-architecture.md)

---

## 1. 一句话地图

MUHUB Discovery 不是「人工维护项目库」，而是：**维护高质量 Source → 系统产出 Signal / Candidate → 人工审核 → 导入 Project**。

出版 AI（`publishing_ai`）在同一套流水线上运行，通过 Source 的 `scope` 区分。

---

## 2. 概念对照（必读）

| 概念 | 是什么 | Admin 入口 | 何时使用 |
|------|--------|------------|----------|
| **Source Network** | 可配置的**信息源**（RSS、名单页、GitHub topic 等） | `/admin/discovery/sources` | 新增/维护来源；跑抓取 |
| **Signal** | **原始线索条目**（一篇文章、一条 RSS、一页公告） | `/admin/discovery/signals` | 新闻/公告/名单类；信息不完整 |
| **Entity Hint (E1)** | 从 Signal 抽出的**命名实体**（机构、实验室、项目名） | `/admin/discovery/entities` | 名单/公告/实验室；不要求 URL |
| **Candidate** | **类 Project 的候选记录**（有 title、可 enrich/import） | `/admin/discovery` | GitHub/PH/高置信产品发布 |
| **Project** | 主站正式项目 | `/admin/projects` | 审核导入后的终点 |

### 2.1 三者会不会重复？

**会。** 同一 RSS URL 可能同时存在：

- 1 条 **Signal**（原始条目）
- 0～1 条 **Candidate**（auto-convert 或人工「转为候选项目」）
- 0～N 条 **EntityHint**（「抽取 Entity Hint」）

**运营原则**：

- **Signal = 来源真相**（原文链接在此）
- **Candidate = 准备上架的项目形态**
- **EntityHint = 实体线索池**（E1 仅审核 ACCEPT/REJECT，暂不晋升 Project）

名单、公告、实验室类来源 **优先走 Signal → Entity Hint**，不要强行「转为候选项目」。

---

## 3. 推荐操作流程（publishing_ai）

```text
1. 信息源 (/admin/discovery/sources?scope=publishing_ai)
   └─ 新增/检查 RSS、协会名单、公告源；configJson.scopes 含 publishing_ai

2. 触发抓取 (/admin/discovery/tasks 或 Source 行内「运行」)
   └─ Run 完成后查看 signalCount / candidateCount

3. 线索池 (/admin/discovery/signals)
   ├─ 高置信产品发布 → 「转为候选项目」
   └─ 名单/机构/实验室 → 「抽取 Entity Hint」（E1）

4. 实体线索 (/admin/discovery/entities)  [E1，可选]
   └─ ACCEPT / REJECT / 待合并；暂不进入 Project

5. 候选项目 (/admin/discovery)
   └─ Enrich → Classify → Approve → 导入 Project

6. 正式项目 (/admin/projects/[id]/edit)
   └─ 补来源、AI 分析、发布
```

---

## 4. Admin 入口速查

| 步骤 | URL | 顶栏 layout 链接 |
|------|-----|------------------|
| Discovery 导航条 | 各 Discovery 子页顶部 | 项目筛选组 |
| 信息源 | `/admin/discovery/sources` | 信息源 |
| 线索池 | `/admin/discovery/signals` | 线索池 |
| 实体线索 | `/admin/discovery/entities` | 实体线索 |
| 候选项目 | `/admin/discovery` | 候选列表 |
| 今日工作台 | `/admin/discovery/daily` | 今日工作台 |
| 抓取任务 | `/admin/discovery/tasks` | 抓取与任务 |
| 运营文档 | 本文 | — |

各 Discovery 子页顶部有 **「Discovery 运营导航」** 条，按 1→4 主流程排列。

---

## 5. Feature Flags

定义于 `lib/discovery/discovery-feature-flags.ts`，`.env.example` 有注释。

### 5.1 Vertical Discovery（默认开启）

| 变量 | 默认 | 说明 |
|------|------|------|
| `VERTICAL_DISCOVERY_ENABLED` | true | Vertical scope 总开关 |
| `VERTICAL_DISCOVERY_RSS_ENABLED` | true | RSS 接入 run 总线 |
| `VERTICAL_DISCOVERY_PUBLISHING_PIPELINE` | true | publishing 批量 pipeline |
| `VERTICAL_DISCOVERY_PUBLISHING_RSS_FILTER` | true | RSS 出版+AI 关键词过滤 |

关闭 `VERTICAL_DISCOVERY_ENABLED` 影响面大，生产慎用。

### 5.2 Entity Discovery E1（默认关闭）

| 变量 | 默认 | 说明 |
|------|------|------|
| `ENTITY_DISCOVERY_ENABLED` | **false** | Entity 总开关 |
| `ENTITY_HINT_EXTRACTION_ENABLED` | **false** | Signal → EntityHint 抽取 |

**Rollback**：设为 `false` 或删除变量 → 零影响 Candidate/Project 主链。

脚本验收可用 `--force` 绕过 flag（仅开发/运维）。

### 5.3 Training（未接线）

| 变量 | 默认 | 说明 |
|------|------|------|
| `TRAINING_PROJECTS_MODE` | static | `live` 预留；training 页仍静态卡片 |

---

## 6. 常用脚本

### 6.1 生产 / 运维

| 命令 | 用途 |
|------|------|
| `pnpm tsx scripts/seed-website-scan-dpresearch.ts` | 种子：数字出版研究 WEBSITE_SCAN 来源 |
| `pnpm tsx scripts/run-publishing-discovery.ts publishing-website-scan-dpresearch` | 单独跑站点扫描 |
| `pnpm tsx scripts/run-publishing-discovery.ts` | 跑 publishing_ai 来源 + auto-convert |
| `pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50` | 批量抽取 EntityHint（需 ENTITY_* 或 `--force`） |
| `pnpm prisma migrate deploy` | 应用 DB migration |

### 6.2 Cron HTTP（需部署配置）

| 路由 | 职责 |
|------|------|
| `GET /api/cron/daily-discovery` | Discovery 日工作流 |
| `GET /api/cron/ai-update` | Project AI 批处理 |
| `GET /api/cron/source-update` | 信息源更新 |
| `GET /api/cron/summary-update` | 周摘要 |
| `GET /api/cron/track-official-info` | 官网追踪 |

**注意**：`pnpm cron:all` **不包含** daily-discovery，需单独调度。

### 6.3 验收 / 统计

| 命令 | 用途 |
|------|------|
| `pnpm tsx scripts/acceptance-publishing-discovery-stats.ts` | publishing 统计 |
| `pnpm tsx scripts/acceptance-entity-discovery-e1.ts` | Entity E1 表可读性 |
| `pnpm tsx scripts/acceptance-discovery-counts.ts` | Discovery 计数 |

### 6.4 Entity Hint 抽取示例

```bash
# .env 开启
ENTITY_DISCOVERY_ENABLED=true
ENTITY_HINT_EXTRACTION_ENABLED=true

# 批量（publishing_ai）
pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50

# 仅规则、不调用 LLM
pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50 --no-ai

# 单条 Signal
pnpm tsx scripts/extract-entity-hints.ts --signal-id <id> --force

# 预览不写库
pnpm tsx scripts/extract-entity-hints.ts --dry-run --limit 10 --force
```

---

## 7. Source 类型与产出路径

| Source 类型 | 典型产出 | 运营动作 |
|-------------|----------|----------|
| GITHUB / PRODUCTHUNT | 直写 **Candidate** | `/admin/discovery` 审核 |
| RSS / NEWS (publishing_ai) | **Signal**（可 auto-convert Candidate） | 先 `/signals`；名单类抽 Entity |
| **WEBSITE_SCAN** | **Signal**（关键词匹配页/微信外链） | 见 §7.1；再抽 Entity Hint |
| INSTITUTION 名单页 | Candidate 或 Signal（视 scope/adapter） | 中文权威名单优先 Entity 路径 |
| 手动 mobile capture | Candidate | `/admin/discovery/mobile` |

### 7.1 WEBSITE_SCAN（受控站点扫描 MVP）

**不是全站爬虫**。通过 `configJson.mode = "website_scan"` 启用 BFS 受控扫描，产出 **DiscoverySignal**（不写 Candidate）。

**配置示例**：

```json
{
  "mode": "website_scan",
  "startUrls": ["http://dpresearch.bjzzcb.com/"],
  "allowedDomains": ["dpresearch.bjzzcb.com", "mp.weixin.qq.com"],
  "maxDepth": 2,
  "maxPages": 50,
  "includeKeywords": ["AI", "人工智能", "数字出版", "智能出版"],
  "excludePatterns": ["login", "search", "comment"],
  "scopes": ["publishing_ai"]
}
```

**规则摘要**：

- 仅 `allowedDomains`；最多 `maxDepth` / `maxPages`
- 页面需命中 `includeKeywords` 才写入 Signal
- 排除附件（pdf/图片/视频等）与 `excludePatterns`
- `mp.weixin.qq.com`：保存链接 URL + 锚文本，不强求抓正文

**Admin**：来源类型选 `WEBSITE_SCAN`；详情页显示 fetched/matched/newSignals。

**种子脚本**：

```bash
pnpm tsx scripts/seed-website-scan-dpresearch.ts
pnpm tsx scripts/run-publishing-discovery.ts publishing-website-scan-dpresearch
```

**后续**：Signal → `extract-entity-hints.ts`（E1，非 E2）。

**后续演进（暂未做）**：sitemap.xml / 站内 RSS 自动发现起始 URL。

---

## 8. 暂不进入 Entity E2 的原因

依据 [架构审视 §7](../architecture/muhub-architecture-review-2026-05.md)：

1. **publishing_ai 中文权威 Source 仍不足**，E1 抽检多为英文 RSS 噪声  
2. **Signal / Candidate / EntityHint 同源重复**尚未有 merge 策略与统一视图  
3. **E1 Hint 人工抽检未达标**（目标 ≥50 条 ACCEPT/REJECT 统计）  
4. **EntityCandidate / Project Promotion 未设计评审**，贸然开发会污染 Candidate 池  

**当前纪律**：

- E1 仅：抽取、列表、ACCEPT/REJECT  
- **不做** EntityCandidate、merge、verification、Promotion  
- **不做** training live、Project 主流程改动  

预计满足门槛后再启动 E2（Resolution + evidence 聚合）。

---

## 9. 故障与回滚

| 现象 | 检查 | 动作 |
|------|------|------|
| RSS 无 Signal | `VERTICAL_DISCOVERY_RSS_ENABLED` | 开 flag；检查 Source configJson.url |
| Entity 抽取无反应 | `ENTITY_*` flags | 开 flag 或 Signal 页手动抽取 / 脚本 `--force` |
| 候选重复过多 | 同一 Signal 又 convert 又 extract | 以 Signal 为准；reject 重复 Candidate |
| publishing 无候选 | pipeline flag、Source scope | `run-publishing-discovery.ts`；查 sources 页 yield |
| 误开 Entity 影响主站 | — | 关 `ENTITY_DISCOVERY_ENABLED`；Candidate 路径不受影响 |

---

## 10. 相关文档

| 文档 | 路径 |
|------|------|
| Discovery V2 架构 | `docs/discovery/discovery-architecture.md` |
| Entity Discovery 架构 | `docs/discovery/entity-discovery-architecture.md` |
| 出版 AI V2 方案 | `docs/discovery/publishing-ai-discovery-v2-technical-plan.md` |
| 多来源项目原则 | `docs/discovery/multi-source-project-principle.md` |
| 架构审视 2026-05 | `docs/architecture/muhub-architecture-review-2026-05.md` |

---

*Runbook 随 P0 收敛更新；E2 启动前需修订 §8 与操作流程。*
