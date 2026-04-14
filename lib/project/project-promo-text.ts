export function buildProjectPromoText({
  name,
  summary,
  highlights,
  latestActivity,
  projectUrl,
}: {
  name: string;
  summary?: string | null;
  highlights?: string[];
  latestActivity?: {
    title?: string;
    type?: string;
  } | null;
  projectUrl: string;
}) {
  const lines: string[] = [];

  lines.push(`🚀 ${name}`);

  if (summary) {
    lines.push("");
    lines.push(summary);
  }

  if (highlights?.length) {
    lines.push("");
    lines.push("✨ Highlights");

    highlights.slice(0, 4).forEach((h) => {
      lines.push(`• ${h}`);
    });
  }

  if (latestActivity?.title) {
    lines.push("");
    lines.push("📢 最新动态");
    lines.push(latestActivity.title);
  }

  lines.push("");
  lines.push("🔗 查看项目");
  lines.push(projectUrl);

  return lines.join("\n");
}
