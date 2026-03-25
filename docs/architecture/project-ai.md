# AI Native 第一阶段（内容生成）

最小能力：**无 Agent、无队列**，通过 OpenAI Chat Completions（兼容 `OPENAI_BASE_URL`）在后台补全文案。

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 未设置或为空时，所有 AI 调用跳过，业务 **静默降级** |
| `OPENAI_BASE_URL` | 可选，默认 `https://api.openai.com` |
| `OPENAI_MODEL` | 可选，默认 `gpt-4o-mini` |

## 模块

| 文件 | 职责 |
|------|------|
| `lib/ai/project-ai.ts` | `generateProjectDescription`、`generateProjectTags`、`generateUpdateSummary`；`isAiConfigured()` |
| `lib/ai/enrich-project.ts` | `enrichProjectWithAi(slug)`、`scheduleProjectAiEnrichment(slug)`（不阻塞 redirect） |
| `lib/ai/update-summary-ai.ts` | `applyAiSummaryToProjectUpdate`、`scheduleAiSummaryForUpdate` |
| `lib/github-release-update.ts` | 刷新快照发现 **新 Release 标签** 时创建 `GITHUB` 动态并调度摘要 |

## 触发点

1. **项目介绍 `description`**：`Project.sourceType` 为 **`import`** 或 **`seed`**，且 `description` 为空时，创建/入库后异步补全（**`createProject`**、`import:seed`**）**。
2. **项目标签 `tags`**：仅 **`import`**，已配置 **`githubUrl`** 且 `tags` 为空时生成 3～5 个短标签写入 **`Project.tags`**（PostgreSQL `text[]`）。
3. **动态摘要**：仓库 **`GITHUB`** 动态（当前为 **新 Release** 自动生成条目）或未来 **`OFFICIAL`** 条目；在 **`summary` 仍为空** 时生成摘要，**`isAiGenerated: true`**，**不修改** `title` / `content` / `sourceType`；可选标题建议写入 **`metaJson.aiSuggestedTitle`**。

## UI

- **`isAiGenerated`** 的动态：来源 badge 保持 **代码仓库 / 官方动态** 等，**并列** **`AI摘要`** 小徽章；正文下展示 **「AI 摘要：…」** 段落（见详情页 `project-update-ai-summary`）。
- **标签**：详情 **Hero 下**、分享名片 **链接区下** 展示 `project-tags` / `share-project-tags`。

## 扩展（非本轮）

- **`OFFICIAL` 动态** 写入后，在创建处调用 `scheduleAiSummaryForUpdate(id)` 即可复用同一套摘要逻辑。
- 更复杂的 pipeline、异步队列、Webhook 同步另立里程碑。
- 周期性脚本与摘要卡字段见 **[ai-operations.md](./ai-operations.md)**（第 20 轮）。
