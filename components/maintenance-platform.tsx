"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileQuestion,
  FileText,
  Inbox,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Package,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  PlatformBadge,
  PlatformBreadcrumbs,
  PlatformEmpty,
  PlatformPageHeader,
  PlatformProgress,
  PlatformSectionHeader,
  PlatformStat,
} from "@/components/platform-ui";
import Link from "@/components/site-link";
import {
  allocationTotals,
  formatCurrency,
  formatDate,
  formatPercent,
  isOpenWorkOrder,
  pmCompliance,
  workOrderSpend,
} from "@/lib/domain/analytics";
import type {
  EmployeeReport,
  LaborEntry,
  PartUsage,
  PmOccurrence,
  PmPlan,
  WorkOrder,
  WorkOrderChecklistItem,
  WorkOrderNote,
  WorkOrderStatus,
} from "@/lib/domain/types";
import { PLATFORM_NOW, platformData } from "@/lib/platform/data";
import {
  priorityLabel,
  statusTone,
  verificationLabel,
  visitOutcomeLabel,
  workOrderStatusLabel,
} from "@/lib/presentation";

const PAGE_SIZE = 20;
const NOW = new Date(PLATFORM_NOW);

type RegistryRecord = Record<string, unknown>;

type RegistryContext = {
  store?: RegistryRecord;
  system?: RegistryRecord;
  asset?: RegistryRecord;
  component?: RegistryRecord;
  reports?: RegistryRecord[];
};

type StatusActivity = {
  id: string;
  priorStatus?: string;
  newStatus: string;
  reason: string;
  actorName: string;
  occurredAt: string;
};

type ActivityData = {
  notes: WorkOrderNote[];
  labor: LaborEntry[];
  parts: PartUsage[];
  checklist: WorkOrderChecklistItem[];
  statuses: StatusActivity[];
};

const emptyActivity: ActivityData = { notes: [], labor: [], parts: [], checklist: [], statuses: [] };

function badgeToneForStatus(status: WorkOrderStatus) {
  const tone = statusTone(status);
  if (tone === "exception") return "critical" as const;
  if (tone === "pending") return "warning" as const;
  if (tone === "active") return "info" as const;
  if (tone === "closed") return "good" as const;
  return "neutral" as const;
}

function priorityTone(priority: WorkOrder["priority"]) {
  if (priority === "critical") return "critical" as const;
  if (priority === "high") return "warning" as const;
  return "neutral" as const;
}

function workStore(workOrder: WorkOrder) {
  return platformData.stores.find((store) => store.id === workOrder.storeId);
}

function workCategory(workOrder: WorkOrder) {
  return platformData.categories.find((category) => category.id === workOrder.categoryId);
}

function workSystem(workOrder: WorkOrder) {
  return platformData.systems.find((system) => system.id === workOrder.systemId);
}

function workAsset(workOrder: WorkOrder) {
  return platformData.assets.find((asset) => asset.id === workOrder.assetId);
}

function workComponent(workOrder: WorkOrder) {
  return platformData.components.find((component) => component.id === workOrder.componentId);
}

function workProviderName(workOrder: WorkOrder) {
  const vendor = platformData.vendors.find((candidate) => candidate.id === workOrder.vendorId);
  if (workOrder.assignmentType === "blended") return workOrder.assignedToName ?? `${vendor?.shortName ?? "Vendor"} + internal`;
  if (workOrder.assignmentType === "internal") return workOrder.assignedToName ?? workOrder.accountableParty;
  return vendor?.name ?? workOrder.assignedToName ?? "Unassigned";
}

function workStoreLabel(workOrder: WorkOrder) {
  const store = workStore(workOrder);
  return store ? `Store ${store.code} · ${store.city}` : workOrder.storeId;
}

function classificationDepth(workOrder: WorkOrder) {
  if (workOrder.componentId) return "Component";
  if (workOrder.assetId) return "Asset";
  if (workOrder.systemId) return "Cost center";
  if (workOrder.categoryId) return "Category";
  return "Store";
}

function isOverdue(workOrder: WorkOrder) {
  return isOpenWorkOrder(workOrder) && Boolean(workOrder.dueAt && new Date(workOrder.dueAt) < NOW);
}

function managerSort(a: WorkOrder, b: WorkOrder) {
  const priorityRank = { critical: 0, high: 1, routine: 2, low: 3 };
  return priorityRank[a.priority] - priorityRank[b.priority]
    || Number(isOverdue(b)) - Number(isOverdue(a))
    || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")
    || b.createdAt.localeCompare(a.createdAt);
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]) {
  return [...new Map([...primary, ...secondary].map((item) => [item.id, item])).values()];
}

function stringValue(record: RegistryRecord, key: string, fallback = "") {
  const value = record[key];
  return value === null || value === undefined ? fallback : String(value);
}

