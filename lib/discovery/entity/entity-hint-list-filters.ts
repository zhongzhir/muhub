import type { Prisma } from "@prisma/client";
import { DISCOVERY_SCOPES } from "@/lib/discovery/discovery-scopes";
import { ENTITY_HINT_STATUSES, ENTITY_TYPES } from "@/lib/discovery/entity/types";

export type EntityHintListFilters = {
  status: "ALL" | (typeof ENTITY_HINT_STATUSES)[number];
  entityType: "ALL" | (typeof ENTITY_TYPES)[number];
  scope: "ALL" | (typeof DISCOVERY_SCOPES)[number];
  q: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

export function parseEntityHintListFilters(sp: SearchParams): EntityHintListFilters {
  const statusRaw = typeof sp.status === "string" ? sp.status.toUpperCase() : "ALL";
  const entityTypeRaw = typeof sp.entityType === "string" ? sp.entityType.toUpperCase() : "ALL";
  const scopeRaw = typeof sp.scope === "string" ? sp.scope : "ALL";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const status =
    statusRaw === "PENDING" ||
    statusRaw === "ACCEPTED" ||
    statusRaw === "REJECTED" ||
    statusRaw === "MERGED_LATER"
      ? statusRaw
      : "ALL";
  const entityType = (ENTITY_TYPES as readonly string[]).includes(entityTypeRaw)
    ? (entityTypeRaw as EntityHintListFilters["entityType"])
    : "ALL";
  const scope = (DISCOVERY_SCOPES as readonly string[]).includes(scopeRaw)
    ? (scopeRaw as EntityHintListFilters["scope"])
    : "ALL";

  return { status, entityType, scope, q };
}

export function buildEntityHintWhereInput(
  filters: EntityHintListFilters,
): Prisma.EntityHintWhereInput {
  const where: Prisma.EntityHintWhereInput = {
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.entityType !== "ALL" ? { entityType: filters.entityType } : {}),
    ...(filters.scope !== "ALL"
      ? {
          discoveryScopes: {
            array_contains: [filters.scope],
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { sourceTitle: { contains: filters.q, mode: "insensitive" } },
            { reason: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return where;
}

export function buildEntityHintListHref(input: EntityHintListFilters): string {
  const params = new URLSearchParams();
  if (input.status !== "ALL") {
    params.set("status", input.status);
  }
  if (input.entityType !== "ALL") {
    params.set("entityType", input.entityType);
  }
  if (input.scope !== "ALL") {
    params.set("scope", input.scope);
  }
  if (input.q) {
    params.set("q", input.q);
  }
  return `/admin/discovery/entities${params.toString() ? `?${params.toString()}` : ""}`;
}
