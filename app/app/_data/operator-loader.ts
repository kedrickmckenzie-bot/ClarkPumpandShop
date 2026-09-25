import { pmStoreAllowed } from "@/lib/ops/pm-record-query";
import { approvalRequestState } from "@/lib/ops/approval-governance";
import { rollingYearStart } from "@/lib/ops/dashboard-query";
import { attentionAccess } from "./attention-presenter";
import { buildReviewQueue, buildReviewSources } from "./review-queue-presenter";
import { buildPmScheduleModel } from "./pm-schedule-presenter";
import { buildPmSetupManagement, buildPmSetupSources } from "./pm-setup-presenter";
import { buildPmReviewPreview, buildPmReviewSources } from "./pm-review-presenter";



import { loadDashboardChartPages } from "./dashboard-charts";
import { presentQueryDashboard } from "./dashboard-query-presenter";
import { buildStoreCostRanking } from "./store-cost-presenter";
import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isFictionalPreview, trustsSitesIdentity, OPS_ORGANIZATION_COOKIE, OperatorAccessError } from "@/lib/server/operator-access";
import { resolveAuthenticatedOperatorSession, domainRoleForOperatorRole } from "@/lib/server/operator-membership";
import type {
  DashboardPageViewModel,
  DetailPageViewModel,
  DemoEdition,
  ListPageViewModel,
  OperatorRole,
  OperatorSession,
  RequestWorkLinkPageViewModel,
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
  NORTHLINE_PREVIEW_PERSONAS,
} from "@/lib/ops/fixtures";
import { getServerOpsRepository, getServerOpsReportingAsOf } from "@/lib/server/ops-repository-provider";
import { getRequestOpsFixtureSnapshot, getRequestOpsTrendsFixtureSnapshot } from "./request-data";
import { buildQueryOwnerBrief, buildQueryBriefRecords } from "./owner-brief-query-presenter";
import { buildWorkOrderCase } from "@/lib/ops/work-order-case";
import { formatInTimeZone } from "@/lib/ops/local-date-time";
import { DEFAULT_OPERATIONS_TIME_ZONE } from "@/lib/ops/local-time";
import { buildIntegritySummary, buildIntegrityRecords } from "./record-integrity-presenter";
import {
  LEGACY_OPS_PREVIEW_ROLE_COOKIE,
  OPS_PREVIEW_EDITION_COOKIE,
  OPS_PREVIEW_ROLE_COOKIE,
} from "@/lib/server/runtime-identifiers";
import { DEFAULT_DEMO_EDITION, isDemoEdition } from "@/components/ops/demo-edition";
import { resolveRoleCapabilities } from "@/lib/ops/capability-policy";
import type { HeldWorkActionsModel } from "@/components/workspace/held-work-actions";
import type { PmProgramManagementModel } from "@/components/workspace/pm-program-management";
import {
  buildCreateStoreModel,
  buildCreateVendorModel,
  buildCreateWorkOrderModel,
  buildDetailModel,
  buildEstimateComparisonModel,
  buildAttentionItemModel,
  buildApprovalPolicyWorkspaceModel,
  buildListModel,
  buildProgramModel,
  buildRequestReviewModel,
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
import { buildTrendsModel } from "./trends-presenter";
import { paginateVendorEvidence } from "./vendor-evidence-pagination";
import { buildApprovedWorkPortfolio } from "./approved-work-presenter";
import {
  buildQueryListModel,
  buildQuerySearchModel,
  QUERY_FIRST_LIST_ROUTES,
} from "./operator-query-presenter";

function isOperatorRole(value: string | undefined): value is OperatorRole {
  return value === "executive" || value === "facilities" || value === "regional" || value === "store_manager" || value === "finance";
}

export async function loadOperatorSession(): Promise<OperatorSession> {
  return getRequestOperatorSession();
}

const getRequestOperatorSession = cache(async (): Promise<OperatorSession> => {
  const [identity, cookieStore] = await Promise.all([getChatGPTUser(), cookies()]);
  if (!isFictionalPreview()) {
    if (!trustsSitesIdentity()) throw new OperatorAccessError("configuration", "Workspace sign-in is not configured. Contact your administrator.");
    if (!identity) throw new OperatorAccessError("sign_in", "Sign in to open your workspace.");
    return resolveAuthenticatedOperatorSession(await getServerOpsRepository(), {
      userId: `sites:${identity.userId}`,
      organizationId: cookieStore.get(OPS_ORGANIZATION_COOKIE)?.value ?? process.env.OPS_ORGANIZATION_ID ?? "",
    });
  }
  const repository = await getServerOpsRepository();
  const requestedRole = cookieStore.get(OPS_PREVIEW_ROLE_COOKIE)?.value
    ?? cookieStore.get(LEGACY_OPS_PREVIEW_ROLE_COOKIE)?.value
    ?? process.env.OPS_OPERATOR_PREVIEW_ROLE
    ?? process.env.TRACEOPS_OPERATOR_PREVIEW_ROLE;
  const role: OperatorRole = isOperatorRole(requestedRole) ? requestedRole : "facilities";
  const requestedEdition = cookieStore.get(OPS_PREVIEW_EDITION_COOKIE)?.value
    ?? process.env.OPS_OPERATOR_PREVIEW_EDITION;
  const demoEdition: DemoEdition = isDemoEdition(requestedEdition) ? requestedEdition : DEFAULT_DEMO_EDITION;
  const persona = role === "executive"
    ? NORTHLINE_PREVIEW_PERSONAS.executive
    : role === "regional"
      // Preserve the original demo picker's Central-region persona. The named
      // fixture persona is North-only and would silently change the preview
      // scope during the query-first migration.
      ? { membershipId: "membership-northline-regional-2" }
      : role === "store_manager"
        ? NORTHLINE_PREVIEW_PERSONAS.store_104
        : role === "finance"
          ? NORTHLINE_PREVIEW_PERSONAS.finance
          : NORTHLINE_PREVIEW_PERSONAS.facilities;
  const [organization, membership, grants, capabilityOverrides] = await Promise.all([
    repository.getOrganization(NORTHLINE_ORGANIZATION_ID),
    repository.getMembership(NORTHLINE_ORGANIZATION_ID, persona.membershipId),
    repository.listScopeGrantsForMembership(NORTHLINE_ORGANIZATION_ID, persona.membershipId),
    repository.listRoleCapabilityOverrides(NORTHLINE_ORGANIZATION_ID),
  ]);
  const effectivePolicy = resolveRoleCapabilities(membership?.role ?? "support", capabilityOverrides);
  if (!organization || !membership || membership.status !== "active" || membership.role !== domainRoleForOperatorRole[role]) {
    throw new OperatorAccessError("membership", "This preview role is unavailable.");
  }
  const personaUser = await repository.getUserInOrganization(NORTHLINE_ORGANIZATION_ID, membership.userId);
  if (!personaUser || personaUser.status !== "active") throw new OperatorAccessError("membership", "This preview role is unavailable.");
  if (!grants.some(grant => ["ops:*", "ops:read", "ops:write", "ops:read_write", "ops:store_manage", "ops:finance_read"].includes(grant.permission))) {
    throw new OperatorAccessError("membership", "No stores are assigned to this preview role.");
  }
  const regionIds = grants.filter((grant) => grant.scopeKind === "region").map((grant) => grant.scopeId);
  const storeIds = grants.filter((grant) => grant.scopeKind === "store").map((grant) => grant.scopeId);
  if (role === "regional" && !regionIds.length || role === "store_manager" && !storeIds.length) {
    throw new OperatorAccessError("membership", "No stores are assigned to this preview role.");
  }
  const scopedStores = await repository.searchStores({
    organizationId: NORTHLINE_ORGANIZATION_ID,
    regionIds: regionIds.length ? regionIds : undefined,
    storeIds: storeIds.length ? storeIds : undefined,
  }, "", { limit: 100 });
  const organizationName = organization?.name ?? "Demo organization";
  const onlyStore = storeIds.length === 1 ? scopedStores.items.find((store) => store.id === storeIds[0]) : undefined;
  const scopeLabel = onlyStore
    ? `Store ${onlyStore.storeNumber} · ${onlyStore.name}`
    : regionIds.length === 1
      ? `${scopedStores.items[0]?.regionName ?? "Regional scope"} · ${scopedStores.totalCount ?? scopedStores.items.length} stores`
      : role === "finance"
        ? `${organizationName} companywide · review-only financial scope`
        : `${organizationName} companywide · ${scopedStores.totalCount ?? scopedStores.items.length} stores`;
  return {
    accessMode: "preview",
    userId: personaUser.id,
    membershipId: membership?.id,
    displayName: personaUser.displayName,
    email: personaUser.email,
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName,
    scopeLabel,
    regionIds: regionIds.length ? regionIds : undefined,
    storeIds: storeIds.length ? storeIds : undefined,
    permissions: grants.map((grant) => grant.permission),
    effectiveCapabilities: effectivePolicy.capabilities,
    capabilityWarnings: effectivePolicy.warnings,
    demoEdition,
  };
});

async function sessionAndFixture() {
  const session = await getRequestOperatorSession();
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  return { session, fixture };
}

export type ListRouteId = OperatorListRoute;
export type ProgramRouteId = OperatorProgramRoute;
export type DetailRouteId = OperatorDetailRoute;

function requireCapability(session: OperatorSession, capability: OperatorCapability) {
  if (!roleCan(session, capability)) notFound();
}

type ModelWithPageActions = {
  page: {
    primaryAction?: { href: string; label: string };
    secondaryAction?: { href: string; label: string };
  };
};

function roleCanUseAction(session: OperatorSession, href: string) {
  if (href === "#issue-work" || href.startsWith("/app/store-sweeps")) return roleCan(session, "issue_work_order");
  if (href === "/app/work-orders/new" || href.startsWith("/app/work-orders/new?")) return roleCan(session, "create_work_order");
  return roleCanOpenOperatorHref(session.role, href);
}

function enforceVisibleActionPolicy<T extends ModelWithPageActions>(model: T, session: OperatorSession): T {
  if (model.page.primaryAction && !roleCanUseAction(session, model.page.primaryAction.href)) {
    model.page.primaryAction = undefined;
  }
  if (model.page.secondaryAction && !roleCanUseAction(session, model.page.secondaryAction.href)) {
    model.page.secondaryAction = undefined;
  }
  return model;
}

function enforceListLinkPolicy<T extends ListPageViewModel>(model: T, session: OperatorSession): T {
  enforceVisibleActionPolicy(model, session);
  model.metrics = model.metrics?.filter((metric) => roleCanUseAction(session, metric.link.href));
  for (const row of model.table.rows) {
    for (const cell of row.cells) {
      if (cell.link && !roleCanOpenOperatorHref(session.role, cell.link.href)) cell.link = undefined;
    }
  }
  const rowCount = model.table.rows.length;
  model.table.rows = model.table.rows.filter((row) => roleCanOpenOperatorHref(session.role, row.href));
  if (model.table.rows.length !== rowCount) {
    model.resultSummary = `${model.table.rows.length} source record${model.table.rows.length === 1 ? "" : "s"}`;
    model.pagination = undefined;
  }
  return model;
}

function enforceDashboardLinkPolicy<T extends DashboardPageViewModel>(model: T, session: OperatorSession): T {
  const role = session.role;
  enforceVisibleActionPolicy(model, session);
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

function enforceDetailLinkPolicy<T extends DetailPageViewModel>(model: T, session: OperatorSession): T {
  const role = session.role;
  enforceVisibleActionPolicy(model, session);
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
  const session = await getRequestOperatorSession();
  if (!roleCanAccessListRoute(session.role, route)) notFound();
  if (route === "action-center") return enforceListLinkPolicy(await buildReviewQueue(await getServerOpsRepository(),session,searchParams,getServerOpsReportingAsOf()),session);
  if (route === "stores" && (Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort) === "cost") {
    return enforceListLinkPolicy(await buildStoreCostRanking(await getServerOpsRepository(), session, searchParams, getServerOpsReportingAsOf()), session);
  }
  const requestedKeys = Object.entries(searchParams).filter(([key, value]) => !["saved", "updated", "created", "success", "notice", "error", "layout"].includes(key) && Boolean(Array.isArray(value) ? value[0] : value)).map(([key]) => key);
  const supportedQueryKeys: Partial<Record<ListRouteId, ReadonlySet<string>>> = {
    requests: new Set(["q", "page", "status", "store", "selected"]),
    "work-orders": new Set(["q", "page", "status", "stage", "store", "vendor", "region", "category", "path", "asset", "component", "hasCost", "createdFrom", "createdThrough", "costFrom", "costTo", "costMonth", "currency", "basis", "period", "selected", "visitPlan", "storeGroup", "appointment", "reviewWindow", "opportunity"]),
    visits: new Set(["q", "page", "status", "store", "vendor", "review", "selected"]),
    stores: new Set(["q", "page", "selected"]),
    vendors: new Set(["q", "page", "selected"]),
  };
  const usesSpecialFixtureProjection = requestedKeys.some((key) => !supportedQueryKeys[route]?.has(key))
    || route === "visits" && (Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status) === "upcoming";
  if (QUERY_FIRST_LIST_ROUTES.has(route) && !usesSpecialFixtureProjection) {
    const repository = await getServerOpsRepository();
    return enforceListLinkPolicy(await buildQueryListModel(repository, session, route, searchParams), session);
  }
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  return enforceListLinkPolicy(
    buildListModel(fixture, session, route, searchParams),
    session,
  );
}

export async function loadApprovedWorkPortfolioModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  if (!roleCanAccessListRoute(context.session.role, "work-orders")) notFound();
  const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  return buildApprovedWorkPortfolio(context.fixture, context.session, {
    q: firstValue(searchParams.q),
    storeId: firstValue(searchParams.store),
    regionId: firstValue(searchParams.region),
    categoryKey: firstValue(searchParams.category),
    status: firstValue(searchParams.status),
    stage: firstValue(searchParams.stage),
    vendorId: firstValue(searchParams.vendor),
    hasCost: firstValue(searchParams.hasCost) === "true",
    costFrom: firstValue(searchParams.costFrom),
    costMonth: firstValue(searchParams.costMonth),
    assetId: firstValue(searchParams.asset),
    componentId: firstValue(searchParams.component),
    path: firstValue(searchParams.path),
    reviewWindow: firstValue(searchParams.reviewWindow),
    opportunity: firstValue(searchParams.opportunity),
    storeGroup: firstValue(searchParams.storeGroup),
    matchStoreId: firstValue(searchParams.matchStore),
  });
}

export async function loadApprovalPolicyWorkspaceModel() {
  const session = await getRequestOperatorSession();
  requireCapability(session, "administer");
  if (session.storeIds !== undefined || session.regionIds !== undefined) notFound();
  const context = await sessionAndFixture();
  return enforceDetailLinkPolicy(
    buildApprovalPolicyWorkspaceModel(context.fixture, context.session),
    context.session,
  );
}

export async function loadNotificationSettingsModel() {
  const session = await getRequestOperatorSession();
  requireCapability(session, "administer");
  const repository = await getServerOpsRepository();
  return {
    organizationName: session.organizationName,
    rules: await repository.listNotificationRules(session.organizationId),
    providerConfigured: Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM),
    providerLabel: process.env.EMAIL_PROVIDER?.trim() || "Not configured",
    fromAddress: process.env.EMAIL_FROM?.trim(),
  };
}

