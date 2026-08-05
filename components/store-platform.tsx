"use client";

import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileStack,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CreatedStoreDetail } from "@/components/created-portfolio-detail";
import { PreventiveLifecycleDashboard } from "@/components/preventive-lifecycle-dashboard";
import { PlatformBadge, PlatformBreadcrumbs, PlatformPageHeader, PlatformProgress, PlatformSectionHeader, PlatformStat } from "@/components/platform-ui";
import { SpendingIntelligenceDashboard } from "@/components/spending-intelligence-dashboard";
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
  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <AppShell><div className="pf-page store-directory-page">
      <PlatformPageHeader eyebrow={`${allComparison.length} stores in this demo`} title="Find a store" description="Search by store number, address, city, or ZIP code. Open a store to see its work, costs, equipment, and next actions.">
        <Link className="pf-secondary-button" href="/setup?section=imports"><FileStack />Import a list</Link>
        <Link className="pf-primary-button" href="/stores/new"><Plus />Add a store</Link>
      </PlatformPageHeader>

      <section className="pf-panel store-directory-panel">
        <div className="directory-toolbar">
          <label className="directory-search"><Search /><input value={query} onChange={(event) => updateFilter(setQuery, event.target.value)} placeholder="Search store number or address…" /></label>
          <label><span>Region</span><select value={region} onChange={(event) => updateFilter(setRegion, event.target.value)}><option value="all">All regions</option>{platformData.regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span>Show me</span><select value={risk} onChange={(event) => updateFilter(setRisk, event.target.value)}><option value="all">All stores</option><option value="outlier">Higher-cost stores</option><option value="critical">Urgent open work</option><option value="replacement">Equipment to review</option></select></label>
          <span className="directory-result-count">{rows.length} matching stores</span>
        </div>
        <div className="pf-table-scroll"><table className="pf-table store-directory-table"><thead><tr><th>Store</th><th>Work needing attention</th><th>Cost · last 12 months</th><th>What to know</th></tr></thead><tbody>
          {paged.map((row) => <tr key={row.store.id}>
            <td><Link href={`/stores/${row.store.id}`} className="store-identity"><span>#{row.store.code}</span><div><strong>{row.store.city}</strong><small>{row.store.address1}, {row.store.state} {row.store.postalCode}</small><small>{platformData.regions.find((item) => item.id === row.store.regionId)?.name ?? "No region"} · {row.store.managerName}</small></div></Link></td>
            <td><strong>{row.openCount}</strong><small>{row.criticalCount ? `${row.criticalCount} urgent` : "Nothing urgent"}</small></td>
            <td><strong>{formatCurrency(row.spend)}</strong><small>{row.change >= 0 ? "+" : ""}{formatPercent(row.change, 0)} from the prior 12 months</small></td>
            <td>{row.store.status === "opening" ? <PlatformBadge tone="info">Still being set up</PlatformBadge> : row.isOutlier ? <PlatformBadge tone="critical">Costs are unusually high</PlatformBadge> : row.replacementCandidates ? <PlatformBadge tone="warning">Equipment needs review</PlatformBadge> : row.criticalCount ? <PlatformBadge tone="info">Urgent work is open</PlatformBadge> : <PlatformBadge tone="good">No major concerns</PlatformBadge>}</td>
          </tr>)}
        </tbody></table></div>
        <footer className="directory-pagination"><span>Showing {rows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, rows.length)} of {rows.length}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><em>Page {page} of {totalPages}</em><button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></footer>
      </section>
    </div></AppShell>
  );
}

