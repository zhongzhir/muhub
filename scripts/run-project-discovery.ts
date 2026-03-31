import { runProjectDiscovery } from "@/agents/discovery/run-project-discovery";

async function main() {
  const result = await runProjectDiscovery();
  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[discovery] fatal", e);
  process.exit(1);
});