function numberValue(record: RegistryRecord, key: string, fallback = 0) {
  const value = Number(record[key]);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRegistryWorkOrder(record: RegistryRecord): WorkOrder {
  return {
    id: stringValue(record, "id"),
    number: stringValue(record, "number", "New work order"),
    title: stringValue(record, "title", "Untitled maintenance work"),
    description: stringValue(record, "description", "No scope description was provided."),
    location: stringValue(record, "location"),
    problemCode: stringValue(record, "problemCode"),
    requestedBy: stringValue(record, "requestedBy", "Operations"),
    origin: (stringValue(record, "origin", "facilities") as WorkOrder["origin"]),
    storeId: stringValue(record, "storeId"),
    categoryId: stringValue(record, "categoryId"),
    systemId: stringValue(record, "systemId") || undefined,
    assetId: stringValue(record, "assetId") || undefined,
    componentId: stringValue(record, "componentId") || undefined,
    priority: (stringValue(record, "priority", "routine") as WorkOrder["priority"]),
    workType: (stringValue(record, "workType", "reactive") as WorkOrder["workType"]),
    status: (stringValue(record, "status", "approved") as WorkOrderStatus),
    accountableParty: stringValue(record, "accountableParty", "Maintenance Dispatch"),
    assignmentType: (stringValue(record, "assignmentType", "unassigned") as WorkOrder["assignmentType"]),
    assignedToId: stringValue(record, "assignedToId") || undefined,
    assignedToName: stringValue(record, "assignedToName") || undefined,
    nextAction: stringValue(record, "nextAction", "Review and assign the next action"),
    dueAt: stringValue(record, "dueAt") || undefined,
    escalation: stringValue(record, "escalation", "Maintenance Supervisor"),
    vendorId: stringValue(record, "vendorId") || undefined,
    vendorAcceptance: (stringValue(record, "vendorAcceptance", "not_issued") as WorkOrder["vendorAcceptance"]),
    createdAt: stringValue(record, "createdAt", PLATFORM_NOW),
    targetCompletionAt: stringValue(record, "dueAt") || undefined,
    estimatedHours: numberValue(record, "estimatedMinutes") / 60 || numberValue(record, "estimatedHours"),
    safetyRisk: (stringValue(record, "safetyRisk", "low") as WorkOrder["safetyRisk"]),
    accessInstructions: stringValue(record, "accessInstructions"),
    closedAt: stringValue(record, "closedAt") || undefined,
    nteCents: numberValue(record, "nteCents"),
    costExposureCents: numberValue(record, "costExposureCents"),
    reportIds: stringValue(record, "reportIds").split(",").filter(Boolean),
  };
}

function normalizeRegistryPmPlan(record: RegistryRecord): PmPlan {
  const targetType = stringValue(record, "targetType", stringValue(record, "scopeType", "system")) as PmPlan["targetType"];
  const targetId = stringValue(record, "targetId");
  const targetLabel = stringValue(record, "targetLabel") || (targetType === "asset"
    ? platformData.assets.find((asset) => asset.id === targetId)?.name
    : platformData.systems.find((system) => system.id === targetId)?.name);
  return {
    id: stringValue(record, "id"),
    name: stringValue(record, "name", "Preventive maintenance plan"),
    categoryId: stringValue(record, "categoryId"),
    scopeLabel: targetLabel ?? "Configured maintenance target",
    targetType,
    targetId,
    frequency: stringValue(record, "frequency", "quarterly") as PmPlan["frequency"],
    earlyWindowDays: numberValue(record, "earlyWindowDays", 15),
    lateWindowDays: numberValue(record, "lateWindowDays", 15),
    vendorId: stringValue(record, "vendorId"),
    requiredDocument: stringValue(record, "requiredDocument", "Completed checklist and service evidence"),
    active: Boolean(record.active),
  };
}

function normalizeRegistryPmOccurrence(record: RegistryRecord): PmOccurrence | null {
  const id = stringValue(record, "occurrenceId");
  if (!id) return null;
  const targetType = stringValue(record, "targetType");
  const targetId = stringValue(record, "targetId");
  return {
    id,
    planId: stringValue(record, "id"),
    storeId: stringValue(record, "occurrenceStoreId"),
    systemId: targetType === "system" ? targetId : undefined,
    assetId: targetType === "asset" ? targetId : undefined,
    dueAt: stringValue(record, "occurrenceDueAt", PLATFORM_NOW),
    windowStart: stringValue(record, "occurrenceWindowStart", PLATFORM_NOW),
    windowEnd: stringValue(record, "occurrenceWindowEnd", PLATFORM_NOW),
    completedAt: stringValue(record, "occurrenceCompletedAt") || undefined,
    status: stringValue(record, "occurrenceStatus", "scheduled") as PmOccurrence["status"],
    workOrderId: stringValue(record, "occurrenceWorkOrderId") || undefined,
    verified: Boolean(record.occurrenceVerified),
    waiverReason: stringValue(record, "occurrenceWaiverReason") || undefined,
  };
}

async function registryRecords(entity: string) {
  const response = await fetch(`/api/registry?entity=${entity}`);
  const result = await response.json() as { ok?: boolean; records?: RegistryRecord[] };
  return result.ok ? result.records ?? [] : [];
}

function normalizeActivity(raw: RegistryRecord, workOrderId: string): ActivityData {
  const notes = Array.isArray(raw.notes) ? raw.notes.map((item) => {
    const record = item as RegistryRecord;
    return { id: stringValue(record, "id"), workOrderId, author: stringValue(record, "author"), authorRole: stringValue(record, "authorRole"), body: stringValue(record, "body"), visibility: stringValue(record, "visibility", "internal") as WorkOrderNote["visibility"], createdAt: stringValue(record, "createdAt", PLATFORM_NOW) };
  }) : [];
  const labor = Array.isArray(raw.labor) ? raw.labor.map((item) => {
    const record = item as RegistryRecord;
    return { id: stringValue(record, "id"), workOrderId, technicianId: stringValue(record, "technicianId"), technicianName: stringValue(record, "technicianName"), startedAt: stringValue(record, "startedAt", PLATFORM_NOW), endedAt: stringValue(record, "endedAt", PLATFORM_NOW), regularHours: numberValue(record, "regularMinutes") / 60, overtimeHours: numberValue(record, "overtimeMinutes") / 60, hourlyRateCents: numberValue(record, "hourlyRateCents"), notes: stringValue(record, "notes") };
  }) : [];
  const parts = Array.isArray(raw.parts) ? raw.parts.map((item) => {
    const record = item as RegistryRecord;
    return { id: stringValue(record, "id"), workOrderId, partNumber: stringValue(record, "partNumber"), description: stringValue(record, "description"), quantity: numberValue(record, "quantityMilli") / 1000, unitCostCents: numberValue(record, "unitCostCents"), source: stringValue(record, "source", "purchased") as PartUsage["source"], recordedBy: stringValue(record, "recordedBy"), recordedAt: stringValue(record, "recordedAt", PLATFORM_NOW) };
  }) : [];
  const checklist = Array.isArray(raw.checklist) ? raw.checklist.map((item) => {
    const record = item as RegistryRecord;
    return { id: stringValue(record, "id"), workOrderId, sequence: numberValue(record, "sequence"), label: stringValue(record, "label"), required: Boolean(record.required), completed: Boolean(record.completed), completedAt: stringValue(record, "completedAt") || undefined, completedBy: stringValue(record, "completedBy") || undefined };
  }) : [];
  const statuses = Array.isArray(raw.statuses) ? raw.statuses.map((item) => {
    const record = item as RegistryRecord;
    return { id: stringValue(record, "id"), priorStatus: stringValue(record, "priorStatus") || undefined, newStatus: stringValue(record, "newStatus"), reason: stringValue(record, "reason"), actorName: stringValue(record, "actorName"), occurredAt: stringValue(record, "occurredAt", PLATFORM_NOW) };
  }) : [];
  return { notes, labor, parts, checklist, statuses };
}

export function MaintenanceCenter() {
  const openWork = platformData.workOrders.filter(isOpenWorkOrder);
  const overdue = openWork.filter(isOverdue);
  const needsDecision = openWork.filter((workOrder) => workOrder.assignmentType === "unassigned" || ["draft", "pending_review", "approved", "awaiting_vendor_acceptance"].includes(workOrder.status));
  const inMotion = openWork.filter((workOrder) => ["accepted", "visit_active", "return_visit_scheduled"].includes(workOrder.status));
  const blocked = openWork.filter((workOrder) => ["follow_up_required", "waiting_on_vendor", "waiting_on_quote", "waiting_on_approval", "waiting_on_parts", "reopened"].includes(workOrder.status));
  const closeout = openWork.filter((workOrder) => ["completed_pending_verification", "completed_pending_invoice"].includes(workOrder.status));
  const critical = openWork.filter((workOrder) => workOrder.priority === "critical");
  const overdueFollowUps = platformData.followUps.filter((followUp) => followUp.status === "open" && new Date(followUp.dueAt) < NOW);
  const pmExceptions = platformData.pmOccurrences.filter((occurrence) => occurrence.status === "missed");
  const attention = [...openWork].filter((workOrder) => isOverdue(workOrder) || workOrder.priority === "critical" || !workOrder.accountableParty || !workOrder.nextAction || !workOrder.dueAt || !workOrder.escalation).sort(managerSort);

  return (
    <AppShell>
      <div className="pf-page maintenance-page">
        <PlatformBreadcrumbs items={[{ label: "Work" }, { label: "Overview" }]} />
        <PlatformPageHeader eyebrow="Work overview" title="What needs attention right now?" description="See new issues, urgent work, items waiting on someone, and jobs ready to close. Open any number to see the full work order.">
          <Link className="pf-button" href="/requests"><Inbox />Reported issues</Link>
          <Link className="pf-button pf-button-primary" href="/work-orders/new"><Plus />Start a work order</Link>
        </PlatformPageHeader>

        <section className="maintenance-manager-brief">
          <div><span className="maintenance-live-label"><span />Updated {formatDate(PLATFORM_NOW, true)}</span><h2>{needsDecision.length + blocked.length + closeout.length} items need a manager.</h2><p>Choose a number to see the individual work orders behind it. Internal teams and outside vendors appear in the same view.</p></div>
          <div className="maintenance-brief-signals"><Link href="/work-orders?priority=critical"><strong>{critical.length}</strong><span>urgent</span><ArrowRight /></Link><Link href="/work-orders?queue=overdue"><strong>{overdue.length}</strong><span>past due</span><ArrowRight /></Link><Link href="/pm?status=missed"><strong>{pmExceptions.length}</strong><span>planned visits missed</span><ArrowRight /></Link></div>
        </section>

        <section className="maintenance-stat-grid" aria-label="Maintenance control metrics">
          <PlatformStat label="Needs an owner" value={String(needsDecision.length)} note="Assign a team or vendor, or collect missing details" icon={Inbox} href="/work-orders?view=decision" tone={needsDecision.length ? "warning" : "positive"} />
          <PlatformStat label="Being worked on" value={String(inMotion.length)} note="Accepted, underway, or scheduled for a return visit" icon={Wrench} href="/work-orders?view=in-motion" tone="info" />
          <PlatformStat label="Waiting or blocked" value={String(blocked.length)} note={`${overdueFollowUps.length} follow-ups are already past due`} icon={AlertTriangle} href="/work-orders?view=blocked" tone={blocked.length ? "critical" : "positive"} />
          <PlatformStat label="Ready to review" value={String(closeout.length)} note="Check the completed work or its final bill" icon={ClipboardCheck} href="/work-orders?view=closeout" tone={closeout.length ? "warning" : "positive"} />
        </section>

        <section className="maintenance-panel maintenance-attention-panel">
          <PlatformSectionHeader title="Work needing your attention" description="Urgent and past-due items are listed first. Open one to see the owner, next step, due date, work history, and cost." href="/work-orders" linkLabel="See all work orders" />
          <CompactWorkTable workOrders={attention.slice(0, 15)} />
        </section>
      </div>
    </AppShell>
  );
}

export function WorkOrderDirectory({ initialStatus = "", initialAssignment = "", initialPriority = "", initialCategory = "", initialProvider = "", initialStore = "", initialSystem = "", initialAsset = "", initialComponent = "", initialAcceptance = "", initialView = "" }: { initialStatus?: string; initialAssignment?: string; initialPriority?: string; initialCategory?: string; initialProvider?: string; initialStore?: string; initialSystem?: string; initialAsset?: string; initialComponent?: string; initialAcceptance?: string; initialView?: string }) {
  const [created, setCreated] = useState<WorkOrder[]>([]);
  const [remoteStores, setRemoteStores] = useState<RegistryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus || (initialAsset || initialComponent ? "all" : "open"));
  const [assignment, setAssignment] = useState(initialAssignment);
  const [priority, setPriority] = useState(initialPriority);
  const [category, setCategory] = useState(initialCategory);
  const [region, setRegion] = useState("");
  const [provider, setProvider] = useState(initialProvider);
  const [depth, setDepth] = useState("");
  const [storeScope, setStoreScope] = useState(initialStore);
  const [systemScope, setSystemScope] = useState(initialSystem);
  const [assetScope, setAssetScope] = useState(initialAsset);
  const [componentScope, setComponentScope] = useState(initialComponent);
  const [acceptance, setAcceptance] = useState(initialAcceptance);
  const [view, setView] = useState(initialView);
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([registryRecords("work-orders"), registryRecords("stores")]).then(([workOrders, stores]) => {
      const known = new Set(platformData.workOrders.map((workOrder) => workOrder.id));
      setCreated(workOrders.map(normalizeRegistryWorkOrder).filter((workOrder) => workOrder.id && !known.has(workOrder.id)));
      setRemoteStores(stores);
    }).catch(() => undefined);
  }, []);

  const allWork = useMemo(() => [...platformData.workOrders, ...created], [created]);
  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return [...allWork].filter((workOrder) => {
      const store = workStore(workOrder);
      const remoteStore = remoteStores.find((candidate) => stringValue(candidate, "id") === workOrder.storeId);
      const asset = workAsset(workOrder);
      const system = workSystem(workOrder);
      const categoryItem = workCategory(workOrder);
      const storeRegion = store?.regionId ?? stringValue(remoteStore ?? {}, "regionId");
      const haystack = `${workOrder.number} ${workOrder.title} ${workOrder.description} ${workOrder.location ?? ""} ${workOrder.requestedBy ?? ""} ${workOrder.accountableParty} ${workOrder.assignedToName ?? ""} ${store?.code ?? stringValue(remoteStore ?? {}, "code")} ${store?.name ?? stringValue(remoteStore ?? {}, "name")} ${store?.address1 ?? stringValue(remoteStore ?? {}, "address1")} ${store?.city ?? stringValue(remoteStore ?? {}, "city")} ${asset?.assetTag ?? ""} ${asset?.serial ?? ""} ${system?.name ?? ""} ${categoryItem?.name ?? ""}`.toLowerCase();
      const viewMatches = !view
        || (view === "overdue" && isOverdue(workOrder))
        || (view === "decision" && (workOrder.assignmentType === "unassigned" || ["draft", "pending_review", "approved", "awaiting_vendor_acceptance"].includes(workOrder.status)))
        || (view === "in-motion" && ["accepted", "visit_active", "return_visit_scheduled"].includes(workOrder.status))
        || (view === "blocked" && ["follow_up_required", "waiting_on_vendor", "waiting_on_quote", "waiting_on_approval", "waiting_on_parts", "reopened"].includes(workOrder.status))
        || (view === "closeout" && ["completed_pending_verification", "completed_pending_invoice"].includes(workOrder.status))
        || (view === "missing-action" && (!workOrder.accountableParty || !workOrder.nextAction || !workOrder.dueAt));
      return (!search || haystack.includes(search))
        && (status === "all" || (status === "open" ? isOpenWorkOrder(workOrder) : workOrder.status === status))
        && (!assignment || workOrder.assignmentType === assignment)
        && (!priority || workOrder.priority === priority)
        && (!category || workOrder.categoryId === category)
        && (!region || storeRegion === region)
        && (!provider || workOrder.vendorId === provider || workOrder.assignedToId === provider)
        && (!storeScope || workOrder.storeId === storeScope)
        && (!systemScope || workOrder.systemId === systemScope)
        && (!assetScope || workOrder.assetId === assetScope)
        && (!componentScope || workOrder.componentId === componentScope)
        && (!acceptance || workOrder.vendorAcceptance === acceptance)
        && (!depth || classificationDepth(workOrder).toLowerCase().replace(" ", "-") === depth)
        && viewMatches;
    }).sort((a, b) => Number(isOpenWorkOrder(b)) - Number(isOpenWorkOrder(a)) || managerSort(a, b));
  }, [acceptance, allWork, assetScope, assignment, category, componentScope, depth, priority, provider, query, region, remoteStores, status, storeScope, systemScope, view]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const moreFilterCount = [assignment, category, region, provider, depth].filter(Boolean).length;
  function resetPage() { setPage(1); }
  function clearFilters() { setQuery(""); setStatus("open"); setAssignment(""); setPriority(""); setCategory(""); setRegion(""); setProvider(""); setDepth(""); setStoreScope(""); setSystemScope(""); setAssetScope(""); setComponentScope(""); setAcceptance(""); setView(""); setPage(1); }

  const scopeLabels = [
    storeScope && `Store ${platformData.stores.find((store) => store.id === storeScope)?.code ?? storeScope}`,
    category && platformData.categories.find((item) => item.id === category)?.name,
    systemScope && platformData.systems.find((system) => system.id === systemScope)?.name,
    assetScope && platformData.assets.find((asset) => asset.id === assetScope)?.name,
    componentScope && platformData.components.find((component) => component.id === componentScope)?.name,
    acceptance && `Vendor response: ${acceptance}`,
  ].filter(Boolean) as string[];

  return (
    <AppShell>
      <div className="pf-page maintenance-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Work orders" }]} />
        <PlatformPageHeader eyebrow="Maintenance" title="Work orders" description="Find work by number, store, address, problem, equipment, or assignee. Open a work order to see its full history, costs, files, and next steps.">
          <Link className="pf-button pf-button-primary" href="/work-orders/new"><Plus />Create work order</Link>
        </PlatformPageHeader>

        {scopeLabels.length > 0 && <section className="work-scope-filter"><span>Showing</span>{scopeLabels.map((label) => <strong key={label}>{label}</strong>)}<button type="button" onClick={clearFilters}>Clear this view</button></section>}
        <section className="work-directory-summary"><span><strong>{rows.length}</strong> work orders found</span><span><strong>{rows.filter(isOpenWorkOrder).length}</strong> open</span><span><strong>{rows.filter(isOverdue).length}</strong> past due</span><span><strong>{rows.filter((workOrder) => workOrder.priority === "critical" && isOpenWorkOrder(workOrder)).length}</strong> urgent</span></section>

        <section className="work-filter-panel work-filter-panel-simple">
          <label className="work-search-field"><span>Search</span><div><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} placeholder="Work order, store, address, equipment, or assignee" /></div></label>
          <label className="work-filter-field"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="open">Open work</option><option value="all">All records</option>{Object.entries(workOrderStatusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label className="work-filter-field"><span>Priority</span><select value={priority} onChange={(event) => { setPriority(event.target.value); resetPage(); }}><option value="">All priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="routine">Routine</option><option value="low">Low</option></select></label>
          <details className="work-filter-more" open={moreFilterCount > 0 ? true : undefined}>
            <summary>More filters{moreFilterCount > 0 ? ` (${moreFilterCount} active)` : ""}</summary>
            <div className="work-filter-more-grid">
              <label className="work-filter-field"><span>Assigned to</span><select value={assignment} onChange={(event) => { setAssignment(event.target.value); resetPage(); }}><option value="">Anyone</option><option value="internal">Internal team</option><option value="vendor">Outside vendor</option><option value="blended">Internal team and vendor</option><option value="unassigned">Not assigned</option></select></label>
              <label className="work-filter-field"><span>Type of work</span><select value={category} onChange={(event) => { setCategory(event.target.value); resetPage(); }}><option value="">All types</option>{platformData.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label className="work-filter-field"><span>Region</span><select value={region} onChange={(event) => { setRegion(event.target.value); resetPage(); }}><option value="">All regions</option>{platformData.regions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label className="work-filter-field"><span>Team or vendor</span><select value={provider} onChange={(event) => { setProvider(event.target.value); resetPage(); }}><option value="">All teams and vendors</option><optgroup label="Outside vendors">{platformData.vendors.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup><optgroup label="Internal technicians">{platformData.technicians.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</optgroup></select></label>
              <label className="work-filter-field"><span>Equipment detail</span><select value={depth} onChange={(event) => { setDepth(event.target.value); resetPage(); }}><option value="">Any level</option><option value="store">Store only</option><option value="category">Type of work</option><option value="cost-center">Equipment group</option><option value="asset">Individual equipment</option><option value="component">Component</option></select></label>
            </div>
          </details>
          <div className="work-filter-footer">
            <button className="work-filter-clear" type="button" onClick={clearFilters}>Clear filters</button>
            <span className="work-filter-result">Page {safePage} of {pageCount}</span>
          </div>
        </section>

        <section className="maintenance-panel work-directory-table">
          <WorkOrderTable workOrders={visible} remoteStores={remoteStores} />
          {!visible.length && <PlatformEmpty icon={Search} title="No matching work orders" description="Change a filter or clear the saved view to see more records." action={<button className="pf-button" type="button" onClick={clearFilters}>Clear filters</button>} />}
        </section>
        {rows.length > PAGE_SIZE && <nav className="work-pagination" aria-label="Work-order pages"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>{rows.length} records · page {safePage} of {pageCount}</span><button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></nav>}
      </div>
    </AppShell>
  );
}

function WorkOrderTable({ workOrders, remoteStores = [] }: { workOrders: WorkOrder[]; remoteStores?: RegistryRecord[] }) {
  return <div className="work-table-wrap"><table className="work-table"><thead><tr><th>Work order / store</th><th>Problem</th><th>Assigned to</th><th>Next step / due</th><th>Status</th></tr></thead><tbody>{workOrders.map((workOrder) => {
    const store = workStore(workOrder);
    const remoteStore = remoteStores.find((candidate) => stringValue(candidate, "id") === workOrder.storeId);
    return <tr key={workOrder.id}><td><Link className="work-record-link" href={`/work-orders/${workOrder.id}`}>{workOrder.number}</Link><Link className="work-record-link work-store-link" href={`/stores/${workOrder.storeId}`}>{store ? `Store ${store.code} · ${store.city}` : `Store ${stringValue(remoteStore ?? {}, "code", workOrder.storeId)} · ${stringValue(remoteStore ?? {}, "city")}`}</Link><span className="work-table-note">{store?.address1 ?? stringValue(remoteStore ?? {}, "address1")}</span></td><td><strong>{workOrder.title}</strong><span className="work-table-note">{workOrder.location || "Location not specified"}</span></td><td><strong>{workProviderName(workOrder)}</strong><span className="work-table-note">{workOrder.assignmentType?.replaceAll("_", " ") ?? "not assigned"}{workOrder.vendorId ? ` · ${workOrder.vendorAcceptance.replaceAll("_", " ")}` : ""}</span></td><td><strong>{workOrder.nextAction || "Choose the next step"}</strong><span className="work-table-note">Owner: {workOrder.accountableParty || "Not assigned"}</span>{workOrder.dueAt ? <><span className="work-table-note">Due {formatDate(workOrder.dueAt, true)}</span>{isOverdue(workOrder) && <span className="work-overdue-note">Past due</span>}</> : <span className="work-overdue-note">Due date missing</span>}</td><td><div className="work-badge-stack"><PlatformBadge tone={badgeToneForStatus(workOrder.status)}>{workOrderStatusLabel[workOrder.status] ?? workOrder.status.replaceAll("_", " ")}</PlatformBadge><PlatformBadge tone={priorityTone(workOrder.priority)}>{priorityLabel[workOrder.priority]} priority</PlatformBadge></div></td></tr>;
  })}</tbody></table></div>;
}

function CompactWorkTable({ workOrders }: { workOrders: WorkOrder[] }) {
  return <div className="work-table-wrap"><table className="work-table work-table-compact"><thead><tr><th>Priority</th><th>Work order</th><th>Store / assignment</th><th>Accountable next action</th><th>Due</th></tr></thead><tbody>{workOrders.map((workOrder) => <tr key={workOrder.id}><td><PlatformBadge tone={priorityTone(workOrder.priority)}>{priorityLabel[workOrder.priority]}</PlatformBadge></td><td><Link className="work-record-link" href={`/work-orders/${workOrder.id}`}>{workOrder.number}</Link><span className="work-table-note">{workOrder.title}</span></td><td><strong>{workStoreLabel(workOrder)}</strong><span className="work-table-note">{workProviderName(workOrder)}</span></td><td><strong>{workOrder.accountableParty}</strong><span className="work-table-note">{workOrder.nextAction}</span></td><td>{workOrder.dueAt ? <><strong>{formatDate(workOrder.dueAt, true)}</strong>{isOverdue(workOrder) && <span className="work-overdue-note">Past due</span>}</> : <span className="work-overdue-note">Missing</span>}</td></tr>)}</tbody></table></div>;
}

export function WorkOrderRecord({ workOrderId }: { workOrderId: string }) {
  const seeded = platformData.workOrders.find((workOrder) => workOrder.id === workOrderId);
  const [remoteRecord, setRemoteRecord] = useState<WorkOrder | null | undefined>(undefined);
  const [context, setContext] = useState<RegistryContext>({});
  const [remoteActivity, setRemoteActivity] = useState<ActivityData>(emptyActivity);

  useEffect(() => {
    if (seeded) return;
    Promise.all([
      registryRecords("work-orders"),
      registryRecords("stores"),
      registryRecords("cost-centers"),
      registryRecords("assets"),
      registryRecords("components"),
      registryRecords("requests"),
    ]).then(([workOrders, stores, systems, assets, components, reports]) => {
      const raw = workOrders.find((candidate) => stringValue(candidate, "id") === workOrderId);
      if (!raw) { setRemoteRecord(null); return; }
      const normalized = normalizeRegistryWorkOrder(raw);
      setRemoteRecord(normalized);
      setContext({
        store: stores.find((candidate) => stringValue(candidate, "id") === normalized.storeId),
        system: systems.find((candidate) => stringValue(candidate, "id") === normalized.systemId),
        asset: assets.find((candidate) => stringValue(candidate, "id") === normalized.assetId),
        component: components.find((candidate) => stringValue(candidate, "id") === normalized.componentId),
        reports: reports.filter((candidate) => normalized.reportIds.includes(stringValue(candidate, "id"))),
      });
    }).catch(() => setRemoteRecord(null));
  }, [seeded, workOrderId]);

  useEffect(() => {
    fetch(`/api/work-orders/${workOrderId}/activity`).then(async (response) => {
      const raw = await response.json() as RegistryRecord;
      if (raw.ok) setRemoteActivity(normalizeActivity(raw, workOrderId));
    }).catch(() => undefined);
  }, [workOrderId]);

  const record = seeded ?? remoteRecord;
  if (record === undefined) return <AppShell><div className="pf-page maintenance-page"><PlatformBreadcrumbs items={[{ label: "Work orders", href: "/work-orders" }, { label: "Loading" }]} /><PlatformEmpty icon={Clock3} title="Loading work order" description="Retrieving the organization-scoped work-order record and activity." /></div></AppShell>;
  if (!record) return <AppShell><div className="pf-page maintenance-page"><PlatformBreadcrumbs items={[{ label: "Work orders", href: "/work-orders" }, { label: "Not found" }]} /><PlatformEmpty icon={FileQuestion} title="Work order not found" description="This record is not available in the current organization. It may have been removed from the demo registry or the link may be incorrect." action={<Link className="pf-button" href="/work-orders">Return to work orders</Link>} /></div></AppShell>;
  return <WorkOrderRecordView workOrder={record} context={context} remoteActivity={remoteActivity} />;
}

function WorkOrderRecordView({ workOrder, context, remoteActivity }: { workOrder: WorkOrder; context: RegistryContext; remoteActivity: ActivityData }) {
  const seededStore = workStore(workOrder);
  const seededSystem = workSystem(workOrder);
  const seededAsset = workAsset(workOrder);
  const seededComponent = workComponent(workOrder);
  const category = workCategory(workOrder);
  const store = {
    id: seededStore?.id ?? stringValue(context.store ?? {}, "id", workOrder.storeId),
    code: seededStore?.code ?? stringValue(context.store ?? {}, "code", "New"),
    name: seededStore?.name ?? stringValue(context.store ?? {}, "name", "Created store"),
    city: seededStore?.city ?? stringValue(context.store ?? {}, "city"),
    state: seededStore?.state ?? stringValue(context.store ?? {}, "state"),
    address1: seededStore?.address1 ?? stringValue(context.store ?? {}, "address1"),
  };
  const system = seededSystem ? { id: seededSystem.id, name: seededSystem.name } : context.system ? { id: stringValue(context.system, "id"), name: stringValue(context.system, "name") } : undefined;
  const asset = seededAsset ? { id: seededAsset.id, name: seededAsset.name, assetTag: seededAsset.assetTag } : context.asset ? { id: stringValue(context.asset, "id"), name: stringValue(context.asset, "name"), assetTag: stringValue(context.asset, "assetTag") } : undefined;
  const component = seededComponent ? { id: seededComponent.id, name: seededComponent.name, partNumber: seededComponent.partNumber } : context.component ? { id: stringValue(context.component, "id"), name: stringValue(context.component, "name"), partNumber: stringValue(context.component, "partNumber") } : undefined;
  const vendor = platformData.vendors.find((candidate) => candidate.id === workOrder.vendorId);
  const remoteReports: EmployeeReport[] = (context.reports ?? []).map((report) => ({ id: stringValue(report, "id"), reference: stringValue(report, "reference"), storeId: stringValue(report, "storeId"), reporterName: stringValue(report, "reporterName", "Store team member"), reporterRole: "Store team", area: stringValue(report, "area", "Area not specified"), originalDescription: stringValue(report, "originalDescription"), urgency: stringValue(report, "urgency", "routine") as EmployeeReport["urgency"], submittedAt: stringValue(report, "submittedAt", PLATFORM_NOW), status: stringValue(report, "status", "reviewed") as EmployeeReport["status"] }));
  const reports = mergeById(platformData.reports.filter((report) => workOrder.reportIds.includes(report.id)), remoteReports);
  const reviews = platformData.reportReviews.filter((review) => reports.some((report) => report.id === review.reportId));
  const visits = platformData.visits.filter((visit) => visit.workOrderId === workOrder.id).sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
  const followUps = platformData.followUps.filter((followUp) => followUp.workOrderId === workOrder.id);
  const documents = platformData.documents.filter((document) => document.workOrderId === workOrder.id);
  const quotes = platformData.quotes.filter((quote) => quote.workOrderId === workOrder.id);
  const authorizations = platformData.authorizations.filter((authorization) => authorization.workOrderId === workOrder.id);
  const invoices = platformData.invoices.filter((invoice) => invoice.workOrderId === workOrder.id);
  const allocations = platformData.allocations.filter((allocation) => allocation.workOrderId === workOrder.id);
  const seededChecklist = platformData.checklistItems.filter((item) => item.workOrderId === workOrder.id);
  const seededNotes = platformData.workOrderNotes.filter((note) => note.workOrderId === workOrder.id);
  const seededLabor = platformData.laborEntries.filter((entry) => entry.workOrderId === workOrder.id);
  const seededParts = platformData.partsUsed.filter((part) => part.workOrderId === workOrder.id);
  const checklist = mergeById(remoteActivity.checklist, seededChecklist).sort((a, b) => a.sequence - b.sequence);
  const notes = mergeById(remoteActivity.notes, seededNotes).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const labor = mergeById(remoteActivity.labor, seededLabor).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const parts = mergeById(remoteActivity.parts, seededParts).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const audit = platformData.auditEvents.filter((event) => event.entityId === workOrder.id || reports.some((report) => report.id === event.entityId)).sort((a, b) => b.at.localeCompare(a.at));
  const spend = workOrderSpend(platformData, workOrder.id);
  const completedChecklist = checklist.filter((item) => item.completed).length;
  const laborHours = labor.reduce((sum, entry) => sum + entry.regularHours + entry.overtimeHours, 0);
  const laborValue = labor.reduce((sum, entry) => sum + (entry.regularHours + entry.overtimeHours) * entry.hourlyRateCents, 0);
  const partsValue = parts.reduce((sum, part) => sum + part.quantity * part.unitCostCents, 0);
  const openFollowUps = followUps.filter((followUp) => followUp.status === "open");
  const unreconciledInvoices = invoices.filter((invoice) => allocationTotals(platformData, invoice.id).unallocated > 0);
  const latestVisit = visits.at(-1);
  const closureBlockers = [
    ...(checklist.some((item) => item.required && !item.completed) ? ["Required checklist items remain open"] : []),
    ...(openFollowUps.length ? [`${openFollowUps.length} required follow-up${openFollowUps.length === 1 ? "" : "s"} remain open`] : []),
    ...(workOrder.status === "completed_pending_verification" ? ["Store or manager verification remains open"] : []),
    ...(unreconciledInvoices.length ? [`${unreconciledInvoices.length} bill${unreconciledInvoices.length === 1 ? " has" : "s have"} dollars not assigned yet`] : []),
    ...(latestVisit && latestVisit.checkedOutAt && latestVisit.outcome && !["resolved", "no_issue_found"].includes(latestVisit.outcome) && !openFollowUps.length ? ["Latest unresolved visit outcome has no open follow-up"] : []),
  ];

  return (
    <AppShell>
      <div className="pf-page maintenance-page work-record-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Work orders", href: "/work-orders" }, { label: workOrder.number }]} />
        <header className="work-record-hero">
          <section className="work-record-primary">
            <div className="work-record-kicker"><span>{workOrder.number}</span><PlatformBadge tone={badgeToneForStatus(workOrder.status)}>{workOrderStatusLabel[workOrder.status] ?? workOrder.status.replaceAll("_", " ")}</PlatformBadge><PlatformBadge tone={priorityTone(workOrder.priority)}>{priorityLabel[workOrder.priority]}</PlatformBadge>{isOverdue(workOrder) && <PlatformBadge tone="critical">Past due</PlatformBadge>}</div>
            <h1>{workOrder.title}</h1><p>{workOrder.description}</p>
            <div className="work-record-meta"><span><Store /><strong>Store {store.code} · {store.city}</strong><small>{store.address1}, {store.state}</small></span><span><MapPin /><strong>{workOrder.location || "Location to confirm"}</strong><small>{workOrder.problemCode || "Problem code not set"}</small></span><span><UsersRound /><strong>{workProviderName(workOrder)}</strong><small>{workOrder.assignmentType?.replaceAll("_", " ") ?? "unassigned"} assignment</small></span></div>
          </section>
          <aside className="work-control-card"><span>Who acts next</span><h2>{workOrder.accountableParty}</h2><p>{workOrder.nextAction}</p><dl><div><dt>Due</dt><dd>{workOrder.dueAt ? formatDate(workOrder.dueAt, true) : "Missing"}</dd></div><div><dt>If overdue, notify</dt><dd>{workOrder.escalation}</dd></div></dl><Link href="/accountability">See all work needing attention <ArrowRight /></Link></aside>
        </header>

        <nav className="work-record-nav" aria-label="Work-order record sections"><a href="#work-source">Problem & equipment</a><a href="#work-execution">Work details</a><a href="#work-financials">Costs & bills</a><a href="#work-audit">History</a></nav>

        <section className="maintenance-stat-grid" aria-label="Work-order totals">
          <PlatformStat label="Recorded cost" value={formatCurrency(spend)} note={`Spending limit ${formatCurrency(workOrder.nteCents)} · estimated open cost ${formatCurrency(workOrder.costExposureCents)}`} icon={CircleDollarSign} href="#work-financials" />
          <PlatformStat label="Visits" value={String(visits.length)} note={`${visits.filter((visit) => visit.checkIn.state === "verified").length} verified check-ins`} icon={MapPin} href="#work-visits" />
          <PlatformStat label="Work plan" value={`${completedChecklist}/${checklist.length}`} note="Required steps must be done before closing" icon={ClipboardCheck} href="#work-checklist" />
          <PlatformStat label="Recorded effort" value={`${laborHours.toFixed(2)}h`} note={`${parts.length} material line${parts.length === 1 ? "" : "s"} · ${formatCurrency(laborValue + partsValue)}`} icon={Clock3} href="#work-time-parts" />
        </section>

        <section className="work-close-control">
          <span className={closureBlockers.length ? "work-close-icon-blocked" : "work-close-icon-ready"}>{closureBlockers.length ? <AlertTriangle /> : <CheckCircle2 />}</span>
          <div><strong>{closureBlockers.length ? "This work order cannot be closed yet" : "This work order is ready to close"}</strong>{closureBlockers.length ? <ul>{closureBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <p>Required steps, follow-up, manager review, and bill checks are complete.</p>}</div>
        </section>

        <section className="maintenance-panel" id="work-source">
          <PlatformSectionHeader title="Problem and equipment details" description="Keep the original problem report, then add equipment details whenever they become known." />
          <div className="work-source-grid">
            <article className="work-scope-card"><span>Problem reported</span><h3>{workOrder.title}</h3><p>{workOrder.description}</p><dl><div><dt>Reported by</dt><dd>{workOrder.requestedBy ?? "Operations"}</dd></div><div><dt>How it came in</dt><dd>{workOrder.origin.replaceAll("_", " ")}</dd></div><div><dt>Created</dt><dd>{formatDate(workOrder.createdAt, true)}</dd></div><div><dt>Type of work</dt><dd>{workOrder.workType.replaceAll("_", " ")}</dd></div><div><dt>Safety risk</dt><dd>{workOrder.safetyRisk ?? "Not recorded"}</dd></div><div><dt>Access</dt><dd>{workOrder.accessInstructions || "Confirm with store"}</dd></div></dl></article>
            <article className="work-classification-card"><span>Equipment detail · {classificationDepth(workOrder)}</span><ol><li className="work-classified"><i>1</i><div><small>Store</small><Link href={`/stores/${store.id}`}>{store.name}</Link></div></li><li className={category ? "work-classified" : "work-deferred"}><i>2</i><div><small>Type of work</small><strong>{category?.name ?? "Add later"}</strong></div></li><li className={system ? "work-classified" : "work-deferred"}><i>3</i><div><small>Equipment group</small>{system ? <Link href={`/stores/${store.id}/systems/${system.id}`}>{system.name}</Link> : <strong>Not identified yet</strong>}</div></li><li className={asset ? "work-classified" : "work-deferred"}><i>4</i><div><small>Individual equipment</small>{asset ? <Link href={`/assets/${asset.id}`}>{asset.assetTag} · {asset.name}</Link> : <strong>Add during review or repair</strong>}</div></li><li className={component ? "work-classified" : "work-deferred"}><i>5</i><div><small>Component</small><strong>{component ? `${component.name}${component.partNumber ? ` · ${component.partNumber}` : ""}` : "Optional"}</strong></div></li></ol></article>
            <article className="work-assignment-card"><span>Who is handling the work</span><h3>{workOrder.assignmentType?.replaceAll("_", " ") ?? "Unassigned"}</h3><dl><div><dt>Internal assignee</dt><dd>{workOrder.assignedToName ?? (workOrder.assignmentType === "internal" ? workOrder.accountableParty : "None")}</dd></div><div><dt>Outside vendor</dt><dd>{vendor ? <Link href={`/providers/${vendor.id}`}>{vendor.name}</Link> : "None"}</dd></div><div><dt>Vendor response</dt><dd>{workOrder.vendorAcceptance.replaceAll("_", " ")}</dd></div><div><dt>Response due</dt><dd>{workOrder.targetResponseAt ? formatDate(workOrder.targetResponseAt, true) : "Not set"}</dd></div><div><dt>Work due</dt><dd>{workOrder.targetCompletionAt ? formatDate(workOrder.targetCompletionAt, true) : workOrder.dueAt ? formatDate(workOrder.dueAt, true) : "Not set"}</dd></div></dl><p>{workOrder.assignmentType === "vendor" || workOrder.assignmentType === "blended" ? "The vendor can keep using its own dispatch process. Clark's still records responses, visits, results, and proof." : "Internal and vendor work use the same problem details, proof, and closing steps."}</p></article>
          </div>
          {reports.map((report) => <article className="work-original-report" key={report.id}><header><LockKeyhole /><div><strong>{report.reference} · original problem report</strong><small>{report.reporterName} · {report.reporterRole} · {formatDate(report.submittedAt, true)}</small></div></header><blockquote>{report.originalDescription}</blockquote>{reviews.filter((review) => review.reportId === report.id).map((review) => <div className="work-report-review" key={review.id}><PlatformBadge tone="good">{review.decision}</PlatformBadge><span><strong>{review.reviewerName}</strong><small>{review.context}</small></span></div>)}</article>)}
        </section>

        <div className="work-record-grid" id="work-execution">
          <section className="maintenance-panel" id="work-visits"><PlatformSectionHeader title="Service visits and follow-up" description="See who visited, when they arrived, what happened, and what remains." />{visits.length ? <div className="work-visit-list">{visits.map((visit, index) => <article className="work-visit-card" key={visit.id}><header><span>Visit {index + 1}</span><strong>{visit.technicianName}</strong><PlatformBadge tone={visit.checkIn.state === "verified" ? "good" : "warning"}>{verificationLabel[visit.checkIn.state]}</PlatformBadge>{visit.outcome && <PlatformBadge tone={visit.outcome === "resolved" || visit.outcome === "no_issue_found" ? "good" : "warning"}>{visitOutcomeLabel[visit.outcome]}</PlatformBadge>}</header><dl><div><dt>Check-in</dt><dd>{formatDate(visit.checkedInAt, true)}</dd></div><div><dt>Distance / accuracy</dt><dd>{visit.checkIn.distanceM ?? "—"}m / {visit.checkIn.accuracyM ?? "—"}m</dd></div><div><dt>Checkout</dt><dd>{visit.checkedOutAt ? formatDate(visit.checkedOutAt, true) : "Active"}</dd></div><div><dt>Checkout proof</dt><dd>{visit.checkOut ? verificationLabel[visit.checkOut.state] : "Not captured"}</dd></div></dl></article>)}</div> : <PlatformEmpty icon={MapPin} title="No visits recorded" description="No technician check-in or checkout has been recorded for this work order." />}{followUps.map((followUp) => <article className="work-followup-card" key={followUp.id}><FileQuestion /><div><strong>{followUp.nextAction}</strong><p>{followUp.accountableParty} · due {formatDate(followUp.dueAt, true)} · notify {followUp.escalation} if late</p></div><PlatformBadge tone={followUp.status === "open" ? "warning" : "good"}>{followUp.status}</PlatformBadge></article>)}</section>

          <section className="maintenance-panel" id="work-checklist"><PlatformSectionHeader title="Work plan and checklist" description="The same required steps apply whether an internal technician or outside vendor does the work." /><div className="work-checklist-summary"><div><strong>{completedChecklist} of {checklist.length} complete</strong><span>{checklist.filter((item) => item.required && !item.completed).length} required items remain</span></div><PlatformProgress value={checklist.length ? completedChecklist / checklist.length : 0} label={checklist.length ? `${Math.round(completedChecklist / checklist.length * 100)}%` : "No plan"} /></div>{checklist.length ? <ol className="work-checklist-list">{checklist.map((item) => <li className={item.completed ? "work-checklist-complete" : "work-checklist-open"} key={item.id}><span>{item.completed ? <CheckCircle2 /> : item.sequence}</span><div><strong>{item.label}</strong><small>{item.required ? "Required" : "Recommended"}{item.completedBy ? ` · ${item.completedBy}` : ""}</small></div></li>)}</ol> : <PlatformEmpty icon={ClipboardCheck} title="No checklist loaded" description="This work order does not have checklist items yet." />}</section>

          <section className="maintenance-panel" id="work-notes"><PlatformSectionHeader title="Work notes" description="Updates are dated and show who can see them." />{notes.length ? <div className="work-note-list">{notes.map((note) => <article className="work-note" key={note.id}><MessageSquareText /><div><header><strong>{note.author}</strong><PlatformBadge tone={note.visibility === "internal" ? "neutral" : "info"}>{note.visibility}</PlatformBadge></header><small>{note.authorRole} · {formatDate(note.createdAt, true)}</small><p>{note.body}</p></div></article>)}</div> : <PlatformEmpty icon={MessageSquareText} title="No work notes" description="No notes are available for this work order." />}</section>

          <section className="maintenance-panel" id="work-time-parts"><PlatformSectionHeader title="Time and materials" description="See the hours, parts, and costs recorded for this work order." /><div className="work-ledger-split"><div><header><strong>Labor</strong><span>{laborHours.toFixed(2)}h · {formatCurrency(laborValue)}</span></header>{labor.map((entry) => <article className="work-ledger-row" key={entry.id}><Clock3 /><span><strong>{entry.technicianName}</strong><small>{entry.regularHours.toFixed(2)} regular · {entry.overtimeHours.toFixed(2)} overtime · {entry.notes}</small></span><b>{formatCurrency((entry.regularHours + entry.overtimeHours) * entry.hourlyRateCents)}</b></article>)}{!labor.length && <p className="work-ledger-empty">No labor entries.</p>}</div><div><header><strong>Materials</strong><span>{parts.length} lines · {formatCurrency(partsValue)}</span></header>{parts.map((part) => <article className="work-ledger-row" key={part.id}><Package /><span><strong>{part.partNumber || "No part number"} · {part.description}</strong><small>{part.quantity} × {formatCurrency(part.unitCostCents)} · {part.source.replaceAll("_", " ")}</small></span><b>{formatCurrency(part.quantity * part.unitCostCents)}</b></article>)}{!parts.length && <p className="work-ledger-empty">No material entries.</p>}</div></div></section>

          <section className="maintenance-panel" id="work-documents"><PlatformSectionHeader title="Photos, quotes, and files" description="Open the proof and paperwork attached to this work order." />{documents.length ? <div className="work-document-grid">{documents.map((document) => <a href={document.href} key={document.id}><FileText /><span><strong>{document.name}</strong><small>{document.classification.replaceAll("_", " ")} · {Math.round(document.bytes / 1024)} KB · {document.visibility.replaceAll("_", " ")}</small></span><ExternalLink /></a>)}</div> : <PlatformEmpty icon={FileText} title="No files attached" description="No photo, quote, service ticket, bill, or other file is attached." />}</section>
        </div>

        <section className="maintenance-panel" id="work-financials">
          <PlatformSectionHeader title="Quotes, approvals, bills, and payments" description="See each step in the cost of this work without mixing estimates, approvals, and paid bills." />
          <div className="work-financial-summary"><article><span>Quoted</span><strong>{formatCurrency(quotes.reduce((sum, quote) => sum + quote.amountCents, 0))}</strong><small>{quotes.length} records</small></article><article><span>Approved</span><strong>{formatCurrency(authorizations.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.amountCents, 0))}</strong><small>{authorizations.length} records</small></article><article><span>Billed</span><strong>{formatCurrency(invoices.filter((item) => item.status !== "void").reduce((sum, item) => sum + item.totalCents, 0))}</strong><small>{invoices.length} records</small></article><article><span>Assigned to store or equipment</span><strong>{formatCurrency(allocations.reduce((sum, item) => sum + item.amountCents, 0))}</strong><small>{allocations.length} lines</small></article></div>
          <div className="work-financial-grid">
            <div><h3>Quotes and approvals</h3>{quotes.map((quote) => <article className="work-financial-row" key={quote.id}><span><strong>Quote {quote.number}</strong><small>{formatDate(quote.submittedAt)} · {quote.status}</small></span><b>{formatCurrency(quote.amountCents)}</b></article>)}{authorizations.map((authorization) => <article className="work-financial-row" key={authorization.id}><span><strong>Approval</strong><small>{formatDate(authorization.approvedAt)} · {authorization.status}</small></span><b>{formatCurrency(authorization.amountCents)}</b></article>)}{!quotes.length && !authorizations.length && <p className="work-ledger-empty">No quotes or approvals.</p>}</div>
            <div><h3>Bill check</h3>{invoices.map((invoice) => { const totals = allocationTotals(platformData, invoice.id); const lines = allocations.filter((allocation) => allocation.invoiceId === invoice.id); return <article className="work-invoice-card" key={invoice.id}><header><span><strong>{invoice.number}</strong><small>{formatDate(invoice.issuedAt)} · {invoice.status}</small></span><b>{formatCurrency(invoice.totalCents)}</b></header>{lines.map((line) => <div key={line.id}><span>{line.workClass.replaceAll("_", " ")} · {line.costCategory.replaceAll("_", " ")}</span><strong>{formatCurrency(line.amountCents)}</strong></div>)}<footer><span>{totals.unallocated ? `${formatCurrency(totals.unallocated)} not assigned yet` : "Fully assigned"}</span><PlatformBadge tone={totals.unallocated ? "critical" : "good"}>{totals.unallocated ? "Needs review" : "Checked"}</PlatformBadge></footer></article>; })}{!invoices.length && <p className="work-ledger-empty">No bills recorded.</p>}</div>
          </div>
        </section>

        <section className="maintenance-panel" id="work-audit">
          <PlatformSectionHeader title="Activity history" description="See the original report, equipment changes, responses, visits, and status updates in time order." />
          <div className="work-audit-timeline">
            {remoteActivity.statuses.map((event) => <article key={`status-${event.id}`}><span /><div><h3>{event.reason || `Status changed to ${event.newStatus.replaceAll("_", " ")}`}</h3><small>{formatDate(event.occurredAt, true)} · {event.actorName}</small>{event.priorStatus && <p>{event.priorStatus.replaceAll("_", " ")} → {event.newStatus.replaceAll("_", " ")}</p>}</div></article>)}
            {audit.map((event) => <article key={event.id}><span /><div><h3>{event.summary}</h3><small>{formatDate(event.at, true)} · {event.actor}</small>{event.detail && <p>{event.detail}</p>}{event.simulated && <PlatformBadge tone="purple">Demo Mode</PlatformBadge>}</div></article>)}
            {!audit.length && !remoteActivity.statuses.length && <PlatformEmpty icon={FileCheck2} title="No activity yet" description="The work order is available, but no later updates were returned." />}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export function RequestsCenter() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "triage" | "issued">("all");
  const [createdReports, setCreatedReports] = useState<EmployeeReport[]>([]);
  const [createdRequestWork, setCreatedRequestWork] = useState<WorkOrder[]>([]);
  useEffect(() => {
    Promise.all([registryRecords("requests"), registryRecords("work-orders")]).then(([records, workOrders]) => {
      setCreatedReports(records.map((record) => ({
      id: stringValue(record, "id"),
      reference: stringValue(record, "reference", "New request"),
      storeId: stringValue(record, "storeId"),
      reporterName: stringValue(record, "reporterName", "Store team member"),
      reporterRole: "Store team",
      area: stringValue(record, "area", "Area not specified"),
      originalDescription: stringValue(record, "originalDescription"),
      urgency: stringValue(record, "urgency", "routine") as EmployeeReport["urgency"],
      submittedAt: stringValue(record, "submittedAt", PLATFORM_NOW),
      status: stringValue(record, "status", "submitted") as EmployeeReport["status"],
      })).filter((report) => report.id && !platformData.reports.some((seeded) => seeded.id === report.id)));
      setCreatedRequestWork(workOrders.map(normalizeRegistryWorkOrder).filter((workOrder) => workOrder.id && !platformData.workOrders.some((seeded) => seeded.id === workOrder.id)));
    }).catch(() => undefined);
  }, []);
  const allReports = useMemo(() => mergeById(platformData.reports, createdReports), [createdReports]);
  const requestWork = mergeById(platformData.workOrders, createdRequestWork).filter((workOrder) => workOrder.origin === "employee_report" || workOrder.origin === "manager" || workOrder.reportIds.length).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const linkedReportIds = new Set(requestWork.flatMap((workOrder) => workOrder.reportIds));
  const unconvertedReports = allReports.filter((report) => !linkedReportIds.has(report.id));
  const deferredClassification = requestWork.filter((workOrder) => isOpenWorkOrder(workOrder) && !workOrder.systemId);
  const visible = requestWork.filter((workOrder) => {
    const store = workStore(workOrder);
    const report = allReports.find((candidate) => workOrder.reportIds.includes(candidate.id));
    const haystack = `${workOrder.number} ${workOrder.title} ${workOrder.description} ${workOrder.requestedBy ?? ""} ${store?.code ?? ""} ${store?.address1 ?? ""} ${store?.city ?? ""} ${report?.originalDescription ?? ""}`.toLowerCase();
    const triage = isOpenWorkOrder(workOrder) && (!workOrder.systemId || workOrder.assignmentType === "unassigned" || ["draft", "pending_review", "approved"].includes(workOrder.status));
    return (!query || haystack.includes(query.toLowerCase())) && (scope === "all" || (scope === "triage" ? triage : !triage));
  });

  return (
    <AppShell>
      <div className="pf-page maintenance-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Requests" }]} />
        <PlatformPageHeader eyebrow="Store-to-maintenance intake" title="Request center" description="Store teams report the symptom and location. Maintenance preserves that source, confirms risk, assigns ownership and adds equipment detail only when known.">
          <Link className="pf-button" href="/work-orders/new"><ClipboardList />Create facilities work</Link>
          <Link className="pf-button pf-button-primary" href="/requests/new"><ClipboardPlus />New store request</Link>
        </PlatformPageHeader>

        <section className="maintenance-stat-grid" aria-label="Request intake summary">
          <PlatformStat label="Immutable reports" value={String(allReports.length)} note="Original employee wording retained" icon={LockKeyhole} href="#maintenance-original-reports" />
          <PlatformStat label="Not yet converted" value={String(unconvertedReports.length)} note="Reports without a linked internal work order" icon={Inbox} href="#maintenance-original-reports" tone={unconvertedReports.length ? "warning" : "positive"} />
          <PlatformStat label="Needs triage depth" value={String(deferredClassification.length)} note="Valid at store + category while equipment is deferred" icon={Wrench} href="#maintenance-request-inbox" tone="info" />
          <PlatformStat label="Critical open intake" value={String(requestWork.filter((workOrder) => workOrder.priority === "critical" && isOpenWorkOrder(workOrder)).length)} note="Immediate operating or safety impact" icon={ShieldAlert} href="#maintenance-request-inbox" tone="critical" />
        </section>

        <section className="maintenance-request-standard"><div><strong>Requester asks for help</strong><p>Symptom, location, impact and optional photo.</p></div><ArrowRight /><div><strong>Manager validates</strong><p>Risk, duplication and operational context.</p></div><ArrowRight /><div><strong>Maintenance controls work</strong><p>Category, assignment, owner, next action and due date.</p></div><ArrowRight /><div><strong>Diagnosis adds depth</strong><p>Cost center, asset or component when physically confirmed.</p></div></section>

        <section className="maintenance-panel" id="maintenance-request-inbox">
          <PlatformSectionHeader title="Request-derived work" description="Manager and employee-report origins linked to the internal work-order record." />
          <div className="work-filter-panel maintenance-request-filters"><label className="work-search-field"><span>Search requests</span><div><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Request, store, address, symptom or requester" /></div></label><label className="work-filter-field"><span>Triage state</span><select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="all">All request work</option><option value="triage">Needs triage</option><option value="issued">Controlled / issued</option></select></label><span className="work-filter-result">{visible.length} records</span></div>
          <div className="maintenance-request-list">{visible.slice(0, 40).map((workOrder) => { const report = allReports.find((candidate) => workOrder.reportIds.includes(candidate.id)); const needsTriage = isOpenWorkOrder(workOrder) && (!workOrder.systemId || workOrder.assignmentType === "unassigned" || ["draft", "pending_review", "approved"].includes(workOrder.status)); return <Link className="maintenance-request-row" href={`/work-orders/${workOrder.id}`} key={workOrder.id}><span className={`maintenance-request-priority maintenance-request-${workOrder.priority}`} /><div><header><span>{report?.reference ?? `REQ-${workOrder.number.replace("CWO-", "")}`}</span><PlatformBadge tone={needsTriage ? "warning" : "good"}>{needsTriage ? "Needs triage" : "Controlled work"}</PlatformBadge><PlatformBadge tone={priorityTone(workOrder.priority)}>{priorityLabel[workOrder.priority]}</PlatformBadge></header><h3>{workOrder.title}</h3><p>{report?.originalDescription ?? workOrder.description}</p><footer><span><MapPin />{workStoreLabel(workOrder)}</span><span><Wrench />{workCategory(workOrder)?.name ?? "Category not set"}</span><span><UserRound />{workOrder.requestedBy ?? report?.reporterName ?? "Store team"}</span><span><Clock3 />{formatDate(workOrder.createdAt, true)}</span></footer></div><ArrowRight /></Link>; })}{!visible.length && <PlatformEmpty icon={Search} title="No matching requests" description="Change the search or triage filter to see more request-derived work." />}</div>
        </section>

        <section className="maintenance-panel" id="maintenance-original-reports">
          <PlatformSectionHeader title="Original employee reports" description="Inserted report content is immutable; reviews and work-order decisions append separately." />
          {allReports.length ? <div className="maintenance-original-report-list">{allReports.map((report) => { const store = platformData.stores.find((candidate) => candidate.id === report.storeId); const linkedWork = requestWork.find((workOrder) => workOrder.reportIds.includes(report.id)); const reviews = platformData.reportReviews.filter((review) => review.reportId === report.id); return <article className="maintenance-original-report" id={`report-${report.id}`} key={report.id}><header><LockKeyhole /><span><strong>{report.reference} · {report.area}</strong><small>{report.reporterName} · {formatDate(report.submittedAt, true)}</small></span><PlatformBadge tone={linkedWork ? "good" : "warning"}>{linkedWork ? "Work order linked" : "Awaiting decision"}</PlatformBadge></header><blockquote>{report.originalDescription}</blockquote><footer><span>{store ? `Store ${store.code} · ${store.city}` : report.storeId}</span><span>{reviews.length} appended review{reviews.length === 1 ? "" : "s"}</span>{linkedWork ? <Link href={`/work-orders/${linkedWork.id}`}>{linkedWork.number}<ArrowRight /></Link> : <Link href={`/work-orders/new?storeId=${report.storeId}&reportId=${report.id}`}>Create work order<ArrowRight /></Link>}</footer></article>; })}</div> : <PlatformEmpty icon={LockKeyhole} title="No employee reports" description="No immutable store-origin report records are available." />}
        </section>
      </div>
    </AppShell>
  );
}

