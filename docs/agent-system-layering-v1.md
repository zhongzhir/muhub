# MUHUB 智能体体系分层说明 V1

> **版本**：V1（概念与目录语义基线，非实现规范）  
> **状态**：团队共识文档；不改变现有代码行为或调度实现。

---

## 1. 文档目的

仓库已存在多处与「智能体」相关的代码与概念，包括但不限于：

- 目录：`agents/sources`、`agents/discovery`、`agents/import`、`agents/content`、`agents/growth`、`agents/orchestrator`
- 数据与流程：**Discovery V2**（`DiscoverySource` / `DiscoveryRun` / `DiscoveryCandidate`、管理端 `/admin/discovery`、`lib/discovery/*` 抓取与 upsert）
- 历史与脚本：`agents/orchestrator` 中对来源与发现、导入的串联；`agents/discovery` 中的 GitHub 搜索入池（`run-project-discovery`）与 mock 类 `discover*` 处理器

同时，产品侧计划推进**「内容生产与发布」**相关能力。若不在此明确**分层职责与术语**，容易出现：

- 在新目录重复实现与 `discovery` / `content` 重叠的「第四套发现」
- 把「内容发布」当成与现有 agents 无关的平行系统，导致接口与数据流分叉
- 把 **Orchestrator** 与 **Growth**、**Import** 混称为「增长脚本」或泛化的「agent」，排障与评审困难

本文目标：**统一分层模型、固定术语、映射当前目录角色**；**不要求**在本文发布时完成目录重构或调度重写。

---

## 2. 总体分层结构

MUHUB 智能体体系的**逻辑链路**（自外向内、自数据到动作）可概括为：

```text
sources → discovery → import / content → growth → orchestrator
```

含义分层解读：

| 链路 | 说明 |
|------|------|
| **项目发现链路** | 从**配置的来源**获得「可被导入的实体」（主要是**项目/候选**），经发现规范化后进入**导入**或运营审核，再落地为平台 `Project` 等。 |
| **内容生产链路** | 从**信号与素材**（平台内项目、榜单、话题、发现侧内容线索等）生成**可发布的文案/素材草稿**，再进入**增长层**做渠道适配与发布计划；不是与 `agents` 无关的另一套系统。 |
| **编排调度链路** | **Orchestrator** 负责「何时、以何策略、调用哪几层」——定时任务、CLI、HTTP 触发、管理端操作的后端编排都可归为此层**语义**；具体实现可分散在多个入口文件中。 |

**说明**：`import` 与 `content` 在图上并列，表示二者都是「发现之后」的**产出分支**——前者侧重**项目实体落地**，后者侧重**内容产物生成**；二者都可接收来自 **sources / discovery** 的输入（项目发现为主轴时走 import；内容生产为主轴时往往还依赖站内实体与运营输入）。

---

## 3. 六层正式定义

以下六层为**逻辑分层**；一层可对应多个目录或 `lib/*` 模块，也可存在历史命名与语义部分重叠的实现（见第 5 节）。

### 3.1 Sources Layer（来源层）

| 维度 | 说明 |
|------|------|
| **一句话定义** | **声明「数据从哪些渠道来」**——注册信息、配置元数据、能力开关，为 discovery 提供「去哪拉」的边界。 |
| **职责** | 维护来源清单与标识；描述类型（代码托管、社区、手动、第三方榜单等）；与启用/禁用策略对齐；不执行重抓取、不生成终稿文案。 |
| **典型输入** | 运营配置、静态注册表、（未来）DB / 远程配置、环境约束。 |
| **典型输出** | 来源 id、类型、URL/区域等元数据；供 discovery 或管理端选用的来源列表。 |
| **不负责什么** | 具体 HTTP/API 抓取、候选字段映射、LLM 撰稿、跨渠道发布执行。 |

### 3.2 Discovery Layer（发现-layer）

