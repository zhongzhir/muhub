"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  approveDiscoveryCandidateAction,
  mergeDiscoveryCandidateAction,
  rejectDiscoveryCandidateAction,
  submitDiscoveryFeedbackAction,
} from "../actions";
import type {
  DiscoveryFeedbackDecision,
  DiscoveryFeedbackReasonTag,
} from "@/lib/discovery/feedback-capture";

const DECISION_OPTIONS: Array<{ value: DiscoveryFeedbackDecision; label: string }> = [
  { value: "ACCEPT", label: "接受" },
  { value: "REJECT", label: "拒绝" },
  { value: "RETYPE", label: "修改类型" },
  { value: "CHANGE_PRIMARY_SOURCE", label: "修改来源" },
  { value: "MERGE", label: "合并" },
  { value: "NEEDS_REVIEW", label: "待观察" },
];

const ACCEPT_REASON_TAGS: Array<{ value: DiscoveryFeedbackReasonTag; label: string }> = [
  { value: "official_source_exists", label: "官方来源存在" },
  { value: "github_exists", label: "GitHub存在" },
  { value: "huggingface_exists", label: "HuggingFace存在" },
  { value: "website_exists", label: "官网存在" },
  { value: "multi_source_verified", label: "多源验证" },
  { value: "high_project_value", label: "项目价值高" },
  { value: "high_industry_attention", label: "行业关注度高" },
  { value: "other", label: "其它" },
];

const REJECT_REASON_TAGS: Array<{ value: DiscoveryFeedbackReasonTag; label: string }> = [
  { value: "concept_only", label: "只是概念" },
  { value: "method_only", label: "只是方法" },
  { value: "no_official_source", label: "没有官方来源" },
  { value: "ambiguous_name", label: "名称歧义" },
  { value: "duplicate_project", label: "重复项目" },
  { value: "insufficient_information", label: "信息不足" },
  { value: "ai_misidentified", label: "AI误识别" },
  { value: "other", label: "其它" },
];

const SOURCE_REASON_TAGS: Array<{ value: DiscoveryFeedbackReasonTag; label: string }> = [
  { value: "found_more_trusted_source", label: "找到更可信来源" },
  { value: "official_source", label: "官方来源" },
  { value: "github_source", label: "GitHub" },
  { value: "huggingface_source", label: "HuggingFace" },
  { value: "website_source", label: "官网" },
  { value: "multi_source_verified", label: "多源验证" },
];

const TYPE_OPTIONS = ["project", "dataset", "model", "tool", "organization", "concept", "method", "person", "unknown"];

function reasonOptionsFor(decision: DiscoveryFeedbackDecision) {
  if (decision === "REJECT") {
    return REJECT_REASON_TAGS;
  }
  if (decision === "CHANGE_PRIMARY_SOURCE") {
    return SOURCE_REASON_TAGS;
  }
  if (decision === "RETYPE") {
    return [...ACCEPT_REASON_TAGS, ...REJECT_REASON_TAGS.filter((tag) => tag.value !== "other")];
  }
  return ACCEPT_REASON_TAGS;
}

