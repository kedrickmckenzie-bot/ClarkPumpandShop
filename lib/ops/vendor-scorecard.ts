import type { OrganizationScope } from "./repository";
import type { OpsSqlDriver } from "./sql-driver";
import { scopeWhere } from "./sql-scope";
import type { OpsFixture } from "./types";

/**
 * Vendor scorecards. Each job sent to a vendor becomes one fact row, built by the
 * same rules from the fixture and from SQL. The page summarizes those rows and every
 * number opens the exact rows behind it, so a summary can never disagree with its jobs.
 */

export interface ScorecardWindow { from: string; to: string; /** Only this vendor's jobs. */ vendorId?: string }

/** One job sent to one vendor in the window. */
export interface VendorJobFact {
  workOrderId: string;
  number: string;
  problem: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  regionId?: string;
  regionName?: string;
  vendorId: string;
  vendorName: string;
  trade: string;
  assetId?: string;
  sentAt: string;
  firstResponseAt?: string;
  declined: boolean;
  appointmentAt?: string;
  firstCheckInAt?: string;
  firstOutcome?: string;
  completedAt?: string;
  checkDecision?: "verified" | "rejected";
  callbackWorkOrderId?: string;
  callbackAt?: string;
  costMinor: number;
  costLineCount: number;
  invoiceIssue: boolean;
}

export const MEASURES = ["jobs", "response", "onTime", "firstFix", "fixHeld", "callbacks", "cost", "declined", "invoice"] as const;
export type ScorecardMeasureKey = typeof MEASURES[number];
export const PERIODS = [30, 90, 180, 365] as const;
export type ScorecardPeriod = typeof PERIODS[number];

/** Rates and medians are withheld below this many jobs, so a vendor is never judged on two calls. */
export const SMALL_SAMPLE = 5;
const ON_TIME_GRACE_MS = 60 * 60_000;
const CALLBACK_DAYS = 30;
const DAY_MS = 86_400_000;

export const TRADE_LABELS: Record<string, string> = {
  refrigeration: "Refrigeration", hvac: "HVAC", forecourt: "Fuel & forecourt", plumbing: "Plumbing",
  electrical: "Electrical & lighting", exterior: "Exterior & lot", foodservice: "Foodservice equipment",
  store_sanitation: "Store cleaning", unclassified: "Not classified yet",
};
export const tradeLabel = (key: string) => TRADE_LABELS[key] ?? key.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());

export function isPeriod(value: unknown): value is ScorecardPeriod { return PERIODS.includes(Number(value) as ScorecardPeriod); }
export function isMeasure(value: unknown): value is ScorecardMeasureKey { return typeof value === "string" && (MEASURES as readonly string[]).includes(value); }

/** The last `days` days through `now`, and the same length just before it. */
export function scorecardWindows(now: string, days: ScorecardPeriod) {
  const end = Date.parse(now);
  const current = { from: new Date(end - days * DAY_MS).toISOString(), to: new Date(end).toISOString() };
  const prior = { from: new Date(end - 2 * days * DAY_MS).toISOString(), to: current.from };
  return { current, prior };
}

/* ---------------- Facts: fixture ---------------- */

