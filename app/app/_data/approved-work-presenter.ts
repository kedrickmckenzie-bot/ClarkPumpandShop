import "server-only";

import type { OperatorSession } from "@/components/ops/data-contract";
import { roleCan, roleCanAccessListRoute } from "@/components/ops/role-policy";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDate, formatOperationsDateTime } from "@/lib/ops/local-time";
import { blockingVendorComplianceIssue } from "@/lib/ops/held-work-policy";
import type { Asset, OpsFixture, ServiceAppointment, Store, WorkOrder, WorkOrderVisitHold } from "@/lib/ops/types";
import { domainLabel } from "@/lib/product/domain-label";

export type ApprovedWorkReviewState = "overdue" | "due_soon" | "later";

export interface ApprovedWorkConfirmedVisitViewModel {
  appointmentId: string;
  startsAt: string;
  startsAtLabel: string;
  vendorId: string;
  vendorName: string;
  scheduledWorkOrderNumber: string;
  scheduledWorkProblem: string;
  relationshipLabel: string;
  visitHref: string;
  visitLinkLabel: string;
  plannedForReview: boolean;
  planAction?: string;
  planReturnTo?: string;
  expectedHoldVersion?: number;
}

export interface ApprovedWorkItemViewModel {
  workOrderId: string;
  workOrderNumber: string;
  problem: string;
  serviceAreaKey?: string;
  serviceAreaLabel: string;
  postureLabel: "Complete during the visit if practical" | "Inspect and report back";
  reviewAt: string;
  reviewByLabel: string;
  reviewState: ApprovedWorkReviewState;
  recordHref: string;
  confirmedVisits: ApprovedWorkConfirmedVisitViewModel[];
}

export interface ApprovedWorkStoreRowViewModel {
  storeId: string;
  storeNumber: string;
  storeName: string;
  cityState: string;
  storeLabel: string;
  itemCount: number;
  serviceAreas: Array<{ key: string; label: string; count: number }>;
  earliestReviewAt: string;
  earliestReviewLabel: string;
  reviewState: ApprovedWorkReviewState;
  matchedItemCount: number;
  confirmedMatchCount: number;
  nextConfirmedOpportunity?: ApprovedWorkConfirmedVisitViewModel;
  items: ApprovedWorkItemViewModel[];
  reviewItemsHref: string;
  reviewMatchesHref?: string;
  storeHref: string;
  sendTogetherHref?: string;
}

export interface ApprovedWorkMatchReviewViewModel {
  storeLabel: string;
  closeHref: string;
  items: ApprovedWorkItemViewModel[];
}

export interface ApprovedWorkPortfolioViewModel {
  asOf: string;
  scopeLabel: string;
  totalItems: number;
  storeCount: number;
  multiItemStoreCount: number;
  reviewSoonCount: number;
  overdueCount: number;
  confirmedOpportunityItemCount: number;
  confirmedOpportunityMatchCount: number;
  confirmedOpportunityStoreCount: number;
  canSendTogether: boolean;
  summaryLinks: {
    all: string;
    multipleStores: string;
    reviewSoon: string;
    confirmedOpportunities: string;
  };
  storeRows: ApprovedWorkStoreRowViewModel[];
  matchReview?: ApprovedWorkMatchReviewViewModel;
}

export interface ApprovedWorkPortfolioOptions {
  q?: string;
  storeId?: string;
  regionId?: string;
  categoryKey?: string;
  status?: string;
  stage?: string;
  vendorId?: string;
  hasCost?: boolean;
  costFrom?: string;
  costMonth?: string;
  assetId?: string;
  componentId?: string;
  path?: string;
  reviewWindow?: string;
  opportunity?: string;
  storeGroup?: string;
  matchStoreId?: string;
}

interface ApprovedWorkSource {
  store: Store;
  workOrder: WorkOrder;
  hold: WorkOrderVisitHold;
}

interface ConfirmedAppointmentSource {
  appointment: ServiceAppointment;
  workOrder: WorkOrder;
  vendorId: string;
  vendorName: string;
}

const DAY_MS = 86_400_000;

function pathSegments(value: string | undefined) {
  return value?.split("|").map((segment) => segment.trim()).filter(Boolean) ?? [];
}

