# MUHUB Discovery V2 阶段总结（2026-05-18）

## 一、本阶段总体目标

本阶段的核心目标，是让 MUHUB 从“项目展示平台”逐步升级为：

> 一个 AI 驱动的项目发现、结构化、传播与公众化系统。

重点不再只是“展示项目”，而是建立：

- 项目发现能力
- 多来源信息采集能力
- AI 结构化分析能力
- 项目 evidence（证据链）体系
- AI 内容生成能力
- 持续更新能力
- 项目公众主页能力

本阶段开始形成 Discovery V2 的基础架构。

---

# 二、本阶段完成的核心能力

---

## chinese-independent-developer V2（2026-05-19）

主板-only 默认策略、AI enrichment 门禁与人工审核回退详见：

- [docs/discovery/chinese-independent-developer-v2.md](./discovery/chinese-independent-developer-v2.md)

---

当前已验证真实链路：

```text
微信公众号文章
→ 手机采集
→ 自动正文提取
→ AI/启发式项目识别
→ JSON 队列
→ 项目入队
→ 导入项目
→ ProjectSource 保存
→ AI 认知卡生成
→ 项目公众主页展示
```

这是当前阶段最重要的成果。

系统已经不再是“手工录入项目”。

而是开始具备：

> AI 自动发现 + AI 自动结构化 + AI 自动归档

能力。

---

# 三、Discovery V2 已形成的能力

---

## 1. 手机采集系统

新增：

- `/admin/discovery/mobile`
- 手机端快速提交外部链接
- 自动提取正文
- 自动识别项目
- 自动进入 discovery queue

支持来源：

- 微信公众号文章
- GitHub
- GitCC
- Product Hunt
- 普通网站文章

---

## 2. AI 项目提取系统

已形成：

### AI 提取

- `aiExtractProjectInfo`
- `aiExtractGeneralProjectsFromArticle`

### 启发式提取

- GitHub URL
- GitCC URL
- Product Hunt URL
- 标题/正文关键词识别

### 混合合并机制

- AI 提取结果
- URL 提取结果
- 启发式结果
- 去重合并

当前已经具备：

> “从长文章中自动识别项目”

的能力。

---

## 3. ProjectSource（项目来源）体系

本阶段的重要升级：

### 手机采集来源保留

现在：

- 微信公众号文章
- 外部文章链接
- 来源正文
- 来源摘要

都会进入：

`ProjectSource`

并在项目编辑页展示。

新增：

`WECHAT_ARTICLE`

来源类型。

系统开始真正形成：

> 项目 evidence / 信息来源链

---

## 4. AI 认知卡（AI Insight）

已正式跑通：

```text
ProjectSource
→ evidence context
→ AI 分析
→ AI 认知卡
```

当前 AI 可以基于：

- GitHub
- 微信文章
- 官网
- 外部介绍

生成：

- 项目摘要
- 项目定位
- AI 结构化认知

这是 MUHUB 从“项目库”向“AI 项目理解系统”演化的重要节点。

---

## 5. Discovery Daily 工作台

已形成：

`/admin/discovery/daily`

用于：

- 今日发现
- discovery 工作流运营
- AI enrichment 观察
- 项目处理入口

开始形成：

> AI discovery operation dashboard

---

# 四、本阶段的重要架构升级

---

## 1. Discovery actions.ts 拆分

原：

`app/admin/discovery/items/actions.ts`

逻辑过重。

本阶段已拆分为：

---

### article-extraction.ts

负责：

- URL 抓取
- 正文清洗
- AI 提取
- 启发式提取
- 官方来源补全

作用：

> 将“文章理解能力”独立出来。

---

### queue-projects.ts

负责：

- 项目入队
- 查重
- 导入前校验
- 批量统计
- ProjectSource 构造

作用：

> 将“项目队列能力”独立出来。

---

### actions.ts

现在只保留：

- server action
- 登录检查
- 表单解析
- revalidatePath
- UI 返回

Discovery 后台结构明显健康化。

---

# 五、本阶段解决的重要问题

---

## 1. 手机采集来源丢失

问题：

- 手机采集文章进入项目后
- 项目来源页只显示 GitHub
- 微信公众号来源丢失

已修复：

- `sourceArticleUrl`
- ProjectSource 自动创建
- WECHAT_ARTICLE 来源保存
- 同 URL 去重

现在：

项目来源链已经形成。

---

## 2. AI 服务环境变量问题

问题：

- DeepSeek 已配置
- 页面仍提示“AI 服务未配置”

原因：

- `.env.production`
- `.env.local`
- `.env`

多环境变量覆盖。

已修复：

- 生产环境 DeepSeek 配置
- PM2 update-env
- AI Insight 运行恢复正常

---

## 3. Discovery 结构过重问题

问题：

- actions.ts 越来越巨大
- 多入口逻辑难维护

已通过 lib 拆分初步缓解。

---

# 六、当前系统已形成的能力层级

当前 MUHUB 已经不是单纯项目站。

系统已经形成：

---

## 第一层：项目发现

- 手机采集
- URL 发现
- discovery queue
- 多来源提取

---

## 第二层：信息结构化

- AI extraction
- ProjectSource
- AI insight
- evidence context

---

## 第三层：项目公众主页

- 项目详情页
- AI 增强描述
- 来源展示
- 分享传播

---

## 第四层：AI 运营系统（雏形）

- daily discovery
- enrichment
- AI generation
- AI marketing

---

# 七、当前仍存在的问题

---

## 1. AI 提取成功率仍不稳定

目前问题包括：

- 微信正文质量不稳定
- AI 提取误判
- 长文章上下文丢失
- 多项目混杂时识别错误
- GitHub 与正文关联错误

这是下一阶段核心问题。

---

## 2. AI 认知卡质量仍有限

目前仍偏：

- 摘要化
- 泛化
- 信息密度不足

下一阶段需要：

- evidence 引用
- 风险分析
- 项目成熟度
- 技术栈识别
- 生态关系分析

---

## 3. 自动化程度仍有限

目前：

- 仍需要人工审核
- 仍需要人工导入
- AI pipeline 还不完整

---

# 八、下一阶段方向（重点）

---

# 第一优先：提高 AI 执行质量

目标：

> 提高 AI 获取信息、分析项目、结构化内容的成功率和正确率。

重点：

- 更稳定的正文抓取
- 更好的 chunking
- 多阶段 extraction
- AI + heuristic 混合校验
- 来源可信度评分
- 项目置信度

---

# 第二优先：让 AI 承担更多环节

逐步推进：

```text
发现
→ 提取
→ enrichment
→ 分类
→ 去重
→ 生成 insight
→ 生成传播内容
→ 更新项目
```

逐步减少人工操作。

---

# 第三优先：走向自动化 pipeline

最终目标：

```text
source material
→ extraction
→ enrichment
→ review
→ publish
→ update
```

形成真正的：

> AI Discovery Pipeline

---

# 九、本阶段的重要意义

本阶段最大的意义，不是增加了多少页面。

而是：

> MUHUB 开始真正形成“AI 时代项目公众基础设施”的底层能力。

系统已经开始具备：

- 自动发现项目
- 自动理解项目
- 自动整理项目
- 自动沉淀 evidence
- 自动生成结构化认知

的能力。

这标志着：

MUHUB 正从：

```text
项目展示网站
```

逐步演化为：

```text
AI 驱动的项目发现与公众化系统
```
