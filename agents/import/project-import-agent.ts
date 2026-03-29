import { DiscoveredProject } from "../types"

export async function importProjects(projects: DiscoveredProject[]) {
  for (const project of projects) {
    console.log("Import project:", project.name)
  }
}
