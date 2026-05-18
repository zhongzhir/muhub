# Discovery Actions Refactor 2026-05-18

## 为什么拆分

`app/admin/discovery/items/actions.ts` 同时承担了页面动作、文章正文提取、队列条目构造、重复项目判断和项目导入前校验。随着手机采集器、公众号文章提取、GitHub/RSS 发现和通用创新项目入队接入同一页面，单个 server action 文件变得过长，后续修改容易把 UI 返回文案、数据库写入和提取规则混在一起。

本次拆分的目标是保持页面行为不变，把可复用、可单独验证的业务逻辑移到 `lib/discovery`，让 `actions.ts` 更接近 server action 编排层。

## 拆分前问题

- 文章抓取、AI/启发式提取、App Store/Google Play 轻量补全散落在 action 文件中。
- 手动 GitHub/GitCC 入队、通用项目入队、批量文章入队都在 action 文件中重复构造 `DiscoveryItem`。
- 项目重复判断直接写在 action 文件中，多个动作复用同一优先级规则时不够清晰。
- 批量入队的来源校验、去重、成功/重复/失败计数和 UI 返回文案耦合在一起。
- 后续如果继续接入新来源，容易继续扩大 `actions.ts`。

## 新模块职责

`lib/discovery/article-extraction.ts`

- URL 正文抓取与正文清洗。
- GitHub/GitCC/Product Hunt 等文章来源链接提取。
- 通用项目的 AI 提取与启发式提取。
- App Store / Google Play 轻量补全。
- 从文章正文或 URL 生成可供页面选择的候选项目。

`lib/discovery/queue-projects.ts`

- 构造手动发现队列条目。
- 按 GitHub URL、项目来源、官网、slug、名称查重。
- 手动 GitHub/GitCC 入队与直接导入前置校验。
- 通用项目官方来源校验、入队与直接导入前置校验。
- 批量文章项目入队的来源校验、去重、条目构造和统计计数。

## 保留在 actions.ts 的职责

- 登录和权限检查。
- server action 函数签名与页面调用入口。
- 页面表单字段的基础解析。
- 调用 `article-extraction.ts` 和 `queue-projects.ts`。
- `revalidatePath`。
- UI 友好的成功、失败、重复提示文案。
- 已存在的发现任务运行、状态更新、批量删除和 JSON 队列导入入口。

## 本次不改动的行为边界

- 不改变页面交互和返回字段结构。
- 不改变发现队列 JSON 存储和项目库写入结果。
- 不改变重复项目判断优先级。
- 不自动发布项目，仍保留人工审核和发布控制。
- 不把 AI 相关性作为入库门槛，AI 只作为标签或短期加分因素。
- 不重构 GitHub/RSS 发现任务、手机采集器页面和项目编辑页。

## 后续建议

- 将 `parseManualGithubProjectAction` 的预览解析逻辑继续收敛为 `queue-projects.ts` 中的 preview helper，进一步减少 `actions.ts` 中的 GitHub/GitCC URL 解析。
- 将 `parseGeneralProjectAction` 中的“参考链接抓取 + AI 初步解析 + 官方来源补全”整理为独立 helper，避免后续通用项目解析逻辑再次堆回 action 文件。
- 为 `queue-projects.ts` 增加轻量单元测试，覆盖手动 GitHub、GitCC、Product Hunt、通用项目缺少官方来源、重复项目等分支。
- 如果继续扩展发现来源，优先复用 `article-extraction.ts` 产出候选，再通过 `queue-projects.ts` 进入队列，避免新来源直接写入 action 文件。
