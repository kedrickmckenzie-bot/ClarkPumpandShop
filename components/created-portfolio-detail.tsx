"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, CircleDollarSign, Cpu, Factory, LoaderCircle, Plus, ShieldCheck, Wrench } from "lucide-react";
import Link from "@/components/site-link";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, MetricCard, PageHeader, PanelTitle, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/domain/analytics";
import { demoData } from "@/lib/demo/data";
import { statusTone, workOrderStatusLabel } from "@/lib/presentation";

type RecordRow = Record<string, string | number | boolean | null | undefined> & { id: string };
type RegistryState = { stores: RecordRow[]; centers: RecordRow[]; assets: RecordRow[]; components: RecordRow[]; workOrders: RecordRow[]; pmPlans: RecordRow[] };

function useRegistry() {
  const [data, setData] = useState<RegistryState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const entities = ["stores", "cost-centers", "assets", "components", "work-orders", "pm-plans"] as const;
    Promise.all(entities.map((entity) => fetch(`/api/registry?entity=${entity}`).then(async (response) => await response.json() as { ok?: boolean; records?: RecordRow[]; error?: string })))
      .then((results) => {
        if (results.some((item) => !item.ok)) throw new Error(results.find((item) => !item.ok)?.error || "Registry unavailable");
        setData({ stores: results[0].records ?? [], centers: results[1].records ?? [], assets: results[2].records ?? [], components: results[3].records ?? [], workOrders: results[4].records ?? [], pmPlans: results[5].records ?? [] });
      }).catch((reason) => setError(reason instanceof Error ? reason.message : "Registry unavailable"));
  }, []);
  return { data, error };
}

function LoadingRecord({ error }: { error: string }) { return <AppShell><div className="page"><div className="record-loading">{error ? <><strong>Unable to load this record</strong><p>{error}</p></> : <><LoaderCircle className="spin" /><strong>Loading maintenance record…</strong></>}</div></div></AppShell>; }

