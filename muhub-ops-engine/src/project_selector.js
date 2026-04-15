function normalizeProject(project, index) {
  const safeProject = project && typeof project === "object" ? project : {};
  const highlights = Array.isArray(safeProject.highlights)
    ? safeProject.highlights.filter(Boolean).slice(0, 4)
    : [];

  return {
    name: typeof safeProject.name === "string" ? safeProject.name.trim() : "",
    slug: typeof safeProject.slug === "string" ? safeProject.slug.trim() : `project-${index + 1}`,
    summary: typeof safeProject.summary === "string" ? safeProject.summary.trim() : "",
    highlights,
    latestActivity:
      safeProject.latestActivity && typeof safeProject.latestActivity === "object"
        ? {
            type:
              typeof safeProject.latestActivity.type === "string"
                ? safeProject.latestActivity.type.trim()
                : "",
            title:
              typeof safeProject.latestActivity.title === "string"
                ? safeProject.latestActivity.title.trim()
                : ""
          }
        : null,
    url: typeof safeProject.url === "string" ? safeProject.url.trim() : ""
  };
}

function scoreProject(project) {
  let score = 0;

  if (project.latestActivity && (project.latestActivity.title || project.latestActivity.type)) {
    score += 100;
  }
  if (project.summary) {
    score += 50;
  }
  score += project.highlights.length;

  return score;
}

function selectProjects(projects, limit) {
  const normalized = Array.isArray(projects) ? projects.map((p, i) => normalizeProject(p, i)) : [];
  const indexed = normalized.map((project, index) => ({ project, index }));

  return indexed
    .sort((a, b) => {
      const scoreDiff = scoreProject(b.project) - scoreProject(a.project);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.index - b.index;
    })
    .slice(0, Math.max(0, limit))
    .map((row) => row.project);
}

function selectProjectsForWechat(projects, limit = 3) {
  return selectProjects(projects, limit);
}

function selectProjectsForX(projects, limit = 5) {
  return selectProjects(projects, limit);
}

module.exports = {
  selectProjectsForWechat,
  selectProjectsForX
};
