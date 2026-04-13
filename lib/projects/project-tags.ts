const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 24;

function normalizeTag(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (!t) {
    return null;
  }
  const compact = t.replace(/[^\p{L}\p{N}-]/gu, "");
  if (!compact) {
    return null;
  }
  return compact.slice(0, MAX_TAG_LENGTH);
}

export function parseProjectTags(input: string): string[] {
  const rawParts = input.split(/[,，]/g);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of rawParts) {
    const n = normalizeTag(part);
    if (!n || seen.has(n)) {
      continue;
    }
    seen.add(n);
    out.push(n);
    if (out.length >= MAX_TAGS) {
      break;
    }
  }
  return out;
}

export function formatProjectTagsInput(tags: string[] | null | undefined): string {
  if (!tags?.length) {
    return "";
  }
  return tags.join(", ");
}

export function parseSingleProjectTag(input: string | null | undefined): string | null {
  if (!input?.trim()) {
    return null;
  }
  return parseProjectTags(input)[0] ?? null;
}
