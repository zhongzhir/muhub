type HighlightProjectInput = {
  stars?: number | null;
  lastCommitAt?: string | Date | null;
  topics?: string[] | null;
  openSource?: boolean | null;
};

export function buildProjectHighlights(project: HighlightProjectInput) {
  const highlights: string[] = [];

  if ((project.stars ?? 0) > 1000) {
    highlights.push("热门项目");
  }

  if (project.lastCommitAt) {
    highlights.push("活跃项目");
  }

  if (project.topics?.includes("ai")) {
    highlights.push("AI");
  }

  if (project.topics?.includes("rag")) {
    highlights.push("RAG");
  }

  if (project.openSource) {
    highlights.push("开源项目");
  }

  return highlights;
}
