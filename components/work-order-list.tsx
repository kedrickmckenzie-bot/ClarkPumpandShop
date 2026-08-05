"use client";

import { Download, Plus, Search } from "lucide-react";
import Link from "@/components/site-link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, PageHeader, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate, isOpenWorkOrder } from "@/lib/domain/analytics";
import { demoData } from "@/lib/demo/data";
import { priorityLabel, statusTone, workOrderStatusLabel } from "@/lib/presentation";
import type { WorkOrder } from "@/lib/domain/types";

const PAGE_SIZE = 20;

export function WorkOrderList() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [region, setRegion] = useState("");
  const [category, setCategory] = useState("");
  const [assignment, setAssignment] = useState("");
  const [page, setPage] = useState(1);
  const [created, setCreated] = useState<WorkOrder[]>([]);
  useEffect(() => { fetch("/api/registry?entity=work-orders").then((response) => response.json()).then((raw) => { const result = raw as { ok: boolean; records?: WorkOrder[] }; if (result.ok) setCreated((result.records ?? []).map((item) => ({ ...item, reportIds: item.reportIds ?? [], nteCents: item.nteCents ?? 0, costExposureCents: item.costExposureCents ?? 0, vendorAcceptance: item.vendorAcceptance ?? "not_issued" }))); }).catch(() => undefined); }, []);
  const rows = useMemo(() => [...demoData.workOrders, ...created].filter((workOrder) => {
    const store = demoData.stores.find((item) => item.id === workOrder.storeId);
    const asset = demoData.assets.find((item) => item.id === workOrder.assetId);
    const haystack = `${workOrder.number} ${workOrder.title} ${workOrder.description} ${workOrder.location ?? ""} ${workOrder.requestedBy ?? ""} ${workOrder.assignedToName ?? ""} ${workOrder.accountableParty} ${store?.code ?? ""} ${store?.name ?? ""} ${store?.address1 ?? ""} ${store?.city ?? ""} ${asset?.assetTag ?? ""} ${asset?.serial ?? ""}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) &&
      (!region || store?.regionId === region) &&
      (!category || workOrder.categoryId === category) &&
      (!assignment || workOrder.assignmentType === assignment) &&
      (status === "all" || (status === "open" ? isOpenWorkOrder(workOrder) : workOrder.status === status));
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [query, status, region, category, assignment, created]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  function reset(mutator: () => void) { mutator(); setPage(1); }

  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Operations", href: "/" }, { label: "Work Orders" }]} />
    <PageHeader eyebrow="Internal source of truth" title="Work orders" description="Every request, vendor touch, visit, document, control action and cost remains tied to Clark’s work order.">
      <Link className="button primary" href="/work-orders/new"><Plus />Create work order</Link>
      <button className="button" onClick={() => window.print()}><Download />Export view</button>
    </PageHeader>
    <div className="filter-bar">
      <label className="filter-field directory-search"><span>Search work, store or equipment</span><div style={{ position: "relative" }}><Search size={13} style={{ position: "absolute", left: 9, top: 10, color: "#7a8987" }} /><input style={{ paddingLeft: 29 }} value={query} onChange={(event) => reset(() => setQuery(event.target.value))} placeholder="WO, store #, address, asset tag, assignee…" /></div></label>
      <label className="filter-field"><span>Status</span><select value={status} onChange={(event) => reset(() => setStatus(event.target.value))}><option value="open">Open work</option><option value="all">All statuses</option><option value="follow_up_required">Follow-up required</option><option value="awaiting_vendor_acceptance">Awaiting vendor</option><option value="waiting_on_quote">Waiting on quote</option><option value="closed">Closed</option></select></label>
      <label className="filter-field"><span>Region</span><select value={region} onChange={(event) => reset(() => setRegion(event.target.value))}><option value="">All regions</option>{demoData.regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="filter-field"><span>Category</span><select value={category} onChange={(event) => reset(() => setCategory(event.target.value))}><option value="">All categories</option>{demoData.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="filter-field"><span>Assignment</span><select value={assignment} onChange={(event) => reset(() => setAssignment(event.target.value))}><option value="">All assignment types</option><option value="internal">Internal maintenance</option><option value="vendor">Vendor</option><option value="blended">Blended</option><option value="unassigned">Unassigned</option></select></label>
      <span className="filter-summary">{rows.length} records · page {page} of {pageCount}</span>
    </div>
    <div className="panel table-wrap">
      <table className="data-table"><thead><tr><th>Work order</th><th>Store</th><th>Classification</th><th>Priority</th><th>Status</th><th>Accountable / next action</th><th>Due</th><th className="numeric">Exposure</th></tr></thead>
        <tbody>{visible.map((workOrder) => {
          const store = demoData.stores.find((item) => item.id === workOrder.storeId);
          const categoryItem = demoData.categories.find((item) => item.id === workOrder.categoryId);
          const system = demoData.systems.find((item) => item.id === workOrder.systemId);
          return <tr key={workOrder.id}>
            <td><Link className="row-link mono" href={`/work-orders/${workOrder.id}`}>{workOrder.number}</Link><span className="subtext">{workOrder.title} · {workOrder.location}</span></td>
            <td><Link className="row-link" href={`/stores/${store?.id}`}>{store ? `Store ${store.code} · ${store.city}` : workOrder.storeId}</Link><span className="subtext">{store?.address1}, {store?.city}, {store?.state}</span></td>
            <td><strong>{categoryItem?.name}</strong><span className="subtext">{system?.name ?? "Store + category only"}</span></td>
            <td><StatusBadge tone={workOrder.priority === "critical" ? "critical" : workOrder.priority === "high" ? "warning" : "neutral"}>{priorityLabel[workOrder.priority]}</StatusBadge></td>
            <td><StatusBadge tone={statusTone(workOrder.status)}>{workOrderStatusLabel[workOrder.status]}</StatusBadge></td>
            <td><strong>{workOrder.assignedToName ?? workOrder.accountableParty}</strong><span className="subtext">{workOrder.assignmentType?.replaceAll("_", " ")} · {workOrder.nextAction}</span></td>
            <td>{workOrder.dueAt ? formatDate(workOrder.dueAt, true) : "—"}</td>
            <td className="numeric"><strong>{formatCurrency(workOrder.costExposureCents ?? 0)}</strong><span className="subtext">NTE {formatCurrency(workOrder.nteCents ?? 0)}</span></td>
          </tr>;
        })}</tbody>
      </table>
      {!visible.length && <div className="empty-state">No work orders match these filters.</div>}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}><button className="button small" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button className="button small" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></div>
  </div></AppShell>;
}
