"use server";

import type { ProjectSourceKind } from "@prisma/client";
import { Prisma, SocialPlatform } from "@prisma/client";
import { auth } from "@/auth";
import { scheduleProjectAiEnrichment } from "@/lib/ai/enrich-project";
import { inferRepoSourceKind, normalizeSourceUrl } from "@/lib/project-sources";
import { parseSocialInput } from "@/lib/social-input";
import { prisma } from "@/lib/prisma";
import { getProjectSourceById } from "@/agents/sources/source-registry";
import { fallbackSlugBase, isValidProjectSlug, slugifyProjectName } from "@/lib/project-slug";
import { parseProjectSourceRowsJson } from "@/app/dashboard/projects/new/prefill";

export type CreateProjectFormState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** 创建成功：客户端 router.push，避免 useActionState 下 redirect 不生效 */
  redirectPath?: string;
  /** 创建成功时带回 slug，供导入页等展示管理链接（不写库） */
  createdSlug?: string;
};

const initialFail: CreateProjectFormState = { ok: false };

const isProduction = process.env.NODE_ENV === "production";

async function allocateUniqueSlug(base: string): Promise<string> {
  let b = base;
  if (!b) {
    b = fallbackSlugBase();
  }
  let candidate = b;
  let n = 2;
  for (;;) {
    const row = await prisma.project.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!row) {
      return candidate;
    }
    candidate = `${b}-${n}`;
    n += 1;
    if (n > 10_000) {
      throw new Error("allocateUniqueSlug: too many collisions");
    }
  }
}

