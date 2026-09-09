import "server-only";

import { cache } from "react";
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
  NORTHLINE_PREVIEW_PERSONAS,
} from "@/lib/ops/fixtures";
import { getServerOpsRepository, getServerOpsFixtureSnapshot, getServerOpsTrendsFixtureSnapshot } from "@/lib/server/ops-repository-provider";
import { buildOwnerBrief } from "@/lib/ops/owner-brief";
import { buildWorkOrderCase } from "@/lib/ops/work-order-case";
import { formatInTimeZone } from "@/lib/ops/local-date-time";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDate } from "@/lib/ops/local-time";
import { buildClosedLoopCoverage, buildDataQualityIssues } from "@/lib/ops/coverage-quality";
import { buildVendorScorecards } from "@/lib/ops/vendor-scorecards";
import {
  LEGACY_OPS_PREVIEW_ROLE_COOKIE,
  OPS_PREVIEW_EDITION_COOKIE,
  OPS_PREVIEW_ROLE_COOKIE,
} from "@/lib/server/runtime-identifiers";
import { DEFAULT_DEMO_EDITION, isDemoEdition } from "@/components/ops/demo-edition";
import type { HeldWorkActionsModel } from "@/components/workspace/held-work-actions";
import type { PmProgramManagementModel } from "@/components/workspace/pm-program-management";
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
import { buildApprovedWorkPortfolio } from "./approved-work-presenter";
import {
  buildQueryListModel,
  buildQuerySearchModel,
  QUERY_FIRST_LIST_ROUTES,
} from "./operator-query-presenter";

// Server Component reads share one immutable tenant snapshot during a render.
// Keep this wrapper in the presentation layer: API commands and mutation paths
// must continue to call the uncached provider and observe the latest state.
const getRequestOpsFixtureSnapshot = cache((organizationId: string) =>
  getServerOpsFixtureSnapshot(organizationId),
);

function isOperatorRole(value: string | undefined): value is OperatorRole {
  return value === "executive" || value === "facilities" || value === "regional" || value === "store_manager" || value === "finance";
}

export async function loadOperatorSession(): Promise<OperatorSession> {
  return getRequestOperatorSession();
}

const getRequestOperatorSession = cache(async (): Promise<OperatorSession> => {
  const repository = await getServerOpsRepository();
  const [identity, cookieStore] = await Promise.all([getChatGPTUser(), cookies()]);
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
  const [organization, membership, grants] = await Promise.all([
    repository.getOrganization(NORTHLINE_ORGANIZATION_ID),
    repository.getMembership(NORTHLINE_ORGANIZATION_ID, persona.membershipId),
    repository.listScopeGrantsForMembership(NORTHLINE_ORGANIZATION_ID, persona.membershipId),
  ]);
  const regionIds = grants.filter((grant) => grant.scopeKind === "region").map((grant) => grant.scopeId);
  const storeIds = grants.filter((grant) => grant.scopeKind === "store").map((grant) => grant.scopeId);
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
    userId: identity?.userId ?? "user-northline-preview",
    membershipId: membership?.id,
    displayName: identity?.displayName ?? "Demo operator",
    email: identity?.email ?? "operator@clark-demo.example",
    role,
    organizationId: NORTHLINE_ORGANIZATION_ID,
    organizationName,
    scopeLabel,
    regionIds: regionIds.length ? regionIds : undefined,
    storeIds: storeIds.length ? storeIds : undefined,
    permissions: grants.map((grant) => grant.permission),
    demoEdition,
  };
});