function assetHierarchyPath(asset: Asset) {
  const categoryLabel = domainLabel(asset.categoryKey);
  const firstSegment = asset.groupPath[0]?.toLocaleLowerCase("en-US");
  return firstSegment === categoryLabel.toLocaleLowerCase("en-US") || firstSegment === asset.categoryKey.toLocaleLowerCase("en-US")
    ? asset.groupPath
    : [categoryLabel, ...asset.groupPath];
}

function assetMatchesPath(asset: Asset | undefined, path: readonly string[]) {
  if (!asset || path.length === 0) return path.length === 0;
  const hierarchy = assetHierarchyPath(asset);
  return path.every((segment, index) => hierarchy[index] === segment);
}

function assignmentForWork(fixture: OpsFixture, organizationId: string, workOrderId: string) {
  return fixture.assignments
    .filter((assignment) => assignment.organizationId === organizationId && assignment.workOrderId === workOrderId)
    .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt))[0];
}

function normalized(value: string | undefined) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

function vendorCanReviewHeldWork(
  fixture: OpsFixture,
  source: ApprovedWorkSource,
  match: ConfirmedAppointmentSource,
  asOf: string,
) {
  const vendor = fixture.vendors.find((row) => row.organizationId === source.workOrder.organizationId && row.id === match.vendorId);
  if (!vendor || vendor.status !== "approved") return false;
  const store = source.store;
  const covered = fixture.vendorCoverage.some((coverage) => {
    if (coverage.organizationId !== source.workOrder.organizationId || coverage.vendorId !== vendor.id) return false;
    if (coverage.scopeKind === "organization") return coverage.scopeId === source.workOrder.organizationId;
    if (coverage.scopeKind === "store") return coverage.scopeId === store.id;
    return coverage.scopeId === store.regionId;
  });
  if (!covered) return false;
  const category = normalized(source.workOrder.categoryKey);
  if (!category) return false;
  const activeQualifications = fixture.vendorQualifications.filter((qualification) =>
    qualification.organizationId === source.workOrder.organizationId
    && qualification.vendorId === vendor.id
    && qualification.status === "active"
    && (!qualification.expiresAt || qualification.expiresAt > asOf)
    && (!qualification.storeId || qualification.storeId === store.id)
    && (!qualification.regionId || qualification.regionId === store.regionId)
  );
  const categoryMatch = fixture.vendorSpecialties.some((specialty) =>
    specialty.organizationId === source.workOrder.organizationId
    && specialty.vendorId === vendor.id
    && normalized(specialty.canonicalKey) === category
  ) || activeQualifications.some((qualification) =>
    [qualification.tradeKey, qualification.workType, qualification.serviceType, qualification.assetType, qualification.componentType]
      .some((value) => normalized(value) === category)
  );
  if (!categoryMatch) return false;
  const documents = fixture.vendorComplianceDocuments.filter((document) =>
    document.organizationId === source.workOrder.organizationId && document.vendorId === vendor.id
  );
  if (blockingVendorComplianceIssue(documents, asOf)) return false;
  const asset = source.workOrder.assetId
    ? fixture.assets.find((row) => row.organizationId === source.workOrder.organizationId && row.id === source.workOrder.assetId)
    : undefined;
  return !(asset?.warrantyEndsAt && asset.warrantyEndsAt > asOf && !activeQualifications.some((qualification) => qualification.warrantyWork));
}

function activeFilterValues(options: ApprovedWorkPortfolioOptions, overrides: Record<string, string | undefined> = {}) {
  return {
    visitPlan: "ready",
    q: options.q,
    store: options.storeId,
    region: options.regionId,
    category: options.categoryKey,
    status: options.status,
    stage: options.stage,
    vendor: options.vendorId,
    hasCost: options.hasCost ? "true" : undefined,
    costFrom: options.costFrom,
    costMonth: options.costMonth,
    asset: options.assetId,
    component: options.componentId,
    path: options.path,
    reviewWindow: options.reviewWindow,
    opportunity: options.opportunity,
    storeGroup: options.storeGroup,
    ...overrides,
  };
}

function hrefWithQuery(path: string, values: Record<string, string | undefined>) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) parameters.set(key, value);
  const query = parameters.toString();
  return query ? `${path}?${query}` : path;
}

