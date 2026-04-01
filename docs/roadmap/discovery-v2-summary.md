# Discovery V2 阶段总结与路线

## 已完成工作（Task 1 ~ Task 8，概览）

| 阶段 | 主题（概要） |
|------|----------------|
| Task 1–5 | Discovery V2 主干：来源、运行、候选池、分类/补全/审核链路与管理界面 |
| Task 6 | 广场 `/projects` 排序筛选、项目完整度、运营质量页、详情与发布提示 |
| Task 7 | **Product Hunt** 接入：与 GitHub 并存、GraphQL 抓取、去重与导入外链 |
| Task 8 | **审核优先级** `reviewPriorityScore` / `signals`、多来源展示、推荐审核区块、低信号筛选 |

详细实现以代码与 `docs/discovery/` 下文档为准。

## 当前系统能力

- **多来源发现**：GitHub（Topics / Trending）、Product Hunt（Featured / Topic）；统一进入 **`DiscoveryCandidate`**。
- **分类**：规则 Classification，接受后合并类型与标签。
- **补全**：Enrichment 管线与接受链接写回候选字段。
- **优先级**：可解释 **review 分** 与 **signals**，列表排序与聚光灯。
- **导入**：Approve 新建草稿项目、Merge 已有项目；外链、分类 slice、溯源字段。

## 下一阶段方向（建议）

1. **更多来源**：在遵守 `discovery-sources.md` 接入规范下扩展 `DiscoverySource`（RSS、官方目录等）。
2. **项目质量**：与 Task 6 一脉，`/admin/projects/quality`、完整度规则与广场推荐的持续迭代。
3. **用户发现体验**：广场推荐区块、排序策略的可配置化与 A/B 友好埋点（仍优先规则化）。

## 文档索引

- [架构与数据流](../discovery/discovery-architecture.md)
- [来源与去重](../discovery/discovery-sources.md)
- [审核优先级](../discovery/review-priority.md)
- [项目导入流](../project/project-import-flow.md)
