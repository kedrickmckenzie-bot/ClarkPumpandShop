import { loadSearchModel } from "@/app/app/_data/operator-loader";
import { opsApiError } from "@/lib/server/ops-request-context";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q")?.trim().slice(0,160) ?? "";
    const model = await loadSearchModel({ q });
    return Response.json({ groups: model.groups.map(g => ({ id: g.id, label: g.label, rows: g.rows.slice(0,4).map(r => ({ id: r.id, href: r.href, label: r.cells[0]?.value ?? r.label, detail: r.cells[0]?.secondary })) })) }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) { return opsApiError(error); }
}
