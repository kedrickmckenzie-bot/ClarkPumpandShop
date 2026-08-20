import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type {
  DashboardPageViewModel,
  DetailPageViewModel,
  ListPageViewModel,
  OperatorRole,
  OperatorSession,
} from "@/components/ops/data-contract";
import {
  roleCan,
  roleCanAccessDetailRoute,
  roleCanAccessListRoute,
  roleCanAccessProgramRoute,
  roleCanOpenOperatorHref,
  type OperatorCapability,
} from "@/components/ops/role-policy";
import {
  NORTHLINE_ORGANIZATION_ID,
} from "@/lib/ops/fixtures";
import { getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import {
  LEGACY_OPS_PREVIEW_ROLE_COOKIE,
  OPS_PREVIEW_ROLE_COOKIE,
} from "@/lib/server/runtime-identifiers";
import type { OpsFixture } from "@/lib/ops/types";
import {
  buildCreateRequestModel,
  buildCreateStoreModel,
  buildCreateVendorModel,
  buildCreateWorkOrderModel,
  buildDashboardModel,
  buildDetailModel,
  buildEstimateComparisonModel,
  buildAttentionItemModel,
  buildApprovalPolicyWorkspaceModel,
  buildListModel,
  buildProgramModel,
  buildRequestReviewModel,
  buildSearchModel,
  buildVendorIssuanceModel,
  buildVendorPerformanceDetailModel,
  buildVendorPerformanceListModel,
  buildWorkOrderControlModel,
  buildWorkOrderRecordingModel,
  type OperatorDetailRoute,
  type OperatorListRoute,
  type OperatorProgramRoute,
  type OperatorSearchParameters,
} from "./operator-presenter";

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
  const requestedRole = cookieStore.get(OPS_PREVIEW_ROLE_COOKIE)?.value
    ?? cookieStore.get(LEGACY_OPS_PREVIEW_ROLE_COOKIE)?.value
    ?? process.env.OPS_OPERATOR_PREVIEW_ROLE
    ?? process.env.TRACEOPS_OPERATOR_PREVIEW_ROLE;
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

function requireCapability(role: OperatorRole, capability: OperatorCapability) {
  if (!roleCan(role, capability)) notFound();
}

type ModelWithPageActions = {
  page: {
    primaryAction?: { href: string; label: string };
    secondaryAction?: { href: string; label: string };
  };
};

function roleCanUseAction(role: OperatorRole, href: string) {
  if (href === "#issue-work") return roleCan(role, "issue_work_order");
  return roleCanOpenOperatorHref(role, href);
}

function enforceVisibleActionPolicy<T extends ModelWithPageActions>(model: T, role: OperatorRole): T {
  if (model.page.primaryAction && !roleCanUseAction(role, model.page.primaryAction.href)) {
    model.page.primaryAction = undefined;
  }
  if (model.page.secondaryAction && !roleCanUseAction(role, model.page.secondaryAction.href)) {
    model.page.secondaryAction = undefined;
  }
  return model;
}

function enforceListLinkPolicy<T extends ListPageViewModel>(model: T, role: OperatorRole): T {
  enforceVisibleActionPolicy(model, role);
  model.metrics = model.metrics?.filter((metric) => roleCanOpenOperatorHref(role, metric.link.href));
  const rowCount = model.table.rows.length;
  model.table.rows = model.table.rows.filter((row) => roleCanOpenOperatorHref(role, row.href));
  if (model.table.rows.length !== rowCount) {
    model.resultSummary = `${model.table.rows.length} source record${model.table.rows.length === 1 ? "" : "s"}`;
    model.pagination = model.table.rows.length
      ? { summary: `Showing 1–${model.table.rows.length} of ${model.table.rows.length}` }
      : undefined;
  }
  return model;
}

function enforceDashboardLinkPolicy<T extends DashboardPageViewModel>(model: T, role: OperatorRole): T {
  enforceVisibleActionPolicy(model, role);
  model.metrics = model.metrics.filter((metric) => roleCanOpenOperatorHref(role, metric.link.href));
  model.journey = model.journey?.filter((stage) => roleCanOpenOperatorHref(role, stage.link.href));
  model.priorityActions = model.priorityActions.filter((action) => roleCanOpenOperatorHref(role, action.link.href));
  if (model.prioritySection && !roleCanOpenOperatorHref(role, model.prioritySection.link.href)) {
    model.prioritySection = undefined;
  }
  model.breakdowns = model.breakdowns
    .map((breakdown) => ({
      ...breakdown,
      segments: breakdown.segments.filter((segment) => roleCanOpenOperatorHref(role, segment.link.href)),
    }))
    .filter((breakdown) => roleCanOpenOperatorHref(role, breakdown.sourceLink.href));
  model.trends = model.trends
    .map((trend) => ({
      ...trend,
      points: trend.points.filter((point) => roleCanOpenOperatorHref(role, point.link.href)),
    }))
    .filter((trend) => roleCanOpenOperatorHref(role, trend.sourceLink.href));
  if (model.spotlight && !roleCanOpenOperatorHref(role, model.spotlight.link.href)) {
    model.spotlight = undefined;
  }
  return model;
}

function enforceDetailLinkPolicy<T extends DetailPageViewModel>(model: T, role: OperatorRole): T {
  enforceVisibleActionPolicy(model, role);
  model.facts = model.facts.filter((fact) => !fact.link || roleCanOpenOperatorHref(role, fact.link.href));
  model.sections = model.sections
    .filter((section) => {
      const sectionId = section.id.toLocaleLowerCase("en-US");
      if (!roleCanAccessListRoute(role, "visits") && sectionId.includes("visit")) return false;
      if (!roleCanAccessProgramRoute(role, "pm") && (sectionId === "pm" || sectionId.includes("preventive"))) return false;
      if (!roleCanAccessProgramRoute(role, "lifecycle") && sectionId.includes("lifecycle")) return false;
      return true;
    })
    .map((section) => ({
      ...section,
      action: section.action && roleCanOpenOperatorHref(role, section.action.href) ? section.action : undefined,
      facts: section.facts?.filter((fact) => !fact.link || roleCanOpenOperatorHref(role, fact.link.href)),
      table: section.table
        ? { ...section.table, rows: section.table.rows.filter((row) => roleCanOpenOperatorHref(role, row.href)) }
        : undefined,
      timeline: section.timeline?.map((event) => event.link && !roleCanOpenOperatorHref(role, event.link.href)
        ? { ...event, link: undefined }
        : event),
    }));
  return model;
}

export async function loadListModel(route: ListRouteId, searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  if (!roleCanAccessListRoute(context.session.role, route)) notFound();
  return enforceListLinkPolicy(
    buildListModel(context.fixture, context.session, route, searchParams),
    context.session.role,
  );
}

export async function loadApprovalPolicyWorkspaceModel() {
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "administer");
  return enforceDetailLinkPolicy(
    buildApprovalPolicyWorkspaceModel(context.fixture, context.session),
    context.session.role,
  );
}

