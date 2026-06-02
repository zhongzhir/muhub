# Memory Engine Theme Library V1

## 文档定位

本文是 Phase D Memory Engine 的早期设计备忘，用于记录 ALLMEME 从“单热点生产”逐步进化到“文化主题覆盖”的产品方向。

本文不是当前开发任务，不是立即实施方案，也不对应本阶段的建表、后台、UI 或复杂系统建设。当前原则仍然是闭环优先、最小可用优先。

## 1. 当前模式

现在 ALLMEME 的主链路是：

```text
热点
-> Discovery
-> Production
-> MEME Draft
```

这是事件驱动的生产模式。

它的优点是轻量、快速、闭环明确。系统可以围绕一个热点判断是否值得生产，并尽快进入 MEME Draft。

它的不足是单个热点容易消失。热点本身通常是短周期事件，如果只围绕单点事件生产，ALLMEME 很难形成长期文化资产，也难以知道某类生活情绪、社会议题或人群经验是否已经被持续覆盖。

## 2. 未来方向

当题材积累足够多时，系统应逐步识别并沉淀以下内容：

- 高共鸣题材
- 高频重复题材
- 长期存在的社会情绪
- 可系列化表达的生活场景

这些内容可以逐步沉淀为 Theme Library，即文化主题库。

Theme Library 的目标不是取代热点生产，而是在热点生产之外，让 ALLMEME 开始识别哪些题材具备长期表达价值，哪些主题值得持续覆盖，哪些场景可以形成系列式 MEME。

## 3. Theme / Series / Scene / MEME 四层结构

未来的文化主题覆盖可以按四层结构理解：

```text
Theme
-> Series
-> Scene
-> MEME
```

示例：

```text
Theme: 打工人
Series: 老板画饼系列
Scene:
- 开会画饼
- KPI 画饼
- 加班画饼
- 年终总结画饼
- 绩效谈话画饼
MEME: 每个 Scene 下可以逐步生产多个 MEME
```

Theme 表示长期文化主题，例如打工人、学生时代、亲子关系、婚恋关系、地域文化、人生焦虑、养宠生活、AI 时代等。

Series 表示某个 Theme 下可持续生产的一组表达方向。例如“老板画饼系列”不是一个热点，而是一类长期存在的职场体验。

Scene 表示 Series 下的具体生活场景。Scene 越具体，越容易转化为可生产、可复用、可扩展的 MEME 方向。

MEME 是最终内容结果。一个 Scene 下可以逐步生产多个 MEME，并在真实反馈中判断哪些值得长期保存。

## 4. 系列式 MEME 的价值

单条热点生产解决的是：

```text
今天做什么
```

系列式 MEME 解决的是：

```text
一个文化主题如何被持续覆盖
```

未来 ALLMEME 不应只是追热点，而应逐步形成对长期主题的 MEME 覆盖，例如：

- 打工人
- 学生
- 亲子
- 婚恋
- 地域文化
- 人生焦虑
- 养宠生活
- AI 时代

这些主题不是单次事件，而是长期存在的社会情绪和生活经验。Theme Library 的价值在于让系统知道：某个主题已经覆盖了什么，还缺什么，哪些表达已经被验证，哪些表达可以继续扩展。

## 5. Coverage Map

未来 Theme Library 可以形成 Coverage Map，即文化主题覆盖地图。

对于某个 Theme，Coverage Map 可以回答：

- 哪些 Series 已覆盖
- 哪些 Scene 已覆盖
- 哪些 Scene 尚未覆盖
- 哪些 MEME 已生产
- 哪些 MEME 值得长期保存

Coverage Map 的意义不是制造复杂管理系统，而是帮助 ALLMEME 从“生产过什么”进一步走向“理解过什么”和“覆盖到什么程度”。

## 6. 与 Discovery Engine 的关系

近期 Discovery Engine 仍然只负责一件事：

```text
发现热点是否值得生产
```

这是当前闭环的核心，不应被 Theme Library 过早打断。

未来 Discovery Engine 可以增加一层识别能力：判断一个热点属于哪个 Theme / Series / Scene。例如，一个关于职场绩效谈话的热点，可能被标记到“打工人 / 老板画饼系列 / 绩效谈话画饼”。

但这不是当前阶段的立即开发内容。当前阶段不应为了 Theme Library 改造 Discovery 主链路。

## 7. 与 Memory Engine 的关系

Memory Engine 不只是归档 MEME。

它更重要的方向是：

- 发现文化主题
- 沉淀文化主题
- 扩展文化主题
- 覆盖文化主题
- 形成长期文化记忆

如果 Discovery Engine 负责判断“这个热点今天值不值得做”，那么 Memory Engine 未来应逐步回答“这个题材在长期文化记忆里属于哪里”“它补齐了哪个主题覆盖”“它是否值得作为长期资产保存”。

Theme Library 是 Memory Engine 从内容归档走向 Cultural Memory Engine 的关键设计储备。

## 8. 当前阶段的最小可用原则

当前不立即开发完整 Theme Library。

当前不做：

- Theme 管理后台
- Series 管理后台
- Coverage Dashboard
- 自动主题聚类
- 自动发行计划

当前阶段仍应优先保证 Discovery -> Production -> MEME Draft 的主链路稳定运行，并继续积累真实生产案例和 Experience Feedback 数据。

## 9. 未来 MVP 建议

未来最小可用版本可以只做两个轻量字段和一个观察期。

### Theme Tag

在 Discovery 或 Radar 中增加一个可选字段：

```text
theme_tag
```

示例：

- 打工人
- 亲子关系
- 地域文化
- 学生时代

这个字段先用于人工标记和经验积累，不影响当前 Discovery -> Production 主链路。

### Series Note

在 MEME DNA 或 Production 结果中增加：

```text
series_note
```

用于记录这个 MEME 是否属于某个系列，以及它可能对应的系列方向。

series_note 不应一开始就变成复杂结构，也不应强制所有 MEME 都归入系列。它的价值是帮助团队在真实生产中观察哪些表达会自然重复，哪些方向具备系列化潜力。

### 观察期

先观察 100 到 300 条真实生产案例后，再决定是否正式建设 Theme Library。

观察重点包括：

- 哪些 theme_tag 高频出现
- 哪些 Series 会自然形成
- 哪些 Scene 有持续生产价值
- 哪些 MEME 在反馈中更值得长期保存
- Theme Library 是否真的能提高生产判断和内容复用效率

## 10. 结论

Theme Library 是 ALLMEME 迈向 Cultural Memory Engine 的重要方向。

它让系统从“追踪今天的热点”逐步走向“覆盖长期文化主题”，从“保存单条 MEME”逐步走向“形成文化记忆”。

但当前阶段仍应优先：

- Discovery Engine 闭环
- Experience Feedback 数据积累
- 生产链路稳定运行

Theme Library 只作为未来 Memory Engine 的设计储备。只有当真实生产案例足够多、重复主题自然出现、系列化价值被验证后，才应进入正式建设。
