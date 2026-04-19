# Prisma 迁移治理说明（基线重建）

## 1. 根因总结

| 现象 | 说明 |
|------|------|
| 迁移链断裂 | `20260430150000_discovery_v2` 等迁移在线上失败或部分执行后，库结构由手工补齐，与「迁移文件假设的线性历史」不一致。 |
| `_prisma_migrations` 漂移 | 表中记录与仓库 `prisma/migrations` 目录内容、顺序或校验和不一致时，`prisma migrate deploy` 会拒绝继续或反复报错。 |
| 无法「无脑 deploy」 | 继续沿用旧链会尝试重跑已存在对象上的 DDL，或卡在失败记录上，风险高于一次性基线治理。 |

**结论**：以当前 `schema.prisma`（与线上一致）为源，生成**单条基线迁移**（全量 DDL），归档旧迁移目录；线上**清空迁移历史表后标记基线为已应用**，后续只追加新迁移。

---

## 2. 三者关系（治理后）

```text
schema.prisma          ← 唯一契约（与线上一致，由团队维护）
       ↓
prisma/migrations/
  └── 20260419120000_baseline_after_manual_schema_alignment/migration.sql
       （从空库 diff 出的完整 DDL；新环境 deploy 时执行）
       ↓
线上 PostgreSQL._prisma_migrations
       （仅保留「基线 + 之后」的记录；治理后从基线行开始续写）
```

**归档目录** `prisma/archived/migrations_pre_baseline_20260419/`：旧迁移的**只读备份**，Prisma **不读取**。

---

## 3. 与线上一致性核对（重点字段）

以下以 **`prisma migrate diff --from-empty --to-schema-datamodel`** 生成的基线 SQL 为准，与 `schema.prisma` 一致（若线上曾用手工改列名/类型，需先 `db pull` 对齐 schema 再重新生成基线 SQL）。

| 对象 | 仓库 / 基线 SQL 中的定义 |
|------|-------------------------|
| `ProjectStatus` | `DRAFT`, `READY`, `PUBLISHED`, `ARCHIVED` |
| `Project.visibilityStatus` | `ProjectVisibilityStatus`，默认 `DRAFT` |
| `Project.isPublic` | `BOOLEAN`，默认 `false` |
| `Project.publishedAt` | `TIMESTAMP(3)`，可空 |
| `Project.status` | `ProjectStatus`，默认 `DRAFT` |
| `DiscoveryCandidate.status` | `DiscoveryCandidateStatus`，默认 `PENDING` |
| `DiscoveryCandidateStatus` | `PENDING`, `APPROVED`, `REJECTED`, `MERGED` |

**如何做「与线上一致」的最终确认（人工）**

```bash
# 指向只读线上或 staging（勿对生产写）
export DATABASE_URL="postgresql://..."

npx prisma db pull --print
# 与 prisma/schema.prisma 做 diff；若有差异，先改 schema.prisma，再重新生成基线：
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script -o prisma/migrations/20260419120000_baseline_after_manual_schema_alignment/migration.sql
```

若 `db pull` 与当前 `schema.prisma` 无实质差异：**差异清单为空**，无需改 schema。

---

## 4. 治理方案（明确动作）

### 4.1 仓库侧（已完成或可复现）

1. 旧迁移整体移至 `prisma/archived/migrations_pre_baseline_20260419/`（含失败链全部 SQL）。
2. `prisma/migrations/` 仅保留：
   - `migration_lock.toml`
   - `20260419120000_baseline_after_manual_schema_alignment/migration.sql`（全量建库脚本）。
3. **不再修补**归档目录内任何文件（冻结）。

### 4.2 线上侧（必须由 DBA / 运维执行）

**前置**：备份数据库；单独备份表 `_prisma_migrations`（`pg_dump -t '_prisma_migrations'` 或 `COPY ... TO`）。

**步骤 A — 处理失败迁移记录**

- 若 `_prisma_migrations` 中 `20260430150000_discovery_v2` 为 **失败** 状态：在清空整表前会一并删除，**无需**单独执行 `migrate resolve`。
- 若团队选择**不**清空整表、仅删失败行：可 `DELETE FROM "_prisma_migrations" WHERE migration_name = '20260430150000_discovery_v2';` 再继续与平台约定是否删其余行（不推荐部分删除，易与本地旧链再次不一致）。

**步骤 B — 与仓库新链对齐（推荐：清空后标记基线）**

1. 确认当前库结构已与 `schema.prisma` 一致（业务已验证）。
2. 在维护窗口执行（示例，**慎用**）：

```sql
BEGIN;
-- 仅在有完整备份后执行
DELETE FROM "_prisma_migrations";
COMMIT;
```

3. 使用与线上一致的 `DATABASE_URL`：

```bash
npx prisma migrate resolve --applied 20260419120000_baseline_after_manual_schema_alignment
```

该命令**不会**执行 `migration.sql`，仅在 `_prisma_migrations` 插入「基线已应用」记录。

4. 之后新变更：`npx prisma migrate dev` 生成新目录 → 发布时 `npx prisma migrate deploy` 仅执行基线之后的迁移。

### 4.3 新空环境（CI / 新实例）

直接 `npx prisma migrate deploy`：会执行基线 SQL，从空库建全表（与当前 `schema.prisma` 一致）。

---

## 5. 修改文件清单（治理提交预期）

| 路径 | 说明 |
|------|------|
| `prisma/migrations/20260419120000_baseline_after_manual_schema_alignment/migration.sql` | 基线全量 DDL |
| `prisma/migrations/migration_lock.toml` | 保留 |
| `prisma/archived/migrations_pre_baseline_20260419/**` | 旧迁移备份 + README |
| `docs/prisma-migration-governance.md` | 本文档 |

---

## 6. 迁移目录结构（治理后）

```text
prisma/
  migrations/
    migration_lock.toml
    20260419120000_baseline_after_manual_schema_alignment/
      migration.sql
  archived/
    migrations_pre_baseline_20260419/
      README.md
      20260324120000_init/
      ...（历史迁移目录）
```

---

## 7. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 误删 `_prisma_migrations` 且无备份 | **必须先备份**再执行 `DELETE`。 |
| 线上库与 `schema.prisma` 仍不一致 | 治理前用 `db pull` 比对；先修 schema 再生成基线 SQL。 |
| 多环境未同步执行 | 每个环境独立执行「清空迁移表 + resolve 基线」；staging 先走一遍。 |

**回滚**：从备份恢复 `_prisma_migrations` 表；将 `prisma/migrations/` 恢复为归档目录内容（移回旧文件夹并移除基线目录），回到旧链（仍可能再次遇到失败迁移问题，仅作应急）。

---

## 8. 本轮明确不做

- 不修改业务代码、admin 路由与发现逻辑。
- 不在无备份情况下删除 `prisma/archived/`。
- 不在本文档外「顺手」重命名模型或大范围格式化。