type StoreTab = "Overview" | "Costs & bills" | "Equipment" | "Work orders" | "Planned work" | "Teams & vendors" | "Store setup";
const primaryStoreTabs: StoreTab[] = ["Overview", "Work orders", "Equipment", "Costs & bills"];
const moreStoreTabs: StoreTab[] = ["Planned work", "Teams & vendors", "Store setup"];

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

      <section className="store-summary-strip store-summary-strip-simple">
        <div><small>Store manager</small><strong>{store.managerName}</strong><span>{store.phone}</span></div><div><small>Store profile</small><strong>{store.squareFeet.toLocaleString()} sq ft</strong><span>{assets.length} known pieces of equipment</span></div><div><small>Next action</small><strong>{openWork[0]?.nextAction ?? "Nothing urgent"}</strong><span>{openWork[0]?.accountableParty ?? "All work is current"}</span></div>
      </section>

      <nav className="store-tabs" aria-label="Store record sections">
        {primaryStoreTabs.map((item) => <button type="button" className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}{item === "Work orders" && <em>{openWork.length}</em>}{item === "Costs & bills" && pendingFinancial.length > 0 && <em>{pendingFinancial.length}</em>}</button>)}
        <details className="store-more-tabs" open={moreStoreTabs.includes(tab) || undefined}>
          <summary>{moreStoreTabs.includes(tab) ? tab : "More"}</summary>
          <div>{moreStoreTabs.map((item) => <button type="button" className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
        </details>
      </nav>

      {tab === "Overview" && <>
        <section className="pf-stat-grid store-stat-grid">
          <PlatformStat label="Cost · last 12 months" value={formatCurrency(ttmSpend, true)} note={`${change >= 0 ? "+" : ""}${formatPercent(change, 0)} from the prior 12 months`} icon={CircleDollarSign} tone={change > .1 ? "warning" : "default"} />
          <PlatformStat label="Work still open" value={String(openWork.length)} note={`${openWork.filter((item) => item.priority === "critical").length} urgent · ${openWork.filter((item) => item.dueAt && new Date(item.dueAt) < now).length} past due`} icon={ClipboardList} tone={openWork.some((item) => item.priority === "critical") ? "critical" : "default"} />
          <PlatformStat label="Planned work on time" value={formatPercent(pm.value)} note={`${pm.numerator} of ${pm.denominator} completed and checked on time`} icon={ShieldCheck} tone={pm.value >= .9 ? "positive" : "warning"} />
          <PlatformStat label="Cost decisions waiting" value={String(pendingFinancial.length)} note="Quotes, approvals, or bills need review" icon={CircleDollarSign} tone={pendingFinancial.length ? "info" : "positive"} />
        </section>
        <div className="pf-dashboard-grid store-overview-grid">
          <section className="pf-panel store-cost-tree"><PlatformSectionHeader title="Where this store is spending money" description="Choose a type of work to see its equipment, work orders, and individual costs." /><div className="pf-table-scroll"><table className="pf-table"><thead><tr><th>Type of work</th><th>Cost · last 12 months</th><th>Change</th><th>Open work</th><th>Known equipment</th></tr></thead><tbody>{categoryRows.map((row) => {
            const system = row.systems[0];
            const href = system ? `/stores/${store.id}/systems/${system.id}` : `/work-orders?store=${store.id}&category=${row.category.id}&status=all`;
            const delta = row.prior ? (row.current - row.prior) / row.prior : 0;
            return <tr key={row.category.id}><td><Link href={href} className="category-tree-link"><i style={{ background: row.category.color }} /><span><strong>{row.category.name}</strong><small>{system?.name ?? "No deeper setup required"}</small></span><ArrowRight /></Link></td><td><strong>{formatCurrency(row.current)}</strong><small>Paid less credits</small></td><td><strong className={delta > .1 ? "text-negative" : delta < 0 ? "text-positive" : ""}>{delta >= 0 ? "+" : ""}{formatPercent(delta, 0)}</strong></td><td><strong>{row.open}</strong></td><td><strong>{row.assets}</strong><small>pieces tracked</small></td></tr>;
          })}</tbody></table></div></section>
          <aside className="store-overview-side">
            <section className="pf-panel"><PlatformSectionHeader title="Who owes the next action?" description="Open an item to see exactly what is waiting and who owns it." href={`/accountability?store=${store.id}`} linkLabel="See every owner" /><div className="store-action-list">{openWork.slice(0, 6).map((item) => <Link key={item.id} href={`/work-orders/${item.id}`}><span className={item.dueAt && new Date(item.dueAt) < now ? "late" : ""}><ClipboardList /></span><div><strong>{item.number} · {item.title}</strong><small>{item.accountableParty} · {item.nextAction}</small><em>{item.dueAt ? `Due ${formatDate(item.dueAt, true)}` : "No deadline"}</em></div><PlatformBadge tone={item.priority === "critical" ? "critical" : item.priority === "high" ? "warning" : "neutral"}>{item.priority}</PlatformBadge></Link>)}</div></section>
          </aside>
        </div>
      </>}

      {tab === "Costs & bills" && <SpendingIntelligenceDashboard initialScopeLevel="store" initialScopeId={store.id} compactHeader />}
      {tab === "Equipment" && <StoreEquipment store={store} systems={systems} assets={assets} components={components} />}
      {tab === "Work orders" && <StoreMaintenance storeId={store.id} workOrders={workOrders} />}
      {tab === "Planned work" && <PreventiveLifecycleDashboard initialStoreId={store.id} />}
      {tab === "Teams & vendors" && <StoreProviders vendorIds={storeVendorIds} workOrders={workOrders} />}
      {tab === "Store setup" && <StoreSetup store={store} systems={systems} assets={assets} />}
    </div></AppShell>
  );
}

