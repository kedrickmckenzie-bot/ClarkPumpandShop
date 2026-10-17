import type { OpsFixture, WorkOrder } from "./types";

/**
 * The only questions "Ask" can put to a company's records. Each lookup reads the person's scoped records,
 * returns exact facts (money in cents, counts) and a link to the records behind every number. The AI writes
 * the sentence; it never sees anything else and never calculates numbers itself.
 */
export interface AskScope {
  organizationId: string;
  stores: OpsFixture["stores"];
  workOrders: OpsFixture["workOrders"];
  assets: OpsFixture["assets"];
}
export interface AskContext { fixture: OpsFixture; scope: AskScope; today: string; now: string; vendorOf(workId: string): string | undefined }

export const OPEN_STATUSES = new Set(["awaiting_approval", "approved", "issued", "accepted", "scheduled", "in_progress", "waiting_on_parts", "waiting_on_vendor"]);
const DONE_STATUSES = new Set(["completed_pending_review", "resolved", "closed"]);
const DAY = 86_400_000;

export type Period = "30d" | "90d" | "12m" | "ytd" | "last_year" | "all";
/** A date window in calendar days, inclusive, plus the same-length window before it for comparison. */
export function periodWindow(period: Period | undefined, today: string, from?: string, to?: string) {
  const day = (offset: number, base = today) => new Date(Date.parse(`${base}T12:00:00Z`) + offset * DAY).toISOString().slice(0, 10);
  let start: string, end = to ?? today, label: string;
  if (from) { start = from; label = `${from} to ${end}`; }
  else if (period === "30d") { start = day(-29); label = "last 30 days"; }
  else if (period === "90d") { start = day(-89); label = "last 90 days"; }
  else if (period === "ytd") { start = `${today.slice(0, 4)}-01-01`; label = "this year so far"; }
  else if (period === "last_year") { const y = Number(today.slice(0, 4)) - 1; start = `${y}-01-01`; end = `${y}-12-31`; label = `${y}`; }
  else if (period === "all") { start = "1900-01-01"; label = "all history"; }
  else { start = day(-364); label = "last 12 months"; }
  const length = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
  const prior = period === "all" ? undefined : { start: day(-length, start), end: day(-1, start) };
  return { start, end, label, prior };
}

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const query = (params: Record<string, string | undefined>) => new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString();
const workHref = (work: Pick<WorkOrder, "id">) => `/app/work-orders/${encodeURIComponent(work.id)}`;

function matchStore(ctx: AskContext, store?: string) {
  if (!store) return undefined;
  const text = store.toLowerCase().replace(/^store\s*/, "").trim();
  return ctx.scope.stores.filter(s => s.storeNumber.toLowerCase() === text || s.name.toLowerCase().includes(text) || s.id === store);
}
function matchVendor(ctx: AskContext, vendor?: string) {
  if (!vendor) return undefined;
  const text = vendor.toLowerCase();
  return ctx.fixture.vendors.filter(v => v.organizationId === ctx.scope.organizationId && (v.name.toLowerCase().includes(text) || v.id === vendor));
}
const categoryOf = (work: WorkOrder) => work.categoryKey ?? "unclassified";
const sentence = (key: string) => key.replaceAll("_", " ").replace(/^./, c => c.toUpperCase());

