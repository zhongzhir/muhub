const MAX_SEARCH_QUERY_LENGTH = 100;

export function normalizeProjectSearchQuery(input: string | null | undefined): string {
  const q = (input ?? "").trim();
  if (!q) {
    return "";
  }
  return q.slice(0, MAX_SEARCH_QUERY_LENGTH);
}
