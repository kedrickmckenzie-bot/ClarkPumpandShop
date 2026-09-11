import "server-only";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "./operator-loader";
import { getRequestOpsFixtureSnapshot } from "./request-data";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";

export async function loadWorkPrices(workOrderId: string, options: { peers?: boolean; unit?: boolean; kind?: "repair" | "replace"; page?: number } = {}) {
  const session = await loadOperatorSession();
  const [fixture, repository] = await Promise.all([getRequestOpsFixtureSnapshot(session.organizationId), getServerOpsRepository()]);
  const stores = fixture.stores.filter(row => row.organizationId === session.organizationId
    && (session.storeIds === undefined || session.storeIds.includes(row.id))
    && (session.regionIds === undefined || !!row.regionId && session.regionIds.includes(row.regionId)));
  const work = fixture.workOrders.find(row => row.organizationId === session.organizationId && row.id === workOrderId && stores.some(store => store.id === row.storeId));
  if (!work) notFound();
  const asset = fixture.assets.find(row => row.organizationId === session.organizationId && row.id === work.assetId);
  const from = new Date(fixture.asOf); from.setUTCFullYear(from.getUTCFullYear() - 1);
  const fromDate = from.toISOString().slice(0,10), toDate = fixture.asOf.slice(0,10);
  const workIds = new Set(fixture.workOrders.filter(row => row.organizationId === session.organizationId && (asset ? row.assetId === asset.id : row.id === work.id)).map(row => row.id));
  const costs = fixture.costLines.filter(row => row.organizationId === session.organizationId && workIds.has(row.workOrderId) && row.serviceDate.slice(0,10) >= fromDate && row.serviceDate.slice(0,10) <= toDate);
  const currencies = [...new Set(costs.map(row => row.amount.currency))];
  const spend = currencies.map(currency => ({ currency, amountMinor: costs.filter(row => row.amount.currency === currency).reduce((sum,row) => sum + row.amount.amountMinor, 0) }));
  const page = Number.isSafeInteger(options.page) && options.page! > 0 ? Math.min(options.page!, 100_000) : 1;
  const history = await repository.listWorkPrices(session.organizationId, { ...(options.peers && asset?.replacementProfileId ? { profileId: asset.replacementProfileId } : options.unit && asset ? {assetId:asset.id} : { workOrderId: work.id }), storeIds: stores.map(row => row.id), kind: options.kind, limit: 20, offset: (page - 1) * 20 });
  return { session, work, asset, groupName: fixture.replacementProfiles.find(row=>row.organizationId===session.organizationId && row.id===asset?.replacementProfileId)?.name, stores, page, history, spend, fromDate, toDate, hasCosts: costs.length > 0, costs: costs.sort((a,b)=>b.serviceDate.localeCompare(a.serviceDate)||b.id.localeCompare(a.id)),
    vendors: fixture.vendors.filter(row => row.organizationId === session.organizationId && row.status !== "inactive"),
    workById: new Map(fixture.workOrders.filter(row => row.organizationId === session.organizationId).map(row => [row.id, row])),
    canRecord: ["facilities", "regional"].includes(session.role) && !["closed", "cancelled"].includes(work.status),
    canPlan: session.role === "facilities" && session.storeIds === undefined && session.regionIds === undefined,
  };
}