/** Filters shared by the lookups; unmatched names are reported back instead of silently ignored. */
function filterWork(ctx: AskContext, input: { store?: string; category?: string; vendor?: string; equipment?: string }) {
  const notes: string[] = [];
  let work = ctx.scope.workOrders;
  const stores = matchStore(ctx, input.store);
  if (stores) { if (!stores.length) notes.push(`No store matches "${input.store}".`); const ids = new Set(stores.map(s => s.id)); work = work.filter(w => ids.has(w.storeId)); }
  if (input.category) { const c = input.category.toLowerCase().replace(/\s+/g, "_"); work = work.filter(w => categoryOf(w).includes(c)); }
  const vendors = matchVendor(ctx, input.vendor);
  if (vendors) { if (!vendors.length) notes.push(`No vendor matches "${input.vendor}".`); const ids = new Set(vendors.map(v => v.id)); work = work.filter(w => ids.has(ctx.vendorOf(w.id) ?? "")); }
  if (input.equipment) {
    const text = input.equipment.toLowerCase();
    const assets = new Set(ctx.scope.assets.filter(a => a.name.toLowerCase().includes(text) || a.assetTag.toLowerCase() === text || a.categoryKey.includes(text.replace(/\s+/g, "_"))).map(a => a.id));
    if (!assets.size) notes.push(`No equipment matches "${input.equipment}".`);
    work = work.filter(w => w.assetId && assets.has(w.assetId));
  }
  return { work, notes, storeId: stores?.length === 1 ? stores[0]!.id : undefined, vendorId: vendors?.length === 1 ? vendors[0]!.id : undefined };
}

