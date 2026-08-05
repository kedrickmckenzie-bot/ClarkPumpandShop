"use client";

import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileStack,
  Filter,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Store,
  UsersRound,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CreatedStoreDetail } from "@/components/created-portfolio-detail";
import { PlatformBadge, PlatformBreadcrumbs, PlatformPageHeader, PlatformProgress, PlatformSectionHeader, PlatformStat } from "@/components/platform-ui";
import Link from "@/components/site-link";
import { formatCurrency, formatDate, formatPercent, isOpenWorkOrder, pmCompliance, spendForPeriod, storeComparison } from "@/lib/domain/analytics";
import type { Store as StoreRecord } from "@/lib/domain/types";
import { platformData, PLATFORM_NOW } from "@/lib/platform/data";
import { useEffect, useMemo, useState } from "react";

const now = new Date(PLATFORM_NOW);
const ttmStart = new Date(Date.UTC(2025, 7, 5));
const priorStart = new Date(Date.UTC(2024, 7, 5));
const pageSize = 15;

function statusTone(status: string): "good" | "warning" | "neutral" {
  return status === "active" ? "good" : status === "opening" ? "warning" : "neutral";
}

export function StoreDirectory({ initialRegion = "" }: { initialRegion?: string }) {
  const comparison = useMemo(() => storeComparison(platformData, PLATFORM_NOW), []);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(platformData.regions.some((item) => item.id === initialRegion) ? initialRegion : "all");
  const [risk, setRisk] = useState("all");
  const [page, setPage] = useState(1);
  const [createdStores, setCreatedStores] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    fetch("/api/registry?entity=stores").then((response) => response.json()).then((raw) => {
      const result = raw as { ok?: boolean; records?: Array<Record<string, unknown>> };
      if (result.ok) setCreatedStores(result.records ?? []);
    }).catch(() => undefined);
  }, []);

  const remoteComparison = useMemo<ReturnType<typeof storeComparison>>(() => createdStores
    .filter((record) => !platformData.stores.some((store) => store.id === record.id))
    .map((record) => {
      const id = String(record.id ?? "");
      return {
        store: {
          id,
          regionId: record.regionId ? String(record.regionId) : undefined,
          code: String(record.code ?? "New"),
          name: String(record.name ?? `Store ${record.code ?? "New"}`),
          city: String(record.city ?? ""),
          state: String(record.state ?? ""),
          address1: String(record.address1 ?? ""),
          postalCode: String(record.postalCode ?? ""),
          phone: String(record.phone ?? ""),
          managerName: String(record.managerName ?? "Manager not assigned"),
          district: String(record.district ?? "Unassigned"),
          status: "opening" as const,
          openedAt: String(record.createdAt ?? PLATFORM_NOW),
          squareFeet: Number(record.squareFeet ?? 0),
          latitude: 0,
          longitude: 0,
          geofenceRadiusM: 200,
        },
        openCount: 0,
        criticalCount: 0,
        spend: 0,
        priorSpend: 0,
        change: 0,
        pm: pmCompliance(platformData, { storeId: id }, PLATFORM_NOW),
        reactivePlannedRatio: 0,
        repeatVisits: 0,
        replacementCandidates: 0,
        refrigerationSpend: 0,
        outlierRatio: 0,
        isOutlier: false,
      };
    }), [createdStores]);
  const allComparison = useMemo(() => [...comparison, ...remoteComparison], [comparison, remoteComparison]);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return allComparison.filter((row) => {
      const haystack = `${row.store.code} ${row.store.name} ${row.store.address1} ${row.store.city} ${row.store.state} ${row.store.postalCode}`.toLowerCase();
      if (search && !haystack.includes(search)) return false;
      if (region !== "all" && row.store.regionId !== region) return false;
      if (risk === "outlier" && !row.isOutlier) return false;
      if (risk === "critical" && !row.criticalCount) return false;
      if (risk === "replacement" && !row.replacementCandidates) return false;
      return true;
    }).sort((a, b) => a.store.code.localeCompare(b.store.code, undefined, { numeric: true }));
  }, [allComparison, query, region, risk]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  const portfolioSpend = allComparison.reduce((sum, row) => sum + row.spend, 0);
  const openTotal = allComparison.reduce((sum, row) => sum + row.openCount, 0);
  const outliers = allComparison.filter((row) => row.isOutlier).length;
  const avgPm = allComparison.reduce((sum, row) => sum + row.pm.value, 0) / allComparison.length;

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <AppShell><div className="pf-page store-directory-page">
      <PlatformPageHeader eyebrow={`Portfolio · ${allComparison.length} showcase and created locations`} title="Find any store, then understand its complete maintenance position." description="Search by store number, name, street address, city, ZIP code, or a legacy identifier. The product model is ready for the pilot operator's full portfolio.">
        <Link className="pf-secondary-button" href="/setup?section=imports"><FileStack />Import stores</Link>
        <Link className="pf-primary-button" href="/stores/new"><Plus />Create store</Link>
      </PlatformPageHeader>

      <section className="pf-stat-grid store-directory-stats">
        <PlatformStat label="Active stores" value={String(platformData.stores.filter((store) => store.status === "active").length)} note={`${platformData.regions.length} regions · ${new Set(platformData.stores.map((store) => store.district)).size} districts`} icon={Store} />
        <PlatformStat label="TTM maintenance cost" value={formatCurrency(portfolioSpend, true)} note="Paid invoices less credits" icon={CircleDollarSign} href="/financials?view=payments" />
        <PlatformStat label="Open work" value={String(openTotal)} note="All internal and outside providers" icon={ClipboardList} href="/work-orders?status=open" />
        <PlatformStat label="Cost outliers" value={String(outliers)} note="Explainable cohort rules" icon={AlertCircle} tone="warning" href="/reports?report=store-cost" />
        <PlatformStat label="Average PM compliance" value={formatPercent(avgPm)} note="Verified, on-time occurrences" icon={CalendarCheck} tone={avgPm >= .9 ? "positive" : "warning"} href="/pm" />
      </section>

      <section className="pf-panel store-directory-panel">
        <div className="directory-toolbar">
          <label className="directory-search"><Search /><input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="Search store number or address…" /></label>
          <label><span>Region</span><select value={region} onChange={(event) => updateFilter(setRegion, event.target.value)}><option value="all">All regions</option>{platformData.regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Attention</span><select value={risk} onChange={(event) => updateFilter(setRisk, event.target.value)}><option value="all">All stores</option><option value="outlier">Cost outliers</option><option value="critical">Open critical</option><option value="replacement">Replacement review</option></select></label>
          <button type="button" className="directory-filter-button"><Filter />More filters</button>
          <span className="directory-result-count">{rows.length} matching stores</span>
        </div>
        <div className="pf-table-scroll"><table className="pf-table store-directory-table"><thead><tr><th>Store</th><th>Region / district</th><th>Open work</th><th>TTM actual</th><th>Vs prior</th><th>PM compliance</th><th>Management signal</th></tr></thead><tbody>
          {paged.map((row) => <tr key={row.store.id}>
            <td><Link href={`/stores/${row.store.id}`} className="store-identity"><span>#{row.store.code}</span><div><strong>{row.store.city}</strong><small>{row.store.address1}, {row.store.state} {row.store.postalCode}</small></div></Link></td>
            <td><strong>{platformData.regions.find((item) => item.id === row.store.regionId)?.name ?? "No region"}</strong><small>{row.store.district} · {row.store.managerName}</small></td>
            <td><strong>{row.openCount}</strong><small>{row.criticalCount ? `${row.criticalCount} critical` : "No critical"}</small></td>
            <td><strong>{formatCurrency(row.spend)}</strong><small>{formatCurrency(row.refrigerationSpend)} refrigeration</small></td>
            <td><strong className={row.change > .1 ? "text-negative" : row.change < 0 ? "text-positive" : ""}>{row.change >= 0 ? "+" : ""}{formatPercent(row.change, 0)}</strong><small>Trailing 12 months</small></td>
            <td>{row.store.status === "opening" ? <PlatformBadge tone="neutral">No PM history</PlatformBadge> : <PlatformProgress value={row.pm.value} tone={row.pm.value >= .9 ? "teal" : row.pm.value >= .8 ? "amber" : "red"} label={formatPercent(row.pm.value)} />}</td>
            <td>{row.store.status === "opening" ? <PlatformBadge tone="info">Commissioning</PlatformBadge> : row.isOutlier ? <PlatformBadge tone="critical">Cost outlier</PlatformBadge> : row.replacementCandidates ? <PlatformBadge tone="warning">Replacement review</PlatformBadge> : row.criticalCount ? <PlatformBadge tone="info">Critical work</PlatformBadge> : <PlatformBadge tone="good">Within range</PlatformBadge>}</td>
          </tr>)}
        </tbody></table></div>
        <footer className="directory-pagination"><span>Showing {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)} of {rows.length}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><em>Page {page} of {totalPages}</em><button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></footer>
      </section>
    </div></AppShell>
  );
}

