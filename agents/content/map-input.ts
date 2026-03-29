/**
 * Growth / 站外发现数据 → Content Agent 输入。
 * 站内 Prisma Project 映射可在后续按需增加（避免引入 ORM 类型耦合）。
 */

import type { DiscoveredProject } from "../types"
import type { ContentProjectInput } from "./content-types"

export function mapDiscoveredProjectToContentInput(d: DiscoveredProject): ContentProjectInput {
  const out: ContentProjectInput = {
    name: d.name,
    description: d.description,
    tags: d.tags,
    sourceType: d.sourceType,
  }
  const u = d.url?.trim()
  if (!u) {
    return out
  }
  if (/github\.com/i.test(u)) {
    out.githubUrl = u
  } else {
    out.websiteUrl = u
  }
  return out
}
