import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardDiscoveryRedirect() {
  redirect("/admin/discovery/items");
}
