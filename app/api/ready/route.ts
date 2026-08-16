import { checkPersistenceReadiness } from "@/lib/server/persistence-readiness";
import { OPS_SERVICE_ID } from "@/lib/server/runtime-identifiers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const readiness = await checkPersistenceReadiness();
    return Response.json(
      {
        status: readiness.ready ? "ready" : "not_ready",
        service: OPS_SERVICE_ID,
        checks: readiness.checks,
        checkedAt: new Date().toISOString(),
      },
      {
        status: readiness.ready ? 200 : 503,
        headers: { "cache-control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      {
        status: "not_ready",
        service: OPS_SERVICE_ID,
        checks: { persistence: "unavailable" },
        checkedAt: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
