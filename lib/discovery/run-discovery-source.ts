import { prisma } from "@/lib/prisma";
import { ensureDiscoveryDefaultSources } from "@/lib/discovery/seed-default-sources";
import { fetchGithubRepositoriesByTopic } from "@/lib/discovery/github/search-repos";
import { mapGithubSearchItemToCandidatePayload } from "@/lib/discovery/map-github-search-item";
import {
  fetchGithubTrendingHtml,
  parseTrendingRepoFullNamesFromHtml,
} from "@/lib/discovery/github/trending-html";
import { fetchGithubRepoFull } from "@/lib/discovery/github/repo-api";
import { mapGithubRepoToCandidatePayload } from "@/lib/discovery/map-github-repo";
import { upsertGithubDiscoveryCandidate } from "@/lib/discovery/upsert-candidate";
import { fetchProductHuntFeatured } from "@/lib/discovery/producthunt/fetch-featured";
import { fetchProductHuntTopicPosts } from "@/lib/discovery/producthunt/fetch-ai-products";
import { mapProductHuntItemToCandidatePayload } from "@/lib/discovery/producthunt/map-producthunt-item";
import { upsertProductHuntDiscoveryCandidate } from "@/lib/discovery/upsert-producthunt-candidate";
import type { Prisma } from "@prisma/client";

export type RunDiscoverySourceSummary = {
  runId: string;
  ok: boolean;
  logs: string[];
  error?: string;
  fetchedCount: number;
  parsedCount: number;
  newCandidateCount: number;
  updatedCandidateCount: number;
};

type FinishArgs = {
  runId: string;
  sourceId: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  logs: string[];
  fetchedCount: number;
  parsedCount: number;
  newCandidateCount: number;
  updatedCandidateCount: number;
  errorMessage?: string | null;
};

async function finalizeDiscoveryRun(args: FinishArgs): Promise<void> {
  const {
    runId,
    sourceId,
    status,
    logs,
    fetchedCount,
    parsedCount,
    newCandidateCount,
    updatedCandidateCount,
    errorMessage,
  } = args;

  await prisma.discoveryRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      fetchedCount,
      parsedCount,
      newCandidateCount,
      updatedCandidateCount,
      errorMessage: errorMessage ?? null,
      logJson: logs as unknown as Prisma.InputJsonValue,
    },
  });

  const errMsg =
    status === "FAILED" || status === "PARTIAL"
      ? (errorMessage?.trim() || logs.filter((l) => l.includes("error") || l.includes("ERROR")).at(-1) || (status === "PARTIAL" ? "Partial success" : "Run failed"))
      : null;

  await prisma.discoverySource.update({
    where: { id: sourceId },
    data: {
      lastRunAt: new Date(),
      ...(status === "SUCCESS"
        ? {
            lastSuccessAt: new Date(),
            lastErrorAt: null,
            lastErrorMessage: null,
          }
        : {
            lastErrorAt: new Date(),
            lastErrorMessage: errMsg,
          }),
    },
  });

}

