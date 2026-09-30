import type { OpsRepository } from "./repository";
import type { WorkOrder } from "./types";
import { OpsDomainError } from "./errors";
import { membershipHasCapability } from "./capability-policy";

export async function confirmationAssignee(repository: OpsRepository, work: Pick<WorkOrder, "organizationId" | "storeId" | "confirmationMembershipId">) {
  if (!work.confirmationMembershipId) return { assigneeType: "role" as const, assigneeRole: "store_manager" as const, assigneeName: "Store team" };
  const member = await repository.getMembership(work.organizationId, work.confirmationMembershipId);
  if (!member || member.status !== "active" || !["facilities_admin", "regional_manager", "store_manager"].includes(member.role)
    || !await membershipHasCapability(repository, work.organizationId, member.id, "confirm_observable_result")
    || !(await repository.listStoreIdsForMembership(work.organizationId, member.id)).includes(work.storeId)) {
    throw new OpsDomainError("VALIDATION", "Choose someone who can confirm work at this store");
  }
  const user = await repository.getUserInOrganization(work.organizationId, member.userId);
  if (!user || user.status !== "active") throw new OpsDomainError("VALIDATION", "Choose an active reviewer");
  return { assigneeType: "user" as const, assigneeId: member.id, assigneeName: user?.displayName ?? "Assigned reviewer" };
}
