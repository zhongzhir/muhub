# MUHUB 项目信息链路重构方案

状态：方案文档，待确认后进入代码修改。

本文目标是重新定义 MUHUB 从项目信息抓取、入库、AI 分析、展示到发布的职责边界，解决重复生成、重复写入、字段互相覆盖和发布失败问题。

核心原则沿用 `docs/product/muhub-product-principles.md`：

- 发布 = 最小可展示；增强 = 后续质量提升。
- 系统默认向前流转，除非基础信息缺失或安全/规则问题，不应阻断。
- AI 认知卡 / AI 结构化分析是统一知识出口。
- GitHub 只是信息源之一，不是强绑定。
- 项目方认领后的官方信息优先级最高。

## 1. 当前链路梳理

### 1.1 从 discovery 到 public page 的完整路径

```text
Discovery item / JSON queue
  -> lib/discovery/import-json-queue-item.ts
  -> Project + ProjectSource + ProjectExternalLink
  -> optional GitHub facts refresh
  -> lib/discovery/project-source-enrichment.ts
  -> lib/project-ai-insight.ts + lib/project-knowledge.ts
  -> lib/project-ai-content.ts
  -> apply required/recommended fields
  -> admin edit page
  -> publish readiness / bulk publish
  -> lib/load-project-page-view.ts
  -> lib/map-project-row.ts
  -> app/projects/[slug]/page.tsx
```

### 1.2 各环节读、生成、写入内容

| 环节 | 主要文件 | 读取 | 生成 | 写入 |
| --- | --- | --- | --- | --- |
| discovery item 提取 | `lib/discovery/import-json-queue-item.ts` | discovery queue item、URL、article/source metadata | name/slug 候选、repo/website/article/source 列表 | 主要在 import 阶段写入 |
| project import | `lib/discovery/import-json-queue-item.ts` | 解析后的 discovery link、existing Project、existing sources | 初始 `name`、`slug`、`tagline`、`description`、website/github/source records | `Project`、`ProjectSource`、`ProjectExternalLink`、`ProjectActivity` |
| ProjectSource 写入 | `prisma/schema.prisma`、`lib/discovery/import-json-queue-item.ts`、`lib/discovery/project-source-enrichment.ts` | GitHub、website、article、curated、official meta | source `kind/url/label/title/content/summary`、质量字段 | `ProjectSource` |
| GitHub facts refresh | `lib/discovery/post-import-project-ai.ts` 等 GitHub sync 入口 | `githubUrl` 或 GitHub source | repo facts、README、activity signals | GitHub snapshot/facts 相关表与项目 AI/source 信号 |
| source enrichment | `lib/discovery/project-source-enrichment.ts`、`lib/discovery/post-import-project-ai.ts` | Project 基础字段、sources、website/github | 补充 sources、source quality、resolved github | `ProjectSource`，必要时补 Project source hints |
| AI insight / AI 认知卡 | `lib/project-ai-insight.ts`、`app/api/admin/projects/[id]/ai-insight/route.ts` | Project、sources、GitHub facts、website facts、socials、activity | `aiInsight`、`aiKnowledgeJson`、AI signals、suggested tags/categories、completeness、source snapshot | `Project.aiInsight`、`aiKnowledgeJson`、`aiSignals`、`aiSuggestedTags`、`aiSuggestedCategories`、`aiCompleteness`、`aiSourceSnapshot`、`aiSourceLevel`、`aiInsightStatus`；当前还会通过 `saveProjectKnowledge` 写 `primaryCategory/categoriesJson/tags` |
| AI content / AI 增强版详情 | `lib/project-ai-content.ts`、`app/api/admin/projects/[id]/ai-content/route.ts` | `officialInfo`、`aiInsight`、source snapshot、tags/category | one-liner、short/medium/long description、audience versions、poster copy | `Project.aiContent`、`aiContentStatus`、`aiContentDraft` |
| apply required fields | `lib/discovery/post-import-project-ai.ts` | `aiInsight`、`aiContent`、`aiKnowledgeJson`、Project legacy fields | tagline/description/simpleSummary/category/tags fallback | `Project.tagline`、`description`、`simpleSummary`、`primaryCategory`、`tags`、`categoriesJson`、`aiKnowledgeJson` |
| apply recommended fields | `app/api/admin/projects/[id]/apply-ai-*/route.ts` | `aiInsight`、suggested tags/categories、operator selection | AI summary/description/tags/categories 应用结果 | `Project.tagline`、`description`、`tags`、`primaryCategory`、`categoriesJson` |
| admin edit page | `lib/admin-project-edit.ts`、`app/admin/projects/[id]/edit/actions.ts`、`app/admin/projects/[id]/edit/*` | Project、officialInfo、sources、links、AI ops logs | 人工编辑后的展示字段、状态变更 | `Project` 多个展示字段、status/visibility、external links |
| publish readiness | `lib/project-publishing.ts` | Project 基础字段、`aiInsight`、`aiKnowledgeJson`、`aiCardSummary`、sources、status/visibility | blocked/warnings/skipped、publish quality | publish update data、activity |
| bulk publish | `app/api/admin/projects/bulk-action/route.ts` | 当前勾选 project ids 对应的 Project rows | counts、blocked reason、warnings | 批量更新 status/visibility/isPublic/publishedAt |
| public page rendering | `lib/load-project-page-view.ts`、`lib/map-project-row.ts`、`app/projects/[slug]/page.tsx`、`components/project/*` | Project legacy fields、`aiKnowledgeJson`、sources、updates、officialInfo、aiContent | hero summary、info sections、links、source list、activity display | 前台只读渲染 |