export function vendorJobFactsFromFixture(fixture: OpsFixture, scope: OrganizationScope, window: ScorecardWindow): VendorJobFact[] {
  const org = scope.organizationId;
  const stores = new Map(fixture.stores.filter(s => s.organizationId === org
    && (scope.storeIds === undefined || scope.storeIds.includes(s.id))
    && (scope.regionIds === undefined || Boolean(s.regionId && scope.regionIds.includes(s.regionId)))).map(s => [s.id, s]));
  const vendors = new Map(fixture.vendors.filter(v => v.organizationId === org && (!window.vendorId || v.id === window.vendorId)).map(v => [v.id, v]));
  const regions = new Map(fixture.regions.filter(r => r.organizationId === org).map(r => [r.id, r]));
  const work = new Map(fixture.workOrders.filter(w => w.organizationId === org).map(w => [w.id, w]));
  const assignments = fixture.assignments.filter(a => a.organizationId === org && a.kind === "outside_vendor" && a.vendorId);
  const assignmentVendor = new Map(assignments.map(a => [a.id, a.vendorId!]));
  const visits = fixture.visits.filter(v => v.organizationId === org && v.vendorId);
  const links = fixture.siteVisitWorkOrders.filter(l => l.organizationId === org);
  const visitById = new Map(visits.map(v => [v.id, v]));
  const linkById = new Map(links.map(l => [l.id, l]));
  const pmWork = new Set(fixture.pmOccurrences.filter(p => p.organizationId === org && p.workOrderId).map(p => p.workOrderId!));
  const sent = new Map<string, { workOrderId: string; vendorId: string; sentAt: string }>();
  for (const a of assignments) {
    const key = `${a.workOrderId}|${a.vendorId}`;
    const current = sent.get(key);
    if (!current || a.assignedAt < current.sentAt) sent.set(key, { workOrderId: a.workOrderId, vendorId: a.vendorId!, sentAt: a.assignedAt });
  }
  const min = (values: Array<string | undefined>) => values.filter((v): v is string => Boolean(v)).sort()[0];
  const max = (values: Array<string | undefined>) => values.filter((v): v is string => Boolean(v)).sort().at(-1);
  // Index once by job, so a large demo stays fast.
  const byWork = <T extends { workOrderId?: string; organizationId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) if (row.organizationId === org && row.workOrderId) map.set(row.workOrderId, [...(map.get(row.workOrderId) ?? []), row]);
    return map;
  };
  const responsesByWork = byWork(fixture.vendorResponses), linksByWork = byWork(links), verificationsByWork = byWork(fixture.workOrderVerifications);
  const costsByWork = byWork(fixture.costLines), appointmentsByWork = byWork(fixture.serviceAppointments ?? []), allocationsByWork = byWork(fixture.invoiceLineAllocations);
  const assignmentsByWork = byWork(fixture.assignments);
  const visitsByWork = new Map<string, typeof visits>();
  for (const v of visits) {
    const ids = new Set([v.workOrderId, ...links.filter(l => l.visitId === v.id).map(l => l.workOrderId)].filter((x): x is string => Boolean(x)));
    for (const workId of ids) visitsByWork.set(workId, [...(visitsByWork.get(workId) ?? []), v]);
  }
  const workByAsset = new Map<string, typeof fixture.workOrders>();
  for (const o of fixture.workOrders) if (o.organizationId === org && o.assetId && o.status !== "cancelled" && o.priority !== "planned" && !pmWork.has(o.id)) workByAsset.set(o.assetId, [...(workByAsset.get(o.assetId) ?? []), o]);
  const invoiceVendor = new Map(fixture.invoices.filter(i => i.organizationId === org).map(i => [i.id, i.vendorId]));
  const lineInvoice = new Map(fixture.invoiceLines.filter(l => l.organizationId === org).map(l => [l.id, l.invoiceId]));
  const openExceptionInvoices = new Set(fixture.invoiceExceptions.filter(e => e.organizationId === org && e.status === "open").map(e => e.invoiceId));
  const facts: VendorJobFact[] = [];
  for (const { workOrderId, vendorId, sentAt } of sent.values()) {
    const w = work.get(workOrderId), store = w && stores.get(w.storeId), vendor = vendors.get(vendorId);
    if (!w || !store || !vendor || w.status === "cancelled" || sentAt < window.from || sentAt >= window.to) continue;
    const responses = (responsesByWork.get(w.id) ?? []).filter(r => assignmentVendor.get(r.assignmentId) === vendorId);
    const vendorVisits = (visitsByWork.get(w.id) ?? []).filter(v => v.vendorId === vendorId);
    const vendorLinks = (linksByWork.get(w.id) ?? []).filter(l => visitById.get(l.visitId)?.vendorId === vendorId);
    const withOutcome = vendorLinks.filter(l => l.outcome).sort((a, b) => (a.outcomeRecordedAt ?? "").localeCompare(b.outcomeRecordedAt ?? "") || a.id.localeCompare(b.id));
    const completedAt = max(vendorLinks.filter(l => l.outcome === "completed").map(l => l.outcomeRecordedAt));
    const decision = (verificationsByWork.get(w.id) ?? [])
      .filter(v => (v.decision === "verified" || v.decision === "rejected")
        && Boolean(v.siteVisitWorkOrderId && visitById.get(linkById.get(v.siteVisitWorkOrderId)?.visitId ?? "")?.vendorId === vendorId))
      .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt) || b.id.localeCompare(a.id))[0];
    const callback = completedAt && w.assetId ? (workByAsset.get(w.assetId) ?? [])
      .filter(o => o.id !== w.id && o.createdAt > completedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0] : undefined;
    // Older cost records may not name a provider; they count only when this vendor is the job's sole provider.
    const soleProvider = !(assignmentsByWork.get(w.id) ?? []).some(a => a.kind === "internal" || (a.kind === "outside_vendor" && a.vendorId !== vendorId));
    const costs = (costsByWork.get(w.id) ?? []).filter(c => c.amount.currency === "USD" && (c.vendorId === vendorId || (!c.vendorId && !c.providerType && soleProvider)));
    const allocatedInvoices = new Set((allocationsByWork.get(w.id) ?? []).map(a => lineInvoice.get(a.invoiceLineId)));
    facts.push({
      workOrderId: w.id, number: w.number, problem: w.problem, storeId: store.id, storeNumber: store.storeNumber, storeName: store.name,
      regionId: store.regionId && regions.has(store.regionId) ? store.regionId : undefined, regionName: store.regionId ? regions.get(store.regionId)?.name : undefined,
      vendorId, vendorName: vendor.name, trade: w.categoryKey ?? "unclassified", assetId: w.assetId, sentAt,
      firstResponseAt: min(responses.map(r => r.respondedAt)),
      declined: responses.some(r => r.response === "declined"),
      appointmentAt: min((appointmentsByWork.get(w.id) ?? []).filter(ap => ap.status === "confirmed" && assignmentVendor.get(ap.assignmentId) === vendorId).map(ap => ap.startsAt)),
      firstCheckInAt: min(vendorVisits.map(v => v.checkedInAt)),
      firstOutcome: withOutcome[0]?.outcome,
      completedAt,
      checkDecision: decision?.decision as VendorJobFact["checkDecision"],
      callbackWorkOrderId: callback?.id, callbackAt: callback?.createdAt,
      costMinor: costs.reduce((sum, c) => sum + c.amount.amountMinor, 0), costLineCount: costs.length,
      invoiceIssue: [...allocatedInvoices].some(invoiceId => invoiceId !== undefined && invoiceVendor.get(invoiceId) === vendorId && openExceptionInvoices.has(invoiceId)),
    });
  }
  return facts.sort(compareFacts);
}

