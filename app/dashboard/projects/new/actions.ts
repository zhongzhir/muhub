"use server";

import type { ProjectSourceKind } from "@prisma/client";
import { Prisma, SocialPlatform } from "@prisma/client";
import { redirect } from "next/navigation";
import { scheduleProjectAiEnrichment } from "@/lib/ai/enrich-project";
import { inferRepoSourceKind, normalizeSourceUrl } from "@/lib/project-sources";
import { parseSocialInput } from "@/lib/social-input";
import { prisma } from "@/lib/prisma";

export type CreateProjectFormState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const initialFail: CreateProjectFormState = { ok: false };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isProduction = process.env.NODE_ENV === "production";

export async function createProject(
  _prev: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ok: false,
      formError: isProduction
        ? "创建功能正在配置中\n\n项目创建功能暂时不可用。若你希望抢先试用或申请收录项目，请通过首页或页脚的「反馈建议」联系我们。"
        : "未配置 DATABASE_URL，无法写入数据库。请在 .env 中配置 PostgreSQL 连接串并执行迁移。",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim().toLowerCase();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
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
  if (!slugInput) {
    fieldErrors.slug = "请填写项目访问地址（路径后缀）";
  } else if (!SLUG_PATTERN.test(slugInput)) {
    fieldErrors.slug =
      "地址后缀仅允许小写字母、数字与短横线（-），不能以短横线开头或结尾，且不能连续出现多个短横线";
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

  const slug = slugInput;

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
        githubUrl,
        websiteUrl,
        sourceType,
        status: "ACTIVE",
        isPublic: true,
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
          fieldErrors: { slug: "该地址已被使用，请换一个后缀" },
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

  redirect(`/projects/${slug}`);
}
