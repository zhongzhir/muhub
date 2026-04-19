# 迁移链归档（治理前快照）

本目录为 **`prisma/migrations` 在建立基线前的完整副本**，仅作审计与回滚参考，**不再被 Prisma CLI 读取**。

## 背景

- 线上库曾通过手工 SQL 与部分迁移对齐，`schema.prisma` 为事实来源。
- 历史迁移中存在失败记录（如 `20260430150000_discovery_v2`），`_prisma_migrations` 与仓库迁移链已不可靠。
- 治理后**唯一生效**的迁移目录为：`prisma/migrations/` 下仅保留基线迁移 + `migration_lock.toml`。

## 恢复旧链（仅供紧急回滚）

若需恢复旧目录结构：将本目录下各子目录**移回** `prisma/migrations/`（并移除或移走基线目录），同时恢复当时对应的 `_prisma_migrations` 备份表。**勿在未备份生产 `_prisma_migrations` 时操作。**
