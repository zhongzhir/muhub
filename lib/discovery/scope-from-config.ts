import {
  mergeDiscoveryScopes,
  scopesFromLegacyIndustry,
  type DiscoveryScope,
} from "@/lib/discovery/discovery-scopes";

export function parseScopesFromConfigJson(configJson: unknown): DiscoveryScope[] {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return [];
  }
  const cfg = configJson as Record<string, unknown>;
  const fromScopes = cfg.scopes;
  const fromIndustry = scopesFromLegacyIndustry(cfg.industry);
  return mergeDiscoveryScopes(fromScopes, fromIndustry);
}

export function metadataDiscoveryScopes(metadataJson: unknown): DiscoveryScope[] {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return [];
  }
  const meta = metadataJson as Record<string, unknown>;
  return mergeDiscoveryScopes(meta.discoveryScopes);
}

export function attachDiscoveryScopesToMetadata(
  metadataJson: unknown,
  scopes: DiscoveryScope[],
): Record<string, unknown> {
  const base =
    metadataJson && typeof metadataJson === "object" && !Array.isArray(metadataJson)
      ? { ...(metadataJson as Record<string, unknown>) }
      : {};
  return {
    ...base,
    discoveryScopes: mergeDiscoveryScopes(base.discoveryScopes, scopes),
  };
}
