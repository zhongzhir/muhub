# AI 自动运营机制（第一阶段）

目标：在 **无系统级 cron、无消息队列** 的前提下，通过 **手动脚本** 周期性拉取仓库变化并反哺 **动态 / 摘要卡**，并在详情页展示 **健康度** 与 **AI 摘要卡**。

## 运行入口

```bash
pnpm ai:update
```

依赖 **`DATABASE_URL`**。**`OPENAI_API_KEY`** 可选：

- **无 key**：仍会对比远端与快照；可 **写入新快照**、**Release 动态**（与手动刷新逻辑一致）；**仅提交推进** 时动态正文使用 **固定模板句**；**摘要卡** 步骤跳过。
- **有 key**：活跃度动态与摘要卡由模型生成短文案。

脚本内项目间默认 **`spacingMs: 350`**，减轻 API 突发（可在 `checkProjectUpdates` 选项中调整）。

## 模块

| 路径 | 说明 |
|------|------|
| `lib/ai/project-ai-cron.ts` | `checkProjectUpdates`：最近 **20** 条（可调）**有快照且 ACTIVE**、含 **githubUrl** 的项目；远端 `lastCommitAt` / `latestReleaseTag` 相对最新快照有变化则 **追加一条 GithubRepoSnapshot**；Release 变化则 **`createReleaseProjectUpdate`**；**仅提交变新** 则发 **`AI` 动态**（`sourceLabel: AI 更新`，**7 天** 内同类型冷却） |
| `lib/ai/project-ai-cron.ts` | `refreshProjectAiCardSummaries`：对 **`aiCardSummary` 为空** 且有 **简介或 tags** 的项目写入摘要（需 API key） |
| `lib/github-sync.ts` | `fetchLiveRepoSnapshotForUrl`：只读拉取 **GitHub/Gitee** 指标，供运营脚本对比 |
| `lib/project-health.ts` | `computeProjectHealth`：基于 **最新快照** 与既有 `computeGithubActivity` 规则得到 **活跃项目 / 持续维护 / 低活跃** |
| `lib/ai/project-ai.ts` | `generateRepoActivityCronLine`、`generateProjectHeroCardSummary` |

## 数据

- **`Project.aiCardSummary`**：详情 **Hero 下方** 摘要卡（`project-ai-summary`）。
- **健康度**：不落库，每次请求由快照 **即时计算**（`project-health-badge`）。

## 与第 19 轮关系

- Release 动态仍走 **`createReleaseProjectUpdate`**，并保留 **AI 摘要** 异步管线。
- 运营脚本在 **检测到 Release 变化** 时也会 **追加快照**（与详情页「刷新仓库数据」写入策略一致：**有历史**）。

## 后续扩展

- 真 cron（Vercel Cron / 系统 systemd）仅 **定时调用** `pnpm ai:update` 或 HTTP 内部路由即可。
- 健康度若改为模型研判，可在 `computeProjectHealth` 内增加 **可选 AI 分支** 并缓存结果。
