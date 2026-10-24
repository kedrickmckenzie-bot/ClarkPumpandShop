import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import type { FilterOptionViewModel, OperatorSession, PaginationViewModel } from "@/components/ops/data-contract";
import { costProvider } from "@/lib/ops/cost-provider";
import { activeTotals } from "@/lib/ops/spend-totals";
import { formatOperationsDate } from "@/lib/ops/local-time";
import { compactStoreLabel } from "@/lib/product/store-label";
import type { OpsFixture } from "@/lib/ops/types";
import { assignmentsForWork, narrowScopeToRegion, narrowScopeToStore, scopeFixture, sentence, spendPeriod } from "./operator-presenter";

type Query = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const usd = cachedNumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const spendMoney = (minor: number) => usd.format(minor / 100);
const pct = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : "—";
const day = (value: string) => formatOperationsDate(`${value.slice(0, 10)}T12:00:00Z`, "UTC");

/** Service areas keep one color everywhere, in a fixed order; anything past the list is "Other". */
const AREA_ORDER = ["refrigeration", "hvac", "exterior", "plumbing", "forecourt", "foodservice", "electrical"];
const AREA_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
export const OTHER_COLOR = "#94a3b8";
export const areaColor = (key: string) => { const index = AREA_ORDER.indexOf(key); return index >= 0 ? AREA_COLORS[index] : OTHER_COLOR; };

/** One recorded cost, with everything the dashboard groups by. Job cost is vendor money; in-house comes from accounting. */
export interface SpendFact { id: string; workId: string; workNumber: string; problem: string; storeId: string; area: string; provider: string; assetId?: string; amount: number; date: string }
export interface SpendScope {
  period: ReturnType<typeof spendPeriod>; through: string; scopeLabel: string; storeCount: number; companyWide: boolean; singleStoreId?: string;
  facts: SpendFact[]; total: number;
  storeName: (id: string) => { number: string; name: string };
  areaName: (key: string) => string; providerName: (key: string) => string; assetName: (id?: string) => string;
  href: (path: string, changes?: Record<string, string | undefined>) => string;
  controls: { periods: FilterOptionViewModel[]; regions: FilterOptionViewModel[]; areas: FilterOptionViewModel[] };
  chips: Array<{ label: string; removeHref: string }>;
}

const KEYS = ["period", "store", "region", "category", "who"];

