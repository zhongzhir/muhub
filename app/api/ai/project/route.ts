import { NextRequest, NextResponse } from "next/server";
import { fetchProjectSummary } from "@/lib/ai/project-api";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function run(githubUrl: string) {
  if (!githubUrl.trim()) {
    return jsonError("missing_github_url", 400);
  }
  const r = await fetchProjectSummary(githubUrl);
  if (!r.ok) {
    const status =
      r.error === "invalid_url" ? 400 : r.error === "repo_not_found" ? 404 : 502;
    return jsonError(r.error, status);
  }
  return NextResponse.json(r.data);
}

/** POST { "githubUrl": "https://github.com/owner/repo" } */
export async function POST(req: NextRequest) {
  let githubUrl = "";
  try {
    const body = (await req.json()) as { githubUrl?: unknown };
    githubUrl = typeof body.githubUrl === "string" ? body.githubUrl : "";
  } catch {
    return jsonError("invalid_json", 400);
  }
  return run(githubUrl);
}

/** GET /api/ai/project?githubUrl=… */
export async function GET(req: NextRequest) {
  const githubUrl = req.nextUrl.searchParams.get("githubUrl") ?? "";
  return run(githubUrl);
}
