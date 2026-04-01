import { prisma } from "@/lib/prisma";
import { fallbackSlugBase, isValidProjectSlug, slugifyProjectName } from "@/lib/project-slug";

/** 分配唯一项目 slug（与手动创建页逻辑一致） */
export async function allocateUniqueProjectSlug(baseRaw: string | null | undefined): Promise<string> {
  const slugified = baseRaw?.trim() ? slugifyProjectName(baseRaw.trim()) : "";
  const base = slugified && isValidProjectSlug(slugified) ? slugified : fallbackSlugBase();
  let candidate = base;
  let n = 2;
  for (;;) {
    const row = await prisma.project.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!row) {
      return candidate;
    }
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 10_000) {
      throw new Error("allocateUniqueProjectSlug: too many collisions");
    }
  }
}
