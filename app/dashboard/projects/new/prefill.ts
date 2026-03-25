import { getRecommendedProjectBySlug } from "@/lib/recommended-projects";

export type NewProjectPrefill = {
  name: string;
  tagline: string;
  slug: string;
  githubUrl: string;
  websiteUrl: string;
  /** import → 写库 `sourceType=import`，否则 manual */
  creationSource: string;
};

export function pickSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = sp[key];
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && v[0] !== undefined) {
    return v[0];
  }
  return "";
}

/** 合并 query 与「推荐项目认领」预填（`from=recommended&slug=`） */
export function resolveNewProjectPrefill(
  sp: Record<string, string | string[] | undefined>,
): NewProjectPrefill {
  const fromRecommended = pickSearchParam(sp, "from") === "recommended";
  const recSlug = pickSearchParam(sp, "slug").trim();

  if (fromRecommended && recSlug) {
    const rec = getRecommendedProjectBySlug(recSlug);
    if (rec) {
      return {
        name: rec.name,
        tagline: rec.tagline,
        slug: rec.slug,
        githubUrl: `https://github.com/${rec.github}`,
        websiteUrl: "",
        creationSource: pickSearchParam(sp, "creationSource").trim() || "manual",
      };
    }
  }

  const githubFromImport = pickSearchParam(sp, "import").trim();
  const githubUrlParam = pickSearchParam(sp, "githubUrl").trim();
  const creationSource = pickSearchParam(sp, "creationSource").trim();

  return {
    name: pickSearchParam(sp, "name"),
    tagline: pickSearchParam(sp, "tagline"),
    slug: pickSearchParam(sp, "slug"),
    githubUrl: githubUrlParam || githubFromImport,
    websiteUrl: pickSearchParam(sp, "websiteUrl"),
    creationSource: creationSource || "manual",
  };
}
