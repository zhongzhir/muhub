# training.muhub.cn 项目背景与 V1 计划

## 项目定位

**training.muhub.cn** 是基于 MUHUB 能力建设的定制项目页面，面向出版行业 AI 应用实训场景。

| 项 | 说明 |
|---|---|
| 当前服务对象 | 华闻传媒研究院 |
| 服务场景 | 出版行业 4–5 天实训课，每年约 2–4 次 |
| 生命周期 | 若项目停止，该二级页面可整体撤销，不影响 MUHUB 主站 |
| 当前名称建议 | **数智出版与 AI 出版实训课系列** |

## 本轮 V1 目标

1. **课程展示** — `/training` 首页介绍、课程安排、实训对象与快捷入口
2. **报名登记** — `/training/register`，表单提交落盘
3. **作业提交** — `/training/homework`，学员作业落盘
4. **示例案例包** — `/training/cases`，1 个示例案例供教学参考
5. **项目研究入口** — `/training/projects`，3–5 个示例项目卡片
6. **管理查看** — `/training/admin`，简单列表查看报名与作业（内部使用）

## 开发边界

**仅限修改：**

- `app/training/**`
- `public/training/**`
- 必要的 training 专用 API（`app/api/training/**`）
- 必要的 training 专用数据文件（`data/training-*.json`）
- `docs/training/**`

**不得改动：**

- MUHUB 主站首页
- 项目广场主流程
- Discovery 主流程
- 现有项目导入、分类、营销系统
- 主站导航结构（除非已有 training 入口需轻微修正）

## 数据存储（V1）

| 类型 | 路径 | 说明 |
|------|------|------|
| 报名记录 | `data/training-registrations.json` | JSON 数组，含提交时间 |
| 作业提交 | `data/training-homework.json` | JSON 数组，含提交时间 |

V1 不修改 Prisma 主结构；后续可迁移为专用数据表。

## 页面路径

| 路径 | 功能 |
|------|------|
| `/training` | 实训课系列首页 |
| `/training/register` | 报名表 |
| `/training/homework` | 作业提交 |
| `/training/cases` | 示例案例包 |
| `/training/projects` | 项目研究入口 |
| `/training/admin` | 内部管理查看 |

## 验收要点

- `/training` 正常打开，标题与副标题符合命名建议
- `/training/register` 可提交并写入 JSON
- `/training/homework` 可提交并写入 JSON
- `/training/admin` 可查看两类记录
- `/training/cases` 有示例案例包
- `/training/projects` 非空，含 3–5 个项目卡片
- 不影响 MUHUB 主站主流程

## 未完成 / 后续增强

- 管理页权限控制（V1 仅页面提示，无鉴权）
- 作业附件真实文件上传（V1 为 URL/文本占位）
- 案例包替换为华闻传媒研究院提供的真实材料
- 报名/作业数据迁移至数据库表
- 优秀作业公开展示与审核流程