function StoreEquipment({ store, systems, assets, components }: { store: StoreRecord; systems: typeof platformData.systems; assets: typeof platformData.assets; components: typeof platformData.components }) {
  return <section className="pf-panel store-equipment-panel"><PlatformSectionHeader title="Equipment hierarchy" description="Configure only the depth that creates operational or financial value."><Link className="pf-secondary-button" href={`/assets/new?storeId=${store.id}`}><Plus />Add equipment</Link></PlatformSectionHeader><div className="equipment-tree">{systems.map((system) => { const systemAssets = assets.filter((asset) => asset.storeSystemId === system.id); return <article key={system.id}><header><span style={{ background: platformData.categories.find((item) => item.id === system.categoryId)?.color }}><Wrench /></span><div><Link href={`/stores/${store.id}/systems/${system.id}`}><strong>{system.name}</strong></Link><small>{system.code} · {system.type} · GL {system.glCode}</small></div><PlatformBadge tone={system.state === "exception" ? "critical" : system.state === "watch" ? "warning" : "good"}>{system.state}</PlatformBadge></header><div className="equipment-tree-assets">{systemAssets.length ? systemAssets.map((asset) => <Link href={`/assets/${asset.id}`} key={asset.id}><span><Boxes /></span><div><strong>{asset.assetTag} · {asset.name}</strong><small>{asset.assetClass} · {asset.manufacturer} {asset.model} · {components.filter((component) => component.assetId === asset.id).length} components</small></div><PlatformBadge tone={asset.state === "operational" ? "good" : asset.state === "watch" || asset.state === "service_due" ? "warning" : "critical"}>{asset.state.replaceAll("_", " ")}</PlatformBadge><ArrowRight /></Link>) : <div className="equipment-tree-empty">No individual equipment required. Work and cost can remain at this level.<Link href={`/assets/new?storeId=${store.id}&systemId=${system.id}`}>Add equipment</Link></div>}</div></article>; })}</div></section>;
}

