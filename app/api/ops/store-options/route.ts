import { getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
export async function GET(request: Request) {
    try {
        const { session, repository } = await getOpsRequestContext(["executive", "facilities", "regional", "store_manager", "finance"], undefined, request), q = new URL(request.url).searchParams;
        // One store by ID (to show which store a page is filtered to), only when it is in the person's scope.
        const id = q.get("id")?.trim().slice(0, 160);
        if (id) {
            const store = await repository.getStore(session.organizationId, id);
            const allowed = store && (!session.storeIds || session.storeIds.includes(store.id)) && (!session.regionIds || Boolean(store.regionId && session.regionIds.includes(store.regionId)));
            return Response.json({ items: allowed ? [{ value: store.id, label: `Store ${store.storeNumber} · ${store.name}` }] : [] });
        }
        const page = await repository.searchStores(session, q.get("q")?.trim().slice(0, 160) ?? "", { limit: Math.min(100, Math.max(1, Number(q.get("limit")) || 25)), cursor: q.get("cursor")?.slice(0, 2000) || undefined });
        return Response.json({ items: page.items.map(s => ({ value: s.id, label: `Store ${s.storeNumber} · ${s.name}`, description: s.formattedAddress })), nextCursor: page.nextCursor, totalCount: page.totalCount });
    }
    catch (error) {
        return opsApiError(error);
    }
}
