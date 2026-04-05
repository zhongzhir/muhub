# MUHUB 内容生产发布智能体 V1 — 设计文档

> **版本**：V1（设计基线，供实现与评审对照）  
> **关联**：[智能体体系分层说明 V1](./agent-system-layering-v1.md) · [Content → Growth Handoff V1](./content-to-growth-handoff-v1.md)  
> **状态**：文档契约；本文不替代代码中的具体类型名与存储路径，实现时以保持向后兼容为前提渐进对齐。

---

## 1. 文档目的

在 [agent-system-layering-v1.md](./agent-system-layering-v1.md) 中，**Content Layer** 的职责已明确：将结构化输入转化为**可审可发的内容草稿**，再交给 **Growth** 做渠道适配与发布准备。

MUHUB 现阶段仍缺一份**仅针对「内容生产发布智能体」**的契约，导致容易出现：

- 把「写一段推广文案」与「完整运营自动化」混为一谈，范围失控；
- 输入来自发现侧、站内项目、运营脑暴等多源，**结构不统一**，难以测试与复盘；
- 草稿与内容包（bundle）**质量标准、状态与 handoff** 未约定，Growth 接口含糊。

**Content Agent V1** 的设计目标是：**用最小闭环**把「内容机会」稳定地变成「可进入增长流水线的草稿与资产包」，而不是先做「大而全的无人值守运营中台」。

---

## 2. V1 的定位

| 维度 | 说明 |
|------|------|
| **在分层中的位置** | 位于 **Discovery（内容子域）下游**、**Growth 上游**；属于现有 `agents` 体系中的 **Content Layer V1 实现规格**，**不是**与 `discovery` / `growth` 平行的另一套运行时。 |
| **与体系的关系** | 输入可来自站内 `Project`、运营配置、以及未来结构化的 **Content Discovery** 线索；输出以 **`ContentDraft` / `ContentBundle`**（见下文）对接 Growth，编排由 **Orchestrator** 触发（定时、CLI、管理端动作等）。 |
| **非目标强调** | V1 **不**声称替代编辑主观判断；**不**承诺全链路无人发布。 |

---

## 3. V1 要解决的问题

| 问题 | 表现 | V1 方向 |
|------|------|---------|
| **输入不稳定** | 有时是一组 slug，有时是话题句，有时是发现侧的摘要 JSON。 | 统一收敛为 **`ContentOpportunity`**（见 §5），映射层显式化。 |
| **草稿结构不统一** | 标题/正文/渠道字段混用，难以复用模板与质检规则。 | 固定 **`ContentDraft`** 核心字段与类型枚举；渠道与体裁在模型层区分。 |
| **质量缺门槛** | 生成即等于「可发」，易产生夸张、重复、无据文案。 | §9 **质量标准** + §11 **状态机**（review 门槛）；V1 以规则/人工为主。 |
| **与 Growth 接口不清晰** | 草稿 → 渠道短帖/bundle 的契约未文档化。 | 约定 **`ContentBundle`** 由 Growth 侧从 Draft 组装或消费（§6、§10）。 |

---

## 4. V1 的范围

### 4.1 V1 要做

- 从 **`ContentOpportunity`** 映射到内部「内容计划」（轻量结构即可，可为内存对象或日志字段）。
- 生成 **一种或多种 `ContentDraft`**（模板/规则为主，可预留 LLM 接入点）。
- **质量检查**（规则层）：长度、禁则词、必填字段、项目引用存在性等（§9）。
- **草稿持久化**（当前可为本地 JSON，与 `agents/content/content-draft-store.ts` 一致；未来可迁移 DB）。
- **内容包生成**：在通过质检与（可选）人工确认后，生成或更新 **`ContentBundle`**，供 Growth 消费（与 `agents/growth/content-bundle.ts` 语义对齐）。

### 4.2 V1 不做

| 不做项 | 说明 |
|--------|------|
| **全自动多平台发布** | 不向各平台 API 批量发帖；发布动作可由人工执行或 V2+ 再做。 |
| **复杂热点预测** | 不做舆情预测、爆款评分模型。 |
| **自动视频** | 不生成/剪辑/合成视频。 |
| **复杂 A/B 测试** | 不多臂老虎机、不自动选版。 |
| **重度事实核查** | 不对稿件做自动法律/财务级事实核验；仅规则级与引用可追溯。 |

---

## 5. 输入模型：`ContentOpportunity`

**一句话定义**：描述一次「值得做一篇内容」的业务机会，是 Content Agent 的**标准输入边界**；Discovery / 运营 / 站内任务均应**先映射**为本结构再进入流水线。

### 5.1 建议字段

