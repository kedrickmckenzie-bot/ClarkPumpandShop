import "server-only";

import { notFound } from "next/navigation";
import { NORTHLINE_DEMO_ENTRY_TOKENS } from "@/lib/ops/fixtures";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import { loadOperatorSession } from "./operator-loader";

export async function loadServiceRunWorkspace(serviceRunId?: string) {
  const [fixture, session] = await Promise.all([getRequestOpsFixtureSnapshot(), loadOperatorSession()]);
  if (!(["executive", "facilities", "regional", "finance"] as const).includes(session.role as "executive" | "facilities" | "regional" | "finance")) notFound();
  const organizationId = session.organizationId;
  const allowedStore = (storeId: string) => {
    const store = fixture.stores.find((row) => row.organizationId === organizationId && row.id === storeId);
    if (!store) return false;
    if (session.storeIds?.length && !session.storeIds.includes(store.id)) return false;
    if (session.regionIds?.length && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
    return true;
  };
  const runs = fixture.serviceRuns.filter((run) => {
    if (run.organizationId !== organizationId) return false;
    const stopStoreIds = fixture.routeStops.filter((stop) => stop.organizationId === organizationId && stop.serviceRunId === run.id).map((stop) => stop.storeId);
    return stopStoreIds.length > 0 && stopStoreIds.every(allowedStore);
  });
  const selected = serviceRunId ? runs.find((run) => run.id === serviceRunId) : undefined;
  if (serviceRunId && !selected) notFound();
  return {
    fixture, session, runs, selected,
    publicResponseHref: selected?.id === "service-run-summit-north-2026-08-24" ? `/public/service-run/${NORTHLINE_DEMO_ENTRY_TOKENS.serviceRunSummit}` : undefined,
  };
}
