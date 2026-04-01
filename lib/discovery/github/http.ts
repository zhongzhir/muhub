export function githubDiscoveryHeaders(): Record<string, string> {
  const token =
    process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_ACCESS_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MUHUB-Discovery-V2",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
