import { readFileSync } from "fs";
import { join } from "path";
import { test, expect } from "@playwright/test";
import { parseRepoUrl } from "@/lib/repo-platform";

type SeedRow = {
  slug: string;
  repoUrl: string;
  name: string;
};

test.describe("种子数据 seed-projects.json", () => {
  test("每项 repoUrl 可被解析，且不少于 6 条", () => {
    const raw = readFileSync(join(process.cwd(), "data", "seed-projects.json"), "utf8");
    const arr = JSON.parse(raw) as SeedRow[];
    expect(arr.length).toBeGreaterThanOrEqual(6);

    const platforms = new Set<string>();
    for (const row of arr) {
      expect(row.slug?.trim(), `slug 为空：${JSON.stringify(row)}`).toBeTruthy();
      expect(row.name?.trim(), `name 为空：${row.slug}`).toBeTruthy();
      const p = parseRepoUrl(row.repoUrl);
      expect(p, `${row.slug} 的 repoUrl 无法解析: ${row.repoUrl}`).not.toBeNull();
      if (p) {
        platforms.add(p.platform);
      }
    }
    expect(platforms.has("github"), "应至少含一条 GitHub").toBe(true);
    expect(platforms.has("gitee"), "应至少含一条 Gitee").toBe(true);
  });
});
