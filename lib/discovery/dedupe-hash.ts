import { createHash } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function discoveryDedupeHashFromNormalizedKey(normalizedKey: string): string {
  return sha256Hex(normalizedKey.trim().toLowerCase());
}
