import type { OrganizationScope } from "../repository";
import type { OpsFixture, Store, WorkOrder } from "../types";
import { invoiceReporting } from "../invoice-reporting";
import type { ReportOptions, WorkFilter } from "./options";

export type Provider = "vendor" | "in_house";

/** One work order with everything the reports need, read once from source records. */
export interface JobFact {
  id: string;
  number: string;
  problem: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  regionId?: string;
  regionName?: string;
  category?: string;
  assetId?: string;
  assetName?: string;
  priority: WorkOrder["priority"];
  status: WorkOrder["status"];
  createdAt: string;
  completedAt?: string;
  dueAt?: string;
  open: boolean;
  /** Open, and the next step's deadline has passed. */
  pastDue: boolean;
  /** Who is (or last was) doing the job; "unassigned" while nobody has it yet. */
  provider: Provider | "unassigned";
  /** Both an outside vendor and the in-house team worked on it. */
  blended: boolean;
  vendorId?: string;
  vendorName?: string;
  techId?: string;
  techName?: string;
  pm: boolean;
  vendorTicket?: string;
  externalPo?: string;
  nteMinor?: number;
  costs: Array<{ date: string; amountMinor: number; provider: Provider; vendorId?: string; kind: string }>;
  visits: Array<{ at: string; provider: Provider; seconds?: number; vendorId?: string; techId?: string; outcome?: string }>;
  invoices: Array<{ invoiceId: string; number: string; date: string; amountMinor: number; vendorId: string }>;
}

export interface ReportContext {
  organizationId: string;
  organizationName: string;
  today: string;
  now: string;
  stores: Store[];
  /** Short store label, e.g. "Store 104 · Ridgeview". */
  storeLabel: (id: string) => string;
  vendorName: (id?: string) => string;
  personName: (membershipId?: string) => string;
  jobs: JobFact[];
  /** Invoice amounts not yet tied to a work order, by vendor. */
  unlinkedInvoices: Array<{ invoiceId: string; vendorId: string; date: string; amountMinor: number }>;
  fixture: OpsFixture;
  scope: OrganizationScope;
}

const DONE = new Set(["closed", "cancelled", "resolved", "completed_pending_review"]);