### 1.3 当前重复生成点

- `Project.tagline/description` 在 import 时由 discovery 内容初始生成，在 AI insight 后由 `applyRequiredProjectFields` 再生成，在后台 `apply-ai-summary/description` 可再次生成，后台编辑页也可人工覆盖。
- `primaryCategory/tags/categoriesJson` 由 `saveProjectKnowledge` 写入，也由 `applyRequiredProjectFields` 写入，还可由后台 `apply-ai-tags/categories` 与人工编辑写入。
- `aiInsight` 与 `aiContent` 都能产出项目摘要、适用对象、亮点和长描述，当前缺少明确的“谁是核心知识，谁是传播内容”边界。
- public page 再次从 `description/simpleSummary/tagline/aiKnowledge/github facts` 派生 summary 和 highlights，导致展示层和知识层边界混在一起。
- GitHub facts refresh、source enrichment、AI insight source snapshot 都在构建事实上下文，但缺少统一的 Source -> Knowledge 输入契约。

### 1.4 当前字段覆盖风险

- `lib/project-knowledge.ts` 的 `saveProjectKnowledge` 保存知识时会同步写 `primaryCategory/categoriesJson/tags`，可能覆盖人工或已有展示字段。
- `lib/discovery/post-import-project-ai.ts` 的 `applyRequiredProjectFields` 会批量写 `tagline/description/simpleSummary/primaryCategory/tags/categoriesJson/aiKnowledgeJson`，容易覆盖 import 或后台编辑后的字段。
- `app/api/admin/projects/[id]/apply-ai-*/route.ts` 多个 apply route 直接写 Project 展示字段，和自动 pipeline 的 apply 逻辑重复。
- `app/admin/projects/[id]/edit/actions.ts` 将后台表单字段写回 Project，并重建 external links。后续自动 apply 如果继续运行，可能再次覆盖人工结果。
- Project legacy fields 同时承担“导入缓存、人工展示字段、AI 推荐结果、前台渲染来源”多重角色，无法判断当前值的权威来源。

### 1.5 当前发布阻断风险

