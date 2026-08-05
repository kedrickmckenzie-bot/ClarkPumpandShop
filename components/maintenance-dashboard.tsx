"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  Inbox,
  PackageSearch,
  Play,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "@/components/site-link";
import { AppShell } from "@/components/app-shell";
import { Breadcrumbs, MetricCard, PageHeader, PanelTitle, StatusBadge } from "@/components/ui";
import { formatDate, isOpenWorkOrder } from "@/lib/domain/analytics";
import { demoData, DEMO_NOW } from "@/lib/demo/data";
import { priorityLabel, statusTone, workOrderStatusLabel } from "@/lib/presentation";

const openWork = demoData.workOrders.filter(isOpenWorkOrder);

export function MaintenanceDashboard() {
  const dispatch = openWork.filter((item) => item.assignmentType === "unassigned" || item.status === "approved" || item.status === "awaiting_vendor_acceptance").sort(prioritySort);
  const overdue = openWork.filter((item) => item.dueAt && item.dueAt < DEMO_NOW).sort(prioritySort);
  const active = openWork.filter((item) => item.status === "visit_active");
  const waitingParts = openWork.filter((item) => item.status === "waiting_on_parts");
  const scheduled = openWork.filter((item) => item.scheduledStartAt).sort((a, b) => (a.scheduledStartAt ?? "").localeCompare(b.scheduledStartAt ?? ""));
  const pmExceptions = demoData.pmOccurrences.filter((item) => item.status === "missed" || ["scheduled", "due_soon"].includes(item.status)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return <AppShell><div className="page">
    <Breadcrumbs items={[{ label: "Maintenance" }, { label: "Home" }]} />
    <PageHeader eyebrow="Maintenance control center" title="Run today’s maintenance work." description="Dispatch new requests, keep technicians moving, recover overdue work, protect the PM schedule and clear parts blockers across all 65 stores.">
      <Link className="button primary" href="/work-orders/new"><Plus />Create work order</Link>
      <Link className="button" href="/schedule"><CalendarClock />Open schedule</Link>
    </PageHeader>

    <section className="maintenance-brief">
      <div><span className="live-label"><span />Wednesday, August 5 · maintenance desk</span><h2>{dispatch.length + overdue.length + waitingParts.length} work items need a dispatch decision or blocker cleared.</h2><p>The queue is ordered for action: assign, schedule, work, document and close. Reporting remains available, but it is downstream of maintenance execution.</p></div>
      <div className="shift-actions"><Link href="/work-orders?assignment=unassigned"><strong>{dispatch.length}</strong><span>Ready for dispatch</span><ArrowRight /></Link><Link href="/work-orders?queue=overdue"><strong>{overdue.length}</strong><span>Past target</span><ArrowRight /></Link><Link href="/work-orders?status=waiting_on_parts"><strong>{waitingParts.length}</strong><span>Waiting on parts</span><ArrowRight /></Link></div>
    </section>

    <section className="metric-grid maintenance-metrics">
      <MetricCard label="Ready to dispatch" value={String(dispatch.length)} note="Unassigned, approved or awaiting acceptance" icon={Inbox} href="/work-orders" tone="warning" />
      <MetricCard label="Active onsite" value={String(active.length)} note="Technician work currently in progress" icon={Play} href="/my-work" tone={active.length ? "good" : ""} />
      <MetricCard label="Overdue targets" value={String(overdue.length)} note="Open work beyond target completion" icon={AlertTriangle} href="/work-orders?queue=overdue" tone={overdue.length ? "critical" : "good"} />
      <MetricCard label="PM exceptions" value={String(pmExceptions.filter((item) => item.status === "missed").length)} note={`${pmExceptions.filter((item) => item.status === "scheduled").length} upcoming occurrences`} icon={ShieldCheck} href="/pm" tone="warning" />
    </section>

    <div className="maintenance-command-grid">
      <section className="panel dispatch-board">
        <div className="panel-pad" style={{ paddingBottom: 8 }}><PanelTitle title="Dispatch board" description="The next work that needs ownership, a commitment or a start." href="/work-orders" linkLabel="Open all work" /></div>
        <div className="dispatch-columns">
          <QueueColumn title="Assign or confirm" count={dispatch.length} tone="warning">{dispatch.slice(0, 4).map((item) => <WorkCard key={item.id} workOrderId={item.id} />)}</QueueColumn>
          <QueueColumn title="In progress" count={active.length} tone="active">{active.slice(0, 4).map((item) => <WorkCard key={item.id} workOrderId={item.id} />)}</QueueColumn>
          <QueueColumn title="Blocked" count={waitingParts.length + openWork.filter((item) => ["waiting_on_quote", "waiting_on_approval"].includes(item.status)).length} tone="critical">{openWork.filter((item) => ["waiting_on_parts", "waiting_on_quote", "waiting_on_approval"].includes(item.status)).slice(0, 4).map((item) => <WorkCard key={item.id} workOrderId={item.id} />)}</QueueColumn>
        </div>
      </section>

      <aside className="stack">
        <section className="panel panel-pad"><PanelTitle title="Today’s technician route" description="Internal assignments ordered by planned start." href="/schedule" linkLabel="Open dispatch schedule" />{scheduled.slice(0, 5).map((item, index) => { const store = demoData.stores.find((candidate) => candidate.id === item.storeId); return <Link className="schedule-row" href={`/work-orders/${item.id}`} key={item.id}><time>{new Date(item.scheduledStartAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</time><span className="route-line" /><span><strong>{item.assignedToName ?? "Unassigned"}</strong><small>Store {store?.code} · {item.title}</small></span><StatusBadge tone={index < 3 ? "active" : "neutral"}>{index < 3 ? "today" : "queued"}</StatusBadge></Link>;})}</section>
        <section className="panel panel-pad"><PanelTitle title="PM control" description="Missed work first, then the next planned occurrences." href="/pm" linkLabel="Open PM program" />{pmExceptions.slice(0, 5).map((item) => { const plan = demoData.pmPlans.find((candidate) => candidate.id === item.planId); const store = demoData.stores.find((candidate) => candidate.id === item.storeId); return <Link className="exception-row" href="/pm" key={item.id}><span className={`exception-bar ${item.status === "missed" ? "red" : ""}`} /><span className="exception-copy"><strong>{plan?.name}</strong><span>Store {store?.code} · due {formatDate(item.dueAt)}</span></span><StatusBadge tone={item.status === "missed" ? "critical" : "info"}>{item.status.replaceAll("_", " ")}</StatusBadge></Link>;})}</section>
      </aside>
    </div>

    <section className="triple-grid maintenance-shortcuts">
      <Link className="workflow-card" href="/requests"><span><Inbox /></span><div><h3>Request intake</h3><p>Review store-reported issues, validate urgency and convert requests into controlled work.</p></div><ArrowRight /></Link>
      <Link className="workflow-card" href="/my-work"><span><UserRound /></span><div><h3>Technician execution</h3><p>Safety review, checklist, time, parts, notes, proof, testing and closeout in one workspace.</p></div><ArrowRight /></Link>
      <Link className="workflow-card" href="/parts"><span><PackageSearch /></span><div><h3>Parts & inventory</h3><p>See critical spares, stock by location, consumption and work waiting for material.</p></div><ArrowRight /></Link>
    </section>
  </div></AppShell>;
}

function prioritySort(a: (typeof demoData.workOrders)[number], b: (typeof demoData.workOrders)[number]) {
  const rank = { critical: 0, high: 1, routine: 2, low: 3 };
  return rank[a.priority] - rank[b.priority] || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
}

function QueueColumn({ title, count, tone, children }: { title: string; count: number; tone: string; children: React.ReactNode }) {
  return <div className="queue-column"><div className="queue-title"><span className={`queue-dot ${tone}`} /><strong>{title}</strong><b>{count}</b></div><div className="queue-cards">{children}</div></div>;
}

function WorkCard({ workOrderId }: { workOrderId: string }) {
  const item = demoData.workOrders.find((candidate) => candidate.id === workOrderId)!;
  const store = demoData.stores.find((candidate) => candidate.id === item.storeId);
  const checks = demoData.checklistItems.filter((candidate) => candidate.workOrderId === item.id);
  return <Link className="dispatch-card" href={`/work-orders/${item.id}`}><div><span className="mono">{item.number}</span><StatusBadge tone={item.priority === "critical" ? "critical" : item.priority === "high" ? "warning" : "neutral"}>{priorityLabel[item.priority]}</StatusBadge></div><h3>{item.title}</h3><p>Store {store?.code} · {store?.city} · {item.location}</p><footer><span><UserRound />{item.assignedToName ?? item.accountableParty}</span><span><ClipboardList />{checks.filter((check) => check.completed).length}/{checks.length}</span><StatusBadge tone={statusTone(item.status)}>{workOrderStatusLabel[item.status]}</StatusBadge></footer></Link>;
}
