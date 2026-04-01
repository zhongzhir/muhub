/**
 * 机构目录单条配置（通常嵌在 DiscoverySource.configJson 内，或与其字段互为补充）
 */
export type InstitutionSourceConfig = {
  id: string;
  name: string;
  url: string;
  type?: string;
  region?: string;
};
