"use server";

import { Prisma, SocialPlatform } from "@prisma/client";
import { redirect } from "next/navigation";
import { parseSocialInput } from "@/lib/social-input";
import { prisma } from "@/lib/prisma";

export type CreateProjectFormState = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const initialFail: CreateProjectFormState = { ok: false };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function createProject(
  _prev: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ok: false,
      formError: "未配置 DATABASE_URL，无法写入数据库。请在 .env 中配置 PostgreSQL 连接串并执行迁移。",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim().toLowerCase();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const githubUrlRaw = String(formData.get("githubUrl") ?? "").trim();
  const websiteUrlRaw = String(formData.get("websiteUrl") ?? "").trim();

  const fieldErrors: Partial<Record<string, string>> = {};

  if (!name) {
    fieldErrors.name = "请填写项目名称";
  }
  if (!slugInput) {
    fieldErrors.slug = "请填写 slug";
  } else if (!SLUG_PATTERN.test(slugInput)) {
    fieldErrors.slug =
      "slug 仅允许小写字母、数字与短横线（-），不能以短横线开头或结尾，且不能连续出现多个短横线";
  }

  let githubUrl: string | null = null;
  if (githubUrlRaw) {
    try {
      githubUrl = new URL(githubUrlRaw).href;
    } catch {
      fieldErrors.githubUrl = "GitHub URL 格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  let websiteUrl: string | null = null;
  if (websiteUrlRaw) {
    try {
      websiteUrl = new URL(websiteUrlRaw).href;
    } catch {
      fieldErrors.websiteUrl = "官网 URL 格式不正确，请以 http:// 或 https:// 开头的完整地址";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ...initialFail, fieldErrors };
  }

  const slug = slugInput;

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

  try {
    await prisma.project.create({
      data: {
        name,
        slug,
        tagline,
        description,
        githubUrl,
        websiteUrl,
        status: "ACTIVE",
        isPublic: true,
        socialAccounts:
          socialCreates.length > 0
            ? {
                create: socialCreates,
              }
            : undefined,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;
      const t = Array.isArray(target) ? target.join(",") : String(target ?? "");
      if (t.includes("slug")) {
        return {
          ...initialFail,
          fieldErrors: { slug: "该 slug 已被使用，请更换其他标识" },
        };
      }
      return {
        ...initialFail,
        formError: "数据冲突：请检查唯一字段（如 slug）是否与其他项目重复。",
      };
    }
    console.error("[createProject]", e);
    return {
      ...initialFail,
      formError:
        "数据库写入失败，请稍后重试。若持续出现，请确认数据库可连接且已执行 `pnpm exec prisma migrate deploy`。",
    };
  }

  redirect(`/projects/${slug}`);
}