- 发布链路存在两套校验：`evaluateProjectPublishReadiness` 与 `validateProjectForPublish`。当前规则已放宽，但双入口仍有未来分叉风险。
- `aiInsightStatus`、`aiStatus`、`aiContentStatus`、`aiCompleteness`、`aiSourceLevel` 同时描述生成状态、质量状态和发布状态，容易被误用为硬门槛。
- `evaluatePublishGuard` 仍保留历史语义，虽然当前主发布路径不应再用它阻断，但存在后续误调用风险。
- GitHub refresh 与 AI content 失败已不应 blocked，但链路中仍有 GitHub-first 的事实采集和展示假设，容易让无 GitHub 项目被误判为信息不足。
- 批量发布依赖明确勾选 ids。若 UI 或隐藏 input 产生 stale ids，会导致“已选 0 项但 action 仍处理项目”的风险，需要继续保持前端禁用和后端空 ids 直接返回。

## 2. 问题诊断

### 2.1 AI 认知卡、AI 增强、基础信息、项目详情冲突的原因

根因不是某个单点 AI 失败，而是同类字段存在多个写入者：

- discovery import 直接写展示字段。
- AI insight 生成结构化知识，但保存时也写分类和标签。
- AI content 生成营销文案，与 description/detail 概念重叠。
- apply required/recommended fields 将 AI 结果再写回 Project 展示字段。
- admin edit page 也把同一批字段作为人工编辑结果写回。

因此 `Project` 当前既是原始导入缓存，也是 AI 结果缓存，也是人工展示字段，也是 public page 的读取源。没有字段权威层级时，后运行的任务天然会覆盖先运行的结果。

### 2.2 为什么手动生成成功但自动发布仍可能失败

- 手动生成 AI 认知卡会更新 `aiInsight/aiKnowledgeJson/aiInsightStatus`，但如果发布读取的是旧的派生字段、旧状态或另一套 readiness 逻辑，就可能显示“已生成”但发布仍认为缺失。
- 历史链路中 AI content、full AI、GitHub enrichment 等曾被当作质量完成信号；这些信号如果被误用为 blocked，就会让非核心增强失败阻断发布。
- 自动 pipeline 的 `applyRequiredProjectFields` 失败、跳过或覆盖不完整时，Project legacy 展示字段可能仍缺 tagline/description，导致 readiness 与 AI 页展示不同步。
- 批量发布只应处理明确选中的 DRAFT 项目。若 action 输入不是当前勾选 ids，而来自当前页列表或残留 hidden input，会造成状态提示与实际处理不一致。

### 2.3 语义混乱的状态字段

- `aiInsightStatus`：应只表达核心结构化知识生成状态。
- `aiStatus`：当前更像整体 AI 质量状态，不能作为发布硬门槛。
- `aiContentStatus`：应只表达营销/增强内容生成状态，不参与 readiness blocked。
- `aiCompleteness`：质量分，不应阻断发布。
- `aiSourceLevel`：来源覆盖水平，不应阻断发布，只能进入 warnings。
- `full_ai/partial_ai/pending`：应是后台质量标记，不是发布门槛。
- `status/visibilityStatus/isPublic/publishedAt`：流程发布状态，必须和 AI 质量状态解耦。

### 2.4 隐含 GitHub 强绑定的位置

- import 后如果有 `githubUrl` 会优先触发 GitHub facts refresh。
- source enrichment 与 AI snapshot 都会读取 GitHub facts，并且部分展示组件围绕 repo metrics/highlights 构建。
- `githubUrl` 同时存在于 Project legacy field 和 ProjectSource，缺少统一来源解析。
- public page 的 repo section 是展示增强，不应暗示无 GitHub 即信息不足。

建议立即改：把 GitHub 相关失败统一降级为 warning/source coverage issue，不进入 blocked。

建议延后改：将 GitHub facts refresh 完全改造成 ProjectSource/Knowledge enrichment 的插件式输入。

不建议改：不建议删除 GitHub 支持；GitHub 对开源项目仍是高价值 source，只是不再是强绑定。

## 3. 新架构设计

建议采用四层结构。

### 3.1 Source Layer

权威对象：`ProjectSource`。

职责：

- 只保存事实来源和证据，不保存最终展示结论。
- source 类型包括 website、GitHub、Gitee、article、social、official、curated、manual note。
- 保存 `url/title/content/summary/kind/isPrimary/quality/verificationStatus` 等来源属性。
- 允许 enrichment 更新或新增 sources，但不直接发布、不直接覆盖展示字段。

