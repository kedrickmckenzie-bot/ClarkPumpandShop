import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
export async function GET(request: Request) {
    try {
        const { session, repository } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager"], "create_request", request), q = new URL(request.url).searchParams;
        const page = await repository.searchStores(session, q.get("q")?.trim().slice(0, 160) ?? "", { limit: 25, cursor: q.get("cursor")?.slice(0, 2000) || undefined });
        return Response.json({ items: page.items.map(s => ({ value: s.id, label: `Store ${s.storeNumber} · ${s.name}` })), nextCursor: page.nextCursor });
    }
    catch (error) {
        return opsApiError(error);
    }
}