function compareFacts(a: VendorJobFact, b: VendorJobFact) {
  return a.sentAt.localeCompare(b.sentAt) || a.workOrderId.localeCompare(b.workOrderId) || a.vendorId.localeCompare(b.vendorId);
}

/* ---------------- Facts: SQL (D1 and PostgreSQL) ---------------- */

export async function queryVendorJobFacts(driver: OpsSqlDriver, scope: OrganizationScope, window: ScorecardWindow): Promise<VendorJobFact[]> {
  const params: unknown[] = [scope.organizationId];
  const scoped = scopeWhere(scope, "st", params);
  params.push(window.from, window.to);
  if (window.vendorId) params.push(window.vendorId);
  // Each fact is worked out once for all jobs in the window (no per-job lookups), so this stays fast at chain scale.
  const result = await driver.query({ sql: `WITH sent AS (
      SELECT a.organization_id, a.work_order_id, a.vendor_id, MIN(a.assigned_at) AS sent_at
      FROM ops_work_order_assignments a
      WHERE a.organization_id = ? AND a.kind = 'outside_vendor' AND a.vendor_id IS NOT NULL
      GROUP BY a.organization_id, a.work_order_id, a.vendor_id
    ), jobs AS (
      SELECT s.organization_id, s.work_order_id, s.vendor_id, s.sent_at, w.number, w.problem, w.category_key, w.asset_id,
        st.id AS store_id, st.store_number, st.name AS store_name, rg.id AS region_id, rg.name AS region_name, v.name AS vendor_name
      FROM sent s
      JOIN ops_work_orders w ON w.organization_id = s.organization_id AND w.id = s.work_order_id
      JOIN ops_stores st ON st.organization_id = w.organization_id AND st.id = w.store_id
      JOIN ops_vendors v ON v.organization_id = s.organization_id AND v.id = s.vendor_id
      LEFT JOIN ops_regions rg ON rg.organization_id = st.organization_id AND rg.id = st.region_id
      WHERE ${scoped} AND w.status <> 'cancelled' AND s.sent_at >= ? AND s.sent_at < ?${window.vendorId ? " AND s.vendor_id = ?" : ""}
    ), responses AS (
      SELECT r.work_order_id, ra.vendor_id, MIN(r.responded_at) AS first_response_at, MAX(CASE WHEN r.response = 'declined' THEN 1 ELSE 0 END) AS declined
      FROM ops_vendor_responses r
      JOIN ops_work_order_assignments ra ON ra.organization_id = r.organization_id AND ra.id = r.assignment_id
      JOIN jobs j ON j.organization_id = r.organization_id AND j.work_order_id = r.work_order_id AND j.vendor_id = ra.vendor_id
      GROUP BY r.work_order_id, ra.vendor_id
    ), appointments AS (
      SELECT ap.work_order_id, aa.vendor_id, MIN(ap.starts_at) AS appointment_at
      FROM ops_service_appointments ap
      JOIN ops_work_order_assignments aa ON aa.organization_id = ap.organization_id AND aa.id = ap.assignment_id
      JOIN jobs j ON j.organization_id = ap.organization_id AND j.work_order_id = ap.work_order_id AND j.vendor_id = aa.vendor_id
      WHERE ap.status = 'confirmed'
      GROUP BY ap.work_order_id, aa.vendor_id
    ), links AS (
      SELECT x.id AS link_id, x.work_order_id, vs.vendor_id, vs.checked_in_at, x.outcome, x.outcome_recorded_at
      FROM ops_site_visit_work_orders x
      JOIN ops_visit_sessions vs ON vs.organization_id = x.organization_id AND vs.id = x.visit_id
      JOIN jobs j ON j.organization_id = x.organization_id AND j.work_order_id = x.work_order_id AND j.vendor_id = vs.vendor_id
    ), check_ins AS (
      SELECT work_order_id, vendor_id, MIN(checked_in_at) AS first_check_in_at FROM (
        SELECT work_order_id, vendor_id, checked_in_at FROM links
        UNION ALL
        SELECT vs.work_order_id, vs.vendor_id, vs.checked_in_at FROM ops_visit_sessions vs
        JOIN jobs j ON j.organization_id = vs.organization_id AND j.work_order_id = vs.work_order_id AND j.vendor_id = vs.vendor_id
      ) visits GROUP BY work_order_id, vendor_id
    ), outcomes AS (
      SELECT work_order_id, vendor_id, outcome, ROW_NUMBER() OVER (PARTITION BY work_order_id, vendor_id ORDER BY outcome_recorded_at ASC, link_id ASC) AS n
      FROM links WHERE outcome IS NOT NULL
    ), completions AS (
      SELECT work_order_id, vendor_id, MAX(outcome_recorded_at) AS completed_at FROM links WHERE outcome = 'completed' GROUP BY work_order_id, vendor_id
    ), decisions AS (
      SELECT l.work_order_id, l.vendor_id, ver.decision, ROW_NUMBER() OVER (PARTITION BY l.work_order_id, l.vendor_id ORDER BY ver.decided_at DESC, ver.id DESC) AS n
      FROM ops_work_order_verifications ver
      JOIN links l ON l.link_id = ver.site_visit_work_order_id AND l.work_order_id = ver.work_order_id
      WHERE ver.organization_id = ? AND ver.decision IN ('verified','rejected')
    ), others AS (
      SELECT j.work_order_id, j.vendor_id FROM jobs j
      WHERE EXISTS (SELECT 1 FROM ops_work_order_assignments oa WHERE oa.organization_id = j.organization_id AND oa.work_order_id = j.work_order_id
        AND (oa.kind = 'internal' OR (oa.kind = 'outside_vendor' AND oa.vendor_id <> j.vendor_id)))
    ), costs AS (
      SELECT j.work_order_id, j.vendor_id, SUM(c.amount_minor) AS cost_minor, COUNT(*) AS cost_line_count
      FROM jobs j
      JOIN ops_cost_lines c ON c.organization_id = j.organization_id AND c.work_order_id = j.work_order_id AND c.currency = 'USD'
      LEFT JOIN others o ON o.work_order_id = j.work_order_id AND o.vendor_id = j.vendor_id
      WHERE c.vendor_id = j.vendor_id OR (c.vendor_id IS NULL AND c.provider_type IS NULL AND o.work_order_id IS NULL)
      GROUP BY j.work_order_id, j.vendor_id
    ), invoice_issues AS (
      SELECT DISTINCT la.work_order_id, i.vendor_id
      FROM ops_invoice_exceptions e
      JOIN ops_invoices i ON i.organization_id = e.organization_id AND i.id = e.invoice_id
      JOIN ops_invoice_lines il ON il.organization_id = i.organization_id AND il.invoice_id = i.id
      JOIN ops_invoice_line_allocations la ON la.organization_id = il.organization_id AND la.invoice_line_id = il.id
      WHERE e.organization_id = ? AND e.status = 'open'
    ), facts AS (
      SELECT j.*, r.first_response_at, COALESCE(r.declined, 0) AS declined, ap.appointment_at, ci.first_check_in_at, oc.outcome AS first_outcome,
        cp.completed_at, d.decision AS check_decision, COALESCE(c.cost_minor, 0) AS cost_minor, COALESCE(c.cost_line_count, 0) AS cost_line_count,
        CASE WHEN ii.work_order_id IS NULL THEN 0 ELSE 1 END AS invoice_issue
      FROM jobs j
      LEFT JOIN responses r ON r.work_order_id = j.work_order_id AND r.vendor_id = j.vendor_id
      LEFT JOIN appointments ap ON ap.work_order_id = j.work_order_id AND ap.vendor_id = j.vendor_id
      LEFT JOIN check_ins ci ON ci.work_order_id = j.work_order_id AND ci.vendor_id = j.vendor_id
      LEFT JOIN outcomes oc ON oc.work_order_id = j.work_order_id AND oc.vendor_id = j.vendor_id AND oc.n = 1
      LEFT JOIN completions cp ON cp.work_order_id = j.work_order_id AND cp.vendor_id = j.vendor_id
      LEFT JOIN decisions d ON d.work_order_id = j.work_order_id AND d.vendor_id = j.vendor_id AND d.n = 1
      LEFT JOIN costs c ON c.work_order_id = j.work_order_id AND c.vendor_id = j.vendor_id
      LEFT JOIN invoice_issues ii ON ii.work_order_id = j.work_order_id AND ii.vendor_id = j.vendor_id
    ), callbacks AS (
      SELECT f.work_order_id, f.vendor_id, o.id AS callback_work_order_id, o.created_at AS callback_at,
        ROW_NUMBER() OVER (PARTITION BY f.work_order_id, f.vendor_id ORDER BY o.created_at ASC, o.id ASC) AS n
      FROM facts f
      JOIN ops_work_orders o ON o.organization_id = f.organization_id AND o.asset_id = f.asset_id AND o.id <> f.work_order_id AND o.created_at > f.completed_at
      WHERE f.completed_at IS NOT NULL AND o.status <> 'cancelled' AND o.priority <> 'planned'
        AND NOT EXISTS (SELECT 1 FROM ops_pm_occurrences p WHERE p.organization_id = o.organization_id AND p.work_order_id = o.id)
    )
    SELECT f.*, cb.callback_work_order_id, cb.callback_at
    FROM facts f
    LEFT JOIN callbacks cb ON cb.work_order_id = f.work_order_id AND cb.vendor_id = f.vendor_id AND cb.n = 1
    ORDER BY f.sent_at ASC, f.work_order_id ASC, f.vendor_id ASC`, params: [...params, scope.organizationId, scope.organizationId] });
  const text = (value: unknown) => value == null ? undefined : value instanceof Date ? value.toISOString() : String(value);
  return result.rows.map(r => ({
    workOrderId: String(r.work_order_id), number: String(r.number), problem: String(r.problem), storeId: String(r.store_id),
    storeNumber: String(r.store_number), storeName: String(r.store_name), regionId: text(r.region_id), regionName: text(r.region_name), vendorId: String(r.vendor_id), vendorName: String(r.vendor_name),
    trade: text(r.category_key) ?? "unclassified", assetId: text(r.asset_id), sentAt: text(r.sent_at)!,
    firstResponseAt: text(r.first_response_at), declined: Number(r.declined) === 1,
    appointmentAt: text(r.appointment_at), firstCheckInAt: text(r.first_check_in_at), firstOutcome: text(r.first_outcome),
    completedAt: text(r.completed_at), checkDecision: text(r.check_decision) as VendorJobFact["checkDecision"],
    callbackWorkOrderId: text(r.callback_work_order_id), callbackAt: text(r.callback_at),
    costMinor: Number(r.cost_minor ?? 0), costLineCount: Number(r.cost_line_count ?? 0), invoiceIssue: Number(r.invoice_issue) === 1,
  })).sort(compareFacts);
}