| 维度 | 说明 |
|------|------|
| **一句话定义** | **从来源拉取原始信号，并规范化为「可被下游消费的发现结果」**（项目候选、内容线索、机构线索等）。 |
| **职责** | 适配各来源协议；抓取/解析；去重键与规范化；写入**候选池或中间结构**（如 `DiscoveryCandidate`、历史 `DiscoveredProjectCandidate` 等，以代码与 Prisma 为准）；可包含面向运营的优先级信号，但不替代人工审核策略产品化全流程。 |
| **典型输入** | Sources 层提供的来源定义；API Token；任务参数（topic、trending、条数等）。 |
| **典型输出** | 候选记录、运行日志、统计计数；供 Import 或 Content 消费的**结构化发现项**。 |
| **不负责什么** | 不默认等同于「已审核可展示项目」；不在本层独立完成全站 SEO 文案定稿；不直接替代 Growth 的发布通道实现（可有元数据传递）。 |

**区分**：**Project Discovery**（项目发现）与 **Content Discovery**（内容发现/线索发现）同属本层**不同子域**；共享「拉取 → 规范化 → 入池/入线索」模式，但实体与下游不同（见第 4 节）。

### 3.3 Import Layer（导入层）

| 维度 | 说明 |
|------|------|
| **一句话定义** | **将「已认可的项目类发现结果」转为平台内的项目实体与关联数据**。 |
| **职责** | 字段映射、合并策略、创建/更新 `Project`、与 Dashboard 导入路径的一致性约定（与具体实现路径对齐）；幂等与错误处理。 |
| **典型输入** | 审核通过的候选、`DiscoveredProject` 批量结构、外部表单 JSON。 |
| **典型输出** | 新建或更新的项目 slug、关系表更新审计；失败原因供运营或编排重试。 |
| **不负责什么** | 不负责发现抓取；不负责社媒发帖；不扩展为通用 CMS 正文编辑器。 |

### 3.4 Content Layer（内容层）

| 维度 | 说明 |
|------|------|
| **一句话定义** | **内容生产**：把结构化输入（项目集、主题、模板变量）**生成可审可发的内容草稿**（文案、多版本、渠道初稿）。 |
| **职责** | 模板与规则拼装；（未来）LLM 生成与护栏；草稿版本与类型（短帖、轮播大纲、长文等）；与项目 slug 等来源追溯字段绑定。 |
| **典型输入** | `ContentProjectInput`、运营主题、discovery 侧摘要（若接入）。 |
| **典型输出** | `ContentDraft`、中间存储（如草稿 store）；供 Growth 选取与适配。 |
| **不负责什么** | 不独自承担全链路发布时间窗与渠道账号凭证管理；不把「导入项目」当作唯一输入（可与 discovery 线索结合，但边界在流水线契约中定义）。 |

### 3.5 Growth Layer（增长层）

| 维度 | 说明 |
|------|------|
| **一句话定义** | **分发与增长动作**：渠道适配、发布计划、素材打包、（未来）反馈回收的规则位。 |
| **职责** | 渠道适配器；内容 bundle；发布计划数据结构；与「何时发、发哪条草稿」相关的策略占位。 |
| **典型输入** | Content 层草稿、运营日历、渠道约束。 |
| **典型输出** | 可执行发布任务描述、存储中的 bundle；日志与状态。 |
| **不负责什么** | 不重新实现完整 discovery 抓取；不替代 Import 写库；编排入口可以调用本层，但「何时跑全链路」归 Orchestrator 语义。 |

### 3.6 Orchestrator Layer（编排层）

| 维度 | 说明 |
|------|------|
| **一句话定义** | **编排**：按策略串联 sources → discovery → import / content → growth，处理错误、跳过、重试与遥测。 |
| **职责** | 注册表与处理器映射（如发现 handler 表）；CLI / 定时任务 / Server Action 的统一**调用顺序**与扩展点（随代码演进）；避免单点硬编码扩散。 |
| **典型输入** | 触发源（cron、人工、消息）；特征开关。 |
| **典型输出** | 单次运行的聚合日志、指标；各层返回值组合。 |
| **不负责什么** | 不承担某一层的业务细节（例如具体 upsert SQL 细节应落在 discovery/import 实现模块）。 |

