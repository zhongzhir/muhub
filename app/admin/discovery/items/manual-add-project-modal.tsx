"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addManualGithubToQueueAction,
  importManualGithubProjectAction,
  parseManualGithubProjectAction,
  parseGeneralProjectAction,
  addGeneralProjectToQueueAction,
  importGeneralProjectAction,
} from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

type Mode = "github" | "general";

type ParsedGithubState = {
  sourceType: "GITHUB" | "GITCC";
  sourceUrl: string;
  sourceLabel: "GitHub" | "GitCC";
  githubUrl: string | null;
  owner: string | null;
  repo: string | null;
  title: string;
  summary: string | null;
  homepage: string | null;
  stargazersCount: number;
  language: string | null;
  duplicate: { slug: string; name: string } | null;
};

type ParsedGeneralState = {
  title: string;
  summary: string | null;
  websiteUrl: string | null;
  referenceUrl: string | null;
  category: string | null;
  aiEnriched: boolean;
  wechatAccount: string | null;
  weiboUrl: string | null;
  douyinUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  officialSourceCompletion: Array<{
    kind: "APP_STORE" | "GOOGLE_PLAY";
    url: string;
    label: string;
    evidence: string;
    confidence: number;
  }>;
  duplicate: { slug: string; name: string } | null;
};

