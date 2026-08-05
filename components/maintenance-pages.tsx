"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  Inbox,
  MapPin,
  PackageCheck,
  PackageSearch,
  Search,
  ShieldAlert,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "@/components/site-link";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, MetricCard, PageHeader, PanelTitle, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate, isOpenWorkOrder } from "@/lib/domain/analytics";
import { demoData } from "@/lib/demo/data";
import { priorityLabel, statusTone, workOrderStatusLabel } from "@/lib/presentation";

export function RequestsPage() {
  const requests = demoData.workOrders.filter((item) => item.origin === "employee_report" || item.origin === "manager").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 18);
  const newRequests = requests.filter((item) => isOpenWorkOrder(item) && !item.assetId);
  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Maintenance", href: "/" }, { label: "Service Requests" }]} />
    <PageHeader eyebrow="Store-to-maintenance intake" title="Service requests" description="One front door for store issues. Maintenance can accept, clarify, reject, combine or convert a request without forcing the requester to know an asset.">
      <Link className="button primary" href="/reports/new"><ClipboardPlus />New store request</Link>
    </PageHeader>
    <section className="metric-grid"><MetricCard label="Needs triage" value={String(newRequests.length)} note="Store and trade known; equipment deferred" icon={Inbox} tone="warning" /><MetricCard label="Critical requests" value={String(requests.filter((item) => item.priority === "critical").length)} note="Immediate safety or operating impact" icon={ShieldAlert} tone="critical" /><MetricCard label="Converted to work" value={String(requests.length - newRequests.length)} note="Controlled work order has been issued" icon={CheckCircle2} tone="good" /><MetricCard label="Median review" value="14 min" note="Submission to facilities decision" icon={Clock3} /></section>
    <div className="request-layout"><section className="panel request-inbox"><div className="panel-pad" style={{ paddingBottom: 8 }}><PanelTitle title="Request inbox" description="The original request stays immutable; triage decisions and later classification are appended." /></div><div className="request-list">{requests.map((item) => { const store = demoData.stores.find((candidate) => candidate.id === item.storeId); const category = demoData.categories.find((candidate) => candidate.id === item.categoryId); const needsTriage = isOpenWorkOrder(item) && !item.assetId; return <Link href={`/work-orders/${item.id}`} className="request-row" key={item.id}><span className={`request-priority ${item.priority}`} /><div><div className="record-line"><span className="mono">REQ-{item.number.replace("CWO-", "")}</span><StatusBadge tone={needsTriage ? "warning" : "good"}>{needsTriage ? "triage" : "work issued"}</StatusBadge></div><h3>{item.title}</h3><p>{item.description}</p><footer><span><MapPin />Store {store?.code} · {store?.city}</span><span><Wrench />{category?.name}</span><span><UserRound />{item.requestedBy}</span><span><Clock3 />{formatDate(item.createdAt, true)}</span></footer></div><ArrowRight /></Link>;})}</div></section>
      <aside className="stack"><section className="panel panel-pad"><PanelTitle title="Triage standard" description="A request becomes executable work in one review." /><ol className="triage-steps"><li><span>1</span><div><strong>Confirm impact and safety</strong><p>Urgency, downtime, food or life-safety exposure.</p></div></li><li><span>2</span><div><strong>Choose responsible trade</strong><p>Store + category is the minimum classification.</p></div></li><li><span>3</span><div><strong>Assign and commit</strong><p>Internal, vendor, blended or dispatch queue with target.</p></div></li><li><span>4</span><div><strong>Preserve the source</strong><p>Diagnosis can add equipment without rewriting the request.</p></div></li></ol></section><div className="callout warning"><strong><AlertTriangle /> Requester experience</strong><p>Store users report the symptom and location. They are never blocked by equipment data, GL codes, vendors, budgets or maintenance terminology.</p></div></aside>
    </div>
  </div></AppShell>;
}

