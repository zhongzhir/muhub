/**
 * Discovery 轻量入口：生成 id / 时间戳并写入本地队列；后续可接 RSS、API 等。
 */

import { randomUUID } from "crypto";

import type { DiscoveryItem } from "./discovery-types";
import { appendDiscoveryItem, readDiscoveryItems } from "./discovery-store";
import {
  buildDiscoveryDedupeFields,
  findPossibleDuplicateByTitle,
  findStrongDuplicateItem,
} from "./discovery-dedupe";

export async function createDiscoveryItem(
  input: Omit<DiscoveryItem, "id" | "status" | "createdAt">,
): Promise<DiscoveryItem> {
  const list = await readDiscoveryItems();
  const enrichedInput = { ...input, ...buildDiscoveryDedupeFields(input) };
  const strongDup = findStrongDuplicateItem(list, enrichedInput);
  if (strongDup) {
    return strongDup;
  }
  const weakDup = findPossibleDuplicateByTitle(list, input);
  const item: DiscoveryItem = {
    ...enrichedInput,
    id: randomUUID(),
    status: "new",
    createdAt: new Date().toISOString(),
    possibleDuplicate: weakDup ? true : input.possibleDuplicate,
  };
  const { duplicate } = await appendDiscoveryItem(item);
  if (duplicate) {
    const againList = await readDiscoveryItems();
    const again = findStrongDuplicateItem(againList, enrichedInput);
    if (again) {
      return again;
    }
  }
  return item;
}
