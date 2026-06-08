# Discovery Unified Pipeline V2: Source -> Signal -> Entity -> Candidate -> Project -> Feedback

日期：2026-06-08

---

## 一、背景

MUHUB Discovery Pipeline 当前已经具备多个有效入口，但真实代码链路已经出现分裂：

- `WEBSITE_SCAN`：Source -> Signal -> EntityHint
- `RSS`：Source -> Signal -> Candidate
- `GITHUB_TOPIC`：Source -> Candidate
- `MANUAL / 手机采集`：Raw input -> Discovery item / Signal / Candidate 混合
- `Feedback`：部分附着在 Entity Queue，部分附着在 Candidate 操作

这导致后台导航中展示的“信息源 -> 线索池 -> 实体线索 -> 候选项目 -> 判断反馈”并不完全等于真实执行链路。随着 RSS、官网扫描、GitHub、手动采集、移动采集等来源继续增加，如果不收敛到统一主链路，后续会继续出现每个来源各走一套判断逻辑的问题。

当前已经暴露的具体断点包括：

1. Publishing Perspectives 最近一次运行产生了 Signal，但 RSS Signal 不会自动进入 Entity Extraction。
2. GitHub Topic 直接进入 Candidate，绕过 Entity 判断。
3. WEBSITE_SCAN 能产生 EntityHint，但 Candidate 层没有统一承接。
4. Feedback 已开始落入 `DiscoveryFeedback`，但语义上仍主要附着在 Entity Queue 和 Candidate 局部操作。
5. 后续来源越多，管线越容易分裂，系统越难从反馈中学习。

本文定义 Discovery Unified Pipeline V2，目标是把所有来源逐步收拢到统一主链路：

```text
Raw Source
-> Signal
-> Entity
-> Candidate
-> Project
-> Feedback
-> Learning
```

本文是架构方案，不是本次代码改造任务。本阶段不要求一次性重构所有来源，不立即改数据库结构，不破坏现有 GitHub Topic、RSS 自动候选、Website Scan EntityHint 等功能。

---

## 二、现状链路审计

### WEBSITE_SCAN

当前链路：

```text
Source
-> Signal
-> EntityHint
```

相关文件：

- `lib/discovery/website-scan/run-website-scan-for-source.ts`
- `lib/discovery/entity/extract-from-signal.ts`
- `lib/discovery/entity/persist-hints.ts`

现状说明：

`WEBSITE_SCAN` 是当前最接近目标统一链路的来源。它先把网页扫描结果持久化为 `DiscoverySignal`，然后调用 Entity Extraction 生成 `EntityHint`。这个链路的优点是没有直接把原始网页当成项目导入，而是先进入实体识别层。

当前不足：

- Entity 后续如何进入 Candidate 尚未统一。
- Entity Extraction 的结果展示、失败原因和 duplicate 统计仍需要进一步产品化。
- 该能力目前主要服务 WEBSITE_SCAN，尚未成为所有 Signal 的默认阶段。

### RSS

当前链路：

```text
Source
-> Signal
-> autoConvertHighConfidencePublishingSignals
-> Candidate
```

相关文件：

- `lib/discovery/rss/run-rss-discovery-for-source.ts`
- `lib/discovery/run-discovery-source.ts`
- `lib/discovery/auto-convert-publishing-signals.ts`

现状说明：

RSS 会抓取 feed item，并通过 `upsertDiscoverySignalFromSeed()` 写入 `DiscoverySignal`。对于高置信 publishing 线索，系统会继续执行 `autoConvertHighConfidencePublishingSignals()`，把部分 Signal 转为 Candidate。

当前不足：

- RSS Signal 创建后不会自动进入 Entity Extraction。
- RSS 高置信文章可能直接跳到 Candidate，绕过 Entity 类型判断、来源验证和真实性判断。
- Publishing Perspectives 的案例已经证明：RSS 产生了 Signal，但 Entity Queue 中看不到对应实体。

### GITHUB_TOPIC

当前链路：

```text
Source
-> upsertGithubDiscoveryCandidate
-> Candidate
```

相关文件：

