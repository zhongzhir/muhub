# training.muhub.cn 2026 出版融合实践交流活动专项开发设计

> **For agentic workers:** 后续进入实现时，建议使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务执行。本文档先完成专项开发计划和整体设计，不直接实施业务代码。

**目标：** 将 `training.muhub.cn` 从当前展示/报名/作业占位能力，改造成服务 2026 年 6 月 29 日至 7 月 3 日“出版融合发展工程实践交流”活动的轻量实践工作台。

**架构：** 复用现有 Next.js App Router、NextAuth 手机号/GitHub 登录、Prisma/PostgreSQL、`training` 子域 rewrite 和 `TrainingPageShell`。新增少量 training 专用数据表与 API，按“活动、案例、小组、参与者、任务、纪要、点评、文件、调查”建模，不扩展成通用 LMS 或复杂组织权限系统。

**技术栈：** Next.js 15 App Router、React 19、NextAuth v5、Prisma 6/PostgreSQL、本地私有文件存储、CSV/Markdown 导出。

---

## P0-A 补充：可拔插专项模块边界

2026-06-12 补充确认：本次开发按“可拔插专项模块”执行，首批 P0-A 以轻量、可运行、可迁出为主。本文后续早期章节中提到的 `TrainingDiscussionNote`、`TrainingMentorReview`、`TrainingFinalSubmission` 细表方案不作为首批执行依据；首批统一使用 `TrainingRecord` 承载 `discussion_note`、`mentor_review`、`task_submission`、`final_submission`。

P0-A 允许改动范围收口为：