建议立即改：所有 enrichment 失败只记录 source warning，不阻断发布。

建议延后改：给每个 source 增加更完整的 provenance/version 字段。

### 3.2 Knowledge Layer

权威对象：短期复用 `Project.aiInsight + Project.aiKnowledgeJson`，中期抽象 `ProjectKnowledgeService`，长期可选新增 `ProjectKnowledge` 表。

职责：

- AI 认知卡 / AI 结构化分析是唯一核心知识生成器。
- 从 Source Layer 和基础 Project 字段读取事实，产出结构化知识。
- 输出 summary、whatItIs、whoFor、useCases、category、tags、signals、source coverage、risks、suggestions。
- 不直接覆盖 Official Layer。
- 不直接把所有字段写成前台最终展示字段；通过 mapper 进入 Presentation Layer。

建议立即改：把 `saveProjectKnowledge` 的“知识保存”和“展示字段写回”拆开。

建议延后改：新增独立 `ProjectKnowledge` 表承载版本、来源快照、生成模型、人工审核状态。

### 3.3 Official Layer

权威对象：`ProjectOfficialInfo` 以及后台人工确认的官方字段。

职责：

- 项目方认领后维护的官方信息优先级最高。
- 官方 summary/fullDescription/contact/website/socials 不应被自动 AI 覆盖。
- 后台管理员手工确认字段也应记录为人工权威来源。

建议立即改：public page resolver 优先读取 officialInfo，再读 Knowledge，再读 Source/legacy fallback。

建议延后改：为 Project legacy presentation fields 增加 provenance 或维护独立 official presentation profile。

### 3.4 Presentation Layer

权威对象：面向页面/API 的 resolved view model，而不是多个流程随意写 Project 字段。

职责：

- 统一生成前台展示字段：summary、description、category、tags、links、source list、activity。
- 使用固定优先级：Official > Knowledge > Source > Legacy imported fields。
- 可以物化部分 Project 字段作为缓存，但必须由统一 mapper 写入，不能由多个业务流程各写各的。

建议立即改：建立统一 resolver/mapper，先用于 readiness 和 public page。

不建议改：不建议让 AI content 直接成为 public page detail 的默认权威来源。

## 4. 统一信息流

目标流程：

```text
discovery/import
  -> ProjectSource
  -> AI 结构化分析 / AI 认知卡
  -> ProjectKnowledge
  -> Presentation mapper
  -> readiness
  -> publish
  -> 后续 enrichment 只更新 Source/Knowledge，并产生 warnings/recommendations
```

关键约束：

- discovery/import 只创建项目身份、最小 legacy fallback 和 ProjectSource，不重复生成长详情。
- AI 结构化分析是核心知识生成入口；AI 增强只能补充 Source/Knowledge。
- Presentation mapper 是唯一把 Knowledge/Official/Source 映射为前台字段的地方。
- readiness 只读取 resolved presentation 和核心 knowledge，不读取 AI content 作为硬门槛。
- publish 只改变流程状态：`status/visibilityStatus/isPublic/publishedAt`。
- 后续 enrichment 不回退发布状态，不阻断已满足最小可展示条件的项目。

## 5. 字段权威优先级

总原则：Official > Knowledge > Source > Legacy imported fields。

