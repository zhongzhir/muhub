import { runProjectDiscovery } from "@/agents/discovery/run-project-discovery";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.DISCOVERY_SECRET?.trim();
  if (!expected) {
    return new Response("Discovery not configured", { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret") ?? "";

  if (secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runProjectDiscovery();

  if (!result.ok) {
    return Response.json({ ok: false, result }, { status: 500 });
  }

  return Response.json({ ok: true, result });
}