const storeTabs = ["Overview", "Costs", "Equipment", "Maintenance", "PM", "Providers", "Setup"] as const;
type StoreTab = typeof storeTabs[number];

export function StoreDashboard({ storeId }: { storeId: string }) {
  const store = platformData.stores.find((item) => item.id === storeId);
  if (!store) return <CreatedStoreDetail storeId={storeId} />;
  return <KnownStoreDashboard store={store} />;
}

function KnownStoreDashboard({ store }: { store: StoreRecord }) {
  const [tab, setTab] = useState<StoreTab>("Overview");
  const region = platformData.regions.find((item) => item.id === store.regionId);
  const systems = platformData.systems.filter((item) => item.storeId === store.id);
  const systemIds = new Set(systems.map((item) => item.id));
  const assets = platformData.assets.filter((item) => systemIds.has(item.storeSystemId));
  const assetIds = new Set(assets.map((item) => item.id));
  const components = platformData.components.filter((item) => assetIds.has(item.assetId));
  const workOrders = platformData.workOrders.filter((item) => item.storeId === store.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openWork = workOrders.filter(isOpenWorkOrder);
  const ttmSpend = spendForPeriod(platformData, ttmStart, now, { storeId: store.id });
  const priorSpend = spendForPeriod(platformData, priorStart, ttmStart, { storeId: store.id });
  const change = priorSpend ? (ttmSpend - priorSpend) / priorSpend : 0;
  const pm = pmCompliance(platformData, { storeId: store.id }, PLATFORM_NOW);
  const allocations = platformData.allocations.filter((item) => item.storeId === store.id);
  const storeInvoiceIds = new Set(allocations.map((item) => item.invoiceId));
  const invoices = platformData.invoices.filter((item) => storeInvoiceIds.has(item.id)).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const storeVendorIds = new Set(workOrders.map((item) => item.vendorId).filter(Boolean));
  const pendingFinancial = workOrders.filter((item) => ["waiting_on_quote", "waiting_on_approval", "completed_pending_invoice"].includes(item.status));

  const categoryRows = platformData.categories.map((category) => {
    const current = spendForPeriod(platformData, ttmStart, now, { storeId: store.id, categoryId: category.id });
    const prior = spendForPeriod(platformData, priorStart, ttmStart, { storeId: store.id, categoryId: category.id });
    const categorySystems = systems.filter((item) => item.categoryId === category.id);
    const rowAssetIds = new Set(assets.filter((asset) => categorySystems.some((system) => system.id === asset.storeSystemId)).map((asset) => asset.id));
    const categoryWork = workOrders.filter((item) => item.categoryId === category.id);
    const assetMapped = categoryWork.filter((item) => item.assetId).length;
    return { category, current, prior, systems: categorySystems, assets: rowAssetIds.size, open: categoryWork.filter(isOpenWorkOrder).length, coverage: categoryWork.length ? assetMapped / categoryWork.length : 0 };
  }).filter((row) => row.current || row.open || row.systems.length).sort((a, b) => b.current - a.current);

  return (
    <AppShell><div className="pf-page store-dashboard-page">
      <PlatformBreadcrumbs items={[{ label: "Stores", href: "/stores" }, { label: `Store ${store.code}` }]} />
      <div className="store-profile-header">
        <div className="store-profile-id"><span>#{store.code}</span><div><p>{region?.name} · {store.district}</p><h1>{store.city}</h1><address><MapPin />{store.address1}, {store.city}, {store.state} {store.postalCode}</address></div></div>
        <div className="store-profile-actions"><PlatformBadge tone={statusTone(store.status)}>{store.status.replaceAll("_", " ")}</PlatformBadge><Link className="pf-secondary-button" href={`/stores/new?copy=${store.id}`}><Boxes />Copy setup</Link><Link className="pf-primary-button" href={`/work-orders/new?storeId=${store.id}`}><Plus />New work order</Link></div>
      </div>

      <section className="store-summary-strip">
        <div><small>Store manager</small><strong>{store.managerName}</strong><span>{store.phone}</span></div><div><small>Operating profile</small><strong>{store.squareFeet.toLocaleString()} sq ft</strong><span>Opened {formatDate(store.openedAt)}</span></div><div><small>Equipment register</small><strong>{assets.length} assets</strong><span>{components.length} tracked components</span></div><div><small>Service coverage</small><strong>{storeVendorIds.size} providers</strong><span>{systems.length} configured service groups</span></div><div><small>Next management action</small><strong>{openWork[0]?.nextAction ?? "No urgent action"}</strong><span>{openWork[0]?.accountableParty ?? "All work current"}</span></div>
      </section>

      <nav className="store-tabs" aria-label="Store record sections">{storeTabs.map((item) => <button type="button" className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}{item === "Maintenance" && <em>{openWork.length}</em>}{item === "Costs" && pendingFinancial.length > 0 && <em>{pendingFinancial.length}</em>}</button>)}</nav>

      {tab === "Overview" && <>
        <section className="pf-stat-grid store-stat-grid">
          <PlatformStat label="TTM maintenance cost" value={formatCurrency(ttmSpend, true)} note={`${change >= 0 ? "+" : ""}${formatPercent(change, 0)} vs prior period`} icon={CircleDollarSign} tone={change > .1 ? "warning" : "default"} />
          <PlatformStat label="Open work" value={String(openWork.length)} note={`${openWork.filter((item) => item.priority === "critical").length} critical · ${openWork.filter((item) => item.dueAt && new Date(item.dueAt) < now).length} overdue`} icon={ClipboardList} tone={openWork.some((item) => item.priority === "critical") ? "critical" : "default"} />
          <PlatformStat label="PM compliance" value={formatPercent(pm.value)} note={`${pm.numerator} of ${pm.denominator} verified on time`} icon={ShieldCheck} tone={pm.value >= .9 ? "positive" : "warning"} />
          <PlatformStat label="Financial decisions" value={String(pendingFinancial.length)} note="Proposals, approvals, or invoice close" icon={CircleDollarSign} tone={pendingFinancial.length ? "info" : "positive"} />
          <PlatformStat label="Equipment coverage" value={formatPercent(workOrders.length ? workOrders.filter((item) => item.assetId).length / workOrders.length : 0)} note="Work classified to an individual asset" icon={Wrench} />
        </section>
        <div className="pf-dashboard-grid store-overview-grid">
          <section className="pf-panel store-cost-tree"><PlatformSectionHeader title="Cost and maintenance hierarchy" description="Start broad, then drill only as far as the record supports." /><div className="pf-table-scroll"><table className="pf-table"><thead><tr><th>Service category</th><th>TTM actual</th><th>Vs prior</th><th>Open</th><th>Equipment</th><th>Classification</th></tr></thead><tbody>{categoryRows.map((row) => {
            const system = row.systems[0];
            const href = system ? `/stores/${store.id}/systems/${system.id}` : `/work-orders?store=${store.id}&category=${row.category.id}&status=all`;
            const delta = row.prior ? (row.current - row.prior) / row.prior : 0;
            return <tr key={row.category.id}><td><Link href={href} className="category-tree-link"><i style={{ background: row.category.color }} /><span><strong>{row.category.name}</strong><small>{system?.name ?? "No deeper setup required"}</small></span><ArrowRight /></Link></td><td><strong>{formatCurrency(row.current)}</strong><small>Paid less credits</small></td><td><strong className={delta > .1 ? "text-negative" : delta < 0 ? "text-positive" : ""}>{delta >= 0 ? "+" : ""}{formatPercent(delta, 0)}</strong></td><td><strong>{row.open}</strong></td><td><strong>{row.assets}</strong><small>tracked assets</small></td><td><PlatformProgress value={row.coverage} tone={row.coverage >= .7 ? "teal" : "amber"} label={formatPercent(row.coverage)} /></td></tr>;
          })}</tbody></table></div></section>
          <aside className="store-overview-side">
            <section className="pf-panel"><PlatformSectionHeader title="Accountability now" description="Every unresolved item has an owner and next action." href={`/accountability?store=${store.id}`} /><div className="store-action-list">{openWork.slice(0, 6).map((item) => <Link key={item.id} href={`/work-orders/${item.id}`}><span className={item.dueAt && new Date(item.dueAt) < now ? "late" : ""}><ClipboardList /></span><div><strong>{item.number} · {item.title}</strong><small>{item.accountableParty} · {item.nextAction}</small><em>{item.dueAt ? `Due ${formatDate(item.dueAt, true)}` : "No deadline"}</em></div><PlatformBadge tone={item.priority === "critical" ? "critical" : item.priority === "high" ? "warning" : "neutral"}>{item.priority}</PlatformBadge></Link>)}</div></section>
            <section className="pf-panel store-management-note"><PlatformSectionHeader title="Management context" /><div><p><Building2 /><span><strong>Regional owner</strong><small>{region?.name} Facilities Lead</small></span></p><p><UsersRound /><span><strong>Store manager</strong><small>{store.managerName}</small></span></p><p><CheckCircle2 /><span><strong>Readiness</strong><small>Core routing and financial policies active</small></span></p></div></section>
          </aside>
        </div>
      </>}

      {tab === "Costs" && <><div className="store-tab-toolbar"><span>Store-scoped maintenance accounting</span><Link className="pf-secondary-button" href={`/financials?view=invoices&store=${store.id}`}><FileStack />Open full store ledger</Link></div><StoreCosts store={store} invoices={invoices} allocations={allocations} categoryRows={categoryRows} /></>}
      {tab === "Equipment" && <StoreEquipment store={store} systems={systems} assets={assets} components={components} />}
      {tab === "Maintenance" && <StoreMaintenance storeId={store.id} workOrders={workOrders} />}
      {tab === "PM" && <StorePm store={store} />}
      {tab === "Providers" && <StoreProviders vendorIds={storeVendorIds} workOrders={workOrders} />}
      {tab === "Setup" && <StoreSetup store={store} systems={systems} assets={assets} />}
    </div></AppShell>
  );
}