| 字段 | 类型（建议） | 必填 | 说明 |
|------|----------------|------|------|
| `id` | string | 是 | 全局唯一，可由编排器生成（UUID 或 `${type}-${timestamp}-…`）。 |
| `type` | 枚举（见 §5.2） | 是 | 决定默认模板与 Channel 偏好。 |
| `title` | string | 否 | 运营可读短标题或内部备注。 |
| `narrative_hint` | string | 否 | 一句话叙事方向（例如「突出开源协议变更」）。 |
| `project_slugs` | string[] | 视类型 | 站内项目 slug 列表；`topic_watch` / `manual_topic` 可为空或少填。 |
| `discovery_refs` | object[]（可选） | 否 | 发现侧候选 id、sourceKey、externalUrl 等**可追溯引用**（不拷贝大段 raw payload）。 |
| `time_window` | `{ start?: ISO8601, end?: ISO8601 }` | 否 | 用于 digest、roundup（如「本周」）。 |
| `topic_tags` | string[] | 否 | 主题标签，用于清单类与检索。 |
| `priority` | `"low" \| "normal" \| "high"` | 否 | 供 Orchestrator 排队；默认 `normal`。 |
| `created_at` | ISO8601 | 是 | 创建时间。 |
| `created_by` | string | 是 | `"system" \| "admin:{id}" \| "scheduler"` 等，便于审计。 |
| `metadata` | JSON object | 否 | 扩展位；避免塞无关大字段。 |

### 5.2 典型 `type` 枚举

| `type` | 含义 | 典型 `project_slugs` |
|--------|------|----------------------|
| `project_spotlight` | 单项目深度介绍 | 1 个为主 |
| `project_update_roundup` | 多项目更新要点汇总 | 多个 |
| `topic_watch` | 某主题下项目动态/清单 | 0～N，可后续由 discovery 补 |
| `weekly_digest` | 周报 / 周期性 digest | 多个或按规则拉取 |
| `manual_topic` | 纯运营命题（无固定 slug） | 可选 |

**与现有代码草稿类型的映射（实现时对齐，非本文件强制改名）**：

| ContentOpportunity.type | 倾向的 ContentDraft.type（现有） |
|-------------------------|----------------------------------|
| `project_spotlight` | `project-spotlight` |
| `project_update_roundup` / `weekly_digest` | `project-roundup` |
| `topic_watch` | `trend-observation` 或 `project-roundup`（由计划层决定） |
| `manual_topic` | 按 `narrative_hint` 选用 `project-roundup` / `trend-observation` |

---

## 6. 输出模型：`ContentDraft` 与 `ContentBundle`

### 6.1 `ContentDraft`

**作用**：单一渠道/体裁下的**一篇可审草稿**，是 Content Agent 的**主输出原子**。

**建议核心字段**（与 `agents/content/content-types.ts` 中 `ContentDraft` 对齐；V1 设计允许逐步扩展 `status` 等字段）：

| 字段 | 说明 |
|------|------|
| `id` | 唯一 id。 |
| `type` | `ContentDraftType`（如 `project-roundup`、`project-spotlight` 等，见 `content-types.ts`）。 |
| `channel` | `ContentChannel`（`article` | `wechat` | …）。 |
| `title` / `summary` / `body` | 标题、摘要、正文。 |
| `sourceProjectSlugs` / `sourceProjectNames` | 可追溯来源项目。 |
| `generatedAt` / `generatedBy` | 时间与生成者标识（如 `content-agent`）。 |
| `status` | 见 §11；当前代码可为单状态字面量，实现上向状态机演进。 |
| `opportunity_id`（建议新增） | 回溯到 `ContentOpportunity.id`。 |
| `quality_flags`（建议新增） | 规则质检结果摘要，如 `{ passed: boolean, issues: string[] }`。 |

**状态语义**：见 §11。

### 6.2 `ContentBundle`

**作用**：**一次发布战役**或可人工一键复制的「资产包」——聚合主文草稿与多渠道衍生文案，是 **Content → Growth** 的**推荐 handoff 形态**。

**建议字段**（与 `agents/growth/content-bundle.ts` 中 `ContentBundle` 对齐；可扩展状态与审核字段）：

| 字段 | 说明 |
|------|------|
| `id` | bundle 唯一 id。 |
| `title` | 对外或对内展示标题。 |
| `articleDraftId` | 主文章级草稿 id（若有）。 |
| `socialPosts` | 分渠道的短帖数组（`x` / `xiaohongshu` / `wechat` 等）。 |
| `communityMessage` | 社群转发类文案。 |
| `createdAt` | ISO8601。 |
| `draft_ids`（建议新增） | 纳入本包的全部草稿 id 列表，便于对账。 |
| `status` | 见 §11。 |

**与 Draft 的分工**：Draft 强调**单篇、可编辑、可质检**；Bundle 强调**多触点一致性、可交由 Growth 排期或人工分发**。

---

