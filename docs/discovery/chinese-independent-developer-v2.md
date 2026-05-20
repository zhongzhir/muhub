# chinese-independent-developer V2

## 为什么只收录主板（README.md）

中国独立开发者项目列表仓库包含三个版本：

| 文件 | 说明 | V2 默认策略 |
|------|------|-------------|
| `README.md` | 主板，覆盖最广的独立开发者项目 | **默认收录** |
| `README-Programmer-Edition.md` | 程序员版 | 仅 `EDITION=programmer` 显式指定 |
| `README-Game.md` | 游戏版 | 仅 `EDITION=game` 显式指定 |

MUHUB 将主板作为**高质量可信来源**的默认入口：信息较完整、与广场类目更匹配，且便于统一审核标准。

程序员版 / 游戏版**暂不进入默认自动上架**，避免与主板重复、类目混杂，待运营规则明确后再单独开放。

## 自动上架前必须 AI enrichment

V2 自动上架（`AUTO_IMPORT=1`）在创建正式 Project 前，必须完成 evidence-first AI enrichment：

1. 官网抓取 evidence（reachable、title、description 等）
2. curated repository 原始 markdown
3. GitHub README / repo info（如有）
4. 生成并写入：一句话简介、项目简介、详细介绍、分类、标签
5. 生成 AI 认知卡
6. 生成 AI 增强版项目详情

**全部成功**才计入 `imported`；否则回滚 Project（软删除），队列项标记 `needsReview`。

## AI 失败进入人工审核

AI enrichment 失败时：

- 不保留正式 Project（软删除）
- JSON 队列项保留，`meta.aiEnrichmentStatus = "failed"`
- `meta.aiEnrichmentError` 记录原因
- `meta.needsReview = true`
- 状态回写为 `reviewed`，等待 `/admin/discovery/items` 人工处理

## 自动上架条件（V2）

仅 `edition=main` 且同时满足：

- `originalStatus = ONLINE`
- 有 `websiteUrl` 或 `githubUrl`
- 非 duplicate
- `description.length >= 10`
- AI enrichment 全部成功（简介、分类、标签、详细介绍、认知卡、增强版）

## 产品原则

- **只结构化呈现**，不推荐、不评级、不做投资判断
- 禁止「值得推荐」「潜力巨大」「领先」等主观表述
- 信息不足时使用「当前公开信息有限」等保守措辞

## CLI 用法

```bash
# 默认：仅主板
pnpm run discovery:chinese-indie

# 预检
DRY_RUN=1 pnpm run discovery:chinese-indie

# 小批量入队
LIMIT=50 pnpm run discovery:chinese-indie

# 跳过头部 duplicate，选取中间批次
OFFSET=100 LIMIT=20 pnpm run discovery:chinese-indie

# 小批量自动上架（需 AI 成功）
AUTO_IMPORT=1 LIMIT=20 pnpm run discovery:chinese-indie
AUTO_IMPORT=1 OFFSET=100 LIMIT=5 pnpm run discovery:chinese-indie

# 程序员版 / 游戏版（须显式指定，不自动上架）
EDITION=programmer DRY_RUN=1 pnpm run discovery:chinese-indie
EDITION=game DRY_RUN=1 pnpm run discovery:chinese-indie
```

## 后台操作

- **预检中国独立开发者主板项目**：`DRY_RUN=1, edition=main`
- **同步中国独立开发者主板项目**：入队，不自动导入
- **自动上架主板项目（需 AI 增强成功）**：`AUTO_IMPORT=1, edition=main`
