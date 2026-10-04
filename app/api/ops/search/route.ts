import { technicianSearch } from "@/lib/server/technician-search";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { loadSearchModel } from "@/app/app/_data/operator-loader";
import { opsApiError } from "@/lib/server/ops-request-context";
import { oneLine } from "@/lib/product/one-line";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q")?.trim().slice(0,160) ?? "";
    const session=await loadOperatorSession();
    if(session.role==="technician")return Response.json(await technicianSearch(q,request),{headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});
    const model = await loadSearchModel({ q });
    return Response.json({ groups: model.groups.map(g => ({ id: g.id, label: g.label, rows: g.rows.slice(0,4).map(r => ({ id: r.id, href: r.href, label: r.cells[0]?.value ?? r.label, detail: oneLine(r.cells[0]?.secondary ?? r.cells.find(c => c.key === "next" || c.key === "problem")?.value) })) })) }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) { return opsApiError(error); }
}
