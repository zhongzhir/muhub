import type { InstitutionAdapter } from "@/lib/discovery/institution/institution-adapter";
import type { InstitutionSourceConfig } from "@/lib/discovery/institution/institution-source";
import { articleFeedAdapter } from "@/lib/discovery/institution/adapters/article-feed-adapter";
import { linkDirectoryAdapter } from "@/lib/discovery/institution/adapters/link-directory-adapter";
import { manualSeedAdapter } from "@/lib/discovery/institution/adapters/manual-seed-adapter";
import { websiteListAdapter } from "@/lib/discovery/institution/adapters/website-list-adapter";

/** 顺序：先匹配更具体的 mode */
const INSTITUTION_ADAPTERS_ORDERED: InstitutionAdapter[] = [
  manualSeedAdapter,
  articleFeedAdapter,
  linkDirectoryAdapter,
  websiteListAdapter,
];

export function resolveInstitutionAdapter(config: InstitutionSourceConfig): InstitutionAdapter {
  for (const a of INSTITUTION_ADAPTERS_ORDERED) {
    if (a.match(config)) {
      return a;
    }
  }
  throw new Error(`No institution adapter for mode=${config.mode}`);
}

export function listInstitutionAdapterKeys(): string[] {
  return INSTITUTION_ADAPTERS_ORDERED.map((a) => a.key);
}
