import { getOpsRequestContext, assertStoreInSessionScope, opsApiError } from "@/lib/server/ops-request-context";
import { membershipHasCapability } from "@/lib/ops/capability-policy";
export async function GET(request: Request) {
  try {
    const { session, repository } = await getOpsRequestContext(["facilities", "regional", "store_manager"], undefined, request);
    const query = new URL(request.url).searchParams;
    const storeId = query.get("store") ?? "";
    await assertStoreInSessionScope(session, storeId);
    const people = await repository.listComplianceOwners(session.organizationId, (query.get("q") ?? "").slice(0, 160));
    const items = await Promise.all(people.map(async person => {
      const member = await repository.getMembership(session.organizationId, person.id);
      if (!member || !["facilities_admin", "regional_manager", "field_manager", "store_manager"].includes(member.role)
        || !await membershipHasCapability(repository, session.organizationId, member.id, "confirm_observable_result")
        || !(await repository.listStoreIdsForMembership(session.organizationId, member.id)).includes(storeId)) return null;
      return { id: person.id, name: `${person.name} · ${member.role.replaceAll("_", " ")}` };
    }));
    return Response.json({ items: items.filter(Boolean) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return opsApiError(error); }
}
