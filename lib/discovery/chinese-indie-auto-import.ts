import {
  updateDiscoveryItemMeta,
  updateDiscoveryStatus,
} from "@/agents/discovery/discovery-store";
import { prisma } from "@/lib/prisma";

export async function rollbackChineseIndieAutoImport(input: {
  discoveryItemId: string;
  projectId: string;
  error: string;
}): Promise<void> {
  const message = input.error.slice(0, 500);
  await prisma.project.update({
    where: { id: input.projectId },
    data: { deletedAt: new Date() },
  });
  await updateDiscoveryItemMeta(input.discoveryItemId, {
    aiEnrichmentStatus: "failed",
    aiEnrichmentError: message,
    needsReview: true,
  });
  await updateDiscoveryStatus(input.discoveryItemId, "reviewed");
}
