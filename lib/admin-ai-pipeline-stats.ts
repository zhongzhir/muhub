import { prisma } from "@/lib/prisma";
import { buildProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";

export type AiPipelineJobRow = {
  id: string;
  title: string;
  status: string;
  stage: string | null;
  failureKind: string | null;
  error: string | null;
  retryCount: number;
  projectId: string | null;
  updatedAt: string;
};

export type AiPipelineStats = {
  jobs: {
    queued: number;
    success: number;
    failed: number;
    retrying: number;
    infraFailed: number;
  };
  stageDistribution: Record<string, number>;
  recentFailures: AiPipelineJobRow[];
  coverageDistribution: {
    githubMissing: number;
    websiteMissing: number;
    lowEvidence: number;
    sampled: number;
  };
};

function parseMeta(metadataJson: unknown): Record<string, unknown> {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {};
  }
  const root = metadataJson as Record<string, unknown>;
  const meta = root.meta;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

function readText(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(meta: Record<string, unknown>, key: string): number {
  const value = meta[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export async function loadAiPipelineStats(): Promise<AiPipelineStats> {
  const rows = await prisma.discoveryCandidate.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 500,
    select: {
      id: true,
      title: true,
      importStatus: true,
      lastSeenAt: true,
      matchedProjectId: true,
      metadataJson: true,
    },
  });

  const jobs = {
    queued: 0,
    success: 0,
    failed: 0,
    retrying: 0,
    infraFailed: 0,
  };
  const stageDistribution: Record<string, number> = {};
  const recentFailures: AiPipelineJobRow[] = [];

  for (const row of rows) {
    const meta = parseMeta(row.metadataJson);
    const status = readText(meta, "aiEnrichmentStatus");
    if (!status) {
      if (row.importStatus === "IMPORTED") {
        jobs.success += 1;
      }
      continue;
    }
    if (status === "scheduled" || status === "pending") {
      jobs.queued += 1;
    } else if (status === "success") {
      jobs.success += 1;
    } else if (status === "failed") {
      jobs.failed += 1;
    } else if (status === "retrying") {
      jobs.retrying += 1;
    }
    const failureKind = readText(meta, "failureKind");
    if (failureKind === "infra" && (status === "failed" || status === "retrying")) {
      jobs.infraFailed += 1;
    }
    const stage = readText(meta, "aiEnrichmentStage");
    if (stage) {
      const normalized =
        stage === "website_evidence"
          ? "evidence"
          : stage === "ai_insight"
            ? "insight"
            : stage === "ai_content"
              ? "content"
              : stage;
      stageDistribution[normalized] = (stageDistribution[normalized] ?? 0) + 1;
    }
    if (status === "failed" || (status === "retrying" && failureKind)) {
      recentFailures.push({
        id: row.id,
        title: row.title,
        status,
        stage,
        failureKind,
        error: readText(meta, "aiEnrichmentError") ?? readText(meta, "importResultError"),
        retryCount: readNumber(meta, "retryCount"),
        projectId: readText(meta, "importedProjectId") ?? row.matchedProjectId,
        updatedAt: readText(meta, "aiEnrichmentAt") ?? row.lastSeenAt.toISOString(),
      });
    }
  }

  const recentProjects = await prisma.project.findMany({
    where: { deletedAt: null, status: "PUBLISHED", importedFromCandidateId: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 12,
    select: { id: true },
  });

  let githubMissing = 0;
  let websiteMissing = 0;
  let lowEvidence = 0;
  for (const project of recentProjects) {
    const snapshot = await buildProjectEvidenceSnapshot(project.id);
    if (!snapshot) {
      continue;
    }
    if (snapshot.coverage.github === "missing") {
      githubMissing += 1;
    }
    if (snapshot.coverage.website === "missing") {
      websiteMissing += 1;
    }
    if (snapshot.confidence.evidenceCompleteness < 45) {
      lowEvidence += 1;
    }
  }

  return {
    jobs,
    stageDistribution,
    recentFailures: recentFailures.slice(0, 20),
    coverageDistribution: {
      githubMissing,
      websiteMissing,
      lowEvidence,
      sampled: recentProjects.length,
    },
  };
}