- `lib/discovery/run-discovery-source.ts`
- `lib/discovery/github/search-repos.ts`
- `lib/discovery/upsert-candidate.ts`

现状说明：

GitHub Topic 的输入天然接近实体，因为 repo 本身通常就是项目、工具或代码资产。但当前链路直接写 Candidate，没有统一经过 Signal 和 Entity 中间层。

当前不足：

- GitHub repo 绕过 Entity 判断，无法与 RSS、WEBSITE_SCAN、Manual 来源共享实体分类和反馈机制。
- Candidate 中缺少统一的 `sourceEntityId` 语义。
- 后续如果要学习“什么 repo 值得成为项目”，缺少 Entity 层反馈样本。

### MANUAL / 手机采集

当前链路：

```text
Raw input
-> Discovery item / Signal / Candidate 混合
```

相关入口：

- 手动导入
- 移动采集
- 运营粘贴 URL / 文本
- 公众号文章或网页文章

现状说明：

人工输入通常包含多种材料：文章 URL、网页、项目名、运营备注、截图、移动采集内容等。这些材料有时被当作 Signal，有时被当作 Candidate，有时直接进入操作队列。

当前不足：

- 文章中出现的实体、来源验证、候选导入容易混在一起。
- 人工输入的材料价值很高，但没有稳定分层：先作为 Signal，抽 Entity，再判断 Candidate。
- 手机采集和手动输入后续也应统一进入 Entity Queue，而不是形成独立旁路。

### Feedback

当前链路：

```text
Entity Queue / Candidate action
-> DiscoveryFeedback
```

相关文件：

- `lib/discovery/feedback-capture.ts`
- `lib/discovery/entity/human-decision.ts`
- `app/admin/discovery/feedback/page.tsx`
- `app/admin/discovery/actions.ts`

现状说明：

Feedback 已经开始进入数据库中的 `DiscoveryFeedback`，这是统一 Learning Loop 的基础。它可以记录人工判断、决策来源、是否人工决策、理由标签、评论、来源信息和 metadata。

当前不足：

- Feedback 目标对象还没有完全统一表达为 Signal / Entity / Candidate / Project。
- Entity Queue 和 Candidate 操作已经开始写反馈，但 Signal 判断和 Project 修正还没有完全纳入统一反馈语义。
- 后续需要让所有人工判断都沉淀为可学习数据，而不是只改变当前状态。

---

## 三、统一主链路定义

### 1. Source

Source 是信息源配置与运行入口。它负责定义从哪里获取原始材料，以及使用什么采集方式。

Source 可以是：

- RSS feed
- website scan 配置
- GitHub topic
- Product Hunt topic
- 手动维护来源
- 手机采集入口
- 运营输入入口

Source 只负责产生 Raw Material，不应直接等同于项目来源，也不应直接决定是否进入 Project。

### 2. Signal

Signal 是原始线索层，表示“某个来源发现了一条值得进一步分析的内容”。

Signal 可以是：

- RSS item
- website page
- GitHub repo
- Product Hunt item
- manual collected article
- mobile collected URL
- manually pasted text

Signal 不等于项目。它只是进一步判断的材料。一个 Signal 可能提到多个实体，也可能没有任何有效实体。

### 3. Entity

Entity 是实体识别层。系统从 Signal 中抽取实体，并做初步分类。

Entity 类型包括：

- project
- model
- dataset
- tool
- organization
- concept
- method
- person
- unknown

Entity 不等于 Candidate。Entity 的意义是建立所有来源共享的中间判断层：先识别“文本里出现了什么”，再判断“它是否值得作为项目候选”。

### 4. Candidate

Candidate 是候选项目层。只有通过实体判断、来源验证和真实性判断后，才应进入 Candidate。

Candidate 应表示“这个实体具备成为 MUHUB 项目的可能性”。Candidate 不应再作为原始入口，而应是被验证后的项目候选。

### 5. Project

Project 是正式项目库。Candidate 通过审核后进入 Project。

发布系统、项目页、Project Knowledge、用户侧推荐等长期产品能力只消费 Project，不直接消费 Signal 或 Entity。

### 6. Feedback

Feedback 记录所有人工判断。