export function spendScope(fixture: OpsFixture, session: OperatorSession, query: Query, path = "/app/spend"): SpendScope {
  const store = first(query.store), region = first(query.region), category = first(query.category), who = first(query.who);
  const scoped = narrowScopeToStore(narrowScopeToRegion(scopeFixture(fixture, session), region), store);
  const period = spendPeriod(fixture.asOf, first(query.period));
  const through = fixture.asOf.slice(0, 10);
  const org = scoped.organizationId;
  const storeById = new Map(scoped.stores.map(row => [row.id, row]));
  const workById = new Map(scoped.workOrders.map(row => [row.id, row]));
  const vendors = new Map(fixture.vendors.filter(row => row.organizationId === org).map(row => [row.id, row.name]));
  const assets = new Map(scoped.assets.map(row => [row.id, row.name]));
  const categoryNames = new Map(fixture.taxonomyNodes.filter(node => node.organizationId === org && node.nodeKind === "category").map(node => [node.canonicalKey, node.name]));
  const facts: SpendFact[] = [];
  for (const line of fixture.costLines) {
    if (line.organizationId !== org || line.amount.currency !== "USD" || line.serviceDate < period.start || line.serviceDate.slice(0, 10) > through) continue;
    const work = workById.get(line.workOrderId);
    if (!work) continue;
    const area = work.categoryKey ?? "unclassified";
    if (category && area !== category) continue;
    const provider = costProvider(line, assignmentsForWork(fixture, line.workOrderId).filter(row => row.organizationId === org));
    if (who && provider !== who) continue;
    facts.push({ id: line.id, workId: work.id, workNumber: work.number, problem: work.shortName ?? work.problem, storeId: work.storeId, area, provider, assetId: work.assetId, amount: line.amount.amountMinor, date: line.serviceDate.slice(0, 10) });
  }
  const href = (target: string, changes: Record<string, string | undefined> = {}) => {
    const values = new URLSearchParams();
    for (const key of KEYS) { const value = first(query[key]); if (value) values.set(key, value); }
    for (const [key, value] of Object.entries(changes)) { if (value) values.set(key, value); else values.delete(key); }
    return `${target}${values.size ? `?${values}` : ""}`;
  };
  const organizationStores = fixture.stores.filter(row => row.organizationId === org);
  const selectedRegion = region ? fixture.regions.find(row => row.organizationId === org && row.id === region) : undefined;
  const scopeLabel = store && storeById.get(store) ? compactStoreLabel(`Store ${storeById.get(store)!.storeNumber} · ${storeById.get(store)!.name}`, session.organizationName)
    : selectedRegion ? `${selectedRegion.name} · ${scoped.stores.length} stores` : compactStoreLabel(session.scopeLabel, session.organizationName);
  const areaName = (key: string) => key === "unclassified" ? "Not classified" : categoryNames.get(key) ?? sentence(key);
  const providerName = (key: string) => key === "in_house" ? "Recorded on in-house jobs" : key === "unmarked" ? "Not marked" : vendors.get(key.replace(/^vendor:/, "")) ?? "Vendor";
  const regions = fixture.regions.filter(row => row.organizationId === org && scopeFixture(fixture, session).stores.some(storeRow => storeRow.regionId === row.id));
  const areas = [...new Set(scoped.workOrders.map(row => row.categoryKey).filter((value): value is string => Boolean(value)))].sort();
  return {
    period, through, scopeLabel, storeCount: scoped.stores.length,
    companyWide: !store && !region && !category && !who && scoped.stores.length === organizationStores.length,
    singleStoreId: store ?? (scoped.stores.length === 1 ? scoped.stores[0].id : undefined),
    facts, total: facts.reduce((sum, row) => sum + row.amount, 0),
    storeName: (id) => { const row = storeById.get(id); return { number: row ? `Store ${row.storeNumber}` : "Store", name: row ? compactStoreLabel(`Store ${row.storeNumber} · ${row.name}`, session.organizationName).split(" · ").slice(1).join(" · ") : "" }; },
    areaName, providerName, assetName: (id) => id ? assets.get(id) ?? "Equipment" : "Not linked to a machine",
    href: (target, changes) => href(target, changes),
    controls: {
      periods: (["3m", "6m", "12m", "ytd"] as const).map(key => ({ value: key, label: key === "ytd" ? "Year to date" : `${key.slice(0, -1)} months`, selected: period.key === key, href: href(path, { period: key, page: undefined }) })),
      regions: regions.length > 1 ? [{ value: "", label: "All regions", selected: !region, href: href(path, { region: undefined, store: undefined, page: undefined }) }, ...regions.map(row => ({ value: row.id, label: row.name, selected: row.id === region, href: href(path, { region: row.id, store: undefined, page: undefined }) }))] : [],
      areas: [{ value: "", label: "All service areas", selected: !category, href: href(path, { category: undefined, page: undefined }) }, ...areas.map(key => ({ value: key, label: areaName(key), selected: key === category, href: href(path, { category: key, page: undefined }) }))],
    },
    chips: [
      ...(category ? [{ label: areaName(category), removeHref: href(path, { category: undefined, page: undefined }) }] : []),
      ...(who ? [{ label: providerName(who), removeHref: href(path, { who: undefined, page: undefined }) }] : []),
    ],
  };
}

