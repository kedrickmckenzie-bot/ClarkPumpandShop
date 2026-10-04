import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { calendarDate } from "@/lib/ops/dispatch-calendar";
import { dispatchJob } from "@/lib/ops/dispatch-board";
import { dispatchStatuses } from "@/lib/server/dispatch-board-page";
import type { WorkOrderListQuery } from "@/lib/ops/repository";

export async function GET(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "executive"], undefined, request);
    const scope = await internalDispatchScope(context.repository, context.session);
    const query = new URL(request.url).searchParams;
    const day = calendarDate(query.get("day") ?? "");
    const bucket = query.get("bucket") ?? "";
    const page = await context.repository.listWorkOrders(scope, { internalOnly: true, maintenanceTeamOnly: true, statuses: dispatchStatuses,
      scheduleView: "week", scheduleFrom: day, scheduleTo: day, search: (query.get("q") ?? "").slice(0, 120),
      regionId: query.get("region") || undefined, storeId: query.get("store") || undefined,
      internalMembershipId: query.get("person") || undefined, dispatchUnassigned: query.get("unassigned") === "yes",
      dispatchBucket: ["parts", "late", "reported", "unassigned"].includes(bucket) ? bucket as WorkOrderListQuery["dispatchBucket"] : undefined,
      limit: 25, cursor: query.get("cursor") || undefined });
    const stores = await Promise.all([...new Set(page.items.map(row => row.storeId))].map(id => context.repository.getStore(scope.organizationId, id)));
    const zones = new Map(stores.filter(store => store !== null).map(store => [store.id, store.timeZone]));
    return Response.json({ ...page, items: page.items.map(row => dispatchJob(row, zones.get(row.storeId))) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsApiError(error); }
}
