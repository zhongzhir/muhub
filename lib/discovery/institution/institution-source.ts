import type { InstitutionManualSeedItem, InstitutionSourceMode } from "@/lib/discovery/institution/types";

/**
 * 嵌在 DiscoverySource.configJson 的机构配置（与表字段 institution* 互补）
 */
export type InstitutionSourceConfig = {
  id: string;
  name: string;
  /** 列表页 / RSS / 占位 URL；manual_seed 可为空串，以 seedItems 为准 */
  url: string;
  mode: InstitutionSourceMode;
  type?: string;
  region?: string;
  /** manual_seed：直接生成候选，便于测试与人工导入桥接 */
  seedItems?: InstitutionManualSeedItem[];
};
