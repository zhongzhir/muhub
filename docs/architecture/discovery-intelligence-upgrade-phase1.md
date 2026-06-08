# Discovery Intelligence Upgrade Phase 1：从实体抽取到专家学习

日期：2026-06-08

本文记录 Discovery Intelligence Upgrade Phase 1 的产品与工程方向。Phase 1 的目标不是把 Entity 自动接入 Project 生产链路，而是提升学习链路质量：

```text
Source -> Signal -> Entity -> Feedback -> Learning
```

当前仍然坚持边界：

```text
Candidate -> Project -> Publish
```

是生产链路。学习链路成熟前，不得自动污染生产项目库。

## 1. 当前问题诊断

### 源头抓取问题

- RSS 经常只抓摘要，容易漏掉正文后半部分出现的真实项目、模型、数据集、工具、机构和平台。
- WEBSITE_SCAN 可以抓正文，但对表格、名单、奖项项目、机构名、产品名、图片说明和链接上下文提取不稳定。
- 长文后半部分实体容易遗漏，尤其是获奖名单、入选项目、案例列表、项目表格。
- 文章链接中的第三方主来源没有被充分识别，例如 GitHub、HuggingFace、官网、官方文档、论文页。
- 公众号、媒体文章、博客容易被误当成 primary source。它们应默认是 secondary evidence。
- 当前 Entity 噪音偏大，包含句子片段、泛概念、普通机构、文章主题和栏目名。

### 实体判断问题

- project / model / dataset / tool / organization / concept / method 边界不稳定。
- 系统容易把组织、奖项、活动、方法、泛概念当作项目。
- dataset / model / tool 这些项目型资源缺少稳定识别规则。
- 缺少稳定的 authenticity score、source validation 和 candidate suggestion 解释。

### 专家反馈问题

- 当前接受 / 拒绝 / 待合并过粗，不能充分学习专家经验。
- 缺少为什么接受、为什么拒绝、改成什么类型、主来源是谁、合并到谁。
- 反馈还没有充分反哺 prompt、规则、过滤器和排序。
- 系统需要把专家判断沉淀为可统计、可复用、可反哺的学习数据。

## 2. 设计目标

### 目标 A：更完整地发现实体

系统应从 Signal 中尽量完整提取：

- 项目名
- 模型名
- 数据集名
- 工具名
- 平台名
- 机构名
- 实验室 / 研究中心
- 奖项项目
- 论文 / 报告中的项目型资源
- 链接中的 GitHub / HuggingFace / 官网 / 文档 / 论文页

### 目标 B：更准确地判断实体

每个 EntityHint 至少应在字段或 evidence metadata 中保留：

- entityType
- confidence
- relevance
- sourceLevel
- extractionReason
- qualityReason
- sourceSignalId
- primarySourceCandidate
- authenticityHint
- shouldPromoteToCandidateSuggestion

这些字段不等于自动创建 Candidate，只是为专家审核和后续学习提供判断上下文。

### 目标 C：更高质量采集专家反馈

专家反馈应从三个按钮升级为结构化判断：

- decision
- finalEntityType
- reasonTags
- primarySourceOverride
- mergeTarget
- expertComment

所有人工判断必须继续写入 `DiscoveryFeedback`，并标记：

- `isHumanDecision=true`
- `decisionSource=entity_queue`

### 目标 D：形成可反哺的学习闭环

Feedback 不只是展示统计，还应产生：

- top false positives
- top missed entity patterns
- source accept rate
- entity type accept/reject rate
- rule performance
- prompt improvement suggestions

## 3. 源头信息抓取改进方案

### Full Text Extraction

Phase 1 的最小改造：

- RSS item 如果只有摘要，尝试 fetch 原文 pageUrl。
- 网站正文提取保留 title、headings、paragraphs、list items、table rows、links、image alt/caption。
- 不再只依赖前 400 字摘要。
- 每个 RSS Signal metadata 记录：
  - rawTextLength
  - fullTextStatus
  - fullTextSource
  - fullTextError
  - sourceLinks

### Table / List Entity Extraction

系统应增强对以下结构的抽取：

- HTML table
- ul / ol list
- award winners
- shortlist
- projects
- datasets
- models
- 项目名称 / 完成单位 / 主要完成人表格

