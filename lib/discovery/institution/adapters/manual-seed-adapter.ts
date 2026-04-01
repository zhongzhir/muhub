import type { InstitutionAdapter } from "@/lib/discovery/institution/institution-adapter";
import type { InstitutionParsedItem } from "@/lib/discovery/institution/types";

export const manualSeedAdapter: InstitutionAdapter = {
  key: "manual_seed",

  match(config) {
    return config.mode === "manual_seed";
  },

  async fetch() {
    return { ok: true, skippedFetch: true, meta: { reason: "manual_seed" } };
  },

  parse(_ok, config) {
    if (!config.seedItems?.length) {
      return [];
    }
    return config.seedItems.map((s): InstitutionParsedItem => {
      const url = s.website?.trim() || s.externalUrl?.trim() || "";
      return {
        title: s.title,
        summary: s.summary,
        website: s.website?.trim() || url || undefined,
        externalUrl: s.externalUrl?.trim() || s.website?.trim() || undefined,
        metadata: {
          ...s.metadata,
          entryKind: "manual_seed",
        },
      };
    });
  },
};