| 字段 | 推荐权威优先级 | 说明 |
| --- | --- | --- |
| `name` | Official/admin confirmed > Source title/name > legacy imported `Project.name` | 项目身份字段。AI 只能建议，不应自动频繁改名。 |
| `slug` | system allocated/admin confirmed > legacy slug | URL 身份字段，不由 AI 生成覆盖。 |
| `tagline` | Official summary > Knowledge `summary/whatItIs` mapper > Source summary/title fallback > legacy `Project.tagline` | 发布最小展示字段之一。 |
| `description` | Official fullDescription > Knowledge `whatItIs/whoFor/useCases/summary` mapper > Source content/summary fallback > legacy `Project.description/simpleSummary` | 允许 Knowledge 生成基础描述；AI content 不直接作为权威描述。 |
| `primaryCategory` | Official/admin confirmed > Knowledge `primaryCategory` > Source classifier > legacy `Project.primaryCategory` | 当前可先以 Knowledge 为主，人工确认应可覆盖。 |
| `tags` | Official/admin confirmed > Knowledge tags/signals/platforms > Source topics/classifier > legacy `Project.tags` | GitHub topics 只是 source 输入之一。 |
| `websiteUrl` | Official website > primary website/official ProjectSource > legacy `Project.websiteUrl` | Project field 可保留为兼容缓存。 |
| `githubUrl` | GitHub/Gitee ProjectSource > legacy `Project.githubUrl` | 非必填，不参与 blocked。 |
| project detail / AI enhanced detail | Official fullDescription > Knowledge detail mapper > AI content as optional marketing draft > legacy description | AI 增强版详情不应直接覆盖核心详情。 |
| public page summary | Official summary > Knowledge summary > tagline/description fallback > legacy summary fields | 由 Presentation resolver 统一产出。 |
| source list | visible ProjectSource > legacy website/github fallback | source list 应展示来源，不等同于展示字段权威。 |
| activity | ProjectUpdate/ProjectActivity/manual updates > source-derived activity > GitHub facts | GitHub activity 是补充，不是唯一活跃度来源。 |

建议立即改：readiness 和 public page 先按此优先级读，不要求马上迁移所有数据。

建议延后改：为每个 resolved 字段返回 provenance，便于后台解释“这个字段来自哪里”。

## 6. AI 模块职责重新划分

### 6.1 AI 认知卡 / AI 结构化分析

定位：唯一核心结构化知识生成器。

应该负责：

- 读取 ProjectSource、基础 Project 字段、官方信息、activity。
- 生成 `aiInsight` 和 `aiKnowledgeJson`。
- 输出可供展示映射的 summary、分类、标签、目标用户、使用场景、风险和建议。
- 更新 AI insight 状态和质量提示。

不应该负责：

- 直接覆盖官方字段。
- 直接决定发布流程状态。
- 直接写多个 presentation fields，除非通过统一 mapper。

### 6.2 AI 增强版内容

定位：source/knowledge enrichment 与内容草稿，不是发布前置条件。

应该负责：

- 补充更好的描述、传播文案、受众版本。
- 作为后台建议和内容草稿。
- 失败时进入 warnings。

不应该负责：

- 阻断发布。
- 作为 full_ai 硬门槛。
- 直接覆盖 public page 详情。

### 6.3 AI 传播稿

定位：marketing/content。

只用于：

- 项目传播素材。
- 运营投放、海报、社媒文案。
- 项目方或运营后续补全。

不参与：

- publish readiness blocked。
- 项目最小可展示判断。

### 6.4 apply recommended fields

定位：从 Knowledge 到 Presentation 的受控映射，不再独立生成。

建议：

- 合并 `applyRequiredProjectFields` 和后台 apply route 的核心逻辑。
- 所有 apply 都调用同一个 mapper。
- mapper 必须识别 Official/manual confirmed 字段，默认不覆盖。

### 6.5 GitHub refresh

定位：事实来源补充。

规则：

- 有 GitHub 时使用 GitHub 增强。
- 无 GitHub 时基于 website / sources / article / description 增强。
- 都不足时跳过增强，进入 warning，不阻止发布。

## 7. 发布 readiness 新规则

### 7.1 blocked 只检查最小可展示条件

blocked 条件建议只包括：

- `name` 存在。
- `slug` 合法。
- status / visibility 可发布。
- `tagline` 或 `description` 至少一个可展示，来源可以是 Official、Knowledge、Source fallback 或 legacy field。
- 有可用 AI 结构化分析 / AI 认知卡内容，短期可识别 `aiInsight`、`aiKnowledgeJson` 或等价核心字段。
- 存在安全、规则或审核层面的硬阻断时，必须明确 reason。

