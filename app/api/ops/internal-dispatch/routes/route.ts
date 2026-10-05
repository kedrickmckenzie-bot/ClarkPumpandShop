import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { getRoutingProvider } from "@/lib/server/routing-provider";
import { OpsDomainError } from "@/lib/ops/errors";
import { resolveRouteLegs, type RoutePoint } from "@/lib/ops/route-legs";

/**
 * Store locations and cached driving legs for the Dispatch map.
 * Body: { sequences: string[][] } — each tech's stops as store ids, in order.
 */
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional", "executive"]);
    const scope = await internalDispatchScope(context.repository, context.session);
    const body = await request.json().catch(() => null) as { sequences?: unknown } | null;
    const sequences = Array.isArray(body?.sequences) ? body.sequences : null;
    if (!sequences || sequences.length > 60 || !sequences.every(list => Array.isArray(list) && list.length <= 40 && list.every(id => typeof id === "string" && id.length <= 120)))
      throw new OpsDomainError("VALIDATION", "Send up to 60 lists of store ids.");
    const ids = [...new Set((sequences as string[][]).flat())].slice(0, 100);
    const stores = (await Promise.all(ids.map(id => context.repository.getStore(scope.organizationId, id))))
      .filter((store): store is NonNullable<typeof store> => Boolean(store
        && (!scope.storeIds || scope.storeIds.includes(store.id))
        && (!scope.regionIds || (store.regionId !== undefined && scope.regionIds.includes(store.regionId)))));
    const located = new Map(stores.filter(s => s.latitudeE6 != null && s.longitudeE6 != null).map(s => [s.id, { latE6: s.latitudeE6!, lngE6: s.longitudeE6! } satisfies RoutePoint]));
    const pairs = (sequences as string[][]).flatMap(list => list.slice(1).map((id, i) => ({ from: located.get(list[i]), to: located.get(id) })))
      .filter((p): p is { from: RoutePoint; to: RoutePoint } => Boolean(p.from && p.to));
    const provider = getRoutingProvider();
    const result = await resolveRouteLegs(context.repository, scope.organizationId, pairs, provider, { now: new Date().toISOString(), newId: () => `route-leg-${crypto.randomUUID()}` });
    return Response.json({
      enabled: Boolean(provider),
      stores: stores.map(s => ({ id: s.id, number: s.storeNumber, name: s.name, latE6: s.latitudeE6 ?? null, lngE6: s.longitudeE6 ?? null })),
      legs: result.legs.map(l => ({ fromLatE6: l.fromLatE6, fromLngE6: l.fromLngE6, toLatE6: l.toLatE6, toLngE6: l.toLngE6, distanceM: l.distanceM, durationS: l.durationS, geometry: l.geometry })),
      pending: result.pending,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return opsApiError(error);
  }
}