/** Builds the facts for the stores this person may see, narrowed by the report's store or area choice. */
export function buildReportContext(fixture: OpsFixture, scope: OrganizationScope, options: Pick<ReportOptions, "store" | "region">, now: string, today: string): ReportContext {
  const org = scope.organizationId;
  const organization = fixture.organizations.find(o => o.id === org);
  const regionName = new Map(fixture.regions.filter(r => r.organizationId === org).map(r => [r.id, r.name]));
  const stores = fixture.stores.filter(s => s.organizationId === org
    && (scope.storeIds === undefined || scope.storeIds.includes(s.id))
    && (scope.regionIds === undefined || Boolean(s.regionId && scope.regionIds.includes(s.regionId)))
    && (!options.store || s.id === options.store)
    && (!options.region || s.regionId === options.region))
    .sort((a, b) => a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true }));
  const storeById = new Map(stores.map(s => [s.id, s]));
  const prefix = organization ? `${organization.name} - ` : "";
  const storeLabel = (id: string) => { const s = storeById.get(id); return s ? `Store ${s.storeNumber} · ${s.name.replace(prefix, "")}` : "Store"; };
  const vendors = new Map(fixture.vendors.filter(v => v.organizationId === org).map(v => [v.id, v.name]));
  const users = new Map(fixture.users.map(u => [u.id, u.displayName]));
  const people = new Map(fixture.memberships.filter(m => m.organizationId === org).map(m => [m.id, users.get(m.userId) ?? "Team member"]));
  const assets = new Map(fixture.assets.filter(a => a.organizationId === org).map(a => [a.id, a.name]));
  const pmWork = new Set(fixture.pmOccurrences.filter(p => p.organizationId === org && p.workOrderId).map(p => p.workOrderId!));

  const group = <T extends { workOrderId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(row.workOrderId, [...(map.get(row.workOrderId) ?? []), row]);
    return map;
  };
  const assignments = group(fixture.assignments.filter(a => a.organizationId === org));
  const costs = group(fixture.costLines.filter(c => c.organizationId === org && c.amount.currency === "USD"));
  const links = group(fixture.siteVisitWorkOrders.filter(l => l.organizationId === org));
  const visitById = new Map(fixture.visits.filter(v => v.organizationId === org).map(v => [v.id, v]));
  const reporting = invoiceReporting(fixture, org);
  const invoices = group(reporting.allocations.filter(a => a.amount.currency === "USD"));

  const jobs: JobFact[] = fixture.workOrders.filter(w => w.organizationId === org && storeById.has(w.storeId)).map(work => {
    const store = storeById.get(work.storeId)!;
    const active = (assignments.get(work.id) ?? []).filter(a => a.kind !== "choose_later" && a.status !== "declined" && a.status !== "cancelled")
      .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
    const last = active.at(-1);
    const lastVendor = active.filter(a => a.kind === "outside_vendor").at(-1);
    const lastTech = active.filter(a => a.kind === "internal").at(-1);
    const provider: JobFact["provider"] = last?.kind === "outside_vendor" ? "vendor" : last?.kind === "internal" ? "in_house" : "unassigned";
    const fallback: Provider = provider === "in_house" ? "in_house" : "vendor";
    const visitRows = (links.get(work.id) ?? []).flatMap(link => {
      const visit = visitById.get(link.visitId);
      return visit ? [{ at: visit.checkedInAt, provider: (visit.providerKind === "internal" ? "in_house" : "vendor") as Provider, seconds: visit.observedDurationSeconds, vendorId: visit.vendorId, techId: visit.internalMembershipId, outcome: link.outcome }] : [];
    });
    return {
      id: work.id, number: work.number, problem: work.problem, storeId: store.id, storeNumber: store.storeNumber, storeName: storeLabel(store.id),
      regionId: store.regionId, regionName: store.regionId ? regionName.get(store.regionId) : undefined,
      category: work.categoryKey, assetId: work.assetId, assetName: work.assetId ? assets.get(work.assetId) : undefined,
      priority: work.priority, status: work.status, createdAt: work.createdAt, completedAt: work.resolvedAt ?? work.closedAt, dueAt: work.dueAt,
      open: !DONE.has(work.status), pastDue: !DONE.has(work.status) && Boolean(work.dueAt && work.dueAt < now),
      provider, blended: active.some(a => a.kind === "outside_vendor") && active.some(a => a.kind === "internal"),
      vendorId: lastVendor?.vendorId, vendorName: lastVendor?.vendorId ? vendors.get(lastVendor.vendorId) : undefined,
      techId: lastTech?.internalMembershipId, techName: lastTech?.internalMembershipId ? people.get(lastTech.internalMembershipId) : undefined,
      pm: pmWork.has(work.id) || work.priority === "planned", vendorTicket: work.vendorServiceTicketNumber, externalPo: work.externalAccountingPo, nteMinor: work.nte?.amountMinor,
      costs: (costs.get(work.id) ?? []).map(line => ({ date: line.serviceDate.slice(0, 10), amountMinor: line.amount.amountMinor,
        provider: line.providerType === "internal" ? "in_house" as const : line.providerType === "vendor" ? "vendor" as const : fallback,
        vendorId: line.vendorId ?? (line.providerType !== "internal" && fallback === "vendor" ? lastVendor?.vendorId : undefined), kind: line.kind })),
      visits: visitRows,
      invoices: (invoices.get(work.id) ?? []).map(a => ({ invoiceId: a.invoiceId, number: a.invoiceNumber, date: a.invoiceDate, amountMinor: a.amount.amountMinor, vendorId: a.vendorId })),
    };
  });
  return {
    organizationId: org, organizationName: organization?.name ?? "", today, now, stores, storeLabel,
    vendorName: id => (id && vendors.get(id)) || "Vendor", personName: id => (id && people.get(id)) || "Technician",
    jobs, unlinkedInvoices: reporting.pending.filter(p => p.amount.currency === "USD" && p.amount.amountMinor > 0).map(p => ({ invoiceId: p.id, vendorId: p.vendorId, date: p.invoiceDate, amountMinor: p.amount.amountMinor })),
    fixture, scope,
  };
}

/** Recorded cost in a date range, optionally only one side of the work. */
export function costIn(job: Pick<JobFact, "costs">, range: { from: string; to: string }, work: WorkFilter = "both") {
  let total = 0;
  for (const line of job.costs) if (line.date >= range.from && line.date <= range.to && (work === "both" || line.provider === work)) total += line.amountMinor;
  return total;
}

/** Whether a job belongs to the chosen side of the work. Blended jobs belong to both sides. */
export function jobMatchesWork(job: JobFact, work: WorkFilter) {
  if (work === "both") return true;
  return job.provider === work || job.blended || job.costs.some(c => c.provider === work) || job.visits.some(v => v.provider === work);
}

export const completedIn = (job: JobFact, range: { from: string; to: string }) => Boolean(job.completedAt && job.completedAt.slice(0, 10) >= range.from && job.completedAt.slice(0, 10) <= range.to && job.status !== "cancelled");
export const openedIn = (job: JobFact, range: { from: string; to: string }) => job.createdAt.slice(0, 10) >= range.from && job.createdAt.slice(0, 10) <= range.to;
export const daysToComplete = (job: JobFact) => job.completedAt ? Math.max(0, (Date.parse(job.completedAt) - Date.parse(job.createdAt)) / 86_400_000) : undefined;

export function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
