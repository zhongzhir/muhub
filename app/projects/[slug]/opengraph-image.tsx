import { ImageResponse } from "next/og";
import { loadProjectPageViewCached } from "@/lib/load-project-page-view";
import { normalizeProjectSlugParam } from "@/lib/route-slug";
import { buildProjectHighlights } from "@/lib/project/project-highlights";
import { buildProjectSummary } from "@/lib/project/project-summary";
import { buildProjectMetaDescription } from "@/lib/seo/project-meta";
import { SITE_URL } from "@/lib/seo/site";

export const runtime = "nodejs";
export const alt = "MUHUB 项目档案";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function buildShareProjectInput(data: {
  description: string;
  tagline?: string;
  tags?: string[];
  githubUrl?: string;
  githubSnapshot?: { stars?: number | null; lastCommitAt?: Date | null } | null;
}) {
  return {
    description: data.description,
    stars: data.githubSnapshot?.stars ?? 0,
    lastCommitAt: data.githubSnapshot?.lastCommitAt ?? null,
    topics: (data.tags ?? []).map((x) => x.toLowerCase()),
    openSource: Boolean(data.githubUrl),
  };
}

function cardShell(title: string, summary: string, highlights: string[], pathLabel: string) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "52px",
        background:
          "linear-gradient(135deg, rgba(12,16,28,1) 0%, rgba(17,24,39,1) 45%, rgba(8,47,73,1) 100%)",
        color: "#f8fafc",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: 24, letterSpacing: "0.04em", color: "#99f6e4" }}>MUHUB</div>
        <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.08 }}>{title}</div>
        <div
          style={{
            fontSize: 30,
            lineHeight: 1.35,
            color: "#d1d5db",
            maxWidth: "1000px",
            display: "block",
          }}
        >
          {summary}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {highlights.length > 0 ? (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {highlights.slice(0, 4).map((h) => (
              <div
                key={h}
                style={{
                  border: "1px solid rgba(148,163,184,.5)",
                  borderRadius: 999,
                  padding: "8px 14px",
                  fontSize: 20,
                  color: "#e2e8f0",
                  background: "rgba(15,23,42,.45)",
                }}
              >
                {h}
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ fontSize: 18, color: "#94a3b8" }}>{pathLabel}</div>
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = normalizeProjectSlugParam((await params).slug);
  const loaded = await loadProjectPageViewCached(slug, null);

  if (!loaded) {
    return new ImageResponse(
      cardShell(
        "MUHUB 项目档案",
        "项目详情暂不可用。请返回 MUHUB 查看更多公开项目。",
        [],
        `${SITE_URL}/projects`,
      ),
      { ...size },
    );
  }

  const { data } = loaded;
  const project = buildShareProjectInput(data);
  const summary =
    buildProjectSummary(project) ||
    data.tagline?.trim() ||
    buildProjectMetaDescription(data);
  const highlights = buildProjectHighlights(project);

  return new ImageResponse(
    cardShell(data.name, summary, highlights, `${SITE_URL}/projects/${slug} · MUHUB 项目档案`),
    { ...size },
  );
}
