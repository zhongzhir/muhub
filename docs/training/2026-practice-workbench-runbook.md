# training.muhub.cn 实践交流工作台运行手册

## 1. 活动基础信息

- 活动名称：出版融合发展工程实践交流活动
- 活动时间：2026 年 6 月 29 日至 7 月 3 日
- 活动结构：3 个班、6 个小组、6 个案例
- 当前活动 slug：`publishing-practice-2026-06`

## 2. 生产环境变量

上线前必须检查以下环境变量：

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `TRAINING_UPLOAD_DIR`

说明：

- `TRAINING_UPLOAD_DIR` 生产环境建议使用以下路径之一：
  - `/var/www/muhub/storage/training/uploads`
  - `/data/muhub/training/uploads`
- 上传目录必须是持久化目录。
- 上传目录不能放在 `public` 下。

## 3. 数据库部署命令

上线或发布后执行：

```bash
npx prisma migrate deploy
corepack pnpm seed:training-2026
npx prisma migrate status
```

说明：

- `seed:training-2026` 需要可重复执行。
- 重复执行后，不应重复插入活动、分组、案例、任务和邀请码。

## 4. 文件目录准备

生产服务器可参考以下命令准备上传目录：

```bash
mkdir -p /var/www/muhub/storage/training/uploads
chown -R <app-user>:<app-user> /var/www/muhub/storage/training
chmod -R 750 /var/www/muhub/storage/training
```

说明：

- `<app-user>` 需替换为实际 PM2 / Node 运行用户。
- 若生产使用 `/data/muhub/training/uploads`，需按实际目录调整命令。

## 5. 邀请码清单

本期活动邀请码如下：

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

说明：

- 学员邀请码按小组发放。
- 导师邀请码按班级发放。
- `ADMIN-2026` 仅代表 training 活动身份，不等同于 MUHUB 主站后台管理员。
- `/training/admin` 仍要求使用 MUHUB 主站管理员账号访问。

## 6. 现场使用流程

### 学员流程

1. 打开 `training.muhub.cn`
2. 使用手机号登录
3. 进入“绑定活动身份”
4. 输入所在小组邀请码
5. 进入“我的工作台”
6. 查看案例资料
7. 按任务填写讨论纪要、阶段成果
8. 上传任务相关文件
9. 提交最终成果
10. 填写满意度调查

### 导师流程

1. 登录
2. 输入班级导师邀请码
3. 进入“我的工作台”
4. 切换本班两个小组
5. 查看记录和文件
6. 填写导师点评

### 管理员流程

1. 使用 MUHUB 管理员账号登录
2. 进入 `/training/admin`
3. 查看小组进度
4. 下载文件
5. 查看调查结果
6. 导出 CSV

## 7. 上线前 Smoke Test 清单

上线前至少完成以下检查：

- `/training` 首页可打开
- `/training/register` 可绑定邀请码
- `/training/cases` 权限过滤正常
- `/training/workspace` 可显示任务
- 学员可写讨论纪要
- 学员可写阶段成果
- 学员可上传文件
- 同组可下载文件
- 导师可切换本班两个小组
- 导师可写点评
- 导师可下载文件
- 管理员可进入 `/training/admin`
- 管理员可查看小组详情
- 管理员可导出 `survey / files / records` CSV
- 满意度调查可提交

## 8. 备份与兜底

- 数据库依赖现有 PostgreSQL 备份策略。
- 上传文件目录必须纳入服务器备份。
- 活动现场如短信登录异常，可由管理员提前准备备用账号。
- 如文件上传异常，学员可先通过微信群或邮箱提交，后续由管理员补录或留档。
- 如系统异常，CSV 导出和 Markdown 导出不是现场主流程必需项，不影响课堂核心流程。

## 9. 已知限制

- 暂无文件删除
- 暂无 OSS
- 暂无 PDF 导出
- 暂无 AI 自动分析
- 暂无在线协作文档
- 暂无聊天
- 导师调查使用 `groupNo = 0` 作为本期兼容策略
- 本模块为 training 专项模块，未并入 MUHUB 主线

## 10. 发布前补充核对

- 确认 `TRAINING_UPLOAD_DIR` 对运行用户可写。
- 确认 `corepack pnpm seed:training-2026` 已执行且结果幂等。
- 确认 10 个邀请码已发放到位，且班级、小组映射无误。
- 确认至少 1 个 MUHUB 主站管理员账号可访问 `/training/admin`。
