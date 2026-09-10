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
import { roleCan, roleCanOpenOperatorHref } from "@/components/ops/role-policy";
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

function queryCurrency(query: OperatorSearchParameters) {
  const value = first(query.currency);
  return value && /^[A-Z]{3}$/.test(value) ? value : "USD";
}

function money(minor: number, currencyCode = "USD") {
  return (currencyCode === "USD" ? currency : new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 })).format(minor / 100);
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

function hrefWithFilter(route: OperatorListRoute, query: OperatorSearchParameters, key: string, value?: string) {
  const entries = Object.entries(query).flatMap(([name, raw]) => {
    if (name === "page" || name === key) return [];
    const current = first(raw);
    return current ? [[name, current] as [string, string]] : [];
  });
  if (value) entries.push([key, value]);
  const serialized = new URLSearchParams(entries).toString();
  return serialized ? `/app/${route}?${serialized}` : `/app/${route}`;
}

function queryFilters(route: OperatorListRoute, query: OperatorSearchParameters) {
  const selectedStatus = first(query.status);
  const statusOptions = route === "visits"
    ? [{ value: "", label: "All visits" }, { value: "active", label: "Onsite now" }, { value: "checked_out", label: "Completed" }]
    : route === "work-orders"
      ? [{ value: "", label: "All work" }, { value: "open", label: "Open" }, { value: "waiting_on_vendor", label: "Waiting on vendor" }, { value: "waiting_on_parts", label: "Waiting on parts" }, { value: "completed_pending_review", label: "Needs verification" }, { value: "closed", label: "Closed" }]
      : route === "requests"
        ? [{ value: "", label: "All reports" }, { value: "submitted", label: "New" }, { value: "under_review", label: "Under review" }, { value: "acknowledged_unlinked", label: "Acknowledged without linked work" }, { value: "converted", label: "Converted to work" }, { value: "closed", label: "Closed" }]
        : [];
  return statusOptions.length ? [{
    id: "status",
    label: "Status",
    options: statusOptions.map((option) => ({ value: option.value || "all", label: option.label, href: hrefWithFilter(route, query, "status", option.value || undefined), selected: (selectedStatus ?? "") === option.value })),
  }] : undefined;
}