function StoreMaintenance({ storeId, workOrders }: { storeId: string; workOrders: typeof platformData.workOrders }) {
  return <section className="pf-panel"><PlatformSectionHeader title="Store maintenance history" description="Internal and outside-vendor work together in one history." href={`/work-orders?store=${storeId}&status=all`}><Link className="pf-primary-button" href={`/work-orders/new?storeId=${storeId}`}><Plus />New work order</Link></PlatformSectionHeader><div className="pf-table-scroll"><table className="pf-table"><thead><tr><th>Work order</th><th>Type / equipment</th><th>Team or vendor</th><th>Who acts next</th><th>Due</th><th>Status</th></tr></thead><tbody>{workOrders.map((item) => <tr key={item.id}><td><Link href={`/work-orders/${item.id}`}><strong>{item.number}</strong><small>{item.title}</small></Link></td><td><strong>{platformData.categories.find((category) => category.id === item.categoryId)?.name}</strong><small>{platformData.assets.find((asset) => asset.id === item.assetId)?.name ?? (item.assetId ? "Equipment record" : "Equipment not identified")}</small></td><td><strong>{item.assignedToName ?? platformData.vendors.find((vendor) => vendor.id === item.vendorId)?.shortName ?? "Unassigned"}</strong><small>{item.assignmentType ?? (item.vendorId ? "Outside vendor" : "Internal")}</small></td><td><strong>{item.accountableParty}</strong><small>{item.nextAction}</small></td><td><strong>{item.dueAt ? formatDate(item.dueAt, true) : "—"}</strong></td><td><PlatformBadge tone={item.status === "closed" ? "good" : item.priority === "critical" ? "critical" : "warning"}>{item.status.replaceAll("_", " ")}</PlatformBadge></td></tr>)}</tbody></table></div></section>;
}

function StoreProviders({ vendorIds, workOrders }: { vendorIds: Set<string | undefined>; workOrders: typeof platformData.workOrders }) { const providers = platformData.vendors.filter((vendor) => vendorIds.has(vendor.id)); return <div className="provider-card-grid"><article className="provider-card internal"><header><span><Wrench /></span><div><strong>Clark&apos;s Internal Maintenance</strong><small>8 technicians · regional coverage</small></div><PlatformBadge tone="good">Internal</PlatformBadge></header><div><p><span>Assigned work</span><strong>{workOrders.filter((item) => item.assignmentType === "internal").length}</strong></p><p><span>Responded on time</span><strong>94%</strong></p><p><span>Repeat visit rate</span><strong>7.2%</strong></p></div><Link href="/providers/internal-maintenance">Open team details<ArrowRight /></Link></article>{providers.map((provider) => { const providerWork = workOrders.filter((item) => item.vendorId === provider.id); return <article className="provider-card" key={provider.id}><header><span style={{ background: provider.accent }}><UsersRound /></span><div><strong>{provider.name}</strong><small>{provider.trade}</small></div><PlatformBadge tone="info">Outside vendor</PlatformBadge></header><div><p><span>Store work orders</span><strong>{providerWork.length}</strong></p><p><span>Accepted on time</span><strong>{87 + (provider.id.length % 9)}%</strong></p><p><span>Open now</span><strong>{providerWork.filter(isOpenWorkOrder).length}</strong></p></div><Link href={`/providers/${provider.id}`}>Open vendor details<ArrowRight /></Link></article>; })}</div>; }