### 7.2 warnings 记录质量和增强问题

warnings 包括：

- AI 增强版内容失败。
- AI 传播稿缺失。
- GitHub facts refresh 失败。
- source enrichment 失败或来源覆盖不足。
- `aiInsightStatus` 与实际 `aiInsight/aiKnowledgeJson` 不同步。
- public page 可展示但分类、标签、activity 不充分。

### 7.3 skipped 记录流程状态

skipped 包括：

- 非 DRAFT 项目。
- 批量 action 收到空 ids。
- 当前用户无权限或项目不在当前操作范围。

### 7.4 AI 状态语义

- `partial_ai` 可以发布。
- `pending` 如果已有基础信息与核心 `aiInsight`，可以发布，同时 warning 标记状态不同步。
- `full_ai` 只是质量标记，不是发布门槛。
- `aiContentStatus` 不进入 blocked。

建议立即改：所有 readiness 返回都稳定区分 `blocked / warnings / skipped`，blocked reason 只保留真正基础条件问题。

## 8. 数据迁移与兼容方案

### 8.1 是否需要新增 ProjectKnowledge 表

建议不在 Phase 1 立即新增表。

理由：

- 当前 `Project.aiInsight + Project.aiKnowledgeJson` 已能承载核心知识。
- 当前主要问题是读写职责混乱，不是存储容量不足。
- 先改读取优先级和 mapper，可避免一次性大迁移风险。

建议延后新增 `ProjectKnowledge` 表，当需要以下能力时再做：

- 多版本知识快照。
- 每次 AI 生成的模型、prompt、source snapshot、审核状态可追踪。
- 官方修订与 AI 知识差异对比。
- 支持回滚和 A/B 质量评估。

### 8.2 Phase 1 兼容策略

- 继续读取现有 `aiInsight` 和 `aiKnowledgeJson`。
- 继续保留 Project legacy fields 作为 fallback 和兼容缓存。
- 新增 resolver/mapper 统一读取，不马上迁移历史数据。
- readiness 使用 resolver 后的最小可展示结果。
- public page 使用 resolver 后的 view model，避免散落 fallback。

### 8.3 如何避免一次性大迁移风险

- 不批量重写所有 Project 字段。
- 不删除 `aiContent/aiContentDraft`。
- 不删除 GitHub 相关字段和 snapshot。
- 对老数据懒加载修复：当项目进入后台编辑、AI insight 生成、发布、前台访问时再补齐 resolver 所需缓存。
- 增加后台诊断信息，展示每个 resolved 字段来源。

## 9. 分阶段实施计划

### Phase 1：统一读取与 readiness，不大改 DB

建议立即改。

- 新建或整理 `ProjectInformationResolver`，统一输出 resolved fields。
- readiness 改为读取 resolved `name/slug/tagline/description/knowledge`。
- bulk publish 只处理明确勾选的 DRAFT 项目；AI content/GitHub/source enrichment 失败只进 warnings。
- public page 首屏 summary/detail/category/tags/links 改为 Official > Knowledge > Source > legacy fallback。
- `saveProjectKnowledge` 暂时保留 DB 写入，但停止无条件覆盖人工/官方字段。

验收重点：

- 无 GitHub 项目可发布。
- 有 AI insight 但 AI content failed 的项目可发布。
- claimed official summary 覆盖 public hero summary。

### Phase 2：抽象 ProjectKnowledge service

建议延后改。

- 建立 `ProjectKnowledgeService`，封装 `aiInsight/aiKnowledgeJson` 的读写、校验和状态同步。
- AI insight route、post-import pipeline、readiness 都调用同一服务。
- 拆开 knowledge 保存和 presentation apply。
- 增加 knowledge health check，用于后台质量提示。

### Phase 3：减少/废弃旧 aiContent 与重复 apply 逻辑

建议延后改。

- 将 `applyRequiredProjectFields` 改为调用 mapper。
- 后台 `apply-ai-summary/description/tags/categories` 改为“应用 Knowledge 建议”，不再各自生成字段。
- AI content 只写 `aiContent/aiContentDraft`，不再作为 description fallback 的高优先级来源。
- 为旧字段写入加 provenance 或操作日志。

