import {
  approveDiscoveryCandidateImport,
  ignoreDiscoveryCandidate,
  rejectDiscoveryCandidate,
} from "@/lib/discovery/import-candidate";

export type BulkCandidateItemResult = {
  id: string;
  success: boolean;
  reason?: string;
};

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export async function bulkRejectDiscoveryCandidates(
  ids: string[],
  reviewerUserId: string,
): Promise<BulkCandidateItemResult[]> {
  const out: BulkCandidateItemResult[] = [];
  for (const id of uniqueIds(ids)) {
    try {
      await rejectDiscoveryCandidate(id, reviewerUserId);
      out.push({ id, success: true });
    } catch (e) {
      out.push({
        id,
        success: false,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}

export async function bulkIgnoreDiscoveryCandidates(
  ids: string[],
  reviewerUserId: string,
): Promise<BulkCandidateItemResult[]> {
  const list = uniqueIds(ids);
  const out: BulkCandidateItemResult[] = [];
  for (const id of list) {
    try {
      await ignoreDiscoveryCandidate(id, reviewerUserId);
      out.push({ id, success: true });
    } catch (e) {
      out.push({
        id,
        success: false,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}

export async function bulkApproveDiscoveryCandidates(
  ids: string[],
  reviewerUserId: string,
): Promise<BulkCandidateItemResult[]> {
  const out: BulkCandidateItemResult[] = [];
  for (const id of uniqueIds(ids)) {
    try {
      await approveDiscoveryCandidateImport(id, reviewerUserId);
      out.push({ id, success: true });
    } catch (e) {
      out.push({
        id,
        success: false,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}