async function sessionAndFixture() {
  const [fixture, session] = await Promise.all([
    getRequestOpsFixtureSnapshot(NORTHLINE_ORGANIZATION_ID),
    getRequestOperatorSession(),
  ]);
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
    model.pagination = undefined;
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
  const session = await getRequestOperatorSession();
  if (!roleCanAccessListRoute(session.role, route)) notFound();
  const requestedKeys = Object.entries(searchParams).filter(([, value]) => Boolean(Array.isArray(value) ? value[0] : value)).map(([key]) => key);
  const supportedQueryKeys: Partial<Record<ListRouteId, ReadonlySet<string>>> = {
    requests: new Set(["q", "page", "status", "store", "selected"]),
    "work-orders": new Set(["q", "page", "status", "store", "vendor", "region", "category", "asset", "component", "hasCost", "costFrom", "costMonth", "selected", "visitPlan", "storeGroup"]),
    visits: new Set(["q", "page", "status", "store", "vendor", "review", "selected"]),
    stores: new Set(["q", "page", "selected"]),
    vendors: new Set(["q", "page", "selected"]),
  };
  const usesSpecialFixtureProjection = requestedKeys.some((key) => !supportedQueryKeys[route]?.has(key))
    || route === "visits" && (Array.isArray(searchParams.status) ? searchParams.status[0] : searchParams.status) === "upcoming";
  if (QUERY_FIRST_LIST_ROUTES.has(route) && !usesSpecialFixtureProjection) {
    const repository = await getServerOpsRepository();
    return enforceListLinkPolicy(await buildQueryListModel(repository, session, route, searchParams), session.role);
  }
  const fixture = await getRequestOpsFixtureSnapshot(NORTHLINE_ORGANIZATION_ID);
  return enforceListLinkPolicy(
    buildListModel(fixture, session, route, searchParams),
    session.role,
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
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "administer");
  return enforceDetailLinkPolicy(
    buildApprovalPolicyWorkspaceModel(context.fixture, context.session),
    context.session.role,
  );
}

export async function loadNotificationSettingsModel() {
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "administer");
  const repository = await getServerOpsRepository();
  return {
    organizationName: context.session.organizationName,
    rules: await repository.listNotificationRules(context.session.organizationId),
    providerConfigured: Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM),
    providerLabel: process.env.EMAIL_PROVIDER?.trim() || "Not configured",
    fromAddress: process.env.EMAIL_FROM?.trim(),
  };
}

export async function loadImportWorkspaceAccess() {
  const context = await sessionAndFixture();
  requireCapability(context.session.role, "administer");
  return { organizationName: context.session.organizationName };
}

export async function loadDashboardModel() {
  const context = await sessionAndFixture();
  return enforceDashboardLinkPolicy(buildDashboardModel(context.fixture, context.session), context.session.role);
}

export async function loadSearchModel(searchParams: OperatorSearchParameters = {}) {
  const session = await getRequestOperatorSession();
  return buildQuerySearchModel(await getServerOpsRepository(), session, searchParams);
}

export async function loadProgramModel(route: ProgramRouteId, searchParams: OperatorSearchParameters = {}) {
  const context = await sessionAndFixture();
  if (!roleCanAccessProgramRoute(context.session.role, route)) notFound();
  return enforceDashboardLinkPolicy(
    buildProgramModel(context.fixture, context.session, route, searchParams),
    context.session.role,
  );
}

export async function loadTrendsModel(searchParams: OperatorSearchParameters = {}) {
  const [session, fixture] = await Promise.all([
    getRequestOperatorSession(),
    getServerOpsTrendsFixtureSnapshot(NORTHLINE_ORGANIZATION_ID),
  ]);
  if (!roleCanAccessProgramRoute(session.role, "trends")) notFound();
  return buildTrendsModel(fixture, session, searchParams);
}

export async function loadTrendsPageData(searchParams: OperatorSearchParameters = {}) {
  const [session, fixture, repository] = await Promise.all([
    getRequestOperatorSession(),
    getServerOpsTrendsFixtureSnapshot(NORTHLINE_ORGANIZATION_ID),
    getServerOpsRepository(),
  ]);
  if (!roleCanAccessProgramRoute(session.role, "trends")) notFound();
  const model = buildTrendsModel(fixture, session, searchParams);
  const savedViews = session.membershipId
    ? await repository.listSavedViews(session.organizationId, session.membershipId, "trends")
    : [];
  return { model, savedViews, session };
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
  return formatOperationsDate(value, DEFAULT_OPERATIONS_TIME_ZONE);
}