function queryAppliedFilters(route: OperatorListRoute, query: OperatorSearchParameters) {
  const labels: Record<string, string> = {
    active: "Onsite now", checked_out: "Completed visits", open: "Open work", waiting_on_vendor: "Waiting on vendor",
    waiting_on_parts: "Waiting on parts", completed_pending_review: "Needs verification", submitted: "New reports",
    under_review: "Reports under review", acknowledged_unlinked: "Acknowledged without linked work", converted: "Reports converted to work", unlinked: "Not linked",
  };
  return Object.entries(query).flatMap(([key, raw]) => {
    if (["q", "page", "selected", "basis", "period", "currency", "saved", "updated", "notice", "error"].includes(key)) return [];
    const value = first(raw);
    if (!value) return [];
    const label = key === "hasCost" ? "With recorded cost"
      : key === "costMonth" ? `Cost month · ${formatOperationsDate(`${value}-01`)}`
      : key === "costFrom" ? `Cost from ${formatOperationsDate(value)}`
      : key === "costTo" ? `Cost through ${formatOperationsDate(value)}`
      : key === "path" ? value.split("|").join(" › ")
      : key === "store" ? "Selected store"
      : key === "region" ? "Selected region"
      : key === "asset" ? value === "unlinked" ? "Not linked to equipment" : "Selected equipment"
      : key === "component" ? value === "unlinked" ? "Not linked to a component" : "Selected component"
      : key === "vendor" ? "Selected vendor"
      : key === "review" && value === "true"
      ? "Needs review"
      : key === "visitPlan" && value === "ready"
        ? "Approved for next suitable visit"
        : key === "storeGroup" && value === "multiple"
          ? "Stores with 2+ approved jobs"
          : labels[value] ?? sentence(value);
    const removeHref = key === "visitPlan" && value === "ready" ? workTimingHref(query, false) : hrefWithFilter(route, query, key);
    return [{ id: key, label, removeHref }];
  });
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

function costPeriod(query: OperatorSearchParameters) {
  const month = first(query.costMonth);
  const validMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  const from = [first(query.costFrom), validMonth ? `${validMonth}-01` : undefined].filter((value): value is string => Boolean(value)).sort().at(-1);
  const monthEnd = validMonth ? new Date(Date.UTC(Number(validMonth.slice(0, 4)), Number(validMonth.slice(5)), 0)).toISOString().slice(0, 10) : undefined;
  const to = [first(query.costTo), monthEnd].filter((value): value is string => Boolean(value)).sort()[0];
  return [from && to ? `${formatOperationsDate(from)}–${formatOperationsDate(to)}` : from ? `From ${formatOperationsDate(from)}` : to ? `Through ${formatOperationsDate(to)}` : "All recorded dates", queryCurrency(query)].join(" · ");
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

function creationHref(path: string, query: OperatorSearchParameters) {
  const params = new URLSearchParams();
  for (const key of ["store", "asset", "vendor"]) {
    const value = first(query[key]);
    if (value && value !== "unlinked") params.set(key, value);
  }
  return params.size ? `${path}?${params}` : path;
}

function workRow(row: WorkOrderListRow): TableRowViewModel {
  return {
    id: row.id,
    label: row.number,
    href: `/app/work-orders/${row.id}`,
    cells: [
      { key: "work", value: row.number, secondary: row.problem },
      { key: "store", value: `Store ${row.storeNumber}`, secondary: row.storeName, link: { href: `/app/stores/${row.storeId}`, label: "Open store" } },
      { key: "assignment", link: row.vendorId ? { href: `/app/vendors/${row.vendorId}`, label: "Open vendor" } : undefined, value: row.vendorName ?? (row.assignmentKind === "internal" ? "Internal maintenance" : "Choose later") },
      { key: "next", value: row.nextAction, secondary: `Next: ${row.accountableParty} · Internal: ${row.internalAccountableParty}${row.dueAt ? ` · Due ${formatOperationsDate(row.dueAt)}` : " · No deadline by policy"}` },
      { key: "cost", value: money(row.recordedCostMinor, row.currency), link: { href: `/app/work-orders/${row.id}?view=cost`, label: "Review recorded cost" } },
      { key: "status", value: sentence(row.status), tone: toneForStatus(row.status) },
    ],
  };
}

function heldWorkRow(row: WorkOrderListRow): TableRowViewModel {
  const posture = row.visitHoldPosture === "look_and_report"
    ? "Inspect and report back"
    : "Complete during the visit if practical";
  return {
    id: row.id,
    label: row.number,
    href: `/app/work-orders/${row.id}`,
    cells: [
      { key: "work", value: row.number, secondary: row.problem },
      { key: "store", value: `Store ${row.storeNumber}`, secondary: row.storeName, link: { href: `/app/stores/${row.storeId}`, label: "Open store" } },
      { key: "assignment", value: posture, secondary: row.vendorName ? `Current provider: ${row.vendorName}` : "Provider can be chosen when the work is sent" },
      { key: "next", value: row.visitHoldDeadlineAt ? `Review by ${formatOperationsDate(row.visitHoldDeadlineAt)}` : "Review date not recorded", secondary: `Internal owner: ${row.internalAccountableParty}` },
      { key: "cost", value: money(row.recordedCostMinor, row.currency), link: { href: `/app/work-orders/${row.id}?view=cost`, label: "Review recorded cost" } },
      { key: "status", value: "Approved for next suitable visit", tone: "info" },
    ],
  };
}

function workTimingHref(query: OperatorSearchParameters, ready: boolean) {
  const excluded = new Set(["page", "selected", "visitPlan", "storeGroup", "reviewWindow", "opportunity", "matchStore"]);
  const parameters = new URLSearchParams(Object.entries(query).flatMap(([key, raw]) => {
    if (excluded.has(key)) return [];
    const value = first(raw);
    return value ? [[key, value] as [string, string]] : [];
  }));
  if (ready) parameters.set("visitPlan", "ready");
  return `/app/work-orders${parameters.size ? `?${parameters}` : ""}`;
}

function requestRow(row: RequestListRow): TableRowViewModel {
  return { id: row.id, label: row.reference, href: `/app/requests/${row.id}`, cells: [
    { key: "request", value: row.reference, secondary: row.problem },
    { key: "store", value: `Store ${row.storeNumber}`, secondary: row.storeName, link: { href: `/app/stores/${row.storeId}`, label: "Open store" } },
    { key: "priority", value: sentence(row.priority), tone: toneForStatus(row.priority) },
    { key: "reported", value: formatOperationsDate(row.submittedAt), secondary: row.reporterName },
    { key: "status", value: row.status === "acknowledged" ? "Acknowledged — being handled" : sentence(row.status), tone: toneForStatus(row.status), secondary: row.status === "acknowledged" ? `${row.linkedWorkOrderId ? "Linked to work" : "No linked work order"}${row.acknowledgedByActorName ? ` · ${row.acknowledgedByActorName}` : ""}` : undefined },
  ] };
}

function storeRow(row: StoreSearchRow): TableRowViewModel {
  return { id: row.id, label: `Store ${row.storeNumber}`, href: `/app/stores/${row.id}`, cells: [
    { key: "store", value: `Store ${row.storeNumber}`, secondary: row.name },
    { key: "region", value: row.regionName ?? "No region" },
    { key: "address", value: row.formattedAddress },
    { key: "work", value: String(row.openWorkCount), link: { href: `/app/work-orders?store=${row.id}&status=open`, label: "Review open work" } },
    { key: "onsite", value: String(row.activeVisitCount), link: { href: `/app/visits?store=${row.id}&status=active`, label: "Review onsite visits" } },
    { key: "cost", value: money(row.recordedCostMinor, row.currency), link: { href: `/app/work-orders?store=${row.id}&hasCost=true`, label: "Review recorded cost sources" } },
  ] };
}

function vendorRow(row: VendorDirectoryRow): TableRowViewModel {
  return { id: row.id, label: row.name, href: `/app/vendors/${row.id}`, cells: [
    { key: "vendor", value: row.name, secondary: row.preferred ? "Preferred provider" : undefined },
    { key: "specialties", value: row.specialties.join(", ") || "No specialties recorded" },
    { key: "coverage", value: row.coverageLabels.join(", ") || "Coverage recorded by store and region" },
    { key: "open", value: String(row.openWorkOrders), link: { href: `/app/work-orders?vendor=${row.id}&status=open`, label: "Review vendor open work" } },
    { key: "visits", link: { href: `/app/visits?vendor=${row.id}&status=active`, label: "Review vendor onsite visits" }, value: String(row.activeVisits), secondary: row.returnVisitWorkOrders ? `${row.returnVisitWorkOrders} with return visits` : undefined },
    { key: "status", value: sentence(row.status), tone: toneForStatus(row.status) },
  ] };
}

function visitRow(row: VisitListRow): TableRowViewModel {
  const observed = row.checkedOutAt
    ? `${formatOperationsDateTime(row.checkedInAt, row.storeTimeZone)} – ${formatOperationsDateTime(row.checkedOutAt, row.storeTimeZone)}`
    : `Since ${formatOperationsDateTime(row.checkedInAt, row.storeTimeZone)}`;
  return { id: row.id, label: `${row.providerName} visit`, href: `/app/visits/${row.id}`, cells: [
    { key: "visit", value: row.technicianName, secondary: row.purpose },
    { key: "store", value: `Store ${row.storeNumber}`, secondary: row.storeName, link: { href: `/app/stores/${row.storeId}`, label: "Open store" } },
    { key: "vendor", value: row.providerName, link: row.vendorId ? { href: `/app/vendors/${row.vendorId}`, label: "Open vendor" } : undefined },
    { key: "work", value: row.workOrders?.length ? row.workOrders.map((work) => work.number).join(" · ") : row.workOrderNumber ?? "No work order linked", secondary: row.workOrders?.length === 1 ? row.workOrders[0].problem : row.workOrders?.length ? `${row.workOrders.length} linked jobs; each has its own outcome` : row.arrivalNote, link: row.workOrders?.length === 1 ? { href: `/app/work-orders/${row.workOrders[0].id}`, label: "Open work order" } : row.workOrders?.length ? { href: `/app/visits/${row.id}`, label: "Review all linked jobs" } : row.workOrderId ? { href: `/app/work-orders/${row.workOrderId}`, label: "Open work order" } : { href: `/app/visits/${row.id}`, label: "Review visit and work-order links" } },
    { key: "observed", value: observed, secondary: "Store-local display · approximate presence, not labor" },
    { key: "evidence", value: sentence(row.locationResult), tone: row.locationResult === "verified" ? "positive" : "warning" },
    { key: "outcome", value: row.workOrders?.length ? row.workOrders.map((work) => `${row.workOrders!.length > 1 ? `${work.number}: ` : ""}${work.outcome ? sentence(work.outcome) : "Outcome not recorded"}`).join(" · ") : row.outcome ? sentence(row.outcome) : row.status === "active" ? "Onsite now" : "Review work outcomes", tone: row.status === "active" ? "info" : "neutral", link: { href: `/app/visits/${row.id}`, label: "Review recorded work outcomes" } },
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
  let metrics: ListPageViewModel["metrics"];
  let secondaryAction: { label: string; href: string } | undefined;
  let contextualFilters: ListPageViewModel["filters"];
  const costEvidence = route === "work-orders" && Boolean(first(query.costMonth) || first(query.costFrom) || first(query.costTo) || first(query.hasCost) === "true");

  if (route === "work-orders") {
    const heldPlan = first(query.visitPlan) === "ready";
    const upcomingAppointments = first(query.appointment) === "upcoming";
    const heldReviewWindow = first(query.reviewWindow);
    const heldOpportunity = first(query.opportunity);
    const heldStoreGroup = first(query.storeGroup) === "multiple" ? "multiple" as const : undefined;
    const requestedStatus = first(query.status);
    const statuses = requestedStatus === "open"
      ? ["draft", "awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_vendor", "waiting_on_parts", "completed_pending_review", "resolved"]
      : requestedStatus ? [requestedStatus] : undefined;
    const [work, held] = await Promise.all([repository.listWorkOrders(scope, {
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
      costTo: first(query.costTo),
      costMonth: first(query.costMonth),
      currency: costEvidence ? queryCurrency(query) : undefined,
      categoryPath: first(query.path)?.split("|").filter(Boolean),
      heldOnly: heldPlan,
      heldStoreGroup,
      heldReviewDeadlineTo: heldPlan && heldReviewWindow === "30" ? new Date(Date.parse(NORTHLINE_AS_OF) + 30 * 86_400_000).toISOString() : undefined,
      heldConfirmedOpportunityAfter: heldPlan && heldOpportunity === "confirmed" ? NORTHLINE_AS_OF : undefined,
      upcomingAppointmentAfter: upcomingAppointments ? NORTHLINE_AS_OF : undefined,
    }), costEvidence ? Promise.resolve({ approvedWorkOrders: 0, storesWithApprovedWork: 0, storesWithMultipleApprovedJobs: 0 }) : repository.getHeldWorkPortfolioSummary(scope)]);
    result = work; rows = work.items.map(heldPlan ? heldWorkRow : workRow); title = heldPlan ? "Approved work waiting for a suitable visit" : upcomingAppointments ? "Work with a confirmed upcoming appointment" : "Work orders"; eyebrow = heldPlan ? "Held-work portfolio" : upcomingAppointments ? "Scheduled service" : "Maintenance work"; description = heldPlan ? "Review what is authorized, when each job must be reconsidered, and which stores can combine approved work without losing each job's outcome or cost trail." : upcomingAppointments ? "Every result has a vendor-confirmed appointment in the selected scope. Each work order appears once even if its schedule has revisions." : "Track internal and outside service from creation through visits, follow-up, and recorded cost."; placeholder = "Search number, problem, store, vendor, or category";
    if (heldPlan && roleCan(session, "issue_work_order")) {
      const currentContext = `/app/work-orders?${new URLSearchParams(paramsWithoutPage(query)).toString()}`;
      primaryAction = { label: "Send approved jobs together", href: `/app/store-sweeps/new?returnTo=${encodeURIComponent(currentContext)}` };
      secondaryAction = { label: "Return to all work", href: workTimingHref(query, false) };
    } else if (roleCan(session, "create_work_order")) primaryAction = { label: "Create work order", href: creationHref("/app/work-orders/new", query) };
    if (!costEvidence && (session.role === "facilities" || session.role === "regional")) {
      if (!heldPlan) secondaryAction = { label: "Send approved jobs together", href: "/app/store-sweeps/new?returnTo=%2Fapp%2Fwork-orders" };
      metrics = [
        { id: "ready-to-bundle", label: "Approved for next suitable visit", value: String(held.approvedWorkOrders), supportingText: `${held.storesWithApprovedWork} store${held.storesWithApprovedWork === 1 ? "" : "s"} across your full operating scope`, tone: held.approvedWorkOrders ? "info" : "positive", link: { href: "/app/work-orders?visitPlan=ready", label: "Open approved work" } },
        { id: "store-sweep-opportunities", label: "Stores with 2+ approved jobs", value: String(held.storesWithMultipleApprovedJobs), supportingText: "Portfolio-wide count; filters below apply only to the result list", tone: held.storesWithMultipleApprovedJobs ? "warning" : "positive", link: { href: "/app/work-orders?visitPlan=ready&storeGroup=multiple", label: "Review stores with multiple jobs" } },
      ];
      contextualFilters = [{
        id: "work-visit-plan",
        label: "Work timing",
        options: [
          { value: "all", label: "All work", href: workTimingHref(query, false), selected: !heldPlan },
          { value: "ready", label: `Approved for next suitable visit (${held.approvedWorkOrders})`, href: workTimingHref(query, true), selected: heldPlan },
        ],
      }, ...(heldPlan ? [{
        id: "held-analysis",
        label: "Portfolio review",
        options: [
          { value: "all", label: "All approved work", href: hrefWithFilter("work-orders", { ...query, reviewWindow: undefined, opportunity: undefined }, "reviewWindow"), selected: !heldReviewWindow && !heldOpportunity },
          { value: "due", label: "Review due within 30 days", href: hrefWithFilter("work-orders", { ...query, opportunity: undefined }, "reviewWindow", "30"), selected: heldReviewWindow === "30" },
          { value: "confirmed", label: "Confirmed visit opportunities", href: hrefWithFilter("work-orders", { ...query, reviewWindow: undefined }, "opportunity", "confirmed"), selected: heldOpportunity === "confirmed" },
        ],
      }] : [])];
    }
  } else if (route === "requests") {
    const requests = await repository.listRequests(scope, { ...request, search: q, status: first(query.status), storeId: first(query.store) });
    result = requests; rows = requests.items.map(requestRow); title = "Service requests"; eyebrow = "Reported issues"; description = "Review what store teams reported, then create work, escalate it, or close it without changing the original report."; placeholder = "Search problem, reporter, request, or store";
    if (roleCan(session, "create_request")) primaryAction = { label: "Report an issue", href: creationHref("/app/requests/new", query) };
  } else if (route === "visits") {
    const visitContext = { storeId: first(query.store), vendorId: first(query.vendor) };
    const [visits, visitSummary] = await Promise.all([
      repository.listVisits(scope, { ...request, search: q, status: first(query.status), review: first(query.review) === "true", ...visitContext }),
      repository.getVisitPortfolioSummary(scope, { ...visitContext, now: NORTHLINE_AS_OF }),
    ]);
    result = visits; rows = visits.items.map(visitRow); title = first(query.review) === "true" ? "Visits needing review" : first(query.status) === "active" ? "Vendors onsite now" : "Service visits"; eyebrow = "Observed service"; description = "See who arrived, why, the evidence captured, and which visits need review—without treating presence as certified labor."; placeholder = "Search technician, vendor, store, or work order";
    const withContext = (status?: string, review?: string) => {
      const params = new URLSearchParams(Object.entries({ store: visitContext.storeId, vendor: visitContext.vendorId, status, review }).filter((entry): entry is [string, string] => Boolean(entry[1])));
      return `/app/visits${params.size ? `?${params}` : ""}`;
    };
    const upcomingWork = new URLSearchParams(Object.entries({ store: visitContext.storeId, vendor: visitContext.vendorId, appointment: "upcoming" }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    metrics = [
      { id: "upcoming-visits", label: "Upcoming work", value: String(visitSummary.upcoming), supportingText: "Distinct work orders with a vendor-confirmed future appointment in the selected scope", tone: visitSummary.upcoming ? "info" : "neutral", link: { href: `/app/work-orders?${upcomingWork}`, label: "Open the exact work orders" } },
      { id: "active-visits", label: "Onsite now", value: String(visitSummary.active), supportingText: "Active check-ins in the selected scope", tone: visitSummary.active ? "info" : "neutral", link: { href: withContext("active"), label: "Show onsite" } },
      { id: "completed-visits", label: "Completed", value: String(visitSummary.completed), supportingText: "Checked-out history; filters below affect the result list", tone: "positive", link: { href: withContext("checked_out"), label: "Show history" } },
      { id: "visit-review", label: "Needs review", value: String(visitSummary.needsReview), supportingText: `${visitSummary.withoutWorkOrder} without a work order`, tone: visitSummary.needsReview ? "warning" : "positive", link: { href: withContext(undefined, "true"), label: "Review visits" } },
    ];
  } else if (route === "stores") {
    const [stores, storeSummary] = await Promise.all([
      repository.searchStores(scope, q, request),
      repository.getStorePortfolioSummary(scope),
    ]);
    result = stores; rows = stores.items.map(storeRow); title = "Stores"; eyebrow = "Operating network"; description = "Find any location by store number, address, name, city, or alias and open its maintenance history."; placeholder = "Search store number, name, address, city, or alias";
    if (roleCan(session, "create_store")) primaryAction = { label: "Add store", href: "/app/stores/new" };
    metrics = [
      { id: "stores-in-scope", label: "Stores in scope", value: String(storeSummary.stores), supportingText: "Portfolio-wide for your operating scope; search below filters the directory", tone: "neutral", link: { href: "/app/stores", label: "Open full directory" } },
      { id: "store-open-work", label: "Open work orders", value: String(storeSummary.openWorkOrders), supportingText: "Current open work across the scoped store portfolio", tone: storeSummary.openWorkOrders ? "warning" : "positive", link: { href: "/app/work-orders?status=open", label: "Open source work" } },
      { id: "store-onsite-now", label: "Vendors onsite now", value: String(storeSummary.activeVisits), supportingText: "Active server-timestamped check-ins across the scoped portfolio", tone: storeSummary.activeVisits ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open active visits" } },
      { id: "store-recorded-cost", label: "Recorded work cost · all history", value: money(storeSummary.recordedCostMinor), supportingText: "Entered cost lines across the full scoped history; not invoice totals", tone: "neutral", link: { href: "/app/work-orders?hasCost=true", label: "Open every work order with recorded cost" } },
    ];
  } else {
    const vendors = await repository.listVendors(scope, q, request);
    result = vendors; rows = vendors.items.map(vendorRow); title = "Approved vendors"; eyebrow = "Vendor network"; description = "Search by name, specialty, plain-language alias, equipment type, and coverage."; placeholder = "Search vendor, plumber, refrigeration, dispenser, or equipment";
    if (roleCan(session, "onboard_vendor")) primaryAction = { label: "Add vendor", href: "/app/vendors/new" };
  }

  if (costEvidence) {
    title = "Recorded work cost";
    eyebrow = "Cost source records";
    description = "Each amount includes only the recorded costs in these filters. Open a work order to review its cost entries, store, equipment, and service history.";
    primaryAction = undefined;
    secondaryAction = { label: "Review spending", href: `/app/spend?${new URLSearchParams(Object.entries({
      store: first(query.store), region: first(query.region), category: first(query.category), path: first(query.path),
      asset: first(query.asset), component: first(query.component), period: first(query.period) ?? "12m", basis: "recorded",
    }).filter((entry): entry is [string, string] => Boolean(entry[1])))}` };
    rows = rows.map((row) => ({ ...row, href: `${row.href}?view=cost` }));
  }
  const total = result.totalCount;
  const heldPlan = route === "work-orders" && first(query.visitPlan) === "ready";
  const summary = heldPlan
    ? `${rows.length}${result.nextCursor ? "+" : ""} approved job${rows.length === 1 && !result.nextCursor ? "" : "s"} on this page · portfolio counts shown above`
    : total === undefined ? `${rows.length}${result.nextCursor ? "+" : ""} matching source records` : `${total} source record${total === 1 ? "" : "s"}`;
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.link && !roleCanOpenOperatorHref(session.role, cell.link.href)) cell.link = undefined;
    }
  }
  const storeCell = first(query.store) ? rows[0]?.cells.find((cell) => cell.key === "store") : undefined;
  const appliedFilters = queryAppliedFilters(route, query).map((filter) => filter.id === "store" && storeCell
    ? { ...filter, label: storeCell.value } : filter);
  return {
    state: rows.length || !q ? { kind: "ready" } : { kind: "empty", title: "No matching records", message: "Try another store number, address, vendor, or keyword." },
    rowNavigation: costEvidence ? "record" : undefined,
    page: { ...commonPage(session, title, eyebrow, description), primaryAction, secondaryAction,
      ...(costEvidence ? { scopeLabel: [first(query.store) ? storeCell ? `${storeCell.value} · ${storeCell.secondary ?? ""}` : "Selected store · no matching costs" : session.scopeLabel,
        first(query.category) ? sentence(first(query.category)!) : undefined, first(query.path)?.split("|").join(" › ")].filter(Boolean).join(" · ") } : {}),
      periodLabel: costEvidence ? costPeriod(query) : undefined },
    metrics,
    table: { id: route, caption: title, columns: heldPlan ? [
      { key: "work", label: "Approved work" }, { key: "store", label: "Store" }, { key: "assignment", label: "Authorized during visit" }, { key: "next", label: "Review and owner" }, { key: "cost", label: "Recorded cost", align: "end" as const }, { key: "status", label: "Timing" },
    ] : columns[route as QueryListRoute], rows },
    resultSummary: summary,
    search: searchControl(route, query, `Search ${title}`, placeholder),
    filters: [...(contextualFilters ?? []), ...(queryFilters(route, query) ?? [])],
    appliedFilters,
    clearFiltersHref: heldPlan ? "/app/work-orders?visitPlan=ready" : `/app/${route}`,
    pagination: pagination(route, query, result, page),
  };
}

function searchAssetRow(row: AssetSearchRow): TableRowViewModel {
  return { id: row.id, label: row.name, href: `/app/equipment/${row.id}`, cells: [
    { key: "result", value: row.name, secondary: `${row.assetTag} · ${[row.manufacturer, row.model].filter(Boolean).join(" ") || "Details not entered"}` },
    { key: "context", value: `Store ${row.storeNumber} · ${row.storeName}`, secondary: row.groupPath.join(" › ") || sentence(row.categoryKey), link: { href: `/app/stores/${row.storeId}`, label: "Open store" } },
    { key: "serial", value: row.serialNumber ?? "Not recorded" },
    { key: "status", value: sentence(row.status), tone: toneForStatus(row.status) },
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
    session.demoEdition === "accountability" ? Promise.resolve({ items: [], totalCount: 0, nextCursor: undefined }) : repository.searchAssets(scope, raw, { limit: 8 }),
    session.role === "finance" ? Promise.resolve({ items: [], totalCount: 0, nextCursor: undefined }) : repository.listVisits(scope, { search: raw, limit: 8 }),
    session.demoEdition === "accountability" || session.role === "finance" ? Promise.resolve({ items: [], totalCount: 0, nextCursor: undefined }) : repository.listRequests(scope, { search: raw, limit: 8 }),
  ]);
  const totals: Record<string, number | undefined> = { stores: stores.totalCount, work: work.totalCount, vendors: vendors.totalCount, equipment: assets.totalCount, visits: visits.totalCount, requests: requests.totalCount };
  const groups = [
    { id: "stores", label: "Stores", rows: stores.items.map(storeRow), resultCount: stores.totalCount ?? stores.items.length, columns: columns.stores, hasMore: Boolean(stores.nextCursor), moreLink: { href: `/app/stores?${new URLSearchParams({ q: raw })}`, label: "Review matching stores" } },
    { id: "work", label: "Work orders", rows: work.items.map(workRow), resultCount: work.totalCount ?? work.items.length, columns: columns["work-orders"], hasMore: Boolean(work.nextCursor), moreLink: { href: `/app/work-orders?${new URLSearchParams({ q: raw })}`, label: "Review matching work orders" } },
    { id: "vendors", label: "Vendors", rows: vendors.items.map(vendorRow), resultCount: vendors.totalCount ?? vendors.items.length, columns: columns.vendors, hasMore: Boolean(vendors.nextCursor), moreLink: { href: `/app/vendors?${new URLSearchParams({ q: raw })}`, label: "Review matching vendors" } },
    ...(session.demoEdition === "accountability" ? [] : [{ id: "equipment", label: "Equipment", rows: assets.items.map(searchAssetRow), resultCount: assets.totalCount ?? assets.items.length, columns: [{ key: "result", label: "Equipment" }, { key: "context", label: "Store and equipment classification" }, { key: "serial", label: "Serial number" }, { key: "status", label: "Operating state" }], hasMore: Boolean(assets.nextCursor), moreLink: { href: `/app/equipment?${new URLSearchParams({ q: raw })}`, label: "Review matching equipment" } }]),
    ...(session.role === "finance" ? [] : [{ id: "visits", label: "Service visits", rows: visits.items.map(visitRow), resultCount: visits.totalCount ?? visits.items.length, columns: columns.visits, hasMore: Boolean(visits.nextCursor), moreLink: { href: `/app/visits?${new URLSearchParams({ q: raw })}`, label: "Review matching visits" } }]),
    ...(session.demoEdition === "accountability" || session.role === "finance" ? [] : [{ id: "requests", label: "Requests", rows: requests.items.map(requestRow), resultCount: requests.totalCount ?? requests.items.length, columns: columns.requests, hasMore: Boolean(requests.nextCursor), moreLink: { href: `/app/requests?${new URLSearchParams({ q: raw })}`, label: "Review matching requests" } }]),
  ].filter((group) => group.rows.length > 0).map((group) => ({ ...group,
    countIsLowerBound: group.hasMore && totals[group.id] === undefined,
    rows: group.rows.map((row) => ({ ...row, cells: row.cells.map((cell) => cell.link && !roleCanOpenOperatorHref(session.role, cell.link.href) ? { ...cell, link: undefined } : cell) })) }));
  const total = groups.reduce((sum, group) => sum + group.resultCount, 0);
  return { state: total ? { kind: "ready" } : { kind: "empty", title: "No matches found", message: `Nothing in your access scope matched “${raw}”. Try a shorter name, number, address, or equipment term.` }, page: commonPage(session, `Search results for “${raw}”`, "One search · Your full scope", "Review matching records and their connected information."), query: raw, placeholder: "Store, address, work order, vendor, equipment, or serial number", resultSummary: `${groups.some((group) => group.countIsLowerBound) ? "At least " : ""}${total} match${total === 1 ? "" : "es"} across ${groups.length} record type${groups.length === 1 ? "" : "s"}`, groups };
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
