import { runRssDiscovery } from "../agents/discovery/rss/rss-discovery";

async function main(): Promise<void> {
  await runRssDiscovery();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