function StoreSetup({ store, systems, assets }: { store: StoreRecord; systems: typeof platformData.systems; assets: typeof platformData.assets }) { const steps = [{ label: "Store number and address", complete: true, detail: `#${store.code} · ${store.address1}` }, { label: "Contacts, hours and access", complete: true, detail: `${store.managerName} · emergency access configured` }, { label: "Types of work and who handles them", complete: systems.length >= 8, detail: `${systems.length} equipment groups set up` }, { label: "Known equipment", complete: assets.length >= 3, detail: `${assets.length} equipment records · adding more is optional` }, { label: "Team and vendor coverage", complete: true, detail: "Primary and backup coverage set" }, { label: "Spending and approval rules", complete: true, detail: "Spending limits and approvals set" }, { label: "Planned maintenance", complete: platformData.pmOccurrences.some((item) => item.storeId === store.id), detail: "Applicable plans turned on" }]; return <div className="store-setup-layout"><section className="pf-panel"><PlatformSectionHeader title="Store setup" description="Finish what you know now and return to the rest later." /><div className="commissioning-list">{steps.map((step, index) => <div key={step.label}><span className={step.complete ? "done" : ""}>{step.complete ? <CheckCircle2 /> : index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><button type="button">Review<ArrowRight /></button></div>)}</div></section><aside className="pf-panel readiness-panel"><PlatformSectionHeader title="Setup progress" /><div className="readiness-score"><strong>{Math.round((steps.filter((step) => step.complete).length / steps.length) * 100)}%</strong><span>ready for full operation</span><PlatformProgress value={steps.filter((step) => step.complete).length / steps.length} /></div><p>This store can accept problems and work orders even when some equipment details are still unknown.</p><Link className="pf-primary-button" href={`/stores/new?edit=${store.id}`}>Continue setup</Link></aside></div>; }

export function CreatedStoreDashboard({ storeId }: { storeId: string }) {
  const [records, setRecords] = useState<Array<Record<string, unknown>> | null>(null);
  useEffect(() => { fetch("/api/registry?entity=stores").then((response) => response.json()).then((raw) => { const result = raw as { records?: Array<Record<string, unknown>> }; setRecords(result.records ?? []); }).catch(() => setRecords([])); }, []);
  const record = records?.find((item) => item.id === storeId);
  if (records === null) return <AppShell><div className="pf-page"><div className="loading-platform">Loading store record…</div></div></AppShell>;
  if (!record) return <AppShell><div className="pf-page"><PlatformPageHeader eyebrow="Store record" title="Store not found" description="The requested store is not available in this organization." /><Link className="pf-secondary-button" href="/stores">Return to stores</Link></div></AppShell>;
  return <AppShell><div className="pf-page"><PlatformBreadcrumbs items={[{ label: "Stores", href: "/stores" }, { label: `Store ${String(record.code)}` }]} /><PlatformPageHeader eyebrow="New store" title={`${String(record.code)} · ${String(record.city)}`} description={`${String(record.address1)}, ${String(record.city)}, ${String(record.state)} ${String(record.postalCode)}`}><Link className="pf-primary-button" href={`/work-orders/new?storeId=${storeId}`}><Plus />New work order</Link></PlatformPageHeader><section className="pf-stat-grid store-stat-grid"><PlatformStat label="Recorded cost" value="$0" note="No bills yet" icon={CircleDollarSign} /><PlatformStat label="Open work" value="0" note="Store is ready for problems and work orders" icon={ClipboardList} /><PlatformStat label="Equipment" value="0" note="Add equipment when you know it" icon={Wrench} /><PlatformStat label="Setup progress" value="38%" note="Store number and address are saved" icon={CheckCircle2} tone="info" /></section><div className="store-setup-layout"><section className="pf-panel"><PlatformSectionHeader title="Continue store setup" description="Complete these in order or skip anything you do not know yet." /><div className="commissioning-list"><div><span className="done"><CheckCircle2 /></span><div><strong>Store basics</strong><small>Number and address saved</small></div><button>Review<ArrowRight /></button></div><div><span>2</span><div><strong>Types of work and equipment groups</strong><small>Use a store template or start blank</small></div><Link href={`/cost-centers/new?storeId=${storeId}`}>Continue<ArrowRight /></Link></div><div><span>3</span><div><strong>Known equipment</strong><small>Add now, import, or identify during future work</small></div><Link href={`/assets/new?storeId=${storeId}`}>Continue<ArrowRight /></Link></div><div><span>4</span><div><strong>Teams, vendors, spending, and planned work</strong><small>Set coverage, spending limits, approvals, and maintenance plans</small></div><Link href={`/stores/new?edit=${storeId}`}>Continue<ArrowRight /></Link></div></div></section><aside className="pf-panel readiness-panel"><PlatformSectionHeader title="Finish details when ready" /><p>The store can accept problems and work orders immediately. Add equipment details later during setup, diagnosis, service, or bill review.</p><Link className="pf-primary-button" href={`/stores/new?edit=${storeId}`}>Open store setup</Link></aside></div></div></AppShell>;
}
