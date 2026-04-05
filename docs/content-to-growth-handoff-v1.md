# Content-to-Growth Handoff V1

> **版本**：V1（交接层契约 + 最小实现）  
> **关联**：[智能体体系分层 V1](./agent-system-layering-v1.md) · [Content Agent V1](./content-agent-v1.md)

---

## 1. 文档目的

Content Agent V1 已能将 **`ContentOpportunity` → `ContentDraft`（内容质检）→ `ContentAgentBundle`** 落在可持久化资产上。若**跳过显式交接**直接进入「发布脚本」，会出现：

- Growth 不知道一条 bundle **是否允许对外动作**（运营未点头即生成渠道素材）。
- **内容质检**与**放行决策**混在同一状态位上，无法审计「谁、在何时、因何允许增长侧接手」。
- `ContentAgentBundle`（内容侧资产包）与 `growth/content-bundle.ts` 的 **`ContentBundle`**（渠道拆解后的营销单位）职责不同，**硬合并**易产生历史结构冲突（本阶段刻意不合并）。

**Handoff V1** 在 **Content Layer 输出** 与 **Growth Layer 输入** 之间增加**薄接口**：把「已通过内容质检的 bundle」变成 **`ContentLaunchCandidate`**，经 **handoff review（运营放行）** 后，由 Growth **最小消费**（生成既有 `ContentBundle` 并落盘），并进入 **`consumed_by_growth`**。  
**本次仍不接真实渠道 API**，只保证交接链稳定、可复核。

---

## 2. handoff 的定位

| 维度 | 说明 |
|------|------|
| **在分层中的位置** | **接口层**：介于 `agents/content` 产出的 **`ContentAgentBundle`** 与 `agents/growth` 既有的 **`ContentBundle` 流水线**之间；**不是**与 Sources/Discovery/Orchestrator 并列的第六层业务层。 |
| **是否独立系统** | 否。表现为 **类型 + 状态机 + 本地 store + 少量纯函数**，不引入新运行时或调度框架。 |
| **核心作用** | 把内容生产输出**结构化**为 Growth 可消费的 **`ContentLaunchCandidate`**，并在放行后触发 **一次受控的 `acceptLaunchCandidate`**（生成 launch 侧对象并记账）。 |

---

## 3. 核心对象

### `ContentLaunchCandidate`（建议新增）

**一句话**：一条「候选上线任务」——关联内容侧 bundle 与主草稿，承载 **handoff 状态** 与 **运营审批摘要**，是 Growth **在不重做 content review 的前提下**接手的入口。

**与上下游关系**：

| 对象 | 角色 |
|------|------|
| **`ContentDraft`** | 正文与质检分；candidate 只**引用** `draftIds`，**不**在 handoff 层重跑 `content-review` 规则。 |
| **`ContentAgentBundle`** | 内容侧资产证券化单元（`draftIds`、`channelTargets`、`reviewStatus: passed` 等）；**创建 candidate 的前提**通常是 bundle 已通过内容质检。 |
| **`ContentLaunchCandidate`** | 交接实体：绑定 `bundleId`、`opportunityId`，并记录 **handoffStatus**、**approval**（运营放行）。 |
| **Growth `ContentBundle`** + **launch plan** | 既有 `createContentBundleFromDraft` 产出渠道备用稿；**launch plan** 在 V1 仍可为冷启动脚本/占位，handoff 的 **accept** 只保证写入 **`content-bundles.json`** 与 intake 日志，不扩展完整排期模型。 |

---

## 4. 状态机建议（`handoffStatus`）

| 状态 | 含义 |
|------|------|
| **`pending_review`** | 已从 `ContentAgentBundle` 生成 candidate，**等待 handoff review**（运营是否允许进入增长动作）。 |
| **`approved_for_growth`** | 运营已放行，可排队或直接被 growth 消费（视流程规定）。 |
| **`rejected`** | handoff 拒绝；growth **不得**消费。 |
| **`queued_for_growth`** | 已排队，growth worker/脚本可批量 `accept`。 |
| **`consumed_by_growth`** | 已完成最小消费（如生成并持久化 `ContentBundle` + intake 记录），**不**表示已对外发帖。 |
| **`archived`** | 流程结束或过期，仅留档。 |

