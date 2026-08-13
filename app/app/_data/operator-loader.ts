import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { OperatorRole, OperatorSession } from "@/components/ops/data-contract";
import {
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import type { OpsFixture } from "@/lib/ops/types";
import {
  buildCreateRequestModel,
  buildCreateStoreModel,
  buildCreateVendorModel,
  buildCreateWorkOrderModel,
  buildDashboardModel,
  buildDetailModel,
  buildListModel,
  buildProgramModel,
  buildSearchModel,
  buildVendorIssuanceModel,
  type OperatorDetailRoute,
  type OperatorListRoute,
  type OperatorProgramRoute,
  type OperatorSearchParameters,
} from "./operator-presenter";

const PREVIEW_ROLE_COOKIE = "traceops-preview-role";

function isOperatorRole(value: string | undefined): value is OperatorRole {
  return value === "executive" || value === "facilities" || value === "regional" || value === "store_manager" || value === "finance";
}

function previewMembership(role: OperatorRole, snapshot: OpsFixture) {
  const domainRole = {
    executive: "executive",
    facilities: "facilities_admin",
    regional: "regional_manager",
    store_manager: "store_manager",
    finance: "finance_reviewer",
  }[role];
  const candidates = snapshot.memberships.filter(
    (membership) =>
      membership.organizationId === NORTHLINE_ORGANIZATION_ID &&
      membership.role === domainRole &&
      membership.status === "active",
  );
  if (role !== "regional") return { snapshot, membership: candidates[0] };
  const centralRegion = snapshot.regions.find(
    (region) => region.organizationId === NORTHLINE_ORGANIZATION_ID && region.code === "central",
  );
  const centralMembership = candidates.find((membership) =>
    snapshot.scopeGrants.some(
      (grant) =>
        grant.organizationId === NORTHLINE_ORGANIZATION_ID &&
        grant.membershipId === membership.id &&
        grant.scopeKind === "region" &&
        grant.scopeId === centralRegion?.id,
    ),
  );
  return { snapshot, membership: centralMembership ?? candidates[0] };
}

/**
 * Current Sites-hosted showcase identity boundary.
 *
 * The role picker is an intentionally visible demo control over fictional data.
 * A live tenant must replace this function with membership and scope grants from
 * the production identity provider; presenter filtering is not a substitute for
 * repository authorization.
 */
async function loadOperatorSessionFromSnapshot(snapshot: OpsFixture): Promise<OperatorSession> {
  const [identity, cookieStore] = await Promise.all([getChatGPTUser(), cookies()]);
  const requestedRole = cookieStore.get(PREVIEW_ROLE_COOKIE)?.value ?? process.env.TRACEOPS_OPERATOR_PREVIEW_ROLE;
  const role: OperatorRole = isOperatorRole(requestedRole) ? requestedRole : "facilities";
  const { membership } = previewMembership(role, snapshot);
  const grants = membership
    ? snapshot.scopeGrants.filter(
        (grant) =>
          grant.organizationId === NORTHLINE_ORGANIZATION_ID &&
          grant.membershipId === membership.id,
      )
    : [];
  const regionIds = grants.filter((grant) => grant.scopeKind === "region").map((grant) => grant.scopeId);
  const storeIds = grants.filter((grant) => grant.scopeKind === "store").map((grant) => grant.scopeId);
  const scopedRegion = regionIds.length === 1
    ? snapshot.regions.find((region) => region.id === regionIds[0] && region.organizationId === NORTHLINE_ORGANIZATION_ID)
    : undefined;
  const scopedStore = storeIds.length === 1
    ? snapshot.stores.find((store) => store.id === storeIds[0] && store.organizationId === NORTHLINE_ORGANIZATION_ID)
    : undefined;
  const scopeLabel = scopedStore
    ? `Store ${scopedStore.storeNumber} · ${scopedStore.name}`
    : scopedRegion
      ? `${scopedRegion.name} · ${snapshot.stores.filter((store) => store.organizationId === NORTHLINE_ORGANIZATION_ID && store.regionId === scopedRegion.id).length} stores`
      : role === "finance"
        ? "Northline companywide · review-only financial scope"
        : `Northline companywide · ${snapshot.stores.filter((store) => store.organizationId === NORTHLINE_ORGANIZATION_ID).length} stores`;

  return {
    userId: identity?.userId ?? "user-northline-preview",
    membershipId: membership?.id,
    displayName: identity?.displayName ?? "Demo operator",
    email: identity?.email ?? "operator@northline.example",
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName: "Northline Fuel & Market",
    scopeLabel,
    regionIds: regionIds.length ? regionIds : undefined,
    storeIds: storeIds.length ? storeIds : undefined,
    permissions: grants.map((grant) => grant.permission),
  };
}

export async function loadOperatorSession(): Promise<OperatorSession> {
  const snapshot = await getServerOpsFixtureSnapshot();
  return loadOperatorSessionFromSnapshot(snapshot);
}

async function sessionAndFixture() {
  const fixture = await getServerOpsFixtureSnapshot();
  const session = await loadOperatorSessionFromSnapshot(fixture);
  return { session, fixture };
}

export type ListRouteId = OperatorListRoute;
export type ProgramRouteId = OperatorProgramRoute;
export type DetailRouteId = OperatorDetailRoute;

function requireRole(role: OperatorRole, allowed: readonly OperatorRole[]) {
  if (!allowed.includes(role)) notFound();
}

export async function loadListModel(route: ListRouteId, searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  const allowed: Record<ListRouteId, readonly OperatorRole[]> = {
    "action-center": ["executive", "facilities", "regional", "store_manager", "finance"],
    requests: ["executive", "facilities", "regional", "store_manager"],
    "work-orders": ["executive", "facilities", "regional", "store_manager", "finance"],
    visits: ["executive", "facilities", "regional", "store_manager"],
    stores: ["executive", "facilities", "regional", "store_manager", "finance"],
    vendors: ["executive", "facilities", "regional", "store_manager", "finance"],
    invoices: ["executive", "facilities", "regional", "store_manager", "finance"],
    reports: ["executive", "facilities", "regional", "store_manager", "finance"],
    admin: ["facilities"],
  };
  requireRole(context.session.role, allowed[route]);
  return buildListModel(context.fixture, context.session, route, searchParams);
}

export async function loadDashboardModel() {
  const context = await sessionAndFixture();
  return buildDashboardModel(context.fixture, context.session);
}

export async function loadSearchModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  return buildSearchModel(context.fixture, context.session, searchParams);
}

