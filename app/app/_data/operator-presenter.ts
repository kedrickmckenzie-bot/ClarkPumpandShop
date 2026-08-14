import "server-only";

import type {
  ActionItemViewModel,
  BreakdownViewModel,
  CreateRequestPageViewModel,
  CreateStorePageViewModel,
  CreateVendorPageViewModel,
  CreateWorkOrderPageViewModel,
  DashboardPageViewModel,
  DetailPageViewModel,
  ListPageViewModel,
  MetricViewModel,
  OperatorSession,
  ProgramPageViewModel,
  SearchPageViewModel,
  TableColumnViewModel,
  TableRowViewModel,
  Tone,
  TrendViewModel,
  VendorIssuanceViewModel,
} from "@/components/ops/data-contract";
import { roleCan, roleCanAccessProgramRoute, roleCanOpenOperatorHref } from "@/components/ops/role-policy";
import type {
  Asset,
  OpsFixture,
  PmOccurrence,
  Store,
  VisitSession,
  WorkOrder,
} from "@/lib/ops/types";
import { NORTHLINE_DEMO_ENTRY_TOKENS, NORTHLINE_DEMO_HANDLES } from "@/lib/ops/fixtures";
import {
  calculateRepairReplacementScreening,
  type RepairReplacementScreening,
} from "@/lib/ops/lifecycle-analytics";

export type OperatorListRoute =
  | "action-center"
  | "requests"
  | "work-orders"
  | "visits"
  | "stores"
  | "vendors"
  | "invoices"
  | "reports"
  | "admin";
export type OperatorProgramRoute = "spend" | "equipment" | "pm" | "lifecycle";
export type OperatorDetailRoute = "request" | "work-order" | "store" | "vendor" | "equipment" | "invoice";
export type OperatorSearchParameters = Record<string, string | string[] | undefined>;

