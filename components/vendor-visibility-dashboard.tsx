"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileSearch,
  History,
  Inbox,
  Link2,
  ListChecks,
  LogIn,
  MessageSquareText,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wrench,
} from "lucide-react";
import Link from "@/components/site-link";
import { formatCurrency, formatDate, isOpenWorkOrder } from "@/lib/domain/analytics";
import type {
  Invoice,
  ServiceVisit,
  Vendor,
  VisitOutcome,
  WorkOrder,
} from "@/lib/domain/types";
import { PLATFORM_NOW, platformData } from "@/lib/platform/data";
import { visitOutcomeLabel, workOrderStatusLabel } from "@/lib/presentation";

type DashboardTab = "accountability" | "workspace" | "ap";
type SourceFilter =
  | "all"
  | "accepted"
  | "pending"
  | "visited"
  | "return_visit"
  | VisitOutcome;

const completeStatuses = new Set<WorkOrder["status"]>([
  "completed_pending_verification",
  "completed_pending_invoice",
  "closed",
]);

const outcomeColors: Record<VisitOutcome, string> = {
  resolved: "#1f7a62",
  temporary: "#c17a22",
  diagnosed_unresolved: "#53718d",
  unable_to_diagnose: "#8a6387",
  no_issue_found: "#76827f",
  unable_to_perform: "#ad4d43",
};

const shortOutcomeLabel: Record<VisitOutcome, string> = {
  resolved: "Resolved",
  temporary: "Temporary fix",
  diagnosed_unresolved: "Diagnosed, unresolved",
  unable_to_diagnose: "Unable to diagnose",
  no_issue_found: "No issue found",
  unable_to_perform: "Unable to perform",
};

function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

