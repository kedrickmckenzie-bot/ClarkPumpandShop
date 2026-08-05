"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileQuestion,
  Inbox,
  Mail,
  MapPin,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  PlatformBadge,
  PlatformBreadcrumbs,
  PlatformEmpty,
  PlatformPageHeader,
  PlatformSectionHeader,
  PlatformStat,
} from "@/components/platform-ui";
import Link from "@/components/site-link";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  isOpenWorkOrder,
  median,
  pmCompliance,
  workOrderSpend,
} from "@/lib/domain/analytics";
import type { Technician, WorkOrder } from "@/lib/domain/types";
import { PLATFORM_NOW, platformData } from "@/lib/platform/data";
import { priorityLabel, statusTone, workOrderStatusLabel } from "@/lib/presentation";

const INTERNAL_PROVIDER_ID = "internal-maintenance";
const PROVIDER_PAGE_SIZE = 12;
const PORTAL_VENDOR_ID = "vendor-northstar";

type ProviderKind = "internal" | "vendor";

type ProviderRecord = {
  id: string;
  name: string;
  shortName: string;
  kind: ProviderKind;
  trade: string;
  email?: string;
  accent: string;
  technicians: Technician[];
};

type PortalResponse = "accepted" | "declined" | "clarification";

type AccountabilityRow = {
  id: string;
  workOrder: WorkOrder;
  reason: string;
  action: string;
  accountableParty: string;
  dueAt?: string;
  escalation: string;
};

const internalTrades = Array.from(new Set(platformData.technicians.flatMap((technician) => technician.trades))).sort();

const providerCatalog: ProviderRecord[] = [
  {
    id: INTERNAL_PROVIDER_ID,
    name: "Clark's Internal Maintenance",
    shortName: "Internal Maintenance",
    kind: "internal",
    trade: internalTrades.join(", "),
    accent: "#0d6a5c",
    technicians: platformData.technicians,
  },
  ...platformData.vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    shortName: vendor.shortName,
    kind: "vendor" as const,
    trade: vendor.trade,
    email: vendor.dispatchEmail,
    accent: vendor.accent,
    technicians: [],
  })),
];

function workBelongsToProvider(workOrder: WorkOrder, provider: ProviderRecord) {
  if (provider.kind === "vendor") return workOrder.vendorId === provider.id;
  return workOrder.assignmentType === "internal" || provider.technicians.some((technician) => technician.id === workOrder.assignedToId);
}

function workForProvider(provider: ProviderRecord) {
  return platformData.workOrders.filter((workOrder) => workBelongsToProvider(workOrder, provider));
}

function hoursBetween(start: string, end: string) {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
}

function formatDuration(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

function providerMetrics(provider: ProviderRecord) {
  const workOrders = workForProvider(provider);
  const workOrderIds = new Set(workOrders.map((workOrder) => workOrder.id));
  const openWork = workOrders.filter(isOpenWorkOrder);
  const responses = provider.kind === "vendor"
    ? platformData.vendorResponses.filter((response) => response.vendorId === provider.id && workOrderIds.has(response.workOrderId))
    : [];
  const visits = platformData.visits.filter((visit) => workOrderIds.has(visit.workOrderId) && (provider.kind === "internal" || visit.vendorId === provider.id));
  const responseHours = responses.map((response) => hoursBetween(response.issuedAt, response.respondedAt));
  const decisionResponses = responses.filter((response) => response.response === "accepted" || response.response === "declined");
  const acceptedResponses = decisionResponses.filter((response) => response.response === "accepted");
  const evidencePoints = visits.flatMap((visit) => [visit.checkIn, ...(visit.checkOut ? [visit.checkOut] : [])]);
  const verifiedEvidence = evidencePoints.filter((evidence) => evidence.state === "verified");
  const completedOutcomes = visits.filter((visit) => Boolean(visit.checkedOutAt && visit.outcome));
  const resolvedOutcomes = completedOutcomes.filter((visit) => visit.outcome === "resolved" || visit.outcome === "no_issue_found");
  const firstVisitTargetResults = workOrders.flatMap((workOrder) => {
    if (!workOrder.targetResponseAt) return [];
    const firstVisit = visits
      .filter((visit) => visit.workOrderId === workOrder.id)
      .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt))[0];
    return firstVisit ? [firstVisit.checkedInAt <= workOrder.targetResponseAt] : [];
  });
  const openFollowUps = platformData.followUps.filter((followUp) => followUp.status === "open" && workOrderIds.has(followUp.workOrderId));
  const invoiceReview = platformData.invoices.filter((invoice) => workOrderIds.has(invoice.workOrderId) && ["submitted", "review"].includes(invoice.status));
  const providerPm = provider.kind === "vendor" ? pmCompliance(platformData, { vendorId: provider.id }, PLATFORM_NOW) : undefined;
  const stores = new Set(workOrders.map((workOrder) => workOrder.storeId));
  const overdue = openWork.filter((workOrder) => workOrder.dueAt && new Date(workOrder.dueAt) < new Date(PLATFORM_NOW));
  const invoiceValue = workOrders.reduce((sum, workOrder) => sum + workOrderSpend(platformData, workOrder.id), 0);
  const exposure = openWork.reduce((sum, workOrder) => sum + workOrder.costExposureCents, 0);
  const assetClassified = workOrders.filter((workOrder) => Boolean(workOrder.assetId)).length;

  return {
    workOrders,
    openWork,
    responses,
    visits,
    stores,
    overdue,
    openFollowUps,
    invoiceReview,
    pendingAcceptance: openWork.filter((workOrder) => workOrder.vendorAcceptance === "pending" || workOrder.vendorAcceptance === "clarification"),
    pendingVerification: openWork.filter((workOrder) => workOrder.status === "completed_pending_verification"),
    responseMedianHours: responseHours.length ? median(responseHours) : undefined,
    responseObservationCount: responseHours.length,
    acceptanceRate: decisionResponses.length ? acceptedResponses.length / decisionResponses.length : undefined,
    acceptanceObservationCount: decisionResponses.length,
    evidenceRate: evidencePoints.length ? verifiedEvidence.length / evidencePoints.length : undefined,
    evidenceObservationCount: evidencePoints.length,
    resolvedOutcomeRate: completedOutcomes.length ? resolvedOutcomes.length / completedOutcomes.length : undefined,
    outcomeObservationCount: completedOutcomes.length,
    checkInTargetRate: firstVisitTargetResults.length ? firstVisitTargetResults.filter(Boolean).length / firstVisitTargetResults.length : undefined,
    checkInTargetCount: firstVisitTargetResults.length,
    providerPm,
    invoiceValue,
    exposure,
    assetCoverage: workOrders.length ? assetClassified / workOrders.length : 0,
    assetClassified,
  };
}