export function PmCenter({ initialStatus = "", initialCategory = "", initialStore = "", initialRegion = "", initialProvider = "" }: { initialStatus?: string; initialCategory?: string; initialStore?: string; initialRegion?: string; initialProvider?: string }) {
  const [createdPlans, setCreatedPlans] = useState<PmPlan[]>([]);
  const [createdOccurrences, setCreatedOccurrences] = useState<PmOccurrence[]>([]);
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState(initialCategory);
  const [storeId, setStoreId] = useState(initialStore);
  const [region, setRegion] = useState(initialRegion);
  const [provider, setProvider] = useState(initialProvider);
  const [page, setPage] = useState(1);
  useEffect(() => {
    registryRecords("pm-plans").then((records) => {
      const knownPlans = new Set(platformData.pmPlans.map((plan) => plan.id));
      const knownOccurrences = new Set(platformData.pmOccurrences.map((occurrence) => occurrence.id));
      setCreatedPlans(mergeById(records.map(normalizeRegistryPmPlan).filter((plan) => plan.id && !knownPlans.has(plan.id)), []));
      setCreatedOccurrences(mergeById(records.map(normalizeRegistryPmOccurrence).filter((occurrence): occurrence is PmOccurrence => Boolean(occurrence?.id) && !knownOccurrences.has(occurrence!.id)), []));
    }).catch(() => undefined);
  }, []);
  const allPlans = useMemo(() => mergeById(platformData.pmPlans, createdPlans), [createdPlans]);
  const allOccurrences = useMemo(() => mergeById(platformData.pmOccurrences, createdOccurrences), [createdOccurrences]);
  const pmData = useMemo(() => ({ ...platformData, pmPlans: allPlans, pmOccurrences: allOccurrences }), [allOccurrences, allPlans]);
  const compliance = pmCompliance(pmData, {}, PLATFORM_NOW);
  const missed = allOccurrences.filter((occurrence) => occurrence.status === "missed");
  const documentation = allOccurrences.filter((occurrence) => occurrence.status === "documentation_pending");
  const upcoming = allOccurrences.filter((occurrence) => ["scheduled", "due_soon", "acceptance_pending", "accepted"].includes(occurrence.status));
  const filtered = [...allOccurrences].filter((occurrence) => {
    const plan = allPlans.find((candidate) => candidate.id === occurrence.planId);
    const store = platformData.stores.find((candidate) => candidate.id === occurrence.storeId);
    return (!status || occurrence.status === status) && (!category || plan?.categoryId === category) && (!provider || plan?.vendorId === provider) && (!storeId || occurrence.storeId === storeId) && (!region || store?.regionId === region);
  }).sort((a, b) => b.dueAt.localeCompare(a.dueAt));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  function resetPage() { setPage(1); }

  return (
    <AppShell>
      <div className="pf-page maintenance-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Preventive maintenance" }]} />
        <PlatformPageHeader eyebrow="Planned maintenance" title="Preventive maintenance" description="Recurring plans create dated occurrences with explicit windows, required evidence and permanent missed-date history.">
          <Link className="pf-button pf-button-primary" href="/pm/new"><Plus />Create PM plan</Link>
        </PlatformPageHeader>

        <section className="maintenance-stat-grid" aria-label="Preventive maintenance summary">
          <PlatformStat label="Verified on-time compliance" value={formatPercent(compliance.value)} note={`${compliance.numerator} of ${compliance.denominator} eligible occurrences`} icon={ShieldCheck} href="#maintenance-pm-occurrences" tone={compliance.value >= 0.9 ? "positive" : "warning"} />
          <PlatformStat label="Active plans" value={String(allPlans.filter((plan) => plan.active).length)} note="Store, system, asset-class and asset scope" icon={Wrench} href="#maintenance-pm-plans" />
          <PlatformStat label="Missed occurrences" value={String(missed.length)} note="Original missed result remains permanent" icon={AlertTriangle} href="#maintenance-pm-occurrences" tone={missed.length ? "critical" : "positive"} />
          <PlatformStat label="Upcoming / accepted" value={String(upcoming.length)} note={`${documentation.length} documentation-pending occurrences`} icon={CalendarClock} href="#maintenance-pm-occurrences" tone="info" />
        </section>

        {missed.length > 0 && <section className="maintenance-pm-recovery"><AlertTriangle /><div><strong>{missed.length} PM occurrence{missed.length === 1 ? " is" : "s are"} missed and retained.</strong><p>Recovery work may be rescheduled, but the original due date and missed result are not overwritten.</p></div>{missed.filter((occurrence) => occurrence.workOrderId).map((occurrence) => <Link key={occurrence.id} href={`/work-orders/${occurrence.workOrderId}`}>Open recovery work<ArrowRight /></Link>)}</section>}

        <section className="maintenance-panel" id="maintenance-pm-occurrences">
          <PlatformSectionHeader title="Occurrence register" description="Filterable dated instances with windows, proof status and linked recovery work." />
          <div className="work-filter-panel maintenance-pm-filters"><label className="work-filter-field"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}><option value="">All statuses</option>{Array.from(new Set(allOccurrences.map((item) => item.status))).sort().map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label className="work-filter-field"><span>Category</span><select value={category} onChange={(event) => { setCategory(event.target.value); resetPage(); }}><option value="">All categories</option>{platformData.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="work-filter-field"><span>Region</span><select value={region} onChange={(event) => { setRegion(event.target.value); resetPage(); }}><option value="">All regions</option>{platformData.regions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="work-filter-field"><span>Store</span><select value={storeId} onChange={(event) => { setStoreId(event.target.value); resetPage(); }}><option value="">All stores</option>{platformData.stores.filter((store) => !region || store.regionId === region).map((store) => <option value={store.id} key={store.id}>Store {store.code} · {store.city}</option>)}</select></label><label className="work-filter-field"><span>Provider</span><select value={provider} onChange={(event) => { setProvider(event.target.value); resetPage(); }}><option value="">All providers</option>{platformData.vendors.map((item) => <option value={item.id} key={item.id}>{item.shortName}</option>)}</select></label><span className="work-filter-result">{filtered.length} occurrences · page {safePage} of {pageCount}</span></div>
          <div className="work-table-wrap"><table className="work-table maintenance-pm-table"><thead><tr><th>Plan / store</th><th>Target</th><th>Due date retained</th><th>Service window</th><th>Status / evidence</th><th>Work order</th></tr></thead><tbody>{visible.map((occurrence) => { const plan = allPlans.find((candidate) => candidate.id === occurrence.planId); const store = platformData.stores.find((candidate) => candidate.id === occurrence.storeId); const system = platformData.systems.find((candidate) => candidate.id === occurrence.systemId); const asset = platformData.assets.find((candidate) => candidate.id === occurrence.assetId); return <tr key={occurrence.id}><td><strong>{plan?.name ?? occurrence.planId}</strong><span className="work-table-note">{store ? `Store ${store.code} · ${store.city}` : occurrence.storeId}</span></td><td><strong>{asset?.name ?? system?.name ?? plan?.scopeLabel ?? "Store scope"}</strong><span className="work-table-note">{plan?.targetType.replaceAll("_", " ")}</span></td><td><strong>{formatDate(occurrence.dueAt, true)}</strong>{occurrence.status === "missed" && <span className="work-overdue-note">Missed · retained</span>}</td><td>{formatDate(occurrence.windowStart)} – {formatDate(occurrence.windowEnd)}</td><td><PlatformBadge tone={occurrence.status === "missed" ? "critical" : occurrence.verified ? "good" : "warning"}>{occurrence.status.replaceAll("_", " ")}</PlatformBadge><span className="work-table-note">{occurrence.verified ? "Evidence verified" : "Not counted as verified"}</span></td><td>{occurrence.workOrderId ? <Link className="work-record-link" href={`/work-orders/${occurrence.workOrderId}`}>{platformData.workOrders.find((workOrder) => workOrder.id === occurrence.workOrderId)?.number ?? "Open linked work"}</Link> : <span className="work-table-note">No work order</span>}</td></tr>; })}</tbody></table></div>
          {filtered.length > PAGE_SIZE && <nav className="work-pagination" aria-label="PM occurrence pages"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {safePage} of {pageCount}</span><button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></nav>}
        </section>

        <section className="maintenance-panel" id="maintenance-pm-plans">
          <PlatformSectionHeader title="Plan library" description="Frequency, scope, provider, window and proof requirement remain organization-scoped." />
          <div className="maintenance-pm-plan-grid">{allPlans.map((plan) => { const provider = platformData.vendors.find((vendor) => vendor.id === plan.vendorId); const planCompliance = pmCompliance(pmData, { vendorId: plan.vendorId, categoryId: plan.categoryId }, PLATFORM_NOW); return <article className="maintenance-pm-plan" key={plan.id}><header><span><strong>{plan.name}</strong><small>{plan.scopeLabel}</small></span><PlatformBadge tone={plan.active ? "good" : "neutral"}>{plan.active ? "Active" : "Inactive"}</PlatformBadge></header><dl><div><dt>Frequency</dt><dd>{plan.frequency}</dd></div><div><dt>Provider</dt><dd>{provider?.shortName ?? "Not assigned"}</dd></div><div><dt>Window</dt><dd>{plan.earlyWindowDays} days early / {plan.lateWindowDays} days late</dd></div><div><dt>Required proof</dt><dd>{plan.requiredDocument}</dd></div></dl><footer><span>Observed cohort compliance</span><strong>{formatPercent(planCompliance.value)}</strong></footer></article>; })}</div>
        </section>
      </div>
    </AppShell>
  );
}

export function InternalWorkQueue() {
  const techniciansWithWork = platformData.technicians.filter((technician) => platformData.workOrders.some((workOrder) => workOrder.assignedToId === technician.id && isOpenWorkOrder(workOrder)));
  const [technicianId, setTechnicianId] = useState(techniciansWithWork[0]?.id ?? platformData.technicians[0]?.id ?? "");
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const technician = platformData.technicians.find((candidate) => candidate.id === technicianId);
  const internalWork = platformData.workOrders.filter((workOrder) => isOpenWorkOrder(workOrder) && (workOrder.assignmentType === "internal" || workOrder.assignmentType === "blended"));
  const visible = internalWork.filter((workOrder) => scope === "team" || workOrder.assignedToId === technicianId).sort(managerSort);
  const active = visible.filter((workOrder) => workOrder.status === "visit_active");
  const waiting = visible.filter((workOrder) => ["waiting_on_parts", "waiting_on_approval", "follow_up_required"].includes(workOrder.status));
  const plannedHours = visible.reduce((sum, workOrder) => sum + (workOrder.estimatedHours ?? 0), 0);

  return (
    <AppShell>
      <div className="pf-page maintenance-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Internal work" }]} />
        <PlatformPageHeader eyebrow="Internal maintenance execution" title="Internal work queue" description="Field-ready assignments with scope, hazards, due dates, checklist progress, labor and material evidence. This is not a route, payroll or workforce-management module.">
          <Link className="pf-button pf-button-primary" href="/work-orders/new?assignment=internal"><Plus />Create internal work</Link>
        </PlatformPageHeader>

        <div className="maintenance-internal-controls"><label><UserRound /><span>View as</span><select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}>{platformData.technicians.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.title}</option>)}</select></label><div><button type="button" className={scope === "mine" ? "maintenance-scope-active" : "maintenance-scope-button"} onClick={() => setScope("mine")}>Selected technician</button><button type="button" className={scope === "team" ? "maintenance-scope-active" : "maintenance-scope-button"} onClick={() => setScope("team")}>All internal work</button></div></div>

        <section className="maintenance-stat-grid" aria-label="Internal work summary">
          <PlatformStat label="Open assignments" value={String(visible.length)} note={scope === "mine" ? `${technician?.name ?? "Technician"}'s current queue` : "Internal and blended work"} icon={Wrench} href="#maintenance-internal-queue" />
          <PlatformStat label="Active work" value={String(active.length)} note="Work currently recorded as active" icon={Clock3} href="#maintenance-internal-queue" tone="info" />
          <PlatformStat label="Past due" value={String(visible.filter(isOverdue).length)} note="Retained completion targets exceeded" icon={CalendarClock} href="#maintenance-internal-queue" tone={visible.some(isOverdue) ? "critical" : "positive"} />
          <PlatformStat label="Blocked / follow-up" value={String(waiting.length)} note={`${plannedHours.toFixed(1)} planned hours across visible work`} icon={AlertTriangle} href="#maintenance-internal-queue" tone={waiting.length ? "warning" : "positive"} />
        </section>

        {technician && <section className="maintenance-technician-context"><span>{technician.name.split(" ").map((part) => part[0]).join("")}</span><div><strong>{technician.name}</strong><p>{technician.title} · {technician.trades.join(", ")}</p></div><dl><div><dt>Regions</dt><dd>{technician.regionIds.map((id) => platformData.regions.find((region) => region.id === id)?.name).filter(Boolean).join(", ")}</dd></div><div><dt>Certifications</dt><dd>{technician.certifications.join(", ")}</dd></div><div><dt>Contact</dt><dd>{technician.phone}</dd></div></dl></section>}

        <section className="maintenance-panel" id="maintenance-internal-queue">
          <PlatformSectionHeader title={scope === "mine" ? `${technician?.name ?? "Technician"}'s assigned work` : "All internal and blended work"} description="Ordered by criticality, missed target and next due date — not by a prescribed route." />
          {visible.length ? <div className="maintenance-internal-list">{visible.map((workOrder) => { const store = workStore(workOrder); const asset = workAsset(workOrder); const checklist = platformData.checklistItems.filter((item) => item.workOrderId === workOrder.id); const completed = checklist.filter((item) => item.completed).length; const recordedParts = platformData.partsUsed.filter((item) => item.workOrderId === workOrder.id); return <article className="maintenance-internal-card" key={workOrder.id}><header><Link href={`/work-orders/${workOrder.id}`}>{workOrder.number}</Link><PlatformBadge tone={badgeToneForStatus(workOrder.status)}>{workOrderStatusLabel[workOrder.status]}</PlatformBadge><PlatformBadge tone={workOrder.safetyRisk === "high" ? "critical" : "warning"}>{workOrder.safetyRisk ?? "unrated"} safety</PlatformBadge></header><h3>{workOrder.title}</h3><p>{workOrder.description}</p><div className="maintenance-internal-meta"><span><MapPin />{store ? `Store ${store.code} · ${store.address1}, ${store.city}` : workOrder.storeId}</span><span><Wrench />{asset ? `${asset.assetTag} · ${asset.name}` : "Equipment can be identified during work"}</span><span><CalendarClock />Due {workOrder.dueAt ? formatDate(workOrder.dueAt, true) : "not set"}</span><span><ClipboardCheck />{completed}/{checklist.length} plan items</span><span><Clock3 />{workOrder.estimatedHours ?? 0}h planned · {workOrder.actualHours ?? 0}h recorded</span><span><Package />{recordedParts.length} material lines</span></div><footer><div><small>Next action</small><strong>{workOrder.nextAction}</strong><span>{workOrder.accountableParty} · escalate to {workOrder.escalation}</span></div><Link className="pf-button pf-button-primary" href={`/work-orders/${workOrder.id}`}>{workOrder.status === "visit_active" ? "Continue work" : "Open assignment"}<ArrowRight /></Link></footer></article>; })}</div> : <PlatformEmpty icon={CheckCircle2} title="No open assignments" description="The selected view has no internal or blended work orders." />}
        </section>
      </div>
    </AppShell>
  );
}