/* ---------------- Per-job results for each measure ---------------- */

/**
 * Whether one job counts toward a measure, and how it came out. `undefined` means the
 * job is not part of that measure (for example, no appointment was set).
 */
export function jobResult(fact: VendorJobFact, measure: ScorecardMeasureKey, now: string): { counted: boolean; hit?: boolean; value?: number } {
  switch (measure) {
    case "jobs": return { counted: true };
    case "declined": return { counted: true, hit: fact.declined };
    case "response": return fact.firstResponseAt ? { counted: true, value: (Date.parse(fact.firstResponseAt) - Date.parse(fact.sentAt)) / 3_600_000 } : { counted: false };
    case "onTime": return fact.appointmentAt && fact.firstCheckInAt ? { counted: true, hit: Date.parse(fact.firstCheckInAt) <= Date.parse(fact.appointmentAt) + ON_TIME_GRACE_MS } : { counted: false };
    case "firstFix": return fact.firstOutcome ? { counted: true, hit: fact.firstOutcome === "completed" } : { counted: false };
    case "fixHeld": return fact.checkDecision ? { counted: true, hit: fact.checkDecision === "verified" } : { counted: false };
    case "callbacks": {
      // A fix needs 30 days behind it before it can be judged.
      if (!fact.completedAt || !fact.assetId || Date.parse(fact.completedAt) + CALLBACK_DAYS * DAY_MS > Date.parse(now)) return { counted: false };
      return { counted: true, hit: Boolean(fact.callbackAt && Date.parse(fact.callbackAt) <= Date.parse(fact.completedAt) + CALLBACK_DAYS * DAY_MS) };
    }
    case "cost": return fact.costLineCount > 0 ? { counted: true, value: fact.costMinor } : { counted: false };
    case "invoice": return { counted: true, hit: fact.invoiceIssue };
  }
}