function providerForId(providerId: string) {
  return providerCatalog.find((provider) => provider.id === providerId);
}

function providerForWorkOrder(workOrder: WorkOrder) {
  if (workOrder.vendorId) return providerForId(workOrder.vendorId);
  if (workOrder.assignmentType === "internal") return providerForId(INTERNAL_PROVIDER_ID);
  return undefined;
}

function providerTone(workOrder: WorkOrder) {
  if (workOrder.priority === "critical") return "critical" as const;
  if (workOrder.priority === "high") return "warning" as const;
  return "neutral" as const;
}

function storeLabel(workOrder: WorkOrder) {
  const store = platformData.stores.find((candidate) => candidate.id === workOrder.storeId);
  return store ? `Store ${store.code} · ${store.city}` : workOrder.storeId;
}

function classificationLabel(workOrder: WorkOrder) {
  const category = platformData.categories.find((candidate) => candidate.id === workOrder.categoryId);
  const system = platformData.systems.find((candidate) => candidate.id === workOrder.systemId);
  const asset = platformData.assets.find((candidate) => candidate.id === workOrder.assetId);
  return {
    primary: asset?.name ?? system?.name ?? category?.name ?? "Store only",
    depth: asset ? "Asset classified" : system ? "Cost center classified" : category ? "Category classified" : "Store only",
  };
}

