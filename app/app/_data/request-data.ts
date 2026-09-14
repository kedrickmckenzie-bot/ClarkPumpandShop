import "server-only";
import { cache } from "react";
import { getServerOpsFixtureSnapshot, getServerOpsTrendsFixtureSnapshot } from "@/lib/server/ops-repository-provider";

// React discards these caches after the server render. Related panels share a
// tenant read, while the next request (including after a mutation) reads afresh.
// Commands, jobs and API handlers must use the uncached repository provider.
const readFixture = cache((organizationId: string) =>
  getServerOpsFixtureSnapshot(organizationId),
);
export function getRequestOpsFixtureSnapshot(organizationId: string) {
  return readFixture(organizationId);
}
export const getRequestOpsTrendsFixtureSnapshot = cache((organizationId: string) =>
  getServerOpsTrendsFixtureSnapshot(organizationId),
);
