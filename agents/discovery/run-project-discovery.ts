/**
 * Discovery Layer — 项目发现：多任务 GitHub 搜索 → 规范化 → 写入发现候选池。
 * 与 Discovery V2（DiscoverySource / lib/discovery）同属发现链路；分层见 docs/agent-system-layering-v1.md。
 */
import { GITHUB_DISCOVERY_SEARCH_TASKS } from "@/agents/discovery/github-filters";
import { fetchGithubSearchRepositories } from "@/agents/discovery/github-search";
import {
  normalizeGithubSearchItem,
  type NormalizedDiscoveryCandidate,
} from "@/agents/discovery/github-normalize";
import { upsertDiscoveredProjectCandidates } from "@/lib/discovery-candidates";

export type RunProjectDiscoveryResult = {
  ok: boolean;
  fetchedRaw: number;
  normalizedCount: number;
  upserted: number;
  /** 与本次运行相关的日志行（含 console 同步输出） */
  logs: string[];
  error?: string;
};

/**
 * GitHub 多任务搜索 → 规范化 → 写入 DiscoveredProjectCandidate。
 * 供 `pnpm discovery:run` 与内部 HTTP 触发共用。
 */
export async function runProjectDiscovery(): Promise<RunProjectDiscoveryResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.info(msg);
  };
  const logErr = (msg: string) => {
    logs.push(msg);
    console.error(msg);
  };

  try {
    const seen = new Set<string>();
    const normalized: NormalizedDiscoveryCandidate[] = [];
    let fetchedRaw = 0;

    for (const task of GITHUB_DISCOVERY_SEARCH_TASKS) {
      const res = await fetchGithubSearchRepositories(task.query, {
        sort: task.sort,
        perPage: task.perPage,
      });
      if (!res.ok) {
        logErr(`[discovery] source=${task.source} error=${res.error}`);
        continue;
      }
      fetchedRaw += res.items.length;
      for (const it of res.items) {
        const n = normalizeGithubSearchItem(it, task.source);
        if (!n) {
          continue;
        }
        const key = `${n.source}:${n.sourceId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        normalized.push(n);
      }
    }

    log(`[discovery] fetched ${fetchedRaw} repos from github`);
    log(`[discovery] normalized ${normalized.length} candidates`);

    if (normalized.length === 0) {
      log("[discovery] upserted 0 candidates (nothing to write)");
      log("[discovery] done");
      return {
        ok: true,
        fetchedRaw,
        normalizedCount: 0,
        upserted: 0,
        logs,
      };
    }

    const { upserted } = await upsertDiscoveredProjectCandidates(normalized);
    log(`[discovery] upserted ${upserted} candidates`);
    log("[discovery] done");

    return {
      ok: true,
      fetchedRaw,
      normalizedCount: normalized.length,
      upserted,
      logs,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr(`[discovery] fatal ${msg}`);
    return {
      ok: false,
      fetchedRaw: 0,
      normalizedCount: 0,
      upserted: 0,
      logs,
      error: msg,
    };
  }
}
