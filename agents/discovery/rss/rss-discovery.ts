import Parser from "rss-parser";

import { createDiscoveryItem } from "../discovery-agent";
import type { DiscoverySourceType } from "../discovery-types";
import { rssSources } from "./rss-sources";

const parser = new Parser();

function safeText(input: string | undefined): string {
  return (input ?? "").trim();
}

export async function runRssDiscovery(): Promise<void> {
  for (const source of rssSources) {
    try {
      const feed = await parser.parseURL(source.url);
      let inserted = 0;

      for (const item of feed.items.slice(0, 5)) {
        const title = safeText(item.title);
        const url = safeText(item.link);
        if (!title || !url) {
          continue;
        }

        await createDiscoveryItem({
          sourceType: source.sourceType as DiscoverySourceType,
          title,
          url,
          description: safeText(item.contentSnippet) || undefined,
        });
        inserted += 1;
      }

      console.log(`[RSS] parsed ${source.name} (inserted: ${inserted})`);
    } catch (err) {
      console.error(`[RSS] error ${source.name}`, err);
    }
  }
}