function visibleStoresForSession(fixture: OpsFixture, session: OperatorSession) {
  let stores = fixture.stores.filter((store) => store.organizationId === session.organizationId);
  if (session.regionIds?.length) {
    const regionIds = new Set(session.regionIds);
    stores = stores.filter((store) => Boolean(store.regionId && regionIds.has(store.regionId)));
  } else if (session.role === "regional") {
    stores = [];
  }
  if (session.storeIds?.length) {
    const storeIds = new Set(session.storeIds);
    stores = stores.filter((store) => storeIds.has(store.id));
  } else if (session.role === "store_manager") {
    stores = [];
  }
  return stores;
}

function serviceAreaLabel(fixture: OpsFixture, organizationId: string, categoryKey?: string) {
  if (!categoryKey) return "Service area not classified";
  return fixture.taxonomyNodes.find((node) =>
    node.organizationId === organizationId
    && node.nodeKind === "category"
    && node.active
    && node.canonicalKey === categoryKey
  )?.name ?? domainLabel(categoryKey);
}

function reviewState(deadlineAt: string, asOf: string): ApprovedWorkReviewState {
  const difference = Date.parse(deadlineAt) - Date.parse(asOf);
  if (difference < 0) return "overdue";
  if (difference <= 30 * DAY_MS) return "due_soon";
  return "later";
}

function reviewLabel(deadlineAt: string, asOf: string, timeZone: string) {
  const state = reviewState(deadlineAt, asOf);
  const formatted = formatOperationsDate(deadlineAt, timeZone);
  if (state === "overdue") return `Review overdue · ${formatted}`;
  const days = Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.parse(asOf)) / DAY_MS));
  if (days === 0) return `Review today · ${formatted}`;
  if (days <= 30) return `Review in ${days} ${days === 1 ? "day" : "days"} · ${formatted}`;
  return `Review if not handled by ${formatted}`;
}

function confirmedAppointments(fixture: OpsFixture, organizationId: string, asOf: string): ConfirmedAppointmentSource[] {
  const workById = new Map(
    fixture.workOrders
      .filter((workOrder) => workOrder.organizationId === organizationId)
      .map((workOrder) => [workOrder.id, workOrder]),
  );
  const assignmentById = new Map(
    fixture.assignments
      .filter((assignment) => assignment.organizationId === organizationId)
      .map((assignment) => [assignment.id, assignment]),
  );
  const vendorById = new Map(
    fixture.vendors
      .filter((vendor) => vendor.organizationId === organizationId)
      .map((vendor) => [vendor.id, vendor]),
  );
  return (fixture.serviceAppointments ?? [])
    .filter((appointment) =>
      appointment.organizationId === organizationId
      && appointment.status === "confirmed"
      && Date.parse(appointment.startsAt) >= Date.parse(asOf)
    )
    .flatMap((appointment) => {
      const workOrder = workById.get(appointment.workOrderId);
      const assignment = assignmentById.get(appointment.assignmentId);
      const currentAssignment = workOrder ? assignmentForWork(fixture, organizationId, workOrder.id) : undefined;
      if (
        !workOrder
        || workOrder.status !== "scheduled"
        || !assignment
        || assignment.kind !== "outside_vendor"
        || assignment.status !== "accepted"
        || !assignment.vendorId
        || currentAssignment?.id !== assignment.id
      ) return [];
      const vendor = vendorById.get(assignment.vendorId);
      if (!vendor || vendor.status !== "approved") return [];
      return [{ appointment, workOrder, vendorId: assignment.vendorId, vendorName: vendor.name }];
    })
    .sort((left, right) => left.appointment.startsAt.localeCompare(right.appointment.startsAt) || left.appointment.id.localeCompare(right.appointment.id));
}

function matchingAppointments(
  fixture: OpsFixture,
  source: ApprovedWorkSource,
  appointments: ConfirmedAppointmentSource[],
  asOf: string,
): ConfirmedAppointmentSource[] {
  // An unclassified job cannot be matched honestly. Sharing a store alone does
  // not establish that the vendor already headed there handles this work.
  if (!source.workOrder.categoryKey) return [];
  return appointments.filter(({ appointment, workOrder }) =>
    workOrder.id !== source.workOrder.id
    && workOrder.storeId === source.workOrder.storeId
    && workOrder.categoryKey === source.workOrder.categoryKey
    && appointment.workOrderId !== source.workOrder.id
    && Date.parse(appointment.startsAt) <= Date.parse(source.hold.deadlineAt)
  ).filter((match) => vendorCanReviewHeldWork(fixture, source, match, asOf));
}