interface ScopedFixture {
  organizationId: string;
  includeCompanywide: boolean;
  stores: Store[];
  storeIds: Set<string>;
  workOrders: WorkOrder[];
  visits: VisitSession[];
  assets: Asset[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function cleanSearch(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

function money(amountMinor: number): string {
  return currencyFormatter.format(amountMinor / 100);
}

function date(value: string | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : "Not set";
}

function dateTime(value: string | undefined): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "Not recorded";
}

function sentence(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function workStatusTone(status: WorkOrder["status"]): Tone {
  if (["cancelled", "closed"].includes(status)) return "neutral";
  if (["completed_pending_review"].includes(status)) return "positive";
  if (["waiting_on_parts", "waiting_on_vendor"].includes(status)) return "warning";
  if (["in_progress", "accepted", "scheduled"].includes(status)) return "info";
  return "neutral";
}

function scopeFixture(fixture: OpsFixture, session: OperatorSession): ScopedFixture {
  const organizationId = session.organizationId;
  const organizationStores = fixture.stores.filter((store) => store.organizationId === organizationId);
  let stores = organizationStores;

  if (session.regionIds?.length) {
    const regionIds = new Set(session.regionIds);
    stores = stores.filter((store) => Boolean(store.regionId && regionIds.has(store.regionId)));
  }
  if (session.role === "regional" && !session.regionIds?.length) stores = [];
  if (session.storeIds?.length) {
    const permittedStoreIds = new Set(session.storeIds);
    stores = stores.filter((store) => permittedStoreIds.has(store.id));
  }
  if (session.role === "store_manager" && !session.storeIds?.length) stores = [];

  const storeIds = new Set(stores.map((store) => store.id));
  return {
    organizationId,
    includeCompanywide: !session.regionIds?.length && !session.storeIds?.length,
    stores,
    storeIds,
    workOrders: fixture.workOrders.filter(
      (workOrder) => workOrder.organizationId === organizationId && storeIds.has(workOrder.storeId),
    ),
    visits: fixture.visits.filter(
      (visit) => visit.organizationId === organizationId && storeIds.has(visit.storeId),
    ),
    assets: fixture.assets.filter(
      (asset) => asset.organizationId === organizationId && storeIds.has(asset.storeId),
    ),
  };
}

function narrowScopeToStore(scoped: ScopedFixture, storeId: string | undefined): ScopedFixture {
  if (!storeId) return scoped;
  if (!scoped.storeIds.has(storeId)) {
    return { ...scoped, stores: [], storeIds: new Set(), workOrders: [], visits: [], assets: [] };
  }
  return {
    ...scoped,
    stores: scoped.stores.filter((store) => store.id === storeId),
    storeIds: new Set([storeId]),
    workOrders: scoped.workOrders.filter((work) => work.storeId === storeId),
    visits: scoped.visits.filter((visit) => visit.storeId === storeId),
    assets: scoped.assets.filter((asset) => asset.storeId === storeId),
  };
}

function narrowScopeToRegion(scoped: ScopedFixture, regionId: string | undefined): ScopedFixture {
  if (!regionId) return scoped;
  const stores = scoped.stores.filter((store) => store.regionId === regionId);
  const storeIds = new Set(stores.map((store) => store.id));
  return {
    ...scoped,
    stores,
    storeIds,
    workOrders: scoped.workOrders.filter((work) => storeIds.has(work.storeId)),
    visits: scoped.visits.filter((visit) => storeIds.has(visit.storeId)),
    assets: scoped.assets.filter((asset) => storeIds.has(asset.storeId)),
  };
}

function pathSegments(value: string | undefined): string[] {
  return value?.split("|").map((segment) => segment.trim()).filter(Boolean) ?? [];
}

function assetHierarchyPath(asset: Asset): string[] {
  const categoryLabel = sentence(asset.categoryKey);
  const firstSegment = asset.groupPath[0]?.toLocaleLowerCase("en-US");
  return firstSegment === categoryLabel.toLocaleLowerCase("en-US") || firstSegment === asset.categoryKey.toLocaleLowerCase("en-US")
    ? asset.groupPath
    : [categoryLabel, ...asset.groupPath];
}

function assetMatchesPath(asset: Asset | undefined, path: readonly string[]): boolean {
  if (!asset || path.length === 0) return path.length === 0;
  const hierarchy = assetHierarchyPath(asset);
  return path.every((segment, index) => hierarchy[index] === segment);
}

function storeLabel(store: Store | undefined): string {
  return store ? `Store ${store.storeNumber} · ${store.name}` : "Unknown store";
}

function storeAddress(store: Store): string {
  return [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`]
    .filter(Boolean)
    .join(", ");
}

function recordedCostByWork(
  fixture: OpsFixture,
  organizationId: string,
  serviceDateFrom?: string,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const line of fixture.costLines) {
    if (line.organizationId !== organizationId || (serviceDateFrom && line.serviceDate < serviceDateFrom)) continue;
    result.set(line.workOrderId, (result.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
  }
  return result;
}

function costForWorkIds(costByWork: Map<string, number>, workIds: Iterable<string>): number {
  let total = 0;
  for (const workId of workIds) total += costByWork.get(workId) ?? 0;
  return total;
}

function assignmentForWork(fixture: OpsFixture, organizationId: string, workOrderId: string) {
  return fixture.assignments
    .filter((assignment) => assignment.organizationId === organizationId && assignment.workOrderId === workOrderId)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))[0];
}

function vendorName(fixture: OpsFixture, organizationId: string, vendorId: string | undefined): string | undefined {
  if (!vendorId) return undefined;
  return fixture.vendors.find((vendor) => vendor.organizationId === organizationId && vendor.id === vendorId)?.name;
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

function hrefWithQuery(path: string, values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function rollingYearStart(asOf: string): string {
  const start = new Date(asOf);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.toISOString().slice(0, 10);
}

function effectivePmStatus(occurrence: PmOccurrence, asOf: string): PmOccurrence["status"] {
  if (occurrence.status === "completed" || occurrence.completedAt) return "completed";
  if (occurrence.status === "waived") return "waived";
  if (Date.parse(occurrence.windowEndsAt) < Date.parse(asOf)) return "missed";
  if (Date.parse(occurrence.windowStartsAt) > Date.parse(asOf)) return "scheduled";
  return occurrence.status === "scheduled" ? "scheduled" : "due";
}

function costBreakdown(
  title: string,
  values: Map<string, number>,
  hrefFor: (key: string) => string,
  options: {
    description?: string;
    labelFor?: (key: string) => string;
    linkLabel?: string;
    sourceHref?: string;
    sourceLabel?: string;
  } = {},
): BreakdownViewModel {
  const entries = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return {
    id: title.toLocaleLowerCase("en-US").replace(/\W+/g, "-"),
    title,
    description: options.description,
    totalLabel: money(total),
    segments: entries.slice(0, 7).map(([key, value], index) => ({
      id: key,
      label: options.labelFor?.(key) ?? sentence(key || "unclassified"),
      value,
      formattedValue: money(value),
      shareLabel: total ? `${Math.round((value / total) * 100)}% of recorded cost` : "No recorded cost",
      tone: index === 0 ? "warning" : "neutral",
      link: { href: hrefFor(key), label: options.linkLabel ?? "Open source work" },
    })),
    sourceLink: { href: options.sourceHref ?? "/app/work-orders?hasCost=true", label: options.sourceLabel ?? "View every cost source" },
  };
}

function countBreakdown(
  id: string,
  title: string,
  values: Map<string, number>,
  hrefFor: (key: string) => string,
  options: {
    description?: string;
    labelFor?: (key: string) => string;
    totalNoun?: string;
    sourceLink: { href: string; label: string };
  },
): BreakdownViewModel {
  const entries = [...values.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return {
    id,
    title,
    description: options.description,
    totalLabel: `${total} ${options.totalNoun ?? "records"}`,
    segments: entries.map(([key, value], index) => ({
      id: key,
      label: options.labelFor?.(key) ?? sentence(key),
      value,
      formattedValue: String(value),
      shareLabel: total ? `${Math.round((value / total) * 100)}% of the visible total` : "No records",
      tone: index === 0 ? "warning" : "neutral",
      link: { href: hrefFor(key), label: "Open supporting records" },
    })),
    sourceLink: options.sourceLink,
  };
}

function costTrend(
  fixture: OpsFixture,
  scoped: ScopedFixture,
  costByWork: Map<string, number>,
  options: { storeId?: string; periodStart?: string; query?: Record<string, string | undefined> } = {},
): TrendViewModel {
  const workById = new Map(scoped.workOrders.map((workOrder) => [workOrder.id, workOrder]));
  const scopedCostWorkCount = [...costByWork.keys()].filter((workOrderId) => workById.has(workOrderId)).length;
  const monthly = new Map<string, number>();
  for (const line of fixture.costLines) {
    if (
      line.organizationId !== scoped.organizationId ||
      !workById.has(line.workOrderId) ||
      (options.periodStart && line.serviceDate < options.periodStart)
    ) continue;
    const key = monthKey(line.serviceDate);
    monthly.set(key, (monthly.get(key) ?? 0) + line.amount.amountMinor);
  }
  return {
    id: "recorded-cost-trend",
    title: "Recorded work cost by month",
    description: "Entered work costs only; invoices are not required and are not silently combined.",
    points: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, value]) => ({
        id: key,
        label: monthLabel(key),
        value,
        formattedValue: money(value),
        link: { href: hrefWithQuery("/app/work-orders", { store: options.storeId, ...options.query, costMonth: key }), label: `Open ${monthLabel(key)} work` },
      })),
    sourceLink: { href: hrefWithQuery("/app/work-orders", { store: options.storeId, ...options.query, hasCost: "true", costFrom: options.periodStart }), label: `Open ${scopedCostWorkCount} work orders with cost` },
  };
}

function actions(fixture: OpsFixture, scoped: ScopedFixture, limit = 6): ActionItemViewModel[] {
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const workById = new Map(scoped.workOrders.map((workOrder) => [workOrder.id, workOrder]));
  const exceptionActions = fixture.exceptions
    .filter(
      (exception) =>
        exception.organizationId === scoped.organizationId &&
        exception.status !== "resolved" &&
        (exception.storeId ? scoped.storeIds.has(exception.storeId) : scoped.includeCompanywide),
    )
    .map<ActionItemViewModel>((exception) => ({
      id: exception.id,
      title: exception.summary,
      description: exception.workOrderId
        ? `Review ${workById.get(exception.workOrderId)?.number ?? "linked work"}.`
        : "Review the evidence and decide whether follow-up is needed.",
      categoryLabel: sentence(exception.kind),
      storeLabel: exception.storeId ? storeLabel(storeById.get(exception.storeId)) : "Companywide",
      recordLabel: exception.workOrderId
        ? workById.get(exception.workOrderId)?.number ?? "Linked work"
        : exception.visitId
          ? "Service visit"
          : sentence(exception.kind),
      dueLabel: exception.severity === "urgent" ? "Review now" : "Needs review",
      ownerLabel: "Facilities coordinator",
      priorityLabel: exception.severity === "urgent" ? "Urgent" : "Attention",
      tone: exception.severity === "urgent" ? "critical" : "warning",
      link: exception.workOrderId
        ? { href: `/app/work-orders/${exception.workOrderId}`, label: "Review work order" }
        : exception.kind === "overdue_pm"
          ? { href: hrefWithQuery("/app/pm", { store: exception.storeId, status: "missed" }), label: "Review missed PM" }
          : exception.visitId
            ? { href: `/app/visits?exception=${exception.id}`, label: "Review visit" }
            : { href: `/app/action-center?type=exception&q=${encodeURIComponent(exception.summary)}`, label: "Review exception" },
    }));
  const followUpActions = fixture.followUps
    .filter(
      (followUp) =>
        followUp.organizationId === scoped.organizationId &&
        followUp.status === "open" &&
        Boolean(workById.get(followUp.workOrderId)),
    )
    .map<ActionItemViewModel>((followUp) => {
      const work = workById.get(followUp.workOrderId)!;
      return {
        id: followUp.id,
        title: followUp.nextAction,
        description: `${work.number} · ${storeLabel(storeById.get(work.storeId))}`,
        categoryLabel: "Open follow-up",
        storeLabel: storeLabel(storeById.get(work.storeId)),
        recordLabel: work.number,
        dueLabel: `Due ${date(followUp.dueAt)}`,
        ownerLabel: followUp.accountableParty,
        priorityLabel: Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "Overdue" : "Due soon",
        tone: Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "critical" : "warning",
        link: { href: `/app/work-orders/${work.id}`, label: "Open work order" },
      };
    });
  return [...exceptionActions, ...followUpActions].slice(0, limit);
}

function dashboardShortcut(options: {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  dueLabel: string;
  ownerLabel: string;
  tone?: Tone;
  href: string;
  linkLabel: string;
}): ActionItemViewModel {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    categoryLabel: options.categoryLabel,
    dueLabel: options.dueLabel,
    ownerLabel: options.ownerLabel,
    tone: options.tone ?? "neutral",
    link: { href: options.href, label: options.linkLabel },
  };
}

function lifecycleComparisonLabel(screening: RepairReplacementScreening): string {
  if (screening.state === "compare_alternatives") return "Compare repair and replacement";
  if (screening.state === "below_materiality") return "Small repair; not flagged";
  if (screening.state === "below_economic_review") return "Below capital-review threshold";
  return "Current comparison inputs needed";
}

function lifecycleComparisonExplanation(screening: RepairReplacementScreening): string {
  if (screening.state === "compare_alternatives") {
    return "The current repair is meaningful in dollars and as a share of replacement, then meets the same-service-period review threshold. Compare the alternatives; this is not a replacement direction.";
  }
  if (screening.state === "below_materiality") {
    return "The current repair is small in dollars or as a share of replacement. A short remaining expected life does not turn a low-cost bridge repair into a replacement signal.";
  }
  if (screening.state === "below_economic_review") {
    return "The current repair does not meet the capital-review threshold against replacement over the same expected-service period.";
  }
  return "Add the current repair, replacement estimate, and expected-service facts that are still missing.";
}

function lifecycleGapLabel(gap: RepairReplacementScreening["dataGaps"][number]): string {
  const labels: Record<typeof gap, string> = {
    missing_install_date: "Install date",
    invalid_install_date: "Valid install date",
    install_date_after_as_of: "Install date before today",
    missing_expected_life: "Expected-life reference",
    invalid_expected_life: "Valid expected-life reference",
    missing_replacement_estimate: "Installed replacement estimate",
    invalid_replacement_estimate: "Valid installed replacement estimate",
    missing_repair_estimate: "Current repair estimate",
    invalid_repair_estimate: "Valid current repair estimate",
    invalid_service_extension: "Valid expected service from repair",
    no_positive_comparison_horizon: "Expected service from repair",
  };
  return labels[gap];
}

function lifecycleRows(fixture: OpsFixture, scoped: ScopedFixture, costByWork: Map<string, number>) {
  const asOf = Date.parse(fixture.asOf);
  const periodStart = (days: number) => asOf - days * 86_400_000;
  const rows = scoped.assets.map((asset) => {
      const work = scoped.workOrders.filter((candidate) => candidate.assetId === asset.id);
      const reactiveWork = work.filter((candidate) => candidate.priority !== "planned");
      const completedReactiveWork = reactiveWork.filter((candidate) =>
        candidate.status === "closed" || candidate.status === "completed_pending_review",
      );
      const workCost = costForWorkIds(costByWork, work.map((candidate) => candidate.id));
      const workInDays = (days: number) => reactiveWork.filter(
        (candidate) => Date.parse(candidate.closedAt ?? candidate.createdAt) >= periodStart(days),
      );
      const work12 = workInDays(365);
      const work24 = workInDays(730);
      const work36 = workInDays(1_095);
      const reactiveWorkIds = new Set(reactiveWork.map((candidate) => candidate.id));
      const costInDays = (days: number) => fixture.costLines
        .filter((line) =>
          line.organizationId === scoped.organizationId &&
          reactiveWorkIds.has(line.workOrderId) &&
          Date.parse(`${line.serviceDate}T00:00:00Z`) >= periodStart(days),
        )
        .reduce((sum, line) => sum + line.amount.amountMinor, 0);
      const cost12 = costInDays(365);
      const cost24 = costInDays(730);
      const cost36 = costInDays(1_095);
      const observedVisits = scoped.visits.filter((visit) =>
        Boolean(visit.workOrderId && reactiveWorkIds.has(visit.workOrderId)),
      );
      const pm = fixture.pmOccurrences.filter(
        (occurrence) =>
          occurrence.organizationId === scoped.organizationId && occurrence.assetId === asset.id,
      );
      const pmExceptions = pm.filter((occurrence) => occurrence.status === "missed" || occurrence.status === "due");
      const ageYears = asset.installedAt
        ? Math.max(0, (asOf - Date.parse(asset.installedAt)) / (365.25 * 86_400_000))
        : undefined;
      const expectedLife = asset.expectedLifeYears;
      const lifeUsed = ageYears !== undefined && expectedLife ? ageYears / expectedLife : undefined;
      const expectedReplacementYear = asset.installedAt && expectedLife
        ? new Date(asset.installedAt).getUTCFullYear() + expectedLife
        : undefined;
      const replacement = asset.replacementEstimate?.amountMinor;
      const warrantyExpired = Boolean(asset.warrantyEndsAt && Date.parse(asset.warrantyEndsAt) < asOf);
      const componentCounts = new Map<string, number>();
      for (const candidate of completedReactiveWork) if (candidate.componentId) {
        componentCounts.set(candidate.componentId, (componentCounts.get(candidate.componentId) ?? 0) + 1);
      }
      const repeatedComponent = [...componentCounts.entries()]
        .filter(([, count]) => count >= 2)
        .sort(([, a], [, b]) => b - a)[0];
      const repeatedComponentName = repeatedComponent
        ? fixture.components.find(
            (component) =>
              component.organizationId === scoped.organizationId &&
              component.assetId === asset.id &&
              component.id === repeatedComponent[0],
          )?.name
        : undefined;
      const sameComponentRepeat = Boolean(repeatedComponent);
      const proposalWork = reactiveWork
        .filter((candidate) =>
          !["closed", "cancelled", "completed_pending_review"].includes(candidate.status) &&
          Boolean(candidate.repairEstimate),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      const screening = calculateRepairReplacementScreening(
        asset,
        proposalWork ? {
          proposalId: proposalWork.id,
          repairEstimateMinor: proposalWork.repairEstimate?.amountMinor,
          estimatedServiceExtensionMonths: proposalWork.estimatedServiceExtensionMonths,
          sourceRecordIds: [proposalWork.id],
        } : undefined,
        {
          asOf: fixture.asOf,
          historicalContext: {
            recordedWorkCostMinor: workCost,
            distinctWorkOrderCount: reactiveWork.length,
            distinctVisitCount: observedVisits.length,
            repeatIssueCount: repeatedComponent?.[1] ?? 0,
            sourceRecordIds: [...reactiveWork.map((candidate) => candidate.id), ...observedVisits.map((visit) => visit.id)],
          },
        },
      );
      const contextFacts = [
        `${reactiveWork.length} reactive work order${reactiveWork.length === 1 ? "" : "s"} recorded`,
        `${observedVisits.length} observed service visit${observedVisits.length === 1 ? "" : "s"}; visit count does not prove repeat failure`,
        repeatedComponent
          ? `${repeatedComponent[1]} completed reactive work orders tied to ${repeatedComponentName ?? "the same component"}`
          : undefined,
        warrantyExpired ? "Warranty reference has expired" : asset.warrantyEndsAt ? "Warranty reference is active" : "Warranty not entered",
        pmExceptions.length > 0 ? `${pmExceptions.length} due or missed PM occurrence${pmExceptions.length === 1 ? "" : "s"}` : undefined,
      ].filter((fact): fact is string => Boolean(fact));
      return {
        asset,
        work,
        reactiveWork,
        workCost,
        work12,
        work24,
        work36,
        cost12,
        cost24,
        cost36,
        observedVisits,
        pm,
        pmExceptions,
        ageYears,
        lifeUsed,
        expectedReplacementYear,
        replacement,
        warrantyExpired,
        sameComponentRepeat,
        proposalWork,
        screening,
        contextFacts,
      };
    });

  const stateOrder: Record<RepairReplacementScreening["state"], number> = {
    compare_alternatives: 3,
    below_economic_review: 2,
    below_materiality: 1,
    incomplete: 0,
  };
  return rows.sort((a, b) =>
    stateOrder[b.screening.state] - stateOrder[a.screening.state] || b.workCost - a.workCost,
  );
}

function buildSharedDashboardModel(fixture: OpsFixture, session: OperatorSession): DashboardPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const periodStart = rollingYearStart(fixture.asOf);
  const costByWork = recordedCostByWork(fixture, scoped.organizationId, periodStart);
  const lifecycleCostByWork = recordedCostByWork(fixture, scoped.organizationId);
  const recordedCost = costForWorkIds(costByWork, scoped.workOrders.map((workOrder) => workOrder.id));
  const openWork = scoped.workOrders.filter((workOrder) => !["closed", "cancelled"].includes(workOrder.status));
  const activeVisits = scoped.visits.filter((visit) => visit.status === "active");
  const completedVisits = scoped.visits.filter((visit) => visit.status !== "active");
  const pendingRequests = fixture.requests.filter(
    (request) =>
      request.organizationId === scoped.organizationId &&
      scoped.storeIds.has(request.storeId) &&
      ["submitted", "under_review"].includes(request.status),
  );
  const awaitingVendor = scoped.workOrders.filter((workOrder) =>
    ["approved", "issued", "waiting_on_vendor"].includes(workOrder.status),
  );
  const followUps = fixture.followUps.filter(
    (followUp) =>
      followUp.organizationId === scoped.organizationId &&
      followUp.status === "open" &&
      scoped.workOrders.some((workOrder) => workOrder.id === followUp.workOrderId),
  );
  const openExceptions = fixture.exceptions.filter(
    (exception) =>
      exception.organizationId === scoped.organizationId &&
      exception.status !== "resolved" &&
      (exception.storeId ? scoped.storeIds.has(exception.storeId) : scoped.includeCompanywide),
  );
  const categoryCost = new Map<string, number>();
  for (const work of scoped.workOrders) {
    const key = work.categoryKey ?? "unclassified";
    categoryCost.set(key, (categoryCost.get(key) ?? 0) + (costByWork.get(work.id) ?? 0));
  }
  const candidate = lifecycleRows(fixture, scoped, lifecycleCostByWork).find((row) =>
    row.screening.state === "compare_alternatives",
  );

  const metrics: MetricViewModel[] = [
    {
      id: "active-visits",
      label: "Vendors onsite now",
      value: String(activeVisits.length),
      supportingText: `${activeVisits.length} onsite now · ${scoped.visits.length} visits in scope`,
      tone: activeVisits.length ? "info" : "neutral",
      link: { href: "/app/visits?status=active", label: "Open live visits" },
    },
    {
      id: "open-exceptions",
      label: "Needs attention",
      value: String(openExceptions.length),
      supportingText: "No-WO, location, checkout, and review facts",
      tone: openExceptions.length ? "warning" : "positive",
      link: { href: "/app/action-center?type=exception", label: "Review exceptions" },
    },
    {
      id: "open-work",
      label: "Open work",
      value: String(openWork.length),
      supportingText: "Every item has an owner and next action",
      link: { href: "/app/work-orders?status=open", label: "Open work orders" },
    },
    {
      id: "recorded-cost",
      label: "Recorded work cost",
      value: money(recordedCost),
      supportingText: "Rolling 12-month source cost; invoices not required",
      link: { href: "/app/spend", label: "Explain the total" },
    },
  ];

  return {
    state: { kind: "ready" },
    page: {
      title: session.role === "executive" ? "Your company at a glance" : "Here’s what needs attention",
      eyebrow: session.role === "executive" ? "Executive home" : "Manager home",
      description: "Start with the decisions that need you, then follow every number into the store, work order, visit, or cost record behind it.",
      scopeLabel: session.scopeLabel,
      periodLabel: `Rolling 12 months from ${date(periodStart)}`,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
      primaryAction: { label: "Review what needs attention", href: "/app/action-center" },
      secondaryAction: session.role === "facilities" || session.role === "regional"
        ? { label: "Create work order", href: "/app/work-orders/new" }
        : undefined,
    },
    journey: [
      {
        id: "intake",
        label: "New requests",
        value: String(pendingRequests.length),
        supportingText: "Waiting for review",
        tone: pendingRequests.length ? "warning" : "neutral",
        link: { href: "/app/requests", label: "Review requests" },
      },
      {
        id: "authorization",
        label: "Vendor response",
        value: String(awaitingVendor.length),
        supportingText: "Approved, issued, or waiting",
        tone: awaitingVendor.length ? "warning" : "neutral",
        link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" },
      },
      {
        id: "onsite",
        label: "Onsite now",
        value: String(activeVisits.length),
        supportingText: `${scoped.visits.length} total visits in scope`,
        tone: activeVisits.length ? "info" : "neutral",
        link: { href: "/app/visits?status=active", label: "Open live visits" },
      },
      {
        id: "follow-up",
        label: "Follow-up",
        value: String(followUps.length),
        supportingText: "Outcome still needs action",
        tone: followUps.length ? "critical" : "positive",
        link: { href: "/app/action-center?type=follow-up", label: "Open follow-ups" },
      },
      {
        id: "history",
        label: "Completed visits",
        value: String(completedVisits.length),
        supportingText: "Observed service history",
        tone: "positive",
        link: { href: "/app/visits?status=checked_out", label: "Open visit history" },
      },
    ],
    metrics,
    priorityActions: actions(fixture, scoped),
    breakdowns: [
      costBreakdown(
        "Recorded cost by service area",
        categoryCost,
        (key) => hrefWithQuery("/app/work-orders", { category: key, hasCost: "true", costFrom: periodStart }),
        {
          description: "Select a service area to open the exact work orders and cost lines behind it.",
          sourceHref: hrefWithQuery("/app/work-orders", { hasCost: "true", costFrom: periodStart }),
        },
      ),
    ],
    trends: [costTrend(fixture, scoped, costByWork, { periodStart })],
    spotlight: candidate
      ? {
          title: `Review ${candidate.proposalWork?.number ?? "the current repair"} before issuing`,
          description: `${candidate.asset.name}: compare the ${money(candidate.screening.comparison.repairEstimateMinor ?? 0)} current repair with the ${money(candidate.screening.comparison.replacementEstimateMinor ?? 0)} replacement estimate over the same expected-service period. Historical work, visits, warranty, and PM remain context and do not decide the result.`,
          facts: [
            { label: "Current repair", value: money(candidate.screening.comparison.repairEstimateMinor ?? 0) },
            { label: "Replacement estimate", value: money(candidate.screening.comparison.replacementEstimateMinor ?? 0) },
            { label: "Repair share", value: `${Math.round((candidate.screening.comparison.repairToReplacementRatio ?? 0) * 100)}%` },
            { label: "Expected service from repair", value: candidate.screening.comparison.comparisonHorizonYears ? `${candidate.screening.comparison.comparisonHorizonYears} ${candidate.screening.comparison.comparisonHorizonYears === 1 ? "year" : "years"}` : "Not entered" },
          ],
          link: { href: `/app/lifecycle?asset=${candidate.asset.id}`, label: "Review the comparison" },
        }
      : undefined,
  };
}

export function buildDashboardModel(fixture: OpsFixture, session: OperatorSession): DashboardPageViewModel {
  const base = buildSharedDashboardModel(fixture, session);
  const scoped = scopeFixture(fixture, session);
  const periodStart = rollingYearStart(fixture.asOf);
  const rollingCostByWork = recordedCostByWork(fixture, scoped.organizationId, periodStart);
  const allCostByWork = recordedCostByWork(fixture, scoped.organizationId);
  const recordedCost = costForWorkIds(rollingCostByWork, scoped.workOrders.map((work) => work.id));
  const openWork = scoped.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status));
  const activeVisits = scoped.visits.filter((visit) => visit.status === "active");
  const completedVisits = scoped.visits.filter((visit) => visit.status !== "active");
  const awaitingVendor = openWork.filter((work) =>
    ["approved", "issued", "waiting_on_vendor"].includes(work.status),
  );
  const openExceptions = fixture.exceptions.filter(
    (exception) =>
      exception.organizationId === scoped.organizationId &&
      exception.status !== "resolved" &&
      (exception.storeId ? scoped.storeIds.has(exception.storeId) : scoped.includeCompanywide),
  );
  const lifecycle = lifecycleRows(fixture, scoped, allCostByWork);
  const repairComparisons = lifecycle.filter((row) => row.screening.state === "compare_alternatives");
  const candidate = repairComparisons[0];
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const vendorById = new Map(
    fixture.vendors
      .filter((vendor) => vendor.organizationId === scoped.organizationId)
      .map((vendor) => [vendor.id, vendor]),
  );

  const categoryCost = new Map<string, number>();
  const storeCost = new Map<string, number>();
  for (const work of scoped.workOrders) {
    const amount = rollingCostByWork.get(work.id) ?? 0;
    categoryCost.set(work.categoryKey ?? "unclassified", (categoryCost.get(work.categoryKey ?? "unclassified") ?? 0) + amount);
    storeCost.set(work.storeId, (storeCost.get(work.storeId) ?? 0) + amount);
  }
  const categoryBreakdown = costBreakdown(
    "Recorded cost by service area",
    categoryCost,
    (key) => hrefWithQuery("/app/spend", { category: key }),
    {
      description: "Choose a service area to continue through configured groups, equipment, components, and source work.",
      linkLabel: "Drill into this service area",
      sourceHref: "/app/spend",
      sourceLabel: "Open the full spending view",
    },
  );
  const storeBreakdown = costBreakdown(
    "Recorded cost by store",
    storeCost,
    (key) => hrefWithQuery("/app/spend", { store: key }),
    {
      description: "Compare locations in this access scope, then open the cost hierarchy and source work for any store.",
      labelFor: (key) => storeLabel(storeById.get(key)),
      linkLabel: "Open this store's cost",
      sourceHref: "/app/stores?sort=cost",
      sourceLabel: "Open the complete store ranking",
    },
  );
  const trend = costTrend(fixture, scoped, rollingCostByWork, { periodStart });
  const lifecycleSpotlight: DashboardPageViewModel["spotlight"] = candidate
    ? {
        eyebrow: "Repair decision support",
        title: `Compare ${candidate.proposalWork?.number ?? "the current repair"} before issuing`,
        description: `${candidate.asset.name}: the current repair estimate is ${money(candidate.screening.comparison.repairEstimateMinor ?? 0)}, or ${Math.round((candidate.screening.comparison.repairToReplacementRatio ?? 0) * 100)}% of the ${money(candidate.screening.comparison.replacementEstimateMinor ?? 0)} replacement estimate, and is expected to buy ${candidate.screening.comparison.comparisonHorizonYears ?? "an unentered number of"} ${candidate.screening.comparison.comparisonHorizonYears === 1 ? "year" : "years"} of service. Age, historical work, visits, warranty, and PM remain visible context but do not change the economic screening.`,
        facts: [
          { label: "Current repair", value: money(candidate.screening.comparison.repairEstimateMinor ?? 0) },
          { label: "Replacement estimate", value: money(candidate.screening.comparison.replacementEstimateMinor ?? 0) },
          { label: "Repair share", value: `${Math.round((candidate.screening.comparison.repairToReplacementRatio ?? 0) * 100)}%` },
          { label: "Expected service from repair", value: candidate.screening.comparison.comparisonHorizonYears ? `${candidate.screening.comparison.comparisonHorizonYears} ${candidate.screening.comparison.comparisonHorizonYears === 1 ? "year" : "years"}` : "Not entered" },
        ],
        link: { href: `/app/lifecycle?asset=${candidate.asset.id}`, label: "Review all lifecycle evidence" },
      }
    : undefined;
  const pageBase = {
    scopeLabel: session.scopeLabel,
    periodLabel: `Rolling 12 months from ${date(periodStart)}`,
    updatedLabel: `Source data through ${date(fixture.asOf)}`,
  };

  if (session.role === "executive") {
    const highestCostStore = [...storeCost.entries()].sort((left, right) => right[1] - left[1])[0];
    return {
      state: { kind: "ready" },
      page: {
        ...pageBase,
        title: "Your company at a glance",
        eyebrow: "Executive overview",
        description: "See companywide cost, open obligations, accountability exceptions, and capital decisions without entering the daily maintenance queue.",
        primaryAction: { label: "Explore company spending", href: "/app/spend" },
        secondaryAction: { label: "Open leadership reports", href: "/app/reports" },
      },
      metrics: [
        { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost; invoice entry is not required", link: { href: "/app/spend", label: "Explain the total" } },
        { id: "open-work", label: "Open maintenance obligations", value: String(openWork.length), supportingText: "Every open item carries an owner and next action", tone: openWork.length ? "info" : "positive", link: { href: "/app/work-orders?status=open", label: "Open supporting work" } },
        { id: "open-exceptions", label: "Open review exceptions", value: String(openExceptions.length), supportingText: "Accountability facts requiring human review", tone: openExceptions.length ? "warning" : "positive", link: { href: "/app/action-center?type=exception", label: "Review source facts" } },
        { id: "watch-assets", label: "Equipment marked for review", value: String(scoped.assets.filter((asset) => asset.status === "watch").length), supportingText: "Transparent review flag; never an opaque health score", tone: "warning", link: { href: "/app/equipment?status=watch", label: "Open equipment evidence" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "executive-attention", title: `Review ${openExceptions.length} open accountability fact${openExceptions.length === 1 ? "" : "s"}`, description: "See the observed visit, no-work-order, location, and follow-up evidence that needs management visibility.", categoryLabel: "Company oversight", dueLabel: "Current", ownerLabel: "Facilities leadership", tone: openExceptions.length ? "warning" : "positive", href: "/app/action-center?type=exception", linkLabel: "Review source facts" }),
        dashboardShortcut({ id: "executive-store-cost", title: highestCostStore ? `${storeLabel(storeById.get(highestCostStore[0]))} has the highest recorded cost` : "Compare store costs", description: highestCostStore ? `${money(highestCostStore[1])} of rolling recorded work cost; open the hierarchy and source work before drawing a conclusion.` : "No store cost is recorded in this period.", categoryLabel: "Cost visibility", dueLabel: "Rolling 12 months", ownerLabel: "Operations leadership", tone: "info", href: highestCostStore ? hrefWithQuery("/app/spend", { store: highestCostStore[0] }) : "/app/spend", linkLabel: "Explain the store total" }),
        dashboardShortcut({ id: "executive-capital", title: `${repairComparisons.length} current repair comparison${repairComparisons.length === 1 ? "" : "s"}`, description: "Review material repairs alongside age, expected life, replacement estimate, and service history before capital decisions.", categoryLabel: "Lifecycle & CapEx", dueLabel: "Planning view", ownerLabel: "Facilities and finance", tone: candidate ? "warning" : "positive", href: "/app/lifecycle?reason=compare+alternatives", linkLabel: "Open lifecycle planning" }),
        dashboardShortcut({ id: "executive-reports", title: "Open leadership-ready source views", description: "Use traceable report views for obligations, cost, vendor accountability, PM, and invoice safeguards.", categoryLabel: "Reporting", dueLabel: "Available now", ownerLabel: "Leadership", href: "/app/reports", linkLabel: "Open reports" }),
      ],
      prioritySection: { title: "Leadership decisions to review", description: "High-level questions with direct paths to the records behind them.", link: { href: "/app/action-center", label: "Open all attention items" } },
      breakdowns: [storeBreakdown, categoryBreakdown],
      trends: [trend],
      spotlight: lifecycleSpotlight,
    };
  }

  const rollingInvoices = fixture.invoiceReferences.filter(
    (invoice) => invoice.organizationId === scoped.organizationId && invoice.invoiceDate >= periodStart,
  );
  const replacementEstimateTotal = lifecycle.reduce((sum, row) => sum + (row.replacement ?? 0), 0);
  if (session.role === "finance") {
    const invoiceToReview = rollingInvoices.find((invoice) => invoice.matchStatus !== "confirmed");
    return {
      state: { kind: "ready" },
      page: {
        ...pageBase,
        title: "Maintenance cost and evidence",
        eyebrow: "Finance overview",
        description: "Review recorded work cost, supporting work orders, optional invoice references, and capital-planning inputs without stepping into dispatch or field operations.",
        primaryAction: { label: "Explore recorded cost", href: "/app/spend" },
        secondaryAction: { label: "Review invoice safeguards", href: hrefWithQuery("/app/invoices", { from: periodStart }) },
      },
      metrics: [
        { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost; not invoice or payment totals", link: { href: "/app/spend", label: "Explain the total" } },
        { id: "cost-work", label: "Cost-bearing work orders", value: String([...rollingCostByWork.keys()].filter((id) => scoped.workOrders.some((work) => work.id === id)).length), supportingText: "Work orders with entered cost in the rolling period", link: { href: hrefWithQuery("/app/work-orders", { hasCost: "true", costFrom: periodStart }), label: "Open supporting work" } },
        { id: "invoice-references", label: "Invoice references recorded", value: String(rollingInvoices.length), supportingText: "Optional matching evidence; not accounts payable", tone: invoiceToReview ? "warning" : "neutral", link: { href: hrefWithQuery("/app/invoices", { from: periodStart }), label: "Review invoice references" } },
        { id: "replacement-estimates", label: "Entered replacement estimates", value: money(replacementEstimateTotal), supportingText: "Planning inputs across tracked equipment", tone: "info", link: { href: "/app/lifecycle?replacement=entered", label: "Open capital outlook" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "finance-invoices", title: `Review ${rollingInvoices.length} recorded invoice reference${rollingInvoices.length === 1 ? "" : "s"}`, description: "Use operator work-order references and confirmed allocations as an optional safeguard; TraceOps does not approve or pay invoices.", categoryLabel: "Invoice safeguard", dueLabel: "Optional review", ownerLabel: "Finance", tone: invoiceToReview ? "warning" : "positive", href: hrefWithQuery("/app/invoices", { from: periodStart }), linkLabel: "Open invoice references" }),
        dashboardShortcut({ id: "finance-store-cost", title: "Compare recorded cost by store", description: "Move from each store total through service area, equipment, component, work order, and entered cost lines.", categoryLabel: "Cost visibility", dueLabel: "Rolling 12 months", ownerLabel: "Finance and operations", tone: "info", href: "/app/stores?sort=cost", linkLabel: "Open store ranking" }),
        dashboardShortcut({ id: "finance-capital", title: "Review entered capital-planning inputs", description: `${money(replacementEstimateTotal)} of installed replacement estimates are planning inputs, not an approved budget.`, categoryLabel: "Lifecycle & CapEx", dueLabel: "Planning view", ownerLabel: "Finance and facilities", href: "/app/lifecycle?replacement=entered", linkLabel: "Open capital outlook" }),
        dashboardShortcut({ id: "finance-reports", title: "Open finance-relevant source views", description: "Recorded cost, work obligations, invoice references, and lifecycle evidence remain separate and traceable.", categoryLabel: "Reporting", dueLabel: "Available now", ownerLabel: "Finance", href: "/app/reports", linkLabel: "Open reports" }),
      ],
      prioritySection: { title: "Financial review paths", description: "Cost and evidence stay distinct so no amount is silently combined or treated as approved.", link: { href: "/app/reports", label: "Open source reports" } },
      breakdowns: [storeBreakdown, categoryBreakdown],
      trends: [trend],
      spotlight: invoiceToReview
        ? {
            eyebrow: "Optional invoice safeguard",
            title: `Review ${invoiceToReview.invoiceNumber} before linking it`,
            description: "This invoice reference is not confirmed against source work. Review the reference and allocations manually; TraceOps does not approve, reject, or execute payment.",
            facts: [
              { label: "Gross invoice amount", value: money(invoiceToReview.grossAmount.amountMinor) },
              { label: "Match status", value: sentence(invoiceToReview.matchStatus) },
              { label: "Operator work order", value: invoiceToReview.operatorWorkOrderNumber ?? "Not provided" },
              { label: "Vendor", value: vendorById.get(invoiceToReview.vendorId)?.name ?? "Unknown vendor" },
            ],
            link: { href: `/app/invoices/${invoiceToReview.id}`, label: "Review invoice evidence" },
          }
        : lifecycleSpotlight,
    };
  }

  if (session.role === "store_manager") {
    const store = scoped.stores[0];
    return {
      state: { kind: "ready" },
      page: {
        ...pageBase,
        title: store ? `Store ${store.storeNumber} at a glance` : "Your store at a glance",
        eyebrow: "Store manager home",
        description: "Report an issue, see who is onsite, follow current work, and understand this store's maintenance cost without corporate clutter.",
        primaryAction: { label: "Report an issue", href: "/app/requests/new" },
        secondaryAction: { label: "Review current work", href: "/app/work-orders?status=open" },
      },
      journey: base.journey,
      metrics: [
        { id: "open-work", label: "Open work", value: String(openWork.length), supportingText: "Current maintenance obligations for this store", tone: openWork.length ? "warning" : "positive", link: { href: "/app/work-orders?status=open", label: "Open current work" } },
        { id: "vendor-response", label: "Awaiting vendor response", value: String(awaitingVendor.length), supportingText: "Approved, issued, or waiting on vendor", tone: awaitingVendor.length ? "warning" : "positive", link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" } },
        { id: "recorded-visits", label: "Recorded service visits", value: String(scoped.visits.length), supportingText: `${activeVisits.length} onsite now · ${completedVisits.length} completed`, tone: activeVisits.length ? "info" : "neutral", link: { href: "/app/visits", label: "Open visit history" } },
        { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost for this store", link: { href: "/app/spend", label: "Explain the total" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "store-report", title: "Report a new store issue", description: "Capture the problem, reporter, priority, and optional photos. Equipment can be classified later.", categoryLabel: "Issue intake", dueLabel: "When needed", ownerLabel: "Store team", tone: "info", href: "/app/requests/new", linkLabel: "Report an issue" }),
        dashboardShortcut({ id: "store-work", title: `Review ${openWork.length} open work order${openWork.length === 1 ? "" : "s"}`, description: "See the assignment, status, accountable party, and next action for this store.", categoryLabel: "Current work", dueLabel: "Current", ownerLabel: "Store and facilities", tone: openWork.length ? "warning" : "positive", href: "/app/work-orders?status=open", linkLabel: "Open current work" }),
        dashboardShortcut({ id: "store-visits", title: `Review ${completedVisits.length} completed service visit${completedVisits.length === 1 ? "" : "s"}`, description: "See observed arrival, checkout, outcome, evidence, and follow-up connected to this store.", categoryLabel: "Vendor accountability", dueLabel: "History", ownerLabel: "Store team", href: "/app/visits?status=checked_out", linkLabel: "Open visit history" }),
        dashboardShortcut({ id: "store-record", title: "Open the complete store record", description: "Move between cost, issues, work, visits, equipment, PM, and public entry points from one place.", categoryLabel: "Store record", dueLabel: "Available now", ownerLabel: "Store manager", href: store ? `/app/stores/${store.id}` : "/app/stores", linkLabel: "Open store" }),
      ],
      prioritySection: { title: "Your store workflow", description: "The four places a store manager should need most often.", link: { href: store ? `/app/stores/${store.id}` : "/app/stores", label: "Open complete store record" } },
      breakdowns: [categoryBreakdown],
      trends: [trend],
    };
  }

  const workStatusCounts = new Map<string, number>();
  for (const work of openWork) workStatusCounts.set(work.status, (workStatusCounts.get(work.status) ?? 0) + 1);
  const activeVendorCounts = new Map<string, number>();
  for (const visit of activeVisits) if (visit.vendorId) {
    activeVendorCounts.set(visit.vendorId, (activeVendorCounts.get(visit.vendorId) ?? 0) + 1);
  }
  const isFacilities = session.role === "facilities";
  return {
    state: { kind: "ready" },
    page: {
      ...pageBase,
      title: isFacilities ? "Maintenance control center" : "Your region at a glance",
      eyebrow: isFacilities ? "Facilities operations" : "Regional operations",
      description: isFacilities
        ? "Run the connected issue-to-outcome workflow, see vendor presence, and keep every unresolved item owned without losing cost visibility."
        : "See the stores, work, vendor activity, accountability exceptions, and recorded cost inside your region only.",
      primaryAction: { label: "Review what needs attention", href: "/app/action-center" },
      secondaryAction: { label: "Create work order", href: "/app/work-orders/new" },
    },
    journey: base.journey,
    metrics: isFacilities
      ? [
          { id: "open-exceptions", label: "Needs attention", value: String(openExceptions.length), supportingText: "No-WO, location, checkout, and review facts", tone: openExceptions.length ? "warning" : "positive", link: { href: "/app/action-center?type=exception", label: "Review exceptions" } },
          { id: "vendor-response", label: "Awaiting vendor response", value: String(awaitingVendor.length), supportingText: "Approved, issued, or waiting on vendor", tone: awaitingVendor.length ? "warning" : "positive", link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" } },
          { id: "active-visits", label: "Vendors onsite now", value: String(activeVisits.length), supportingText: `${scoped.visits.length} recorded visits in company scope`, tone: activeVisits.length ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open live visits" } },
          { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost; invoices are not required", link: { href: "/app/spend", label: "Explain the total" } },
        ]
      : [
          { id: "open-work", label: "Open work", value: String(openWork.length), supportingText: "Every item has an owner and next action", tone: openWork.length ? "info" : "positive", link: { href: "/app/work-orders?status=open", label: "Open regional work" } },
          { id: "open-exceptions", label: "Needs attention", value: String(openExceptions.length), supportingText: "Accountability facts inside your region", tone: openExceptions.length ? "warning" : "positive", link: { href: "/app/action-center?type=exception", label: "Review regional exceptions" } },
          { id: "active-visits", label: "Vendors onsite now", value: String(activeVisits.length), supportingText: `${scoped.visits.length} recorded visits in regional scope`, tone: activeVisits.length ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open live visits" } },
          { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost inside your region", link: { href: "/app/spend", label: "Explain the total" } },
        ],
    priorityActions: actions(fixture, scoped),
    prioritySection: { title: isFacilities ? "Operational priorities" : "Regional priorities", description: isFacilities ? "Exceptions and follow-ups that need a clear owner or decision." : "Exceptions and follow-ups from stores inside your assigned region.", link: { href: "/app/action-center", label: "Open action center" } },
    breakdowns: isFacilities
      ? [
          countBreakdown("open-work-status", "Open work by status", workStatusCounts, (key) => hrefWithQuery("/app/work-orders", { status: key }), { description: "Every segment opens the work orders currently carrying that status.", totalNoun: "open work orders", sourceLink: { href: "/app/work-orders?status=open", label: "Open every maintenance obligation" } }),
          countBreakdown("onsite-vendor", "Who is onsite now", activeVendorCounts, (key) => hrefWithQuery("/app/visits", { status: "active", vendor: key }), { description: "Observed active visits by outside vendor; time and location are presence evidence, not certified labor.", labelFor: (key) => vendorById.get(key)?.name ?? "Unknown vendor", totalNoun: "active visits", sourceLink: { href: "/app/visits?status=active", label: "Open all live visits" } }),
        ]
      : [storeBreakdown, categoryBreakdown],
    trends: [trend],
    spotlight: lifecycleSpotlight,
  };
}

const columns: Record<OperatorListRoute, TableColumnViewModel[]> = {
  "action-center": [
    { key: "item", label: "What needs review" },
    { key: "store", label: "Store" },
    { key: "record", label: "Related record" },
    { key: "owner", label: "Owner" },
    { key: "due", label: "Due" },
    { key: "priority", label: "Priority" },
  ],
  requests: [
    { key: "request", label: "Request" },
    { key: "store", label: "Store" },
    { key: "priority", label: "Priority" },
    { key: "reported", label: "Reported" },
    { key: "status", label: "Status" },
  ],
  "work-orders": [
    { key: "work", label: "Work order" },
    { key: "store", label: "Store" },
    { key: "assignment", label: "Assigned to" },
    { key: "next", label: "Next action" },
    { key: "cost", label: "Recorded cost", align: "end" },
    { key: "status", label: "Status" },
  ],
  visits: [
    { key: "visit", label: "Visit" },
    { key: "store", label: "Store" },
    { key: "vendor", label: "Vendor" },
    { key: "work", label: "Work order" },
    { key: "observed", label: "Observed window" },
    { key: "evidence", label: "Evidence" },
    { key: "outcome", label: "Outcome" },
  ],
  stores: [
    { key: "store", label: "Store" },
    { key: "region", label: "Region" },
    { key: "address", label: "Address" },
    { key: "work", label: "Open work", align: "end" },
    { key: "onsite", label: "Onsite now", align: "end" },
    { key: "cost", label: "Recorded cost", align: "end" },
  ],
  vendors: [
    { key: "vendor", label: "Vendor" },
    { key: "specialties", label: "Specialties" },
    { key: "coverage", label: "Coverage" },
    { key: "open", label: "Open work", align: "end" },
    { key: "visits", label: "Recent visits", align: "end" },
    { key: "status", label: "Status" },
  ],
  invoices: [
    { key: "invoice", label: "Invoice reference" },
    { key: "work", label: "Work order" },
    { key: "vendor", label: "Vendor" },
    { key: "store", label: "Store" },
    { key: "amount", label: "Invoice amount", align: "end" },
    { key: "status", label: "Match status" },
  ],
  reports: [
    { key: "report", label: "Live report" },
    { key: "scope", label: "Scope" },
    { key: "period", label: "Period" },
    { key: "basis", label: "Definition" },
    { key: "status", label: "Status" },
  ],
  admin: [
    { key: "area", label: "Configuration area" },
    { key: "summary", label: "Current setup" },
    { key: "owner", label: "Owner" },
    { key: "status", label: "Status" },
  ],
};

const listMeta: Record<OperatorListRoute, { title: string; eyebrow: string; description: string; placeholder?: string }> = {
  "action-center": { title: "Action center", eyebrow: "Assigned work", description: "Approvals, exceptions, follow-ups, and review decisions in one prioritized queue.", placeholder: "Search actions, stores, work orders, or vendors" },
  requests: { title: "Service requests", eyebrow: "Issue intake", description: "Preserve what store teams reported, then classify, approve, or convert it without erasing the original facts.", placeholder: "Search problem, reporter, request, or store" },
  "work-orders": { title: "Work orders", eyebrow: "Service control", description: "Canonical internal and outside service records from creation through outcome, follow-up, and recorded cost.", placeholder: "Search number, problem, store, vendor, or category" },
  visits: { title: "Service visits", eyebrow: "Observed service", description: "See who arrived, why, the evidence captured, and which visits need review—without treating presence as certified labor.", placeholder: "Search technician, vendor, store, or work order" },
  stores: { title: "Stores", eyebrow: "Operating network", description: "Find any location by store number, address, name, city, or alias and open its maintenance history.", placeholder: "Search store number, name, address, city, or alias" },
  vendors: { title: "Approved vendors", eyebrow: "Vendor network", description: "Search by name, specialty, plain-language alias, equipment type, and coverage.", placeholder: "Search vendor, plumber, refrigeration, dispenser, or equipment" },
  invoices: { title: "Invoice references", eyebrow: "Optional billing safeguard", description: "Review manually entered invoice references tied to operator work orders. This is an accountability aid, not an accounts-payable system.", placeholder: "Search invoice, work order, vendor, or store" },
  reports: { title: "Reports & records", eyebrow: "Governed views", description: "Open live, source-linked reporting views now; published snapshots can be archived when the reporting workflow is enabled.", placeholder: "Search report name or definition" },
  admin: { title: "Administration", eyebrow: "Organization setup", description: "Manage stores, vendors, roles, taxonomy, and evidence policy without rewriting source history.", placeholder: "Search settings, stores, vendors, roles, or policy" },
};

const filterLabels: Record<string, string> = {
  active: "Onsite now",
  checked_out: "Completed visits",
  amended: "Amended visits",
  open: "Open",
  refrigeration: "Refrigeration",
  hvac: "HVAC",
  forecourt: "Forecourt",
  plumbing: "Plumbing",
  electrical: "Electrical",
  exterior: "Exterior services",
  exception: "Exceptions",
  "follow-up": "Follow-ups",
  true: "With recorded cost",
};

function routePath(route: OperatorListRoute): string {
  return `/app/${route}`;
}

function queryEntries(query: OperatorSearchParameters): Array<[string, string]> {
  return Object.entries(query).flatMap(([key, raw]) => {
    const value = first(raw);
    return value ? [[key, value] as [string, string]] : [];
  });
}

function hrefWithoutQueryKey(route: OperatorListRoute, query: OperatorSearchParameters, keyToRemove: string): string {
  const params = new URLSearchParams(queryEntries(query).filter(([key]) => key !== keyToRemove));
  const serialized = params.toString();
  return serialized ? `${routePath(route)}?${serialized}` : routePath(route);
}

function appliedFilters(
  fixture: OpsFixture,
  scoped: ScopedFixture,
  route: OperatorListRoute,
  query: OperatorSearchParameters,
) {
  const stores = new Map(scoped.stores.map((store) => [store.id, store]));
  const vendors = new Map(
    fixture.vendors
      .filter((vendor) => vendor.organizationId === scoped.organizationId)
      .map((vendor) => [vendor.id, vendor]),
  );
  const assets = new Map(scoped.assets.map((asset) => [asset.id, asset]));
  const ignored = new Set(["q"]);
  return queryEntries(query)
    .filter(([key]) => !ignored.has(key))
    .map(([key, value]) => {
      let label = filterLabels[value] ?? sentence(value);
      if (key === "store") label = storeLabel(stores.get(value));
      else if (key === "vendor") label = vendors.get(value)?.name ?? "Selected vendor";
      else if (key === "asset") label = assets.get(value)?.name ?? (value === "unlinked" ? "No equipment linked" : "Selected equipment");
      else if (key === "costFrom") label = `Cost from ${date(value)}`;
      else if (key === "costMonth") label = `Cost month ${monthLabel(value)}`;
      else if (key === "path") label = value.split("|").at(-1) ?? value;
      else if (key === "exception") label = "Selected exception";
      else if (key === "visit") label = "Selected visit";
      return { id: key, label, removeHref: hrefWithoutQueryKey(route, query, key) };
    });
}

function searchable(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ").toLocaleLowerCase("en-US");
}

function workRows(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): TableRowViewModel[] {
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const costFrom = first(query.costFrom);
  const costMonth = first(query.costMonth);
  const costByWork = costMonth
    ? fixture.costLines.reduce((result, line) => {
        if (
          line.organizationId === scoped.organizationId &&
          line.serviceDate.startsWith(costMonth) &&
          (!costFrom || line.serviceDate >= costFrom)
        ) result.set(line.workOrderId, (result.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
        return result;
      }, new Map<string, number>())
    : recordedCostByWork(fixture, scoped.organizationId, costFrom);
  const q = cleanSearch(first(query.q));
  const category = first(query.category);
  const status = first(query.status);
  const stage = first(query.stage);
  const storeId = first(query.store);
  const regionId = first(query.region);
  const hasCost = first(query.hasCost) === "true";
  const asset = first(query.asset);
  const component = first(query.component);
  const path = pathSegments(first(query.path));
  const assetById = new Map(scoped.assets.map((candidate) => [candidate.id, candidate]));
  return scoped.workOrders
    .filter((work) => {
      if (!q) return true;
      const assignment = assignmentForWork(fixture, scoped.organizationId, work.id);
      const assignee = assignment?.kind === "outside_vendor"
        ? vendorName(fixture, scoped.organizationId, assignment.vendorId)
        : assignment?.kind === "internal"
          ? "Internal maintenance"
          : "Choose later";
      return searchable(work.number, work.problem, work.categoryKey, storeLabel(storeById.get(work.storeId)), assignee).includes(q);
    })
    .filter((work) => !category || (work.categoryKey ?? "unclassified") === category)
    .filter((work) => !storeId || work.storeId === storeId)
    .filter((work) => !regionId || storeById.get(work.storeId)?.regionId === regionId)
    .filter((work) => !hasCost || (costByWork.get(work.id) ?? 0) > 0)
    .filter((work) => !costMonth || fixture.costLines.some((line) => line.organizationId === scoped.organizationId && line.workOrderId === work.id && line.serviceDate.startsWith(costMonth)))
    .filter((work) => !asset || (asset === "unlinked" ? !work.assetId : work.assetId === asset))
    .filter((work) => !component || (component === "unlinked" ? !work.componentId : work.componentId === component))
    .filter((work) => path.length === 0 || assetMatchesPath(work.assetId ? assetById.get(work.assetId) : undefined, path))
    .filter((work) => !status || (status === "open" ? !["closed", "cancelled"].includes(work.status) : work.status === status))
    .filter((work) => !stage || (stage === "vendor-response" && ["approved", "issued", "waiting_on_vendor"].includes(work.status)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((work) => {
      const assignment = assignmentForWork(fixture, scoped.organizationId, work.id);
      const assignee = assignment?.kind === "outside_vendor"
        ? vendorName(fixture, scoped.organizationId, assignment.vendorId)
        : assignment?.kind === "internal"
          ? "Internal maintenance"
          : "Choose later";
      return {
        id: work.id,
        label: work.number,
        href: `/app/work-orders/${work.id}`,
        cells: [
          { key: "work", value: work.number, secondary: work.problem },
          { key: "store", value: storeLabel(storeById.get(work.storeId)) },
          { key: "assignment", value: assignee ?? "Not assigned", secondary: assignment ? sentence(assignment.status) : "Assignment needed" },
          { key: "next", value: work.nextAction, secondary: work.accountableParty },
          { key: "cost", value: money(costByWork.get(work.id) ?? 0) },
          { key: "status", value: sentence(work.status), tone: workStatusTone(work.status) },
        ],
      };
    });
}

function visitRows(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): TableRowViewModel[] {
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const workById = new Map(scoped.workOrders.map((work) => [work.id, work]));
  const q = cleanSearch(first(query.q));
  const status = first(query.status);
  const storeId = first(query.store);
  const vendorId = first(query.vendor);
  const visitId = first(query.visit);
  const exceptionId = first(query.exception);
  const exceptionVisitId = exceptionId
    ? fixture.exceptions.find((item) => item.organizationId === scoped.organizationId && item.id === exceptionId)?.visitId
    : undefined;
  return scoped.visits
    .filter((visit) => !status || visit.status === status)
    .filter((visit) => !storeId || visit.storeId === storeId)
    .filter((visit) => !vendorId || visit.vendorId === vendorId)
    .filter((visit) => !visitId || visit.id === visitId)
    .filter((visit) => !exceptionId || visit.id === exceptionVisitId)
    .filter((visit) => !q || searchable(visit.technicianName, visit.providerName, visit.purpose, workById.get(visit.workOrderId ?? "")?.number, storeLabel(storeById.get(visit.storeId))).includes(q))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
    .map((visit) => {
      const evidence = fixture.visitEvidence.filter((item) => item.organizationId === scoped.organizationId && item.visitId === visit.id);
      const checkIn = evidence.find((item) => item.kind === "check_in");
      const work = visit.workOrderId ? workById.get(visit.workOrderId) : undefined;
      return {
        id: visit.id,
        label: `${visit.providerName} visit`,
        href: work ? `/app/work-orders/${work.id}` : `/app/visits?visit=${visit.id}`,
        cells: [
          { key: "visit", value: visit.technicianName, secondary: visit.purpose },
          { key: "store", value: storeLabel(storeById.get(visit.storeId)) },
          { key: "vendor", value: visit.providerName },
          { key: "work", value: work?.number ?? "No work order", secondary: visit.unmatchedReason },
          { key: "observed", value: visit.checkedOutAt ? `${dateTime(visit.checkedInAt)} – ${dateTime(visit.checkedOutAt)}` : `Since ${dateTime(visit.checkedInAt)}`, secondary: "Approximate presence, not labor" },
          { key: "evidence", value: checkIn?.location?.result ? sentence(checkIn.location.result) : "No location evidence", tone: checkIn?.location?.result === "verified" ? "positive" : "warning" },
          { key: "outcome", value: visit.outcome ? sentence(visit.outcome) : "Onsite now", tone: visit.status === "active" ? "info" : "neutral" },
        ],
      };
    });
}

function visitMetrics(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): MetricViewModel[] {
  const selectedStore = first(query.store);
  const selectedVendor = first(query.vendor);
  const base = scoped.visits
    .filter((visit) => !selectedStore || visit.storeId === selectedStore)
    .filter((visit) => !selectedVendor || visit.vendorId === selectedVendor);
  const openExceptionVisitIds = new Set(
    fixture.exceptions
      .filter(
        (exception) =>
          exception.organizationId === scoped.organizationId &&
          exception.status !== "resolved" &&
          Boolean(exception.visitId),
      )
      .map((exception) => exception.visitId!),
  );
  const withContext = (status?: string) => hrefWithQuery("/app/visits", {
    store: selectedStore,
    vendor: selectedVendor,
    status,
  });
  const active = base.filter((visit) => visit.status === "active").length;
  const completed = base.filter((visit) => visit.status !== "active").length;
  const noWorkOrder = base.filter((visit) => !visit.workOrderId).length;
  const needsReviewIds = new Set(
    base
      .filter((visit) => openExceptionVisitIds.has(visit.id) || !visit.workOrderId)
      .map((visit) => visit.id),
  );
  return [
    { id: "all-visits", label: "All visits", value: String(base.length), supportingText: "Every observed visit in scope", link: { href: withContext(), label: "Show all visits" } },
    { id: "active-visits", label: "Onsite now", value: String(active), supportingText: "Active check-ins", tone: active ? "info" : "neutral", link: { href: withContext("active"), label: "Show onsite" } },
    { id: "completed-visits", label: "Completed", value: String(completed), supportingText: "Checked-out visit history", tone: "positive", link: { href: withContext("checked_out"), label: "Show history" } },
    { id: "visit-review", label: "Needs review", value: String(needsReviewIds.size), supportingText: `${noWorkOrder} without a work order`, tone: needsReviewIds.size ? "warning" : "positive", link: { href: hrefWithQuery("/app/action-center", { type: "exception" }), label: "Review exceptions" } },
  ];
}

function storeRows(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): TableRowViewModel[] {
  const costByWork = recordedCostByWork(fixture, scoped.organizationId);
  const regionById = new Map(fixture.regions.filter((region) => region.organizationId === scoped.organizationId).map((region) => [region.id, region]));
  const q = cleanSearch(first(query.q));
  const sort = first(query.sort);
  return scoped.stores
    .filter((store) => !q || searchable(store.storeNumber, store.name, storeAddress(store), ...store.aliases).includes(q))
    .sort((a, b) => {
      if (sort === "cost") {
        const aCost = costForWorkIds(costByWork, scoped.workOrders.filter((work) => work.storeId === a.id).map((work) => work.id));
        const bCost = costForWorkIds(costByWork, scoped.workOrders.filter((work) => work.storeId === b.id).map((work) => work.id));
        return bCost - aCost || a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true });
      }
      return a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true });
    })
    .map((store) => {
      const work = scoped.workOrders.filter((item) => item.storeId === store.id);
      return {
        id: store.id,
        label: storeLabel(store),
        href: `/app/stores/${store.id}`,
        cells: [
          { key: "store", value: `Store ${store.storeNumber}`, secondary: store.name },
          { key: "region", value: regionById.get(store.regionId ?? "")?.name ?? "No region" },
          { key: "address", value: storeAddress(store) },
          { key: "work", value: String(work.filter((item) => !["closed", "cancelled"].includes(item.status)).length) },
          { key: "onsite", value: String(scoped.visits.filter((visit) => visit.storeId === store.id && visit.status === "active").length) },
          { key: "cost", value: money(costForWorkIds(costByWork, work.map((item) => item.id))) },
        ],
      };
    });
}

function vendorRows(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): TableRowViewModel[] {
  const q = cleanSearch(first(query.q));
  return fixture.vendors
    .filter((vendor) => vendor.organizationId === scoped.organizationId)
    .filter((vendor) => {
      const specialties = fixture.vendorSpecialties.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      return !q || searchable(vendor.name, vendor.code, ...specialties.flatMap((item) => [item.displayName, ...item.searchAliases])).includes(q);
    })
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.name.localeCompare(b.name))
    .map((vendor) => {
      const specialties = fixture.vendorSpecialties.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      const coverage = fixture.vendorCoverage.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      const assignments = fixture.assignments.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      const workIds = new Set(assignments.map((item) => item.workOrderId));
      return {
        id: vendor.id,
        label: vendor.name,
        href: `/app/vendors/${vendor.id}`,
        cells: [
          { key: "vendor", value: vendor.name, secondary: vendor.preferred ? "Preferred provider" : vendor.code },
          { key: "specialties", value: specialties.map((item) => item.displayName).join(", ") || "Not classified" },
          { key: "coverage", value: coverage.some((item) => item.scopeKind === "organization") ? "Companywide" : `${coverage.length} assigned scopes` },
          { key: "open", value: String(scoped.workOrders.filter((work) => workIds.has(work.id) && !["closed", "cancelled"].includes(work.status)).length) },
          { key: "visits", value: String(scoped.visits.filter((visit) => visit.vendorId === vendor.id).length) },
          { key: "status", value: sentence(vendor.status), tone: vendor.status === "approved" ? "positive" : "warning" },
        ],
      };
    });
}

export function buildListModel(
  fixture: OpsFixture,
  session: OperatorSession,
  route: OperatorListRoute,
  query: OperatorSearchParameters = {},
): ListPageViewModel {
  const requestedStoreId = first(query.store);
  const scoped = narrowScopeToStore(scopeFixture(fixture, session), requestedStoreId);
  const requestedStore = requestedStoreId ? scoped.stores.find((store) => store.id === requestedStoreId) : undefined;
  const activeScopeLabel = requestedStore ? storeLabel(requestedStore) : session.scopeLabel;
  const q = cleanSearch(first(query.q));
  let rows: TableRowViewModel[];
  if (route === "work-orders") rows = workRows(fixture, scoped, query);
  else if (route === "visits") rows = visitRows(fixture, scoped, query);
  else if (route === "stores") rows = storeRows(fixture, scoped, query);
  else if (route === "vendors") rows = vendorRows(fixture, scoped, query);
  else if (route === "invoices") {
    const from = first(query.from);
    const requestedStatus = first(query.status);
    const requestedRegionId = first(query.region);
    const requestedCategory = first(query.category);
    const workById = new Map(scoped.workOrders.map((work) => [work.id, work]));
    const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
    const vendorById = new Map(
      fixture.vendors
        .filter((vendor) => vendor.organizationId === scoped.organizationId)
        .map((vendor) => [vendor.id, vendor]),
    );
    rows = fixture.invoiceReferences
      .filter(
        (invoice) =>
          invoice.organizationId === scoped.organizationId &&
          (!from || invoice.invoiceDate >= from),
      )
      .map((invoice) => ({
        invoice,
        allocations: fixture.invoiceAllocations.filter(
          (allocation) =>
            allocation.organizationId === scoped.organizationId &&
            allocation.invoiceReferenceId === invoice.id &&
            workById.has(allocation.workOrderId),
          ),
      }))
      .filter((item) => scoped.includeCompanywide || item.allocations.length > 0)
      .filter((item) =>
        !requestedStatus ||
        (requestedStatus === "review"
          ? item.invoice.matchStatus !== "confirmed"
          : item.invoice.matchStatus === requestedStatus),
      )
      .filter((item) => {
        if (!requestedRegionId && !requestedStoreId && !requestedCategory) return true;
        return item.allocations.some((allocation) => {
          const work = workById.get(allocation.workOrderId);
          const store = work ? storeById.get(work.storeId) : undefined;
          return Boolean(
            work &&
            (!requestedRegionId || store?.regionId === requestedRegionId) &&
            (!requestedStoreId || work.storeId === requestedStoreId) &&
            (!requestedCategory || work.categoryKey === requestedCategory)
          );
        });
      })
      .filter((item) => {
        if (!q) return true;
        const work = item.allocations[0] ? workById.get(item.allocations[0].workOrderId) : undefined;
        const store = work ? storeById.get(work.storeId) : undefined;
        const vendor = vendorById.get(item.invoice.vendorId);
        return searchable(item.invoice.invoiceNumber, item.invoice.operatorWorkOrderNumber, work?.number, vendor?.name, storeLabel(store)).includes(q);
      })
      .sort((a, b) => b.invoice.invoiceDate.localeCompare(a.invoice.invoiceDate))
      .map(({ invoice, allocations }) => {
        const primaryWork = allocations[0] ? workById.get(allocations[0].workOrderId) : undefined;
        const store = primaryWork ? storeById.get(primaryWork.storeId) : undefined;
        const vendor = vendorById.get(invoice.vendorId);
        return {
          id: invoice.id,
          label: invoice.invoiceNumber,
          href: `/app/invoices/${invoice.id}`,
          cells: [
            { key: "invoice", value: invoice.invoiceNumber, secondary: date(invoice.invoiceDate) },
            { key: "work", value: primaryWork?.number ?? invoice.operatorWorkOrderNumber ?? "No work-order reference", secondary: allocations.length ? (allocations.length > 1 ? `${allocations.length} allocations` : "1 linked allocation") : "Not linked to source work" },
            { key: "vendor", value: vendor?.name ?? "Unknown vendor" },
            { key: "store", value: primaryWork ? storeLabel(store) : "Not attributed" },
            { key: "amount", value: money(invoice.grossAmount.amountMinor) },
            { key: "status", value: sentence(invoice.matchStatus), tone: invoice.matchStatus === "confirmed" ? "positive" : ["rejected", "unmatched"].includes(invoice.matchStatus) ? "warning" : "info" },
          ],
        };
      });
  }
  else if (route === "requests") {
    const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
    rows = fixture.requests
      .filter((request) => request.organizationId === scoped.organizationId && scoped.storeIds.has(request.storeId))
      .filter((request) => !q || searchable(request.reference, request.problem, request.reporterName, storeLabel(storeById.get(request.storeId))).includes(q))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((request) => ({
        id: request.id,
        label: request.reference,
        href: `/app/requests/${request.id}`,
        cells: [
          { key: "request", value: request.reference, secondary: request.problem },
          { key: "store", value: storeLabel(storeById.get(request.storeId)) },
          { key: "priority", value: sentence(request.priority), tone: request.priority === "emergency" ? "critical" : request.priority === "urgent" ? "warning" : "neutral" },
          { key: "reported", value: dateTime(request.submittedAt), secondary: request.reporterName },
          { key: "status", value: sentence(request.status), tone: request.status === "converted" ? "positive" : "info" },
        ],
      }));
  } else if (route === "action-center") {
    const requestedType = first(query.type);
    rows = actions(fixture, scoped, 50)
      .filter((action) => !requestedType || (requestedType === "exception" ? action.categoryLabel !== "Open follow-up" : action.categoryLabel === "Open follow-up"))
      .filter((action) => !q || searchable(action.title, action.description, action.ownerLabel).includes(q))
      .map((action) => ({
        id: action.id,
        label: action.title,
        href: action.link.href,
        cells: [
          { key: "item", value: action.title, secondary: action.description },
          { key: "store", value: action.storeLabel ?? "Companywide" },
          { key: "record", value: action.recordLabel ?? action.categoryLabel, secondary: action.categoryLabel },
          { key: "owner", value: action.ownerLabel },
          { key: "due", value: action.dueLabel },
          { key: "priority", value: action.priorityLabel ?? (action.tone === "critical" ? "Urgent" : "Attention"), tone: action.tone },
        ],
      }));
  } else if (route === "reports") {
    const reportRows = [
      ["Vendor visit accountability", "/app/visits", `${scoped.visits.length} source visits`, "Observed presence and exception evidence"],
      ["Open maintenance obligations", "/app/work-orders?status=open", `${scoped.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status)).length} source work orders`, "Owner, next action, due date, and status"],
      ["Recorded maintenance cost", "/app/spend", `${fixture.costLines.filter((line) => line.organizationId === scoped.organizationId && scoped.workOrders.some((work) => work.id === line.workOrderId)).length} cost lines`, "Recorded work cost only"],
      ["Invoice reference safeguards", "/app/invoices", `${fixture.invoiceAllocations.filter((allocation) => allocation.organizationId === scoped.organizationId && scoped.workOrders.some((work) => work.id === allocation.workOrderId)).length} linked allocations`, "Optional invoice-to-work-order references; not accounts payable"],
      ["Preventive maintenance", "/app/pm", `${fixture.pmOccurrences.filter((item) => item.organizationId === scoped.organizationId && scoped.storeIds.has(item.storeId)).length} PM occurrences`, "Due-window numerator and denominator"],
    ];
    rows = reportRows.filter(([name, , source, definition]) => !q || searchable(name, source, definition).includes(q)).map(([name, href, source, definition], index) => ({
      id: `report-${index}`,
      label: name,
      href,
      cells: [
        { key: "report", value: name, secondary: source },
        { key: "scope", value: session.scopeLabel },
        { key: "period", value: "Current source view" },
        { key: "basis", value: definition },
        { key: "status", value: "Live", tone: "positive" },
      ],
    }));
  } else {
    const administrationRows: TableRowViewModel[] = [
      { id: "stores", label: "Stores", href: "/app/stores", cells: [{ key: "area", value: "Stores & regions" }, { key: "summary", value: `${scoped.stores.length} stores in scope` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Configured", tone: "positive" }] },
      { id: "vendors", label: "Vendors", href: "/app/vendors", cells: [{ key: "area", value: "Approved vendor network" }, { key: "summary", value: `${fixture.vendors.filter((vendor) => vendor.organizationId === scoped.organizationId).length} approved vendors` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Configured", tone: "positive" }] },
      { id: "taxonomy", label: "Service taxonomy", href: "/app/equipment", cells: [{ key: "area", value: "Service areas & equipment" }, { key: "summary", value: `${new Set(scoped.assets.map((asset) => asset.categoryKey)).size} active service areas` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Progressive", tone: "info" }] },
      { id: "policy", label: "Visit policy", href: "/app/visits", cells: [{ key: "area", value: "Visit evidence policy" }, { key: "summary", value: "Event-only location; no continuous tracking" }, { key: "owner", value: "Security & facilities" }, { key: "status", value: "Active", tone: "positive" }] },
    ];
    rows = administrationRows.filter((row) => !q || searchable(row.label, ...row.cells.map((cell) => cell.value)).includes(q));
  }

  rows = rows.filter((row) => roleCanOpenOperatorHref(session.role, row.href));
  const meta = listMeta[route];
  const activeFilters = appliedFilters(fixture, scopeFixture(fixture, session), route, query);
  const visitStatus = route === "visits" ? first(query.status) : undefined;
  const visitTotal = route === "visits"
    ? scoped.visits.filter((visit) => !first(query.vendor) || visit.vendorId === first(query.vendor)).length
    : undefined;
  const visitFilters = route === "visits"
    ? [{
        id: "visit-status",
        label: "Show",
        options: [
          { value: "all", label: `All (${visitTotal})`, href: hrefWithoutQueryKey(route, query, "status"), selected: !visitStatus },
          { value: "active", label: `Onsite (${scoped.visits.filter((visit) => visit.status === "active").length})`, href: hrefWithQuery(routePath(route), { store: first(query.store), vendor: first(query.vendor), status: "active" }), selected: visitStatus === "active" },
          { value: "checked_out", label: `Completed (${scoped.visits.filter((visit) => visit.status === "checked_out").length})`, href: hrefWithQuery(routePath(route), { store: first(query.store), vendor: first(query.vendor), status: "checked_out" }), selected: visitStatus === "checked_out" },
        ],
      }]
    : undefined;
  const primaryAction = route === "requests" && roleCan(session.role, "create_request")
    ? { label: "Report an issue", href: "/app/requests/new" }
    : route === "work-orders" && roleCan(session.role, "create_work_order")
      ? { label: "Create work order", href: "/app/work-orders/new" }
      : route === "stores" && roleCan(session.role, "create_store")
        ? { label: "Add store", href: "/app/stores/new" }
        : route === "vendors" && roleCan(session.role, "onboard_vendor")
          ? { label: "Add vendor", href: "/app/vendors/new" }
          : undefined;

  return {
    state: rows.length || !q ? { kind: "ready" } : { kind: "empty", title: "No matching records", message: "Try another store number, address, vendor, or keyword." },
    page: {
      title: route === "visits" && visitStatus === "active" ? "Vendors onsite now" : meta.title,
      eyebrow: meta.eyebrow,
      description: route === "visits" && visitStatus === "active"
        ? `${rows.length} active visit${rows.length === 1 ? "" : "s"} · ${visitTotal} total visits in scope. Location and time are presence evidence, not certified labor.`
        : meta.description,
      scopeLabel: activeScopeLabel,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
      primaryAction,
    },
    metrics: route === "visits" ? visitMetrics(fixture, scoped, query) : undefined,
    filters: visitFilters,
    appliedFilters: activeFilters,
    clearFiltersHref: activeFilters.length ? routePath(route) : undefined,
    table: { id: route, caption: meta.title, columns: columns[route], rows },
    resultSummary: route === "visits" && visitTotal !== undefined && rows.length !== visitTotal
      ? `Showing ${rows.length} of ${visitTotal} visits`
      : `${rows.length} source record${rows.length === 1 ? "" : "s"}`,
    search: meta.placeholder ? {
      label: `Search ${meta.title}`,
      placeholder: meta.placeholder,
      value: first(query.q),
      action: routePath(route),
      preservedParameters: queryEntries(query)
        .filter(([key]) => key !== "q")
        .map(([name, value]) => ({ name, value })),
    } : undefined,
    pagination: rows.length ? { summary: `Showing 1–${rows.length} of ${rows.length}` } : undefined,
  };
}

export function buildSearchModel(
  fixture: OpsFixture,
  session: OperatorSession,
  query: OperatorSearchParameters = {},
): SearchPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const q = cleanSearch(first(query.q));
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));

  const equipmentRows = q
    ? scoped.assets
        .filter((asset) => searchable(
          asset.assetTag,
          asset.name,
          asset.manufacturer,
          asset.model,
          asset.serialNumber,
          asset.categoryKey,
          ...asset.groupPath,
          storeLabel(storeById.get(asset.storeId)),
        ).includes(q))
        .sort((a, b) => a.assetTag.localeCompare(b.assetTag))
        .map<TableRowViewModel>((asset) => ({
          id: asset.id,
          label: asset.name,
          href: `/app/equipment/${asset.id}`,
          cells: [
            { key: "result", value: asset.name, secondary: `${asset.assetTag} · ${asset.manufacturer ?? "Manufacturer not entered"} ${asset.model ?? ""}`.trim() },
            { key: "context", value: storeLabel(storeById.get(asset.storeId)), secondary: `${sentence(asset.categoryKey)} · ${asset.groupPath.join(" › ")}` },
          ],
        }))
    : [];

  const groups = q
    ? [
        { id: "stores", label: "Stores", rows: storeRows(fixture, scoped, { q }) },
        { id: "work", label: "Work orders", rows: workRows(fixture, scoped, { q }) },
        { id: "vendors", label: "Vendors", rows: vendorRows(fixture, scoped, { q }) },
        { id: "equipment", label: "Equipment", rows: equipmentRows },
        ...(session.role === "finance" ? [] : [
          { id: "visits", label: "Service visits", rows: visitRows(fixture, scoped, { q }) },
          {
            id: "requests",
            label: "Requests",
            rows: fixture.requests
              .filter((request) => request.organizationId === scoped.organizationId && scoped.storeIds.has(request.storeId))
              .filter((request) => searchable(request.reference, request.problem, request.reporterName, storeLabel(storeById.get(request.storeId))).includes(q))
              .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
              .map<TableRowViewModel>((request) => ({
                id: request.id,
                label: request.reference,
                href: `/app/requests/${request.id}`,
                cells: [
                  { key: "result", value: request.reference, secondary: request.problem },
                  { key: "context", value: storeLabel(storeById.get(request.storeId)), secondary: request.reporterName },
                ],
              })),
          },
        ]),
      ].map((group) => ({ ...group, resultCount: group.rows.length, rows: group.rows.slice(0, 8) }))
        .filter((group) => group.resultCount > 0)
    : [];
  const total = groups.reduce((sum, group) => sum + group.resultCount, 0);

  return {
    state: !q
      ? { kind: "empty", title: "Search the whole operation", message: "Try a store number, address, work order, vendor specialty, equipment tag, serial number, technician, or request." }
      : total
        ? { kind: "ready" }
        : { kind: "empty", title: "No matches found", message: `Nothing in your access scope matched “${first(query.q)?.trim()}”. Try a shorter name, number, address, or equipment term.` },
    page: {
      title: q ? `Search results for “${first(query.q)?.trim()}”` : "Search TraceOps",
      eyebrow: "One search · Your full scope",
      description: "Find a store, work order, request, vendor, service visit, or piece of equipment without deciding which module to open first.",
      scopeLabel: session.scopeLabel,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
    },
    query: first(query.q)?.trim() ?? "",
    resultSummary: `${total} match${total === 1 ? "" : "es"} across ${groups.length} record type${groups.length === 1 ? "" : "s"}`,
    groups,
  };
}

function categoryCostMap(scoped: ScopedFixture, costByWork: Map<string, number>): Map<string, number> {
  const result = new Map<string, number>();
  for (const work of scoped.workOrders) {
    const key = work.categoryKey ?? "unclassified";
    result.set(key, (result.get(key) ?? 0) + (costByWork.get(work.id) ?? 0));
  }
  return result;
}

export function buildProgramModel(
  fixture: OpsFixture,
  session: OperatorSession,
  route: OperatorProgramRoute,
  query: OperatorSearchParameters = {},
): ProgramPageViewModel {
  const selectedRegionId = first(query.region);
  const selectedStoreId = first(query.store);
  const regionalScope = narrowScopeToRegion(scopeFixture(fixture, session), selectedRegionId);
  const scoped = narrowScopeToStore(regionalScope, selectedStoreId);
  const selectedRegion = selectedRegionId
    ? fixture.regions.find((region) => region.organizationId === session.organizationId && region.id === selectedRegionId)
    : undefined;
  const selectedStore = selectedStoreId ? scoped.stores.find((store) => store.id === selectedStoreId) : undefined;
  const activeScopeLabel = selectedStore
    ? storeLabel(selectedStore)
    : selectedRegion
      ? `${selectedRegion.name} · ${scoped.stores.length} stores`
      : session.scopeLabel;
  const costByWork = recordedCostByWork(fixture, scoped.organizationId);
  const allActions = actions(fixture, scoped, 6);

  if (route === "spend") {
    const periodStart = rollingYearStart(fixture.asOf);
    const rollingCostByWork = recordedCostByWork(fixture, scoped.organizationId, periodStart);
    const selectedCategory = first(query.category);
    const selectedPath = pathSegments(first(query.path));
    const selectedAssetId = first(query.asset);
    const selectedComponentId = first(query.component);
    const assetById = new Map(scoped.assets.map((asset) => [asset.id, asset]));
    const selectedAsset = selectedAssetId && selectedAssetId !== "unlinked" ? assetById.get(selectedAssetId) : undefined;
    const componentById = new Map(
      fixture.components
        .filter((component) => component.organizationId === scoped.organizationId)
        .map((component) => [component.id, component]),
    );
    const selectedComponent = selectedComponentId && selectedComponentId !== "unlinked"
      ? componentById.get(selectedComponentId)
      : undefined;
    const spendWork = scoped.workOrders
      .filter((work) => !selectedCategory || (work.categoryKey ?? "unclassified") === selectedCategory)
      .filter((work) => !selectedAssetId || (selectedAssetId === "unlinked" ? !work.assetId : work.assetId === selectedAssetId))
      .filter((work) => !selectedComponentId || (selectedComponentId === "unlinked" ? !work.componentId : work.componentId === selectedComponentId))
      .filter((work) => selectedPath.length === 0 || assetMatchesPath(work.assetId ? assetById.get(work.assetId) : undefined, selectedPath));
    const spendScope: ScopedFixture = { ...scoped, workOrders: spendWork };
    const scopedWorkIds = new Set(spendWork.map((work) => work.id));
    const sourceLines = fixture.costLines.filter(
      (line) =>
        line.organizationId === scoped.organizationId &&
        scopedWorkIds.has(line.workOrderId) &&
        line.serviceDate >= periodStart,
    );
    const total = costForWorkIds(rollingCostByWork, spendWork.map((work) => work.id));
    const storeCost = new Map<string, number>();
    for (const store of scoped.stores) {
      storeCost.set(
        store.id,
        costForWorkIds(rollingCostByWork, spendWork.filter((work) => work.storeId === store.id).map((work) => work.id)),
      );
    }
    const ranked = [...storeCost.values()].sort((a, b) => b - a);
    const median = ranked.length ? ranked[Math.floor(ranked.length / 2)] : 0;
    const unclassified = spendWork.filter((work) => {
      if ((rollingCostByWork.get(work.id) ?? 0) <= 0) return false;
      if (!selectedCategory) return !work.categoryKey;
      if (!work.assetId) return true;
      if (selectedAssetId && !work.componentId) return true;
      return false;
    });
    const invoiceIds = new Set(
      fixture.invoiceAllocations
        .filter(
          (allocation) =>
            allocation.organizationId === scoped.organizationId &&
            scopedWorkIds.has(allocation.workOrderId),
        )
        .map((allocation) => allocation.invoiceReferenceId),
    );
    const invoiceCount = fixture.invoiceReferences.filter(
      (invoice) =>
        invoice.organizationId === scoped.organizationId &&
        invoiceIds.has(invoice.id) &&
        invoice.invoiceDate >= periodStart,
    ).length;
    const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
    const equipmentCost = new Map<string, number>();
    for (const work of spendWork) {
      const key = work.assetId ?? "unlinked";
      equipmentCost.set(key, (equipmentCost.get(key) ?? 0) + (rollingCostByWork.get(work.id) ?? 0));
    }
    const workLink = (extra: Record<string, string | undefined>) => hrefWithQuery("/app/work-orders", {
      region: selectedRegionId,
      store: selectedStoreId,
      category: selectedCategory,
      path: selectedPath.length ? selectedPath.join("|") : undefined,
      asset: selectedAssetId,
      component: selectedComponentId,
      costFrom: periodStart,
      ...extra,
    });
    const comparisonMetric: MetricViewModel = selectedStoreId
      ? {
          id: "cost-bearing-work",
          label: "Cost-bearing work",
          value: String([...rollingCostByWork.keys()].filter((workId) => scopedWorkIds.has(workId)).length),
          supportingText: "Work orders with entered cost in this scope and period",
          link: { href: workLink({ hasCost: "true" }), label: "Open source work" },
        }
      : {
          id: "median",
          label: "Median store cost",
          value: money(median),
          supportingText: "Useful comparison; not a budget target",
          link: { href: "/app/stores?sort=cost", label: "Compare stores" },
        };

    const spendHref = (overrides: Record<string, string | undefined> = {}) => hrefWithQuery("/app/spend", {
      region: selectedRegionId,
      store: selectedStoreId,
      category: selectedCategory,
      path: selectedPath.length ? selectedPath.join("|") : undefined,
      asset: selectedAssetId,
      component: selectedComponentId,
      ...overrides,
    });
    const hierarchyParts = [
      selectedCategory ? sentence(selectedCategory) : undefined,
      ...selectedPath.slice(selectedPath[0]?.toLocaleLowerCase("en-US") === (selectedCategory ? sentence(selectedCategory).toLocaleLowerCase("en-US") : undefined) ? 1 : 0),
      selectedAsset?.name,
      selectedComponent?.name,
    ].filter(Boolean);
    const hierarchyLabel = hierarchyParts.length ? hierarchyParts.join(" › ") : "All service areas";
    const upHref = selectedComponentId
      ? spendHref({ component: undefined })
      : selectedAssetId
        ? spendHref({ asset: undefined })
        : selectedPath.length
          ? spendHref({ path: selectedPath.length > 2 ? selectedPath.slice(0, -1).join("|") : undefined })
          : selectedCategory
            ? spendHref({ category: undefined })
            : selectedStoreId
              ? spendHref({ store: undefined })
              : selectedRegionId
                ? spendHref({ region: undefined })
                : undefined;

    let hierarchyBreakdown: BreakdownViewModel;
    if (selectedComponentId) {
      const kindCost = new Map<string, number>();
      for (const line of sourceLines) kindCost.set(line.kind, (kindCost.get(line.kind) ?? 0) + line.amount.amountMinor);
      hierarchyBreakdown = costBreakdown(
        "Recorded cost by source type",
        kindCost,
        () => workLink({ hasCost: "true" }),
        { description: "This is the deepest configured component level. Open the source work orders for every entered cost line.", sourceHref: workLink({ hasCost: "true" }) },
      );
    } else if (selectedAssetId) {
      const componentCost = new Map<string, number>();
      for (const work of spendWork) {
        const key = work.componentId ?? "unlinked";
        componentCost.set(key, (componentCost.get(key) ?? 0) + (rollingCostByWork.get(work.id) ?? 0));
      }
      hierarchyBreakdown = costBreakdown(
        "Recorded cost by component",
        componentCost,
        (key) => key === "unlinked" ? workLink({ component: "unlinked", hasCost: "true" }) : spendHref({ component: key }),
        {
          description: "Component depth is optional. Cost that stops at the equipment record remains visible.",
          labelFor: (key) => key === "unlinked" ? "Not classified to a component" : componentById.get(key)?.name ?? "Unknown component",
          sourceHref: workLink({ hasCost: "true" }),
        },
      );
    } else if (selectedCategory) {
      const nextValues = new Map<string, number>();
      const nextKind = new Map<string, "path" | "asset" | "source">();
      const categoryRoot = selectedPath.length === 0;
      for (const work of spendWork) {
        const amount = rollingCostByWork.get(work.id) ?? 0;
        const asset = work.assetId ? assetById.get(work.assetId) : undefined;
        if (!asset) {
          nextValues.set("unlinked", (nextValues.get("unlinked") ?? 0) + amount);
          nextKind.set("unlinked", "source");
          continue;
        }
        const fullPath = assetHierarchyPath(asset);
        const currentPath = categoryRoot ? [fullPath[0]] : selectedPath;
        const nextSegment = fullPath[currentPath.length];
        if (nextSegment) {
          const nextPath = [...currentPath, nextSegment].join("|");
          nextValues.set(nextPath, (nextValues.get(nextPath) ?? 0) + amount);
          nextKind.set(nextPath, "path");
        } else {
          nextValues.set(asset.id, (nextValues.get(asset.id) ?? 0) + amount);
          nextKind.set(asset.id, "asset");
        }
      }
      hierarchyBreakdown = costBreakdown(
        categoryRoot ? `Where ${sentence(selectedCategory)} cost sits` : `Cost below ${selectedPath.at(-1)}`,
        nextValues,
        (key) => nextKind.get(key) === "path"
          ? spendHref({ path: key })
          : nextKind.get(key) === "asset"
            ? spendHref({ asset: key })
            : workLink({ asset: "unlinked", hasCost: "true" }),
        {
          description: "Open each level until you reach a specific equipment record. Unclassified cost never disappears.",
          labelFor: (key) => key === "unlinked" ? "Unclassified below this level" : nextKind.get(key) === "asset" ? assetById.get(key)?.name ?? "Unknown equipment" : key.split("|").at(-1) ?? key,
          sourceHref: workLink({ hasCost: "true" }),
        },
      );
    } else {
      hierarchyBreakdown = costBreakdown(
        "Recorded cost by service area",
        categoryCostMap(spendScope, rollingCostByWork),
        (key) => key === "unclassified" ? workLink({ category: "unclassified", hasCost: "true" }) : spendHref({ category: key }),
        { description: "Choose a service area to continue through organization-defined groups, equipment, and optional components.", sourceHref: workLink({ hasCost: "true" }) },
      );
    }

    const regionOptions = fixture.regions
      .filter((region) => region.organizationId === scoped.organizationId && scopeFixture(fixture, session).stores.some((store) => store.regionId === region.id))
      .map((region) => ({ value: region.id, label: region.name, href: hrefWithQuery("/app/spend", { region: region.id, category: selectedCategory }), selected: region.id === selectedRegionId }));
    const categoryOptions = [...new Set(scopeFixture(fixture, session).workOrders.map((work) => work.categoryKey).filter((value): value is string => Boolean(value)))]
      .sort()
      .map((category) => ({ value: category, label: sentence(category), href: hrefWithQuery("/app/spend", { region: selectedRegionId, store: selectedStoreId, category }), selected: category === selectedCategory }));
    const filters = [
      {
        id: "region",
        label: "Region",
        options: [
          { value: "all", label: "All regions", href: hrefWithQuery("/app/spend", { category: selectedCategory }), selected: !selectedRegionId },
          ...regionOptions,
        ],
      },
      {
        id: "category",
        label: "Service area",
        options: [
          { value: "all", label: "All service areas", href: hrefWithQuery("/app/spend", { region: selectedRegionId, store: selectedStoreId }), selected: !selectedCategory },
          ...categoryOptions,
        ],
      },
    ];
    return {
      state: { kind: "ready" },
      page: { title: selectedComponent?.name ?? selectedAsset?.name ?? selectedPath.at(-1) ?? (selectedCategory ? sentence(selectedCategory) : "Maintenance spend"), eyebrow: "Recorded cost visibility", description: "Move from company to region, store, service area, flexible equipment groups, equipment, component, work order, and source cost without changing the selected basis.", scopeLabel: `${activeScopeLabel} · ${hierarchyLabel}`, periodLabel: `Rolling 12 months from ${date(periodStart)}`, updatedLabel: `Through ${date(fixture.asOf)}`, secondaryAction: upHref ? { label: "Up one level", href: upHref } : undefined },
      filters,
      metrics: [
        { id: "total", label: "Recorded work cost", value: money(total), supportingText: `${sourceLines.length} entered source lines`, link: { href: workLink({ hasCost: "true" }), label: "Open source work" } },
        comparisonMetric,
        { id: "unclassified", label: selectedAssetId ? "Not mapped to a component" : selectedCategory ? "Not mapped to equipment" : "Unclassified service area", value: String(unclassified.length), supportingText: "Visible rather than forced into a guess", tone: unclassified.length ? "warning" : "positive", link: { href: selectedAssetId ? workLink({ component: "unlinked", hasCost: "true" }) : selectedCategory ? workLink({ asset: "unlinked", hasCost: "true" }) : workLink({ category: "unclassified", hasCost: "true" }), label: "Open source work" } },
        { id: "invoices", label: "Linked invoice references", value: String(invoiceCount), supportingText: "Optional billing safeguard; not required for cost visibility", link: { href: hrefWithQuery("/app/invoices", { region: selectedRegionId, store: selectedStoreId, category: selectedCategory, from: periodStart }), label: "Review invoice references" } },
      ],
      breakdowns: [
        hierarchyBreakdown,
        selectedStoreId
          ? costBreakdown(
              "Recorded cost by equipment",
              equipmentCost,
              (key) => key === "unlinked" ? workLink({ asset: "unlinked", hasCost: "true" }) : spendHref({ asset: key }),
              {
                labelFor: (key) => key === "unlinked" ? "Not linked to equipment" : assetById.get(key)?.name ?? "Unknown equipment",
                sourceHref: workLink({ hasCost: "true" }),
              },
            )
          : costBreakdown(
              "Recorded cost by store",
              storeCost,
              (key) => spendHref({ region: undefined, store: key }),
              {
                labelFor: (key) => {
                  const store = storeById.get(key);
                  return store ? `Store ${store.storeNumber}` : "Unknown store";
                },
                sourceHref: workLink({ hasCost: "true" }),
              },
            ),
      ],
      trends: [costTrend(fixture, spendScope, rollingCostByWork, { storeId: selectedStoreId, periodStart, query: { region: selectedRegionId, category: selectedCategory, path: selectedPath.length ? selectedPath.join("|") : undefined, asset: selectedAssetId, component: selectedComponentId } })],
      priorityActions: allActions,
      table: { id: "spend-work", caption: "Work orders with recorded cost in this scope and period", columns: columns["work-orders"], rows: workRows(fixture, spendScope, { ...query, hasCost: "true", costFrom: periodStart }).slice(0, 12) },
    };
  }

  if (route === "equipment") {
    const categoryCounts = new Map<string, number>();
    for (const asset of scoped.assets) categoryCounts.set(asset.categoryKey, (categoryCounts.get(asset.categoryKey) ?? 0) + 1);
    const statusCounts = new Map<string, number>();
    for (const asset of scoped.assets) statusCounts.set(asset.status, (statusCounts.get(asset.status) ?? 0) + 1);
    const categoryFilter = first(query.category);
    const statusFilter = first(query.status);
    const rows = scoped.assets.filter((asset) => !categoryFilter || asset.categoryKey === categoryFilter).filter((asset) => !statusFilter || asset.status === statusFilter).map<TableRowViewModel>((asset) => {
      const store = scoped.stores.find((item) => item.id === asset.storeId);
      const linkedWork = scoped.workOrders.filter((work) => work.assetId === asset.id);
      return { id: asset.id, label: asset.name, href: `/app/equipment/${asset.id}`, cells: [
        { key: "asset", value: asset.name, secondary: asset.assetTag },
        { key: "store", value: storeLabel(store) },
        { key: "category", value: sentence(asset.categoryKey), secondary: asset.groupPath.join(" › ") },
        { key: "identity", value: asset.model ?? "Model not entered", secondary: asset.serialNumber ? `S/N ${asset.serialNumber}` : "Serial not entered" },
        { key: "work", value: String(linkedWork.length) },
        { key: "status", value: sentence(asset.status), tone: asset.status === "watch" ? "warning" : asset.status === "operational" ? "positive" : "critical" },
      ] };
    });
    return {
      state: { kind: "ready" },
      page: { title: "Equipment", eyebrow: "Service history", description: "Installed equipment, components, warranties, linked work, and cost—without making asset selection a prerequisite for service.", scopeLabel: activeScopeLabel, updatedLabel: `Through ${date(fixture.asOf)}` },
      metrics: [
        { id: "assets", label: "Tracked equipment", value: String(scoped.assets.length), supportingText: "Across the selected stores", link: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId }), label: "View equipment" } },
        { id: "watch", label: "Marked for review", value: String(scoped.assets.filter((asset) => asset.status === "watch").length), supportingText: "Human review, not an opaque score", tone: "warning", link: roleCanAccessProgramRoute(session.role, "lifecycle") ? { href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, status: "watch" }), label: "Review lifecycle evidence" } : { href: hrefWithQuery("/app/equipment", { store: selectedStoreId, status: "watch" }), label: "Review equipment" } },
        { id: "components", label: "Tracked components", value: String(fixture.components.filter((component) => component.organizationId === scoped.organizationId && scoped.assets.some((asset) => asset.id === component.assetId)).length), supportingText: "Optional depth below the asset", link: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId }), label: "View component coverage" } },
        { id: "unlinked", label: "Work awaiting asset", value: String(scoped.workOrders.filter((work) => !work.assetId).length), supportingText: "Deferred classification stays visible", tone: "info", link: { href: hrefWithQuery("/app/work-orders", { asset: "unlinked", store: selectedStoreId }), label: "Open unlinked work" } },
      ],
      breakdowns: [
        { id: "equipment-category", title: "Equipment by service area", totalLabel: `${scoped.assets.length} assets`, segments: [...categoryCounts.entries()].map(([key, value]) => ({ id: key, label: sentence(key), value, formattedValue: String(value), link: { href: hrefWithQuery("/app/equipment", { category: key, store: selectedStoreId }), label: "Filter equipment" } })), sourceLink: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId }), label: "Open equipment list" } },
        { id: "equipment-status", title: "Equipment status", totalLabel: `${scoped.assets.length} assets`, segments: [...statusCounts.entries()].map(([key, value]) => ({ id: key, label: sentence(key), value, formattedValue: String(value), tone: key === "watch" ? "warning" : key === "operational" ? "positive" : "critical", link: { href: hrefWithQuery("/app/equipment", { status: key, store: selectedStoreId }), label: "Filter equipment" } })), sourceLink: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId }), label: "Open equipment list" } },
      ],
      trends: [],
      priorityActions: allActions,
      table: { id: "equipment", caption: "Tracked equipment", columns: [{ key: "asset", label: "Equipment" }, { key: "store", label: "Store" }, { key: "category", label: "Service area" }, { key: "identity", label: "Model / serial" }, { key: "work", label: "Linked work", align: "end" }, { key: "status", label: "Status" }], rows },
    };
  }

  if (route === "pm") {
    const occurrences = fixture.pmOccurrences.filter((item) => item.organizationId === scoped.organizationId && scoped.storeIds.has(item.storeId));
    const statusFilter = first(query.status);
    const occurrenceFilter = first(query.occurrence);
    const occurrenceStates = occurrences.map((occurrence) => ({
      occurrence,
      status: effectivePmStatus(occurrence, fixture.asOf),
    }));
    const visible = occurrenceStates
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter((item) => !occurrenceFilter || item.occurrence.id === occurrenceFilter);
    const statusCounts = new Map<string, number>();
    for (const item of occurrenceStates) statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
    const closedWindow = occurrenceStates.filter(
      (item) => Date.parse(item.occurrence.windowEndsAt) < Date.parse(fixture.asOf) && item.status !== "waived",
    );
    const completed = closedWindow.filter((item) => item.status === "completed").length;
    const eligible = closedWindow.length;
    const rows = visible.sort((a, b) => a.occurrence.dueAt.localeCompare(b.occurrence.dueAt)).map<TableRowViewModel>(({ occurrence, status }) => {
      const plan = fixture.pmPlans.find((item) => item.id === occurrence.planId && item.organizationId === scoped.organizationId);
      const store = scoped.stores.find((item) => item.id === occurrence.storeId);
      const asset = scoped.assets.find((item) => item.id === occurrence.assetId);
      return { id: occurrence.id, label: plan?.name ?? "PM occurrence", href: occurrence.workOrderId ? `/app/work-orders/${occurrence.workOrderId}` : asset ? `/app/equipment/${asset.id}#preventive-maintenance` : hrefWithQuery("/app/pm", { status, store: occurrence.storeId }), cells: [
        { key: "plan", value: plan?.name ?? "PM plan", secondary: asset?.name ?? (plan?.categoryKey ? sentence(plan.categoryKey) : "Store-level plan") },
        { key: "store", value: storeLabel(store) },
        { key: "window", value: `${date(occurrence.windowStartsAt)} – ${date(occurrence.windowEndsAt)}`, secondary: `Due ${date(occurrence.dueAt)}` },
        { key: "work", value: occurrence.workOrderId ? scoped.workOrders.find((work) => work.id === occurrence.workOrderId)?.number ?? "Linked" : "Not created" },
        { key: "status", value: sentence(status), tone: status === "completed" ? "positive" : status === "missed" ? "critical" : status === "due" ? "warning" : "info" },
      ] };
    });
    const metric = (key: string, label: string, tone: Tone): MetricViewModel => ({ id: key, label, value: String(statusCounts.get(key) ?? 0), supportingText: "Select to filter the occurrence list", tone, link: { href: hrefWithQuery("/app/pm", { status: key, store: selectedStoreId }), label: `Show ${label.toLocaleLowerCase("en-US")}` } });
    return {
      state: { kind: "ready" },
      page: { title: "Preventive maintenance", eyebrow: "Planned work", description: "Due, scheduled, completed, missed, and waived occurrences with the exact compliance numerator and denominator.", scopeLabel: activeScopeLabel, periodLabel: "Current PM window", updatedLabel: `Through ${date(fixture.asOf)}` },
      metrics: [metric("due", "Due", "warning"), metric("scheduled", "Scheduled", "info"), metric("completed", "Completed", "positive"), metric("missed", "Missed", "critical")],
      breakdowns: [{ id: "pm-status", title: "PM occurrence status", description: `Closed-window compliance: ${completed} completed / ${eligible} eligible occurrences = ${eligible ? Math.round((completed / eligible) * 100) : 0}%. Work still inside its completion window is excluded.`, totalLabel: `${occurrences.length} occurrences`, segments: [...statusCounts.entries()].map(([key, value]) => ({ id: key, label: sentence(key), value, formattedValue: String(value), tone: key === "completed" ? "positive" : key === "missed" ? "critical" : key === "due" ? "warning" : "info", link: { href: hrefWithQuery("/app/pm", { status: key, store: selectedStoreId }), label: "Filter occurrences" } })), sourceLink: { href: hrefWithQuery("/app/pm", { store: selectedStoreId }), label: "Open all source occurrences" } }],
      trends: [],
      priorityActions: allActions,
      table: { id: "pm-occurrences", caption: "Preventive-maintenance occurrences", columns: [{ key: "plan", label: "Plan / equipment" }, { key: "store", label: "Store" }, { key: "window", label: "Completion window" }, { key: "work", label: "Work order" }, { key: "status", label: "Status" }], rows },
    };
  }

  const lifecycle = lifecycleRows(fixture, scoped, costByWork);
  const selectedAsset = first(query.asset);
  const requestedReason = first(query.reason);
  const requestedReplacementYear = first(query.replacementYear);
  const requestedReplacement = first(query.replacement);
  const requestedAssetStatus = first(query.status);
  const candidates = lifecycle
    .filter((row) => !selectedAsset || row.asset.id === selectedAsset)
    .filter((row) => !requestedAssetStatus || row.asset.status === requestedAssetStatus)
    .filter((row) => !requestedReplacement || (requestedReplacement === "entered" && row.replacement !== undefined))
    .filter((row) => !requestedReplacementYear || String(row.expectedReplacementYear) === requestedReplacementYear)
    .filter((row) => !requestedReason ||
      (["repair review", "compare alternatives"].includes(requestedReason) && row.screening.state === "compare_alternatives") ||
      (requestedReason === "not flagged" && row.screening.state === "below_economic_review") ||
      (requestedReason === "small repair" && row.screening.state === "below_materiality") ||
      (requestedReason === "missing inputs" && row.screening.state === "incomplete") ||
      (requestedReason === "historical context" && row.contextFacts.length > 0));
  const replacementTotal = candidates.reduce((sum, row) => sum + (row.replacement ?? 0), 0);
  const reasonCounts = new Map<string, number>();
  for (const row of candidates) {
    const key = row.screening.state === "compare_alternatives"
      ? "compare alternatives"
      : row.screening.state === "below_economic_review"
        ? "not flagged"
        : row.screening.state === "below_materiality"
          ? "small repair"
          : "missing inputs";
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const rows = candidates.map<TableRowViewModel>((row) => ({
    id: row.asset.id,
    label: row.asset.name,
    href: `/app/equipment/${row.asset.id}`,
    cells: [
      { key: "asset", value: row.asset.name, secondary: row.asset.assetTag },
      { key: "store", value: storeLabel(scoped.stores.find((store) => store.id === row.asset.storeId)) },
      {
        key: "evidence",
        value: lifecycleComparisonLabel(row.screening),
        secondary: row.screening.state === "incomplete"
          ? `Needed: ${row.screening.dataGaps.map(lifecycleGapLabel).join(", ")}`
          : lifecycleComparisonExplanation(row.screening),
      },
      {
        key: "work",
        value: row.proposalWork
          ? `${row.proposalWork.number}: ${money(row.screening.comparison.repairEstimateMinor ?? 0)}`
          : "No current repair estimate",
        secondary: row.screening.comparison.comparisonHorizonYears
          ? `${row.screening.comparison.comparisonHorizonYears} ${row.screening.comparison.comparisonHorizonYears === 1 ? "year" : "years"} of expected service · ${Math.round((row.screening.comparison.repairToReplacementRatio ?? 0) * 100)}% of replacement estimate`
          : "Enter expected service from the repair for a same-horizon comparison",
      },
      { key: "replacement", value: row.replacement ? money(row.replacement) : "Not entered" },
      {
        key: "status",
        value: lifecycleComparisonLabel(row.screening),
        tone: row.screening.state === "compare_alternatives" ? "warning" : row.screening.state === "incomplete" ? "info" : "positive",
      },
    ],
  }));
  return {
    state: { kind: "ready" },
    page: { title: "Lifecycle & CapEx", eyebrow: "Repair decisions and capital planning", description: "See age against expected life, compare a current repair with replacement over the same expected-service period, and look ahead to likely capital needs. Small bridge repairs are not treated as replacement signals, and TraceOps never makes the decision for you.", scopeLabel: activeScopeLabel, updatedLabel: `Through ${date(fixture.asOf)}` },
    metrics: [
      { id: "review", label: "Repairs to compare", value: String(lifecycle.filter((row) => row.screening.state === "compare_alternatives").length), supportingText: "Material current repairs worth comparing with replacement", tone: "warning", link: { href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, reason: "compare alternatives" }), label: "Open repair comparisons" } },
      { id: "replacement", label: "Entered replacement estimates", value: money(replacementTotal), supportingText: "Planning input, not an approved budget", link: { href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId }), label: "Review estimates" } },
      { id: "work-cost", label: "Historical recorded cost", value: money(candidates.reduce((sum, row) => sum + row.workCost, 0)), supportingText: "Context only; never added to the current repair estimate", link: { href: hrefWithQuery("/app/work-orders", { hasCost: "true", store: selectedStoreId }), label: "Open cost sources" } },
      { id: "coverage", label: "Comparison inputs complete", value: `${lifecycle.filter((row) => row.screening.state !== "incomplete").length}/${lifecycle.length}`, supportingText: "Current repair, replacement, and expected-service inputs", tone: "info", link: { href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, reason: "missing inputs" }), label: "Review missing inputs" } },
    ],
    breakdowns: [{ id: "lifecycle-reasons", title: "Current repair screening", description: "A repair must first be meaningful in dollars and as a share of replacement. Only then is it compared over the same expected-service period.", totalLabel: `${candidates.length} assets`, segments: [...reasonCounts.entries()].map(([key, value]) => ({ id: key, label: sentence(key), value, formattedValue: String(value), link: { href: hrefWithQuery("/app/lifecycle", { reason: key, store: selectedStoreId }), label: "Filter equipment" } })), sourceLink: { href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId }), label: "Open all lifecycle evidence" } }],
    trends: [{
      id: "capex-horizon",
      title: "Entered replacement estimates by expected-life year",
      description: "A planning horizon based on entered installation date, expected life, and replacement estimate—not an approved budget or automatic replacement decision.",
      points: [...lifecycle.reduce((years, row) => {
        if (row.expectedReplacementYear && row.replacement) years.set(String(row.expectedReplacementYear), (years.get(String(row.expectedReplacementYear)) ?? 0) + row.replacement);
        return years;
      }, new Map<string, number>()).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => ({ id: year, label: year, value, formattedValue: money(value), link: { href: hrefWithQuery("/app/lifecycle", { replacementYear: year, store: selectedStoreId }), label: `Review ${year} evidence` } })),
      sourceLink: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId }), label: "Review entered life and replacement fields" },
    }],
    priorityActions: allActions,
    table: { id: "lifecycle", caption: "Equipment lifecycle evidence", columns: [{ key: "asset", label: "Equipment" }, { key: "store", label: "Store" }, { key: "evidence", label: "Comparison basis" }, { key: "work", label: "Current repair" }, { key: "replacement", label: "Installed replacement estimate", align: "end" }, { key: "status", label: "Screening" }], rows },
  };
}