export async function runDiscoverySourceByKey(key: string): Promise<RunDiscoverySourceSummary> {
  await ensureDiscoveryDefaultSources();

  const empty = (): Omit<RunDiscoverySourceSummary, "runId"> => ({
    ok: false,
    logs: [],
    error: undefined,
    fetchedCount: 0,
    parsedCount: 0,
    newCandidateCount: 0,
    updatedCandidateCount: 0,
  });

  if (!process.env.DATABASE_URL?.trim()) {
    return { runId: "", ...empty(), error: "DATABASE_URL 未配置" };
  }

  const source = await prisma.discoverySource.findUnique({ where: { key } });
  if (!source) {
    return { runId: "", ...empty(), error: `Unknown discovery source: ${key}` };
  }

  const run = await prisma.discoveryRun.create({
    data: {
      sourceId: source.id,
      status: "RUNNING",
      logJson: [],
    },
  });

  const logs: string[] = [`[${key}] run ${run.id} started`];
  let fetchedCount = 0;
  let parsedCount = 0;
  let newCandidateCount = 0;
  let updatedCandidateCount = 0;

  if (source.status !== "ACTIVE") {
    const msg = `Source ${key} is not ACTIVE (status=${source.status})`;
    logs.push(`[${key}] ${msg}`);
    await finalizeDiscoveryRun({
      runId: run.id,
      sourceId: source.id,
      status: "FAILED",
      logs,
      fetchedCount: 0,
      parsedCount: 0,
      newCandidateCount: 0,
      updatedCandidateCount: 0,
      errorMessage: msg,
    });
    return {
      runId: run.id,
      ok: false,
      logs,
      error: msg,
      fetchedCount: 0,
      parsedCount: 0,
      newCandidateCount: 0,
      updatedCandidateCount: 0,
    };
  }

  try {
    if (source.type === "GITHUB" && source.subtype === "topic") {
      const config = source.configJson as {
        topics?: string[];
        perPage?: number;
        sort?: "stars" | "updated";
      } | null;
      const topics = Array.isArray(config?.topics) ? config!.topics : [];
      const perPage = typeof config?.perPage === "number" ? config!.perPage : 30;
      const sort = config?.sort === "updated" ? "updated" : "stars";

      let topicErrors = 0;
      for (const topic of topics) {
        const res = await fetchGithubRepositoriesByTopic(topic, { sort, perPage });
        if (!res.ok) {
          topicErrors += 1;
          logs.push(`[${key}] topic=${topic} error=${res.error}`);
          continue;
        }
        fetchedCount += res.items.length;
        for (const it of res.items) {
          const payload = mapGithubSearchItemToCandidatePayload(it);
          if (!payload) {
            continue;
          }
          parsedCount += 1;
          const up = await upsertGithubDiscoveryCandidate(prisma, {
            sourceId: source.id,
            sourceKey: source.key,
            runId: run.id,
            payload,
            mode: "full",
          });
          if (up.created) {
            newCandidateCount += 1;
          } else {
            updatedCandidateCount += 1;
          }
        }
      }

      const status =
        topicErrors > 0 && topics.length > 0 && topicErrors === topics.length
          ? "FAILED"
          : topicErrors > 0
            ? "PARTIAL"
            : "SUCCESS";

      const errMsg =
        status === "FAILED"
          ? "All topic fetches failed"
          : status === "PARTIAL"
            ? "Partial topic failures"
            : null;

      await finalizeDiscoveryRun({
        runId: run.id,
        sourceId: source.id,
        status,
        logs: [...logs, `[${key}] done status=${status}`],
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
        errorMessage: errMsg,
      });

      return {
        runId: run.id,
        ok: status !== "FAILED",
        logs,
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
        error: status === "FAILED" ? errMsg ?? undefined : undefined,
      };
    }

    if (source.type === "PRODUCTHUNT" && source.subtype === "featured") {
      const config = source.configJson as {
        postCount?: number;
        order?: "RANKING" | "VOTES" | "NEWEST" | "FEATURED_AT";
        featuredOnly?: boolean;
      } | null;
      const postCount =
        typeof config?.postCount === "number"
          ? Math.min(50, Math.max(1, config.postCount))
          : 20;
      const orderRaw = config?.order;
      const order =
        orderRaw === "VOTES" ||
        orderRaw === "NEWEST" ||
        orderRaw === "FEATURED_AT" ||
        orderRaw === "RANKING"
          ? orderRaw
          : "RANKING";
      const featuredOnly =
        typeof config?.featuredOnly === "boolean" ? config.featuredOnly : undefined;

      const phRes = await fetchProductHuntFeatured({
        first: postCount,
        order,
        featuredOnly,
      });
      if (!phRes.ok) {
        throw new Error(phRes.error);
      }
      fetchedCount = phRes.posts.length;

      for (const node of phRes.posts) {
        const payload = mapProductHuntItemToCandidatePayload(node, source.key);
        if (!payload) {
          continue;
        }
        parsedCount += 1;
        const up = await upsertProductHuntDiscoveryCandidate(prisma, {
          sourceId: source.id,
          sourceKey: source.key,
          runId: run.id,
          payload,
        });
        if (up.created) {
          newCandidateCount += 1;
        } else {
          updatedCandidateCount += 1;
        }
      }

      await finalizeDiscoveryRun({
        runId: run.id,
        sourceId: source.id,
        status: "SUCCESS",
        logs: [...logs, `[${key}] Product Hunt featured done posts=${parsedCount}`],
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
        errorMessage: null,
      });

      return {
        runId: run.id,
        ok: true,
        logs,
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
      };
    }

    if (source.type === "PRODUCTHUNT" && source.subtype === "topic") {
      const config = source.configJson as {
        topicSlug?: string;
        postCount?: number;
        order?: "RANKING" | "VOTES" | "NEWEST" | "FEATURED_AT";
      } | null;
      const topicSlug =
        typeof config?.topicSlug === "string" && config.topicSlug.trim()
          ? config.topicSlug.trim()
          : "artificial-intelligence";
      const postCount =
        typeof config?.postCount === "number"
          ? Math.min(50, Math.max(1, config.postCount))
          : 20;

      const orderRaw = config?.order;
      const topicOrder =
        orderRaw === "VOTES" ||
        orderRaw === "NEWEST" ||
        orderRaw === "FEATURED_AT" ||
        orderRaw === "RANKING"
          ? orderRaw
          : "RANKING";
      const phRes = await fetchProductHuntTopicPosts({
        topicSlug,
        first: postCount,
        order: topicOrder,
      });
      if (!phRes.ok) {
        throw new Error(phRes.error);
      }
      fetchedCount = phRes.posts.length;
      logs.push(`[${key}] topic=${topicSlug} posts=${phRes.posts.length}`);

      for (const node of phRes.posts) {
        const payload = mapProductHuntItemToCandidatePayload(node, source.key);
        if (!payload) {
          continue;
        }
        parsedCount += 1;
        const up = await upsertProductHuntDiscoveryCandidate(prisma, {
          sourceId: source.id,
          sourceKey: source.key,
          runId: run.id,
          payload,
        });
        if (up.created) {
          newCandidateCount += 1;
        } else {
          updatedCandidateCount += 1;
        }
      }

      await finalizeDiscoveryRun({
        runId: run.id,
        sourceId: source.id,
        status: "SUCCESS",
        logs: [...logs, `[${key}] Product Hunt topic done posts=${parsedCount}`],
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
        errorMessage: null,
      });

      return {
        runId: run.id,
        ok: true,
        logs,
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
      };
    }

    if (source.type === "GITHUB" && source.subtype === "trending") {
      const config = source.configJson as {
        since?: "daily" | "weekly" | "monthly";
        maxRepos?: number;
        programmingLanguage?: string;
        spokenLanguageCode?: string;
      } | null;
      const since =
        config?.since === "weekly" || config?.since === "monthly" ? config.since : "daily";
      const maxRepos =
        typeof config?.maxRepos === "number" ? Math.min(100, Math.max(1, config.maxRepos)) : 25;

      const htmlRes = await fetchGithubTrendingHtml({
        since,
        programmingLanguage: config?.programmingLanguage ?? "",
        spokenLanguageCode: config?.spokenLanguageCode ?? "",
      });
      if (!htmlRes.ok) {
        throw new Error(htmlRes.error);
      }
      fetchedCount = 1;
      const names = parseTrendingRepoFullNamesFromHtml(htmlRes.html, maxRepos);
      logs.push(`[${key}] trending parsed ${names.length} repos (max ${maxRepos})`);

      if (names.length === 0) {
        logs.push(
          `[${key}] WARNING: trending HTML returned 0 repo paths; page structure may have changed`,
        );
      } else if (maxRepos >= 10 && names.length < Math.max(3, Math.ceil(maxRepos * 0.15))) {
        logs.push(
          `[${key}] WARNING: trending count unusually low (${names.length}/${maxRepos}); check parser or rate limits`,
        );
      }

      let fetchFailCount = 0;
      for (const fullName of names) {
        const parts = fullName.split("/");
        const o = parts[0];
        const r = parts[1];
        if (!o || !r) {
          continue;
        }
        const full = await fetchGithubRepoFull(o, r);
        if (!full.ok) {
          fetchFailCount += 1;
          logs.push(`[${key}] ${fullName} error=${full.error}`);
          continue;
        }
        const payload = mapGithubRepoToCandidatePayload(full.repo);
        if (!payload) {
          continue;
        }
        parsedCount += 1;
        const up = await upsertGithubDiscoveryCandidate(prisma, {
          sourceId: source.id,
          sourceKey: source.key,
          runId: run.id,
          payload,
          mode: "trending",
        });
        if (up.created) {
          newCandidateCount += 1;
        } else {
          updatedCandidateCount += 1;
        }
      }

      let status: "SUCCESS" | "FAILED" | "PARTIAL" = "SUCCESS";
      let errMsg: string | null = null;
      if (parsedCount === 0 && names.length > 0) {
        status = "PARTIAL";
        errMsg = "All GitHub repo fetches failed after trending parse";
        logs.push(`[${key}] ${errMsg}`);
      } else if (parsedCount === 0 && names.length === 0) {
        status = "PARTIAL";
        errMsg = "No trending repos parsed from HTML";
      } else if (names.length > 0 && fetchFailCount === names.length) {
        status = "PARTIAL";
        errMsg = "Every repo fetch failed";
      } else if (fetchFailCount > 0) {
        status = "PARTIAL";
        errMsg = `${fetchFailCount} repo fetch(es) failed`;
      }

      await finalizeDiscoveryRun({
        runId: run.id,
        sourceId: source.id,
        status,
        logs: [...logs, `[${key}] done status=${status}`],
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
        errorMessage: errMsg,
      });

      return {
        runId: run.id,
        ok: true,
        logs,
        fetchedCount,
        parsedCount,
        newCandidateCount,
        updatedCandidateCount,
        error: errMsg ?? undefined,
      };
    }

    throw new Error(`Unsupported discovery source kind: ${source.type} / ${source.subtype}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`[${key}] FATAL ${msg}`);
    await finalizeDiscoveryRun({
      runId: run.id,
      sourceId: source.id,
      status: "FAILED",
      logs,
      fetchedCount,
      parsedCount,
      newCandidateCount,
      updatedCandidateCount,
      errorMessage: msg,
    });
    return {
      runId: run.id,
      ok: false,
      logs,
      error: msg,
      fetchedCount,
      parsedCount,
      newCandidateCount,
      updatedCandidateCount,
    };
  }
}
