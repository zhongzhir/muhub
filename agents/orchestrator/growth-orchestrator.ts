import { importProjects } from "../import/project-import-agent"
import { getEnabledProjectSources } from "../sources/source-registry"
import type { DiscoveredProject } from "../types"
import { DISCOVERY_HANDLERS } from "./discovery-registry"

export async function runGrowth() {
  const enabled = getEnabledProjectSources()
  const allProjects: DiscoveredProject[] = []

  for (const src of enabled) {
    const handler = DISCOVERY_HANDLERS[src.id]
    if (!handler) {
      console.log(`[growth] skipped source: ${src.id} (no discovery handler yet)`)
      continue
    }
    console.log(`[growth] running source: ${src.id}`)
    try {
      const batch = await handler()
      allProjects.push(...batch)
    } catch (e) {
      console.error(`[growth] source failed: ${src.id}`, e)
    }
  }

  const discoveredCount = allProjects.length
  await importProjects(allProjects)
  console.log(`[growth] summary: discovered=${discoveredCount}, import_processed=${discoveredCount}`)
  console.log("[growth] Growth run completed")
}