### Phase 4：前台完全按 Official > Knowledge > Source fallback 渲染

建议延后改。

- public page 所有展示字段从 resolver 读取。
- `mapProjectRowToView` 不再散落业务 fallback。
- source list、activity、links 都由统一 presentation model 输出。
- 可选引入 `ProjectKnowledge` 表并迁移历史 knowledge。

### 不建议改的方向

- 不建议把 `full_ai` 恢复为发布硬门槛。
- 不建议让 AI content / AI 传播稿阻断发布。
- 不建议把 GitHub URL 是否存在作为 readiness 条件。
- 不建议立即删除 legacy Project fields；它们仍需要作为兼容缓存和旧页面 fallback。
- 不建议一次性重写 discovery/import、public page、admin edit 和 AI pipeline 的所有字段结构。

## 10. 风险与验证

### 10.1 可能影响的页面/API

- `/admin/projects`
- `/admin/projects/[id]/edit`
- `/api/admin/projects/[id]/ai-insight`
- `/api/admin/projects/[id]/ai-content`
- `/api/admin/projects/[id]/apply-ai-*`
- `/api/admin/projects/bulk-action`
- discovery import / JSON queue import
- post-import AI pipeline
- source enrichment / GitHub facts refresh
- `/projects/[slug]`
- claimed project official info editor
- project lists、category/tag/search 页面

### 10.2 回归测试清单

- 未勾选任何项目时，批量按钮不可点击，action 收到空 ids 返回 skipped/未选择，不执行项目。
- DRAFT 项目有 name、合法 slug、tagline 或 description、可用 aiInsight 时可以批量发布。
- DRAFT 项目 `aiContentStatus = failed` 时可以发布，并返回 warning。
- 无 GitHub 项目只要基础信息和 AI insight 足够，可以发布，并返回 source/GitHub warning。
- 非 DRAFT 项目在批量发布中计入 skipped，不进入 blocked。
- 项目方 official summary/fullDescription 存在时，前台优先展示 official 信息。
- 后台手工编辑字段后，AI enrichment 不应无提示覆盖人工确认字段。
- 手工生成 AI 认知卡后，readiness 能读取同一份 `aiInsight/aiKnowledgeJson`。
- public page 在只有 Source + Knowledge、没有 GitHub 的情况下仍能正常展示。

### 10.3 手动验证路径

1. 导入一个只有 website/article、无 GitHub 的项目。
2. 确认生成 ProjectSource。
3. 手工触发 AI 结构化分析 / AI 认知卡。
4. 批量勾选该 DRAFT 项目并发布。
5. 检查结果 counts：`processed/published/blocked/skipped/warnings`。
6. 打开 public page，确认 summary/detail/source list 正常展示。
7. 人工填写 official summary/fullDescription，再次打开 public page，确认 official 优先。

### 10.4 自动验证要求

- `pnpm typecheck` 必须通过。
- 涉及展示改造时补充 project page 相关测试。
- 涉及批量发布时补充 bulk publish action 单元或集成测试。
- 涉及 resolver 时补充字段优先级测试：
  - Official 覆盖 Knowledge。
  - Knowledge 覆盖 Source fallback。
  - Source fallback 覆盖 legacy imported empty fields。
  - GitHub 缺失不影响 readiness blocked。

## 推荐下一步最小改造

建议立即做 Phase 1 的最小版本：

1. 新建统一 resolver，先不改 DB schema。
2. readiness 和 bulk publish 改读 resolver，blocked 只保留最小可展示条件。
3. public page hero summary、description、category、tags、links 逐步改读 resolver。
4. `saveProjectKnowledge` 停止无条件覆盖人工/官方 presentation fields。
5. `applyRequiredProjectFields` 改为 mapper 调用，并默认不覆盖 official/manual confirmed 字段。

这一步能先解决发布失败和展示不一致问题，同时避免大迁移。