- `app/training/**`
- `app/api/training/**`
- `docs/training/**`
- `scripts/seed-training-2026-practice.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `tests/e2e/training-module.spec.ts`

P0-A 新增数据表固定为 9 张：

- `TrainingEvent`
- `TrainingGroup`
- `TrainingCase`
- `TrainingParticipant`
- `TrainingInvite`
- `TrainingTask`
- `TrainingRecord`
- `TrainingFile`
- `TrainingSurveyResponse`

可迁出设计要求：

- training 页面组件不依赖 MUHUB 主站项目组件。
- training API 不调用 Discovery / Project 发布逻辑。
- training 权限只复用登录用户 ID，不扩展 `User.role`。
- 当前活动 slug 放在 `app/training/lib/current-event.ts`。
- training 查询集中在 `app/training/lib/queries.ts`。
- training 权限判断集中在 `app/training/lib/access.ts`。
- 文件存储边界放在 `app/training/lib/file-storage.ts`。
- 后台代码保留在 `app/training/admin/**` 和 `app/api/training/admin/**`，不并入主站 `/admin`。

P0-A 不实现：

- 文件上传下载 API。
- 讨论纪要提交。
- 导师点评提交。
- 最终成果提交。
- 满意度调查保存。
- CSV 导出。
- MUHUB Project 草稿。
- OSS。
- AI 调用。
- 复杂后台。

## 1. 当前 training.muhub.cn 代码现状梳理

### 已阅读的关键文件

- `middleware.ts`
  - 已支持 `training.muhub.cn` / `training.localhost` 子域访问：非 `/training` 路径会 rewrite 到 `/training/*`，URL 可保持子域根路径体验。
  - 当前 middleware 的受保护路由只覆盖 `/dashboard`、`/me`、`/settings`、`/admin`，不覆盖 `/training/admin` 或 `/training/workspace`。
  - API 路由有全局限流逻辑，`/api/*` 直接放行到 API handler，权限需要在各 training API 内自行判断。

- `lib/pwa/training-host.ts`
  - `isTrainingHost(host)` 判断 `training.localhost` 或 `training.*`。

- `app/training/layout.tsx`
  - training 子域下启用 training PWA manifest 与 service worker。
  - 可继续复用，不建议本期改动 PWA 主逻辑。

- `app/training/_components/training-chrome.tsx`
  - 提供 `TrainingHeader`、`TrainingNav`、`TrainingFooter`、`TrainingPageShell`、`SceneTag`。
  - 当前导航仍是 V1：报名、作业提交、案例学习区、项目研究。
  - 本期应复用 shell，但要调整导航为“案例库 / 我的工作台 / 满意度调查 / 管理后台”。

- `app/training/page.tsx`
  - 当前是“数智出版与 AI 出版实训课系列”营销/课程展示页。
  - 内容与本次 6 月 29 日活动不匹配，可作为活动首页改造对象。

- `app/training/register/page.tsx`、`app/training/register/register-form.tsx`
  - 当前是报名表，不接入用户登录，不绑定身份/班级/小组。
  - 数据通过 server action 写入 JSON 文件。
  - 本期可废弃“公开报名”定位，改为“邀请码绑定活动身份”。

- `app/training/homework/page.tsx`、`app/training/homework/homework-form.tsx`
  - 当前是单页作业文本提交，不支持组内共享、导师点评、文件上传或任务分阶段。
  - 本期建议不沿用为主入口，保留跳转到新工作台。

- `app/training/cases/page.tsx`
  - 当前只有一个 MUHUB 示例案例，数据硬编码在页面内。
  - 本期需要替换为 6 个真实案例列表，并新增 `/training/cases/[slug]`。

- `app/training/projects/page.tsx`
  - 当前是硬编码研究项目入口，与本次“出版传媒类项目研究包下载”可选项相关。
  - 本期 MVP 不依赖此页；二期可改造为研究包下载页。

- `app/training/admin/page.tsx`
  - 当前读取 `data/training-registrations.json` 与 `data/training-homework.json`。
  - 页面明示 V1 暂未启用权限控制。
  - 本期必须接入 `requireMuHubAdmin()` 或 training admin 权限，否则不能用于活动真实数据。

- `app/training/actions.ts`、`app/training/lib/store.ts`、`app/training/lib/types.ts`
  - 当前 Training V1 使用本地 JSON 存储报名和作业。
  - 不适合本次需要：权限隔离、文件下载鉴权、导师点评、后台导出、后续转项目草稿。

- `auth.ts`、`auth.config.ts`、`app/api/auth/[...nextauth]/route.ts`
  - 现有 NextAuth 已接入 Prisma Adapter。
  - 支持 GitHub 登录与手机号验证码登录。
  - session 中会带 `session.user.id` 和 `session.user.role`。

- `lib/auth/phone-credentials-provider.ts`、`components/auth/phone-login-form.tsx`
  - 手机号登录会自动创建 `User` 和 `Account(provider="phone")`。
  - 适合培训活动使用：学员/导师可以用手机号登录，再通过邀请码绑定活动身份。

- `lib/admin-auth.ts`
  - 已有主站管理员判断：DB `User.role === ADMIN`，兼容环境变量 bootstrap。
  - 可直接复用于 `/training/admin` 和 `/api/training/admin/*`。

- `prisma/schema.prisma`
  - 已有 `User`、`Account`、`Session`、`PhoneVerificationCode`、`Project` 等主站模型。
  - 没有 Training 专用模型、Submission、Survey 或 File 模型。
  - `User.role` 是主站角色 `USER | ADMIN`，不应扩展为培训活动内角色，避免污染主站权限语义。

- `app/admin/discovery/feedback/export/route.ts`
  - 已有管理员鉴权 + 下载响应示例，可复用 CSV/JSONL 导出的响应模式。

- `docs/training/training-project-background-and-v1-plan.md`
  - 记录了 Training V1 边界：主要改动 `app/training/**`、`app/api/training/**`、`data/training-*.json`、`docs/training/**`。
  - V1 明确“附件真实上传、DB 迁移、权限控制”为后续增强；本次活动正好需要补齐这些能力。

### 当前可复用能力

- 子域能力：`training.muhub.cn` 已能映射到 `/training`。
- 页面骨架：`TrainingPageShell` 与现有 training 视觉可以复用。
- 登录能力：可复用手机号验证码登录，降低学员账号成本。
- 管理员能力：可复用 `requireMuHubAdmin()`。
- 数据库能力：Prisma/PostgreSQL 已在主站稳定使用。
- 项目能力：`Project` 可作为二期“最终成果转 MUHUB 项目草稿”的目标表，但 MVP 不应依赖它。
- 导出能力：已有 admin export route 的响应写法可参考。

### 当前缺口

- `/training/admin` 没有权限保护。
- `/training` 路由没有要求登录，无法区分学员、导师、管理员。
- Training 数据仍是 JSON 文件，无法可靠支持组内隔离、导师点评和导出。
- 没有后端文件上传与私有下载接口。
- 没有分组、案例、任务、纪要、点评、最终成果、满意度调查模型。
- 中文源码显示存在历史编码/乱码问题；实现时应直接用 UTF-8 修正文案，避免继续扩散乱码。

## 2. 最小可行产品范围

本期只服务 2026 年 6 月 29 日至 7 月 3 日活动，MVP 包括：

- 邀请码绑定身份与分组。
- 学员、导师、管理员三类活动权限。
- 6 个案例列表与详情页。
- 我的工作台：显示本组案例、导师、成员、5 日任务卡。
- 每个任务下记录讨论纪要。
- 每个任务下上传/下载文件。
- 导师在负责班级下填写点评。
- 最终成果提交。
- 满意度调查。
- 管理后台查看全部班级/小组、纪要、点评、文件、最终成果、调查结果。
- CSV 导出调查和提交清单。

MVP 不要求：

- 实时在线协作文档。
- 实时聊天。
- 自动评分、排名、考勤。
- 复杂课程、班级、部门、机构管理。
- 通用 LMS 能力。
- 复杂角色继承。
- OSS 接入。
- PDF 自动生成。
- AI 在线调用。

## 3. 不做事项

- 不修改主站 `/projects` 公开项目展示逻辑。
- 不修改主站 Project 发布/上架/Discovery 主流程。
- 不把培训活动角色写入 `User.role`。
- 不开放组间互看。
- 不允许上传文件直接放到 `public` 目录。
- 不做多人同时编辑同一篇纪要的冲突合并。
- 不做复杂组织架构、学院/课程/长期班期模型。
- 不引入重型第三方服务。

## 4. 数据模型设计

### 推荐路径

推荐新增 `TrainingParticipant` 表，而不是复用 `User` 字段，也不是把所有信息塞进 JSON。

原因：

- `User.role` 已用于主站 `USER | ADMIN`，培训角色 `student | mentor | admin` 是活动内角色，语义不同。
- 本次活动有明确的 class/group/case/invite 绑定，需要能查询、导出、审计。
- 一个 MUHUB 用户未来可能参与多个 training 活动，使用 participant 表更容易扩展。
- 相比“TrainingProfile”，`TrainingParticipant` 更准确：它是某个活动里的身份，而不是用户全局资料。

### 必要新增 enum

在 `prisma/schema.prisma` 新增：

```prisma
enum TrainingRole {
  student
  mentor
  admin
}

enum TrainingTaskKey {
  organization_preview
  experience_problem
  solution_design
  presentation_material
  review_sharing
}
```

### 必要新增表

#### TrainingEvent

用于固定本次活动，也方便后续加下一期但不做复杂 LMS。

```prisma
model TrainingEvent {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  startsAt    DateTime
  endsAt      DateTime
  status      String   @default("ACTIVE")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  cases        TrainingCase[]
  groups       TrainingGroup[]
  participants TrainingParticipant[]
  tasks        TrainingTask[]
  surveyResponses TrainingSurveyResponse[]
}
```

#### TrainingGroup

承载 3 个班级、每班 2 组。

```prisma
model TrainingGroup {
  id        String   @id @default(cuid())
  eventId   String
  event     TrainingEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  classNo   Int
  groupNo   Int
  name      String
  caseId    String?
  case      TrainingCase? @relation(fields: [caseId], references: [id], onDelete: SetNull)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  participants TrainingParticipant[]
  notes        TrainingDiscussionNote[]
  reviews      TrainingMentorReview[]
  files        TrainingFile[]
  submissions  TrainingFinalSubmission[]

  @@unique([eventId, classNo, groupNo])
  @@index([eventId, classNo])
}
```

#### TrainingCase

6 个案例独立存储，详情页和工作台共用。

```prisma
model TrainingCase {
  id          String   @id @default(cuid())
  eventId     String
  event       TrainingEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  slug        String
  name        String
  organization String
  classNo     Int
  groupNo     Int
  track       String
  traits      String?
  summary     String? @db.Text
  needAndUsers String? @db.Text
  competitors String? @db.Text
  technologyAdoption String? @db.Text
  marketAndBenefits String? @db.Text
  teamMechanism String? @db.Text
  challenges  String? @db.Text
  touchpointExperience String? @db.Text
  attachmentsJson Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  groups TrainingGroup[]

  @@unique([eventId, slug])
  @@unique([eventId, classNo, groupNo])
  @@index([eventId, classNo, groupNo])
}
```

#### TrainingParticipant

活动内身份表。

```prisma
model TrainingParticipant {
  id          String   @id @default(cuid())
  eventId     String
  event       TrainingEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role        TrainingRole
  classNo     Int?
  groupNo     Int?
  groupId     String?
  group       TrainingGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  inviteCode  String
  displayName String?
  organization String?
  phone       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  notes       TrainingDiscussionNote[]
  reviews     TrainingMentorReview[]
  files       TrainingFile[]
  submissions TrainingFinalSubmission[]
  surveyResponses TrainingSurveyResponse[]

  @@unique([eventId, userId])
  @@index([eventId, role])
  @@index([eventId, classNo, groupNo])
}
```

需要在 `User` 增加反向关系：

```prisma
trainingParticipants TrainingParticipant[]
```

#### TrainingInvite

邀请码表，支持预置和禁用。

```prisma
model TrainingInvite {
  id        String   @id @default(cuid())
  eventId   String
  code      String   @unique
  role      TrainingRole
  classNo   Int?
  groupNo   Int?
  maxUses   Int?
  usedCount Int      @default(0)
  isActive  Boolean  @default(true)
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([eventId, role])
}
```

邀请码建议：

- `C1G1-STUDENT`：一班一组学员。
- `C1G2-STUDENT`：一班二组学员。
- `C1-MENTOR`：一班导师，可看两个小组。
- `ADMIN-2026`：活动管理员；实际管理后台仍优先要求 MUHUB 主站 admin。

#### TrainingTask

5 日任务固定表，可种子化。

```prisma
model TrainingTask {
  id          String   @id @default(cuid())
  eventId     String
  event       TrainingEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  key         TrainingTaskKey
  dayIndex    Int
  title       String
  description String @db.Text
  activitiesJson Json
  deliverablesJson Json
  promptPackJson Json?
  sortOrder   Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  notes       TrainingDiscussionNote[]
  reviews     TrainingMentorReview[]
  files       TrainingFile[]

  @@unique([eventId, key])
  @@index([eventId, sortOrder])
}
```

#### TrainingDiscussionNote

每个任务每组可有多条纪要；MVP 页面可先显示最新或列表。

```prisma
model TrainingDiscussionNote {
  id          String   @id @default(cuid())
  eventId     String
  groupId     String
  group       TrainingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  taskId      String
  task        TrainingTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  authorParticipantId String
  authorParticipant TrainingParticipant @relation(fields: [authorParticipantId], references: [id], onDelete: Cascade)
  title       String
  content     String   @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([eventId, groupId, taskId])
  @@index([authorParticipantId, createdAt(sort: Desc)])
}
```

#### TrainingMentorReview

导师点评按任务和小组保存。允许同一任务多次点评，后台按时间显示。

```prisma
model TrainingMentorReview {
  id          String   @id @default(cuid())
  eventId     String
  groupId     String
  group       TrainingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  taskId      String
  task        TrainingTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  mentorParticipantId String
  mentorParticipant TrainingParticipant @relation(fields: [mentorParticipantId], references: [id], onDelete: Cascade)
  strengths   String? @db.Text
  issues      String? @db.Text
  suggestions String? @db.Text
  nextSteps   String? @db.Text
  recommendFinalPresentation Boolean @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([eventId, groupId, taskId])
  @@index([mentorParticipantId, createdAt(sort: Desc)])
}
```

#### TrainingFile

文件元数据表。文件本体放在服务器私有目录，不放 `public`。

```prisma
model TrainingFile {
  id          String   @id @default(cuid())
  eventId     String
  groupId     String
  group       TrainingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  taskId      String?
  task        TrainingTask? @relation(fields: [taskId], references: [id], onDelete: SetNull)
  uploaderParticipantId String
  uploaderParticipant TrainingParticipant @relation(fields: [uploaderParticipantId], references: [id], onDelete: Cascade)
  originalName String
  storageKey   String @unique
  mimeType     String?
  sizeBytes    Int
  kind         String @default("task_file")
  createdAt    DateTime @default(now())

  @@index([eventId, groupId, taskId])
  @@index([storageKey])
}
```

#### TrainingFinalSubmission

最终成果提交，关联一组。

```prisma
model TrainingFinalSubmission {
  id          String   @id @default(cuid())
  eventId     String
  groupId     String
  group       TrainingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  submitterParticipantId String
  submitterParticipant TrainingParticipant @relation(fields: [submitterParticipantId], references: [id], onDelete: Cascade)
  title       String
  summary     String @db.Text
  projectDraftId String?
  submittedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([eventId, groupId])
}
```

#### TrainingSurveyResponse

满意度调查。

```prisma
model TrainingSurveyResponse {
  id          String   @id @default(cuid())
  eventId     String
  event       TrainingEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  participantId String?
  participant TrainingParticipant? @relation(fields: [participantId], references: [id], onDelete: SetNull)
  name        String
  classNo     Int
  groupNo     Int
  caseQualityScore Int
  mentorScore Int
  platformScore Int
  mostValuablePart String @db.Text
  improvementPart String @db.Text
  willingToContinue Boolean
  muhubSuggestion String? @db.Text
  createdAt   DateTime @default(now())

  @@index([eventId, classNo, groupNo])
  @@index([participantId])
}
```

### 暂不新增的模型

- 不新增通用 `Submission` 表；使用 `TrainingDiscussionNote`、`TrainingFile`、`TrainingFinalSubmission` 更清晰。
- 不新增通用 `File` 表；主站没有成熟通用文件能力，本期用 `TrainingFile` 降低影响面。
- 不把案例建成主站 `Project`；案例是培训材料，不一定适合公开项目广场。

## 5. 路由与页面设计

### 公开/半公开路由

- `app/training/page.tsx`
  - 改为活动首页。
  - 正式文案建议：
    - 标题：`出版融合发展工程实践交流活动`
    - 副标题：`2026 年 6 月 29 日至 7 月 3 日`
    - 入口：`进入我的工作台`、`查看案例资料`、`填写满意度调查`

- `app/training/register/page.tsx`
  - 改为邀请码绑定页面。
  - 已登录用户输入邀请码后创建或更新 `TrainingParticipant`。
  - 未登录用户提示先手机号登录。

- `app/training/cases/page.tsx`
  - 显示 6 个案例卡片。
  - 学员只看到本组案例；导师看到本班 2 个案例；管理员看到 6 个案例。
  - 未绑定 participant 时显示“请先使用邀请码绑定身份”。

- `app/training/cases/[slug]/page.tsx`
  - 案例详情页，展示题目要求中的字段。
  - 下载附件时仍走 `/api/training/files/[id]/download`。

- `app/training/workspace/page.tsx`
  - 学员和导师主入口。
  - 学员：默认进入自己的小组。
  - 导师：显示本班两个小组切换。
  - 管理员：可跳转后台或选择任意小组预览。

- `app/training/survey/page.tsx`
  - 满意度调查表。
  - 登录且已绑定时自动带出姓名/班级/小组，但允许修改姓名。

### 管理路由

- `app/training/admin/page.tsx`
  - 接入 `requireMuHubAdmin()`。
  - 总览：3 个班、6 个组、成员数、文件数、纪要数、最终提交状态、调查提交数。

- `app/training/admin/groups/page.tsx`
  - 按班级/小组查看全部工作台内容。

- `app/training/admin/cases/page.tsx`
  - MVP 可先只读展示种子案例。
  - 若活动前客户材料频繁调整，可加简单编辑表单。

- `app/training/admin/survey/page.tsx`
  - 调查结果列表。
  - CSV 导出按钮。

- `app/training/admin/export/page.tsx`
  - 汇总导出入口：调查 CSV、文件清单 CSV、最终成果清单 CSV、学习档案 Markdown。

### API 路由

- `app/api/training/register/route.ts`
  - 校验登录态和邀请码，创建 `TrainingParticipant`。

- `app/api/training/workspace/route.ts`
  - 返回当前用户可访问的小组、案例、任务、纪要、点评、文件。

- `app/api/training/notes/route.ts`
  - 新增/更新讨论纪要。

- `app/api/training/reviews/route.ts`
  - 导师点评新增/更新。

- `app/api/training/files/route.ts`
  - `POST` 上传文件，写入私有存储和 `TrainingFile`。

- `app/api/training/files/[id]/download/route.ts`
  - 鉴权后下载文件。

- `app/api/training/final-submissions/route.ts`
  - 最终成果提交。

- `app/api/training/survey/route.ts`
  - 满意度调查提交。

- `app/api/training/admin/survey/export/route.ts`
  - 管理员导出 CSV。

- `app/api/training/admin/files/export/route.ts`
  - 管理员导出文件清单 CSV。

### 建议新增公共库

- `app/training/lib/current-event.ts`
  - 固定当前活动 slug：`publishing-practice-2026-06`。

- `app/training/lib/auth.ts`
  - `getCurrentTrainingParticipant()`
  - `requireTrainingParticipant()`
  - `requireTrainingAdminOrMuHubAdmin()`

- `app/training/lib/access.ts`
  - `canAccessTrainingGroup(participant, group)`
  - `canAccessTrainingCase(participant, case)`
  - `canDownloadTrainingFile(participant, file)`
  - `canReviewTrainingGroup(participant, group)`

- `app/training/lib/seed-data.ts`
  - 6 个案例、6 个小组、5 个任务、邀请码。

- `app/training/lib/csv.ts`
  - CSV escape 和下载响应构造。

- `app/training/lib/file-storage.ts`
  - 本地私有路径、文件名清洗、大小限制、MIME 白名单。

## 6. 权限设计

### 角色来源

- 主站管理员：`User.role === ADMIN` 或 `lib/admin-auth.ts` 环境变量 bootstrap。
- 活动角色：`TrainingParticipant.role`。
- 活动管理员：可以通过 `ADMIN-2026` 创建 `TrainingParticipant(role=admin)`，但访问 `/training/admin` 建议仍要求主站管理员，避免邀请码泄露导致后台数据暴露。

### 权限规则

学员 `student`：

- 必须有 `classNo`、`groupNo`、`groupId`。
- 只能访问自己的 `groupId`。
- 可查看本组案例、成员、导师、任务、纪要、点评、文件。
- 可新增/编辑自己创建的纪要。
- 可上传本组任务文件、下载本组文件。
- 可提交最终成果。
- 可填写满意度调查。

导师 `mentor`：

- 必须有 `classNo`，`groupNo` 为空。
- 可访问本班两个小组。
- 可查看两个小组的案例、纪要、文件和最终成果。
- 可下载两个小组文件。
- 可填写导师点评。
- 不应修改学员纪要正文。

管理员 `admin`：

- 可查看全部活动数据。
- 可导出 CSV/Markdown。
- 可下载全部文件。
- 可必要时维护案例和分组。

主站 MUHUB admin：

- 始终可进入 `/training/admin`。
- 即使未绑定 `TrainingParticipant`，也可后台查看全部数据。

### Middleware 是否修改

MVP 不建议在 `middleware.ts` 加复杂 training 权限。

原因：

- Training 权限需要查询数据库，不适合 Edge middleware。
- 当前 middleware 已避免 Prisma 依赖。
- 页面和 API 内用 server-side guard 更可控。

只建议最小修改：

- 如果需要保护 `/training/workspace` 的未登录访问，可在页面中调用 `auth()` 后 redirect 到 `/login?redirect=/training/workspace`。
- `/training/admin` 页面内部调用 `requireMuHubAdmin()`，未授权显示跳转或 403。

## 7. 文件上传下载方案

### 本地文件存储是否足够

本期活动 6 个小组、每组约 8-12 人、5 日任务，预计文件量可控。本地私有存储足够作为 6 月 29 日前稳定版本。

建议限制：

- 单文件最大 50 MB。
- 每组总量软限制 1 GB。
- 允许扩展名：`.pdf`、`.doc`、`.docx`、`.ppt`、`.pptx`、`.xls`、`.xlsx`、`.csv`、`.txt`、`.md`、`.png`、`.jpg`、`.jpeg`、`.zip`。
- 禁止可执行文件。

### 存储目录

不放 `public`。

建议：

- 环境变量：`TRAINING_UPLOAD_DIR`
- 默认：`storage/training/uploads`
- 目录结构：`storage/training/uploads/{eventSlug}/{classNo}-{groupNo}/{yyyyMMdd}/{fileId}-{safeName}`

`storage/` 应加入 `.gitignore`，并在部署环境挂载持久盘或确认平台文件系统是否持久。

### 上传流程

1. 用户登录。
2. API 获取 `TrainingParticipant`。
3. 校验目标 group/task 权限。
4. 读取 `request.formData()`。
5. 校验文件大小、扩展名、MIME。
6. 写入私有目录。
7. 创建 `TrainingFile`。
8. 返回文件元数据，不返回真实路径。

### 下载流程

1. 请求 `/api/training/files/[id]/download`。
2. 查询 `TrainingFile`、`TrainingGroup`。
3. 校验权限。
4. 从私有目录读取文件。
5. 返回 `Content-Disposition: attachment; filename="原文件名"`。
6. 设置 `Cache-Control: no-store`。

### 后续迁移到 OSS

迁移成本低，只需让 `TrainingFile.storageKey` 从本地相对路径切换为对象存储 key。

`app/training/lib/file-storage.ts` 应定义接口：

```ts
type TrainingStoredFile = {
  storageKey: string;
  sizeBytes: number;
  mimeType?: string;
};

async function saveTrainingFile(input: File, context: StorageContext): Promise<TrainingStoredFile>;
async function readTrainingFile(storageKey: string): Promise<{ body: ReadableStream | Buffer; sizeBytes: number }>;
```

本期实现 local adapter，二期增加 OSS adapter。

## 8. 后台管理方案

后台首版只做运营必须能力：

- `/training/admin`
  - 活动总览。
  - 每班/每组进度矩阵。
  - 缺失项提示：未绑定成员、未提交纪要、未上传文件、未提交最终成果、未填调查。

- `/training/admin/groups`
  - 筛选：班级、组别、任务。
  - 查看：案例、成员、纪要、文件、导师点评、最终成果。
  - 下载单个文件。

- `/training/admin/survey`
  - 查看满意度调查。
  - 导出 CSV。

- `/training/admin/export`
  - 导出：
    - `training-survey-2026.csv`
    - `training-files-2026.csv`
    - `training-final-submissions-2026.csv`
    - `training-archive-c1g1.md` 等小组档案 Markdown。

后台权限：

- 页面和 API 均调用 `requireMuHubAdmin()`。
- 活动内 `TrainingParticipant(role=admin)` 可作为二期扩展；MVP 不让它单独打开后台，除非用户明确确认。

## 9. 种子数据方案

### 种子脚本

新增：

- `scripts/seed-training-2026-practice.ts`

运行：

```bash
node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/seed-training-2026-practice.ts
```

建议后续在 `package.json` 增加：

```json
"seed:training-2026": "node --env-file=.env ./node_modules/tsx/dist/cli.mjs scripts/seed-training-2026-practice.ts"
```

### 活动数据

- slug：`publishing-practice-2026-06`
- name：`出版融合发展工程实践交流活动`
- startsAt：`2026-06-29T00:00:00+08:00`
- endsAt：`2026-07-03T23:59:59+08:00`

### 6 个案例初始数据

1. `phoenix-zhiling`
   - 案例名称：凤凰智灵平台
   - 案例单位：江苏凤凰传媒股份
   - 班级/小组：一班一组
   - 赛道：AI+教育

2. `sanjin-culture-model`
   - 案例名称：三晋文化大模型
   - 案例单位：山西出版集团
   - 班级/小组：一班二组
   - 赛道：AI+传统文化

3. `sanlian-civilization-tracing`
   - 案例名称：三联文明寻踪
   - 案例单位：三联生活周刊
   - 班级/小组：二班一组
   - 赛道：期刊+文旅

4. `lianhuanhua-ai-vertical-model`
   - 案例名称：连环画人工智能垂类模型
   - 案例单位：人民美术出版社
   - 班级/小组：二班二组
   - 赛道：美育教育新业态

5. `phoenix-literature-ai-comic-drama`
   - 案例名称：凤凰文艺 AI 漫剧
   - 案例单位：凤凰文艺
   - 班级/小组：三班一组
   - 赛道：IP 衍生漫剧

6. `china-treasure-hunt`
   - 案例名称：大中华寻宝记
   - 案例单位：中文传媒 21 世纪出版社
   - 班级/小组：三班二组
   - 赛道：出版 IP 多模态

说明：除名称、单位、赛道、班级/小组外，其他字段先写“待主办方补充材料”，页面用正式空态文案：

> 该部分资料将由活动组织方统一补充，当前请以现场发放材料为准。

### 5 日任务种子数据

任务 1：组织建设与案例预习

- 小组分工。
- 案例预读。
- 提交：分工表、预习问题清单。

任务 2：项目体验与问题识别

- 项目体验。
- 竞品分析。
- 提交：体验记录、竞品分析表、问题清单。

任务 3：优化设计与方案研磨

- 头脑风暴。
- 方案设计。
- AI 工具辅助。
- 提交：讨论纪要、优化方案初稿、AI 工具使用记录。

任务 4：汇报材料形成

- PPT。
- 作品生成。
- 试讲。
- 导师点评。
- 提交：汇报 PPT、修改版、导师意见记录。

任务 5：复盘分享

- 最终成果。
- 学习复盘。
- 提交：最终 PPT、复盘纪要、满意度调查。

### 邀请码种子数据

- `C1G1-STUDENT`
- `C1G2-STUDENT`
- `C2G1-STUDENT`
- `C2G2-STUDENT`
- `C3G1-STUDENT`
- `C3G2-STUDENT`
- `C1-MENTOR`
- `C2-MENTOR`
- `C3-MENTOR`
- `ADMIN-2026`

建议学员邀请码 `maxUses` 设为 15，导师邀请码 `maxUses` 设为 4，管理员邀请码 `maxUses` 设为 3。

## 10. 开发任务拆分

### Task 1：数据模型和种子数据

**文件：**

- 修改：`prisma/schema.prisma`
- 新增：`prisma/migrations/<timestamp>_training_practice_2026/migration.sql`
- 新增：`scripts/seed-training-2026-practice.ts`
- 可选修改：`package.json`

**验收：**

- Prisma generate 成功。
- migrate deploy/status 成功。
- seed 脚本可重复运行，不重复插入。
- DB 中有 1 个 event、6 个 group、6 个 case、5 个 task、10 个 invite。

### Task 2：training 权限和当前活动读取

**文件：**

- 新增：`app/training/lib/current-event.ts`
- 新增：`app/training/lib/auth.ts`
- 新增：`app/training/lib/access.ts`
- 新增：`app/training/lib/queries.ts`

**验收：**

- 未登录访问工作台跳转登录。
- 已登录但未绑定邀请码显示绑定入口。
- 学员只能取到本组。
- 导师只能取到本班两个组。
- 主站 admin 可取到全部。

### Task 3：邀请码绑定

**文件：**

- 修改：`app/training/register/page.tsx`
- 新增或改造：`app/training/register/register-form.tsx`
- 新增：`app/api/training/register/route.ts`

**验收：**

- 手机号登录用户输入 `C1G1-STUDENT` 后绑定一班一组学员。
- 重复绑定同一活动不会创建重复 participant。
- 无效/停用/超额邀请码给出正式错误文案。

### Task 4：案例列表和详情

**文件：**

- 修改：`app/training/cases/page.tsx`
- 新增：`app/training/cases/[slug]/page.tsx`
- 可选新增：`app/training/_components/case-card.tsx`

**验收：**

- 学员只看本组案例。
- 导师看本班两个案例。
- 管理员看 6 个案例。
- 详情字段按正式培训资料结构展示。

### Task 5：工作台页面

**文件：**

- 新增：`app/training/workspace/page.tsx`
- 新增：`app/training/_components/task-card.tsx`
- 新增：`app/training/_components/group-switcher.tsx`
- 新增：`app/api/training/workspace/route.ts`

**验收：**

- 学员进入后看到本组案例、导师、成员、5 日任务。
- 导师可在本班两个小组切换。
- 非本组 URL 或 groupId 请求返回 403。

### Task 6：讨论纪要

**文件：**

- 新增：`app/training/_components/discussion-note-form.tsx`
- 新增：`app/api/training/notes/route.ts`
- 修改：`app/training/workspace/page.tsx`

**验收：**

- 学员可为本组任务新增纪要。
- 学员可编辑自己创建的纪要。
- 导师和管理员可查看。
- 组外用户无法读写。

### Task 7：导师点评

**文件：**

- 新增：`app/training/_components/mentor-review-form.tsx`
- 新增：`app/api/training/reviews/route.ts`
- 修改：`app/training/workspace/page.tsx`

**验收：**

- 导师可点评自己班级两个小组。
- 点评字段包含优点、主要问题、建议补充、下一步修改方向、是否建议进入最终汇报。
- 学员只读导师点评。

### Task 8：文件上传下载

**文件：**

- 新增：`app/training/lib/file-storage.ts`
- 新增：`app/api/training/files/route.ts`
- 新增：`app/api/training/files/[id]/download/route.ts`
- 新增：`app/training/_components/file-upload-panel.tsx`
- 修改：`.gitignore`

**验收：**

- 文件不进入 `public`。
- 组内成员可下载本组文件。
- 导师可下载负责班级文件。
- 管理员可下载全部。
- 组外访问下载接口返回 403。

### Task 9：最终成果提交

**文件：**

- 新增：`app/training/_components/final-submission-form.tsx`
- 新增：`app/api/training/final-submissions/route.ts`
- 修改：`app/training/workspace/page.tsx`

**验收：**

- 每组可提交最终成果标题和摘要。
- 最终 PPT 通过 Task 8 文件能力上传。
- 后台能看到提交状态。

### Task 10：满意度调查

**文件：**

- 新增：`app/training/survey/page.tsx`
- 新增：`app/training/_components/survey-form.tsx`
- 新增：`app/api/training/survey/route.ts`

**验收：**

- 已绑定用户自动带出班级/小组。
- 所有题目完整保存。
- 同一 participant 默认只保留一份或更新同一份；如果允许多次提交，需要后台显示最新标记。建议 MVP 使用一人一份。

### Task 11：管理后台和导出

**文件：**

- 修改：`app/training/admin/page.tsx`
- 新增：`app/training/admin/groups/page.tsx`
- 新增：`app/training/admin/survey/page.tsx`
- 新增：`app/training/admin/export/page.tsx`
- 新增：`app/api/training/admin/survey/export/route.ts`
- 新增：`app/api/training/admin/files/export/route.ts`
- 新增：`app/training/lib/csv.ts`

**验收：**

- 非管理员不能访问后台。
- 管理员能按班级/小组查看全部内容。
- CSV 下载打开后中文不乱码，建议加 UTF-8 BOM。

### Task 12：活动首页和导航收口

**文件：**

- 修改：`app/training/page.tsx`
- 修改：`app/training/_components/training-chrome.tsx`
- 可选修改：`app/training/homework/page.tsx`
- 可选修改：`app/training/projects/page.tsx`

**验收：**

- 首页文案适配本次正式活动。
- 导航入口清晰：活动首页、案例资料、我的工作台、满意度调查。
- 老作业页不再成为主流程入口。

## 11. 优先级排序

P0，6 月 29 日前必须稳定：

1. 数据模型、种子数据、邀请码绑定。
2. 权限守卫。
3. 6 个案例页。
4. 工作台 5 日任务。
5. 讨论纪要。
6. 文件上传下载。
7. 导师点评。
8. 最终成果提交。
9. 管理后台查看与 CSV 导出。
10. 满意度调查。

P1，活动期间可补：

1. 案例资料后台编辑。
2. 小组学习过程档案 Markdown 导出。
3. AI 研究提示词包复制。
4. 出版传媒类项目研究包 Markdown/CSV 下载。

P2，二期：

1. 小组最终成果转 MUHUB Project 草稿。
2. OSS 文件存储。
3. PDF 档案导出。
4. 更完整的活动/班级长期管理。

## 12. 预计工作量

按现有代码情况估算：

- 数据模型、迁移、种子脚本：0.5-1 天。
- 权限与邀请码绑定：0.5-1 天。
- 案例页与工作台基础 UI：1-1.5 天。
- 纪要、点评、最终成果 API 与表单：1-1.5 天。
- 私有文件上传下载：1 天。
- 满意度调查与 CSV 导出：0.5-1 天。
- 管理后台总览和分组查看：1 天。
- 联调、文案修正、权限回归、部署验证：1-1.5 天。

合计 MVP：约 6-8 个工程日。

如果只做最窄可用版，压缩策略：

- 案例后台编辑延后。
- 工作台少做动态仪表盘，只做任务列表和表单。
- 每个任务纪要先用“新增列表”，不做富编辑。
- 文件上传先用单文件/多次上传，不做批量进度。

## 13. 风险点

- 生产环境文件系统是否持久：如果部署平台无持久盘，本地文件存储会丢文件。必须在实现前确认部署环境。
- `/training/admin` 当前无鉴权：上线前必须先改。
- 源码中历史中文存在乱码：本次改造应统一 UTF-8 保存相关文件，避免页面正式文案异常。
- 手机验证码依赖短信配置：如果活动现场短信不可用，需要准备 GitHub 登录或管理员预建账号替代方案。
- 邀请码泄露：学员邀请码可以接受一定共享，管理员邀请码不应单独授权后台。
- 文件大小和网络：PPT/视频可能过大，MVP 应明确单文件大小限制。
- 组间隔离：文件下载接口必须比页面隐藏更严格，不能只靠前端判断。
- 时间紧：不要把 Project 草稿、OSS、PDF、AI 调用放进首批。

## 14. 需要确认的问题

1. 每个案例与班级/小组的对应关系是否按上文顺序分配，即 1-2 属于一班，3-4 属于二班，5-6 属于三班？
2. 导师是否固定为“每班 2 位导师、共同查看本班两个小组”，还是每位导师只负责一个小组？
3. 学员是否必须用手机号登录？是否允许 GitHub 登录作为备选？
4. 生产部署是否有可持久化的本地存储目录？如果没有，文件上传需要提前接 OSS 或服务器磁盘。
5. 单文件最大限制是否可以定为 50 MB？是否会提交视频或大体积素材包？
6. 案例详情的完整材料由谁维护？如果活动前仍会频繁修改，是否需要把案例后台编辑列入 P0？
7. 满意度调查是否允许匿名？当前建议绑定 participant，但表单显示姓名。
8. `ADMIN-2026` 是否只用于绑定活动管理员身份，还是希望非 MUHUB 主站 admin 也能进入 training 后台？
9. 最终成果是否必须转成 MUHUB 项目草稿？建议二期，除非主办方要求活动现场展示。

## 15. 推荐第一批实现任务

建议立即进入实现，但只进入第一批 P0，不做二期增值项。

第一批顺序：

1. 新增 training 专用 Prisma 表和 seed 脚本。
2. 新增 training 权限辅助函数和当前活动查询。
3. 改造 `/training/register` 为邀请码绑定。
4. 改造 `/training/cases` 并新增 `/training/cases/[slug]`。
5. 新增 `/training/workspace`，先显示小组、案例、导师、成员、5 日任务。
6. 接入讨论纪要、导师点评和最终成果提交。
7. 接入私有文件上传下载。
8. 改造 `/training/admin`，加管理员鉴权和总览。
9. 新增 `/training/survey` 与 CSV 导出。

## 16. 推荐页面结构

面向学员：

- `/training`
  - 活动首页
  - 入口：我的工作台、案例资料、满意度调查

- `/training/register`
  - 邀请码绑定
  - 绑定成功后跳转 `/training/workspace`

- `/training/workspace`
  - 本组信息
  - 本组案例
  - 本组导师
  - 本组成员
  - 五日任务卡
  - 每个任务：纪要、文件、导师点评
  - 最终成果提交

- `/training/cases`
  - 可访问案例列表

- `/training/cases/[slug]`
  - 案例详情

- `/training/survey`
  - 满意度调查

面向导师：

- `/training/workspace`
  - 本班两个小组切换
  - 查看文件和纪要
  - 填写点评

面向管理员：

- `/training/admin`
  - 活动总览

- `/training/admin/groups`
  - 分组数据查看

- `/training/admin/survey`
  - 调查结果

- `/training/admin/export`
  - 导出入口

## 17. 可选增值功能判断

### AI 研究提示词包

投入低，建议 P1。

实现方式：

- 在 `TrainingTask.promptPackJson` 存储每个任务 2-3 条提示词。
- 页面提供复制按钮。
- 不内置 AI 调用。

### 出版传媒类项目研究包下载

投入中，建议 P1。

实现方式：

- 复用主站 `Project` 查询，筛选 `primaryCategory` 或 `categoriesJson` 中的出版传媒相关项目。
- 导出 Markdown/CSV。
- 不在 MVP 中做复杂筛选 UI。

### 小组最终成果转 MUHUB 项目草稿

投入中高，建议 P2。

原因：

- 需要映射 `TrainingFinalSubmission` 到 `Project`。
- 需要管理员审核后发布，涉及主站项目质量门槛。
- 容易牵动现有 Project 发布工作流。

低成本版本：

- 只在后台提供“生成草稿”按钮。
- 创建 `Project(status=DRAFT, visibilityStatus=DRAFT, isPublic=false, sourceType="training-2026")`。
- 不自动发布。

### 小组学习过程档案

投入中，建议 P1。

实现方式：

- 后台按 group 汇总案例、成员、任务、纪要、文件、点评、最终成果。
- 先导出 Markdown。
- PDF 暂缓。

## 18. 是否建议立即进入实现

建议立即进入第一批实现。

理由：

- 当前 training V1 已具备子域、页面骨架、登录和数据库基础，改造路径清晰。
- 本次活动需求已经超过 JSON 占位能力，必须尽早完成 schema、权限和上传下载闭环。
- 距 6 月 29 日上线窗口紧，优先做 P0，二期能力不应进入首批。

进入实现前建议先确认两件事：

1. 生产环境文件存储是否持久。
2. 6 个案例与 6 个小组的对应关系是否按本文默认顺序。