/* ---------------- Summary ---------------- */

export type MeasureDirection = "higher" | "lower" | "neutral";
export const MEASURE_INFO: Record<ScorecardMeasureKey, { label: string; short: string; direction: MeasureDirection; definition: string }> = {
  jobs: { label: "Jobs", short: "Jobs", direction: "neutral", definition: "Jobs first sent to this vendor in the period. Cancelled jobs are left out." },
  response: { label: "Typical response", short: "Response", direction: "lower", definition: "Typical (median) time from sending the job to the vendor's first reply." },
  onTime: { label: "On time", short: "On time", direction: "higher", definition: "Checked in within an hour of the agreed appointment. Only jobs with an appointment and a check-in." },
  firstFix: { label: "Fixed first visit", short: "First visit", direction: "higher", definition: "The vendor's first visit on the job recorded “completed”." },
  fixHeld: { label: "Fix held up", short: "Held up", direction: "higher", definition: "Of repairs that were checked, the share confirmed rather than rejected." },
  callbacks: { label: "Broke again in 30 days", short: "Again in 30d", direction: "lower", definition: "The same equipment needed another repair within 30 days of this vendor's fix. Fixes less than 30 days old are not judged yet." },
  cost: { label: "Average cost per job", short: "Avg cost", direction: "neutral", definition: "Recorded costs from this vendor, per job with a cost. Older costs without a named provider count only on jobs this vendor worked alone." },
  declined: { label: "Declined", short: "Declined", direction: "lower", definition: "Jobs the vendor declined." },
  invoice: { label: "Invoice issues", short: "Invoices", direction: "lower", definition: "Jobs with an open invoice problem on this vendor's invoice." },
};