export function buildApprovedWorkPortfolio(
  fixture: OpsFixture,
  session: OperatorSession,
  options: ApprovedWorkPortfolioOptions = {},
): ApprovedWorkPortfolioViewModel {
  const visibleStores = visibleStoresForSession(fixture, session)
    .filter((store) => !options.storeId || store.id === options.storeId)
    .filter((store) => !options.regionId || store.regionId === options.regionId);
  const storeById = new Map(visibleStores.map((store) => [store.id, store]));
  const visibleStoreIds = new Set(storeById.keys());
  const normalizedSearch = options.q?.trim().toLocaleLowerCase("en-US") ?? "";
  const selectedPath = pathSegments(options.path);
  const assetById = new Map(
    fixture.assets
      .filter((asset) => asset.organizationId === session.organizationId && visibleStoreIds.has(asset.storeId))
      .map((asset) => [asset.id, asset]),
  );
  const costByWork = fixture.costLines.reduce((result, line) => {
    if (
      line.organizationId === session.organizationId
      && (!options.costFrom || line.serviceDate >= options.costFrom)
      && (!options.costMonth || line.serviceDate.startsWith(options.costMonth))
    ) result.set(line.workOrderId, (result.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
    return result;
  }, new Map<string, number>());
  const vendorNameById = new Map(
    fixture.vendors
      .filter((vendor) => vendor.organizationId === session.organizationId)
      .map((vendor) => [vendor.id, vendor.name]),
  );
  const approvedWorkById = new Map(
    fixture.workOrders
      .filter((workOrder) =>
        workOrder.organizationId === session.organizationId
        && workOrder.status === "approved"
        && visibleStoreIds.has(workOrder.storeId)
        && (!options.categoryKey || (workOrder.categoryKey ?? "unclassified") === options.categoryKey)
      )
      .filter((workOrder) => !options.status || options.status === "open" || options.status === workOrder.status)
      .filter((workOrder) => !options.stage || (options.stage === "vendor-response" && ["approved", "issued", "waiting_on_vendor"].includes(workOrder.status)))
      .filter((workOrder) => {
        const assignment = assignmentForWork(fixture, session.organizationId, workOrder.id);
        return !options.vendorId || assignment?.vendorId === options.vendorId;
      })
      .filter((workOrder) => !options.hasCost || (costByWork.get(workOrder.id) ?? 0) > 0)
      .filter((workOrder) => !options.costMonth || fixture.costLines.some((line) =>
        line.organizationId === session.organizationId
        && line.workOrderId === workOrder.id
        && line.serviceDate.startsWith(options.costMonth!)
      ))
      .filter((workOrder) => !options.assetId || (options.assetId === "unlinked" ? !workOrder.assetId : workOrder.assetId === options.assetId))
      .filter((workOrder) => !options.componentId || (options.componentId === "unlinked" ? !workOrder.componentId : workOrder.componentId === options.componentId))
      .filter((workOrder) => selectedPath.length === 0 || assetMatchesPath(workOrder.assetId ? assetById.get(workOrder.assetId) : undefined, selectedPath))
      .filter((workOrder) => {
        if (!normalizedSearch) return true;
        const store = storeById.get(workOrder.storeId);
        const assignment = assignmentForWork(fixture, session.organizationId, workOrder.id);
        const assignee = assignment?.kind === "outside_vendor"
          ? vendorNameById.get(assignment.vendorId ?? "")
          : assignment?.kind === "internal"
            ? "Internal maintenance"
            : "Choose later";
        return [workOrder.number, workOrder.problem, workOrder.categoryKey, store ? `Store ${store.storeNumber} · ${store.name}` : undefined, assignee]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("en-US")
          .includes(normalizedSearch);
      })
      .map((workOrder) => [workOrder.id, workOrder]),
  );
  const sources = (fixture.workOrderVisitHolds ?? [])
    .filter((hold) => hold.organizationId === session.organizationId && hold.status === "active")
    .flatMap((hold): ApprovedWorkSource[] => {
      const workOrder = approvedWorkById.get(hold.workOrderId);
      const store = workOrder ? storeById.get(workOrder.storeId) : undefined;
      return workOrder && store ? [{ store, workOrder, hold }] : [];
    });
  const appointments = confirmedAppointments(fixture, session.organizationId, fixture.asOf)
    .filter(({ workOrder }) => visibleStoreIds.has(workOrder.storeId));

  const itemsByStore = new Map<string, ApprovedWorkItemViewModel[]>();
  for (const source of sources) {
    const timeZone = source.store.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
    const categoryLabel = serviceAreaLabel(fixture, session.organizationId, source.workOrder.categoryKey);
    const matchReturnTo = hrefWithQuery("/app/work-orders", {
      ...activeFilterValues(options),
      matchStore: source.store.id,
    });
    const confirmedVisits = matchingAppointments(fixture, source, appointments, fixture.asOf).map((match): ApprovedWorkConfirmedVisitViewModel => {
      const canOpenVisitList = roleCanAccessListRoute(session.role, "visits");
      return {
        appointmentId: match.appointment.id,
        startsAt: match.appointment.startsAt,
        startsAtLabel: formatOperationsDateTime(match.appointment.startsAt, timeZone),
        vendorId: match.vendorId,
        vendorName: match.vendorName,
        scheduledWorkOrderNumber: match.workOrder.number,
        scheduledWorkProblem: match.workOrder.problem,
        relationshipLabel: `Same store and ${categoryLabel.toLocaleLowerCase("en-US")} service area`,
        visitHref: canOpenVisitList
          ? hrefWithQuery("/app/visits", { status: "upcoming", store: source.store.id, selected: match.appointment.id })
          : `/app/work-orders/${encodeURIComponent(match.workOrder.id)}?view=service`,
        visitLinkLabel: canOpenVisitList ? "Open confirmed visit" : "Open scheduled work order",
        plannedForReview: source.hold.plannedReviewAppointmentId === match.appointment.id,
        planAction: roleCan(session, "issue_work_order")
          ? `/api/ops/work-orders/${encodeURIComponent(source.workOrder.id)}/visit-hold/appointment-plan`
          : undefined,
        planReturnTo: roleCan(session, "issue_work_order") ? matchReturnTo : undefined,
        expectedHoldVersion: roleCan(session, "issue_work_order") ? source.hold.version : undefined,
      };
    });
    const item: ApprovedWorkItemViewModel = {
      workOrderId: source.workOrder.id,
      workOrderNumber: source.workOrder.number,
      problem: source.workOrder.problem,
      serviceAreaKey: source.workOrder.categoryKey,
      serviceAreaLabel: categoryLabel,
      postureLabel: source.hold.posture === "look_and_report" ? "Inspect and report back" : "Complete during the visit if practical",
      reviewAt: source.hold.deadlineAt,
      reviewByLabel: reviewLabel(source.hold.deadlineAt, fixture.asOf, timeZone),
      reviewState: reviewState(source.hold.deadlineAt, fixture.asOf),
      recordHref: `/app/work-orders/${encodeURIComponent(source.workOrder.id)}`,
      confirmedVisits,
    };
    if (options.reviewWindow === "30" && item.reviewState !== "due_soon" && item.reviewState !== "overdue") continue;
    if (options.opportunity === "confirmed" && !item.confirmedVisits.length) continue;
    const storeItems = itemsByStore.get(source.store.id) ?? [];
    storeItems.push(item);
    itemsByStore.set(source.store.id, storeItems);
  }

  const storeRows = [...itemsByStore.entries()].flatMap(([storeId, unsortedItems]): ApprovedWorkStoreRowViewModel[] => {
    const store = storeById.get(storeId);
    if (!store) return [];
    const items = [...unsortedItems].sort((left, right) => left.reviewAt.localeCompare(right.reviewAt) || left.workOrderNumber.localeCompare(right.workOrderNumber));
    const serviceAreaCounts = new Map<string, { label: string; count: number }>();
    for (const item of items) {
      const key = item.serviceAreaKey ?? "unclassified";
      const current = serviceAreaCounts.get(key);
      serviceAreaCounts.set(key, { label: item.serviceAreaLabel, count: (current?.count ?? 0) + 1 });
    }
    const matchedItems = items.filter((item) => item.confirmedVisits.length > 0);
    const confirmedMatches = matchedItems.flatMap((item) => item.confirmedVisits);
    const nextConfirmedOpportunity = [...confirmedMatches]
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.appointmentId.localeCompare(right.appointmentId))[0];
    const earliest = items[0]!;
    const firstVisibleWorkOrderId = items[0]?.workOrderId;
    const rowFilters = activeFilterValues(options, { store: store.id });
    if (options.storeGroup === "multiple" && items.length < 2) return [];
    return [{
      storeId: store.id,
      storeNumber: store.storeNumber,
      storeName: store.name,
      cityState: `${store.city}, ${store.state}`,
      storeLabel: `Store ${store.storeNumber} · ${store.name}`,
      itemCount: items.length,
      serviceAreas: [...serviceAreaCounts.entries()]
        .map(([key, value]) => ({ key, ...value }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
      earliestReviewAt: earliest.reviewAt,
      earliestReviewLabel: earliest.reviewByLabel,
      reviewState: earliest.reviewState,
      matchedItemCount: matchedItems.length,
      confirmedMatchCount: confirmedMatches.length,
      nextConfirmedOpportunity,
      items,
      reviewItemsHref: hrefWithQuery("/app/work-orders", rowFilters),
      reviewMatchesHref: matchedItems.length
        ? hrefWithQuery("/app/work-orders", { ...rowFilters, matchStore: store.id })
        : undefined,
      storeHref: `/app/stores/${encodeURIComponent(store.id)}`,
      sendTogetherHref: roleCan(session, "issue_work_order")
        ? hrefWithQuery("/app/store-sweeps/new", {
            store: store.id,
            workOrder: firstVisibleWorkOrderId,
            returnTo: hrefWithQuery("/app/work-orders", activeFilterValues(options)),
          })
        : undefined,
    }];
  }).sort((left, right) =>
    Number(Boolean(right.nextConfirmedOpportunity)) - Number(Boolean(left.nextConfirmedOpportunity))
    || left.earliestReviewAt.localeCompare(right.earliestReviewAt)
    || left.storeNumber.localeCompare(right.storeNumber, undefined, { numeric: true })
  );

  const allItems = storeRows.flatMap((row) => row.items);
  const confirmedOpportunityItemCount = allItems.filter((item) => item.confirmedVisits.length > 0).length;
  const confirmedOpportunityMatchCount = allItems.reduce((sum, item) => sum + item.confirmedVisits.length, 0);
  const confirmedOpportunityStoreCount = storeRows.filter((row) => row.nextConfirmedOpportunity).length;
  const selectedMatchStore = options.matchStoreId
    ? storeRows.find((row) => row.storeId === options.matchStoreId && row.matchedItemCount > 0)
    : undefined;
  const selectedMatchItems = selectedMatchStore?.items.filter((item) => item.confirmedVisits.length > 0);
  return {
    asOf: fixture.asOf,
    scopeLabel: session.scopeLabel,
    totalItems: allItems.length,
    storeCount: storeRows.length,
    multiItemStoreCount: storeRows.filter((row) => row.itemCount > 1).length,
    reviewSoonCount: allItems.filter((item) => item.reviewState === "due_soon" || item.reviewState === "overdue").length,
    overdueCount: allItems.filter((item) => item.reviewState === "overdue").length,
    confirmedOpportunityItemCount,
    confirmedOpportunityMatchCount,
    confirmedOpportunityStoreCount,
    canSendTogether: roleCan(session, "issue_work_order"),
    summaryLinks: {
      all: hrefWithQuery("/app/work-orders", activeFilterValues(options, { storeGroup: undefined, reviewWindow: undefined, opportunity: undefined })),
      multipleStores: hrefWithQuery("/app/work-orders", activeFilterValues(options, { storeGroup: "multiple", reviewWindow: undefined, opportunity: undefined })),
      reviewSoon: hrefWithQuery("/app/work-orders", activeFilterValues(options, { storeGroup: undefined, reviewWindow: "30", opportunity: undefined })),
      confirmedOpportunities: hrefWithQuery("/app/work-orders", activeFilterValues(options, { storeGroup: undefined, reviewWindow: undefined, opportunity: "confirmed" })),
    },
    storeRows,
    matchReview: selectedMatchStore && selectedMatchItems?.length ? {
      storeLabel: selectedMatchStore.storeLabel,
      closeHref: hrefWithQuery("/app/work-orders", activeFilterValues(options)),
      items: selectedMatchItems,
    } : undefined,
  };
}
