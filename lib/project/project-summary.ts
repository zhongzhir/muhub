type SummaryProjectInput = {
  description?: string | null;
};

export function buildProjectSummary(project: SummaryProjectInput) {
  if (!project.description) return null;

  return project.description.slice(0, 200);
}