Feedback 可以挂在：

- Signal
- Entity
- Candidate
- Project

但无论目标对象是什么，都必须统一写入 `DiscoveryFeedback`。这样系统才能把人工判断沉淀为后续分类、验证、排序和去重的学习样本。

### 7. Learning

Learning 是未来能力，不是立即训练模型的要求。

Learning 的输入是 `DiscoveryFeedback`，目标是优化：

- Entity Classification
- Source Validation
- Candidate Ranking
- authenticity score
- duplicate detection
- source reliability

---

## 四、统一原则

1. 所有来源先产 Signal。
2. 所有 Signal 默认尝试 Entity Extraction。
3. Entity 是所有来源的共同中间层。
4. Candidate 不再是原始入口，而是被验证后的项目候选。
5. GitHub repo 也应先映射为 Entity，再进入 Candidate。
6. RSS 不应直接跳到 Candidate。
7. WEBSITE_SCAN 不应只停留在 Entity，要能进入 Candidate。
8. Feedback 可以挂在 Signal / Entity / Candidate / Project，但必须统一存入 `DiscoveryFeedback`。
9. 自动规则可以给建议，但人工判断是高价值学习信号。
10. 发布系统只消费 Project，不直接消费 Signal / Entity。

---

## 五、目标统一管线图

```text
DiscoverySource
  |
  v
Raw Material
  |
  v
DiscoverySignal
  |
  v
Entity Extraction
  |
  v
EntityHint / Entity Queue
  |
  v
Entity Decision + Source Validation
  |
  v
DiscoveryCandidate
  |
  v
Human Review / Merge / Reject / Approve
  |
  v
Project
  |
  v
DiscoveryFeedback
  |
  v
Learning Loop
```

这个目标图的关键变化是：Candidate 不再作为多个来源的直接写入目标，而是 Entity 判断后的结果。

---

## 六、迁移策略

不要一次性大改。统一主链路应分阶段迁移，先保证现有功能可用，再逐步收敛。

### Phase 0：保持现有功能可用

保留现状：

- GitHub Topic 继续可直接产生 Candidate。
- RSS 高置信自动候选继续可用。
- WEBSITE_SCAN 继续产生 EntityHint。
- Feedback 继续写 `DiscoveryFeedback`。

Phase 0 的目标是建立架构共识，不破坏当前业务闭环。

### Phase 1：所有 Signal 自动进入 Entity Extraction

改造范围：

- RSS upsert Signal 后触发 Entity Extraction。
- WEBSITE_SCAN 保持已有逻辑。
- MANUAL Signal 可以触发 Entity Extraction。
- GitHub 暂时保留 Candidate 直达。

Phase 1 的目标是让所有文本类来源进入 Entity Queue，而不是让 RSS 直接跳过 Entity 层。

### Phase 2：Candidate 统一由 Entity 生成

改造范围：

- Entity ACCEPT 后可生成 Candidate。
- RSS 不再通过 `autoConvertHighConfidencePublishingSignals()` 直接 Candidate。
- WEBSITE_SCAN Entity 可以转 Candidate。
- Candidate 记录 `sourceEntityId`。

Phase 2 的目标是让 Candidate 成为“被验证后的项目候选”，而不是原始入口。

### Phase 3：GitHub Topic 实体化

改造范围：

- GitHub repo 先作为 Entity，类型可为 project / tool / repo。
- 高置信 Entity 可自动生成 Candidate。
- 保留旧 GitHub signals / candidates 兼容字段。

Phase 3 的目标是把 GitHub 也纳入同一判断层，同时保留其高质量来源优势。

### Phase 4：Feedback 全链路统一

改造范围：

- Signal 判断写 `DiscoveryFeedback`。
- Entity 判断写 `DiscoveryFeedback`。
- Candidate 判断写 `DiscoveryFeedback`。
- Project 修正写 `DiscoveryFeedback`。

Phase 4 的目标是让所有人工判断都成为学习样本。

### Phase 5：Learning Loop

改造范围：

- 基于 `DiscoveryFeedback` 优化分类规则。
- 计算来源可信度。
- 计算 authenticity score。
- 优化 candidate ranking。
- 识别重复和低质量来源。