export async function loadImportWorkspaceAccess() {
  const session = await getRequestOperatorSession();
  requireCapability(session, "administer");
  return { organizationName: session.organizationName };
}

export async function loadDashboardModel() {
  const session = await getRequestOperatorSession();
  const asOf = getServerOpsReportingAsOf();
  const repository = await getServerOpsRepository();
  const scope = { organizationId: session.organizationId, storeIds: session.storeIds, regionIds: session.regionIds };
  const window = { asOf, costFrom: rollingYearStart(asOf), costTo: asOf.slice(0, 10), currency: "USD" };
  const [activity, attention, charts, context, lifecycle] = await Promise.all([
    repository.getDashboardActivity(scope, window),
    repository.listAttention(scope, attentionAccess(session), { asOf, limit: 7 }),
    loadDashboardChartPages(repository, scope, window),
    repository.getDashboardContext(scope),
    repository.getDashboardLifecycle(scope, asOf),
  ]);
  return enforceDashboardLinkPolicy(presentQueryDashboard({ activity, attention, charts, context, lifecycle }, session, window), session);
}

export async function loadReviewSourcesModel(searchParams: OperatorSearchParameters) {
  const session=await getRequestOperatorSession();
  if(!roleCanAccessListRoute(session.role,"action-center")) notFound();
  return buildReviewSources(await getServerOpsRepository(),session,searchParams,getServerOpsReportingAsOf());
}
export async function loadReviewSelection(searchParams: OperatorSearchParameters,ids:string[]) {
  const session=await getRequestOperatorSession();
  if(!roleCanAccessListRoute(session.role,"action-center")) notFound();
  return enforceListLinkPolicy(await buildReviewQueue(await getServerOpsRepository(),session,searchParams,getServerOpsReportingAsOf(),ids),session);
}

