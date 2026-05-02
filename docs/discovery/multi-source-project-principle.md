# MUHUB 多来源项目原则

MUHUB 是所有项目的公众信息平台，不是 GitHub 项目库。GitHub 是早期重要切入点和高质量信息源，但不是项目创建、项目识别、项目展示的必要条件。

## 1. 背景

MUHUB 从 GitHub 切入，是因为很多 AI/技术项目天然公开，GitHub 信息结构化、可持续追踪，能反映项目动态和技术质量。

但 MUHUB 的长期定位是所有项目的公众信息平台，不限于 GitHub，也不限于技术项目。项目可能来自官网、公众号文章、Product Hunt、GitCC、媒体报道、社交账号、应用商店、小程序、产业园区项目页、活动报名页、融资新闻或其它公开资料。

因此，GitHub 应被视为一种高质量信息源，而不是项目存在的前提。

## 2. 核心原则：项目优先，来源多元

Project 是 MUHUB 的核心对象。所有采集、识别、导入、展示和后续运营流程，都应围绕 Project 本体组织。

GitHub、官网、公众号文章、GitCC、Product Hunt、媒体报道、社交账号、应用商店、小程序、产业园区项目页等，都应被视为 Project Source。它们提供不同维度的信息，帮助确认项目身份、理解项目定位、追踪项目动态和评估信息完整度。

GitHub 不得作为项目成立的必要条件。一个项目可以没有 GitHub 仓库，但只要有可信来源或明确的项目主地址，就可以被创建、收录和展示。

## 3. 三层结构

### Project：项目本体

Project 表示项目本身，包括名称、简介、分类、标签、主地址、展示状态、AI 结构化信息等。Project 不应绑定到某一种来源平台。

### Source：信息来源

Source 表示用于理解 Project 的信息来源。来源可以是 GitHub 仓库、官网、公众号文章、GitCC 项目页、Product Hunt 页面、媒体报道、社交账号、文档、博客、应用商店链接等。

Source 应保留来源类型、平台、URL、label、是否主来源、正文或摘要等信息，便于后续人工复核和自动补全。

### Signal：动态信号

Signal 表示项目相关的动态线索，例如版本发布、媒体报道、社交讨论、融资新闻、活动报名、公众号更新、产品发布、GitHub 活跃度变化等。

Signal 不一定直接等同于 Project Source，但可以转化为候选项目、补充现有项目，或形成项目动态。

## 4. 项目创建最低条件

创建 Project 的最低条件应是：

- 项目名称
- 至少一个可信来源或项目主地址
- GitHub 可选

可信来源可以是官网、平台项目页、公众号文章、媒体报道、应用商店页面、产业园区项目页、Product Hunt 页面、GitCC 页面等。GitHub 仓库是可信来源之一，但不是唯一来源。

## 5. URL 分类原则

URL 进入 Discovery 或导入流程时，应先分类，再决定写入位置。

- `github.com`：GitHub 仓库
- `mp.weixin.qq.com`：公众号文章来源
- `gitcc.com` / `producthunt.com`：平台项目页
- 独立域名：官网或项目主页
- 媒体/新闻链接：来源文章
- 其它链接：外部链接，需保留 `platform` / `label` / `url`

导入时不得把来源文章 URL 当作项目官网，也不得因为没有 GitHub URL 就拒绝创建项目。

## 6. 当前最小实现

当前最小实现已支持：

- GitCC / Product Hunt 等平台项目页可作为 `websiteUrl`
- GitCC 链接写入 `Project.websiteUrl`、`ProjectSource`、`ProjectExternalLink`
- 公众号文章写入 `ProjectSource(kind=WECHAT_ARTICLE)`，不覆盖官网
- 没有 GitHub 也允许创建项目

以 GitCC 项目页为例，链接会同时作为项目主地址和可复核外部来源保存。以公众号文章为例，文章只作为来源文章保存，不会覆盖项目主页。

## 7. 后续演进方向

后续可以引入更清晰的 Project Identity 层，例如：

- `primaryProjectUrl`
- `canonicalUrl`
- 项目身份去重规则
- 多平台项目页归并规则

不同项目类型也应定义不同的信息完整度标准。技术项目可以重点看 GitHub 动态、文档、官网、Release；非技术项目可以重点看官网、公众号、社媒、活动、产品页、业务数据、应用商店和媒体报道。

Discovery prompt/schema 后续应明确输出：

- `primaryProjectUrl`
- `sourceArticleUrl`
- `externalLinks`
- `githubUrl`
- `websiteUrl`
- `projectPageUrl`

这样可以从源头区分项目主页、平台项目页、来源文章和其它外部链接，减少导入阶段的猜测与误判。