function visitMinutes(visit: ServiceVisit) {
  return minutesBetween(visit.checkedInAt, visit.checkedOutAt ?? PLATFORM_NOW);
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function workVisits(workOrderId: string) {
  return platformData.visits
    .filter((visit) => visit.workOrderId === workOrderId)
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
}

function workDocuments(workOrderId: string) {
  return platformData.documents.filter((document) => document.workOrderId === workOrderId);
}

function vendorName(vendorId?: string) {
  return platformData.vendors.find((vendor) => vendor.id === vendorId)?.shortName ?? "Not selected";
}

function storeLabel(workOrder: WorkOrder) {
  const store = platformData.stores.find((candidate) => candidate.id === workOrder.storeId);
  return store ? `Store ${store.code} · ${store.city}, ${store.state}` : workOrder.storeId;
}

function assetLabel(workOrder: WorkOrder) {
  if (workOrder.assetId) {
    return platformData.assets.find((asset) => asset.id === workOrder.assetId)?.name ?? "Linked asset";
  }
  if (workOrder.systemId) {
    return platformData.systems.find((system) => system.id === workOrder.systemId)?.name ?? "Linked equipment group";
  }
  return "Asset can be classified later";
}

function filterLabel(filter: SourceFilter) {
  const labels: Record<Exclude<SourceFilter, VisitOutcome>, string> = {
    all: "All vendor work",
    accepted: "Accepted work",
    pending: "Awaiting response",
    visited: "Work with QR visits",
    return_visit: "Work with repeat visits",
  };
  return filter in labels ? labels[filter as Exclude<SourceFilter, VisitOutcome>] : shortOutcomeLabel[filter as VisitOutcome];
}

function matchesSourceFilter(workOrder: WorkOrder, filter: SourceFilter) {
  const visits = workVisits(workOrder.id);
  if (filter === "all") return true;
  if (filter === "accepted") return workOrder.vendorAcceptance === "accepted";
  if (filter === "pending") return ["pending", "clarification"].includes(workOrder.vendorAcceptance);
  if (filter === "visited") return visits.length > 0;
  if (filter === "return_visit") return visits.length > 1 || workOrder.status === "return_visit_scheduled";
  return visits.some((visit) => visit.outcome === filter);
}

export function VendorVisibilityDashboard() {
  const [tab, setTab] = useState<DashboardTab>("accountability");
  const [selectedVendorId, setSelectedVendorId] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");

  const vendorWork = useMemo(
    () =>
      platformData.workOrders
        .filter((workOrder) => workOrder.vendorId && workOrder.assignmentType !== "internal")
        .filter((workOrder) => selectedVendorId === "all" || workOrder.vendorId === selectedVendorId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [selectedVendorId],
  );

  const scopedWorkIds = useMemo(() => new Set(vendorWork.map((workOrder) => workOrder.id)), [vendorWork]);
  const scopedVisits = useMemo(
    () => platformData.visits.filter((visit) => scopedWorkIds.has(visit.workOrderId)),
    [scopedWorkIds],
  );
  const sourceRows = useMemo(
    () => vendorWork.filter((workOrder) => matchesSourceFilter(workOrder, sourceFilter)),
    [sourceFilter, vendorWork],
  );
  const selectedWorkOrder =
    sourceRows.find((workOrder) => workOrder.id === selectedWorkOrderId) ?? sourceRows[0];

  const acceptedWork = vendorWork.filter((workOrder) => workOrder.vendorAcceptance === "accepted");
  const pendingWork = vendorWork.filter((workOrder) =>
    ["pending", "clarification"].includes(workOrder.vendorAcceptance),
  );
  const declinedResponses = platformData.vendorResponses.filter(
    (response) => scopedWorkIds.has(response.workOrderId) && response.response === "declined",
  );
  const repeatVisitWork = vendorWork.filter(
    (workOrder) => workVisits(workOrder.id).length > 1 || workOrder.status === "return_visit_scheduled",
  );
  const onsiteMinutes = scopedVisits.reduce((total, visit) => total + visitMinutes(visit), 0);
  const activeVisits = scopedVisits.filter((visit) => !visit.checkedOutAt);
  const evidenceDocuments = platformData.documents.filter(
    (document) =>
      document.workOrderId &&
      scopedWorkIds.has(document.workOrderId) &&
      ["proof", "service_ticket", "employee_photo"].includes(document.classification),
  );

  const outcomeCounts = Object.keys(outcomeColors).map((outcome) => ({
    outcome: outcome as VisitOutcome,
    count: scopedVisits.filter((visit) => visit.outcome === outcome).length,
  }));
  const recordedOutcomes = outcomeCounts.reduce((total, item) => total + item.count, 0);
  let donutCursor = 0;
  const donutStops = outcomeCounts
    .filter((item) => item.count > 0)
    .map((item) => {
      const start = donutCursor;
      donutCursor += recordedOutcomes ? (item.count / recordedOutcomes) * 100 : 0;
      return `${outcomeColors[item.outcome]} ${start}% ${donutCursor}%`;
    });
  const donutStyle: CSSProperties = {
    background: recordedOutcomes
      ? `conic-gradient(${donutStops.join(", ")})`
      : "conic-gradient(#dfe5e2 0 100%)",
  };

  function chooseMetric(filter: SourceFilter) {
    setSourceFilter(filter);
    setSelectedWorkOrderId("");
  }

  return (
    <section className="vv-shell" aria-labelledby="vv-title">
      <header className="vv-hero">
        <div className="vv-hero-copy">
          <span className="vv-eyebrow">Vendor accountability · flexible by design</span>
          <h1 id="vv-title">See what happened onsite without making vendors adopt another system.</h1>
          <p>
            Email links and the store QR handle the basics. Acceptance, visits, approximate time onsite,
            outcomes and return trips become visible to the client. Photos, notes, the vendor workspace and
            invoice review are optional.
          </p>
        </div>
        <div className="vv-policy-card" aria-label="Example company settings">
          <span>Example company settings</span>
          <strong>Minimum-friction field flow</strong>
          <ul>
            <li><CheckCircle2 /> No vendor account required</li>
            <li><CheckCircle2 /> No technician signature required</li>
            <li><Camera /> Photos and notes optional</li>
            <li><QrCode /> Work order can be missing at check-in</li>
          </ul>
        </div>
      </header>

      <div className="vv-controls">
        <div className="vv-tabs" role="tablist" aria-label="Vendor visibility views">
          <button
            className={tab === "accountability" ? "vv-tab vv-tab-active" : "vv-tab"}
            type="button"
            role="tab"
            aria-selected={tab === "accountability"}
            onClick={() => setTab("accountability")}
          >
            <ShieldCheck /> Accountability
          </button>
          <button
            className={tab === "workspace" ? "vv-tab vv-tab-active" : "vv-tab"}
            type="button"
            role="tab"
            aria-selected={tab === "workspace"}
            onClick={() => setTab("workspace")}
          >
            <Building2 /> Optional vendor workspace
          </button>
          <button
            className={tab === "ap" ? "vv-tab vv-tab-active" : "vv-tab"}
            type="button"
            role="tab"
            aria-selected={tab === "ap"}
            onClick={() => setTab("ap")}
          >
            <FileCheck2 /> Optional AP safeguard
          </button>
        </div>
        <label className="vv-vendor-filter">
          <span>Service partner</span>
          <select
            value={selectedVendorId}
            onChange={(event) => {
              setSelectedVendorId(event.target.value);
              setSourceFilter("all");
              setSelectedWorkOrderId("");
            }}
          >
            <option value="all">All service partners</option>
            {platformData.vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
            ))}
          </select>
        </label>
      </div>

      {tab === "accountability" && (
        <div className="vv-accountability" role="tabpanel">
          <section className="vv-metric-grid" aria-label="Vendor activity summary">
            <MetricButton
              icon={CheckCircle2}
              label="Accepted work"
              value={String(acceptedWork.length)}
              note={`${pendingWork.length} waiting · ${declinedResponses.length} declined`}
              active={sourceFilter === "accepted"}
              onClick={() => chooseMetric("accepted")}
            />
            <MetricButton
              icon={QrCode}
              label="QR visits recorded"
              value={String(scopedVisits.length)}
              note={`${activeVisits.length} active now · ${evidenceDocuments.length} evidence files`}
              active={sourceFilter === "visited"}
              onClick={() => chooseMetric("visited")}
            />
            <MetricButton
              icon={Clock3}
              label="Observed time onsite"
              value={formatMinutes(onsiteMinutes)}
              note="Approximate check-in to check-out spans"
              active={sourceFilter === "visited"}
              onClick={() => chooseMetric("visited")}
            />
            <MetricButton
              icon={RefreshCw}
              label="Work with repeat visits"
              value={String(repeatVisitWork.length)}
              note="Two or more visits, or a return scheduled"
              active={sourceFilter === "return_visit"}
              onClick={() => chooseMetric("return_visit")}
            />
          </section>

          <div className="vv-accountability-grid">
            <section className="vv-panel vv-flow-panel">
              <div className="vv-panel-heading">
                <div>
                  <span>Lightweight participation</span>
                  <h2>From email to a visible service history</h2>
                </div>
                <span className="vv-optional-label">Only the first two steps are needed</span>
              </div>
              <div className="vv-flow" aria-label="Vendor participation flow">
                <FlowStep icon={Inbox} title="Open email link" detail="Review, accept or decline" />
                <FlowStep icon={CalendarClock} title="Share a date" detail="Optional schedule update" optional />
                <FlowStep icon={LogIn} title="Scan store QR" detail="Name, vendor, work order" />
                <FlowStep icon={Camera} title="Add context" detail="Photos and notes optional" optional />
                <FlowStep icon={ListChecks} title="Record outcome" detail="Then check out" />
              </div>
              <div className="vv-unmatched-callout">
                <div className="vv-unmatched-icon"><Link2 /></div>
                <div>
                  <strong>“I don&apos;t see my work order” is always available.</strong>
                  <p>
                    The technician can still check in. The visit lands in an unmatched queue for the client to
                    connect later; it does not block service.
                  </p>
                </div>
                <span><b>0</b> unmatched visits now</span>
              </div>
            </section>

            <section className="vv-panel vv-outcome-panel">
              <div className="vv-panel-heading">
                <div>
                  <span>Recorded outcomes</span>
                  <h2>What technicians reported</h2>
                </div>
                <b>{recordedOutcomes} completed visits</b>
              </div>
              <div className="vv-outcome-visual">
                <div
                  className="vv-donut"
                  style={donutStyle}
                  role="img"
                  aria-label={`${recordedOutcomes} visits have a recorded outcome`}
                >
                  <span><strong>{recordedOutcomes}</strong><small>outcomes</small></span>
                </div>
                <div className="vv-outcome-legend">
                  {outcomeCounts.map((item) => (
                    <button
                      type="button"
                      key={item.outcome}
                      className={sourceFilter === item.outcome ? "vv-legend-row vv-legend-active" : "vv-legend-row"}
                      onClick={() => chooseMetric(item.outcome)}
                    >
                      <i style={{ backgroundColor: outcomeColors[item.outcome] }} />
                      <span>{shortOutcomeLabel[item.outcome]}</span>
                      <strong>{item.count}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <p className="vv-data-note">
                Outcome labels describe what the technician reported. They do not certify workmanship or turn
                observed time onsite into billable labor.
              </p>
            </section>
          </div>

          <section className="vv-panel vv-source-panel">
            <div className="vv-panel-heading vv-source-heading">
              <div>
                <span>Supporting records</span>
                <h2>{filterLabel(sourceFilter)}</h2>
                <p>{sourceRows.length} exact work orders support this view. Select one to see its visits.</p>
              </div>
              {sourceFilter !== "all" && (
                <button className="vv-clear-filter" type="button" onClick={() => chooseMetric("all")}>
                  Clear filter
                </button>
              )}
            </div>
            <div className="vv-source-layout">
              <div className="vv-record-table-wrap">
                <table className="vv-record-table">
                  <thead>
                    <tr><th>Work order</th><th>Service partner</th><th>Response</th><th>Visits</th><th>Latest outcome</th></tr>
                  </thead>
                  <tbody>
                    {sourceRows.map((workOrder) => {
                      const visits = workVisits(workOrder.id);
                      const latestVisit = visits[0];
                      return (
                        <tr
                          key={workOrder.id}
                          className={selectedWorkOrder?.id === workOrder.id ? "vv-row-selected" : ""}
                        >
                          <td>
                            <button type="button" className="vv-work-select" onClick={() => setSelectedWorkOrderId(workOrder.id)}>
                              <strong>{workOrder.number}</strong>
                              <span>{workOrder.title}</span>
                              <small>{storeLabel(workOrder)}</small>
                            </button>
                          </td>
                          <td>{vendorName(workOrder.vendorId)}</td>
                          <td><StatusPill value={workOrder.vendorAcceptance.replaceAll("_", " ")} /></td>
                          <td>{visits.length}</td>
                          <td>{latestVisit?.outcome ? shortOutcomeLabel[latestVisit.outcome] : "No outcome yet"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!sourceRows.length && (
                  <div className="vv-empty"><CheckCircle2 /><strong>No records in this view</strong><p>Try another service partner or clear the filter.</p></div>
                )}
              </div>
              {selectedWorkOrder && <WorkOrderEvidence workOrder={selectedWorkOrder} />}
            </div>
          </section>
        </div>
      )}

      {tab === "workspace" && (
        <VendorWorkspacePreview key={selectedVendorId} selectedVendorId={selectedVendorId} />
      )}

      {tab === "ap" && (
        <ApSafeguardPreview key={selectedVendorId} selectedVendorId={selectedVendorId} />
      )}
    </section>
  );
}

function MetricButton({
  icon: Icon,
  label,
  value,
  note,
  active,
  onClick,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  note: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "vv-metric vv-metric-active" : "vv-metric"}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="vv-metric-icon"><Icon /></span>
      <span className="vv-metric-copy"><small>{label}</small><strong>{value}</strong><em>{note}</em></span>
      <ChevronRight />
    </button>
  );
}

function FlowStep({
  icon: Icon,
  title,
  detail,
  optional = false,
}: {
  icon: typeof Inbox;
  title: string;
  detail: string;
  optional?: boolean;
}) {
  return (
    <div className="vv-flow-step">
      <span className="vv-flow-icon"><Icon /></span>
      <strong>{title}</strong>
      <small>{detail}</small>
      {optional && <em>Optional</em>}
    </div>
  );
}

function StatusPill({ value, tone = "neutral" }: { value: string; tone?: "neutral" | "good" | "warning" }) {
  return <span className={`vv-status vv-status-${tone}`}>{value}</span>;
}

function WorkOrderEvidence({ workOrder }: { workOrder: WorkOrder }) {
  const visits = workVisits(workOrder.id);
  const documents = workDocuments(workOrder.id).filter((document) =>
    ["proof", "service_ticket", "employee_photo"].includes(document.classification),
  );
  const observedMinutes = visits.reduce((total, visit) => total + visitMinutes(visit), 0);

  return (
    <aside className="vv-evidence-detail" aria-label={`Evidence for ${workOrder.number}`}>
      <div className="vv-evidence-head">
        <div><span>{workOrder.number}</span><h3>{workOrder.title}</h3><p>{assetLabel(workOrder)}</p></div>
        <Link href={`/work-orders/${workOrder.id}`} aria-label={`Open ${workOrder.number}`}><ExternalLink /></Link>
      </div>
      <div className="vv-evidence-summary">
        <div><strong>{visits.length}</strong><span>Visits</span></div>
        <div><strong>{formatMinutes(observedMinutes)}</strong><span>Observed onsite</span></div>
        <div><strong>{documents.length}</strong><span>Evidence files</span></div>
      </div>
      <div className="vv-visit-list">
        <h4>Visit history</h4>
        {visits.map((visit, index) => (
          <article key={visit.id} className="vv-visit-row">
            <span className="vv-visit-number">{visits.length - index}</span>
            <div>
              <strong>{visit.technicianName}</strong>
              <small>{formatDate(visit.checkedInAt, true)} · {formatMinutes(visitMinutes(visit))}</small>
              <span>{visit.outcome ? visitOutcomeLabel[visit.outcome] : "Currently checked in"}</span>
            </div>
            <StatusPill
              value={visit.checkedOutAt ? "Checked out" : "Onsite"}
              tone={visit.checkedOutAt ? "neutral" : "good"}
            />
          </article>
        ))}
        {!visits.length && <p className="vv-empty-copy">No QR visit has been recorded for this work order.</p>}
      </div>
      <p className="vv-data-note"><Clock3 /> Observed onsite time is an approximate span, not a timecard or a billable-hours decision.</p>
    </aside>
  );
}

function VendorWorkspacePreview({ selectedVendorId }: { selectedVendorId: string }) {
  const portalVendors = platformData.vendors.filter((vendor) =>
    platformData.workOrders.some((workOrder) => workOrder.vendorId === vendor.id),
  );
  const initialVendor = selectedVendorId !== "all" && portalVendors.some((vendor) => vendor.id === selectedVendorId)
    ? selectedVendorId
    : portalVendors[0]?.id ?? "";
  const [portalVendorId, setPortalVendorId] = useState(initialVendor);
  const portalVendor = portalVendors.find((vendor) => vendor.id === portalVendorId) ?? portalVendors[0];
  const portalWork = platformData.workOrders
    .filter((workOrder) => workOrder.vendorId === portalVendor?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openWork = portalWork.filter((workOrder) => isOpenWorkOrder(workOrder) && !completeStatuses.has(workOrder.status));
  const completedWork = portalWork.filter((workOrder) => completeStatuses.has(workOrder.status));
  const [portalFilter, setPortalFilter] = useState<"all" | "open" | "completed" | "visited">("all");
  const visiblePortalWork = portalWork.filter((workOrder) => {
    if (portalFilter === "all") return true;
    if (portalFilter === "open") return openWork.some((candidate) => candidate.id === workOrder.id);
    if (portalFilter === "completed") return completedWork.some((candidate) => candidate.id === workOrder.id);
    return workVisits(workOrder.id).length > 0;
  });
  const [selectedId, setSelectedId] = useState(openWork[0]?.id ?? completedWork[0]?.id ?? "");
  const selected = visiblePortalWork.find((workOrder) => workOrder.id === selectedId) ?? visiblePortalWork[0];

  return (
    <div className="vv-workspace" role="tabpanel">
      <section className="vv-portal-banner">
        <div>
          <span className="vv-eyebrow">Optional vendor workspace</span>
          <h2>A useful account for vendors who want one.</h2>
          <p>
            Service partners can see their customer jobs, relevant equipment details and the history needed to
            prepare for a visit. Email action links and store QR check-in still work without an account.
          </p>
        </div>
        <div className="vv-portal-choice">
          <div><Link2 /><span><strong>No login</strong><small>Accept link + store QR</small></span></div>
          <span>or</span>
          <div><Building2 /><span><strong>Vendor workspace</strong><small>History and one shared queue</small></span></div>
        </div>
      </section>

      <section className="vv-portal-shell">
        <header className="vv-portal-header">
          <div className="vv-portal-brand"><span><Wrench /></span><div><strong>Maintenance Intelligence partner workspace</strong><small>Demo Mode · vendor-scoped information</small></div></div>
          <label><span>Preview as</span><select value={portalVendor?.id ?? ""} onChange={(event) => { setPortalVendorId(event.target.value); setSelectedId(""); }}>{portalVendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
        </header>
        {portalVendor && selected ? (
          <div className="vv-portal-grid">
            <aside className="vv-portal-queue">
              <div className="vv-portal-stats">
                <button type="button" aria-pressed={portalFilter === "open"} onClick={() => { setPortalFilter("open"); setSelectedId(""); }}><strong>{openWork.length}</strong><span>Open jobs</span></button>
                <button type="button" aria-pressed={portalFilter === "completed"} onClick={() => { setPortalFilter("completed"); setSelectedId(""); }}><strong>{completedWork.length}</strong><span>Completed</span></button>
                <button type="button" aria-pressed={portalFilter === "visited"} onClick={() => { setPortalFilter("visited"); setSelectedId(""); }}><strong>{portalWork.reduce((total, workOrder) => total + workVisits(workOrder.id).length, 0)}</strong><span>Visits</span></button>
              </div>
              <div className="vv-portal-list-heading"><strong>{portalFilter === "all" ? "All" : portalFilter.replaceAll("_", " ")} jobs for {portalVendor.shortName}</strong><small>Pricing from other vendors is never shown.</small>{portalFilter !== "all" && <button type="button" onClick={() => { setPortalFilter("all"); setSelectedId(""); }}>Show all</button>}</div>
              <div className="vv-portal-list">
                {visiblePortalWork.map((workOrder) => (
                  <button
                    key={workOrder.id}
                    type="button"
                    className={selected.id === workOrder.id ? "vv-portal-job vv-portal-job-active" : "vv-portal-job"}
                    onClick={() => setSelectedId(workOrder.id)}
                  >
                    <span><strong>{workOrder.number}</strong><StatusPill value={workOrderStatusLabel[workOrder.status]} /></span>
                    <b>{workOrder.title}</b>
                    <small>{storeLabel(workOrder)}</small>
                    <em>{workOrder.scheduledStartAt ? `Planned ${formatDate(workOrder.scheduledStartAt, true)}` : "No shared schedule"}</em>
                  </button>
                ))}
                {!visiblePortalWork.length && <div className="vv-empty"><CheckCircle2 /><strong>No jobs in this view</strong><p>Choose another summary or show all jobs.</p></div>}
              </div>
            </aside>
            <PortalJobDetail workOrder={selected} vendor={portalVendor} />
          </div>
        ) : (
          <div className="vv-empty"><Inbox /><strong>No shared jobs</strong><p>This vendor has no work in the demonstration data.</p></div>
        )}
      </section>
    </div>
  );
}

function PortalJobDetail({ workOrder, vendor }: { workOrder: WorkOrder; vendor: Vendor }) {
  const asset = platformData.assets.find((candidate) => candidate.id === workOrder.assetId);
  const system = platformData.systems.find((candidate) => candidate.id === workOrder.systemId);
  const assetHistory = asset
    ? platformData.workOrders
        .filter((candidate) => candidate.assetId === asset.id && candidate.id !== workOrder.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const sharedDocuments = platformData.documents.filter(
    (document) =>
      document.visibility === "vendor_shared" &&
      (document.workOrderId === workOrder.id || (asset && document.assetId === asset.id)),
  );

  return (
    <article className="vv-portal-detail">
      <header className="vv-portal-detail-head">
        <div><span>{workOrder.number}</span><h3>{workOrder.title}</h3><p>{storeLabel(workOrder)} · {assetLabel(workOrder)}</p></div>
        <StatusPill value={workOrderStatusLabel[workOrder.status]} tone={completeStatuses.has(workOrder.status) ? "good" : "neutral"} />
      </header>
      <section className="vv-portal-scope">
        <h4>Requested work</h4>
        <p>{workOrder.description}</p>
        <dl>
          <div><dt>Service partner</dt><dd>{vendor.name}</dd></div>
          <div><dt>Requested</dt><dd>{workOrder.requestedServiceAt ? formatDate(workOrder.requestedServiceAt, true) : formatDate(workOrder.createdAt, true)}</dd></div>
          <div><dt>Shared schedule</dt><dd>{workOrder.scheduledStartAt ? formatDate(workOrder.scheduledStartAt, true) : "Not provided · optional"}</dd></div>
          <div><dt>Store access</dt><dd>{workOrder.accessInstructions ?? "Check in with the store contact."}</dd></div>
        </dl>
      </section>
      <section className="vv-asset-context">
        <div className="vv-section-heading"><div><span>Relevant equipment context</span><h4>{asset?.name ?? system?.name ?? "Equipment not classified yet"}</h4></div>{asset && <Link href={`/assets/${asset.id}`}>Open asset <ArrowRight /></Link>}</div>
        {asset ? (
          <>
            <dl className="vv-asset-facts">
              <div><dt>Manufacturer</dt><dd>{asset.manufacturer}</dd></div>
              <div><dt>Model</dt><dd>{asset.model}</dd></div>
              <div><dt>Serial</dt><dd>{asset.serial}</dd></div>
              <div><dt>Location</dt><dd>{asset.location}</dd></div>
              <div><dt>Warranty through</dt><dd>{formatDate(asset.warrantyEndsAt)}</dd></div>
              <div><dt>Last service</dt><dd>{asset.lastServiceAt ? formatDate(asset.lastServiceAt) : "No date recorded"}</dd></div>
            </dl>
            <div className="vv-history-list">
              <h5><History /> Relevant asset history</h5>
              {assetHistory.slice(0, 4).map((historyItem) => (
                <Link href={`/work-orders/${historyItem.id}`} key={historyItem.id}>
                  <span><strong>{historyItem.number} · {historyItem.title}</strong><small>{formatDate(historyItem.createdAt)} · {workOrderStatusLabel[historyItem.status]}</small></span><ChevronRight />
                </Link>
              ))}
              {!assetHistory.length && <p>No prior work is recorded for this asset.</p>}
            </div>
          </>
        ) : (
          <div className="vv-unclassified-note"><AlertCircle /><p>The work order is still useful without an asset. The customer team can classify it after diagnosis.</p></div>
        )}
      </section>
      <section className="vv-shared-files">
        <div className="vv-section-heading"><div><span>Shared with this vendor</span><h4>Files and technical references</h4></div><b>{sharedDocuments.length} files</b></div>
        {sharedDocuments.slice(0, 5).map((document) => (
          <a href={document.href} key={document.id}><FileSearch /><span><strong>{document.name}</strong><small>{document.classification.replaceAll("_", " ")} · {formatDate(document.uploadedAt)}</small></span><ExternalLink /></a>
        ))}
        {!sharedDocuments.length && <p className="vv-empty-copy">No files have been shared for this job.</p>}
      </section>
    </article>
  );
}

type InvoiceReview = {
  invoice: Invoice;
  workOrder?: WorkOrder;
  status: "matched" | "review";
  headline: string;
  signals: { label: string; state: "good" | "review" | "neutral" }[];
};

function reviewInvoice(invoice: Invoice): InvoiceReview {
  const workOrder = platformData.workOrders.find((candidate) => candidate.id === invoice.workOrderId);
  const visits = workOrder ? workVisits(workOrder.id) : [];
  const approvedQuote = platformData.quotes.find((quote) => quote.workOrderId === workOrder?.id && quote.status === "approved");
  const authorization = platformData.authorizations.find(
    (item) => item.workOrderId === workOrder?.id && ["approved", "committed"].includes(item.status),
  );
  const comparisonAmount = authorization?.amountCents ?? approvedQuote?.amountCents ?? workOrder?.nteCents;
  const duplicate = platformData.invoices.some(
    (candidate) => candidate.id !== invoice.id && candidate.vendorId === invoice.vendorId && candidate.number === invoice.number,
  );
  const vendorMatches = workOrder?.vendorId === invoice.vendorId;
  const amountOver = comparisonAmount !== undefined && invoice.totalCents > comparisonAmount;
  const workLooksComplete = workOrder ? completeStatuses.has(workOrder.status) : false;
  const needsReview = !workOrder || !vendorMatches || duplicate || amountOver || !visits.length || !workLooksComplete;
  const signals: InvoiceReview["signals"] = [
    { label: workOrder ? `Linked to ${workOrder.number}` : "Work order not linked", state: workOrder ? "good" : "review" },
    { label: vendorMatches ? "Vendor matches work order" : "Vendor does not match", state: vendorMatches ? "good" : "review" },
    { label: visits.length ? `${visits.length} QR visit${visits.length === 1 ? "" : "s"} recorded` : "No QR visit recorded", state: visits.length ? "good" : "neutral" },
    { label: workLooksComplete ? "Work has a completed status" : "Work is not marked complete", state: workLooksComplete ? "good" : "review" },
    { label: duplicate ? "Possible duplicate invoice number" : "Invoice number is unique", state: duplicate ? "review" : "good" },
    {
      label: comparisonAmount === undefined
        ? "No approval amount to compare"
        : amountOver
          ? `${formatCurrency(invoice.totalCents - comparisonAmount)} above recorded approval`
          : `${formatCurrency(comparisonAmount - invoice.totalCents)} at or below recorded approval`,
      state: amountOver ? "review" : comparisonAmount === undefined ? "neutral" : "good",
    },
  ];
  return {
    invoice,
    workOrder,
    status: needsReview ? "review" : "matched",
    headline: needsReview ? "Quick review suggested" : "Records align",
    signals,
  };
}

function ApSafeguardPreview({ selectedVendorId }: { selectedVendorId: string }) {
  const invoiceReviews = platformData.invoices
    .filter((invoice) => selectedVendorId === "all" || invoice.vendorId === selectedVendorId)
    .map(reviewInvoice)
    .sort((a, b) => b.invoice.issuedAt.localeCompare(a.invoice.issuedAt));
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoiceReviews[0]?.invoice.id ?? "");
  const [apFilter, setApFilter] = useState<"all" | "matched" | "review">("all");
  const visibleInvoiceReviews = invoiceReviews.filter((review) => apFilter === "all" || review.status === apFilter);
  const selectedReview = visibleInvoiceReviews.find((review) => review.invoice.id === selectedInvoiceId) ?? visibleInvoiceReviews[0];
  const [stagingOpen, setStagingOpen] = useState(false);
  const [stagedFile, setStagedFile] = useState("");
  const [stagedWorkOrderId, setStagedWorkOrderId] = useState("");
  const [stagedPreview, setStagedPreview] = useState(false);
  const availableWork = platformData.workOrders.filter(
    (workOrder) =>
      workOrder.vendorId &&
      workOrder.assignmentType !== "internal" &&
      (selectedVendorId === "all" || workOrder.vendorId === selectedVendorId),
  );
  const matchedCount = invoiceReviews.filter((review) => review.status === "matched").length;

  function fileChanged(event: ChangeEvent<HTMLInputElement>) {
    setStagedFile(event.target.files?.[0]?.name ?? "");
    setStagedPreview(false);
  }

  return (
    <div className="vv-ap" role="tabpanel">
      <section className="vv-ap-banner">
        <div>
          <span className="vv-eyebrow">Optional AP safeguard</span>
          <h2>Connect the invoice to the maintenance record before payment.</h2>
          <p>
            This is an evidence check, not accounting software and not an automatic payment decision. The customer
            can upload an invoice, link one or more work orders and review factual differences.
          </p>
        </div>
        <button type="button" className="vv-upload-button" onClick={() => { setStagingOpen((current) => !current); setStagedPreview(false); }}>
          <Upload /> {stagingOpen ? "Close upload preview" : "Upload invoice"}
        </button>
      </section>

      {stagingOpen && (
        <section className="vv-upload-staging">
          <div className="vv-section-heading"><div><span>Demo Mode</span><h3>Stage an invoice for review</h3><p>The file stays in this browser preview and is not saved.</p></div></div>
          <div className="vv-upload-fields">
            <label className="vv-file-field"><span>Invoice file</span><input type="file" accept=".pdf,image/*" onChange={fileChanged} /><small>{stagedFile || "PDF or image"}</small></label>
            <label><span>Connect to work order</span><select value={stagedWorkOrderId} onChange={(event) => { setStagedWorkOrderId(event.target.value); setStagedPreview(false); }}><option value="">Choose a work order</option><option value="unmatched">I don&apos;t see the work order</option>{availableWork.map((workOrder) => <option key={workOrder.id} value={workOrder.id}>{workOrder.number} · {workOrder.title} · {storeLabel(workOrder)}</option>)}</select></label>
            <button type="button" disabled={!stagedFile || !stagedWorkOrderId} onClick={() => setStagedPreview(true)}><FileSearch />Preview record check</button>
          </div>
          {stagedPreview && (
            <div className={stagedWorkOrderId === "unmatched" ? "vv-staged-result vv-staged-review" : "vv-staged-result"}>
              {stagedWorkOrderId === "unmatched" ? <AlertCircle /> : <CheckCircle2 />}
              <div><strong>{stagedWorkOrderId === "unmatched" ? "Work order not linked" : "Ready for line-item review"}</strong><p>{stagedWorkOrderId === "unmatched" ? "The invoice can still be saved to an unlinked review queue. AP is not blocked." : "The system can now compare vendor, store, visits, status and recorded approval."}</p></div>
            </div>
          )}
        </section>
      )}

      <section className="vv-ap-metrics" aria-label="Invoice review summary">
        <button type="button" aria-pressed={apFilter === "all"} onClick={() => { setApFilter("all"); setSelectedInvoiceId(""); }}><span><FileCheck2 /></span><div><strong>{invoiceReviews.length}</strong><small>Uploaded invoices</small></div></button>
        <button type="button" aria-pressed={apFilter === "matched"} onClick={() => { setApFilter("matched"); setSelectedInvoiceId(""); }}><span><CheckCircle2 /></span><div><strong>{matchedCount}</strong><small>Records align</small></div></button>
        <button type="button" aria-pressed={apFilter === "review"} onClick={() => { setApFilter("review"); setSelectedInvoiceId(""); }}><span><AlertCircle /></span><div><strong>{invoiceReviews.length - matchedCount}</strong><small>Quick review suggested</small></div></button>
        <button type="button" aria-pressed={apFilter === "all"} onClick={() => { setApFilter("all"); setSelectedInvoiceId(""); }}><span><CircleDollarSign /></span><div><strong>{formatCurrency(invoiceReviews.reduce((total, item) => total + item.invoice.totalCents, 0), true)}</strong><small>Invoice value in view</small></div></button>
      </section>

      <section className="vv-ap-layout">
        <div className="vv-invoice-list">
          <div className="vv-panel-heading"><div><span>Source invoices</span><h3>{apFilter === "all" ? "Invoice review queue" : apFilter === "matched" ? "Invoices whose records align" : "Invoices suggested for review"}</h3></div><b>{visibleInvoiceReviews.length} records</b></div>
          {visibleInvoiceReviews.map((review) => (
            <button
              type="button"
              key={review.invoice.id}
              className={selectedReview?.invoice.id === review.invoice.id ? "vv-invoice-row vv-invoice-row-active" : "vv-invoice-row"}
              onClick={() => setSelectedInvoiceId(review.invoice.id)}
            >
              <span className={review.status === "matched" ? "vv-invoice-icon vv-invoice-good" : "vv-invoice-icon vv-invoice-review"}>{review.status === "matched" ? <CheckCircle2 /> : <AlertCircle />}</span>
              <span><strong>{review.invoice.number}</strong><small>{vendorName(review.invoice.vendorId)} · {review.workOrder?.number ?? "Not linked"} · {formatDate(review.invoice.issuedAt)}</small></span>
              <span><b>{formatCurrency(review.invoice.totalCents)}</b><em>{review.headline}</em></span>
              <ChevronRight />
            </button>
          ))}
          {!visibleInvoiceReviews.length && <div className="vv-empty"><FileCheck2 /><strong>No invoices in this view</strong><p>Choose another summary, service partner or upload an invoice.</p></div>}
        </div>

        {selectedReview && (
          <aside className="vv-invoice-detail">
            <header>
              <div><span>{selectedReview.invoice.number}</span><h3>{selectedReview.headline}</h3><p>{vendorName(selectedReview.invoice.vendorId)} · {formatCurrency(selectedReview.invoice.totalCents)}</p></div>
              <StatusPill value={selectedReview.status === "matched" ? "Records align" : "Review"} tone={selectedReview.status === "matched" ? "good" : "warning"} />
            </header>
            <div className="vv-signal-list">
              {selectedReview.signals.map((signal) => (
                <div key={signal.label} className={`vv-signal vv-signal-${signal.state}`}>
                  {signal.state === "good" ? <CheckCircle2 /> : signal.state === "review" ? <AlertCircle /> : <MessageSquareText />}
                  <span>{signal.label}</span>
                </div>
              ))}
            </div>
            {selectedReview.workOrder && (
              <div className="vv-ap-work-link">
                <div><strong>{selectedReview.workOrder.number} · {selectedReview.workOrder.title}</strong><small>{storeLabel(selectedReview.workOrder)} · {workVisits(selectedReview.workOrder.id).length} visits</small></div>
                <Link href={`/work-orders/${selectedReview.workOrder.id}`}>Open source record <ArrowRight /></Link>
              </div>
            )}
            <p className="vv-data-note"><ShieldCheck /> These signals support a human review. They do not approve, reject or pay the invoice.</p>
          </aside>
        )}
      </section>
    </div>
  );
}