export async function loadSearchModel(searchParams: OperatorSearchParameters = {}) {
  const session = await getRequestOperatorSession();
  return buildQuerySearchModel(await getServerOpsRepository(), session, searchParams);
}

export async function loadProgramModel(route: ProgramRouteId, searchParams: OperatorSearchParameters = {}) {
  if (route === "pm") {
    const session = await getRequestOperatorSession();
    if (!roleCanAccessProgramRoute(session.role, route)) notFound();
        if (searchParams.reviewSource || searchParams.pmReview) {
      if (!roleCanAccessListRoute(session.role, "invoices")) notFound();
      return enforceDashboardLinkPolicy(await buildPmReviewSources(await getServerOpsRepository(),session,searchParams),session);
    }
    return enforceDashboardLinkPolicy(await (searchParams.setup ? buildPmSetupSources : buildPmScheduleModel)(await getServerOpsRepository(), session, getServerOpsReportingAsOf(), searchParams), session);
  }
  const context = await sessionAndFixture();
  if (!roleCanAccessProgramRoute(context.session.role, route)) notFound();
  return enforceDashboardLinkPolicy(
    buildProgramModel(context.fixture, context.session, route, searchParams),
    context.session,
  );
}

export async function loadTrendsModel(searchParams: OperatorSearchParameters = {}) {
  const session = await getRequestOperatorSession();
  if (!roleCanAccessProgramRoute(session.role, "trends")) notFound();
  const fixture = await getRequestOpsTrendsFixtureSnapshot(session.organizationId);
  return buildTrendsModel(fixture, session, searchParams);
}