export function ProviderDirectory() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | ProviderKind>("all");
  const visibleProviders = useMemo(() => {
    const search = query.trim().toLowerCase();
    return providerCatalog.filter((provider) => {
      const matchesKind = kind === "all" || provider.kind === kind;
      const matchesSearch = !search || `${provider.name} ${provider.shortName} ${provider.trade} ${provider.email ?? ""} ${provider.technicians.map((technician) => technician.name).join(" ")}`.toLowerCase().includes(search);
      return matchesKind && matchesSearch;
    });
  }, [kind, query]);
  const assignedOpen = platformData.workOrders.filter((workOrder) => isOpenWorkOrder(workOrder) && (workOrder.vendorId || workOrder.assignmentType === "internal"));
  const pendingAcceptance = assignedOpen.filter((workOrder) => workOrder.vendorAcceptance === "pending" || workOrder.vendorAcceptance === "clarification");

  return (
    <AppShell>
      <div className="pf-page provider-page">
        <PlatformBreadcrumbs items={[{ label: "Operations", href: "/" }, { label: "Providers" }]} />
        <PlatformPageHeader
          eyebrow="Service network"
          title="Providers"
          description="Run internal maintenance and outside service partners from one accountable work-order network without forcing vendors into a new dispatch system."
        >
          <Link className="pf-button pf-button-primary" href="/work-orders/new"><Plus />Create work order</Link>
          <Link className="pf-button" href="/accountability"><AlertTriangle />Open accountability</Link>
        </PlatformPageHeader>

        <section className="provider-stat-grid" aria-label="Provider network summary">
          <PlatformStat label="Service sources" value={String(providerCatalog.length)} note={`${platformData.vendors.length} outside firms + 1 internal team`} icon={Building2} href="#provider-directory" />
          <PlatformStat label="Internal maintainers" value={String(platformData.technicians.length)} note={`${platformData.technicians.filter((technician) => technician.status === "available").length} currently marked available`} icon={Wrench} href={`/providers/${INTERNAL_PROVIDER_ID}`} tone="info" />
          <PlatformStat label="Open assigned work" value={String(assignedOpen.length)} note={`${new Set(assignedOpen.map((workOrder) => workOrder.storeId)).size} stores represented`} icon={Inbox} href="#provider-open-work" />
          <PlatformStat label="Response needed" value={String(pendingAcceptance.length)} note="Accept, decline or clarification is still due" icon={MessageSquareText} href="/accountability#provider-queue-response" tone={pendingAcceptance.length ? "warning" : "positive"} />
        </section>

        <section className="provider-channel-model" aria-labelledby="provider-channel-title">
          <PlatformSectionHeader title="Meet each service partner where they work" description="The Clark's work order remains the permanent record while every participant gets the lightest useful interaction." />
          <div className="provider-channel-steps" id="provider-channel-title">
            <article className="provider-channel-step"><span><Mail /></span><div><strong>Email + secure response link</strong><p>Outside vendor offices can accept, decline or request clarification without creating an account.</p></div></article>
            <article className="provider-channel-step"><span><ShieldCheck /></span><div><strong>Optional vendor workspace</strong><p>Frequent partners can see only their assigned Clark&apos;s work orders, shared files and required responses.</p></div></article>
            <article className="provider-channel-step"><span><MapPin /></span><div><strong>Store QR for field evidence</strong><p>A technician enters a name, checks in, records one outcome and checks out. No roster or route management is added.</p></div></article>
          </div>
        </section>

        <section className="provider-directory-panel" id="provider-directory">
          <PlatformSectionHeader title="Provider directory" description="Search internal capability and approved outside firms by name, trade or contact." />
          <div className="provider-filter-bar">
            <label className="provider-search-field"><span>Search providers</span><div><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, trade, email or internal technician" /></div></label>
            <label className="provider-select-field"><span>Provider type</span><select value={kind} onChange={(event) => setKind(event.target.value as "all" | ProviderKind)}><option value="all">All service sources</option><option value="internal">Internal maintenance</option><option value="vendor">Outside vendors</option></select></label>
            <span className="provider-filter-result">{visibleProviders.length} of {providerCatalog.length} providers</span>
          </div>
          <div className="provider-table-wrap">
            <table className="provider-table">
              <thead><tr><th>Provider</th><th>Operating channel</th><th>Coverage</th><th>Current accountability</th><th>Observed response</th><th aria-label="Open provider" /></tr></thead>
              <tbody>
                {visibleProviders.map((provider) => {
                  const metrics = providerMetrics(provider);
                  return (
                    <tr key={provider.id}>
                      <td><div className="provider-identity"><i style={{ backgroundColor: provider.accent }}>{provider.shortName.slice(0, 2).toUpperCase()}</i><span><Link href={`/providers/${provider.id}`}>{provider.name}</Link><small>{provider.trade}</small></span></div></td>
                      <td><PlatformBadge tone={provider.kind === "internal" ? "info" : "purple"}>{provider.kind === "internal" ? "Internal team" : "Outside vendor"}</PlatformBadge><span className="provider-table-note">{provider.kind === "internal" ? "Assigned work queue" : "Email + secure link"}</span></td>
                      <td><strong>{metrics.stores.size} stores</strong><span className="provider-table-note">{metrics.workOrders.length} work orders on record</span></td>
                      <td><Link className="provider-accountability-link" href={`/providers/${provider.id}#provider-open-work`}><strong>{metrics.openWork.length} open</strong><span>{metrics.overdue.length} past due · {metrics.pendingAcceptance.length} awaiting response</span></Link></td>
                      <td>{provider.kind === "vendor" && metrics.responseMedianHours !== undefined ? <><strong>{formatDuration(metrics.responseMedianHours)}</strong><span className="provider-table-note">median · {metrics.responseObservationCount} recorded responses</span></> : <><strong>{provider.technicians.length} people</strong><span className="provider-table-note">{provider.technicians.filter((technician) => technician.status === "available").length} available</span></>}</td>
                      <td><Link className="provider-row-open" href={`/providers/${provider.id}`} aria-label={`Open ${provider.name}`}><ArrowRight /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibleProviders.length && <PlatformEmpty icon={Search} title="No providers match" description="Try a company name, technician, trade or dispatch email." />}
          </div>
        </section>

        <section className="provider-directory-panel" id="provider-open-work">
          <PlatformSectionHeader title="Network work requiring attention" description="The most urgent open provider work, linked back to Clark's internal maintenance record." href="/accountability" linkLabel="Open every exception" />
          <ProviderWorkRows workOrders={assignedOpen.sort(providerWorkSort).slice(0, 12)} />
        </section>
      </div>
    </AppShell>
  );
}

export function ProviderDetail({ providerId }: { providerId: string }) {
  const provider = providerForId(providerId);
  if (!provider) {
    return (
      <AppShell><div className="pf-page provider-page"><PlatformBreadcrumbs items={[{ label: "Providers", href: "/providers" }, { label: "Not found" }]} /><PlatformEmpty icon={Building2} title="Provider not found" description="This provider is not part of the current organization's service network." action={<Link className="pf-button" href="/providers">Return to providers</Link>} /></div></AppShell>
    );
  }

  const metrics = providerMetrics(provider);
  const exceptions = providerExceptionRows(provider);
  const latestWork = [...metrics.workOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return (
    <AppShell>
      <div className="pf-page provider-page">
        <PlatformBreadcrumbs items={[{ label: "Providers", href: "/providers" }, { label: provider.name }]} />
        <PlatformPageHeader
          eyebrow={provider.kind === "internal" ? "Internal service team" : "Outside service partner"}
          title={provider.name}
          description={`${provider.trade}. Performance shown here comes only from Clark's work-order, response, visit, PM and invoice records.`}
        >
          {provider.email && <a className="pf-button" href={`mailto:${provider.email}`}><Mail />Email dispatch</a>}
          {provider.kind === "vendor" && <Link className="pf-button" href="/vendor-portal"><ShieldCheck />Preview vendor view</Link>}
          <Link className="pf-button pf-button-primary" href={provider.kind === "internal" ? "/work-orders/new?assignment=internal" : `/work-orders/new?assignment=vendor&providerId=${provider.id}`}><Plus />Create assigned work</Link>
        </PlatformPageHeader>

        <section className="provider-profile-band">
          <div className="provider-profile-identity"><i style={{ backgroundColor: provider.accent }}>{provider.shortName.slice(0, 2).toUpperCase()}</i><div><PlatformBadge tone={provider.kind === "internal" ? "info" : "purple"}>{provider.kind === "internal" ? "Internal maintenance" : "Approved vendor"}</PlatformBadge><h2>{provider.shortName}</h2><p>{provider.trade}</p></div></div>
          <div className="provider-profile-facts">
            <span><small>Primary channel</small><strong>{provider.kind === "internal" ? "Assigned work queue" : provider.email}</strong></span>
            <span><small>Stores with recorded work</small><strong>{metrics.stores.size}</strong></span>
            <span><small>Latest work-order activity</small><strong>{latestWork ? formatDate(latestWork.createdAt) : "No activity"}</strong></span>
          </div>
          <div className="provider-profile-channels">
            {provider.kind === "vendor" ? <><span><Mail />No-login email response</span><span><ShieldCheck />Optional portal</span><span><MapPin />Store QR visit flow</span></> : <><span><Inbox />Assigned queue</span><span><UsersRound />Named internal assignee</span><span><ClipboardCheck />Checklist and closeout</span></>}
          </div>
        </section>

        <section className="provider-stat-grid" aria-label={`${provider.name} summary`}>
          <PlatformStat label="Open work orders" value={String(metrics.openWork.length)} note={`${metrics.stores.size} stores across the full record`} icon={Inbox} href="#provider-open-work" />
          <PlatformStat label="Past target" value={String(metrics.overdue.length)} note={`${metrics.pendingAcceptance.length} also await a provider response`} icon={AlertTriangle} href="#provider-exceptions" tone={metrics.overdue.length ? "critical" : "positive"} />
          <PlatformStat label="Open exposure" value={formatCurrency(metrics.exposure, true)} note={`${formatCurrency(metrics.invoiceValue, true)} invoiced value on linked work`} icon={CircleDollarSign} href="#provider-open-work" tone="info" />
          <PlatformStat label="Asset classification" value={formatPercent(metrics.assetCoverage)} note={`${metrics.assetClassified} of ${metrics.workOrders.length} work orders reach asset level`} icon={Wrench} href="#provider-open-work" />
        </section>

        <div className="provider-detail-grid">
          <section className="provider-panel provider-performance-panel">
            <PlatformSectionHeader title="Observable service measures" description="No dispatch, en-route or inferred technician metrics are used." />
            <div className="provider-measure-list">
              {provider.kind === "vendor" && <ProviderMeasure label="Response time" value={metrics.responseMedianHours === undefined ? "No observations" : formatDuration(metrics.responseMedianHours)} detail={`Median from ${metrics.responseObservationCount} issued and responded timestamps`} href="#provider-open-work" />}
              {provider.kind === "vendor" && <ProviderMeasure label="Recorded acceptance" value={metrics.acceptanceRate === undefined ? "No decisions" : formatPercent(metrics.acceptanceRate)} detail={`${metrics.acceptanceObservationCount} accept or decline response events`} href="#provider-open-work" />}
              <ProviderMeasure label="Check-in by response target" value={metrics.checkInTargetRate === undefined ? "No paired records" : formatPercent(metrics.checkInTargetRate)} detail={`${metrics.checkInTargetCount} work orders with both target and first check-in`} href="#provider-open-work" />
              <ProviderMeasure label="Verified location evidence" value={metrics.evidenceRate === undefined ? "No visit evidence" : formatPercent(metrics.evidenceRate)} detail={`${metrics.evidenceObservationCount} check-in and checkout evidence points`} href="#provider-open-work" />
              <ProviderMeasure label="Resolved visit outcomes" value={metrics.resolvedOutcomeRate === undefined ? "No visit outcomes" : formatPercent(metrics.resolvedOutcomeRate)} detail={`${metrics.outcomeObservationCount} completed visit outcomes`} href="#provider-open-work" />
              {metrics.providerPm && <ProviderMeasure label="Verified PM compliance" value={formatPercent(metrics.providerPm.value)} detail={`${metrics.providerPm.numerator} on-time verified occurrences of ${metrics.providerPm.denominator} due`} href={`/pm?provider=${provider.id}`} />}
            </div>
          </section>

          <section className="provider-panel" id="provider-exceptions">
            <PlatformSectionHeader title="Exceptions requiring action" description="Each item retains its accountable party, next action, due date and escalation path." />
            <div className="provider-exception-list">
              {exceptions.slice(0, 8).map((item) => <ProviderExceptionRow item={item} key={item.id} />)}
              {!exceptions.length && <PlatformEmpty icon={CheckCircle2} title="No open provider exceptions" description="There are no overdue, response, follow-up, verification, evidence or invoice-review records for this provider." />}
            </div>
            {exceptions.length > 8 && <Link className="provider-panel-link" href={`/accountability?providerId=${provider.id}`}>View all {exceptions.length} supporting exceptions<ArrowRight /></Link>}
          </section>

          {provider.kind === "internal" ? (
            <section className="provider-panel provider-roster-panel">
              <PlatformSectionHeader title="Internal team" description="One person may carry several trades; assignments remain on the work order." href="/my-work" linkLabel="Open technician work" />
              <div className="provider-roster-list">
                {provider.technicians.map((technician) => <article className="provider-roster-row" key={technician.id}><i>{technician.name.split(" ").map((part) => part[0]).join("")}</i><span><strong>{technician.name}</strong><small>{technician.title} · {technician.trades.join(", ")}</small></span><PlatformBadge tone={technician.status === "available" ? "good" : technician.status === "assigned" ? "info" : "neutral"}>{technician.status.replaceAll("_", " ")}</PlatformBadge></article>)}
              </div>
            </section>
          ) : (
            <section className="provider-panel provider-access-panel">
              <PlatformSectionHeader title="Low-friction access" description="The vendor can use one channel or combine them; Clark's still retains the canonical record." />
              <div className="provider-access-list">
                <a href={`mailto:${provider.email}`}><span><Mail /></span><div><strong>Email dispatch</strong><small>{provider.email}</small></div><ArrowRight /></a>
                <Link href="/vendor-portal"><span><ShieldCheck /></span><div><strong>Optional vendor workspace</strong><small>Only this firm&apos;s assigned work and shared records</small></div><ArrowRight /></Link>
                <div className="provider-access-static"><span><MapPin /></span><div><strong>Technician store QR</strong><small>Entered name, check-in, one outcome and checkout</small></div></div>
              </div>
            </section>
          )}
        </div>

        <section className="provider-directory-panel" id="provider-open-work">
          <PlatformSectionHeader title="Linked work-order record" description="Current work and history remain on Clark's internal work order; this table is the support for the measures above." />
          <ProviderWorkTable provider={provider} workOrders={metrics.workOrders} />
        </section>
      </div>
    </AppShell>
  );
}

function ProviderMeasure({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return <Link className="provider-measure" href={href}><span><strong>{label}</strong><small>{detail}</small></span><b>{value}</b><ArrowRight /></Link>;
}

function providerExceptionRows(provider: ProviderRecord): AccountabilityRow[] {
  const metrics = providerMetrics(provider);
  const rows = new Map<string, AccountabilityRow>();
  function add(workOrder: WorkOrder, reason: string, action = workOrder.nextAction, suffix = reason) {
    const key = `${workOrder.id}-${suffix}`;
    rows.set(key, { id: key, workOrder, reason, action, accountableParty: workOrder.accountableParty, dueAt: workOrder.dueAt, escalation: workOrder.escalation });
  }
  metrics.overdue.forEach((workOrder) => add(workOrder, "Completion target is past due", workOrder.nextAction, "overdue"));
  metrics.pendingAcceptance.forEach((workOrder) => add(workOrder, workOrder.vendorAcceptance === "clarification" ? "Vendor requested clarification" : "Provider response is pending", workOrder.nextAction, "response"));
  metrics.openFollowUps.forEach((followUp) => {
    const workOrder = metrics.workOrders.find((candidate) => candidate.id === followUp.workOrderId);
    if (workOrder) rows.set(`${workOrder.id}-follow-up-${followUp.id}`, { id: `${workOrder.id}-follow-up-${followUp.id}`, workOrder, reason: "Required follow-up remains open", action: followUp.nextAction, accountableParty: followUp.accountableParty, dueAt: followUp.dueAt, escalation: followUp.escalation });
  });
  metrics.pendingVerification.forEach((workOrder) => add(workOrder, "Completion verification is pending", workOrder.nextAction, "verification"));
  metrics.invoiceReview.forEach((invoice) => {
    const workOrder = metrics.workOrders.find((candidate) => candidate.id === invoice.workOrderId);
    if (workOrder) add(workOrder, `Invoice ${invoice.number} requires review`, `Review ${formatCurrency(invoice.totalCents)} invoice package`, `invoice-${invoice.id}`);
  });
  metrics.visits.filter((visit) => visit.checkIn.state !== "verified" || (visit.checkOut && visit.checkOut.state !== "verified")).forEach((visit) => {
    const workOrder = metrics.workOrders.find((candidate) => candidate.id === visit.workOrderId);
    if (workOrder) add(workOrder, "Visit location evidence has an exception", "Review check-in and checkout evidence", `visit-${visit.id}`);
  });
  return [...rows.values()].sort(accountabilitySort);
}

function ProviderExceptionRow({ item }: { item: AccountabilityRow }) {
  return (
    <Link className="provider-exception-row" href={`/work-orders/${item.workOrder.id}`}>
      <span className={`provider-exception-marker provider-exception-${item.workOrder.priority}`} />
      <span className="provider-exception-copy"><strong>{item.reason}</strong><small>{item.workOrder.number} · {storeLabel(item.workOrder)} · {item.action}</small></span>
      <span className="provider-exception-control"><strong>{item.accountableParty}</strong><small>{item.dueAt ? `Due ${formatDate(item.dueAt, true)}` : "No due date"}</small></span>
      <ArrowRight />
    </Link>
  );
}

function ProviderWorkTable({ provider, workOrders }: { provider: ProviderRecord; workOrders: WorkOrder[] }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"open" | "all">("open");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return [...workOrders].filter((workOrder) => {
      const store = platformData.stores.find((candidate) => candidate.id === workOrder.storeId);
      const classification = classificationLabel(workOrder);
      const haystack = `${workOrder.number} ${workOrder.title} ${workOrder.description} ${store?.code ?? ""} ${store?.address1 ?? ""} ${store?.city ?? ""} ${classification.primary}`.toLowerCase();
      return (scope === "all" || isOpenWorkOrder(workOrder)) && (!search || haystack.includes(search));
    }).sort(providerWorkSort);
  }, [query, scope, workOrders]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PROVIDER_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PROVIDER_PAGE_SIZE, safePage * PROVIDER_PAGE_SIZE);
  function resetPage() { setPage(1); }

  return (
    <>
      <div className="provider-filter-bar">
        <label className="provider-search-field"><span>Search this provider&apos;s work</span><div><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Work order, store, address, scope or asset" /></div></label>
        <label className="provider-select-field"><span>Record scope</span><select value={scope} onChange={(event) => { setScope(event.target.value as "open" | "all"); resetPage(); }}><option value="open">Open work</option><option value="all">Open + history</option></select></label>
        <span className="provider-filter-result">{filtered.length} records · page {safePage} of {pageCount}</span>
      </div>
      <ProviderWorkRows workOrders={visible} />
      {!visible.length && <PlatformEmpty icon={Inbox} title="No matching work orders" description={`No ${provider.shortName} records match the current search and scope.`} />}
      {filtered.length > PROVIDER_PAGE_SIZE && <nav className="provider-pagination" aria-label="Provider work-order pages"><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span>Page {safePage} of {pageCount}</span><button type="button" disabled={safePage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next</button></nav>}
    </>
  );
}

function ProviderWorkRows({ workOrders }: { workOrders: WorkOrder[] }) {
  return (
    <div className="provider-table-wrap">
      <table className="provider-table provider-work-table">
        <thead><tr><th>Work order</th><th>Store</th><th>Classification</th><th>Priority / status</th><th>Accountable next action</th><th>Due</th><th>Exposure</th></tr></thead>
        <tbody>
          {workOrders.map((workOrder) => {
            const store = platformData.stores.find((candidate) => candidate.id === workOrder.storeId);
            const classification = classificationLabel(workOrder);
            return (
              <tr key={workOrder.id}>
                <td><Link className="provider-work-link" href={`/work-orders/${workOrder.id}`}>{workOrder.number}</Link><span className="provider-table-note">{workOrder.title}</span></td>
                <td><Link className="provider-work-link" href={`/stores/${workOrder.storeId}`}>{storeLabel(workOrder)}</Link><span className="provider-table-note">{store?.address1}</span></td>
                <td><strong>{classification.primary}</strong><span className="provider-table-note">{classification.depth}</span></td>
                <td><div className="provider-badge-stack"><PlatformBadge tone={providerTone(workOrder)}>{priorityLabel[workOrder.priority]}</PlatformBadge><PlatformBadge tone={statusTone(workOrder.status) === "exception" ? "critical" : statusTone(workOrder.status) === "pending" ? "warning" : statusTone(workOrder.status) === "active" ? "info" : statusTone(workOrder.status) === "closed" ? "good" : "neutral"}>{workOrderStatusLabel[workOrder.status]}</PlatformBadge></div></td>
                <td><strong>{workOrder.accountableParty}</strong><span className="provider-table-note">{workOrder.nextAction} · escalate to {workOrder.escalation}</span></td>
                <td>{workOrder.dueAt ? <><strong>{formatDate(workOrder.dueAt, true)}</strong>{isOpenWorkOrder(workOrder) && new Date(workOrder.dueAt) < new Date(PLATFORM_NOW) && <span className="provider-overdue-note">Past due</span>}</> : <span className="provider-table-note">No due date</span>}</td>
                <td><strong>{formatCurrency(workOrder.costExposureCents)}</strong><span className="provider-table-note">NTE {formatCurrency(workOrder.nteCents)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function providerWorkSort(a: WorkOrder, b: WorkOrder) {
  const openDifference = Number(isOpenWorkOrder(b)) - Number(isOpenWorkOrder(a));
  if (openDifference) return openDifference;
  const priorityRank = { critical: 0, high: 1, routine: 2, low: 3 };
  const priorityDifference = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityDifference) return priorityDifference;
  return (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || b.createdAt.localeCompare(a.createdAt);
}

function accountabilitySort(a: AccountabilityRow, b: AccountabilityRow) {
  return providerWorkSort(a.workOrder, b.workOrder) || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
}

function buildAccountabilityQueues() {
  const openWork = platformData.workOrders.filter(isOpenWorkOrder);
  const overdue: AccountabilityRow[] = openWork.filter((workOrder) => workOrder.dueAt && new Date(workOrder.dueAt) < new Date(PLATFORM_NOW)).map((workOrder) => ({ id: `overdue-${workOrder.id}`, workOrder, reason: "Completion target is past due", action: workOrder.nextAction, accountableParty: workOrder.accountableParty, dueAt: workOrder.dueAt, escalation: workOrder.escalation }));
  const providerResponse: AccountabilityRow[] = openWork.filter((workOrder) => workOrder.vendorAcceptance === "pending" || workOrder.vendorAcceptance === "clarification").map((workOrder) => ({ id: `response-${workOrder.id}`, workOrder, reason: workOrder.vendorAcceptance === "clarification" ? "Provider requested clarification" : "Provider response has not been recorded", action: workOrder.nextAction, accountableParty: workOrder.accountableParty, dueAt: workOrder.dueAt, escalation: workOrder.escalation }));
  const followUp: AccountabilityRow[] = platformData.followUps.filter((item) => item.status === "open").flatMap((item) => {
    const workOrder = platformData.workOrders.find((candidate) => candidate.id === item.workOrderId);
    return workOrder ? [{ id: `followup-${item.id}`, workOrder, reason: "Required follow-up remains open", action: item.nextAction, accountableParty: item.accountableParty, dueAt: item.dueAt, escalation: item.escalation }] : [];
  });
  const verificationMap = new Map<string, AccountabilityRow>();
  openWork.filter((workOrder) => workOrder.status === "completed_pending_verification").forEach((workOrder) => verificationMap.set(`verification-${workOrder.id}`, { id: `verification-${workOrder.id}`, workOrder, reason: "Completion verification is pending", action: workOrder.nextAction, accountableParty: workOrder.accountableParty, dueAt: workOrder.dueAt, escalation: workOrder.escalation }));
  platformData.visits.filter((visit) => visit.checkIn.state !== "verified" || (visit.checkOut && visit.checkOut.state !== "verified")).forEach((visit) => {
    const workOrder = platformData.workOrders.find((candidate) => candidate.id === visit.workOrderId);
    if (workOrder) verificationMap.set(`evidence-${visit.id}`, { id: `evidence-${visit.id}`, workOrder, reason: "Visit location evidence needs review", action: "Review the captured accuracy, distance and verification result", accountableParty: workOrder.accountableParty, dueAt: workOrder.dueAt, escalation: workOrder.escalation });
  });
  const financialMap = new Map<string, AccountabilityRow>();
  openWork.filter((workOrder) => ["waiting_on_quote", "waiting_on_approval", "completed_pending_invoice"].includes(workOrder.status)).forEach((workOrder) => financialMap.set(`financial-${workOrder.id}`, { id: `financial-${workOrder.id}`, workOrder, reason: workOrderStatusLabel[workOrder.status], action: workOrder.nextAction, accountableParty: workOrder.accountableParty, dueAt: workOrder.dueAt, escalation: workOrder.escalation }));
  platformData.invoices.filter((invoice) => invoice.status === "submitted" || invoice.status === "review").forEach((invoice) => {
    const workOrder = platformData.workOrders.find((candidate) => candidate.id === invoice.workOrderId);
    if (workOrder) financialMap.set(`invoice-${invoice.id}`, { id: `invoice-${invoice.id}`, workOrder, reason: `Invoice ${invoice.number} is ${invoice.status}`, action: `Review ${formatCurrency(invoice.totalCents)} invoice and allocation`, accountableParty: workOrder.accountableParty, dueAt: workOrder.dueAt, escalation: workOrder.escalation });
  });
  const controlGaps: AccountabilityRow[] = openWork.filter((workOrder) => !workOrder.accountableParty || !workOrder.nextAction || !workOrder.dueAt || !workOrder.escalation).map((workOrder) => ({ id: `control-${workOrder.id}`, workOrder, reason: "Required control field is missing", action: "Assign accountability, next action, due date and escalation", accountableParty: workOrder.accountableParty || "Unassigned", dueAt: workOrder.dueAt, escalation: workOrder.escalation || "Not set" }));

  return {
    overdue: overdue.sort(accountabilitySort),
    providerResponse: providerResponse.sort(accountabilitySort),
    followUp: followUp.sort(accountabilitySort),
    verification: [...verificationMap.values()].sort(accountabilitySort),
    financial: [...financialMap.values()].sort(accountabilitySort),
    controlGaps: controlGaps.sort(accountabilitySort),
  };
}

export function AccountabilityCenter({ initialStoreScope = "", initialQueueScope = "", initialProviderScope = "" }: { initialStoreScope?: string; initialQueueScope?: string; initialProviderScope?: string }) {
  const [storeScope] = useState(initialStoreScope);
  const [queueScope] = useState(initialQueueScope);
  const [providerScope] = useState(initialProviderScope);
  const allQueues = buildAccountabilityQueues();
  const scoped = (rows: AccountabilityRow[]) => rows.filter((item) => (!storeScope || item.workOrder.storeId === storeScope) && (!providerScope || (providerScope === INTERNAL_PROVIDER_ID ? item.workOrder.assignmentType === "internal" || item.workOrder.assignmentType === "blended" : item.workOrder.vendorId === providerScope)));
  const queues = {
    overdue: scoped(allQueues.overdue),
    providerResponse: scoped(allQueues.providerResponse),
    followUp: scoped(allQueues.followUp),
    verification: scoped(allQueues.verification),
    financial: scoped(allQueues.financial),
    controlGaps: scoped(allQueues.controlGaps),
  };
  const queueKey = ({ acceptance: "providerResponse", response: "providerResponse", followup: "followUp", verification: "verification", financial: "financial", control: "controlGaps", overdue: "overdue" } as Record<string, keyof typeof queues>)[queueScope];
  const showQueue = (key: keyof typeof queues) => !queueKey || queueKey === key;
  const scopedStore = platformData.stores.find((store) => store.id === storeScope);
  const scopedProvider = providerForId(providerScope);
  const actionableWorkOrders = new Set(Object.values(queues).flat().map((item) => item.workOrder.id));
  const criticalWorkOrders = new Set(Object.values(queues).flat().filter((item) => item.workOrder.priority === "critical").map((item) => item.workOrder.id));

  return (
    <AppShell>
      <div className="pf-page provider-page">
        <PlatformBreadcrumbs items={[{ label: "Operations", href: "/" }, { label: "Accountability" }]} />
        <PlatformPageHeader eyebrow="Exception control" title="Accountability center" description="Recover unresolved work through named ownership, an explicit next action, a retained due date and a visible escalation path.">
          <Link className="pf-button" href="/providers"><UsersRound />Provider network</Link>
          <Link className="pf-button pf-button-primary" href="/work-orders/new"><Plus />Create work order</Link>
        </PlatformPageHeader>

        {(storeScope || queueKey || providerScope) && <section className="work-scope-filter"><span>Accountability scope</span>{scopedStore && <strong>Store {scopedStore.code} · {scopedStore.city}</strong>}{scopedProvider && <strong>{scopedProvider.shortName}</strong>}{queueKey && <strong>{queueScope.replaceAll("-", " ")}</strong>}<Link href="/accountability">Clear scope</Link></section>}

        <section className="provider-accountability-brief">
          <div><span className="provider-live-label"><span />As of {formatDate(PLATFORM_NOW, true)}</span><h2>{actionableWorkOrders.size} work orders have at least one open control exception.</h2><p>Queues may overlap because one work order can be overdue and also need a provider response, follow-up, verification or financial action.</p></div>
          <div className="provider-accountability-signal"><strong>{criticalWorkOrders.size}</strong><span>critical-priority work orders represented</span></div>
        </section>

        <section className="provider-stat-grid" aria-label="Accountability queue summary">
          <PlatformStat label="Past target" value={String(queues.overdue.length)} note="Open work beyond its retained due date" icon={Clock3} href="#provider-queue-overdue" tone={queues.overdue.length ? "critical" : "positive"} />
          <PlatformStat label="Provider response" value={String(queues.providerResponse.length)} note="Accept, decline or clarification remains due" icon={MessageSquareText} href="#provider-queue-response" tone={queues.providerResponse.length ? "warning" : "positive"} />
          <PlatformStat label="Open follow-ups" value={String(queues.followUp.length)} note="Required unresolved-outcome controls" icon={FileQuestion} href="#provider-queue-followup" tone={queues.followUp.length ? "warning" : "positive"} />
          <PlatformStat label="Verification / evidence" value={String(queues.verification.length)} note="Completion or location evidence needs review" icon={ShieldCheck} href="#provider-queue-verification" tone={queues.verification.length ? "warning" : "positive"} />
          <PlatformStat label="Quote / invoice control" value={String(queues.financial.length)} note="Financial stage requires the next action" icon={CircleDollarSign} href="#provider-queue-financial" />
          <PlatformStat label="Missing control fields" value={String(queues.controlGaps.length)} note="Accountability, action, due date or escalation" icon={AlertTriangle} href="#provider-queue-control" tone={queues.controlGaps.length ? "critical" : "positive"} />
        </section>

        <div className="provider-queue-stack">
          {showQueue("overdue") && <AccountabilityQueue id="provider-queue-overdue" title="Past target" description="Overdue work remains visible until resolved; the original due date is preserved here." rows={queues.overdue} />}
          {showQueue("providerResponse") && <AccountabilityQueue id="provider-queue-response" title="Provider response required" description="Outside vendor office action is limited to accept, decline or request clarification." rows={queues.providerResponse} />}
          {showQueue("followUp") && <AccountabilityQueue id="provider-queue-followup" title="Unresolved outcome follow-up" description="A non-terminal technician outcome creates follow-through on the same internal work order." rows={queues.followUp} />}
          {showQueue("verification") && <AccountabilityQueue id="provider-queue-verification" title="Completion and location evidence review" description="Exceptions stay visibly unverified; captured accuracy, distance and timestamps remain attached to the visit." rows={queues.verification} />}
          {showQueue("financial") && <AccountabilityQueue id="provider-queue-financial" title="Quote, approval and invoice control" description="Quote, approved, committed and invoice stages remain distinct and tied to the work order." rows={queues.financial} />}
          {showQueue("controlGaps") && <AccountabilityQueue id="provider-queue-control" title="Missing accountability controls" description="Every non-terminal record must identify the accountable party, next action, due date and escalation destination." rows={queues.controlGaps} />}
        </div>
      </div>
    </AppShell>
  );
}

function AccountabilityQueue({ id, title, description, rows }: { id: string; title: string; description: string; rows: AccountabilityRow[] }) {
  return (
    <section className="provider-directory-panel provider-accountability-queue" id={id}>
      <PlatformSectionHeader title={title} description={description}><PlatformBadge tone={rows.length ? "warning" : "good"}>{rows.length} records</PlatformBadge></PlatformSectionHeader>
      {rows.length ? (
        <div className="provider-table-wrap">
          <table className="provider-table provider-accountability-table">
            <thead><tr><th>Work order / reason</th><th>Store</th><th>Service source</th><th>Accountable next action</th><th>Due</th><th>Escalation</th></tr></thead>
            <tbody>{rows.map((item) => { const source = providerForWorkOrder(item.workOrder); return <tr key={item.id}><td><Link className="provider-work-link" href={`/work-orders/${item.workOrder.id}`}>{item.workOrder.number}</Link><span className="provider-table-note">{item.reason} · {item.workOrder.title}</span></td><td><Link className="provider-work-link" href={`/stores/${item.workOrder.storeId}`}>{storeLabel(item.workOrder)}</Link></td><td>{source ? <Link className="provider-work-link" href={`/providers/${source.id}`}>{source.shortName}</Link> : <span className="provider-table-note">Unassigned</span>}<span className="provider-table-note">{item.workOrder.assignmentType?.replaceAll("_", " ") ?? "assignment not set"}</span></td><td><strong>{item.accountableParty}</strong><span className="provider-table-note">{item.action}</span></td><td>{item.dueAt ? <strong>{formatDate(item.dueAt, true)}</strong> : <span className="provider-overdue-note">Missing</span>}</td><td>{item.escalation}</td></tr>; })}</tbody>
          </table>
        </div>
      ) : <PlatformEmpty icon={CheckCircle2} title="Queue is clear" description="No work orders currently meet this exception rule." />}
    </section>
  );
}

export function VendorPortalDemo() {
  const vendor = platformData.vendors.find((candidate) => candidate.id === PORTAL_VENDOR_ID) ?? platformData.vendors[0];
  const vendorWork = platformData.workOrders.filter((workOrder) => workOrder.vendorId === vendor.id && isOpenWorkOrder(workOrder)).sort(providerWorkSort);
  const initialWorkOrder = vendorWork.find((workOrder) => workOrder.vendorAcceptance === "pending") ?? vendorWork[0];
  const [selectedId, setSelectedId] = useState(initialWorkOrder?.id ?? "");
  const [choice, setChoice] = useState<PortalResponse | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState<Record<string, PortalResponse>>({});
  const selected = vendorWork.find((workOrder) => workOrder.id === selectedId) ?? initialWorkOrder;
  const selectedStore = selected ? platformData.stores.find((store) => store.id === selected.storeId) : undefined;
  const sharedDocuments = selected ? platformData.documents.filter((document) => document.workOrderId === selected.id && document.visibility === "vendor_shared") : [];
  const pendingCount = vendorWork.filter((workOrder) => !submitted[workOrder.id] && (workOrder.vendorAcceptance === "pending" || workOrder.vendorAcceptance === "clarification")).length;

  function chooseWork(workOrderId: string) {
    setSelectedId(workOrderId);
    setChoice(null);
    setNote("");
  }

  function submitResponse() {
    if (!selected || !choice || (choice !== "accepted" && !note.trim())) return;
    setSubmitted((current) => ({ ...current, [selected.id]: choice }));
    setChoice(null);
    setNote("");
  }

  return (
    <main className="provider-portal-shell">
      <header className="provider-portal-header"><div className="provider-portal-brand"><span><Building2 /></span><div><strong>Clark&apos;s Operations</strong><small>Service partner workspace</small></div></div><div className="provider-portal-account"><span>Demo Mode</span><div><strong>{vendor.shortName}</strong><small>{vendor.dispatchEmail}</small></div></div></header>
      <div className="provider-portal-frame">
        <section className="provider-portal-intro"><div><PlatformBadge tone="purple">Optional vendor workspace</PlatformBadge><h1>Work assigned to {vendor.shortName}</h1><p>This view is limited to this firm&apos;s Clark&apos;s work orders and vendor-shared records. Email response links remain available; using this workspace is optional.</p></div><a className="provider-portal-email" href={`mailto:${vendor.dispatchEmail}`}><Mail />Email Clark&apos;s facilities</a></section>

        <section className="provider-portal-summary" aria-label="Vendor work summary">
          <article><span><Inbox /></span><div><strong>{vendorWork.length}</strong><small>Open work orders</small></div></article>
          <article><span><MessageSquareText /></span><div><strong>{pendingCount}</strong><small>Responses required</small></div></article>
          <article><span><AlertTriangle /></span><div><strong>{vendorWork.filter((workOrder) => workOrder.dueAt && new Date(workOrder.dueAt) < new Date(PLATFORM_NOW)).length}</strong><small>Past Clark&apos;s target</small></div></article>
        </section>

        {selected ? (
          <div className="provider-portal-layout">
            <aside className="provider-portal-queue">
              <header><div><span>Assigned work</span><strong>{vendorWork.length} open</strong></div><small>Ordered by priority and Clark&apos;s target</small></header>
              <div className="provider-portal-work-list">{vendorWork.map((workOrder) => { const localResponse = submitted[workOrder.id]; return <button className={`provider-portal-work ${selected.id === workOrder.id ? "provider-portal-work-active" : ""}`} type="button" key={workOrder.id} onClick={() => chooseWork(workOrder.id)}><span><strong>{workOrder.number}</strong><PlatformBadge tone={providerTone(workOrder)}>{priorityLabel[workOrder.priority]}</PlatformBadge></span><b>{workOrder.title}</b><small>{storeLabel(workOrder)}</small><em>{localResponse ? `Demo response: ${localResponse}` : workOrderStatusLabel[workOrder.status]}</em></button>; })}</div>
            </aside>

            <article className="provider-portal-workspace">
              <header className="provider-portal-work-head"><div><span>{selected.number}</span><h2>{selected.title}</h2><p>{storeLabel(selected)}</p></div><div><PlatformBadge tone={providerTone(selected)}>{priorityLabel[selected.priority]}</PlatformBadge><PlatformBadge tone={statusTone(selected.status) === "exception" ? "critical" : statusTone(selected.status) === "pending" ? "warning" : statusTone(selected.status) === "active" ? "info" : "neutral"}>{workOrderStatusLabel[selected.status]}</PlatformBadge></div></header>

              <section className="provider-portal-scope"><h3>Requested scope</h3><p>{selected.description}</p><dl><div><dt>Store</dt><dd>{selectedStore ? `${selectedStore.name}, ${selectedStore.address1}, ${selectedStore.city}, ${selectedStore.state} ${selectedStore.postalCode}` : selected.storeId}</dd></div><div><dt>Requested service</dt><dd>{selected.requestedServiceAt ? formatDate(selected.requestedServiceAt, true) : formatDate(selected.createdAt, true)}</dd></div><div><dt>Clark&apos;s target</dt><dd>{selected.targetCompletionAt ? formatDate(selected.targetCompletionAt, true) : selected.dueAt ? formatDate(selected.dueAt, true) : "Not set"}</dd></div><div><dt>Not to exceed</dt><dd>{formatCurrency(selected.nteCents)}</dd></div><div><dt>Access</dt><dd>{selected.accessInstructions ?? "Confirm access with the store contact."}</dd></div></dl></section>

              {(selected.vendorAcceptance === "pending" || selected.vendorAcceptance === "clarification") && !submitted[selected.id] ? (
                <section className="provider-portal-response"><h3>Response required</h3><p>Choose one office action. Technician scheduling and dispatch stay in {vendor.shortName}&apos;s own system.</p><div className="provider-portal-response-options"><button type="button" className={choice === "accepted" ? "provider-portal-choice-active" : ""} onClick={() => setChoice("accepted")}><CheckCircle2 /><strong>Accept</strong><small>We will dispatch internally</small></button><button type="button" className={choice === "clarification" ? "provider-portal-choice-active" : ""} onClick={() => setChoice("clarification")}><FileQuestion /><strong>Clarification</strong><small>Ask Clark&apos;s a scope question</small></button><button type="button" className={choice === "declined" ? "provider-portal-choice-active" : ""} onClick={() => setChoice("declined")}><AlertTriangle /><strong>Decline</strong><small>Clark&apos;s retains next action</small></button></div>{choice && choice !== "accepted" && <label className="provider-portal-note"><span>{choice === "clarification" ? "Question for Clark's" : "Reason for declining"}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Give Clark's enough information to take the next action." /></label>}<button className="provider-portal-submit" type="button" disabled={!choice || (choice !== "accepted" && !note.trim())} onClick={submitResponse}>Submit response</button><small className="provider-portal-demo-note">Demo Mode: this preview changes only this screen. Production responses append to the work-order audit trail.</small></section>
              ) : (
                <section className="provider-portal-response provider-portal-response-complete"><CheckCircle2 /><div><h3>{submitted[selected.id] ? `Demo response: ${submitted[selected.id].replaceAll("_", " ")}` : "No office response required"}</h3><p>{submitted[selected.id] === "accepted" || selected.vendorAcceptance === "accepted" ? "Use your own dispatch workflow. The field technician checks in from the store QR and does not need an account." : "Clark's Facilities retains accountability for the next action."}</p></div></section>
              )}

              <section className="provider-portal-field-flow"><PlatformSectionHeader title="Technician handoff" description="The minimum field flow after the vendor office accepts the work." /><ol><li><span>1</span><div><strong>Scan the store QR</strong><small>The QR uses an opaque, purpose-bound token.</small></div></li><li><span>2</span><div><strong>Select this accepted work order</strong><small>The technician enters a name; no account or Clark&apos;s schedule is required.</small></div></li><li><span>3</span><div><strong>Check in, record one outcome, check out</strong><small>Location is captured only at check-in and checkout.</small></div></li></ol></section>

              <section className="provider-portal-documents"><PlatformSectionHeader title="Shared records" description="Only files explicitly shared with this vendor are visible." />{sharedDocuments.length ? <div>{sharedDocuments.map((document) => <a href={document.href} key={document.id}><ClipboardCheck /><span><strong>{document.name}</strong><small>{document.classification.replaceAll("_", " ")} · uploaded {formatDate(document.uploadedAt)}</small></span><ArrowRight /></a>)}</div> : <PlatformEmpty icon={ClipboardCheck} title="No shared files" description="No vendor-visible documents are attached to this work order." />}</section>
            </article>
          </div>
        ) : <PlatformEmpty icon={CheckCircle2} title="No open assigned work" description="This vendor has no open Clark's work orders in the demo data." />}
      </div>
    </main>
  );
}
