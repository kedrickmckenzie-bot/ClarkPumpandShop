import type { OpsRepository } from "./repository";
import type { OrganizationRole, WorkOrder, WorkflowTaskAssigneeType } from "./types";

export interface ResolvedInternalAccountability {
  assigneeType: WorkflowTaskAssigneeType;
  assigneeId?: string;
  assigneeRole?: OrganizationRole;
  assigneeName: string;
  escalationDestination: string;
}

function grantCoversStore(grant: { scopeKind: string; scopeId: string }, workOrder: WorkOrder, regionId?: string) {
  return (grant.scopeKind === "organization" && grant.scopeId === workOrder.organizationId)
    || (grant.scopeKind === "store" && grant.scopeId === workOrder.storeId)
    || (grant.scopeKind === "region" && Boolean(regionId) && grant.scopeId === regionId);
}

/**
 * Resolve the work order's durable customer-side owner for every newly created
 * operational obligation. Compatibility records fall back to the named
 * facilities team instead of inventing a person.
 */
export async function resolveInternalAccountability(
  repository: OpsRepository,
  workOrder: WorkOrder,
): Promise<ResolvedInternalAccountability> {
  const escalationDestination = workOrder.escalationTo?.trim() || "Facilities leadership";
  if (workOrder.internalAccountableType === "membership" && workOrder.internalAccountableId) {
    const [membership, grants, store] = await Promise.all([
      repository.getMembership(workOrder.organizationId, workOrder.internalAccountableId),
      repository.listScopeGrantsForMembership(workOrder.organizationId, workOrder.internalAccountableId),
      repository.getStore(workOrder.organizationId, workOrder.storeId),
    ]);
    if (membership?.status === "active" && grants.some((grant) => grantCoversStore(grant, workOrder, store?.regionId))) {
      return {
        assigneeType: "user",
        assigneeId: membership.id,
        assigneeName: workOrder.internalAccountableParty?.trim() || workOrder.accountableParty,
        escalationDestination,
      };
    }
  }
  if (workOrder.internalAccountableType === "team" && workOrder.internalAccountableId) {
    return {
      assigneeType: "team",
      assigneeId: workOrder.internalAccountableId,
      assigneeName: workOrder.internalAccountableParty?.trim() || "Facilities coordination",
      escalationDestination,
    };
  }
  return {
    assigneeType: "team",
    assigneeId: "facilities-coordination",
    assigneeName: workOrder.internalAccountableParty?.trim() || "Facilities coordination",
    escalationDestination,
  };
}