Phase 5 的目标是让 Discovery 从“收集系统”进化为“判断系统”。

---

## 七、对现有数据模型的建议

本阶段不立即改数据库，但需要为未来字段预留设计方向。

### Signal

建议未来字段：

- `sourceId`
- `sourceRunId`
- `rawText`
- `fullTextStatus`
- `extractionStatus`
- `extractionSummary`

这些字段用于说明 Signal 是否已经具备足够文本、是否完成 Entity Extraction，以及失败原因是什么。

### EntityHint

建议未来字段：

- `sourceSignalId`
- `sourceRunId`
- `sourceType`
- `sourceLevel`
- `candidateId nullable`
- `status`
- `entityType`
- `confidence`
- `relevance`
- `authenticityScore`
- `decisionHistory`

这些字段用于把 Entity 与来源、运行批次、候选转化和人工判断串起来。

### Candidate

建议未来字段：

- `sourceEntityId nullable`
- `sourceSignalId nullable`
- `primarySourceUrl`
- `sourceValidationStatus`
- `authenticityScore`

这些字段用于明确 Candidate 的来源实体和真实性判断依据。

### DiscoveryFeedback

建议未来字段：

- `targetType: signal/entity/candidate/project`
- `targetId`
- `decisionSource`
- `isHumanDecision`

这些字段用于把不同层级的人工判断统一记录在同一反馈表。

---

## 八、E2 最小落地方案

下一步代码改造建议只做最小闭环：

1. RSS Signal 创建后触发 Entity Extraction。
2. Entity Extraction 结果只进入 Entity Queue，不自动 Candidate。
3. 在 `/admin/discovery/signals` 或 signal detail 显示：
   - 是否已抽取 Entity
   - Entity 数量
   - duplicate 数量
   - skipped 原因
4. Entity Queue 增加 source filter，能按 sourceKey 查看 Publishing Perspectives 的 Entity。
5. 暂时不改 GitHub Topic 和 Candidate 导入逻辑。

E2 的目标不是立刻完成全链路统一，而是先让所有文本类来源进入 Entity Queue。

---

## 九、Publishing Perspectives 验证方式

验证 sourceKey：

```text
publishing-publishing-perspectives
```

验收点：

1. 最近一次 run 产生 3 个 Signal。
2. RSS Signal 自动进入 Entity Extraction。
3. Entity Queue 中可按 sourceKey / sourceName 看到对应实体。
4. 如果没有实体，必须显示原因：
   - `text_too_short`
   - `duplicate`
   - `ai_returned_empty`
   - `quality_filtered`
   - `no_entities_detected`

当前已知断点是 RSS Signal 创建后没有自动触发 Entity Extraction。E2 的第一步应以这个案例为回归验证对象。

---

## 十、配置建议

不一定马上改 schema，可以先把逻辑配置放在 `DiscoverySource.configJson`：

```json
{
  "entityExtraction": {
    "enabled": true,
    "mode": "auto",
    "maxSignalsPerRun": 5,
    "useAi": true,
    "minTextLength": 200,
    "scopes": ["publishing_ai"]
  }
}
```

建议默认策略：

- `publishing_ai` RSS 可以开启。
- general RSS 默认关闭或限量。
- WEBSITE_SCAN 默认开启。
- GitHub 暂缓。

这样可以避免 RSS 全量 Entity Extraction 带来过高 AI 调用成本和噪音。

---

## 十一、风险

### AI 调用成本

RSS 全量 Entity Extraction 会增加 AI 调用成本。需要 `maxSignalsPerRun`、source scope 和 source-level 开关限制。

### 噪音实体

低质量 RSS 可能产生大量组织名、活动名、文章名等噪音实体。需要质量过滤、重复控制和 source authority 判断。

### 迁移复杂度

GitHub Topic 当前直达 Candidate，强行一次性改成 Entity 中间层会影响现有候选导入效率。GitHub 应放在后续 Phase 3，而不是 E2。

### 产品展示压力

如果 Entity Extraction 失败但 UI 不展示原因，运营会误以为系统没有工作。E2 必须同步展示 extraction status、entity count、duplicate count 和 skipped reason。

