/**
 * V1：批量导入代理仍为控制台占位；CLI `pnpm growth` 与编排器统计用。
 * 与 Dashboard「导入外部项目」的真实写库路径独立，后者走 createProject。
 */
import type { DiscoveredProject } from "../types"

export async function importProjects(projects: DiscoveredProject[]) {
  for (const project of projects) {
    console.log("Import project:", project.name)
  }
}