function StoreCosts({ store, invoices, allocations, categoryRows }: { store: StoreRecord; invoices: typeof platformData.invoices; allocations: typeof platformData.allocations; categoryRows: Array<{ category: typeof platformData.categories[number]; current: number; prior: number; systems: typeof platformData.systems; assets: number; open: number; coverage: number }> }) {
  const allocated = allocations.reduce((sum, item) => sum + item.amountCents, 0);
  const budget = platformData.systems.filter((item) => item.storeId === store.id).reduce((sum, item) => sum + item.annualBudgetCents, 0);
  return <div className="store-tab-layout"><section className="pf-stat-grid store-stat-grid"><PlatformStat label="Annual budget" value={formatCurrency(budget, true)} note="All service categories" icon={CircleDollarSign} /><PlatformStat label="Allocated invoice cost" value={formatCurrency(allocated, true)} note={`${invoices.length} invoice records`} icon={FileStack} /><PlatformStat label="Invoice review" value={String(invoices.filter((item) => ["submitted", "review"].includes(item.status)).length)} note="Needs validation or approval" icon={AlertCircle} tone="warning" /><PlatformStat label="Credits recovered" value={formatCurrency(platformData.credits.filter((credit) => invoices.some((invoice) => invoice.id === credit.invoiceId)).reduce((sum, credit) => sum + credit.amountCents, 0), true)} note="Posted and potential credits" icon={CheckCircle2} tone="positive" /></section><div className="pf-dashboard-grid pf-dashboard-grid-equal"><section className="pf-panel"><PlatformSectionHeader title="Budget and actual by category" description="Physical hierarchy and financial coding remain separate." /><table className="pf-table"><thead><tr><th>Category</th><th>Budget</th><th>TTM actual</th><th>Utilization</th></tr></thead><tbody>{categoryRows.map((row) => { const rowBudget = row.systems.reduce((sum, system) => sum + system.annualBudgetCents, 0); return <tr key={row.category.id}><td><strong>{row.category.name}</strong><small>{row.systems[0]?.glCode ? `Default GL ${row.systems[0].glCode}` : "Financial mapping pending"}</small></td><td><strong>{formatCurrency(rowBudget)}</strong></td><td><strong>{formatCurrency(row.current)}</strong></td><td><PlatformProgress value={rowBudget ? row.current / rowBudget : 0} tone={row.current > rowBudget ? "red" : "teal"} label={formatPercent(rowBudget ? row.current / rowBudget : 0)} /></td></tr>; })}</tbody></table></section><section className="pf-panel"><PlatformSectionHeader title="Invoices and allocations" description="Every dollar retains its work-order and equipment path." href="/financials?view=invoices" /><table className="pf-table"><thead><tr><th>Invoice</th><th>Provider</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.slice(0, 10).map((invoice) => <tr key={invoice.id}><td><Link href={`/work-orders/${invoice.workOrderId}`}><strong>{invoice.number}</strong><small>{formatDate(invoice.issuedAt)}</small></Link></td><td><strong>{platformData.vendors.find((vendor) => vendor.id === invoice.vendorId)?.shortName ?? "Internal maintenance"}</strong></td><td><strong>{formatCurrency(invoice.totalCents)}</strong></td><td><PlatformBadge tone={invoice.status === "paid" ? "good" : invoice.status === "review" ? "warning" : "info"}>{invoice.status}</PlatformBadge></td></tr>)}</tbody></table></section></div></div>;
}

