import { createDiscoveryItem } from "../discovery-agent";
import { findDiscoveryItemByUrl } from "../discovery-store";
import type { DiscoveryItem } from "../discovery-types";
import {
  buildGitHubDiscoveryDescription,
  buildGitHubDiscoveryTitle,
  parseGitHubRepoRef,
} from "./github-utils";

export async function createDiscoveryItemFromGitHubUrl(url: string): Promise<DiscoveryItem> {
  const ref = parseGitHubRepoRef(url);
  if (!ref) {
    throw new Error(`Invalid GitHub repo URL: ${url}`);
  }
  return createDiscoveryItem({
    sourceType: "github",
    title: buildGitHubDiscoveryTitle(ref),
    url: ref.url,
    description: buildGitHubDiscoveryDescription(ref),
  });
}

export async function runGitHubBatchDiscovery(urls: string[]): Promise<{
  total: number;
  inserted: number;
  skipped: number;
  invalid: number;
}> {
  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  for (const raw of urls) {
    const input = raw.trim();
    if (!input) {
      invalid += 1;
      console.warn("[GitHub Discovery] invalid: (empty)");
      continue;
    }
    try {
      const ref = parseGitHubRepoRef(input);
      if (!ref) {
        invalid += 1;
        console.warn(`[GitHub Discovery] invalid: ${input}`);
        continue;
      }

      const exists = await findDiscoveryItemByUrl(ref.url);
      if (exists) {
        skipped += 1;
        console.log(`[GitHub Discovery] skipped (duplicate): ${ref.url}`);
        continue;
      }

      await createDiscoveryItemFromGitHubUrl(ref.url);
      inserted += 1;
      console.log(`[GitHub Discovery] inserted: ${ref.url}`);
    } catch (e) {
      invalid += 1;
      console.error(`[GitHub Discovery] invalid/error: ${input}`, e);
    }
  }

  return { total: urls.length, inserted, skipped, invalid };
}
