import { NextResponse } from "next/server";

/** 负载均衡 / 平台探活：不访问数据库 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