function StoreEquipment({ store, systems, assets, components }: { store: StoreRecord; systems: typeof platformData.systems; assets: typeof platformData.assets; components: typeof platformData.components }) {
  return <section className="pf-panel store-equipment-panel"><PlatformSectionHeader title="Equipment hierarchy" description="Configure only the depth that creates operational or financial value."><Link className="pf-secondary-button" href={`/assets/new?storeId=${store.id}`}><Plus />Add equipment</Link></PlatformSectionHeader><div className="equipment-tree">{systems.map((system) => { const systemAssets = assets.filter((asset) => asset.storeSystemId === system.id); return <article key={system.id}><header><span style={{ background: platformData.categories.find((item) => item.id === system.categoryId)?.color }}><Wrench /></span><div><Link href={`/stores/${store.id}/systems/${system.id}`}><strong>{system.name}</strong></Link><small>{system.code} · {system.type} · GL {system.glCode}</small></div><PlatformBadge tone={system.state === "exception" ? "critical" : system.state === "watch" ? "warning" : "good"}>{system.state}</PlatformBadge></header><div className="equipment-tree-assets">{systemAssets.length ? systemAssets.map((asset) => <Link href={`/assets/${asset.id}`} key={asset.id}><span><Boxes /></span><div><strong>{asset.assetTag} · {asset.name}</strong><small>{asset.assetClass} · {asset.manufacturer} {asset.model} · {components.filter((component) => component.assetId === asset.id).length} components</small></div><PlatformBadge tone={asset.state === "operational" ? "good" : asset.state === "watch" || asset.state === "service_due" ? "warning" : "critical"}>{asset.state.replaceAll("_", " ")}</PlatformBadge><ArrowRight /></Link>) : <div className="equipment-tree-empty">No individual equipment required. Work and cost can remain at this level.<Link href={`/assets/new?storeId=${store.id}&systemId=${system.id}`}>Add equipment</Link></div>}</div></article>; })}</div></section>;
}