export function CreatedStoreDetail({ storeId }: { storeId: string }) {
  const { data, error } = useRegistry();
  if (!data) return <LoadingRecord error={error} />;
  const store = data.stores.find((item) => item.id === storeId);
  if (!store) return <LoadingRecord error="Store not found in this tenant." />;
  const centers = data.centers.filter((item) => item.storeId === storeId);
  const centerIds = new Set(centers.map((item) => item.id));
  const assets = data.assets.filter((item) => centerIds.has(String(item.storeSystemId)));
  const assetIds = new Set(assets.map((item) => item.id));
  const components = data.components.filter((item) => assetIds.has(String(item.assetId)));
  const work = data.workOrders.filter((item) => item.storeId === storeId);
  return <AppShell><div className="page"><Breadcrumbs items={[{ label: "Stores", href: "/stores" }, { label: `Store ${store.code}` }]} /><PageHeader eyebrow={`${store.district || "Independent"} · ${demoData.regions.find((item) => item.id === store.regionId)?.name ?? "No region"}`} title={String(store.name)} description={`${store.address1}, ${store.city}, ${store.state} ${store.postalCode} · ${store.managerName || "Manager unassigned"}`}><Link className="button primary" href={`/work-orders/new?storeId=${storeId}`}><Plus />Create work order</Link></PageHeader>
    <div className="metric-grid"><MetricCard label="Cost centers" value={String(centers.length)} note="Maintainable operating systems" icon={Building2} tone={centers.length ? "good" : "warning"} /><MetricCard label="Registered assets" value={String(assets.length)} note={`${components.length} serviceable components`} icon={Factory} tone={assets.length ? "good" : "warning"} /><MetricCard label="Open work" value={String(work.filter((item) => !["closed", "cancelled"].includes(String(item.status))).length)} note={`${work.length} total created work orders`} icon={Wrench} /><MetricCard label="Setup readiness" value={centers.length && assets.length ? "Ready" : "Incomplete"} note="Requests and work can start at store + category" icon={CheckCircle2} tone={centers.length ? "good" : "warning"} /></div>
    <div className="split-grid"><section className="panel panel-pad"><PanelTitle title="Equipment hierarchy" description="Store → cost center → asset → serviceable component" />{centers.map((center) => { const centerAssets = assets.filter((item) => item.storeSystemId === center.id); const category = demoData.categories.find((item) => item.id === center.categoryId); return <div className="created-tree-center" key={center.id}><header><Building2 /><div><strong>{center.name}</strong><span>{category?.name} · {center.code} · {center.location}</span></div><StatusBadge tone="good">{centerAssets.length} assets</StatusBadge></header>{centerAssets.map((asset) => <Link href={`/assets/${asset.id}`} className="created-tree-asset" key={asset.id}><Factory /><span><strong>{asset.assetTag} · {asset.name}</strong><small>{asset.manufacturer} {asset.model} · {asset.location}</small></span><b>{components.filter((item) => item.assetId === asset.id).length} parts</b></Link>)}</div>;})}{!centers.length && <div className="empty-state">No cost centers yet. The store can still accept Store + Category work orders.</div>}</section><aside className="stack"><section className="panel panel-pad"><PanelTitle title="Commissioning checklist" description="A reusable activation standard for every new location." /><div className="commission-check"><p className="done"><CheckCircle2 />Store identity and address</p><p className={centers.length ? "done" : ""}><CheckCircle2 />Maintainable cost centers</p><p className={assets.length ? "done" : ""}><CheckCircle2 />Starter asset register</p><p className={components.length ? "done" : ""}><CheckCircle2 />Components and critical spares</p><p className="done"><CheckCircle2 />Request and work-order routing</p></div></section><div className="callout"><strong><ShieldCheck /> Progressive data rule</strong><p>Incomplete equipment records never block a request or work order. Classification depth improves during diagnosis, repair and invoice review.</p></div></aside></div>
    <section className="panel table-wrap"><div className="panel-pad" style={{ paddingBottom: 8 }}><PanelTitle title="Store work orders" description="All created maintenance activity stays attached to this location." /></div><table className="data-table"><thead><tr><th>Work order</th><th>Problem</th><th>Status</th><th>Assignment</th><th>Due</th></tr></thead><tbody>{work.map((item) => <tr key={item.id}><td><Link className="row-link mono" href={`/work-orders/${item.id}`}>{item.number}</Link></td><td><strong>{item.title}</strong><span className="subtext">{item.location}</span></td><td><StatusBadge tone={statusTone(String(item.status) as never)}>{workOrderStatusLabel[String(item.status) as keyof typeof workOrderStatusLabel] ?? String(item.status)}</StatusBadge></td><td>{item.assignedToName || item.accountableParty}</td><td>{item.dueAt ? formatDate(String(item.dueAt), true) : "Not set"}</td></tr>)}</tbody></table>{!work.length && <div className="empty-state">No work orders yet. Create the first one from this store workspace.</div>}</section>
  </div></AppShell>;
}

