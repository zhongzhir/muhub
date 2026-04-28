import { parseProjectSourceUrl } from "@/lib/project-source-url";

/**
 * 从候选跳转至创建项目页，复用 query 预填（与 {@link resolveNewProjectPrefill} 对齐）。
 */
export function buildDiscoveryImportPath(candidate: {
  id: string;
  name: string;
  description: string | null;
  repoUrl: string;
  homepageUrl: string | null;
}): string {
  const desc = candidate.description ?? "";
  const tagline = desc.slice(0, 280);
  const description = desc.slice(0, 2000);
  const p = new URLSearchParams();
  p.set("name", candidate.name);
  p.set("tagline", tagline);
  p.set("description", description);
  const source = parseProjectSourceUrl(candidate.repoUrl);
  if (source?.type === "GITCC") {
    p.set("extraSourcesJson", JSON.stringify([{ kind: "OTHER", url: source.url, label: "GitCC" }]));
  } else {
    p.set("githubUrl", candidate.repoUrl);
  }
  if (candidate.homepageUrl?.trim()) {
    p.set("websiteUrl", candidate.homepageUrl.trim());
  }
  p.set("creationSource", "import");
  p.set("from", "discovery");
  p.set("discoveryCandidateId", candidate.id);
  return `/dashboard/projects/new?${p.toString()}`;
}
