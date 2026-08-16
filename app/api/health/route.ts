import { OPS_SERVICE_ID } from "@/lib/server/runtime-identifiers";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: OPS_SERVICE_ID,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