export async function loadProgramModel(route: ProgramRouteId, searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  const allowed: Record<ProgramRouteId, readonly OperatorRole[]> = {
    spend: ["executive", "facilities", "regional", "store_manager", "finance"],
    equipment: ["executive", "facilities", "regional", "store_manager", "finance"],
    pm: ["executive", "facilities", "regional", "store_manager"],
    lifecycle: ["executive", "facilities", "regional", "finance"],
  };
  requireRole(context.session.role, allowed[route]);
  return buildProgramModel(context.fixture, context.session, route, searchParams);
}

export async function loadDetailModel(route: DetailRouteId, id: string) {
  const context = await sessionAndFixture();
  const allowed: Record<DetailRouteId, readonly OperatorRole[]> = {
    request: ["executive", "facilities", "regional", "store_manager"],
    "work-order": ["executive", "facilities", "regional", "store_manager", "finance"],
    store: ["executive", "facilities", "regional", "store_manager", "finance"],
    vendor: ["executive", "facilities", "regional", "store_manager", "finance"],
    equipment: ["executive", "facilities", "regional", "store_manager", "finance"],
    invoice: ["executive", "facilities", "regional", "store_manager", "finance"],
  };
  requireRole(context.session.role, allowed[route]);
  return buildDetailModel(context.fixture, context.session, route, id);
}

export async function loadCreateRequestModel() {
  const context = await sessionAndFixture();
  requireRole(context.session.role, ["facilities", "regional", "store_manager"]);
  return buildCreateRequestModel(context.fixture, context.session);
}

export async function loadCreateWorkOrderModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  requireRole(context.session.role, ["facilities", "regional"]);
  return buildCreateWorkOrderModel(context.fixture, context.session, searchParams);
}

export async function loadCreateStoreModel() {
  const context = await sessionAndFixture();
  requireRole(context.session.role, ["facilities"]);
  return buildCreateStoreModel(context.fixture, context.session);
}

export async function loadCreateVendorModel() {
  const context = await sessionAndFixture();
  requireRole(context.session.role, ["facilities"]);
  return buildCreateVendorModel(context.fixture, context.session);
}

export async function loadVendorIssuanceModel(workOrderId: string) {
  const context = await sessionAndFixture();
  return buildVendorIssuanceModel(context.fixture, context.session, workOrderId);
}
