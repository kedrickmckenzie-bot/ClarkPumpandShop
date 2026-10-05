import "server-only";
import type { RoutingProvider } from "@/lib/ops/route-legs";

/**
 * Road routing is an opt-in outside service. Set OPS_ROUTING_PROVIDER=osrm to enable it;
 * OPS_OSRM_URL points at a self-hosted OSRM server and defaults to the public demo server,
 * which allows light use only. Routes are cached per store pair, so each pair is asked once.
 */
export function getRoutingProvider(): RoutingProvider | undefined {
  if (process.env.OPS_ROUTING_PROVIDER !== "osrm") return undefined;
  const base = (process.env.OPS_OSRM_URL || "https://router.project-osrm.org").replace(/\/$/, "");
  return {
    name: "osrm",
    async route(from, to) {
      const points = `${from.lngE6 / 1e6},${from.latE6 / 1e6};${to.lngE6 / 1e6},${to.latE6 / 1e6}`;
      const response = await fetch(`${base}/route/v1/driving/${points}?overview=full&geometries=polyline6&steps=false`, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Routing service answered ${response.status}`);
      const body = await response.json() as { code?: string; routes?: { distance: number; duration: number; geometry: string }[] };
      const route = body.routes?.[0];
      if (body.code !== "Ok" || !route) throw new Error("No driving route found");
      return { distanceM: route.distance, durationS: route.duration, geometry: route.geometry };
    },
  };
}