/** One analysis pass for CSV export. The presenter returns its complete,
 * consistently scoped source projection only on this server-only path. */
export async function loadTrendsExportModel(searchParams: OperatorSearchParameters = {}) {
  const session = await getRequestOperatorSession();
  if (!roleCanAccessProgramRoute(session.role, "trends")) notFound();
  const fixture = await getRequestOpsTrendsFixtureSnapshot(session.organizationId);
  return buildTrendsModel(fixture, session, searchParams, { includeExportRows: true });
}

export async function loadTrendsPageData(searchParams: OperatorSearchParameters = {}) {
  const session = await getRequestOperatorSession();
  if (!roleCanAccessProgramRoute(session.role, "trends")) notFound();
  const [fixture, repository] = await Promise.all([
    getRequestOpsTrendsFixtureSnapshot(session.organizationId), getServerOpsRepository(),
  ]);
  const model = buildTrendsModel(fixture, session, searchParams);
  const savedViews = session.membershipId
    ? await repository.listSavedViews(session.organizationId, session.membershipId, "trends")
    : [];
  return { model, savedViews, session };
}

export async function loadPmProgramManagementModel(searchParams: OperatorSearchParameters = {}): Promise<PmProgramManagementModel> {
  const session=await getRequestOperatorSession();
  if(!roleCanAccessProgramRoute(session.role,"pm"))notFound();
  const model=await buildPmSetupManagement(await getServerOpsRepository(),session,getServerOpsReportingAsOf(),searchParams);
  model.canReviewInvoices=roleCanAccessListRoute(session.role,"invoices");
  if(model.canReviewInvoices){const reviews=await buildPmReviewPreview(await getServerOpsRepository(),session,searchParams);model.reconciliations=reviews.rows;model.summary.evidenceReviews=reviews.total;model.reconciliationHref=reviews.href;}
  return model;
}
export async function loadDetailModel(route: DetailRouteId, id: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, route)) notFound();
  const model = buildDetailModel(context.fixture, context.session, route, id);
  if (route === "work-order" && roleCan(context.session, "issue_work_order")) {
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
    context.session,
  );
}

