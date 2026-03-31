-- Extend ProjectSourceKind for multi-source / ops links (Chinese platforms + Discord + OTHER).
-- Runs after 20260403120000_project_sources, which creates the enum.
ALTER TYPE "ProjectSourceKind" ADD VALUE 'WECHAT';
ALTER TYPE "ProjectSourceKind" ADD VALUE 'XIAOHONGSHU';
ALTER TYPE "ProjectSourceKind" ADD VALUE 'DOUYIN';
ALTER TYPE "ProjectSourceKind" ADD VALUE 'ZHIHU';
ALTER TYPE "ProjectSourceKind" ADD VALUE 'BILIBILI';
ALTER TYPE "ProjectSourceKind" ADD VALUE 'DISCORD';
ALTER TYPE "ProjectSourceKind" ADD VALUE 'OTHER';