export interface MeasureSummary {
  key: ScorecardMeasureKey;
  /** Jobs this measure applies to. */
  counted: number;
  /** Jobs that hit the condition (rates and counts). */
  hits: number;
  /** Rate 0-1, median hours, or average minor units; undefined when nothing is counted. */
  value?: number;
  tooFew: boolean;
  rank?: "best" | "worst";
  trend?: "better" | "worse";
  priorValue?: number;
}

export interface ScoreRow { key: string; label: string; measures: Record<ScorecardMeasureKey, MeasureSummary> }
export interface TradeGroup { trade: string; label: string; jobs: number; vendors: Array<{ vendorId: string; vendorName: string; measures: Record<ScorecardMeasureKey, MeasureSummary> }> }

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function summarizeMeasure(facts: VendorJobFact[], key: ScorecardMeasureKey, now: string): MeasureSummary {
  const results = facts.map(f => jobResult(f, key, now)).filter(r => r.counted);
  const hits = results.filter(r => r.hit).length;
  const values = results.map(r => r.value).filter((v): v is number => v !== undefined);
  const value = key === "jobs" ? results.length
    : key === "invoice" ? hits
    : key === "response" ? (values.length ? median(values) : undefined)
    : key === "cost" ? (values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined)
    : results.length ? hits / results.length : undefined;
  const sampled = !["jobs", "invoice"].includes(key);
  return { key, counted: results.length, hits, value, tooFew: sampled && results.length > 0 && results.length < SMALL_SAMPLE };
}