export async function loadConnectedWorkReview(workOrderId: string) {
  const session = await getRequestOperatorSession();
  const { loadWorkReview } = await import("@/lib/ops/work-review");
  return loadWorkReview(await getServerOpsRepository(), session, workOrderId, await getServerOpsReportingAsOf());
}

export async function loadVendorPerformanceListModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  if (!roleCanAccessListRoute(context.session.role, "vendors")) notFound();
  return buildVendorPerformanceListModel(context.fixture, context.session, searchParams);
}

export async function loadVendorPerformanceDetailModel(vendorId: string, query: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "vendor")) notFound();
  return paginateVendorEvidence(buildVendorPerformanceDetailModel(context.fixture, context.session, vendorId), vendorId, query);
}

export async function loadCreateRequestModel(query: OperatorSearchParameters = {}): Promise<import("@/components/ops/data-contract").CreateRequestPageViewModel> {
  const session=await getRequestOperatorSession();requireCapability(session,"create_request");
  const repository=await getServerOpsRepository(),page=await repository.searchStores(session,"",{limit:25}),requested=Array.isArray(query.store)?query.store[0]:query.store;
  const selected=requested?await repository.getStore(session.organizationId,requested):null;
  if(requested&&(!selected||!pmStoreAllowed(session,selected)))notFound();
  const stores=page.items.map(s=>({value:s.id,label:`Store ${s.storeNumber} · ${s.name}`}));
  if(selected&&!stores.some(s=>s.value===selected.id))stores.unshift({value:selected.id,label:`Store ${selected.storeNumber} · ${selected.name}`});
  return {state:{kind:"ready"},page:{title:"Report an issue",eyebrow:"Issue intake",description:"Choose a store and describe the problem.",scopeLabel:session.scopeLabel},submitAction:"/api/ops/requests",cancelLink:{label:"Back to requests",href:"/app/requests"},stores,storeLookup:Boolean(page.nextCursor),storeNextCursor:page.nextCursor,defaultStoreId:selected?.id??(!page.nextCursor&&stores.length===1?stores[0].value:undefined),priorityOptions:[{value:"routine",label:"Routine"},{value:"urgent",label:"Urgent"},{value:"emergency",label:"Emergency"}]};
}

export async function loadCreateWorkOrderModel(searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  requireCapability(context.session, "create_work_order");
  return buildCreateWorkOrderModel(context.fixture, context.session, searchParams);
}

export async function loadCreateStoreModel() {
  const session=await getRequestOperatorSession();requireCapability(session,"create_store");
  if(session.storeIds!==undefined||session.regionIds!==undefined)notFound();
  const repository=await getServerOpsRepository(),[organization,configuration]=await Promise.all([repository.getOrganization(session.organizationId),repository.readOnboardingConfiguration(session.organizationId)]);
  if(!organization)notFound();
  return buildCreateStoreModel({organizations:[organization],regions:configuration.regions},session);
}
export async function loadCreateVendorModel() {
  const session=await getRequestOperatorSession();requireCapability(session,"onboard_vendor");
  if(session.storeIds!==undefined||session.regionIds!==undefined)notFound();
  return buildCreateVendorModel(await (await getServerOpsRepository()).readOnboardingConfiguration(session.organizationId),session);
}

export async function loadVendorIssuanceModel(workOrderId: string) {
  const context = await sessionAndFixture();
  const model = buildVendorIssuanceModel(context.fixture, context.session, workOrderId);
  model.permitted = model.available && roleCan(context.session, "issue_work_order");
  return model;
}

