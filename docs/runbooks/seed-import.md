# 冷启动：批量导入种子项目

## 用途

一次性将 `data/seed-projects.json` 中的公开项目写入数据库，用于 MUHUB 上线初期的项目广场展示。不做定时任务、无后台导入 UI。

## 前置条件

- Node.js 20+
- 已配置 **`DATABASE_URL`**（`.env`）
- 已执行 **`pnpm exec prisma migrate deploy`**（包含 **`Project.isFeatured` / `Project.sourceType`** 等迁移）

## 执行

在项目根目录：

```bash
pnpm import:seed
```

脚本通过 **`node --env-file=.env`** 读取环境变量（见 `package.json` 中的 `import:seed` 命令）。若运行环境不支持 `--env-file`，可手动导出 **`DATABASE_URL`** 后执行同一 tsx 命令。

## 行为说明

- 逐条 **`prisma.project.create`**，默认 **`status = ACTIVE`**、**`isPublic = true`**、**`claimStatus = UNCLAIMED`**。
- **`repoUrl`** 经 **`parseRepoUrl`** 校验，并 **`normalizeRepoWebUrl`** 后写入 **`githubUrl`** 字段（兼容 GitHub / Gitee，字段名历史遗留）。
- **`slug` 已存在**：跳过并打印 **`[跳过] slug=…：已存在`**。
- **`repoUrl` 非法**：跳过并打印 **`[跳过] …无法解析 repoUrl`**。
- 结束输出：**成功 / 跳过 / 失败** 统计；任一条创建抛错计入失败且进程以非零退出（仅跳过则成功退出）。

## 验证

1. 再次执行应几乎全部 **跳过**（幂等）。
2. 浏览器打开 **`/projects`**，应能看到种子中的项目名称卡片。
3. 点击某 slug（如 **`/projects/pytorch`**）进入详情，链接与仓库地址正确。

更完整的清单见 **`docs/runbooks/regression.md`** 中「批量导入种子项目」一节。