function StoreMaintenance({ storeId, workOrders }: { storeId: string; workOrders: typeof platformData.workOrders }) {
  return <section className="pf-panel"><PlatformSectionHeader title="Store maintenance history" description="Internal and outside-provider work in one authoritative record stream." href={`/work-orders?store=${storeId}&status=all`}><Link className="pf-primary-button" href={`/work-orders/new?storeId=${storeId}`}><Plus />New work order</Link></PlatformSectionHeader><div className="pf-table-scroll"><table className="pf-table"><thead><tr><th>Work order</th><th>Category / equipment</th><th>Provider</th><th>Current accountability</th><th>Due</th><th>Status</th></tr></thead><tbody>{workOrders.map((item) => <tr key={item.id}><td><Link href={`/work-orders/${item.id}`}><strong>{item.number}</strong><small>{item.title}</small></Link></td><td><strong>{platformData.categories.find((category) => category.id === item.categoryId)?.name}</strong><small>{platformData.assets.find((asset) => asset.id === item.assetId)?.name ?? (item.assetId ? "Equipment record" : "Equipment not identified")}</small></td><td><strong>{item.assignedToName ?? platformData.vendors.find((vendor) => vendor.id === item.vendorId)?.shortName ?? "Unassigned"}</strong><small>{item.assignmentType ?? (item.vendorId ? "Outside provider" : "Internal")}</small></td><td><strong>{item.accountableParty}</strong><small>{item.nextAction}</small></td><td><strong>{item.dueAt ? formatDate(item.dueAt, true) : "—"}</strong></td><td><PlatformBadge tone={item.status === "closed" ? "good" : item.priority === "critical" ? "critical" : "warning"}>{item.status.replaceAll("_", " ")}</PlatformBadge></td></tr>)}</tbody></table></div></section>;
}