export async function loadEstimateComparisonModel(workOrderId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  const model = buildEstimateComparisonModel(context.fixture, context.session, workOrderId);
  if (!model.available) notFound();
  return model;
}

export async function loadWorkOrderCaseModel(workOrderId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  const fixture = context.fixture;
  const workOrder = fixture.workOrders.find((row) => row.organizationId === context.session.organizationId && row.id === workOrderId);
  if (!workOrder) notFound();
  const store = fixture.stores.find((row) => row.id === workOrder.storeId);
  const estimateRequests = fixture.estimateRequests.filter((row) => row.workOrderId === workOrderId);
  const requestIds = new Set(estimateRequests.map((row) => row.id));
  const assignments = fixture.assignments.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId);
  const currentAssignment = [...assignments].sort((left, right) => right.assignedAt.localeCompare(left.assignedAt))[0];
  const internalMembership = currentAssignment?.internalMembershipId
    ? fixture.memberships.find((row) => row.organizationId === context.session.organizationId && row.id === currentAssignment.internalMembershipId)
    : undefined;
  const providerName = currentAssignment?.vendorId
    ? fixture.vendors.find((row) => row.organizationId === context.session.organizationId && row.id === currentAssignment.vendorId)?.name
    : internalMembership
      ? fixture.users.find((row) => row.id === internalMembership.userId)?.displayName
      : undefined;
  const siteVisitWorkOrders = fixture.siteVisitWorkOrders.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId);
  const linkedVisitIds = new Set(siteVisitWorkOrders.map((row) => row.visitId));
  return buildWorkOrderCase({
    hasPendingApproval: fixture.approvalRequests.some((row) => row.organizationId === context.session.organizationId && (row.subjectType === "work_order" && row.subjectId === workOrderId || row.subjectType === "service_request" && row.subjectId === workOrder.requestId) && approvalRequestState(row, fixture.approvalDecisions) === "pending"),
    now: context.fixture.asOf,
    workOrder,
    timeZone: store?.timeZone ?? context.fixture.organizations.find((row) => row.id === context.session.organizationId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE,
    storeName: store ? `${store.storeNumber} - ${store.name}` : undefined,
    providerName,
    assignments,
    issuances: fixture.issuances.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    vendorResponses: fixture.vendorResponses.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    appointments: await (await getServerOpsRepository()).listServiceAppointmentsForWorkOrder(context.session.organizationId, workOrderId),
    continuations: await (await getServerOpsRepository()).listVendorContinuationsForWorkOrder(context.session.organizationId, workOrderId),
    visits: fixture.visits.filter((row) => row.organizationId === context.session.organizationId && (row.workOrderId === workOrderId || linkedVisitIds.has(row.id))),
    siteVisitWorkOrders,
    verifications: fixture.workOrderVerifications.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    impactAssessments: workOrder.requestId
      ? fixture.requestImpactAssessments.filter((row) => row.organizationId === context.session.organizationId && row.requestId === workOrder.requestId)
      : [],
    workflowTasks: fixture.workflowTasks.filter((row) => row.organizationId === context.session.organizationId && (row.workOrderId === workOrderId || (workOrder.requestId && row.serviceRequestId === workOrder.requestId))),
    followUps: fixture.followUps.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    costLines: fixture.costLines.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    // Invoice evidence is scoped to THIS work order through its allocations;
    // an unrelated tenant invoice must never surface on the case.
    ...(() => {
      const linkedReferenceIds = new Set(
        fixture.invoiceAllocations
          .filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId)
          .map((row) => row.invoiceReferenceId),
      );
      const legacyInvoices = fixture.invoiceReferences
        .filter((row) => row.organizationId === context.session.organizationId && linkedReferenceIds.has(row.id))
        .map((row) => ({ id: row.id, status: row.matchStatus }));
      const invoiceLineAllocations = fixture.invoiceLineAllocations.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId);
      const lineIds = new Set(invoiceLineAllocations.map((row) => row.invoiceLineId));
      const allocatedLines = fixture.invoiceLines.filter((row) => row.organizationId === context.session.organizationId && lineIds.has(row.id));
      const invoiceIds = new Set(allocatedLines.map((row) => row.invoiceId));
      const invoiceLines = fixture.invoiceLines.filter((row) => row.organizationId === context.session.organizationId && invoiceIds.has(row.invoiceId));
      const invoices = fixture.invoices.filter((row) => row.organizationId === context.session.organizationId && invoiceIds.has(row.id));
      return {
        invoices: invoices.length ? invoices : legacyInvoices,
        invoiceLines,
        invoiceLineAllocations,
        invoiceExceptions: fixture.invoiceExceptions.filter((row) => row.organizationId === context.session.organizationId && invoiceIds.has(row.invoiceId)),
        invoiceAdjustments: fixture.invoiceAdjustments.filter((row) => row.organizationId === context.session.organizationId && invoiceIds.has(row.invoiceId)),
        valueEvents: fixture.valueEvents.filter((row) => row.organizationId === context.session.organizationId && (row.workOrderId === workOrderId || Boolean(row.invoiceLineId && lineIds.has(row.invoiceLineId)))),
      };
    })(),
    estimateRequests,
    estimateProposals: fixture.estimateProposals.filter((row) => requestIds.has(row.requestId)),
    replacementEvents: fixture.replacementEvents.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
  });
}