## 7. 支持的内容类型（V1 优先级）

| 优先级 | 类型 | 对应机会/草稿侧重 | 优先原因 |
|--------|------|-------------------|----------|
| P0 | **项目 Spotlight** | `project_spotlight` / `project-spotlight` | 与 MUHUB 核心资产（项目页）强绑定，叙事边界清晰。 |
| P0 | **项目更新摘要** | `project_update_roundup` / `project-roundup` | 复用站内项目更新事实，易做规则拼装与复核。 |
| P1 | **主题项目清单** | `topic_watch` + roundup/observation | 支撑「某一主题下有哪些值得关注」的运营栏目，输入可由标签 + 项目列表稳定表达。 |
| P1 | **周报 / Digest** | `weekly_digest` | 时间窗明确，适合半自动固定栏目；与 roundup 可共享引擎。 |

**说明**：**社媒短帖**（如现有 `social-post`）可作为 Spotlight / Roundup 的**伴生产物**，并入同一 `ContentBundle`，不必单独列为另一条「主机会类型」，除非运营单独发帖需求频繁。

---

## 8. 处理流程

以下为 **Content Agent V1** 逻辑步骤；实现可合并模块，但**语义顺序**建议保持，便于日志与排错。

| 步骤 | 名称 | 输入 | 输出 | 说明 |
|------|------|------|------|------|
| 1 | **输入映射** | 外部异构输入 | 校验后的 `ContentOpportunity` | 补全缺省字段、校验 slug、丢弃无效引用。 |
| 2 | **内容计划生成** | `ContentOpportunity` | `ContentPlan`（轻量：体裁列表、目标 channel、篇幅预设） | 可不持久化；写入日志或 `metadata` 即可。 |
| 3 | **草稿生成** | `ContentPlan` + 项目事实 | 一条或多条 `ContentDraft` | 模板/规则为主；LLM 为可选增强。 |
| 4 | **质量检查** | `ContentDraft` | 更新 `quality_flags`、通过/打回 | 规则优先；打回可阻断进入 bundle 或仅警告（策略可配置）。 |
| 5 | **草稿存储** | 定稿草稿 | 持久化 | 如 `data/content-drafts.json` 或 DB。 |
| 6 | **内容包生成** | 已通过质检的草稿集合 | `ContentBundle` | 调用 Growth 侧 `createContentBundleFromDraft` 或等价逻辑；写入 bundle 存储。 |

**失败策略**：任一步骤失败应**结构化记录**（opportunity_id、step、error），由 Orchestrator 决定是否重试或告警；V1 不强制复杂补偿事务。

---

## 9. 质量标准

V1 质检以**可自动化规则 + 人工抽检**为主。

| 维度 | 要求 |
|------|------|
| **相关性** | 正文必须与 `project_slugs` / `topic_tags` 及 `ContentOpportunity.type` 一致；禁止套模板跑题。 |
| **证据感** | 关键信息尽量对应可引用来源（项目页、更新、仓库 star 等）；避免无来源数字与断言。 |
| **风格一致** | 符合 MUHUB 语气规范（见下）；同一 bundle 内口径一致。 |
| **可发布性** | 长度、敏感词、链接有效性（可逐步实现）、渠道字段符合渠道下限（如字数）。 |
| **非重复** | 与近期已生成草稿在标题/核心句上做简单相似度或关键词overlap 检测（V1 可用轻量规则）。 |

### MUHUB 风格约束（V1 必须遵守）

- **信息导向**：说明「是什么、谁在做、解决什么问题」，少形容词堆叠。  
- **克制、清晰**：短句优先；避免「最、第一、颠覆」等除非有客观可链证据。  
- **不夸张、不做投资判断**：不对用户收益、股价、融资结果做承诺或引导性结论。

---

## 10. 与其它层的边界

### 10.1 Discovery

| Content Agent | Discovery |
|---------------|-----------|
| 消费 **已结构化** 的线索与引用（`discovery_refs`），**不**复制抓取逻辑。 | 负责抓取、去重、入池；**不**负责长文定稿与多渠道拆解。 |
| 若需项目事实，优先 **站内 Project / Update**；发现侧仅作补充引用。 | **Content Discovery** 子域的未来产出应能 **映射为 `ContentOpportunity`**。 |

### 10.2 Growth

| Content Agent | Growth |
|---------------|--------|
| 输出 **质检后可 handoff 的 Draft** 与 **Bundle 素材组织结构**。 | 负责渠道适配规则、排期语义、（未来）真实发布执行与账号凭据。 |
| **不**直接调用平台发帖 API（V1）。 | **不**重新发明草稿正文生成逻辑；从 Draft/Bundle 读取。 |

### 10.3 Orchestrator