function StorePm({ store }: { store: StoreRecord }) { const occurrences = platformData.pmOccurrences.filter((item) => item.storeId === store.id); return <section className="pf-panel"><PlatformSectionHeader title="Preventive maintenance" description="Plans generate auditable occurrences and ordinary work orders." href={`/pm?store=${store.id}`} /><table className="pf-table"><thead><tr><th>Plan</th><th>Target</th><th>Window</th><th>Work order</th><th>Verification</th><th>Status</th></tr></thead><tbody>{occurrences.map((item) => <tr key={item.id}><td><strong>{platformData.pmPlans.find((plan) => plan.id === item.planId)?.name ?? item.planId}</strong></td><td><strong>{platformData.assets.find((asset) => asset.id === item.assetId)?.name ?? platformData.systems.find((system) => system.id === item.systemId)?.name ?? `Store ${store.code}`}</strong></td><td><strong>{formatDate(item.windowStart)} – {formatDate(item.windowEnd)}</strong></td><td>{item.workOrderId ? <Link href={`/work-orders/${item.workOrderId}`}><strong>{platformData.workOrders.find((work) => work.id === item.workOrderId)?.number}</strong></Link> : "—"}</td><td><PlatformBadge tone={item.verified ? "good" : "warning"}>{item.verified ? "verified" : "pending"}</PlatformBadge></td><td><PlatformBadge tone={item.status.includes("on_time") ? "good" : item.status === "missed" ? "critical" : "info"}>{item.status.replaceAll("_", " ")}</PlatformBadge></td></tr>)}</tbody></table>{!occurrences.length && <div className="simple-empty">No occurrences are due in the current reporting window.</div>}</section>; }

