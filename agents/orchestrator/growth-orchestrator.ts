import { discoverGithubCN } from "../discovery/github-cn"
import { discoverGitee } from "../discovery/gitee"
import { discoverManual } from "../discovery/manual"
import { discoverV2EX } from "../discovery/v2ex"

import { importProjects } from "../import/project-import-agent"

export async function runGrowth() {
  const sources = await Promise.all([
    discoverGithubCN(),
    discoverGitee(),
    discoverV2EX(),
    discoverManual(),
  ])

  const projects = sources.flat()

  await importProjects(projects)

  console.log("Growth run completed")
}
