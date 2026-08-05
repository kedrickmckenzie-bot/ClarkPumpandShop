"use client";

import { ExternalLink, FileText, LockKeyhole, MapPin, PencilLine, ShieldCheck } from "lucide-react";
import Link from "@/components/site-link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, PanelTitle, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate, workOrderSpend } from "@/lib/domain/analytics";
import type { WorkOrder } from "@/lib/domain/types";
import { demoData } from "@/lib/demo/data";
import { priorityLabel, statusTone, verificationLabel, visitOutcomeLabel, workOrderStatusLabel } from "@/lib/presentation";
import { WorkOrderExecution } from "@/components/work-order-execution";

export function WorkOrderDetail({ workOrder }: { workOrder: WorkOrder }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const store = demoData.stores.find((item) => item.id === workOrder.storeId)!;
  const category = demoData.categories.find((item) => item.id === workOrder.categoryId)!;
  const system = demoData.systems.find((item) => item.id === workOrder.systemId);
  const asset = demoData.assets.find((item) => item.id === workOrder.assetId);
  const component = demoData.components.find((item) => item.id === workOrder.componentId);
  const vendor = demoData.vendors.find((item) => item.id === workOrder.vendorId);
  const reports = demoData.reports.filter((item) => workOrder.reportIds.includes(item.id));
  const reviews = demoData.reportReviews.filter((review) => reports.some((report) => report.id === review.reportId));
  const visits = demoData.visits.filter((item) => item.workOrderId === workOrder.id);
  const followUps = demoData.followUps.filter((item) => item.workOrderId === workOrder.id);
  const documents = demoData.documents.filter((item) => item.workOrderId === workOrder.id);
  const invoices = demoData.invoices.filter((item) => item.workOrderId === workOrder.id);
  const audit = demoData.auditEvents.filter((item) => item.entityId === workOrder.id || reports.some((report) => report.id === item.entityId)).sort((a, b) => b.at.localeCompare(a.at));
  const spend = workOrderSpend(demoData, workOrder.id);

  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Work Orders", href: "/work-orders" }, { label: workOrder.number }]} />
    <div className="detail-hero">
      <section className="record-card"><div className="record-line"><span className="mono">{workOrder.number}</span><StatusBadge tone={statusTone(workOrder.status)}>{workOrderStatusLabel[workOrder.status]}</StatusBadge><StatusBadge tone={workOrder.priority === "critical" ? "critical" : "warning"}>{priorityLabel[workOrder.priority]}</StatusBadge></div><h1>{workOrder.title}</h1><p className="description">{workOrder.description}</p>
        <div className="record-meta"><div className="meta-item"><span>Store</span><strong><Link href={`/stores/${store.id}`}>Store {store.code} · {store.city}</Link></strong></div><div className="meta-item"><span>Location</span><strong>{workOrder.location}</strong></div><div className="meta-item"><span>Assignment</span><strong>{workOrder.assignedToName ?? vendor?.name ?? "Unassigned"}</strong></div><div className="meta-item"><span>Cost / NTE</span><strong>{formatCurrency(spend)} / {formatCurrency(workOrder.nteCents)}</strong></div></div>
      </section>
      <aside className="control-card"><span className="label">Control owner</span><h3>{workOrder.accountableParty}</h3><p>{workOrder.nextAction}</p><div className="due"><strong>Due:</strong> {workOrder.dueAt ? formatDate(workOrder.dueAt, true) : "Complete"}<br /><strong>Escalates to:</strong> {workOrder.escalation}</div></aside>
    </div>
    <section className="panel panel-pad" style={{ marginBottom: 14 }}><PanelTitle title="Progressive classification" description="A report can start at Store + Category. Confirmed detail is added without rewriting history." />
      <div className="record-meta" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}><div className="meta-item"><span>Store</span><strong>{store.name}</strong></div><div className="meta-item"><span>Category</span><strong>{category.name}</strong></div><div className="meta-item"><span>System</span><strong>{system ? <Link href={`/stores/${store.id}/systems/${system.id}`}>{system.name}</Link> : "Not yet identified"}</strong></div><div className="meta-item"><span>Asset / component</span><strong>{asset ? <Link href={`/assets/${asset.id}`}>{asset.name}</Link> : "Not yet identified"}{component ? ` · ${component.name}` : ""}</strong></div></div>
      {editing ? <div className="callout" style={{ marginTop: 14 }}><strong>Demo reclassification control</strong><p>Change reason: diagnostic visit or vendor documentation. Saving appends an audit event; it never alters the original employee report.</p><button className="button primary small" style={{ marginTop: 9 }} onClick={() => { setEditing(false); setSaved(true); }}>Append audited update</button></div> : <button className="button small" style={{ marginTop: 14 }} onClick={() => setEditing(true)}><PencilLine />Refine classification</button>}{saved && <StatusBadge tone="good">Audit event appended in demo session</StatusBadge>}
    </section>
    <WorkOrderExecution workOrder={workOrder} />
    <div className="split-grid">
      <div className="stack">
        {reports.map((report) => <section className="panel panel-pad" key={report.id}><PanelTitle title={`Original employee report · ${report.reference}`} description="Immutable source record" /><div className="callout"><strong><LockKeyhole size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />Original wording</strong><p>“{report.originalDescription}”</p></div><div className="record-meta"><div className="meta-item"><span>Reported by</span><strong>{report.reporterName} · {report.reporterRole}</strong></div><div className="meta-item"><span>Area</span><strong>{report.area}</strong></div><div className="meta-item"><span>Submitted</span><strong>{formatDate(report.submittedAt, true)}</strong></div><div className="meta-item"><span>Status</span><strong>{report.status}</strong></div></div>{reviews.map((review) => <div className="record-line" key={review.id} style={{ marginTop: 14 }}><StatusBadge tone="good">{review.decision}</StatusBadge><span className="subtext">{review.reviewerName} · {review.context}</span></div>)}</section>)}
        <section className="panel panel-pad"><PanelTitle title="Service visits" description="Minimal technician proof: session, location, time and outcome." />{visits.map((visit) => <div className="record-card" style={{ padding: 14, borderRadius: 10, marginBottom: 8 }} key={visit.id}><div className="record-line"><strong>{visit.technicianName}</strong><StatusBadge tone={visit.checkIn.state === "verified" ? "verified" : "warning"}>{verificationLabel[visit.checkIn.state]}</StatusBadge>{visit.outcome && <StatusBadge tone={visit.outcome === "resolved" ? "good" : "exception"}>{visitOutcomeLabel[visit.outcome]}</StatusBadge>}</div><p className="description"><MapPin size={12} style={{ verticalAlign: "middle" }} /> In {formatDate(visit.checkedInAt, true)} · {Math.round(visit.checkIn.distanceM ?? 0)}m from store {visit.checkedOutAt && `· Out ${formatDate(visit.checkedOutAt, true)}`}</p></div>)}{followUps.map((item) => <div className="callout warning" key={item.id}><strong>Auto-created follow-up · {item.status}</strong><p>{item.nextAction} · accountable: {item.accountableParty} · due {formatDate(item.dueAt, true)}</p></div>)}</section>
        <section className="panel panel-pad"><PanelTitle title="Documents" description="Attached once; classified and linked to the operational record." /><div className="document-grid">{documents.map((document) => <Link className="document-card" href={document.href} key={document.id}><span className="document-icon"><FileText /></span><span><strong>{document.name}</strong><span>{document.classification.replaceAll("_", " ")} · {(document.bytes / 1024).toFixed(0)} KB</span></span><ExternalLink size={13} /></Link>)}</div></section>
      </div>
      <div className="stack">
        <section className="panel panel-pad"><PanelTitle title="Financial record" description="Approved, invoiced and allocated without losing classification depth." />{invoices.map((invoice) => { const lines = demoData.allocations.filter((item) => item.invoiceId === invoice.id); return <div key={invoice.id}><div className="record-line"><strong>{invoice.number}</strong><StatusBadge tone="good">{invoice.status}</StatusBadge></div>{lines.map((line) => <div className="record-line" style={{ justifyContent: "space-between" }} key={line.id}><span>{line.costCategory} · {line.workClass}</span><strong>{formatCurrency(line.amountCents)}</strong></div>)}<div className="record-line" style={{ justifyContent: "space-between", borderTop: "1px solid #dce2de", paddingTop: 10 }}><strong>Total</strong><strong>{formatCurrency(invoice.totalCents)}</strong></div></div>;})}</section>
        <section className="panel panel-pad"><PanelTitle title="Audit timeline" description="Who changed what, when and why." /><div className="timeline">{audit.map((event) => <div className="timeline-event" key={event.id}><span className="timeline-dot" /><div><h4>{event.summary}</h4><time>{formatDate(event.at, true)} · <span className="actor">{event.actor}</span></time>{event.detail && <p>{event.detail}</p>}</div></div>)}</div></section>
        <section className="callout"><strong><ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Close-control rule</strong><p>Open follow-ups, missing outcome evidence or unallocated invoice value block closure. This closed record satisfies all three.</p></section>
      </div>
    </div>
  </div></AppShell>;
}
