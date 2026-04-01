-- Discovery V2：审核状态增加 IGNORED（批量忽略 / 运营清理）

ALTER TYPE "DiscoveryReviewStatus" ADD VALUE 'IGNORED';