/** Change large enough to call better or worse, per measure. */
function trendOf(key: ScorecardMeasureKey, current: number, prior: number): "better" | "worse" | undefined {
  const direction = MEASURE_INFO[key].direction;
  if (direction === "neutral") return undefined;
  const change = key === "response" ? (Math.abs(current - prior) >= Math.max(0.5, prior * 0.1) ? current - prior : 0)
    : Math.abs(current - prior) >= 0.05 ? current - prior : 0;
  if (!change) return undefined;
  return (change < 0) === (direction === "lower") ? "better" : "worse";
}

/** All measures for one set of jobs, with arrows against the same set in the previous period. */
export function summarizeAll(facts: VendorJobFact[], prior: VendorJobFact[], now: string) {
  return Object.fromEntries(MEASURES.map(key => {
    const summary = summarizeMeasure(facts, key, now);
    const before = summarizeMeasure(prior, key, now);
    if (summary.value !== undefined && !summary.tooFew && before.value !== undefined && !before.tooFew && before.counted) {
      summary.priorValue = before.value;
      summary.trend = trendOf(key, summary.value, before.value);
    }
    return [key, summary];
  })) as Record<ScorecardMeasureKey, MeasureSummary>;
}

/** Rows grouped by any key (vendor, district, type of work). Largest first. */
export function scoreRows(facts: VendorJobFact[], prior: VendorJobFact[], now: string, keyOf: (fact: VendorJobFact) => string, labelOf: (fact: VendorJobFact) => string): ScoreRow[] {
  const groups = new Map<string, VendorJobFact[]>();
  for (const fact of facts) groups.set(keyOf(fact), [...(groups.get(keyOf(fact)) ?? []), fact]);
  return [...groups.entries()].map(([key, rows]) => ({ key, label: labelOf(rows[0]!), measures: summarizeAll(rows, prior.filter(f => keyOf(f) === key), now) }))
    .sort((a, b) => b.measures.jobs.counted - a.measures.jobs.counted || a.label.localeCompare(b.label));
}