export async function loadPmProgramManagementModel(searchParams: OperatorSearchParameters = {}): Promise<PmProgramManagementModel> {
  const { session, fixture } = await sessionAndFixture();
  if (!roleCanAccessProgramRoute(session.role, "pm")) notFound();
  const selectedStoreId = Array.isArray(searchParams.store) ? searchParams.store[0] : searchParams.store;
  const selectedProgramId = Array.isArray(searchParams.program) ? searchParams.program[0] : searchParams.program;
  const requestedEnrollmentView = Array.isArray(searchParams.enrollments) ? searchParams.enrollments[0] : searchParams.enrollments;
  const requestedEnrollmentPage = Number(Array.isArray(searchParams.enrollmentPage) ? searchParams.enrollmentPage[0] : searchParams.enrollmentPage);
  const enrollmentPage = Number.isFinite(requestedEnrollmentPage) && requestedEnrollmentPage > 0 ? Math.floor(requestedEnrollmentPage) : 1;
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
  const visibleOccurrences = fixture.pmOccurrences.filter((occurrence) => occurrence.organizationId === session.organizationId && visibleStoreIds.has(occurrence.storeId));

  const pmStatus = (occurrence: (typeof visibleOccurrences)[number]) => {
    if (occurrence.status === "completed" || occurrence.completedAt) return "completed" as const;
    if (occurrence.status === "waived") return "waived" as const;
    if (Date.parse(occurrence.windowEndsAt) < Date.parse(fixture.asOf)) return "missed" as const;
    if (Date.parse(occurrence.windowStartsAt) > Date.parse(fixture.asOf)) return "scheduled" as const;
    return "due" as const;
  };
  const pmHref = (values: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value));
    const query = params.toString();
    return query ? `/app/pm?${query}` : "/app/pm";
  };
  const money = (amountMinor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amountMinor / 100);

  const equipmentTypesForProgram = (program: (typeof programs)[number]) => templates.filter((template) => pmProgramMatchesTemplate(program.applicableAssetTypes, template.id, template.name));
  const matchingAssetsForProgram = (program: (typeof programs)[number]) => {
    const matchingTemplateIds = new Set(equipmentTypesForProgram(program).map((template) => template.id));
    return visibleAssets.filter((asset) => asset.equipmentTemplateId && matchingTemplateIds.has(asset.equipmentTemplateId));
  };
  const programRows = programs.map((program) => {
    const programTemplates = equipmentTypesForProgram(program);
    const matchingAssets = matchingAssetsForProgram(program);
    const plans = visiblePlans.filter((plan) => plan.programId === program.id);
    const isStoreLevelProgram = programTemplates.length === 0;
    const enrolledAssetIds = new Set(plans.map((plan) => plan.assetId).filter((id): id is string => Boolean(id)));
    const enrolledStoreIds = new Set(plans.map((plan) => plan.storeId).filter((id): id is string => Boolean(id)));
    const matchingEquipment = isStoreLevelProgram ? visibleStores.length : matchingAssets.length;
    const gaps = isStoreLevelProgram
      ? visibleStores.filter((store) => !enrolledStoreIds.has(store.id)).length
      : matchingAssets.filter((asset) => !enrolledAssetIds.has(asset.id)).length;
    const overrides = plans.filter((plan) => plan.cadenceDays !== program.frequencyDays || plan.completionWindowDays !== program.dueWindowDays || Boolean(plan.cadenceOverrideReason)).length;
    const occurrences = visibleOccurrences.filter((occurrence) => plans.some((plan) => plan.id === occurrence.planId));
    const dueOccurrences = occurrences.filter((occurrence) => pmStatus(occurrence) === "due").length;
    const missedOccurrences = occurrences.filter((occurrence) => pmStatus(occurrence) === "missed").length;
    const nextOccurrence = occurrences
      .filter((occurrence) => pmStatus(occurrence) === "scheduled")
      .sort((left, right) => left.windowStartsAt.localeCompare(right.windowStartsAt))[0];
    return {
      id: program.id,
      name: program.name,
      serviceAreaLabel: program.tradeKey.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US")),
      equipmentTypeLabels: isStoreLevelProgram ? ["All stores"] : programTemplates.map((template) => template.name),
      cadenceLabel: `Every ${program.frequencyDays} days`,
      windowLabel: `±${program.dueWindowDays} day window`,
      anchorLabel: shortDate(program.scheduleAnchorAt),
      matchingEquipment,
      enrolledPlans: plans.length,
      coverageGaps: gaps,
      localOverrides: overrides,
      dueOccurrences,
      missedOccurrences,
      nextWindowLabel: nextOccurrence ? `Next window ${shortDate(nextOccurrence.windowStartsAt)}` : "No future window scheduled",
      href: pmHref({ program: program.id, store: selectedStoreId, view: "attention" }),
      selected: selectedProgramId === program.id,
    };
  });
  const matchingFilteredPlans = visiblePlans
    .filter((plan) => !selectedStoreId || plan.storeId === selectedStoreId)
    .filter((plan) => !selectedProgramId || plan.programId === selectedProgramId)
    .sort((left, right) => {
      const leftStore = storesById.get(left.storeId ?? "")?.storeNumber ?? "";
      const rightStore = storesById.get(right.storeId ?? "")?.storeNumber ?? "";
      return leftStore.localeCompare(rightStore, undefined, { numeric: true }) || left.name.localeCompare(right.name);
    });
  const enrollmentView = selectedStoreId ? "store" : requestedEnrollmentView === "all" ? "all" : "exceptions";
  const plansForView = enrollmentView === "exceptions"
    ? matchingFilteredPlans.filter((plan) => {
        const program = plan.programId ? programById.get(plan.programId) : undefined;
        return !program || plan.cadenceDays !== program.frequencyDays || plan.completionWindowDays !== program.dueWindowDays || Boolean(plan.cadenceOverrideReason);
      })
    : matchingFilteredPlans;
  const enrollmentPageSize = 20;
  const totalEnrollmentPages = Math.max(1, Math.ceil(plansForView.length / enrollmentPageSize));
  const boundedEnrollmentPage = Math.min(enrollmentPage, totalEnrollmentPages);
  const enrollmentStart = (boundedEnrollmentPage - 1) * enrollmentPageSize;
  const filteredPlans = plansForView
    .slice(enrollmentStart, enrollmentStart + enrollmentPageSize)
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

  const reconciliations = fixture.serviceDiscrepancies
    .filter((item) => item.organizationId === session.organizationId && item.status !== "resolved" && item.status !== "closed")
    .flatMap((item) => {
      let facts: Record<string, unknown>;
      try {
        facts = JSON.parse(item.factsJson) as Record<string, unknown>;
      } catch {
        return [];
      }
      if (facts.reconciliationKind !== "pm_billed_vs_observed" || typeof facts.storeId !== "string" || !visibleStoreIds.has(facts.storeId)) return [];
      const store = storesById.get(facts.storeId);
      const program = typeof facts.programId === "string" ? programById.get(facts.programId) : undefined;
      const invoiceIds = Array.isArray(facts.billedInvoiceIds) ? facts.billedInvoiceIds.filter((value): value is string => typeof value === "string") : [];
      const billedUnits = typeof facts.billedServiceUnits === "number" ? facts.billedServiceUnits : invoiceIds.length;
      const observedVisits = typeof facts.observedVisitCount === "number" ? facts.observedVisitCount : 0;
      const missingEvidence = Array.isArray(facts.missingOccurrenceIds) ? facts.missingOccurrenceIds.length : Math.max(0, billedUnits - observedVisits);
      return [{
        id: item.id,
        programName: program?.name ?? "Preventive maintenance",
        storeLabel: store ? `Store ${store.storeNumber} · ${store.name}` : "Unknown store",
        periodLabel: typeof facts.periodLabel === "string" ? facts.periodLabel : "Selected service period",
        billedUnits,
        observedVisits,
        missingEvidence,
        invoicedAmountLabel: money(typeof facts.invoicedAmountMinor === "number" ? facts.invoicedAmountMinor : 0),
        reviewAmountLabel: money(typeof facts.reviewAmountMinor === "number" ? facts.reviewAmountMinor : 0),
        invoiceHref: invoiceIds.length ? `/app/invoices/${encodeURIComponent(invoiceIds.at(-1)!)}` : "/app/invoices",
        occurrencesHref: pmHref({ program: typeof facts.programId === "string" ? facts.programId : undefined, store: facts.storeId, view: "all" }),
        note: typeof facts.note === "string" ? facts.note : "No matching platform visit evidence was found; confirm the service record before drawing a conclusion.",
      }];
    });
  const matchingEquipment = programRows.reduce((sum, program) => sum + program.matchingEquipment, 0);
  const resultLabel = plansForView.length
    ? `${enrollmentStart + 1}–${Math.min(enrollmentStart + enrollmentPageSize, plansForView.length)} of ${plansForView.length}`
    : "0 plans";
  const queryValue = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const commonPlanQuery = {
    program: selectedProgramId,
    store: selectedStoreId,
    view: queryValue("view"),
    status: queryValue("status"),
    occurrence: queryValue("occurrence"),
    page: queryValue("page"),
  };
  const enrollmentPageHref = (page: number) => pmHref({ ...commonPlanQuery, enrollments: enrollmentView, enrollmentPage: page });
  const enrollmentPageNumbers = [...new Set([1, boundedEnrollmentPage - 2, boundedEnrollmentPage - 1, boundedEnrollmentPage, boundedEnrollmentPage + 1, boundedEnrollmentPage + 2, totalEnrollmentPages]
    .filter((page) => page >= 1 && page <= totalEnrollmentPages))].sort((left, right) => left - right);
  return {
    scopeLabel: session.scopeLabel,
    canCreateMasterSchedule: session.role === "executive" || session.role === "facilities",
    summary: {
      activePrograms: programs.length,
      matchingEquipment,
      enrolledPlans: programRows.reduce((sum, program) => sum + program.enrolledPlans, 0),
      coverageGaps: programRows.reduce((sum, program) => sum + program.coverageGaps, 0),
      localOverrides: programRows.reduce((sum, program) => sum + program.localOverrides, 0),
      evidenceReviews: reconciliations.length,
    },
    programs: programRows,
    plans: filteredPlans,
    planView: {
      mode: enrollmentView,
      title: enrollmentView === "store" ? "Store PM schedules" : enrollmentView === "all" ? "All store schedules" : "Store-specific schedule changes",
      description: enrollmentView === "store"
        ? "Company standards and local adjustments for the selected store."
        : enrollmentView === "all"
          ? "Every active company enrollment. Use this register when you need an exact store-by-store record."
          : "Stores listed here use a different cadence than the company standard or have a store-only schedule. These are intentional settings, not problems.",
      resultLabel,
      toggleHref: enrollmentView === "store" ? undefined : pmHref({ ...commonPlanQuery, enrollments: enrollmentView === "all" ? "exceptions" : "all" }),
      toggleLabel: enrollmentView === "store" ? undefined : enrollmentView === "all" ? "Show store-specific changes" : "Show every store schedule",
      pagination: plansForView.length > enrollmentPageSize ? {
        summary: `Showing ${resultLabel}`,
        currentPage: boundedEnrollmentPage,
        totalPages: totalEnrollmentPages,
        pageLinks: enrollmentPageNumbers.map((page) => ({ page, href: enrollmentPageHref(page), current: page === boundedEnrollmentPage })),
        previousHref: boundedEnrollmentPage > 1 ? enrollmentPageHref(boundedEnrollmentPage - 1) : undefined,
        nextHref: boundedEnrollmentPage < totalEnrollmentPages ? enrollmentPageHref(boundedEnrollmentPage + 1) : undefined,
      } : undefined,
    },
    reconciliations,
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
  const context = await sessionAndFixture();
  if (!roleCanAccessDetailRoute(context.session.role, "work-order")) notFound();
  const workOrder = context.fixture.workOrders.find((row) => row.organizationId === context.session.organizationId && row.id === workOrderId);
  if (!workOrder) notFound();
  const repository = await getServerOpsRepository();
  const [hold, store] = await Promise.all([
    repository.getWorkOrderVisitHold(context.session.organizationId, workOrderId),
    repository.getStore(context.session.organizationId, workOrder.storeId),
  ]);
  const organizationTimeZone = context.fixture.organizations.find((row) => row.id === context.session.organizationId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const storeTimeZone = store?.timeZone ?? organizationTimeZone;
  const fallbackDeadlineMs = Date.parse(context.fixture.asOf) + 30 * 24 * 60 * 60_000;
  const recordedDeadlineMs = Date.parse(workOrder.dueAt ?? "");
  const defaultDeadline = new Date(Number.isFinite(recordedDeadlineMs)
    ? Math.max(recordedDeadlineMs, fallbackDeadlineMs)
    : fallbackDeadlineMs).toISOString();
  const claimedVendor = hold?.claimedVendorId
    ? await repository.getVendor(context.session.organizationId, hold.claimedVendorId)
    : null;
  const formatMoney = (amountMinor: number, currency: string) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
  return {
    workOrderId,
    permitted: roleCan(context.session.role, "control_work_order"),
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
