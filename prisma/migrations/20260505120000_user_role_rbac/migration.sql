-- Migration: user_role_rbac
-- 为 User 模型增加 role 字段，支持数据库级别的 RBAC。
-- 默认值 'USER'，存量用户迁移后保持普通用户身份。
-- 后续通过 UPDATE "User" SET role = 'ADMIN' WHERE email = '...' 提升管理员，
-- 无需重启服务（下次 session 刷新时自动生效）。

-- 创建 UserRole 枚举
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- 新增 role 列（DEFAULT 'USER' 使存量数据自动填充）
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- 为 role 字段建索引（admin-auth.ts 查询用）
CREATE INDEX "User_role_idx" ON "User"("role");
