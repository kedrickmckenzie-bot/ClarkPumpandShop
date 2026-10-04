import type { OpsRepository } from "./repository";
import type { OrganizationRole, WorkOrder, WorkflowTaskAssigneeType } from "./types";
import { grantCoversStore, writableOpsPermissions } from "./store-scope";

export interface ResolvedInternalAccountability {
  assigneeType: WorkflowTaskAssigneeType;
  assigneeId?: string;
  assigneeRole?: OrganizationRole;
  assigneeName: string;
  escalationDestination: string;
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
    const user = membership ? await repository.getUserInOrganization(workOrder.organizationId, membership.userId) : null;
    if (membership?.status === "active" && user?.status === "active" && store && grants.some((grant) => grantCoversStore(grant, store) && writableOpsPermissions.includes(grant.permission))) {
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
    assigneeName: workOrder.internalAccountableType === "membership" ? "Facilities coordination" : workOrder.internalAccountableParty?.trim() || "Facilities coordination",
    escalationDestination,
  };
}