function addDaysUtc(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

function dateKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function mondayOfWeek(value: Date) {
  const day = value.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + offset, 12));
}

export function ScheduleCenter() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignment, setAssignment] = useState("");
  const [category, setCategory] = useState("");
  const start = addDaysUtc(mondayOfWeek(NOW), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => addDaysUtc(start, index));
  const end = addDaysUtc(start, 7);
  const openWork = platformData.workOrders.filter((workOrder) => isOpenWorkOrder(workOrder) && (!assignment || workOrder.assignmentType === assignment) && (!category || workOrder.categoryId === category));
  const dueThisWeek = openWork.filter((workOrder) => workOrder.dueAt && new Date(workOrder.dueAt) >= start && new Date(workOrder.dueAt) < end).sort(managerSort);
  const overdue = openWork.filter((workOrder) => workOrder.dueAt && new Date(workOrder.dueAt) < NOW).sort(managerSort);
  const missingDue = openWork.filter((workOrder) => !workOrder.dueAt).sort(managerSort);
  const criticalWeek = dueThisWeek.filter((workOrder) => workOrder.priority === "critical");

  return (
    <AppShell>
      <div className="pf-page maintenance-page">
        <PlatformBreadcrumbs items={[{ label: "Maintenance", href: "/maintenance" }, { label: "Due-date schedule" }]} />
        <PlatformPageHeader eyebrow="Commitment calendar" title="Due-date schedule" description="See when internal, vendor, blended and unassigned work is due. This calendar does not schedule technicians, build routes or infer provider dispatch activity.">
          <Link className="pf-button pf-button-primary" href="/work-orders/new"><Plus />Create work order</Link>
        </PlatformPageHeader>

        <section className="maintenance-stat-grid" aria-label="Due-date schedule summary">
          <PlatformStat label="Due this week" value={String(dueThisWeek.length)} note={`${criticalWeek.length} critical-priority commitments`} icon={CalendarClock} href="#maintenance-due-calendar" />
          <PlatformStat label="Past due" value={String(overdue.length)} note="Original target dates remain visible" icon={AlertTriangle} href="#maintenance-due-overdue" tone={overdue.length ? "critical" : "positive"} />
          <PlatformStat label="Missing due date" value={String(missingDue.length)} note="Control field requires manager action" icon={FileQuestion} href="#maintenance-due-missing" tone={missingDue.length ? "warning" : "positive"} />
          <PlatformStat label="Service sources" value={String(new Set(dueThisWeek.map((workOrder) => workOrder.vendorId ?? workOrder.assignedToId ?? workOrder.assignmentType)).size)} note="Observed from this week's due work" icon={UsersRound} href="#maintenance-due-calendar" tone="info" />
        </section>

        <section className="maintenance-schedule-controls"><div><button type="button" onClick={() => setWeekOffset((current) => current - 1)}>Previous week</button><button type="button" onClick={() => setWeekOffset(0)}>Current week</button><button type="button" onClick={() => setWeekOffset((current) => current + 1)}>Next week</button></div><strong>{start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} – {addDaysUtc(end, -1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</strong><label><span>Assignment</span><select value={assignment} onChange={(event) => setAssignment(event.target.value)}><option value="">All sources</option><option value="internal">Internal</option><option value="vendor">Outside vendor</option><option value="blended">Blended</option><option value="unassigned">Unassigned</option></select></label><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{platformData.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></section>

        <section className="maintenance-calendar" id="maintenance-due-calendar">
          {days.map((day) => { const work = dueThisWeek.filter((workOrder) => workOrder.dueAt && dateKey(workOrder.dueAt) === dateKey(day)); const isToday = dateKey(day) === dateKey(NOW); return <article className={isToday ? "maintenance-calendar-day maintenance-calendar-today" : "maintenance-calendar-day"} key={dateKey(day)}><header><span>{day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</span><strong>{day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</strong><b>{work.length}</b></header><div>{work.map((workOrder) => <Link className="maintenance-calendar-item" href={`/work-orders/${workOrder.id}`} key={workOrder.id}><div><span>{workOrder.number}</span><PlatformBadge tone={priorityTone(workOrder.priority)}>{priorityLabel[workOrder.priority]}</PlatformBadge></div><strong>{workOrder.title}</strong><small>{workStoreLabel(workOrder)}</small><footer><span>{workProviderName(workOrder)}</span><time>{new Date(workOrder.dueAt!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</time></footer></Link>)}{!work.length && <p className="maintenance-calendar-empty">No work due</p>}</div></article>; })}
        </section>

        <div className="maintenance-schedule-exceptions">
          <section className="maintenance-panel" id="maintenance-due-overdue"><PlatformSectionHeader title="Past-due commitments" description="These remain visible until resolved or explicitly rescheduled with a retained missed date." />{overdue.length ? <CompactWorkTable workOrders={overdue.slice(0, 20)} /> : <PlatformEmpty icon={CheckCircle2} title="No past-due work" description="No visible open work is beyond its target date." />}</section>
          <section className="maintenance-panel" id="maintenance-due-missing"><PlatformSectionHeader title="Work without a due date" description="Every non-terminal work order needs a due date and escalation destination." />{missingDue.length ? <div className="maintenance-missing-due-list">{missingDue.map((workOrder) => <Link href={`/work-orders/${workOrder.id}`} key={workOrder.id}><FileQuestion /><span><strong>{workOrder.number} · {workOrder.title}</strong><small>{workStoreLabel(workOrder)} · accountable: {workOrder.accountableParty}</small></span><ArrowRight /></Link>)}</div> : <PlatformEmpty icon={CheckCircle2} title="Every open record has a due date" description="No due-date control gaps are visible in the current filter." />}</section>
        </div>
      </div>
    </AppShell>
  );
}