export function buildDetailModel(
  fixture: OpsFixture,
  session: OperatorSession,
  route: OperatorDetailRoute,
  id: string,
): DetailPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const costByWork = recordedCostByWork(fixture, scoped.organizationId);

  if (route === "request") {
    const request = fixture.requests.find(
      (item) =>
        item.id === id &&
        item.organizationId === scoped.organizationId &&
        scoped.storeIds.has(item.storeId),
    );
    if (!request) return missingDetail("Request", "/app/requests");
    const store = scoped.stores.find((item) => item.id === request.storeId);
    const convertedWork = request.convertedWorkOrderId
      ? scoped.workOrders.find((work) => work.id === request.convertedWorkOrderId)
      : undefined;
    const canConvert = roleCan(session.role, "create_work_order");
    const audit = fixture.auditEvents
      .filter(
        (event) =>
          event.organizationId === scoped.organizationId &&
          (event.aggregateId === request.id || event.aggregateId === convertedWork?.id),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const linkedFiles = fixture.entityFiles.filter(
      (link) =>
        link.organizationId === scoped.organizationId &&
        link.entityType === "request" &&
        link.entityId === request.id,
    );
    return {
      state: { kind: "ready" },
      page: {
        title: request.reference,
        eyebrow: "Store issue / preserved source report",
        description: request.problem,
        scopeLabel: storeLabel(store),
        primaryAction: convertedWork
          ? { label: `Open ${convertedWork.number}`, href: `/app/work-orders/${convertedWork.id}` }
          : canConvert
            ? { label: "Approve & create work order", href: `/app/work-orders/new?request=${request.id}` }
            : undefined,
        secondaryAction: store ? { label: "Open store", href: `/app/stores/${store.id}` } : undefined,
      },
      statusLabel: sentence(request.status),
      statusTone: request.status === "converted" ? "positive" : request.priority === "emergency" ? "critical" : request.priority === "urgent" ? "warning" : "info",
      facts: [
        { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
        { label: "Reported by", value: request.reporterName, helperText: request.reporterEmployeeId ? `Employee ID ${request.reporterEmployeeId}` : "Employee ID not entered" },
        { label: "Reported", value: dateTime(request.submittedAt) },
        { label: "Priority", value: sentence(request.priority) },
        { label: "Work order", value: convertedWork?.number ?? "Not created", link: convertedWork ? { href: `/app/work-orders/${convertedWork.id}`, label: "Open work order" } : undefined },
        { label: "Attached evidence", value: String(linkedFiles.length), helperText: "Original evidence remains tied to this report" },
      ],
      sections: [
        {
          id: "source-report",
          title: "Original store report",
          description: "This text remains preserved after classification, approval, and work-order creation.",
          facts: [
            { label: "Observed problem", value: request.problem },
            { label: "Review state", value: convertedWork ? `Converted to ${convertedWork.number}` : canConvert ? "Ready for facilities review" : "Awaiting facilities review" },
          ],
          action: !convertedWork && canConvert ? { label: "Create the accountable work record", href: `/app/work-orders/new?request=${request.id}` } : undefined,
        },
        {
          id: "decision-path",
          title: "What happens next",
          description: convertedWork
            ? "The source report is linked to the canonical work order; vendor routing, visits, outcomes, cost, and follow-up continue there."
            : "Review the observable facts, then create the work order only when action is authorized. Equipment may remain deferred.",
          facts: [
            { label: "Deletion", value: "Not available", helperText: "Corrections are additive so reported issues cannot be quietly erased" },
            { label: "Equipment", value: "Optional at intake", helperText: "Link it now or after diagnosis" },
            { label: "Outside dispatch", value: "Begins only after a versioned authorization is issued" },
          ],
        },
        {
          id: "timeline",
          title: "Audit timeline",
          timeline: audit.map((event) => ({
            id: event.id,
            title: sentence(event.eventType.replaceAll(".", " ")),
            timestampLabel: dateTime(event.occurredAt),
            actorLabel: event.actorName,
          })),
        },
      ],
      backLink: { label: "Back to requests", href: "/app/requests" },
    };
  }

  if (route === "equipment") {
    const asset = scoped.assets.find((item) => item.id === id);
    if (!asset) return missingDetail("Equipment", "/app/equipment");
    const store = scoped.stores.find((item) => item.id === asset.storeId);
    const assetWork = scoped.workOrders.filter((work) => work.assetId === asset.id);
    const assetWorkIds = new Set(assetWork.map((work) => work.id));
    const assetVisits = scoped.visits.filter((visit) => Boolean(visit.workOrderId && assetWorkIds.has(visit.workOrderId)));
    const components = fixture.components.filter(
      (component) => component.organizationId === scoped.organizationId && component.assetId === asset.id,
    );
    const componentById = new Map(components.map((component) => [component.id, component]));
    const pmOccurrences = fixture.pmOccurrences
      .filter(
        (occurrence) =>
          occurrence.organizationId === scoped.organizationId &&
          occurrence.assetId === asset.id,
      )
      .sort((a, b) => b.dueAt.localeCompare(a.dueAt));
    const lifecycle = lifecycleRows(fixture, scoped, costByWork).find((row) => row.asset.id === asset.id);
    const expectedReplacementYear = asset.installedAt && asset.expectedLifeYears
      ? new Date(asset.installedAt).getUTCFullYear() + asset.expectedLifeYears
      : undefined;
    const canCreateWork = roleCan(session.role, "create_work_order");
    return {
      state: { kind: "ready" },
      page: {
        title: asset.name,
        eyebrow: `${sentence(asset.categoryKey)} / ${asset.groupPath.join(" / ")}`,
        description: `${asset.assetTag} at ${storeLabel(store)}. Identity, components, service history, PM, cost, warranty, and replacement inputs stay connected here.`,
        scopeLabel: storeLabel(store),
        primaryAction: canCreateWork
          ? { label: "Create work order", href: hrefWithQuery("/app/work-orders/new", { store: asset.storeId, asset: asset.id }) }
          : undefined,
        secondaryAction: roleCanAccessProgramRoute(session.role, "lifecycle")
          ? { label: "Review lifecycle evidence", href: hrefWithQuery("/app/lifecycle", { store: asset.storeId, asset: asset.id }) }
          : undefined,
      },
      statusLabel: sentence(asset.status),
      statusTone: asset.status === "operational" ? "positive" : asset.status === "watch" ? "warning" : "critical",
      facts: [
        { label: "Asset tag", value: asset.assetTag },
        { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
        { label: "Manufacturer / model", value: [asset.manufacturer, asset.model].filter(Boolean).join(" / ") || "Not entered" },
        { label: "Serial number", value: asset.serialNumber ?? "Not entered" },
        { label: "Installed", value: date(asset.installedAt), helperText: asset.expectedLifeYears ? `${asset.expectedLifeYears}-year expected-life planning reference; not an expiration date` : "Expected-life reference not entered" },
        { label: "Warranty", value: asset.warrantyEndsAt ? date(asset.warrantyEndsAt) : "Not entered", helperText: asset.warrantyEndsAt && Date.parse(asset.warrantyEndsAt) < Date.parse(fixture.asOf) ? "Expired as of this view" : "Check coverage before authorizing work" },
        { label: "Recorded work cost", value: money(lifecycle?.workCost ?? 0), helperText: "Entered cost lines only" },
        { label: "Replacement estimate", value: asset.replacementEstimate ? money(asset.replacementEstimate.amountMinor) : "Not entered", helperText: expectedReplacementYear ? `Expected-life year ${expectedReplacementYear}` : "Planning inputs remain optional" },
      ],
      sections: [
        {
          id: "lifecycle-evidence",
          title: "Repair decision and lifecycle context",
          description: "Age against expected life and the current repair-versus-replacement facts appear together. Small bridge repairs are not treated as replacement signals, historical facts stay separate, and the decision remains human.",
          facts: [
            { label: "Current comparison", value: lifecycle ? lifecycleComparisonLabel(lifecycle.screening) : "Inputs not available", helperText: lifecycle ? lifecycleComparisonExplanation(lifecycle.screening) : undefined },
            { label: "Current repair estimate", value: lifecycle?.screening.comparison.repairEstimateMinor === undefined ? "Not entered" : money(lifecycle.screening.comparison.repairEstimateMinor), helperText: "Current proposal only; not accumulated historical spend" },
            { label: "Expected service from repair", value: lifecycle?.screening.comparison.comparisonHorizonYears === undefined ? "Not entered" : `${lifecycle.screening.comparison.comparisonHorizonYears} ${lifecycle.screening.comparison.comparisonHorizonYears === 1 ? "year" : "years"}`, helperText: lifecycle?.screening.comparison.comparisonHorizonSource === "estimated_service_extension" ? "Entered planning estimate" : "Uses chronological remaining expected life" },
            { label: "Age against expected life", value: lifecycle?.screening.age.ageYears === undefined || lifecycle?.screening.age.expectedLifeYears === undefined ? "Not available" : `${lifecycle.screening.age.ageYears} of ${lifecycle.screening.age.expectedLifeYears} years`, helperText: lifecycle?.screening.age.lifeUsedPercentage === undefined ? undefined : `${Math.round(lifecycle.screening.age.lifeUsedPercentage)}% of the planning reference used; expected life is not an expiration date` },
            { label: "Expected life remaining", value: lifecycle?.screening.age.chronologicalRemainingExpectedLifeYears === undefined ? "Not available" : `${lifecycle.screening.age.chronologicalRemainingExpectedLifeYears} ${lifecycle.screening.age.chronologicalRemainingExpectedLifeYears === 1 ? "year" : "years"}`, helperText: "Chronological planning reference before any entered repair extension" },
            { label: "Repair share of replacement", value: lifecycle?.screening.comparison.repairToReplacementRatio === undefined ? "Not available" : `${Math.round(lifecycle.screening.comparison.repairToReplacementRatio * 100)}%`, helperText: "One transparent materiality fact; never a replacement rule by itself" },
            { label: "Additional capital to replace now", value: lifecycle?.screening.comparison.repairEstimateMinor === undefined || lifecycle?.screening.comparison.replacementEstimateMinor === undefined ? "Not available" : money(Math.max(0, lifecycle.screening.comparison.replacementEstimateMinor - lifecycle.screening.comparison.repairEstimateMinor)), helperText: "Replacement estimate less the current repair estimate; excludes effects not entered here" },
            { label: "Missing comparison inputs", value: lifecycle?.screening.dataGaps.length ? lifecycle.screening.dataGaps.map(lifecycleGapLabel).join(", ") : "None" },
            { label: "12 / 24 / 36 month work", value: `${lifecycle?.work12.length ?? 0} / ${lifecycle?.work24.length ?? 0} / ${lifecycle?.work36.length ?? 0}` },
            { label: "12 / 24 / 36 month cost", value: `${money(lifecycle?.cost12 ?? 0)} / ${money(lifecycle?.cost24 ?? 0)} / ${money(lifecycle?.cost36 ?? 0)}` },
            { label: "Observed service visits", value: String(lifecycle?.observedVisits.length ?? 0), helperText: "Visit count is presence context; it does not prove a repeat failure or billed labor" },
            { label: "Historical context", value: lifecycle?.contextFacts.join(" · ") || "No history recorded", helperText: "Visible for human review; excluded from the capital comparison" },
          ],
        },
        {
          id: "components",
          title: "Components",
          description: "Optional depth below the equipment record. Component-level history is retained when the team chooses to classify it.",
          table: {
            id: "equipment-components",
            caption: `Components for ${asset.name}`,
            columns: [
              { key: "component", label: "Component" },
              { key: "parent", label: "Parent" },
              { key: "part", label: "Part / serial" },
              { key: "installed", label: "Installed" },
              { key: "warranty", label: "Warranty" },
              { key: "work", label: "Linked work", align: "end" },
            ],
            rows: components.map((component) => ({
              id: component.id,
              label: component.name,
              href: `/app/equipment/${asset.id}#components`,
              cells: [
                { key: "component", value: component.name },
                { key: "parent", value: component.parentComponentId ? componentById.get(component.parentComponentId)?.name ?? "Unknown parent" : "Equipment" },
                { key: "part", value: component.partNumber ?? "Part not entered", secondary: component.serialNumber ? `S/N ${component.serialNumber}` : "Serial not entered" },
                { key: "installed", value: date(component.installedAt) },
                { key: "warranty", value: date(component.warrantyEndsAt) },
                { key: "work", value: String(assetWork.filter((work) => work.componentId === component.id).length) },
              ],
            })),
          },
        },
        {
          id: "service-history",
          title: "Service history",
          description: `${assetVisits.length} observed visit${assetVisits.length === 1 ? "" : "s"} connect to this equipment through its work orders.`,
          table: {
            id: "equipment-work",
            caption: `Work orders for ${asset.name}`,
            columns: columns["work-orders"],
            rows: workRows(fixture, { ...scoped, workOrders: assetWork, visits: assetVisits, assets: [asset] }, {}),
          },
        },
        {
          id: "preventive-maintenance",
          title: "Preventive maintenance",
          table: {
            id: "equipment-pm",
            caption: `PM occurrences for ${asset.name}`,
            columns: [
              { key: "plan", label: "Plan" },
              { key: "window", label: "Completion window" },
              { key: "work", label: "Work order" },
              { key: "status", label: "Status" },
            ],
            rows: pmOccurrences.map((occurrence) => {
              const plan = fixture.pmPlans.find((item) => item.organizationId === scoped.organizationId && item.id === occurrence.planId);
              const status = effectivePmStatus(occurrence, fixture.asOf);
              return {
                id: occurrence.id,
                label: plan?.name ?? "PM occurrence",
                href: occurrence.workOrderId ? `/app/work-orders/${occurrence.workOrderId}` : hrefWithQuery("/app/pm", { occurrence: occurrence.id, store: asset.storeId }),
                cells: [
                  { key: "plan", value: plan?.name ?? "PM plan" },
                  { key: "window", value: `${date(occurrence.windowStartsAt)} – ${date(occurrence.windowEndsAt)}`, secondary: `Due ${date(occurrence.dueAt)}` },
                  { key: "work", value: occurrence.workOrderId ? assetWork.find((work) => work.id === occurrence.workOrderId)?.number ?? "Linked work outside current scope" : "Not created" },
                  { key: "status", value: sentence(status), tone: status === "completed" ? "positive" : status === "missed" ? "critical" : status === "due" ? "warning" : "info" },
                ],
              };
            }),
          },
        },
      ],
      backLink: { label: "Back to equipment", href: hrefWithQuery("/app/equipment", { store: asset.storeId }) },
    };
  }

  if (route === "invoice") {
    const invoice = fixture.invoiceReferences.find(
      (candidate) => candidate.organizationId === scoped.organizationId && candidate.id === id,
    );
    if (!invoice) return missingDetail("Invoice reference", "/app/invoices");
    const allAllocations = fixture.invoiceAllocations.filter(
      (allocation) => allocation.organizationId === scoped.organizationId && allocation.invoiceReferenceId === invoice.id,
    );
    const visibleAllocations = allAllocations.filter((allocation) => scoped.workOrders.some((work) => work.id === allocation.workOrderId));
    const hasRestrictedStoreScope = Boolean(session.regionIds?.length || session.storeIds?.length);
    if ((allAllocations.length > 0 && visibleAllocations.length === 0) || (allAllocations.length === 0 && hasRestrictedStoreScope)) {
      return missingDetail("Invoice reference", "/app/invoices");
    }
    const vendor = fixture.vendors.find((candidate) => candidate.organizationId === scoped.organizationId && candidate.id === invoice.vendorId);
    const allocatedMinor = visibleAllocations.reduce((sum, allocation) => sum + allocation.amount.amountMinor, 0);
    const rows: TableRowViewModel[] = visibleAllocations.map((allocation) => {
      const work = scoped.workOrders.find((candidate) => candidate.id === allocation.workOrderId)!;
      const store = scoped.stores.find((candidate) => candidate.id === work.storeId);
      const visits = scoped.visits.filter((visit) => visit.workOrderId === work.id);
      return {
        id: allocation.id,
        label: work.number,
        href: `/app/work-orders/${work.id}`,
        cells: [
          { key: "work", value: work.number, secondary: work.problem },
          { key: "store", value: storeLabel(store) },
          { key: "allocation", value: money(allocation.amount.amountMinor) },
          { key: "recorded", value: money(costByWork.get(work.id) ?? 0), secondary: "Entered work cost" },
          { key: "visits", value: String(visits.length), secondary: visits.length ? "Observed source visits" : "No visit recorded" },
          { key: "authorization", value: work.nte ? money(work.nte.amountMinor) : "Not set", secondary: "Not-to-exceed reference" },
        ],
      };
    });
    return {
      state: { kind: "ready" },
      page: { title: invoice.invoiceNumber, eyebrow: "Optional invoice safeguard", description: "A manually entered invoice reference connected to source work, visit, authorization, and recorded-cost facts. TraceOps does not approve or pay it.", scopeLabel: session.scopeLabel },
      statusLabel: sentence(invoice.matchStatus),
      statusTone: invoice.matchStatus === "confirmed" ? "positive" : ["unmatched", "rejected"].includes(invoice.matchStatus) ? "warning" : "info",
      facts: [
        { label: "Vendor", value: vendor?.name ?? "Unknown vendor", link: vendor ? { href: `/app/vendors/${vendor.id}`, label: "Open vendor" } : undefined },
        { label: "Invoice date", value: date(invoice.invoiceDate) },
        { label: "Gross amount", value: money(invoice.grossAmount.amountMinor) },
        { label: "Allocated to work", value: money(allocatedMinor), helperText: `${visibleAllocations.length} visible allocation${visibleAllocations.length === 1 ? "" : "s"}` },
        { label: "Unmatched balance", value: money(Math.max(0, invoice.grossAmount.amountMinor - allocatedMinor)), helperText: "Visible for human review; not an automatic rejection" },
        { label: "Operator WO reference", value: invoice.operatorWorkOrderNumber ?? "Not supplied", helperText: "The operator work-order number is the first match key" },
      ],
      sections: [
        {
          id: "linked-work",
          title: "Linked source work",
          description: visibleAllocations.length ? "Open a work order to inspect authorization, visits, cost lines, and audit history." : "No source work is linked yet. The reference stays visible for manual review.",
          table: { id: "invoice-work", caption: `Work linked to ${invoice.invoiceNumber}`, columns: [{ key: "work", label: "Work order" }, { key: "store", label: "Store" }, { key: "allocation", label: "Invoice allocation", align: "end" }, { key: "recorded", label: "Recorded cost", align: "end" }, { key: "visits", label: "Visits" }, { key: "authorization", label: "NTE", align: "end" }], rows },
        },
        {
          id: "review-boundary",
          title: "What this review means",
          description: "These are comparison facts for a person. Observed presence is approximate, and a difference does not prove that work or billing is invalid.",
          facts: [
            { label: "Matching", value: "Manual confirmation" },
            { label: "Payment", value: "Handled in the customer's accounting system" },
            { label: "Source of truth", value: "Operator work order and append-only service evidence" },
          ],
        },
      ],
      backLink: { label: "Back to invoice references", href: "/app/invoices" },
    };
  }

  if (route === "work-order") {
    const work = scoped.workOrders.find((item) => item.id === id);
    if (!work) return missingDetail("Work order", "/app/work-orders");
    const store = scoped.stores.find((item) => item.id === work.storeId);
    const assignment = assignmentForWork(fixture, scoped.organizationId, work.id);
    const vendor = assignment?.vendorId ? fixture.vendors.find((item) => item.id === assignment.vendorId && item.organizationId === scoped.organizationId) : undefined;
    const visits = scoped.visits.filter((visit) => visit.workOrderId === work.id);
    const costLines = fixture.costLines.filter((line) => line.organizationId === scoped.organizationId && line.workOrderId === work.id);
    const invoiceLinks = fixture.invoiceAllocations
      .filter((allocation) => allocation.organizationId === scoped.organizationId && allocation.workOrderId === work.id)
      .map((allocation) => ({
        allocation,
        invoice: fixture.invoiceReferences.find((invoice) => invoice.organizationId === scoped.organizationId && invoice.id === allocation.invoiceReferenceId),
      }))
      .filter((item): item is typeof item & { invoice: NonNullable<typeof item.invoice> } => Boolean(item.invoice));
    const audit = fixture.auditEvents.filter((event) => event.organizationId === scoped.organizationId && (event.aggregateId === work.id || visits.some((visit) => visit.id === event.aggregateId))).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const issuances = fixture.issuances.filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === work.id);
    return {
      state: { kind: "ready" },
      page: { title: work.number, eyebrow: "Work order / service authorization", description: work.problem, scopeLabel: storeLabel(store), primaryAction: roleCan(session.role, "issue_work_order") && assignment?.kind !== "internal" && !["closed", "cancelled", "completed_pending_review"].includes(work.status) ? { label: assignment?.kind === "choose_later" ? "Choose vendor & issue" : "Issue to vendor", href: `#issue-work` } : undefined },
      statusLabel: sentence(work.status),
      statusTone: workStatusTone(work.status),
      facts: [
        { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
        { label: "Assigned to", value: vendor?.name ?? (assignment?.kind === "internal" ? "Internal maintenance" : "Choose later") },
        { label: "Accountable party", value: work.accountableParty },
        { label: "Next action", value: work.nextAction, helperText: work.dueAt ? `Due ${dateTime(work.dueAt)}` : "No due time entered" },
        { label: "Recorded work cost", value: money(costByWork.get(work.id) ?? 0), helperText: "Entered source lines; not inferred from observed time" },
        { label: "Classification", value: work.categoryKey ? sentence(work.categoryKey) : "Deferred", helperText: work.assetId ? "Equipment linked" : "Equipment not required" },
      ],
      sections: [
        { id: "authorization", title: "Authorization", description: "The operator work-order number remains the billing reference; vendor ticket, invoice, and external PO stay separate.", action: work.id === NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId ? { label: "Preview vendor authorization", href: `/public/service/${NORTHLINE_DEMO_ENTRY_TOKENS.serviceAuthorization104}` } : undefined, facts: [
          { label: "Authorized scope", value: work.authorizedScope ?? "No additional scope entered" },
          { label: "Not to exceed", value: work.nte ? money(work.nte.amountMinor) : "Not set" },
          { label: "Issued revisions", value: String(issuances.length), helperText: issuances.length ? `Latest revision ${Math.max(...issuances.map((item) => item.revision))}` : "Not issued yet" },
          { label: "Vendor service ticket", value: work.vendorServiceTicketNumber ?? "Not entered" },
          { label: "Vendor invoice", value: work.vendorInvoiceNumber ?? (invoiceLinks.map((item) => item.invoice.invoiceNumber).join(", ") || "Not entered"), helperText: invoiceLinks.length ? "Optional invoice reference linked below" : undefined, link: invoiceLinks.length === 1 ? { href: `/app/invoices/${invoiceLinks[0].invoice.id}`, label: "Open invoice reference" } : undefined },
          { label: "External accounting PO", value: work.externalAccountingPo ?? "Not entered" },
        ] },
        { id: "visits", title: "Observed visits", description: "Observed onsite duration is approximate presence evidence, not certified labor.", table: { id: "work-visits", caption: "Visits linked to this work order", columns: columns.visits, rows: visitRows(fixture, { ...scoped, visits }, {}) } },
        { id: "cost", title: "Recorded work cost", description: "Cost lines are entered facts. Optional invoice evidence is reviewed separately.", table: { id: "work-cost", caption: "Recorded cost lines", columns: [{ key: "date", label: "Service date" }, { key: "kind", label: "Type" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount", align: "end" }], rows: costLines.map((line) => ({ id: line.id, label: line.description, href: `/app/work-orders/${work.id}`, cells: [{ key: "date", value: date(line.serviceDate) }, { key: "kind", value: sentence(line.kind) }, { key: "description", value: line.description }, { key: "amount", value: money(line.amount.amountMinor) }] })) } },
        { id: "invoice-references", title: "Invoice references", description: "Optional billing evidence is linked for review without making it a prerequisite for maintenance visibility.", table: { id: "work-invoices", caption: `Invoice references linked to ${work.number}`, columns: [{ key: "invoice", label: "Invoice" }, { key: "date", label: "Invoice date" }, { key: "gross", label: "Gross amount", align: "end" }, { key: "allocation", label: "Allocated here", align: "end" }, { key: "status", label: "Match status" }], rows: invoiceLinks.map(({ invoice, allocation }) => ({ id: invoice.id, label: invoice.invoiceNumber, href: `/app/invoices/${invoice.id}`, cells: [{ key: "invoice", value: invoice.invoiceNumber }, { key: "date", value: date(invoice.invoiceDate) }, { key: "gross", value: money(invoice.grossAmount.amountMinor) }, { key: "allocation", value: money(allocation.amount.amountMinor) }, { key: "status", value: sentence(invoice.matchStatus), tone: invoice.matchStatus === "confirmed" ? "positive" : "warning" }] })) } },
        { id: "timeline", title: "Audit timeline", description: "Issued versions, responses, visits, follow-ups, and corrections remain attributable.", timeline: audit.map((event) => ({ id: event.id, title: sentence(event.eventType.replaceAll(".", " ")), timestampLabel: dateTime(event.occurredAt), actorLabel: event.actorName })) },
      ],
      backLink: { label: "Back to work orders", href: "/app/work-orders" },
    };
  }

  if (route === "store") {
    const store = scoped.stores.find((item) => item.id === id);
    if (!store) return missingDetail("Store", "/app/stores");
    const storeWork = scoped.workOrders.filter((work) => work.storeId === store.id);
    const storeVisits = scoped.visits.filter((visit) => visit.storeId === store.id);
    const storeAssets = scoped.assets.filter((asset) => asset.storeId === store.id);
    const rollingCostByWork = recordedCostByWork(fixture, scoped.organizationId, rollingYearStart(fixture.asOf));
    const storePm = fixture.pmOccurrences.filter((occurrence) => occurrence.organizationId === scoped.organizationId && occurrence.storeId === store.id);
    const eligiblePm = storePm.filter((occurrence) => occurrence.status !== "waived" && Date.parse(occurrence.windowEndsAt) < Date.parse(fixture.asOf));
    const completedPm = eligiblePm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "completed");
    const pmByPlan = new Map(fixture.pmPlans.filter((plan) => plan.organizationId === scoped.organizationId).map((plan) => [plan.id, plan]));
    const serviceAreas = [...new Set([
      ...storeWork.map((work) => work.categoryKey).filter((value): value is string => Boolean(value)),
      ...storeAssets.map((asset) => asset.categoryKey),
    ])].sort();
    const serviceAreaRows: TableRowViewModel[] = serviceAreas.map((category) => {
      const work = storeWork.filter((item) => item.categoryKey === category);
      const assets = storeAssets.filter((asset) => asset.categoryKey === category);
      const pm = storePm.filter((occurrence) => pmByPlan.get(occurrence.planId)?.categoryKey === category);
      const missed = pm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "missed").length;
      const due = pm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "due").length;
      const open = work.filter((item) => !["closed", "cancelled"].includes(item.status)).length;
      return {
        id: category,
        label: sentence(category),
        href: hrefWithQuery("/app/spend", { store: store.id, category }),
        cells: [
          { key: "area", value: sentence(category), secondary: `${assets.length} tracked equipment record${assets.length === 1 ? "" : "s"}` },
          { key: "cost", value: money(costForWorkIds(rollingCostByWork, work.map((item) => item.id))) },
          { key: "open", value: String(open), tone: open ? "warning" : "positive" },
          { key: "pm", value: pm.length ? `${pm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "completed").length}/${pm.length} completed` : "Not configured", secondary: missed ? `${missed} missed` : due ? `${due} due now` : undefined, tone: missed ? "critical" : due ? "warning" : "positive" },
          { key: "status", value: missed ? "PM exception" : open ? "Open work" : "No current exception", tone: missed ? "critical" : open ? "warning" : "positive" },
        ],
      };
    });
    return {
      state: { kind: "ready" },
      page: { title: `Store ${store.storeNumber}`, eyebrow: store.name, description: storeAddress(store), scopeLabel: session.scopeLabel, primaryAction: roleCan(session.role, "create_work_order") ? { label: "Create work order", href: `/app/work-orders/new?store=${store.id}` } : undefined, secondaryAction: { label: "View recorded cost", href: `/app/spend?store=${store.id}` } },
      statusLabel: sentence(store.status),
      statusTone: store.status === "active" ? "positive" : "neutral",
      facts: [
        { label: "Open work", value: String(storeWork.filter((work) => !["closed", "cancelled"].includes(work.status)).length), link: { href: `/app/work-orders?store=${store.id}&status=open`, label: "Open work" } },
        { label: "Onsite now", value: String(storeVisits.filter((visit) => visit.status === "active").length), link: { href: `/app/visits?store=${store.id}&status=active`, label: "Open visits" } },
        { label: "Rolling 12-month cost", value: money(costForWorkIds(rollingCostByWork, storeWork.map((work) => work.id))), link: { href: `/app/spend?store=${store.id}`, label: "Explain cost" } },
        { label: "PM compliance", value: eligiblePm.length ? `${Math.round((completedPm.length / eligiblePm.length) * 100)}%` : "No closed window", helperText: eligiblePm.length ? `${completedPm.length} completed / ${eligiblePm.length} eligible occurrences` : "Future and open windows are excluded", link: { href: `/app/pm?store=${store.id}`, label: "Open PM evidence" } },
        { label: "Tracked equipment", value: String(storeAssets.length), link: { href: `/app/equipment?store=${store.id}`, label: "Open equipment" } },
        { label: "Capital review", value: String(storeAssets.filter((asset) => asset.status === "watch").length), helperText: "Human review; no automatic replacement", link: { href: `/app/lifecycle?store=${store.id}`, label: "Open lifecycle evidence" } },
      ],
      sections: [
        ...(store.id === NORTHLINE_DEMO_HANDLES.storyStoreId ? [{
          id: "demo-entry-points",
          title: "Store 104 accountability walkthrough",
          description: "Use either entry point against the same store and work records. The QR/mobile route requests event-only location; the trusted service-desk route records exact server time without a PIN or location permission.",
          facts: [
            { label: "QR or mobile web", value: "Report an issue or start a vendor visit", link: { href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}`, label: "Open QR/mobile entry" } },
            { label: "Trusted store computer", value: "Check a vendor in or finish an onsite visit", link: { href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.trustedStore104}`, label: "Open store service desk" } },
            { label: "Vendor authorization", value: "Account-free acceptance, scheduling, decline, or question", link: { href: `/public/service/${NORTHLINE_DEMO_ENTRY_TOKENS.serviceAuthorization104}`, label: "Open vendor view" } },
          ],
        }] : []),
        { id: "service-areas", title: "Store systems", description: "Start broad, then open a service area and continue through flexible groups, equipment, components, work orders, and entered cost.", table: { id: "store-service-areas", caption: `Service areas for Store ${store.storeNumber}`, columns: [{ key: "area", label: "Service area" }, { key: "cost", label: "12-month cost", align: "end" }, { key: "open", label: "Open work", align: "end" }, { key: "pm", label: "PM" }, { key: "status", label: "Current signal" }], rows: serviceAreaRows } },
        { id: "work", title: "Work orders", table: { id: "store-work", caption: `Work orders for Store ${store.storeNumber}`, columns: columns["work-orders"], rows: workRows(fixture, { ...scoped, stores: [store], storeIds: new Set([store.id]), workOrders: storeWork, visits: storeVisits, assets: storeAssets }, {}) } },
        { id: "visits", title: "Service visits", description: "All channels create the same store visit record.", table: { id: "store-visits", caption: `Visits for Store ${store.storeNumber}`, columns: columns.visits, rows: visitRows(fixture, { ...scoped, stores: [store], storeIds: new Set([store.id]), workOrders: storeWork, visits: storeVisits, assets: storeAssets }, {}) } },
        { id: "equipment", title: "Equipment & lifecycle", facts: [{ label: "Tracked assets", value: String(storeAssets.length) }, { label: "Marked for review", value: String(storeAssets.filter((asset) => asset.status === "watch").length) }, { label: "Optional components", value: String(fixture.components.filter((component) => component.organizationId === scoped.organizationId && storeAssets.some((asset) => asset.id === component.assetId)).length) }], action: { label: "Open equipment", href: `/app/equipment?store=${store.id}` } },
      ],
      backLink: { label: "Back to stores", href: "/app/stores" },
    };
  }

  const vendor = fixture.vendors.find((item) => item.id === id && item.organizationId === scoped.organizationId);
  if (!vendor) return missingDetail("Vendor", "/app/vendors");
  const assignments = fixture.assignments.filter((assignment) => assignment.organizationId === scoped.organizationId && assignment.vendorId === vendor.id);
  const workIds = new Set(assignments.map((assignment) => assignment.workOrderId));
  const vendorWork = scoped.workOrders.filter((work) => workIds.has(work.id));
  const vendorVisits = scoped.visits.filter((visit) => visit.vendorId === vendor.id);
  const specialties = fixture.vendorSpecialties.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
  return {
    state: { kind: "ready" },
    page: { title: vendor.name, eyebrow: vendor.preferred ? "Preferred approved vendor" : "Approved vendor", description: specialties.map((item) => item.displayName).join(" · "), scopeLabel: session.scopeLabel, primaryAction: roleCan(session.role, "create_work_order") ? { label: "Create work order", href: `/app/work-orders/new?vendor=${vendor.id}` } : undefined },
    statusLabel: sentence(vendor.status),
    statusTone: vendor.status === "approved" ? "positive" : "warning",
    facts: [
      { label: "Dispatch", value: vendor.dispatchEmail, helperText: vendor.dispatchPhone },
      { label: "Open work", value: String(vendorWork.filter((work) => !["closed", "cancelled"].includes(work.status)).length) },
      { label: "Observed visits", value: String(vendorVisits.length), helperText: "Source visits, not invoice claims" },
      { label: "Recorded work cost", value: money(costForWorkIds(costByWork, vendorWork.map((work) => work.id))) },
    ],
    sections: [
      { id: "coverage", title: "Specialties & coverage", facts: specialties.map((specialty) => ({ label: specialty.displayName, value: specialty.searchAliases.join(", ") || "No search aliases" })) },
      { id: "work", title: "Issued work", table: { id: "vendor-work", caption: `Work assigned to ${vendor.name}`, columns: columns["work-orders"], rows: workRows(fixture, { ...scoped, workOrders: vendorWork }, {}) } },
      { id: "visits", title: "Observed service visits", description: "Presence, outcomes, and exceptions are shown as facts—not a black-box vendor score.", table: { id: "vendor-visits", caption: `Visits by ${vendor.name}`, columns: columns.visits, rows: visitRows(fixture, { ...scoped, visits: vendorVisits }, {}) } },
    ],
    backLink: { label: "Back to vendors", href: "/app/vendors" },
  };
}

function missingDetail(label: string, href: string): DetailPageViewModel {
  return {
    state: { kind: "error", title: `${label} not available`, message: "This record does not exist or is outside your authorized operating scope." },
    page: { title: label, description: "The requested source record is unavailable.", scopeLabel: "Authorized scope" },
    statusLabel: "Unavailable",
    facts: [],
    sections: [],
    backLink: { label: `Back to ${label.toLocaleLowerCase("en-US")}s`, href },
  };
}

function storesAsOptions(scoped: ScopedFixture) {
  return scoped.stores.map((store) => ({ value: store.id, label: `Store ${store.storeNumber} · ${store.name}`, description: storeAddress(store) }));
}

export function buildCreateRequestModel(fixture: OpsFixture, session: OperatorSession): CreateRequestPageViewModel {
  const scoped = scopeFixture(fixture, session);
  return {
    state: { kind: "ready" },
    page: { title: "Report an issue", eyebrow: "Issue intake", description: "Capture what the store can observe. A store and plain-language problem are enough to begin review.", scopeLabel: `${session.scopeLabel} · Requests remain visible after submission` },
    submitAction: "/api/ops/requests",
    cancelLink: { label: "Back to requests", href: "/app/requests" },
    stores: storesAsOptions(scoped),
    priorityOptions: [
      { value: "routine", label: "Routine", description: "Normal service need" },
      { value: "urgent", label: "Urgent", description: "Material operating impact" },
      { value: "emergency", label: "Emergency", description: "Immediate safety, fuel, food-safety, or major operating impact" },
    ],
  };
}

export function buildCreateWorkOrderModel(
  fixture: OpsFixture,
  session: OperatorSession,
  query: OperatorSearchParameters = {},
): CreateWorkOrderPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const vendors = fixture.vendors.filter((vendor) => vendor.organizationId === scoped.organizationId && vendor.status === "approved");
  const internal = fixture.memberships.filter((membership) => membership.organizationId === scoped.organizationId && membership.role === "internal_technician" && membership.status === "active");
  const userById = new Map(fixture.users.map((user) => [user.id, user]));
  const requestedRequestId = first(query.request);
  const sourceRequest = requestedRequestId
    ? fixture.requests.find(
        (request) =>
          request.id === requestedRequestId &&
          request.organizationId === scoped.organizationId &&
          scoped.storeIds.has(request.storeId) &&
          request.status !== "closed",
      )
    : undefined;
  const requestedAssetId = first(query.asset);
  const requestedAsset = requestedAssetId
    ? scoped.assets.find((asset) => asset.id === requestedAssetId)
    : undefined;
  const requestedStoreId = first(query.store);
  const requestedStore = requestedStoreId && scoped.storeIds.has(requestedStoreId)
    ? requestedStoreId
    : undefined;
  return {
    state: { kind: "ready" },
    page: { title: "Create work order", eyebrow: "Service control", description: "Create the canonical record now; assign, classify, and add equipment detail only when it is useful and known.", scopeLabel: `${session.scopeLabel} · Store and problem are the only required work facts` },
    submitAction: "/api/ops/work-orders",
    cancelLink: { label: "Back to work orders", href: "/app/work-orders" },
    stores: storesAsOptions(scoped),
    vendors: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name, description: fixture.vendorSpecialties.filter((item) => item.vendorId === vendor.id && item.organizationId === scoped.organizationId).flatMap((item) => [item.displayName, ...item.searchAliases]).join(", ") })),
    internalAssignees: internal.map((membership) => ({ value: membership.id, label: userById.get(membership.userId)?.displayName ?? "Internal technician" })),
    priorityOptions: [
      { value: "routine", label: "Routine" },
      { value: "urgent", label: "Urgent" },
      { value: "emergency", label: "Emergency" },
      { value: "planned", label: "Planned / preventive" },
    ],
    categories: [...new Set(scoped.assets.map((asset) => asset.categoryKey).concat(scoped.workOrders.map((work) => work.categoryKey ?? "")).filter(Boolean))].sort().map((category) => ({ value: category, label: sentence(category) })),
    assetLifecycleInputs: scoped.assets.map((asset) => ({
      id: asset.id,
      organizationId: asset.organizationId,
      storeId: asset.storeId,
      label: `${asset.name} · ${asset.assetTag}`,
      description: `${storeLabel(scoped.stores.find((store) => store.id === asset.storeId))} · ${asset.groupPath.join(" › ")}`,
      installedAt: asset.installedAt,
      expectedLifeYears: asset.expectedLifeYears,
      replacementEstimate: asset.replacementEstimate,
    })),
    lifecycleAsOf: fixture.asOf,
    defaults: requestedAsset || requestedStore ? {
      storeId: sourceRequest?.storeId ?? requestedAsset?.storeId ?? requestedStore,
      assetId: requestedAsset?.id,
      categoryKey: requestedAsset?.categoryKey,
    } : undefined,
    sourceRequest: sourceRequest ? {
      id: sourceRequest.id,
      reference: sourceRequest.reference,
      storeId: sourceRequest.storeId,
      problem: sourceRequest.problem,
      reporterName: sourceRequest.reporterName,
      submittedLabel: `on ${dateTime(sourceRequest.submittedAt)}`,
    } : undefined,
  };
}

