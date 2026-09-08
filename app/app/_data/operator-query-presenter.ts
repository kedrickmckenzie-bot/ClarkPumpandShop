import "server-only";

import type {
  DashboardPageViewModel,
  ListPageViewModel,
  OperatorSession,
  PaginationViewModel,
  SearchPageViewModel,
  TableRowViewModel,
  Tone,
} from "@/components/ops/data-contract";
import { roleCan } from "@/components/ops/role-policy";
import { NORTHLINE_AS_OF } from "@/lib/ops/fixtures";
import { formatOperationsDate, formatOperationsDateTime } from "@/lib/ops/local-time";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { Page } from "@/lib/ops/types";
import type {
  AssetSearchRow,
  RequestListRow,
  StoreSearchRow,
  VendorDirectoryRow,
  VisitListRow,
  WorkOrderListRow,
} from "@/lib/ops/view-models";
import type { OperatorListRoute, OperatorSearchParameters } from "./operator-presenter";

const PAGE_SIZE = 25;
type QueryListRoute = "requests" | "work-orders" | "visits" | "stores" | "vendors";
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function money(minor: number) {
  return currency.format(minor / 100);
}

function sentence(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"));
}

function toneForStatus(status: string): Tone {
  if (["closed", "completed", "resolved", "checked_out", "approved"].includes(status)) return "positive";
  if (["cancelled", "declined", "expired"].includes(status)) return "neutral";
  if (["emergency", "urgent", "overdue"].includes(status)) return "critical";
  return "info";
}

function scopeFor(session: OperatorSession): OrganizationScope {
  return { organizationId: session.organizationId, regionIds: session.regionIds, storeIds: session.storeIds };
}

function paramsWithoutPage(query: OperatorSearchParameters) {
  return Object.fromEntries(Object.entries(query).flatMap(([key, raw]) => {
    if (key === "page") return [];
    const value = first(raw);
    return value ? [[key, value]] : [];
  }));
}

function hrefWithPage(route: OperatorListRoute, query: OperatorSearchParameters, page: number) {
  const params = new URLSearchParams({ ...paramsWithoutPage(query), page: String(page) });
  return `/app/${route}?${params.toString()}`;
}

function pagination<T>(route: OperatorListRoute, query: OperatorSearchParameters, result: Page<T>, page: number): PaginationViewModel | undefined {
  const total = result.totalCount;
  const hasNext = Boolean(result.nextCursor) || (total !== undefined && page * PAGE_SIZE < total);
  if (page === 1 && !hasNext) return undefined;
  const totalPages = total === undefined ? page + Number(hasNext) : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumbers = [...new Set([1, page - 1, page, page + 1, totalPages])].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  return {
    summary: total === undefined ? `${result.items.length} records on this page` : `${total} records · ${PAGE_SIZE} per page`,
    currentPage: page,
    totalPages,
    pageLinks: pageNumbers.map((value) => ({ page: value, href: hrefWithPage(route, query, value), current: value === page })),
    previousHref: page > 1 ? hrefWithPage(route, query, page - 1) : undefined,
    nextHref: hasNext ? hrefWithPage(route, query, page + 1) : undefined,
  };
}

