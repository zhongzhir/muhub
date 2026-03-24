/**
 * 将表单中的社媒输入解析为落库字段：
 * - 以 http(s) 开头 → 作为 accountUrl，accountName 取主机名或固定「链接」
 * - 否则 → accountName 为原文，无 URL
 */
export function parseSocialInput(raw: string | null | undefined): {
  accountName: string;
  accountUrl: string | null;
} | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) {
    return null;
  }
  const lower = v.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const u = new URL(v);
      const host = u.hostname.replace(/^www\./, "");
      const name = host || "链接";
      return { accountName: name, accountUrl: v };
    } catch {
      return { accountName: v, accountUrl: null };
    }
  }
  return { accountName: v, accountUrl: null };
}
