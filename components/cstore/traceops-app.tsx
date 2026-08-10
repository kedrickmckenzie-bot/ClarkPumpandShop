"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileBarChart,
  FileText,
  Gauge,
  Inbox,
  Layers3,
  LayoutDashboard,
  Mail,
  MapPin,
  PackageSearch,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Store as StoreIcon,
  Truck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { demoData } from "@/lib/cstore/demo-data";
import {
  findLifecycleCandidates,
  getAssetLifecycleDecisionFacts,
  type LifecycleCapexPlanDraft,
} from "@/lib/cstore/analytics";
import {
  demoRolePolicies,
  getDemoRolePolicy,
  roleScopeLabel,
  scopeDatasetForRole,
  type DemoRoleId,
  type RolePermission,
  type RoleView,
} from "@/lib/cstore/role-policy";
import type {
  Asset,
  AssetComponent,
  AuditEvent,
  CostLine,
  DemoDataset,
  EvidenceDocument,
  ExceptionRecord,
  Invoice,
  InvoiceWorkLink,
  MaintenanceCategory,
  PmOccurrence,
  PreventiveMaintenancePlan,
  ServiceRequest,
  Store,
  TaxonomyNode,
  Vendor,
  VendorIssuance,
  Visit,
  WorkAssignment,
  WorkOrder,
  WorkStatus,
} from "@/lib/cstore/types";
import {
  createGuidedAssignment,
  createGuidedInvoice,
  createGuidedInvoiceDocument,
  createGuidedInvoiceLink,
  createGuidedIssuance,
  createGuidedRequest,
  createGuidedWorkOrder,
  GUIDED_DEMO_IDS,
  GUIDED_INVOICE_TOTAL_MINOR,
  GUIDED_NTE_MINOR,
  GUIDED_REQUEST_NUMBER,
  GUIDED_VENDOR_REFERENCE,
  GUIDED_WORK_ORDER_NUMBER,
} from "@/lib/cstore/guided-demo";
import {
  GuidedDemoStory,
  type GuidedDemoAction,
  type GuidedDemoAnalyticsDestination,
  type GuidedDemoScenario,
  type GuidedDemoStepId,
} from "./guided-demo-story";
import { TechnicianVisitFlow } from "./technician-visit-flow";
import {
  RequestWorkspace,
  type EmployeeIssueDraft,
  type RequestInboxItem,
  type RequestInboxValue,
  type SubmittedRequestReceipt,
} from "./request-workspace";
import { GuidedStoreSetup } from "./guided-store-setup";
import { WorkClassificationEditor } from "./work-classification-editor";
import { WorkOrderCreation } from "./work-order-creation";
import type { GuidedStoreSetupValue, WorkClassificationValue } from "./setup-workflows";
import {
  VendorServiceAuthorization,
  type ServiceAuthorizationLifecycleReview,
} from "./vendor-service-authorization";
import { VendorPicker } from "./vendor-picker";
import {
  InvoiceEvidenceDetail,
  InvoiceEvidenceQueue,
  type InvoiceEvidenceQueueValue,
} from "./maintenance-cost-review";
import {
  MaintenanceSpendWorkspace,
  defaultMaintenanceSpendState,
  maintenanceSpendWorkOrderIds,
  type MaintenanceSpendState,
} from "./maintenance-spend-workspace";
import { LifecyclePlanning } from "./lifecycle-planning";
import {
  ActiveVisitWorkspace,
  ExceptionQueue,
  type OperationsSourceReference,
} from "./operations-drilldowns";
import {
  AssetSetupForm,
  ComponentSetupForm,
  PmOccurrenceDetail,
  PmPlanForm,
  StoreServiceAreasForm,
  VendorOnboardingForm,
  type AssetSetupValue,
  type ComponentSetupValue,
  type PmOccurrenceCompletionValue,
  type PmOccurrenceWaiverValue,
  type PmPlanSetupValue,
  type StoreServiceAreasValue,
  type VendorOnboardingValue,
} from "./platform-setup-workflows";
import {
  MaintenanceCostEntryForm,
  VendorProposalReview,
  WorkCompletionReview,
  type MaintenanceCostEntryValue,
  type VendorProposalReviewValue,
  type WorkCompletionReviewValue,
} from "./work-lifecycle-workflows";
import {
  TaxonomyManager,
  type TaxonomyCategoryCreateValue,
  type TaxonomyCategoryUpdateValue,
  type TaxonomyNodeCreateValue,
  type TaxonomyNodeUpdateValue,
} from "./taxonomy-manager";
import type {
  ActiveVisit,
  ServiceAuthorizationRecord,
  StoreOption,
  VisitChannel as WorkflowVisitChannel,
  VisitCheckInValue,
  VisitCheckOutValue,
  VisitEvidence,
  VendorOption,
  WorkOrderCreationValue,
} from "./types";

type View = RoleView;
type Drawer = "create-work" | "request-form" | "assign-vendor" | "issue-vendor" | "record-invoice" | "record-cost" | "completion-review" | "vendor-proposal" | "store-portal" | "visit" | "capabilities" | "taxonomy" | "new-store" | "classify-work" | "new-vendor" | "new-asset" | "new-component" | "store-services" | "new-pm" | "pm-update" | "internal-update" | "report-builder" | null;
type Detail = { kind: "store" | "work" | "vendor" | "asset" | "invoice" | "pm" | "visit" | "report"; id: string } | null;
type PmScheduleFilter = "all" | "compliance_window" | "due_upcoming" | "overdue" | "due" | "upcoming" | "completed" | "waived" | "active_plans";
type PmScheduleSort = "due_asc" | "due_desc" | "status";
interface CapabilityConfig {
  vendorAcceptance: boolean;
  locationEvidence: boolean;
  invoiceSafeguard: boolean;
  preventiveMaintenance: boolean;
  equipmentLifecycle: boolean;
}

type GuidedDemoStage = "request" | "review" | "vendor" | "authorization" | "visit" | "analytics";

interface GuidedDemoState {
  stage: GuidedDemoStage;
  selectedVendorId: string;
  externalWindowOpened: boolean;
  vendorResponse?: "accepted" | "declined" | "date_proposed";
  activeVisitId?: string;
  invoiceLinked: boolean;
}

interface SpendPreset {
  regionId: string;
  storeId: string;
  categoryId: string;
  mode?: "overview" | "evidence_review";
}

interface InvoiceEntryValue {
  invoiceNumber: string;
  laborMinor: number;
  materialsMinor: number;
  tripMinor: number;
  file: File | null;
}

interface SavedReportRecord {
  id: string;
  title: string;
  template: "operating_review" | "vendor_accountability" | "lifecycle_review";
  scopeLabel: string;
  periodLabel: string;
  costBasis: "recorded" | "authorized" | "invoice_linked";
  createdAt: string;
  version: number;
  sourceWorkOrderIds: string[];
  sourceSnapshots: SavedReportSourceSnapshot[];
}

interface SavedReportSourceSnapshot {
  workOrderId: string;
  number: string;
  title: string;
  storeNumber: string;
  storeCity: string;
  status: WorkStatus;
  categoryLabel: string;
  amountMinor: number;
}

interface InternalWorkUpdateValue {
  action: "acknowledge" | "start" | "complete";
  outcome?: "resolved" | "diagnosed_waiting_parts" | "temporary_repair" | "unresolved";
  note?: string;
  recordedCostMinor?: number;
}

interface ReportBuilderValue {
  title: string;
  periodLabel: string;
  costBasis: SavedReportRecord["costBasis"];
}

const initialGuidedDemoState: GuidedDemoState = {
  stage: "request",
  selectedVendorId: GUIDED_DEMO_IDS.preferredVendor,
  externalWindowOpened: false,
  invoiceLinked: false,
};

const initialEmployeeIssueDraft: EmployeeIssueDraft = {
  employeeName: "Lee Bryant",
  employeeId: "E2104",
  problem: "The beer cave is warm. The display reads 48°F and the product feels warmer than normal.",
  reportedLocation: "Rear sales floor · Beer cave entrance",
  urgency: "urgent",
  photo: null,
};

const initialRequestInboxValue: RequestInboxValue = {
  query: "",
  filter: "needs_review",
  selectedRequestId: null,
};

const navItems: Array<{ view: View; label: string; icon: typeof LayoutDashboard }> = [
  { view: "today", label: "Today", icon: LayoutDashboard },
  { view: "requests", label: "Requests", icon: Inbox },
  { view: "stores", label: "Stores", icon: StoreIcon },
  { view: "work", label: "Work", icon: ClipboardList },
  { view: "vendors", label: "Vendors", icon: Truck },
  { view: "spend", label: "Spend", icon: CircleDollarSign },
  { view: "equipment", label: "Lifecycle & CapEx", icon: Gauge },
  { view: "pm", label: "Preventive maintenance", icon: CalendarCheck },
  { view: "reports", label: "Reports", icon: FileBarChart },
];

const terminalStatuses = new Set<WorkStatus>(["closed", "cancelled"]);

function nowMilliseconds() {
  return new Date().getTime();
}

