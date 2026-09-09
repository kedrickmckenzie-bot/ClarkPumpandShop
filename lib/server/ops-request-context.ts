import "server-only";

import type { OperatorRole } from "@/components/ops/data-contract";
import { roleCan, type OperatorCapability } from "@/components/ops/role-policy";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { OpsDomainError } from "@/lib/ops/commands";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import type { OpsRepository } from "@/lib/ops/repository";
import type { ActorContext } from "@/lib/ops/types";

const domainRoleForOperatorRole = {
  executive: "executive",
  facilities: "facilities_admin",
  regional: "regional_manager",
  store_manager: "store_manager",
  finance: "finance_reviewer",
} as const;

export async function assertActiveOperatorMembership(
  repository: OpsRepository,
  session: Awaited<ReturnType<typeof loadOperatorSession>>,
) {
  if (!session.membershipId) {
    throw new OpsDomainError("FORBIDDEN", "An active organization membership is required for this action.");
  }
  const membership = await repository.getMembership(session.organizationId, session.membershipId);
  if (
    !membership
    || membership.status !== "active"
    || membership.role !== domainRoleForOperatorRole[session.role]
  ) {
    throw new OpsDomainError("FORBIDDEN", "Your organization membership or role is no longer active.");
  }
  return membership;
}

export async function getOpsRequestContext(allowedRoles: readonly OperatorRole[], requiredCapability?: OperatorCapability) {
  const session = await loadOperatorSession();
  if (!allowedRoles.includes(session.role)) {
    throw new OpsDomainError("FORBIDDEN", "Your current role cannot perform this action.");
  }
  const repository = await getServerOpsRepository();
  const membership = await assertActiveOperatorMembership(repository, session);
  if (requiredCapability && !roleCan(session, requiredCapability)) {
    throw new OpsDomainError("FORBIDDEN", "This maintenance responsibility is not enabled for your role.");
  }
  const actor: ActorContext = {
    actorType: "user",
    actorId: membership.id,
    actorName: session.displayName,
    organizationId: session.organizationId,
  };
  return { session, repository, actor };
}

export async function assertStoreInSessionScope(
  session: Awaited<ReturnType<typeof loadOperatorSession>>,
  storeId: string,
) {
  const repository = await getServerOpsRepository();
  const store = await repository.getStore(session.organizationId, storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store was not found in this organization.");
  if (session.storeIds?.length && !session.storeIds.includes(store.id)) {
    throw new OpsDomainError("FORBIDDEN", "Store is outside your assigned scope.");
  }
  if (session.regionIds?.length && (!store.regionId || !session.regionIds.includes(store.regionId))) {
    throw new OpsDomainError("FORBIDDEN", "Store is outside your assigned region.");
  }
  if (session.role === "store_manager" && !session.storeIds?.length) {
    throw new OpsDomainError("FORBIDDEN", "No store scope is assigned to this role.");
  }
  if (session.role === "regional" && !session.regionIds?.length) {
    throw new OpsDomainError("FORBIDDEN", "No region scope is assigned to this role.");
  }
  return store;
}

export function formText(formData: FormData, name: string, options: { required?: boolean; max?: number } = {}) {
  const raw = formData.get(name);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (options.required && !value) throw new OpsDomainError("VALIDATION", `${name} is required.`);
  if (options.max && value.length > options.max) throw new OpsDomainError("VALIDATION", `${name} is too long.`);
  return value;
}

export function optionalIsoDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new OpsDomainError("VALIDATION", "Date is invalid.");
  return parsed.toISOString();
}

export function optionalMoneyMinor(value: string) {
  if (!value) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new OpsDomainError("VALIDATION", "Amount must be zero or greater.");
  return Math.round(amount * 100);
}

export function opsApiError(error: unknown) {
  if (error instanceof OpsDomainError) {
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 422;
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  console.error("Unhandled facilities API error", error);
  return Response.json({ error: "The action could not be completed." }, { status: 500 });
}
