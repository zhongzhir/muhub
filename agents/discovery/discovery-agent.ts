/**
 * Discovery 轻量入口：生成 id / 时间戳并写入本地队列；后续可接 RSS、API 等。
 */

import { randomUUID } from "crypto";

import type { DiscoveryItem } from "./discovery-types";
import { appendDiscoveryItem, findDiscoveryItemByUrl } from "./discovery-store";

export async function createDiscoveryItem(
  input: Omit<DiscoveryItem, "id" | "status" | "createdAt">,
): Promise<DiscoveryItem> {
  const existing = await findDiscoveryItemByUrl(input.url);
  if (existing) {
    return existing;
  }
  const item: DiscoveryItem = {
    ...input,
    id: randomUUID(),
    status: "new",
    createdAt: new Date().toISOString(),
  };
  const { duplicate } = await appendDiscoveryItem(item);
  if (duplicate) {
    const again = await findDiscoveryItemByUrl(input.url);
    if (again) {
      return again;
    }
  }
  return item;
}
