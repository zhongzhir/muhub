# MUHUB 产品原则

## 发布原则：最小可展示优先，AI增强不阻断发布

MUHUB 当前阶段的发布原则是：发布 = 最小可展示；增强 = 后续质量提升。

项目进入公开展示链路时，系统应优先保证发现、导入、发布、展示的流转效率。只要项目已经具备最小可展示信息，就应允许先上线，再通过后续 AI、人工运营或项目方维护持续补全质量。

### 发布硬门槛

项目发布的硬门槛只应包括：

- 项目名存在。
- slug 合法。
- status / visibility 可发布。
- tagline 或 description 至少一个可展示。
- 有可用 AI 结构化分析 / AI 认知卡内容。

### 不得阻断发布的内容

以下内容不得作为发布阻断条件：

- AI增强版内容。
- AI传播草稿。
- GitHub facts refresh。
- source enrichment。
- 外部来源补全。
- full_ai 状态。
- GitHub URL 是否存在。

AI增强、来源增强、内容增强失败时，应进入 warnings，在后台提示，并允许后续补全，不得进入 blocked。

### GitHub 信息源原则

GitHub 不再是项目信息源强绑定条件：

- 有 GitHub 时，使用 GitHub 增强。
- 无 GitHub 时，基于 website / sources / article / description 增强。
- 都不足时，跳过增强，但不阻止发布。

### 产品理由

当前阶段优先提高项目发现、导入、发布、展示的流转效率。AI 链路中的非核心增强环节不应降低自动发布成功率。

系统应允许项目先上线，再通过后续 AI、人工运营、项目方补全持续提高质量。

### 开发约束

后续新增 AI 功能时，默认不得加入 publish blocked 条件。若确需成为发布硬门槛，必须先在产品层确认。

readiness 结果应区分 blocked / warnings / skipped：

- blocked：真正阻止发布的基础条件问题。
- warnings：不影响发布、但需要后台提示或后续补全的质量问题。
- skipped：不应参与当前发布动作的项目，例如非 DRAFT 项目或不存在的记录。