function StoreProviders({ vendorIds, workOrders }: { vendorIds: Set<string | undefined>; workOrders: typeof platformData.workOrders }) { const providers = platformData.vendors.filter((vendor) => vendorIds.has(vendor.id)); return <div className="provider-card-grid"><article className="provider-card internal"><header><span><Wrench /></span><div><strong>Clark&apos;s Internal Maintenance</strong><small>8 technicians · regional coverage</small></div><PlatformBadge tone="good">Internal</PlatformBadge></header><div><p><span>Assigned work</span><strong>{workOrders.filter((item) => item.assignmentType === "internal").length}</strong></p><p><span>Acknowledged on time</span><strong>94%</strong></p><p><span>Repeat visit rate</span><strong>7.2%</strong></p></div><Link href="/providers/internal-maintenance">Open accountability record<ArrowRight /></Link></article>{providers.map((provider) => { const providerWork = workOrders.filter((item) => item.vendorId === provider.id); return <article className="provider-card" key={provider.id}><header><span style={{ background: provider.accent }}><UsersRound /></span><div><strong>{provider.name}</strong><small>{provider.trade}</small></div><PlatformBadge tone="info">Outside</PlatformBadge></header><div><p><span>Store work orders</span><strong>{providerWork.length}</strong></p><p><span>Accepted on time</span><strong>{87 + (provider.id.length % 9)}%</strong></p><p><span>Current open</span><strong>{providerWork.filter(isOpenWorkOrder).length}</strong></p></div><Link href={`/providers/${provider.id}`}>Open accountability record<ArrowRight /></Link></article>; })}</div>; }

