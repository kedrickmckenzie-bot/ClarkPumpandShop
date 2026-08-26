import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type {
  DashboardPageViewModel,
  DetailPageViewModel,
  DemoEdition,
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
import { getServerOpsRepository, getServerOpsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { buildOwnerBrief } from "@/lib/ops/owner-brief";
import { buildWorkOrderCase } from "@/lib/ops/work-order-case";
import { formatInTimeZone } from "@/lib/ops/local-date-time";
import { buildClosedLoopCoverage, buildDataQualityIssues } from "@/lib/ops/coverage-quality";
import { buildVendorScorecards } from "@/lib/ops/vendor-scorecards";
import {
  LEGACY_OPS_PREVIEW_ROLE_COOKIE,
  OPS_PREVIEW_EDITION_COOKIE,
  OPS_PREVIEW_ROLE_COOKIE,
} from "@/lib/server/runtime-identifiers";
import { DEFAULT_DEMO_EDITION, isDemoEdition } from "@/components/ops/demo-edition";
import type { OpsFixture } from "@/lib/ops/types";
import type { PmProgramManagementModel } from "@/components/workspace/pm-program-management";
import {
  buildCreateRequestModel,
  buildCreateStoreModel,
  buildCreateVendorModel,
  buildCreateWorkOrderModel,
  buildAccountabilityDashboardModel,
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
  const requestedEdition = cookieStore.get(OPS_PREVIEW_EDITION_COOKIE)?.value
    ?? process.env.OPS_OPERATOR_PREVIEW_EDITION;
  const demoEdition: DemoEdition = isDemoEdition(requestedEdition)
    ? requestedEdition
    : DEFAULT_DEMO_EDITION;
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
    demoEdition,
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
    context.session.demoEdition === "accountability"
      ? buildAccountabilityDashboardModel(context.fixture, context.session)
      : buildDashboardModel(context.fixture, context.session),
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

function pmTypeKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/^equipment-template-/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function pmProgramMatchesTemplate(applicableAssetTypes: string[], templateId: string, templateName: string) {
  const accepted = new Set([templateId, pmTypeKey(templateId), pmTypeKey(templateName)]);
  return applicableAssetTypes.some((value) => accepted.has(value) || accepted.has(pmTypeKey(value)));
}

function shortDate(value: string | undefined) {
  if (!value) return "not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export async function loadPmProgramManagementModel(searchParams: OperatorSearchParameters = {}): Promise<PmProgramManagementModel> {
  const { session, fixture } = await sessionAndFixture();
  if (!roleCanAccessProgramRoute(session.role, "pm")) notFound();
  const selectedStoreId = Array.isArray(searchParams.store) ? searchParams.store[0] : searchParams.store;
  const selectedProgramId = Array.isArray(searchParams.program) ? searchParams.program[0] : searchParams.program;
  const visibleStores = fixture.stores.filter((store) => {
    if (store.organizationId !== session.organizationId) return false;
    if (session.storeIds?.length && !session.storeIds.includes(store.id)) return false;
    if (session.regionIds?.length && (!store.regionId || !session.regionIds.includes(store.regionId))) return false;
    return true;
  });
  const visibleStoreIds = new Set(visibleStores.map((store) => store.id));
  const storesById = new Map(visibleStores.map((store) => [store.id, store]));
  const templates = fixture.equipmentTemplates.filter((template) => template.organizationId === session.organizationId && template.active);
  const visibleAssets = fixture.assets.filter((asset) => asset.organizationId === session.organizationId && visibleStoreIds.has(asset.storeId) && asset.status !== "retired");
  const assetById = new Map(visibleAssets.map((asset) => [asset.id, asset]));
  const programs = fixture.maintenancePrograms.filter((program) => program.organizationId === session.organizationId && program.status === "active");
  const programById = new Map(programs.map((program) => [program.id, program]));
  const visiblePlans = fixture.pmPlans.filter((plan) => plan.organizationId === session.organizationId && plan.active && plan.storeId && visibleStoreIds.has(plan.storeId));

  const equipmentTypesForProgram = (program: (typeof programs)[number]) => templates.filter((template) => pmProgramMatchesTemplate(program.applicableAssetTypes, template.id, template.name));
  const matchingAssetsForProgram = (program: (typeof programs)[number]) => {
    const matchingTemplateIds = new Set(equipmentTypesForProgram(program).map((template) => template.id));
    return visibleAssets.filter((asset) => asset.equipmentTemplateId && matchingTemplateIds.has(asset.equipmentTemplateId));
  };
  const programRows = programs.map((program) => {
    const programTemplates = equipmentTypesForProgram(program);
    const matchingAssets = matchingAssetsForProgram(program);
    const plans = visiblePlans.filter((plan) => plan.programId === program.id);
    const enrolledAssetIds = new Set(plans.map((plan) => plan.assetId).filter((id): id is string => Boolean(id)));
    const gaps = matchingAssets.filter((asset) => !enrolledAssetIds.has(asset.id)).length;
    const overrides = plans.filter((plan) => plan.cadenceDays !== program.frequencyDays || plan.completionWindowDays !== program.dueWindowDays || Boolean(plan.cadenceOverrideReason)).length;
    return {
      id: program.id,
      name: program.name,
      serviceAreaLabel: program.tradeKey.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US")),
      equipmentTypeLabels: programTemplates.map((template) => template.name),
      cadenceLabel: `Every ${program.frequencyDays} days`,
      windowLabel: `±${program.dueWindowDays} day window`,
      anchorLabel: shortDate(program.scheduleAnchorAt),
      matchingEquipment: matchingAssets.length,
      enrolledPlans: plans.length,
      coverageGaps: gaps,
      localOverrides: overrides,
      href: `/app/pm?program=${encodeURIComponent(program.id)}${selectedStoreId ? `&store=${encodeURIComponent(selectedStoreId)}` : ""}`,
      selected: selectedProgramId === program.id,
    };
  });
  const filteredPlans = visiblePlans
    .filter((plan) => !selectedStoreId || plan.storeId === selectedStoreId)
    .filter((plan) => !selectedProgramId || plan.programId === selectedProgramId)
    .sort((left, right) => {
      const leftStore = storesById.get(left.storeId ?? "")?.storeNumber ?? "";
      const rightStore = storesById.get(right.storeId ?? "")?.storeNumber ?? "";
      return leftStore.localeCompare(rightStore, undefined, { numeric: true }) || left.name.localeCompare(right.name);
    })
    .slice(0, 75)
    .map((plan) => {
      const store = storesById.get(plan.storeId ?? "");
      const asset = plan.assetId ? assetById.get(plan.assetId) : undefined;
      const program = plan.programId ? programById.get(plan.programId) : undefined;
      const inherited = Boolean(program) && plan.cadenceDays === program?.frequencyDays && plan.completionWindowDays === program?.dueWindowDays && !plan.cadenceOverrideReason;
      return {
        id: plan.id,
        planName: plan.name,
        storeLabel: store ? `Store ${store.storeNumber} · ${store.name}` : "Unknown store",
        assetLabel: asset ? `${asset.name} · ${asset.assetTag}` : "Store-level plan",
        programName: program?.name ?? "Store-created plan",
        cadenceLabel: `Every ${plan.cadenceDays} days · ±${plan.completionWindowDays} days`,
        sourceLabel: inherited ? "Company standard" : program ? "Store override" : "Store-created",
        overrideReason: plan.cadenceOverrideReason,
        href: `/app/pm/plans/${encodeURIComponent(plan.id)}`,
      };
    });
  const matchingEquipment = programRows.reduce((sum, program) => sum + program.matchingEquipment, 0);
  return {
    scopeLabel: session.scopeLabel,
    canCreateMasterSchedule: session.role === "executive" || session.role === "facilities",
    summary: {
      activePrograms: programs.length,
      matchingEquipment,
      enrolledPlans: programRows.reduce((sum, program) => sum + program.enrolledPlans, 0),
      coverageGaps: programRows.reduce((sum, program) => sum + program.coverageGaps, 0),
      localOverrides: programRows.reduce((sum, program) => sum + program.localOverrides, 0),
    },
    programs: programRows,
    plans: filteredPlans,
  };
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

export async function loadWorkOrderCaseModel(workOrderId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  const fixture = context.fixture;
  const workOrder = fixture.workOrders.find((row) => row.organizationId === context.session.organizationId && row.id === workOrderId);
  if (!workOrder) notFound();
  const store = fixture.stores.find((row) => row.id === workOrder.storeId);
  const estimateRequests = fixture.estimateRequests.filter((row) => row.workOrderId === workOrderId);
  const requestIds = new Set(estimateRequests.map((row) => row.id));
  return buildWorkOrderCase({
    now: context.fixture.asOf,
    workOrder,
    timeZone: store?.timeZone ?? context.fixture.organizations.find((row) => row.id === context.session.organizationId)?.timeZone ?? "UTC",
    storeName: store ? `${store.storeNumber} - ${store.name}` : undefined,
    assignments: fixture.assignments.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    issuances: fixture.issuances.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    vendorResponses: fixture.vendorResponses.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    appointments: await (await getServerOpsRepository()).listServiceAppointmentsForWorkOrder(context.session.organizationId, workOrderId),
    continuations: await (await getServerOpsRepository()).listVendorContinuationsForWorkOrder(context.session.organizationId, workOrderId),
    visits: fixture.visits.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    workflowTasks: fixture.workflowTasks.filter((row) => row.organizationId === context.session.organizationId && (row.workOrderId === workOrderId || (workOrder.requestId && row.serviceRequestId === workOrder.requestId))),
    followUps: fixture.followUps.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    costLines: fixture.costLines.filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId),
    // Invoice evidence is scoped to THIS work order through its allocations;
    // an unrelated tenant invoice must never surface on the case.
    invoices: (() => {
      const linkedReferenceIds = new Set(
        fixture.invoiceAllocations
          .filter((row) => row.organizationId === context.session.organizationId && row.workOrderId === workOrderId)
          .map((row) => row.invoiceReferenceId),
      );
      return fixture.invoiceReferences
        .filter((row) => row.organizationId === context.session.organizationId && linkedReferenceIds.has(row.id))
        .map((row) => ({ id: row.id, status: row.matchStatus }));
    })(),
    estimateRequests,
    estimateProposals: fixture.estimateProposals.filter((row) => requestIds.has(row.requestId)),
  });
}
export async function loadVendorResponseActionsModel(workOrderId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  if (!roleCan(context.session.role, "control_work_order")) return null;
  const orgId = context.session.organizationId;
  const workOrder = context.fixture.workOrders.find((row) => row.organizationId === orgId && row.id === workOrderId);
  if (!workOrder || ["completed_pending_review", "resolved", "closed", "cancelled"].includes(workOrder.status)) return null;
  const repository = await getServerOpsRepository();
  const [activeAssignment, latestIssuance, continuations] = await Promise.all([
    repository.getActiveAssignment(orgId, workOrderId),
    repository.getLatestIssuanceForWorkOrder(orgId, workOrderId),
    repository.listVendorContinuationsForWorkOrder(orgId, workOrderId),
  ]);
  const responses = context.fixture.vendorResponses
    .filter((row) => row.organizationId === orgId && row.workOrderId === workOrderId)
    .sort((a, b) => b.respondedAt.localeCompare(a.respondedAt));
  const handled = new Set(
    continuations.map((row) => row.vendorResponseId),
  );
  const actionable = responses.find((row) =>
    !handled.has(row.id)
    && ((row.response === "proposed_date" || row.response === "question")
      ? row.assignmentId === activeAssignment?.id && row.issuanceId === latestIssuance?.id
      : row.response === "declined"));
  if (!actionable) return null;
  const store = context.fixture.stores.find((row) => row.organizationId === orgId && row.id === workOrder.storeId);
  const organization = context.fixture.organizations.find((row) => row.id === orgId);
  const timeZone = store?.timeZone ?? organization?.timeZone ?? "UTC";
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

export async function loadAttentionItemModel(itemId: string) {
  const context = await sessionAndFixture();
  if (!roleCanAccessListRoute(context.session.role, "action-center")) notFound();
  const model = buildAttentionItemModel(context.fixture, context.session, itemId);
  if (!model.control.available) notFound();
  model.detail = enforceDetailLinkPolicy(model.detail, context.session.role);
  return model;
}

export async function loadOwnerBriefModel() {
  const context = await sessionAndFixture();
  const role = context.session.role;
  if (role !== "executive" && role !== "facilities" && role !== "regional") return null;
  const periodEndsAt = context.fixture.asOf;
  const periodStartsAt = new Date(Date.parse(periodEndsAt) - 30 * 24 * 60 * 60 * 1000).toISOString();
  return buildOwnerBrief(context.fixture, context.session.organizationId, { startsAt: periodStartsAt, endsAt: periodEndsAt });
}

export async function loadJobHealthModel() {
  const context = await sessionAndFixture();
  const role = context.session.role;
  if (role !== "executive" && role !== "facilities") return null;
  const repository = await getServerOpsRepository();
  const [runs, outboxCounts] = await Promise.all([
    repository.listRecentJobRuns(context.session.organizationId, 20),
    repository.outboxStatusCounts(context.session.organizationId),
  ]);
  return { generatedAt: context.fixture.asOf, runs, outboxCounts };
}

export async function loadSavedViewsModel(surface: string) {
  const context = await sessionAndFixture();
  const repository = await getServerOpsRepository();
  return repository.listSavedViews(context.session.organizationId, (context.session.membershipId ?? ""), surface);
}

export async function loadVendorScorecardsModel() {
  const context = await sessionAndFixture();
  const role = context.session.role;
  if (role !== "executive" && role !== "facilities" && role !== "regional") return [];
  return buildVendorScorecards(context.fixture, context.session.organizationId);
}  export async function loadCoverageQualityModel() {
  const context = await sessionAndFixture();
  const role = context.session.role;
  if (role !== "executive" && role !== "facilities") return null;
  const coverage = buildClosedLoopCoverage(context.fixture, context.session.organizationId);
  const quality = buildDataQualityIssues(context.fixture, context.session.organizationId, context.fixture.asOf);
  return { coverage, quality };
}
