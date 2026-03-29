import { DiscoveredProject } from "../types"

export async function discoverGithubCN(): Promise<DiscoveredProject[]> {
  return [
    {
      name: "Example AI Project",
      description: "AI 项目示例",
      url: "https://github.com/example/project",
      tags: ["AI"],
      source: "github",
      sourceType: "cn",
    },
  ]
}
