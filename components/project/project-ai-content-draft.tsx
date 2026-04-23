"use client";

import {
  contentPayloadEquals,
  isAiContentDraftWorkflowStatus,
  workflowStatusLabel,
} from "@/lib/project-ai-content-edit-summary";
import { useCallback, useEffect, useMemo, useState } from "react";

type ContentPayload = {
  mode?: "balanced" | "expressive";
  copy?: {
    oneLiner?: string;
    short?: string;
    medium?: string;
    long?: string;
    audienceVersions?: {
      general?: string;
      business?: string;
      creator?: string;
      developer?: string;
    };
  };
  poster?: {
    title?: string;
    subtitle?: string;
    highlights?: string[];
    targetUsers?: string;
    callToAction?: string;
    contactLine?: string;
    linkLine?: string;
  };
  notes?: string[];
  validation?: {
    basedOn?: string[];
    weakPoints?: string[];
    verifyBeforeUse?: string[];
  };
};

type HistoryItem = {
  id: string;
  createdAt: string;
  operatorLabel: string;
  summary: string;
};

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

function generationStatusLabel(status: string): string {
  if (status === "pending") return "生成中";
  if (status === "success") return "已生成";
  if (status === "failed") return "生成失败";
  if (status === "idle") return "未生成";
  return status;
}

function parseInitialWorkflow(value: string): "" | "drafting" | "reviewing" | "ready_for_publish" {
  if (value && isAiContentDraftWorkflowStatus(value)) return value;
  return "";
}