function costIn(ctx: AskContext, workIds: Set<string>, start: string, end: string) {
  let total = 0; const byWork = new Map<string, number>();
  for (const line of ctx.fixture.costLines) {
    if (line.organizationId !== ctx.scope.organizationId || !workIds.has(line.workOrderId) || line.amount.currency !== "USD") continue;
    const date = line.serviceDate.slice(0, 10);
    if (date < start || date > end) continue;
    total += line.amount.amountMinor; byWork.set(line.workOrderId, (byWork.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
  }
  return { total, byWork };
}

export interface SpendingInput { period?: Period; from?: string; to?: string; groupBy?: "store" | "category" | "vendor" | "region" | "month" | "equipment"; store?: string; category?: string; vendor?: string; equipment?: string; top?: number }
/** Recorded work cost (labor, parts, invoices matched to work), grouped, with the prior period for comparison. */
export function spending(ctx: AskContext, input: SpendingInput) {
  const window = periodWindow(input.period, ctx.today, input.from, input.to);
  const { work, notes, storeId, vendorId } = filterWork(ctx, input);
  const ids = new Set(work.map(w => w.id)), byId = new Map(work.map(w => [w.id, w]));
  const now = costIn(ctx, ids, window.start, window.end);
  const before = window.prior ? costIn(ctx, ids, window.prior.start, window.prior.end) : undefined;
  const groupBy = input.groupBy ?? "store";
  const keyOf = (w: WorkOrder): [string, string] => {
    if (groupBy === "category") return [categoryOf(w), sentence(categoryOf(w))];
    if (groupBy === "vendor") { const v = ctx.vendorOf(w.id); return [v ?? "in_house", v ? ctx.fixture.vendors.find(x => x.id === v)?.name ?? "Vendor" : "In-house team"]; }
    if (groupBy === "region") { const s = ctx.scope.stores.find(x => x.id === w.storeId); const r = ctx.fixture.regions.find(x => x.id === s?.regionId); return [r?.id ?? "none", r?.name ?? "No region"]; }
    if (groupBy === "equipment") { const a = ctx.scope.assets.find(x => x.id === w.assetId); return [a?.id ?? "none", a ? `${a.name} (store ${ctx.scope.stores.find(s => s.id === a.storeId)?.storeNumber})` : "No equipment linked"]; }
    if (groupBy === "month") return ["", ""];
    const s = ctx.scope.stores.find(x => x.id === w.storeId)!; return [s.id, `Store ${s.storeNumber} · ${s.name.replace(/^.* - /, "")}`];
  };
  const groups = new Map<string, { label: string; cents: number; jobs: Set<string> }>();
  if (groupBy === "month") {
    for (const line of ctx.fixture.costLines) {
      if (!ids.has(line.workOrderId) || line.amount.currency !== "USD") continue;
      const date = line.serviceDate.slice(0, 10); if (date < window.start || date > window.end) continue;
      const g = groups.get(date.slice(0, 7)) ?? { label: date.slice(0, 7), cents: 0, jobs: new Set() };
      g.cents += line.amount.amountMinor; g.jobs.add(line.workOrderId); groups.set(date.slice(0, 7), g);
    }
  } else for (const [workId, cents] of now.byWork) {
    const [key, label] = keyOf(byId.get(workId)!);
    const g = groups.get(key) ?? { label, cents: 0, jobs: new Set() };
    g.cents += cents; g.jobs.add(workId); groups.set(key, g);
  }
  const listHref = (extra: Record<string, string | undefined>) => `/app/work-orders?${query({ hasCost: "true", costFrom: window.start, costTo: window.end, store: storeId, vendor: vendorId, ...extra })}`;
  const rows = [...groups.entries()].sort((a, b) => groupBy === "month" ? a[0].localeCompare(b[0]) : b[1].cents - a[1].cents).slice(0, Math.min(input.top ?? 10, 25)).map(([key, g]) => ({
    label: g.label, amount: dollars(g.cents), jobs: g.jobs.size,
    href: groupBy === "store" ? listHref({ store: key }) : groupBy === "category" ? listHref({ category: key === "unclassified" ? undefined : key }) : groupBy === "vendor" && key !== "in_house" ? listHref({ vendor: key }) : groupBy === "equipment" && key !== "none" ? listHref({ asset: key }) : listHref({}),
  }));
  return {
    basis: "Recorded work cost (labor, parts and invoices matched to jobs), by service date",
    period: `${window.label} (${window.start} to ${window.end})`,
    total: dollars(now.total), jobsWithCost: now.byWork.size,
    priorPeriod: before && window.prior ? { period: `${window.prior.start} to ${window.prior.end}`, total: dollars(before.total) } : undefined,
    groupedBy: groupBy, rows, allRecordsHref: listHref({}), notes,
  };
}

export interface JobsInput { status?: "open" | "late" | "done" | "all"; store?: string; category?: string; vendor?: string; equipment?: string; priority?: "urgent" | "routine"; period?: Period; from?: string; to?: string; limit?: number }
/** Jobs matching plain filters, newest first, with counts and links. */
export function jobs(ctx: AskContext, input: JobsInput) {
  const { work, notes, storeId, vendorId } = filterWork(ctx, input);
  const window = input.period || input.from ? periodWindow(input.period, ctx.today, input.from, input.to) : undefined;
  const status = input.status ?? "open";
  const matched = work.filter(w =>
    (status === "all" || (status === "open" && OPEN_STATUSES.has(w.status)) || (status === "late" && OPEN_STATUSES.has(w.status) && Boolean(w.dueAt && w.dueAt < ctx.now)) || (status === "done" && DONE_STATUSES.has(w.status)))
    && (!input.priority || (input.priority === "urgent" ? ["urgent", "emergency"].includes(w.priority) : !["urgent", "emergency"].includes(w.priority)))
    && (!window || (w.createdAt.slice(0, 10) >= window.start && w.createdAt.slice(0, 10) <= window.end)),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const store = (id: string) => ctx.scope.stores.find(s => s.id === id)?.storeNumber;
  return {
    status, period: window ? `${window.label} (${window.start} to ${window.end})` : "any time", count: matched.length,
    jobs: matched.slice(0, Math.min(input.limit ?? 8, 20)).map(w => ({ number: w.number, problem: w.problem.slice(0, 120), store: `Store ${store(w.storeId)}`, status: sentence(w.status), priority: w.priority, created: w.createdAt.slice(0, 10), deadline: w.dueAt?.slice(0, 16).replace("T", " "), href: workHref(w) })),
    allRecordsHref: `/app/work-orders?${query({ status: status === "open" || status === "late" ? "open" : status === "done" ? "history" : undefined, store: storeId, vendor: vendorId })}`,
    notes,
  };
}

export interface RepeatInput { period?: Period; from?: string; to?: string; groupBy?: "equipment" | "vendor" | "store"; store?: string; vendor?: string; days?: number }
/** Repairs that came back: a new job on the same equipment within N days (default 30) of an earlier job finishing. */
export function repeatRepairs(ctx: AskContext, input: RepeatInput) {
  const window = periodWindow(input.period, ctx.today, input.from, input.to);
  const days = Math.min(Math.max(input.days ?? 30, 1), 180);
  const { work, notes } = filterWork(ctx, { store: input.store });
  const byAsset = new Map<string, WorkOrder[]>();
  for (const w of ctx.scope.workOrders) if (w.assetId) byAsset.set(w.assetId, [...(byAsset.get(w.assetId) ?? []), w]);
  const inFilter = new Set(work.map(w => w.id));
  const repeats: Array<{ earlier: WorkOrder; later: WorkOrder; vendor?: string }> = [];
  for (const list of byAsset.values()) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (let i = 1; i < sorted.length; i++) {
      const later = sorted[i]!, created = later.createdAt.slice(0, 10);
      if (!inFilter.has(later.id) || created < window.start || created > window.end) continue;
      const earlier = sorted.slice(0, i).reverse().find(e => { const done = e.resolvedAt ?? e.closedAt; return done && Date.parse(later.createdAt) - Date.parse(done) <= days * DAY && Date.parse(later.createdAt) >= Date.parse(done); });
      if (earlier) repeats.push({ earlier, later, vendor: ctx.vendorOf(earlier.id) });
    }
  }
  const vendorFilter = matchVendor(ctx, input.vendor);
  if (vendorFilter && !vendorFilter.length) notes.push(`No vendor matches "${input.vendor}".`);
  const kept = vendorFilter ? repeats.filter(r => vendorFilter.some(v => v.id === r.vendor)) : repeats;
  const groupBy = input.groupBy ?? "equipment";
  const groups = new Map<string, { label: string; count: number; examples: typeof kept }>();
  for (const r of kept) {
    const asset = ctx.scope.assets.find(a => a.id === r.later.assetId);
    const [key, label] = groupBy === "vendor" ? [r.vendor ?? "in_house", r.vendor ? ctx.fixture.vendors.find(v => v.id === r.vendor)?.name ?? "Vendor" : "In-house team"]
      : groupBy === "store" ? [r.later.storeId, `Store ${ctx.scope.stores.find(s => s.id === r.later.storeId)?.storeNumber}`]
      : [r.later.assetId!, `${asset?.name ?? "Equipment"} (store ${ctx.scope.stores.find(s => s.id === r.later.storeId)?.storeNumber})`];
    const g = groups.get(key) ?? { label, count: 0, examples: [] }; g.count++; g.examples.push(r); groups.set(key, g);
  }
  return {
    rule: `A new job on the same equipment within ${days} days after an earlier job on it was finished. Different problems still count; it is a fact to review, not proof of a bad repair.`,
    period: `${window.label} (${window.start} to ${window.end})`, count: kept.length, groupedBy: groupBy,
    rows: [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 10).map(g => ({ label: g.label, repeats: g.count,
      examples: g.examples.slice(0, 3).map(r => ({ earlier: `${r.earlier.number}: ${r.earlier.problem.slice(0, 80)}`, earlierHref: workHref(r.earlier), later: `${r.later.number}: ${r.later.problem.slice(0, 80)}`, laterHref: workHref(r.later), daysLater: Math.round((Date.parse(r.later.createdAt) - Date.parse(r.earlier.resolvedAt ?? r.earlier.closedAt!)) / DAY) })) })),
    notes,
  };
}

export interface EquipmentInput { store?: string; equipment: string }
/** One piece of equipment: facts, warranty, its jobs and what they cost. */
export function equipmentHistory(ctx: AskContext, input: EquipmentInput) {
  const stores = matchStore(ctx, input.store), text = input.equipment.toLowerCase();
  const candidates = ctx.scope.assets.filter(a => (!stores || stores.some(s => s.id === a.storeId)) && (a.name.toLowerCase().includes(text) || a.assetTag.toLowerCase() === text || a.categoryKey.includes(text.replace(/\s+/g, "_"))));
  if (!candidates.length) return { found: 0, notes: [`No equipment matches "${input.equipment}"${input.store ? ` at ${input.store}` : ""}.`] };
  if (candidates.length > 1) return { found: candidates.length, choices: candidates.slice(0, 10).map(a => ({ name: a.name, tag: a.assetTag, store: `Store ${ctx.scope.stores.find(s => s.id === a.storeId)?.storeNumber}`, href: `/app/equipment/${encodeURIComponent(a.id)}` })), notes: ["More than one match; ask which one, or name the store."] };
  const asset = candidates[0]!;
  const work = ctx.scope.workOrders.filter(w => w.assetId === asset.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cost = costIn(ctx, new Set(work.map(w => w.id)), "1900-01-01", ctx.today);
  return {
    found: 1, name: asset.name, tag: asset.assetTag, store: `Store ${ctx.scope.stores.find(s => s.id === asset.storeId)?.storeNumber}`,
    makeModel: [asset.manufacturer, asset.model].filter(Boolean).join(" ") || undefined, installed: asset.installedAt?.slice(0, 10),
    warrantyEnds: asset.warrantyEndsAt?.slice(0, 10), underWarranty: Boolean(asset.warrantyEndsAt && asset.warrantyEndsAt.slice(0, 10) >= ctx.today),
    jobsAllTime: work.length, recordedCostAllTime: dollars(cost.total), href: `/app/equipment/${encodeURIComponent(asset.id)}`,
    recentJobs: work.slice(0, 6).map(w => ({ number: w.number, problem: w.problem.slice(0, 100), created: w.createdAt.slice(0, 10), status: sentence(w.status), cost: dollars(cost.byWork.get(w.id) ?? 0), href: workHref(w) })),
  };
}

export interface WarrantyInput { period?: Period; from?: string; to?: string; store?: string }
/** Cost recorded on jobs for equipment that was under warranty when the job was opened. */
export function costWhileUnderWarranty(ctx: AskContext, input: WarrantyInput) {
  const window = periodWindow(input.period, ctx.today, input.from, input.to);
  const { work, notes } = filterWork(ctx, { store: input.store });
  const assets = new Map(ctx.scope.assets.map(a => [a.id, a]));
  const covered = work.filter(w => { const a = w.assetId ? assets.get(w.assetId) : undefined; return Boolean(a?.warrantyEndsAt && a.warrantyEndsAt.slice(0, 10) >= w.createdAt.slice(0, 10)); });
  const cost = costIn(ctx, new Set(covered.map(w => w.id)), window.start, window.end);
  const paid = covered.filter(w => (cost.byWork.get(w.id) ?? 0) > 0).sort((a, b) => (cost.byWork.get(b.id) ?? 0) - (cost.byWork.get(a.id) ?? 0));
  return {
    rule: "Jobs on equipment whose warranty end date was on or after the day the job was opened, with recorded cost in the period. Warranty terms differ; parts, labor or trip charges may not have been covered. Review each job.",
    period: `${window.label} (${window.start} to ${window.end})`, jobs: paid.length, recordedCost: dollars(cost.total),
    rows: paid.slice(0, 8).map(w => ({ number: w.number, problem: w.problem.slice(0, 100), equipment: assets.get(w.assetId!)?.name, warrantyEnds: assets.get(w.assetId!)?.warrantyEndsAt?.slice(0, 10), cost: dollars(cost.byWork.get(w.id) ?? 0), href: workHref(w) })),
    warrantiesHref: "/app/warranties", notes,
  };
}

/** Every link a lookup result contains, so an answer can only link to records a lookup returned. */
export function linksIn(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === "string") { if (value.startsWith("/app/")) into.add(value); }
  else if (Array.isArray(value)) for (const item of value) linksIn(item, into);
  else if (value && typeof value === "object") for (const item of Object.values(value)) linksIn(item, into);
  return into;
}