function sumBy(facts: SpendFact[], key: (row: SpendFact) => string) {
  const map = new Map<string, number>();
  for (const row of facts) map.set(key(row), (map.get(key(row)) ?? 0) + row.amount);
  return [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

export interface SpendMetric { id: string; label: string; value: string; detail: string; href: string }
export interface SpendSegment { key: string; label: string; amount: number; amountLabel: string; share: string; color: string; href: string }
export interface SpendGridModel {
  columns: Array<{ key: string; label: string; href: string }>;
  rows: Array<{ id: string; label: string; secondary?: string; href: string; total: string; cells: Array<{ key: string; amount: number; label: string; href: string }> }>;
  average?: { label: string; cells: string[]; total: string };
  max: number; totals: string[]; grandTotal: string;
}

/** Stores (or machines, for one store) × service areas or vendors; darker means more money; every cell opens its costs. */
export function spendGrid(scope: SpendScope, options: { by: "area" | "vendor"; rowLimit?: number; columnLimit?: number; offset?: number; rowsPage?: number }): SpendGridModel & { rowCount: number } {
  const columnKey = (row: SpendFact) => options.by === "vendor" ? row.provider : row.area;
  const single = Boolean(scope.singleStoreId);
  const rowKey = (row: SpendFact) => single ? row.assetId ?? "unlinked" : row.storeId;
  const allColumns = sumBy(scope.facts, columnKey);
  const shown = allColumns.slice(0, options.columnLimit ?? allColumns.length);
  const shownKeys = new Set(shown.map(([key]) => key));
  const hasOther = allColumns.length > shown.length;
  const col = (row: SpendFact) => shownKeys.has(columnKey(row)) ? columnKey(row) : "__other";
  const allRows = sumBy(scope.facts, rowKey);
  const offset = options.offset ?? 0;
  const pageRows = allRows.slice(offset, offset + (options.rowLimit ?? allRows.length));
  const filter = (key: string) => options.by === "vendor" ? { who: key } : { category: key };
  const rowFilter = (key: string) => single ? { asset: key } : { store: key };
  const columns = [...shown.map(([key]) => ({ key, label: options.by === "vendor" ? scope.providerName(key) : scope.areaName(key), href: scope.href("/app/spend/costs", filter(key)) })),
    ...(hasOther ? [{ key: "__other", label: "Other", href: scope.href("/app/spend/costs") }] : [])];
  const cellAmount = new Map<string, number>();
  for (const row of scope.facts) { const key = `${rowKey(row)}|${col(row)}`; cellAmount.set(key, (cellAmount.get(key) ?? 0) + row.amount); }
  const rows = pageRows.map(([key, total]) => {
    const store = scope.storeName(key);
    return { id: key, label: single ? scope.assetName(key === "unlinked" ? undefined : key) : store.number, secondary: single ? undefined : store.name,
      href: single ? key === "unlinked" ? scope.href("/app/spend/costs") : `/app/equipment/${encodeURIComponent(key)}` : scope.href("/app/spend", { store: key, region: undefined }), total: spendMoney(total),
      cells: columns.map(column => { const amount = cellAmount.get(`${key}|${column.key}`) ?? 0; return { key: column.key, amount, label: amount ? spendMoney(amount) : "—",
        href: column.key === "__other" ? scope.href("/app/spend/costs", single ? {} : { store: key }) : scope.href("/app/spend/costs", { ...(single ? {} : rowFilter(key)), ...filter(column.key) }) }; }) };
  });
  const columnTotals = columns.map(column => scope.facts.filter(row => col(row) === column.key).reduce((sum, row) => sum + row.amount, 0));
  const storeCount = single ? 0 : allRows.length;
  return {
    columns, rows, rowCount: allRows.length,
    max: Math.max(1, ...rows.flatMap(row => row.cells.map(cell => cell.amount))),
    totals: columnTotals.map(spendMoney), grandTotal: spendMoney(scope.total),
    average: storeCount > 1 ? { label: `Typical store (average of ${storeCount})`, cells: columnTotals.map(value => spendMoney(Math.round(value / storeCount))), total: spendMoney(Math.round(scope.total / storeCount)) } : undefined,
  };
}

function pagination(total: number, page: number, size: number, hrefFor: (page: number) => string): PaginationViewModel | undefined {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages === 1) return undefined;
  return { summary: `Page ${page} of ${pages}`, currentPage: page, totalPages: pages, pageLinks: [], previousHref: page > 1 ? hrefFor(page - 1) : undefined, nextHref: page < pages ? hrefFor(page + 1) : undefined };
}
const pageOf = (query: Query) => { const value = Number(first(query.page) ?? 1); return Number.isSafeInteger(value) && value > 0 ? value : 1; };

/** The dashboard: four numbers and four cards, each opening its own page. */
export function buildSpendDashboard(fixture: OpsFixture, session: OperatorSession, query: Query) {
  const scope = spendScope(fixture, session, query);
  const storeTotals = sumBy(scope.facts, row => row.storeId);
  const typical = median(scope.facts.length ? storeTotals.map(([, value]) => value) : []);
  const [topStoreId, topStoreAmount] = storeTotals[0] ?? ["", 0];
  // In-house: accounting's company-wide totals wholly inside the period; never shown against part of the company.
  const accounting = activeTotals((fixture.spendTotals ?? []).filter(row => row.organizationId === session.organizationId && row.currency === "USD"))
    .filter(row => row.periodStart >= scope.period.start && row.periodEnd <= scope.through);
  const vendorCost = (from: string, to: string) => fixture.costLines.reduce((sum, line) => line.organizationId === session.organizationId && line.amount.currency === "USD" && line.serviceDate.slice(0, 10) >= from && line.serviceDate.slice(0, 10) <= to
    && costProvider(line, assignmentsForWork(fixture, line.workOrderId).filter(row => row.organizationId === session.organizationId)) !== "in_house" ? sum + line.amount.amountMinor : sum, 0);
  const inHouse = accounting.reduce((sum, row) => sum + (row.kind === "in_house" ? row.amountMinor : Math.max(0, row.amountMinor - vendorCost(row.periodStart, row.periodEnd))), 0);
  const vendorTotal = scope.facts.filter(row => row.provider !== "in_house").reduce((sum, row) => sum + row.amount, 0);
  const metrics: SpendMetric[] = [
    { id: "recorded", label: "Recorded job cost", value: spendMoney(scope.total), detail: `${scope.facts.length} costs · ${pct(vendorTotal, scope.total)} paid to vendors`, href: scope.href("/app/spend/costs") },
    { id: "in-house", label: "In-house team", value: scope.companyWide && accounting.length ? spendMoney(inHouse) : "—",
      detail: !scope.companyWide ? "Entered by accounting for the whole company" : accounting.length ? `From accounting · ${day(accounting[0].periodStart)} – ${day(accounting.at(-1)!.periodEnd)}` : "Not entered for these dates", href: "/app/spend/totals" },
    ...(scope.singleStoreId ? [] : [
      { id: "typical", label: "Typical store", value: spendMoney(typical), detail: `Middle of ${storeTotals.length} stores`, href: scope.href("/app/spend/stores") },
      { id: "top-store", label: "Highest store", value: topStoreId ? scope.storeName(topStoreId).number : "—", detail: topStoreId ? `${spendMoney(topStoreAmount)}${typical ? ` · ${(topStoreAmount / typical).toFixed(1)}× typical` : ""}` : "No costs", href: topStoreId ? scope.href("/app/spend", { store: topStoreId, region: undefined }) : scope.href("/app/spend/stores") },
    ]),
  ];
  const areas = sumBy(scope.facts, row => row.area);
  const areaSegments = (rows: Array<[string, number]>, whole: number): SpendSegment[] => {
    const top = rows.slice(0, 6), rest = rows.slice(6).reduce((sum, [, value]) => sum + value, 0);
    return [...top.map(([key, amount]) => ({ key, label: scope.areaName(key), amount, amountLabel: spendMoney(amount), share: pct(amount, whole), color: areaColor(key), href: scope.href("/app/spend/costs", { category: key }) })),
      ...(rest ? [{ key: "__other", label: "Other", amount: rest, amountLabel: spendMoney(rest), share: pct(rest, whole), color: OTHER_COLOR, href: scope.href("/app/spend/costs") }] : [])];
  };
  const vendors = sumBy(scope.facts, row => row.provider).slice(0, 5).map(([key, amount]) => ({
    key, label: scope.providerName(key), amountLabel: spendMoney(amount), share: pct(amount, scope.total), amount, href: scope.href("/app/spend/costs", { who: key }),
    segments: areaSegments(sumBy(scope.facts.filter(row => row.provider === key), row => row.area), amount),
  }));
  const equipment = equipmentRows(scope).slice(0, 5);
  return {
    scope, metrics,
    grid: spendGrid(scope, { by: "area", rowLimit: 6, columnLimit: 5 }),
    areas: areaSegments(areas, scope.total),
    vendors, vendorMax: Math.max(1, ...vendors.map(row => row.amount)),
    equipment,
  };
}

export interface SpendEquipmentRow { id: string; name: string; store: string; area: string; jobs: number; amount: number; amountLabel: string; age?: string; href: string; costsHref: string; replaceHref: string }
function equipmentRows(scope: SpendScope): SpendEquipmentRow[] {
  const byAsset = new Map<string, SpendFact[]>();
  for (const row of scope.facts) if (row.assetId) byAsset.set(row.assetId, [...(byAsset.get(row.assetId) ?? []), row]);
  return [...byAsset].map(([id, rows]) => {
    const amount = rows.reduce((sum, row) => sum + row.amount, 0), store = scope.storeName(rows[0].storeId);
    return { id, name: scope.assetName(id), store: `${store.number}${store.name ? ` · ${store.name}` : ""}`, area: scope.areaName(rows[0].area), jobs: new Set(rows.map(row => row.workId)).size, amount, amountLabel: spendMoney(amount),
      href: `/app/equipment/${encodeURIComponent(id)}`, costsHref: scope.href("/app/spend/costs", { asset: id }), replaceHref: `/app/lifecycle?asset=${encodeURIComponent(id)}` };
  }).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
}

export function buildSpendStores(fixture: OpsFixture, session: OperatorSession, query: Query) {
  const scope = spendScope(fixture, session, query, "/app/spend/stores");
  const by = first(query.by) === "vendor" ? "vendor" as const : "area" as const;
  const size = 15, page = pageOf(query);
  const grid = spendGrid(scope, { by, rowLimit: size, offset: (page - 1) * size, columnLimit: 6 });
  return { scope, by, grid, byOptions: (["area", "vendor"] as const).map(key => ({ value: key, label: key === "area" ? "By service area" : "By vendor", selected: key === by, href: `${scope.href("/app/spend/stores")}${scope.href("/app/spend/stores").includes("?") ? "&" : "?"}by=${key}` })),
    pagination: pagination(grid.rowCount, page, size, next => `${scope.href("/app/spend/stores")}${scope.href("/app/spend/stores").includes("?") ? "&" : "?"}${new URLSearchParams({ ...(by === "vendor" ? { by } : {}), page: String(next) })}`) };
}

export function buildSpendVendors(fixture: OpsFixture, session: OperatorSession, query: Query) {
  const scope = spendScope(fixture, session, query, "/app/spend/vendors");
  const size = 15, page = pageOf(query);
  const all = sumBy(scope.facts, row => row.provider);
  const rows = all.slice((page - 1) * size, page * size).map(([key, amount]) => {
    const facts = scope.facts.filter(row => row.provider === key);
    return { key, label: scope.providerName(key), amount, amountLabel: spendMoney(amount), share: pct(amount, scope.total), jobs: new Set(facts.map(row => row.workId)).size, stores: new Set(facts.map(row => row.storeId)).size,
      href: scope.href("/app/spend/costs", { who: key }), vendorHref: key.startsWith("vendor:") ? `/app/vendors/${encodeURIComponent(key.slice(7))}` : undefined,
      segments: sumBy(facts, row => row.area).map(([area, value]) => ({ key: area, label: scope.areaName(area), amount: value, share: pct(value, amount), color: areaColor(area) })) };
  });
  return { scope, rows, max: Math.max(1, ...all.map(([, value]) => value)), count: all.length,
    pagination: pagination(all.length, page, size, next => `${scope.href("/app/spend/vendors")}${scope.href("/app/spend/vendors").includes("?") ? "&" : "?"}page=${next}`) };
}

export function buildSpendEquipment(fixture: OpsFixture, session: OperatorSession, query: Query) {
  const scope = spendScope(fixture, session, query, "/app/spend/equipment");
  const size = 25, page = pageOf(query);
  const all = equipmentRows(scope);
  const unlinked = scope.facts.filter(row => !row.assetId).reduce((sum, row) => sum + row.amount, 0);
  return { scope, rows: all.slice((page - 1) * size, page * size), count: all.length, offset: (page - 1) * size, unlinked: unlinked ? spendMoney(unlinked) : undefined,
    pagination: pagination(all.length, page, size, next => `${scope.href("/app/spend/equipment")}${scope.href("/app/spend/equipment").includes("?") ? "&" : "?"}page=${next}`) };
}