### 反馈语义不统一

如果 Feedback 只写在部分操作里，Learning Loop 仍无法形成完整样本。后续必须让 Signal / Entity / Candidate / Project 的判断都统一进入 `DiscoveryFeedback`。

---

## 十二、为什么 Candidate 不应再是原始入口

Candidate 表示“可被审核导入的项目候选”。它应该已经经过初步实体识别、类型判断和来源验证。

如果 Candidate 继续作为原始入口，会产生几个问题：

- 文章中出现的概念、方法、组织和活动容易被误当成项目。
- 来源文章会被误用作项目 primary source。
- 不同来源的判断标准无法统一。
- 人工反馈难以回流到实体分类和来源验证。
- Project Knowledge 会吸收噪音输入。

因此，Candidate 应从“入口层”下沉为“验证后的候选层”。

---

## 十三、为什么 Entity 是统一中间层

Entity 是所有来源都可以共享的最小判断对象。

无论来源是 RSS、Website Scan、GitHub、Product Hunt、手动输入还是手机采集，系统最终都需要回答同一个问题：

```text
这个材料里出现了什么？
它是什么类型？
它是否真实存在？
它是否值得进入候选项目？
```

Entity 层可以统一承接这些判断。它既不要求立即导入 Project，也不丢失原始来源信息。它允许系统先观察、分类、验证和学习，再决定是否生成 Candidate。

---

## 十四、推荐统一链路

推荐采用渐进式统一链路：

```text
Phase 1:
RSS / WEBSITE_SCAN / MANUAL
-> Signal
-> Entity
-> Entity Queue

Phase 2:
Entity ACCEPT
-> Candidate
-> Project

Phase 3:
GitHub Topic
-> Signal / Entity
-> Candidate

Phase 4:
All decisions
-> DiscoveryFeedback

Phase 5:
DiscoveryFeedback
-> Learning
```

这条路线的优点是先修复最明显的 RSS 断点，不破坏现有候选导入和发布系统，同时为后续全链路学习建立统一中间层。

---

## 十五、下一步最小改造建议

建议立刻进入 E2 最小改造，但只改 RSS 自动 Entity Extraction，不同时改 Candidate 生成策略。

具体建议：

1. 在 `run-rss-discovery-for-source.ts` 中，RSS Signal upsert 成功后，根据 `configJson.entityExtraction` 判断是否触发 Entity Extraction。
2. 默认只对 `publishing_ai` scope 的 RSS 开启，且限制 `maxSignalsPerRun`。
3. Extraction 结果只写 Entity Queue，不自动生成 Candidate。
4. 在 Signal 列表或详情页展示 Entity Extraction 状态和失败原因。
5. 用 `publishing-publishing-perspectives` 做回归验证。

不建议立刻做：

- GitHub Topic 全量实体化。
- RSS 停用 autoConvertHighConfidencePublishingSignals。
- Candidate schema 大改。
- Project 发布链路调整。

---

## 十六、验收标准

本文档对应的后续实现验收标准如下：

1. 当前分裂管线图已明确。
2. 目标统一管线图已明确。
3. 每类 source 如何迁移已明确。
4. Candidate 不再作为原始入口的原因已明确。
5. Entity 作为统一中间层的原因已明确。
6. E2 最小代码改造边界已明确。
7. Publishing Perspectives 验证方式已明确。
8. Phase 2 / 3 / 4 / 5 路线已明确。

---

## 十七、结论

Discovery Unified Pipeline V2 的核心不是一次性重构代码，而是建立统一判断顺序：

```text
先发现材料
再识别实体
再验证实体
再生成候选
再导入项目
再记录反馈
最后形成学习
```

当前最值得立即修复的断点是 RSS Signal 不进入 Entity Extraction。建议下一步只做 E2 最小改造：让 Publishing Perspectives 这类 publishing RSS 先进入 Entity Queue，并把抽取结果、重复数量和跳过原因展示给运营。等这个闭环稳定后，再逐步迁移 Candidate 生成、GitHub Topic 实体化和全链路 Feedback。