function localInputValue(value: string, timeZone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export async function loadHeldWorkActionsModel(workOrderId: string): Promise<HeldWorkActionsModel> {
  const session = await getRequestOperatorSession();
  if (!roleCanAccessDetailRoute(session.role, "work-order")) notFound();
  const repository = await getServerOpsRepository();
  const workOrder = await repository.getWorkOrder(session.organizationId, workOrderId);
  if (!workOrder) notFound();
  const scopeStore = await repository.getStore(session.organizationId,workOrder.storeId);
  if (!scopeStore || !pmStoreAllowed(session,scopeStore)) notFound();
  const [hold, store] = await Promise.all([
    repository.getWorkOrderVisitHold(session.organizationId, workOrderId),
    repository.getStore(session.organizationId, workOrder.storeId),
  ]);
  const organizationTimeZone = (await repository.getOrganization(session.organizationId))?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const storeTimeZone = store?.timeZone ?? organizationTimeZone;
  const fallbackDeadlineMs = Date.parse(await getServerOpsReportingAsOf()) + 30 * 24 * 60 * 60_000;
  const recordedDeadlineMs = Date.parse(workOrder.dueAt ?? "");
  const defaultDeadline = new Date(Number.isFinite(recordedDeadlineMs)
    ? Math.max(recordedDeadlineMs, fallbackDeadlineMs)
    : fallbackDeadlineMs).toISOString();
  const claimedVendor = hold?.claimedVendorId
    ? await repository.getVendor(session.organizationId, hold.claimedVendorId)
    : null;
  const formatMoney = (amountMinor: number, currency: string) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
  return {
    workOrderId,
    permitted: roleCan(session, "control_work_order"),
    eligible: Boolean(workOrder.categoryKey) && workOrder.status === "approved",
    categoryLabel: workOrder.categoryKey
      ? workOrder.categoryKey.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
      : undefined,
    storeTimeZone,
    deadlineInputValue: localInputValue(defaultDeadline, storeTimeZone),
    hold: hold && hold.status !== "cancelled" ? {
      status: hold.status,
      posture: hold.posture,
      deadlineLabel: formatInTimeZone(hold.deadlineAt, storeTimeZone),
      deadlineInputValue: localInputValue(hold.deadlineAt, storeTimeZone),
      internalReviewThreshold: hold.internalReviewThreshold
        ? formatMoney(hold.internalReviewThreshold.amountMinor, hold.internalReviewThreshold.currency)
        : undefined,
      claimedVendorName: claimedVendor?.name,
    } : undefined,
  };
}
export async function loadVendorResponseActionsModel(workOrderId: string) {
  const session = await getRequestOperatorSession();
  if (!roleCanAccessDetailRoute(session.role, "work-order")) notFound();
  if (!roleCan(session, "control_work_order")) return null;
  const orgId = session.organizationId, repository = await getServerOpsRepository();
  const workOrder = await repository.getWorkOrder(orgId,workOrderId);
  if (!workOrder) return null;
  const store = await repository.getStore(orgId,workOrder.storeId);
  if (!store || !pmStoreAllowed(session,store)) notFound();
  const [activeAssignment,latestIssuance,organization] = await Promise.all([repository.getActiveAssignment(orgId,workOrderId),repository.getLatestIssuanceForWorkOrder(orgId,workOrderId),repository.getOrganization(orgId)]);
  const actionable = await repository.getActionableVendorResponse(orgId,workOrderId,activeAssignment?.id ?? latestIssuance?.assignmentId,latestIssuance?.id);
  if (!actionable || (actionable.response !== "question" && ["completed_pending_review", "resolved", "closed", "cancelled"].includes(workOrder.status))) return null;
  const timeZone = store?.timeZone ?? organization?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  return {
    responseId: actionable.id,
    kind: actionable.response,
    responderName: actionable.responderName,
    proposedAt: actionable.proposedAt,
    proposedAtLabel: actionable.proposedAt ? formatInTimeZone(actionable.proposedAt, timeZone) : undefined,
    timeZone,
    message: actionable.message,
    respondedAt: actionable.respondedAt,
  };
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

export async function loadRequestWorkLinkModel(
  requestId: string,
  searchParams: { q?: string | string[]; page?: string | string[]; returnTo?: string | string[] },
): Promise<RequestWorkLinkPageViewModel> {
  const session = await getRequestOperatorSession();
  if (!roleCanAccessDetailRoute(session.role, "request") || !roleCan(session, "review_request")) notFound();
  const repository = await getServerOpsRepository();
  const request = await repository.getRequest(session.organizationId, requestId);
  if (!request || !["submitted", "under_review", "acknowledged"].includes(request.status)) notFound();
  const store = await repository.getStore(session.organizationId, request.storeId);
  if (!store
    || (session.storeIds !== undefined && !session.storeIds.includes(store.id))
    || (session.regionIds !== undefined && (!store.regionId || !session.regionIds.includes(store.regionId)))) notFound();
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const q = first(searchParams.q)?.trim() ?? "";
  const requestedPage = Number(first(searchParams.page) ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 10;
  const result = await repository.listWorkOrders(
    { organizationId: session.organizationId, regionIds: session.regionIds, storeIds: session.storeIds },
    { storeId: request.storeId, search: q, statuses: ["draft", "awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"], limit: pageSize, offset: (page - 1) * pageSize },
  );
  const resultSummary = result.totalCount === undefined
    ? `${result.items.length} active work order${result.items.length === 1 ? "" : "s"} on this page${result.nextCursor ? " · more available" : ""}`
    : `${result.totalCount} matching active work order${result.totalCount === 1 ? "" : "s"}`;
  const totalPages = result.totalCount === undefined ? page + Number(Boolean(result.nextCursor)) : Math.max(1, Math.ceil(result.totalCount / pageSize));
  const rawReturn = first(searchParams.returnTo);
  const returnHref = rawReturn?.startsWith(`/app/requests/${request.id}`) && !rawReturn.startsWith("//") ? rawReturn : `/app/requests/${request.id}`;
  const hrefForPage = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(nextPage));
    params.set("returnTo", returnHref);
    return `/app/requests/${encodeURIComponent(request.id)}/link?${params}`;
  };
  return {
    requestId: request.id, reference: request.reference, problem: request.problem,
    expectedStatus: request.status as "submitted" | "under_review" | "acknowledged",
    currentLinkedWorkOrderId: request.linkedWorkOrderId, returnHref, searchValue: q,
    searchAction: `/app/requests/${encodeURIComponent(request.id)}/link`,
    rows: result.items.map((work) => ({ id: work.id, number: work.number, problem: work.problem, statusLabel: work.status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US")), serviceContext: `${work.categoryKey ? work.categoryKey.replaceAll("_", " ") : "Unclassified"} · ${work.vendorName ?? (work.assignmentKind === "internal" ? "Internal maintenance" : "Provider not chosen")}` })),
    currentPage: page, totalPages, resultSummary,
    previousHref: page > 1 ? hrefForPage(page - 1) : undefined,
    nextHref: result.nextCursor ? hrefForPage(page + 1) : undefined,
    linkAction: `/api/ops/requests/${encodeURIComponent(request.id)}/link`,
  };
}

export async function loadAttentionItemModel(itemId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessListRoute(context.session.role, "action-center")) notFound();
  const model = buildAttentionItemModel(context.fixture, context.session, itemId);
  if (!model.control.available) notFound();
  model.detail = enforceDetailLinkPolicy(model.detail, context.session);
  return model;
}

export async function loadOwnerBriefModel(query: OperatorSearchParameters = {}) {
  const session = await getRequestOperatorSession();
  const role = session.role;
  if (role !== "executive" && role !== "facilities" && role !== "regional") return null;
  return buildQueryOwnerBrief(await getServerOpsRepository(), session, query, await getServerOpsReportingAsOf());
}

export async function loadBriefRecordsModel(query: OperatorSearchParameters) {
  const session = await getRequestOperatorSession();
  if (!["executive", "facilities", "regional"].includes(session.role)) notFound();
  return buildQueryBriefRecords(await getServerOpsRepository(), session, query, await getServerOpsReportingAsOf());
}

export async function loadJobHealthModel() {
  const session = await getRequestOperatorSession();
  const role = session.role;
  if (role !== "executive" && role !== "facilities" || session.storeIds !== undefined || session.regionIds !== undefined) return null;
  const repository = await getServerOpsRepository();
  const [runs, outboxCounts] = await Promise.all([
    repository.listRecentJobRuns(session.organizationId, 20),
    repository.outboxStatusCounts(session.organizationId),
  ]);
  return { generatedAt: await getServerOpsReportingAsOf(), runs, outboxCounts };
}

export async function loadSavedViewsModel(surface: string) {
  const session = await getRequestOperatorSession();
  const repository = await getServerOpsRepository();
  return repository.listSavedViews(session.organizationId, (session.membershipId ?? ""), surface);
}

export async function loadCoverageQualityModel() {
  const session = await getRequestOperatorSession();
  const role = session.role;
  if (role !== "executive" && role !== "facilities" && role !== "regional") return null;
  return buildIntegritySummary(await getServerOpsRepository(), session, await getServerOpsReportingAsOf());
}

export async function loadIntegrityRecordsModel(query: OperatorSearchParameters) {
  const session = await getRequestOperatorSession();
  if (!["executive", "facilities", "regional"].includes(session.role)) notFound();
  return buildIntegrityRecords(await getServerOpsRepository(), session, await getServerOpsReportingAsOf(), query);
}