export async function createProject(
  _prev: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ...initialFail, formError: "请先登录后再创建项目。" };
  }
  const ownerId = session.user.id;

  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ok: false,
      formError: isProduction
        ? "创建功能正在配置中\n\n项目创建功能暂时不可用。若你希望抢先试用或申请收录项目，请通过首页或页脚的「反馈建议」联系我们。"
        : "未配置 DATABASE_URL，无法写入数据库。请在 .env 中配置 PostgreSQL 连接串并执行迁移。",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugOverrideRaw = String(formData.get("slugOverride") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  let description = String(formData.get("description") ?? "").trim() || null;
  const githubUrlRaw = String(formData.get("githubUrl") ?? "").trim();
  const giteeUrlRaw = String(formData.get("giteeUrl") ?? "").trim();
  const websiteUrlRaw = String(formData.get("websiteUrl") ?? "").trim();
  const docsUrlRaw = String(formData.get("docsUrl") ?? "").trim();
  const blogUrlRaw = String(formData.get("blogUrl") ?? "").trim();
  const twitterUrlRaw = String(formData.get("twitterUrl") ?? "").trim();

  const fieldErrors: Partial<Record<string, string>> = {};

  if (!name) {
    fieldErrors.name = "请填写项目名称";
  }

  let baseSlug: string | undefined;
  if (slugOverrideRaw) {
    baseSlug = slugifyProjectName(slugOverrideRaw);
    if (!baseSlug || !isValidProjectSlug(baseSlug)) {
      fieldErrors.slugOverride =
        "自定义地址无效：请使用中文、英文字母、数字与短横线，且不要将短横线放在首尾";
    }
  } else if (name) {
    baseSlug = slugifyProjectName(name);
    if (!baseSlug) {
      fieldErrors.name = "项目名称需包含可用的中文、字母或数字，以便生成页面地址";
    } else if (!isValidProjectSlug(baseSlug)) {
      fieldErrors.name = "项目名称生成的地址不合法，请微调名称后重试";
      baseSlug = undefined;
    }
  }

  let githubUrl: string | null = null;
  if (githubUrlRaw) {
    try {
      githubUrl = new URL(githubUrlRaw).href;
    } catch {
      fieldErrors.githubUrl = "GitHub 仓库链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  let websiteUrl: string | null = null;
  if (websiteUrlRaw) {
    try {
      websiteUrl = new URL(websiteUrlRaw).href;
    } catch {
      fieldErrors.websiteUrl = "官网链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  let giteeUrl: string | null = null;
  if (giteeUrlRaw) {
    try {
      giteeUrl = new URL(giteeUrlRaw).href;
    } catch {
      fieldErrors.giteeUrl = "Gitee 仓库链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  let docsUrl: string | null = null;
  if (docsUrlRaw) {
    try {
      docsUrl = new URL(docsUrlRaw).href;
    } catch {
      fieldErrors.docsUrl = "文档站链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  let blogUrl: string | null = null;
  if (blogUrlRaw) {
    try {
      blogUrl = new URL(blogUrlRaw).href;
    } catch {
      fieldErrors.blogUrl = "博客链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  let twitterUrl: string | null = null;
  if (twitterUrlRaw) {
    try {
      twitterUrl = new URL(twitterUrlRaw).href;
    } catch {
      fieldErrors.twitterUrl = "社媒主页链接格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ...initialFail, fieldErrors };
  }

  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw
    ? tagsRaw
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 64)
    : [];

  const growthSourceId = String(formData.get("growthSourceId") ?? "").trim();
  const importNotes = String(formData.get("importNotes") ?? "").trim();

  const metaLines: string[] = [];
  if (growthSourceId) {
    const growthSrc = getProjectSourceById(growthSourceId);
    metaLines.push(
      growthSrc
        ? `【增长来源】${growthSrc.name}（${growthSourceId}）`
        : `【增长来源】${growthSourceId}`,
    );
  }
  if (importNotes) {
    metaLines.push(`【运营备注】${importNotes}`);
  }
  if (metaLines.length > 0) {
    const meta = metaLines.join("\n");
    description = description ? `${description}\n\n${meta}` : meta;
  }

  let slug: string;
  try {
    slug = await allocateUniqueSlug(baseSlug ?? fallbackSlugBase());
  } catch {
    return {
      ...initialFail,
      formError: "无法生成唯一页面地址，请稍后重试或调整项目名称。",
    };
  }

  const creationSource = String(formData.get("creationSource") ?? "").trim();
  const sourceType = creationSource === "import" ? "import" : "manual";

  const socialSpecs: { platform: SocialPlatform; raw: string }[] = [
    { platform: "WEIBO", raw: String(formData.get("weibo") ?? "") },
    { platform: "WECHAT_OFFICIAL", raw: String(formData.get("wechat_official") ?? "") },
    { platform: "DOUYIN", raw: String(formData.get("douyin") ?? "") },
    { platform: "XIAOHONGSHU", raw: String(formData.get("xiaohongshu") ?? "") },
  ];

  const socialCreates = socialSpecs
    .map(({ platform, raw }) => {
      const parsed = parseSocialInput(raw);
      if (!parsed) {
        return null;
      }
      return {
        platform,
        accountName: parsed.accountName,
        accountUrl: parsed.accountUrl,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const projectSourceRows: { kind: ProjectSourceKind; url: string; isPrimary: boolean }[] = [];
  if (githubUrl) {
    projectSourceRows.push({
      kind: inferRepoSourceKind(githubUrl),
      url: githubUrl,
      isPrimary: true,
    });
  }
  if (
    giteeUrl &&
    (!githubUrl || normalizeSourceUrl(giteeUrl) !== normalizeSourceUrl(githubUrl))
  ) {
    projectSourceRows.push({
      kind: "GITEE",
      url: giteeUrl,
      isPrimary: !githubUrl,
    });
  }
  if (websiteUrl) {
    projectSourceRows.push({ kind: "WEBSITE", url: websiteUrl, isPrimary: false });
  }
  if (docsUrl) {
    projectSourceRows.push({ kind: "DOCS", url: docsUrl, isPrimary: false });
  }
  if (blogUrl) {
    projectSourceRows.push({ kind: "BLOG", url: blogUrl, isPrimary: false });
  }
  if (twitterUrl) {
    projectSourceRows.push({ kind: "TWITTER", url: twitterUrl, isPrimary: false });
  }

  const extraSourcesJson = String(formData.get("extraSourcesJson") ?? "").trim();
  for (const row of parseProjectSourceRowsJson(extraSourcesJson)) {
    projectSourceRows.push({ kind: row.kind, url: row.url, isPrimary: false });
  }

  const dedupedSources: typeof projectSourceRows = [];
  const seenUrl = new Set<string>();
  for (const row of projectSourceRows) {
    const key = `${row.kind}:${normalizeSourceUrl(row.url)}`;
    if (seenUrl.has(key)) continue;
    seenUrl.add(key);
    dedupedSources.push(row);
  }

  try {
    await prisma.project.create({
      data: {
        name,
        slug,
        tagline,
        description,
        tags,
        githubUrl,
        websiteUrl,
        sourceType,
        status: "ACTIVE",
        isPublic: false,
        visibilityStatus: "DRAFT",
        createdById: ownerId,
        socialAccounts:
          socialCreates.length > 0
            ? {
                create: socialCreates,
              }
            : undefined,
        sources:
          dedupedSources.length > 0
            ? {
                create: dedupedSources,
              }
            : undefined,
      },
    });
    scheduleProjectAiEnrichment(slug);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;
      const t = Array.isArray(target) ? target.join(",") : String(target ?? "");
      if (t.includes("slug")) {
        return {
          ...initialFail,
          formError: "页面地址与他人冲突，请修改项目名称或在高级选项中调整自定义地址后重试。",
        };
      }
      return {
        ...initialFail,
        formError: isProduction
          ? "保存失败：数据与其他项目冲突，请调整后重试。"
          : "数据冲突：请检查唯一字段（如项目访问地址）是否与其他项目重复。",
      };
    }
    console.error("[createProject]", e);
    return {
      ...initialFail,
      formError: isProduction
        ? "保存失败，请稍后重试。若问题持续，可通过首页或页脚的「反馈建议」联系我们。"
        : "数据库写入失败，请稍后重试。若持续出现，请确认数据库可连接且已执行 `pnpm exec prisma migrate deploy`。",
    };
  }

  return { ok: true, redirectPath: `/projects/${slug}`, createdSlug: slug };
}
