import type { OpsRepository } from "./repository";

/** A point in millionths of a degree, as stores keep their coordinates. */
export interface RoutePoint { latE6: number; lngE6: number }

/** One cached drive between two points. Typical-day timing, not live traffic. */
export interface RouteLeg {
  id: string;
  organizationId: string;
  fromLatE6: number;
  fromLngE6: number;
  toLatE6: number;
  toLngE6: number;
  distanceM: number;
  durationS: number;
  /** Encoded polyline with 6-digit precision (lat/lng order). */
  geometry: string;
  provider: string;
  fetchedAt: string;
}

/** Any road-routing service: OSRM today, a traffic-aware provider later. */
export interface RoutingProvider {
  name: string;
  route(from: RoutePoint, to: RoutePoint): Promise<{ distanceM: number; durationS: number; geometry: string }>;
}

export const legKey = (from: RoutePoint, to: RoutePoint) => `${from.latE6},${from.lngE6}>${to.latE6},${to.lngE6}`;

/**
 * Returns cached legs for the requested pairs and looks up a limited number of missing ones.
 * Stores never move, so each pair is fetched once; `pending` counts pairs left for a later request.
 */
export async function resolveRouteLegs(
  repository: OpsRepository,
  organizationId: string,
  pairs: { from: RoutePoint; to: RoutePoint }[],
  provider: RoutingProvider | undefined,
  options: { now: string; newId: () => string; maxLookups?: number },
) {
  const unique = [...new Map(pairs.filter(p => legKey(p.from, p.from) !== legKey(p.to, p.to)).map(p => [legKey(p.from, p.to), p])).values()];
  const cached = await repository.getRouteLegs(organizationId, unique.map(p => ({ fromLatE6: p.from.latE6, fromLngE6: p.from.lngE6, toLatE6: p.to.latE6, toLngE6: p.to.lngE6 })));
  const found = new Map(cached.map(leg => [legKey({ latE6: leg.fromLatE6, lngE6: leg.fromLngE6 }, { latE6: leg.toLatE6, lngE6: leg.toLngE6 }), leg]));
  const missing = unique.filter(p => !found.has(legKey(p.from, p.to)));
  let lookups = 0, failed = 0;
  if (provider) {
    for (const pair of missing.slice(0, options.maxLookups ?? 20)) {
      lookups++;
      try {
        const result = await provider.route(pair.from, pair.to);
        const leg: RouteLeg = { id: options.newId(), organizationId, fromLatE6: pair.from.latE6, fromLngE6: pair.from.lngE6, toLatE6: pair.to.latE6, toLngE6: pair.to.lngE6, distanceM: Math.round(result.distanceM), durationS: Math.round(result.durationS), geometry: result.geometry, provider: provider.name, fetchedAt: options.now };
        try {
          await repository.atomicWrite([{ sql: "INSERT INTO ops_route_legs (id, organization_id, from_lat_e6, from_lng_e6, to_lat_e6, to_lng_e6, distance_m, duration_s, geometry, provider, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params: [leg.id, leg.organizationId, leg.fromLatE6, leg.fromLngE6, leg.toLatE6, leg.toLngE6, leg.distanceM, leg.durationS, leg.geometry, leg.provider, leg.fetchedAt] }]);
        } catch {
          // Another request saved the same pair first; its copy is equally valid.
        }
        found.set(legKey(pair.from, pair.to), leg);
      } catch {
        failed++;
      }
    }
  }
  return { legs: [...found.values()], pending: unique.length - found.size, failed, lookups };
}