/** Best and Weakest, only among rows with enough jobs, and only when they actually differ. Use only for like-for-like work. */
export function rankRows(rows: ScoreRow[]) {
  for (const key of MEASURES) {
    const direction = MEASURE_INFO[key].direction;
    if (direction === "neutral" || key === "invoice") continue;
    const ready = rows.map(v => v.measures[key]).filter(m => m.value !== undefined && !m.tooFew);
    if (ready.length < 2) continue;
    const sorted = [...ready].sort((a, b) => direction === "higher" ? b.value! - a.value! : a.value! - b.value!);
    if (sorted[0]!.value === sorted.at(-1)!.value) continue;
    sorted[0]!.rank = "best";
    sorted.at(-1)!.rank = "worst";
  }
  return rows;
}

/** Vendors side by side within each type of work. */
export function buildScorecard(facts: VendorJobFact[], priorFacts: VendorJobFact[], now: string): TradeGroup[] {
  const trades = [...new Set(facts.map(f => f.trade))];
  return trades.map(trade => {
    const tradeFacts = facts.filter(f => f.trade === trade);
    const rows = rankRows(scoreRows(tradeFacts, priorFacts.filter(f => f.trade === trade), now, f => f.vendorId, f => f.vendorName));
    return { trade, label: tradeLabel(trade), jobs: tradeFacts.length, vendors: rows.map(row => ({ vendorId: row.key, vendorName: row.label, measures: row.measures })) };
  }).sort((a, b) => (a.trade === "unclassified" ? 1 : 0) - (b.trade === "unclassified" ? 1 : 0) || b.jobs - a.jobs || a.label.localeCompare(b.label));
}

/** Window `back` periods before the current one (0 = current). */
export function scorecardWindowAt(now: string, days: ScorecardPeriod, back: number): ScorecardWindow {
  const end = Date.parse(now) - back * days * DAY_MS;
  return { from: new Date(end - days * DAY_MS).toISOString(), to: new Date(end).toISOString() };
}

/** How many periods the "over time" view shows: up to six, never more than two years back. */
export function historyLength(days: ScorecardPeriod) { return Math.max(2, Math.min(6, Math.floor(730 / days))); }

export const inWindow = (fact: VendorJobFact, window: ScorecardWindow) => fact.sentAt >= window.from && fact.sentAt < window.to;