字段 **`reviewStatus`**（candidate 上）建议表示 **Content Agent 侧质检快照**（来自 bundle，如 `passed`），与 **`handoffStatus`** 分离。

---

## 5. 审核节点

| 节点 | 负责什么 | 不负责什么 |
|------|----------|------------|
| **Content review** | 标题/正文门槛、证据感、营销与投资口吻等（`content-review.ts`）。 | 不决定「本周是否发、发哪条优先」。 |
| **Handoff review** | 运营/主编**放行**：是否与排期、合规、品牌口径一致；是否进入 growth 队列。 | **不**重新逐字做全文内容规则引擎（若需改稿应退回 content 侧改草稿后再走 bundle）。 |

V1：**handoff 审批为函数级 + 可选 notes**，复杂审批后台留到后续。

---

## 6. growth 最小消费方式

1. **前置条件**：`handoffStatus ∈ { approved_for_growth, queued_for_growth }`，且主草稿 `draftIds[0]` 可读、`review_passed`（与 content 侧一致）。  
2. **`acceptLaunchCandidate`**（按 id）：加载 candidate 与主 `ContentDraft`，调用 **`createContentBundleFromDraft(candidate.title, draft)`**（现有 growth 逻辑，**不**再跑 content-review）。  
3. **`appendBundle`** 写入 `data/content-bundles.json`。  
4. 追加 **`GrowthLaunchIntakeStub`**（最小审计：`candidateId`、`growth` 侧 `ContentBundle.id`、`acceptedAt`）。  
5. 将 candidate 更新为 **`consumed_by_growth`**。

即：**Growth 消费的是「已批准 candidate + 已定稿草稿」→ 产出既有渠道 bundle**；质检信任链止于 content，handoff 只增加**放行与审计**。

---

## 7. V1 范围

### V1 做

- 定义 **`ContentLaunchCandidate`** 与 **handoff 状态机**（文档 + 类型）。  
- **`createLaunchCandidateFromBundle` / approve / reject / queue / accept`** 最小实现 + **本地 JSON store**。  
- **演示脚本**：`bundle → candidate → approve → queue → accept → growth bundle 落盘`。

### 留到 Launch / Growth V2+

- 真实多平台发布、账号与 OAuth。  
- 排期日历、优先级队列、多轮审批。  
- Analytics 回流、A/B、自动二次适配。  
- 合并或统一 `ContentAgentBundle` 与 `ContentBundle` 的存储模型（**本阶段不合并历史结构**）。

---

## 8. 与现有文档的衔接

- **[agent-system-layering-v1.md](./agent-system-layering-v1.md)**：明确 Content 与 Growth 分层；本文描述二者之间的 **handoff 契约**，不改变六层语义。  
- **[content-agent-v1.md](./content-agent-v1.md)**：Content 产出 **Draft / `ContentAgentBundle`**；本文约定 **bundle 之后**如何进入 Growth **而不重复 content review**。  

---

## 相关代码索引

| 资源 | 说明 |
|------|------|
| `agents/content/content-types.ts` | `ContentAgentBundle`、`ContentDraft` |
| `agents/content/content-bundle.ts` | （content 侧 bundle 工厂，非 growth 包） |
| `agents/growth/content-bundle.ts` | `ContentBundle`、`createContentBundleFromDraft` |
| `agents/growth/content-bundle-store.ts` | growth bundle 落盘 |
| `agents/growth/launch-candidate.ts` | `ContentLaunchCandidate` 类型 |
| `agents/growth/content-handoff.ts` | handoff 纯函数 + `acceptLaunchCandidateById` |
| `agents/growth/content-handoff-store.ts` | candidates + intake stub JSON |
| `scripts/run-content-handoff-demo.ts` | 端到端演示 |