function money(minor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function costDonutBackground(rows: Array<{ cost: number; color: string }>, total: number) {
  if (!total || !rows.length) return "#e5ecea";
  const result = rows.reduce(
    (current, row) => {
      const nextCursor = current.cursor + (row.cost / total) * 100;
      return {
        cursor: nextCursor,
        stops: [...current.stops, `${row.color} ${current.cursor}% ${nextCursor}%`],
      };
    },
    { cursor: 0, stops: [] as string[] },
  );
  const stops = result.cursor < 100
    ? [...result.stops, `#e5ecea ${result.cursor}% 100%`]
    : result.stops;
  return `conic-gradient(${stops.join(", ")})`;
}

function dateLabel(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}

function timeLabel(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function words(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): "red" | "amber" | "green" | "blue" | "teal" | "" {
  if (["emergency", "unresolved", "declined", "overdue", "critical"].includes(status)) return "red";
  if (["urgent", "waiting_parts", "awaiting_vendor_response", "needs_review", "warning"].includes(status)) return "amber";
  if (["completed", "closed", "accepted", "approved", "preferred"].includes(status)) return "green";
  if (["onsite", "scheduled", "issued", "active"].includes(status)) return "blue";
  if (["open", "ready_to_issue", "invoice_received"].includes(status)) return "teal";
  return "";
}

function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`to-badge ${statusTone(value)}`}>{label ?? words(value)}</span>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function invoiceTotal(dataset: DemoDataset, invoiceId: string) {
  const invoice = dataset.invoices.find((record) => record.id === invoiceId);
  return invoice?.lineItems.reduce((sum, line) => sum + line.amountMinor, 0) ?? 0;
}

function workOrderCost(dataset: DemoDataset, workOrderId: string) {
  const recorded = dataset.costLines
    .filter((line) => line.workOrderId === workOrderId && line.basis === "recorded")
    .reduce((sum, line) => sum + line.amountMinor, 0);
  if (recorded) return recorded;
  const linked = dataset.invoiceWorkLinks
    .filter((link) => link.workOrderId === workOrderId)
    .reduce((sum, link) => sum + link.attributedAmountMinor, 0);
  return linked;
}

function recordedMaintenanceCost(dataset: DemoDataset, workOrderId: string) {
  const recorded = dataset.costLines
    .filter((line) => line.workOrderId === workOrderId && line.basis === "recorded")
    .reduce((sum, line) => sum + line.amountMinor, 0);
  return recorded || dataset.invoiceWorkLinks
    .filter((link) => link.workOrderId === workOrderId)
    .reduce((sum, link) => sum + link.attributedAmountMinor, 0);
}

function storeSpend(dataset: DemoDataset, storeId: string) {
  return dataset.workOrders
    .filter((work) => work.storeId === storeId)
    .reduce((sum, work) => sum + recordedMaintenanceCost(dataset, work.id), 0);
}

function categorySpend(dataset: DemoDataset, categoryId: string) {
  return dataset.workOrders
    .filter((work) => work.categoryId === categoryId)
    .reduce((sum, work) => sum + recordedMaintenanceCost(dataset, work.id), 0);
}

function vendorSpend(dataset: DemoDataset, vendorId: string) {
  const workIds = new Set(dataset.assignments
    .filter((assignment) => assignment.partyType === "vendor" && assignment.partyId === vendorId)
    .map((assignment) => assignment.workOrderId));
  return dataset.workOrders
    .filter((work) => workIds.has(work.id))
    .reduce((sum, work) => sum + recordedMaintenanceCost(dataset, work.id), 0);
}

function workForStore(dataset: DemoDataset, storeId: string) {
  return dataset.workOrders.filter((work) => work.storeId === storeId);
}

function facilitiesOwner(dataset: DemoDataset) {
  return dataset.people.find((person) => person.roles.includes("facilities_manager")) ?? dataset.people[0];
}

function isInvoiceException(record: ExceptionRecord) {
  return Boolean(record.invoiceId) || record.type.startsWith("invoice_") || record.type === "duplicate_invoice_reference";
}

function reportPeriodFromLabel(periodLabel: string): MaintenanceSpendState["period"] | "last_quarter" {
  const normalized = periodLabel.toLowerCase();
  if (normalized.includes("last completed quarter")) return "last_quarter";
  if (normalized.includes("month to date")) return "month";
  if (normalized.includes("year to date")) return "ytd";
  return "trailing_12";
}

function reportPeriodRange(periodLabel: string, asOf: string) {
  const parsedAsOf = Date.parse(asOf);
  const end = new Date(Math.max(Number.isFinite(parsedAsOf) ? parsedAsOf : 0, nowMilliseconds()));
  const period = reportPeriodFromLabel(periodLabel);
  const start = new Date(end);
  if (period === "trailing_12") start.setUTCFullYear(start.getUTCFullYear() - 1);
  if (period === "ytd") {
    start.setUTCMonth(0, 1);
    start.setUTCHours(0, 0, 0, 0);
  }
  if (period === "month") {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
  }
  if (period === "last_quarter") {
    const quarterStartMonth = Math.floor(end.getUTCMonth() / 3) * 3;
    end.setUTCMonth(quarterStartMonth, 1);
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCMilliseconds(-1);
    start.setTime(end.getTime());
    start.setUTCMonth(end.getUTCMonth() - 2, 1);
    start.setUTCHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function reportWorkMatchesSpendScope(dataset: DemoDataset, work: WorkOrder, state: MaintenanceSpendState) {
  const store = dataset.stores.find((record) => record.id === work.storeId);
  const vendorId = dataset.assignments
    .filter((assignment) => assignment.workOrderId === work.id && assignment.partyType === "vendor" && assignment.status !== "declined")
    .sort((left, right) => right.assignedAt.localeCompare(left.assignedAt))[0]?.partyId;
  return Boolean(
    store &&
    (state.regionId === "all" || store.regionId === state.regionId) &&
    (state.storeId === "all" || store.id === state.storeId) &&
    (state.categoryId === "all" || (state.categoryId === "unclassified" ? !work.categoryId : work.categoryId === state.categoryId)) &&
    (state.vendorId === "all" || (state.vendorId === "no_vendor" ? !vendorId : vendorId === state.vendorId))
  );
}

function createReportSourceSnapshot(
  dataset: DemoDataset,
  workOrderId: string,
  costBasis: SavedReportRecord["costBasis"],
): SavedReportSourceSnapshot | null {
  const work = dataset.workOrders.find((record) => record.id === workOrderId);
  if (!work) return null;
  const store = dataset.stores.find((record) => record.id === work.storeId);
  const category = dataset.categories.find((record) => record.id === work.categoryId);
  const approvedLine = dataset.costLines
    .filter((line) => line.workOrderId === work.id && line.basis === "approved")
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
  const latestIssuance = dataset.vendorIssuances
    .filter((issuance) => issuance.workOrderId === work.id && issuance.notToExceedMinor != null)
    .sort((left, right) => right.version - left.version)[0];
  const amountMinor = costBasis === "authorized"
    ? approvedLine?.amountMinor ?? latestIssuance?.notToExceedMinor ?? work.notToExceedMinor ?? 0
    : costBasis === "invoice_linked"
      ? dataset.invoiceWorkLinks
          .filter((link) => link.workOrderId === work.id)
          .reduce((sum, link) => sum + link.attributedAmountMinor, 0)
      : recordedMaintenanceCost(dataset, work.id);
  return {
    workOrderId: work.id,
    number: work.number,
    title: work.title,
    storeNumber: store?.storeNumber ?? "Unknown",
    storeCity: store?.address.city ?? "Unknown location",
    status: work.status,
    categoryLabel: category?.label ?? "Unclassified",
    amountMinor,
  };
}

function nextPmDueAt(dueAt: string, cadence: PreventiveMaintenancePlan["cadence"]) {
  const next = new Date(dueAt);
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : cadence === "semiannual" ? 6 : 12;
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString();
}

function domainVisitChannel(channel: WorkflowVisitChannel): Visit["channelStarted"] {
  return channel === "app"
    ? "vendor_app"
    : channel === "qr"
      ? "qr_mobile_web"
      : channel === "store_kiosk"
        ? "store_kiosk"
        : "secure_work_link";
}

function domainVisitEvidence(evidence: VisitEvidence): Pick<Visit, "evidenceStrength" | "locationEvidence"> {
  const locationVerified = evidence.state === "location_verified";
  const kioskRecorded = evidence.state === "store_kiosk_recorded";
  return {
    evidenceStrength: locationVerified
      ? "location_verified"
      : kioskRecorded
        ? "store_kiosk"
        : "manual_unverified",
    locationEvidence: {
      required: !kioskRecorded,
      consented: locationVerified || evidence.state === "outside_geofence",
      capturedAt: evidence.capturedAt,
      accuracyMeters: evidence.accuracyMeters,
      distanceFromStoreMeters: evidence.distanceMeters,
      verification: locationVerified
        ? "inside_geofence"
        : evidence.state === "outside_geofence"
          ? "outside_geofence"
          : "not_collected",
    },
  };
}

function domainVisitOutcome(outcome: VisitCheckOutValue["outcome"]): NonNullable<Visit["outcome"]> {
  if (outcome === "preventive_service_complete") return "preventive_complete";
  if (outcome === "return_visit_required") return "unresolved";
  return outcome;
}

function PageHead({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="to-page-head">
      <div>
        <p className="to-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children ? <div className="to-head-actions">{children}</div> : null}
    </header>
  );
}

export function TraceOpsApp() {
  const [view, setView] = useState<View>("today");
  const [detail, setDetail] = useState<Detail>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [roleId, setRoleId] = useState<DemoRoleId>("facilities_manager");
  const [globalQuery, setGlobalQuery] = useState("");
  const [stores, setStores] = useState<Store[]>(demoData.stores);
  const [categories, setCategories] = useState<MaintenanceCategory[]>(demoData.categories);
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>(demoData.taxonomyNodes);
  const [vendors, setVendors] = useState<Vendor[]>(demoData.vendors);
  const [assets, setAssets] = useState<Asset[]>(demoData.assets);
  const [assetComponents, setAssetComponents] = useState<AssetComponent[]>(demoData.assetComponents);
  const [pmPlans, setPmPlans] = useState<PreventiveMaintenancePlan[]>(demoData.pmPlans);
  const [pmOccurrences, setPmOccurrences] = useState<PmOccurrence[]>(demoData.pmOccurrences);
  const [requests, setRequests] = useState<ServiceRequest[]>(demoData.requests);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => demoData.workOrders.map((work) =>
    work.status === "awaiting_invoice" || work.status === "invoice_received"
      ? { ...work, status: "completed" as const }
      : work,
  ));
  const [assignments, setAssignments] = useState<WorkAssignment[]>(demoData.assignments);
  const [issuances, setIssuances] = useState<VendorIssuance[]>(demoData.vendorIssuances);
  const [visits, setVisits] = useState<Visit[]>(demoData.visits);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>(demoData.exceptions);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(demoData.auditEvents);
  const [costLines, setCostLines] = useState<CostLine[]>(demoData.costLines);
  const [invoices, setInvoices] = useState<Invoice[]>(demoData.invoices);
  const [invoiceWorkLinks, setInvoiceWorkLinks] = useState<InvoiceWorkLink[]>(demoData.invoiceWorkLinks);
  const [documents, setDocuments] = useState<EvidenceDocument[]>(demoData.documents);
  const [pendingAuthorization, setPendingAuthorization] = useState<ServiceAuthorizationRecord | null>(null);
  const [visitStoreId, setVisitStoreId] = useState<string | null>(null);
  const [visitVendorId, setVisitVendorId] = useState<string | null>(null);
  const [visitWorkOrderId, setVisitWorkOrderId] = useState<string | null>(null);
  const [visitWorkspaceInitialId, setVisitWorkspaceInitialId] = useState<string | null>(null);
  const [storePortalStoreId, setStorePortalStoreId] = useState<string>(GUIDED_DEMO_IDS.store);
  const [requestStoreId, setRequestStoreId] = useState<string>(GUIDED_DEMO_IDS.store);
  const [assignmentWorkId, setAssignmentWorkId] = useState<string | null>(null);
  const [assignmentVendorId, setAssignmentVendorId] = useState<string>(GUIDED_DEMO_IDS.preferredVendor);
  const [assignmentTeamId, setAssignmentTeamId] = useState<string>(demoData.teams[0]?.id ?? "");
  const [assignmentMode, setAssignmentMode] = useState<"internal" | "external">("internal");
  const [invoiceWorkId, setInvoiceWorkId] = useState<string | null>(null);
  const [costWorkId, setCostWorkId] = useState<string | null>(null);
  const [completionWorkId, setCompletionWorkId] = useState<string | null>(null);
  const [proposalWorkId, setProposalWorkId] = useState<string | null>(null);
  const [workflowStoreId, setWorkflowStoreId] = useState<string | null>(null);
  const [workflowAssetId, setWorkflowAssetId] = useState<string | null>(null);
  const [internalWorkId, setInternalWorkId] = useState<string | null>(null);
  const [reportTemplate, setReportTemplate] = useState<SavedReportRecord["template"] | null>(null);
  const [reportCostBasisPreset, setReportCostBasisPreset] = useState<SavedReportRecord["costBasis"]>("recorded");
  const [reportSpendPreset, setReportSpendPreset] = useState<MaintenanceSpendState | null>(null);
  const [employeeIssueDraft, setEmployeeIssueDraft] = useState<EmployeeIssueDraft>(initialEmployeeIssueDraft);
  const [requestReceipt, setRequestReceipt] = useState<SubmittedRequestReceipt | null>(null);
  const [requestInboxValue, setRequestInboxValue] = useState<RequestInboxValue>(initialRequestInboxValue);
  const [requestNumbers, setRequestNumbers] = useState<Record<string, string>>({});
  const [workInitialStoreId, setWorkInitialStoreId] = useState<string | null>(null);
  const [classificationWorkId, setClassificationWorkId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReportRecord[]>([]);
  const [draftAcceptanceByWork, setDraftAcceptanceByWork] = useState<Record<string, boolean>>({});
  const [guidedDemo, setGuidedDemo] = useState<GuidedDemoState>(initialGuidedDemoState);
  const [spendPreset, setSpendPreset] = useState<SpendPreset | null>(null);
  const [maintenanceSpendState, setMaintenanceSpendState] = useState<MaintenanceSpendState>(defaultMaintenanceSpendState);
  const [lifecycleTab, setLifecycleTab] = useState<"review" | "capex" | "equipment">("review");
  const [capexDrafts, setCapexDrafts] = useState<Record<string, LifecycleCapexPlanDraft>>({});
  const [pmScheduleFilter, setPmScheduleFilter] = useState<PmScheduleFilter>("all");
  const [pmScheduleSort, setPmScheduleSort] = useState<PmScheduleSort>("due_asc");
  const [invoiceEvidenceQueueValue, setInvoiceEvidenceQueueValue] = useState<InvoiceEvidenceQueueValue>({ filter: "needs_review", query: "" });
  const [invoiceDetailReturn, setInvoiceDetailReturn] = useState<"spend" | "evidence" | "exceptions">("evidence");
  const [capabilities, setCapabilities] = useState<CapabilityConfig>({
    vendorAcceptance: true,
    locationEvidence: true,
    invoiceSafeguard: true,
    preventiveMaintenance: true,
    equipmentLifecycle: true,
  });

  const fullDataset = useMemo<DemoDataset>(
    () => ({
      ...demoData,
      stores,
      categories,
      taxonomyNodes,
      vendors,
      assets,
      assetComponents,
      pmPlans,
      pmOccurrences,
      requests,
      workOrders,
      assignments,
      vendorIssuances: issuances,
      visits,
      exceptions,
      auditEvents,
      costLines,
      invoices,
      invoiceWorkLinks,
      documents,
    }),
    [assetComponents, assets, assignments, auditEvents, categories, costLines, documents, exceptions, invoiceWorkLinks, invoices, issuances, pmOccurrences, pmPlans, requests, stores, taxonomyNodes, vendors, visits, workOrders],
  );

  const rolePolicy = getDemoRolePolicy(roleId);
  const dataset = useMemo(
    () => scopeDatasetForRole(fullDataset, rolePolicy),
    [fullDataset, rolePolicy],
  );
  const activePerson = fullDataset.people.find((person) => person.id === rolePolicy.personId) ?? fullDataset.people[0];
  const scopeLabel = roleScopeLabel(fullDataset, rolePolicy);
  function maintenanceScopeLabel(state: MaintenanceSpendState) {
    return [
      scopeLabel,
      state.regionId !== "all" ? dataset.regions.find((region) => region.id === state.regionId)?.name : undefined,
      state.storeId !== "all" ? `Store ${dataset.stores.find((store) => store.id === state.storeId)?.storeNumber}` : undefined,
      state.categoryId !== "all" ? dataset.categories.find((category) => category.id === state.categoryId)?.label ?? (state.categoryId === "unclassified" ? "Unclassified" : undefined) : undefined,
      state.vendorId !== "all" ? dataset.vendors.find((vendor) => vendor.id === state.vendorId)?.displayName ?? (state.vendorId === "no_vendor" ? "Internal / no outside vendor" : undefined) : undefined,
    ].filter(Boolean).join(" · ");
  }
  const maintenanceSpendScopeLabel = maintenanceScopeLabel(maintenanceSpendState);

  useEffect(() => {
    function handleGuidedVendorResponse(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = event.data as {
        type?: string;
        scenarioId?: string;
        response?: string;
        payload?: { scenarioId?: string; response?: string; proposedDate?: string; proposedTime?: string };
      } | null;
      const scenarioId = message?.payload?.scenarioId ?? message?.scenarioId;
      const rawResponse = message?.payload?.response ?? message?.response;
      if (message?.type !== "traceops:guided-vendor-response" || !scenarioId) return;
      if (!rawResponse || !["accepted", "declined", "date_proposed"].includes(rawResponse)) return;
      const response = rawResponse as "accepted" | "declined" | "date_proposed";
      const occurredAt = new Date().toISOString();
      const proposedArrivalAt = response === "date_proposed"
        ? message?.payload?.proposedDate
          ? new Date(`${message.payload.proposedDate}T${message.payload.proposedTime || "12:00"}:00`).toISOString()
          : new Date(nowMilliseconds() + 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      if (scenarioId === GUIDED_DEMO_IDS.workOrder) {
        setGuidedDemo((current) => ({
          ...current,
          stage: response === "accepted" ? "visit" : response === "declined" ? "vendor" : "authorization",
          vendorResponse: response,
        }));
      }
      setIssuances((current) => {
        const latest = current
          .filter((issuance) => issuance.workOrderId === scenarioId)
          .sort((left, right) => right.version - left.version)[0];
        return current.map((issuance) => issuance.id === latest?.id ? {
          ...issuance,
          response,
          respondedAt: occurredAt,
          vendorReference: scenarioId === GUIDED_DEMO_IDS.workOrder && response !== "declined"
            ? GUIDED_VENDOR_REFERENCE
            : issuance.vendorReference,
          proposedArrivalAt,
        } : issuance);
      });
      setAssignments((current) => current.map((assignment) => assignment.workOrderId === scenarioId && assignment.partyType === "vendor" ? {
        ...assignment,
        status: response === "accepted" ? "accepted" : response === "declined" ? "declined" : "acknowledged",
        acknowledgedAt: occurredAt,
      } : assignment));
      setWorkOrders((current) => current.map((work) => work.id === scenarioId ? {
        ...work,
        fulfillmentMode: response === "declined" ? "unassigned" : "external",
        status: response === "accepted" ? "accepted" : response === "declined" ? "draft" : "awaiting_vendor_response",
        scheduledWindow: work.scheduledWindow,
        accountable: work.accountable ? {
          ...work.accountable,
          nextAction: response === "accepted"
            ? "Vendor technician checks in at the assigned store"
            : response === "declined"
              ? "Store manager chooses another approved vendor"
              : "Store manager reviews the proposed service date",
        } : work.accountable,
      } : work));
      setAuditEvents((current) => [{
        id: `audit-vendor-response-${scenarioId}-${nowMilliseconds()}`,
        organizationId: demoData.organization.id,
        entityType: "work_order",
        entityId: scenarioId,
        eventType: `vendor_${response}`,
        actorType: "vendor_contact",
        channel: "vendor_link",
        occurredAt,
        summary: `Vendor ${response.replaceAll("_", " ")}`,
        payloadSnapshot: { workOrderId: scenarioId, response },
        demoMode: true,
      }, ...current]);
      setNotice(response === "accepted" ? "Vendor acceptance received from the external work-order window. The work order is ready for technician check-in." : response === "declined" ? "Vendor declined. The work returned for reassignment without losing its request history." : "Vendor proposed a date. The proposal is recorded on the work order for manager review.");
    }

    window.addEventListener("message", handleGuidedVendorResponse);
    return () => window.removeEventListener("message", handleGuidedVendorResponse);
  }, []);

  const activeVisits = dataset.visits.filter((visit) => !visit.checkedOutAt);
  const openExceptions = dataset.exceptions.filter((record) => record.status !== "resolved");
  const visibleOpenExceptions = capabilities.invoiceSafeguard
    ? openExceptions
    : openExceptions.filter((record) => !isInvoiceException(record));
  const classificationWork = classificationWorkId
    ? dataset.workOrders.find((record) => record.id === classificationWorkId)
    : undefined;
  const classificationStore = classificationWork
    ? dataset.stores.find((record) => record.id === classificationWork.storeId)
    : undefined;
  const requestStore = dataset.stores.find((record) => record.id === requestStoreId) ?? dataset.stores[0];
  const assignmentWork = assignmentWorkId
    ? dataset.workOrders.find((record) => record.id === assignmentWorkId)
    : undefined;
  const invoiceWork = invoiceWorkId
    ? dataset.workOrders.find((record) => record.id === invoiceWorkId)
    : undefined;
  const invoiceAssignment = invoiceWork
    ? dataset.assignments.find((record) => record.workOrderId === invoiceWork.id && record.partyType === "vendor" && record.status !== "declined")
    : undefined;
  const invoiceVendor = invoiceAssignment
    ? dataset.vendors.find((record) => record.id === invoiceAssignment.partyId)
    : undefined;
  const costWork = costWorkId
    ? dataset.workOrders.find((record) => record.id === costWorkId)
    : undefined;
  const completionWork = completionWorkId
    ? dataset.workOrders.find((record) => record.id === completionWorkId)
    : undefined;
  const proposalWork = proposalWorkId
    ? dataset.workOrders.find((record) => record.id === proposalWorkId)
    : undefined;
  const proposalIssuance = proposalWork
    ? dataset.vendorIssuances
      .filter((record) => record.workOrderId === proposalWork.id)
      .sort((left, right) => right.version - left.version)[0]
    : undefined;
  const proposalVendor = proposalIssuance
    ? dataset.vendors.find((record) => record.id === proposalIssuance.vendorId)
    : undefined;
  const internalWork = internalWorkId
    ? dataset.workOrders.find((record) => record.id === internalWorkId)
    : undefined;
  const internalAssignment = internalWork
    ? dataset.assignments.find((record) => record.workOrderId === internalWork.id && record.partyType === "team")
    : undefined;
  const internalTeam = internalAssignment
    ? dataset.teams.find((record) => record.id === internalAssignment.partyId)
    : undefined;
  const roleNavItems = navItems.filter((item) => rolePolicy.allowedViews.includes(item.view));
  const intelligenceNavItems = roleNavItems.slice().filter((item) => ["spend", "equipment", "pm", "reports"].includes(item.view)).filter((item) =>
    item.view === "equipment"
      ? capabilities.equipmentLifecycle
      : item.view === "pm"
        ? capabilities.preventiveMaintenance
        : true,
  );
  const mobileNavItems = roleNavItems
    .filter((item) => item.view !== "equipment" || capabilities.equipmentLifecycle)
    .filter((item) => item.view !== "pm" || capabilities.preventiveMaintenance)
    .slice(0, 5);

  const storeOptions: StoreOption[] = dataset.stores.map((store) => ({
    id: store.id,
    storeNumber: store.storeNumber,
    name: store.name,
    address: `${store.address.line1}, ${store.address.city}, ${store.address.state}`,
    regionName: dataset.regions.find((region) => region.id === store.regionId)?.name,
  }));

  const vendorOptions: VendorOption[] = dataset.vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.displayName,
    description: vendor.description,
    specialties: vendor.specialties.map((specialty) => specialty.label),
    aliases: [...vendor.aliases, ...vendor.searchTerms],
    coverage: vendor.coverageRegionIds.map(
      (regionId) => dataset.regions.find((region) => region.id === regionId)?.name ?? "Regional coverage",
    ),
    coveredStoreIds: dataset.stores
      .filter((store) => store.regionId && vendor.coverageRegionIds.includes(store.regionId))
      .map((store) => store.id),
    preferredStoreIds: vendor.preferredStoreIds,
    dispatchEmail: vendor.contacts.find((contact) => contact.role === "dispatch")?.email,
    dispatchPhone: vendor.contacts.find((contact) => contact.role === "dispatch")?.phone,
    afterHoursLabel: vendor.afterHoursAvailable ? "24/7 emergency dispatch" : "Standard dispatch hours",
  }));

  const guidedStore = fullDataset.stores.find((record) => record.id === GUIDED_DEMO_IDS.store);
  const guidedRegion = fullDataset.regions.find((record) => record.id === guidedStore?.regionId);
  const guidedEmployee = fullDataset.people.find((record) => record.id === GUIDED_DEMO_IDS.employee);
  const guidedManager = fullDataset.people.find((record) => record.id === GUIDED_DEMO_IDS.manager);
  const guidedVendor = fullDataset.vendors.find((record) => record.id === guidedDemo.selectedVendorId);
  const guidedAsset = fullDataset.assets.find((record) => record.id === GUIDED_DEMO_IDS.asset);
  const guidedCategory = fullDataset.categories.find((record) => record.id === GUIDED_DEMO_IDS.category);
  const guidedTaxonomy = fullDataset.taxonomyNodes.find((record) => record.id === GUIDED_DEMO_IDS.taxonomy);
  const guidedRequest = fullDataset.requests.find((record) => record.id === GUIDED_DEMO_IDS.request);
  const guidedWork = fullDataset.workOrders.find((record) => record.id === GUIDED_DEMO_IDS.workOrder);
  const guidedAssignment = fullDataset.assignments.find((record) => record.id === GUIDED_DEMO_IDS.assignment);
  const guidedIssuance = fullDataset.vendorIssuances.find((record) => record.id === GUIDED_DEMO_IDS.issuance);
  const guidedDomainVisit = fullDataset.visits.find((record) => record.workOrderId === GUIDED_DEMO_IDS.workOrder);
  const guidedInvoiceLink = fullDataset.invoiceWorkLinks.find((record) => record.id === GUIDED_DEMO_IDS.invoiceLink);
  const guidedInvoice = fullDataset.invoices.find((record) => record.id === GUIDED_DEMO_IDS.invoice);
  const guidedStoreOption = storeOptions.find((record) => record.id === GUIDED_DEMO_IDS.store);

  const guidedStepByStage: Record<GuidedDemoStage, GuidedDemoStepId> = {
    request: "employee_request",
    review: "manager_review",
    vendor: "vendor_selection",
    authorization: "external_work_order",
    visit: "technician_visit",
    analytics: "analytics_handoff",
  };
  const guidedStageByStep: Record<GuidedDemoStepId, GuidedDemoStage> = {
    employee_request: "request",
    manager_review: "review",
    vendor_selection: "vendor",
    external_work_order: "authorization",
    technician_visit: "visit",
    analytics_handoff: "analytics",
  };
  const guidedCompletedSteps: GuidedDemoStepId[] = [
    ...(guidedRequest ? ["employee_request" as const] : []),
    ...(guidedWork ? ["manager_review" as const] : []),
    ...(guidedAssignment ? ["vendor_selection" as const] : []),
    ...(guidedIssuance?.response === "accepted" || guidedDomainVisit || guidedInvoiceLink
      ? ["external_work_order" as const]
      : []),
    ...(guidedDomainVisit?.checkedOutAt || guidedInvoiceLink ? ["technician_visit" as const] : []),
  ];
  const guidedUnlockedSteps: GuidedDemoStepId[] = [
    "employee_request",
    ...(guidedRequest ? ["manager_review" as const] : []),
    ...(guidedWork ? ["vendor_selection" as const] : []),
    ...(guidedAssignment ? ["external_work_order" as const] : []),
    ...(guidedIssuance?.response === "accepted" || guidedDomainVisit || guidedInvoiceLink
      ? ["technician_visit" as const]
      : []),
    ...(guidedInvoiceLink ? ["analytics_handoff" as const] : []),
  ];
  const guidedScenario: GuidedDemoScenario = {
    store: {
      id: guidedStore?.id ?? GUIDED_DEMO_IDS.store,
      number: guidedStore?.storeNumber ?? "104",
      name: guidedStore?.name ?? "Northline West Broad",
      address: guidedStore
        ? `${guidedStore.address.line1}, ${guidedStore.address.city}, ${guidedStore.address.state} ${guidedStore.address.postalCode}`
        : "2875 West Broad Street, Columbus, OH 43204",
      region: guidedRegion?.name ?? "Central Ohio",
    },
    employee: { name: guidedEmployee?.displayName ?? "Lee Bryant", role: "Store associate" },
    manager: { name: guidedManager?.displayName ?? "Robin Flores", approvalLimitLabel: "$1,500 store approval limit" },
    request: {
      number: GUIDED_REQUEST_NUMBER,
      submittedAtLabel: "Today · 9:12 AM",
      problem: guidedRequest?.immutableDescription ?? "The beer cave is warm. The display reads 48°F and the product feels warmer than normal.",
      reportedLocation: guidedRequest?.reportedLocation ?? "Rear sales floor · Beer cave entrance",
      priority: guidedRequest?.urgency ?? "urgent",
      photoCount: 2,
    },
    vendor: {
      id: guidedVendor?.id ?? GUIDED_DEMO_IDS.preferredVendor,
      name: guidedVendor?.displayName ?? "Summit Refrigeration",
      specialty: guidedVendor?.specialties.flatMap((specialty) => [specialty.label, ...specialty.equipmentTypes.slice(0, 2)]).join(" · ") ?? "Commercial refrigeration · Beer caves",
      coverageLabel: guidedRegion ? `Covers Store 104 and ${guidedRegion.name}` : "Covers Store 104 and Central Ohio",
      relationshipLabel: guidedVendor?.status === "preferred" ? "Preferred refrigeration partner" : "Approved service partner",
    },
    workOrder: {
      number: guidedWork?.number ?? GUIDED_WORK_ORDER_NUMBER,
      title: guidedWork?.title ?? "Beer cave holding at 48°F",
      categoryLabel: guidedCategory?.label ?? "Refrigeration",
      taxonomyLabel: `Walk-in refrigeration › ${guidedTaxonomy?.label ?? "Beer cave"}`,
      assetLabel: guidedAsset ? `${guidedAsset.name} · ${guidedAsset.assetCode}` : "Beer Cave Refrigeration System · 104-REF-BC-1",
      nteLabel: `${money(guidedWork?.notToExceedMinor ?? GUIDED_NTE_MINOR)} not to exceed`,
      requestedWindowLabel: "Service requested today, before 2:00 PM",
    },
    visit: {
      technicianName: guidedDomainVisit?.technicianName ?? "Marcus Hill",
      channelLabel: "Store QR mobile web",
      checkInLabel: guidedDomainVisit ? timeLabel(guidedDomainVisit.checkedInAt) : "10:03 AM",
      checkOutLabel: guidedDomainVisit?.checkedOutAt ? timeLabel(guidedDomainVisit.checkedOutAt) : "11:24 AM",
      observedDurationLabel: "1 hr 21 min observed onsite",
      evidenceState: "location_verified",
      evidenceLabel: "Location verified · 24 m from Store 104",
      outcome: "resolved",
      outcomeLabel: "Resolved · final temperature 37°F and falling",
      photoCount: 4,
    },
    analytics: {
      recordedCostLabel: `${money(guidedInvoiceLink?.attributedAmountMinor ?? GUIDED_INVOICE_TOTAL_MINOR)} linked invoice`,
      linkedInvoiceLabel: `${guidedInvoice?.invoiceNumber ?? "SUM-DEMO-685"} · matched`,
      visitCount: guidedDomainVisit ? 1 : 1,
      workStatusLabel: guidedInvoiceLink ? "Invoice received" : "Ready for source-linked reporting",
    },
  };
  const guidedInitialActiveVisit: ActiveVisit | undefined = guidedDomainVisit && !guidedDomainVisit.checkedOutAt && guidedVendor
    ? {
        id: guidedDomainVisit.id,
        storeId: guidedDomainVisit.storeId,
        technicianName: guidedDomainVisit.technicianName,
        vendorName: guidedVendor.displayName,
        workOrderId: guidedDomainVisit.workOrderId,
        channel: "qr",
        evidence: {
          state: guidedDomainVisit.evidenceStrength === "location_verified" ? "location_verified" : "manual_exception",
          capturedAt: guidedDomainVisit.locationEvidence.capturedAt,
          accuracyMeters: guidedDomainVisit.locationEvidence.accuracyMeters,
          distanceMeters: guidedDomainVisit.locationEvidence.distanceFromStoreMeters,
        },
        startedAt: guidedDomainVisit.checkedInAt,
      }
    : undefined;

  const requestInboxItems: RequestInboxItem[] = dataset.requests
    .map((request, index) => {
      const store = dataset.stores.find((record) => record.id === request.storeId);
      const submitter = dataset.people.find((record) => record.id === request.submittedByPersonId);
      const linkedWork = request.workOrderId
        ? dataset.workOrders.find((record) => record.id === request.workOrderId)
        : undefined;
      if (!store) return null;
      return {
        id: request.id,
        requestNumber: requestNumbers[request.id] ?? `REQ-${store.storeNumber}-${String(index + 1).padStart(4, "0")}`,
        store: {
          id: store.id,
          storeNumber: store.storeNumber,
          name: store.name,
          address: `${store.address.line1}, ${store.address.city}, ${store.address.state} ${store.address.postalCode}`,
        },
        submittedByName: submitter?.displayName ?? "Store employee",
        submittedByEmployeeId: submitter?.employeeNumber ?? "Not recorded",
        submittedAt: request.submittedAt,
        immutableDescription: request.immutableDescription,
        reportedLocation: request.reportedLocation,
        urgency: request.urgency,
        categoryHint: request.categoryHint,
        attachmentCount: request.attachmentDocumentIds.length,
        reviewStatus: request.reviewStatus,
        linkedWorkOrderId: linkedWork?.id,
        linkedWorkOrderNumber: linkedWork?.number,
      } satisfies RequestInboxItem;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));

  const searchResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    const stores = dataset.stores
      .filter((store) =>
        [store.storeNumber, store.name, store.normalizedAddress, ...store.searchTerms, ...store.aliases.map((a) => a.value)]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 4)
      .map((store) => ({ kind: "store" as const, id: store.id, title: `Store ${store.storeNumber}`, meta: store.normalizedAddress }));
    const vendors = rolePolicy.allowedViews.includes("vendors") ? dataset.vendors
      .filter((vendor) =>
        [vendor.displayName, vendor.description, ...vendor.aliases, ...vendor.searchTerms]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 3)
      .map((vendor) => ({ kind: "vendor" as const, id: vendor.id, title: vendor.displayName, meta: vendor.specialties.map((s) => s.label).join(" · ") })) : [];
    const work = rolePolicy.allowedViews.includes("work") ? dataset.workOrders
      .filter((record) => [record.number, record.title, record.problemDescription].join(" ").toLowerCase().includes(query))
      .slice(0, 4)
      .map((record) => ({ kind: "work" as const, id: record.id, title: record.number, meta: record.title })) : [];
    const assets = rolePolicy.allowedViews.includes("equipment") ? dataset.assets
      .filter((asset) =>
        [asset.assetCode, asset.name, asset.manufacturer, asset.model, asset.serialNumber, ...asset.searchTerms]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 3)
      .map((asset) => ({
        kind: "asset" as const,
        id: asset.id,
        title: asset.name,
        meta: `${asset.assetCode} · ${asset.manufacturer} ${asset.model}`,
      })) : [];
    return [...stores, ...vendors, ...work, ...assets].slice(0, 8);
  }, [dataset.assets, dataset.stores, dataset.vendors, dataset.workOrders, globalQuery, rolePolicy]);

  function navigate(next: View) {
    if (!rolePolicy.allowedViews.includes(next)) {
      setNotice(`${rolePolicy.label} does not have access to ${navItems.find((item) => item.view === next)?.label ?? next}.`);
      return;
    }
    setView(next);
    setDetail(null);
    setGlobalQuery("");
  }

  function hasPermission(permission: RolePermission) {
    return rolePolicy.permissions[permission];
  }

  function guardPermission(permission: RolePermission, action: string) {
    if (hasPermission(permission)) return true;
    setNotice(`${rolePolicy.label} has read-only access here and cannot ${action}.`);
    return false;
  }

  function changeRole(nextRoleId: DemoRoleId) {
    const nextPolicy = getDemoRolePolicy(nextRoleId);
    setRoleId(nextRoleId);
    setView(nextPolicy.defaultView);
    setDetail(null);
    setDrawer(null);
    setPendingAuthorization(null);
    setClassificationWorkId(null);
    setWorkInitialStoreId(null);
    setVisitStoreId(null);
    setGlobalQuery("");
    const nextPerson = fullDataset.people.find((person) => person.id === nextPolicy.personId);
    setNotice(`Now viewing as ${nextPerson?.displayName ?? nextPolicy.label} · ${roleScopeLabel(fullDataset, nextPolicy)}.`);
  }

  function openWorkOrderDrawer(storeId?: string) {
    if (!guardPermission("createWork", "create work orders")) return;
    if (storeId && !dataset.stores.some((store) => store.id === storeId)) {
      setNotice("That store is outside this role’s assigned scope.");
      return;
    }
    setWorkInitialStoreId(storeId ?? null);
    setDrawer("create-work");
  }

  function openResult(result: { kind: "store" | "vendor" | "work" | "asset"; id: string }) {
    setView(
      result.kind === "store"
        ? "stores"
        : result.kind === "vendor"
          ? "vendors"
          : result.kind === "asset"
            ? "equipment"
            : "work",
    );
    setDetail(result);
    setGlobalQuery("");
  }

  function appendAuditEvent(
    entityType: AuditEvent["entityType"],
    entityId: string,
    summary: string,
    payloadSnapshot: AuditEvent["payloadSnapshot"],
    channel: AuditEvent["channel"] = "manager_web",
    actorType: AuditEvent["actorType"] = "person",
  ) {
    const event: AuditEvent = {
      id: `audit-session-${nowMilliseconds()}`,
      organizationId: dataset.organization.id,
      entityType,
      entityId,
      eventType: summary.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      actorType,
      actorId: actorType === "person" ? activePerson?.id : undefined,
      channel,
      occurredAt: new Date().toISOString(),
      summary,
      payloadSnapshot,
      demoMode: true,
    };
    setAuditEvents((current) => [event, ...current]);
  }

  function openStorePortal(storeId = GUIDED_DEMO_IDS.store) {
    if (!guardPermission("recordVisits", "open the store portal")) return;
    const store = dataset.stores.find((record) => record.id === storeId) ?? dataset.stores[0];
    if (!store) return;
    setStorePortalStoreId(store.id);
    setDrawer("store-portal");
  }

  function openEmployeeRequestForm(storeId: string) {
    const store = dataset.stores.find((record) => record.id === storeId);
    if (!store) return;
    const storeEmployee = dataset.people.find((person) =>
      person.roles.includes("store_employee") && person.scopeIds.includes(store.id),
    );
    setRequestStoreId(store.id);
    setRequestReceipt(null);
    setEmployeeIssueDraft({
      ...initialEmployeeIssueDraft,
      employeeName: storeEmployee?.displayName ?? "",
      employeeId: storeEmployee?.employeeNumber ?? "",
      problem: store.id === GUIDED_DEMO_IDS.store ? initialEmployeeIssueDraft.problem : "",
      reportedLocation: store.id === GUIDED_DEMO_IDS.store ? initialEmployeeIssueDraft.reportedLocation : "",
    });
    setDrawer("request-form");
  }

  async function submitEmployeeRequest(value: EmployeeIssueDraft) {
    const store = fullDataset.stores.find((record) => record.id === requestStoreId);
    if (!store) return;
    const submittedAt = new Date().toISOString();
    const submitter = fullDataset.people.find((person) =>
      person.employeeNumber.toLowerCase() === value.employeeId.trim().toLowerCase() ||
      person.displayName.toLowerCase() === value.employeeName.trim().toLowerCase(),
    ) ?? fullDataset.people.find((person) => person.roles.includes("store_employee") && person.scopeIds.includes(store.id));
    if (!submitter) {
      setNotice("Enter a store employee name and ID that can be matched to this location.");
      return;
    }
    const requestId = `request-session-${nowMilliseconds()}`;
    const requestNumber = `REQ-${store.storeNumber}-DEMO-${String(Object.keys(requestNumbers).length + 1).padStart(3, "0")}`;
    const documentId = value.photo ? `document-${requestId}-photo` : undefined;
    const request: ServiceRequest = {
      id: requestId,
      organizationId: fullDataset.organization.id,
      storeId: store.id,
      submittedByPersonId: submitter.id,
      submittedAt,
      immutableDescription: value.problem.trim(),
      reportedLocation: value.reportedLocation.trim(),
      urgency: value.urgency,
      categoryHint: /beer|cooler|freezer|refriger/i.test(value.problem) ? "Refrigeration" : undefined,
      attachmentDocumentIds: documentId ? [documentId] : [],
      reviewStatus: "new",
    };
    setRequests((current) => [request, ...current]);
    setRequestNumbers((current) => ({ ...current, [request.id]: requestNumber }));
    if (value.photo && documentId) {
      const document: EvidenceDocument = {
        id: documentId,
        organizationId: fullDataset.organization.id,
        storeId: store.id,
        kind: "request_photo",
        fileName: value.photo.name,
        mediaType: value.photo.type || "application/octet-stream",
        createdAt: submittedAt,
        createdByLabel: `${submitter.displayName} · Store ${store.storeNumber}`,
        visibility: "operator_only",
      };
      setDocuments((current) => [document, ...current]);
    }
    setAuditEvents((current) => [{
      id: `audit-${requestId}-submitted`,
      organizationId: fullDataset.organization.id,
      entityType: "request",
      entityId: request.id,
      eventType: "store_employee_request_submitted",
      actorType: "person",
      actorId: submitter.id,
      channel: "store_portal",
      occurredAt: submittedAt,
      summary: `Store ${store.storeNumber} employee submitted an issue`,
      payloadSnapshot: { storeId: store.id, urgency: request.urgency, attachmentCount: request.attachmentDocumentIds.length },
      demoMode: true,
    }, ...current]);
    setRequestReceipt({ requestId, requestNumber, submittedAtLabel: timeLabel(submittedAt) });
    setRequestInboxValue({ query: "", filter: "needs_review", selectedRequestId: request.id });
    setNotice(`${requestNumber} submitted. It is now visible in the manager Requests queue.`);
  }

  function approveAndCreateRequestWorkOrder(requestId: string) {
    if (!guardPermission("createWork", "approve requests and create work orders")) return;
    const request = fullDataset.requests.find((record) => record.id === requestId);
    const store = request ? fullDataset.stores.find((record) => record.id === request.storeId) : undefined;
    if (!request || !store) return;
    if (request.workOrderId) {
      setView("work");
      setDetail({ kind: "work", id: request.workOrderId });
      return;
    }
    const now = new Date().toISOString();
    const due = new Date(Date.parse(now) + (request.urgency === "emergency" ? 6 : request.urgency === "urgent" ? 24 : 72) * 60 * 60 * 1000).toISOString();
    const looksLikeRefrigeration = /beer|cooler|freezer|refriger|warm product/i.test(`${request.immutableDescription} ${request.categoryHint ?? ""}`);
    const category = looksLikeRefrigeration
      ? fullDataset.categories.find((record) => record.id === GUIDED_DEMO_IDS.category)
      : fullDataset.categories.find((record) => request.categoryHint && record.label.toLowerCase() === request.categoryHint.toLowerCase());
    const asset = looksLikeRefrigeration
      ? fullDataset.assets.find((record) => record.storeId === store.id && record.id === GUIDED_DEMO_IDS.asset) ??
        fullDataset.assets.find((record) => record.storeId === store.id && record.categoryId === category?.id)
      : undefined;
    const taxonomy = asset
      ? fullDataset.taxonomyNodes.find((record) => record.id === asset.taxonomyNodeId)
      : undefined;
    const workId = `work-session-${nowMilliseconds()}`;
    const requestNumber = requestNumbers[request.id] ?? `REQ-${store.storeNumber}`;
    const workNumber = `NLM-${store.storeNumber}-DEMO-${String(fullDataset.workOrders.filter((work) => work.number.includes("-DEMO-")).length + 1).padStart(3, "0")}`;
    const work: WorkOrder = {
      id: workId,
      organizationId: fullDataset.organization.id,
      number: workNumber,
      storeId: store.id,
      requestId: request.id,
      categoryId: category?.id,
      taxonomyNodeId: taxonomy?.id,
      assetId: asset?.id,
      title: request.immutableDescription.length > 62 ? `${request.immutableDescription.slice(0, 59)}…` : request.immutableDescription,
      problemDescription: request.immutableDescription,
      scopeOfWork: "Diagnose the reported condition, document findings, and restore safe normal operation. Contact the customer before exceeding authorization.",
      priority: request.urgency,
      source: "employee_request",
      fulfillmentMode: "unassigned",
      status: "draft",
      createdByPersonId: activePerson.id,
      createdAt: now,
      requestedWindow: { startsAt: now, endsAt: due },
      accountable: {
        partyType: "person",
        partyId: activePerson.id,
        nextAction: "Choose an internal team or approved outside vendor",
        dueAt: due,
        escalationPartyId: activePerson.id,
      },
      currency: "USD",
      classificationDeferred: !asset,
      tags: ["employee-request", "manager-approved", requestNumber],
    };
    setRequests((current) => current.map((record) => record.id === request.id ? {
      ...record,
      workOrderId: work.id,
      reviewStatus: "converted",
    } : record));
    setWorkOrders((current) => [work, ...current]);
    setAuditEvents((current) => [{
      id: `audit-${request.id}-approved`,
      organizationId: fullDataset.organization.id,
      entityType: "work_order",
      entityId: work.id,
      eventType: "request_approved_and_converted",
      actorType: "person",
      actorId: activePerson.id,
      channel: "manager_web",
      occurredAt: now,
      summary: `${requestNumber} approved and converted to ${work.number}`,
      payloadSnapshot: { requestId: request.id, workOrderId: work.id, storeId: store.id },
      demoMode: true,
    }, ...current]);
    setRequestInboxValue((current) => ({ ...current, selectedRequestId: request.id }));
    setView("work");
    setDetail({ kind: "work", id: work.id });
    setNotice(`${work.number} created from the original employee request. Choose who will handle it next.`);
  }

  function openVendorAssignment(workOrderId: string) {
    if (!guardPermission("createWork", "assign maintenance work")) return;
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    if (!work) return;
    const preferredVendor = dataset.vendors.find((vendor) =>
      vendor.preferredStoreIds.includes(work.storeId) &&
      (!work.categoryId || vendor.specialties.some((specialty) => specialty.categoryId === work.categoryId)),
    );
    setAssignmentWorkId(work.id);
    setAssignmentMode(dataset.teams.length ? "internal" : "external");
    setAssignmentTeamId(dataset.teams[0]?.id ?? "");
    setAssignmentVendorId(preferredVendor?.id ?? dataset.vendors[0]?.id ?? "");
    setDrawer("assign-vendor");
  }

  function assignHandlerToWork() {
    const work = fullDataset.workOrders.find((record) => record.id === assignmentWorkId);
    const vendor = assignmentMode === "external" ? fullDataset.vendors.find((record) => record.id === assignmentVendorId) : undefined;
    const team = assignmentMode === "internal" ? fullDataset.teams.find((record) => record.id === assignmentTeamId) : undefined;
    if (!work || (assignmentMode === "external" ? !vendor : !team)) return;
    const now = new Date().toISOString();
    const assignment: WorkAssignment = {
      id: `assignment-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      workOrderId: work.id,
      partyType: assignmentMode === "external" ? "vendor" : "team",
      partyId: vendor?.id ?? team!.id,
      status: "offered",
      assignedAt: now,
      assignmentNote: assignmentMode === "external"
        ? "Approved outside vendor selected; customer service authorization is ready to review."
        : "Assigned to the internal maintenance queue.",
    };
    setAssignments((current) => [assignment, ...current.filter((record) => record.workOrderId !== work.id)]);
    setWorkOrders((current) => current.map((record) => record.id === work.id ? {
      ...record,
      fulfillmentMode: assignmentMode,
      status: assignmentMode === "external" ? "ready_to_issue" : "draft",
      accountable: {
        partyType: assignmentMode === "external" ? "person" : "team",
        partyId: assignmentMode === "external" ? activePerson.id : team!.id,
        nextAction: assignmentMode === "external"
          ? `Review and send the customer work order to ${vendor!.displayName}`
          : `${team!.name} acknowledges and assesses the work`,
        dueAt: record.requestedWindow.endsAt,
        escalationPartyId: activePerson.id,
      },
    } : record));
    appendAuditEvent("assignment", assignment.id, assignmentMode === "external" ? "Outside vendor selected" : "Internal maintenance team selected", {
      workOrderId: work.id,
      partyType: assignment.partyType,
      partyId: assignment.partyId,
    });
    setDrawer(null);
    setAssignmentWorkId(null);
    setNotice(assignmentMode === "external"
      ? `${vendor!.displayName} selected. Review and send the service authorization from this work order.`
      : `${team!.name} selected. The work is now in the internal maintenance queue.`);
  }

  function openVisitForWork(workOrderId: string) {
    if (!guardPermission("recordVisits", "record vendor visits")) return;
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    const assignment = dataset.assignments.find((record) => record.workOrderId === workOrderId && record.partyType === "vendor" && record.status !== "declined");
    if (!work || !assignment) {
      setNotice("Assign an outside vendor before opening this visit.");
      return;
    }
    setVisitStoreId(work.storeId);
    setVisitVendorId(assignment.partyId);
    setVisitWorkOrderId(work.id);
    setDrawer("visit");
  }

  function openWorkInSpend(workOrderId: string) {
    const work = fullDataset.workOrders.find((record) => record.id === workOrderId);
    const store = work ? fullDataset.stores.find((record) => record.id === work.storeId) : undefined;
    if (!work || !store) return;
    setSpendPreset({
      regionId: store.regionId ?? "all",
      storeId: store.id,
      categoryId: work.categoryId ?? "all",
      mode: "overview",
    });
    setMaintenanceSpendState({
      ...defaultMaintenanceSpendState,
      regionId: store.regionId ?? "all",
      storeId: store.id,
      categoryId: work.categoryId ?? "all",
    });
    navigate("spend");
  }

  function openMaintenanceSpend(resetScope = false) {
    if (resetScope) {
      setMaintenanceSpendState(defaultMaintenanceSpendState);
      setSpendPreset({ regionId: "all", storeId: "all", categoryId: "all", mode: "overview" });
    } else {
      setSpendPreset((current) => ({
        regionId: current?.regionId ?? "all",
        storeId: current?.storeId ?? "all",
        categoryId: current?.categoryId ?? "all",
        mode: "overview",
      }));
    }
    navigate("spend");
  }

  function openInvoiceEvidenceReview(resetScope = false) {
    if (!capabilities.invoiceSafeguard) {
      setNotice("Invoice evidence review is hidden while the optional invoice safeguard is off.");
      return;
    }
    if (resetScope) {
      setMaintenanceSpendState(defaultMaintenanceSpendState);
      setInvoiceEvidenceQueueValue({ filter: "needs_review", query: "" });
      setSpendPreset({ regionId: "all", storeId: "all", categoryId: "all", mode: "evidence_review" });
    } else {
      setSpendPreset((current) => ({
        regionId: current?.regionId ?? "all",
        storeId: current?.storeId ?? "all",
        categoryId: current?.categoryId ?? "all",
        mode: "evidence_review",
      }));
    }
    navigate("spend");
  }

  function openSpendCategory(categoryId: string) {
    setSpendPreset({ regionId: "all", storeId: "all", categoryId, mode: "overview" });
    setMaintenanceSpendState({
      ...defaultMaintenanceSpendState,
      regionId: "all",
      storeId: "all",
      categoryId,
    });
    navigate("spend");
  }

  function openOperationsSource(source: OperationsSourceReference) {
    if (source.kind === "visit") {
      setVisitWorkspaceInitialId(source.id);
      navigate("visits");
      return;
    }
    if (source.kind === "invoice") setInvoiceDetailReturn("exceptions");
    setView(
      source.kind === "store"
        ? "stores"
        : source.kind === "vendor"
          ? "vendors"
          : source.kind === "asset"
            ? "equipment"
            : source.kind === "pm"
              ? "pm"
              : source.kind === "invoice"
                ? "spend"
                : "work",
    );
    setDetail({ kind: source.kind, id: source.id });
  }

  function resolveInvoiceEvidence(invoiceId: string) {
    if (!guardPermission("reviewInvoiceEvidence", "resolve invoice evidence review")) return;
    const invoice = fullDataset.invoices.find((record) => record.id === invoiceId);
    if (!invoice) return;
    appendAuditEvent("invoice", invoiceId, "Maintenance invoice evidence reviewed", {
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      accountingDecisionMade: false,
      sourceFactsChanged: false,
    });
    setDetail({ kind: "invoice", id: invoiceId });
    setNotice(`${invoice.invoiceNumber} review recorded. Match states and exceptions were preserved; payment and accounting decisions remain in the accounting system.`);
  }

  function openReportBuilder(template: SavedReportRecord["template"], costBasis: SavedReportRecord["costBasis"] = "recorded", spendState: MaintenanceSpendState | null = null) {
    if (!guardPermission("generateReports", "generate reports")) return;
    setReportTemplate(template);
    setReportCostBasisPreset(costBasis);
    setReportSpendPreset(spendState);
    setDrawer("report-builder");
  }

  function generateReport(value: ReportBuilderValue) {
    if (!reportTemplate) return;
    const createdAt = new Date().toISOString();
    const version = savedReports.filter((report) => report.template === reportTemplate).length + 1;
    const selectedPeriod = reportPeriodFromLabel(value.periodLabel);
    const finalSpendState = reportSpendPreset
      ? {
          ...reportSpendPreset,
          basis: value.costBasis === "invoice_linked" ? "linked_invoice" as const : value.costBasis,
          period: selectedPeriod === "last_quarter" ? reportSpendPreset.period : selectedPeriod,
          sourcePage: 1,
        }
      : null;
    const sourceWorkOrderIds = finalSpendState && selectedPeriod !== "last_quarter"
      ? maintenanceSpendWorkOrderIds(dataset, finalSpendState)
      : dataset.workOrders
          .filter((work) => {
            const range = reportPeriodRange(value.periodLabel, dataset.asOf);
            return work.createdAt >= range.start && work.createdAt <= range.end;
          })
          .filter((work) => !reportSpendPreset || reportWorkMatchesSpendScope(dataset, work, reportSpendPreset))
          .map((work) => work.id);
    const sourceSnapshots = sourceWorkOrderIds
      .map((workOrderId) => createReportSourceSnapshot(dataset, workOrderId, value.costBasis))
      .filter((snapshot): snapshot is SavedReportSourceSnapshot => Boolean(snapshot));
    const report: SavedReportRecord = {
      id: `report-session-${nowMilliseconds()}`,
      title: value.title.trim(),
      template: reportTemplate,
      scopeLabel: reportSpendPreset ? maintenanceScopeLabel(reportSpendPreset) : scopeLabel,
      periodLabel: value.periodLabel,
      costBasis: value.costBasis,
      createdAt,
      version,
      sourceWorkOrderIds,
      sourceSnapshots,
    };
    setSavedReports((current) => [report, ...current]);
    appendAuditEvent("report", report.id, "Management report generated", {
      reportId: report.id,
      template: report.template,
      scopeLabel: report.scopeLabel,
      periodLabel: report.periodLabel,
      costBasis: report.costBasis,
      sourceCount: report.sourceSnapshots.length,
    });
    setDrawer(null);
    setReportTemplate(null);
    setReportCostBasisPreset("recorded");
    setReportSpendPreset(null);
    setView("reports");
    setDetail({ kind: "report", id: report.id });
    setNotice(`${report.title} · Version ${report.version} generated with ${report.sourceSnapshots.length} frozen source records.`);
  }

  function openInvoiceForWork(workOrderId: string) {
    if (!guardPermission("createWork", "attach vendor invoices")) return;
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    const assignment = dataset.assignments.find((record) => record.workOrderId === workOrderId && record.partyType === "vendor" && record.status !== "declined");
    if (!work || !assignment) {
      setNotice("An outside vendor must be connected before an invoice can be matched to this work order.");
      return;
    }
    setInvoiceWorkId(work.id);
    setDrawer("record-invoice");
  }

  function openInternalWorkUpdate(workOrderId: string) {
    if (!guardPermission("createWork", "update internal maintenance work")) return;
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    const assignment = dataset.assignments.find((record) => record.workOrderId === workOrderId && record.partyType === "team");
    if (!work || !assignment) return;
    setInternalWorkId(work.id);
    setDrawer("internal-update");
  }

  function openMaintenanceCostEntry(workOrderId: string) {
    if (!guardPermission("createWork", "record maintenance cost")) return;
    if (!dataset.workOrders.some((work) => work.id === workOrderId)) return;
    setCostWorkId(workOrderId);
    setDrawer("record-cost");
  }

  function recordMaintenanceCost(value: MaintenanceCostEntryValue) {
    const work = fullDataset.workOrders.find((record) => record.id === costWorkId);
    if (!work) return;
    const entries = ([
      { costType: "labor", amountMinor: value.laborMinor, label: "Labor" },
      { costType: "materials", amountMinor: value.materialsMinor, label: "Materials" },
      { costType: "trip", amountMinor: value.tripMinor, label: "Trip / dispatch" },
      { costType: "miscellaneous", amountMinor: value.miscellaneousMinor, label: "Other maintenance cost" },
    ] satisfies Array<{ costType: CostLine["costType"]; amountMinor: number; label: string }>).filter((entry) => entry.amountMinor > 0);
    if (!entries.length) {
      setNotice("Enter at least one maintenance cost amount.");
      return;
    }
    const recordedAt = new Date().toISOString();
    const assignment = fullDataset.assignments.find((record) => record.workOrderId === work.id && record.partyType === "vendor" && record.status !== "declined");
    const lines: CostLine[] = entries.map((entry, index) => ({
      id: `cost-session-${nowMilliseconds()}-${index + 1}`,
      organizationId: fullDataset.organization.id,
      workOrderId: work.id,
      storeId: work.storeId,
      categoryId: work.categoryId,
      assetId: work.assetId,
      vendorId: assignment?.partyId,
      basis: "recorded",
      costType: entry.costType,
      description: value.note.trim() ? `${entry.label} · ${value.note.trim()}` : entry.label,
      amountMinor: entry.amountMinor,
      currency: work.currency,
      recordedAt,
      source: "internal_entry",
    }));
    setCostLines((current) => [...lines, ...current]);
    appendAuditEvent("work_order", work.id, "Recorded maintenance cost added", {
      workOrderId: work.id,
      amountMinor: lines.reduce((sum, line) => sum + line.amountMinor, 0),
      lineCount: lines.length,
      invoiceCreated: false,
    });
    setDrawer(null);
    setCostWorkId(null);
    setDetail({ kind: "work", id: work.id });
    setNotice(`${money(lines.reduce((sum, line) => sum + line.amountMinor, 0))} recorded on ${work.number} without creating an invoice or accounting entry.`);
  }

  function openCompletionReview(workOrderId: string) {
    if (!guardPermission("createWork", "review completed work")) return;
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    if (!work || work.status !== "completed") return;
    setCompletionWorkId(work.id);
    setDrawer("completion-review");
  }

  function reviewWorkCompletion(value: WorkCompletionReviewValue) {
    const work = fullDataset.workOrders.find((record) => record.id === completionWorkId);
    if (!work || !value.decision) return;
    const linkedPmOccurrence = work.pmOccurrenceId
      ? fullDataset.pmOccurrences.find((occurrence) => occurrence.id === work.pmOccurrenceId)
      : undefined;
    if (value.decision === "verified_resolved_close" && linkedPmOccurrence && linkedPmOccurrence.status !== "completed") {
      setDrawer(null);
      setCompletionWorkId(null);
      setView("pm");
      setDetail({ kind: "pm", id: linkedPmOccurrence.id });
      setNotice("Complete the linked PM evidence review before closing this preventive-maintenance work order.");
      return;
    }
    const occurredAt = new Date().toISOString();
    setWorkOrders((current) => current.map((record) => {
      if (record.id !== work.id) return record;
      if (value.decision === "verified_resolved_close") return {
        ...record,
        status: "closed",
        closedAt: occurredAt,
        accountable: record.accountable ? { ...record.accountable, nextAction: "Closed after manager verification" } : record.accountable,
      };
      return {
        ...record,
        status: "unresolved",
        outcome: "unresolved",
        completedAt: undefined,
        closedAt: undefined,
        accountable: record.accountable ? {
          ...record.accountable,
          nextAction: value.decision === "needs_follow_up" ? "Assign the documented follow-up action" : "Reassess and assign the reopened work",
          dueAt: new Date(Date.parse(occurredAt) + 24 * 60 * 60 * 1000).toISOString(),
        } : record.accountable,
      };
    }));
    appendAuditEvent("work_order", work.id, value.decision === "verified_resolved_close" ? "Completed work verified and closed" : value.decision === "needs_follow_up" ? "Completed work returned for follow-up" : "Completed work reopened", {
      workOrderId: work.id,
      decision: value.decision,
      note: value.note.trim(),
    });
    setDrawer(null);
    setCompletionWorkId(null);
    setDetail({ kind: "work", id: work.id });
    setNotice(value.decision === "verified_resolved_close" ? `${work.number} verified and closed.` : `${work.number} returned to active follow-up with the manager note preserved.`);
  }

  function openVendorProposalReview(workOrderId: string) {
    if (!guardPermission("issueVendorWork", "review vendor scheduling")) return;
    const issuance = dataset.vendorIssuances
      .filter((record) => record.workOrderId === workOrderId)
      .sort((left, right) => right.version - left.version)[0];
    if (!issuance) return;
    setProposalWorkId(workOrderId);
    setDrawer("vendor-proposal");
  }

  function reviewVendorProposal(value: VendorProposalReviewValue) {
    if (!proposalWork || !proposalIssuance || !value.decision) return;
    const occurredAt = new Date().toISOString();
    const toTimestamp = (date: string, time: string) => date ? new Date(`${date}T${time || "12:00"}:00`).toISOString() : undefined;
    const requestedArrivalAt = value.decision === "request_different_date"
      ? toTimestamp(value.requestedDate, value.requestedTime)
      : undefined;
    const manualProposedArrivalAt = value.decision === "record_manual_response"
      ? toTimestamp(value.manualProposedDate, value.manualProposedTime)
      : undefined;
    const operationalResponse = value.decision === "record_manual_response"
      ? value.manualResponse
      : value.decision === "accept_proposed_window"
        ? "accepted"
        : "question";
    const persistedVendorResponse = value.decision === "record_manual_response" && !proposalIssuance.response
      ? value.manualResponse
      : proposalIssuance.response;
    setIssuances((current) => current.map((record) => record.id === proposalIssuance.id ? {
      ...record,
      response: persistedVendorResponse,
      respondedAt: record.respondedAt ?? occurredAt,
      proposedArrivalAt: record.proposedArrivalAt ?? manualProposedArrivalAt,
      vendorReference: value.vendorTicket.trim() || record.vendorReference,
    } : record));
    setAssignments((current) => current.map((record) => record.id === proposalIssuance.assignmentId ? {
      ...record,
      status: operationalResponse === "accepted" ? "accepted" : operationalResponse === "declined" ? "declined" : "acknowledged",
      acknowledgedAt: occurredAt,
    } : record));
    setWorkOrders((current) => current.map((record) => record.id === proposalWork.id ? {
      ...record,
      fulfillmentMode: operationalResponse === "declined" ? "unassigned" : record.fulfillmentMode,
      status: value.decision === "accept_proposed_window"
        ? "scheduled"
        : operationalResponse === "accepted"
          ? "accepted"
          : operationalResponse === "declined"
            ? "draft"
            : "awaiting_vendor_response",
      requestedWindow: requestedArrivalAt ? {
        startsAt: requestedArrivalAt,
        endsAt: new Date(Date.parse(requestedArrivalAt) + 2 * 60 * 60 * 1000).toISOString(),
      } : record.requestedWindow,
      scheduledWindow: value.decision === "accept_proposed_window" && proposalIssuance.proposedArrivalAt ? {
        startsAt: proposalIssuance.proposedArrivalAt,
        endsAt: new Date(Date.parse(proposalIssuance.proposedArrivalAt) + 2 * 60 * 60 * 1000).toISOString(),
      } : record.scheduledWindow,
      accountable: record.accountable ? {
        ...record.accountable,
        nextAction: value.decision === "accept_proposed_window"
          ? "Vendor technician checks in at the scheduled store"
          : operationalResponse === "accepted"
            ? "Vendor schedules service and records the onsite visit"
            : operationalResponse === "declined"
              ? "Choose another approved vendor"
              : requestedArrivalAt
                ? `Vendor confirms the requested ${dateLabel(requestedArrivalAt)} service window`
                : "Review the vendor's proposed window or question",
      } : record.accountable,
    } : record));
    appendAuditEvent("vendor_issuance", proposalIssuance.id, value.decision === "record_manual_response" ? "Vendor response recorded manually" : value.decision === "accept_proposed_window" ? "Vendor proposed window accepted" : "Different service date requested", {
      workOrderId: proposalWork.id,
      issuanceId: proposalIssuance.id,
      originalVendorResponse: proposalIssuance.response ?? null,
      operatorDecision: value.decision,
      recordedVendorResponse: value.decision === "record_manual_response" ? value.manualResponse : null,
      requestedArrivalAt: requestedArrivalAt ?? null,
      manualChannel: value.decision === "record_manual_response" ? value.manualChannel : null,
      note: value.manualNote.trim() || null,
    });
    setDrawer(null);
    setProposalWorkId(null);
    setDetail({ kind: "work", id: proposalWork.id });
    setNotice(value.decision === "accept_proposed_window"
      ? `${proposalWork.number} scheduled from the reviewed vendor proposal.`
      : operationalResponse === "accepted"
        ? `${proposalWork.number} accepted; the vendor still controls its final dispatch schedule.`
        : operationalResponse === "declined"
          ? `${proposalWork.number} returned for reassignment.`
          : `${proposalWork.number} is awaiting the next scheduling decision.`);
  }

  function updateInternalWork(value: InternalWorkUpdateValue) {
    const work = fullDataset.workOrders.find((record) => record.id === internalWorkId);
    const assignment = work
      ? fullDataset.assignments.find((record) => record.workOrderId === work.id && record.partyType === "team")
      : undefined;
    if (!work || !assignment) return;
    const now = new Date().toISOString();
    const resolved = value.action === "complete" && value.outcome === "resolved";
    setAssignments((current) => current.map((record) => record.id === assignment.id ? {
      ...record,
      status: value.action === "acknowledge" ? "accepted" : value.action === "start" ? "active" : resolved ? "completed" : "active",
      acknowledgedAt: value.action === "acknowledge" ? now : record.acknowledgedAt,
      completedAt: resolved ? now : record.completedAt,
    } : record));
    setWorkOrders((current) => current.map((record) => {
      if (record.id !== work.id) return record;
      if (value.action === "acknowledge") return {
        ...record,
        status: "accepted",
        accountable: record.accountable ? { ...record.accountable, nextAction: "Internal maintenance starts and records the work" } : record.accountable,
      };
      if (value.action === "start") return {
        ...record,
        status: "onsite",
        accountable: record.accountable ? { ...record.accountable, nextAction: "Internal technician records the outcome and maintenance cost" } : record.accountable,
      };
      const outcome = value.outcome ?? "resolved";
      return {
        ...record,
        outcome,
        status: outcome === "resolved" ? "completed" : outcome === "diagnosed_waiting_parts" ? "waiting_parts" : "unresolved",
        completedAt: outcome === "resolved" ? now : undefined,
        accountable: record.accountable ? {
          ...record.accountable,
          nextAction: outcome === "resolved" ? "Manager verifies the result and closes the work order" : outcome === "diagnosed_waiting_parts" ? "Internal team records parts availability and return plan" : "Facilities manager reviews the follow-up plan",
        } : record.accountable,
      };
    }));
    if (value.action === "complete" && (value.recordedCostMinor ?? 0) > 0) {
      const cost: CostLine = {
        id: `cost-internal-session-${nowMilliseconds()}`,
        organizationId: fullDataset.organization.id,
        workOrderId: work.id,
        storeId: work.storeId,
        categoryId: work.categoryId,
        assetId: work.assetId,
        basis: "recorded",
        costType: "labor",
        description: value.note?.trim() || "Internal labor and materials recorded at completion",
        amountMinor: value.recordedCostMinor ?? 0,
        currency: work.currency,
        recordedAt: now,
        source: "internal_entry",
      };
      setCostLines((current) => [cost, ...current]);
    }
    appendAuditEvent("work_order", work.id, `Internal work ${value.action}`, {
      workOrderId: work.id,
      assignmentId: assignment.id,
      outcome: value.outcome ?? null,
      recordedCostMinor: value.recordedCostMinor ?? 0,
    });
    setDrawer(null);
    setInternalWorkId(null);
    setDetail({ kind: "work", id: work.id });
    setNotice(value.action === "acknowledge" ? `${work.number} acknowledged by the internal team.` : value.action === "start" ? `${work.number} is now in progress.` : `${work.number} updated with the internal outcome and recorded maintenance cost.`);
  }

  function recordInvoiceForWork(value: InvoiceEntryValue) {
    const work = fullDataset.workOrders.find((record) => record.id === invoiceWorkId);
    const assignment = work
      ? fullDataset.assignments.find((record) => record.workOrderId === work.id && record.partyType === "vendor" && record.status !== "declined")
      : undefined;
    const vendor = assignment
      ? fullDataset.vendors.find((record) => record.id === assignment.partyId)
      : undefined;
    if (!work || !vendor) return;
    const totalMinor = value.laborMinor + value.materialsMinor + value.tripMinor;
    if (totalMinor <= 0) {
      setNotice("Enter at least one invoice amount before recording it.");
      return;
    }
    const now = new Date().toISOString();
    const invoiceId = `invoice-session-${nowMilliseconds()}`;
    const documentId = `document-${invoiceId}`;
    const lineItems: Invoice["lineItems"] = [];
    if (value.laborMinor > 0) lineItems.push({ id: `${invoiceId}-labor`, workOrderId: work.id, description: "Onsite labor", costType: "labor", quantity: 1, unitAmountMinor: value.laborMinor, amountMinor: value.laborMinor });
    if (value.materialsMinor > 0) lineItems.push({ id: `${invoiceId}-materials`, workOrderId: work.id, description: "Parts and materials", costType: "materials", quantity: 1, unitAmountMinor: value.materialsMinor, amountMinor: value.materialsMinor });
    if (value.tripMinor > 0) lineItems.push({ id: `${invoiceId}-trip`, workOrderId: work.id, description: "Dispatch / trip charge", costType: "trip", quantity: 1, unitAmountMinor: value.tripMinor, amountMinor: value.tripMinor });
    const overNte = Boolean(work.notToExceedMinor && totalMinor > work.notToExceedMinor);
    const invoice: Invoice = {
      id: invoiceId,
      organizationId: fullDataset.organization.id,
      vendorId: vendor.id,
      invoiceNumber: value.invoiceNumber.trim(),
      customerWorkOrderReferences: [work.number],
      vendorServiceReferences: fullDataset.vendorIssuances.find((record) => record.workOrderId === work.id)?.vendorReference
        ? [fullDataset.vendorIssuances.find((record) => record.workOrderId === work.id)!.vendorReference!]
        : [],
      invoiceDate: now.slice(0, 10),
      receivedAt: now,
      status: overNte ? "needs_review" : "received",
      currency: work.currency,
      lineItems,
      documentId,
    };
    const link: InvoiceWorkLink = {
      id: `invoice-link-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      invoiceId,
      workOrderId: work.id,
      storeId: work.storeId,
      categoryId: work.categoryId,
      assetId: work.assetId,
      attributedAmountMinor: totalMinor,
      currency: work.currency,
      matchMethod: "work_order_reference",
      matchStatus: overNte ? "review_needed" : "matched",
      linkedAt: now,
      linkedByPersonId: activePerson.id,
    };
    const document: EvidenceDocument = {
      id: documentId,
      organizationId: fullDataset.organization.id,
      storeId: work.storeId,
      workOrderId: work.id,
      invoiceId,
      kind: "invoice",
      fileName: value.file?.name ?? `${value.invoiceNumber.trim()}-manual-entry.pdf`,
      mediaType: value.file?.type || "application/pdf",
      createdAt: now,
      createdByLabel: `${activePerson.displayName} · Demo Mode`,
      visibility: "operator_only",
    };
    setInvoices((current) => [invoice, ...current]);
    setInvoiceWorkLinks((current) => [link, ...current]);
    setDocuments((current) => [document, ...current]);
    if (overNte) {
      setExceptions((current) => [{
        id: `exception-${invoiceId}-nte`,
        organizationId: fullDataset.organization.id,
        type: "invoice_over_nte",
        severity: "warning",
        status: "open",
        title: `${invoice.invoiceNumber} exceeds the work-order limit`,
        description: `${money(totalMinor)} invoiced against ${money(work.notToExceedMinor ?? 0)} authorized. Review the supporting maintenance records, then continue in the accounting system.`,
        storeId: work.storeId,
        workOrderId: work.id,
        invoiceId,
        vendorId: vendor.id,
        sourceRecordIds: [invoiceId, work.id],
        assignedPersonId: activePerson.id,
        openedAt: now,
        dueAt: new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString(),
      }, ...current]);
    }
    appendAuditEvent("invoice", invoice.id, "Invoice uploaded and matched to customer work order", {
      invoiceId,
      workOrderId: work.id,
      vendorId: vendor.id,
      amountMinor: totalMinor,
      matchStatus: link.matchStatus,
    });
    setDrawer(null);
    setInvoiceWorkId(null);
    setDetail({ kind: "work", id: work.id });
    setNotice(overNte
      ? `${invoice.invoiceNumber} matched to ${work.number} and flagged above the authorization limit.`
      : `${invoice.invoiceNumber} linked to ${work.number}. The maintenance-cost evidence is ready to review.`);
  }

  function resetGuidedDemo() {
    setRequests((current) => current.filter((request) => request.id !== GUIDED_DEMO_IDS.request));
    setWorkOrders((current) => current.filter((work) => work.id !== GUIDED_DEMO_IDS.workOrder));
    setAssignments((current) => current.filter((assignment) => assignment.id !== GUIDED_DEMO_IDS.assignment));
    setIssuances((current) => current.filter((issuance) => issuance.id !== GUIDED_DEMO_IDS.issuance));
    setVisits((current) => current.filter((visit) => visit.workOrderId !== GUIDED_DEMO_IDS.workOrder));
    setInvoices((current) => current.filter((invoice) => invoice.id !== GUIDED_DEMO_IDS.invoice));
    setInvoiceWorkLinks((current) => current.filter((link) => link.id !== GUIDED_DEMO_IDS.invoiceLink));
    setDocuments((current) => current.filter((document) => document.id !== GUIDED_DEMO_IDS.invoiceDocument));
    setAuditEvents((current) => current.filter((event) =>
      event.entityId !== GUIDED_DEMO_IDS.request &&
      event.entityId !== GUIDED_DEMO_IDS.workOrder &&
      event.entityId !== GUIDED_DEMO_IDS.assignment &&
      event.entityId !== GUIDED_DEMO_IDS.issuance &&
      event.entityId !== GUIDED_DEMO_IDS.invoice &&
      event.entityId !== GUIDED_DEMO_IDS.invoiceLink &&
      event.payloadSnapshot.workOrderId !== GUIDED_DEMO_IDS.workOrder,
    ));
    setGuidedDemo(initialGuidedDemoState);
    setDetail(null);
    setNotice("Guided demo reset. Start again from the store employee request.");
  }

  function submitGuidedRequest() {
    const request = createGuidedRequest(fullDataset);
    setRequests((current) => [request, ...current.filter((record) => record.id !== request.id)]);
    setAuditEvents((current) => [{
      id: "audit-guided-request-submitted",
      organizationId: fullDataset.organization.id,
      entityType: "request",
      entityId: request.id,
      eventType: "store_employee_request_submitted",
      actorType: "person",
      actorId: GUIDED_DEMO_IDS.employee,
      channel: "store_portal",
      occurredAt: request.submittedAt,
      summary: "Store employee submitted an immutable issue request",
      payloadSnapshot: { storeId: request.storeId, urgency: request.urgency },
      demoMode: true,
    }, ...current.filter((event) => event.id !== "audit-guided-request-submitted")]);
    setGuidedDemo((current) => ({ ...current, stage: "review" }));
    setNotice("Request submitted from Store 104. The original description is now preserved for manager review.");
  }

  function approveGuidedRequest() {
    const work = createGuidedWorkOrder(fullDataset);
    setRequests((current) => current.map((request) => request.id === GUIDED_DEMO_IDS.request ? {
      ...request,
      workOrderId: work.id,
      reviewStatus: "converted",
    } : request));
    setWorkOrders((current) => [work, ...current.filter((record) => record.id !== work.id)]);
    setAuditEvents((current) => [{
      id: "audit-guided-work-approved",
      organizationId: fullDataset.organization.id,
      entityType: "work_order",
      entityId: work.id,
      eventType: "request_approved_and_converted",
      actorType: "person",
      actorId: GUIDED_DEMO_IDS.manager,
      channel: "manager_web",
      occurredAt: fullDataset.asOf,
      summary: "Store manager approved the request and created a customer work order",
      payloadSnapshot: { workOrderId: work.id, storeId: work.storeId, requestId: GUIDED_DEMO_IDS.request },
      demoMode: true,
    }, ...current.filter((event) => event.id !== "audit-guided-work-approved")]);
    setGuidedDemo((current) => ({ ...current, stage: "vendor" }));
    setNotice(`${GUIDED_WORK_ORDER_NUMBER} created and linked to the employee’s original request.`);
  }

  function confirmGuidedVendorSelection() {
    const vendor = fullDataset.vendors.find((record) => record.id === guidedDemo.selectedVendorId);
    const work = fullDataset.workOrders.find((record) => record.id === GUIDED_DEMO_IDS.workOrder);
    if (!vendor || !work) {
      setNotice("Create the customer work order before choosing a service partner.");
      return;
    }
    const assignment = createGuidedAssignment(fullDataset, vendor.id);
    setAssignments((current) => [assignment, ...current.filter((record) => record.id !== assignment.id)]);
    setWorkOrders((current) => current.map((record) => record.id === work.id ? {
      ...record,
      fulfillmentMode: "external",
      status: "ready_to_issue",
      accountable: {
        partyType: "person",
        partyId: GUIDED_DEMO_IDS.manager,
        nextAction: `Send ${GUIDED_WORK_ORDER_NUMBER} to ${vendor.displayName}`,
        dueAt: record.requestedWindow.endsAt,
        escalationPartyId: GUIDED_DEMO_IDS.manager,
      },
    } : record));
    setAuditEvents((current) => [{
      id: "audit-guided-vendor-selected",
      organizationId: fullDataset.organization.id,
      entityType: "assignment",
      entityId: assignment.id,
      eventType: "approved_vendor_selected",
      actorType: "person",
      actorId: GUIDED_DEMO_IDS.manager,
      channel: "manager_web",
      occurredAt: assignment.assignedAt,
      summary: `${vendor.displayName} selected for the approved work`,
      payloadSnapshot: { workOrderId: work.id, vendorId: vendor.id },
      demoMode: true,
    }, ...current.filter((event) => event.id !== "audit-guided-vendor-selected")]);
    setGuidedDemo((current) => ({ ...current, stage: "authorization", vendorResponse: undefined }));
    setNotice(`${vendor.displayName} selected. Review and send the external service authorization next.`);
  }

  function issueGuidedVendorWork() {
    const vendor = fullDataset.vendors.find((record) => record.id === guidedDemo.selectedVendorId);
    const work = fullDataset.workOrders.find((record) => record.id === GUIDED_DEMO_IDS.workOrder) ?? createGuidedWorkOrder(fullDataset);
    if (!vendor) {
      setNotice("Choose an approved vendor before issuing the customer work order.");
      return;
    }
    const assignment = createGuidedAssignment(fullDataset, vendor.id);
    const issuance = createGuidedIssuance(fullDataset, vendor.id);
    setAssignments((current) => [assignment, ...current.filter((record) => record.id !== assignment.id)]);
    setIssuances((current) => [issuance, ...current.filter((record) => record.id !== issuance.id)]);
    setWorkOrders((current) => current.map((record) => record.id === work.id ? {
      ...record,
      fulfillmentMode: "external",
      status: "awaiting_vendor_response",
      notToExceedMinor: GUIDED_NTE_MINOR,
      accountable: {
        partyType: "vendor",
        partyId: vendor.id,
        nextAction: "Vendor accepts, declines, or proposes a service date",
        dueAt: record.requestedWindow.endsAt,
        escalationPartyId: GUIDED_DEMO_IDS.manager,
      },
    } : record));
    setAuditEvents((current) => [{
      id: "audit-guided-issued",
      organizationId: fullDataset.organization.id,
      entityType: "vendor_issuance",
      entityId: issuance.id,
      eventType: "customer_work_order_issued",
      actorType: "person",
      actorId: GUIDED_DEMO_IDS.manager,
      channel: "manager_web",
      occurredAt: issuance.issuedAt,
      summary: `Customer work order issued to ${vendor.displayName}`,
      payloadSnapshot: { workOrderId: work.id, vendorId: vendor.id, nteMinor: GUIDED_NTE_MINOR },
      demoMode: true,
    }, ...current.filter((event) => event.id !== "audit-guided-issued")]);
    setGuidedDemo((current) => ({ ...current, stage: "authorization", externalWindowOpened: false }));
    setNotice(`${GUIDED_WORK_ORDER_NUMBER} issued to ${vendor.displayName}. Open the external version next.`);
  }

  function openExternalWorkOrder(workOrderId: string) {
    const work = fullDataset.workOrders.find((record) => record.id === workOrderId);
    const assignment = fullDataset.assignments.find((record) =>
      record.workOrderId === workOrderId && record.partyType === "vendor" && record.status !== "declined",
    );
    const vendor = assignment ? fullDataset.vendors.find((record) => record.id === assignment.partyId) : undefined;
    const store = work ? fullDataset.stores.find((record) => record.id === work.storeId) : undefined;
    const asset = work?.assetId ? fullDataset.assets.find((record) => record.id === work.assetId) : undefined;
    const issuance = fullDataset.vendorIssuances.find((record) => record.workOrderId === workOrderId);
    if (!work || !vendor || !store || !issuance) {
      setNotice("Select a vendor and send the service authorization before opening the vendor-facing work order.");
      return;
    }
    const url = new URL("/external-work-order", window.location.origin);
    url.searchParams.set("scenarioId", work.id);
    url.searchParams.set("wo", work.number);
    url.searchParams.set("store", `Store ${store.storeNumber} · ${store.name}`);
    url.searchParams.set("address", `${store.address.line1}, ${store.address.city}, ${store.address.state} ${store.address.postalCode}`);
    url.searchParams.set("vendor", vendor.displayName);
    url.searchParams.set("problem", work.problemDescription);
    url.searchParams.set("scope", work.scopeOfWork);
    if (issuance.notToExceedMinor !== undefined) url.searchParams.set("nteMinor", String(issuance.notToExceedMinor));
    url.searchParams.set("requestedWindow", `${dateLabel(work.requestedWindow.startsAt)} – ${dateLabel(work.requestedWindow.endsAt)}`);
    url.searchParams.set("access", `Check in at Store ${store.storeNumber} by QR, vendor app, or store device. Select ${work.number} when you arrive. ${asset ? `Service asset: ${asset.assetCode} · ${asset.name}.` : ""}`);
    const opened = window.open(url.toString(), `traceops-external-${work.id}`, "width=1120,height=860,resizable=yes,scrollbars=yes");
    opened?.focus();
    if (work.id === GUIDED_DEMO_IDS.workOrder) {
      setGuidedDemo((current) => ({ ...current, externalWindowOpened: Boolean(opened) }));
    }
    setNotice(opened
      ? `${work.number} opened in the vendor-facing window. Respond there, then return here to continue.`
      : "The browser blocked the vendor-facing window. Allow pop-ups and try again.");
  }

  function openGuidedExternalWorkOrder() {
    openExternalWorkOrder(GUIDED_DEMO_IDS.workOrder);
  }

  function mockGuidedVendorResponse(response: "accepted" | "declined" | "date_proposed") {
    window.postMessage({ type: "traceops:guided-vendor-response", scenarioId: GUIDED_DEMO_IDS.workOrder, response }, window.location.origin);
  }

  function guidedVisitCheckIn(value: VisitCheckInValue): ActiveVisit | void {
    const activeVisit = recordVisitCheckIn(value);
    if (activeVisit) setGuidedDemo((current) => ({ ...current, activeVisitId: activeVisit.id }));
    return activeVisit;
  }

  function guidedVisitCheckOut(value: VisitCheckOutValue) {
    recordVisitCheckOut(value);
    const vendorId = guidedDemo.selectedVendorId;
    const invoice = createGuidedInvoice(fullDataset, vendorId);
    const link = createGuidedInvoiceLink(fullDataset);
    const document = createGuidedInvoiceDocument(fullDataset);
    setInvoices((current) => [invoice, ...current.filter((record) => record.id !== invoice.id)]);
    setInvoiceWorkLinks((current) => [link, ...current.filter((record) => record.id !== link.id)]);
    setDocuments((current) => [document, ...current.filter((record) => record.id !== document.id)]);
    setAssignments((current) => current.map((assignment) => assignment.id === GUIDED_DEMO_IDS.assignment ? {
      ...assignment,
      status: "completed",
      completedAt: value.recordedAt,
    } : assignment));
    setWorkOrders((current) => current.map((work) => work.id === GUIDED_DEMO_IDS.workOrder ? {
      ...work,
      status: "invoice_received",
      outcome: "resolved",
      completedAt: value.recordedAt,
      accountable: {
        partyType: "person",
        partyId: "person-evan-rhodes",
        nextAction: "Review the matched evidence packet before AP handoff",
        dueAt: new Date(Date.parse(value.recordedAt) + 24 * 60 * 60 * 1000).toISOString(),
        escalationPartyId: "person-dana-brooks",
      },
    } : work));
    setAuditEvents((current) => [{
      id: "audit-guided-invoice-linked",
      organizationId: fullDataset.organization.id,
      entityType: "invoice_work_link",
      entityId: link.id,
      eventType: "invoice_matched_by_customer_work_order",
      actorType: "system",
      channel: "system",
      occurredAt: fullDataset.asOf,
      summary: "Invoice matched to the customer work order and attributed to Store 104",
      payloadSnapshot: { workOrderId: GUIDED_DEMO_IDS.workOrder, invoiceId: invoice.id, amountMinor: link.attributedAmountMinor },
      demoMode: true,
    }, ...current.filter((event) => event.id !== "audit-guided-invoice-linked")]);
    setGuidedDemo((current) => ({ ...current, stage: "analytics", invoiceLinked: true, activeVisitId: undefined }));
    setNotice("Checkout saved, the mock invoice matched by customer WO number, and every dashboard now has the same source chain.");
  }

  function openGuidedDestination(destination: "store" | "work" | "vendor" | "asset" | "spend") {
    if (destination === "spend") {
      setSpendPreset({
        regionId: guidedStore?.regionId ?? "region-central-ohio",
        storeId: GUIDED_DEMO_IDS.store,
        categoryId: GUIDED_DEMO_IDS.category,
      });
      navigate("spend");
      return;
    }
    setView(destination === "store" ? "stores" : destination === "vendor" ? "vendors" : destination === "asset" ? "equipment" : "work");
    setDetail({
      kind: destination,
      id: destination === "store"
        ? GUIDED_DEMO_IDS.store
        : destination === "vendor"
          ? guidedDemo.selectedVendorId
          : destination === "asset"
            ? GUIDED_DEMO_IDS.asset
            : GUIDED_DEMO_IDS.workOrder,
    });
  }

  function handleGuidedAction(action: GuidedDemoAction) {
    if (action === "submit_employee_request") {
      submitGuidedRequest();
      return;
    }
    if (action === "approve_and_create_work_order") {
      approveGuidedRequest();
      return;
    }
    if (action === "select_outside_vendor") {
      confirmGuidedVendorSelection();
      return;
    }
    if (action === "issue_service_authorization") {
      if (guidedIssuance) openGuidedExternalWorkOrder();
      else issueGuidedVendorWork();
    }
  }

  function handleGuidedAnalyticsNavigate(destination: GuidedDemoAnalyticsDestination) {
    if (destination === "store_spend") openGuidedDestination("store");
    else if (destination === "refrigeration_drilldown") openGuidedDestination("spend");
    else if (destination === "vendor_accountability") openGuidedDestination("vendor");
    else openGuidedDestination("asset");
  }

  function createTaxonomyCategory(value: TaxonomyCategoryCreateValue) {
    if (!guardPermission("manageSuite", "manage company naming")) return;
    if (fullDataset.categories.some((category) => category.label.trim().toLowerCase() === value.label.trim().toLowerCase())) {
      setNotice(`A service area named ${value.label} already exists.`);
      return;
    }
    const createdAt = nowMilliseconds();
    const slug = value.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || String(createdAt);
    const palette = ["#0b7568", "#df6d50", "#376f9e", "#d59a47", "#7560a8", "#4b7d51"];
    const category: MaintenanceCategory = {
      id: `category-session-${createdAt}`,
      organizationId: fullDataset.organization.id,
      key: `custom_${slug}`,
      label: value.label.trim(),
      description: value.description.trim() || `Company-defined maintenance service area for ${value.label.trim()}.`,
      aliases: [],
      color: palette[fullDataset.categories.length % palette.length],
      sortOrder: Math.max(0, ...fullDataset.categories.map((record) => record.sortOrder)) + 1,
      active: true,
    };
    setCategories((current) => [...current, category]);
    appendAuditEvent("taxonomy", category.id, "Company service area created", { categoryId: category.id, label: category.label });
    setNotice(`${category.label} added to the company naming structure. Activate it only at stores that use it.`);
  }

  function updateTaxonomyCategory(value: TaxonomyCategoryUpdateValue) {
    if (!guardPermission("manageSuite", "manage company naming")) return;
    const category = fullDataset.categories.find((record) => record.id === value.id);
    if (!category) return;
    if (fullDataset.categories.some((record) => record.id !== value.id && record.label.trim().toLowerCase() === value.label.trim().toLowerCase())) {
      setNotice(`A service area named ${value.label} already exists.`);
      return;
    }
    setCategories((current) => current.map((record) => record.id === value.id ? { ...record, label: value.label, active: value.active } : record));
    appendAuditEvent("taxonomy", value.id, "Company service area updated", { categoryId: value.id, previousLabel: category.label, label: value.label, active: value.active });
    setNotice(`${value.label} ${value.active ? "is active" : "was retired for new setup"}. Existing records keep their original classification.`);
  }

  function createTaxonomyNode(value: TaxonomyNodeCreateValue) {
    if (!guardPermission("manageSuite", "manage company naming")) return;
    const category = fullDataset.categories.find((record) => record.id === value.categoryId);
    const parent = value.parentId ? fullDataset.taxonomyNodes.find((record) => record.id === value.parentId) : undefined;
    if (!category || (value.parentId && (!parent || parent.categoryId !== category.id))) {
      setNotice("Choose a valid parent within the selected service area.");
      return;
    }
    const siblings = fullDataset.taxonomyNodes.filter((record) => record.categoryId === category.id && record.parentId === value.parentId);
    if (siblings.some((record) => record.label.trim().toLowerCase() === value.label.trim().toLowerCase())) {
      setNotice(`${value.label} already exists at that level.`);
      return;
    }
    const createdAt = nowMilliseconds();
    const node: TaxonomyNode = {
      id: `taxonomy-session-${createdAt}`,
      organizationId: fullDataset.organization.id,
      categoryId: category.id,
      parentId: value.parentId,
      canonicalKey: `${category.key}_${value.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
      label: value.label.trim(),
      aliases: [],
      kind: value.kind,
      sortOrder: Math.max(0, ...siblings.map((record) => record.sortOrder)) + 1,
      active: true,
    };
    setTaxonomyNodes((current) => [...current, node]);
    appendAuditEvent("taxonomy", node.id, "Company taxonomy node created", { nodeId: node.id, categoryId: category.id, parentId: node.parentId ?? null, label: node.label, kind: node.kind });
    setNotice(`${node.label} added beneath ${parent?.label ?? category.label}.`);
  }

  function updateTaxonomyNode(value: TaxonomyNodeUpdateValue) {
    if (!guardPermission("manageSuite", "manage company naming")) return;
    const node = fullDataset.taxonomyNodes.find((record) => record.id === value.id);
    if (!node) return;
    const duplicate = fullDataset.taxonomyNodes.some((record) => record.id !== value.id && record.categoryId === node.categoryId && record.parentId === node.parentId && record.label.trim().toLowerCase() === value.label.trim().toLowerCase());
    if (duplicate) {
      setNotice(`${value.label} already exists at that level.`);
      return;
    }
    setTaxonomyNodes((current) => current.map((record) => record.id === value.id ? { ...record, label: value.label, active: value.active } : record));
    appendAuditEvent("taxonomy", value.id, "Company taxonomy node updated", { nodeId: value.id, previousLabel: node.label, label: value.label, active: value.active });
    setNotice(`${value.label} ${value.active ? "is available for setup" : "was retired for new setup"}. Existing assets keep their recorded path.`);
  }

  function createStore(value: GuidedStoreSetupValue) {
    if (!guardPermission("createStore", "create stores")) return;
    const normalizedStoreNumber = value.storeNumber.trim().toLowerCase();
    const normalizedAddress = `${value.address.line1}, ${value.address.city}, ${value.address.state} ${value.address.postalCode}`.trim().toLowerCase();
    if (fullDataset.stores.some((store) => store.storeNumber.trim().toLowerCase() === normalizedStoreNumber)) {
      setNotice(`Store number ${value.storeNumber} already exists.`);
      return;
    }
    if (fullDataset.stores.some((store) => store.normalizedAddress.trim().toLowerCase() === normalizedAddress)) {
      setNotice("A store with that address already exists.");
      return;
    }
    const manager = fullDataset.people.find((person) => person.roles.includes("store_manager")) ?? fullDataset.people[0];
    if (!manager) return;
    const regionStore = fullDataset.stores.find((record) => record.regionId === value.regionId);
    const store: Store = {
      id: `store-session-${nowMilliseconds()}`,
      organizationId: dataset.organization.id,
      divisionId: dataset.divisions[0]?.id,
      regionId: value.regionId,
      storeNumber: value.storeNumber,
      name: value.name,
      normalizedAddress: `${value.address.line1}, ${value.address.city}, ${value.address.state} ${value.address.postalCode}`,
      address: value.address,
      coordinates: regionStore?.coordinates ?? { latitude: 39.5, longitude: -84.5 },
      externalIdentifiers: { demo_setup: `NEW-${value.storeNumber}`, coordinate_status: "unverified_demo_estimate" },
      aliases: [],
      phone: "(555) 010-0199",
      managerPersonId: manager.id,
      format: value.format,
      open24Hours: value.hours.mode === "open_24_hours",
      openedOn: dataset.asOf.slice(0, 10),
      squareFeet: value.format === "travel_center" ? 7200 : value.format === "market_only" ? 2800 : 4100,
      activeCategoryIds: value.starterCategoryIds,
      status: "open",
      searchTerms: [value.storeNumber, value.name, value.address.line1, value.address.city],
    };
    setStores((current) => [store, ...current]);
    appendAuditEvent("store", store.id, "Store created", { storeId: store.id, storeNumber: store.storeNumber, regionId: store.regionId ?? null, starterServiceAreaCount: store.activeCategoryIds.length, coordinateStatus: "unverified_demo_estimate" });
    setDrawer(null);
    setView("stores");
    setDetail({ kind: "store", id: store.id });
    setNotice(`Store ${store.storeNumber} created with ${store.activeCategoryIds.length} starter service areas. Equipment and PM can be added when useful.`);
  }

  function onboardVendor(value: VendorOnboardingValue) {
    if (!guardPermission("manageSuite", "onboard vendors")) return;
    if (fullDataset.vendors.some((vendor) => [vendor.legalName, vendor.displayName, ...vendor.aliases].some((name) => name.trim().toLowerCase() === value.name.trim().toLowerCase()))) {
      setNotice(`${value.name} is already in the vendor directory.`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.dispatchContact.email.trim())) {
      setNotice("Enter a valid dispatch email address.");
      return;
    }
    if (value.dispatchContact.phone.replace(/\D/g, "").length < 10) {
      setNotice("Enter a dispatch phone number with at least 10 digits.");
      return;
    }
    if (!value.categoryIds.every((categoryId) => fullDataset.categories.some((category) => category.id === categoryId && category.active !== false)) || !value.regionIds.every((regionId) => fullDataset.regions.some((region) => region.id === regionId))) {
      setNotice("Choose active service specialties and valid coverage regions.");
      return;
    }
    const createdAt = nowMilliseconds();
    const vendor: Vendor = {
      id: `vendor-session-${createdAt}`,
      organizationId: fullDataset.organization.id,
      legalName: value.name.trim(),
      displayName: value.name.trim(),
      customerVendorNumber: `V-${String(fullDataset.vendors.length + 1).padStart(4, "0")}`,
      description: value.description.trim(),
      aliases: value.aliases,
      specialties: value.categoryIds.map((categoryId) => {
        const category = fullDataset.categories.find((record) => record.id === categoryId);
        return {
          categoryId,
          label: category?.label ?? "General maintenance",
          aliases: category ? category.aliases : [],
          equipmentTypes: fullDataset.taxonomyNodes
            .filter((node) => node.categoryId === categoryId && node.kind === "equipment_type")
            .map((node) => node.label),
        };
      }),
      searchTerms: [value.name, value.description, ...value.aliases],
      coverageRegionIds: value.regionIds,
      preferredStoreIds: [],
      contacts: [{
        id: `vendor-contact-session-${createdAt}`,
        name: value.dispatchContact.name.trim(),
        role: "dispatch",
        email: value.dispatchContact.email.trim(),
        phone: value.dispatchContact.phone.trim(),
        preferredChannel: value.dispatchContact.preferredChannel,
      }],
      afterHoursAvailable: value.afterHoursAvailable,
      status: value.status,
      portalEnabled: value.portalEnabled,
    };
    setVendors((current) => [vendor, ...current]);
    appendAuditEvent("vendor", vendor.id, "Approved vendor onboarded", {
      vendorId: vendor.id,
      categoryIds: value.categoryIds.join(","),
      regionIds: value.regionIds.join(","),
      portalEnabled: value.portalEnabled,
    });
    setDrawer(null);
    setView("vendors");
    setDetail({ kind: "vendor", id: vendor.id });
    setNotice(`${vendor.displayName} added to the approved vendor directory.`);
  }

  function updateStoreServiceAreas(value: StoreServiceAreasValue) {
    if (!guardPermission("manageSuite", "configure store service areas")) return;
    const store = fullDataset.stores.find((record) => record.id === value.storeId);
    if (!store) return;
    const removedCategoryIds = store.activeCategoryIds.filter((categoryId) => !value.activeCategoryIds.includes(categoryId));
    const blockedCategoryId = removedCategoryIds.find((categoryId) =>
      fullDataset.assets.some((asset) => asset.storeId === value.storeId && asset.categoryId === categoryId && asset.status !== "retired") ||
      fullDataset.pmPlans.some((plan) => plan.storeId === value.storeId && plan.categoryId === categoryId && plan.active),
    );
    if (blockedCategoryId) {
      const category = fullDataset.categories.find((record) => record.id === blockedCategoryId);
      setNotice(`${category?.label ?? "That service area"} still has active equipment or preventive-maintenance plans. Retire or reclassify those records first.`);
      return;
    }
    setStores((current) => current.map((store) => store.id === value.storeId ? {
      ...store,
      activeCategoryIds: value.activeCategoryIds,
    } : store));
    appendAuditEvent("store", value.storeId, "Store service areas updated", {
      storeId: value.storeId,
      activeCategoryIds: value.activeCategoryIds.join(","),
    });
    setDrawer(null);
    setWorkflowStoreId(null);
    setView("stores");
    setDetail({ kind: "store", id: value.storeId });
    setNotice(`${value.activeCategoryIds.length} service areas are now active for this store.`);
  }

  function createAsset(value: AssetSetupValue) {
    if (!guardPermission("manageSuite", "add equipment")) return;
    const store = fullDataset.stores.find((record) => record.id === value.storeId);
    const selectedNode = fullDataset.taxonomyNodes.find((node) => node.id === value.taxonomyNodeId);
    if (!store || !selectedNode || selectedNode.active === false || selectedNode.categoryId !== value.categoryId || !store.activeCategoryIds.includes(value.categoryId)) {
      setNotice("Choose an active store service area and a valid company equipment type within it.");
      return;
    }
    if (fullDataset.assets.some((asset) => asset.storeId === value.storeId && asset.assetCode.trim().toLowerCase() === value.assetCode.trim().toLowerCase())) {
      setNotice(`${value.assetCode} is already used at Store ${store.storeNumber}.`);
      return;
    }
    if (value.serialNumber.trim() && fullDataset.assets.some((asset) => asset.serialNumber.trim().toLowerCase() === value.serialNumber.trim().toLowerCase())) {
      setNotice(`Serial number ${value.serialNumber} is already assigned to another asset.`);
      return;
    }
    if (value.supplierVendorId && !fullDataset.vendors.some((vendor) => vendor.id === value.supplierVendorId && vendor.status !== "inactive")) {
      setNotice("Choose an active supplier from the approved vendor directory.");
      return;
    }
    if (value.warranty && Date.parse(value.warranty.endsOn) < Date.parse(value.warranty.startsOn)) {
      setNotice("Warranty end date must be on or after its start date.");
      return;
    }
    const taxonomyPathIds = [selectedNode.id];
    let parentId = selectedNode.parentId;
    while (parentId) {
      const parent = fullDataset.taxonomyNodes.find((node) => node.id === parentId);
      if (!parent || taxonomyPathIds.includes(parent.id)) break;
      taxonomyPathIds.unshift(parent.id);
      parentId = parent.parentId;
    }
    const asset: Asset = {
      id: `asset-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      storeId: value.storeId,
      categoryId: value.categoryId,
      taxonomyNodeId: value.taxonomyNodeId,
      taxonomyPathIds,
      assetCode: value.assetCode.trim(),
      name: value.name.trim(),
      assetType: value.assetType.trim(),
      locationDetail: value.locationDetail.trim(),
      manufacturer: value.manufacturer.trim(),
      model: value.model.trim(),
      serialNumber: value.serialNumber.trim(),
      installedOn: value.installedOn,
      expectedLifeYears: value.expectedLifeYears,
      replacementEstimateMinor: value.replacementEstimateMinor,
      currency: "USD",
      supplierVendorId: value.supplierVendorId,
      warranty: value.warranty,
      status: "active",
      criticality: value.criticality,
      searchTerms: [value.assetCode, value.name, value.assetType, value.manufacturer, value.model, value.serialNumber].filter(Boolean),
    };
    setAssets((current) => [asset, ...current]);
    appendAuditEvent("asset", asset.id, "Equipment record created", {
      assetId: asset.id,
      storeId: asset.storeId,
      categoryId: asset.categoryId,
      taxonomyNodeId: asset.taxonomyNodeId,
    });
    setDrawer(null);
    setWorkflowStoreId(null);
    setView("equipment");
    setDetail({ kind: "asset", id: asset.id });
    setNotice(`${asset.assetCode} created. Components and preventive maintenance can be added when useful.`);
  }

  function createAssetComponent(value: ComponentSetupValue) {
    if (!guardPermission("manageSuite", "add equipment components")) return;
    const asset = fullDataset.assets.find((record) => record.id === value.assetId);
    if (!asset) return;
    if (value.parentComponentId && !fullDataset.assetComponents.some((component) => component.id === value.parentComponentId && component.assetId === asset.id)) {
      setNotice("Choose a parent component from the same asset.");
      return;
    }
    if (fullDataset.assetComponents.some((component) => component.assetId === asset.id && component.componentCode.trim().toLowerCase() === value.componentCode.trim().toLowerCase())) {
      setNotice(`${value.componentCode} is already used beneath ${asset.name}.`);
      return;
    }
    if (value.serialNumber?.trim() && fullDataset.assetComponents.some((component) => component.serialNumber?.trim().toLowerCase() === value.serialNumber?.trim().toLowerCase())) {
      setNotice(`Serial number ${value.serialNumber} is already assigned to another component.`);
      return;
    }
    const component: AssetComponent = {
      id: `component-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      assetId: value.assetId,
      parentComponentId: value.parentComponentId,
      componentCode: value.componentCode.trim(),
      name: value.name.trim(),
      componentType: value.componentType.trim(),
      manufacturer: value.manufacturer?.trim() || undefined,
      model: value.model?.trim() || undefined,
      serialNumber: value.serialNumber?.trim() || undefined,
      installedOn: value.installedOn || undefined,
      status: value.status,
    };
    setAssetComponents((current) => [component, ...current]);
    appendAuditEvent("asset", asset.id, "Equipment component added", {
      assetId: asset.id,
      componentId: component.id,
      parentComponentId: component.parentComponentId ?? null,
    });
    setDrawer(null);
    setWorkflowAssetId(null);
    setView("equipment");
    setDetail({ kind: "asset", id: asset.id });
    setNotice(`${component.name} added beneath ${asset.name}.`);
  }

  function createPmPlan(value: PmPlanSetupValue) {
    if (!guardPermission("manageSuite", "create preventive-maintenance plans")) return;
    const store = fullDataset.stores.find((record) => record.id === value.storeId);
    const asset = value.assetId ? fullDataset.assets.find((record) => record.id === value.assetId) : undefined;
    if (!store || !store.activeCategoryIds.includes(value.categoryId) || (value.assetId && (!asset || asset.storeId !== store.id || asset.categoryId !== value.categoryId))) {
      setNotice("Choose a valid store service area and an asset from that same classification.");
      return;
    }
    const assignmentValid = value.assignedPartyType === "vendor"
      ? fullDataset.vendors.some((vendor) => vendor.id === value.assignedPartyId && vendor.status !== "inactive" && vendor.specialties.some((specialty) => specialty.categoryId === value.categoryId) && (!store.regionId || vendor.coverageRegionIds.includes(store.regionId)))
      : fullDataset.teams.some((team) => team.id === value.assignedPartyId && team.categoryIds.includes(value.categoryId) && (!store.regionId || team.regionIds.includes(store.regionId)));
    if (!assignmentValid) {
      setNotice("Choose an internal team or approved vendor that covers this store and service area.");
      return;
    }
    if (fullDataset.pmPlans.some((plan) => plan.active && plan.storeId === value.storeId && plan.categoryId === value.categoryId && plan.assetId === value.assetId && plan.name.trim().toLowerCase() === value.name.trim().toLowerCase())) {
      setNotice(`An active PM plan named ${value.name} already covers this scope.`);
      return;
    }
    const createdAt = nowMilliseconds();
    const plan: PreventiveMaintenancePlan = {
      id: `pm-plan-session-${createdAt}`,
      organizationId: fullDataset.organization.id,
      storeId: value.storeId,
      categoryId: value.categoryId,
      assetId: value.assetId,
      name: value.name.trim(),
      description: value.description.trim(),
      cadence: value.cadence,
      fulfillmentMode: value.fulfillmentMode,
      assignedPartyType: value.assignedPartyType,
      assignedPartyId: value.assignedPartyId,
      active: true,
      nextDueAt: new Date(value.nextDueAt).toISOString(),
      requiredEvidence: value.requiredEvidence,
    };
    const occurrence: PmOccurrence = {
      id: `pm-occurrence-session-${createdAt}`,
      organizationId: fullDataset.organization.id,
      pmPlanId: plan.id,
      storeId: plan.storeId,
      dueAt: plan.nextDueAt,
      status: Date.parse(plan.nextDueAt) < Date.parse(fullDataset.asOf) ? "overdue" : "upcoming",
    };
    setPmPlans((current) => [plan, ...current]);
    setPmOccurrences((current) => [occurrence, ...current]);
    appendAuditEvent("pm_occurrence", occurrence.id, "Preventive-maintenance plan created", {
      pmPlanId: plan.id,
      occurrenceId: occurrence.id,
      storeId: plan.storeId,
      assignedPartyType: plan.assignedPartyType,
      assignedPartyId: plan.assignedPartyId,
    });
    setDrawer(null);
    setWorkflowStoreId(null);
    setWorkflowAssetId(null);
    setView("pm");
    setDetail({ kind: "pm", id: occurrence.id });
    setNotice(`${plan.name} created with its first occurrence due ${dateLabel(plan.nextDueAt)}.`);
  }

  function createWorkFromPmOccurrence(occurrenceId: string) {
    if (!guardPermission("createWork", "create preventive-maintenance work")) return;
    const occurrence = dataset.pmOccurrences.find((record) => record.id === occurrenceId);
    const plan = occurrence ? dataset.pmPlans.find((record) => record.id === occurrence.pmPlanId) : undefined;
    const store = plan ? dataset.stores.find((record) => record.id === plan.storeId) : undefined;
    if (!occurrence || !plan || !store) return;
    if (occurrence.workOrderId) {
      setView("work");
      setDetail({ kind: "work", id: occurrence.workOrderId });
      return;
    }
    const now = new Date().toISOString();
    const requestedEndsAt = Date.parse(occurrence.dueAt) > Date.parse(now)
      ? occurrence.dueAt
      : new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
    const work: WorkOrder = {
      id: `work-pm-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      number: `${fullDataset.organization.workOrderPrefix}-${store.storeNumber}-PM-${String(fullDataset.workOrders.length + 1).padStart(4, "0")}`,
      storeId: plan.storeId,
      pmOccurrenceId: occurrence.id,
      categoryId: plan.categoryId,
      assetId: plan.assetId,
      taxonomyNodeId: plan.assetId ? fullDataset.assets.find((asset) => asset.id === plan.assetId)?.taxonomyNodeId : undefined,
      title: plan.name,
      problemDescription: plan.description,
      scopeOfWork: `${plan.description} Record ${plan.requiredEvidence.map(words).join(", ")} before completion.`,
      priority: "routine",
      source: "pm",
      fulfillmentMode: plan.fulfillmentMode,
      status: plan.fulfillmentMode === "external" ? "ready_to_issue" : "draft",
      createdByPersonId: activePerson.id,
      createdAt: now,
      requestedWindow: { startsAt: now, endsAt: requestedEndsAt },
      accountable: {
        partyType: plan.assignedPartyType,
        partyId: plan.assignedPartyId,
        nextAction: plan.fulfillmentMode === "external" ? "Issue the PM work order to the assigned vendor" : "Acknowledge and perform preventive maintenance",
        dueAt: requestedEndsAt,
        escalationPartyId: activePerson.id,
      },
      currency: "USD",
      classificationDeferred: !plan.assetId,
      tags: ["preventive-maintenance", plan.cadence],
    };
    const assignment: WorkAssignment = {
      id: `assignment-pm-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      workOrderId: work.id,
      partyType: plan.assignedPartyType,
      partyId: plan.assignedPartyId,
      status: "offered",
      assignedAt: now,
      assignmentNote: "Created from the linked preventive-maintenance occurrence.",
    };
    setWorkOrders((current) => [work, ...current]);
    setAssignments((current) => [assignment, ...current]);
    setPmOccurrences((current) => current.map((record) => record.id === occurrence.id ? {
      ...record,
      workOrderId: work.id,
      status: "due",
    } : record));
    appendAuditEvent("pm_occurrence", occurrence.id, "Preventive-maintenance work order created", {
      pmOccurrenceId: occurrence.id,
      workOrderId: work.id,
      assignmentId: assignment.id,
    });
    setView("work");
    setDetail({ kind: "work", id: work.id });
    setNotice(`${work.number} created from ${plan.name}.`);
  }

  function completePmOccurrence(value: PmOccurrenceCompletionValue) {
    if (!guardPermission("createWork", "complete preventive maintenance")) return;
    const occurrence = dataset.pmOccurrences.find((record) => record.id === value.occurrenceId);
    const plan = occurrence ? dataset.pmPlans.find((record) => record.id === occurrence.pmPlanId) : undefined;
    if (!occurrence || !plan || ["completed", "skipped"].includes(occurrence.status)) return;
    const linkedWork = occurrence.workOrderId ? dataset.workOrders.find((work) => work.id === occurrence.workOrderId) : undefined;
    if (linkedWork && !["completed", "closed"].includes(linkedWork.status)) {
      throw new Error("Complete the linked work order before completing this PM occurrence.");
    }
    const visits = linkedWork ? dataset.visits.filter((visit) => visit.workOrderId === linkedWork.id && visit.checkedOutAt) : [];
    const visitIds = new Set(visits.map((visit) => visit.id));
    const photoDocuments = linkedWork ? dataset.documents.filter((document) =>
      (document.workOrderId === linkedWork.id || (document.visitId && visitIds.has(document.visitId))) &&
      (document.kind === "before_photo" || document.kind === "after_photo" || document.mediaType.startsWith("image/")),
    ) : [];
    const missingRequirements = plan.requiredEvidence.filter((requirement) =>
      requirement === "visit"
        ? !visits.length
        : requirement === "photo"
          ? !photoDocuments.length
          : requirement === "checklist"
            ? !value.checklistConfirmed
            : !value.reading?.trim(),
    );
    if (missingRequirements.length && (value.overrideReason?.trim().length ?? 0) < 8) {
      throw new Error(`Missing ${missingRequirements.map(words).join(", ")}; record an override reason to continue.`);
    }
    const completedAt = new Date().toISOString();
    const nextDueAt = nextPmDueAt(occurrence.dueAt, plan.cadence);
    const evidenceRecords: NonNullable<PmOccurrence["evidenceRecords"]> = plan.requiredEvidence.map((requirement, index) => {
      const missing = missingRequirements.includes(requirement);
      const sourceRecordIds = requirement === "visit"
        ? visits.map((visit) => visit.id)
        : requirement === "photo"
          ? photoDocuments.map((document) => document.id)
          : [];
      return {
        id: `pm-evidence-${occurrence.id}-${nowMilliseconds()}-${index + 1}`,
        requirement,
        status: missing ? "overridden" : "satisfied",
        source: missing
          ? "manager_override"
          : requirement === "visit"
            ? "visit"
            : requirement === "photo"
              ? "document"
              : "manager_confirmation",
        sourceRecordIds,
        value: missing ? value.overrideReason?.trim() : requirement === "reading" ? value.reading?.trim() : requirement === "checklist" ? "Required checklist confirmed" : undefined,
        recordedAt: completedAt,
        recordedByPersonId: activePerson.id,
      };
    });
    const nextOccurrence: PmOccurrence = {
      id: `pm-occurrence-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      pmPlanId: plan.id,
      storeId: plan.storeId,
      dueAt: nextDueAt,
      status: Date.parse(nextDueAt) < Date.parse(fullDataset.asOf) ? "overdue" : "upcoming",
    };
    setPmOccurrences((current) => {
      const completed = current.map((record) => record.id === occurrence.id ? {
        ...record,
        status: "completed" as const,
        completedAt,
        completedByPartyId: activePerson.id,
        completionNote: value.note?.trim() || "Preventive maintenance completed.",
        evidenceRecords,
      } : record);
      return completed.some((record) => record.pmPlanId === plan.id && record.dueAt === nextDueAt)
        ? completed
        : [nextOccurrence, ...completed];
    });
    setPmPlans((current) => current.map((record) => record.id === plan.id ? { ...record, nextDueAt } : record));
    setExceptions((current) => current.map((record) =>
      record.type === "pm_overdue" && (record.sourceRecordIds.includes(occurrence.id) || record.sourceRecordIds.includes(plan.id))
        ? { ...record, status: "resolved", resolvedAt: completedAt }
        : record,
    ));
    appendAuditEvent("pm_occurrence", occurrence.id, "Preventive maintenance completed", {
      pmOccurrenceId: occurrence.id,
      workOrderId: occurrence.workOrderId ?? null,
      note: value.note ?? null,
      evidenceCount: evidenceRecords.length,
      overrideCount: evidenceRecords.filter((record) => record.status === "overridden").length,
      nextDueAt,
    });
    setDetail({ kind: "pm", id: occurrence.id });
    setNotice(`Preventive-maintenance completion recorded. The next occurrence is due ${dateLabel(nextDueAt)}.`);
  }

  function waivePmOccurrence(value: PmOccurrenceWaiverValue) {
    if (!guardPermission("manageSuite", "waive preventive maintenance")) return;
    const occurrence = dataset.pmOccurrences.find((record) => record.id === value.occurrenceId);
    const plan = occurrence ? dataset.pmPlans.find((record) => record.id === occurrence.pmPlanId) : undefined;
    if (!occurrence || !plan || ["completed", "skipped"].includes(occurrence.status)) return;
    const linkedWork = occurrence.workOrderId ? dataset.workOrders.find((work) => work.id === occurrence.workOrderId) : undefined;
    if (linkedWork && !["closed", "cancelled"].includes(linkedWork.status)) {
      throw new Error("Cancel or close the linked work order before waiving this PM occurrence.");
    }
    const waivedAt = new Date().toISOString();
    const nextDueAt = nextPmDueAt(occurrence.dueAt, plan.cadence);
    const nextOccurrence: PmOccurrence = {
      id: `pm-occurrence-session-${nowMilliseconds()}`,
      organizationId: fullDataset.organization.id,
      pmPlanId: plan.id,
      storeId: plan.storeId,
      dueAt: nextDueAt,
      status: Date.parse(nextDueAt) < Date.parse(fullDataset.asOf) ? "overdue" : "upcoming",
    };
    setPmOccurrences((current) => {
      const waived = current.map((record) => record.id === occurrence.id ? {
        ...record,
        status: "skipped" as const,
        completionNote: `Waived: ${value.reason.trim()}`,
        completedByPartyId: activePerson.id,
      } : record);
      return waived.some((record) => record.pmPlanId === plan.id && record.dueAt === nextDueAt)
        ? waived
        : [nextOccurrence, ...waived];
    });
    setPmPlans((current) => current.map((record) => record.id === plan.id ? { ...record, nextDueAt } : record));
    setExceptions((current) => current.map((record) =>
      record.type === "pm_overdue" && (record.sourceRecordIds.includes(occurrence.id) || record.sourceRecordIds.includes(plan.id))
        ? { ...record, status: "resolved", resolvedAt: waivedAt }
        : record,
    ));
    appendAuditEvent("pm_occurrence", occurrence.id, "Preventive maintenance waived", {
      pmOccurrenceId: occurrence.id,
      reason: value.reason.trim(),
      nextDueAt,
    });
    setDetail({ kind: "pm", id: occurrence.id });
    setNotice(`The PM occurrence was waived with a permanent reason. The next occurrence is due ${dateLabel(nextDueAt)}.`);
  }

  function saveWorkClassification(value: WorkClassificationValue) {
    if (!guardPermission("classifyWork", "change equipment classification")) return;
    if (!dataset.workOrders.some((work) => work.id === value.workOrderId)) {
      setNotice("That work order is outside this role’s assigned scope.");
      return;
    }
    setWorkOrders((current) =>
      current.map((record) =>
        record.id === value.workOrderId
          ? {
              ...record,
              categoryId: value.categoryId,
              taxonomyNodeId: value.taxonomyNodeId,
              assetId: value.assetId,
              componentId: value.componentId,
              classificationDeferred: value.classificationDeferred,
            }
          : record,
      ),
    );
    appendAuditEvent("work_order", value.workOrderId, "Maintenance classification updated", {
      workOrderId: value.workOrderId,
      categoryId: value.categoryId ?? null,
      taxonomyNodeId: value.taxonomyNodeId ?? null,
      assetId: value.assetId ?? null,
      componentId: value.componentId ?? null,
      classificationDeferred: value.classificationDeferred,
    });
    setDrawer(null);
    setClassificationWorkId(null);
    setDetail({ kind: "work", id: value.workOrderId });
    setNotice(value.classificationDeferred ? "Current classification saved. Deeper equipment detail remains optional." : "Work order classified through the selected equipment level.");
  }

  function createWorkOrder(value: WorkOrderCreationValue) {
    if (!guardPermission("createWork", "create work orders")) return;
    const store = dataset.stores.find((record) => record.id === value.storeId);
    if (!store) return;
    const creator = activePerson;
    if (!creator) return;
    const selectedAsset = value.assetId
      ? dataset.assets.find((asset) => asset.id === value.assetId && asset.storeId === store.id)
      : undefined;
    const selectedComponent = selectedAsset && value.componentId
      ? dataset.assetComponents.find((component) => component.id === value.componentId && component.assetId === selectedAsset.id)
      : undefined;
    const sequence = String(300 + workOrders.length + 1).padStart(6, "0");
    const now = new Date(dataset.asOf);
    const due = new Date(now);
    due.setDate(due.getDate() + (value.priority === "emergency" ? 0 : value.priority === "urgent" ? 1 : 3));
    const newWork: WorkOrder = {
      id: `wo-created-${workOrders.length + 1}`,
      organizationId: dataset.organization.id,
      number: `${dataset.organization.workOrderPrefix}-${store.storeNumber}-${sequence}`,
      storeId: store.id,
      categoryId: selectedAsset?.categoryId,
      taxonomyNodeId: selectedAsset?.taxonomyPathIds.at(-1),
      assetId: selectedAsset?.id,
      componentId: selectedComponent?.id,
      title: value.problem.length > 56 ? `${value.problem.slice(0, 53)}…` : value.problem,
      problemDescription: value.problem,
      scopeOfWork: "Diagnose the reported condition and restore safe, normal operation. Call before exceeding authorization.",
      priority: value.priority,
      source: "manager_direct",
      fulfillmentMode: value.fulfillmentMode === "decide_later" ? "unassigned" : value.fulfillmentMode,
      status:
        value.fulfillmentMode === "external"
          ? "ready_to_issue"
          : "draft",
      createdByPersonId: creator.id,
      createdAt: dataset.asOf,
      requestedWindow: { startsAt: dataset.asOf, endsAt: due.toISOString() },
      accountable: {
        partyType:
          value.fulfillmentMode === "internal" && value.internalTeamId
            ? "team"
            : value.fulfillmentMode === "external"
              ? "vendor"
              : "person",
        partyId: value.internalTeamId ?? value.vendorId ?? creator.id,
        nextAction: value.fulfillmentMode === "external" ? "Issue customer work order to selected vendor" : value.fulfillmentMode === "internal" ? "Acknowledge and assess work" : "Choose internal team or outside vendor",
        dueAt: due.toISOString(),
        escalationPartyId: creator.id,
      },
      notToExceedMinor: value.fulfillmentMode === "external" ? 75000 : undefined,
      currency: "USD",
      classificationDeferred: !selectedAsset,
      tags: ["created-in-demo"],
    };
    setWorkOrders((current) => [newWork, ...current]);
    appendAuditEvent("work_order", newWork.id, "Customer work order created", {
      workOrderId: newWork.id,
      storeId: newWork.storeId,
      fulfillmentMode: newWork.fulfillmentMode,
      status: newWork.status,
      assetId: newWork.assetId ?? null,
      componentId: newWork.componentId ?? null,
    });

    if (value.fulfillmentMode === "external" && value.vendorId) {
      const assignment: WorkAssignment = {
        id: `assignment-created-${assignments.length + 1}`,
        organizationId: dataset.organization.id,
        workOrderId: newWork.id,
        partyType: "vendor",
        partyId: value.vendorId,
        status: "offered",
        assignedAt: dataset.asOf,
        assignmentNote: "Outside vendor selected; service authorization ready to send.",
      };
      setAssignments((current) => [assignment, ...current]);
      appendAuditEvent("assignment", assignment.id, "Outside vendor selected", {
        workOrderId: newWork.id,
        vendorId: value.vendorId,
      });
      const vendor = vendorOptions.find((record) => record.id === value.vendorId);
      const storeOption = storeOptions.find((record) => record.id === value.storeId);
      if (vendor && storeOption) {
        setPendingAuthorization({
          workOrderId: newWork.id,
          customerWorkOrderNumber: newWork.number,
          store: storeOption,
          vendor,
          problem: newWork.problemDescription,
          requestedService: newWork.scopeOfWork,
          priority: value.priority,
          requestedWindow: `${dateLabel(newWork.requestedWindow.startsAt)} – ${dateLabel(newWork.requestedWindow.endsAt)}`,
          accessInstructions: "Check in using the store QR or the store service desk before beginning work.",
          nteMinorUnits: newWork.notToExceedMinor,
          currency: "USD",
        });
        setDrawer("issue-vendor");
        return;
      }
    } else if (value.fulfillmentMode === "internal" && value.internalTeamId) {
      const internalTeamId = value.internalTeamId;
      setAssignments((current) => [
        {
          id: `assignment-created-${assignments.length + 1}`,
          organizationId: dataset.organization.id,
          workOrderId: newWork.id,
          partyType: "team",
          partyId: internalTeamId,
          status: "offered",
          assignedAt: dataset.asOf,
          assignmentNote: "Assigned to internal maintenance queue.",
        },
        ...current,
      ]);
      appendAuditEvent("assignment", `assignment-created-${assignments.length + 1}`, "Internal team selected", {
        workOrderId: newWork.id,
        teamId: internalTeamId,
      });
    }
    setDrawer(null);
    setView("work");
    setDetail({ kind: "work", id: newWork.id });
    setNotice(`${newWork.number} created.`);
  }

  function openAuthorizationForWork(workOrderId: string) {
    if (!guardPermission("issueVendorWork", "issue work to vendors")) return;
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    const assignment = dataset.assignments.find(
      (record) => record.workOrderId === workOrderId && record.partyType === "vendor" && record.status !== "declined",
    );
    const store = work ? storeOptions.find((record) => record.id === work.storeId) : undefined;
    const vendor = assignment ? vendorOptions.find((record) => record.id === assignment.partyId) : undefined;
    if (!work || !store || !vendor) {
      setNotice("Choose an outside vendor before issuing this customer work order.");
      return;
    }
    setPendingAuthorization({
      workOrderId: work.id,
      customerWorkOrderNumber: work.number,
      store,
      vendor,
      problem: work.problemDescription,
      requestedService: work.scopeOfWork,
      priority: work.priority,
      requestedWindow: `${dateLabel(work.requestedWindow.startsAt)} – ${dateLabel(work.requestedWindow.endsAt)}`,
      accessInstructions: "Check in using the store QR or the store service desk before beginning work.",
      nteMinorUnits: work.notToExceedMinor,
      currency: work.currency,
    });
    setDrawer("issue-vendor");
  }

  function openLifecycleHistory(assetId: string) {
    setPendingAuthorization(null);
    setDrawer(null);
    setLifecycleTab("review");
    setView("equipment");
    setDetail({ kind: "asset", id: assetId });
  }

  function addAssetToCapexPlan(assetId: string) {
    const facts = getAssetLifecycleDecisionFacts(dataset, dataset.organization.id, assetId);
    if (!facts) return;
    const currentYear = new Date(dataset.asOf).getUTCFullYear();
    setCapexDrafts((current) => ({
      ...current,
      [assetId]: current[assetId] ?? {
        include: true,
        targetYear: Math.max(currentYear, facts.expectedReplacementYear ?? currentYear),
        amountMinor: facts.currentReplacementEstimateMinor,
        note: "",
      },
    }));
    setPendingAuthorization(null);
    setDrawer(null);
    setDetail(null);
    setLifecycleTab("capex");
    setView("equipment");
    setNotice(`${facts.asset.name} added to the editable upcoming CapEx plan. The vendor work order remains saved and unsent.`);
  }

  function issueAuthorization(value: {
    workOrderId: string;
    customerWorkOrderNumber: string;
    nteMinorUnits?: number;
    currency: string;
    sendByEmail: boolean;
    email?: string;
    sendByText: boolean;
    phone?: string;
    acceptanceRequested: boolean;
    vendorNote?: string;
  }) {
    if (!guardPermission("issueVendorWork", "issue work to vendors")) return;
    if (!pendingAuthorization) return;
    if (!dataset.workOrders.some((work) => work.id === value.workOrderId)) {
      setNotice("That work order is outside this role’s assigned scope.");
      return;
    }
    const assignment = dataset.assignments.find((record) => record.workOrderId === value.workOrderId && record.partyType === "vendor");
    const creator = activePerson;
    if (!assignment || !creator) return;
    const issuance: VendorIssuance = {
      id: `issuance-created-${issuances.length + 1}`,
      organizationId: dataset.organization.id,
      workOrderId: value.workOrderId,
      vendorId: assignment.partyId,
      assignmentId: assignment.id,
      version: 1,
      issuedAt: dataset.asOf,
      issuedByPersonId: creator.id,
      channels: [value.sendByEmail ? "email" : null, value.sendByText ? "sms" : null].filter(
        (channel): channel is "email" | "sms" => Boolean(channel),
      ),
      recipientContactIds: [],
      deliveryStatus: "delivered",
      acceptanceRequested: value.acceptanceRequested,
      customerBillingInstruction: `Include ${value.customerWorkOrderNumber} on every invoice and service document.`,
      scopeSnapshot: pendingAuthorization.requestedService ?? pendingAuthorization.problem,
      notToExceedMinor: value.nteMinorUnits,
      currency: "USD",
    };
    setIssuances((current) => [issuance, ...current]);
    setWorkOrders((current) =>
      current.map((record) =>
        record.id === value.workOrderId
          ? {
              ...record,
              status: value.acceptanceRequested ? "awaiting_vendor_response" : "issued",
              notToExceedMinor: value.nteMinorUnits,
              accountable: record.accountable
                ? {
                    ...record.accountable,
                    nextAction: value.acceptanceRequested
                      ? "Vendor must accept, decline, or propose a service date"
                      : "Vendor must perform the authorized work and record the visit",
                  }
                : record.accountable,
            }
          : record,
      ),
    );
    appendAuditEvent("vendor_issuance", issuance.id, "Customer work order delivered to vendor", {
      workOrderId: value.workOrderId,
      vendorId: assignment.partyId,
      acceptanceRequested: value.acceptanceRequested,
      channels: issuance.channels.join("+"),
    });
    setPendingAuthorization(null);
    setDrawer(null);
    setView("work");
    setDetail({ kind: "work", id: value.workOrderId });
    setNotice(`${value.customerWorkOrderNumber} delivered to ${pendingAuthorization.vendor.name}.`);
  }

  function respondToVendorWork(
    workOrderId: string,
    response: "accepted" | "declined" | "date_proposed",
  ) {
    if (!guardPermission("simulateVendorResponse", "record a vendor response")) return;
    const latest = dataset.vendorIssuances
      .filter((record) => record.workOrderId === workOrderId)
      .sort((a, b) => b.version - a.version)[0];
    const work = dataset.workOrders.find((record) => record.id === workOrderId);
    if (!latest || !work) return;
    const now = new Date().toISOString();
    const proposedArrivalAt = new Date(nowMilliseconds() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const facilitiesOwner = dataset.people.find((person) => person.roles.includes("facilities_manager")) ?? dataset.people[0];

    setIssuances((current) =>
      current.map((record) =>
        record.id === latest.id
          ? {
              ...record,
              response,
              respondedAt: now,
              vendorReference: response === "declined" ? undefined : "SV-884219",
              proposedArrivalAt: response === "date_proposed" ? proposedArrivalAt : undefined,
            }
          : record,
      ),
    );
    setAssignments((current) =>
      current.map((record) =>
        record.id === latest.assignmentId
          ? { ...record, status: response === "accepted" ? "accepted" : response === "declined" ? "declined" : "acknowledged" }
          : record,
      ),
    );
    setWorkOrders((current) =>
      current.map((record) => {
        if (record.id !== workOrderId) return record;
        if (response === "declined") {
          return {
            ...record,
            fulfillmentMode: "unassigned",
            status: "draft",
            accountable: facilitiesOwner
              ? {
                  partyType: "person",
                  partyId: facilitiesOwner.id,
                  nextAction: "Choose another internal team or approved vendor",
                  dueAt: new Date(nowMilliseconds() + 4 * 60 * 60 * 1000).toISOString(),
                  escalationPartyId: facilitiesOwner.id,
                }
              : record.accountable,
          };
        }
        return {
          ...record,
          status: response === "date_proposed" ? "awaiting_vendor_response" : "accepted",
          scheduledWindow: record.scheduledWindow,
          accountable: record.accountable
            ? {
                ...record.accountable,
                nextAction:
                  response === "date_proposed"
                    ? "Facilities manager reviews the proposed arrival window"
                    : "Vendor schedules service and records the onsite visit",
              }
            : record.accountable,
        };
      }),
    );
    appendAuditEvent("vendor_issuance", latest.id, `Vendor ${words(response)}`, {
      workOrderId,
      vendorId: latest.vendorId,
      response,
    }, "vendor_link", "vendor_contact");
    setNotice(
      response === "accepted"
        ? "Vendor accepted the customer work order and added its service-ticket reference."
        : response === "date_proposed"
          ? "Vendor proposed an arrival window; the facilities manager now owns the review."
          : "Vendor declined. The work remains visible and was returned for reassignment.",
    );
  }

  function recordVisitCheckIn(value: VisitCheckInValue): ActiveVisit | void {
    if (!guardPermission("recordVisits", "record vendor visits")) return;
    if (!dataset.stores.some((store) => store.id === value.storeId)) {
      setNotice("That store is outside this role’s assigned scope.");
      return;
    }
    const vendor = dataset.vendors.find((record) => record.displayName === value.vendorName);
    const id = `visit-session-${nowMilliseconds()}`;
    const evidence = domainVisitEvidence(value.evidence);
    const visit: Visit = {
      id,
      organizationId: dataset.organization.id,
      storeId: value.storeId,
      workOrderId: value.workOrderId,
      vendorId: vendor?.id,
      technicianName: value.technicianName,
      technicianIdentifier: `${vendor?.customerVendorNumber ?? "VENDOR"}-${value.technicianName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`,
      purposeWhenUnmatched: value.noWorkOrderReason,
      channelStarted: domainVisitChannel(value.channel),
      checkedInAt: value.recordedAt,
      ...evidence,
      documentIds: [],
    };
    setVisits((current) => [visit, ...current]);
    if (value.workOrderId) {
      setWorkOrders((current) =>
        current.map((record) =>
          record.id === value.workOrderId
            ? {
                ...record,
                status: "onsite",
                accountable: record.accountable
                  ? { ...record.accountable, nextAction: "Technician records an outcome before leaving the store" }
                  : record.accountable,
              }
            : record,
        ),
      );
    } else if (facilitiesOwner(dataset)) {
      const owner = facilitiesOwner(dataset)!;
      setExceptions((current) => [
        {
          id: `exception-session-${nowMilliseconds()}`,
          organizationId: dataset.organization.id,
          type: "visit_without_work_order",
          severity: "warning",
          status: "open",
          title: "Vendor visit has no customer work order",
          description: value.noWorkOrderReason ?? "The technician could not find a matching customer work order.",
          storeId: value.storeId,
          visitId: id,
          vendorId: vendor?.id,
          sourceRecordIds: [id],
          assignedPersonId: owner.id,
          openedAt: value.recordedAt,
          dueAt: new Date(Date.parse(value.recordedAt) + 24 * 60 * 60 * 1000).toISOString(),
        },
        ...current,
      ]);
    }
    appendAuditEvent("visit", id, "Technician checked in", {
      visitId: id,
      workOrderId: value.workOrderId ?? null,
      storeId: value.storeId,
      evidenceState: value.evidence.state,
    }, value.channel === "store_kiosk" ? "kiosk" : value.channel === "app" ? "vendor_app" : "qr", "technician");
    return {
      id,
      storeId: value.storeId,
      technicianName: value.technicianName,
      vendorName: value.vendorName,
      workOrderId: value.workOrderId,
      noWorkOrderReason: value.noWorkOrderReason,
      channel: value.channel,
      evidence: value.evidence,
      startedAt: value.recordedAt,
    };
  }

  function recordVisitCheckOut(value: VisitCheckOutValue) {
    if (!guardPermission("recordVisits", "record vendor visits")) return;
    const activeVisit = dataset.visits.find((record) => record.id === value.visitId);
    if (!activeVisit) return;
    const outcome = domainVisitOutcome(value.outcome);
    const freshEvidence = { ...value.evidence, capturedAt: value.recordedAt };
    const checkoutEvidence = domainVisitEvidence(freshEvidence);
    const checkoutDocuments: EvidenceDocument[] = value.files.map((file, index) => ({
      id: `document-visit-${value.visitId}-${nowMilliseconds()}-${index + 1}`,
      organizationId: fullDataset.organization.id,
      storeId: activeVisit.storeId,
      workOrderId: activeVisit.workOrderId,
      visitId: activeVisit.id,
      kind: file.type.startsWith("image/") ? "after_photo" : "service_ticket",
      fileName: file.name,
      mediaType: file.type || "application/octet-stream",
      createdAt: value.recordedAt,
      createdByLabel: `${activeVisit.technicianName} · Visit checkout`,
      visibility: "engagement_parties",
    }));
    if (checkoutDocuments.length) setDocuments((current) => [...checkoutDocuments, ...current]);
    setVisits((current) =>
      current.map((record) =>
        record.id === value.visitId
          ? {
              ...record,
              checkedOutAt: value.recordedAt,
              channelEnded: domainVisitChannel(value.channel),
              outcome,
              checkoutNote: value.notes,
              evidenceStrength:
                record.evidenceStrength === "location_verified" || checkoutEvidence.evidenceStrength === "location_verified"
                  ? "location_verified"
                  : checkoutEvidence.evidenceStrength,
              locationEvidence: checkoutEvidence.locationEvidence,
              documentIds: [...record.documentIds, ...checkoutDocuments.map((document) => document.id)],
            }
          : record,
      ),
    );
    if (activeVisit.workOrderId) {
      const followUpDue = new Date(Date.parse(value.recordedAt) + 3 * 24 * 60 * 60 * 1000).toISOString();
      setWorkOrders((current) =>
        current.map((record) => {
          if (record.id !== activeVisit.workOrderId) return record;
          const resolved = outcome === "resolved" || outcome === "preventive_complete";
          return {
            ...record,
            outcome,
            status: resolved ? "completed" : outcome === "diagnosed_waiting_parts" ? "waiting_parts" : "unresolved",
            completedAt: resolved ? value.recordedAt : undefined,
            accountable: record.accountable
              ? {
                  ...record.accountable,
                  nextAction: resolved
                    ? "Store or facilities manager verifies the result and closes the work order"
                    : outcome === "diagnosed_waiting_parts"
                      ? "Vendor confirms parts availability and proposed return date"
                      : "Facilities manager assigns the next diagnostic or return-visit action",
                  dueAt: followUpDue,
                }
              : record.accountable,
          };
        }),
      );
    }
    appendAuditEvent("visit", value.visitId, `Technician checked out · ${words(outcome)}`, {
      visitId: value.visitId,
      workOrderId: activeVisit.workOrderId ?? null,
      outcome,
      fileCount: value.files.length,
      evidenceState: value.evidence.state,
    }, value.channel === "store_kiosk" ? "kiosk" : value.channel === "app" ? "vendor_app" : "qr", "technician");
    setNotice("Visit checkout saved. The work order and next accountable action were updated.");
  }

  const selectedInvoice = detail?.kind === "invoice"
    ? dataset.invoices.find((record) => record.id === detail.id)
    : undefined;
  const selectedReport = detail?.kind === "report"
    ? savedReports.find((record) => record.id === detail.id)
    : undefined;
  const selectedPmOccurrence = detail?.kind === "pm"
    ? dataset.pmOccurrences.find((record) => record.id === detail.id) ??
      dataset.pmOccurrences.find((record) => record.pmPlanId === detail.id)
    : undefined;
  const selectedPmPlan = selectedPmOccurrence
    ? dataset.pmPlans.find((record) => record.id === selectedPmOccurrence.pmPlanId)
    : undefined;
  const pendingAuthorizationWork = pendingAuthorization
    ? dataset.workOrders.find((record) => record.id === pendingAuthorization.workOrderId)
    : undefined;
  const pendingLifecycleFacts = pendingAuthorizationWork?.assetId
    ? getAssetLifecycleDecisionFacts(
        dataset,
        dataset.organization.id,
        pendingAuthorizationWork.assetId,
      )
    : undefined;
  const pendingLifecycleReview: ServiceAuthorizationLifecycleReview | undefined = pendingLifecycleFacts &&
    pendingLifecycleFacts.reviewReasons.some((reason) => reason.category !== "invoice_evidence")
    ? (() => {
        const facts: string[] = [];
        const activity = pendingLifecycleFacts.reactiveActivity.trailing12Months;
        const recurrence = pendingLifecycleFacts.confirmedComponentRecurrences.trailing12Months[0];
        const completedCost = pendingLifecycleFacts.costs.trailing24Months.recordedMinor;
        if (completedCost > 0) {
          facts.push(`${money(completedCost)} in completed-work cost is recorded over the last 24 months.`);
        }
        if (recurrence) {
          facts.push(`${recurrence.componentName} appears on ${recurrence.distinctWorkOrderCount} completed corrective work orders.`);
        }
        if (activity.distinctWorkOrderCount > 0) {
          facts.push(`${activity.distinctWorkOrderCount} corrective work orders and ${activity.distinctVisitCount} recorded visits in the last 12 months.`);
        }
        if ((pendingLifecycleFacts.expectedLifePercentage ?? 0) >= 80) {
          facts.push(`${pendingLifecycleFacts.assetAgeYears ?? "Unknown"} years old compared with the entered ${pendingLifecycleFacts.expectedLifeYears}-year typical life.`);
        }
        if (activity.temporaryOrUnresolvedWorkOrderIds.length > 0) {
          const count = activity.temporaryOrUnresolvedWorkOrderIds.length;
          facts.push(`${count} recent ${count === 1 ? "work order has" : "work orders have"} a temporary, waiting-parts, or unresolved outcome.`);
        }
        return {
          kind: "review",
          assetName: pendingLifecycleFacts.asset.name,
          assetCode: pendingLifecycleFacts.asset.assetCode,
          repairCostMinor: completedCost,
          replacementEstimateMinor: pendingLifecycleFacts.currentReplacementEstimateMinor,
          reactiveWorkOrderCount: activity.distinctWorkOrderCount,
          ageYears: pendingLifecycleFacts.assetAgeYears,
          expectedLifeYears: pendingLifecycleFacts.expectedLifeYears,
          facts,
          alreadyPlanned: Boolean(capexDrafts[pendingLifecycleFacts.asset.id]?.include),
        } satisfies ServiceAuthorizationLifecycleReview;
      })()
    : pendingAuthorizationWork && !pendingAuthorizationWork.assetId
      ? { kind: "equipment_not_selected" }
      : undefined;

  const rendered = selectedInvoice ? (
    <>
      <div className="to-detail-tools"><button className="to-button" type="button" onClick={() => {
        setDetail(null);
        if (invoiceDetailReturn === "exceptions") {
          setView("exceptions");
          return;
        }
        setView("spend");
        setSpendPreset((current) => ({
          regionId: current?.regionId ?? "all",
          storeId: current?.storeId ?? "all",
          categoryId: current?.categoryId ?? "all",
          mode: invoiceDetailReturn === "spend" ? "overview" : "evidence_review",
        }));
      }}><ArrowLeft /> Back to {invoiceDetailReturn === "exceptions" ? "exceptions" : invoiceDetailReturn === "spend" ? "maintenance costs" : "invoice evidence"}</button></div>
      <InvoiceEvidenceDetail
        dataset={dataset}
        invoice={selectedInvoice}
        onOpenWork={(id) => setDetail({ kind: "work", id })}
        onOpenStore={(id) => setDetail({ kind: "store", id })}
        onOpenVendor={(id) => setDetail({ kind: "vendor", id })}
        onResolveReview={resolveInvoiceEvidence}
        canResolve={hasPermission("reviewInvoiceEvidence")}
      />
    </>
  ) : selectedReport ? (
    <ReportDetail
      dataset={dataset}
      report={selectedReport}
      onBack={() => { setDetail(null); setView("reports"); }}
      onOpenWork={(id) => { setView("work"); setDetail({ kind: "work", id }); }}
    />
  ) : selectedPmOccurrence && selectedPmPlan ? (
    <>
      <div className="to-detail-tools"><button className="to-button" type="button" onClick={() => { setDetail(null); setView("pm"); }}><ArrowLeft /> Back to PM schedule</button></div>
      <PmOccurrenceDetail
        dataset={dataset}
        occurrence={selectedPmOccurrence}
        plan={selectedPmPlan}
        onOpenLinkedWorkOrder={(id) => { setView("work"); setDetail({ kind: "work", id }); }}
        onCreateWorkOrder={hasPermission("createWork") ? createWorkFromPmOccurrence : undefined}
        onMarkComplete={hasPermission("createWork") ? completePmOccurrence : undefined}
        onWaive={hasPermission("manageSuite") ? waivePmOccurrence : undefined}
      />
    </>
  ) : detail ? (
    <>
      {detail.kind === "work" ? (() => {
        const work = dataset.workOrders.find((record) => record.id === detail.id);
        const issuance = work ? dataset.vendorIssuances.filter((record) => record.workOrderId === work.id).sort((left, right) => right.version - left.version)[0] : undefined;
        const assignment = work ? dataset.assignments.find((record) => record.workOrderId === work.id && record.status !== "declined") : undefined;
        if (!work) return null;
        return <div className="to-detail-tools">
          {hasPermission("createWork") && !assignment && !terminalStatuses.has(work.status) ? <button className="to-button primary" type="button" onClick={() => openVendorAssignment(work.id)}><Users /> Choose internal team or vendor</button> : null}
          {hasPermission("createWork") && work.status !== "cancelled" ? <button className="to-button" type="button" onClick={() => openMaintenanceCostEntry(work.id)}><CircleDollarSign /> Record maintenance cost</button> : null}
          {hasPermission("createWork") && work.status === "completed" ? <button className="to-button primary" type="button" onClick={() => openCompletionReview(work.id)}><CheckCircle2 /> Verify completion</button> : null}
          {hasPermission("issueVendorWork") && issuance && issuance.response !== "accepted" && issuance.response !== "declined" ? <button className="to-button" type="button" onClick={() => openVendorProposalReview(work.id)}><CalendarCheck /> Review vendor response</button> : null}
        </div>;
      })() : null}
    <DetailView
      dataset={dataset}
      detail={detail}
      onBack={() => setDetail(null)}
      onVendorRespond={respondToVendorWork}
      onIssue={openAuthorizationForWork}
      onOpenWork={(id) => setDetail({ kind: "work", id })}
      onOpenAsset={(id) => setDetail({ kind: "asset", id })}
      onOpenStore={(id) => setDetail({ kind: "store", id })}
      onOpenVendor={(id) => setDetail({ kind: "vendor", id })}
      onClassify={(id) => { setClassificationWorkId(id); setDrawer("classify-work"); }}
      onAssignVendor={openVendorAssignment}
      onOpenExternal={openExternalWorkOrder}
      onStartVisit={openVisitForWork}
      onInternalUpdate={openInternalWorkUpdate}
      onRecordInvoice={openInvoiceForWork}
      onOpenSpend={openWorkInSpend}
      onCreateWorkForStore={openWorkOrderDrawer}
      onConfigureStore={(storeId) => { setWorkflowStoreId(storeId); setDrawer("store-services"); }}
      onAddAssetForStore={(storeId) => { setWorkflowStoreId(storeId); setDrawer("new-asset"); }}
      onAddComponent={(assetId) => { setWorkflowAssetId(assetId); setDrawer("new-component"); }}
      onCreatePmForAsset={(assetId, storeId) => { setWorkflowAssetId(assetId); setWorkflowStoreId(storeId); setDrawer("new-pm"); }}
      canClassify={hasPermission("classifyWork")}
      canIssueVendorWork={hasPermission("issueVendorWork") && (detail.kind !== "work" || dataset.assignments.some((assignment) => assignment.workOrderId === detail.id && assignment.status !== "declined"))}
      canRecordVisits={hasPermission("recordVisits")}
      canRecordInvoice={hasPermission("createWork") && capabilities.invoiceSafeguard}
      canSimulateVendorResponse={hasPermission("simulateVendorResponse")}
      canManage={hasPermission("manageSuite")}
    />
    </>
  ) : view === "exceptions" ? (
    <ExceptionQueue
      dataset={dataset}
      exceptions={capabilities.invoiceSafeguard ? dataset.exceptions : dataset.exceptions.filter((record) => !isInvoiceException(record))}
      scopeLabel={scopeLabel}
      onOpenSource={openOperationsSource}
    />
  ) : view === "visits" ? (
    <ActiveVisitWorkspace
      key={visitWorkspaceInitialId ?? "visit-workspace"}
      dataset={dataset}
      visits={dataset.visits}
      scopeLabel={scopeLabel}
      initialVisitId={visitWorkspaceInitialId ?? undefined}
      onOpenWork={(id) => { setView("work"); setDetail({ kind: "work", id }); }}
      onOpenStore={(id) => { setView("stores"); setDetail({ kind: "store", id }); }}
      onOpenVendor={(id) => { setView("vendors"); setDetail({ kind: "vendor", id }); }}
    />
  ) : view === "requests" ? (
    <RequestWorkspace
      mode="manager"
      scopeLabel={scopeLabel}
      requests={requestInboxItems}
      value={requestInboxValue}
      onChange={setRequestInboxValue}
      onApproveAndCreateWorkOrder={approveAndCreateRequestWorkOrder}
      onOpenWorkOrder={(id) => {
        setView("work");
        setDetail({ kind: "work", id });
      }}
    />
  ) : view === "story" ? (
    <GuidedDemoStory
      activeStep={guidedStepByStage[guidedDemo.stage]}
      onStepChange={(step) => setGuidedDemo((current) => ({ ...current, stage: guidedStageByStep[step] }))}
      onReset={resetGuidedDemo}
      onAction={handleGuidedAction}
      onAnalyticsNavigate={handleGuidedAnalyticsNavigate}
      completedSteps={guidedCompletedSteps}
      unlockedSteps={guidedUnlockedSteps}
      activeActionLabel={guidedStepByStage[guidedDemo.stage] === "external_work_order" && guidedIssuance
        ? "Open external vendor work order"
        : undefined}
      scenario={guidedScenario}
      authorizationContent={(
        <div className="to-guided-auth-state" data-ready={guidedIssuance ? "true" : "false"}>
          <span className="to-guided-auth-icon">
            {guidedIssuance ? <CheckCircle2 aria-hidden="true" /> : <Mail aria-hidden="true" />}
          </span>
          <div>
            <strong>{guidedIssuance ? "Authorization delivered to Summit Dispatch" : "Ready to create the vendor-facing record"}</strong>
            <p>
              {guidedIssuance
                ? `${GUIDED_WORK_ORDER_NUMBER} is now the vendor's billing reference. Open the separate window to see exactly what Summit receives.`
                : "Sending creates the versioned authorization, preserves the $750 limit, and keeps the vendor's own dispatch process optional."}
            </p>
            {guidedIssuance ? (
              <span className="to-guided-auth-meta">
                Email delivered · acceptance requested · {money(GUIDED_NTE_MINOR)} NTE
              </span>
            ) : null}
          </div>
          {guidedIssuance && !guidedDemo.vendorResponse ? (
            <button className="to-button ghost" type="button" onClick={() => mockGuidedVendorResponse("accepted")}>
              Demo fallback: record acceptance here
            </button>
          ) : null}
        </div>
      )}
      visitContent={guidedStoreOption && guidedVendor && guidedWork ? (
        <TechnicianVisitFlow
          key={`guided-visit-${guidedDomainVisit?.id ?? "new"}-${guidedDomainVisit?.checkedOutAt ? "complete" : "active"}`}
          store={guidedStoreOption}
          vendorName={guidedVendor.displayName}
          workOrders={[{
            id: guidedWork.id,
            number: guidedWork.number,
            title: guidedWork.title,
            storeId: guidedWork.storeId,
            assetLabel: guidedAsset ? `${guidedAsset.assetCode} · ${guidedAsset.name}` : undefined,
            requestedService: guidedWork.scopeOfWork,
          }]}
          channel="qr"
          evidence={{ state: "location_verified", accuracyMeters: 18, distanceMeters: 24 }}
          initialActiveVisit={guidedInitialActiveVisit}
          initialCompleted={Boolean(guidedDomainVisit?.checkedOutAt)}
          defaultTechnicianName="Marcus Hill"
          requireVerifiedEvidence
          onCheckIn={guidedVisitCheckIn}
          onCheckOut={guidedVisitCheckOut}
        />
      ) : (
        <div className="to-callout"><AlertTriangle /> Accept the external work order before starting the visit.</div>
      )}
    />
  ) : view === "today" ? (
    <TodayView
      dataset={dataset}
      activeVisits={activeVisits}
      exceptions={visibleOpenExceptions}
      onNavigate={navigate}
      onOpenSource={openOperationsSource}
      onCreate={() => openWorkOrderDrawer()}
      onStorePortal={() => openStorePortal(GUIDED_DEMO_IDS.store)}
      onVisit={() => { if (!guardPermission("recordVisits", "record vendor visits")) return; setVisitStoreId(null); setVisitVendorId(null); setVisitWorkOrderId(null); setDrawer("visit"); }}
      onInvoiceReview={() => openInvoiceEvidenceReview(true)}
      onOpenSpend={() => openMaintenanceSpend(true)}
      onOpenExceptions={() => navigate("exceptions")}
      onOpenVisits={() => { setVisitWorkspaceInitialId(null); navigate("visits"); }}
      onOpenSpendCategory={openSpendCategory}
      scopeLabel={scopeLabel}
      roleLabel={rolePolicy.label}
      canCreateWork={hasPermission("createWork")}
      canUseStorePortal={hasPermission("recordVisits")}
      canRecordVisits={hasPermission("recordVisits")}
      invoiceSafeguardEnabled={capabilities.invoiceSafeguard}
    />
  ) : view === "stores" ? (
    <StoresView dataset={dataset} onOpen={(id) => setDetail({ kind: "store", id })} onCreate={() => openWorkOrderDrawer()} onNewStore={() => setDrawer("new-store")} canCreateWork={hasPermission("createWork")} canCreateStore={hasPermission("createStore")} />
  ) : view === "work" ? (
    <WorkView dataset={dataset} onOpen={(id) => setDetail({ kind: "work", id })} onCreate={() => openWorkOrderDrawer()} canCreateWork={hasPermission("createWork")} />
  ) : view === "vendors" ? (
    <VendorsView
      dataset={dataset}
      onOpen={(id) => setDetail({ kind: "vendor", id })}
      onNewVendor={() => setDrawer("new-vendor")}
      canManage={hasPermission("manageSuite")}
    />
  ) : view === "spend" ? (
    <>
      <div className="to-detail-tools" role="tablist" aria-label="Maintenance cost views">
        <button
          className={`to-button ${!capabilities.invoiceSafeguard || spendPreset?.mode !== "evidence_review" ? "primary" : ""}`}
          type="button"
          role="tab"
          aria-selected={!capabilities.invoiceSafeguard || spendPreset?.mode !== "evidence_review"}
          onClick={() => setSpendPreset((current) => ({
            regionId: current?.regionId ?? "all",
            storeId: current?.storeId ?? "all",
            categoryId: current?.categoryId ?? "all",
            mode: "overview",
          }))}
        >
          <CircleDollarSign /> Maintenance costs
        </button>
        {capabilities.invoiceSafeguard ? <button
          className={`to-button ${spendPreset?.mode === "evidence_review" ? "primary" : ""}`}
          type="button"
          role="tab"
          aria-selected={spendPreset?.mode === "evidence_review"}
          onClick={() => openInvoiceEvidenceReview(false)}
        >
          <ReceiptText /> Invoice evidence review
        </button> : null}
      </div>
      {capabilities.invoiceSafeguard && spendPreset?.mode === "evidence_review" ? (
        <InvoiceEvidenceQueue
          dataset={dataset}
          scopeLabel={maintenanceSpendScopeLabel}
          scope={maintenanceSpendState}
          initialFilter="needs_review"
          value={invoiceEvidenceQueueValue}
          onChange={setInvoiceEvidenceQueueValue}
          onOpenInvoice={(id) => { setInvoiceDetailReturn("evidence"); setDetail({ kind: "invoice", id }); }}
          onOpenWork={(id) => setDetail({ kind: "work", id })}
        />
      ) : (
        <MaintenanceSpendWorkspace
          dataset={dataset}
          scopeLabel={scopeLabel}
          value={maintenanceSpendState}
          onChange={setMaintenanceSpendState}
          onOpenWork={(id) => setDetail({ kind: "work", id })}
          onOpenStore={(id) => setDetail({ kind: "store", id })}
          onOpenAsset={(id) => setDetail({ kind: "asset", id })}
          onOpenVendor={(id) => setDetail({ kind: "vendor", id })}
          onOpenInvoice={(id) => { setInvoiceDetailReturn("spend"); setDetail({ kind: "invoice", id }); }}
          onGenerateReport={(state) => openReportBuilder(
            "operating_review",
            state.basis === "linked_invoice" ? "invoice_linked" : state.basis,
            state,
          )}
          canGenerate={hasPermission("generateReports")}
          invoiceEvidenceEnabled={capabilities.invoiceSafeguard}
        />
      )}
    </>
  ) : view === "equipment" ? (
    <>
      <PageHead
        eyebrow="Equipment lifecycle"
        title="See the history. Decide what to repair or replace."
        description="Completed-work cost, corrective history, component activity, equipment age, warranty, PM, and editable capital planning stay useful even when no invoice is entered."
      >
        {hasPermission("manageSuite") ? <button className="to-button primary" type="button" onClick={() => { setWorkflowStoreId(null); setDrawer("new-asset"); }}><Plus /> Add equipment</button> : null}
      </PageHead>
      <LifecyclePlanning
        dataset={dataset}
        tab={lifecycleTab}
        onTabChange={setLifecycleTab}
        capexDrafts={capexDrafts}
        onCapexDraftsChange={setCapexDrafts}
        onOpenAsset={(id) => setDetail({ kind: "asset", id })}
        canManage={hasPermission("manageSuite") || hasPermission("createWork")}
      />
    </>
  ) : view === "pm" ? (
    <PmView
      dataset={dataset}
      filter={pmScheduleFilter}
      onFilterChange={setPmScheduleFilter}
      sort={pmScheduleSort}
      onSortChange={setPmScheduleSort}
      onOpenWork={(id) => setDetail({ kind: "work", id })}
      onOpenOccurrence={(id) => setDetail({ kind: "pm", id })}
      onNewPlan={() => { setWorkflowStoreId(null); setWorkflowAssetId(null); setDrawer("new-pm"); }}
      canManage={hasPermission("manageSuite")}
    />
  ) : (
    <ReportsView dataset={dataset} savedReports={savedReports} onBuild={openReportBuilder} onOpenReport={(id) => setDetail({ kind: "report", id })} canGenerate={hasPermission("generateReports")} scopeLabel={scopeLabel} />
  );

  const drawerTitle =
    drawer === "create-work"
      ? "Create work order"
      : drawer === "request-form"
        ? "Report a store issue"
        : drawer === "assign-vendor"
          ? "Choose who handles the work"
      : drawer === "issue-vendor"
        ? "Issue to outside vendor"
        : drawer === "record-invoice"
          ? "Attach and link vendor invoice"
        : drawer === "record-cost"
          ? "Record maintenance cost"
        : drawer === "completion-review"
          ? "Verify completed work"
        : drawer === "vendor-proposal"
          ? "Review vendor scheduling"
        : drawer === "internal-update"
          ? "Update internal maintenance work"
        : drawer === "report-builder"
          ? "Generate management report"
        : drawer === "store-portal"
          ? "Store portal"
          : drawer === "capabilities"
            ? "Suite settings"
            : drawer === "taxonomy"
              ? "Company naming structure"
            : drawer === "new-store"
              ? "Create a store"
              : drawer === "new-vendor"
                ? "Add an approved vendor"
                : drawer === "store-services"
                  ? "Configure store service areas"
                  : drawer === "new-asset"
                    ? "Add equipment"
                    : drawer === "new-component"
                      ? "Add equipment component"
                      : drawer === "new-pm"
                        ? "Create preventive-maintenance plan"
              : drawer === "classify-work"
                ? "Update equipment classification"
                : "Vendor check-in";
  const drawerSubtitle =
    drawer === "create-work"
      ? "Start simple. Equipment, cost detail, and safeguards can be added later."
      : drawer === "request-form"
        ? "A quick employee report becomes a permanent manager-review record."
        : drawer === "assign-vendor"
          ? "Use an internal maintenance team or search the approved vendor network. Nothing is sent until you review it."
      : drawer === "issue-vendor"
        ? "This customer work order becomes the vendor’s authorization and invoice reference."
        : drawer === "record-invoice"
          ? "Link supporting vendor billing to maintenance records without replacing the accounting system."
        : drawer === "record-cost"
          ? "Capture operational work cost without creating an invoice, payable, or accounting entry."
        : drawer === "completion-review"
          ? "Close, return for follow-up, or reopen the work independently of invoice review."
        : drawer === "vendor-proposal"
          ? "Accept a proposed window, request another date, or attribute a response received by phone or email."
        : drawer === "internal-update"
          ? "Move internal work through accountable states and record the maintenance outcome."
        : drawer === "report-builder"
          ? "Freeze the selected scope, period, definitions, and source records into a reusable management record."
        : drawer === "capabilities"
          ? "Use only the controls that create value for this operator."
          : drawer === "taxonomy"
            ? "Create shared service areas and optional drill-down levels without forcing every store to use the same depth."
          : drawer === "new-store"
            ? "Create the location first, then add service structure only where it helps."
            : drawer === "new-vendor"
              ? "Make the provider searchable by name, plain-language specialty, equipment, and coverage."
              : drawer === "store-services"
                ? "Choose the shared company categories this location actually uses."
                : drawer === "new-asset"
                  ? "Start with the useful identity and lifecycle facts; deeper detail remains optional."
                  : drawer === "new-component"
                    ? "Add a replaceable or diagnostically useful part beneath the selected asset."
                    : drawer === "new-pm"
                      ? "Create the plan and its first actionable occurrence in one workflow."
            : drawer === "classify-work"
              ? "Move from store-level work to category, system, asset, or component at any time."
              : "Focused store experience · Demo mode";

  return (
    <div className="to-app">
      <aside className="to-sidebar">
        <div className="to-brand">
          <div className="to-brand-mark">T</div>
          <div><strong>TraceOps</strong><span>Convenience Suite</span></div>
        </div>
        <div className="to-org-switcher"><small>Demo organization</small><strong>{dataset.organization.displayName}</strong></div>
        <p className="to-nav-label">Operate</p>
        <nav className="to-nav" aria-label="Main navigation">
          {roleNavItems.filter((item) => ["today", "requests", "stores", "work", "vendors"].includes(item.view)).map((item) => <NavButton key={item.view} item={item} active={view === item.view && !detail} onClick={() => navigate(item.view)} />)}
        </nav>
        <p className="to-nav-label">Understand</p>
        <nav className="to-nav" aria-label="Intelligence navigation">
          {intelligenceNavItems.map((item) => <NavButton key={item.view} item={item} active={view === item.view && !detail} onClick={() => navigate(item.view)} />)}
        </nav>
        {hasPermission("manageSuite") ? <><p className="to-nav-label">Configure</p><nav className="to-nav"><button type="button" onClick={() => setDrawer("taxonomy")}><Layers3 /> Naming structure</button><button type="button" onClick={() => setDrawer("capabilities")}><Settings2 /> Suite settings</button></nav></> : null}
        <div className="to-sidebar-foot"><span className="to-demo-pill">Demo mode</span><br />{scopeLabel}<br />{dataset.vendors.length} approved vendors · source-linked maintenance records.</div>
      </aside>

      <main className="to-main">
        <header className="to-topbar">
          <div className="to-global-search">
            <Search />
            <input aria-label="Search the suite" value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="Search store number, address, vendor, work order…" />
            <span className="to-search-key">⌘ K</span>
            {searchResults.length ? (
              <div className="to-search-results">
                {searchResults.map((result) => (
                  <button key={`${result.kind}-${result.id}`} type="button" onClick={() => openResult(result)}>
                    <span><strong>{result.title}</strong><small>{result.meta}</small></span><ChevronRight />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="to-top-actions">
            <button className="to-icon-button" type="button" aria-label={`Open ${visibleOpenExceptions.length} exceptions`} onClick={() => navigate("exceptions")}><Bell /></button>
            <select className="to-role" value={roleId} onChange={(event) => changeRole(event.target.value as DemoRoleId)} aria-label="Demo role">
              {demoRolePolicies.map((policy) => <option value={policy.id} key={policy.id}>{policy.label}</option>)}
            </select>
            <button className="to-icon-button" type="button" aria-label="User profile" onClick={() => setNotice(`Viewing Demo Mode as ${activePerson?.displayName ?? rolePolicy.label} · ${scopeLabel}.`)}><UserRound /></button>
          </div>
        </header>

        <div className="to-page">
          <div className="to-role-context" data-readonly={!Object.entries(rolePolicy.permissions).some(([key, allowed]) => key !== "generateReports" && allowed)}>
            <span className="to-avatar">{initials(activePerson?.displayName ?? rolePolicy.label)}</span>
            <span><small>Current demo perspective</small><strong>{activePerson?.displayName ?? rolePolicy.label} · {rolePolicy.label}</strong></span>
            <span className="to-role-scope"><strong>{scopeLabel}</strong><small>{rolePolicy.accessSummary}</small></span>
          </div>
          {notice ? <div className="to-notice"><CheckCircle2 /><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X /></button></div> : null}
          {rendered}
        </div>
      </main>

      <nav className="to-mobile-nav" aria-label="Mobile navigation">
        {mobileNavItems.map((item) => <NavButton key={item.view} item={item} active={view === item.view && !detail} onClick={() => navigate(item.view)} />)}
      </nav>

      {drawer ? (
        <DrawerShell title={drawerTitle} subtitle={drawerSubtitle} onClose={() => { setDrawer(null); setPendingAuthorization(null); setClassificationWorkId(null); setWorkInitialStoreId(null); setAssignmentWorkId(null); setInvoiceWorkId(null); setCostWorkId(null); setCompletionWorkId(null); setProposalWorkId(null); setInternalWorkId(null); setReportTemplate(null); setReportCostBasisPreset("recorded"); setReportSpendPreset(null); setVisitVendorId(null); setVisitWorkOrderId(null); setWorkflowStoreId(null); setWorkflowAssetId(null); }}>
          {drawer === "create-work" ? (
            <WorkOrderCreation
              stores={storeOptions}
              vendors={vendorOptions}
              equipmentOptions={dataset.assets.map((asset) => ({
                id: asset.id,
                storeId: asset.storeId,
                assetCode: asset.assetCode,
                name: asset.name,
                assetType: asset.assetType,
                locationDetail: asset.locationDetail,
              }))}
              componentOptions={dataset.assetComponents.map((component) => ({
                id: component.id,
                assetId: component.assetId,
                componentCode: component.componentCode,
                name: component.name,
                componentType: component.componentType,
                parentComponentId: component.parentComponentId,
              }))}
              internalTeams={dataset.teams.map((team) => ({ id: team.id, name: team.name, description: team.description, coverageLabel: "Internal regional coverage" }))}
              onCreate={createWorkOrder}
              initialValue={workInitialStoreId ? { storeId: workInitialStoreId } : undefined}
            />
          ) : drawer === "request-form" && requestStore ? (
            <RequestWorkspace
              mode="employee"
              store={{
                id: requestStore.id,
                storeNumber: requestStore.storeNumber,
                name: requestStore.name,
                address: requestStore.normalizedAddress,
              }}
              value={employeeIssueDraft}
              onChange={setEmployeeIssueDraft}
              onSubmit={submitEmployeeRequest}
              receipt={requestReceipt}
              onReportAnother={() => {
                setRequestReceipt(null);
                setEmployeeIssueDraft((current) => ({
                  ...initialEmployeeIssueDraft,
                  employeeName: current.employeeName,
                  employeeId: current.employeeId,
                  problem: "",
                  reportedLocation: "",
                }));
              }}
            />
          ) : drawer === "assign-vendor" && assignmentWork ? (
            <div>
              <div className="to-callout">
                <ClipboardList />
                <span>
                  <strong>{assignmentWork.number} · {assignmentWork.title}</strong>
                  <small>Assignment only chooses responsibility. Outside-vendor work is reviewed before anything is sent.</small>
                </span>
              </div>
              <div className="to-response-actions" role="group" aria-label="Assignment type">
                <button className={`to-button ${assignmentMode === "internal" ? "primary" : ""}`} type="button" onClick={() => setAssignmentMode("internal")}><Wrench /> Internal maintenance</button>
                <button className={`to-button ${assignmentMode === "external" ? "primary" : ""}`} type="button" onClick={() => setAssignmentMode("external")}><Truck /> Outside vendor</button>
              </div>
              {assignmentMode === "internal" ? (
                <div className="to-field">
                  <label htmlFor="assignment-team">Internal maintenance team</label>
                  <select id="assignment-team" value={assignmentTeamId} onChange={(event) => setAssignmentTeamId(event.target.value)}>
                    <option value="">Choose a team</option>
                    {dataset.teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.description}</option>)}
                  </select>
                  <small>The team receives the same accountable work record without vendor issuance or invoice requirements.</small>
                </div>
              ) : (
                <VendorPicker
                  vendors={vendorOptions}
                  storeId={assignmentWork.storeId}
                  value={assignmentVendorId}
                  onChange={setAssignmentVendorId}
                />
              )}
              <button className="to-button primary to-full" type="button" disabled={assignmentMode === "internal" ? !assignmentTeamId : !assignmentVendorId} onClick={assignHandlerToWork}>
                <ArrowRight /> Assign {assignmentMode === "internal" ? "internal team" : "selected vendor"}
              </button>
            </div>
          ) : drawer === "issue-vendor" && pendingAuthorization ? (
            <VendorServiceAuthorization
              authorization={pendingAuthorization}
              lifecycleReview={pendingLifecycleReview}
              onOpenEquipmentHistory={pendingAuthorizationWork?.assetId
                ? () => openLifecycleHistory(pendingAuthorizationWork.assetId!)
                : undefined}
              onAddToCapexPlan={pendingAuthorizationWork?.assetId
                ? () => addAssetToCapexPlan(pendingAuthorizationWork.assetId!)
                : undefined}
              onSelectEquipment={pendingAuthorizationWork && !pendingAuthorizationWork.assetId
                ? () => {
                    setClassificationWorkId(pendingAuthorizationWork.id);
                    setPendingAuthorization(null);
                    setDrawer("classify-work");
                    setNotice("Select equipment if it is known. The work order remains saved and nothing has been sent.");
                  }
                : undefined}
              onIssue={issueAuthorization}
              onSaveDraft={(draft) => {
                setWorkOrders((current) => current.map((work) => work.id === draft.workOrderId ? { ...work, notToExceedMinor: draft.nteMinorUnits } : work));
                setDraftAcceptanceByWork((current) => ({ ...current, [draft.workOrderId]: draft.acceptanceRequested }));
                setDrawer(null);
                setNotice(`${pendingAuthorization.customerWorkOrderNumber} authorization settings saved without sending. Reopen it from the work-order record.`);
              }}
              defaultAcceptanceRequested={draftAcceptanceByWork[pendingAuthorization.workOrderId] ?? capabilities.vendorAcceptance}
            />
          ) : drawer === "record-invoice" && invoiceWork && invoiceVendor ? (
            <InvoiceEntryForm work={invoiceWork} vendor={invoiceVendor} onSubmit={recordInvoiceForWork} />
          ) : drawer === "record-cost" && costWork ? (
            <MaintenanceCostEntryForm
              workOrder={costWork}
              existingRecordedLines={dataset.costLines.filter((line) => line.workOrderId === costWork.id && line.basis === "recorded")}
              onSubmit={recordMaintenanceCost}
            />
          ) : drawer === "completion-review" && completionWork ? (
            <WorkCompletionReview
              workOrder={completionWork}
              visits={dataset.visits.filter((visit) => visit.workOrderId === completionWork.id)}
              onSubmit={reviewWorkCompletion}
            />
          ) : drawer === "vendor-proposal" && proposalWork && proposalIssuance ? (
            <VendorProposalReview
              workOrder={proposalWork}
              issuance={proposalIssuance}
              vendorName={proposalVendor?.displayName}
              onSubmit={reviewVendorProposal}
            />
          ) : drawer === "internal-update" && internalWork && internalTeam ? (
            <InternalWorkUpdateForm work={internalWork} teamName={internalTeam.name} onSubmit={updateInternalWork} />
          ) : drawer === "report-builder" && reportTemplate ? (
            <ReportBuilderForm
              template={reportTemplate}
              scopeLabel={reportSpendPreset ? maintenanceScopeLabel(reportSpendPreset) : scopeLabel}
              initialCostBasis={reportCostBasisPreset}
              initialPeriodLabel={reportSpendPreset?.period === "month" ? "August 2026 month to date" : reportSpendPreset?.period === "ytd" ? "2026 year to date" : "Trailing 12 months through August 10, 2026"}
              invoiceEvidenceEnabled={capabilities.invoiceSafeguard}
              onSubmit={generateReport}
            />
          ) : drawer === "store-portal" ? (
            <StorePortal
              dataset={dataset}
              storeId={storePortalStoreId}
              onWork={openEmployeeRequestForm}
              onVisit={(storeId) => { setVisitStoreId(storeId); setVisitVendorId(null); setVisitWorkOrderId(null); setDrawer("visit"); }}
              onOpenIssues={() => {
                const portalStore = dataset.stores.find((store) => store.id === storePortalStoreId);
                const firstStoreRequest = requestInboxItems.find((request) => request.store.id === storePortalStoreId);
                setRequestInboxValue({
                  query: portalStore?.storeNumber ?? "",
                  filter: "all",
                  selectedRequestId: firstStoreRequest?.id ?? null,
                });
                setDrawer(null);
                navigate("requests");
              }}
            />
          ) : drawer === "capabilities" ? (
            <CapabilitySettings value={capabilities} onChange={setCapabilities} />
          ) : drawer === "taxonomy" ? (
            <TaxonomyManager
              categories={fullDataset.categories}
              nodes={fullDataset.taxonomyNodes}
              onCreateCategory={createTaxonomyCategory}
              onUpdateCategory={updateTaxonomyCategory}
              onCreateNode={createTaxonomyNode}
              onUpdateNode={updateTaxonomyNode}
            />
          ) : drawer === "new-store" ? (
            <GuidedStoreSetup regions={dataset.regions} categories={dataset.categories.filter((category) => category.active !== false)} onCreate={createStore} />
          ) : drawer === "new-vendor" ? (
            <VendorOnboardingForm
              categories={dataset.categories.filter((category) => category.active !== false)}
              regions={dataset.regions}
              onSubmit={onboardVendor}
            />
          ) : drawer === "store-services" ? (
            <StoreServiceAreasForm
              stores={dataset.stores}
              categories={dataset.categories.filter((category) => category.active !== false)}
              initialStoreId={workflowStoreId ?? dataset.stores[0]?.id}
              initialCategoryIds={dataset.stores.find((store) => store.id === workflowStoreId)?.activeCategoryIds}
              onSubmit={updateStoreServiceAreas}
            />
          ) : drawer === "new-asset" ? (
            <AssetSetupForm
              stores={dataset.stores}
              categories={dataset.categories.filter((category) => category.active !== false)}
              taxonomyNodes={dataset.taxonomyNodes.filter((node) => node.active !== false)}
              vendors={dataset.vendors}
              initialStoreId={workflowStoreId ?? dataset.stores[0]?.id}
              onSubmit={createAsset}
            />
          ) : drawer === "new-component" ? (
            <ComponentSetupForm
              assets={dataset.assets}
              components={dataset.assetComponents}
              initialAssetId={workflowAssetId ?? dataset.assets[0]?.id}
              onSubmit={createAssetComponent}
            />
          ) : drawer === "new-pm" ? (
            <PmPlanForm
              stores={dataset.stores}
              categories={dataset.categories.filter((category) => category.active !== false)}
              assets={dataset.assets}
              internalTeams={dataset.teams}
              vendors={dataset.vendors}
              initialStoreId={workflowAssetId ? dataset.assets.find((asset) => asset.id === workflowAssetId)?.storeId : workflowStoreId ?? dataset.stores[0]?.id}
              initialValue={workflowAssetId ? (() => {
                const asset = dataset.assets.find((record) => record.id === workflowAssetId);
                return asset ? { storeId: asset.storeId, categoryId: asset.categoryId, assetId: asset.id } : undefined;
              })() : undefined}
              onSubmit={createPmPlan}
            />
          ) : drawer === "classify-work" && classificationWork && classificationStore ? (
            <WorkClassificationEditor
              workOrder={classificationWork}
              store={classificationStore}
              categories={dataset.categories.filter((category) => category.active !== false)}
              taxonomyNodes={dataset.taxonomyNodes.filter((node) => node.active !== false)}
              assets={dataset.assets}
              components={dataset.assetComponents}
              onSave={saveWorkClassification}
            />
          ) : (
            <VisitDemo dataset={dataset} activeVisits={activeVisits} fixedStoreId={visitStoreId ?? undefined} fixedVendorId={visitVendorId ?? undefined} fixedWorkOrderId={visitWorkOrderId ?? undefined} requireLocationEvidence={capabilities.locationEvidence} onCheckIn={recordVisitCheckIn} onCheckOut={recordVisitCheckOut} />
          )}
        </DrawerShell>
      ) : null}
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { view: View; label: string; icon: typeof LayoutDashboard }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button type="button" data-active={active} onClick={onClick}><Icon />{item.label}</button>;
}

function DrawerShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [onClose]);
  return <div className="to-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside ref={dialogRef} tabIndex={-1} className="to-drawer" role="dialog" aria-modal="true" aria-label={title}><header className="to-drawer-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="to-close" type="button" onClick={onClose} aria-label="Close"><X /></button></header><div className="to-drawer-body">{children}</div></aside></div>;
}

function InvoiceEntryForm({ work, vendor, onSubmit }: { work: WorkOrder; vendor: Vendor; onSubmit: (value: InvoiceEntryValue) => void }) {
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-DEMO-${work.number.split("-").at(-1) ?? "001"}`);
  const [labor, setLabor] = useState("420.00");
  const [materials, setMaterials] = useState("218.40");
  const [trip, setTrip] = useState("65.00");
  const [file, setFile] = useState<File | null>(null);
  const toMinor = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));
  const totalMinor = toMinor(labor) + toMinor(materials) + toMinor(trip);
  const overNte = Boolean(work.notToExceedMinor && totalMinor > work.notToExceedMinor);
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit({ invoiceNumber, laborMinor: toMinor(labor), materialsMinor: toMinor(materials), tripMinor: toMinor(trip), file }); }}><div className="to-callout"><ReceiptText /><span><strong>{vendor.displayName} · {work.number}</strong><small>The customer work-order reference creates the match. Visit duration remains supporting context, not certified billable labor.</small></span></div><div className="to-grid equal"><div className="to-field"><label htmlFor="invoice-number">Vendor invoice number</label><input id="invoice-number" required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></div><div className="to-field"><label htmlFor="invoice-file">Invoice file <small>(optional in Demo Mode)</small></label><input id="invoice-file" type="file" accept="application/pdf,image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div></div><div className="to-grid equal"><div className="to-field"><label htmlFor="invoice-labor">Labor</label><input id="invoice-labor" type="number" min="0" step="0.01" value={labor} onChange={(event) => setLabor(event.target.value)} /></div><div className="to-field"><label htmlFor="invoice-materials">Parts and materials</label><input id="invoice-materials" type="number" min="0" step="0.01" value={materials} onChange={(event) => setMaterials(event.target.value)} /></div><div className="to-field"><label htmlFor="invoice-trip">Trip charge</label><input id="invoice-trip" type="number" min="0" step="0.01" value={trip} onChange={(event) => setTrip(event.target.value)} /></div></div><div className="to-definition-list"><dl><div><dt>Invoice total</dt><dd><strong>{money(totalMinor)}</strong></dd></div><div><dt>Authorization limit</dt><dd>{work.notToExceedMinor ? money(work.notToExceedMinor) : "No NTE used"}</dd></div><div><dt>Safeguard result</dt><dd><Badge value={overNte ? "warning" : "matched"} label={overNte ? "Review · above NTE" : "WO reference matched"} /></dd></div></dl></div><button className="to-button primary to-full" type="submit" disabled={!invoiceNumber.trim() || totalMinor <= 0}><ArrowRight /> Record invoice and update spending</button></form>;
}

function InternalWorkUpdateForm({ work, teamName, onSubmit }: { work: WorkOrder; teamName: string; onSubmit: (value: InternalWorkUpdateValue) => void }) {
  const action: InternalWorkUpdateValue["action"] = ["draft", "ready_to_issue"].includes(work.status) ? "acknowledge" : work.status === "accepted" ? "start" : "complete";
  const [outcome, setOutcome] = useState<NonNullable<InternalWorkUpdateValue["outcome"]>>("resolved");
  const [note, setNote] = useState("Inspected the reported condition and completed the required maintenance.");
  const [cost, setCost] = useState("185.00");
  const recordedCostMinor = Math.max(0, Math.round((Number(cost) || 0) * 100));
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit({ action, outcome: action === "complete" ? outcome : undefined, note: action === "complete" ? note : undefined, recordedCostMinor: action === "complete" ? recordedCostMinor : undefined }); }}><div className="to-callout"><Wrench /><span><strong>{teamName} · {work.number}</strong><small>Internal work follows the same accountable state changes as outside work without pretending an outside vendor visit occurred.</small></span></div>{action === "complete" ? <><div className="to-field"><label htmlFor="internal-outcome">Work outcome</label><select id="internal-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as NonNullable<InternalWorkUpdateValue["outcome"]>)}><option value="resolved">Resolved</option><option value="diagnosed_waiting_parts">Diagnosed · waiting on parts</option><option value="temporary_repair">Temporary repair</option><option value="unresolved">Unresolved</option></select></div><div className="to-field"><label htmlFor="internal-note">Work performed and next context</label><textarea id="internal-note" rows={5} value={note} onChange={(event) => setNote(event.target.value)} /></div><div className="to-field"><label htmlFor="internal-cost">Recorded maintenance cost</label><input id="internal-cost" type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /><small>Internal entry for maintenance visibility—not payroll or accounting.</small></div></> : <div className="to-definition-list"><dl><div><dt>Current status</dt><dd>{words(work.status)}</dd></div><div><dt>Next state</dt><dd>{action === "acknowledge" ? "Accepted by internal maintenance" : "Work in progress"}</dd></div></dl></div>}<button className="to-button primary to-full" type="submit"><ArrowRight /> {action === "acknowledge" ? "Acknowledge internal work" : action === "start" ? "Start internal work" : "Save outcome and maintenance cost"}</button></form>;
}

function ReportBuilderForm({ template, scopeLabel, initialCostBasis, initialPeriodLabel, invoiceEvidenceEnabled, onSubmit }: { template: SavedReportRecord["template"]; scopeLabel: string; initialCostBasis: SavedReportRecord["costBasis"]; initialPeriodLabel: string; invoiceEvidenceEnabled: boolean; onSubmit: (value: ReportBuilderValue) => void }) {
  const templateTitle = template === "operating_review" ? "Monthly operating review" : template === "vendor_accountability" ? "Vendor accountability review" : "Equipment lifecycle review";
  const [title, setTitle] = useState(templateTitle);
  const [periodLabel, setPeriodLabel] = useState(initialPeriodLabel);
  const [costBasis, setCostBasis] = useState<SavedReportRecord["costBasis"]>(invoiceEvidenceEnabled ? initialCostBasis : "recorded");
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit({ title, periodLabel, costBasis }); }}><div className="to-callout"><FileBarChart /><span><strong>{templateTitle}</strong><small>The generated record preserves scope, definitions, cost basis, and clickable source records. It does not create an accounting report.</small></span></div><div className="to-field"><label htmlFor="report-title">Report title</label><input id="report-title" required value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="to-field"><label htmlFor="report-scope">Operating scope</label><input id="report-scope" value={scopeLabel} disabled /></div><div className="to-field"><label htmlFor="report-period">Review period</label><select id="report-period" value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)}><option>Trailing 12 months through August 10, 2026</option><option>August 2026 month to date</option><option>2026 year to date</option><option>Last completed quarter</option></select></div><div className="to-field"><label htmlFor="report-basis">Maintenance cost basis</label><select id="report-basis" value={costBasis} onChange={(event) => setCostBasis(event.target.value as SavedReportRecord["costBasis"])}><option value="recorded">Recorded maintenance cost</option><option value="authorized">Current authorization / NTE</option><option value="invoice_linked">Linked vendor invoice amount</option></select><small>Invoice-linked amounts are optional supporting evidence, not the default platform basis.</small></div><button className="to-button primary to-full" type="submit" disabled={!title.trim()}><ArrowRight /> Generate source-linked report</button></form>;
}

function TodayView({ dataset, activeVisits, exceptions, onNavigate, onOpenSource, onCreate, onStorePortal, onVisit, onInvoiceReview, onOpenSpend, onOpenExceptions, onOpenVisits, onOpenSpendCategory, scopeLabel, roleLabel, canCreateWork, canUseStorePortal, canRecordVisits, invoiceSafeguardEnabled }: { dataset: DemoDataset; activeVisits: Visit[]; exceptions: ExceptionRecord[]; onNavigate: (view: View) => void; onOpenSource: (source: OperationsSourceReference) => void; onCreate: () => void; onStorePortal: () => void; onVisit: () => void; onInvoiceReview: () => void; onOpenSpend: () => void; onOpenExceptions: () => void; onOpenVisits: () => void; onOpenSpendCategory: (categoryId: string) => void; scopeLabel: string; roleLabel: string; canCreateWork: boolean; canUseStorePortal: boolean; canRecordVisits: boolean; invoiceSafeguardEnabled: boolean }) {
  const pendingRequests = dataset.requests.filter((request) => request.reviewStatus === "new");
  const reviewInvoiceIds = new Set<string>();
  dataset.invoices.filter((invoice) => invoice.status === "needs_review").forEach((invoice) => reviewInvoiceIds.add(invoice.id));
  dataset.invoiceWorkLinks.filter((link) => link.matchStatus === "review_needed").forEach((link) => reviewInvoiceIds.add(link.invoiceId));
  exceptions.forEach((exception) => {
    if (exception.invoiceId) reviewInvoiceIds.add(exception.invoiceId);
    exception.sourceRecordIds.forEach((sourceId) => {
      if (dataset.invoices.some((invoice) => invoice.id === sourceId)) reviewInvoiceIds.add(sourceId);
    });
  });
  dataset.auditEvents
    .filter((event) => event.entityType === "invoice" && event.eventType === "maintenance_invoice_evidence_reviewed")
    .forEach((event) => reviewInvoiceIds.delete(event.entityId));
  const recordedCost = dataset.workOrders.reduce((sum, work) => sum + recordedMaintenanceCost(dataset, work.id), 0);
  const categoryRows = dataset.categories
    .map((category) => ({
      category,
      cost: dataset.workOrders
        .filter((work) => work.categoryId === category.id)
        .reduce((sum, work) => sum + recordedMaintenanceCost(dataset, work.id), 0),
    }))
    .filter((row) => row.cost > 0)
    .sort((left, right) => right.cost - left.cost)
    .slice(0, 6);
  const priorityExceptions = exceptions
    .slice()
    .sort((left, right) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[left.severity] - severityOrder[right.severity] || left.dueAt.localeCompare(right.dueAt);
    });
  const todayDonutBackground = costDonutBackground(
    categoryRows.map((row) => ({ cost: row.cost, color: row.category.color })),
    recordedCost,
  );

  return <>
    <PageHead eyebrow={`${roleLabel} · ${scopeLabel}`} title="What needs attention today?" description="Start with the signal. Every number opens the exact queue or source record behind it.">
      {canUseStorePortal ? <button className="to-button" type="button" onClick={onStorePortal}><StoreIcon /> Store portal</button> : null}
      {canRecordVisits ? <button className="to-button" type="button" onClick={onVisit}><MapPin /> Vendor check-in</button> : null}
      {canCreateWork ? <button className="to-button primary" type="button" onClick={onCreate}><Plus /> New work order</button> : null}
    </PageHead>
    <section className="to-kpi-grid">
      <button className="to-kpi" type="button" onClick={onOpenVisits}><div className="to-kpi-top"><span>Active vendor visits</span><span className="to-kpi-icon"><MapPin /></span></div><strong>{activeVisits.length}</strong><span>Open the onsite workspace and exact visit records</span></button>
      <button className="to-kpi" data-tone="coral" type="button" onClick={() => onNavigate("requests")}><div className="to-kpi-top"><span>Requests awaiting review</span><span className="to-kpi-icon"><Inbox /></span></div><strong>{pendingRequests.length}</strong><span>Employee reports requiring a manager decision</span></button>
      <button className="to-kpi" data-tone="blue" type="button" onClick={onOpenSpend}><div className="to-kpi-top"><span>Recorded maintenance cost</span><span className="to-kpi-icon"><CircleDollarSign /></span></div><strong>{money(recordedCost)}</strong><span>Recorded work cost, with invoice evidence only as fallback</span></button>
      {invoiceSafeguardEnabled ? <button className="to-kpi" data-tone="amber" type="button" onClick={onInvoiceReview}><div className="to-kpi-top"><span>Invoice evidence review</span><span className="to-kpi-icon"><ReceiptText /></span></div><strong>{reviewInvoiceIds.size}</strong><span>Distinct invoices with factual safeguards to review</span></button> : null}
    </section>
    <section className="to-grid two">
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Priority exceptions</h2><p>Each signal resolves to its underlying record.</p></div><button className="to-link-button" type="button" onClick={onOpenExceptions}>Open exception queue <ArrowRight /></button></header>
        <div className="to-exception-list">
          {priorityExceptions.slice(0, 6).map((exception) => {
            const pmOccurrenceId = exception.type === "pm_overdue"
              ? exception.sourceRecordIds.find((id) => dataset.pmOccurrences.some((occurrence) => occurrence.id === id))
              : undefined;
            const source: OperationsSourceReference | undefined = exception.invoiceId
              ? { kind: "invoice", id: exception.invoiceId }
              : exception.visitId
                ? { kind: "visit", id: exception.visitId }
                : exception.workOrderId
                  ? { kind: "work", id: exception.workOrderId }
                  : pmOccurrenceId
                    ? { kind: "pm", id: pmOccurrenceId }
                    : exception.assetId
                      ? { kind: "asset", id: exception.assetId }
                      : exception.storeId
                        ? { kind: "store", id: exception.storeId }
                        : undefined;
            return <button className="to-exception" type="button" key={exception.id} onClick={() => source ? onOpenSource(source) : onOpenExceptions()}>
              <span className="to-exception-icon" data-tone={exception.severity === "critical" ? "red" : exception.invoiceId ? "blue" : undefined}>{exception.invoiceId ? <ReceiptText /> : exception.visitId ? <MapPin /> : <AlertTriangle />}</span>
              <span className="to-record-primary"><strong>{exception.title}</strong><span>{exception.description}</span></span>
              <span className="to-record-meta">{exception.storeId ? `Store ${dataset.stores.find((store) => store.id === exception.storeId)?.storeNumber}` : "Portfolio"}<br />Due {dateLabel(exception.dueAt)}</span>
              <Badge value={exception.severity} />
            </button>;
          })}
        </div>
      </article>
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Onsite now</h2><p>QR, secure link, store device, and app feed one record.</p></div><button className="to-link-button" type="button" onClick={onOpenVisits}>Open visits <ArrowRight /></button></header>
        <div className="to-panel-body"><div className="to-visit-list">
          {activeVisits.length ? activeVisits.map((visit) => {
            const store = dataset.stores.find((record) => record.id === visit.storeId);
            const vendor = dataset.vendors.find((record) => record.id === visit.vendorId);
            return <button className="to-visit" type="button" key={visit.id} onClick={() => onOpenSource({ kind: "visit", id: visit.id })}><span className="to-avatar">{initials(visit.technicianName)}</span><span><strong>{visit.technicianName}</strong><span>{vendor?.displayName ?? "Internal maintenance"} · Store {store?.storeNumber}</span></span><time>{timeLabel(visit.checkedInAt)}</time></button>;
          }) : <div className="to-empty"><MapPin /><strong>No technicians onsite</strong><p>New check-ins will appear here immediately.</p></div>}
        </div></div>
      </article>
    </section>
    <section className="to-grid two">
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Where maintenance cost is concentrated</h2><p>Recorded maintenance cost by service area.</p></div><button className="to-link-button" type="button" onClick={onOpenSpend}>Explore all costs <ArrowRight /></button></header>
        <div className="to-chart"><div className="to-donut" style={{ background: todayDonutBackground }}><div className="to-donut-center"><strong>{money(recordedCost)}</strong><span>selected cost</span></div></div><div className="to-legend">{categoryRows.map((row, index) => <button type="button" onClick={() => onOpenSpendCategory(row.category.id)} key={row.category.id}><i style={{ background: row.category.color || ["#0b7568", "#df6d50", "#376f9e", "#d59a47"][index % 4] }} /><strong>{row.category.label}</strong><span>{recordedCost ? Math.round((row.cost / recordedCost) * 100) : 0}%</span><em>{money(row.cost)}</em></button>)}</div></div>
      </article>
      <StoreOutliers dataset={dataset} onOpen={(id) => onOpenSource({ kind: "store", id })} />
    </section>
  </>;
}

export function LegacyTodayView({ dataset, activeVisits, exceptions, invoicedSpend, onNavigate, onOpen, onCreate, onStorePortal, onVisit, scopeLabel, roleLabel, canCreateWork, canUseStorePortal, canRecordVisits }: { dataset: DemoDataset; activeVisits: Visit[]; exceptions: ExceptionRecord[]; invoicedSpend: number; onNavigate: (view: View) => void; onOpen: (detail: Detail) => void; onCreate: () => void; onStorePortal: () => void; onVisit: () => void; scopeLabel: string; roleLabel: string; canCreateWork: boolean; canUseStorePortal: boolean; canRecordVisits: boolean }) {
  const pendingRequests = dataset.requests.filter((request) => request.reviewStatus === "new");
  const invoiceExceptions = exceptions.filter((record) => record.invoiceId);
  const heading = roleLabel === "Store manager"
    ? `${scopeLabel.split(" · ")[0]} needs attention today.`
    : roleLabel === "Regional manager"
      ? `${scopeLabel.split(" · ")[0]} needs attention today.`
      : roleLabel === "Owner / executive"
        ? "Portfolio signals worth your attention."
        : "Here’s what needs attention today.";
  return <>
    <PageHead eyebrow={`Monday, August 10 · ${scopeLabel}`} title={heading} description="Every signal below is limited to this role’s assigned scope and connects to its work, evidence, cost, and store source records.">
      {canUseStorePortal ? <button className="to-button" type="button" onClick={onStorePortal}><StoreIcon /> Store portal</button> : null}
      {canRecordVisits ? <button className="to-button" type="button" onClick={onVisit}><MapPin /> Vendor check-in</button> : null}
      {canCreateWork ? <button className="to-button primary" type="button" onClick={onCreate}><Plus /> New work order</button> : null}
    </PageHead>
    <section className="to-kpi-grid">
      <button className="to-kpi" type="button" onClick={() => onNavigate("work")}><div className="to-kpi-top"><span>Active vendor visits</span><span className="to-kpi-icon"><MapPin /></span></div><strong>{activeVisits.length}</strong><span>Across {new Set(activeVisits.map((visit) => visit.storeId)).size} stores right now</span></button>
      <button className="to-kpi" data-tone="coral" type="button" onClick={() => onNavigate("requests")}><div className="to-kpi-top"><span>Requests awaiting review</span><span className="to-kpi-icon"><Inbox /></span></div><strong>{pendingRequests.length}</strong><span>Employee reports that still need a manager decision</span></button>
      <button className="to-kpi" data-tone="blue" type="button" onClick={() => onNavigate("spend")}><div className="to-kpi-top"><span>Linked maintenance spend</span><span className="to-kpi-icon"><CircleDollarSign /></span></div><strong>{money(invoicedSpend)}</strong><span>Invoice-linked source records · trailing 12 months</span></button>
      <button className="to-kpi" data-tone="amber" type="button" onClick={() => onNavigate("spend")}><div className="to-kpi-top"><span>Invoice review</span><span className="to-kpi-icon"><ReceiptText /></span></div><strong>{invoiceExceptions.length}</strong><span>Missing WO, NTE, or evidence exceptions</span></button>
    </section>
    <section className="to-grid two">
      <article className="to-panel"><header className="to-panel-head"><div><h2>Priority exceptions</h2><p>Manage the exceptions, not every routine job.</p></div><button className="to-link-button" type="button" onClick={() => onNavigate("work")}>View all <ArrowRight /></button></header><div className="to-exception-list">{exceptions.slice(0, 6).map((exception) => <button className="to-exception" type="button" key={exception.id} onClick={() => exception.workOrderId ? onOpen({ kind: "work", id: exception.workOrderId }) : exception.storeId ? onOpen({ kind: "store", id: exception.storeId }) : undefined}><span className="to-exception-icon" data-tone={exception.severity === "critical" ? "red" : exception.invoiceId ? "blue" : undefined}>{exception.invoiceId ? <ReceiptText /> : exception.type === "visit_without_work_order" ? <MapPin /> : <AlertTriangle />}</span><span className="to-record-primary"><strong>{exception.title}</strong><span>{exception.description}</span></span><span className="to-record-meta">{exception.storeId ? `Store ${dataset.stores.find((store) => store.id === exception.storeId)?.storeNumber}` : "Portfolio"}<br />Due {dateLabel(exception.dueAt)}</span><Badge value={exception.severity} /></button>)}</div></article>
      <article className="to-panel"><header className="to-panel-head"><div><h2>Onsite now</h2><p>One visit record across QR, link, kiosk, and app.</p></div>{canRecordVisits ? <button className="to-link-button" type="button" onClick={onVisit}>Check in <ArrowRight /></button> : null}</header><div className="to-panel-body"><div className="to-visit-list">{activeVisits.length ? activeVisits.map((visit) => { const store = dataset.stores.find((record) => record.id === visit.storeId); const vendor = dataset.vendors.find((record) => record.id === visit.vendorId); return <div className="to-visit" key={visit.id}><span className="to-avatar">{initials(visit.technicianName)}</span><span><strong>{visit.technicianName}</strong><span>{vendor?.displayName ?? "Internal maintenance"} · Store {store?.storeNumber}</span></span><time>{timeLabel(visit.checkedInAt)}</time></div>; }) : <div className="to-empty"><MapPin /><strong>No technicians onsite</strong><p>New check-ins will appear here immediately.</p></div>}</div></div></article>
    </section>
    <section className="to-grid two"><SpendSnapshot dataset={dataset} onNavigate={onNavigate} /><StoreOutliers dataset={dataset} onOpen={(id) => onOpen({ kind: "store", id })} /></section>
  </>;
}

function SpendSnapshot({ dataset, onNavigate }: { dataset: DemoDataset; onNavigate: (view: View) => void }) {
  const rows = dataset.categories.map((category) => ({ category, spend: categorySpend(dataset, category.id) })).filter((row) => row.spend > 0).sort((a, b) => b.spend - a.spend).slice(0, 5);
  const total = rows.reduce((sum, row) => sum + row.spend, 0);
  return <article className="to-panel"><header className="to-panel-head"><div><h2>Where the money went</h2><p>Invoice-linked spend · trailing 12 months</p></div><button className="to-link-button" type="button" onClick={() => onNavigate("spend")}>Explore spend <ArrowRight /></button></header><div className="to-chart"><div className="to-donut"><div className="to-donut-center"><strong>{money(total)}</strong><span>selected spend</span></div></div><div className="to-legend">{rows.map((row, index) => <button type="button" onClick={() => onNavigate("spend")} key={row.category.id}><i style={{ background: ["#0b7568", "#df6d50", "#376f9e", "#d59a47", "#9eaaa6"][index] }} /><strong>{row.category.label}</strong><span>{total ? Math.round((row.spend / total) * 100) : 0}%</span><em>{money(row.spend)}</em></button>)}</div></div></article>;
}

function StoreOutliers({ dataset, onOpen }: { dataset: DemoDataset; onOpen: (id: string) => void }) {
  const rows = dataset.stores.map((store) => ({ store, spend: storeSpend(dataset, store.id), open: workForStore(dataset, store.id).filter((work) => !terminalStatuses.has(work.status)).length })).sort((a, b) => b.spend - a.spend).slice(0, 5);
  const max = rows[0]?.spend || 1;
  return <article className="to-panel"><header className="to-panel-head"><div><h2>Highest-cost stores</h2><p>Click a store to see the exact drivers.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{rows.map((row) => <button className="to-bar-row to-link-row" type="button" key={row.store.id} onClick={() => onOpen(row.store.id)}><span className="to-bar-label"><strong>Store {row.store.storeNumber}</strong><span>{row.open} open work orders</span></span><span className="to-bar-track"><i style={{ width: `${Math.max(8, (row.spend / max) * 100)}%` }} /></span><b>{money(row.spend)}</b></button>)}</div></div></article>;
}

function StoresView({ dataset, onOpen, onCreate, onNewStore, canCreateWork, canCreateStore }: { dataset: DemoDataset; onOpen: (id: string) => void; onCreate: () => void; onNewStore: () => void; canCreateWork: boolean; canCreateStore: boolean }) {
  const [query, setQuery] = useState(""); const [regionId, setRegionId] = useState("all");
  const rows = dataset.stores.filter((store) => (regionId === "all" || store.regionId === regionId) && [store.storeNumber, store.name, store.normalizedAddress, ...store.searchTerms].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <><PageHead eyebrow={`${dataset.stores.length} active ${dataset.stores.length === 1 ? "store" : "stores"}`} title={dataset.stores.length === 1 ? "Your assigned store and its connected history." : "Find a store and understand it fast."} description="Search by store number, name, address, city, or legacy identifier. Results are limited to the current role’s scope.">{canCreateStore ? <button className="to-button" type="button" onClick={onNewStore}><Building2 /> New store</button> : null}{canCreateWork ? <button className="to-button primary" type="button" onClick={onCreate}><Plus /> New work order</button> : null}</PageHead><div className="to-toolbar"><div className="to-field grow"><label htmlFor="store-search">Search stores</label><input id="store-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try 104, West Broad, or Columbus…" /></div>{dataset.regions.length > 1 ? <div className="to-field"><label htmlFor="region-filter">Region</label><select id="region-filter" value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="all">All regions</option>{dataset.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div> : null}<span className="to-filter-count">{rows.length} {rows.length === 1 ? "store" : "stores"}</span></div><div className="to-store-grid">{rows.map((store) => { const open = workForStore(dataset, store.id).filter((work) => !terminalStatuses.has(work.status)); const spend = storeSpend(dataset, store.id); const exceptions = dataset.exceptions.filter((record) => record.storeId === store.id && record.status !== "resolved"); return <button className="to-card" type="button" key={store.id} onClick={() => onOpen(store.id)}><header className="to-card-head"><div><h3>Store {store.storeNumber}</h3><p>{store.name}<br />{store.address.line1}, {store.address.city}, {store.address.state}</p></div>{exceptions.some((record) => record.severity === "critical") ? <Badge value="critical" /> : <Badge value="open" label="Operating" />}</header><div className="to-card-body"><div className="to-tags"><span className="to-tag">{words(store.format)}</span><span className="to-tag">{store.open24Hours ? "Open 24 hours" : "Extended hours"}</span></div></div><footer className="to-card-facts"><div><span>Open work</span><strong>{open.length}</strong></div><div><span>Linked spend</span><strong>{money(spend)}</strong></div><div><span>Exceptions</span><strong>{exceptions.length}</strong></div></footer></button>; })}</div></>;
}

function WorkView({ dataset, onOpen, onCreate, canCreateWork }: { dataset: DemoDataset; onOpen: (id: string) => void; onCreate: () => void; canCreateWork: boolean }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("open");
  const rows = dataset.workOrders.filter((work) => (status === "all" || (status === "open" ? !terminalStatuses.has(work.status) : work.status === status)) && [work.number, work.title, work.problemDescription].join(" ").toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <><PageHead eyebrow="Customer work orders" title="One record from authorization to invoice." description="Internal and outside work stays connected. Every result below is limited to the current role’s assigned stores.">{canCreateWork ? <button className="to-button primary" type="button" onClick={onCreate}><Plus /> Create work order</button> : null}</PageHead><div className="to-toolbar"><div className="to-field grow"><label htmlFor="work-search">Search work</label><input id="work-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Work-order number, store, or problem…" /></div><div className="to-field"><label htmlFor="work-status">Status</label><select id="work-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">All active</option><option value="awaiting_vendor_response">Awaiting vendor</option><option value="onsite">Onsite</option><option value="waiting_parts">Waiting on parts</option><option value="completed">Completed</option><option value="all">Everything</option></select></div><span className="to-filter-count">{rows.length} work orders</span></div><article className="to-panel to-table-wrap"><table className="to-table"><thead><tr><th>Work order</th><th>Store</th><th>Who handles it</th><th>Status</th><th>Next action</th><th>Cost</th></tr></thead><tbody>{rows.map((work) => { const store = dataset.stores.find((record) => record.id === work.storeId); const assignment = dataset.assignments.find((record) => record.workOrderId === work.id); const vendor = assignment?.partyType === "vendor" ? dataset.vendors.find((record) => record.id === assignment.partyId) : undefined; const team = assignment?.partyType === "team" ? dataset.teams.find((record) => record.id === assignment.partyId) : undefined; return <tr key={work.id} onClick={() => onOpen(work.id)}><td><strong>{work.number}</strong><small>{work.title}</small></td><td><strong>#{store?.storeNumber}</strong><small>{store?.address.city}</small></td><td>{vendor?.displayName ?? team?.name ?? (work.fulfillmentMode === "unassigned" ? "Choose later" : words(work.fulfillmentMode))}</td><td><Badge value={work.status} /></td><td>{work.accountable?.nextAction ?? "Review history"}<small>{work.accountable ? `Due ${dateLabel(work.accountable.dueAt)}` : ""}</small></td><td className="to-money">{money(workOrderCost(dataset, work.id))}</td></tr>; })}</tbody></table></article></>;
}

function VendorsView({ dataset, onOpen, onNewVendor, canManage }: { dataset: DemoDataset; onOpen: (id: string) => void; onNewVendor: () => void; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const rows = dataset.vendors.filter((vendor) => [vendor.displayName, vendor.description, ...vendor.aliases, ...vendor.searchTerms, ...vendor.specialties.flatMap((specialty) => [specialty.label, ...specialty.aliases, ...specialty.equipmentTypes])].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <><PageHead eyebrow="Approved vendor network" title="Find the right vendor by name or what they do." description="Search plain-language needs such as plumber, beer cave, fuel pump, parking-lot lights, or snow removal. Results explain coverage and preference.">{canManage ? <button className="to-button primary" type="button" onClick={onNewVendor}><Plus /> Add approved vendor</button> : null}</PageHead><div className="to-toolbar"><div className="to-field grow"><label htmlFor="vendor-search">Search vendors and specialties</label><input id="vendor-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try refrigeration, plumber, beer cave, or a company name…" /></div><span className="to-filter-count">{rows.length} approved vendors</span></div><div className="to-vendor-grid">{rows.map((vendor) => { const workIds = new Set(dataset.assignments.filter((assignment) => assignment.partyType === "vendor" && assignment.partyId === vendor.id).map((assignment) => assignment.workOrderId)); const active = dataset.workOrders.filter((work) => workIds.has(work.id) && !terminalStatuses.has(work.status)).length; const visits = dataset.visits.filter((visit) => visit.vendorId === vendor.id).length; return <button className="to-card" type="button" key={vendor.id} onClick={() => onOpen(vendor.id)}><header className="to-card-head"><div><h3>{vendor.displayName}</h3><p>{vendor.description}</p></div><Badge value={vendor.status} /></header><div className="to-card-body"><div className="to-tags">{vendor.specialties.slice(0, 4).map((specialty) => <span className="to-tag" key={specialty.label}>{specialty.label}</span>)}</div></div><footer className="to-card-facts"><div><span>Active work</span><strong>{active}</strong></div><div><span>Visits</span><strong>{visits}</strong></div><div><span>Linked spend</span><strong>{money(vendorSpend(dataset, vendor.id))}</strong></div></footer></button>; })}</div></>;
}

export function LegacySpendView({ dataset, onOpenWork, onNavigate }: { dataset: DemoDataset; onOpenWork: (id: string) => void; onNavigate: (view: View) => void }) {
  const total = dataset.invoiceWorkLinks.reduce((sum, link) => sum + link.attributedAmountMinor, 0); const invoiceReview = dataset.invoices.filter((invoice) => invoice.status === "needs_review"); const rows = dataset.categories.map((category) => ({ category, spend: categorySpend(dataset, category.id) })).filter((row) => row.spend).sort((a, b) => b.spend - a.spend); const max = rows[0]?.spend || 1;
  return <><PageHead eyebrow="Invoice-linked cost basis · trailing 12 months" title="Every maintenance dollar has a source story." description="Move from company totals to a store, category, asset, work order, visit, and invoice without changing the selected cost basis."><button className="to-button" type="button" onClick={() => onNavigate("reports")}><FileBarChart /> Generate report</button></PageHead><section className="to-kpi-grid"><div className="to-kpi"><div className="to-kpi-top"><span>Selected spend</span><span className="to-kpi-icon"><CircleDollarSign /></span></div><strong>{money(total)}</strong><span>{dataset.invoiceWorkLinks.length} linked cost allocations</span></div><div className="to-kpi" data-tone="coral"><div className="to-kpi-top"><span>Highest category</span><span className="to-kpi-icon"><Gauge /></span></div><strong>{rows[0]?.category.label}</strong><span>{money(rows[0]?.spend ?? 0)} from source invoices</span></div><div className="to-kpi" data-tone="amber"><div className="to-kpi-top"><span>Invoice exceptions</span><span className="to-kpi-icon"><ReceiptText /></span></div><strong>{invoiceReview.length}</strong><span>Human review required before AP handoff</span></div><div className="to-kpi" data-tone="blue"><div className="to-kpi-top"><span>Classified to asset</span><span className="to-kpi-icon"><PackageSearch /></span></div><strong>{Math.round((dataset.invoiceWorkLinks.filter((link) => link.assetId).length / Math.max(1, dataset.invoiceWorkLinks.length)) * 100)}%</strong><span>Unclassified work remains visible in totals</span></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Spend by service area</h2><p>Click through to supporting work.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{rows.map((row) => <div className="to-bar-row" key={row.category.id}><span className="to-bar-label"><strong>{row.category.label}</strong><span>{Math.round((row.spend / total) * 100)}% of selected spend</span></span><span className="to-bar-track"><i style={{ width: `${(row.spend / max) * 100}%` }} /></span><b>{money(row.spend)}</b></div>)}</div></div></article><StoreOutliers dataset={dataset} onOpen={(storeId) => { const work = dataset.workOrders.find((record) => record.storeId === storeId); if (work) onOpenWork(work.id); }} /></section><article className="to-panel"><header className="to-panel-head"><div><h2>Invoices needing review</h2><p>Exceptions are facts to review—not automatic accusations.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Invoice</th><th>Vendor</th><th>Customer WO reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoiceReview.map((invoice) => { const vendor = dataset.vendors.find((record) => record.id === invoice.vendorId); const link = dataset.invoiceWorkLinks.find((record) => record.invoiceId === invoice.id); return <tr key={invoice.id} onClick={() => link ? onOpenWork(link.workOrderId) : undefined}><td><strong>{invoice.invoiceNumber}</strong><small>Received {dateLabel(invoice.receivedAt)}</small></td><td>{vendor?.displayName}</td><td>{invoice.customerWorkOrderReferences.join(", ") || "Missing"}</td><td className="to-money">{money(invoiceTotal(dataset, invoice.id))}</td><td><Badge value={invoice.status} /></td></tr>; })}</tbody></table></div></article></>;
}

export function LegacyScopedSpendView({ dataset, onOpenWork, onOpenStore, onOpenAsset, onNavigate, initialRegionId, initialStoreId, initialCategoryId }: { dataset: DemoDataset; onOpenWork: (id: string) => void; onOpenStore: (id: string) => void; onOpenAsset: (id: string) => void; onNavigate: (view: View) => void; initialRegionId?: string; initialStoreId?: string; initialCategoryId?: string }) {
  const [regionId, setRegionId] = useState(initialRegionId ?? "all");
  const [storeId, setStoreId] = useState(initialStoreId ?? "all");
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? "all");
  const availableStores = dataset.stores.filter((store) => regionId === "all" || store.regionId === regionId);
  const scopedStoreIds = new Set(availableStores.filter((store) => storeId === "all" || store.id === storeId).map((store) => store.id));
  const links = dataset.invoiceWorkLinks.filter((link) => scopedStoreIds.has(link.storeId) && (categoryId === "all" || link.categoryId === categoryId));
  const total = links.reduce((sum, link) => sum + link.attributedAmountMinor, 0);
  const categoryRows = dataset.categories
    .map((category) => ({ category, links: links.filter((link) => link.categoryId === category.id) }))
    .map((row) => ({ ...row, spend: row.links.reduce((sum, link) => sum + link.attributedAmountMinor, 0) }))
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const storeRows = dataset.stores
    .filter((store) => scopedStoreIds.has(store.id))
    .map((store) => ({ store, links: links.filter((link) => link.storeId === store.id) }))
    .map((row) => ({ ...row, spend: row.links.reduce((sum, link) => sum + link.attributedAmountMinor, 0) }))
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const assetRows = dataset.assets
    .filter((asset) => scopedStoreIds.has(asset.storeId) && (categoryId === "all" || asset.categoryId === categoryId))
    .map((asset) => ({ asset, links: links.filter((link) => link.assetId === asset.id) }))
    .map((row) => ({ ...row, spend: row.links.reduce((sum, link) => sum + link.attributedAmountMinor, 0) }))
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const assetClassified = links.filter((link) => link.assetId).reduce((sum, link) => sum + link.attributedAmountMinor, 0);
  const selectedRegion = dataset.regions.find((region) => region.id === regionId);
  const selectedStore = dataset.stores.find((store) => store.id === storeId);
  const selectedCategory = dataset.categories.find((category) => category.id === categoryId);
  const maxCategory = categoryRows[0]?.spend || 1;
  const maxStore = storeRows[0]?.spend || 1;

  return <><PageHead eyebrow="Invoice-linked cost basis · trailing 12 months" title="Move from the company total to the source record." description="Change operating scope and maintenance depth independently. Every amount below is calculated from the same invoice-to-work-order allocations."><button className="to-button" type="button" onClick={() => onNavigate("reports")}><FileBarChart /> Generate report</button></PageHead><div className="to-toolbar"><div className="to-field"><label htmlFor="spend-region">Region</label><select id="spend-region" value={regionId} onChange={(event) => { setRegionId(event.target.value); setStoreId("all"); }}><option value="all">All regions</option>{dataset.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></div><div className="to-field"><label htmlFor="spend-store">Store</label><select id="spend-store" value={storeId} onChange={(event) => setStoreId(event.target.value)}><option value="all">All stores in scope</option>{availableStores.map((store) => <option key={store.id} value={store.id}>#{store.storeNumber} · {store.address.city}</option>)}</select></div><div className="to-field"><label htmlFor="spend-category">Service area</label><select id="spend-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">All service areas</option>{dataset.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></div><button className="to-button ghost" type="button" onClick={() => { setRegionId("all"); setStoreId("all"); setCategoryId("all"); }}>Reset scope</button></div><div className="to-scope-trail"><span>Company</span><ChevronRight />{selectedRegion ? <><span>{selectedRegion.name}</span><ChevronRight /></> : <span>All regions</span>}{selectedStore ? <><span>Store {selectedStore.storeNumber}</span><ChevronRight /></> : null}<strong>{selectedCategory?.label ?? "All service areas"}</strong></div><section className="to-kpi-grid"><div className="to-kpi"><div className="to-kpi-top"><span>Selected spend</span><span className="to-kpi-icon"><CircleDollarSign /></span></div><strong>{money(total)}</strong><span>{links.length} source-linked allocations · invoice basis</span></div><button className="to-kpi" data-tone="coral" type="button" onClick={() => storeRows[0] && onOpenStore(storeRows[0].store.id)}><div className="to-kpi-top"><span>Highest-cost store</span><span className="to-kpi-icon"><StoreIcon /></span></div><strong>{storeRows[0] ? `#${storeRows[0].store.storeNumber}` : "—"}</strong><span>{money(storeRows[0]?.spend ?? 0)} · click for store record</span></button><button className="to-kpi" data-tone="amber" type="button" onClick={() => assetRows[0] && onOpenAsset(assetRows[0].asset.id)}><div className="to-kpi-top"><span>Highest-cost asset</span><span className="to-kpi-icon"><Gauge /></span></div><strong>{assetRows[0]?.asset.assetCode ?? "Unclassified"}</strong><span>{money(assetRows[0]?.spend ?? 0)} · click for lifecycle history</span></button><div className="to-kpi" data-tone="blue"><div className="to-kpi-top"><span>Mapped to an asset</span><span className="to-kpi-icon"><PackageSearch /></span></div><strong>{total ? Math.round((assetClassified / total) * 100) : 0}%</strong><span>Unclassified spend stays in the selected total</span></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Service-area drilldown</h2><p>Choose a category without changing operating scope.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{categoryRows.map((row) => <button className="to-bar-row to-link-row" type="button" key={row.category.id} onClick={() => setCategoryId(row.category.id)}><span className="to-bar-label"><strong>{row.category.label}</strong><span>{row.links.length} source allocations</span></span><span className="to-bar-track"><i style={{ width: `${Math.max(4, (row.spend / maxCategory) * 100)}%`, background: row.category.color }} /></span><b>{money(row.spend)}</b></button>)}</div></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Store drilldown</h2><p>Open a store to see work, visits, equipment, and PM.</p></div></header><div className="to-panel-body"><div className="to-bar-list">{storeRows.slice(0, 8).map((row) => <button className="to-bar-row to-link-row" type="button" key={row.store.id} onClick={() => onOpenStore(row.store.id)}><span className="to-bar-label"><strong>Store {row.store.storeNumber}</strong><span>{row.store.address.city} · {row.links.length} allocations</span></span><span className="to-bar-track"><i style={{ width: `${Math.max(4, (row.spend / maxStore) * 100)}%` }} /></span><b>{money(row.spend)}</b></button>)}</div></div></article></section>{assetRows.length ? <article className="to-panel to-spend-assets"><header className="to-panel-head"><div><h2>Equipment drivers</h2><p>{selectedCategory ? `${selectedCategory.label} · ` : ""}only classified spend appears here.</p></div><span className="to-filter-count">{assetRows.length} assets</span></header><div className="to-record-list">{assetRows.slice(0, 8).map((row) => { const store = dataset.stores.find((record) => record.id === row.asset.storeId); return <button className="to-record-row to-spend-asset-row" type="button" key={row.asset.id} onClick={() => onOpenAsset(row.asset.id)}><span className="to-exception-icon" data-tone="blue"><Gauge /></span><span className="to-record-primary"><strong>{row.asset.name}</strong><span>Store {store?.storeNumber} · {row.asset.assetCode} · {row.asset.manufacturer} {row.asset.model}</span></span><span className="to-record-meta">{row.links.length} allocations</span><strong className="to-money">{money(row.spend)}</strong><ChevronRight /></button>; })}</div></article> : null}<article className="to-panel"><header className="to-panel-head"><div><h2>Supporting source records</h2><p>Open the customer work order behind any selected amount.</p></div><span className="to-filter-count">{links.length} allocations</span></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Customer WO</th><th>Store</th><th>Service area</th><th>Vendor invoice</th><th>Match</th><th>Attributed amount</th></tr></thead><tbody>{links.slice(0, 18).map((link) => { const work = dataset.workOrders.find((record) => record.id === link.workOrderId); const store = dataset.stores.find((record) => record.id === link.storeId); const category = dataset.categories.find((record) => record.id === link.categoryId); const invoice = dataset.invoices.find((record) => record.id === link.invoiceId); return <tr key={link.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenWork(link.workOrderId)}><span><strong>{work?.number}</strong><small>{work?.title}</small></span><ChevronRight /></button></td><td>#{store?.storeNumber}<small>{store?.address.city}</small></td><td>{category?.label ?? "Unclassified"}</td><td>{invoice?.invoiceNumber}<small>{invoice?.customerWorkOrderReferences.join(", ") || "WO reference missing"}</small></td><td><Badge value={link.matchStatus} /></td><td className="to-money">{money(link.attributedAmountMinor)}</td></tr>; })}</tbody></table></div></article></>;
}

export function EquipmentView({ dataset, onOpenWork, onOpenAsset, onNewAsset, canManage }: { dataset: DemoDataset; onOpenWork: (id: string) => void; onOpenAsset: (id: string) => void; onNewAsset: () => void; canManage: boolean }) {
  const assets = [...dataset.assets].sort((left, right) => {
    const leftCost = dataset.workOrders
      .filter((work) => work.assetId === left.id)
      .reduce((sum, work) => sum + recordedMaintenanceCost(dataset, work.id), 0);
    const rightCost = dataset.workOrders
      .filter((work) => work.assetId === right.id)
      .reduce((sum, work) => sum + recordedMaintenanceCost(dataset, work.id), 0);
    return rightCost - leftCost;
  });

  return <>
    <PageHead
      eyebrow={`${dataset.assets.length} tracked assets`}
      title="Equipment history that earns its setup."
      description="Start at store and service area. Add model, serial, warranty, components, and lifecycle depth only where it improves a decision."
    >
      {canManage ? <button className="to-button primary" type="button" onClick={onNewAsset}><Plus /> Add equipment</button> : null}
    </PageHead>
    <div className="to-asset-grid">
      {assets.slice(0, 24).map((asset) => {
        const store = dataset.stores.find((record) => record.id === asset.storeId);
        const work = dataset.workOrders.filter((record) => record.assetId === asset.id);
        const cost = work.reduce((sum, record) => sum + recordedMaintenanceCost(dataset, record.id), 0);
        const age = Math.max(0, new Date(dataset.asOf).getUTCFullYear() - Number(asset.installedOn.slice(0, 4)));
        const review = cost > asset.replacementEstimateMinor * 0.35 || age >= asset.expectedLifeYears;
        return <article className="to-card" key={asset.id}>
          <header className="to-card-head">
            <div><h3>{asset.name}</h3><p>Store {store?.storeNumber} · {asset.locationDetail}<br />{asset.manufacturer} {asset.model}</p></div>
            {review ? <Badge value="warning" label="Capital review" /> : <Badge value={asset.status} />}
          </header>
          <div className="to-card-body">
            <div className="to-tags">
              <span className="to-tag">{asset.assetType}</span>
              <span className="to-tag">{age} years old</span>
              {asset.warranty ? <span className="to-tag">Warranty to {dateLabel(asset.warranty.endsOn)}</span> : null}
            </div>
          </div>
          <footer className="to-card-facts">
            <div><span>Recorded cost</span><strong>{money(cost)}</strong></div>
            <div><span>Work orders</span><strong>{work.length}</strong></div>
            <div><span>Replace est.</span><strong>{money(asset.replacementEstimateMinor)}</strong></div>
          </footer>
          <div className="to-card-actions">
            <button className="to-card-action" type="button" onClick={() => onOpenAsset(asset.id)}>Open equipment record <ChevronRight /></button>
            {work[0] ? <button className="to-card-action secondary" type="button" onClick={() => onOpenWork(work[0].id)}>Latest work order <ArrowRight /></button> : null}
          </div>
        </article>;
      })}
    </div>
  </>;
}

export function LegacyEquipmentView({ dataset, onOpenWork, onOpenAsset }: { dataset: DemoDataset; onOpenWork: (id: string) => void; onOpenAsset: (id: string) => void }) {
  const assets = [...dataset.assets].sort((a, b) => { const aCost = dataset.invoiceWorkLinks.filter((link) => link.assetId === a.id).reduce((sum, link) => sum + link.attributedAmountMinor, 0); const bCost = dataset.invoiceWorkLinks.filter((link) => link.assetId === b.id).reduce((sum, link) => sum + link.attributedAmountMinor, 0); return bCost - aCost; });
  return <><PageHead eyebrow={`${dataset.assets.length} tracked assets`} title="Equipment history that earns its setup." description="Start with store and category. Add model, serial, warranty, components, and lifecycle depth only where it improves decisions."></PageHead><div className="to-asset-grid">{assets.slice(0, 18).map((asset) => { const store = dataset.stores.find((record) => record.id === asset.storeId); const cost = dataset.invoiceWorkLinks.filter((link) => link.assetId === asset.id).reduce((sum, link) => sum + link.attributedAmountMinor, 0); const work = dataset.workOrders.filter((record) => record.assetId === asset.id); const age = Math.max(0, new Date(dataset.asOf).getUTCFullYear() - Number(asset.installedOn.slice(0, 4))); const review = cost > asset.replacementEstimateMinor * .35 || age >= asset.expectedLifeYears; return <article className="to-card" key={asset.id}><header className="to-card-head"><div><h3>{asset.name}</h3><p>Store {store?.storeNumber} · {asset.locationDetail}<br />{asset.manufacturer} {asset.model}</p></div>{review ? <Badge value="warning" label="Capital review" /> : <Badge value={asset.status} />}</header><div className="to-card-body"><div className="to-tags"><span className="to-tag">{asset.assetType}</span><span className="to-tag">{age} years old</span>{asset.warranty ? <span className="to-tag">Warranty to {dateLabel(asset.warranty.endsOn)}</span> : null}</div></div><footer className="to-card-facts"><div><span>Linked spend</span><strong>{money(cost)}</strong></div><div><span>Work orders</span><strong>{work.length}</strong></div><div><span>Replace est.</span><strong>{money(asset.replacementEstimateMinor)}</strong></div></footer><div className="to-card-actions"><button className="to-card-action" type="button" onClick={() => onOpenAsset(asset.id)}>Open equipment record <ChevronRight /></button>{work[0] ? <button className="to-card-action secondary" type="button" onClick={() => onOpenWork(work[0].id)}>Latest work order <ArrowRight /></button> : null}</div></article>; })}</div></>;
}

function PmView({ dataset, filter, onFilterChange, sort, onSortChange, onOpenWork, onOpenOccurrence, onNewPlan, canManage }: { dataset: DemoDataset; filter: PmScheduleFilter; onFilterChange: (filter: PmScheduleFilter) => void; sort: PmScheduleSort; onSortChange: (sort: PmScheduleSort) => void; onOpenWork: (id: string) => void; onOpenOccurrence: (id: string) => void; onNewPlan: () => void; canManage: boolean }) {
  const completed = dataset.pmOccurrences.filter((record) => record.status === "completed").length;
  const denominator = dataset.pmOccurrences.filter((record) => record.status !== "upcoming").length;
  const compliance = denominator ? Math.round((completed / denominator) * 100) : 100;
  const open = dataset.pmOccurrences.filter((record) => !["completed", "skipped"].includes(record.status));
  const dueAndUpcoming = open.filter((record) => record.status === "due" || record.status === "upcoming").length;
  const overdue = open.filter((record) => record.status === "overdue").length;
  const activePlanIds = new Set(dataset.pmPlans.filter((plan) => plan.active).map((plan) => plan.id));
  const activePlanOccurrenceCount = dataset.pmOccurrences.filter((occurrence) => activePlanIds.has(occurrence.pmPlanId)).length;
  const statusOrder: Record<PmOccurrence["status"], number> = {
    overdue: 0,
    due: 1,
    upcoming: 2,
    completed: 3,
    skipped: 4,
  };
  const visibleOccurrences = dataset.pmOccurrences
    .filter((occurrence) => {
      if (filter === "all") return true;
      if (filter === "compliance_window") return occurrence.status !== "upcoming";
      if (filter === "due_upcoming") return occurrence.status === "due" || occurrence.status === "upcoming";
      if (filter === "active_plans") return activePlanIds.has(occurrence.pmPlanId);
      if (filter === "waived") return occurrence.status === "skipped";
      return occurrence.status === filter;
    })
    .sort((left, right) => {
      const result = sort === "status"
        ? statusOrder[left.status] - statusOrder[right.status] || left.dueAt.localeCompare(right.dueAt)
        : sort === "due_desc"
          ? right.dueAt.localeCompare(left.dueAt)
          : left.dueAt.localeCompare(right.dueAt);
      return result || left.id.localeCompare(right.id);
    });

  function toggleTile(next: PmScheduleFilter) {
    onFilterChange(filter === next ? "all" : next);
  }

  return <>
    <PageHead
      eyebrow="Preventive maintenance"
      title="See what is due, missed, and actually completed."
      description="Every occurrence is actionable, whether or not a work order has been created yet. Completion and waivers remain explicit and auditable."
    >
      {canManage ? <button className="to-button primary" type="button" onClick={onNewPlan}><Plus /> New PM plan</button> : null}
    </PageHead>
    <section className="to-kpi-grid" aria-label="Filter preventive maintenance by status">
      <button className="to-kpi" type="button" data-active={filter === "compliance_window"} aria-pressed={filter === "compliance_window"} aria-label={`Show ${denominator} PM occurrences in the compliance window`} aria-controls="pm-schedule-table" onClick={() => toggleTile("compliance_window")}><div className="to-kpi-top"><span>PM compliance</span><span className="to-kpi-icon"><CalendarCheck /></span></div><strong>{compliance}%</strong><span>{completed} completed of {denominator} due · click to filter</span></button>
      <button className="to-kpi" type="button" data-tone="amber" data-active={filter === "due_upcoming"} aria-pressed={filter === "due_upcoming"} aria-label={`Show ${dueAndUpcoming} due and upcoming PM occurrences`} aria-controls="pm-schedule-table" onClick={() => toggleTile("due_upcoming")}><div className="to-kpi-top"><span>Due and upcoming</span><span className="to-kpi-icon"><Clock3 /></span></div><strong>{dueAndUpcoming}</strong><span>Click to show work that is due or coming next</span></button>
      <button className="to-kpi" type="button" data-tone="coral" data-active={filter === "overdue"} aria-pressed={filter === "overdue"} aria-label={`Show ${overdue} overdue PM occurrences`} aria-controls="pm-schedule-table" onClick={() => toggleTile("overdue")}><div className="to-kpi-top"><span>Overdue</span><span className="to-kpi-icon"><AlertTriangle /></span></div><strong>{overdue}</strong><span>Click to show only overdue occurrences</span></button>
      <button className="to-kpi" type="button" data-tone="blue" data-active={filter === "active_plans"} aria-pressed={filter === "active_plans"} aria-label={`Show ${activePlanOccurrenceCount} occurrences on active PM plans`} aria-controls="pm-schedule-table" onClick={() => toggleTile("active_plans")}><div className="to-kpi-top"><span>Active plans</span><span className="to-kpi-icon"><ClipboardList /></span></div><strong>{dataset.pmPlans.filter((record) => record.active).length}</strong><span>{activePlanOccurrenceCount} scheduled occurrences · click to filter</span></button>
    </section>
    <div className="to-toolbar" aria-label="Preventive maintenance table controls">
      <div className="to-field">
        <label htmlFor="pm-status-filter">Show</label>
        <select id="pm-status-filter" value={filter} onChange={(event) => onFilterChange(event.target.value as PmScheduleFilter)}>
          <option value="all">All occurrences</option>
          <option value="compliance_window">Compliance window</option>
          <option value="due_upcoming">Due and upcoming</option>
          <option value="overdue">Overdue</option>
          <option value="due">Due now</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="waived">Waived</option>
          <option value="active_plans">Active-plan occurrences</option>
        </select>
      </div>
      <div className="to-field">
        <label htmlFor="pm-sort">Sort by</label>
        <select id="pm-sort" value={sort} onChange={(event) => onSortChange(event.target.value as PmScheduleSort)}>
          <option value="due_asc">Due date · soonest first</option>
          <option value="due_desc">Due date · latest first</option>
          <option value="status">Status · attention first</option>
        </select>
      </div>
      {filter !== "all" || sort !== "due_asc" ? <button className="to-button ghost" type="button" onClick={() => { onFilterChange("all"); onSortChange("due_asc"); }}><X /> Reset</button> : null}
      <span className="to-filter-count" aria-live="polite">Showing {visibleOccurrences.length} of {dataset.pmOccurrences.length}</span>
    </div>
    <article className="to-panel">
      <header className="to-panel-head"><div><h2>PM schedule</h2><p>Open any row for the occurrence actions and source trail.</p></div></header>
      <div className="to-table-wrap"><table className="to-table" id="pm-schedule-table">
        <thead><tr><th>Plan</th><th>Store</th><th>Due</th><th>Assigned to</th><th>Status</th><th>Evidence</th></tr></thead>
        <tbody>{visibleOccurrences.map((occurrence) => {
          const plan = dataset.pmPlans.find((record) => record.id === occurrence.pmPlanId);
          const store = dataset.stores.find((record) => record.id === occurrence.storeId);
          const vendor = plan?.assignedPartyType === "vendor" ? dataset.vendors.find((record) => record.id === plan.assignedPartyId) : undefined;
          const team = plan?.assignedPartyType === "team" ? dataset.teams.find((record) => record.id === plan.assignedPartyId) : undefined;
          return <tr key={occurrence.id} onClick={() => onOpenOccurrence(occurrence.id)}>
            <td><button className="to-link-button to-cell-link" type="button" onClick={(event) => { event.stopPropagation(); onOpenOccurrence(occurrence.id); }}><span><strong>{plan?.name}</strong><small>{plan?.cadence ? words(plan.cadence) : ""}</small></span><ChevronRight /></button></td>
            <td>#{store?.storeNumber}<small>{store?.address.city}</small></td>
            <td>{dateLabel(occurrence.dueAt)}</td>
            <td>{vendor?.displayName ?? team?.name ?? "Unassigned"}</td>
            <td>{occurrence.status === "skipped" ? <Badge value="skipped" label="Waived" /> : <Badge value={occurrence.status} />}</td>
            <td>{plan?.requiredEvidence.map(words).join(" · ")}{occurrence.workOrderId ? <button className="to-link-button" type="button" onClick={(event) => { event.stopPropagation(); onOpenWork(occurrence.workOrderId!); }}>Open work</button> : null}</td>
          </tr>;
        })}{visibleOccurrences.length === 0 ? <tr><td colSpan={6}><div className="to-empty"><CalendarCheck /><strong>No PM occurrences match this status</strong><p>Choose another status or clear the filter to see the full schedule.</p><button className="to-button ghost" type="button" onClick={() => onFilterChange("all")}>Show all occurrences</button></div></td></tr> : null}</tbody>
      </table></div>
    </article>
  </>;
}

export function LegacyPmView({ dataset, onOpenWork }: { dataset: DemoDataset; onOpenWork: (id: string) => void }) {
  const completed = dataset.pmOccurrences.filter((record) => record.status === "completed").length; const denominator = dataset.pmOccurrences.filter((record) => record.status !== "upcoming").length; const compliance = denominator ? Math.round((completed / denominator) * 100) : 100; const open = dataset.pmOccurrences.filter((record) => record.status !== "completed");
  return <><PageHead eyebrow="Preventive maintenance" title="See what is due, missed, and actually completed." description="PM uses the same customer work order, vendor issuance, visit evidence, cost, and audit trail as reactive maintenance."></PageHead><section className="to-kpi-grid"><div className="to-kpi"><div className="to-kpi-top"><span>PM compliance</span><span className="to-kpi-icon"><CalendarCheck /></span></div><strong>{compliance}%</strong><span>{completed} completed of {denominator} due in the selected window</span></div><div className="to-kpi" data-tone="amber"><div className="to-kpi-top"><span>Due and upcoming</span><span className="to-kpi-icon"><Clock3 /></span></div><strong>{open.filter((record) => record.status === "due" || record.status === "upcoming").length}</strong><span>Across HVAC, refrigeration, and exterior service</span></div><div className="to-kpi" data-tone="coral"><div className="to-kpi-top"><span>Overdue</span><span className="to-kpi-icon"><AlertTriangle /></span></div><strong>{open.filter((record) => record.status === "overdue").length}</strong><span>Visible until resolved or waived with reason</span></div><div className="to-kpi" data-tone="blue"><div className="to-kpi-top"><span>Active plans</span><span className="to-kpi-icon"><ClipboardList /></span></div><strong>{dataset.pmPlans.filter((record) => record.active).length}</strong><span>Store, asset, and category schedules</span></div></section><article className="to-panel"><header className="to-panel-head"><div><h2>PM schedule</h2><p>Every row links to the occurrence and customer work order.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Plan</th><th>Store</th><th>Due</th><th>Assigned to</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{dataset.pmOccurrences.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((occurrence) => { const plan = dataset.pmPlans.find((record) => record.id === occurrence.pmPlanId); const store = dataset.stores.find((record) => record.id === occurrence.storeId); const vendor = plan?.assignedPartyType === "vendor" ? dataset.vendors.find((record) => record.id === plan.assignedPartyId) : undefined; const team = plan?.assignedPartyType === "team" ? dataset.teams.find((record) => record.id === plan.assignedPartyId) : undefined; return <tr key={occurrence.id} onClick={() => occurrence.workOrderId ? onOpenWork(occurrence.workOrderId) : undefined}><td><strong>{plan?.name}</strong><small>{plan?.cadence ? words(plan.cadence) : ""}</small></td><td>#{store?.storeNumber}<small>{store?.address.city}</small></td><td>{dateLabel(occurrence.dueAt)}</td><td>{vendor?.displayName ?? team?.name ?? "Unassigned"}</td><td><Badge value={occurrence.status} /></td><td>{plan?.requiredEvidence.map(words).join(" · ")}</td></tr>; })}</tbody></table></div></article></>;
}

function ReportsView({ dataset, savedReports, onBuild, onOpenReport, canGenerate, scopeLabel }: { dataset: DemoDataset; savedReports: SavedReportRecord[]; onBuild: (template: SavedReportRecord["template"]) => void; onOpenReport: (id: string) => void; canGenerate: boolean; scopeLabel: string }) {
  const templates: Array<{ id: SavedReportRecord["template"]; title: string; description: string }> = [
    { id: "operating_review", title: "Monthly operating review", description: `Maintenance cost, critical work, vendor exceptions, PM, and capital review across ${dataset.stores.length} ${dataset.stores.length === 1 ? "store" : "stores"}.` },
    { id: "vendor_accountability", title: "Vendor accountability review", description: "Acceptance, observed visits, unresolved outcomes, return trips, and supporting invoice evidence by provider." },
    { id: "lifecycle_review", title: "Equipment lifecycle review", description: "Store and asset outliers, repeat repairs, warranties, PM history, and source work orders." },
  ];
  return <><PageHead eyebrow={`Management records · ${scopeLabel}`} title="Explore live. Generate when it needs to be handed off." description="Each generated report preserves its operating scope, period, maintenance-cost basis, definitions, and source records."></PageHead><div className="to-store-grid">{templates.map((template) => <article className="to-card to-report-card" key={template.id}><header className="to-card-head"><div><h3>{template.title}</h3><p>{template.description}</p></div><FileText /></header><div className="to-card-body"><div className="to-tags"><span className="to-tag">{scopeLabel}</span><span className="to-tag">Recorded cost default</span><span className="to-tag">Source records included</span></div></div>{canGenerate ? <button className="to-card-action" type="button" onClick={() => onBuild(template.id)}>Configure and generate <ArrowRight /></button> : null}</article>)}</div>{savedReports.length ? <article className="to-panel to-saved-reports"><header className="to-panel-head"><div><h2>Generated management records</h2><p>Open a report to see its frozen definitions and exact sources.</p></div></header><div className="to-record-list">{savedReports.map((report) => <button className="to-record-row to-generated-report" type="button" key={report.id} onClick={() => onOpenReport(report.id)}><span className="to-exception-icon" data-tone="blue"><FileBarChart /></span><span className="to-record-primary"><strong>{report.title}</strong><span>{report.scopeLabel} · {report.periodLabel} · {words(report.costBasis)}</span></span><Badge value="completed" label={`Version ${report.version}`} /><ChevronRight /></button>)}</div></article> : null}</>;
}

function ReportDetail({ dataset, report, onBack, onOpenWork }: { dataset: DemoDataset; report: SavedReportRecord; onBack: () => void; onOpenWork: (id: string) => void }) {
  const selectedCost = report.sourceSnapshots.reduce((sum, source) => sum + source.amountMinor, 0);
  const currentWorkIds = new Set(dataset.workOrders.map((work) => work.id));
  return <>
    <section className="to-detail-hero">
      <div className="to-detail-copy">
        <button type="button" onClick={onBack}><ArrowLeft /> Back to reports</button>
        <p className="to-eyebrow">Generated management record · Version {report.version}</p>
        <h1>{report.title}</h1>
        <p>{report.scopeLabel} · {report.periodLabel}</p>
      </div>
      <div className="to-detail-summary">
        <div><span>Cost basis</span><strong>{words(report.costBasis)}</strong></div>
        <div><span>Frozen sources</span><strong>{report.sourceSnapshots.length}</strong></div>
        <div><span>Selected cost</span><strong>{money(selectedCost)}</strong></div>
        <div><span>Generated</span><strong>{dateLabel(report.createdAt)}</strong></div>
      </div>
    </section>
    <section className="to-grid equal">
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Frozen definitions</h2><p>This version does not silently change when live records change.</p></div></header>
        <div className="to-panel-body to-definition-list"><dl>
          <div><dt>Operating scope</dt><dd>{report.scopeLabel}</dd></div>
          <div><dt>Review period</dt><dd>{report.periodLabel}</dd></div>
          <div><dt>Maintenance-cost basis</dt><dd>{words(report.costBasis)}</dd></div>
          <div><dt>Product boundary</dt><dd>Operational maintenance record; accounting and payment remain in the customer&apos;s existing system.</dd></div>
        </dl></div>
      </article>
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Report purpose</h2><p>{report.template === "operating_review" ? "Operating visibility and exception management." : report.template === "vendor_accountability" ? "Vendor response, presence, outcomes, and supporting cost evidence." : "Repair history, lifecycle signals, warranties, and capital-review sources."}</p></div></header>
        <div className="to-panel-body"><p className="to-callout"><ShieldCheck /> Every amount and label below is the value captured when this report version was generated.</p></div>
      </article>
    </section>
    <article className="to-panel">
      <header className="to-panel-head"><div><h2>Frozen source work records</h2><p>Open a row when the live source still exists; the report values remain unchanged.</p></div><span className="to-filter-count">{report.sourceSnapshots.length} records</span></header>
      <div className="to-table-wrap"><table className="to-table">
        <thead><tr><th>Work order</th><th>Store</th><th>Status at generation</th><th>Service area</th><th>Selected cost</th></tr></thead>
        <tbody>{report.sourceSnapshots.map((source) => {
          const available = currentWorkIds.has(source.workOrderId);
          return <tr key={source.workOrderId} onClick={() => available ? onOpenWork(source.workOrderId) : undefined}>
            <td><strong>{source.number}</strong><small>{source.title}{available ? "" : " · source no longer in current scope"}</small></td>
            <td>#{source.storeNumber}<small>{source.storeCity}</small></td>
            <td><Badge value={source.status} /></td>
            <td>{source.categoryLabel}</td>
            <td className="to-money">{money(source.amountMinor)}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </article>
  </>;
}

export function LegacyReportDetail({ dataset, report, onBack, onOpenWork }: { dataset: DemoDataset; report: SavedReportRecord; onBack: () => void; onOpenWork: (id: string) => void }) {
  const sourceWork = report.sourceWorkOrderIds.map((id) => dataset.workOrders.find((work) => work.id === id)).filter((work): work is WorkOrder => Boolean(work));
  const linkedCost = sourceWork.reduce((sum, work) => {
    if (report.costBasis === "authorized") return sum + (work.notToExceedMinor ?? 0);
    if (report.costBasis === "invoice_linked") return sum + workOrderCost(dataset, work.id);
    const recorded = dataset.costLines.filter((line) => line.workOrderId === work.id && line.basis === "recorded").reduce((lineSum, line) => lineSum + line.amountMinor, 0);
    return sum + (recorded || workOrderCost(dataset, work.id));
  }, 0);
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to reports</button><p className="to-eyebrow">Generated management record · Version {report.version}</p><h1>{report.title}</h1><p>{report.scopeLabel} · {report.periodLabel}</p></div><div className="to-detail-summary"><div><span>Cost basis</span><strong>{words(report.costBasis)}</strong></div><div><span>Source work</span><strong>{sourceWork.length}</strong></div><div><span>Selected cost</span><strong>{money(linkedCost)}</strong></div><div><span>Generated</span><strong>{dateLabel(report.createdAt)}</strong></div></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Frozen definitions</h2><p>This version does not silently change when the live dashboard changes.</p></div></header><div className="to-panel-body to-definition-list"><dl><div><dt>Operating scope</dt><dd>{report.scopeLabel}</dd></div><div><dt>Review period</dt><dd>{report.periodLabel}</dd></div><div><dt>Maintenance-cost basis</dt><dd>{words(report.costBasis)}</dd></div><div><dt>Product boundary</dt><dd>Operational maintenance record; accounting and payment remain in the customer’s existing system.</dd></div></dl></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Report purpose</h2><p>{report.template === "operating_review" ? "Operating visibility and exception management." : report.template === "vendor_accountability" ? "Vendor response, presence, outcomes, and supporting cost evidence." : "Repair history, lifecycle signals, warranties, and capital-review sources."}</p></div></header><div className="to-panel-body"><p className="to-callout"><ShieldCheck /> Every metric below remains connected to the customer work order that produced it.</p></div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Source work records</h2><p>Open any row to verify the underlying work, visits, equipment, and cost.</p></div><span className="to-filter-count">{sourceWork.length} records</span></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Work order</th><th>Store</th><th>Status</th><th>Service area</th><th>Selected cost</th></tr></thead><tbody>{sourceWork.slice(0, 24).map((work) => { const store = dataset.stores.find((record) => record.id === work.storeId); const category = dataset.categories.find((record) => record.id === work.categoryId); const recorded = dataset.costLines.filter((line) => line.workOrderId === work.id && line.basis === "recorded").reduce((sum, line) => sum + line.amountMinor, 0); const amount = report.costBasis === "authorized" ? work.notToExceedMinor ?? 0 : report.costBasis === "invoice_linked" ? workOrderCost(dataset, work.id) : recorded || workOrderCost(dataset, work.id); return <tr key={work.id} onClick={() => onOpenWork(work.id)}><td><strong>{work.number}</strong><small>{work.title}</small></td><td>#{store?.storeNumber}<small>{store?.address.city}</small></td><td><Badge value={work.status} /></td><td>{category?.label ?? "Unclassified"}</td><td className="to-money">{money(amount)}</td></tr>; })}</tbody></table></div></article></>;
}

function DetailView({ dataset, detail, onBack, onVendorRespond, onIssue, onOpenWork, onOpenAsset, onOpenStore, onOpenVendor, onClassify, onAssignVendor, onOpenExternal, onStartVisit, onInternalUpdate, onRecordInvoice, onOpenSpend, onCreateWorkForStore, onConfigureStore, onAddAssetForStore, onAddComponent, onCreatePmForAsset, canClassify, canIssueVendorWork, canRecordVisits, canRecordInvoice, canSimulateVendorResponse, canManage }: { dataset: DemoDataset; detail: NonNullable<Detail>; onBack: () => void; onVendorRespond: (workOrderId: string, response: "accepted" | "declined" | "date_proposed") => void; onIssue: (workOrderId: string) => void; onOpenWork: (workOrderId: string) => void; onOpenAsset: (assetId: string) => void; onOpenStore: (storeId: string) => void; onOpenVendor: (vendorId: string) => void; onClassify: (workOrderId: string) => void; onAssignVendor: (workOrderId: string) => void; onOpenExternal: (workOrderId: string) => void; onStartVisit: (workOrderId: string) => void; onInternalUpdate: (workOrderId: string) => void; onRecordInvoice: (workOrderId: string) => void; onOpenSpend: (workOrderId: string) => void; onCreateWorkForStore: (storeId: string) => void; onConfigureStore: (storeId: string) => void; onAddAssetForStore: (storeId: string) => void; onAddComponent: (assetId: string) => void; onCreatePmForAsset: (assetId: string, storeId: string) => void; canClassify: boolean; canIssueVendorWork: boolean; canRecordVisits: boolean; canRecordInvoice: boolean; canSimulateVendorResponse: boolean; canManage: boolean }) {
  if (detail.kind === "store") { const store = dataset.stores.find((record) => record.id === detail.id); if (!store) return null; return <StoreDetail dataset={dataset} store={store} onBack={onBack} onOpenWork={onOpenWork} onOpenAsset={onOpenAsset} onCreateWork={onCreateWorkForStore} onConfigure={onConfigureStore} onAddAsset={onAddAssetForStore} canManage={canManage} />; }
  if (detail.kind === "vendor") { const vendor = dataset.vendors.find((record) => record.id === detail.id); if (!vendor) return null; return <VendorDetail dataset={dataset} vendor={vendor} onBack={onBack} onOpenWork={onOpenWork} />; }
  if (detail.kind === "asset") { const asset = dataset.assets.find((record) => record.id === detail.id); if (!asset) return null; return <AssetDetail dataset={dataset} asset={asset} onBack={onBack} onOpenWork={onOpenWork} onAddComponent={onAddComponent} onCreatePm={onCreatePmForAsset} canManage={canManage} />; }
  const work = dataset.workOrders.find((record) => record.id === detail.id);
  if (!work) return null;
  const assignment = dataset.assignments.find((record) => record.workOrderId === work.id && record.partyType === "vendor" && record.status !== "declined");
  const internalAssignment = dataset.assignments.find((record) => record.workOrderId === work.id && record.partyType === "team");
  const issuance = dataset.vendorIssuances.filter((record) => record.workOrderId === work.id).sort((left, right) => right.version - left.version)[0];
  const visitReady = Boolean(assignment && issuance && (
    issuance.acceptanceRequested === false ||
    issuance.response === "accepted" ||
    work.status === "accepted" ||
    work.status === "scheduled"
  ));
  const canAddInvoice = Boolean(assignment && canRecordInvoice && ["completed", "closed", "awaiting_invoice", "invoice_received"].includes(work.status) && !dataset.invoiceWorkLinks.some((link) => link.workOrderId === work.id));
  return <><div className="to-detail-tools">{!assignment && !internalAssignment && canIssueVendorWork ? <button className="to-button primary" type="button" onClick={() => onAssignVendor(work.id)}><Truck /> Choose outside vendor</button> : null}{internalAssignment && !terminalStatuses.has(work.status) ? <button className="to-button primary" type="button" onClick={() => onInternalUpdate(work.id)}><Wrench /> Update internal work</button> : null}{issuance ? <button className="to-button primary" type="button" onClick={() => onOpenExternal(work.id)}><FileText /> Open vendor work order</button> : null}{visitReady && canRecordVisits ? <button className="to-button" type="button" onClick={() => onStartVisit(work.id)}><MapPin /> Vendor sign in or out</button> : null}{canAddInvoice ? <button className="to-button primary" type="button" onClick={() => onRecordInvoice(work.id)}><ReceiptText /> Attach vendor invoice</button> : null}{canClassify ? <button className="to-button" type="button" onClick={() => onClassify(work.id)}><PackageSearch /> Update equipment classification</button> : null}<button className="to-button" type="button" onClick={() => onOpenStore(work.storeId)}><StoreIcon /> Store dashboard</button>{assignment ? <button className="to-button" type="button" onClick={() => onOpenVendor(assignment.partyId)}><Truck /> Vendor performance</button> : null}<button className="to-button" type="button" onClick={() => onOpenSpend(work.id)}><CircleDollarSign /> View maintenance costs</button></div><WorkDetail dataset={dataset} work={work} onBack={onBack} onVendorRespond={onVendorRespond} onIssue={onIssue} onOpenAsset={onOpenAsset} canIssueVendorWork={canIssueVendorWork} canSimulateVendorResponse={canSimulateVendorResponse} /></>;
}

function StoreDetail({ dataset, store, onBack, onOpenWork, onOpenAsset, onCreateWork, onConfigure, onAddAsset, canManage }: { dataset: DemoDataset; store: Store; onBack: () => void; onOpenWork: (id: string) => void; onOpenAsset: (id: string) => void; onCreateWork: (storeId: string) => void; onConfigure: (storeId: string) => void; onAddAsset: (storeId: string) => void; canManage: boolean }) {
  return <>
    <div className="to-detail-tools">
      <button className="to-button primary" type="button" onClick={() => onCreateWork(store.id)}><Plus /> Create work for this store</button>
      {canManage ? <button className="to-button" type="button" onClick={() => onConfigure(store.id)}><Settings2 /> Service areas</button> : null}
      {canManage ? <button className="to-button" type="button" onClick={() => onAddAsset(store.id)}><Gauge /> Add equipment</button> : null}
    </div>
    <StoreDetailRecord dataset={dataset} store={store} onBack={onBack} onOpenWork={onOpenWork} onOpenAsset={onOpenAsset} />
  </>;
}

function StoreDetailRecord({ dataset, store, onBack, onOpenWork, onOpenAsset }: { dataset: DemoDataset; store: Store; onBack: () => void; onOpenWork: (id: string) => void; onOpenAsset: (id: string) => void }) {
  const work = workForStore(dataset, store.id); const open = work.filter((record) => !terminalStatuses.has(record.status)); const spend = storeSpend(dataset, store.id); const assets = dataset.assets.filter((asset) => asset.storeId === store.id); const visits = dataset.visits.filter((visit) => visit.storeId === store.id); const exceptions = dataset.exceptions.filter((record) => record.storeId === store.id && record.status !== "resolved");
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to all stores</button><p className="to-eyebrow">{dataset.regions.find((region) => region.id === store.regionId)?.name}</p><h1>Store {store.storeNumber} · {store.name}</h1><p>{store.address.line1}, {store.address.city}, {store.address.state} {store.address.postalCode} · {store.phone}</p></div><div className="to-detail-summary"><div><span>Linked spend</span><strong>{money(spend)}</strong></div><div><span>Open work</span><strong>{open.length}</strong></div><div><span>Tracked assets</span><strong>{assets.length}</strong></div><div><span>Exceptions</span><strong>{exceptions.length}</strong></div></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Store attention</h2><p>Current work and accountable next actions</p></div></header><div className="to-exception-list">{open.slice(0, 6).map((record) => <button className="to-exception" type="button" key={record.id} onClick={() => onOpenWork(record.id)}><span className="to-exception-icon"><Wrench /></span><span className="to-record-primary"><strong>{record.number} · {record.title}</strong><span>{record.accountable?.nextAction}</span></span><span className="to-record-meta">{dateLabel(record.accountable?.dueAt)}</span><Badge value={record.status} /></button>)}</div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Visit history</h2><p>{visits.length} observed visits at this store</p></div></header><div className="to-panel-body"><div className="to-visit-list">{visits.slice(0, 6).map((visit) => { const vendor = dataset.vendors.find((record) => record.id === visit.vendorId); return <div className="to-visit" key={visit.id}><span className="to-avatar">{initials(visit.technicianName)}</span><span><strong>{visit.technicianName}</strong><span>{vendor?.displayName ?? "Internal"} · {visit.outcome ? words(visit.outcome) : "Active now"}</span></span><time>{dateLabel(visit.checkedInAt)}</time></div>; })}</div></div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Equipment and service structure</h2><p>Progressive depth—only the known assets are tracked.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Asset</th><th>Category</th><th>Location</th><th>Model / serial</th><th>Warranty</th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenAsset(asset.id)}><span><strong>{asset.assetCode}</strong><small>{asset.name}</small></span><ChevronRight /></button></td><td>{dataset.categories.find((category) => category.id === asset.categoryId)?.label}</td><td>{asset.locationDetail}</td><td>{asset.manufacturer} {asset.model}<small>{asset.serialNumber}</small></td><td>{asset.warranty ? dateLabel(asset.warranty.endsOn) : "Not recorded"}</td></tr>)}</tbody></table></div></article></>;
}

function AssetDetail({ dataset, asset, onBack, onOpenWork, onAddComponent, onCreatePm, canManage }: { dataset: DemoDataset; asset: Asset; onBack: () => void; onOpenWork: (id: string) => void; onAddComponent: (assetId: string) => void; onCreatePm: (assetId: string, storeId: string) => void; canManage: boolean }) {
  return <>
    {canManage ? <div className="to-detail-tools">
      <button className="to-button primary" type="button" onClick={() => onAddComponent(asset.id)}><Plus /> Add component</button>
      <button className="to-button" type="button" onClick={() => onCreatePm(asset.id, asset.storeId)}><CalendarCheck /> Create PM plan</button>
    </div> : null}
    <AssetDetailRecord dataset={dataset} asset={asset} onBack={onBack} onOpenWork={onOpenWork} />
  </>;
}

function AssetDetailRecord({ dataset, asset, onBack, onOpenWork }: { dataset: DemoDataset; asset: Asset; onBack: () => void; onOpenWork: (id: string) => void }) {
  const store = dataset.stores.find((record) => record.id === asset.storeId);
  const category = dataset.categories.find((record) => record.id === asset.categoryId);
  const taxonomyPath = asset.taxonomyPathIds
    .map((id) => dataset.taxonomyNodes.find((record) => record.id === id)?.label)
    .filter(Boolean)
    .join(" → ");
  const components = dataset.assetComponents.filter((record) => record.assetId === asset.id);
  const work = dataset.workOrders
    .filter((record) => record.assetId === asset.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const pmPlans = dataset.pmPlans.filter((record) => record.assetId === asset.id);
  const lifecycle = getAssetLifecycleDecisionFacts(dataset, dataset.organization.id, asset.id);
  const activity = lifecycle?.reactiveActivity.trailing12Months;
  const cost = lifecycle?.costs.trailing24Months;
  const recurrence = lifecycle?.confirmedComponentRecurrences.trailing12Months[0];
  const followUpCount = activity?.temporaryOrUnresolvedWorkOrderIds.length ?? 0;
  const pmWindow = lifecycle?.pm.trailing12Months;
  const recordedCostForWork = (workOrderId: string) => dataset.costLines
    .filter((line) => line.workOrderId === workOrderId && line.basis === "recorded")
    .reduce((sum, line) => sum + line.amountMinor, 0);

  return <>
    <section className="to-detail-hero">
      <div className="to-detail-copy">
        <button type="button" onClick={onBack}><ArrowLeft /> Back to Lifecycle &amp; CapEx</button>
        <p className="to-eyebrow">Store {store?.storeNumber} · {category?.label}</p>
        <h1>{asset.name}</h1>
        <p>{asset.assetCode} · {taxonomyPath} · {asset.locationDetail}</p>
      </div>
      <div className="to-detail-summary">
        <div><span>Completed-work cost</span><strong>{money(cost?.recordedMinor ?? 0)}</strong></div>
        <div><span>Replacement estimate</span><strong>{money(asset.replacementEstimateMinor)}</strong></div>
        <div><span>Equipment age</span><strong>{lifecycle?.assetAgeYears === undefined ? "Not entered" : `${lifecycle.assetAgeYears} years`}</strong></div>
        <div><span>Corrective work</span><strong>{activity?.distinctWorkOrderCount ?? 0}</strong></div>
      </div>
    </section>

    <section className="to-grid two">
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Equipment record</h2><p>Identity, location, supplier, and warranty</p></div><Badge value={asset.status} /></header>
        <div className="to-panel-body">
          <dl className="to-mini-dl">
            <div><dt>Manufacturer / model</dt><dd>{asset.manufacturer} {asset.model}</dd></div>
            <div><dt>Serial number</dt><dd>{asset.serialNumber}</dd></div>
            <div><dt>Installed</dt><dd>{dateLabel(asset.installedOn)}</dd></div>
            <div><dt>Entered typical life</dt><dd>{asset.expectedLifeYears} years{lifecycle?.expectedReplacementOn ? ` · date ${dateLabel(lifecycle.expectedReplacementOn)}` : ""}</dd></div>
            <div><dt>Criticality</dt><dd>{words(asset.criticality)}</dd></div>
            <div><dt>Warranty</dt><dd>{asset.warranty ? `${asset.warranty.provider} through ${dateLabel(asset.warranty.endsOn)} · ${asset.warranty.coverage}` : "No warranty entered"}</dd></div>
          </dl>
        </div>
      </article>

      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Repair or replace</h2><p>The facts are assembled here; the manager makes the decision.</p></div></header>
        <div className="to-panel-body">
          <dl className="to-mini-dl">
            <div><dt>Completed-work cost · 24 months</dt><dd>{money(cost?.recordedMinor ?? 0)}</dd></div>
            <div><dt>Current replacement estimate</dt><dd>{money(asset.replacementEstimateMinor)}</dd></div>
            <div><dt>Corrective activity · 12 months</dt><dd>{activity?.distinctWorkOrderCount ?? 0} work orders · {activity?.distinctVisitCount ?? 0} recorded visits</dd></div>
            <div><dt>Same-component history</dt><dd>{recurrence ? `${recurrence.componentName} appears on ${recurrence.distinctWorkOrderCount} completed work orders; no common cause is assumed.` : "No tracked component appears on multiple completed work orders."}</dd></div>
            <div><dt>Open follow-up context</dt><dd>{followUpCount ? `${followUpCount} recent ${followUpCount === 1 ? "work order has" : "work orders have"} a temporary, waiting-parts, or unresolved outcome.` : "No temporary, waiting-parts, or unresolved outcome in the last 12 months."}</dd></div>
            <div><dt>Preventive maintenance</dt><dd>{lifecycle?.pm.planCount ? `${pmWindow?.completedCount ?? 0} completed · ${pmWindow?.overdueCount ?? 0} overdue in the last 12 months` : "No equipment-specific PM plan entered"}</dd></div>
            {cost?.authorizedMinor ? <div><dt>Authorized amount · not actual cost</dt><dd>{money(cost.authorizedMinor)}</dd></div> : null}
          </dl>
          {cost?.needsReviewInvoiceMinor ? <details className="to-method"><summary>Optional invoice reconciliation</summary><p>{money(cost.needsReviewInvoiceMinor)} in manually entered invoice allocations still needs review. It is not included in the completed-work cost above and is not required for this lifecycle history.</p></details> : null}
          <p className="to-callout"><ShieldCheck /> Continue the repair, request another quote, or move the estimate into CapEx planning. TraceOps keeps the history visible without making the choice for you.</p>
        </div>
      </article>
    </section>

    <section className="to-grid equal">
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Components</h2><p>Optional depth for serviceable parts</p></div><span className="to-filter-count">{components.length} tracked</span></header>
        {components.length ? <div className="to-record-list">{components.map((component) => <div className="to-record-row to-component-row" key={component.id}><span className="to-exception-icon" data-tone="blue"><PackageSearch /></span><span className="to-record-primary"><strong>{component.name}</strong><span>{component.componentCode} · {component.componentType}{component.manufacturer ? ` · ${component.manufacturer}` : ""}</span></span><Badge value={component.status} /></div>)}</div> : <div className="to-panel-body"><div className="to-empty"><PackageSearch /><strong>No components entered</strong><p>The equipment history remains useful without component-level setup.</p></div></div>}
      </article>
      <article className="to-panel">
        <header className="to-panel-head"><div><h2>Preventive maintenance</h2><p>Plans use the same work and visit history.</p></div></header>
        <div className="to-panel-body">{pmPlans.length ? pmPlans.map((plan) => <dl className="to-mini-dl" key={plan.id}><div><dt>Plan</dt><dd>{plan.name}</dd></div><div><dt>Cadence</dt><dd>{words(plan.cadence)}</dd></div><div><dt>Next due</dt><dd>{dateLabel(plan.nextDueAt)}</dd></div><div><dt>Evidence</dt><dd>{plan.requiredEvidence.map(words).join(" · ")}</dd></div></dl>) : <div className="to-empty"><CalendarCheck /><strong>No equipment-specific PM plan</strong><p>Store- or service-area-level PM may still cover this equipment.</p></div>}</div>
      </article>
    </section>

    <article className="to-panel">
      <header className="to-panel-head"><div><h2>Service history</h2><p>Completed-work costs and visits stay useful without invoice entry.</p></div></header>
      <div className="to-table-wrap"><table className="to-table"><thead><tr><th>Customer WO</th><th>Date</th><th>Problem</th><th>Status</th><th>Visits</th><th>Completed-work cost</th></tr></thead><tbody>{work.map((record) => <tr key={record.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenWork(record.id)}><strong>{record.number}</strong><ChevronRight /></button></td><td>{dateLabel(record.createdAt)}</td><td>{record.title}</td><td><Badge value={record.status} /></td><td>{dataset.visits.filter((visit) => visit.workOrderId === record.id).length}</td><td className="to-money">{money(recordedCostForWork(record.id))}</td></tr>)}</tbody></table></div>
    </article>
  </>;
}

export function LegacyAssetDetailRecord({ dataset, asset, onBack, onOpenWork }: { dataset: DemoDataset; asset: Asset; onBack: () => void; onOpenWork: (id: string) => void }) {
  const store = dataset.stores.find((record) => record.id === asset.storeId);
  const category = dataset.categories.find((record) => record.id === asset.categoryId);
  const taxonomyPath = asset.taxonomyPathIds
    .map((id) => dataset.taxonomyNodes.find((record) => record.id === id)?.label)
    .filter(Boolean)
    .join(" → ");
  const components = dataset.assetComponents.filter((record) => record.assetId === asset.id);
  const work = dataset.workOrders
    .filter((record) => record.assetId === asset.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const workIds = new Set(work.map((record) => record.id));
  const visits = dataset.visits.filter((record) => record.workOrderId && workIds.has(record.workOrderId));
  const pmPlans = dataset.pmPlans.filter((record) => record.assetId === asset.id);
  const candidate = findLifecycleCandidates(dataset, dataset.organization.id, { assetId: asset.id })[0];
  const spend = dataset.invoiceWorkLinks
    .filter((record) => record.assetId === asset.id)
    .reduce((sum, record) => sum + record.attributedAmountMinor, 0);
  const age = Math.round(((Date.parse(dataset.asOf) - Date.parse(asset.installedOn)) / (365.25 * 86400000)) * 10) / 10;
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to equipment</button><p className="to-eyebrow">Store {store?.storeNumber} · {category?.label}</p><h1>{asset.name}</h1><p>{asset.assetCode} · {taxonomyPath} · {asset.locationDetail}</p></div><div className="to-detail-summary"><div><span>Linked repair spend</span><strong>{money(spend)}</strong></div><div><span>Replacement estimate</span><strong>{money(asset.replacementEstimateMinor)}</strong></div><div><span>Age</span><strong>{age} years</strong></div><div><span>Observed visits</span><strong>{visits.length}</strong></div></div></section><section className="to-grid two"><article className="to-panel"><header className="to-panel-head"><div><h2>Equipment record</h2><p>Identity, location, supplier, and warranty context</p></div><Badge value={asset.status} /></header><div className="to-panel-body"><dl className="to-mini-dl"><div><dt>Manufacturer / model</dt><dd>{asset.manufacturer} {asset.model}</dd></div><div><dt>Serial number</dt><dd>{asset.serialNumber}</dd></div><div><dt>Installed</dt><dd>{dateLabel(asset.installedOn)} · expected life {asset.expectedLifeYears} years</dd></div><div><dt>Criticality</dt><dd>{words(asset.criticality)}</dd></div><div><dt>Warranty</dt><dd>{asset.warranty ? `${asset.warranty.provider} through ${dateLabel(asset.warranty.endsOn)} · ${asset.warranty.coverage}` : "No warranty recorded"}</dd></div></dl></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Lifecycle review</h2><p>Transparent rules, not an opaque health score</p></div>{candidate ? <Badge value="warning" label="Capital review" /> : <Badge value="active" label="Monitor" />}</header><div className="to-panel-body">{candidate ? <><div className="to-lifecycle-metric"><strong>{candidate.repairToReplacementPercentage}%</strong><span>documented repair spend versus replacement estimate</span></div><ul className="to-reason-list">{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><details className="to-method"><summary>Why this record qualifies</summary><ul>{candidate.thresholds.map((threshold) => <li key={threshold}>{threshold}</li>)}</ul></details><p className="to-callout"><ShieldCheck /> Capital review is recommended. TraceOps does not automatically claim this asset must be replaced.</p></> : <div className="to-empty"><ShieldCheck /><strong>No capital-review rule is triggered</strong><p>Cost, repeat work, and service-life thresholds remain visible and source-linked.</p></div>}</div></article></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Components</h2><p>Optional depth for serviceable parts</p></div><span className="to-filter-count">{components.length} tracked</span></header><div className="to-record-list">{components.map((component) => <div className="to-record-row to-component-row" key={component.id}><span className="to-exception-icon" data-tone="blue"><PackageSearch /></span><span className="to-record-primary"><strong>{component.name}</strong><span>{component.componentCode} · {component.componentType}{component.manufacturer ? ` · ${component.manufacturer}` : ""}</span></span><Badge value={component.status} /></div>)}</div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Preventive maintenance</h2><p>The same work, visit, and evidence chain</p></div></header><div className="to-panel-body">{pmPlans.length ? pmPlans.map((plan) => <dl className="to-mini-dl" key={plan.id}><div><dt>Plan</dt><dd>{plan.name}</dd></div><div><dt>Cadence</dt><dd>{words(plan.cadence)}</dd></div><div><dt>Next due</dt><dd>{dateLabel(plan.nextDueAt)}</dd></div><div><dt>Evidence</dt><dd>{plan.requiredEvidence.map(words).join(" · ")}</dd></div></dl>) : <div className="to-empty"><CalendarCheck /><strong>No asset-specific PM plan</strong><p>Category or store-level PM may still cover this equipment.</p></div>}</div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Service history</h2><p>Open any customer work order to see visits, invoice references, and audit events.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Customer WO</th><th>Date</th><th>Problem</th><th>Status</th><th>Visits</th><th>Linked cost</th></tr></thead><tbody>{work.map((record) => <tr key={record.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenWork(record.id)}><strong>{record.number}</strong><ChevronRight /></button></td><td>{dateLabel(record.createdAt)}</td><td>{record.title}</td><td><Badge value={record.status} /></td><td>{dataset.visits.filter((visit) => visit.workOrderId === record.id).length}</td><td className="to-money">{money(workOrderCost(dataset, record.id))}</td></tr>)}</tbody></table></div></article></>;
}

function WorkDetail({ dataset, work, onBack, onVendorRespond, onIssue, onOpenAsset, canIssueVendorWork, canSimulateVendorResponse }: { dataset: DemoDataset; work: WorkOrder; onBack: () => void; onVendorRespond: (id: string, response: "accepted" | "declined" | "date_proposed") => void; onIssue: (id: string) => void; onOpenAsset: (id: string) => void; canIssueVendorWork: boolean; canSimulateVendorResponse: boolean }) {
  const store = dataset.stores.find((record) => record.id === work.storeId); const assignment = dataset.assignments.find((record) => record.workOrderId === work.id); const vendor = assignment?.partyType === "vendor" ? dataset.vendors.find((record) => record.id === assignment.partyId) : undefined; const issuance = dataset.vendorIssuances.filter((record) => record.workOrderId === work.id).sort((left, right) => right.version - left.version)[0]; const visits = dataset.visits.filter((record) => record.workOrderId === work.id); const invoiceLinks = dataset.invoiceWorkLinks.filter((record) => record.workOrderId === work.id); const invoices = invoiceLinks.map((link) => dataset.invoices.find((record) => record.id === link.invoiceId)).filter(Boolean); const events = dataset.auditEvents.filter((event) => event.entityId === work.id || event.payloadSnapshot.workOrderId === work.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to work orders</button><p className="to-eyebrow">{work.number}</p><h1>{work.title}</h1><p>Store {store?.storeNumber} · {work.problemDescription}</p></div><div className="to-detail-summary"><div><span>Status</span><strong>{words(work.status)}</strong></div><div><span>Handler</span><strong>{vendor?.displayName ?? words(work.fulfillmentMode)}</strong></div><div><span>NTE</span><strong>{work.notToExceedMinor ? money(work.notToExceedMinor) : "Not used"}</strong></div><div><span>Linked cost</span><strong>{money(workOrderCost(dataset, work.id))}</strong></div></div></section><section className="to-grid two"><article className="to-panel"><header className="to-panel-head"><div><h2>Customer work order</h2><p>Operator source record and vendor billing reference</p></div><Badge value={work.status} /></header><div className="to-panel-body to-definition-list"><dl><div><dt>Store</dt><dd>#{store?.storeNumber} · {store?.normalizedAddress}</dd></div><div><dt>Requested work</dt><dd>{work.scopeOfWork}</dd></div><div><dt>Priority</dt><dd>{words(work.priority)}</dd></div><div><dt>Requested window</dt><dd>{dateLabel(work.requestedWindow.startsAt)} – {dateLabel(work.requestedWindow.endsAt)}</dd></div><div><dt>Classification</dt><dd>{work.classificationDeferred ? "Store-level now · equipment can be added later" : dataset.categories.find((category) => category.id === work.categoryId)?.label}{work.assetId ? <button className="to-link-button" type="button" onClick={() => onOpenAsset(work.assetId!)}>View linked asset <ChevronRight /></button> : null}</dd></div><div><dt>Next accountable action</dt><dd>{work.accountable?.nextAction ?? "Review and close"}</dd></div></dl></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Vendor issuance</h2><p>Versioned authorization sent outside the company</p></div>{issuance ? <Badge value={issuance.response ?? issuance.deliveryStatus} /> : <Badge value="ready_to_issue" />}</header><div className="to-panel-body">{vendor ? <><div className="to-vendor-summary"><span className="to-avatar">{initials(vendor.displayName)}</span><div><strong>{vendor.displayName}</strong><span>{vendor.specialties.map((specialty) => specialty.label).join(" · ")}</span></div></div>{issuance ? <dl className="to-mini-dl"><div><dt>Issued</dt><dd>{dateLabel(issuance.issuedAt)} · Version {issuance.version}</dd></div><div><dt>Delivery</dt><dd>{words(issuance.deliveryStatus)} by {issuance.channels.join(" + ")}</dd></div><div><dt>Vendor ticket</dt><dd>{issuance.vendorReference ?? "Not provided"}</dd></div><div><dt>Invoice instruction</dt><dd>{issuance.customerBillingInstruction}</dd></div></dl> : <><p className="to-callout">Vendor selected, but the customer work order has not been sent.</p>{canIssueVendorWork ? <button className="to-button primary to-full" type="button" onClick={() => onIssue(work.id)}><ArrowRight /> Review and send authorization</button> : <p className="to-permission-note"><ShieldCheck /> Read-only role · authorization controls are hidden.</p>}</>}{issuance && !issuance.response && issuance.acceptanceRequested !== false && canSimulateVendorResponse ? <div className="to-response-actions"><button className="to-button primary" type="button" onClick={() => onVendorRespond(work.id, "accepted")}><CheckCircle2 /> Accept</button><button className="to-button" type="button" onClick={() => onVendorRespond(work.id, "date_proposed")}><CalendarCheck /> Propose date</button><button className="to-button ghost" type="button" onClick={() => onVendorRespond(work.id, "declined")}>Decline</button></div> : null}</> : <div className="to-empty"><Users /><strong>{work.fulfillmentMode === "unassigned" ? "Handler not chosen" : "Internal work"}</strong><p>{work.accountable?.nextAction}</p></div>}</div></article></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Visit evidence</h2><p>Approximate presence context—not certified labor.</p></div></header><div className="to-panel-body"><div className="to-visit-list">{visits.length ? visits.map((visit) => <div className="to-visit" key={visit.id}><span className="to-avatar">{initials(visit.technicianName)}</span><span><strong>{visit.technicianName}</strong><span>{words(visit.evidenceStrength)} · {visit.outcome ? words(visit.outcome) : "Onsite now"}</span></span><time>{timeLabel(visit.checkedInAt)}–{visit.checkedOutAt ? timeLabel(visit.checkedOutAt) : "now"}</time></div>) : <div className="to-empty"><MapPin /><strong>No recorded visits</strong><p>A QR, secure-link, or kiosk check-in will appear here.</p></div>}</div></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Invoice and cost</h2><p>References remain separate and auditable.</p></div></header><div className="to-panel-body">{invoices.length ? invoices.map((invoice) => invoice ? <dl className="to-mini-dl" key={invoice.id}><div><dt>Vendor invoice</dt><dd>{invoice.invoiceNumber}</dd></div><div><dt>Customer WO reference</dt><dd>{invoice.customerWorkOrderReferences.join(", ") || "Missing"}</dd></div><div><dt>Amount</dt><dd>{money(invoiceTotal(dataset, invoice.id))}</dd></div><div><dt>Review state</dt><dd><Badge value={invoice.status} /></dd></div></dl> : null) : <div className="to-empty"><ReceiptText /><strong>No invoice linked yet</strong><p>The work order remains valid even when the customer does not use invoice safeguards.</p></div>}</div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Permanent timeline</h2><p>Original events and later corrections remain visible.</p></div></header><div className="to-timeline">{events.slice(0, 10).map((event) => <div key={event.id}><i /><span><strong>{event.summary}</strong><small>{dateLabel(event.occurredAt)} · {words(event.channel)}</small></span></div>)}</div></article></>;
}

function VendorDetail({ dataset, vendor, onBack, onOpenWork }: { dataset: DemoDataset; vendor: Vendor; onBack: () => void; onOpenWork: (id: string) => void }) {
  const assignmentIds = dataset.assignments.filter((record) => record.partyType === "vendor" && record.partyId === vendor.id).map((record) => record.workOrderId); const work = dataset.workOrders.filter((record) => assignmentIds.includes(record.id)); const visits = dataset.visits.filter((record) => record.vendorId === vendor.id); const accepted = dataset.vendorIssuances.filter((record) => record.vendorId === vendor.id && record.response === "accepted").length; const issued = dataset.vendorIssuances.filter((record) => record.vendorId === vendor.id).length;
  return <><section className="to-detail-hero"><div className="to-detail-copy"><button type="button" onClick={onBack}><ArrowLeft /> Back to vendors</button><p className="to-eyebrow">Approved vendor · {vendor.customerVendorNumber}</p><h1>{vendor.displayName}</h1><p>{vendor.description}</p></div><div className="to-detail-summary"><div><span>Linked spend</span><strong>{money(vendorSpend(dataset, vendor.id))}</strong></div><div><span>Active work</span><strong>{work.filter((record) => !terminalStatuses.has(record.status)).length}</strong></div><div><span>Observed visits</span><strong>{visits.length}</strong></div><div><span>Digital acceptance</span><strong>{issued ? Math.round((accepted / issued) * 100) : 0}%</strong></div></div></section><section className="to-grid equal"><article className="to-panel"><header className="to-panel-head"><div><h2>Capabilities and coverage</h2><p>Searchable organization-owned vendor record</p></div><Badge value={vendor.status} /></header><div className="to-panel-body"><div className="to-tags">{vendor.specialties.flatMap((specialty) => [specialty.label, ...specialty.aliases.slice(0, 2)]).map((label) => <span className="to-tag" key={label}>{label}</span>)}</div><dl className="to-mini-dl"><div><dt>Regions</dt><dd>{vendor.coverageRegionIds.map((id) => dataset.regions.find((region) => region.id === id)?.name).join(", ")}</dd></div><div><dt>After-hours</dt><dd>{vendor.afterHoursAvailable ? "Available" : "Standard dispatch only"}</dd></div><div><dt>Insurance through</dt><dd>{dateLabel(vendor.insuranceExpiresOn)}</dd></div><div><dt>Portal</dt><dd>{vendor.portalEnabled ? "Optional account enabled" : "Secure links only"}</dd></div></dl></div></article><article className="to-panel"><header className="to-panel-head"><div><h2>Contacts</h2><p>Dispatch and billing remain separate.</p></div></header><div className="to-record-list">{vendor.contacts.map((contact) => <div className="to-record-row to-contact-row" key={contact.id}><span className="to-avatar">{initials(contact.name)}</span><span className="to-record-primary"><strong>{contact.name} · {words(contact.role)}</strong><span>{contact.email} · {contact.phone}</span></span><Badge value={contact.preferredChannel} label={words(contact.preferredChannel)} /></div>)}</div></article></section><article className="to-panel"><header className="to-panel-head"><div><h2>Customer work issued to this vendor</h2><p>The vendor can keep using its own dispatch system.</p></div></header><div className="to-table-wrap"><table className="to-table"><thead><tr><th>Customer WO</th><th>Store</th><th>Problem</th><th>Vendor response</th><th>Linked cost</th></tr></thead><tbody>{work.map((record) => { const store = dataset.stores.find((entry) => entry.id === record.storeId); const issuance = dataset.vendorIssuances.find((entry) => entry.workOrderId === record.id); return <tr key={record.id}><td><button className="to-link-button to-cell-link" type="button" onClick={() => onOpenWork(record.id)}><strong>{record.number}</strong><ChevronRight /></button></td><td>#{store?.storeNumber}</td><td>{record.title}</td><td><Badge value={issuance?.response ?? issuance?.deliveryStatus ?? "ready_to_issue"} /></td><td className="to-money">{money(workOrderCost(dataset, record.id))}</td></tr>; })}</tbody></table></div></article></>;
}

function CapabilitySettings({ value, onChange }: { value: CapabilityConfig; onChange: (value: CapabilityConfig) => void }) {
  const options: Array<{ key: keyof CapabilityConfig; title: string; description: string }> = [
    { key: "vendorAcceptance", title: "Vendor response link", description: "Ask vendors to accept, decline, or propose a date. Turn it off when email issuance alone is enough." },
    { key: "locationEvidence", title: "Visit location evidence", description: "Use event-based location for QR/app activity while allowing the trusted store computer path." },
    { key: "invoiceSafeguard", title: "Optional invoice safeguard", description: "Manually add an invoice when useful and compare it with the work order, NTE limit, visits, and evidence. No other workflow depends on it." },
    { key: "preventiveMaintenance", title: "Preventive maintenance", description: "Expose plans, due occurrences, vendor issuance, evidence, and compliance reporting." },
    { key: "equipmentLifecycle", title: "Equipment lifecycle and CapEx", description: "Track assets, components, warranties, completed-work history, and an editable capital plan without requiring invoice entry." },
  ];
  return <div className="to-settings"><div className="to-callout"><Settings2 /><span><strong>One product, flexible adoption</strong><small>These are capability switches—not separate products or duplicate data models.</small></span></div><div className="to-setting-list">{options.map((option) => { const inputId = `capability-${option.key}`; return <label key={option.key} htmlFor={inputId}><span><strong>{option.title}</strong><small>{option.description}</small></span><input id={inputId} aria-label={option.title} type="checkbox" checked={value[option.key]} onChange={(event) => onChange({ ...value, [option.key]: event.target.checked })} /><i aria-hidden="true" /></label>; })}</div><p className="to-setting-foot">Demo changes are session-scoped. Existing records remain valid when a capability is hidden.</p></div>;
}

function StorePortal({ dataset, storeId, onWork, onVisit, onOpenIssues }: { dataset: DemoDataset; storeId: string; onWork: (storeId: string) => void; onVisit: (storeId: string) => void; onOpenIssues: () => void }) {
  const store = dataset.stores.find((record) => record.id === storeId) ?? dataset.stores[0];
  if (!store) return null;
  const openWork = dataset.workOrders.filter((record) => record.storeId === store.id && !terminalStatuses.has(record.status));
  const pendingRequests = dataset.requests.filter((record) => record.storeId === store.id && record.reviewStatus === "new");
  const openCount = openWork.length + pendingRequests.length;
  return <div className="to-storefront"><header><span className="to-demo-pill">Store device demo</span><p>Store {store.storeNumber}</p><h3>What do you need?</h3><span>{store.address.line1}, {store.address.city}</span></header><div className="to-storefront-actions"><button type="button" onClick={() => onWork(store.id)}><span><AlertTriangle /></span><strong>Report an issue</strong><small>Tell us what you see. No equipment knowledge required.</small><ChevronRight /></button><button type="button" onClick={() => onVisit(store.id)}><span><MapPin /></span><strong>Vendor sign in or out</strong><small>Technician self-service from this store computer.</small><ChevronRight /></button><button type="button" onClick={onOpenIssues}><span><ClipboardList /></span><strong>View open store issues</strong><small>{openCount} current {openCount === 1 ? "item" : "items"} at this store.</small><ChevronRight /></button></div></div>;
}

function VisitDemo({ dataset, activeVisits, fixedStoreId, fixedVendorId, fixedWorkOrderId, requireLocationEvidence, onCheckIn, onCheckOut }: { dataset: DemoDataset; activeVisits: Visit[]; fixedStoreId?: string; fixedVendorId?: string; fixedWorkOrderId?: string; requireLocationEvidence: boolean; onCheckIn: (value: VisitCheckInValue) => ActiveVisit | void; onCheckOut: (value: VisitCheckOutValue) => void }) {
  const [storeId, setStoreId] = useState(fixedStoreId ?? dataset.stores[0]?.id ?? "");
  const [vendorId, setVendorId] = useState(fixedVendorId ?? dataset.vendors[0]?.id ?? "");
  const [channel, setChannel] = useState<WorkflowVisitChannel>(fixedStoreId ? "store_kiosk" : "qr");
  const [evidenceState, setEvidenceState] = useState<VisitEvidence["state"]>(fixedStoreId ? "store_kiosk_recorded" : "location_verified");
  const [activeVisitId, setActiveVisitId] = useState("new");
  const selectedActive = activeVisits.find((record) => record.id === activeVisitId);
  const activeVendor = selectedActive?.vendorId ? dataset.vendors.find((record) => record.id === selectedActive.vendorId) : undefined;
  const selectedStoreId = selectedActive?.storeId ?? fixedStoreId ?? storeId;
  const selectedVendorId = activeVendor?.id ?? fixedVendorId ?? vendorId;
  const store = dataset.stores.find((record) => record.id === selectedStoreId) ?? dataset.stores[0];
  const vendor = dataset.vendors.find((record) => record.id === selectedVendorId) ?? dataset.vendors[0];
  if (!store || !vendor) return null;

  const activeChannel: WorkflowVisitChannel = selectedActive
    ? selectedActive.channelStarted === "vendor_app"
      ? "app"
      : selectedActive.channelStarted === "store_kiosk"
        ? "store_kiosk"
        : selectedActive.channelStarted === "secure_work_link"
          ? "secure_link"
          : "qr"
    : channel;
  const effectiveChannel = selectedActive ? channel : activeChannel;
  const evidence: VisitEvidence = selectedActive
    ? selectedActive.evidenceStrength === "location_verified"
      ? { state: "location_verified", capturedAt: selectedActive.locationEvidence.capturedAt, accuracyMeters: selectedActive.locationEvidence.accuracyMeters, distanceMeters: selectedActive.locationEvidence.distanceFromStoreMeters }
      : selectedActive.evidenceStrength === "store_kiosk"
        ? { state: "store_kiosk_recorded", capturedAt: selectedActive.checkedInAt }
        : selectedActive.locationEvidence.verification === "outside_geofence"
          ? { state: "outside_geofence", capturedAt: selectedActive.locationEvidence.capturedAt, distanceMeters: selectedActive.locationEvidence.distanceFromStoreMeters }
          : { state: "manual_exception", capturedAt: selectedActive.checkedInAt }
    : effectiveChannel === "store_kiosk"
      ? { state: "store_kiosk_recorded", capturedAt: new Date().toISOString() }
      : { state: evidenceState, capturedAt: new Date().toISOString(), accuracyMeters: evidenceState === "location_verified" ? 18 : 80, distanceMeters: evidenceState === "location_verified" ? 24 : evidenceState === "outside_geofence" ? 1840 : undefined, note: evidenceState === "location_not_shared" ? "The browser permission was denied in this visible Demo Mode scenario." : undefined };
  const initialActiveVisit: ActiveVisit | undefined = selectedActive
    ? {
        id: selectedActive.id,
        storeId: selectedActive.storeId,
        technicianName: selectedActive.technicianName,
        vendorName: activeVendor?.displayName ?? "Outside vendor",
        workOrderId: selectedActive.workOrderId,
        noWorkOrderReason: selectedActive.purposeWhenUnmatched,
        channel: activeChannel,
        evidence,
        startedAt: selectedActive.checkedInAt,
      }
    : undefined;
  const workOrders = dataset.workOrders
    .filter((work) => work.storeId === store.id && dataset.assignments.some((assignment) => assignment.workOrderId === work.id && assignment.partyType === "vendor" && assignment.partyId === vendor.id && assignment.status !== "declined"))
    .map((work) => ({ id: work.id, number: work.number, title: work.title, storeId: work.storeId, assetLabel: work.assetId ? dataset.assets.find((asset) => asset.id === work.assetId)?.name : undefined, requestedService: work.scopeOfWork }));

  return <div className="to-visit-wrapper"><div className="to-callout"><MapPin /><span><strong>Evidence is event-based, not continuous tracking</strong><small>Demo Mode can show verified, outside-boundary, denied-permission, and trusted store-kiosk records.</small></span></div>{activeVisits.length ? <div className="to-field"><label htmlFor="active-visit">Start or end a visit</label><select id="active-visit" value={activeVisitId} onChange={(event) => setActiveVisitId(event.target.value)}><option value="new">Start a new visit</option>{activeVisits.map((visit) => { const activeStore = dataset.stores.find((record) => record.id === visit.storeId); return <option key={visit.id} value={visit.id}>Check out {visit.technicianName} · Store {activeStore?.storeNumber}</option>; })}</select></div> : null}<div className="to-visit-context"><div className="to-field"><label htmlFor="visit-channel">This event is using</label><select id="visit-channel" value={effectiveChannel} onChange={(event) => { const next = event.target.value as WorkflowVisitChannel; setChannel(next); if (next === "store_kiosk") setEvidenceState("store_kiosk_recorded"); else if (evidenceState === "store_kiosk_recorded") setEvidenceState("location_verified"); }}><option value="qr">Store QR link</option><option value="app">Vendor app</option><option value="store_kiosk">Store computer</option><option value="secure_link">Secure work-order link</option></select></div><div className="to-field"><label htmlFor="visit-store-context">Store</label><select id="visit-store-context" value={store.id} disabled={Boolean(fixedStoreId || selectedActive)} onChange={(event) => setStoreId(event.target.value)}>{dataset.stores.map((record) => <option key={record.id} value={record.id}>Store {record.storeNumber} · {record.address.city}</option>)}</select></div><div className="to-field"><label htmlFor="visit-vendor-context">Vendor</label><select id="visit-vendor-context" value={vendor.id} disabled={Boolean(selectedActive || fixedVendorId)} onChange={(event) => setVendorId(event.target.value)}>{dataset.vendors.map((record) => <option key={record.id} value={record.id}>{record.displayName}</option>)}</select></div>{effectiveChannel !== "store_kiosk" ? <div className="to-field"><label htmlFor="visit-evidence">Demo evidence result</label><select id="visit-evidence" value={evidenceState} onChange={(event) => setEvidenceState(event.target.value as VisitEvidence["state"])}><option value="location_verified">Inside store boundary</option><option value="outside_geofence">Outside store boundary</option><option value="location_not_shared">Permission denied</option><option value="manual_exception">Inaccurate / manual exception</option></select></div> : null}</div><TechnicianVisitFlow key={`${activeVisitId}-${store.id}-${vendor.id}-${effectiveChannel}-${evidence.state}`} store={{ id: store.id, storeNumber: store.storeNumber, name: store.name, address: store.normalizedAddress, regionName: dataset.regions.find((record) => record.id === store.regionId)?.name }} vendorName={vendor.displayName} workOrders={workOrders} channel={effectiveChannel} evidence={evidence} initialActiveVisit={initialActiveVisit} defaultWorkOrderId={fixedWorkOrderId} requireVerifiedEvidence={requireLocationEvidence && effectiveChannel !== "store_kiosk"} onCheckIn={onCheckIn} onCheckOut={onCheckOut} /></div>;
}
