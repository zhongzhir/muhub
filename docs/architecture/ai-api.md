# AI 项目 API：`/api/ai/project`

基于 **GitHub 仓库 URL** 拉取公开元数据，并可选使用 **OpenAI** 生成简介与标签；返回结构化 JSON，便于外部集成或内部工具。

实现入口：**`lib/ai/project-api.ts`**（`fetchProjectSummary`）；路由：**`app/api/ai/project/route.ts`**。

## 支持的平台

- 当前 **仅解析 `github.com`** 仓库 URL（与 `parseGitHubRepoUrl` 一致）。
- 需能访问 **GitHub REST API**；建议配置 **`GITHUB_TOKEN`** 提高速率上限。

## 请求

### POST

- **URL**：`/api/ai/project`
- **Header**：`Content-Type: application/json`
- **Body**：

```json
{
  "githubUrl": "https://github.com/vercel/next.js"
}
```

### GET

- **URL**：`/api/ai/project?githubUrl=https://github.com/vercel/next.js`

## 成功响应：`200`

JSON 与 **`ProjectSummaryPayload`** 一致，示例：

```json
{
  "name": "next.js",
  "summary": "……（AI 生成的中文简介，或未配置 key 时为仓库 description 占位）",
  "tags": ["React", "SSR", "…"],
  "updates": [
    {
      "title": "Release v15.1.0",
      "summary": "发布于 2025-xx-xx",
      "sourceUrl": "https://github.com/vercel/next.js/releases/tag/v15.1.0",
      "occurredAt": "2025-… ISO8601 …"
    },
    {
      "title": "chore: …",
      "summary": "……",
      "sourceUrl": "https://github.com/vercel/next.js/commit/…",
      "occurredAt": "…"
    }
  ],
  "sources": [
    { "kind": "GITHUB", "url": "https://github.com/vercel/next.js", "label": "GitHub" },
    { "kind": "WEBSITE", "url": "https://nextjs.org", "label": "官网" }
  ]
}
```

- **`updates`**：优先包含**最新 Release**（若有）， plus 若干**近期 commit**。
- **`tags`**：未配置 **`OPENAI_API_KEY`** 时多为 **`[]`**。
- **CI / E2E**：设置 **`GITHUB_IMPORT_E2E_FIXTURE=1`** 且请求 **`muhub/e2e-fixture`** 时返回固定 JSON，不访问外网。

## 错误响应

| HTTP | `error`（body 内） | 说明 |
|------|-------------------|------|
| 400 | `missing_github_url` | 未提供 `githubUrl` |
| 400 | `invalid_json` | POST 非合法 JSON |
| 400 | `invalid_url` | 非可识别的 GitHub 仓库 URL |
| 404 | `repo_not_found` | GitHub API 404 |
| 502 | `api_error` | 网络或其它 API 失败 |

错误体示例：

```json
{ "error": "invalid_url" }
```

## 环境变量

| 变量 | 作用 |
|------|------|
| `OPENAI_API_KEY` | 生成 **`summary`** / **`tags`**；未设则降级为仓库描述 + 空标签 |
| `OPENAI_BASE_URL` | 可选，默认 OpenAI 官方 |
| `OPENAI_MODEL` | 可选，默认 `gpt-4o-mini` |
| `GITHUB_TOKEN` | 可选，`Authorization: Bearer`，提高 GitHub 限额 |

## 安全与合规

- 只读公开仓库信息；请勿在日志中打印完整 API Key。
- 生产环境建议对该路由做 **速率限制** 或 **内网 / API Key** 网关（当前仓库未内置鉴权，按需自行加固）。