function StoreSetup({ store, systems, assets }: { store: StoreRecord; systems: typeof platformData.systems; assets: typeof platformData.assets }) { const steps = [{ label: "Store identity and address", complete: true, detail: `#${store.code} · ${store.address1}` }, { label: "Contacts, hours and access", complete: true, detail: `${store.managerName} · emergency access configured` }, { label: "Service categories and routing", complete: systems.length >= 8, detail: `${systems.length} configured service groups` }, { label: "Equipment register", complete: assets.length >= 3, detail: `${assets.length} known assets · deeper setup remains optional` }, { label: "Provider coverage", complete: true, detail: "Primary and backup rules active" }, { label: "Financial policies", complete: true, detail: "GL, NTE and approval routing active" }, { label: "PM templates", complete: platformData.pmOccurrences.some((item) => item.storeId === store.id), detail: "Applicable templates activated" }]; return <div className="store-setup-layout"><section className="pf-panel"><PlatformSectionHeader title="Store commissioning" description="A resumable workspace—not a one-time form." /><div className="commissioning-list">{steps.map((step, index) => <div key={step.label}><span className={step.complete ? "done" : ""}>{step.complete ? <CheckCircle2 /> : index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><button type="button">Review<ArrowRight /></button></div>)}</div></section><aside className="pf-panel readiness-panel"><PlatformSectionHeader title="Readiness" /><div className="readiness-score"><strong>{Math.round((steps.filter((step) => step.complete).length / steps.length) * 100)}%</strong><span>ready for full operation</span><PlatformProgress value={steps.filter((step) => step.complete).length / steps.length} /></div><p>Request intake remains active even if the equipment register is incomplete. Missing depth is measured as coverage, never invented.</p><Link className="pf-primary-button" href={`/stores/new?edit=${store.id}`}>Continue setup</Link></aside></div>; }

export function CreatedStoreDashboard({ storeId }: { storeId: string }) {
  const [records, setRecords] = useState<Array<Record<string, unknown>> | null>(null);
  useEffect(() => { fetch("/api/registry?entity=stores").then((response) => response.json()).then((raw) => { const result = raw as { records?: Array<Record<string, unknown>> }; setRecords(result.records ?? []); }).catch(() => setRecords([])); }, []);
  const record = records?.find((item) => item.id === storeId);
  if (records === null) return <AppShell><div className="pf-page"><div className="loading-platform">Loading store record…</div></div></AppShell>;
  if (!record) return <AppShell><div className="pf-page"><PlatformPageHeader eyebrow="Store record" title="Store not found" description="The requested store is not available in this organization." /><Link className="pf-secondary-button" href="/stores">Return to stores</Link></div></AppShell>;
  return <AppShell><div className="pf-page"><PlatformBreadcrumbs items={[{ label: "Stores", href: "/stores" }, { label: `Store ${String(record.code)}` }]} /><PlatformPageHeader eyebrow="New store · commissioning" title={`${String(record.code)} · ${String(record.city)}`} description={`${String(record.address1)}, ${String(record.city)}, ${String(record.state)} ${String(record.postalCode)}`}><Link className="pf-primary-button" href={`/work-orders/new?storeId=${storeId}`}><Plus />New work order</Link></PlatformPageHeader><section className="pf-stat-grid store-stat-grid"><PlatformStat label="Posted cost" value="$0" note="No financial history yet" icon={CircleDollarSign} /><PlatformStat label="Open work" value="0" note="Store is ready for intake" icon={ClipboardList} /><PlatformStat label="Equipment" value="0" note="Optional setup can continue" icon={Wrench} /><PlatformStat label="Readiness" value="38%" note="Core store record created" icon={CheckCircle2} tone="info" /></section><div className="store-setup-layout"><section className="pf-panel"><PlatformSectionHeader title="Continue commissioning" description="Complete in order or skip anything that is not known yet." /><div className="commissioning-list"><div><span className="done"><CheckCircle2 /></span><div><strong>Store identity</strong><small>Number and address saved</small></div><button>Review<ArrowRight /></button></div><div><span>2</span><div><strong>Service areas and equipment groups</strong><small>Choose a store blueprint or start blank</small></div><Link href={`/cost-centers/new?storeId=${storeId}`}>Continue<ArrowRight /></Link></div><div><span>3</span><div><strong>Known equipment</strong><small>Add now, import, or identify during future work</small></div><Link href={`/assets/new?storeId=${storeId}`}>Continue<ArrowRight /></Link></div><div><span>4</span><div><strong>Providers, policies and PM</strong><small>Coverage, NTE, approvals and applicable templates</small></div><Link href={`/stores/new?edit=${storeId}`}>Continue<ArrowRight /></Link></div></div></section><aside className="pf-panel readiness-panel"><PlatformSectionHeader title="Progressive setup" /><p>The store can accept requests and work orders immediately. Classification depth improves during diagnosis, service, invoice review, and planned commissioning.</p><Link className="pf-primary-button" href={`/stores/new?edit=${storeId}`}>Open commissioning workspace</Link></aside></div></div></AppShell>;
}