export function buildCreateStoreModel(fixture: OpsFixture, session: OperatorSession): CreateStorePageViewModel {
  return {
    state: { kind: "ready" },
    page: { title: "Add a store", eyebrow: "Network setup", description: "Create the location first, then add equipment, PM, and deeper classification only where it creates value.", scopeLabel: session.scopeLabel },
    submitAction: "/api/ops/stores",
    cancelLink: { label: "Back to stores", href: "/app/stores" },
    regions: fixture.regions.filter((region) => region.organizationId === session.organizationId).map((region) => ({ value: region.id, label: region.name, description: region.code })),
    timeZones: [{ value: "America/New_York", label: "Eastern time" }, { value: "America/Chicago", label: "Central time" }, { value: "America/Denver", label: "Mountain time" }, { value: "America/Los_Angeles", label: "Pacific time" }],
  };
}

export function buildCreateVendorModel(fixture: OpsFixture, session: OperatorSession): CreateVendorPageViewModel {
  const specialtyNames = new Map(fixture.vendorSpecialties.filter((item) => item.organizationId === session.organizationId).map((item) => [item.canonicalKey, item.displayName]));
  return {
    state: { kind: "ready" },
    page: { title: "Add an approved vendor", eyebrow: "Vendor onboarding", description: "Add dispatch details, searchable specialties, and service coverage. A portal account is optional.", scopeLabel: session.scopeLabel },
    submitAction: "/api/ops/vendors",
    cancelLink: { label: "Back to vendors", href: "/app/vendors" },
    specialties: [...specialtyNames.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    coverageScopes: [{ value: session.organizationId, label: "All stores", description: "Companywide coverage" }, ...fixture.regions.filter((region) => region.organizationId === session.organizationId).map((region) => ({ value: region.id, label: region.name, description: "Regional coverage" }))],
  };
}

export function buildVendorIssuanceModel(fixture: OpsFixture, session: OperatorSession, workOrderId: string): VendorIssuanceViewModel {
  const scoped = scopeFixture(fixture, session);
  const work = scoped.workOrders.find((item) => item.id === workOrderId);
  const assignment = work ? assignmentForWork(fixture, scoped.organizationId, work.id) : undefined;
  const revisions = fixture.issuances.filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === workOrderId);
  const available = Boolean(
    work &&
    assignment &&
    assignment.kind !== "internal" &&
    !["closed", "cancelled", "completed_pending_review"].includes(work.status) &&
    !["completed", "cancelled", "superseded"].includes(assignment.status),
  );
  return {
    available,
    permitted: available && roleCan(session.role, "issue_work_order"),
    submitAction: `/api/ops/work-orders/${encodeURIComponent(workOrderId)}/issue`,
    workOrderId,
    workOrderNumber: work?.number ?? workOrderId,
    assignmentKind: assignment?.kind ?? "choose_later",
    selectedVendorId: assignment?.vendorId,
    vendors: fixture.vendors.filter((vendor) => vendor.organizationId === scoped.organizationId && vendor.status === "approved").map((vendor) => ({ value: vendor.id, label: vendor.name })),
    channels: [{ value: "email", label: "Email secure link" }, { value: "sms", label: "SMS secure link" }, { value: "print", label: "Print / PDF" }, { value: "manual", label: "Record phone or manual delivery" }],
    currentRevision: revisions.length ? Math.max(...revisions.map((item) => item.revision)) : 0,
    helperText: "Create an immutable service-authorization revision and give the vendor an account-free response link.",
  };
}