export function CandidateDetailActions(props: {
  candidateId: string;
  canMutate: boolean;
  entityName: string;
  originalEntityType: string | null;
  originalDecision: string | null;
  originalPrimarySource: string | null;
  authenticityScore: number | null;
}) {
  const {
    candidateId,
    canMutate,
    entityName,
    originalEntityType,
    originalDecision,
    originalPrimarySource,
    authenticityScore,
  } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [decision, setDecision] = useState<DiscoveryFeedbackDecision>("ACCEPT");
  const [selectedTags, setSelectedTags] = useState<DiscoveryFeedbackReasonTag[]>([]);
  const [finalEntityType, setFinalEntityType] = useState(originalEntityType ?? "project");
  const [finalPrimarySource, setFinalPrimarySource] = useState(originalPrimarySource ?? "");
  const [comment, setComment] = useState("");
  const [mergeProjectId, setMergeProjectId] = useState("");

  const reasonTags = useMemo(() => reasonOptionsFor(decision), [decision]);

  function toggleTag(tag: DiscoveryFeedbackReasonTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  }

  async function submitFeedback(
    override?: Partial<{
      finalDecision: DiscoveryFeedbackDecision;
      targetProjectId: string | null;
      comment: string | null;
    }>,
  ) {
    const finalDecision = override?.finalDecision ?? decision;
    const result = await submitDiscoveryFeedbackAction({
      candidateId,
      entityName,
      originalEntityType,
      finalEntityType:
        finalDecision === "RETYPE" || finalDecision === "REJECT"
          ? finalEntityType
          : finalEntityType || originalEntityType,
      originalDecision,
      finalDecision,
      originalPrimarySource,
      finalPrimarySource:
        finalDecision === "CHANGE_PRIMARY_SOURCE"
          ? finalPrimarySource.trim() || null
          : finalPrimarySource.trim() || originalPrimarySource,
      reasonTags: selectedTags,
      comment: override?.comment ?? (comment.trim() || null),
      authenticityScore,
      targetProjectId: override?.targetProjectId ?? null,
      source: "project_import_review",
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.feedbackId;
  }

  const onSubmitFeedback = () => {
    setMessage(null);
    start(async () => {
      try {
        const feedbackId = await submitFeedback();
        setMessage(`判断已记录：${feedbackId}`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  };

  const onApprove = () => {
    if (!canMutate) {
      return;
    }
    setMessage(null);
    start(async () => {
      try {
        await submitFeedback({ finalDecision: "ACCEPT" });
        const result = await approveDiscoveryCandidateAction(candidateId);
        if (result.ok && result.projectId) {
          router.push(`/admin/projects/${result.projectId}/edit`);
          return;
        }
        if (!result.ok) {
          setMessage(result.error);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  };

  const onReject = () => {
    if (!canMutate) {
      return;
    }
    setMessage(null);
    start(async () => {
      try {
        await submitFeedback({ finalDecision: "REJECT" });
        const result = await rejectDiscoveryCandidateAction(candidateId, comment.trim() || undefined);
        if (result.ok) {
          setMessage("已拒绝导入，并记录判断。");
          router.refresh();
        } else {
          setMessage(result.error);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  };

  const onMerge = () => {
    const projectId = mergeProjectId.trim();
    if (!projectId) {
      setMessage("请先填写目标项目 ID。");
      return;
    }
    if (!canMutate) {
      return;
    }

    setMessage(null);
    start(async () => {
      try {
        await submitFeedback({ finalDecision: "MERGE", targetProjectId: projectId });
        const result = await mergeDiscoveryCandidateAction(candidateId, projectId);
        if (result.ok) {
          router.push(`/admin/projects/${projectId}/edit`);
          return;
        }
        setMessage(result.error);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  };

  return (
    <div className="space-y-5">
      {!canMutate ? (
        <p className="text-sm text-zinc-500">
          该候选已经处理，可返回{" "}
          <Link href="/admin/discovery" className="underline">
            候选列表
          </Link>{" "}
          继续处理其他项目。仍可在下方补记判断样本。
        </p>
      ) : null}

      <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-sky-950 dark:text-sky-100">
              Decision
            </h3>
            <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-200/80">
              记录人的判断，用于后续 Learning Loop。先选结构化原因，再补充说明。
            </p>
          </div>
          <Link
            href="/admin/discovery/feedback"
            className="text-xs text-sky-800 underline-offset-2 hover:underline dark:text-sky-200"
          >
            查看反馈数据
          </Link>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <fieldset>
            <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              第一层：判断类型
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DECISION_OPTIONS.map((item) => (
                <label
                  key={item.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    decision === item.value
                      ? "border-sky-600 bg-white text-sky-950 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-100"
                      : "border-zinc-200 bg-white/70 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="discovery-feedback-decision"
                    checked={decision === item.value}
                    onChange={() => {
                      setDecision(item.value);
                      setSelectedTags([]);
                    }}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                最终实体类型
              </span>
              <select
                value={finalEntityType}
                onChange={(event) => setFinalEntityType(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                最终主来源
              </span>
              <input
                value={finalPrimarySource}
                onChange={(event) => setFinalPrimarySource(event.target.value)}
                placeholder="例如 GitHub / HuggingFace / 官网 URL"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            第二层：Reason Tags
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {reasonTags.map((tag) => {
              const active = selectedTags.includes(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => toggleTag(tag.value)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-sky-600 bg-sky-100 text-sky-950 dark:border-sky-500 dark:bg-sky-900/60 dark:text-sky-100"
                      : "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            判断说明（建议填写）
          </span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder={
              "请说明判断依据。\n例如：ForgeTrain 是训练方法，不是独立项目。\nUltraData 的真实性来源应为 HuggingFace Collection。"
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onSubmitFeedback}
            className="rounded-lg border border-sky-700 bg-white px-4 py-2 text-sm font-medium text-sky-900 disabled:opacity-50 dark:border-sky-500 dark:bg-sky-950/30 dark:text-sky-100"
          >
            {pending ? "提交中..." : "提交判断"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !canMutate}
          onClick={onApprove}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          接受导入
        </button>
        <button
          type="button"
          disabled={pending || !canMutate}
          onClick={onReject}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
        >
          拒绝导入
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">合并到已有项目</p>
        <p className="mt-1 text-xs text-zinc-500">
          填写已有项目的 <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">id</code>。
          合并操作会先写入 MERGE 判断样本。
        </p>
        <input
          className="mt-2 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="项目 CUID"
          value={mergeProjectId}
          onChange={(event) => setMergeProjectId(event.target.value)}
        />
        <button
          type="button"
          disabled={pending || !canMutate}
          onClick={onMerge}
          className="mt-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
        >
          合并到已有项目
        </button>
      </div>

      {message ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}
    </div>
  );
}
