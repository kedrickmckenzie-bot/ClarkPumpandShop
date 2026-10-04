import "server-only";
import { sessionHasNoStores } from "@/components/ops/role-policy";
import type { OperatorSession } from "@/components/ops/data-contract";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";

/** Intersect the saved view with current grants; stale cookies never broaden a read. */
export async function internalDispatchScope(repository: OpsRepository, session: OperatorSession): Promise<OrganizationScope> {
  const stores = session.membershipId && !sessionHasNoStores(session)
    ? await repository.listStoreIdsForMembership(session.organizationId, session.membershipId) : [];
  return { organizationId: session.organizationId, regionIds: session.regionIds, storeIds: session.storeIds === undefined ? stores : stores.filter(id => session.storeIds!.includes(id)) };
}
