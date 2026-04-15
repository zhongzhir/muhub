# MUHUB Ops Engine V1

`muhub-ops-engine` 是一个独立于 MUHUB 主系统运行的外部内容生产引擎。

它的目标是：读取项目数据，自动生成多渠道传播文案（公众号合集 + X 短帖），落地为本地文件，供人工审核后发布。

## 为什么独立于 MUHUB 主系统

- 避免污染主系统边界，降低耦合风险。
- 便于快速迭代内容策略与提示词，不影响线上主业务。
- 更适合后续扩展到更多外部渠道（如 LinkedIn、Reddit、Newsletter）。

## 项目结构

```text
muhub-ops-engine/
├─ scripts/
│  ├─ run_content_pipeline.js
│  ├─ generate_wechat_post.js
│  └─ generate_x_posts.js
├─ src/
│  ├─ project_selector.js
│  ├─ prompt_builder.js
│  ├─ llm_client.js
│  └─ file_writer.js
├─ inputs/
│  └─ projects.json
├─ outputs/
│  ├─ wechat/
│  ├─ x/
│  └─ drafts/
├─ templates/
│  ├─ wechat_prompt.txt
│  └─ x_prompt.txt
├─ package.json
├─ README.md
└─ .env.example
```

## 输入数据：`inputs/projects.json`

输入为项目数组，每个项目推荐结构：

```json
{
  "name": "CowAgent",
  "slug": "cowagent",
  "summary": "支持多平台接入的 AI 超级助理与数字员工系统。",
  "highlights": ["AI", "Open Source", "Active"],
  "latestActivity": {
    "type": "release",
    "title": "发布新版本 v1.2.0"
  },
  "url": "https://www.muhub.cn/projects/cowagent"
}
```

V1 容错规则：

- 支持字段缺失（空字段不报错）。
- 没有 `latestActivity` 也可生成文案。
- `highlights` 最多取前 4 个。

## 环境变量配置

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

填写：

- `OPENAI_API_KEY`：可选；未配置会自动 fallback 为 prompt 草稿模式。
- `OPENAI_BASE_URL`：可选；用于兼容代理或网关。
- `OPENAI_MODEL`：可选，默认 `gpt-4o-mini`。

## 运行方式

```bash
npm install
npm run gen:all
```

也可以单独运行：

- `npm run gen:wechat`：生成 1 篇公众号合集稿。
- `npm run gen:x`：生成多条 X 短帖。

## 输出位置

- 公众号稿：`outputs/wechat/`
- X 短帖：`outputs/x/`
- fallback prompt 草稿：`outputs/drafts/`

所有输出文件名都带时间戳，便于追踪与人工审核。

## V1 边界（本版不做）

- 不自动发布
- 不接微信公众号 API
- 不接 X/Twitter API
- 不接数据库
- 不做 Web UI
- 不做复杂审核系统
- 不修改 MUHUB 主系统
