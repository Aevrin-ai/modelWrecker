import type { ListFilter } from "./client";

// { projectId: "p1", q: undefined } -> "?projectId=p1"; empty values are left out
export function buildQuery(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) searchParams.set(key, value);
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function buildFilterQuery(filter?: ListFilter): string {
  return buildQuery({
    projectId: filter?.projectId,
    campaignId: filter?.campaignId,
    targetId: filter?.targetId,
    q: filter?.query,
  });
}
