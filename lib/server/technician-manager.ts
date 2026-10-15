import type { OpsRepository } from "@/lib/ops/repository";

/** Who a technician calls: the team's field manager, or the facilities manager when there is none. */
export async function technicianManager(repository: OpsRepository, organizationId: string) {
  const people = await repository.listReportRecipients(organizationId);
  const pick = people.find(p => p.role === "field_manager") ?? people.find(p => p.role === "facilities_admin");
  if (!pick) return undefined;
  const membership = await repository.getMembership(organizationId, pick.membershipId);
  const user = membership ? await repository.getUserInOrganization(organizationId, membership.userId) : null;
  return { name: pick.name, phone: user?.phone };
}
