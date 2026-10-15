import { createWorkOrder, type OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { ActorContext, OpsId } from "./types";

/**
 * A technician reports a problem they found while on site. Two choices, no waiting for approval:
 * "fix now" creates the job assigned to them; "send to manager" leaves it for a manager to route
 * (a vendor, parts, another trade). Managers see both afterwards in Review as "Reported by a tech".
 *
 * Equipment under an active warranty can't be fixed on the spot: a tech repair can void coverage,
 * so the job goes to a manager, who deals with the warranty provider.
 */
export interface ReportFoundProblemInput {
  organizationId: OpsId;
  actor: ActorContext;
  storeId: OpsId;
  assetId?: OpsId;
  problem: string;
  fixNow: boolean;
  /** Today in the organization's zone (YYYY-MM-DD), for the warranty check. */
  today: string;
  key: string;
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Whether the equipment has an active warranty today. */
export async function underWarranty(svc: Pick<OpsCommandServices, "repository">, organizationId: OpsId, storeId: OpsId, assetId: OpsId, today: string) {
  const coverage = await svc.repository.listWarrantyDirectory({ organizationId, storeIds: [storeId] }, { today, view: "active", assetId, limit: 1 });
  return coverage.totalCount > 0 ? coverage.items[0] : undefined;
}

export async function reportFoundProblem(svc: OpsCommandServices, input: ReportFoundProblemInput) {
  const { repository } = svc;
  const techId = input.actor.actorType === "user" ? input.actor.actorId : undefined;
  const problem = input.problem.trim();
  if (!techId) throw new OpsDomainError("FORBIDDEN", "Sign in to report a problem.");
  if (problem.length < 3) throw new OpsDomainError("VALIDATION", "Say what's wrong in a few words.");
  if (problem.length > 500) throw new OpsDomainError("VALIDATION", "Keep the problem under 500 characters.");
  const member = await repository.getMembership(input.organizationId, techId);
  if (!member || member.status !== "active" || member.role !== "internal_technician") throw new OpsDomainError("FORBIDDEN", "Only technicians can report a problem they found.");
  if (!(await repository.listStoreIdsForMembership(input.organizationId, techId)).includes(input.storeId)) throw new OpsDomainError("FORBIDDEN", "You don't cover this store.");
  const asset = input.assetId ? await repository.getAsset(input.organizationId, input.assetId) : undefined;
  if (input.assetId && (!asset || asset.storeId !== input.storeId)) throw new OpsDomainError("VALIDATION", "That equipment isn't at this store.");
  if (input.fixNow && asset && await underWarranty(svc, input.organizationId, input.storeId, asset.id, input.today)) {
    throw new OpsDomainError("CONFLICT", "This equipment is under warranty. Send it to your manager instead of repairing it.");
  }
  const requestHash = await sha256(JSON.stringify([techId, input.storeId, input.assetId ?? "", problem, input.fixNow]));
  return createWorkOrder(svc, {
    organizationId: input.organizationId, actor: input.actor, storeId: input.storeId, assetId: asset?.id, categoryKey: asset?.categoryKey,
    problem, priority: "routine", foundByMembershipId: techId,
    accountableParty: "Facilities coordinator", nextAction: "Choose who handles it", escalationTo: "Facilities director",
    // A manager should decide on a tech's report by the next day; fix-now jobs keep the normal deadline.
    dueAt: input.fixNow ? undefined : new Date(Date.now() + 24 * 3_600_000).toISOString(),
    initialAssignment: input.fixNow ? { kind: "internal", internalTarget: "person", internalMembershipId: techId } : { kind: "choose_later" },
    idempotency: { key: input.key, command: "work_order.report_found", requestHash, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() },
  });
}