| Content Agent | Orchestrator |
|---------------|--------------|
| **不**决定全站 cron 表；暴露「处理单条 `ContentOpportunity`」的可调用单元即可。 | 负责触发时机、多源合并、错误重试策略、与 Discovery/Import 流水线的隔离。 |
| 可被 CLI、Server Action、队列 worker 调用；**同一入口契约**（入参 `ContentOpportunity`，出参 draft/bundle id）。 | 命名上避免把仅含 Content 的任务误标为 `growth` 脚本（参见分层文档）。 |

---

## 11. 状态机建议

以下为**建议状态**；实现可分阶段落地，与现有字面量 `status: "draft"` 兼容时，可先做「字符串枚举扩展 + 默认 `created`/`draft` 等价」。

### 11.1 `ContentDraft` 状态

| 状态 | 含义 |
|------|------|
| `created` | 已生成，未质检。 |
| `review_pending` | 待人审（或待人触发自动规则集）。 |
| `review_passed` | 质检/人工通过，可进入 bundle。 |
| `review_failed` | 未通过，需改稿或丢弃。 |
| `bundled` | 已纳入某个 `ContentBundle`。 |
| `archived` | 过期或不再使用，保留审计。 |

### 11.2 `ContentBundle` 状态

| 状态 | 含义 |
|------|------|
| `draft` | 包结构已生成，内容仍可能有变。 |
| `ready_for_launch` | 已定稿，可交运营排期或手工发布。 |
| `launched` | 已执行对外发布（V1 可人工标记）。 |
| `hold` | 暂缓，不计入活跃排期。 |
| `archived` | 活动结束，仅存档。 |

**说明**：V1 若未落 DB，状态可仅存 JSON；**以 `id` + `updated_at` 日志**保证可追溯即可。

---

## 12. 最小落地建议

### 12.1 必做（V1 闭环）

- `ContentOpportunity` 的 **TypeScript 类型或 Zod schema**（与本文一致）。  
- **映射 → 生成 → 规则质检 → 写入 draft store** 的单路径实现（可无 UI）。  
- 至少一种 **P0 类型**（Spotlight 或 Roundup）端到端可跑通。  
- 从通过质检的 draft **生成一个 `ContentBundle`**（即使社交渠道文案仍为规则占位）。

### 12.2 可以先人工代替

- **人工审核**：`review_pending` → 人工改稿 → `review_passed`。  
- **人工发布**：`ready_for_launch` 后运营复制粘贴到各平台；系统中 `launched` 手打勾。  
- **热点与选题**：`manual_topic` 与管理员表单代替自动选题。  
- **高级去重**：重复检测可先肉眼；自动检测接 §9 轻量规则即可。

### 12.3 定位总结

**V1 = 半自动内容生产系统**：机器（规则/模板/可选 LLM）负责**结构化产出与初检**，人负责**把关与发布**；**不是**无人值守自动运营系统。

---

## 13. 后续版本展望

| 版本方向 | 可能能力 |
|----------|----------|
| **V2** | 受控自动发布（单平台 pilot）、排期日历与 Growth 深度打通、基础效果回传（点击/阅读人工录入或单一平台 API）。 |
| **V3+** | 多平台适配深化（版式、素材规范）、数据反馈闭环（转化信号驱动选题）、**自动视频**或富媒体管线、轻量 A/B。 |

上述均 **不在 V1 范围**；V1 交付以 §12 **必做**为准。

---

## 相关文档与代码索引

| 资源 | 说明 |
|------|------|
| [agent-system-layering-v1.md](./agent-system-layering-v1.md) | 六层模型与 Content / Growth / Orchestrator 关系（本文是其 Content Layer 的落地规格）。 |
| `agents/content/content-agent.ts` | 当前草稿生成入口。 |
| `agents/content/content-types.ts` | `ContentDraft`、`ContentProjectInput` 等。 |
| `agents/content/content-draft-store.ts` | 草稿本地存储。 |
| `agents/growth/content-bundle.ts` | `ContentBundle` 与从 draft 组装逻辑。 |
| `agents/growth/content-bundle-store.ts` | Bundle 本地存储。 |
| [content-to-growth-handoff-v1.md](./content-to-growth-handoff-v1.md) | `ContentAgentBundle` → `ContentLaunchCandidate` → Growth 最小消费。 |

---

## 文档小结（供 PR / 评审引用）

**Content Agent V1** 在分层上隶属于 **Content Layer**，以 **`ContentOpportunity` → 计划 → `ContentDraft`（质检）→ `ContentBundle`** 为最小闭环；**不**做全自动多平台发布与重型预测/视频/A-B/事实核查。风格上坚持 **信息导向、克制、清晰、不替用户做投资判断**。实现上优先 **Spotlight、更新摘要、主题清单、 Digest** 四类场景，并与 **Discovery / Growth / Orchestrator** 按 §10 边界协作。