---

## 4. 两条核心业务链路

### 4.1 A. 项目发现链路

```text
source → discovery(project) → import
```

- **Source**：配置与注册（如 `DiscoverySource`、`agents/sources` 静态表、管理端来源配置）。
- **Discovery(project)**：`lib/discovery/*` 各适配器、`run-discovery-source`、`agents/discovery` 中针对项目的搜索/规范化/入池逻辑。
- **Import**：Dashboard / 管理端合并入 `Project`、`agents/import` 中与批量发现结构相关的路径，以及审核通过后的写库实现。

### 4.2 B. 内容生产发布链路

```text
sources / discovery(content) → content → growth
```

- **Sources / discovery(content)**：内容侧可复用**同一套来源与发现语义**——例如站内项目更新、榜单候选、话题聚合；「内容线索」的规范化仍属 Discovery 子域，**不是**另起一条无关联的管道。
- **Content**：`agents/content`（模板、类型、`ContentDraft` 生成）。
- **Growth**：`agents/growth`（bundle、渠道适配、计划结构）。

**重要结论**：计划中的**「内容生产发布智能体」**不是与当前 `agents` **平行的新系统**，而是由 **`discovery（内容子域）+ content + growth`** 构成的主要业务流水线，并由 **`orchestrator`** 在合适的触发点串联（与项目发现链路**并列**，可共享 orchestrator 与部分 sources 概念）。

---

## 5. 当前目录的职责映射

以下为**截至 V1 文档**的语义映射；实现上允许历史命名与分层理想形态不完全一致。

| 目录/模块 | 当前更贴近的分层 | 说明 |
|-----------|------------------|------|
| `agents/sources` | **Sources** | 静态项目来源注册表；为 discovery handler 与启用列表提供 id。 |
| `agents/discovery` | **Discovery（偏项目发现）** | `github-*`、`gitee`、`v2ex`、`manual` 等处理器；`run-project-discovery` 衔接 GitHub 搜索与候选 upsert。 |
| `agents/import` | **Import** | 批量导入占位与类型规范化；与 Dashboard 真实写库路径的关系以代码注释与 [project-import-flow.md](./project/project-import-flow.md) 为准。 |
| `agents/content` | **Content（雏形）** | 草稿生成、模板与类型；后续 Content Agent V1 主要在本层扩展。 |
| `agents/growth` | **Growth（雏形）** | bundle、渠道、计划相关结构；发布器与反馈闭环可后续增量落地。 |
| `agents/orchestrator` | **Orchestrator（雏形）** | 如 `DISCOVERY_HANDLERS` 映射、CLI 用 `runGrowth` 等对多源的循环调度；**注意**：个别文件名可能历史原因同时触碰 discovery/import，以分层文档为准理解「意图」，而非仅凭文件名猜职责。 |
| `lib/discovery/*`、Prisma Discovery 模型、admin discovery API | **Sources（配置实体）+ Discovery + 运营审核边界** | **DiscoverySource** 承担「来源配置」的数据面；执行与 upsert 主体在 `lib/discovery`；审核与导入状态机见 [discovery-architecture.md](./discovery/discovery-architecture.md)。 |

### 5.1 现有「项目发现体系」主要落在哪几层？

综合 **Discovery V2**（`DiscoverySource` / `DiscoveryRun` / `DiscoveryCandidate`）、`lib/discovery/*`、管理端发现、`agents/discovery` 与 `run-project-discovery`：