function queryPage(query: OperatorSearchParameters) {
  const requested = Number(first(query.page) ?? "1");
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

function commonPage(session: OperatorSession, title: string, eyebrow: string, description: string) {
  return { title, eyebrow, description, scopeLabel: session.scopeLabel, updatedLabel: `Source data through ${formatOperationsDate(NORTHLINE_AS_OF)}` };
}

function searchControl(route: OperatorListRoute, query: OperatorSearchParameters, label: string, placeholder: string) {
  return {
    label,
    placeholder,
    value: first(query.q),
    action: `/app/${route}`,
    preservedParameters: Object.entries(query).flatMap(([name, raw]) => {
      if (["q", "page"].includes(name)) return [];
      const value = first(raw);
      return value ? [{ name, value }] : [];
    }),
  };
}

function workRow(row: WorkOrderListRow): TableRowViewModel {
  return {
    id: row.id,
    label: row.number,
    href: `/app/work-orders/${row.id}`,
    cells: [
      { key: "work", value: row.number, secondary: row.problem },
      { key: "store", value: `Store ${row.storeNumber}`, secondary: row.storeName },
      { key: "assignment", value: row.vendorName ?? (row.assignmentKind === "internal" ? "Internal maintenance" : "Choose later") },
      { key: "next", value: row.nextAction, secondary: row.dueAt ? `Due ${formatOperationsDate(row.dueAt)}` : undefined },
      { key: "cost", value: money(row.recordedCostMinor) },
      { key: "status", value: sentence(row.status), tone: toneForStatus(row.status) },
    ],
  };
}

function requestRow(row: RequestListRow): TableRowViewModel {
  return { id: row.id, label: row.reference, href: `/app/requests/${row.id}`, cells: [
    { key: "request", value: row.reference, secondary: row.problem },
    { key: "store", value: `Store ${row.storeNumber}`, secondary: row.storeName },
    { key: "priority", value: sentence(row.priority), tone: toneForStatus(row.priority) },
    { key: "reported", value: formatOperationsDate(row.submittedAt), secondary: row.reporterName },
    { key: "status", value: sentence(row.status), tone: toneForStatus(row.status) },
  ] };
}

function storeRow(row: StoreSearchRow): TableRowViewModel {
  return { id: row.id, label: `Store ${row.storeNumber}`, href: `/app/stores/${row.id}`, cells: [
    { key: "store", value: `Store ${row.storeNumber}`, secondary: row.name },
    { key: "region", value: row.regionName ?? "No region" },
    { key: "address", value: row.formattedAddress },
    { key: "work", value: String(row.openWorkCount) },
    { key: "onsite", value: String(row.activeVisitCount) },
    { key: "cost", value: money(row.recordedCostMinor) },
  ] };
}

function vendorRow(row: VendorDirectoryRow): TableRowViewModel {
  return { id: row.id, label: row.name, href: `/app/vendors/${row.id}`, cells: [
    { key: "vendor", value: row.name, secondary: row.preferred ? "Preferred provider" : undefined },
    { key: "specialties", value: row.specialties.join(", ") || "No specialties recorded" },
    { key: "coverage", value: row.coverageLabels.join(", ") || "Coverage recorded by store and region" },
    { key: "open", value: String(row.openWorkOrders) },
    { key: "visits", value: String(row.activeVisits), secondary: row.returnVisitWorkOrders ? `${row.returnVisitWorkOrders} with return visits` : undefined },
    { key: "status", value: sentence(row.status), tone: toneForStatus(row.status) },
  ] };
}

function visitRow(row: VisitListRow): TableRowViewModel {
  const observed = row.checkedOutAt
    ? `${formatOperationsDateTime(row.checkedInAt, row.storeTimeZone)} – ${formatOperationsDateTime(row.checkedOutAt, row.storeTimeZone)}`
    : `Since ${formatOperationsDateTime(row.checkedInAt, row.storeTimeZone)}`;
  return { id: row.id, label: `${row.providerName} visit`, href: `/app/visits/${row.id}`, cells: [
    { key: "visit", value: row.technicianName, secondary: row.purpose },
    { key: "store", value: `Store ${row.storeNumber}`, secondary: row.storeName },
    { key: "vendor", value: row.providerName },
    { key: "work", value: row.workOrderNumber ?? "No work order", secondary: row.arrivalNote },
    { key: "observed", value: observed, secondary: "Store-local display · approximate presence, not labor" },
    { key: "evidence", value: sentence(row.locationResult), tone: row.locationResult === "verified" ? "positive" : "warning" },
    { key: "outcome", value: row.outcome ? sentence(row.outcome) : "Onsite now", tone: row.status === "active" ? "info" : "neutral" },
  ] };
}

const columns: Record<QueryListRoute, ListPageViewModel["table"]["columns"]> = {
  requests: [
    { key: "request", label: "Request" }, { key: "store", label: "Store" }, { key: "priority", label: "Priority" }, { key: "reported", label: "Reported" }, { key: "status", label: "Status" },
  ],
  "work-orders": [
    { key: "work", label: "Work order" }, { key: "store", label: "Store" }, { key: "assignment", label: "Assigned to" }, { key: "next", label: "Next action" }, { key: "cost", label: "Recorded cost", align: "end" as const }, { key: "status", label: "Status" },
  ],
  visits: [
    { key: "visit", label: "Visit" }, { key: "store", label: "Store" }, { key: "vendor", label: "Vendor" }, { key: "work", label: "Work order" }, { key: "observed", label: "Timing" }, { key: "evidence", label: "Evidence" }, { key: "outcome", label: "Outcome" },
  ],
  stores: [
    { key: "store", label: "Store" }, { key: "region", label: "Region" }, { key: "address", label: "Address" }, { key: "work", label: "Open work", align: "end" as const }, { key: "onsite", label: "Onsite now", align: "end" as const }, { key: "cost", label: "Recorded cost", align: "end" as const },
  ],
  vendors: [
    { key: "vendor", label: "Vendor" }, { key: "specialties", label: "Specialties" }, { key: "coverage", label: "Coverage" }, { key: "open", label: "Open work", align: "end" as const }, { key: "visits", label: "Onsite now", align: "end" as const }, { key: "status", label: "Status" },
  ],
};

export const QUERY_FIRST_LIST_ROUTES = new Set<OperatorListRoute>(["requests", "work-orders", "visits", "stores", "vendors"]);

export async function buildQueryListModel(repository: OpsRepository, session: OperatorSession, route: OperatorListRoute, query: OperatorSearchParameters): Promise<ListPageViewModel> {
  if (!QUERY_FIRST_LIST_ROUTES.has(route)) throw new Error(`No query-first list projection for ${route}`);
  const page = queryPage(query);
  const request = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
  const scope = scopeFor(session);
  const q = first(query.q)?.trim() ?? "";
  let result: Page<unknown>;
  let rows: TableRowViewModel[];
  let title: string;
  let eyebrow: string;
  let description: string;
  let placeholder: string;
  let primaryAction: { label: string; href: string } | undefined;

  if (route === "work-orders") {
    const requestedStatus = first(query.status);
    const statuses = requestedStatus === "open"
      ? ["draft", "awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"]
      : requestedStatus ? [requestedStatus] : undefined;
    const work = await repository.listWorkOrders(scope, {
      ...request,
      search: q,
      statuses,
      storeId: first(query.store),
      vendorId: first(query.vendor),
      regionId: first(query.region),
      categoryKey: first(query.category),
      assetId: first(query.asset),
      componentId: first(query.component),
      hasCost: first(query.hasCost) === "true",
      costFrom: first(query.costFrom),
      costMonth: first(query.costMonth),
    });
    result = work; rows = work.items.map(workRow); title = "Work orders"; eyebrow = "Maintenance work"; description = "Track internal and outside service from creation through visits, follow-up, and recorded cost."; placeholder = "Search number, problem, store, vendor, or category";
    if (roleCan(session.role, "create_work_order")) primaryAction = { label: "Create work order", href: "/app/work-orders/new" };
  } else if (route === "requests") {
    const requests = await repository.listRequests(scope, { ...request, search: q, status: first(query.status), storeId: first(query.store) });
    result = requests; rows = requests.items.map(requestRow); title = "Service requests"; eyebrow = "Reported issues"; description = "Review what store teams reported, then create work, escalate it, or close it without changing the original report."; placeholder = "Search problem, reporter, request, or store";
    if (roleCan(session.role, "create_request")) primaryAction = { label: "Report an issue", href: "/app/requests/new" };
  } else if (route === "visits") {
    const visits = await repository.listVisits(scope, { ...request, search: q, status: first(query.status), storeId: first(query.store), vendorId: first(query.vendor) });
    result = visits; rows = visits.items.map(visitRow); title = first(query.status) === "active" ? "Vendors onsite now" : "Service visits"; eyebrow = "Observed service"; description = "See who arrived, why, the evidence captured, and which visits need review—without treating presence as certified labor."; placeholder = "Search technician, vendor, store, or work order";
  } else if (route === "stores") {
    const stores = await repository.searchStores(scope, q, request);
    result = stores; rows = stores.items.map(storeRow); title = "Stores"; eyebrow = "Operating network"; description = "Find any location by store number, address, name, city, or alias and open its maintenance history."; placeholder = "Search store number, name, address, city, or alias";
    if (roleCan(session.role, "create_store")) primaryAction = { label: "Add store", href: "/app/stores/new" };
  } else {
    const vendors = await repository.listVendors(scope, q, request);
    result = vendors; rows = vendors.items.map(vendorRow); title = "Approved vendors"; eyebrow = "Vendor network"; description = "Search by name, specialty, plain-language alias, equipment type, and coverage."; placeholder = "Search vendor, plumber, refrigeration, dispenser, or equipment";
    if (roleCan(session.role, "onboard_vendor")) primaryAction = { label: "Add vendor", href: "/app/vendors/new" };
  }

  const total = result.totalCount;
  const summary = total === undefined ? `${rows.length}${result.nextCursor ? "+" : ""} matching source records` : `${total} source record${total === 1 ? "" : "s"}`;
  return {
    state: rows.length || !q ? { kind: "ready" } : { kind: "empty", title: "No matching records", message: "Try another store number, address, vendor, or keyword." },
    page: { ...commonPage(session, title, eyebrow, description), primaryAction },
    table: { id: route, caption: title, columns: columns[route as QueryListRoute], rows },
    resultSummary: summary,
    search: searchControl(route, query, `Search ${title}`, placeholder),
    pagination: pagination(route, query, result, page),
  };
}

function searchAssetRow(row: AssetSearchRow): TableRowViewModel {
  return { id: row.id, label: row.name, href: `/app/equipment/${row.id}`, cells: [
    { key: "result", value: row.name, secondary: `${row.assetTag} · ${[row.manufacturer, row.model].filter(Boolean).join(" ") || "Details not entered"}` },
    { key: "context", value: `Store ${row.storeNumber} · ${row.storeName}`, secondary: row.groupPath.join(" › ") || sentence(row.categoryKey) },
  ] };
}

export async function buildQuerySearchModel(repository: OpsRepository, session: OperatorSession, query: OperatorSearchParameters): Promise<SearchPageViewModel> {
  const raw = first(query.q)?.trim() ?? "";
  if (!raw) return { state: { kind: "empty", title: "Search the whole operation", message: "Try a store number, address, work order, vendor specialty, equipment tag, serial number, technician, or request." }, page: commonPage(session, "Search the workspace", "One search · Your full scope", "Find a store, work order, request, vendor, visit, or piece of equipment without deciding which module to open first."), query: "", placeholder: "Store, address, work order, vendor, equipment, or serial number", resultSummary: "Enter a search term", groups: [] };
  const scope = scopeFor(session);
  const [stores, work, vendors, assets, visits, requests] = await Promise.all([
    repository.searchStores(scope, raw, { limit: 8 }),
    repository.listWorkOrders(scope, { search: raw, limit: 8 }),
    repository.listVendors(scope, raw, { limit: 8 }),
    repository.searchAssets(scope, raw, { limit: 8 }),
    session.role === "finance" ? Promise.resolve({ items: [], totalCount: 0 }) : repository.listVisits(scope, { search: raw, limit: 8 }),
    session.demoEdition === "accountability" || session.role === "finance" ? Promise.resolve({ items: [], totalCount: 0 }) : repository.listRequests(scope, { search: raw, limit: 8 }),
  ]);
  const groups = [
    { id: "stores", label: "Stores", rows: stores.items.map(storeRow), resultCount: stores.totalCount ?? stores.items.length },
    { id: "work", label: "Work orders", rows: work.items.map(workRow), resultCount: work.totalCount ?? work.items.length },
    { id: "vendors", label: "Vendors", rows: vendors.items.map(vendorRow), resultCount: vendors.totalCount ?? vendors.items.length },
    ...(session.demoEdition === "accountability" ? [] : [{ id: "equipment", label: "Equipment", rows: assets.items.map(searchAssetRow), resultCount: assets.totalCount ?? assets.items.length }]),
    ...(session.role === "finance" ? [] : [{ id: "visits", label: "Service visits", rows: visits.items.map(visitRow), resultCount: visits.totalCount ?? visits.items.length }]),
    ...(session.demoEdition === "accountability" || session.role === "finance" ? [] : [{ id: "requests", label: "Requests", rows: requests.items.map(requestRow), resultCount: requests.totalCount ?? requests.items.length }]),
  ].filter((group) => group.rows.length > 0);
  const total = groups.reduce((sum, group) => sum + group.resultCount, 0);
  return { state: total ? { kind: "ready" } : { kind: "empty", title: "No matches found", message: `Nothing in your access scope matched “${raw}”. Try a shorter name, number, address, or equipment term.` }, page: commonPage(session, `Search results for “${raw}”`, "One search · Your full scope", "Every result is tenant- and role-scoped before it reaches this page."), query: raw, placeholder: "Store, address, work order, vendor, equipment, or serial number", resultSummary: `${total} match${total === 1 ? "" : "es"} across ${groups.length} record type${groups.length === 1 ? "" : "s"}`, groups };
}

export async function buildQueryDashboardModel(repository: OpsRepository, session: OperatorSession): Promise<DashboardPageViewModel> {
  const scope = scopeFor(session);
  const period = { startsAt: "2026-01-01T00:00:00.000Z", endsAt: NORTHLINE_AS_OF };
  const [snapshot, exceptions, work] = await Promise.all([
    repository.getExecutiveSnapshot(scope, period),
    repository.listExceptions(scope, { statuses: ["open", "acknowledged"], limit: 6 }),
    repository.listWorkOrders(scope, { statuses: ["draft", "awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"], limit: 6 }),
  ]);
  const priorityActions = [
    ...exceptions.items.map((item) => ({ id: item.id, title: item.summary, description: [item.storeNumber ? `Store ${item.storeNumber}` : undefined, item.workOrderNumber].filter(Boolean).join(" · "), categoryLabel: "Record to review", dueLabel: `Detected ${formatOperationsDate(item.detectedAt)}`, ownerLabel: "Facilities team", tone: item.severity === "urgent" ? "critical" as const : "warning" as const, link: { href: item.workOrderId ? `/app/work-orders/${item.workOrderId}` : item.visitId ? `/app/visits/${item.visitId}` : "/app/action-center", label: "Open source record" } })),
    ...work.items.slice(0, Math.max(0, 6 - exceptions.items.length)).map((item) => ({ id: item.id, title: item.nextAction, description: `${item.number} · Store ${item.storeNumber}`, categoryLabel: "Open work order", dueAt: item.dueAt, dueLabel: item.dueAt ? `Due ${formatOperationsDate(item.dueAt)}` : "No due date recorded", ownerLabel: item.accountableParty, tone: item.priority === "emergency" ? "critical" as const : "info" as const, link: { href: `/app/work-orders/${item.id}`, label: "Open work order" } })),
  ];
  return {
    state: { kind: "ready" },
    page: commonPage(session, "Operations overview", "Facilities control tower", "See the work, visits, costs, and exceptions that need attention across your access scope."),
    metrics: [
      { id: "open-work", label: "Open work orders", value: String(snapshot.openWorkOrders), supportingText: `${snapshot.sourceCounts.workOrders} work orders in the selected period`, tone: snapshot.openWorkOrders ? "warning" : "positive", link: { href: "/app/work-orders?status=open", label: "Open source work" } },
      { id: "onsite", label: "Onsite now", value: String(snapshot.activeVisits), supportingText: `${snapshot.sourceCounts.visits} recorded visits in the selected period`, tone: snapshot.activeVisits ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open active visits" } },
      { id: "review", label: "Needs review", value: String(snapshot.openExceptions + snapshot.overdueFollowUps), supportingText: `${snapshot.openExceptions} exceptions · ${snapshot.overdueFollowUps} overdue follow-ups`, tone: snapshot.openExceptions + snapshot.overdueFollowUps ? "critical" : "positive", link: { href: "/app/action-center", label: "Open review queue" } },
      { id: "cost", label: "Recorded work cost", value: money(snapshot.recordedCost.amountMinor), supportingText: `${snapshot.sourceCounts.costLines} entered cost lines`, link: { href: "/app/spend", label: "Explain recorded cost" } },
    ],
    priorityActions,
    prioritySection: { title: "Review queue", description: "The highest-priority source records currently waiting for a decision or update.", link: { href: "/app/action-center", label: "Open full review queue" }, display: "summary" },
    breakdowns: [],
    trends: [],
  };
}