export function ManualAddProjectModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("github");

  const [projectUrl, setProjectUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [note, setNote] = useState("");
  const [parsedGithub, setParsedGithub] = useState<ParsedGithubState | null>(null);

  const [genTitle, setGenTitle] = useState("");
  const [genDesc, setGenDesc] = useState("");
  const [genWebsite, setGenWebsite] = useState("");
  const [genRefUrl, setGenRefUrl] = useState("");
  const [genNote, setGenNote] = useState("");
  const [parsedGeneral, setParsedGeneral] = useState<ParsedGeneralState | null>(null);

  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const githubDuplicateHit = parsedGithub?.duplicate ?? null;
  const canSubmitGithub = Boolean(parsedGithub && !githubDuplicateHit);

  const generalDuplicateHit = parsedGeneral?.duplicate ?? null;
  const canSubmitGeneral = Boolean(parsedGeneral && !generalDuplicateHit);

  const normalizedWebsite = useMemo(() => websiteUrl.trim(), [websiteUrl]);

  function resetForm() {
    setProjectUrl(""); setWebsiteUrl(""); setNote("");
    setParsedGithub(null);
    setGenTitle(""); setGenDesc(""); setGenWebsite(""); setGenRefUrl(""); setGenNote("");
    setParsedGeneral(null);
    setFeedback(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setFeedback(null); }}
        className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {"➕ 添加项目"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl overflow-y-auto max-h-[90vh] rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {"添加项目"}
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {"支持 GitHub / GitCC 技术项目，也支持产品、工具等非技术类项目。"}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => { setOpen(false); resetForm(); }}
              >
                {"关闭"}
              </button>
            </div>

            <div className="mt-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/60">
              <button
                type="button"
                onClick={() => { setMode("github"); setFeedback(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === "github"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {"🔗 GitHub / GitCC 项目"}
              </button>
              <button
                type="button"
                onClick={() => { setMode("general"); setFeedback(null); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === "general"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {"📦 通用项目（产品 / 服务 / 工具）"}
              </button>
            </div>

            {mode === "github" && (
              <>
                <div className="mt-4 grid gap-3">
                  <label className="text-sm">
                    {"项目链接（必填）"}
                    <input
                      className={inputClass}
                      placeholder="https://github.com/{owner}/{repo}"
                      value={projectUrl}
                      onChange={(e) => setProjectUrl(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {"官网 URL（可选）"}
                    <input
                      className={inputClass}
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {"备注（可选）"}
                    <textarea
                      className={`${inputClass} min-h-[60px]`}
                      placeholder={"运营备注"}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                    onClick={() => {
                      setFeedback(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await parseManualGithubProjectAction({
                            githubUrl: projectUrl.trim(),
                            websiteUrl: normalizedWebsite || undefined,
                          });
                          if (!result.ok) {
                            setParsedGithub(null);
                            setFeedback({ kind: "err", text: result.error });
                            return;
                          }
                          setParsedGithub({
                            ...result.parsed,
                            duplicate: result.duplicate
                              ? { slug: result.duplicate.slug, name: result.duplicate.name }
                              : null,
                          });
                          if (result.duplicate) {
                            setFeedback({ kind: "err", text: "该项目已存在，禁止重复导入。" });
                          } else {
                            setFeedback({ kind: "ok", text: "解析成功，可加入发现队列或直接导入项目。" });
                          }
                        })();
                      });
                    }}
                  >
                    {pending ? "解析中..." : "解析项目"}
                  </button>

                  <button
                    type="button"
                    disabled={pending || !canSubmitGithub}
                    className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    onClick={() => {
                      if (!parsedGithub) return;
                      setFeedback(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await addManualGithubToQueueAction({
                            githubUrl: parsedGithub.sourceUrl,
                            websiteUrl: normalizedWebsite || parsedGithub.homepage || undefined,
                            note,
                            title: parsedGithub.title,
                            summary: parsedGithub.summary,
                            owner: parsedGithub.owner ?? undefined,
                            repo: parsedGithub.repo ?? undefined,
                            language: parsedGithub.language,
                            stargazersCount: parsedGithub.stargazersCount,
                          });
                          if (!result.ok) { setFeedback({ kind: "err", text: result.error }); return; }
                          setFeedback({ kind: "ok", text: "已加入发现队列。" });
                          router.refresh();
                        })();
                      });
                    }}
                  >
                    {pending ? "处理中..." : "加入发现队列"}
                  </button>

                  <button
                    type="button"
                    disabled={pending || !canSubmitGithub}
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    onClick={() => {
                      if (!parsedGithub) return;
                      setFeedback(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await importManualGithubProjectAction({
                            githubUrl: parsedGithub.sourceUrl,
                            websiteUrl: normalizedWebsite || parsedGithub.homepage || undefined,
                            note,
                            title: parsedGithub.title,
                            summary: parsedGithub.summary,
                            owner: parsedGithub.owner ?? undefined,
                            repo: parsedGithub.repo ?? undefined,
                            language: parsedGithub.language,
                            stargazersCount: parsedGithub.stargazersCount,
                          });
                          if (!result.ok) { setFeedback({ kind: "err", text: result.error }); return; }
                          setFeedback({ kind: "ok", text: "已成功导入项目。" });
                          router.refresh();
                        })();
                      });
                    }}
                  >
                    {pending ? "导入中..." : "直接导入项目"}
                  </button>
                </div>

                {parsedGithub ? (
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
                    <p>{"项目："}{parsedGithub.title}</p>
                    <p>{"来源："}{parsedGithub.sourceLabel}</p>
                    {parsedGithub.owner && parsedGithub.repo ? (
                      <p>{"仓库："}{parsedGithub.owner}/{parsedGithub.repo}</p>
                    ) : null}
                    <p>{"星标："}{parsedGithub.stargazersCount}</p>
                    <p>{"语言："}{parsedGithub.language || "-"}</p>
                    <p className="truncate">{"项目链接："}{parsedGithub.sourceUrl}</p>
                    <p className="truncate">{"官网 URL："}{normalizedWebsite || parsedGithub.homepage || "-"}</p>
                    {parsedGithub.summary ? (
                      <p className="mt-1 line-clamp-2">{"简介："}{parsedGithub.summary}</p>
                    ) : null}
                    {githubDuplicateHit ? (
                      <p className="mt-2 text-red-600 dark:text-red-300">
                        {"该项目已存在："}
                        <Link href={`/projects/${githubDuplicateHit.slug}`} className="underline underline-offset-2">
                          {githubDuplicateHit.name}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}

            {mode === "general" && (
              <>
                <div className="mt-4 grid gap-3">
                  <label className="text-sm">
                    {"项目名称（必填，或提供参考链接后自动识别）"}
                    <input
                      className={inputClass}
                      placeholder={"例如：Notion、Claude、DeepSeek"}
                      value={genTitle}
                      onChange={(e) => setGenTitle(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {"参考链接（可选）— 微信文章、新闻报道等，AI 将自动提取项目信息"}
                    <input
                      className={inputClass}
                      placeholder="https://mp.weixin.qq.com/s/…"
                      value={genRefUrl}
                      onChange={(e) => setGenRefUrl(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {"官方网站（可选）"}
                    <input
                      className={inputClass}
                      placeholder="https://example.com"
                      value={genWebsite}
                      onChange={(e) => setGenWebsite(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {"简介（可选）— 不填则由 AI 从参考链接生成"}
                    <textarea
                      className={`${inputClass} min-h-[60px]`}
                      placeholder={"一句话介绍这个项目…"}
                      value={genDesc}
                      onChange={(e) => setGenDesc(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    {"备注（可选）"}
                    <textarea
                      className={`${inputClass} min-h-[48px]`}
                      placeholder={"运营备注"}
                      value={genNote}
                      onChange={(e) => setGenNote(e.target.value)}
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {"提供参考链接后点击「解析项目」，AI 将尝试从页面内容提取项目名称、简介和官网。"}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                    onClick={() => {
                      setFeedback(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await parseGeneralProjectAction({
                            title: genTitle,
                            description: genDesc,
                            websiteUrl: genWebsite,
                            referenceUrl: genRefUrl,
                          });
                          if (!result.ok) {
                            setParsedGeneral(null);
                            setFeedback({ kind: "err", text: result.error });
                            return;
                          }
                          setParsedGeneral({
                            ...result.parsed,
                            duplicate: result.duplicate
                              ? { slug: result.duplicate.slug, name: result.duplicate.name }
                              : null,
                          });
                          if (!genTitle && result.parsed.title) setGenTitle(result.parsed.title);
                          if (!genDesc && result.parsed.summary) setGenDesc(result.parsed.summary);
                          if (!genWebsite && result.parsed.websiteUrl) setGenWebsite(result.parsed.websiteUrl);

                          if (result.duplicate) {
                            setFeedback({ kind: "err", text: "该项目已存在，禁止重复导入。" });
                          } else {
                            const aiHint = result.parsed.aiEnriched ? "（AI 已从参考链接提取信息）" : "";
                            setFeedback({ kind: "ok", text: `解析成功${aiHint}，可加入发现队列或直接导入。` });
                          }
                        })();
                      });
                    }}
                  >
                    {pending ? "解析中..." : "解析项目"}
                  </button>

                  <button
                    type="button"
                    disabled={pending || !canSubmitGeneral}
                    className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    onClick={() => {
                      if (!parsedGeneral) return;
                      setFeedback(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await addGeneralProjectToQueueAction({
                            title: parsedGeneral.title,
                            summary: parsedGeneral.summary,
                            websiteUrl: parsedGeneral.websiteUrl,
                            referenceUrl: parsedGeneral.referenceUrl,
                            category: parsedGeneral.category,
                            note: genNote,
                            wechatAccount: parsedGeneral.wechatAccount,
                            weiboUrl: parsedGeneral.weiboUrl,
                            douyinUrl: parsedGeneral.douyinUrl,
                            appStoreUrl: parsedGeneral.appStoreUrl,
                            playStoreUrl: parsedGeneral.playStoreUrl,
                            officialSourceCompletion: parsedGeneral.officialSourceCompletion,
                          });
                          if (!result.ok) { setFeedback({ kind: "err", text: result.error }); return; }
                          setFeedback({ kind: "ok", text: "已加入发现队列。" });
                          router.refresh();
                        })();
                      });
                    }}
                  >
                    {pending ? "处理中..." : "加入发现队列"}
                  </button>

                  <button
                    type="button"
                    disabled={pending || !canSubmitGeneral}
                    className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    onClick={() => {
                      if (!parsedGeneral) return;
                      setFeedback(null);
                      startTransition(() => {
                        void (async () => {
                          const result = await importGeneralProjectAction({
                            title: parsedGeneral.title,
                            summary: parsedGeneral.summary,
                            websiteUrl: parsedGeneral.websiteUrl,
                            referenceUrl: parsedGeneral.referenceUrl,
                            category: parsedGeneral.category,
                            note: genNote,
                            wechatAccount: parsedGeneral.wechatAccount,
                            weiboUrl: parsedGeneral.weiboUrl,
                            douyinUrl: parsedGeneral.douyinUrl,
                            appStoreUrl: parsedGeneral.appStoreUrl,
                            playStoreUrl: parsedGeneral.playStoreUrl,
                            officialSourceCompletion: parsedGeneral.officialSourceCompletion,
                          });
                          if (!result.ok) { setFeedback({ kind: "err", text: result.error }); return; }
                          setFeedback({ kind: "ok", text: "已成功导入项目。" });
                          router.refresh();
                        })();
                      });
                    }}
                  >
                    {pending ? "导入中..." : "直接导入项目"}
                  </button>
                </div>

                {parsedGeneral ? (
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
                    <p>{"项目名："}{parsedGeneral.title}</p>
                    {parsedGeneral.category ? <p>{"分类："}{parsedGeneral.category}</p> : null}
                    {parsedGeneral.websiteUrl ? (
                      <p className="truncate">{"官网："}{parsedGeneral.websiteUrl}</p>
                    ) : null}
                    {parsedGeneral.wechatAccount ? (
                      <p className="truncate">{"公众号："}{parsedGeneral.wechatAccount}</p>
                    ) : null}
                    {parsedGeneral.weiboUrl ? (
                      <p className="truncate">{"微博："}{parsedGeneral.weiboUrl}</p>
                    ) : null}
                    {parsedGeneral.douyinUrl ? (
                      <p className="truncate">{"抖音："}{parsedGeneral.douyinUrl}</p>
                    ) : null}
                    {parsedGeneral.appStoreUrl ? (
                      <p className="truncate">{"App Store："}{parsedGeneral.appStoreUrl}</p>
                    ) : null}
                    {parsedGeneral.playStoreUrl ? (
                      <p className="truncate">{"Google Play："}{parsedGeneral.playStoreUrl}</p>
                    ) : null}
                    {parsedGeneral.referenceUrl ? (
                      <p className="truncate">{"参考来源："}{parsedGeneral.referenceUrl}</p>
                    ) : null}
                    {parsedGeneral.summary ? (
                      <p className="mt-1 line-clamp-3">{"简介："}{parsedGeneral.summary}</p>
                    ) : null}
                    {parsedGeneral.aiEnriched ? (
                      <p className="mt-1 text-blue-600 dark:text-blue-400">{"✦ 已由 AI 从参考链接自动提取信息"}</p>
                    ) : null}
                    {parsedGeneral.officialSourceCompletion.length ? (
                      <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                        {"已轻量补全官方来源："}
                        {parsedGeneral.officialSourceCompletion.map((item) => item.label).join("、")}
                      </p>
                    ) : null}
                    {generalDuplicateHit ? (
                      <p className="mt-2 text-red-600 dark:text-red-300">
                        {"该项目已存在："}
                        <Link href={`/projects/${generalDuplicateHit.slug}`} className="underline underline-offset-2">
                          {generalDuplicateHit.name}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}

            {feedback ? (
              <p
                className={`mt-4 rounded px-3 py-2 text-xs ${
                  feedback.kind === "ok"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "border border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                }`}
              >
                {feedback.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