export function ProjectAiContentDraft({
  projectId,
  initialStatus,
  initialUpdatedAt,
  initialContent,
  initialError,
  initialDraft,
  initialDraftUpdatedAt,
  initialDraftOperatorLabel,
  initialDraftWorkflowStatus,
  initialDraftWorkflowStatusUpdatedAt,
}: {
  projectId: string;
  initialStatus: string;
  initialUpdatedAt: string;
  initialContent: unknown;
  initialError: string;
  initialDraft: unknown;
  initialDraftUpdatedAt: string;
  initialDraftOperatorLabel: string;
  initialDraftWorkflowStatus: string;
  initialDraftWorkflowStatusUpdatedAt: string;
}) {
  const [status, setStatus] = useState(initialStatus || "idle");
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt || "");
  const [content] = useState<ContentPayload>(
    (initialContent && typeof initialContent === "object" ? (initialContent as ContentPayload) : {}),
  );
  const [draft, setDraft] = useState<ContentPayload>(
    (initialDraft && typeof initialDraft === "object" ? (initialDraft as ContentPayload) : {}),
  );
  const [editDraft, setEditDraft] = useState<ContentPayload>(
    (initialDraft && typeof initialDraft === "object" ? (initialDraft as ContentPayload) : {}),
  );
  const [error, setError] = useState(initialError || "");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState(initialDraftUpdatedAt || "");
  const [draftOperatorLabel, setDraftOperatorLabel] = useState(initialDraftOperatorLabel || "");
  const [workflowStatus, setWorkflowStatus] = useState(() => parseInitialWorkflow(initialDraftWorkflowStatus));
  const [workflowStatusAt, setWorkflowStatusAt] = useState(initialDraftWorkflowStatusUpdatedAt || "");
  const [statusSaving, setStatusSaving] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const active = draft && Object.keys(draft).length > 0 ? draft : content;
  const isAiOriginalView = contentPayloadEquals(content, active);

  const publishHints = useMemo(() => {
    const hints: string[] = [];
    if (asArray(active.validation?.weakPoints).length) {
      hints.push("当前仍有信息不足项，建议先核对再对外使用");
    }
    if (!(active.poster?.contactLine || "").trim()) {
      hints.push("尚未补充联系方式，海报与合作文案可能不完整");
    }
    if (isAiOriginalView && status === "success") {
      hints.push("当前内容仍是 AI 原始稿，建议按项目实际情况微调");
    }
    if (workflowStatus === "drafting") {
      hints.push("当前仍处于草稿阶段");
    }
    if (workflowStatus === "ready_for_publish") {
      hints.push("已标记为可发布，请在正式对外前再核对一次事实项");
    }
    return hints;
  }, [active, isAiOriginalView, status, workflowStatus]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-content/history`);
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        items?: HistoryItem[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setHistoryItems([]);
        return;
      }
      setHistoryItems(Array.isArray(json.items) ? json.items : []);
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (status === "success") void loadHistory();
  }, [status, loadHistory]);

  const postWorkflowStatus = async (next: "drafting" | "reviewing" | "ready_for_publish") => {
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-content/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: string;
        updatedAt?: string;
      };
      if (!res.ok || !json.ok) {
        window.alert(json.error || "更新状态失败。");
        return;
      }
      if (json.status && isAiContentDraftWorkflowStatus(json.status)) {
        setWorkflowStatus(json.status);
      }
      if (json.updatedAt) setWorkflowStatusAt(json.updatedAt);
    } finally {
      setStatusSaving(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      window.alert(`${label}已复制到剪贴板。`);
    } catch {
      window.alert("复制失败，请手动复制。");
    }
  };

  const exportMarkdown = () => {
    const markdown = [
      "# 项目传播文案",
      "",
      "## 一句话",
      active.copy?.oneLiner || "",
      "",
      "## 短文案",
      active.copy?.short || "",
      "",
      "## 中文案",
      active.copy?.medium || "",
      "",
      "## 长文案",
      active.copy?.long || "",
      "",
      "## 不同受众版本",
      `- general: ${active.copy?.audienceVersions?.general || ""}`,
      `- business: ${active.copy?.audienceVersions?.business || ""}`,
      `- creator: ${active.copy?.audienceVersions?.creator || ""}`,
      `- developer: ${active.copy?.audienceVersions?.developer || ""}`,
      "",
      "## 海报内容草稿",
      `- 标题: ${active.poster?.title || ""}`,
      `- 副标题: ${active.poster?.subtitle || ""}`,
      `- 亮点: ${asArray(active.poster?.highlights).join("；")}`,
      `- 目标用户: ${active.poster?.targetUsers || ""}`,
      `- 行动引导: ${active.poster?.callToAction || ""}`,
      `- 联系方式: ${active.poster?.contactLine || ""}`,
      `- 链接信息: ${active.poster?.linkLine || ""}`,
      "",
      "## 生成说明",
      ...asArray(active.notes).map((item) => `- ${item}`),
      "",
      "## 使用前提示",
      `- 内容依据: ${asArray(active.validation?.basedOn).join(" / ")}`,
      ...asArray(active.validation?.weakPoints).map((item) => `- 信息不足点: ${item}`),
      ...asArray(active.validation?.verifyBeforeUse).map((item) => `- 发布前确认: ${item}`),
      "",
    ].join("\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "muhub-ai-content.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const generate = async () => {
    setBusy(true);
    setStatus("pending");
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-content`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: string;
        content?: unknown;
        updatedAt?: string | null;
        draftOperatorLabel?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "AI传播草稿生成失败，请稍后重试。");
      }
      setStatus(json.status || "success");
      const next = json.content && typeof json.content === "object" ? (json.content as ContentPayload) : {};
      setDraft(next);
      setEditDraft(next);
      setUpdatedAt(json.updatedAt || new Date().toISOString());
      setDraftUpdatedAt(json.updatedAt || new Date().toISOString());
      if (json.draftOperatorLabel) setDraftOperatorLabel(json.draftOperatorLabel);
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "AI传播草稿生成失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-content/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: editDraft }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        updatedAt?: string;
        draftOperatorLabel?: string;
        draftWorkflowStatus?: string | null;
        draftWorkflowStatusUpdatedAt?: string | null;
      };
      if (!res.ok || !json.ok) {
        window.alert(json.error || "保存草稿失败。");
        return;
      }
      setDraft(editDraft);
      setDraftUpdatedAt(json.updatedAt || new Date().toISOString());
      if (json.draftOperatorLabel) setDraftOperatorLabel(json.draftOperatorLabel);
      if (json.draftWorkflowStatus && isAiContentDraftWorkflowStatus(json.draftWorkflowStatus)) {
        setWorkflowStatus(json.draftWorkflowStatus);
      }
      if (json.draftWorkflowStatusUpdatedAt) setWorkflowStatusAt(json.draftWorkflowStatusUpdatedAt);
      setEditing(false);
      void loadHistory();
    } finally {
      setSavingDraft(false);
    }
  };

  const resetToAi = async () => {
    if (!window.confirm("确认恢复为 AI 原始版本？当前编辑内容将被覆盖。")) return;
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-content/reset`, { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      draft?: unknown;
      updatedAt?: string;
      draftOperatorLabel?: string;
    };
    if (!res.ok || !json.ok) {
      window.alert(json.error || "恢复失败。");
      return;
    }
    const next = json.draft && typeof json.draft === "object" ? (json.draft as ContentPayload) : {};
    setDraft(next);
    setEditDraft(next);
    setDraftUpdatedAt(json.updatedAt || new Date().toISOString());
    if (json.draftOperatorLabel) setDraftOperatorLabel(json.draftOperatorLabel);
    setEditing(false);
    void loadHistory();
  };

  const updateEdit = (updater: (prev: ContentPayload) => ContentPayload) => {
    setEditDraft((prev) => updater(prev));
  };

  const formatTime = (iso: string) => (iso ? iso.replace("T", " ").slice(0, 19) : "");

  return (
    <section className="muhub-card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI 传播内容草稿</h2>
          <p className="mt-1 text-xs text-zinc-500">
            AI生成传播草稿，请在发布前自行确认内容是否符合项目实际情况。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="muhub-btn-secondary px-3 py-2 text-sm disabled:opacity-60"
          >
            {busy ? "生成中..." : status === "success" ? "重新生成" : "生成传播文案"}
          </button>
          {status === "success" ? (
            <>
              {!editing ? (
                <button type="button" onClick={() => setEditing(true)} className="rounded border border-zinc-300 px-3 py-2 text-sm">
                  编辑
                </button>
              ) : (
                <>
                  <button type="button" disabled={savingDraft} onClick={saveDraft} className="rounded border border-emerald-300 px-3 py-2 text-sm text-emerald-700 disabled:opacity-60">
                    {savingDraft ? "保存中..." : "保存"}
                  </button>
                  <button type="button" onClick={() => { setEditing(false); setEditDraft(draft); }} className="rounded border border-zinc-300 px-3 py-2 text-sm">
                    取消
                  </button>
                </>
              )}
              <button type="button" onClick={resetToAi} className="rounded border border-zinc-300 px-3 py-2 text-sm">
                恢复为AI版本
              </button>
            </>
          ) : null}
          {status === "success" ? (
            <button
              type="button"
              onClick={exportMarkdown}
              className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              导出全部文案（Markdown）
            </button>
          ) : null}
          {status === "success" ? (
            <button
              type="button"
              onClick={() => copyText(exportMarkdownText(active), "全部文案")}
              className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              复制全部（纯文本）
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>
            生成状态：<strong>{generationStatusLabel(status)}</strong>
            {updatedAt ? ` · ${formatTime(updatedAt)}` : ""}
          </span>
          {status === "success" ? (
            <>
              <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">|</span>
              <span>
                当前版本：<strong>{isAiOriginalView ? "AI 原始" : "已编辑"}</strong>
              </span>
              <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">|</span>
              <span>
                表达模式：<strong>{active.mode === "expressive" ? "增强表达（expressive）" : "平衡表达（balanced）"}</strong>
              </span>
              <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">|</span>
              <span>
                当前状态：<strong>{workflowStatusLabel(workflowStatus)}</strong>
              </span>
              <label className="inline-flex items-center gap-1">
                <span className="sr-only">切换流程状态</span>
                <select
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-950"
                  value={workflowStatus}
                  disabled={statusSaving}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isAiContentDraftWorkflowStatus(v)) void postWorkflowStatus(v);
                  }}
                >
                  <option value="" disabled>
                    选择流程状态…
                  </option>
                  <option value="drafting">草稿中</option>
                  <option value="reviewing">校对中</option>
                  <option value="ready_for_publish">可发布</option>
                </select>
              </label>
              <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">|</span>
              <span>草稿更新：{draftUpdatedAt ? formatTime(draftUpdatedAt) : "—"}</span>
              <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">|</span>
              <span>最近编辑人：{draftOperatorLabel || "—"}</span>
              {workflowStatusAt ? (
                <>
                  <span className="hidden sm:inline text-zinc-300 dark:text-zinc-600">|</span>
                  <span>状态更新时间：{formatTime(workflowStatusAt)}</span>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {status === "idle" ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
          尚未生成传播草稿。
        </div>
      ) : null}
      {status === "pending" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          正在生成传播草稿，请稍候...
        </div>
      ) : null}
      {status === "failed" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "生成失败，请重试。"}
        </div>
      ) : null}
      {status === "success" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">发布准备情况</h3>
            {publishHints.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-200">
                {publishHints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">暂无额外提醒，发布前仍建议人工核对事实与合规。</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">最近改动</h3>
            {historyLoading ? (
              <p className="mt-2 text-xs text-zinc-500">加载中…</p>
            ) : historyItems.length ? (
              <ul className="mt-2 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
                {historyItems.map((item) => (
                  <li key={item.id} className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500">{formatTime(item.createdAt)}</div>
                    <div className="mt-0.5">
                      <span className="font-medium">{item.operatorLabel}</span>
                      <span className="text-zinc-500"> · </span>
                      <span>{item.summary}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">暂无保存记录。</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">一句话传播版</h3>
            <p className="mt-1 text-xs text-zinc-500">适合标题 / 社交平台简介</p>
            {editing ? (
              <textarea
                className="muhub-input mt-2 min-h-[80px]"
                value={editDraft.copy?.oneLiner || ""}
                onChange={(e) => updateEdit((prev) => ({
                  ...prev,
                  copy: { ...prev.copy, oneLiner: e.target.value },
                }))}
              />
            ) : (
              <p className="mt-2 text-sm">{active.copy?.oneLiner || "信息不足"}</p>
            )}
            <button
              type="button"
              className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs"
              onClick={() => copyText(active.copy?.oneLiner || "", "一句话传播版")}
            >
              复制
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold">短文案</h3>
              <p className="mt-1 text-xs text-zinc-500">适合卡片 / 简短介绍</p>
              {editing ? (
                <textarea className="muhub-input mt-2 min-h-[120px]" value={editDraft.copy?.short || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, copy: { ...prev.copy, short: e.target.value } }))} />
              ) : (
                <p className="mt-2 text-sm whitespace-pre-wrap">{active.copy?.short || "信息不足"}</p>
              )}
              <button type="button" className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs" onClick={() => copyText(active.copy?.short || "", "短文案")}>
                复制
              </button>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold">中文案</h3>
              <p className="mt-1 text-xs text-zinc-500">适合项目介绍页 / 合作沟通</p>
              {editing ? (
                <textarea className="muhub-input mt-2 min-h-[120px]" value={editDraft.copy?.medium || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, copy: { ...prev.copy, medium: e.target.value } }))} />
              ) : (
                <p className="mt-2 text-sm whitespace-pre-wrap">{active.copy?.medium || "信息不足"}</p>
              )}
              <button type="button" className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs" onClick={() => copyText(active.copy?.medium || "", "中文案")}>
                复制
              </button>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold">长文案</h3>
              <p className="mt-1 text-xs text-zinc-500">适合公众号 / 长内容</p>
              {editing ? (
                <textarea className="muhub-input mt-2 min-h-[140px]" value={editDraft.copy?.long || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, copy: { ...prev.copy, long: e.target.value } }))} />
              ) : (
                <p className="mt-2 text-sm whitespace-pre-wrap">{active.copy?.long || "信息不足"}</p>
              )}
              <button type="button" className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs" onClick={() => copyText(active.copy?.long || "", "长文案")}>
                复制
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">不同受众版本</h3>
            <p className="mt-1 text-xs text-zinc-500">
              general：普通用户；business：合作/招商；creator：内容创作者；developer：技术用户
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              <li>general: {active.copy?.audienceVersions?.general || "信息不足"}</li>
              <li>business: {active.copy?.audienceVersions?.business || "信息不足"}</li>
              <li>creator: {active.copy?.audienceVersions?.creator || "信息不足"}</li>
              <li>developer: {active.copy?.audienceVersions?.developer || "信息不足"}</li>
            </ul>
            {editing ? (
              <div className="mt-2 grid gap-2">
                <input className="muhub-input" placeholder="general" value={editDraft.copy?.audienceVersions?.general || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, copy: { ...prev.copy, audienceVersions: { ...prev.copy?.audienceVersions, general: e.target.value } } }))} />
                <input className="muhub-input" placeholder="business" value={editDraft.copy?.audienceVersions?.business || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, copy: { ...prev.copy, audienceVersions: { ...prev.copy?.audienceVersions, business: e.target.value } } }))} />
                <input className="muhub-input" placeholder="creator" value={editDraft.copy?.audienceVersions?.creator || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, copy: { ...prev.copy, audienceVersions: { ...prev.copy?.audienceVersions, creator: e.target.value } } }))} />
                <input className="muhub-input" placeholder="developer" value={editDraft.copy?.audienceVersions?.developer || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, copy: { ...prev.copy, audienceVersions: { ...prev.copy?.audienceVersions, developer: e.target.value } } }))} />
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="rounded border border-zinc-300 px-2 py-1 text-xs" onClick={() => copyText(active.copy?.audienceVersions?.general || "", "general版本")}>复制 general</button>
              <button type="button" className="rounded border border-zinc-300 px-2 py-1 text-xs" onClick={() => copyText(active.copy?.audienceVersions?.business || "", "business版本")}>复制 business</button>
              <button type="button" className="rounded border border-zinc-300 px-2 py-1 text-xs" onClick={() => copyText(active.copy?.audienceVersions?.creator || "", "creator版本")}>复制 creator</button>
              <button type="button" className="rounded border border-zinc-300 px-2 py-1 text-xs" onClick={() => copyText(active.copy?.audienceVersions?.developer || "", "developer版本")}>复制 developer</button>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">海报内容草稿</h3>
            {editing ? (
              <div className="mt-2 grid gap-2">
                <input className="muhub-input" placeholder="标题" value={editDraft.poster?.title || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, poster: { ...prev.poster, title: e.target.value } }))} />
                <input className="muhub-input" placeholder="副标题" value={editDraft.poster?.subtitle || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, poster: { ...prev.poster, subtitle: e.target.value } }))} />
                <textarea className="muhub-input min-h-[80px]" placeholder="亮点（每行一条）" value={asArray(editDraft.poster?.highlights).join("\n")} onChange={(e) => updateEdit((prev) => ({ ...prev, poster: { ...prev.poster, highlights: e.target.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean) } }))} />
                <input className="muhub-input" placeholder="目标用户" value={editDraft.poster?.targetUsers || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, poster: { ...prev.poster, targetUsers: e.target.value } }))} />
                <input className="muhub-input" placeholder="行动引导" value={editDraft.poster?.callToAction || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, poster: { ...prev.poster, callToAction: e.target.value } }))} />
                <input className="muhub-input" placeholder="联系方式" value={editDraft.poster?.contactLine || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, poster: { ...prev.poster, contactLine: e.target.value } }))} />
                <input className="muhub-input" placeholder="链接信息" value={editDraft.poster?.linkLine || ""} onChange={(e) => updateEdit((prev) => ({ ...prev, poster: { ...prev.poster, linkLine: e.target.value } }))} />
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm">标题：{active.poster?.title || "信息不足"}</p>
                <p className="text-sm">副标题：{active.poster?.subtitle || "信息不足"}</p>
              </>
            )}
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {asArray(active.poster?.highlights).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm">目标用户：{active.poster?.targetUsers || "信息不足"}</p>
            <p className="text-sm">行动引导：{active.poster?.callToAction || "信息不足"}</p>
            <p className="text-sm">联系方式：{active.poster?.contactLine || "-"}</p>
            <p className="text-sm">链接信息：{active.poster?.linkLine || "-"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">生成说明</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {asArray(active.notes).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">使用前提示</h3>
            <p className="mt-2 text-xs text-zinc-500">内容依据</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {asArray(active.validation?.basedOn).map((item) => (
                <li key={`based-${item}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">信息不足点</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {asArray(active.validation?.weakPoints).map((item) => (
                <li key={`weak-${item}`}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">发布前建议确认</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {asArray(active.validation?.verifyBeforeUse).map((item) => (
                <li key={`verify-${item}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold">发布前检查</h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li>☐ 是否确认所有亮点表述</li>
              <li>☐ 是否补充联系方式</li>
              <li>☐ 是否核对适用人群</li>
              <li>☐ 是否符合当前项目阶段</li>
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function exportMarkdownText(content: ContentPayload): string {
  return [
    "# 项目传播文案",
    "",
    "## 一句话",
    content.copy?.oneLiner || "",
    "",
    "## 短文案",
    content.copy?.short || "",
    "",
    "## 中文案",
    content.copy?.medium || "",
    "",
    "## 长文案",
    content.copy?.long || "",
    "",
    "## 不同受众版本",
    `general: ${content.copy?.audienceVersions?.general || ""}`,
    `business: ${content.copy?.audienceVersions?.business || ""}`,
    `creator: ${content.copy?.audienceVersions?.creator || ""}`,
    `developer: ${content.copy?.audienceVersions?.developer || ""}`,
  ].join("\n");
}
