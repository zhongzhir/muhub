import Link from "next/link";
import { PlazaDiscoveryBlocks } from "@/components/plaza-discovery-blocks";
import { ProjectCard } from "@/components/project-card";
import { RecommendedProjectCard } from "@/components/recommended-project-card";
import { PRIMARY_TYPE_ORDER } from "@/lib/discovery/classification/keyword-rules";
import {
  fetchPlazaSpotlights,
  fetchPublicProjects,
  type PlazaSortMode,
} from "@/lib/project-list";
import { recommendedProjects } from "@/lib/recommended-projects";

export const dynamic = "force-dynamic";

function parseBoolQuery(v: string | string[] | undefined): boolean | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "1" || s === "true") {
    return true;
  }
  if (s === "0" || s === "false") {
    return false;
  }
  return undefined;
}

function parseSort(raw: string | string[] | undefined): PlazaSortMode {
  const s = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  if (s === "updated" || s === "github" || s === "recommended") {
    return s;
  }
  return "new";
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProjectsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const searchTerm = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category.trim() : "";
  const tag = typeof sp.tag === "string" ? sp.tag.trim() : "";
  const ai = parseBoolQuery(sp.ai);
  const zh = parseBoolQuery(sp.zh);
  const hw = parseBoolQuery(sp.hw);
  const hd = parseBoolQuery(sp.hd);
  const hg = parseBoolQuery(sp.hg);
  const sort = parseSort(sp.sort);

  const { items, error } = await fetchPublicProjects({
    q: searchTerm || undefined,
    category: category || undefined,
    tag: tag || undefined,
    isAiRelated: ai,
    isChineseTool: zh,
    hasWebsite: hw,
    hasDocs: hd,
    hasGitHub: hg,
    sort,
  });

  const hasListFilters =
    Boolean(searchTerm) ||
    Boolean(category) ||
    Boolean(tag) ||
    ai != null ||
    zh != null ||
    hw != null ||
    hd != null ||
    hg != null;

  const showEmptyAll = !error && items.length === 0 && !hasListFilters;
  const showEmptySearch = !error && items.length === 0 && hasListFilters;

  const spotlights =
    !error && !hasListFilters ? await fetchPlazaSpotlights() : null;

  const filterQuery = new URLSearchParams();
  if (searchTerm) {
    filterQuery.set("q", searchTerm);
  }
  if (category) {
    filterQuery.set("category", category);
  }
  if (tag) {
    filterQuery.set("tag", tag);
  }
  if (ai === true) {
    filterQuery.set("ai", "1");
  } else if (ai === false) {
    filterQuery.set("ai", "0");
  }
  if (zh === true) {
    filterQuery.set("zh", "1");
  } else if (zh === false) {
    filterQuery.set("zh", "0");
  }
  if (hw === true) {
    filterQuery.set("hw", "1");
  } else if (hw === false) {
    filterQuery.set("hw", "0");
  }
  if (hd === true) {
    filterQuery.set("hd", "1");
  } else if (hd === false) {
    filterQuery.set("hd", "0");
  }
  if (hg === true) {
    filterQuery.set("hg", "1");
  } else if (hg === false) {
    filterQuery.set("hg", "0");
  }
  if (sort !== "new") {
    filterQuery.set("sort", sort);
  }
  const filterQS = filterQuery.toString();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">项目广场</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">浏览公开展示的项目。希望展示你的项目？</span>{" "}
            <Link
              href="/dashboard/projects/new"
              className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              创建项目
            </Link>
          </p>
        </header>

        {spotlights ? (
          <PlazaDiscoveryBlocks
            hotAgents={spotlights.hotAgents}
            chineseAi={spotlights.chineseAi}
            recentDiscovered={spotlights.recentDiscovered}
            wellFilled={spotlights.wellFilled}
          />
        ) : null}

        <section className="mb-10 space-y-4">
          <form
            action="/projects"
            method="get"
            className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="projects-search" className="sr-only">
                  搜索项目
                </label>
                <input
                  id="projects-search"
                  name="q"
                  type="search"
                  defaultValue={searchTerm}
                  placeholder="按名称、页面路径或一句话介绍搜索"
                  aria-label="搜索项目"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                搜索
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                排序
                <select
                  name="sort"
                  defaultValue={sort}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="new">最新收录</option>
                  <option value="updated">最近更新</option>
                  <option value="github">GitHub 热度（快照星标）</option>
                  <option value="recommended">推荐（完整度+AI 等规则）</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                主类型
                <select
                  name="category"
                  defaultValue={category}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="">全部</option>
                  {PRIMARY_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                标签（精确匹配一项）
                <input
                  name="tag"
                  type="text"
                  defaultValue={tag}
                  placeholder="如 LLM"
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                AI 相关
                <select
                  name="ai"
                  defaultValue={ai === true ? "1" : ai === false ? "0" : ""}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="">不限</option>
                  <option value="1">是</option>
                  <option value="0">否</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                中文工具
                <select
                  name="zh"
                  defaultValue={zh === true ? "1" : zh === false ? "0" : ""}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="">不限</option>
                  <option value="1">是</option>
                  <option value="0">否</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                含官网
                <select
                  name="hw"
                  defaultValue={hw === true ? "1" : hw === false ? "0" : ""}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="">不限</option>
                  <option value="1">是</option>
                  <option value="0">否</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                含文档
                <select
                  name="hd"
                  defaultValue={hd === true ? "1" : hd === false ? "0" : ""}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="">不限</option>
                  <option value="1">是</option>
                  <option value="0">否</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                含 GitHub
                <select
                  name="hg"
                  defaultValue={hg === true ? "1" : hg === false ? "0" : ""}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                >
                  <option value="">不限</option>
                  <option value="1">是</option>
                  <option value="0">否</option>
                </select>
              </label>
            </div>
          </form>
          {filterQS ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              已应用筛选或排序。
              <Link href="/projects" className="ml-2 underline">
                清除
              </Link>
            </p>
          ) : null}
        </section>

        {error ? (
          <div
            role="alert"
            className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
          >
            {error}
          </div>
        ) : null}

        <section aria-label="项目列表">
          {showEmptyAll ? (
            <div className="space-y-8">
              <div
                data-testid="projects-empty-all"
                className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-10 text-center dark:border-zinc-600 dark:bg-zinc-900/40"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">暂无项目</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  你可以先创建项目，或从 GitHub / Gitee 导入一个项目开始。
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/dashboard/projects/new"
                    className="inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto"
                  >
                    创建项目
                  </Link>
                  <Link
                    href="/dashboard/projects/import"
                    className="inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto"
                  >
                    导入项目
                  </Link>
                </div>
              </div>
              <div data-testid="recommended-project-pool" className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  推荐项目
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  冷启动示例：浏览下方知名开源项目（点击卡片进入示例详情页）。
                </p>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {recommendedProjects.map((p) => (
                    <li key={p.slug}>
                      <RecommendedProjectCard project={p} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {showEmptySearch ? (
            <p
              data-testid="projects-empty-search"
              className="rounded-lg border border-dashed border-zinc-300 bg-zinc-100/50 px-6 py-12 text-center text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
            >
              没有找到匹配的项目
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="grid gap-6 sm:grid-cols-2">
              {items.map((p) => (
                <li key={p.slug} className="h-full">
                  <ProjectCard project={p} variant="plaza" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
