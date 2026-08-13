export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "traceops-convenience-suite",
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
