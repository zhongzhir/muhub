"use server";

import { appendPendingImport } from "@/agents/import/pending-import-store";
import type { ImportCandidate } from "@/agents/import/import-types";
import {
  importCandidateToCreateProjectFormData,
  normalizeExternalProjectUrl,
  parseTagsInput,
} from "@/agents/import/normalize-import-candidate";
import { getProjectSourceById } from "@/agents/sources/source-registry";
import { auth } from "@/auth";
import {
  createProject,
  type CreateProjectFormState,
} from "@/app/dashboard/projects/new/actions";

export type ImportExternalProjectState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** created：已写库；pending：仅写入 data/pending-external-imports.json */
  mode?: "created" | "pending";
  slug?: string;
};

const initialFail: ImportExternalProjectState = { ok: false };

const createInitial: CreateProjectFormState = { ok: false };

/**
 * 供 Growth / 未来 OCR 等调用：候选 → 与手动创建相同的写库路径。
 * V1.1：委托 createProject + FormData；后续若创建逻辑抽成 lib，只需改此处。
 */
export async function createProjectFromImportCandidate(
  candidate: ImportCandidate,
): Promise<CreateProjectFormState> {
  const fd = importCandidateToCreateProjectFormData(candidate);
  return createProject(createInitial, fd);
}

export async function submitImportExternalProject(
  _prev: ImportExternalProjectState,
  formData: FormData,
): Promise<ImportExternalProjectState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ...initialFail, formError: "请先登录后再导入项目。" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || undefined;
  const urlRaw = String(formData.get("url") ?? "").trim();
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  /** 勾选「仅保存为待导入」时提交 */
  const deferOnly = formData.get("deferOnly") === "on";

  const fieldErrors: Partial<Record<string, string>> = {};

  if (!name) {
    fieldErrors.name = "请填写项目名称";
  }

  if (!urlRaw) {
    fieldErrors.url = "请填写项目官网或仓库链接";
  }

  const urlNorm = urlRaw ? normalizeExternalProjectUrl(urlRaw) : null;
  if (urlRaw && urlNorm && !urlNorm.ok) {
    fieldErrors.url = urlNorm.message;
  }

  if (!sourceId) {
    fieldErrors.sourceId = "请选择来源";
  } else {
    const src = getProjectSourceById(sourceId);
    if (!src || !src.enabled) {
      fieldErrors.sourceId = "来源无效或已停用";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ...initialFail, fieldErrors };
  }

  if (!urlNorm?.ok) {
    return { ...initialFail, formError: "链接无效，请检查后重试。" };
  }
  const href = urlNorm.href;

  const src = getProjectSourceById(sourceId)!;
  const tags = tagsRaw ? parseTagsInput(tagsRaw) : undefined;

  const candidate: ImportCandidate = {
    name,
    description,
    url: href,
    tags,
    sourceId,
    sourceLabel: src.name,
    notes,
    rawInputType: "manual-form",
  };

  if (deferOnly) {
    try {
      await appendPendingImport(candidate);
    } catch (e) {
      console.error("[submitImportExternalProject] pending file write failed", e);
      return {
        ...initialFail,
        formError: "保存待导入记录失败，请检查 data 目录写权限或稍后重试。",
      };
    }
    return { ok: true, mode: "pending" };
  }

  const fd = importCandidateToCreateProjectFormData(candidate);
  const created = await createProject(createInitial, fd);
  if (!created.ok) {
    return {
      ok: false,
      formError: created.formError,
      fieldErrors: mapCreateFieldErrorsToImportForm(created.fieldErrors),
    };
  }

  const slug =
    created.createdSlug ??
    (() => {
      const m = /\/projects\/([^/]+)$/.exec(created.redirectPath ?? "");
      return m?.[1];
    })();

  return { ok: true, mode: "created", slug };
}

function mapCreateFieldErrorsToImportForm(
  fe: CreateProjectFormState["fieldErrors"],
): ImportExternalProjectState["fieldErrors"] {
  if (!fe) {
    return undefined;
  }
  const out: ImportExternalProjectState["fieldErrors"] = {};
  if (fe.name) {
    out.name = fe.name;
  }
  if (fe.githubUrl || fe.giteeUrl || fe.websiteUrl) {
    out.url = fe.githubUrl ?? fe.giteeUrl ?? fe.websiteUrl;
  }
  if (fe.description) {
    out.description = fe.description;
  }
  return out;
}