目标是能从数字出版研究、评选奖项、案例名单中抽出项目行，而不是只抽机构名。

### Link Mining

正文外链应被分类：

- GitHub / HuggingFace / GitCC / Gitee / arXiv / DOI / docs / official site：primary candidate
- 公众号 / 媒体 / 博客：secondary evidence
- 文章来源自身：referrer 或 secondary evidence

EntityHint 的 `sourceUrl` 可以优先使用 primary source candidate；原始文章 URL 保留在 evidence metadata 中。

## 4. Entity Quality Filter V2

### 过滤句子型实体

命中以下特征应过滤或降权：

- 名称过长
- 包含 therefore / because / due to / these / all of 等句子连接词
- 包含“这些 / 所有 / 因此 / 由于 / 正在 / 可以 / 均可”等片段
- 不是名词短语

### 保留普通组织但不建议进入 Candidate

例如：

- 出版社
- 协会
- 大学出版社
- 委员会
- 调查公司

这些可以保留为 organization，但 `shouldPromoteToCandidateSuggestion=false`。

### 项目型实体优先特征

提升权重：

- 名称包含 system / platform / tool / model / dataset / engine / framework / project / Demo / SDK / API
- 有 GitHub / HuggingFace / 官网 / 文档
- 出现在“项目名称”列或 shortlist / award winners 列表中
- 与完成单位、组织、链接共同出现

### 低质量实体不得进入 Candidate Suggestion

即使保留 Entity，也要标记：

- `shouldPromoteToCandidateSuggestion=false`
- `candidateSuggestionReason=generic_organization / sentence_fragment / concept_only / source_insufficient`

## 5. Expert Feedback V2

Entity Queue 的结构化反馈入口保留快捷按钮，但提交时支持补充：

- decision
- finalEntityType
- reasonTags
- mergeTarget
- primarySourceOverride.url
- primarySourceOverride.sourceLevel
- primarySourceOverride.reason
- expertComment

字段进入 `DiscoveryFeedback.metadata`，不要求新增 schema。这样可以先积累样本，再决定是否拆成正式列。

## 6. 从已有项目学习

新增脚本：

```text
scripts/analyze-project-learning-samples.ts
```

输出：

```text
data/reports/project-learning-samples.json
```

它从已发布 Project 生成 positive samples 画像，包括：

- 已发布项目数量
- 项目类型分布
- 标签分布
- source kind 分布
- primary source 分布
- GitHub / 官网 / HuggingFace / 微信 / 文档比例
- name pattern
- tagline pattern
- category pattern
- 字段来源说明

这不是训练模型，只是建立正样本参考。

## 7. Feedback Analytics

新增：

```text
/admin/discovery/learning
```

展示：

- Source Performance
- Entity Type Performance
- Noise Patterns
- Learning Suggestions

统计维度：

- source accept rate
- source reject rate
- entity type accept rate
- top reject reasons
- sentence_fragment / generic_organization / concept_only / no_primary_source / duplicate / ai_misidentified

## 8. Historical Project Verification 设计

后续可以形成：

```text
Project Verification Queue
```

周期性核验已发布项目：

- 主来源是否可访问
- 是否有 primary source
- 官方信息是否优先
- GitHub / HuggingFace 是否仍存在
- AI 认知卡是否过期
- 项目是否长期无更新
- 来源是否只是媒体文章
- 是否需要补充来源

可能状态：

- verified
- needs_source
- needs_update
- stale
- source_broken
- questionable

本阶段只设计，不接生产流程。

## 9. 当前阶段不做

- Entity 自动转 Candidate
- Entity 自动导入 Project
- Entity 自动发布
- 大规模 schema 重构
- 模型训练
- GitHub Topic 全量实体化
- 直接把学习链路接入生产主链路

## 10. 最小验收

- Full text extraction 比当前更完整。
- 表格 / 列表 / 奖项项目能更好抽取。
- Entity Queue 噪音减少，低质量实体有 quality reason。
- Expert Feedback V2 能记录 decision、finalEntityType、reasonTags、mergeTarget、primarySourceOverride、expertComment。
- Feedback Analytics 能看到 source accept rate、entity type reject rate、top reject reasons。
- 已发布 Project 正样本分析脚本可运行。
- 不自动污染 Candidate / Project。
- `pnpm typecheck` 通过。