export function SchedulePage() {
  const [technician, setTechnician] = useState("");
  const scheduled = demoData.workOrders.filter((item) => item.scheduledStartAt && isOpenWorkOrder(item)).filter((item) => !technician || item.assignedToId === technician).sort((a, b) => itemTime(a) - itemTime(b));
  const days = ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08"];
  const unassigned = demoData.workOrders.filter((item) => isOpenWorkOrder(item) && (item.assignmentType === "unassigned" || item.status === "approved")).slice(0, 8);
  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Maintenance", href: "/" }, { label: "Schedule & Dispatch" }]} />
    <PageHeader eyebrow="Labor and route planning" title="Schedule & dispatch" description="Balance technician capacity, trade fit, store travel, priority and target dates. Drag-and-drop is represented here as an executable weekly dispatch board.">
      <Link className="button primary" href="/work-orders/new"><ClipboardPlus />Add work</Link>
    </PageHeader>
    <div className="filter-bar"><label className="filter-field"><span>Technician</span><select value={technician} onChange={(event) => setTechnician(event.target.value)}><option value="">All internal technicians</option>{demoData.technicians.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.trades.join(" / ")}</option>)}</select></label><span className="filter-summary">Week of Aug 3 · {scheduled.length} planned assignments · {scheduled.reduce((sum, item) => sum + (item.estimatedHours ?? 0), 0).toFixed(1)} labor hours</span></div>
    <div className="schedule-layout"><section className="weekly-board panel">{days.map((day) => { const items = scheduled.filter((item) => item.scheduledStartAt?.startsWith(day)); return <div className="schedule-day" key={day}><header><span>{new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong><b>{items.reduce((sum, item) => sum + (item.estimatedHours ?? 0), 0)}h</b></header><div>{items.map((item) => { const store = demoData.stores.find((candidate) => candidate.id === item.storeId); return <Link className="calendar-job" href={`/work-orders/${item.id}`} key={item.id}><time>{new Date(item.scheduledStartAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</time><StatusBadge tone={item.priority === "high" ? "warning" : "neutral"}>{priorityLabel[item.priority]}</StatusBadge><h3>{item.title}</h3><p>Store {store?.code} · {store?.city}</p><footer><UserRound />{item.assignedToName}<span>{item.estimatedHours}h</span></footer></Link>;})}{!items.length && <div className="calendar-empty">Open capacity</div>}</div></div>;})}</section>
      <aside className="panel dispatch-rail"><div className="panel-pad"><PanelTitle title="Unscheduled queue" description="Assign a qualified owner and planned start." /></div>{unassigned.map((item) => { const store = demoData.stores.find((candidate) => candidate.id === item.storeId); return <Link className="unscheduled-job" href={`/work-orders/${item.id}`} key={item.id}><div><span className="mono">{item.number}</span><StatusBadge tone={statusTone(item.status)}>{workOrderStatusLabel[item.status]}</StatusBadge></div><strong>{item.title}</strong><small>Store {store?.code} · {item.location} · due {item.dueAt ? formatDate(item.dueAt) : "not set"}</small></Link>;})}</aside>
    </div>
  </div></AppShell>;
}

function itemTime(item: (typeof demoData.workOrders)[number]) { return new Date(item.scheduledStartAt ?? item.dueAt ?? item.createdAt).getTime(); }

export function PartsPage() {
  const [query, setQuery] = useState("");
  const inventory = useMemo(() => demoData.components.map((component, index) => {
    const asset = demoData.assets.find((item) => item.id === component.assetId)!;
    const system = demoData.systems.find((item) => item.id === asset.storeSystemId)!;
    const store = demoData.stores.find((item) => item.id === system.storeId)!;
    const onHand = component.criticalSpare ? index % 3 : 2 + (index % 9);
    const min = component.criticalSpare ? 2 : 1;
    return { component, asset, system, store, onHand, min, status: onHand === 0 ? "out" : onHand <= min ? "low" : "ok" };
  }).filter((row) => `${row.component.partNumber} ${row.component.name} ${row.asset.name} ${row.store.code} ${row.store.city}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(a.status === "ok") - Number(b.status === "ok") || Number(b.component.criticalSpare) - Number(a.component.criticalSpare)), [query]);
  const waiting = demoData.workOrders.filter((item) => item.status === "waiting_on_parts");
  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Equipment & Parts", href: "/" }, { label: "Parts & Inventory" }]} />
    <PageHeader eyebrow="Maintenance material control" title="Parts & inventory" description="Stock by store or storeroom, critical spares, asset associations, consumption and work-order demand stay connected.">
      <button className="button primary"><PackageCheck />Receive stock</button><button className="button"><Truck />Create purchase order</button>
    </PageHeader>
    <section className="metric-grid"><MetricCard label="Tracked part records" value={String(demoData.components.length)} note="Components and stocked service parts" icon={PackageSearch} /><MetricCard label="Below minimum" value={String(inventory.filter((item) => item.status !== "ok").length)} note="Replenishment action required" icon={AlertTriangle} tone="critical" /><MetricCard label="Critical spares" value={String(inventory.filter((item) => item.component.criticalSpare).length)} note="Protected high-criticality equipment" icon={ShieldAlert} tone="warning" /><MetricCard label="Work waiting parts" value={String(waiting.length)} note="Demand linked to open work orders" icon={Clock3} tone="warning" /></section>
    {waiting.length > 0 && <section className="parts-demand-strip"><strong><Clock3 /> Work blocked by material</strong>{waiting.map((item) => { const store = demoData.stores.find((candidate) => candidate.id === item.storeId); return <Link href={`/work-orders/${item.id}`} key={item.id}><span className="mono">{item.number}</span>{item.title}<small>Store {store?.code}</small><ArrowRight /></Link>;})}</section>}
    <div className="filter-bar"><label className="filter-field directory-search"><span>Search inventory</span><div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "#71807d" }} /><input style={{ paddingLeft: 31 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Part number, description, asset or store" /></div></label><span className="filter-summary">{inventory.length} part-location records</span></div>
    <section className="panel table-wrap"><table className="data-table parts-table"><thead><tr><th>Part</th><th>Asset association</th><th>Stock location</th><th className="numeric">On hand</th><th className="numeric">Minimum</th><th className="numeric">Unit cost</th><th>Status</th></tr></thead><tbody>{inventory.slice(0, 40).map(({ component, asset, system, store, onHand, min, status }) => <tr key={component.id}><td><Link className="row-link mono" href={`/components/${component.id}`}>{component.partNumber}</Link><span className="subtext">{component.name} · {component.type}</span></td><td><Link className="row-link" href={`/assets/${asset.id}`}>{asset.assetTag} · {asset.name}</Link><span className="subtext">{system.name}</span></td><td>Store {store.code} maintenance stock<span className="subtext">{store.city}, {store.state}</span></td><td className="numeric"><strong>{onHand}</strong></td><td className="numeric">{min}</td><td className="numeric">{formatCurrency(component.unitCostCents)}</td><td><StatusBadge tone={status === "out" ? "critical" : status === "low" ? "warning" : "good"}>{status === "out" ? "out of stock" : status === "low" ? "reorder" : "available"}</StatusBadge></td></tr>)}</tbody></table></section>
  </div></AppShell>;
}