export function CreatedAssetDetail({ assetId }: { assetId: string }) {
  const { data, error } = useRegistry();
  if (!data) return <LoadingRecord error={error} />;
  const asset = data.assets.find((item) => item.id === assetId);
  if (!asset) return <LoadingRecord error="Asset not found in this tenant." />;
  const center = data.centers.find((item) => item.id === asset.storeSystemId);
  const store = data.stores.find((item) => item.id === center?.storeId);
  const components = data.components.filter((item) => item.assetId === assetId);
  const work = data.workOrders.filter((item) => item.assetId === assetId);
  return <AppShell><div className="page"><Breadcrumbs items={[{ label: "Stores", href: "/stores" }, { label: `Store ${store?.code}`, href: `/stores/${store?.id}` }, { label: String(asset.name) }]} /><div className="detail-hero"><section className="record-card"><div className="record-line"><span className="mono">{asset.assetTag} · {asset.serial}</span><StatusBadge tone="good">{asset.state || "operational"}</StatusBadge><Link className="button primary small" href={`/work-orders/new?storeId=${store?.id}&systemId=${center?.id}&assetId=${asset.id}`}><Plus />Create work order</Link></div><h1>{asset.name}</h1><p className="description">{asset.manufacturer} {asset.model} · {asset.assetClass} · {asset.location}</p><div className="record-meta"><div className="meta-item"><span>Store</span><strong>Store {store?.code} · {store?.city}</strong></div><div className="meta-item"><span>Cost center</span><strong>{center?.name}</strong></div><div className="meta-item"><span>Criticality</span><strong>{asset.criticality}</strong></div><div className="meta-item"><span>Replacement value</span><strong>{formatCurrency(Number(asset.replacementCostCents) || 0)}</strong></div></div></section><aside className="control-card"><span className="label">Maintenance record</span><h3>{work.length} linked work orders</h3><p>This asset’s work, PM, components, documents, downtime and cost history accumulate here.</p></aside></div><div className="split-grid"><section className="panel panel-pad"><PanelTitle title="Serviceable components" description="Parts and subassemblies beneath this equipment." />{components.map((item) => <Link className="exception-row" href={`/components/${item.id}`} key={item.id}><span className="exception-bar" /><span className="exception-copy"><strong>{item.name}</strong><span>{item.type} · part {item.partNumber}</span></span><StatusBadge tone={item.criticalSpare ? "warning" : "neutral"}>{item.criticalSpare ? "critical spare" : "tracked"}</StatusBadge></Link>)}</section><section className="panel panel-pad"><PanelTitle title="Linked work" description="Open and historical maintenance on this asset." />{work.map((item) => <Link className="exception-row" href={`/work-orders/${item.id}`} key={item.id}><span className="exception-bar" /><span className="exception-copy"><strong>{item.number} · {item.title}</strong><span>{item.status} · {item.nextAction}</span></span></Link>)}{!work.length && <div className="empty-state">No asset-specific work yet.</div>}</section></div></div></AppShell>;
}

export function CreatedComponentDetail({ componentId }: { componentId: string }) {
  const { data, error } = useRegistry();
  if (!data) return <LoadingRecord error={error} />;
  const component = data.components.find((item) => item.id === componentId);
  if (!component) return <LoadingRecord error="Component not found in this tenant." />;
  const asset = data.assets.find((item) => item.id === component.assetId);
  const center = data.centers.find((item) => item.id === asset?.storeSystemId);
  const store = data.stores.find((item) => item.id === center?.storeId);
  return <AppShell><div className="page"><Breadcrumbs items={[{ label: `Store ${store?.code}`, href: `/stores/${store?.id}` }, { label: String(asset?.name), href: `/assets/${asset?.id}` }, { label: String(component.name) }]} /><PageHeader eyebrow="Serviceable component" title={String(component.name)} description={`${component.type} · part ${component.partNumber} · ${asset?.assetTag} ${asset?.name}`}><Link className="button primary" href={`/work-orders/new?storeId=${store?.id}&systemId=${center?.id}&assetId=${asset?.id}&componentId=${component.id}`}><Plus />Create work order</Link></PageHeader><div className="metric-grid"><MetricCard label="Parent asset" value={String(asset?.assetTag)} note={String(asset?.name)} icon={Factory} /><MetricCard label="Quantity" value={String(component.quantity)} note="Registered on equipment" icon={Cpu} /><MetricCard label="Reference cost" value={formatCurrency(Number(component.unitCostCents) || 0)} note="Expected unit material cost" icon={CircleDollarSign} /><MetricCard label="Stock posture" value={component.criticalSpare ? "Critical" : "Standard"} note="Inventory protection rule" icon={ShieldCheck} tone={component.criticalSpare ? "warning" : "good"} /></div></div></AppShell>;
}