- **Sources（语义）**：`DiscoverySource` 行 + `agents/sources` 的静态注册（两轨并存时各自定位不同，运营以 DB 配置为准）。
- **Discovery**：抓取、映射、去重、入候选池、运行审计的主体。
- **Import**：审核通过后的项目落地、与 `Project` 合并（含 product-import-flow 等流程文档描述部分）。

**Orchestrator** 体现在 admin/API/CLI 触发与 `agents/orchestrator` 的注册映射中，**Growth 不主导**项目发现主链路。

### 5.2 建议性的未来目录整理方向（非本次执行）

为减少「所有发现混在一个文件夹」的认知成本，**后续**（单独 RFC / 任务）可考虑**逐步**演化为类似结构：

- `agents/discovery/project/` — 项目发现适配与任务入口
- `agents/discovery/content/` — 内容线索发现（若与项目发现代码量分担）
- `agents/content/idea/`、`agents/content/draft/` — 创意与草稿子模块（按需）
- `agents/growth/publish/`、`agents/growth/feedback/` — 发布执行与回收

**刻意不在 V1 阶段执行**：大规模搬迁、批量重命名、公共 API 重导出变更；以文档对齐为先，避免与在途业务 PR 冲突。

---

## 6. 统一术语

| 术语 | 固定含义 |
|------|----------|
| **Project Discovery** | 发现**项目/仓库/产品实体**并进入候选池的路径。 |
| **Content Discovery** | 发现**可供写作的线索或素材**（话题、更新摘要、外部榜单条目转写等），仍为 Discovery 层子域，不是「绕过 discovery 的爬虫」。 |
| **Project Import** | 将候选或表单数据**落地为平台 Project**（及关联数据）。 |
| **Content Production** | **Content Layer**：生成草稿与版本化内容产物，不等同于「后台发一篇文章按钮」的全部实现。 |
| **Growth Distribution** | **Growth Layer**：渠道、计划、bundle、发布与反馈相关能力。 |
| **Orchestrator** | **编排**：串联各层、处理触发与错误的协调逻辑；不等于某一个 CLI 文件名。 |

**建议避免的模糊命名**：

- 用「Discovery」泛指一切后台任务（应区分 project / content / import）
- 用「Growth」指代「只做项目发现 + 导入」的脚本（易与 Growth Layer 混淆）
- 无上下文的「Agent」——应指明是 import / content / orchestrator 中的哪条能力

---

## 7. 当前阶段建议

1. **以本文档统一认知与评审用语**；新需求对照第 3、4 节标定落层。
2. **Content Agent V1** 在独立设计/评审中展开接口与数据契约，实现优先落在 `agents/content` 与必要 `lib/*`，避免重复造「第四套发现」。
3. **不做大规模目录重构** until 有专用迁移任务与测试计划；轻微调整仅通过后续小 PR 逐步做。
4. 项目发现已与 DB、管理端深度耦合，**新内容流水线**应显式声明与 `DiscoveryCandidate` / 站内 `Project` 的依赖，而非旁路复制模型。

---

## 8. 结论（团队共识简版）

- MUHUB 智能体体系按 **Sources → Discovery → Import / Content → Growth → Orchestrator** 理解；**项目发现**与**内容生产发布**是两条核心业务链路，**共享分层语言**，不是两套互不相干的「智能体操作系统」。
- 当前的 **`agents/*` 与 `lib/discovery`** 是上述分层的**代码投影**，存在历史文件名与理想目录结构的差距；**以本文分层语义为准**，目录渐进整理留待后续专项。
- **内容生产发布智能体** = **`discovery（内容子域）+ content + growth`**，由 **orchestrator** 编排触发；**不在 V1 文档阶段强制实现或重构**。

---

## 相关文档

- [内容生产发布智能体 V1（Content Agent）](./content-agent-v1.md)
- [Discovery V2 架构与数据流](./discovery/discovery-architecture.md)
- [Discovery 数据来源与接入](./discovery/discovery-sources.md)
- [项目导入流程](./project/project-import-flow.md)