export async function loadDashboardModel() {
  const context = await sessionAndFixture();
  return enforceDashboardLinkPolicy(
    buildDashboardModel(context.fixture, context.session),
    context.session.role,
  );
}

export async function loadSearchModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  return buildSearchModel(context.fixture, context.session, searchParams);
}

export async function loadProgramModel(route: ProgramRouteId, searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  if (!roleCanAccessProgramRoute(context.session.role, route)) notFound();
  return enforceDashboardLinkPolicy(
    buildProgramModel(context.fixture, context.session, route, searchParams),
    context.session.role,
  );
}

export async function loadDetailModel(route: DetailRouteId, id: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, route)) notFound();
  const model = buildDetailModel(context.fixture, context.session, route, id);
  if (route === "work-order" && roleCan(context.session.role, "issue_work_order")) {
    const issuance = buildVendorIssuanceModel(context.fixture, context.session, id);
    if (issuance.available) {
      model.page.primaryAction = {
        label: issuance.assignmentKind === "choose_later"
          ? "Choose vendor & create handoff"
          : issuance.selectedVendorId
            ? "Create vendor handoff"
            : "Choose another vendor",
        href: "#issue-work",
      };
    }
  }
  return enforceDetailLinkPolicy(
    model,
    context.session.role,
  );
}

export async function loadVendorPerformanceListModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  if (!roleCanAccessListRoute(context.session.role, "vendors")) notFound();
  return buildVendorPerformanceListModel(context.fixture, context.session, searchParams);
}

export async function loadVendorPerformanceDetailModel(vendorId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "vendor")) notFound();
  return buildVendorPerformanceDetailModel(context.fixture, context.session, vendorId);
}

export async function loadCreateRequestModel() {
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "create_request");
  return buildCreateRequestModel(context.fixture, context.session);
}

export async function loadCreateWorkOrderModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "create_work_order");
  return buildCreateWorkOrderModel(context.fixture, context.session, searchParams);
}

export async function loadCreateStoreModel() {
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "create_store");
  return buildCreateStoreModel(context.fixture, context.session);
}

export async function loadCreateVendorModel() {
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "onboard_vendor");
  return buildCreateVendorModel(context.fixture, context.session);
}

export async function loadVendorIssuanceModel(workOrderId: string) {
  const context = await sessionAndFixture();
  const model = buildVendorIssuanceModel(context.fixture, context.session, workOrderId);
  model.permitted = model.available && roleCan(context.session.role, "issue_work_order");
  return model;
}

export async function loadEstimateComparisonModel(workOrderId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  const model = buildEstimateComparisonModel(context.fixture, context.session, workOrderId);
  if (!model.available) notFound();
  return model;
}

export async function loadWorkOrderControlModel(workOrderId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  const model = buildWorkOrderControlModel(context.fixture, context.session, workOrderId);
  if (!model.available) notFound();
  return model;
}

export async function loadWorkOrderRecordingModel(workOrderId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  const model = buildWorkOrderRecordingModel(context.fixture, context.session, workOrderId);
  if (!model.available) notFound();
  return model;
}

export async function loadRequestReviewModel(requestId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "request")) notFound();
  return buildRequestReviewModel(context.fixture, context.session, requestId);
}

export async function loadAttentionItemModel(itemId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessListRoute(context.session.role, "action-center")) notFound();
  const model = buildAttentionItemModel(context.fixture, context.session, itemId);
  if (!model.control.available) notFound();
  model.detail = enforceDetailLinkPolicy(model.detail, context.session.role);
  return model;
}
