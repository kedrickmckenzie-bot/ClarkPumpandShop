import "server-only";

import type {
  ActionItemViewModel,
  ApprovalDecisionViewModel,
  AttentionItemControlViewModel,
  BreakdownViewModel,
  CreateRequestPageViewModel,
  CreateStorePageViewModel,
  CreateVendorPageViewModel,
  CreateWorkOrderPageViewModel,
  DashboardPageViewModel,
  DetailPageViewModel,
  DetailFactViewModel,
  DetailSectionViewModel,
  EstimateComparisonViewModel,
  ListPageViewModel,
  MetricViewModel,
  OperatorSession,
  PaginationViewModel,
  ProgramPageViewModel,
  SearchPageViewModel,
  TableColumnViewModel,
  TableRowViewModel,
  TimelineEventViewModel,
  Tone,
  TrendViewModel,
  VendorIssuanceViewModel,
  RequestReviewViewModel,
  WorkOrderControlViewModel,
  WorkOrderRecordingViewModel,
} from "@/components/ops/data-contract";
import type {
  VendorAccountabilityEvidenceRow,
  VendorAuthorizationEvidenceRow,
  VendorCostEvidenceRow,
  VendorComplianceEvidenceRow,
  VendorCoverageEvidenceRow,
  VendorPerformanceDetailViewModel,
  VendorPerformanceListViewModel,
  VendorPerformanceSummary,
  VendorQualificationEvidenceRow,
  VendorRepeatVisitEvidenceRow,
  VendorVisitEvidenceRow,
} from "@/components/ops/vendor-performance-contract";
import { roleCan, roleCanAccessProgramRoute, roleCanOpenOperatorHref } from "@/components/ops/role-policy";
import type {
  ApprovalRequiredRole,
  Asset,
  ExceptionKind,
  OpsFixture,
  PmOccurrence,
  RequestImpactAssessment,
  Store,
  VisitSession,
  WorkOrder,
} from "@/lib/ops/types";
import {
  allowedWorkOrderControlTransitions,
  canRouteAndIssueWorkOrder,
} from "@/lib/ops/commands";
import { approvalRequestState } from "@/lib/ops/approval-governance";
import { buildWorkflowTaskWorkspaceModel } from "./workflow-task-presenter";
import { buildApprovedWorkPortfolio } from "./approved-work-presenter";
import { NORTHLINE_DEMO_ENTRY_TOKENS, NORTHLINE_DEMO_HANDLES } from "@/lib/ops/fixtures";
import {
  calculateRepairReplacementScreening,
  type RepairReplacementScreening,
} from "@/lib/ops/lifecycle-analytics";
import { resolveLifecycleDecisionState } from "@/lib/ops/lifecycle-decision-state";
import { resolveAssetReplacementEstimate } from "@/lib/ops/replacement-intelligence";
import { reportCatalog } from "@/lib/ops/report-catalog";
import { domainLabel } from "@/lib/product/domain-label";
import {
  DEFAULT_OPERATIONS_TIME_ZONE,
  formatOperationsDate,
  formatOperationsDateTime,
} from "@/lib/ops/local-time";

export type OperatorListRoute =
  | "action-center"
  | "requests"
  | "work-orders"
  | "estimates"
  | "visits"
  | "stores"
  | "vendors"
  | "invoices"
  | "reports"
  | "admin";
export type OperatorProgramRoute = "spend" | "equipment" | "pm" | "lifecycle";
export type OperatorDetailRoute = "request" | "work-order" | "visit" | "store" | "vendor" | "equipment" | "invoice";
export type OperatorSearchParameters = Record<string, string | string[] | undefined>;

interface ScopedFixture {
  organizationId: string;
  includeCompanywide: boolean;
  stores: Store[];
  storeIds: Set<string>;
  workOrders: WorkOrder[];
  visits: VisitSession[];
  assets: Asset[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const unresolvedOutcomesForPresentation = new Set<NonNullable<VisitSession["outcome"]>>([
  "temporary_repair",
  "diagnosed_waiting_parts",
  "return_required",
  "unable_to_complete",
  "unable_to_reproduce",
]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function cleanSearch(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

function money(amountMinor: number): string {
  return currencyFormatter.format(amountMinor / 100);
}

function visitsForWorkOrder(fixture: OpsFixture, scoped: ScopedFixture, workOrderId: string): VisitSession[] {
  const linkedVisitIds = new Set(
    fixture.siteVisitWorkOrders
      .filter((link) => link.organizationId === scoped.organizationId && link.workOrderId === workOrderId)
      .map((link) => link.visitId),
  );
  return scoped.visits
    .filter((visit) => visit.workOrderId === workOrderId || linkedVisitIds.has(visit.id))
    .sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt));
}

function workOrderVisitRows(visits: VisitSession[], timeZone: string, sourceVisitId?: string): TableRowViewModel[] {
  return visits.map((visit) => ({
    id: visit.id,
    label: `${visit.technicianName} service visit`,
    href: `/app/visits/${visit.id}`,
    cells: [
      {
        key: "visit",
        value: dateTime(visit.checkedInAt, timeZone),
        secondary: visit.id === sourceVisitId ? "Created this follow-up" : "Recorded check-in",
      },
      { key: "provider", value: visit.technicianName, secondary: visit.providerName },
      {
        key: "checkout",
        value: visit.checkedOutAt ? dateTime(visit.checkedOutAt, timeZone) : "Still onsite",
        secondary: visit.checkedOutAt ? "Recorded checkout" : "No checkout yet",
      },
      {
        key: "outcome",
        value: visit.outcome ? sentence(visit.outcome) : "Not recorded",
        secondary: visit.outcomeNotes?.trim() || "No checkout note recorded",
      },
    ],
  }));
}

function workOrderNoteHistory(
  fixture: OpsFixture,
  organizationId: string,
  workOrderId: string,
  visits: VisitSession[],
  timeZone: string,
): TimelineEventViewModel[] {
  const membershipById = new Map(
    fixture.memberships
      .filter((membership) => membership.organizationId === organizationId)
      .map((membership) => [membership.id, membership]),
  );
  const userById = new Map(fixture.users.map((user) => [user.id, user]));
  const memberName = (membershipId: string | undefined) => {
    const membership = membershipId ? membershipById.get(membershipId) : undefined;
    return membership ? userById.get(membership.userId)?.displayName ?? "Customer team" : "Customer team";
  };
  const notes: Array<{ sortAt: string; event: TimelineEventViewModel }> = [];

  for (const visit of visits) {
    if (!visit.outcomeNotes?.trim()) continue;
    const recordedAt = visit.checkedOutAt ?? visit.checkedInAt;
    notes.push({
      sortAt: recordedAt,
      event: {
        id: `visit-note-${visit.id}`,
        title: "Technician checkout note",
        description: visit.outcomeNotes.trim(),
        timestampLabel: dateTime(recordedAt, timeZone),
        actorLabel: `${visit.technicianName} · ${visit.providerName}`,
        tone: visit.outcome && unresolvedOutcomesForPresentation.has(visit.outcome) ? "warning" : "neutral",
        link: { href: `/app/visits/${visit.id}`, label: "Open visit" },
      },
    });
  }

  for (const response of fixture.vendorResponses.filter((item) => item.organizationId === organizationId && item.workOrderId === workOrderId && item.message?.trim())) {
    notes.push({
      sortAt: response.respondedAt,
      event: {
        id: `vendor-response-note-${response.id}`,
        title: `Vendor response · ${sentence(response.response)}`,
        description: response.message!.trim(),
        timestampLabel: dateTime(response.respondedAt, timeZone),
        actorLabel: response.responderName,
        tone: response.response === "declined" ? "warning" : "info",
      },
    });
  }

  for (const continuation of (fixture.vendorContinuations ?? []).filter((item) => item.organizationId === organizationId && item.workOrderId === workOrderId && item.message?.trim())) {
    notes.push({
      sortAt: continuation.createdAt,
      event: {
        id: `customer-note-${continuation.id}`,
        title: `Customer update · ${sentence(continuation.action)}`,
        description: continuation.message!.trim(),
        timestampLabel: dateTime(continuation.createdAt, timeZone),
        actorLabel: memberName(continuation.createdByMembershipId),
        tone: "info",
      },
    });
  }

  for (const appointment of (fixture.serviceAppointments ?? []).filter((item) => item.organizationId === organizationId && item.workOrderId === workOrderId && item.note?.trim())) {
    notes.push({
      sortAt: appointment.createdAt,
      event: {
        id: `appointment-note-${appointment.id}`,
        title: `Appointment note · ${sentence(appointment.status)}`,
        description: appointment.note!.trim(),
        timestampLabel: dateTime(appointment.createdAt, timeZone),
        actorLabel: appointment.proposedBy === "vendor" ? "Vendor" : memberName(appointment.createdByMembershipId),
        tone: appointment.status === "cancelled" ? "warning" : "neutral",
      },
    });
  }

  return notes
    .sort((left, right) => right.sortAt.localeCompare(left.sortAt))
    .map(({ event }) => event);
}

function estimateMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function date(value: string | undefined, timeZone = DEFAULT_OPERATIONS_TIME_ZONE): string {
  return value ? formatOperationsDate(value, timeZone) : "Not set";
}

function dateTime(value: string | undefined, timeZone = DEFAULT_OPERATIONS_TIME_ZONE): string {
  return value ? formatOperationsDateTime(value, timeZone, { year: false }) : "Not recorded";
}

function dateTimeInZone(value: string | undefined, timeZone: string): string {
  return value ? formatOperationsDateTime(value, timeZone, { year: false }) : "Not recorded";
}

function dateTimeInputInZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function sentence(value: string): string {
  return domainLabel(value);
}

function equipmentStatusLabel(value: string): string {
  return ({ operational: "Operational", watch: "Watch", out_of_service: "Out of service", retired: "Retired" } as Record<string, string>)[value] ?? sentence(value);
}

const IMPACT_ESTIMATE_CAVEAT = "Product value, sales impact, capacity, and downtime are optional estimates. They help with planning but are not confirmed losses.";

function impactMoney(value: RequestImpactAssessment["productInventoryValue"]) {
  return value ? estimateMoney(value.amountMinor, value.currency) : "Not estimated";
}

function impactEvidenceSection(
  assessments: RequestImpactAssessment[],
  recordHref: string,
): DetailSectionViewModel {
  const history = [...assessments].sort((left, right) => right.assessedAt.localeCompare(left.assessedAt) || right.id.localeCompare(left.id));
  const current = history[0];
  return {
    id: "business-impact",
    title: "Store impact",
    description: current ? IMPACT_ESTIMATE_CAVEAT : "No store-impact details were added to this issue.",
    facts: current ? [
      { label: "Store operation", value: sentence(current.storeOperatingState) },
      { label: "Safety", value: sentence(current.safetyConcern), helperText: `Compliance: ${sentence(current.complianceImpact)}` },
      { label: "Product / inventory", value: sentence(current.productInventoryRisk), helperText: `Reported value at risk: ${impactMoney(current.productInventoryValue)}` },
      { label: "Customers affected", value: sentence(current.customersAffected) },
      { label: "Unavailable capacity", value: current.capacityUnavailableBps === undefined ? "Not estimated" : `${current.capacityUnavailableBps / 100}%`, helperText: `Redundant equipment: ${sentence(current.redundantEquipment)}` },
      { label: "Revenue function", value: current.revenueFunctionImpact ? sentence(current.revenueFunctionImpact) : "Not identified", helperText: `Estimated daily exposure: ${impactMoney(current.estimatedDailyRevenueExposure)}` },
      { label: "Estimated downtime", value: current.estimatedDowntimeMinutes === undefined ? "Not estimated" : `${current.estimatedDowntimeMinutes} minutes` },
      { label: "Current evidence", value: `${sentence(current.confidence)} confidence · ${sentence(current.source)}`, helperText: `${current.assessedByActorName} · ${dateTime(current.assessedAt)}` },
    ] : [{ label: "Assessment", value: "Not recorded" }],
    table: {
      id: "impact-history",
      caption: "Append-only impact assessment history",
      columns: [
        { key: "assessment", label: "Assessment" },
        { key: "operation", label: "Store operation" },
        { key: "risk", label: "Reported risk" },
        { key: "estimates", label: "Exposure estimates" },
        { key: "provenance", label: "Recorded by" },
      ],
      rows: history.map((assessment) => ({
        id: assessment.id,
        label: assessment.assessmentKind === "review" ? `Manager ${assessment.reviewDisposition}` : "Initial store report",
        href: `${recordHref}#business-impact`,
        cells: [
          { key: "assessment", value: assessment.assessmentKind === "review" ? `Manager ${sentence(assessment.reviewDisposition ?? "review")}` : "Initial store report", secondary: `${sentence(assessment.confidence)} confidence` },
          { key: "operation", value: sentence(assessment.storeOperatingState), secondary: `Customers: ${sentence(assessment.customersAffected)}` },
          { key: "risk", value: sentence(assessment.safetyConcern), secondary: `Inventory: ${sentence(assessment.productInventoryRisk)} · Compliance: ${sentence(assessment.complianceImpact)}` },
          { key: "estimates", value: `Inventory ${impactMoney(assessment.productInventoryValue)}`, secondary: `Daily revenue ${impactMoney(assessment.estimatedDailyRevenueExposure)} · Downtime ${assessment.estimatedDowntimeMinutes === undefined ? "not estimated" : `${assessment.estimatedDowntimeMinutes} min`}` },
          { key: "provenance", value: assessment.assessedByActorName, secondary: dateTime(assessment.assessedAt) },
        ],
      })),
    },
  };
}

const approvalRoleLabels: Record<ApprovalRequiredRole, string> = {
  executive: "Owner / leadership",
  facilities_admin: "Maintenance administrator",
  regional_manager: "Regional manager",
  store_manager: "Store manager",
  finance_reviewer: "Invoice reviewer",
};

function approvalEvidence(
  fixture: OpsFixture,
  organizationId: string,
  subjectType: "service_request" | "work_order",
  subjectId: string,
): { fact: DetailFactViewModel; section: DetailSectionViewModel } {
  const requests = fixture.approvalRequests
    .filter((request) => request.organizationId === organizationId && request.subjectType === subjectType && request.subjectId === subjectId)
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id));
  if (!requests.length) {
    return {
      fact: { label: "Approval", value: "No approval gate", helperText: "Basic store-and-problem work remains valid when no policy-triggering amount is entered" },
      section: {
        id: "approval-governance",
        title: "Approval",
        description: "No approval is needed for this record. Approval limits do not prevent basic issue reporting or work-order creation.",
        facts: [
          { label: "Current state", value: "No approval required" },
          { label: "Source rule", value: "No policy snapshot attached" },
          { label: "History", value: "No approval decisions recorded" },
        ],
      },
    };
  }
  const decisions = fixture.approvalDecisions.filter((decision) => decision.organizationId === organizationId && requests.some((request) => request.id === decision.approvalRequestId));
  const current = requests[0];
  const currentState = approvalRequestState(current, decisions);
  const scopeName = current.policyScopeKind === "organization"
    ? fixture.organizations.find((organization) => organization.id === current.policyScopeId)?.name
    : current.policyScopeKind === "region"
      ? fixture.regions.find((region) => region.organizationId === organizationId && region.id === current.policyScopeId)?.name
      : fixture.stores.find((store) => store.organizationId === organizationId && store.id === current.policyScopeId)?.storeNumber;
  return {
    fact: { label: "Approval", value: sentence(currentState), helperText: `${sentence(current.requiredRole)} under ${current.policyName} v${current.policyVersion}` },
    section: {
      id: "approval-governance",
      title: "Approval",
      description: "See the rule, amount, required role, due date, and decision history for this approval.",
      facts: [
        { label: "Current state", value: sentence(currentState), helperText: currentState === "pending" && current.dueAt ? `Due ${dateTime(current.dueAt)}` : undefined },
        { label: "Amount presented", value: estimateMoney(current.amount.amountMinor, current.amount.currency), helperText: "Authorization basis captured when review was requested" },
        { label: "Required role", value: sentence(current.requiredRole), helperText: current.escalationRole ? `Escalates to ${sentence(current.escalationRole)}` : "No further escalation role configured" },
        { label: "Applied policy", value: `${current.policyName} v${current.policyVersion}`, helperText: `${sentence(current.policyScopeKind)} scope${scopeName ? ` · ${scopeName}` : ""}${current.categoryKey ? ` · ${sentence(current.categoryKey)}` : " · all categories"}` },
        { label: "Requested by", value: current.requestedByName, helperText: dateTime(current.requestedAt) },
        { label: "Reason", value: current.reason ?? "No additional reason entered" },
      ],
      table: {
        id: "approval-ledger",
        caption: "Immutable approval request and decision ledger",
        columns: [
          { key: "request", label: "Request" },
          { key: "amount", label: "Amount", align: "end" },
          { key: "role", label: "Accountable role" },
          { key: "status", label: "State" },
          { key: "decision", label: "Decision evidence" },
        ],
        rows: requests.map((request) => {
          const decision = decisions.find((candidate) => candidate.approvalRequestId === request.id);
          const state = approvalRequestState(request, decisions);
          return {
            id: request.id,
            label: `${request.policyName} v${request.policyVersion}`,
            href: subjectType === "work_order" ? `/app/work-orders/${subjectId}#approval-governance` : `/app/requests/${subjectId}#approval-governance`,
            cells: [
              { key: "request", value: `${request.policyName} v${request.policyVersion}`, secondary: `${request.requestedByName} · ${dateTime(request.requestedAt)}` },
              { key: "amount", value: estimateMoney(request.amount.amountMinor, request.amount.currency) },
              { key: "role", value: sentence(request.requiredRole), secondary: request.parentApprovalRequestId ? "Escalated review" : "Initial review" },
              { key: "status", value: sentence(state), tone: state === "approved" ? "positive" : state === "rejected" || state === "cancelled" ? "critical" : "warning" },
              { key: "decision", value: decision ? `${decision.decidedByName} · ${dateTime(decision.decidedAt)}` : "Awaiting decision", secondary: decision?.reason },
            ],
          };
        }),
      },
    },
  };
}

function auditDescription(payloadJson: string): string | undefined {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof payload.note === "string" && payload.note.trim()) return payload.note;
    if (typeof payload.resolution === "string" && payload.resolution.trim()) return payload.resolution;
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    const current = payload.current;
    if (current && typeof current === "object") {
      const nextAction = (current as Record<string, unknown>).nextAction;
      const owner = (current as Record<string, unknown>).accountableParty;
      if (typeof nextAction === "string") return `${nextAction}${typeof owner === "string" ? ` · ${owner}` : ""}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function workStatusTone(status: WorkOrder["status"]): Tone {
  if (["cancelled", "closed"].includes(status)) return "neutral";
  if (["completed_pending_review", "resolved"].includes(status)) return "positive";
  if (["waiting_on_parts", "waiting_on_vendor"].includes(status)) return "warning";
  if (["in_progress", "accepted", "scheduled"].includes(status)) return "info";
  return "neutral";
}

/** Plain operator language; persisted status keys remain stable and auditable. */
function workStatusLabel(status: WorkOrder["status"]): string {
  const labels: Record<WorkOrder["status"], string> = {
    draft: "Draft",
    awaiting_approval: "Approval needed",
    approved: "Ready to send",
    issued: "Sent to vendor",
    accepted: "Vendor accepted",
    scheduled: "Scheduled",
    in_progress: "Work in progress",
    waiting_on_vendor: "Waiting on vendor",
    waiting_on_parts: "Waiting on parts",
    completed_pending_review: "Completed · review needed",
    resolved: "Closeout ready",
    closed: "Closed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function scopeFixture(fixture: OpsFixture, session: OperatorSession): ScopedFixture {
  const organizationId = session.organizationId;
  const organizationStores = fixture.stores.filter((store) => store.organizationId === organizationId);
  let stores = organizationStores;

  if (session.regionIds?.length) {
    const regionIds = new Set(session.regionIds);
    stores = stores.filter((store) => Boolean(store.regionId && regionIds.has(store.regionId)));
  }
  if (session.role === "regional" && !session.regionIds?.length) stores = [];
  if (session.storeIds?.length) {
    const permittedStoreIds = new Set(session.storeIds);
    stores = stores.filter((store) => permittedStoreIds.has(store.id));
  }
  if (session.role === "store_manager" && !session.storeIds?.length) stores = [];

  const storeIds = new Set(stores.map((store) => store.id));
  return {
    organizationId,
    includeCompanywide: !session.regionIds?.length && !session.storeIds?.length,
    stores,
    storeIds,
    workOrders: fixture.workOrders.filter(
      (workOrder) => workOrder.organizationId === organizationId && storeIds.has(workOrder.storeId),
    ),
    visits: fixture.visits.filter(
      (visit) => visit.organizationId === organizationId && storeIds.has(visit.storeId),
    ),
    assets: fixture.assets.filter(
      (asset) => asset.organizationId === organizationId && storeIds.has(asset.storeId),
    ),
  };
}

function narrowScopeToStore(scoped: ScopedFixture, storeId: string | undefined): ScopedFixture {
  if (!storeId) return scoped;
  if (!scoped.storeIds.has(storeId)) {
    return { ...scoped, stores: [], storeIds: new Set(), workOrders: [], visits: [], assets: [] };
  }
  return {
    ...scoped,
    stores: scoped.stores.filter((store) => store.id === storeId),
    storeIds: new Set([storeId]),
    workOrders: scoped.workOrders.filter((work) => work.storeId === storeId),
    visits: scoped.visits.filter((visit) => visit.storeId === storeId),
    assets: scoped.assets.filter((asset) => asset.storeId === storeId),
  };
}

function narrowScopeToRegion(scoped: ScopedFixture, regionId: string | undefined): ScopedFixture {
  if (!regionId) return scoped;
  const stores = scoped.stores.filter((store) => store.regionId === regionId);
  const storeIds = new Set(stores.map((store) => store.id));
  return {
    ...scoped,
    stores,
    storeIds,
    workOrders: scoped.workOrders.filter((work) => storeIds.has(work.storeId)),
    visits: scoped.visits.filter((visit) => storeIds.has(visit.storeId)),
    assets: scoped.assets.filter((asset) => storeIds.has(asset.storeId)),
  };
}

function pathSegments(value: string | undefined): string[] {
  return value?.split("|").map((segment) => segment.trim()).filter(Boolean) ?? [];
}

function assetHierarchyPath(asset: Asset): string[] {
  const categoryLabel = sentence(asset.categoryKey);
  const firstSegment = asset.groupPath[0]?.toLocaleLowerCase("en-US");
  return firstSegment === categoryLabel.toLocaleLowerCase("en-US") || firstSegment === asset.categoryKey.toLocaleLowerCase("en-US")
    ? asset.groupPath
    : [categoryLabel, ...asset.groupPath];
}

function assetMatchesPath(asset: Asset | undefined, path: readonly string[]): boolean {
  if (!asset || path.length === 0) return path.length === 0;
  const hierarchy = assetHierarchyPath(asset);
  return path.every((segment, index) => hierarchy[index] === segment);
}

function storeLabel(store: Store | undefined): string {
  return store ? `Store ${store.storeNumber} · ${store.name}` : "Unknown store";
}

function storeAddress(store: Store): string {
  return [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`]
    .filter(Boolean)
    .join(", ");
}

function recordedCostByWork(
  fixture: OpsFixture,
  organizationId: string,
  serviceDateFrom?: string,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const line of fixture.costLines) {
    if (line.organizationId !== organizationId || (serviceDateFrom && line.serviceDate < serviceDateFrom)) continue;
    result.set(line.workOrderId, (result.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
  }
  return result;
}

function costForWorkIds(costByWork: Map<string, number>, workIds: Iterable<string>): number {
  let total = 0;
  for (const workId of workIds) total += costByWork.get(workId) ?? 0;
  return total;
}

function assignmentForWork(fixture: OpsFixture, organizationId: string, workOrderId: string) {
  return fixture.assignments
    .filter((assignment) => assignment.organizationId === organizationId && assignment.workOrderId === workOrderId)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))[0];
}

function vendorName(fixture: OpsFixture, organizationId: string, vendorId: string | undefined): string | undefined {
  if (!vendorId) return undefined;
  return fixture.vendors.find((vendor) => vendor.organizationId === organizationId && vendor.id === vendorId)?.name;
}

function monthKey(value: string): string {
  return value.slice(0, 7);
}

function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

function monthEndDate(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function hrefWithQuery(path: string, values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function rollingYearStart(asOf: string): string {
  const asOfDate = new Date(asOf);
  return new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth() - 11, 1)).toISOString().slice(0, 10);
}

function paginationModel(
  totalRows: number,
  currentPage: number,
  pageSize: number,
  pageHref: (page: number) => string,
): PaginationViewModel {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalRows);
  const pageNumbers = [...new Set([
    1,
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    totalPages,
  ].filter((page) => page >= 1 && page <= totalPages))].sort((left, right) => left - right);
  return {
    summary: totalRows ? `Showing ${pageStart + 1}–${pageEnd} of ${totalRows}` : "No records",
    currentPage,
    totalPages,
    pageLinks: pageNumbers.map((page) => ({ page, href: pageHref(page), current: page === currentPage })),
    previousHref: currentPage > 1 ? pageHref(currentPage - 1) : undefined,
    nextHref: currentPage < totalPages ? pageHref(currentPage + 1) : undefined,
  };
}

function spendPeriod(asOf: string, key: string | undefined) {
  const selected = key === "3m" || key === "6m" || key === "ytd" ? key : "12m";
  const asOfDate = new Date(asOf);
  const start = selected === "ytd"
    ? `${asOf.slice(0, 4)}-01-01`
    : new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth() - (selected === "3m" ? 2 : selected === "6m" ? 5 : 11), 1)).toISOString().slice(0, 10);
  return { key: selected, start, label: selected === "ytd" ? `Year to date from ${date(start)}` : `Rolling ${selected.slice(0, -1)} months from ${date(start)}`, months: selected === "ytd" ? asOfDate.getUTCMonth() + 1 : Number(selected.slice(0, -1)) };
}

function rollingMonthKeys(asOf: string, count = 12): string[] {
  const end = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (count - index - 1), 1));
    return month.toISOString().slice(0, 7);
  });
}

function effectivePmStatus(occurrence: PmOccurrence, asOf: string): PmOccurrence["status"] {
  if (occurrence.status === "completed" || occurrence.completedAt) return "completed";
  if (occurrence.status === "waived") return "waived";
  if (Date.parse(occurrence.windowEndsAt) < Date.parse(asOf)) return "missed";
  if (Date.parse(occurrence.windowStartsAt) > Date.parse(asOf)) return "scheduled";
  return occurrence.status === "scheduled" ? "scheduled" : "due";
}

function costBreakdown(
  title: string,
  values: Map<string, number>,
  hrefFor: (key: string) => string,
  options: {
    description?: string;
    labelFor?: (key: string) => string;
    linkLabel?: string;
    sourceHref?: string;
    sourceLabel?: string;
    amountLabel?: string;
  } = {},
): BreakdownViewModel {
  const entries = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return {
    id: title.toLocaleLowerCase("en-US").replace(/\W+/g, "-"),
    title,
    description: options.description,
    totalLabel: money(total),
    segments: entries.slice(0, 7).map(([key, value], index) => ({
      id: key,
      label: options.labelFor?.(key) ?? sentence(key || "unclassified"),
      value,
      formattedValue: money(value),
      shareLabel: total ? `${Math.round((value / total) * 100)}% of ${options.amountLabel ?? "recorded cost"}` : `No ${options.amountLabel ?? "recorded cost"}`,
      tone: index === 0 ? "warning" : "neutral",
      link: { href: hrefFor(key), label: options.linkLabel ?? "Open source work" },
    })),
    sourceLink: { href: options.sourceHref ?? "/app/work-orders?hasCost=true", label: options.sourceLabel ?? "View every cost source" },
  };
}

function countBreakdown(
  id: string,
  title: string,
  values: Map<string, number>,
  hrefFor: (key: string) => string,
  options: {
    description?: string;
    labelFor?: (key: string) => string;
    totalNoun?: string;
    sourceLink: { href: string; label: string };
  },
): BreakdownViewModel {
  const entries = [...values.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  return {
    id,
    title,
    description: options.description,
    totalLabel: `${total} ${options.totalNoun ?? "records"}`,
    segments: entries.map(([key, value], index) => ({
      id: key,
      label: options.labelFor?.(key) ?? sentence(key),
      value,
      formattedValue: String(value),
      shareLabel: total ? `${Math.round((value / total) * 100)}% of the visible total` : "No records",
      tone: index === 0 ? "warning" : "neutral",
      link: { href: hrefFor(key), label: "Open supporting records" },
    })),
    sourceLink: options.sourceLink,
  };
}

function costTrend(
  fixture: OpsFixture,
  scoped: ScopedFixture,
  options: { storeId?: string; periodStart?: string; query?: Record<string, string | undefined> } = {},
): TrendViewModel {
  const workById = new Map(scoped.workOrders.map((workOrder) => [workOrder.id, workOrder]));
  const monthKeys = rollingMonthKeys(fixture.asOf);
  const visibleMonths = new Set(monthKeys);
  const sourceWorkIds = new Set<string>();
  const monthly = new Map<string, number>();
  for (const line of fixture.costLines) {
    const key = monthKey(line.serviceDate);
    if (
      line.organizationId !== scoped.organizationId ||
      !workById.has(line.workOrderId) ||
      !visibleMonths.has(key)
    ) continue;
    sourceWorkIds.add(line.workOrderId);
    monthly.set(key, (monthly.get(key) ?? 0) + line.amount.amountMinor);
  }
  return {
    id: "recorded-cost-trend",
    title: "Recorded work cost — last 12 months",
    description: `Entered work costs grouped by service month. ${monthLabel(monthKeys.at(-1) ?? monthKey(fixture.asOf))} is through ${date(fixture.asOf)}; invoices are not included.`,
    points: monthKeys
      .map((key) => ({
        id: key,
        label: monthLabel(key),
        value: monthly.get(key) ?? 0,
        formattedValue: money(monthly.get(key) ?? 0),
        link: { href: hrefWithQuery("/app/work-orders", { store: options.storeId, ...options.query, costMonth: key }), label: `Open ${monthLabel(key)} work` },
      })),
    sourceLink: { href: hrefWithQuery("/app/work-orders", { store: options.storeId, ...options.query, hasCost: "true", costFrom: `${monthKeys[0]}-01` }), label: `Open ${sourceWorkIds.size} work orders with cost` },
  };
}

const reviewQueueExceptionCopy: Record<ExceptionKind, { label: string; title: string }> = {
  no_work_order: {
    label: "Visit without a work order",
    title: "Create or link a work order",
  },
  unexpected_visit: {
    label: "Unplanned visit",
    title: "Review an unplanned vendor visit",
  },
  missing_checkout: {
    label: "Missing checkout",
    title: "Close or follow up on an open visit",
  },
  outside_geofence: {
    label: "Check-in outside store area",
    title: "Review the check-in location",
  },
  low_accuracy_location: {
    label: "Weak location data",
    title: "Review a check-in with weak location data",
  },
  duplicate_active_visit: {
    label: "Possible duplicate visits",
    title: "Check for a duplicate visit",
  },
  unmatched_invoice: {
    label: "Invoice not linked",
    title: "Link the invoice to the right work",
  },
  amount_above_authorization: {
    label: "Cost above approved amount",
    title: "Review a cost above the approved amount",
  },
  overdue_pm: {
    label: "PM missed its due date",
    title: "Decide what to do with overdue PM",
  },
};

function actions(fixture: OpsFixture, scoped: ScopedFixture, limit = 6): ActionItemViewModel[] {
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const workById = new Map(scoped.workOrders.map((workOrder) => [workOrder.id, workOrder]));
  const exceptionActions = fixture.exceptions
    .filter(
      (exception) =>
        exception.organizationId === scoped.organizationId &&
        exception.status !== "resolved" &&
        (exception.storeId ? scoped.storeIds.has(exception.storeId) : scoped.includeCompanywide),
    )
    .map<ActionItemViewModel>((exception) => {
      const workNumber = exception.workOrderId ? workById.get(exception.workOrderId)?.number : undefined;
      const copy = reviewQueueExceptionCopy[exception.kind];
      return {
        id: exception.id,
        title: copy.title,
        description: exception.summary,
        categoryLabel: "Record to check",
        attentionType: "service_record",
        reasonLabel: copy.label,
        storeLabel: exception.storeId ? storeLabel(storeById.get(exception.storeId)) : "Companywide",
        recordLabel: exception.workOrderId
          ? workNumber ?? "Linked work"
          : exception.visitId
            ? "Service visit"
            : copy.label,
        dueAt: exception.detectedAt,
        dueLabel: exception.severity === "urgent" ? "Review now" : `Open since ${date(exception.detectedAt)}`,
        ownerLabel: "Facilities coordinator",
        priorityLabel: exception.severity === "urgent" ? "Urgent" : "Review",
        tone: exception.severity === "urgent" ? "critical" : "warning",
        link: { href: `/app/action-center/${exception.id}`, label: "Review and resolve" },
      };
    });
  const followUpActions = fixture.followUps
    .filter(
      (followUp) =>
        followUp.organizationId === scoped.organizationId &&
        followUp.status === "open" &&
        Boolean(workById.get(followUp.workOrderId)),
    )
    .map<ActionItemViewModel>((followUp) => {
      const work = workById.get(followUp.workOrderId)!;
      return {
        id: followUp.id,
        title: followUp.nextAction,
        description: followUp.sourceVisitId
          ? "Created from a checkout result. Open the visit to read the technician's notes."
          : "A manager-created follow-up is still open.",
        categoryLabel: "Follow-up",
        attentionType: "follow_up",
        reasonLabel: "Work-order follow-up",
        storeLabel: storeLabel(storeById.get(work.storeId)),
        recordLabel: work.number,
        dueAt: followUp.dueAt,
        dueLabel: `Due ${date(followUp.dueAt)}`,
        ownerLabel: followUp.accountableParty,
        priorityLabel: Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "Overdue" : "Due soon",
        tone: Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "critical" : "warning",
        link: { href: `/app/action-center/${followUp.id}`, label: "Complete or reassign" },
      };
    });
  const vendorById = new Map(fixture.vendors.filter((vendor) => vendor.organizationId === scoped.organizationId).map((vendor) => [vendor.id, vendor]));
  const vendorReminderActions = scoped.includeCompanywide
    ? fixture.vendorReminders
        .filter((reminder) => reminder.organizationId === scoped.organizationId && reminder.status === "open" && vendorById.has(reminder.vendorId))
        .map<ActionItemViewModel>((reminder) => ({
          id: reminder.id,
          title: reminder.title,
          description: "A companywide vendor task is still open.",
          categoryLabel: "Vendor task",
          attentionType: "vendor_task",
          reasonLabel: "Vendor relationship task",
          storeLabel: "Companywide",
          recordLabel: vendorById.get(reminder.vendorId)?.name ?? "Vendor",
          dueAt: reminder.dueAt,
          dueLabel: `Due ${date(reminder.dueAt)}`,
          ownerLabel: reminder.accountableParty,
          priorityLabel: Date.parse(reminder.dueAt) < Date.parse(fixture.asOf) ? "Overdue" : "Due soon",
          tone: Date.parse(reminder.dueAt) < Date.parse(fixture.asOf) ? "critical" : "warning",
          link: { href: `/app/vendors/${reminder.vendorId}#vendor-reminders`, label: "Open vendor reminder" },
        }))
    : [];
  return [...exceptionActions, ...followUpActions, ...vendorReminderActions]
    .sort((left, right) => Number(right.tone === "critical") - Number(left.tone === "critical") || (Date.parse(left.dueAt ?? "9999-12-31") - Date.parse(right.dueAt ?? "9999-12-31")) || left.title.localeCompare(right.title))
    .slice(0, limit);
}

const accountabilityExceptionKinds = new Set([
  "no_work_order",
  "unexpected_visit",
  "missing_checkout",
  "outside_geofence",
  "low_accuracy_location",
  "duplicate_active_visit",
]);

function actionsForSession(
  fixture: OpsFixture,
  scoped: ScopedFixture,
  session: OperatorSession,
  limit = 6,
) {
  const source = actions(fixture, scoped, 200);
  if (session.demoEdition !== "accountability") return source.slice(0, limit);
  const accountabilityExceptionIds = new Set(
    fixture.exceptions
      .filter((exception) => accountabilityExceptionKinds.has(exception.kind))
      .map((exception) => exception.id),
  );
  return source
    .filter((action) => action.attentionType === "follow_up" || accountabilityExceptionIds.has(action.id))
    .slice(0, limit);
}

function dashboardShortcut(options: {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  dueLabel: string;
  ownerLabel: string;
  tone?: Tone;
  href: string;
  linkLabel: string;
}): ActionItemViewModel {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    categoryLabel: options.categoryLabel,
    dueLabel: options.dueLabel,
    ownerLabel: options.ownerLabel,
    tone: options.tone ?? "neutral",
    link: { href: options.href, label: options.linkLabel },
  };
}

function formatRunway(months: number): string {
  if (months < 12) {
    const rounded = Math.max(0.1, Math.round(months * 10) / 10);
    return `${rounded} ${rounded === 1 ? "month" : "months"}`;
  }
  const years = Math.round((months / 12) * 10) / 10;
  return `${years} ${years === 1 ? "year" : "years"}`;
}

function lifecycleGapLabel(gap: RepairReplacementScreening["dataGaps"][number]): string {
  const labels: Record<typeof gap, string> = {
    missing_install_date: "Install date",
    invalid_install_date: "Valid install date",
    install_date_after_as_of: "Install date before today",
    missing_expected_life: "Expected-life reference",
    invalid_expected_life: "Valid expected-life reference",
    missing_replacement_estimate: "Installed replacement estimate",
    invalid_replacement_estimate: "Valid installed replacement estimate",
    missing_repair_estimate: "Current repair estimate",
    invalid_repair_estimate: "Valid current repair estimate",
    invalid_service_extension: "Valid expected service from repair",
    no_positive_comparison_horizon: "Expected service from repair",
  };
  return labels[gap];
}

function lifecycleRows(fixture: OpsFixture, scoped: ScopedFixture, costByWork: Map<string, number>) {
  const asOf = Date.parse(fixture.asOf);
  const periodStart = (days: number) => asOf - days * 86_400_000;
  const rows = scoped.assets.map((asset) => {
      const work = scoped.workOrders.filter((candidate) => candidate.assetId === asset.id);
      const reactiveWork = work.filter((candidate) => candidate.priority !== "planned");
      const completedReactiveWork = reactiveWork.filter((candidate) =>
        candidate.status === "closed" || candidate.status === "completed_pending_review" || candidate.status === "resolved",
      );
      const workCost = costForWorkIds(costByWork, work.map((candidate) => candidate.id));
      const workInDays = (days: number) => reactiveWork.filter(
        (candidate) => Date.parse(candidate.closedAt ?? candidate.createdAt) >= periodStart(days),
      );
      const work12 = workInDays(365);
      const work24 = workInDays(730);
      const work36 = workInDays(1_095);
      const reactiveWorkIds = new Set(reactiveWork.map((candidate) => candidate.id));
      const costInDays = (days: number) => fixture.costLines
        .filter((line) =>
          line.organizationId === scoped.organizationId &&
          reactiveWorkIds.has(line.workOrderId) &&
          Date.parse(`${line.serviceDate}T00:00:00Z`) >= periodStart(days),
        )
        .reduce((sum, line) => sum + line.amount.amountMinor, 0);
      const cost12 = costInDays(365);
      const cost24 = costInDays(730);
      const cost36 = costInDays(1_095);
      const observedVisits = scoped.visits.filter((visit) =>
        Boolean(visit.workOrderId && reactiveWorkIds.has(visit.workOrderId)),
      );
      const pm = fixture.pmOccurrences.filter(
        (occurrence) =>
          occurrence.organizationId === scoped.organizationId && occurrence.assetId === asset.id,
      );
      const pmExceptions = pm.filter((occurrence) => occurrence.status === "missed" || occurrence.status === "due");
      const ageYears = asset.installedAt
        ? Math.max(0, (asOf - Date.parse(asset.installedAt)) / (365.25 * 86_400_000))
        : undefined;
      const expectedLife = asset.expectedLifeYears;
      const lifeUsed = ageYears !== undefined && expectedLife ? ageYears / expectedLife : undefined;
      const expectedReplacementYear = asset.installedAt && expectedLife
        ? new Date(asset.installedAt).getUTCFullYear() + expectedLife
        : undefined;
      const latestLifecycleDecision = fixture.lifecycleRecommendations
        .filter((recommendation) => recommendation.organizationId === scoped.organizationId && recommendation.assetId === asset.id)
        .sort((left, right) => right.version - left.version || right.decidedAt.localeCompare(left.decidedAt))[0];
      const hasManagementPlan = Boolean(
        latestLifecycleDecision?.plannedForYear &&
        ["replace", "defer"].includes(latestLifecycleDecision.userDecision) &&
        latestLifecycleDecision.actualOutcome !== "replaced",
      );
      const capitalPlanYear = hasManagementPlan ? latestLifecycleDecision?.plannedForYear : expectedReplacementYear;
      const capitalPlanLabel = hasManagementPlan
        ? `${latestLifecycleDecision?.userDecision === "defer" ? "Deferred" : "Planned"} for ${capitalPlanYear}`
        : expectedReplacementYear
          ? `Age-based outlook: ${expectedReplacementYear}`
          : "Planning year not set";
      const replacementResolution = resolveAssetReplacementEstimate(fixture, asset, fixture.asOf);
      const replacement = replacementResolution.amount?.amountMinor;
      const warrantyExpired = Boolean(asset.warrantyEndsAt && Date.parse(asset.warrantyEndsAt) < asOf);
      const componentCounts = new Map<string, number>();
      for (const candidate of completedReactiveWork) if (candidate.componentId) {
        componentCounts.set(candidate.componentId, (componentCounts.get(candidate.componentId) ?? 0) + 1);
      }
      const repeatedComponent = [...componentCounts.entries()]
        .filter(([, count]) => count >= 2)
        .sort(([, a], [, b]) => b - a)[0];
      const repeatedComponentName = repeatedComponent
        ? fixture.components.find(
            (component) =>
              component.organizationId === scoped.organizationId &&
              component.assetId === asset.id &&
              component.id === repeatedComponent[0],
          )?.name
        : undefined;
      const sameComponentRepeat = Boolean(repeatedComponent);
      const proposalWork = reactiveWork
        .filter((candidate) =>
          !["closed", "cancelled", "completed_pending_review", "resolved"].includes(candidate.status) &&
          Boolean(candidate.repairEstimate),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      const screening = calculateRepairReplacementScreening(
        { ...asset, replacementEstimate: replacementResolution.amount },
        proposalWork ? {
          proposalId: proposalWork.id,
          repairEstimateMinor: proposalWork.repairEstimate?.amountMinor,
          estimatedServiceExtensionMonths: proposalWork.estimatedServiceExtensionMonths,
          sourceRecordIds: [proposalWork.id],
        } : undefined,
        {
          asOf: fixture.asOf,
          historicalContext: {
            recordedWorkCostMinor: workCost,
            distinctWorkOrderCount: reactiveWork.length,
            distinctVisitCount: observedVisits.length,
            repeatIssueCount: repeatedComponent?.[1] ?? 0,
            sourceRecordIds: [...reactiveWork.map((candidate) => candidate.id), ...observedVisits.map((visit) => visit.id)],
          },
        },
      );
      const replacementEvents = fixture.replacementEvents.filter(
        (event) =>
          event.organizationId === scoped.organizationId &&
          event.assetId === asset.id &&
          (!proposalWork || event.workOrderId === proposalWork.id),
      );
      const decisionState = resolveLifecycleDecisionState({
        screening,
        latestDecision: latestLifecycleDecision,
        replacementEvents,
      });
      const contextFacts = [
        `${reactiveWork.length} reactive work order${reactiveWork.length === 1 ? "" : "s"} recorded`,
        `${observedVisits.length} observed service visit${observedVisits.length === 1 ? "" : "s"}; visit count does not prove repeat failure`,
        repeatedComponent
          ? `${repeatedComponent[1]} completed reactive work orders tied to ${repeatedComponentName ?? "the same component"}`
          : undefined,
        warrantyExpired ? "Warranty reference has expired" : asset.warrantyEndsAt ? "Warranty reference is active" : "Warranty not entered",
        pmExceptions.length > 0 ? `${pmExceptions.length} due or missed PM occurrence${pmExceptions.length === 1 ? "" : "s"}` : undefined,
      ].filter((fact): fact is string => Boolean(fact));
      return {
        asset,
        work,
        reactiveWork,
        workCost,
        work12,
        work24,
        work36,
        cost12,
        cost24,
        cost36,
        observedVisits,
        pm,
        pmExceptions,
        ageYears,
        lifeUsed,
        expectedReplacementYear,
        latestLifecycleDecision,
        hasManagementPlan,
        capitalPlanYear,
        capitalPlanLabel,
        replacement,
        replacementResolution,
        warrantyExpired,
        sameComponentRepeat,
        proposalWork,
        screening,
        decisionState,
        contextFacts,
      };
    });

  const stateOrder: Record<RepairReplacementScreening["state"], number> = {
    compare_alternatives: 3,
    below_economic_review: 2,
    below_materiality: 1,
    incomplete: 0,
  };
  return rows.sort((a, b) =>
    stateOrder[b.screening.state] - stateOrder[a.screening.state] ||
    (b.screening.comparison.repairEstimateMinor ?? 0) - (a.screening.comparison.repairEstimateMinor ?? 0) ||
    b.workCost - a.workCost,
  );
}

function buildSharedDashboardModel(fixture: OpsFixture, session: OperatorSession): DashboardPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const periodStart = rollingYearStart(fixture.asOf);
  const costByWork = recordedCostByWork(fixture, scoped.organizationId, periodStart);
  const lifecycleCostByWork = recordedCostByWork(fixture, scoped.organizationId);
  const recordedCost = costForWorkIds(costByWork, scoped.workOrders.map((workOrder) => workOrder.id));
  const openWork = scoped.workOrders.filter((workOrder) => !["closed", "cancelled"].includes(workOrder.status));
  const activeVisits = scoped.visits.filter((visit) => visit.status === "active");
  const completedVisits = scoped.visits.filter((visit) => visit.status !== "active");
  const pendingRequests = fixture.requests.filter(
    (request) =>
      request.organizationId === scoped.organizationId &&
      scoped.storeIds.has(request.storeId) &&
      ["submitted", "under_review"].includes(request.status),
  );
  const awaitingVendor = scoped.workOrders.filter((workOrder) =>
    ["approved", "issued", "waiting_on_vendor"].includes(workOrder.status),
  );
  const followUps = fixture.followUps.filter(
    (followUp) =>
      followUp.organizationId === scoped.organizationId &&
      followUp.status === "open" &&
      scoped.workOrders.some((workOrder) => workOrder.id === followUp.workOrderId),
  );
  const categoryCost = new Map<string, number>();
  for (const work of scoped.workOrders) {
    const key = work.categoryKey ?? "unclassified";
    categoryCost.set(key, (categoryCost.get(key) ?? 0) + (costByWork.get(work.id) ?? 0));
  }
  const candidate = lifecycleRows(fixture, scoped, lifecycleCostByWork).find((row) =>
    row.screening.state === "compare_alternatives",
  );

  const reviewItems = actions(fixture, scoped, 200);
  const metrics: MetricViewModel[] = [
    {
      id: "active-visits",
      label: "Vendors onsite now",
      value: String(activeVisits.length),
      supportingText: `${activeVisits.length} onsite now · ${scoped.visits.length} visits in scope`,
      tone: activeVisits.length ? "info" : "neutral",
      link: { href: "/app/visits?status=active", label: "Open live visits" },
    },
    {
      id: "open-exceptions",
      label: "Items to review",
      value: String(reviewItems.length),
      supportingText: "Open the queue for source records and next steps",
      tone: reviewItems.length ? "warning" : "positive",
      link: { href: "/app/action-center", label: "Open review queue" },
    },
    {
      id: "open-work",
      label: "Open work",
      value: String(openWork.length),
      supportingText: "Every item has an owner and next action",
      link: { href: "/app/work-orders?status=open", label: "Open work orders" },
    },
    {
      id: "recorded-cost",
      label: "Recorded work cost",
      value: money(recordedCost),
      supportingText: "Rolling 12-month source cost; invoices not required",
      link: { href: "/app/spend", label: "Explain the total" },
    },
  ];

  return {
    state: { kind: "ready" },
    layout: session.role === "executive" ? "executive" : session.role === "finance" ? "finance" : session.role === "store_manager" ? "store" : session.role === "regional" ? "regional" : "operations",
    page: {
      title: session.role === "executive" ? "Your company at a glance" : "Maintenance overview",
      eyebrow: session.role === "executive" ? "Executive home" : "Manager home",
      description: "Start with the decisions that need you, then follow every number into the store, work order, visit, or cost record behind it.",
      scopeLabel: session.scopeLabel,
      periodLabel: `Rolling 12 months from ${date(periodStart)}`,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
      primaryAction: { label: "Open review queue", href: "/app/action-center" },
      secondaryAction: session.role === "facilities" || session.role === "regional"
        ? { label: "Create work order", href: "/app/work-orders/new" }
        : undefined,
    },
    journey: [
      {
        id: "intake",
        label: "New requests",
        value: String(pendingRequests.length),
        supportingText: "Waiting for review",
        tone: pendingRequests.length ? "warning" : "neutral",
        link: { href: "/app/requests", label: "Review requests" },
      },
      {
        id: "authorization",
        label: "Vendor response",
        value: String(awaitingVendor.length),
        supportingText: "Approved, issued, or waiting",
        tone: awaitingVendor.length ? "warning" : "neutral",
        link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" },
      },
      {
        id: "onsite",
        label: "Onsite now",
        value: String(activeVisits.length),
        supportingText: `${scoped.visits.length} total visits in scope`,
        tone: activeVisits.length ? "info" : "neutral",
        link: { href: "/app/visits?status=active", label: "Open live visits" },
      },
      {
        id: "follow-up",
        label: "Follow-up",
        value: String(followUps.length),
        supportingText: "Outcome still needs action",
        tone: followUps.length ? "critical" : "positive",
        link: { href: "/app/action-center?type=follow-up", label: "Open follow-ups" },
      },
      {
        id: "history",
        label: "Completed visits",
        value: String(completedVisits.length),
        supportingText: "Observed service history",
        tone: "positive",
        link: { href: "/app/visits?status=checked_out", label: "Open visit history" },
      },
    ],
    metrics,
    priorityActions: actions(fixture, scoped),
    breakdowns: [
      costBreakdown(
        "Recorded cost by service area",
        categoryCost,
        (key) => hrefWithQuery("/app/work-orders", { category: key, hasCost: "true", costFrom: periodStart }),
        {
          description: "Select a service area to open the exact work orders and cost lines behind it.",
          sourceHref: hrefWithQuery("/app/work-orders", { hasCost: "true", costFrom: periodStart }),
        },
      ),
    ],
    trends: [costTrend(fixture, scoped, { periodStart })],
    spotlight: candidate
      ? {
          eyebrow: "Repair or replace",
          title: `${candidate.proposalWork?.number ?? "Current repair"}: review repair versus replacement`,
          description: `The proposed repair is ${money(candidate.screening.comparison.repairEstimateMinor ?? 0)}, or ${Math.round((candidate.screening.comparison.repairToReplacementRatio ?? 0) * 100)}% of the ${money(candidate.screening.comparison.replacementEstimateMinor ?? 0)} replacement estimate. It would need about ${candidate.screening.comparison.requiredEconomicRunwayMonths === undefined ? "an uncalculated period" : formatRunway(candidate.screening.comparison.requiredEconomicRunwayMonths)} of continued service to equal the replacement's annualized installed-capital cost. The entered service estimate is planning evidence, not a guarantee.`,
          facts: [
            { label: "Proposed repair", value: money(candidate.screening.comparison.repairEstimateMinor ?? 0) },
            { label: "Estimated replacement", value: money(candidate.screening.comparison.replacementEstimateMinor ?? 0) },
            { label: "Repair vs. replacement", value: `${Math.round((candidate.screening.comparison.repairToReplacementRatio ?? 0) * 100)}%` },
            { label: "Required service runway", value: candidate.screening.comparison.requiredEconomicRunwayMonths === undefined ? "Not calculable" : formatRunway(candidate.screening.comparison.requiredEconomicRunwayMonths) },
            { label: "Entered service estimate", value: candidate.screening.comparison.estimatedServiceExtensionMonths === undefined ? "Not entered" : formatRunway(candidate.screening.comparison.estimatedServiceExtensionMonths) },
          ],
          link: { href: `/app/lifecycle?asset=${candidate.asset.id}`, label: "Open repair-or-replace details" },
        }
      : undefined,
  };
}

/**
 * A deliberately complete view of the smaller launch package.
 *
 * This is packaging, not a second data stack: every count and drill-through is
 * derived from the same requests, work orders, visits, exceptions, and vendors
 * used by the complete platform.
 */
export function buildAccountabilityDashboardModel(
  fixture: OpsFixture,
  session: OperatorSession,
): DashboardPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const openWork = scoped.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status));
  const activeVisits = scoped.visits.filter((visit) => visit.status === "active");
  const noWorkOrderVisits = scoped.visits.filter((visit) => !visit.workOrderId);
  const openExceptions = fixture.exceptions.filter(
    (exception) =>
      exception.organizationId === scoped.organizationId
      && exception.status !== "resolved"
      && accountabilityExceptionKinds.has(exception.kind)
      && (exception.storeId ? scoped.storeIds.has(exception.storeId) : scoped.includeCompanywide),
  );
  const workStatusCounts = new Map<string, number>();
  for (const work of openWork) {
    workStatusCounts.set(work.status, (workStatusCounts.get(work.status) ?? 0) + 1);
  }
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const visitById = new Map(scoped.visits.map((visit) => [visit.id, visit]));
  const reviewByVisit = new Map<string, (typeof openExceptions)[number]>();
  for (const exception of openExceptions) {
    if (!exception.visitId || reviewByVisit.has(exception.visitId)) continue;
    reviewByVisit.set(exception.visitId, exception);
  }
  const visitReviewActions = [...reviewByVisit.entries()].slice(0, 6).map<ActionItemViewModel>(([visitId, exception]) => {
    const visit = visitById.get(visitId);
    return {
      id: exception.id,
      title: exception.summary,
      description: visit ? `${visit.providerName} · ${visit.purpose}` : "Open the visit and review the recorded check-in or checkout.",
      categoryLabel: "Visit review",
      storeLabel: visit ? storeLabel(storeById.get(visit.storeId)) : undefined,
      recordLabel: "Service visit",
      dueLabel: "Review now",
      ownerLabel: "Maintenance / facilities",
      priorityLabel: exception.severity === "urgent" ? "Urgent" : "Review",
      tone: exception.severity === "urgent" ? "critical" : "warning",
      link: { href: `/app/visits/${visitId}`, label: "Open service visit" },
    };
  });
  const roleCopy = {
    executive: {
      title: "Vendor check-in & work orders",
      eyebrow: "Accountability package · Company view",
      description: "Create vendor work orders, see who is onsite, and review every recorded checkout.",
      primaryAction: { label: "Create work order", href: "/app/work-orders/new" },
      secondaryAction: { label: "Open vendor check-in", href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}` },
    },
    facilities: {
      title: "Vendor check-in & work orders",
      eyebrow: "Accountability package · Daily view",
      description: "Create the work order, send it to the vendor, and record the technician's arrival and checkout.",
      primaryAction: { label: "Create work order", href: "/app/work-orders/new" },
      secondaryAction: { label: "Open vendor check-in", href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}` },
    },
    regional: {
      title: "Regional check-in & work orders",
      eyebrow: "Accountability package · Regional view",
      description: "See active work orders, vendor arrivals, completed checkouts, and visits that need review.",
      primaryAction: { label: "Create work order", href: "/app/work-orders/new" },
      secondaryAction: { label: "Open vendor check-in", href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}` },
    },
    store_manager: {
      title: scoped.stores[0]
        ? `Store ${scoped.stores[0].storeNumber} vendor visits`
        : "Store vendor visits",
      eyebrow: "Accountability package · Store view",
      description: "See who is expected or onsite and review the visit history for this store.",
      primaryAction: { label: "Open vendor check-in", href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}` },
      secondaryAction: { label: "Review service visits", href: "/app/visits" },
    },
    finance: {
      title: "Work-order & visit records",
      eyebrow: "Accountability package · Read-only view",
      description: "Trace each vendor visit back to the operator work order that authorized it.",
      primaryAction: { label: "Open work orders", href: "/app/work-orders" },
      secondaryAction: { label: "Open service visits", href: "/app/visits" },
    },
  }[session.role];

  return {
    state: { kind: "ready" },
    layout: session.role === "executive"
      ? "executive"
      : session.role === "finance"
        ? "finance"
        : session.role === "store_manager"
          ? "store"
          : session.role === "regional"
            ? "regional"
            : "operations",
    page: {
      ...roleCopy,
      scopeLabel: session.scopeLabel,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
    },
    metrics: [
      {
        id: "open-work",
        label: "Open work orders",
        value: String(openWork.length),
        supportingText: "Vendor work that is not closed or cancelled",
        tone: openWork.length ? "info" : "positive",
        link: { href: "/app/work-orders?status=open", label: "Open work orders" },
      },
      {
        id: "active-visits",
        label: "Vendors onsite now",
        value: String(activeVisits.length),
        supportingText: `${scoped.visits.length} observed service visits in scope`,
        tone: activeVisits.length ? "info" : "neutral",
        link: { href: "/app/visits?status=active", label: "Open live visits" },
      },
      {
        id: "no-work-order",
        label: "Visits without a work order",
        value: String(noWorkOrderVisits.length),
        supportingText: "Service was allowed and separated for review",
        tone: noWorkOrderVisits.length ? "warning" : "positive",
        link: { href: "/app/visits?review=true", label: "Review unmatched visits" },
      },
      {
        id: "visit-review",
        label: "Visits needing review",
        value: String(reviewByVisit.size),
        supportingText: "Unscheduled, unmatched, location, or missing-checkout records",
        tone: reviewByVisit.size ? "warning" : "positive",
        link: { href: "/app/visits?review=true", label: "Review service visits" },
      },
    ],
    priorityActions: visitReviewActions,
    prioritySection: {
      title: "Visit review queue",
      description: "Open the full queue for the exact check-in and checkout records.",
      link: { href: "/app/visits?review=true", label: "Open all visits needing review" },
      display: "summary",
    },
    breakdowns: [
      countBreakdown(
        "accountability-work-status",
        "Open work by status",
        workStatusCounts,
        (key) => hrefWithQuery("/app/work-orders", { status: key }),
        {
          description: "Select a status to open the work orders currently carrying it.",
          totalNoun: "open work orders",
          sourceLink: { href: "/app/work-orders?status=open", label: "Open every work order" },
        },
      ),
    ],
    trends: [],
  };
}

export function buildDashboardModel(fixture: OpsFixture, session: OperatorSession): DashboardPageViewModel {
  const base = buildSharedDashboardModel(fixture, session);
  const scoped = scopeFixture(fixture, session);
  const periodStart = rollingYearStart(fixture.asOf);
  const rollingCostByWork = recordedCostByWork(fixture, scoped.organizationId, periodStart);
  const allCostByWork = recordedCostByWork(fixture, scoped.organizationId);
  const recordedCost = costForWorkIds(rollingCostByWork, scoped.workOrders.map((work) => work.id));
  const openWork = scoped.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status));
  const activeVisits = scoped.visits.filter((visit) => visit.status === "active");
  const completedVisits = scoped.visits.filter((visit) => visit.status !== "active");
  const awaitingVendor = openWork.filter((work) =>
    ["approved", "issued", "waiting_on_vendor"].includes(work.status),
  );
  const lifecycle = lifecycleRows(fixture, scoped, allCostByWork);
  const repairComparisons = lifecycle.filter((row) => row.screening.state === "compare_alternatives");
  const candidate = repairComparisons[0];
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const vendorById = new Map(
    fixture.vendors
      .filter((vendor) => vendor.organizationId === scoped.organizationId)
      .map((vendor) => [vendor.id, vendor]),
  );
  const observedVisitCounts = new Map<string, number>();
  for (const visit of scoped.visits) {
    if (visit.vendorId) observedVisitCounts.set(visit.vendorId, (observedVisitCounts.get(visit.vendorId) ?? 0) + 1);
  }

  const reviewItems = actions(fixture, scoped, 200);
  const categoryCost = new Map<string, number>();
  const storeCost = new Map<string, number>();
  for (const work of scoped.workOrders) {
    const amount = rollingCostByWork.get(work.id) ?? 0;
    categoryCost.set(work.categoryKey ?? "unclassified", (categoryCost.get(work.categoryKey ?? "unclassified") ?? 0) + amount);
    storeCost.set(work.storeId, (storeCost.get(work.storeId) ?? 0) + amount);
  }
  const categoryBreakdown = costBreakdown(
    "Recorded cost by service area",
    categoryCost,
    (key) => hrefWithQuery("/app/spend", { category: key }),
    {
      description: "Choose a service area to continue through configured groups, equipment, components, and source work.",
      linkLabel: "Drill into this service area",
      sourceHref: "/app/spend",
      sourceLabel: "Open the full spending view",
    },
  );
  const storeBreakdown = costBreakdown(
    "Recorded cost by store",
    storeCost,
    (key) => hrefWithQuery("/app/spend", { store: key }),
    {
      description: "Compare locations in this access scope, then open the cost hierarchy and source work for any store.",
      labelFor: (key) => storeLabel(storeById.get(key)),
      linkLabel: "Open this store's cost",
      sourceHref: "/app/stores?sort=cost",
      sourceLabel: "Open the complete store ranking",
    },
  );
  const vendorAccountabilityBreakdown = countBreakdown(
    "observed-visits-by-vendor",
    "Observed service visits by vendor",
    observedVisitCounts,
    (key) => hrefWithQuery("/app/visits", { vendor: key }),
    {
      description: "Observed check-in records by outside vendor in this scope. Open any segment to review work-order linkage, presence evidence, outcome, and follow-up.",
      labelFor: (key) => vendorById.get(key)?.name ?? "Unknown vendor",
      totalNoun: "observed outside-vendor visits",
      sourceLink: { href: "/app/vendors", label: "Open vendor accountability" },
    },
  );
  const trend = costTrend(fixture, scoped, { periodStart });
  const lifecycleSpotlight: DashboardPageViewModel["spotlight"] = candidate
    ? {
        eyebrow: "Repair or replace",
        title: `${candidate.proposalWork?.number ?? "Current repair"}: review repair versus replacement`,
        description: `The proposed repair is ${money(candidate.screening.comparison.repairEstimateMinor ?? 0)}, or ${Math.round((candidate.screening.comparison.repairToReplacementRatio ?? 0) * 100)}% of the ${money(candidate.screening.comparison.replacementEstimateMinor ?? 0)} replacement estimate. It would need about ${candidate.screening.comparison.requiredEconomicRunwayMonths === undefined ? "an uncalculated period" : formatRunway(candidate.screening.comparison.requiredEconomicRunwayMonths)} of continued service to equal the replacement's annualized installed-capital cost. Open the comparison to review the entered vendor estimate, age, warranty, prior repairs, visits, and preventive maintenance before making the decision.`,
        facts: [
          { label: "Proposed repair", value: money(candidate.screening.comparison.repairEstimateMinor ?? 0) },
          { label: "Estimated replacement", value: money(candidate.screening.comparison.replacementEstimateMinor ?? 0) },
          { label: "Repair vs. replacement", value: `${Math.round((candidate.screening.comparison.repairToReplacementRatio ?? 0) * 100)}%` },
          { label: "Required service runway", value: candidate.screening.comparison.requiredEconomicRunwayMonths === undefined ? "Not calculable" : formatRunway(candidate.screening.comparison.requiredEconomicRunwayMonths) },
          { label: "Entered service estimate", value: candidate.screening.comparison.estimatedServiceExtensionMonths === undefined ? "Not entered" : formatRunway(candidate.screening.comparison.estimatedServiceExtensionMonths) },
        ],
        link: { href: `/app/lifecycle?asset=${candidate.asset.id}`, label: "Open repair-or-replace details" },
      }
    : undefined;
  const pageBase = {
    scopeLabel: session.scopeLabel,
    periodLabel: `Rolling 12 months from ${date(periodStart)}`,
    updatedLabel: `Source data through ${date(fixture.asOf)}`,
  };

  if (session.role === "executive") {
    const highestCostStore = [...storeCost.entries()].sort((left, right) => right[1] - left[1])[0];
    return {
      state: { kind: "ready" },
      layout: "executive",
      page: {
        ...pageBase,
        title: "Your company at a glance",
        eyebrow: "Owner overview",
        description: "See spending, open work, vendor activity, and upcoming equipment decisions across the company.",
        primaryAction: { label: "View spending", href: "/app/spend" },
        secondaryAction: { label: "Open reports", href: "/app/reports" },
      },
      metrics: [
        { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Entered work costs for the last 12 months", link: { href: "/app/spend", label: "See the costs" } },
        { id: "open-work", label: "Open work", value: String(openWork.length), supportingText: "Every item has an owner and next step", tone: openWork.length ? "info" : "positive", link: { href: "/app/work-orders?status=open", label: "See open work" } },
        { id: "open-exceptions", label: "Items to review", value: String(reviewItems.length), supportingText: "Open the queue for source records and next steps", tone: reviewItems.length ? "warning" : "positive", link: { href: "/app/action-center", label: "Open review queue" } },
        { id: "watch-assets", label: "Equipment to review", value: String(scoped.assets.filter((asset) => asset.status === "watch").length), supportingText: "Equipment flagged for a closer look", tone: "warning", link: { href: "/app/equipment?status=watch", label: "Review equipment" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "executive-attention", title: `Review ${reviewItems.length} item${reviewItems.length === 1 ? "" : "s"}`, description: "Open the complete queue for source records, owners, and next steps.", categoryLabel: "Company overview", dueLabel: "Current", ownerLabel: "Maintenance leadership", tone: reviewItems.length ? "warning" : "positive", href: "/app/action-center", linkLabel: "Open review queue" }),
        dashboardShortcut({ id: "executive-store-cost", title: highestCostStore ? `${storeLabel(storeById.get(highestCostStore[0]))} has the highest recorded cost` : "Compare store costs", description: highestCostStore ? `${money(highestCostStore[1])} of rolling recorded work cost; open the hierarchy and source work before drawing a conclusion.` : "No store cost is recorded in this period.", categoryLabel: "Cost visibility", dueLabel: "Rolling 12 months", ownerLabel: "Operations leadership", tone: "info", href: highestCostStore ? hrefWithQuery("/app/spend", { store: highestCostStore[0] }) : "/app/spend", linkLabel: "Explain the store total" }),
        dashboardShortcut({ id: "executive-capital", title: `${repairComparisons.length} repair comparison${repairComparisons.length === 1 ? "" : "s"} to review`, description: "Compare larger repairs with age, expected life, replacement cost, and service history.", categoryLabel: "Equipment planning", dueLabel: "Planning view", ownerLabel: "Maintenance and finance", tone: candidate ? "warning" : "positive", href: "/app/lifecycle?reason=compare+alternatives", linkLabel: "Open equipment planning" }),
        dashboardShortcut({ id: "executive-reports", title: "Open reports", description: "Share or archive reports for open work, costs, vendors, preventive maintenance, and invoice review.", categoryLabel: "Reporting", dueLabel: "Available now", ownerLabel: "Leadership", href: "/app/reports", linkLabel: "Open reports" }),
      ],
      prioritySection: { title: "Owner decisions", description: "The company-level items most likely to need your attention.", link: { href: "/app/action-center", label: "See all" } },
      breakdowns: [storeBreakdown, vendorAccountabilityBreakdown, categoryBreakdown],
      trends: [trend],
      spotlight: lifecycleSpotlight,
    };
  }

  const rollingInvoices = fixture.invoiceReferences.filter(
    (invoice) => invoice.organizationId === scoped.organizationId && invoice.invoiceDate >= periodStart,
  );
  const replacementEstimateTotal = lifecycle.reduce((sum, row) => sum + (row.replacement ?? 0), 0);
  if (session.role === "finance") {
    const invoiceToReview = rollingInvoices.find((invoice) => invoice.matchStatus !== "confirmed");
    return {
      state: { kind: "ready" },
      layout: "finance",
      page: {
        ...pageBase,
        title: "Maintenance cost and evidence",
        eyebrow: "Finance overview",
        description: "Review recorded work cost, supporting work orders, optional invoice references, and capital-planning inputs without stepping into dispatch or field operations.",
        primaryAction: { label: "Explore recorded cost", href: "/app/spend" },
        secondaryAction: { label: "Review invoice safeguards", href: hrefWithQuery("/app/invoices", { from: periodStart }) },
      },
      metrics: [
        { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost; not invoice or payment totals", link: { href: "/app/spend", label: "Explain the total" } },
        { id: "cost-work", label: "Cost-bearing work orders", value: String([...rollingCostByWork.keys()].filter((id) => scoped.workOrders.some((work) => work.id === id)).length), supportingText: "Work orders with entered cost in the rolling period", link: { href: hrefWithQuery("/app/work-orders", { hasCost: "true", costFrom: periodStart }), label: "Open supporting work" } },
        { id: "invoice-references", label: "Invoice references recorded", value: String(rollingInvoices.length), supportingText: "Optional matching evidence; not accounts payable", tone: invoiceToReview ? "warning" : "neutral", link: { href: hrefWithQuery("/app/invoices", { from: periodStart }), label: "Review invoice references" } },
        { id: "replacement-estimates", label: "Current replacement outlook", value: money(replacementEstimateTotal), supportingText: "Dated benchmarks and equipment-specific adjustments across tracked equipment", tone: "info", link: { href: "/app/lifecycle?replacement=entered", label: "Open capital outlook" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "finance-invoices", title: `Review ${rollingInvoices.length} recorded invoice reference${rollingInvoices.length === 1 ? "" : "s"}`, description: "Use operator work-order references and confirmed allocations as an optional safeguard; the platform does not approve or pay invoices.", categoryLabel: "Invoice safeguard", dueLabel: "Optional review", ownerLabel: "Finance", tone: invoiceToReview ? "warning" : "positive", href: hrefWithQuery("/app/invoices", { from: periodStart }), linkLabel: "Open invoice references" }),
        dashboardShortcut({ id: "finance-store-cost", title: "Compare recorded cost by store", description: "Move from each store total through service area, equipment, component, work order, and entered cost lines.", categoryLabel: "Cost visibility", dueLabel: "Rolling 12 months", ownerLabel: "Finance and operations", tone: "info", href: "/app/stores?sort=cost", linkLabel: "Open store ranking" }),
        dashboardShortcut({ id: "finance-capital", title: "Review replacement planning evidence", description: `${money(replacementEstimateTotal)} is the current benchmark-based outlook, not an approved budget.`, categoryLabel: "Lifecycle & CapEx", dueLabel: "Planning view", ownerLabel: "Finance and facilities", href: "/app/lifecycle?replacement=entered", linkLabel: "Open capital outlook" }),
        dashboardShortcut({ id: "finance-reports", title: "Open finance-relevant source views", description: "Recorded cost, work obligations, invoice references, and lifecycle evidence remain separate and traceable.", categoryLabel: "Reporting", dueLabel: "Available now", ownerLabel: "Finance", href: "/app/reports", linkLabel: "Open reports" }),
      ],
      prioritySection: { title: "Financial review paths", description: "Cost and evidence stay distinct so no amount is silently combined or treated as approved.", link: { href: "/app/reports", label: "Open source reports" } },
      breakdowns: [storeBreakdown, categoryBreakdown],
      trends: [trend],
      spotlight: invoiceToReview
        ? {
            eyebrow: "Optional invoice safeguard",
            title: `Review ${invoiceToReview.invoiceNumber} before linking it`,
            description: "This invoice reference is not confirmed against source work. Review the reference and allocations manually; the platform does not approve, reject, or execute payment.",
            facts: [
              { label: "Gross invoice amount", value: money(invoiceToReview.grossAmount.amountMinor) },
              { label: "Match status", value: sentence(invoiceToReview.matchStatus) },
              { label: "Operator work order", value: invoiceToReview.operatorWorkOrderNumber ?? "Not provided" },
              { label: "Vendor", value: vendorById.get(invoiceToReview.vendorId)?.name ?? "Unknown vendor" },
            ],
            link: { href: `/app/invoices/${invoiceToReview.id}`, label: "Review invoice evidence" },
          }
        : lifecycleSpotlight,
    };
  }

  if (session.role === "store_manager") {
    const store = scoped.stores[0];
    return {
      state: { kind: "ready" },
      layout: "store",
      page: {
        ...pageBase,
        title: store ? `Store ${store.storeNumber} at a glance` : "Your store at a glance",
        eyebrow: "Store manager home",
        description: "Report an issue, see who is onsite, follow current work, and understand this store's maintenance cost without corporate clutter.",
        primaryAction: { label: "Report an issue", href: "/app/requests/new" },
        secondaryAction: { label: "Review current work", href: "/app/work-orders?status=open" },
      },
      journey: base.journey,
      metrics: [
        { id: "open-work", label: "Open work", value: String(openWork.length), supportingText: "Current maintenance obligations for this store", tone: openWork.length ? "warning" : "positive", link: { href: "/app/work-orders?status=open", label: "Open current work" } },
        { id: "vendor-response", label: "Awaiting vendor response", value: String(awaitingVendor.length), supportingText: "Approved, issued, or waiting on vendor", tone: awaitingVendor.length ? "warning" : "positive", link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" } },
        { id: "recorded-visits", label: "Recorded service visits", value: String(scoped.visits.length), supportingText: `${activeVisits.length} onsite now · ${completedVisits.length} completed`, tone: activeVisits.length ? "info" : "neutral", link: { href: "/app/visits", label: "Open visit history" } },
        { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost for this store", link: { href: "/app/spend", label: "Explain the total" } },
      ],
      priorityActions: [
        dashboardShortcut({ id: "store-report", title: "Report a new store issue", description: "Capture the problem, reporter, priority, and optional photos. Equipment can be classified later.", categoryLabel: "Issue intake", dueLabel: "When needed", ownerLabel: "Store team", tone: "info", href: "/app/requests/new", linkLabel: "Report an issue" }),
        dashboardShortcut({ id: "store-work", title: `Review ${openWork.length} open work order${openWork.length === 1 ? "" : "s"}`, description: "See who owns the work, what happens next, and when it is due.", categoryLabel: "Current work", dueLabel: "Current", ownerLabel: "Store and maintenance", tone: openWork.length ? "warning" : "positive", href: "/app/work-orders?status=open", linkLabel: "Open current work" }),
        dashboardShortcut({ id: "store-visits", title: `Review ${completedVisits.length} completed service visit${completedVisits.length === 1 ? "" : "s"}`, description: "See arrival, checkout, outcome, photos, and any follow-up tied to this store.", categoryLabel: "Vendor visits", dueLabel: "History", ownerLabel: "Store team", href: "/app/visits?status=checked_out", linkLabel: "Open visit history" }),
        dashboardShortcut({ id: "store-record", title: "Open the complete store record", description: "Move between cost, issues, work, visits, equipment, PM, and public entry points from one place.", categoryLabel: "Store record", dueLabel: "Available now", ownerLabel: "Store manager", href: store ? `/app/stores/${store.id}` : "/app/stores", linkLabel: "Open store" }),
      ],
      prioritySection: { title: "Your store workflow", description: "The four places a store manager should need most often.", link: { href: store ? `/app/stores/${store.id}` : "/app/stores", label: "Open complete store record" } },
      breakdowns: [categoryBreakdown],
      trends: [trend],
    };
  }

  const workStatusCounts = new Map<string, number>();
  for (const work of openWork) workStatusCounts.set(work.status, (workStatusCounts.get(work.status) ?? 0) + 1);
  const activeVendorCounts = new Map<string, number>();
  for (const visit of activeVisits) if (visit.vendorId) {
    activeVendorCounts.set(visit.vendorId, (activeVendorCounts.get(visit.vendorId) ?? 0) + 1);
  }
  const isFacilities = session.role === "facilities";
  return {
    state: { kind: "ready" },
    layout: isFacilities ? "operations" : "regional",
    page: {
      ...pageBase,
      title: isFacilities ? "Maintenance overview" : "Your region at a glance",
      eyebrow: isFacilities ? "Daily maintenance" : "Regional overview",
      description: isFacilities
        ? "See what is waiting for review, who is onsite, where work stands, and how maintenance costs are moving."
        : "See stores, open work, vendor activity, and recorded costs across your region.",
      primaryAction: { label: "Open review queue", href: "/app/action-center" },
      secondaryAction: { label: "Create work order", href: "/app/work-orders/new" },
    },
    journey: base.journey,
    metrics: isFacilities
      ? [
          { id: "open-exceptions", label: "Items to review", value: String(reviewItems.length), supportingText: "Open the queue for records, owners, and next steps", tone: reviewItems.length ? "warning" : "positive", link: { href: "/app/action-center", label: "Open review queue" } },
          { id: "vendor-response", label: "Awaiting vendor response", value: String(awaitingVendor.length), supportingText: "Ready to send, sent, or waiting on vendor", tone: awaitingVendor.length ? "warning" : "positive", link: { href: "/app/work-orders?stage=vendor-response", label: "Open vendor queue" } },
          { id: "active-visits", label: "Vendors onsite now", value: String(activeVisits.length), supportingText: `${scoped.visits.length} total visits recorded`, tone: activeVisits.length ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open live visits" } },
          { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Entered work costs for the last 12 months", link: { href: "/app/spend", label: "See the costs" } },
        ]
      : [
          { id: "open-work", label: "Open work", value: String(openWork.length), supportingText: "Each item has an owner, next step, and due date", tone: openWork.length ? "info" : "positive", link: { href: "/app/work-orders?status=open", label: "Open regional work" } },
          { id: "open-exceptions", label: "Items to review", value: String(reviewItems.length), supportingText: "Open the regional queue for records and next steps", tone: reviewItems.length ? "warning" : "positive", link: { href: "/app/action-center", label: "Open review queue" } },
          { id: "active-visits", label: "Vendors onsite now", value: String(activeVisits.length), supportingText: `${scoped.visits.length} recorded visits in regional scope`, tone: activeVisits.length ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open live visits" } },
          { id: "recorded-cost", label: "Recorded work cost", value: money(recordedCost), supportingText: "Rolling source cost inside your region", link: { href: "/app/spend", label: "Explain the total" } },
        ],
    priorityActions: reviewItems.slice(0, 6),
    prioritySection: { title: "Review queue", description: isFacilities ? "Items waiting for a decision, update, or owner." : "Items waiting for action across stores in your region.", link: { href: "/app/action-center", label: "Open review queue" }, display: "summary" },
    breakdowns: isFacilities
      ? [
          countBreakdown("open-work-status", "Open work by status", workStatusCounts, (key) => hrefWithQuery("/app/work-orders", { status: key }), { description: "Every segment opens the work orders currently carrying that status.", labelFor: (key) => workStatusLabel(key as WorkOrder["status"]), totalNoun: "open work orders", sourceLink: { href: "/app/work-orders?status=open", label: "Open every maintenance obligation" } }),
          countBreakdown("onsite-vendor", "Who is onsite now", activeVendorCounts, (key) => hrefWithQuery("/app/visits", { status: "active", vendor: key }), { description: "Observed active visits by outside vendor; time and location are presence evidence, not certified labor.", labelFor: (key) => vendorById.get(key)?.name ?? "Unknown vendor", totalNoun: "active visits", sourceLink: { href: "/app/visits?status=active", label: "Open all live visits" } }),
        ]
      : [storeBreakdown, categoryBreakdown],
    trends: [trend],
    spotlight: lifecycleSpotlight,
  };
}

const columns: Record<OperatorListRoute, TableColumnViewModel[]> = {
  "action-center": [
    { key: "item", label: "Next action" },
    { key: "store", label: "Location" },
    { key: "record", label: "Related record" },
    { key: "owner", label: "Owner" },
    { key: "due", label: "When" },
    { key: "priority", label: "Priority" },
  ],
  requests: [
    { key: "request", label: "Request" },
    { key: "store", label: "Store" },
    { key: "priority", label: "Priority" },
    { key: "reported", label: "Reported" },
    { key: "status", label: "Status" },
  ],
  "work-orders": [
    { key: "work", label: "Work order" },
    { key: "store", label: "Store" },
    { key: "assignment", label: "Assigned to" },
    { key: "next", label: "Next action" },
    { key: "cost", label: "Recorded cost", align: "end" },
    { key: "status", label: "Status" },
  ],
  estimates: [
    { key: "request", label: "Bid request" },
    { key: "work", label: "Work order / store" },
    { key: "vendor", label: "Vendor" },
    { key: "amount", label: "Latest proposal", align: "end" },
    { key: "due", label: "Response due" },
    { key: "status", label: "Status" },
  ],
  visits: [
    { key: "visit", label: "Visit" },
    { key: "store", label: "Store" },
    { key: "vendor", label: "Vendor" },
    { key: "work", label: "Work order" },
    { key: "observed", label: "Timing" },
    { key: "evidence", label: "Evidence" },
    { key: "outcome", label: "Outcome" },
  ],
  stores: [
    { key: "store", label: "Store" },
    { key: "region", label: "Region" },
    { key: "address", label: "Address" },
    { key: "work", label: "Open work", align: "end" },
    { key: "onsite", label: "Onsite now", align: "end" },
    { key: "cost", label: "Recorded cost", align: "end" },
  ],
  vendors: [
    { key: "vendor", label: "Vendor" },
    { key: "specialties", label: "Specialties" },
    { key: "coverage", label: "Coverage" },
    { key: "open", label: "Open work", align: "end" },
    { key: "visits", label: "Recent visits", align: "end" },
    { key: "status", label: "Status" },
  ],
  invoices: [
    { key: "invoice", label: "Invoice reference" },
    { key: "work", label: "Work order" },
    { key: "vendor", label: "Vendor" },
    { key: "store", label: "Store" },
    { key: "amount", label: "Linked in scope / gross", align: "end" },
    { key: "status", label: "Match status" },
  ],
  reports: [
    { key: "report", label: "Live report" },
    { key: "scope", label: "Scope" },
    { key: "period", label: "Period" },
    { key: "basis", label: "Definition" },
    { key: "status", label: "Status" },
  ],
  admin: [
    { key: "area", label: "Configuration area" },
    { key: "summary", label: "Current setup" },
    { key: "owner", label: "Owner" },
    { key: "status", label: "Status" },
  ],
};

const listMeta: Record<OperatorListRoute, { title: string; eyebrow: string; description: string; placeholder?: string }> = {
  "action-center": { title: "Needs attention", eyebrow: "Review queue", description: "This is your to-do list. Start at the top, open an item, and take the next step.", placeholder: "Search this list" },
  requests: { title: "Service requests", eyebrow: "Reported issues", description: "Review what store teams reported, then create work, escalate it, or close it without changing the original report.", placeholder: "Search problem, reporter, request, or store" },
  "work-orders": { title: "Work orders", eyebrow: "Maintenance work", description: "Track internal and outside service from creation through visits, follow-up, and recorded cost.", placeholder: "Search number, problem, store, vendor, or category" },
  estimates: { title: "Bid requests", eyebrow: "Request pricing", description: "Ask one or more vendors for pricing without creating duplicate work orders, visits, or costs.", placeholder: "Search work order, store, vendor, scope, or amount" },
  visits: { title: "Service visits", eyebrow: "Observed service", description: "See who arrived, why, the evidence captured, and which visits need review—without treating presence as certified labor.", placeholder: "Search technician, vendor, store, or work order" },
  stores: { title: "Stores", eyebrow: "Operating network", description: "Find any location by store number, address, name, city, or alias and open its maintenance history.", placeholder: "Search store number, name, address, city, or alias" },
  vendors: { title: "Approved vendors", eyebrow: "Vendor network", description: "Search by name, specialty, plain-language alias, equipment type, and coverage.", placeholder: "Search vendor, plumber, refrigeration, dispenser, or equipment" },
  invoices: { title: "Invoice review", eyebrow: "Optional invoice check", description: "Compare manually entered invoices with work orders and visits. Payment still happens in your accounting system.", placeholder: "Search invoice, work order, vendor, or store" },
  reports: { title: "Reports", eyebrow: "Share and archive", description: "Open live reports, see the records behind them, and export the view you need.", placeholder: "Search report name or definition" },
  admin: { title: "Setup", eyebrow: "Company setup", description: "Manage stores, approved vendors, service areas, and reusable equipment templates.", placeholder: "Search stores, vendors, service areas, or equipment templates" },
};

const filterLabels: Record<string, string> = {
  active: "Onsite now",
  checked_out: "Completed visits",
  amended: "Amended visits",
  open: "Open",
  refrigeration: "Refrigeration",
  hvac: "HVAC",
  forecourt: "Forecourt",
  plumbing: "Plumbing",
  electrical: "Electrical",
  exterior: "Exterior services",
  exception: "Records to check",
  "service-record": "Records to check",
  "follow-up": "Follow-ups",
  "vendor-reminder": "Vendor tasks",
  "vendor-task": "Vendor tasks",
  true: "With recorded cost",
  ready: "Approved for next suitable visit",
  upcoming: "Upcoming visits",
};

function heldWorkInstruction(posture: "complete_using_professional_judgment" | "look_and_report") {
  return posture === "look_and_report" ? "Inspect and report back" : "Complete during the visit if practical";
}

function heldWorkReviewLabel(deadlineAt: string, asOf: string) {
  const dayCount = Math.ceil((Date.parse(deadlineAt) - Date.parse(asOf)) / 86_400_000);
  if (dayCount < 0) return `${Math.abs(dayCount)} day${Math.abs(dayCount) === 1 ? "" : "s"} past review date`;
  if (dayCount === 0) return "Review today";
  return `Review in ${dayCount} day${dayCount === 1 ? "" : "s"}`;
}

function routePath(route: OperatorListRoute): string {
  return `/app/${route}`;
}

function queryEntries(query: OperatorSearchParameters): Array<[string, string]> {
  return Object.entries(query).flatMap(([key, raw]) => {
    const value = first(raw);
    return value ? [[key, value] as [string, string]] : [];
  });
}

function hrefWithoutQueryKey(route: OperatorListRoute, query: OperatorSearchParameters, keyToRemove: string): string {
  const params = new URLSearchParams(queryEntries(query).filter(([key]) => key !== keyToRemove && key !== "page"));
  const serialized = params.toString();
  return serialized ? `${routePath(route)}?${serialized}` : routePath(route);
}

function appliedFilters(
  fixture: OpsFixture,
  scoped: ScopedFixture,
  route: OperatorListRoute,
  query: OperatorSearchParameters,
) {
  const stores = new Map(scoped.stores.map((store) => [store.id, store]));
  const vendors = new Map(
    fixture.vendors
      .filter((vendor) => vendor.organizationId === scoped.organizationId)
      .map((vendor) => [vendor.id, vendor]),
  );
  const assets = new Map(scoped.assets.map((asset) => [asset.id, asset]));
  const ignored = new Set(["q", "page", "selected", "matchStore"]);
  return queryEntries(query)
    .filter(([key]) => !ignored.has(key))
    .map(([key, value]) => {
      let label = filterLabels[value] ?? sentence(value);
      if (key === "store") label = storeLabel(stores.get(value));
      else if (key === "vendor") label = vendors.get(value)?.name ?? "Selected vendor";
      else if (key === "asset") label = assets.get(value)?.name ?? (value === "unlinked" ? "No equipment linked" : "Selected equipment");
      else if (key === "costFrom") label = `Cost from ${date(value)}`;
      else if (key === "costMonth") label = `Cost month ${monthLabel(value)}`;
      else if (key === "path") label = value.split("|").at(-1) ?? value;
      else if (key === "exception") label = "Selected exception";
      else if (key === "visit") label = "Selected visit";
      else if (key === "review") label = "Needs review";
      else if (key === "reviewWindow" && value === "30") label = "Review within 30 days";
      else if (key === "opportunity" && value === "confirmed") label = "Confirmed visit matches";
      else if (key === "storeGroup" && value === "multiple") label = "Stores with 2+ approved jobs";
      else if (key === "matchStore") return undefined;
      return { id: key, label, removeHref: hrefWithoutQueryKey(route, query, key) };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function searchable(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ").toLocaleLowerCase("en-US");
}

function workRows(
  fixture: OpsFixture,
  scoped: ScopedFixture,
  query: OperatorSearchParameters,
  canManageApprovedLater = false,
): TableRowViewModel[] {
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const organizationName = fixture.organizations.find((organization) => organization.id === scoped.organizationId)?.name ?? "Customer";
  const costFrom = first(query.costFrom);
  const costMonth = first(query.costMonth);
  const costByWork = costMonth
    ? fixture.costLines.reduce((result, line) => {
        if (
          line.organizationId === scoped.organizationId &&
          line.serviceDate.startsWith(costMonth) &&
          (!costFrom || line.serviceDate >= costFrom)
        ) result.set(line.workOrderId, (result.get(line.workOrderId) ?? 0) + line.amount.amountMinor);
        return result;
      }, new Map<string, number>())
    : recordedCostByWork(fixture, scoped.organizationId, costFrom);
  const q = cleanSearch(first(query.q));
  const category = first(query.category);
  const status = first(query.status);
  const stage = first(query.stage);
  const storeId = first(query.store);
  const regionId = first(query.region);
  const vendorId = first(query.vendor);
  const hasCost = first(query.hasCost) === "true";
  const asset = first(query.asset);
  const component = first(query.component);
  const path = pathSegments(first(query.path));
  const visitPlan = first(query.visitPlan);
  const assetById = new Map(scoped.assets.map((candidate) => [candidate.id, candidate]));
  const activeHoldByWork = new Map(
    (fixture.workOrderVisitHolds ?? [])
      .filter((hold) => hold.organizationId === scoped.organizationId && hold.status === "active" && scoped.workOrders.some((work) => work.id === hold.workOrderId && work.status === "approved"))
      .map((hold) => [hold.workOrderId, hold]),
  );
  return scoped.workOrders
    .filter((work) => {
      if (!q) return true;
      const assignment = assignmentForWork(fixture, scoped.organizationId, work.id);
      const assignee = assignment?.kind === "outside_vendor"
        ? vendorName(fixture, scoped.organizationId, assignment.vendorId)
        : assignment?.kind === "internal"
          ? "Internal maintenance"
          : "Choose later";
      return searchable(work.number, work.problem, work.categoryKey, storeLabel(storeById.get(work.storeId)), assignee).includes(q);
    })
    .filter((work) => !category || (work.categoryKey ?? "unclassified") === category)
    .filter((work) => !storeId || work.storeId === storeId)
    .filter((work) => !regionId || storeById.get(work.storeId)?.regionId === regionId)
    .filter((work) => !vendorId || assignmentForWork(fixture, scoped.organizationId, work.id)?.vendorId === vendorId)
    .filter((work) => !hasCost || (costByWork.get(work.id) ?? 0) > 0)
    .filter((work) => !costMonth || fixture.costLines.some((line) => line.organizationId === scoped.organizationId && line.workOrderId === work.id && line.serviceDate.startsWith(costMonth)))
    .filter((work) => !asset || (asset === "unlinked" ? !work.assetId : work.assetId === asset))
    .filter((work) => !component || (component === "unlinked" ? !work.componentId : work.componentId === component))
    .filter((work) => path.length === 0 || assetMatchesPath(work.assetId ? assetById.get(work.assetId) : undefined, path))
    .filter((work) => !visitPlan || (visitPlan === "ready" && activeHoldByWork.has(work.id)))
    .filter((work) => !status || (status === "open" ? !["closed", "cancelled"].includes(work.status) : work.status === status))
    .filter((work) => !stage || (stage === "vendor-response" && ["approved", "issued", "waiting_on_vendor"].includes(work.status)))
    .sort((a, b) => {
      if (visitPlan === "ready") {
        const aDeadline = activeHoldByWork.get(a.id)?.deadlineAt ?? a.dueAt ?? a.createdAt;
        const bDeadline = activeHoldByWork.get(b.id)?.deadlineAt ?? b.dueAt ?? b.createdAt;
        return aDeadline.localeCompare(bDeadline) || a.number.localeCompare(b.number);
      }
      return b.createdAt.localeCompare(a.createdAt);
    })
    .map((work) => {
      const assignment = assignmentForWork(fixture, scoped.organizationId, work.id);
      const hold = activeHoldByWork.get(work.id);
      const assignee = assignment?.kind === "outside_vendor"
        ? vendorName(fixture, scoped.organizationId, assignment.vendorId)
        : assignment?.kind === "internal"
          ? "Internal maintenance"
          : hold
            ? "Ready for a suitable visit"
            : "Choose later";
      const store = storeById.get(work.storeId);
      const storeTimeZone = store?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
      const coveredVendorIds = new Set(
        store
          ? fixture.vendorCoverage
              .filter((coverage) => {
                if (coverage.organizationId !== scoped.organizationId) return false;
                if (coverage.scopeKind === "organization") return coverage.scopeId === scoped.organizationId;
                if (coverage.scopeKind === "store") return coverage.scopeId === store.id;
                return coverage.scopeKind === "region" && coverage.scopeId === store.regionId;
              })
              .map((coverage) => coverage.vendorId)
          : [],
      );
      const issueVendors = fixture.vendors
        .filter((vendor) => vendor.organizationId === scoped.organizationId && vendor.status === "approved" && coveredVendorIds.has(vendor.id))
        .sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.name.localeCompare(right.name))
        .map((vendor) => ({
          value: vendor.id,
          label: vendor.name,
          description: fixture.vendorSpecialties
            .filter((specialty) => specialty.organizationId === scoped.organizationId && specialty.vendorId === vendor.id)
            .map((specialty) => specialty.displayName)
            .join(", ") || "Approved service vendor",
          dispatchEmail: vendor.dispatchEmail,
          preferred: vendor.preferred,
        }));
      const currentIssuanceRevision = fixture.issuances
        .filter((issuance) => issuance.organizationId === scoped.organizationId && issuance.workOrderId === work.id)
        .reduce((highest, issuance) => Math.max(highest, issuance.revision), 0);
      const workAsset = work.assetId ? assetById.get(work.assetId) : undefined;
      return {
        id: work.id,
        label: work.number,
        href: `/app/work-orders/${work.id}`,
        management: hold && store ? {
          kind: "approved_later" as const,
          workOrderId: work.id,
          workOrderNumber: work.number,
          organizationName,
          storeId: store.id,
          storeLabel: `Store ${store.storeNumber} · ${store.name}`,
          storeAddress: [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "),
          storeTimeZone,
          problem: work.problem,
          workScope: work.authorizedScope ?? work.problem,
          categoryLabel: work.categoryKey ? sentence(work.categoryKey) : "Not classified",
          equipmentLabel: workAsset ? `${workAsset.name}${workAsset.assetTag ? ` · ${workAsset.assetTag}` : ""}` : undefined,
          requestedTimingLabel: work.dueAt ? formatOperationsDateTime(work.dueAt, storeTimeZone) : undefined,
          posture: hold.posture,
          priority: work.priority,
          deadlineInputValue: dateTimeInputInZone(hold.deadlineAt, storeTimeZone),
          reviewByLabel: formatOperationsDateTime(hold.deadlineAt, storeTimeZone),
          internalReviewThresholdInputValue: hold.internalReviewThreshold
            ? String(hold.internalReviewThreshold.amountMinor / 100)
            : undefined,
          currentIssuanceRevision,
          selectedVendorId: assignment?.kind === "outside_vendor" && assignment.status !== "declined" ? assignment.vendorId : undefined,
          vendors: issueVendors,
          canManage: canManageApprovedLater,
        } : undefined,
        cells: [
          { key: "work", value: work.number, secondary: work.problem },
          { key: "store", value: store ? `Store ${store.storeNumber}` : "Store unavailable", secondary: store?.city },
          { key: "assignment", value: hold ? "Waiting for a suitable visit" : assignee ?? "Not assigned", secondary: hold ? heldWorkInstruction(hold.posture) : assignment ? sentence(assignment.status) : "Assignment needed" },
          { key: "next", value: hold ? heldWorkReviewLabel(hold.deadlineAt, fixture.asOf) : work.nextAction, secondary: hold ? `Review if not handled by ${date(hold.deadlineAt)}` : work.accountableParty },
          { key: "cost", value: money(costByWork.get(work.id) ?? 0) },
          { key: "status", value: hold ? "Approved for next suitable visit" : workStatusLabel(work.status), tone: hold ? "info" : workStatusTone(work.status) },
        ],
      };
    });
}

function visitRows(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): TableRowViewModel[] {
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const workById = new Map(scoped.workOrders.map((work) => [work.id, work]));
  const q = cleanSearch(first(query.q));
  const status = first(query.status);
  const storeId = first(query.store);
  const vendorId = first(query.vendor);
  const reviewOnly = first(query.review) === "true";
  const visitId = first(query.visit);
  const exceptionId = first(query.exception);
  const exceptionVisitId = exceptionId
    ? fixture.exceptions.find((item) => item.organizationId === scoped.organizationId && item.id === exceptionId)?.visitId
    : undefined;
  const reviewVisitIds = new Set(
    fixture.exceptions
      .filter((item) => item.organizationId === scoped.organizationId && item.status !== "resolved" && item.visitId)
      .map((item) => item.visitId!),
  );
  if (status === "upcoming") {
    const assignmentById = new Map(
      fixture.assignments
        .filter((assignment) => assignment.organizationId === scoped.organizationId)
        .map((assignment) => [assignment.id, assignment]),
    );
    return (fixture.serviceAppointments ?? [])
      .filter((appointment) => appointment.organizationId === scoped.organizationId && appointment.status === "confirmed")
      .filter((appointment) => Date.parse(appointment.startsAt) >= Date.parse(fixture.asOf))
      .map((appointment) => ({ appointment, work: workById.get(appointment.workOrderId), assignment: assignmentById.get(appointment.assignmentId) }))
      .filter((item): item is typeof item & { work: NonNullable<typeof item.work> } => Boolean(item.work))
      .filter(({ work }) => !storeId || work.storeId === storeId)
      .filter(({ assignment }) => !vendorId || assignment?.vendorId === vendorId)
      .filter(({ appointment, work, assignment }) => {
        const store = storeById.get(work.storeId);
        return !q || searchable(work.number, work.problem, storeLabel(store), vendorName(fixture, scoped.organizationId, assignment?.vendorId), appointment.note).includes(q);
      })
      .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt))
      .map(({ appointment, work, assignment }) => {
        const store = storeById.get(work.storeId);
        const storeTimeZone = store?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
        return {
          id: appointment.id,
          label: `${work.number} scheduled service`,
          href: `/app/work-orders/${work.id}?view=service`,
          cells: [
            { key: "visit", value: "Scheduled service", secondary: work.problem },
            { key: "store", value: store ? `Store ${store.storeNumber}` : "Store unavailable", secondary: store?.city },
            { key: "vendor", value: vendorName(fixture, scoped.organizationId, assignment?.vendorId) ?? "Vendor not recorded" },
            { key: "work", value: work.number },
            { key: "observed", value: dateTime(appointment.startsAt, storeTimeZone), secondary: "Confirmed appointment · store-local time" },
            { key: "evidence", value: "Confirmed with vendor", tone: "positive" },
            { key: "outcome", value: "Upcoming", tone: "info" },
          ],
        };
      });
  }
  return scoped.visits
    .filter((visit) => !status || visit.status === status)
    .filter((visit) => !storeId || visit.storeId === storeId)
    .filter((visit) => !vendorId || visit.vendorId === vendorId)
    .filter((visit) => !reviewOnly || !visit.workOrderId || reviewVisitIds.has(visit.id))
    .filter((visit) => !visitId || visit.id === visitId)
    .filter((visit) => !exceptionId || visit.id === exceptionVisitId)
    .filter((visit) => !q || searchable(visit.technicianName, visit.providerName, visit.purpose, workById.get(visit.workOrderId ?? "")?.number, storeLabel(storeById.get(visit.storeId))).includes(q))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
    .map((visit) => {
      const store = storeById.get(visit.storeId);
      const storeTimeZone = store?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
      const evidence = fixture.visitEvidence.filter((item) => item.organizationId === scoped.organizationId && item.visitId === visit.id);
      const checkIn = evidence.find((item) => item.kind === "check_in");
      const work = visit.workOrderId ? workById.get(visit.workOrderId) : undefined;
      return {
        id: visit.id,
        label: `${visit.providerName} visit`,
        href: `/app/visits/${visit.id}`,
        cells: [
          { key: "visit", value: visit.technicianName, secondary: visit.purpose },
          { key: "store", value: storeLabel(store) },
          { key: "vendor", value: visit.providerName },
          { key: "work", value: work?.number ?? "No work order", secondary: visit.unmatchedReason },
          { key: "observed", value: visit.checkedOutAt ? `${dateTime(visit.checkedInAt, storeTimeZone)} – ${dateTime(visit.checkedOutAt, storeTimeZone)}` : `Since ${dateTime(visit.checkedInAt, storeTimeZone)}`, secondary: "Store-local time · approximate presence, not labor" },
          { key: "evidence", value: checkIn?.location?.result ? sentence(checkIn.location.result) : "No location evidence", tone: checkIn?.location?.result === "verified" ? "positive" : "warning" },
          { key: "outcome", value: visit.outcome ? sentence(visit.outcome) : "Onsite now", tone: visit.status === "active" ? "info" : "neutral" },
        ],
      };
    });
}

function visitMetrics(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): MetricViewModel[] {
  const selectedStore = first(query.store);
  const selectedVendor = first(query.vendor);
  const base = scoped.visits
    .filter((visit) => !selectedStore || visit.storeId === selectedStore)
    .filter((visit) => !selectedVendor || visit.vendorId === selectedVendor);
  const openExceptionVisitIds = new Set(
    fixture.exceptions
      .filter(
        (exception) =>
          exception.organizationId === scoped.organizationId &&
          exception.status !== "resolved" &&
          Boolean(exception.visitId),
      )
      .map((exception) => exception.visitId!),
  );
  const withContext = (status?: string) => hrefWithQuery("/app/visits", {
    store: selectedStore,
    vendor: selectedVendor,
    status,
  });
  const active = base.filter((visit) => visit.status === "active").length;
  const completed = base.filter((visit) => visit.status !== "active").length;
  const scopedWorkIds = new Set(scoped.workOrders.map((work) => work.id));
  const upcoming = (fixture.serviceAppointments ?? []).filter((appointment) => {
    if (appointment.organizationId !== scoped.organizationId || appointment.status !== "confirmed" || !scopedWorkIds.has(appointment.workOrderId)) return false;
    if (Date.parse(appointment.startsAt) < Date.parse(fixture.asOf)) return false;
    const assignment = fixture.assignments.find((candidate) => candidate.organizationId === scoped.organizationId && candidate.id === appointment.assignmentId);
    return !selectedVendor || assignment?.vendorId === selectedVendor;
  }).length;
  const noWorkOrder = base.filter((visit) => !visit.workOrderId).length;
  const needsReviewIds = new Set(
    base
      .filter((visit) => openExceptionVisitIds.has(visit.id) || !visit.workOrderId)
      .map((visit) => visit.id),
  );
  return [
    { id: "upcoming-visits", label: "Upcoming", value: String(upcoming), supportingText: "Vendor-confirmed appointments", tone: upcoming ? "info" : "neutral", link: { href: withContext("upcoming"), label: "Show upcoming" } },
    { id: "active-visits", label: "Onsite now", value: String(active), supportingText: "Active check-ins", tone: active ? "info" : "neutral", link: { href: withContext("active"), label: "Show onsite" } },
    { id: "completed-visits", label: "Completed", value: String(completed), supportingText: "Checked-out visit history", tone: "positive", link: { href: withContext("checked_out"), label: "Show history" } },
    { id: "visit-review", label: "Needs review", value: String(needsReviewIds.size), supportingText: `${noWorkOrder} without a work order`, tone: needsReviewIds.size ? "warning" : "positive", link: { href: hrefWithQuery("/app/visits", { store: selectedStore, vendor: selectedVendor, review: "true" }), label: "Review visits" } },
  ];
}

function storeRows(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): TableRowViewModel[] {
  const costByWork = recordedCostByWork(fixture, scoped.organizationId);
  const regionById = new Map(fixture.regions.filter((region) => region.organizationId === scoped.organizationId).map((region) => [region.id, region]));
  const q = cleanSearch(first(query.q));
  const sort = first(query.sort);
  return scoped.stores
    .filter((store) => !q || searchable(store.storeNumber, store.name, storeAddress(store), ...store.aliases).includes(q))
    .sort((a, b) => {
      if (sort === "cost") {
        const aCost = costForWorkIds(costByWork, scoped.workOrders.filter((work) => work.storeId === a.id).map((work) => work.id));
        const bCost = costForWorkIds(costByWork, scoped.workOrders.filter((work) => work.storeId === b.id).map((work) => work.id));
        return bCost - aCost || a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true });
      }
      return a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true });
    })
    .map((store) => {
      const work = scoped.workOrders.filter((item) => item.storeId === store.id);
      return {
        id: store.id,
        label: storeLabel(store),
        href: `/app/stores/${store.id}`,
        cells: [
          { key: "store", value: `Store ${store.storeNumber}`, secondary: store.name },
          { key: "region", value: regionById.get(store.regionId ?? "")?.name ?? "No region" },
          { key: "address", value: storeAddress(store) },
          { key: "work", value: String(work.filter((item) => !["closed", "cancelled"].includes(item.status)).length) },
          { key: "onsite", value: String(scoped.visits.filter((visit) => visit.storeId === store.id && visit.status === "active").length) },
          { key: "cost", value: money(costForWorkIds(costByWork, work.map((item) => item.id))) },
        ],
      };
    });
}

const vendorServiceAssignmentStatuses = new Set(["issued", "opened", "accepted", "completed"]);

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function elapsedLabel(hours: number | undefined): string {
  if (hours === undefined) return "No response recorded";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

function ratioLabel(numerator: number, denominator: number): string {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "Not enough history";
}

interface VendorEvidenceBundle {
  summary: VendorPerformanceSummary;
  medianResponseHours?: number;
  authorizationRows: VendorAuthorizationEvidenceRow[];
  accountabilityRows: VendorAccountabilityEvidenceRow[];
  repeatVisitRows: VendorRepeatVisitEvidenceRow[];
  visitRows: VendorVisitEvidenceRow[];
  costRows: VendorCostEvidenceRow[];
  coverageRows: VendorCoverageEvidenceRow[];
  complianceRows: VendorComplianceEvidenceRow[];
  qualificationRows: VendorQualificationEvidenceRow[];
  regionLabels: string[];
  searchTerms: string[];
}

function buildVendorEvidenceBundle(
  fixture: OpsFixture,
  scoped: ScopedFixture,
  vendor: OpsFixture["vendors"][number],
): VendorEvidenceBundle {
  const organizationTimeZone = fixture.organizations.find((organization) => organization.id === scoped.organizationId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const allScopedWorkIds = new Set(scoped.workOrders.map((work) => work.id));
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const workById = new Map(scoped.workOrders.map((work) => [work.id, work]));
  const regionById = new Map(
    fixture.regions
      .filter((region) => region.organizationId === scoped.organizationId)
      .map((region) => [region.id, region]),
  );
  const costByWork = recordedCostByWork(fixture, scoped.organizationId);
  const costLineCountByWork = fixture.costLines.reduce((counts, line) => {
    if (line.organizationId === scoped.organizationId && allScopedWorkIds.has(line.workOrderId)) {
      counts.set(line.workOrderId, (counts.get(line.workOrderId) ?? 0) + 1);
    }
    return counts;
  }, new Map<string, number>());

  const vendorAssignments = fixture.assignments.filter(
    (assignment) =>
      assignment.organizationId === scoped.organizationId &&
      assignment.vendorId === vendor.id &&
      allScopedWorkIds.has(assignment.workOrderId),
  );
  const vendorAssignmentIds = new Set(vendorAssignments.map((assignment) => assignment.id));
  const attributedWork = scoped.workOrders.filter(
    (work) => assignmentForWork(fixture, scoped.organizationId, work.id)?.vendorId === vendor.id,
  );
  const attributedWorkIds = new Set(attributedWork.map((work) => work.id));
  const serviceWorkIds = new Set(
    vendorAssignments
      .filter((assignment) => vendorServiceAssignmentStatuses.has(assignment.status))
      .filter((assignment) => workById.get(assignment.workOrderId)?.status !== "cancelled")
      .map((assignment) => assignment.workOrderId),
  );

  const vendorVisits = scoped.visits
    .filter((visit) => visit.vendorId === vendor.id)
    .sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt));
  const linkedVisitsByWork = new Map<string, VisitSession[]>();
  for (const visit of vendorVisits) {
    if (!visit.workOrderId) continue;
    const current = linkedVisitsByWork.get(visit.workOrderId) ?? [];
    current.push(visit);
    linkedVisitsByWork.set(visit.workOrderId, current);
  }
  const coveredServiceWorkCount = [...serviceWorkIds].filter((workOrderId) => linkedVisitsByWork.has(workOrderId)).length;
  const noWorkOrderVisits = vendorVisits.filter((visit) => !visit.workOrderId);
  const checkedOutVisits = vendorVisits.filter((visit) => visit.status !== "active");
  const unresolvedVisits = checkedOutVisits.filter(
    (visit) => Boolean(visit.outcome && unresolvedOutcomesForPresentation.has(visit.outcome)),
  );
  const repeatVisitWorkIds = [...linkedVisitsByWork.entries()]
    .filter(([, visits]) => visits.length > 1)
    .map(([workOrderId]) => workOrderId);

  const vendorIssuances = fixture.issuances
    .filter(
      (issuance) =>
        issuance.organizationId === scoped.organizationId &&
        vendorAssignmentIds.has(issuance.assignmentId) &&
        allScopedWorkIds.has(issuance.workOrderId),
    )
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt) || right.revision - left.revision);
  const validResponses = fixture.vendorResponses.filter(
    (response) =>
      response.organizationId === scoped.organizationId &&
      vendorAssignmentIds.has(response.assignmentId) &&
      vendorIssuances.some((issuance) => issuance.id === response.issuanceId),
  );
  const firstResponseByIssuance = new Map<string, OpsFixture["vendorResponses"][number]>();
  const terminalResponseByIssuance = new Map<string, OpsFixture["vendorResponses"][number]>();
  for (const issuance of vendorIssuances) {
    const responses = validResponses
      .filter(
        (response) =>
          response.issuanceId === issuance.id &&
          response.assignmentId === issuance.assignmentId &&
          Date.parse(response.respondedAt) >= Date.parse(issuance.issuedAt),
      )
      .sort((left, right) => left.respondedAt.localeCompare(right.respondedAt) || left.id.localeCompare(right.id));
    if (responses[0]) firstResponseByIssuance.set(issuance.id, responses[0]);
    const terminal = responses.find((response) => response.response === "accepted" || response.response === "declined");
    if (terminal) terminalResponseByIssuance.set(issuance.id, terminal);
  }
  const responseHours = vendorIssuances.flatMap((issuance) => {
    const response = firstResponseByIssuance.get(issuance.id);
    if (!response) return [];
    const hours = (Date.parse(response.respondedAt) - Date.parse(issuance.issuedAt)) / 3_600_000;
    return Number.isFinite(hours) && hours >= 0 ? [hours] : [];
  });
  const medianResponseHours = median(responseHours);
  const terminalResponses = [...terminalResponseByIssuance.values()];
  const acceptedResponseCount = terminalResponses.filter((response) => response.response === "accepted").length;

  const vendorExceptions = fixture.exceptions
    .filter(
      (exception) =>
        exception.organizationId === scoped.organizationId &&
        exception.vendorId === vendor.id &&
        exception.status !== "resolved" &&
        (!exception.storeId || scoped.storeIds.has(exception.storeId)),
    )
    .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt));
  const vendorFollowUps = fixture.followUps
    .filter(
      (followUp) =>
        followUp.organizationId === scoped.organizationId &&
        followUp.status === "open" &&
        attributedWorkIds.has(followUp.workOrderId),
    )
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const vendorRelationshipReminders = fixture.vendorReminders
    .filter((reminder) => reminder.organizationId === scoped.organizationId && reminder.vendorId === vendor.id)
    .sort((left, right) => Number(left.status !== "open") - Number(right.status !== "open") || left.dueAt.localeCompare(right.dueAt));
  const openVendorRelationshipReminders = vendorRelationshipReminders.filter((reminder) => reminder.status === "open");

  const coverageRecords = fixture.vendorCoverage.filter(
    (coverage) => coverage.organizationId === scoped.organizationId && coverage.vendorId === vendor.id,
  );
  const coveredStoreIds = new Set<string>();
  for (const coverage of coverageRecords) {
    for (const store of scoped.stores) {
      if (
        (coverage.scopeKind === "organization" && coverage.scopeId === scoped.organizationId) ||
        (coverage.scopeKind === "region" && store.regionId === coverage.scopeId) ||
        (coverage.scopeKind === "store" && store.id === coverage.scopeId)
      ) coveredStoreIds.add(store.id);
    }
  }
  const coveredRegionIds = new Set(
    scoped.stores
      .filter((store) => coveredStoreIds.has(store.id) && store.regionId)
      .map((store) => store.regionId!),
  );
  const observedStoreCount = new Set(vendorVisits.map((visit) => visit.storeId)).size;
  const specialtyRecords = fixture.vendorSpecialties.filter(
    (specialty) => specialty.organizationId === scoped.organizationId && specialty.vendorId === vendor.id,
  );
  const specialties = specialtyRecords.map((specialty) => specialty.displayName);
  const recordedCostMinor = costForWorkIds(costByWork, attributedWorkIds);
  const recordedCostLineCount = [...attributedWorkIds].reduce(
    (total, workOrderId) => total + (costLineCountByWork.get(workOrderId) ?? 0),
    0,
  );
  const openWorkCount = attributedWork.filter((work) => !["closed", "cancelled"].includes(work.status)).length;
  const accountabilityCount = vendorExceptions.length + vendorFollowUps.length + openVendorRelationshipReminders.length;
  const visitedWorkDenominator = linkedVisitsByWork.size;
  const vendorDocuments = fixture.vendorComplianceDocuments
    .filter((document) => document.organizationId === scoped.organizationId && document.vendorId === vendor.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  const asOfMs = Date.parse(fixture.asOf);
  const currentDocumentByType = new Map<string, (typeof vendorDocuments)[number]>();
  const documentsByType = new Map<string, typeof vendorDocuments>();
  for (const document of vendorDocuments) documentsByType.set(
    document.documentType,
    [...(documentsByType.get(document.documentType) ?? []), document],
  );
  for (const [documentType, records] of documentsByType) {
    // A newly uploaded replacement does not invalidate the approved document
    // already on file. Keep using the current approved record until it expires
    // or the replacement is approved; retain every version in the evidence list.
    const currentApproved = records.find((document) => document.reviewStatus === "approved"
      && (!document.expiresAt || Date.parse(document.expiresAt) > asOfMs));
    currentDocumentByType.set(documentType, currentApproved ?? records[0]!);
  }
  const currentVendorDocuments = [...currentDocumentByType.values()];
  const vendorQualifications = fixture.vendorQualifications
    .filter((qualification) => qualification.organizationId === scoped.organizationId && qualification.vendorId === vendor.id)
    .sort((left, right) => left.tradeKey.localeCompare(right.tradeKey) || left.id.localeCompare(right.id));
  const dueSoonMs = asOfMs + 60 * 24 * 60 * 60_000;
  const blockingDocument = currentVendorDocuments.find((document) => document.blocking && (
    document.reviewStatus !== "approved" || (document.expiresAt ? Date.parse(document.expiresAt) <= asOfMs : false)
  ));
  const expiringDocument = currentVendorDocuments.find((document) => document.reviewStatus === "approved" && document.expiresAt && Date.parse(document.expiresAt) > asOfMs && Date.parse(document.expiresAt) <= dueSoonMs);
  const approvedDocumentCount = currentVendorDocuments.filter((document) => document.reviewStatus === "approved" && (!document.expiresAt || Date.parse(document.expiresAt) > asOfMs)).length;
  const activeQualificationCount = vendorQualifications.filter((qualification) => qualification.status === "active" && (!qualification.expiresAt || Date.parse(qualification.expiresAt) > asOfMs)).length;
  const complianceState: VendorPerformanceSummary["compliance"]["state"] = blockingDocument
    ? "blocked"
    : expiringDocument
      ? "due_soon"
      : currentVendorDocuments.length
        ? "ready"
        : "unconfigured";
  const complianceLabel = complianceState === "blocked"
    ? "Routing hold"
    : complianceState === "due_soon"
      ? "Renewal due soon"
      : complianceState === "ready"
        ? "Documents current"
        : "Documents not configured";
  const latestExpiryAlert = expiringDocument
    ? (fixture.vendorComplianceAlerts ?? [])
      .filter((alert) => alert.organizationId === scoped.organizationId && alert.vendorId === vendor.id && alert.documentId === expiringDocument.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    : undefined;
  const complianceDetail = blockingDocument
    ? `${sentence(blockingDocument.documentType)} is not current; new routine routing is paused while active work stays in place`
    : expiringDocument?.expiresAt
      ? latestExpiryAlert && latestExpiryAlert.stage !== "60_day"
        ? `${sentence(expiringDocument.documentType)} expires ${date(expiringDocument.expiresAt)} · vendor and facilities renewal notice active`
        : `${sentence(expiringDocument.documentType)} expires ${date(expiringDocument.expiresAt)} · quiet 60-day dashboard notice`
      : currentVendorDocuments.length
        ? `${approvedDocumentCount} of ${currentVendorDocuments.length} document controls current`
        : "Complete required vendor documents before sending work that depends on them";
  const relationshipState: VendorPerformanceSummary["relationshipState"] = complianceState === "blocked" || accountabilityCount >= 2 || unresolvedVisits.length >= 2
    ? "attention"
    : complianceState === "due_soon" || complianceState === "unconfigured" || accountabilityCount > 0 || noWorkOrderVisits.length > 0 || unresolvedVisits.length > 0
      ? "watch"
      : "stable";
  const relationshipLabel = relationshipState === "attention" ? "Action required" : relationshipState === "watch" ? "Monitor" : "Operating normally";
  const relationshipSummary = relationshipState === "attention"
    ? [accountabilityCount ? `${accountabilityCount} open item${accountabilityCount === 1 ? "" : "s"}` : undefined, openVendorRelationshipReminders.length ? `${openVendorRelationshipReminders.length} relationship reminder${openVendorRelationshipReminders.length === 1 ? "" : "s"}` : undefined, unresolvedVisits.length ? `${unresolvedVisits.length} unresolved checkout${unresolvedVisits.length === 1 ? "" : "s"}` : undefined, complianceState === "blocked" ? complianceDetail : undefined].filter(Boolean).join(" · ")
    : relationshipState === "watch"
      ? [accountabilityCount ? `${accountabilityCount} open item${accountabilityCount === 1 ? "" : "s"}` : undefined, openVendorRelationshipReminders.length ? `${openVendorRelationshipReminders.length} relationship reminder${openVendorRelationshipReminders.length === 1 ? "" : "s"}` : undefined, noWorkOrderVisits.length ? `${noWorkOrderVisits.length} visit${noWorkOrderVisits.length === 1 ? "" : "s"} without a work order` : undefined, complianceState === "due_soon" || complianceState === "unconfigured" ? complianceDetail : undefined].filter(Boolean).join(" · ")
      : "No open follow-ups or vendor-document issues in this view";

  const summary: VendorPerformanceSummary = {
    id: vendor.id,
    name: vendor.name,
    code: vendor.code,
    statusLabel: sentence(vendor.status),
    preferred: vendor.preferred,
    dispatchEmail: vendor.dispatchEmail,
    dispatchPhone: vendor.dispatchPhone,
    specialties,
    coverageLabel: coveredStoreIds.size === scoped.stores.length && scoped.stores.length
      ? `All ${scoped.stores.length} stores in scope`
      : `${coveredStoreIds.size} of ${scoped.stores.length} stores in scope`,
    coverageStoreCount: coveredStoreIds.size,
    coverageStoreDenominator: scoped.stores.length,
    coverageRegionCount: coveredRegionIds.size,
    observedStoreCount,
    openWorkCount,
    openReminderCount: openVendorRelationshipReminders.length,
    assignedWorkCount: attributedWork.length,
    recordedCostMinor,
    recordedCostLineCount,
    relationshipState,
    relationshipLabel,
    relationshipSummary,
    compliance: {
      state: complianceState,
      label: complianceLabel,
      detail: complianceDetail,
      approvedDocumentCount,
      documentCount: currentVendorDocuments.length,
      activeQualificationCount,
    },
    href: `/app/vendors/${vendor.id}`,
    measures: {
      responseTime: {
        id: "response-time",
        label: "Median first response",
        value: responseHours.length >= 3 ? elapsedLabel(medianResponseHours) : "Not enough history",
        numerator: responseHours.length,
        denominator: vendorIssuances.length,
        denominatorLabel: `${responseHours.length} of ${vendorIssuances.length} issued authorization${vendorIssuances.length === 1 ? "" : "s"} have a timed response`,
        definition: "Median elapsed time from an issued service authorization to its first recorded vendor response.",
        state: responseHours.length >= 3 ? "ready" : "insufficient",
        sourceLink: { href: `/app/vendors/${vendor.id}#authorization-evidence`, label: "Open response evidence" },
      },
      acceptance: {
        id: "acceptance",
        label: "Authorization acceptance",
        value: terminalResponses.length >= 3 ? ratioLabel(acceptedResponseCount, terminalResponses.length) : "Not enough history",
        numerator: acceptedResponseCount,
        denominator: terminalResponses.length,
        denominatorLabel: `${acceptedResponseCount} accepted of ${terminalResponses.length} accepted-or-declined decision${terminalResponses.length === 1 ? "" : "s"}`,
        definition: "Accepted service authorizations divided by accepted plus declined authorizations. Questions and proposed dates are excluded.",
        state: terminalResponses.length >= 3 ? "ready" : "insufficient",
        sourceLink: { href: `/app/vendors/${vendor.id}#authorization-evidence`, label: "Open decision evidence" },
      },
      visitCoverage: {
        id: "visit-coverage",
        label: "Jobs with a recorded visit",
        value: ratioLabel(coveredServiceWorkCount, serviceWorkIds.size),
        numerator: coveredServiceWorkCount,
        denominator: serviceWorkIds.size,
        denominatorLabel: `${coveredServiceWorkCount} of ${serviceWorkIds.size} issued, accepted, or completed work order${serviceWorkIds.size === 1 ? "" : "s"}`,
        definition: "Vendor-assigned service work with at least one linked observed visit. Declined, cancelled, superseded, and pricing-only requests are excluded.",
        state: serviceWorkIds.size ? "ready" : "insufficient",
        sourceLink: { href: `/app/vendors/${vendor.id}#visit-evidence`, label: "Open visit sources" },
      },
      noWorkOrder: {
        id: "no-work-order",
        label: "Visits without work order",
        value: ratioLabel(noWorkOrderVisits.length, vendorVisits.length),
        numerator: noWorkOrderVisits.length,
        denominator: vendorVisits.length,
        denominatorLabel: `${noWorkOrderVisits.length} of ${vendorVisits.length} observed visit${vendorVisits.length === 1 ? "" : "s"}`,
        definition: "Observed visits where the technician selected no work order or could not find one.",
        state: vendorVisits.length ? "ready" : "insufficient",
        tone: noWorkOrderVisits.length ? "warning" : "positive",
        sourceLink: { href: `/app/vendors/${vendor.id}#visit-evidence`, label: "Open visit sources" },
      },
      accountability: {
        id: "accountability",
        label: "Open items",
        value: String(accountabilityCount),
        numerator: accountabilityCount,
        denominator: vendorExceptions.length + vendorFollowUps.length,
        denominatorLabel: `${vendorExceptions.length} active exception${vendorExceptions.length === 1 ? "" : "s"} and ${vendorFollowUps.length} open follow-up${vendorFollowUps.length === 1 ? "" : "s"}`,
        definition: "Unresolved vendor-specific exceptions plus open follow-ups on work currently attributed to this vendor.",
        state: "ready",
        tone: accountabilityCount ? "warning" : "positive",
        sourceLink: { href: `/app/vendors/${vendor.id}#accountability-evidence`, label: "Open source records" },
      },
      repeatVisits: {
        id: "repeat-visits",
        label: "Work with repeat visits",
        value: ratioLabel(repeatVisitWorkIds.length, visitedWorkDenominator),
        numerator: repeatVisitWorkIds.length,
        denominator: visitedWorkDenominator,
        denominatorLabel: `${repeatVisitWorkIds.length} of ${visitedWorkDenominator} work order${visitedWorkDenominator === 1 ? "" : "s"} with observed visits`,
        definition: "Work orders with more than one observed visit by this vendor. It is a review fact, not proof of poor work.",
        state: visitedWorkDenominator ? "ready" : "insufficient",
        tone: repeatVisitWorkIds.length ? "warning" : "positive",
        sourceLink: { href: `/app/vendors/${vendor.id}#repeat-visits`, label: "Open repeat-visit work" },
      },
      unresolvedOutcomes: {
        id: "unresolved-outcomes",
        label: "Unresolved checkout outcomes",
        value: ratioLabel(unresolvedVisits.length, checkedOutVisits.length),
        numerator: unresolvedVisits.length,
        denominator: checkedOutVisits.length,
        denominatorLabel: `${unresolvedVisits.length} of ${checkedOutVisits.length} checked-out visit${checkedOutVisits.length === 1 ? "" : "s"}`,
        definition: "Checked-out visits recorded as temporary repair, waiting on parts, return required, unable to complete, or unable to reproduce.",
        state: checkedOutVisits.length ? "ready" : "insufficient",
        tone: unresolvedVisits.length ? "warning" : "positive",
        sourceLink: { href: `/app/vendors/${vendor.id}#visit-evidence`, label: "Open checkout evidence" },
      },
    },
  };

  const authorizationRows: VendorAuthorizationEvidenceRow[] = vendorIssuances.map((issuance) => {
    const work = workById.get(issuance.workOrderId);
    const response = firstResponseByIssuance.get(issuance.id);
    const decision = terminalResponseByIssuance.get(issuance.id);
    const responseTime = response
      ? (Date.parse(response.respondedAt) - Date.parse(issuance.issuedAt)) / 3_600_000
      : undefined;
    return {
      id: issuance.id,
      workOrderNumber: work?.number ?? "Work order unavailable",
      workOrderProblem: work?.problem ?? "Source work is outside this view",
      storeLabel: storeLabel(work ? storeById.get(work.storeId) : undefined),
      revision: issuance.revision,
      issuedAtLabel: dateTime(issuance.issuedAt),
      responseLabel: response ? sentence(response.response) : "No response recorded",
      responderLabel: response?.responderName ?? "—",
      responseAtLabel: response ? dateTime(response.respondedAt) : "—",
      responseTimeLabel: elapsedLabel(responseTime),
      decisionLabel: decision ? sentence(decision.response) : "No accepted-or-declined decision",
      decisionAtLabel: decision ? `${decision.responderName} · ${dateTime(decision.respondedAt)}` : "Questions and proposed dates are not acceptance decisions",
      href: work ? `/app/work-orders/${work.id}` : `/app/vendors/${vendor.id}`,
    };
  });

  const accountabilityRows: VendorAccountabilityEvidenceRow[] = [
    ...vendorExceptions.map<VendorAccountabilityEvidenceRow>((exception) => ({
      id: exception.id,
      kindLabel: sentence(exception.kind),
      summary: exception.summary,
      workOrderLabel: exception.workOrderId ? workById.get(exception.workOrderId)?.number ?? "Linked work" : "Visit evidence",
      ownerLabel: "Facilities review",
      dueLabel: exception.severity === "urgent" ? "Review now" : "Needs review",
      tone: exception.severity === "urgent" ? "critical" : "warning",
      href: `/app/action-center/${exception.id}`,
    })),
    ...vendorFollowUps.map<VendorAccountabilityEvidenceRow>((followUp) => ({
      id: followUp.id,
      kindLabel: "Open follow-up",
      summary: followUp.nextAction,
      workOrderLabel: workById.get(followUp.workOrderId)?.number ?? "Linked work",
      ownerLabel: followUp.accountableParty,
      dueLabel: dateTimeInZone(followUp.dueAt, organizationTimeZone),
      tone: Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "critical" : "warning",
      href: `/app/action-center/${followUp.id}`,
    })),
  ];

  const repeatVisitRows: VendorRepeatVisitEvidenceRow[] = repeatVisitWorkIds
    .map((workOrderId) => {
      const work = workById.get(workOrderId);
      const visits = linkedVisitsByWork.get(workOrderId) ?? [];
      const latest = [...visits].sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt))[0];
      return work ? {
        id: work.id,
        workOrderNumber: work.number,
        problem: work.problem,
        storeLabel: storeLabel(storeById.get(work.storeId)),
        visitCount: visits.length,
        latestOutcomeLabel: latest?.outcome ? sentence(latest.outcome) : latest?.status === "active" ? "Onsite now" : "Outcome not recorded",
        recordedCostLabel: money(costByWork.get(work.id) ?? 0),
        href: `/app/work-orders/${work.id}`,
      } : undefined;
    })
    .filter((row): row is VendorRepeatVisitEvidenceRow => Boolean(row))
    .sort((left, right) => right.visitCount - left.visitCount || left.workOrderNumber.localeCompare(right.workOrderNumber));

  const visitRows: VendorVisitEvidenceRow[] = vendorVisits.map((visit) => {
    const work = visit.workOrderId ? workById.get(visit.workOrderId) : undefined;
    const storeTimeZone = storeById.get(visit.storeId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
    return {
      id: visit.id,
      technicianName: visit.technicianName,
      storeLabel: storeLabel(storeById.get(visit.storeId)),
      workOrderLabel: work?.number ?? "No work order",
      observedLabel: visit.checkedOutAt
        ? `${dateTime(visit.checkedInAt, storeTimeZone)} – ${dateTime(visit.checkedOutAt, storeTimeZone)}`
        : `Onsite since ${dateTime(visit.checkedInAt, storeTimeZone)}`,
      outcomeLabel: visit.outcome ? sentence(visit.outcome) : visit.status === "active" ? "Onsite now" : "Outcome not recorded",
      isNoWorkOrder: !visit.workOrderId,
      isUnresolved: Boolean(visit.outcome && unresolvedOutcomesForPresentation.has(visit.outcome)),
      href: `/app/visits/${visit.id}`,
    };
  });

  const costRows: VendorCostEvidenceRow[] = attributedWork
    .filter((work) => (costByWork.get(work.id) ?? 0) > 0)
    .sort((left, right) => (costByWork.get(right.id) ?? 0) - (costByWork.get(left.id) ?? 0))
    .map((work) => ({
      id: work.id,
      workOrderNumber: work.number,
      problem: work.problem,
      storeLabel: storeLabel(storeById.get(work.storeId)),
      statusLabel: workStatusLabel(work.status),
      costLabel: money(costByWork.get(work.id) ?? 0),
      costLineCount: costLineCountByWork.get(work.id) ?? 0,
      href: `/app/work-orders/${work.id}`,
    }));

  const coverageRows: VendorCoverageEvidenceRow[] = coverageRecords.map((coverage) => {
    const stores = scoped.stores.filter((store) =>
      (coverage.scopeKind === "organization" && coverage.scopeId === scoped.organizationId) ||
      (coverage.scopeKind === "region" && store.regionId === coverage.scopeId) ||
      (coverage.scopeKind === "store" && store.id === coverage.scopeId),
    );
    const scopeLabel = coverage.scopeKind === "organization"
      ? "Companywide"
      : coverage.scopeKind === "region"
        ? regionById.get(coverage.scopeId)?.name ?? "Selected region"
        : storeLabel(storeById.get(coverage.scopeId));
    return {
      id: coverage.id,
      scopeLabel,
      includedStoresLabel: `${stores.length} store${stores.length === 1 ? "" : "s"} in current view`,
      preferredRankLabel: coverage.preferredRank ? `Preference ${coverage.preferredRank}` : "No preference rank",
    };
  });

  const complianceRows: VendorComplianceEvidenceRow[] = vendorDocuments.map((document) => {
    const isCurrent = currentDocumentByType.get(document.documentType)?.id === document.id;
    const currentOperationalDocument = currentDocumentByType.get(document.documentType);
    const replacementPending = document.reviewStatus === "pending"
      && Boolean(currentOperationalDocument)
      && currentOperationalDocument?.id !== document.id
      && currentOperationalDocument?.reviewStatus === "approved"
      && document.createdAt > currentOperationalDocument.createdAt;
    const expiredByDate = Boolean(document.expiresAt && Date.parse(document.expiresAt) <= asOfMs);
    const dueSoon = Boolean(document.expiresAt && Date.parse(document.expiresAt) > asOfMs && Date.parse(document.expiresAt) <= dueSoonMs);
    const effectiveStatus = expiredByDate ? "expired" : document.reviewStatus;
    return {
      id: document.id,
      documentTypeLabel: sentence(document.documentType),
      referenceLabel: [document.issuer, document.reference].filter(Boolean).join(" · ") || "Reference not entered",
      statusLabel: replacementPending
        ? "Replacement pending review"
        : !isCurrent
          ? "Prior record retained"
          : dueSoon && effectiveStatus === "approved"
            ? "Approved · renewal due soon"
            : sentence(effectiveStatus),
      effectiveLabel: document.effectiveAt ? date(document.effectiveAt) : "Not entered",
      expiryLabel: document.expiresAt ? date(document.expiresAt) : "No expiration entered",
      blockingLabel: document.blocking ? "Required for routing" : "Non-blocking record",
      tone: replacementPending
        ? "warning"
        : !isCurrent
          ? "neutral"
          : effectiveStatus !== "approved" || (document.blocking && expiredByDate)
            ? "critical"
            : dueSoon
              ? "warning"
              : "positive",
    };
  });

  const qualificationRows: VendorQualificationEvidenceRow[] = vendorQualifications.map((qualification) => {
    const expiredByDate = Boolean(qualification.expiresAt && Date.parse(qualification.expiresAt) <= asOfMs);
    const effectiveStatus = expiredByDate ? "expired" : qualification.status;
    const capabilities = [qualification.workType, qualification.serviceType, qualification.assetType, qualification.componentType]
      .filter(Boolean)
      .map((value) => sentence(value!));
    const serviceRights = [qualification.pmWork ? "PM" : undefined, qualification.emergencyResponse ? "Emergency" : undefined, qualification.warrantyWork ? "Warranty" : undefined, qualification.afterHours ? "After-hours" : undefined].filter(Boolean);
    return {
      id: qualification.id,
      tradeLabel: sentence(qualification.tradeKey),
      capabilityLabel: capabilities.join(" · ") || "General approved work",
      serviceRightsLabel: serviceRights.join(" · ") || "Standard reactive work",
      limitLabel: qualification.maximumJobAmount ? money(qualification.maximumJobAmount.amountMinor) : "No qualification limit entered",
      expiryLabel: qualification.expiresAt ? date(qualification.expiresAt) : "No expiration entered",
      statusLabel: sentence(effectiveStatus),
      tone: effectiveStatus === "active" ? "positive" : "critical",
    };
  });

  return {
    summary,
    medianResponseHours,
    authorizationRows,
    accountabilityRows,
    repeatVisitRows,
    visitRows,
    costRows,
    coverageRows,
    complianceRows,
    qualificationRows,
    regionLabels: [...coveredRegionIds]
      .map((regionId) => regionById.get(regionId)?.name)
      .filter((label): label is string => Boolean(label))
      .sort((left, right) => left.localeCompare(right)),
    searchTerms: specialtyRecords.flatMap((specialty) => [specialty.displayName, ...specialty.searchAliases]),
  };
}

export function buildVendorPerformanceListModel(
  fixture: OpsFixture,
  session: OperatorSession,
  query: OperatorSearchParameters = {},
): VendorPerformanceListViewModel {
  const scoped = scopeFixture(fixture, session);
  const searchValue = cleanSearch(first(query.q));
  const requestedView = first(query.view);
  const view: VendorPerformanceListViewModel["view"] = requestedView === "attention" || requestedView === "preferred" || requestedView === "stable" ? requestedView : "all";
  const specialty = cleanSearch(first(query.specialty));
  const requestedSort = first(query.sort);
  const sort: VendorPerformanceListViewModel["sort"] = requestedSort === "name" || requestedSort === "response" || requestedSort === "cost"
    ? requestedSort
    : "attention";
  const allBundles = fixture.vendors
    .filter((vendor) => vendor.organizationId === scoped.organizationId)
    .map((vendor) => buildVendorEvidenceBundle(fixture, scoped, vendor));
  const specialtyOptions = [...new Set(allBundles.flatMap(({ summary }) => summary.specialties))]
    .sort((left, right) => left.localeCompare(right))
    .map((label) => ({ value: label.toLocaleLowerCase(), label }));
  const bundles = allBundles
    .filter(({ summary, regionLabels, coverageRows, searchTerms }) => !searchValue || searchable(
      summary.name,
      summary.code,
      summary.coverageLabel,
      ...searchTerms,
      ...regionLabels,
      ...coverageRows.map((coverage) => coverage.scopeLabel),
    ).includes(searchValue))
    .filter(({ summary }) => !specialty || summary.specialties.some((item) => cleanSearch(item) === specialty))
    .filter(({ summary }) => view === "all" || (view === "attention" ? summary.relationshipState !== "stable" : view === "preferred" ? summary.preferred : summary.relationshipState === "stable"));

  bundles.sort((left, right) => {
    if (sort === "name") return left.summary.name.localeCompare(right.summary.name);
    if (sort === "cost") return right.summary.recordedCostMinor - left.summary.recordedCostMinor || left.summary.name.localeCompare(right.summary.name);
    if (sort === "response") {
      const leftValue = left.summary.measures.responseTime.state === "ready" ? left.medianResponseHours ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
      const rightValue = right.summary.measures.responseTime.state === "ready" ? right.medianResponseHours ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
      return leftValue - rightValue || left.summary.name.localeCompare(right.summary.name);
    }
    return right.summary.measures.accountability.numerator - left.summary.measures.accountability.numerator ||
      right.summary.measures.unresolvedOutcomes.numerator - left.summary.measures.unresolvedOutcomes.numerator ||
      left.summary.name.localeCompare(right.summary.name);
  });

  const vendors = bundles.map((bundle) => bundle.summary);
  const visitCovered = vendors.reduce((total, vendor) => total + vendor.measures.visitCoverage.numerator, 0);
  const visitEligible = vendors.reduce((total, vendor) => total + vendor.measures.visitCoverage.denominator, 0);
  const recordedCostMinor = vendors.reduce((total, vendor) => total + vendor.recordedCostMinor, 0);

  return {
    title: "Vendor network",
    description: "Find an approved vendor, see where they work and what they handle, then open the jobs, visits, follow-ups, and costs behind each number.",
    scopeLabel: session.scopeLabel,
    updatedLabel: `Through ${date(fixture.asOf)}`,
    searchValue: first(query.q),
    view,
    specialty: first(query.specialty),
    specialtyOptions,
    sort,
    resultSummary: `${vendors.length} of ${fixture.vendors.filter((vendor) => vendor.organizationId === scoped.organizationId).length} approved vendors`,
    createVendorLink: roleCan(session.role, "onboard_vendor") ? { href: "/app/vendors/new", label: "Add approved vendor" } : undefined,
    portfolioMetrics: [
      { id: "vendors", label: "Approved vendors", value: String(vendors.length), context: `${vendors.length} vendor${vendors.length === 1 ? "" : "s"} match this view`, sourceLink: { href: "/app/vendors", label: "Open vendor directory" } },
      { id: "attention", label: "Vendors to review", value: String(vendors.filter((vendor) => vendor.relationshipState !== "stable").length), context: "Open follow-ups, unresolved visits, or missing documents", sourceLink: { href: "/app/vendors?view=attention", label: "Review these vendors" } },
      { id: "compliance", label: "Documents current", value: `${vendors.filter((vendor) => vendor.compliance.state === "ready").length}/${vendors.length}`, context: "Approved vendor documents that are current", sourceLink: { href: "/app/vendors?view=attention", label: "Review missing documents" } },
      { id: "visits", label: "Jobs with a recorded visit", value: ratioLabel(visitCovered, visitEligible), context: `${visitCovered} of ${visitEligible} vendor work orders have a linked check-in`, sourceLink: { href: "/app/visits", label: "Open visit evidence" } },
      { id: "cost", label: "Recorded work cost", value: money(recordedCostMinor), context: "Entered cost lines on work currently attributed to these vendors", sourceLink: { href: "/app/spend", label: "Open cost records" } },
    ],
    vendors,
  };
}

export function buildVendorPerformanceDetailModel(
  fixture: OpsFixture,
  session: OperatorSession,
  vendorId: string,
): VendorPerformanceDetailViewModel {
  const scoped = scopeFixture(fixture, session);
  const vendor = fixture.vendors.find(
    (candidate) => candidate.organizationId === scoped.organizationId && candidate.id === vendorId,
  );
  if (!vendor) {
    return {
      state: "missing",
      title: "Vendor not available",
      description: "This vendor does not exist or is outside your authorized organization.",
      scopeLabel: session.scopeLabel,
      updatedLabel: `Through ${date(fixture.asOf)}`,
      backLink: { href: "/app/vendors", label: "Back to vendors" },
      specialtyOptions: [],
      authorizationRows: [],
      accountabilityRows: [],
      repeatVisitRows: [],
      visitRows: [],
      costRows: [],
      coverageRows: [],
      complianceRows: [],
      qualificationRows: [],
      vendorReminderRows: [],
      timeZone: DEFAULT_OPERATIONS_TIME_ZONE,
      defaultReminderOwner: "",
      defaultReminderEscalation: "Facilities leadership",
      regionLabels: [],
    };
  }
  const bundle = buildVendorEvidenceBundle(fixture, scoped, vendor);
  const organizationTimeZone = fixture.organizations.find((organization) => organization.id === scoped.organizationId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  return {
    state: "ready",
    title: vendor.name,
    description: "Decision-grade vendor evidence with every measure tied to the authorization, work order, visit, exception, follow-up, coverage, or cost record behind it.",
    scopeLabel: session.scopeLabel,
    updatedLabel: `Through ${date(fixture.asOf)}`,
    backLink: { href: "/app/vendors", label: "Back to vendor network" },
    createWorkOrderLink: roleCan(session.role, "create_work_order")
      ? { href: `/app/work-orders/new?vendor=${vendor.id}`, label: "Create work order" }
      : undefined,
    manageRelationshipAction: roleCan(session.role, "onboard_vendor")
      ? `/api/ops/vendors/${encodeURIComponent(vendor.id)}/relationship`
      : undefined,
    manageRemindersAction: roleCan(session.role, "onboard_vendor")
      ? `/api/ops/vendors/${encodeURIComponent(vendor.id)}/reminders`
      : undefined,
    timeZone: organizationTimeZone,
    defaultReminderOwner: session.displayName,
    defaultReminderEscalation: session.role === "facilities" ? "Executive leadership" : "Facilities leadership",
    specialtyOptions: fixture.vendorSpecialties
      .filter((specialty) => specialty.organizationId === scoped.organizationId && specialty.vendorId === vendor.id)
      .sort((left, right) => left.displayName.localeCompare(right.displayName))
      .map((specialty) => ({ value: specialty.canonicalKey, label: specialty.displayName })),
    summary: bundle.summary,
    authorizationRows: bundle.authorizationRows,
    accountabilityRows: bundle.accountabilityRows,
    repeatVisitRows: bundle.repeatVisitRows,
    visitRows: bundle.visitRows,
    costRows: bundle.costRows,
    coverageRows: bundle.coverageRows,
    complianceRows: bundle.complianceRows,
    qualificationRows: bundle.qualificationRows,
    vendorReminderRows: fixture.vendorReminders
      .filter((reminder) => reminder.organizationId === scoped.organizationId && reminder.vendorId === vendor.id)
      .sort((left, right) => Number(left.status !== "open") - Number(right.status !== "open") || left.dueAt.localeCompare(right.dueAt))
      .map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        note: reminder.note,
        accountableParty: reminder.accountableParty,
        dueAt: reminder.dueAt.slice(0, 16),
        dueInputValue: dateTimeInputInZone(reminder.dueAt, organizationTimeZone),
        dueLabel: dateTimeInZone(reminder.dueAt, organizationTimeZone),
        escalationTo: reminder.escalationTo,
        status: reminder.status,
        statusLabel: sentence(reminder.status),
        createdLabel: `${reminder.createdByActorName} · ${dateTimeInZone(reminder.createdAt, organizationTimeZone)}`,
        completionLabel: reminder.completedAt ? `${reminder.completedByActorName ?? "Recorded user"} · ${dateTimeInZone(reminder.completedAt, organizationTimeZone)}` : undefined,
      })),
    regionLabels: bundle.regionLabels,
  };
}

function vendorRows(fixture: OpsFixture, scoped: ScopedFixture, query: OperatorSearchParameters): TableRowViewModel[] {
  const q = cleanSearch(first(query.q));
  return fixture.vendors
    .filter((vendor) => vendor.organizationId === scoped.organizationId)
    .filter((vendor) => {
      const specialties = fixture.vendorSpecialties.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      return !q || searchable(vendor.name, vendor.code, ...specialties.flatMap((item) => [item.displayName, ...item.searchAliases])).includes(q);
    })
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.name.localeCompare(b.name))
    .map((vendor) => {
      const specialties = fixture.vendorSpecialties.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      const coverage = fixture.vendorCoverage.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      const assignments = fixture.assignments.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
      const workIds = new Set(assignments.map((item) => item.workOrderId));
      return {
        id: vendor.id,
        label: vendor.name,
        href: `/app/vendors/${vendor.id}`,
        cells: [
          { key: "vendor", value: vendor.name, secondary: vendor.preferred ? "Preferred provider" : vendor.code },
          { key: "specialties", value: specialties.map((item) => item.displayName).join(", ") || "Not classified" },
          { key: "coverage", value: coverage.some((item) => item.scopeKind === "organization") ? "Companywide" : `${coverage.length} assigned scopes` },
          { key: "open", value: String(scoped.workOrders.filter((work) => workIds.has(work.id) && !["closed", "cancelled"].includes(work.status)).length) },
          { key: "visits", value: String(scoped.visits.filter((visit) => visit.vendorId === vendor.id).length) },
          { key: "status", value: sentence(vendor.status), tone: vendor.status === "approved" ? "positive" : "warning" },
        ],
      };
    });
}

export function buildListModel(
  fixture: OpsFixture,
  session: OperatorSession,
  route: OperatorListRoute,
  query: OperatorSearchParameters = {},
): ListPageViewModel {
  const requestedStoreId = first(query.store);
  const scoped = narrowScopeToStore(scopeFixture(fixture, session), requestedStoreId);
  const requestedStore = requestedStoreId ? scoped.stores.find((store) => store.id === requestedStoreId) : undefined;
  const activeScopeLabel = requestedStore ? storeLabel(requestedStore) : session.scopeLabel;
  const q = cleanSearch(first(query.q));
  let rows: TableRowViewModel[];
  if (route === "work-orders") {
    rows = workRows(fixture, scoped, query, roleCan(session.role, "control_work_order"));
    if (first(query.visitPlan) === "ready" && (first(query.opportunity) === "confirmed" || first(query.reviewWindow) === "30" || first(query.storeGroup) === "multiple")) {
      const approvedPortfolio = buildApprovedWorkPortfolio(fixture, session, {
        q: first(query.q),
        storeId: requestedStoreId,
        regionId: first(query.region),
        categoryKey: first(query.category),
        status: first(query.status),
        stage: first(query.stage),
        vendorId: first(query.vendor),
        hasCost: first(query.hasCost) === "true",
        costFrom: first(query.costFrom),
        costMonth: first(query.costMonth),
        assetId: first(query.asset),
        componentId: first(query.component),
        path: first(query.path),
        reviewWindow: first(query.reviewWindow),
        opportunity: first(query.opportunity),
        storeGroup: first(query.storeGroup),
      });
      const matchingIds = new Set(approvedPortfolio.storeRows.flatMap((store) => store.items.map((item) => item.workOrderId)));
      rows = rows.filter((row) => matchingIds.has(row.id));
    }
  }
  else if (route === "visits") rows = visitRows(fixture, scoped, query);
  else if (route === "stores") rows = storeRows(fixture, scoped, query);
  else if (route === "vendors") rows = vendorRows(fixture, scoped, query);
  else if (route === "invoices") {
    const from = first(query.from);
    const to = first(query.to);
    const requestedStatus = first(query.status);
    const requestedRegionId = first(query.region);
    const requestedCategory = first(query.category);
    const requestedPath = pathSegments(first(query.path));
    const requestedAssetId = first(query.asset);
    const requestedComponentId = first(query.component);
    const hasAllocationScope = Boolean(requestedRegionId || requestedStoreId || requestedCategory || requestedPath.length || requestedAssetId || requestedComponentId);
    const workById = new Map(scoped.workOrders.map((work) => [work.id, work]));
    const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
    const assetById = new Map(scoped.assets.map((asset) => [asset.id, asset]));
    const vendorById = new Map(
      fixture.vendors
        .filter((vendor) => vendor.organizationId === scoped.organizationId)
        .map((vendor) => [vendor.id, vendor]),
    );
    rows = fixture.invoiceReferences
      .filter(
        (invoice) =>
          invoice.organizationId === scoped.organizationId &&
          (!from || invoice.invoiceDate >= from) &&
          (!to || invoice.invoiceDate <= to),
      )
      .map((invoice) => ({
        invoice,
        allocations: fixture.invoiceAllocations.filter(
          (allocation) => {
            if (allocation.organizationId !== scoped.organizationId || allocation.invoiceReferenceId !== invoice.id) return false;
            const work = workById.get(allocation.workOrderId);
            const store = work ? storeById.get(work.storeId) : undefined;
            const asset = work?.assetId ? assetById.get(work.assetId) : undefined;
            return Boolean(
              work &&
              (!requestedRegionId || store?.regionId === requestedRegionId) &&
              (!requestedStoreId || work.storeId === requestedStoreId) &&
              (!requestedCategory || work.categoryKey === requestedCategory) &&
              (!requestedAssetId || (requestedAssetId === "unlinked" ? !work.assetId : work.assetId === requestedAssetId)) &&
              (!requestedComponentId || (requestedComponentId === "unlinked" ? !work.componentId : work.componentId === requestedComponentId)) &&
              (requestedPath.length === 0 || assetMatchesPath(asset, requestedPath))
            );
          },
        ),
      }))
      .filter((item) => (!hasAllocationScope && scoped.includeCompanywide) || item.allocations.length > 0)
      .filter((item) =>
        !requestedStatus ||
        (requestedStatus === "review"
          ? item.invoice.matchStatus !== "confirmed"
          : item.invoice.matchStatus === requestedStatus),
      )
      .filter((item) => {
        if (!q) return true;
        const work = item.allocations[0] ? workById.get(item.allocations[0].workOrderId) : undefined;
        const store = work ? storeById.get(work.storeId) : undefined;
        const vendor = vendorById.get(item.invoice.vendorId);
        return searchable(item.invoice.invoiceNumber, item.invoice.operatorWorkOrderNumber, work?.number, vendor?.name, storeLabel(store)).includes(q);
      })
      .sort((a, b) => b.invoice.invoiceDate.localeCompare(a.invoice.invoiceDate))
      .map(({ invoice, allocations }) => {
        const primaryWork = allocations[0] ? workById.get(allocations[0].workOrderId) : undefined;
        const store = primaryWork ? storeById.get(primaryWork.storeId) : undefined;
        const vendor = vendorById.get(invoice.vendorId);
        const scopedAmountMinor = allocations.reduce((sum, allocation) => sum + allocation.amount.amountMinor, 0);
        const allocationStoreCount = new Set(allocations.map((allocation) => workById.get(allocation.workOrderId)?.storeId).filter(Boolean)).size;
        return {
          id: invoice.id,
          label: invoice.invoiceNumber,
          href: `/app/invoices/${invoice.id}`,
          cells: [
            { key: "invoice", value: invoice.invoiceNumber, secondary: date(invoice.invoiceDate) },
            { key: "work", value: primaryWork?.number ?? invoice.operatorWorkOrderNumber ?? "No work-order reference", secondary: allocations.length ? (allocations.length > 1 ? `${allocations.length} allocations` : "1 linked allocation") : "Not linked to source work" },
            { key: "vendor", value: vendor?.name ?? "Unknown vendor" },
            { key: "store", value: allocationStoreCount > 1 ? `${allocationStoreCount} stores in this scope` : primaryWork ? storeLabel(store) : "Not attributed" },
            { key: "amount", value: allocations.length ? money(scopedAmountMinor) : money(invoice.grossAmount.amountMinor), secondary: allocations.length ? `${money(invoice.grossAmount.amountMinor)} invoice gross` : "Invoice gross · no confirmed allocation" },
            { key: "status", value: sentence(invoice.matchStatus), tone: invoice.matchStatus === "confirmed" ? "positive" : ["rejected", "unmatched"].includes(invoice.matchStatus) ? "warning" : "info" },
          ],
        };
      });
  }
  else if (route === "estimates") {
    const requestedStatus = first(query.status);
    const requestedDecision = first(query.decision);
    const workById = new Map(scoped.workOrders.map((work) => [work.id, work]));
    const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
    const vendorById = new Map(
      fixture.vendors
        .filter((vendor) => vendor.organizationId === scoped.organizationId)
        .map((vendor) => [vendor.id, vendor]),
    );
    rows = (fixture.estimateRequests ?? [])
      .filter((request) => request.organizationId === scoped.organizationId && workById.has(request.workOrderId))
      .filter((request) => !requestedStatus || request.status === requestedStatus)
      .filter((request) => !requestedDecision || (request.decisionKind ?? "service_bid") === requestedDecision)
      .map((request) => {
        const work = workById.get(request.workOrderId)!;
        const store = storeById.get(work.storeId);
        const vendor = vendorById.get(request.vendorId);
        const proposal = (fixture.estimateProposals ?? [])
          .filter((candidate) => candidate.organizationId === scoped.organizationId && candidate.requestId === request.id)
          .sort((left, right) => right.revision - left.revision)[0];
        return { request, work, store, vendor, proposal };
      })
      .filter(({ request, work, store, vendor, proposal }) => !q || searchable(
        work.number,
        work.problem,
        storeLabel(store),
        vendor?.name,
        request.requestedScope,
        request.decisionKind,
        proposal?.scope,
        proposal ? estimateMoney(proposal.amount.amountMinor, proposal.amount.currency) : undefined,
      ).includes(q))
      .sort((left, right) => right.request.requestedAt.localeCompare(left.request.requestedAt) || left.vendor?.name.localeCompare(right.vendor?.name ?? "") || 0)
      .map(({ request, work, store, vendor, proposal }) => ({
        id: request.id,
        label: `${work.number} - ${vendor?.name ?? "Unknown vendor"}`,
        href: `/app/work-orders/${work.id}?view=service#bid-requests`,
        cells: [
          { key: "request", value: request.decisionKind === "replacement_quote" ? "Replacement quote" : "Service bid", secondary: request.requestedScope },
          { key: "work", value: work.number, secondary: storeLabel(store) },
          { key: "vendor", value: vendor?.name ?? "Unknown vendor" },
          { key: "amount", value: proposal ? estimateMoney(proposal.amount.amountMinor, proposal.amount.currency) : "Not submitted", secondary: proposal ? `Revision ${proposal.revision}` : "Pricing evidence pending" },
          { key: "due", value: request.dueAt ? dateTime(request.dueAt, store?.timeZone) : "No deadline", secondary: request.respondedAt ? `Responded ${dateTime(request.respondedAt, store?.timeZone)}` : undefined },
          { key: "status", value: sentence(request.status), tone: request.status === "selected" ? "positive" : ["declined", "expired", "withdrawn", "not_selected"].includes(request.status) ? "neutral" : request.status === "submitted" ? "info" : "warning" },
        ],
      }));
  }
  else if (route === "requests") {
    const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
    rows = fixture.requests
      .filter((request) => request.organizationId === scoped.organizationId && scoped.storeIds.has(request.storeId))
      .filter((request) => !q || searchable(request.reference, request.problem, request.reporterName, storeLabel(storeById.get(request.storeId))).includes(q))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((request) => ({
        id: request.id,
        label: request.reference,
        href: `/app/requests/${request.id}`,
        cells: [
          { key: "request", value: request.reference, secondary: request.problem },
          { key: "store", value: storeLabel(storeById.get(request.storeId)) },
          { key: "priority", value: sentence(request.priority), tone: request.priority === "emergency" ? "critical" : request.priority === "urgent" ? "warning" : "neutral" },
          { key: "reported", value: dateTime(request.submittedAt, storeById.get(request.storeId)?.timeZone), secondary: request.reporterName },
          { key: "status", value: sentence(request.status), tone: request.status === "converted" ? "positive" : "info" },
        ],
      }));
  } else if (route === "action-center") {
    const requestedType = first(query.type);
    const requestedPriority = first(query.priority);
    rows = actionsForSession(fixture, scoped, session, 200)
      .filter((action) => !requestedType || (["service-record", "exception"].includes(requestedType) ? action.attentionType === "service_record" : ["vendor-task", "vendor-reminder"].includes(requestedType) ? action.attentionType === "vendor_task" : action.attentionType === "follow_up"))
      .filter((action) => !requestedPriority || (requestedPriority === "urgent" ? action.tone === "critical" : action.tone !== "critical"))
      .filter((action) => !q || searchable(action.title, action.description, action.reasonLabel, action.ownerLabel, action.storeLabel, action.recordLabel).includes(q))
      .map((action) => ({
        id: action.id,
        label: action.title,
        href: action.link.href,
        cells: [
          { key: "item", value: action.title, secondary: action.description },
          { key: "store", value: action.storeLabel ?? "Companywide" },
          { key: "record", value: action.recordLabel ?? action.categoryLabel, secondary: action.reasonLabel ?? action.categoryLabel },
          { key: "owner", value: action.ownerLabel },
          { key: "due", value: action.dueLabel },
          { key: "priority", value: action.priorityLabel ?? (action.tone === "critical" ? "Urgent" : "Review"), tone: action.tone },
          { key: "type", value: action.categoryLabel },
        ],
      }));
  } else if (route === "reports") {
    const sourceCounts: Record<string, string> = {
      "vendor-visit-accountability": `${scoped.visits.length} source visits`,
      "open-maintenance-obligations": `${scoped.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status)).length} open work orders`,
      "store-cost-comparison": `${scoped.stores.length} stores in scope`,
      "recorded-maintenance-cost": `${fixture.costLines.filter((line) => line.organizationId === scoped.organizationId && scoped.workOrders.some((work) => work.id === line.workOrderId)).length} recorded cost lines`,
      "preventive-maintenance-compliance": `${fixture.pmOccurrences.filter((item) => item.organizationId === scoped.organizationId && scoped.storeIds.has(item.storeId)).length} PM occurrences`,
      "lifecycle-capital-evidence": `${scoped.assets.length} equipment records`,
      "invoice-reference-safeguards": `${fixture.invoiceAllocations.filter((allocation) => allocation.organizationId === scoped.organizationId && scoped.workOrders.some((work) => work.id === allocation.workOrderId)).length} linked allocations`,
    };
    rows = reportCatalog.filter((report) => !q || searchable(report.title, report.description, report.definition, sourceCounts[report.id]).includes(q)).map((report) => ({
      id: report.id,
      label: report.title,
      href: report.liveHref,
      cells: [
        { key: "report", value: report.title, secondary: sourceCounts[report.id] },
        { key: "scope", value: session.scopeLabel },
        { key: "period", value: "Current source view" },
        { key: "basis", value: report.definition },
        { key: "status", value: "Live", tone: "positive" },
      ],
    }));
  } else {
    const administrationRows: TableRowViewModel[] = [
      { id: "stores", label: "Stores", href: "/app/stores", cells: [{ key: "area", value: "Store directory" }, { key: "summary", value: `${scoped.stores.length} stores in scope` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Configured", tone: "positive" }] },
      { id: "vendors", label: "Vendors", href: "/app/vendors", cells: [{ key: "area", value: "Approved vendor network" }, { key: "summary", value: `${fixture.vendors.filter((vendor) => vendor.organizationId === scoped.organizationId).length} approved vendors` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Configured", tone: "positive" }] },
      { id: "taxonomy", label: "Service areas and equipment templates", href: "/app/admin/service-areas", cells: [{ key: "area", value: "Company equipment setup" }, { key: "summary", value: `${(fixture.equipmentTemplates ?? []).filter((template) => template.organizationId === scoped.organizationId && template.active).length} reusable equipment types` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Ready to reuse", tone: "positive" }] },
      { id: "approval-policies", label: "Approval policies", href: "/app/admin/approval-policies", cells: [{ key: "area", value: "Authorization governance" }, { key: "summary", value: `${fixture.approvalPolicies.filter((policy) => policy.organizationId === scoped.organizationId && policy.status === "active").length} active policies · ${fixture.approvalRequests.filter((request) => request.organizationId === scoped.organizationId && approvalRequestState(request, fixture.approvalDecisions) === "pending").length} pending decisions` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Auditable", tone: "positive" }] },
      { id: "notifications", label: "Notification delivery", href: "/app/admin/notifications", cells: [{ key: "area", value: "Email and escalation rules" }, { key: "summary", value: `${(fixture.notificationRules ?? []).filter((rule) => rule.organizationId === scoped.organizationId && rule.emailEnabled).length} email rules enabled` }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Configurable", tone: "info" }] },
      { id: "imports", label: "Data imports", href: "/app/admin/imports", cells: [{ key: "area", value: "Store, vendor, and equipment onboarding" }, { key: "summary", value: "Validate CSV files before any records are written" }, { key: "owner", value: "Facilities administration" }, { key: "status", value: "Dry-run preview", tone: "info" }] },
    ];
    rows = administrationRows.filter((row) => !q || searchable(row.label, ...row.cells.map((cell) => cell.value)).includes(q));
  }

  rows = rows.filter((row) => roleCanOpenOperatorHref(session.role, row.href));
  const filteredRowIds = new Set(rows.map((row) => row.id));
  const totalRows = rows.length;
  const exportAll = first(query.export) === "all";
  const pageSize = exportAll ? Math.max(totalRows, 1) : 25;
  const requestedPage = Number(first(query.page) ?? "1");
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, totalRows);
  const pageParameters = Object.fromEntries(queryEntries(query).filter(([key]) => !["page", "selected", "matchStore"].includes(key)));
  const pageHref = (page: number) => hrefWithQuery(routePath(route), { ...pageParameters, page: String(page) });
  rows = rows.slice(pageStart, pageEnd);
  const baseMeta = listMeta[route];
  const accountabilityMeta: Partial<Record<OperatorListRoute, typeof baseMeta>> = {
    "work-orders": {
      ...baseMeta,
      description: "Create vendor work orders and track each one through issuance, check-in, checkout, and closure.",
      placeholder: "Search work-order number, problem, store, or vendor",
    },
    visits: {
      ...baseMeta,
      description: "Review vendor check-in, checkout, linked work order, location evidence, and recorded outcome.",
      placeholder: "Search technician, vendor, store, or work order",
    },
    stores: {
      ...baseMeta,
      description: "Find a location, review its open work and onsite vendors, or open its store check-in page.",
      placeholder: "Search store number, name, address, city, or alias",
    },
  };
  const meta = session.demoEdition === "accountability"
    ? accountabilityMeta[route] ?? baseMeta
    : baseMeta;
  const visitPlan = route === "work-orders" ? first(query.visitPlan) : undefined;
  const defaultTableColumns = session.demoEdition === "accountability"
    ? columns[route].filter((column) => {
        if (route === "work-orders" || route === "stores") return column.key !== "cost";
        return true;
      })
    : columns[route];
  const tableColumns = route === "work-orders" && visitPlan === "ready"
    ? [
        { key: "work", label: "Work order / issue" },
        { key: "store", label: "Store" },
        { key: "assignment", label: "How to handle it" },
        { key: "next", label: "Review timing" },
      ]
    : defaultTableColumns;
  const activeFilters = appliedFilters(fixture, scopeFixture(fixture, session), route, query);
  const visitStatus = route === "visits" ? first(query.status) : undefined;
  const visitTotal = route === "visits"
    ? scoped.visits.filter((visit) => !first(query.vendor) || visit.vendorId === first(query.vendor)).length
    : undefined;
  const upcomingVisitCount = route === "visits"
    ? (fixture.serviceAppointments ?? []).filter((appointment) => {
        if (appointment.organizationId !== scoped.organizationId || appointment.status !== "confirmed" || Date.parse(appointment.startsAt) < Date.parse(fixture.asOf)) return false;
        const work = scoped.workOrders.find((candidate) => candidate.id === appointment.workOrderId);
        if (!work) return false;
        const requestedVendorId = first(query.vendor);
        if (!requestedVendorId) return true;
        const assignment = fixture.assignments.find((candidate) => candidate.organizationId === scoped.organizationId && candidate.id === appointment.assignmentId);
        return assignment?.vendorId === requestedVendorId;
      }).length
    : 0;
  const visitFilters = route === "visits"
    ? [{
        id: "visit-status",
        label: "Show",
        options: [
          { value: "all", label: `History (${visitTotal})`, href: hrefWithoutQueryKey(route, query, "status"), selected: !visitStatus },
          { value: "upcoming", label: `Upcoming (${upcomingVisitCount})`, href: hrefWithQuery(routePath(route), { store: first(query.store), vendor: first(query.vendor), status: "upcoming" }), selected: visitStatus === "upcoming" },
          { value: "active", label: `Onsite (${scoped.visits.filter((visit) => visit.status === "active").length})`, href: hrefWithQuery(routePath(route), { store: first(query.store), vendor: first(query.vendor), status: "active" }), selected: visitStatus === "active" },
          { value: "checked_out", label: `Completed (${scoped.visits.filter((visit) => visit.status === "checked_out").length})`, href: hrefWithQuery(routePath(route), { store: first(query.store), vendor: first(query.vendor), status: "checked_out" }), selected: visitStatus === "checked_out" },
        ],
      }]
    : undefined;
  const activeHeldWork = route === "work-orders"
    ? (fixture.workOrderVisitHolds ?? []).filter((hold) => hold.organizationId === scoped.organizationId && hold.status === "active" && filteredRowIds.has(hold.workOrderId) && scoped.workOrders.some((work) => work.id === hold.workOrderId && work.status === "approved"))
    : [];
  const openStoreWork = route === "stores"
    ? scoped.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status))
    : [];
  const storeWorkIds = route === "stores" ? new Set(scoped.workOrders.map((work) => work.id)) : new Set<string>();
  const storeRecordedCostMinor = route === "stores"
    ? fixture.costLines
        .filter((line) => line.organizationId === scoped.organizationId && storeWorkIds.has(line.workOrderId))
        .reduce((sum, line) => sum + line.amount.amountMinor, 0)
    : 0;
  const heldStoreCounts = new Map<string, number>();
  for (const hold of activeHeldWork) {
    const work = scoped.workOrders.find((candidate) => candidate.id === hold.workOrderId);
    if (work) heldStoreCounts.set(work.storeId, (heldStoreCounts.get(work.storeId) ?? 0) + 1);
  }
  const workTimingContext = route === "work-orders"
    ? Object.fromEntries(queryEntries(query).filter(([key]) => ![
        "page", "selected", "visitPlan", "reviewWindow", "opportunity", "storeGroup", "matchStore",
      ].includes(key)))
    : {};
  const workFilters = route === "work-orders"
    ? [{
        id: "work-visit-plan",
        label: "Work timing",
        options: [
          { value: "all", label: `All work (${scoped.workOrders.length})`, href: hrefWithQuery(routePath(route), workTimingContext), selected: !visitPlan },
          { value: "ready", label: `Approved for next suitable visit (${activeHeldWork.length})`, href: hrefWithQuery(routePath(route), { ...workTimingContext, visitPlan: "ready" }), selected: visitPlan === "ready" },
        ],
      }]
    : undefined;
  const allAttention = route === "action-center" ? actionsForSession(fixture, scoped, session, 200) : [];
  const scopedEstimateRequests = route === "estimates"
    ? (fixture.estimateRequests ?? []).filter((request) => request.organizationId === scoped.organizationId && scoped.workOrders.some((work) => work.id === request.workOrderId))
    : [];
  const estimateStatus = route === "estimates" ? first(query.status) : undefined;
  const estimateDecision = route === "estimates" ? first(query.decision) : undefined;
  const estimateFilters = route === "estimates"
    ? [
        {
          id: "estimate-status",
          label: "Status",
          options: [
            { value: "all", label: `All (${scopedEstimateRequests.length})`, href: hrefWithoutQueryKey(route, query, "status"), selected: !estimateStatus },
            { value: "requested", label: `Requested (${scopedEstimateRequests.filter((item) => item.status === "requested").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), decision: estimateDecision, status: "requested" }), selected: estimateStatus === "requested" },
            { value: "opened", label: `Opened (${scopedEstimateRequests.filter((item) => item.status === "opened").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), decision: estimateDecision, status: "opened" }), selected: estimateStatus === "opened" },
            { value: "submitted", label: `Submitted (${scopedEstimateRequests.filter((item) => item.status === "submitted").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), decision: estimateDecision, status: "submitted" }), selected: estimateStatus === "submitted" },
            { value: "selected", label: `Selected (${scopedEstimateRequests.filter((item) => item.status === "selected").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), decision: estimateDecision, status: "selected" }), selected: estimateStatus === "selected" },
          ],
        },
        {
          id: "estimate-decision",
          label: "Purpose",
          options: [
            { value: "all", label: "All", href: hrefWithoutQueryKey(route, query, "decision"), selected: !estimateDecision },
            { value: "service_bid", label: "Service bids", href: hrefWithQuery(routePath(route), { q: first(query.q), status: estimateStatus, decision: "service_bid" }), selected: estimateDecision === "service_bid" },
            { value: "replacement_quote", label: "Replacement quotes", href: hrefWithQuery(routePath(route), { q: first(query.q), status: estimateStatus, decision: "replacement_quote" }), selected: estimateDecision === "replacement_quote" },
          ],
        },
      ]
    : undefined;
  const requestedActionType = route === "action-center" ? first(query.type) : undefined;
  const actionType = requestedActionType === "exception"
    ? "service-record"
    : requestedActionType === "vendor-reminder"
      ? "vendor-task"
      : requestedActionType;
  const actionPriority = route === "action-center" ? first(query.priority) : undefined;
  const actionFilters = route === "action-center"
    ? [
        {
          id: "attention-type",
          label: "Show",
          options: [
            { value: "all", label: `All (${allAttention.length})`, href: hrefWithoutQueryKey(route, query, "type"), selected: !actionType },
            { value: "service-record", label: `Records to check (${allAttention.filter((item) => item.attentionType === "service_record").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), priority: actionPriority, type: "service-record" }), selected: actionType === "service-record" },
            { value: "follow-up", label: `Follow-ups (${allAttention.filter((item) => item.attentionType === "follow_up").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), priority: actionPriority, type: "follow-up" }), selected: actionType === "follow-up" },
            { value: "vendor-task", label: `Vendor tasks (${allAttention.filter((item) => item.attentionType === "vendor_task").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), priority: actionPriority, type: "vendor-task" }), selected: actionType === "vendor-task" },
          ],
        },
        {
          id: "attention-priority",
          label: "Priority",
          options: [
            { value: "all", label: "All", href: hrefWithoutQueryKey(route, query, "priority"), selected: !actionPriority },
            { value: "urgent", label: `Do now (${allAttention.filter((item) => item.tone === "critical").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), type: actionType, priority: "urgent" }), selected: actionPriority === "urgent" },
            { value: "standard", label: `Other items (${allAttention.filter((item) => item.tone !== "critical").length})`, href: hrefWithQuery(routePath(route), { q: first(query.q), type: actionType, priority: "standard" }), selected: actionPriority === "standard" },
          ],
        },
      ]
    : undefined;
  const primaryAction = route === "requests" && roleCan(session.role, "create_request")
    ? { label: "Report an issue", href: "/app/requests/new" }
    : route === "work-orders" && roleCan(session.role, "create_work_order")
      ? { label: "Create work order", href: "/app/work-orders/new" }
      : route === "stores" && roleCan(session.role, "create_store")
        ? { label: "Add store", href: "/app/stores/new" }
        : route === "vendors" && roleCan(session.role, "onboard_vendor")
          ? { label: "Add vendor", href: "/app/vendors/new" }
          : undefined;

  return {
    state: rows.length || !q ? { kind: "ready" } : { kind: "empty", title: "No matching records", message: "Try another store number, address, vendor, or keyword." },
    page: {
      title: route === "visits" && visitStatus === "active"
        ? "Vendors onsite now"
        : route === "visits" && visitStatus === "upcoming"
          ? "Upcoming visits"
          : route === "work-orders" && visitPlan === "ready"
            ? "Approved for next suitable visit"
            : meta.title,
      eyebrow: route === "visits" && visitStatus === "upcoming" ? "Scheduled service" : meta.eyebrow,
      description: route === "visits" && visitStatus === "active"
        ? `${totalRows} active visit${totalRows === 1 ? "" : "s"} · ${visitTotal} total visits in scope. Location and time are presence evidence, not certified labor.`
        : route === "visits" && visitStatus === "upcoming"
          ? "Vendor-confirmed appointments that have not started yet. Times display in each store’s local time."
          : route === "work-orders" && visitPlan === "ready"
            ? "Small jobs already approved to wait for a suitable visit. Review them by store, use a confirmed visit as a factual opportunity, or send selected jobs together."
            : meta.description,
      scopeLabel: activeScopeLabel,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
      primaryAction,
      secondaryAction: route === "work-orders" && activeHeldWork.length ? { label: "Send approved jobs together", href: "/app/store-sweeps/new" } : undefined,
    },
    metrics: route === "visits"
      ? visitMetrics(fixture, scoped, query)
      : route === "work-orders"
        ? [
            { id: "ready-to-bundle", label: "Approved for next suitable visit", value: String(activeHeldWork.length), supportingText: "Approved jobs that can wait for a practical opportunity", tone: activeHeldWork.length ? "info" : "positive", link: { href: "/app/work-orders?visitPlan=ready", label: "Open the list" } },
            { id: "store-sweep-opportunities", label: "Stores with 2+ approved jobs", value: String([...heldStoreCounts.values()].filter((count) => count >= 2).length), supportingText: "Review these stores before deciding whether one vendor can handle the work", tone: [...heldStoreCounts.values()].some((count) => count >= 2) ? "warning" : "positive", link: { href: "/app/store-sweeps/new", label: "Review jobs by store" } },
          ]
      : route === "stores"
        ? [
            { id: "stores-in-scope", label: "Stores in scope", value: String(scoped.stores.length), supportingText: "Every location available to your role", tone: "neutral", link: { href: "/app/stores", label: "Open store directory" } },
            { id: "store-open-work", label: "Open work orders", value: String(openStoreWork.length), supportingText: `${new Set(openStoreWork.map((work) => work.storeId)).size} store${new Set(openStoreWork.map((work) => work.storeId)).size === 1 ? "" : "s"} currently have open work`, tone: openStoreWork.length ? "warning" : "positive", link: { href: "/app/work-orders?status=open", label: "Open source work" } },
            { id: "store-onsite-now", label: "Vendors onsite now", value: String(scoped.visits.filter((visit) => visit.status === "active").length), supportingText: "Active, server-timestamped check-ins", tone: scoped.visits.some((visit) => visit.status === "active") ? "info" : "neutral", link: { href: "/app/visits?status=active", label: "Open active visits" } },
            { id: "store-recorded-cost", label: "Recorded work cost", value: money(storeRecordedCostMinor), supportingText: "Entered cost lines for these stores", tone: "neutral", link: { href: "/app/spend", label: "Open cost breakdown" } },
          ]
      : route === "action-center"
        ? [
            { id: "attention-urgent", label: "Do now", value: String(allAttention.filter((item) => item.tone === "critical").length), supportingText: "Urgent or past due", tone: allAttention.some((item) => item.tone === "critical") ? "critical" : "positive", link: { href: "/app/action-center?priority=urgent", label: "Show these items" } },
            { id: "attention-service", label: "Records to check", value: String(allAttention.filter((item) => item.attentionType === "service_record").length), supportingText: "Visits, invoices, or scheduled maintenance", tone: "info", link: { href: "/app/action-center?type=service-record", label: "Show these records" } },
            { id: "attention-followups", label: "Follow-ups", value: String(allAttention.filter((item) => item.attentionType === "follow_up").length), supportingText: "Updates still needed", tone: "warning", link: { href: "/app/action-center?type=follow-up", label: "Show follow-ups" } },
            { id: "attention-vendor-tasks", label: "Vendor tasks", value: String(allAttention.filter((item) => item.attentionType === "vendor_task").length), supportingText: "Insurance, availability, or planning", tone: "neutral", link: { href: "/app/action-center?type=vendor-task", label: "Show vendor tasks" } },
          ]
        : undefined,
    filters: visitFilters ?? workFilters ?? actionFilters ?? estimateFilters,
    appliedFilters: activeFilters,
    clearFiltersHref: activeFilters.length ? routePath(route) : undefined,
    table: { id: route, caption: route === "work-orders" && visitPlan === "ready" ? "Approved for next suitable visit" : route === "visits" && visitStatus === "upcoming" ? "Upcoming visits" : meta.title, columns: tableColumns, rows },
    resultSummary: route === "work-orders" && visitPlan === "ready"
      ? `${totalRows} approved job${totalRows === 1 ? "" : "s"} across ${heldStoreCounts.size} store${heldStoreCounts.size === 1 ? "" : "s"}`
      : route === "visits" && visitStatus === "upcoming"
        ? `${totalRows} upcoming appointment${totalRows === 1 ? "" : "s"}`
      : route === "visits" && visitTotal !== undefined && totalRows !== visitTotal
          ? `${totalRows} matching of ${visitTotal} visits`
          : route === "action-center"
            ? `${totalRows} item${totalRows === 1 ? "" : "s"}`
          : `${totalRows} source record${totalRows === 1 ? "" : "s"}`,
    search: meta.placeholder ? {
      label: `Search ${meta.title}`,
      placeholder: meta.placeholder,
      value: first(query.q),
      action: routePath(route),
      preservedParameters: queryEntries(query)
        .filter(([key]) => key !== "q" && key !== "page")
        .map(([name, value]) => ({ name, value })),
    } : undefined,
    pagination: totalRows > pageSize ? paginationModel(totalRows, currentPage, pageSize, pageHref) : undefined,
  };
}

export function buildSearchModel(
  fixture: OpsFixture,
  session: OperatorSession,
  query: OperatorSearchParameters = {},
): SearchPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const q = cleanSearch(first(query.q));
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));

  const equipmentRows = q
    ? scoped.assets
        .filter((asset) => searchable(
          asset.assetTag,
          asset.name,
          asset.manufacturer,
          asset.model,
          asset.serialNumber,
          asset.categoryKey,
          ...asset.groupPath,
          storeLabel(storeById.get(asset.storeId)),
        ).includes(q))
        .sort((a, b) => a.assetTag.localeCompare(b.assetTag))
        .map<TableRowViewModel>((asset) => ({
          id: asset.id,
          label: asset.name,
          href: `/app/equipment/${asset.id}`,
          cells: [
            { key: "result", value: asset.name, secondary: `${asset.assetTag} · ${asset.manufacturer ?? "Manufacturer not entered"} ${asset.model ?? ""}`.trim() },
            { key: "context", value: storeLabel(storeById.get(asset.storeId)), secondary: assetHierarchyPath(asset).join(" › ") },
          ],
        }))
    : [];

  const groups = q
    ? [
        { id: "stores", label: "Stores", rows: storeRows(fixture, scoped, { q }) },
        { id: "work", label: "Work orders", rows: workRows(fixture, scoped, { q }) },
        { id: "vendors", label: "Vendors", rows: vendorRows(fixture, scoped, { q }) },
        ...(session.demoEdition === "accountability"
          ? []
          : [{ id: "equipment", label: "Equipment", rows: equipmentRows }]),
        ...(session.role === "finance" ? [] : [
          { id: "visits", label: "Service visits", rows: visitRows(fixture, scoped, { q }) },
        ]),
        ...(session.demoEdition === "accountability" || session.role === "finance" ? [] : [
          {
            id: "requests",
            label: "Requests",
            rows: fixture.requests
              .filter((request) => request.organizationId === scoped.organizationId && scoped.storeIds.has(request.storeId))
              .filter((request) => searchable(request.reference, request.problem, request.reporterName, storeLabel(storeById.get(request.storeId))).includes(q))
              .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
              .map<TableRowViewModel>((request) => ({
                id: request.id,
                label: request.reference,
                href: `/app/requests/${request.id}`,
                cells: [
                  { key: "result", value: request.reference, secondary: request.problem },
                  { key: "context", value: storeLabel(storeById.get(request.storeId)), secondary: request.reporterName },
                ],
              })),
          },
        ]),
      ].map((group) => ({ ...group, resultCount: group.rows.length, rows: group.rows.slice(0, 8) }))
        .filter((group) => group.resultCount > 0)
    : [];
  const total = groups.reduce((sum, group) => sum + group.resultCount, 0);

  return {
    state: !q
      ? {
          kind: "empty",
          title: session.demoEdition === "accountability" ? "Search vendor accountability records" : "Search the whole operation",
          message: session.demoEdition === "accountability"
            ? "Try a store number, address, work order, vendor specialty, technician, or visit."
            : "Try a store number, address, work order, vendor specialty, equipment tag, serial number, technician, or request.",
        }
      : total
        ? { kind: "ready" }
        : { kind: "empty", title: "No matches found", message: `Nothing in your access scope matched “${first(query.q)?.trim()}”. Try a shorter name, number, address, or equipment term.` },
    page: {
      title: q ? `Search results for “${first(query.q)?.trim()}”` : "Search the workspace",
      eyebrow: session.demoEdition === "accountability" ? "Accountability package · One search" : "One search · Your full scope",
      description: session.demoEdition === "accountability"
        ? "Find a store, work order, vendor, or service visit without deciding which screen to open first."
        : "Find a store, work order, request, vendor, service visit, or piece of equipment without deciding which module to open first.",
      scopeLabel: session.scopeLabel,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
    },
    query: first(query.q)?.trim() ?? "",
    placeholder: session.demoEdition === "accountability"
      ? "Store, work order, vendor, technician, or visit"
      : "Store, address, work order, vendor, equipment, or serial number",
    resultSummary: `${total} match${total === 1 ? "" : "es"} across ${groups.length} record type${groups.length === 1 ? "" : "s"}`,
    groups,
  };
}

function categoryCostMap(scoped: ScopedFixture, costByWork: Map<string, number>): Map<string, number> {
  const result = new Map<string, number>();
  for (const work of scoped.workOrders) {
    const key = work.categoryKey ?? "unclassified";
    result.set(key, (result.get(key) ?? 0) + (costByWork.get(work.id) ?? 0));
  }
  return result;
}

export function buildProgramModel(
  fixture: OpsFixture,
  session: OperatorSession,
  route: OperatorProgramRoute,
  query: OperatorSearchParameters = {},
): ProgramPageViewModel {
  const selectedRegionId = first(query.region);
  const selectedStoreId = first(query.store);
  const regionalScope = narrowScopeToRegion(scopeFixture(fixture, session), selectedRegionId);
  const scoped = narrowScopeToStore(regionalScope, selectedStoreId);
  const selectedRegion = selectedRegionId
    ? fixture.regions.find((region) => region.organizationId === session.organizationId && region.id === selectedRegionId)
    : undefined;
  const selectedStore = selectedStoreId ? scoped.stores.find((store) => store.id === selectedStoreId) : undefined;
  const activeScopeLabel = selectedStore
    ? storeLabel(selectedStore)
    : selectedRegion
      ? `${selectedRegion.name} · ${scoped.stores.length} stores`
      : session.scopeLabel;
  const costByWork = recordedCostByWork(fixture, scoped.organizationId);
  const allActions = actions(fixture, scoped, 6);

  if (route === "spend") {
    const period = spendPeriod(fixture.asOf, first(query.period));
    const periodStart = period.start;
    const basis = first(query.basis) === "invoiced" ? "invoiced" : "recorded";
    const recordedAmountByWork = recordedCostByWork(fixture, scoped.organizationId, periodStart);
    const selectedCategory = first(query.category);
    const selectedPath = pathSegments(first(query.path));
    const selectedAssetId = first(query.asset);
    const selectedComponentId = first(query.component);
    const assetById = new Map(scoped.assets.map((asset) => [asset.id, asset]));
    const selectedAsset = selectedAssetId && selectedAssetId !== "unlinked" ? assetById.get(selectedAssetId) : undefined;
    const componentById = new Map(
      fixture.components
        .filter((component) => component.organizationId === scoped.organizationId)
        .map((component) => [component.id, component]),
    );
    const selectedComponent = selectedComponentId && selectedComponentId !== "unlinked"
      ? componentById.get(selectedComponentId)
      : undefined;
    const spendWork = scoped.workOrders
      .filter((work) => !selectedCategory || (work.categoryKey ?? "unclassified") === selectedCategory)
      .filter((work) => !selectedAssetId || (selectedAssetId === "unlinked" ? !work.assetId : work.assetId === selectedAssetId))
      .filter((work) => !selectedComponentId || (selectedComponentId === "unlinked" ? !work.componentId : work.componentId === selectedComponentId))
      .filter((work) => selectedPath.length === 0 || assetMatchesPath(work.assetId ? assetById.get(work.assetId) : undefined, selectedPath));
    const spendScope: ScopedFixture = { ...scoped, workOrders: spendWork };
    const scopedWorkIds = new Set(spendWork.map((work) => work.id));
    const periodInvoiceIds = new Set(fixture.invoiceReferences.filter((invoice) => invoice.organizationId === scoped.organizationId && invoice.invoiceDate >= periodStart && invoice.invoiceDate <= fixture.asOf.slice(0, 10)).map((invoice) => invoice.id));
    const invoiceAmountByWork = new Map<string, number>();
    for (const allocation of fixture.invoiceAllocations) if (allocation.organizationId === scoped.organizationId && scopedWorkIds.has(allocation.workOrderId) && periodInvoiceIds.has(allocation.invoiceReferenceId)) invoiceAmountByWork.set(allocation.workOrderId, (invoiceAmountByWork.get(allocation.workOrderId) ?? 0) + allocation.amount.amountMinor);
    const basisAmountByWork = basis === "invoiced" ? invoiceAmountByWork : recordedAmountByWork;
    const sourceLines = fixture.costLines.filter(
      (line) =>
        line.organizationId === scoped.organizationId &&
        scopedWorkIds.has(line.workOrderId) &&
        line.serviceDate >= periodStart,
    );
    const total = costForWorkIds(basisAmountByWork, spendWork.map((work) => work.id));
    const storeCost = new Map<string, number>();
    for (const store of scoped.stores) {
      storeCost.set(
        store.id,
        costForWorkIds(basisAmountByWork, spendWork.filter((work) => work.storeId === store.id).map((work) => work.id)),
      );
    }
    const ranked = [...storeCost.values()].sort((a, b) => b - a);
    const median = ranked.length ? ranked[Math.floor(ranked.length / 2)] : 0;
    const unclassified = spendWork.filter((work) => {
      if ((basisAmountByWork.get(work.id) ?? 0) <= 0) return false;
      if (!selectedCategory) return !work.categoryKey;
      if (!work.assetId) return true;
      if (selectedAssetId && !work.componentId) return true;
      return false;
    });
    const invoiceIds = new Set(
      fixture.invoiceAllocations
        .filter(
          (allocation) =>
            allocation.organizationId === scoped.organizationId &&
            scopedWorkIds.has(allocation.workOrderId),
        )
        .map((allocation) => allocation.invoiceReferenceId),
    );
    const invoiceCount = fixture.invoiceReferences.filter(
      (invoice) =>
        invoice.organizationId === scoped.organizationId &&
        invoiceIds.has(invoice.id) &&
        invoice.invoiceDate >= periodStart,
    ).length;
    const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
    const equipmentCost = new Map<string, number>();
    for (const work of spendWork) {
      const key = work.assetId ?? "unlinked";
      equipmentCost.set(key, (equipmentCost.get(key) ?? 0) + (basisAmountByWork.get(work.id) ?? 0));
    }
    const workLink = (extra: Record<string, string | undefined>) => hrefWithQuery("/app/work-orders", {
      region: selectedRegionId,
      store: selectedStoreId,
      category: selectedCategory,
      path: selectedPath.length ? selectedPath.join("|") : undefined,
      asset: selectedAssetId,
      component: selectedComponentId,
      costFrom: periodStart,
      basis,
      period: period.key,
      ...extra,
    });
    const comparisonMetric: MetricViewModel = selectedStoreId
      ? {
          id: "cost-bearing-work",
          label: "Cost-bearing work",
          value: String([...basisAmountByWork.keys()].filter((workId) => scopedWorkIds.has(workId)).length),
          supportingText: basis === "recorded" ? "Work orders with entered cost in this scope and period" : "Work orders with confirmed invoice allocations in this scope and period",
          link: { href: workLink({ hasCost: "true" }), label: "Open source work" },
        }
      : {
          id: "median",
          label: "Median store cost",
          value: money(median),
          supportingText: "Useful comparison; not a budget target",
          link: { href: "/app/stores?sort=cost", label: "Compare stores" },
        };

    const spendHref = (overrides: Record<string, string | undefined> = {}) => hrefWithQuery("/app/spend", {
      region: selectedRegionId,
      store: selectedStoreId,
      category: selectedCategory,
      path: selectedPath.length ? selectedPath.join("|") : undefined,
      asset: selectedAssetId,
      component: selectedComponentId,
      basis,
      period: period.key,
      ...overrides,
    });
    const hierarchyParts = [
      selectedCategory ? sentence(selectedCategory) : undefined,
      ...selectedPath.slice(selectedPath[0]?.toLocaleLowerCase("en-US") === (selectedCategory ? sentence(selectedCategory).toLocaleLowerCase("en-US") : undefined) ? 1 : 0),
      selectedAsset?.name,
      selectedComponent?.name,
    ].filter(Boolean);
    const hierarchyLabel = hierarchyParts.length ? hierarchyParts.join(" › ") : "All service areas";
    const upHref = selectedComponentId
      ? spendHref({ component: undefined })
      : selectedAssetId
        ? spendHref({ asset: undefined })
        : selectedPath.length
          ? spendHref({ path: selectedPath.length > 2 ? selectedPath.slice(0, -1).join("|") : undefined })
          : selectedCategory
            ? spendHref({ category: undefined })
            : selectedStoreId
              ? spendHref({ store: undefined })
              : selectedRegionId
                ? spendHref({ region: undefined })
                : undefined;

    let hierarchyBreakdown: BreakdownViewModel;
    if (selectedComponentId) {
      const kindCost = new Map<string, number>();
      if (basis === "recorded") for (const line of sourceLines) kindCost.set(line.kind, (kindCost.get(line.kind) ?? 0) + line.amount.amountMinor);
      else kindCost.set("linked invoice amount", total);
      hierarchyBreakdown = costBreakdown(
        basis === "recorded" ? "Recorded cost by source type" : "Linked invoice amount",
        kindCost,
        () => workLink({ hasCost: "true" }),
        { description: "This is the deepest configured component level. Open the source work orders for every entered cost line.", sourceHref: workLink({ hasCost: "true" }), amountLabel: basis === "recorded" ? "recorded cost" : "linked invoice amount" },
      );
    } else if (selectedAssetId) {
      const componentCost = new Map<string, number>();
      for (const work of spendWork) {
        const key = work.componentId ?? "unlinked";
        componentCost.set(key, (componentCost.get(key) ?? 0) + (basisAmountByWork.get(work.id) ?? 0));
      }
      hierarchyBreakdown = costBreakdown(
        `${basis === "recorded" ? "Recorded cost" : "Linked invoice amount"} by component`,
        componentCost,
        (key) => key === "unlinked" ? workLink({ component: "unlinked", hasCost: "true" }) : spendHref({ component: key }),
        {
          description: "Component depth is optional. Cost that stops at the equipment record remains visible.",
          labelFor: (key) => key === "unlinked" ? "Not classified to a component" : componentById.get(key)?.name ?? "Unknown component",
          sourceHref: workLink({ hasCost: "true" }),
          amountLabel: basis === "recorded" ? "recorded cost" : "linked invoice amount",
        },
      );
    } else if (selectedCategory) {
      const nextValues = new Map<string, number>();
      const nextKind = new Map<string, "path" | "asset" | "source">();
      const categoryRoot = selectedPath.length === 0;
      for (const work of spendWork) {
        const amount = basisAmountByWork.get(work.id) ?? 0;
        const asset = work.assetId ? assetById.get(work.assetId) : undefined;
        if (!asset) {
          nextValues.set("unlinked", (nextValues.get("unlinked") ?? 0) + amount);
          nextKind.set("unlinked", "source");
          continue;
        }
        const fullPath = assetHierarchyPath(asset);
        const currentPath = categoryRoot ? [fullPath[0]] : selectedPath;
        const nextSegment = fullPath[currentPath.length];
        if (nextSegment) {
          const nextPath = [...currentPath, nextSegment].join("|");
          nextValues.set(nextPath, (nextValues.get(nextPath) ?? 0) + amount);
          nextKind.set(nextPath, "path");
        } else {
          nextValues.set(asset.id, (nextValues.get(asset.id) ?? 0) + amount);
          nextKind.set(asset.id, "asset");
        }
      }
      hierarchyBreakdown = costBreakdown(
        categoryRoot ? `Where ${sentence(selectedCategory)} cost sits` : `Cost below ${selectedPath.at(-1)}`,
        nextValues,
        (key) => nextKind.get(key) === "path"
          ? spendHref({ path: key })
          : nextKind.get(key) === "asset"
            ? spendHref({ asset: key })
            : workLink({ asset: "unlinked", hasCost: "true" }),
        {
          description: "Open each level until you reach a specific equipment record. Unclassified cost never disappears.",
          labelFor: (key) => key === "unlinked" ? "Unclassified below this level" : nextKind.get(key) === "asset" ? assetById.get(key)?.name ?? "Unknown equipment" : key.split("|").at(-1) ?? key,
          sourceHref: workLink({ hasCost: "true" }),
          amountLabel: basis === "recorded" ? "recorded cost" : "linked invoice amount",
        },
      );
    } else {
      hierarchyBreakdown = costBreakdown(
        `${basis === "recorded" ? "Recorded cost" : "Linked invoice amount"} by service area`,
        categoryCostMap(spendScope, basisAmountByWork),
        (key) => key === "unclassified" ? workLink({ category: "unclassified", hasCost: "true" }) : spendHref({ category: key }),
        { description: "Choose a service area to continue through organization-defined groups, equipment, and optional components.", sourceHref: workLink({ hasCost: "true" }), amountLabel: basis === "recorded" ? "recorded cost" : "linked invoice amount" },
      );
    }

    const regionOptions = fixture.regions
      .filter((region) => region.organizationId === scoped.organizationId && scopeFixture(fixture, session).stores.some((store) => store.regionId === region.id))
      .map((region) => ({ value: region.id, label: region.name, href: spendHref({ region: region.id, store: undefined }), selected: region.id === selectedRegionId }));
    const categoryOptions = [...new Set(scopeFixture(fixture, session).workOrders.map((work) => work.categoryKey).filter((value): value is string => Boolean(value)))]
      .sort()
      .map((category) => ({ value: category, label: sentence(category), href: spendHref({ category, path: undefined, asset: undefined, component: undefined }), selected: category === selectedCategory }));
    const monthKeys = rollingMonthKeys(fixture.asOf, period.months);
    const monthly = new Map<string, number>();
    if (basis === "recorded") for (const line of sourceLines) monthly.set(monthKey(line.serviceDate), (monthly.get(monthKey(line.serviceDate)) ?? 0) + line.amount.amountMinor);
    else {
      const invoiceById = new Map(fixture.invoiceReferences.filter((invoice) => invoice.organizationId === scoped.organizationId).map((invoice) => [invoice.id, invoice]));
      for (const allocation of fixture.invoiceAllocations) { const invoice = invoiceById.get(allocation.invoiceReferenceId); if (allocation.organizationId === scoped.organizationId && scopedWorkIds.has(allocation.workOrderId) && invoice && invoice.invoiceDate >= periodStart) monthly.set(monthKey(invoice.invoiceDate), (monthly.get(monthKey(invoice.invoiceDate)) ?? 0) + allocation.amount.amountMinor); }
    }
    const invoiceSourceHref = (from: string, to: string) => hrefWithQuery("/app/invoices", {
      from,
      to,
      region: selectedRegionId,
      store: selectedStoreId,
      category: selectedCategory,
      path: selectedPath.length ? selectedPath.join("|") : undefined,
      asset: selectedAssetId,
      component: selectedComponentId,
    });
    const spendTrendModel: TrendViewModel = { id: "actual-spend-trend", title: `${basis === "recorded" ? "Recorded work cost" : "Linked invoice amount"} — ${period.key === "ytd" ? "year to date" : `last ${period.months} months`}`, description: basis === "recorded" ? "Entered work costs grouped by service month. Invoice amounts are not included in this basis." : "Confirmed invoice allocations grouped by invoice month. Recorded work costs are not included in this basis.", points: monthKeys.map((key) => ({ id: key, label: monthLabel(key), value: monthly.get(key) ?? 0, formattedValue: money(monthly.get(key) ?? 0), link: { href: basis === "recorded" ? workLink({ costMonth: key, hasCost: "true" }) : invoiceSourceHref(`${key}-01`, monthEndDate(key)), label: `Open ${monthLabel(key)} source records` } })), sourceLink: { href: basis === "recorded" ? workLink({ hasCost: "true" }) : invoiceSourceHref(periodStart, fixture.asOf.slice(0, 10)), label: "Open all exact source records" } };
    const sourceWork = spendWork.filter((work) => (basisAmountByWork.get(work.id) ?? 0) > 0).sort((a, b) => (basisAmountByWork.get(b.id) ?? 0) - (basisAmountByWork.get(a.id) ?? 0) || a.number.localeCompare(b.number));
    const spendPageSize = 25;
    const requestedSpendPage = Number(first(query.page));
    const spendTotalPages = Math.max(1, Math.ceil(sourceWork.length / spendPageSize));
    const spendCurrentPage = Math.min(Number.isFinite(requestedSpendPage) && requestedSpendPage > 0 ? Math.floor(requestedSpendPage) : 1, spendTotalPages);
    const spendPageStart = (spendCurrentPage - 1) * spendPageSize;
    const sourceRows = sourceWork.slice(spendPageStart, spendPageStart + spendPageSize).map<TableRowViewModel>((work) => ({ id: work.id, label: work.number, href: `/app/work-orders/${work.id}?view=records`, cells: [
      { key: "work", value: work.number, secondary: work.problem },
      { key: "store", value: storeLabel(storeById.get(work.storeId)) },
      { key: "category", value: work.categoryKey ? sentence(work.categoryKey) : "Unclassified" },
      { key: "amount", value: money(basisAmountByWork.get(work.id) ?? 0) },
      { key: "basis", value: basis === "recorded" ? "Recorded work cost" : "Confirmed invoice allocation" },
    ] }));
    const filters = [
      { id: "period", label: "Period", options: [
        { value: "3m", label: "3 months", href: spendHref({ period: "3m" }), selected: period.key === "3m" },
        { value: "6m", label: "6 months", href: spendHref({ period: "6m" }), selected: period.key === "6m" },
        { value: "12m", label: "12 months", href: spendHref({ period: "12m" }), selected: period.key === "12m" },
        { value: "ytd", label: "Year to date", href: spendHref({ period: "ytd" }), selected: period.key === "ytd" },
      ] },
      { id: "basis", label: "Amount basis", options: [
        { value: "recorded", label: "Recorded work cost", href: spendHref({ basis: "recorded" }), selected: basis === "recorded" },
        { value: "invoiced", label: "Linked invoice amount", href: spendHref({ basis: "invoiced" }), selected: basis === "invoiced" },
      ] },
      {
        id: "region",
        label: "Region",
        options: [
          { value: "all", label: "All regions", href: spendHref({ region: undefined, store: undefined }), selected: !selectedRegionId },
          ...regionOptions,
        ],
      },
      {
        id: "category",
        label: "Service area",
        options: [
          { value: "all", label: "All service areas", href: spendHref({ category: undefined, path: undefined, asset: undefined, component: undefined }), selected: !selectedCategory },
          ...categoryOptions,
        ],
      },
    ];
    return {
      state: { kind: "ready" },
      page: { title: selectedComponent?.name ?? selectedAsset?.name ?? selectedPath.at(-1) ?? (selectedCategory ? sentence(selectedCategory) : "Maintenance spend"), eyebrow: "Actual spend visibility", description: "Move from company to region, store, service area, flexible equipment groups, equipment, component, work order, and source record while keeping the selected period and amount basis visible.", scopeLabel: `${activeScopeLabel} · ${hierarchyLabel} · ${basis === "recorded" ? "Recorded work cost" : "Linked invoice amount"}`, periodLabel: period.label, updatedLabel: `Through ${date(fixture.asOf)}`, secondaryAction: upHref ? { label: "Up one level", href: upHref } : undefined },
      filters,
      metrics: [
        { id: "total", label: basis === "recorded" ? "Recorded work cost" : "Linked invoice amount", value: money(total), supportingText: basis === "recorded" ? `${sourceLines.length} entered source lines` : `${invoiceAmountByWork.size} work orders with confirmed allocations`, link: { href: basis === "recorded" ? workLink({ hasCost: "true" }) : invoiceSourceHref(periodStart, fixture.asOf.slice(0, 10)), label: "Open exact source records" } },
        comparisonMetric,
        { id: "unclassified", label: selectedAssetId ? "Not mapped to a component" : selectedCategory ? "Not mapped to equipment" : "Unclassified service area", value: String(unclassified.length), supportingText: "Visible rather than forced into a guess", tone: unclassified.length ? "warning" : "positive", link: { href: selectedAssetId ? workLink({ component: "unlinked", hasCost: "true" }) : selectedCategory ? workLink({ asset: "unlinked", hasCost: "true" }) : workLink({ category: "unclassified", hasCost: "true" }), label: "Open source work" } },
        { id: "invoices", label: "Linked invoice references", value: String(invoiceCount), supportingText: "Optional billing safeguard; not required for cost visibility", link: { href: invoiceSourceHref(periodStart, fixture.asOf.slice(0, 10)), label: "Review invoice references" } },
      ],
      breakdowns: [
        hierarchyBreakdown,
        selectedStoreId
          ? costBreakdown(
              `${basis === "recorded" ? "Recorded cost" : "Linked invoice amount"} by equipment`,
              equipmentCost,
              (key) => key === "unlinked" ? workLink({ asset: "unlinked", hasCost: "true" }) : spendHref({ asset: key }),
              {
                labelFor: (key) => key === "unlinked" ? "Not linked to equipment" : assetById.get(key)?.name ?? "Unknown equipment",
                sourceHref: workLink({ hasCost: "true" }),
                amountLabel: basis === "recorded" ? "recorded cost" : "linked invoice amount",
              },
            )
          : costBreakdown(
              `${basis === "recorded" ? "Recorded cost" : "Linked invoice amount"} by store`,
              storeCost,
              (key) => spendHref({ region: undefined, store: key }),
              {
                labelFor: (key) => {
                  const store = storeById.get(key);
                  return store ? `Store ${store.storeNumber}` : "Unknown store";
                },
                sourceHref: workLink({ hasCost: "true" }),
                amountLabel: basis === "recorded" ? "recorded cost" : "linked invoice amount",
              },
            ),
      ],
      trends: [spendTrendModel],
      priorityActions: allActions,
      resultSummary: sourceWork.length ? `Showing ${spendPageStart + 1}–${Math.min(spendPageStart + spendPageSize, sourceWork.length)} of ${sourceWork.length}` : "0 source records",
      pagination: sourceWork.length > spendPageSize
        ? paginationModel(sourceWork.length, spendCurrentPage, spendPageSize, (page) => spendHref({ page: String(page) }))
        : undefined,
      table: { id: "spend-work", caption: `${basis === "recorded" ? "Work orders with recorded cost" : "Work orders with confirmed invoice allocations"} in this scope and period`, columns: [{ key: "work", label: "Work order / problem" }, { key: "store", label: "Store" }, { key: "category", label: "Service area" }, { key: "amount", label: "Amount", align: "end" }, { key: "basis", label: "Source basis" }], rows: sourceRows },
    };
  }

  if (route === "equipment") {
    const categoryCounts = new Map<string, number>();
    for (const asset of scoped.assets) categoryCounts.set(asset.categoryKey, (categoryCounts.get(asset.categoryKey) ?? 0) + 1);
    const statusCounts = new Map<string, number>();
    for (const asset of scoped.assets) statusCounts.set(asset.status, (statusCounts.get(asset.status) ?? 0) + 1);
    const categoryFilter = first(query.category);
    const statusFilter = first(query.status);
    const searchQuery = first(query.q)?.trim().toLocaleLowerCase("en-US");
    const requestedView = first(query.view);
    const equipmentView = requestedView === "all" || requestedView === "recent" || requestedView === "attention"
      ? requestedView
      : categoryFilter || statusFilter || searchQuery
        ? "all"
        : "attention";
    const terminalWorkStatuses = new Set(["closed", "cancelled"]);
    const workByAsset = new Map<string, WorkOrder[]>();
    for (const work of scoped.workOrders) {
      if (!work.assetId) continue;
      const list = workByAsset.get(work.assetId) ?? [];
      list.push(work);
      workByAsset.set(work.assetId, list);
    }
    const attentionAssets = scoped.assets.filter((asset) =>
      asset.status !== "operational" || (workByAsset.get(asset.id) ?? []).some((work) => !terminalWorkStatuses.has(work.status)),
    );
    const recentThreshold = new Date(Date.parse(fixture.asOf) - 90 * 24 * 60 * 60 * 1_000).toISOString();
    const recentlyServicedAssets = scoped.assets.filter((asset) =>
      (workByAsset.get(asset.id) ?? []).some((work) => work.createdAt >= recentThreshold && work.createdAt <= fixture.asOf),
    );
    const viewAssets = equipmentView === "attention" ? attentionAssets : equipmentView === "recent" ? recentlyServicedAssets : scoped.assets;
    const filteredAssets = viewAssets
      .filter((asset) => !categoryFilter || asset.categoryKey === categoryFilter)
      .filter((asset) => !statusFilter || asset.status === statusFilter)
      .filter((asset) => {
        if (!searchQuery) return true;
        const store = scoped.stores.find((item) => item.id === asset.storeId);
        return [asset.name, asset.assetTag, asset.model, asset.serialNumber, store?.storeNumber, store?.name, store?.address1, store?.address2, store?.city, store?.state, store?.postalCode]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("en-US").includes(searchQuery));
      })
      .sort((left, right) => {
        const leftLatest = (workByAsset.get(left.id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ?? "";
        const rightLatest = (workByAsset.get(right.id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ?? "";
        return Number(left.status === "operational") - Number(right.status === "operational") || rightLatest.localeCompare(leftLatest) || left.name.localeCompare(right.name);
      });
    const requestedPage = Number(first(query.page));
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
    const currentPage = Math.min(Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1, totalPages);
    const pageStart = (currentPage - 1) * pageSize;
    const pageAssets = filteredAssets.slice(pageStart, pageStart + pageSize);
    const equipmentHref = (values: Record<string, string | undefined>) => hrefWithQuery("/app/equipment", {
      view: equipmentView,
      store: selectedStoreId,
      category: categoryFilter,
      status: statusFilter,
      q: searchQuery,
      ...values,
    });
    const equipmentAppliedFilters = [
      ...(categoryFilter ? [{ id: "category", label: `Service area: ${sentence(categoryFilter)}`, removeHref: equipmentHref({ category: undefined, page: undefined }) }] : []),
      ...(statusFilter ? [{ id: "status", label: `Status: ${equipmentStatusLabel(statusFilter)}`, removeHref: equipmentHref({ status: undefined, page: undefined }) }] : []),
    ];
    const siteLevelCategories = new Set(["exterior", "store_sanitation"]);
    const workNeedingEquipmentChoice = scoped.workOrders.filter((work) =>
      !work.assetId
      && !siteLevelCategories.has(work.categoryKey ?? "")
      && !["closed", "cancelled"].includes(work.status),
    );
    const rows = pageAssets.map<TableRowViewModel>((asset) => {
      const store = scoped.stores.find((item) => item.id === asset.storeId);
      const linkedWork = workByAsset.get(asset.id) ?? [];
      return { id: asset.id, label: asset.name, href: asset.status === "out_of_service" ? hrefWithQuery(`/app/equipment/${asset.id}`, { section: "service-history" }) : `/app/equipment/${asset.id}`, cells: [
        { key: "asset", value: asset.name, secondary: asset.assetTag },
        { key: "store", value: storeLabel(store) },
        { key: "category", value: sentence(asset.categoryKey), secondary: assetHierarchyPath(asset).slice(1).join(" › ") || "No deeper grouping" },
        { key: "identity", value: asset.model ?? "Model not entered", secondary: asset.serialNumber ? `S/N ${asset.serialNumber}` : "Serial not entered" },
        { key: "work", value: String(linkedWork.length) },
        { key: "status", value: equipmentStatusLabel(asset.status), tone: asset.status === "watch" ? "warning" : asset.status === "operational" ? "positive" : "critical" },
      ] };
    });
    return {
      state: { kind: "ready" },
      page: { title: "Equipment", eyebrow: "Equipment & service history", description: "The default queue shows equipment needing attention—not the whole register. Switch to All equipment at any time, then search by store, asset tag, model, serial number, or location.", scopeLabel: activeScopeLabel, updatedLabel: `Through ${date(fixture.asOf)}` },
      filters: [{ id: "view", label: "View", options: [
        { value: "attention", label: `Needs attention (${attentionAssets.length})`, href: hrefWithQuery("/app/equipment", { view: "attention", store: selectedStoreId }), selected: equipmentView === "attention" },
        { value: "recent", label: `Recently serviced (${recentlyServicedAssets.length})`, href: hrefWithQuery("/app/equipment", { view: "recent", store: selectedStoreId }), selected: equipmentView === "recent" },
        { value: "all", label: `All equipment (${scoped.assets.length})`, href: hrefWithQuery("/app/equipment", { view: "all", store: selectedStoreId }), selected: equipmentView === "all" },
      ] }],
      metrics: [
        { id: "assets", label: "Equipment", value: String(scoped.assets.length), supportingText: "Across the stores in this view", link: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId, view: "all" }), label: "View all equipment" } },
        { id: "attention", label: "Needs attention", value: String(attentionAssets.length), supportingText: "Active work or an equipment status that needs review", tone: "warning", link: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId, view: "attention" }), label: "Open the attention queue" } },
        { id: "out-of-service", label: "Out of service", value: String(scoped.assets.filter((asset) => asset.status === "out_of_service").length), supportingText: "Unavailable now with the related service record one click away", tone: "critical", link: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId, status: "out_of_service", view: "all" }), label: "Open out-of-service equipment" } },
        { id: "unlinked", label: "Needs an equipment choice", value: String(workNeedingEquipmentChoice.length), supportingText: "Open work where equipment appears relevant but has not been linked yet", tone: workNeedingEquipmentChoice.length ? "warning" : "positive", link: { href: hrefWithQuery("/app/work-orders", { asset: "unlinked", store: selectedStoreId }), label: "Review work needing classification" } },
      ],
      breakdowns: [
        { id: "equipment-category", title: "Equipment by service area", description: "Select a row to open the exact equipment in that service area.", totalLabel: `${scoped.assets.length} assets`, segments: [...categoryCounts.entries()].map(([key, value]) => ({ id: key, label: sentence(key), value, formattedValue: String(value), shareLabel: `Open ${value} ${sentence(key).toLocaleLowerCase("en-US")} record${value === 1 ? "" : "s"}`, link: { href: hrefWithQuery("/app/equipment", { category: key, store: selectedStoreId, view: "all" }), label: `Open ${sentence(key)} equipment` } })), sourceLink: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId, view: "all" }), label: "Open all equipment" } },
        { id: "equipment-status", title: "Equipment status", description: "Operational, watch, and out-of-service totals come directly from the equipment register.", totalLabel: `${scoped.assets.length} assets`, segments: [...statusCounts.entries()].map(([key, value]) => ({ id: key, label: equipmentStatusLabel(key), value, formattedValue: String(value), shareLabel: `Open ${value} ${equipmentStatusLabel(key).toLocaleLowerCase("en-US")} record${value === 1 ? "" : "s"}`, tone: key === "watch" ? "warning" : key === "operational" ? "positive" : "critical", link: { href: hrefWithQuery("/app/equipment", { status: key, store: selectedStoreId, view: "all" }), label: `Open ${equipmentStatusLabel(key)} equipment` } })), sourceLink: { href: hrefWithQuery("/app/equipment", { store: selectedStoreId, view: "all" }), label: "Open all equipment" } },
      ],
      trends: [],
      priorityActions: [],
      search: { label: "Search equipment", placeholder: "Asset tag, name, model, serial, store, or address", value: first(query.q), action: "/app/equipment", preservedParameters: [
        { name: "view", value: equipmentView },
        ...(selectedStoreId ? [{ name: "store", value: selectedStoreId }] : []),
        ...(categoryFilter ? [{ name: "category", value: categoryFilter }] : []),
        ...(statusFilter ? [{ name: "status", value: statusFilter }] : []),
      ] },
      appliedFilters: equipmentAppliedFilters,
      clearFiltersHref: equipmentAppliedFilters.length ? hrefWithQuery("/app/equipment", { view: equipmentView, store: selectedStoreId }) : undefined,
      resultSummary: filteredAssets.length
        ? equipmentView === "attention" && !categoryFilter && !statusFilter && !searchQuery
          ? `${filteredAssets.length} needing attention · ${scoped.assets.length} total equipment`
          : equipmentView === "recent" && !categoryFilter && !statusFilter && !searchQuery
            ? `${filteredAssets.length} recently serviced · ${scoped.assets.length} total equipment`
            : `Showing ${pageStart + 1}–${Math.min(pageStart + pageSize, filteredAssets.length)} of ${filteredAssets.length}`
        : "0 equipment records",
      pagination: filteredAssets.length > pageSize
        ? paginationModel(filteredAssets.length, currentPage, pageSize, (page) => equipmentHref({ page: String(page) }))
        : undefined,
      table: { id: "equipment", caption: equipmentView === "attention" ? "Equipment needing attention" : equipmentView === "recent" ? "Recently serviced equipment" : "Tracked equipment", columns: [{ key: "asset", label: "Equipment" }, { key: "store", label: "Store" }, { key: "category", label: "Service area" }, { key: "identity", label: "Model / serial" }, { key: "work", label: "Linked work", align: "end" }, { key: "status", label: "Status" }], rows },
    };
  }

  if (route === "pm") {
    const occurrences = fixture.pmOccurrences.filter((item) => item.organizationId === scoped.organizationId && scoped.storeIds.has(item.storeId));
    const statusFilter = first(query.status);
    const occurrenceFilter = first(query.occurrence);
    const programFilter = first(query.program);
    const planById = new Map(fixture.pmPlans.filter((plan) => plan.organizationId === scoped.organizationId).map((plan) => [plan.id, plan]));
    const requestedPmView = first(query.view);
    const pmView = requestedPmView === "all" || requestedPmView === "upcoming" || requestedPmView === "attention"
      ? requestedPmView
      : statusFilter || occurrenceFilter
        ? "all"
        : "attention";
    const occurrenceStates = occurrences.map((occurrence) => ({
      occurrence,
      status: effectivePmStatus(occurrence, fixture.asOf),
    })).filter((item) => !programFilter || planById.get(item.occurrence.planId)?.programId === programFilter);
    const viewStates = occurrenceStates.filter((item) =>
      pmView === "all" || (pmView === "attention" ? item.status === "due" || item.status === "missed" : item.status === "due" || item.status === "scheduled"),
    );
    const filteredOccurrenceStates = viewStates
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter((item) => !occurrenceFilter || item.occurrence.id === occurrenceFilter);
    const requestedPage = Number(first(query.page));
    const pageSize = pmView === "attention" ? 10 : 30;
    const totalPages = Math.max(1, Math.ceil(filteredOccurrenceStates.length / pageSize));
    const currentPage = Math.min(Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1, totalPages);
    const pageStart = (currentPage - 1) * pageSize;
    const visible = filteredOccurrenceStates.slice(pageStart, pageStart + pageSize);
    const statusCounts = new Map<string, number>();
    for (const item of occurrenceStates) statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
    const closedWindow = occurrenceStates.filter(
      (item) => Date.parse(item.occurrence.windowEndsAt) < Date.parse(fixture.asOf) && item.status !== "waived",
    );
    const completed = closedWindow.filter((item) => item.status === "completed").length;
    const eligible = closedWindow.length;
    const latestClosedByAsset = new Map<string, (typeof closedWindow)[number]>();
    for (const item of closedWindow.filter((candidate) => candidate.occurrence.assetId).sort((a, b) => a.occurrence.windowEndsAt.localeCompare(b.occurrence.windowEndsAt))) latestClosedByAsset.set(item.occurrence.assetId!, item);
    const compliantAssetIds = new Set([...latestClosedByAsset.values()].filter((item) => item.status === "completed").map((item) => item.occurrence.assetId!));
    const noncompliantAssetIds = new Set([...latestClosedByAsset.values()].filter((item) => item.status !== "completed").map((item) => item.occurrence.assetId!));
    const pmWorkOrderIds = new Set(occurrences.map((item) => item.workOrderId).filter((value): value is string => Boolean(value)));
    const trailingStart = new Date(Date.parse(fixture.asOf) - 365.2425 * 24 * 60 * 60 * 1_000).toISOString();
    const reactiveAssetWork = scoped.workOrders.filter((work) => work.assetId && work.createdAt >= trailingStart && work.createdAt <= fixture.asOf && !pmWorkOrderIds.has(work.id));
    const cohortRate = (assetIds: Set<string>) => assetIds.size ? reactiveAssetWork.filter((work) => assetIds.has(work.assetId!)).length / (assetIds.size * 12) * 100 : 0;
    const compliantRate = cohortRate(compliantAssetIds);
    const noncompliantRate = cohortRate(noncompliantAssetIds);
    const minimumCohort = Math.min(compliantAssetIds.size || Number.POSITIVE_INFINITY, noncompliantAssetIds.size || Number.POSITIVE_INFINITY);
    const cohortCaution = Number.isFinite(minimumCohort) && minimumCohort >= 10 ? "Descriptive association only; review source records before changing cadence." : "Directional only: at least one cohort has fewer than 10 equipment records, so no effectiveness conclusion is made.";
    const reactiveCostByMonth = new Map<string, number>();
    for (const work of reactiveAssetWork) reactiveCostByMonth.set(work.createdAt.slice(0, 7), (reactiveCostByMonth.get(work.createdAt.slice(0, 7)) ?? 0) + (costByWork.get(work.id) ?? 0));
    const rows = visible.sort((a, b) => a.occurrence.dueAt.localeCompare(b.occurrence.dueAt)).map<TableRowViewModel>(({ occurrence, status }) => {
      const plan = planById.get(occurrence.planId);
      const store = scoped.stores.find((item) => item.id === occurrence.storeId);
      const asset = scoped.assets.find((item) => item.id === occurrence.assetId);
      const observedVisitIds = new Set(fixture.siteVisitWorkOrders.filter((link) => link.organizationId === scoped.organizationId && link.workOrderId === occurrence.workOrderId).map((link) => link.visitId));
      const historicalAttestation = status === "completed" && !occurrence.workOrderId && occurrence.result?.startsWith("Manager-attested historical completion");
      return { id: occurrence.id, label: plan?.name ?? "PM occurrence", href: occurrence.workOrderId
        ? `/app/work-orders/${occurrence.workOrderId}`
        : ["due", "missed"].includes(status)
          ? hrefWithQuery("/app/work-orders/new", { pmOccurrence: occurrence.id })
          : asset
            ? `/app/equipment/${asset.id}#preventive-maintenance`
            : hrefWithQuery("/app/pm", { status, store: occurrence.storeId }), cells: [
        { key: "plan", value: plan?.name ?? "PM plan", secondary: asset?.name ?? (plan?.categoryKey ? sentence(plan.categoryKey) : "Store-level plan") },
        { key: "store", value: storeLabel(store) },
        { key: "window", value: `${date(occurrence.windowStartsAt)} – ${date(occurrence.windowEndsAt)}`, secondary: `Due ${date(occurrence.dueAt)}` },
        { key: "work", value: occurrence.workOrderId ? scoped.workOrders.find((work) => work.id === occurrence.workOrderId)?.number ?? "Linked" : historicalAttestation ? "Imported history" : "Not created", secondary: historicalAttestation ? "Manager-attested completion" : undefined },
        { key: "visit", value: observedVisitIds.size ? `${observedVisitIds.size} observed visit${observedVisitIds.size === 1 ? "" : "s"}` : historicalAttestation ? "No platform visit expected" : "No matching visit recorded", secondary: observedVisitIds.size ? "Recorded store-presence evidence" : historicalAttestation ? "Imported history; source attestation is explicit" : "Review fact, not proof service was missed", tone: observedVisitIds.size ? "positive" : historicalAttestation ? "info" : status === "completed" ? "warning" : "neutral" },
        { key: "status", value: sentence(status), tone: status === "completed" ? "positive" : status === "missed" ? "critical" : status === "due" ? "warning" : "info" },
      ] };
    });
    const metric = (key: string, label: string, tone: Tone): MetricViewModel => ({ id: key, label, value: String(statusCounts.get(key) ?? 0), supportingText: "Select to open the exact occurrences", tone, link: { href: hrefWithQuery("/app/pm", { status: key, store: selectedStoreId, program: programFilter, view: "all" }), label: `Show ${label.toLocaleLowerCase("en-US")}` } });
    const pmPageHref = (page: number) => hrefWithQuery("/app/pm", { view: pmView, status: statusFilter, occurrence: occurrenceFilter, store: selectedStoreId, program: programFilter, page: String(page) });
    return {
      state: { kind: "ready" },
      page: { title: "Preventive maintenance", eyebrow: "Planned work", description: "Manage company standards by exception, see what is due or missed first, and reconcile billed PM service against observed store visits.", scopeLabel: activeScopeLabel, periodLabel: "Current PM window", updatedLabel: `Through ${date(fixture.asOf)}` },
      filters: [{ id: "view", label: "Occurrence view", options: [
        { value: "attention", label: `Needs attention (${occurrenceStates.filter((item) => item.status === "due" || item.status === "missed").length})`, href: hrefWithQuery("/app/pm", { view: "attention", store: selectedStoreId, program: programFilter }), selected: pmView === "attention" },
        { value: "upcoming", label: `Upcoming (${occurrenceStates.filter((item) => item.status === "due" || item.status === "scheduled").length})`, href: hrefWithQuery("/app/pm", { view: "upcoming", store: selectedStoreId, program: programFilter }), selected: pmView === "upcoming" },
        { value: "all", label: `All occurrences (${occurrenceStates.length})`, href: hrefWithQuery("/app/pm", { view: "all", store: selectedStoreId, program: programFilter }), selected: pmView === "all" },
      ] }],
      metrics: [metric("due", "Due", "warning"), metric("scheduled", "Scheduled", "info"), metric("completed", "Completed", "positive"), metric("missed", "Missed", "critical"), metric("waived", "Waived", "neutral")],
      breakdowns: [
        { id: "pm-status", title: "PM occurrence status", description: `Closed-window compliance: ${completed} completed / ${eligible} eligible occurrences = ${eligible ? Math.round((completed / eligible) * 100) : 0}%. Work still inside its completion window is excluded.`, totalLabel: `${occurrenceStates.length} occurrences`, segments: [...statusCounts.entries()].map(([key, value]) => ({ id: key, label: sentence(key), value, formattedValue: String(value), tone: key === "completed" ? "positive" : key === "missed" ? "critical" : key === "due" ? "warning" : "info", link: { href: hrefWithQuery("/app/pm", { status: key, store: selectedStoreId, program: programFilter, view: "all" }), label: "Filter occurrences" } })), sourceLink: { href: hrefWithQuery("/app/pm", { store: selectedStoreId, program: programFilter, view: "all" }), label: "Open all source occurrences" } },
        { id: "pm-effectiveness-cohorts", title: "Reactive work after the latest closed PM window", description: `${cohortCaution} Rates use trailing-12-month reactive Work Orders per 100 equipment-months; PM-generated Work Orders are excluded.`, totalLabel: `${compliantAssetIds.size + noncompliantAssetIds.size} equipment`, segments: [
          { id: "latest-compliant", label: `Latest PM completed (${compliantAssetIds.size})`, value: compliantRate, formattedValue: `${compliantRate.toFixed(1)} / 100`, tone: "positive", link: { href: hrefWithQuery("/app/pm", { status: "completed", store: selectedStoreId }), label: "Open completed occurrence evidence" } },
          { id: "latest-noncompliant", label: `Latest PM missed (${noncompliantAssetIds.size})`, value: noncompliantRate, formattedValue: `${noncompliantRate.toFixed(1)} / 100`, tone: "warning", link: { href: hrefWithQuery("/app/pm", { status: "missed", store: selectedStoreId }), label: "Open missed occurrence evidence" } },
        ], sourceLink: { href: hrefWithQuery("/app/work-orders", { store: selectedStoreId, hasCost: "true" }), label: "Open supporting reactive Work Orders" } },
      ],
      trends: [{ id: "pm-reactive-cost", title: "Recorded reactive cost for PM-covered equipment", description: "Trailing-12-month recorded work cost only. This is context for cadence review, not proof that PM caused or prevented a repair.", points: [...reactiveCostByMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ id: month, label: month, value, formattedValue: money(value), link: { href: hrefWithQuery("/app/work-orders", { store: selectedStoreId, hasCost: "true" }), label: `Open ${month} source Work Orders` } })), sourceLink: { href: hrefWithQuery("/app/work-orders", { store: selectedStoreId, hasCost: "true" }), label: "Open all supporting cost records" } }],
      priorityActions: allActions,
      resultSummary: filteredOccurrenceStates.length ? `${pageStart + 1}–${Math.min(pageStart + pageSize, filteredOccurrenceStates.length)} of ${filteredOccurrenceStates.length}` : "0 occurrences",
      pagination: filteredOccurrenceStates.length > pageSize
        ? paginationModel(filteredOccurrenceStates.length, currentPage, pageSize, pmPageHref)
        : undefined,
      table: { id: "pm-occurrences", caption: pmView === "attention" ? "Preventive-maintenance occurrences needing attention" : pmView === "upcoming" ? "Upcoming preventive-maintenance occurrences" : "Preventive-maintenance occurrences", columns: [{ key: "plan", label: "Plan / equipment" }, { key: "store", label: "Store" }, { key: "window", label: "Completion window" }, { key: "work", label: "Work order" }, { key: "visit", label: "Visit evidence" }, { key: "status", label: "Status" }], rows },
    };
  }

  const lifecycle = lifecycleRows(fixture, scoped, costByWork);
  const selectedAsset = first(query.asset);
  const selectedLifecycleAsset = selectedAsset ? lifecycle.find((row) => row.asset.id === selectedAsset) : undefined;
  const requestedReason = first(query.reason);
  const requestedReplacementYear = first(query.replacementYear);
  const requestedReplacement = first(query.replacement);
  const requestedPlan = first(query.plan);
  const requestedAssetStatus = first(query.status);
  const requestedLifecycleView = first(query.view);
  const scopeCandidates = lifecycle
    .filter((row) => !selectedAsset || row.asset.id === selectedAsset)
    .filter((row) => !requestedAssetStatus || row.asset.status === requestedAssetStatus)
    .filter((row) => !requestedReplacement || (requestedReplacement === "entered" && row.replacement !== undefined))
    .filter((row) => requestedPlan !== "management" || row.hasManagementPlan)
    .filter((row) => !requestedReplacementYear || String(row.capitalPlanYear) === requestedReplacementYear)
    .filter((row) => !requestedReason ||
      (["repair review", "compare alternatives"].includes(requestedReason) && row.screening.state === "compare_alternatives") ||
      (requestedReason === "not flagged" && row.screening.state === "below_economic_review") ||
      (requestedReason === "small repair" && row.screening.state === "below_materiality") ||
      (requestedReason === "missing inputs" && row.screening.state === "incomplete") ||
      (requestedReason === "historical context" && row.contextFacts.length > 0));
  const managementPlanned = scopeCandidates.filter((row) => row.hasManagementPlan && row.replacement);
  const liveRepairDecisions = scopeCandidates.filter((row) => row.screening.state === "compare_alternatives");
  const lifecycleView = requestedLifecycleView === "all" || requestedLifecycleView === "capital"
    ? requestedLifecycleView
    : requestedPlan === "management"
      ? "capital"
      : requestedReason || selectedAsset || requestedAssetStatus || requestedReplacement || requestedReplacementYear
        ? "all"
        : "review";
  const candidates = lifecycleView === "capital"
    ? managementPlanned
    : lifecycleView === "all"
      ? scopeCandidates
      : liveRepairDecisions;
  const lifecyclePageSize = 25;
  const requestedLifecyclePage = Number(first(query.page));
  const lifecycleTotalPages = Math.max(1, Math.ceil(candidates.length / lifecyclePageSize));
  const lifecycleCurrentPage = Math.min(Number.isFinite(requestedLifecyclePage) && requestedLifecyclePage > 0 ? Math.floor(requestedLifecyclePage) : 1, lifecycleTotalPages);
  const lifecyclePageStart = (lifecycleCurrentPage - 1) * lifecyclePageSize;
  const visibleCandidates = candidates.slice(lifecyclePageStart, lifecyclePageStart + lifecyclePageSize);
  const lifecyclePageHref = (page: number) => hrefWithQuery("/app/lifecycle", {
    store: selectedStoreId,
    asset: selectedAsset,
    reason: requestedReason,
    replacementYear: requestedReplacementYear,
    replacement: requestedReplacement,
    plan: requestedPlan,
    status: requestedAssetStatus,
    view: lifecycleView,
    page: String(page),
  });
  const pricedReplacementCount = scopeCandidates.filter((row) => row.replacement !== undefined).length;
  const reviewRepairPriceCount = liveRepairDecisions.filter((row) => row.screening.comparison.repairEstimateMinor !== undefined).length;
  const reviewReplacementPriceCount = liveRepairDecisions.filter((row) => row.replacement !== undefined).length;
  const reviewStoreCount = new Set(liveRepairDecisions.map((row) => row.asset.storeId)).size;
  const reasonCounts = new Map<string, number>();
  for (const row of scopeCandidates) {
    const key = row.screening.state === "compare_alternatives"
      ? "compare alternatives"
      : row.screening.state === "below_economic_review"
        ? "not flagged"
        : row.screening.state === "below_materiality"
          ? "small repair"
          : "missing inputs";
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const rows = visibleCandidates.map<TableRowViewModel>((row) => ({
    id: row.asset.id,
    label: row.asset.name,
    href: `/app/equipment/${row.asset.id}`,
    cells: [
      { key: "asset", value: row.asset.name, secondary: row.asset.assetTag },
      { key: "store", value: storeLabel(scoped.stores.find((store) => store.id === row.asset.storeId)) },
      {
        key: "evidence",
        value: lifecycleView === "capital" ? "Management-planned replacement" : row.decisionState.label,
        secondary: lifecycleView === "capital"
          ? row.capitalPlanLabel
          : row.decisionState.helper,
      },
      {
        key: "work",
        value: row.proposalWork
          ? `${row.proposalWork.number}: ${money(row.screening.comparison.repairEstimateMinor ?? 0)}`
          : lifecycleView === "capital"
            ? "No active repair decision"
            : "No current repair estimate",
        secondary: lifecycleView === "capital" && !row.proposalWork
          ? "Planning record only"
          : row.screening.comparison.requiredEconomicRunwayMonths === undefined
          ? "Comparison inputs not complete"
          : selectedAsset
            ? `${formatRunway(row.screening.comparison.requiredEconomicRunwayMonths)} required runway · ${row.screening.comparison.estimatedServiceExtensionMonths === undefined ? "service estimate not entered" : `${formatRunway(row.screening.comparison.estimatedServiceExtensionMonths)} entered service estimate`} · ${Math.round((row.screening.comparison.repairToReplacementRatio ?? 0) * 100)}% of replacement estimate`
            : `${formatRunway(row.screening.comparison.requiredEconomicRunwayMonths)} required runway · ${Math.round((row.screening.comparison.repairToReplacementRatio ?? 0) * 100)}% of replacement`,
      },
      { key: "replacement", value: row.replacement ? money(row.replacement) : "Not entered", secondary: selectedAsset ? `${row.capitalPlanLabel}. ${row.replacementResolution.explanation}` : row.capitalPlanLabel },
      {
        key: "status",
        value: lifecycleView === "capital" ? row.capitalPlanLabel : row.decisionState.label,
        tone: lifecycleView === "capital" ? "info" : row.decisionState.tone,
      },
    ],
  }));
  const managementPlannedTotal = managementPlanned.reduce((sum, row) => sum + (row.replacement ?? 0), 0);
  const managementPlanYears = [...new Set(managementPlanned.map((row) => row.capitalPlanYear).filter((year): year is number => Boolean(year)))].sort((a, b) => a - b);
  const managementPlanYearLabel = managementPlanYears.length === 0
    ? "No funding years"
    : managementPlanYears.length === 1
      ? String(managementPlanYears[0])
      : `${managementPlanYears[0]}–${managementPlanYears.at(-1)}`;
  const managementPlanStoreCount = new Set(managementPlanned.map((row) => row.asset.storeId)).size;
  const sharedLifecycleParameters = { store: selectedStoreId, asset: selectedAsset };
  const metrics: MetricViewModel[] = lifecycleView === "review"
    ? [
        { id: "review", label: "Current lifecycle cases", value: String(liveRepairDecisions.length), supportingText: `Active repair-or-replace cases across ${reviewStoreCount} store${reviewStoreCount === 1 ? "" : "s"}; each row shows its recorded decision state`, tone: liveRepairDecisions.some((row) => row.decisionState.kind === "compare_alternatives") ? "warning" : "info", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "review" }), label: "Open current cases" } },
        { id: "repair-estimates", label: "Repair prices entered", value: `${reviewRepairPriceCount} of ${liveRepairDecisions.length}`, supportingText: "The actual vendor price stays on each case; prices are not combined", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "review" }), label: "Review repair prices" } },
        { id: "replacement-alternatives", label: "Replacement estimates ready", value: `${reviewReplacementPriceCount} of ${liveRepairDecisions.length}`, supportingText: "Each estimate is compared only with the repair for that equipment", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "review" }), label: "Review replacement estimates" } },
        { id: "portfolio-context", label: "Portfolio planning", value: `${managementPlanned.length} planned`, supportingText: "Future replacement decisions are kept separate from today's repair review", tone: "info", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "capital" }), label: "Open planned replacements" } },
      ]
    : lifecycleView === "capital"
      ? [
          { id: "management-plan", label: "Planned replacements", value: String(managementPlanned.length), supportingText: `Management decisions across ${managementPlanStoreCount} store${managementPlanStoreCount === 1 ? "" : "s"}`, tone: managementPlanned.length ? "info" : "neutral", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "capital" }), label: "Open planned replacements" } },
          { id: "planned-value", label: "Estimated planned cost", value: money(managementPlannedTotal), supportingText: `Replacement estimates for these ${managementPlanned.length} planned decision${managementPlanned.length === 1 ? "" : "s"}; not an approved budget`, link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "capital" }), label: "Review planned costs" } },
          { id: "funding-years", label: "Funding years", value: managementPlanYearLabel, supportingText: "Years selected by management, not age-based predictions", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "capital" }), label: "Review funding years" } },
          { id: "repair-context", label: "Repair decisions now", value: String(liveRepairDecisions.length), supportingText: "Current repair choices are reviewed in a separate queue", tone: liveRepairDecisions.length ? "warning" : "positive", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "review" }), label: "Open repair decisions" } },
        ]
      : [
          { id: "scope", label: "Equipment records", value: String(scopeCandidates.length), supportingText: "All equipment in the selected store and filter scope", tone: "info", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "all" }), label: "Browse equipment records" } },
          { id: "estimate-coverage", label: "Replacement estimates available", value: `${pricedReplacementCount} of ${scopeCandidates.length}`, supportingText: `${scopeCandidates.length - pricedReplacementCount} equipment record${scopeCandidates.length - pricedReplacementCount === 1 ? " still needs" : "s still need"} a planning estimate`, tone: pricedReplacementCount === scopeCandidates.length ? "positive" : "warning", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, replacement: "entered", view: "all" }), label: "Open priced equipment" } },
          { id: "repair-context", label: "Repair decisions now", value: String(liveRepairDecisions.length), supportingText: "Open decisions are kept separate and compared one equipment record at a time", tone: liveRepairDecisions.length ? "warning" : "positive", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "review" }), label: "Open repair decisions" } },
          { id: "management-plan", label: "Management-planned replacements", value: String(managementPlanned.length), supportingText: `Assigned across ${managementPlanYearLabel}; cost totals appear only in the planned-replacements view`, tone: managementPlanned.length ? "info" : "neutral", link: { href: hrefWithQuery("/app/lifecycle", { ...sharedLifecycleParameters, view: "capital" }), label: "Open planned replacements" } },
        ];
  const lifecyclePage = lifecycleView === "review"
    ? {
        title: "Current lifecycle cases",
        description: "Follow active repair-or-replace cases from comparison through the recorded management decision. Repair and replacement dollars refer to the same equipment; portfolio replacement estimates stay out of this view.",
      }
    : lifecycleView === "capital"
      ? {
          title: "Planned replacements",
          description: "See only replacement decisions that management has assigned to a funding year. These are planning estimates, not an approved budget or a prediction that equipment will fail.",
        }
      : {
          title: "Replacement planning register",
          description: "Review which equipment has a current replacement estimate and open any record for its source, age, warranty, and service history. This register does not total the hypothetical cost of replacing the entire portfolio.",
        };
  return {
    state: { kind: "ready" },
    page: { title: lifecyclePage.title, eyebrow: "Repair or replace", description: lifecyclePage.description, scopeLabel: selectedLifecycleAsset ? `${activeScopeLabel} · ${selectedLifecycleAsset.asset.name}` : activeScopeLabel, updatedLabel: `Through ${date(fixture.asOf)}` },
    metrics,
    filters: [{ id: "lifecycle-view", label: "Equipment shown", options: [
      { value: "review", label: `Current cases (${liveRepairDecisions.length})`, href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, asset: selectedAsset, view: "review" }), selected: lifecycleView === "review" },
      { value: "capital", label: `Planned replacements (${managementPlanned.length})`, href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, asset: selectedAsset, view: "capital" }), selected: lifecycleView === "capital" },
      { value: "all", label: `Planning register (${scopeCandidates.length})`, href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, asset: selectedAsset, view: "all" }), selected: lifecycleView === "all" },
    ] }],
    breakdowns: lifecycleView === "all" ? [{ id: "lifecycle-reasons", title: "Repair-screening status", description: "This classifies current repair evidence only. It does not predict failure or recommend replacing equipment without a live repair decision.", totalLabel: `${scopeCandidates.length} equipment`, segments: [...reasonCounts.entries()].map(([key, value]) => ({ id: key, label: sentence(key), value, formattedValue: String(value), link: { href: hrefWithQuery("/app/lifecycle", { reason: key, store: selectedStoreId, asset: selectedAsset, view: "all" }), label: "Filter equipment" } })), sourceLink: { href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, asset: selectedAsset, view: "all" }), label: "Open planning register" } }] : [],
    trends: lifecycleView === "capital" ? [{
      id: "capex-horizon",
      title: "Planned replacements by funding year",
      description: `Only the ${managementPlanned.length} management-planned replacements shown in this view are included. Values are estimates, not an approved budget.`,
      points: [...managementPlanned.reduce((years, row) => {
        if (row.capitalPlanYear && row.replacement) years.set(String(row.capitalPlanYear), (years.get(String(row.capitalPlanYear)) ?? 0) + row.replacement);
        return years;
      }, new Map<string, number>()).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => ({ id: year, label: year, value, formattedValue: money(value), link: { href: hrefWithQuery("/app/lifecycle", { replacementYear: year, plan: "management", store: selectedStoreId, asset: selectedAsset, view: "capital" }), label: `Review ${year} planned replacements` } })),
      sourceLink: { href: hrefWithQuery("/app/lifecycle", { store: selectedStoreId, asset: selectedAsset, view: "capital" }), label: "Open planned replacements" },
    }] : [],
    priorityActions: selectedAsset ? [] : allActions,
    resultSummary: candidates.length ? `Showing ${lifecyclePageStart + 1}–${Math.min(lifecyclePageStart + lifecyclePageSize, candidates.length)} of ${candidates.length}` : "0 equipment records",
    pagination: candidates.length > lifecyclePageSize
      ? paginationModel(candidates.length, lifecycleCurrentPage, lifecyclePageSize, lifecyclePageHref)
      : undefined,
    table: { id: "lifecycle", caption: lifecycleView === "review" ? "Current lifecycle cases" : lifecycleView === "capital" ? "Management-planned replacements" : "Replacement planning register", columns: [{ key: "asset", label: "Equipment" }, { key: "store", label: "Store" }, { key: "evidence", label: lifecycleView === "capital" ? "Why it is planned" : "Recorded decision" }, { key: "work", label: "Current repair" }, { key: "replacement", label: "Estimated replacement", align: "end" }, { key: "status", label: lifecycleView === "capital" ? "Funding plan" : "Current state" }], rows },
  };
}

export function buildApprovalPolicyWorkspaceModel(
  fixture: OpsFixture,
  session: OperatorSession,
): DetailPageViewModel {
  const policies = fixture.approvalPolicies
    .filter((policy) => policy.organizationId === session.organizationId)
    .sort((left, right) => left.name.localeCompare(right.name) || right.version - left.version);
  const requests = fixture.approvalRequests
    .filter((request) => request.organizationId === session.organizationId)
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id));
  const decisions = fixture.approvalDecisions.filter((decision) => decision.organizationId === session.organizationId);
  const stateCount = (state: ReturnType<typeof approvalRequestState>) => requests.filter((request) => approvalRequestState(request, decisions) === state).length;
  const scopeLabel = (policy: (typeof policies)[number]) => {
    if (policy.scopeKind === "organization") return "All stores";
    if (policy.scopeKind === "region") return fixture.regions.find((region) => region.organizationId === session.organizationId && region.id === policy.scopeId)?.name ?? "Unknown region";
    const store = fixture.stores.find((candidate) => candidate.organizationId === session.organizationId && candidate.id === policy.scopeId);
    return store ? `Store ${store.storeNumber}` : "Unknown store";
  };
  const amountRange = (policy: (typeof policies)[number]) => policy.maxAmountMinor === undefined
    ? `${estimateMoney(policy.minAmountMinor, policy.currency)} and above`
    : `${estimateMoney(policy.minAmountMinor, policy.currency)} – ${estimateMoney(policy.maxAmountMinor, policy.currency)}`;
  return {
    state: { kind: "ready" },
    page: {
      title: "Approval policies",
      eyebrow: "Governed authorization",
      description: "Define who reviews service commitments by company, region, store, category, and amount. Every request freezes the exact policy version used; every decision is appended and attributed.",
      scopeLabel: session.scopeLabel,
      updatedLabel: `Source data through ${date(fixture.asOf)}`,
    },
    statusLabel: `${policies.filter((policy) => policy.status === "active").length} active policies`,
    statusTone: "positive",
    facts: [
      { label: "Pending decisions", value: String(stateCount("pending")), helperText: "Each item retains an accountable role and due time" },
      { label: "Approved", value: String(stateCount("approved")), helperText: "Immutable decisions in the current source ledger" },
      { label: "Escalated", value: String(stateCount("escalated")), helperText: "Original escalation evidence remains visible beside the next review" },
      { label: "Access", value: session.role === "facilities" ? "Facilities administrator" : sentence(session.role), helperText: "This setup workspace is restricted by the server-side role policy" },
    ],
    sections: [
      {
        id: "policy-versions",
        title: "Effective policy versions",
        description: "A rule change creates a new version. Historical approval requests keep the name, scope, threshold, and required role that applied when review began.",
        table: {
          id: "approval-policies",
          caption: "Tenant-scoped approval policy versions",
          columns: [
            { key: "policy", label: "Policy" },
            { key: "applies", label: "Applies to" },
            { key: "range", label: "Amount range", align: "end" },
            { key: "role", label: "Required role" },
            { key: "usage", label: "Approval requests", align: "end" },
            { key: "status", label: "Status" },
          ],
          rows: policies.map((policy) => ({
            id: policy.id,
            label: policy.name,
            href: "/app/admin/approval-policies#policy-versions",
            cells: [
              { key: "policy", value: policy.name, secondary: `${policy.policyKey} · version ${policy.version}` },
              { key: "applies", value: scopeLabel(policy), secondary: policy.categoryKey ? sentence(policy.categoryKey) : "All categories" },
              { key: "range", value: amountRange(policy) },
              { key: "role", value: sentence(policy.requiredRole), secondary: policy.escalationRole ? `Escalates to ${sentence(policy.escalationRole)}` : "Final approval level" },
              { key: "usage", value: String(requests.filter((request) => request.policyId === policy.id).length) },
              { key: "status", value: sentence(policy.status), tone: policy.status === "active" ? "positive" : "neutral" },
            ],
          })),
        },
      },
      {
        id: "approval-ledger",
        title: "Approval request ledger",
        description: "Pending, approved, and escalated examples point back to the exact operational record. Basic work with no triggering amount does not appear here.",
        table: {
          id: "approval-requests",
          caption: "Approval requests and immutable decisions",
          columns: [
            { key: "record", label: "Operational record" },
            { key: "store", label: "Store" },
            { key: "amount", label: "Amount", align: "end" },
            { key: "policy", label: "Policy snapshot" },
            { key: "owner", label: "Accountable role" },
            { key: "status", label: "State" },
          ],
          rows: requests.map((request) => {
            const workOrder = request.subjectType === "work_order" ? fixture.workOrders.find((candidate) => candidate.organizationId === session.organizationId && candidate.id === request.subjectId) : undefined;
            const serviceRequest = request.subjectType === "service_request" ? fixture.requests.find((candidate) => candidate.organizationId === session.organizationId && candidate.id === request.subjectId) : undefined;
            const store = fixture.stores.find((candidate) => candidate.organizationId === session.organizationId && candidate.id === request.storeId);
            const state = approvalRequestState(request, decisions);
            return {
              id: request.id,
              label: workOrder?.number ?? serviceRequest?.reference ?? "Approval subject",
              href: request.subjectType === "work_order" ? `/app/work-orders/${request.subjectId}#approval-governance` : `/app/requests/${request.subjectId}#approval-governance`,
              cells: [
                { key: "record", value: workOrder?.number ?? serviceRequest?.reference ?? "Unknown record", secondary: workOrder?.problem ?? serviceRequest?.problem },
                { key: "store", value: store ? `Store ${store.storeNumber}` : "Unknown store" },
                { key: "amount", value: estimateMoney(request.amount.amountMinor, request.amount.currency) },
                { key: "policy", value: request.policyName, secondary: `Frozen version ${request.policyVersion}` },
                { key: "owner", value: sentence(request.requiredRole), secondary: request.dueAt ? `Due ${dateTime(request.dueAt)}` : "No due time" },
                { key: "status", value: sentence(state), tone: state === "approved" ? "positive" : state === "rejected" || state === "cancelled" ? "critical" : "warning" },
              ],
            };
          }),
        },
      },
    ],
    backLink: { label: "Back to administration", href: "/app/admin" },
  };
}

export function buildDetailModel(
  fixture: OpsFixture,
  session: OperatorSession,
  route: OperatorDetailRoute,
  id: string,
): DetailPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const costByWork = recordedCostByWork(fixture, scoped.organizationId);

  if (route === "request") {
    const request = fixture.requests.find(
      (item) =>
        item.id === id &&
        item.organizationId === scoped.organizationId &&
        scoped.storeIds.has(item.storeId),
    );
    if (!request) return missingDetail("Request", "/app/requests");
    const store = scoped.stores.find((item) => item.id === request.storeId);
    const convertedWork = request.convertedWorkOrderId
      ? scoped.workOrders.find((work) => work.id === request.convertedWorkOrderId)
      : undefined;
    const audit = fixture.auditEvents
      .filter(
        (event) =>
          event.organizationId === scoped.organizationId &&
          (event.aggregateId === request.id || event.aggregateId === convertedWork?.id),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const linkedFiles = fixture.entityFiles.filter(
      (link) =>
        link.organizationId === scoped.organizationId &&
        link.entityType === "request" &&
        link.entityId === request.id,
    );
    const approval = approvalEvidence(fixture, scoped.organizationId, "service_request", request.id);
    const impactAssessments = fixture.requestImpactAssessments.filter((assessment) => assessment.organizationId === scoped.organizationId && assessment.requestId === request.id);
    const latestImpact = [...impactAssessments]
      .sort((left, right) => right.assessedAt.localeCompare(left.assessedAt) || right.id.localeCompare(left.id))[0];
    const latestApprovalRequest = fixture.approvalRequests
      .filter((approvalRequest) => approvalRequest.organizationId === scoped.organizationId && approvalRequest.subjectType === "service_request" && approvalRequest.subjectId === request.id)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id))[0];
    const latestApprovalState = latestApprovalRequest
      ? approvalRequestState(latestApprovalRequest, fixture.approvalDecisions)
      : undefined;
    const impactReviewed = latestImpact?.assessmentKind === "review"
      && latestImpact.source === "manager_review"
      && Boolean(latestImpact.reviewDisposition);
    const approvalAllowsConversion = !latestApprovalRequest || latestApprovalState === "approved";
    const canConvert = Boolean(
      !convertedWork
      && request.status === "under_review"
      && impactReviewed
      && approvalAllowsConversion
      && roleCan(session.role, "create_work_order"),
    );
    const conversionState = convertedWork
      ? `Converted to ${convertedWork.number}`
      : !impactReviewed
        ? "Awaiting manager impact review"
        : latestApprovalState === "pending" || latestApprovalState === "escalated"
          ? "Awaiting approval decision"
          : latestApprovalState === "rejected" || latestApprovalState === "cancelled"
            ? "Authorization not approved"
            : canConvert
              ? "Ready for work-order creation"
              : "Awaiting an authorized facilities operator";
    return {
      state: { kind: "ready" },
      page: {
        title: request.reference,
        eyebrow: "Store issue / preserved source report",
        description: request.problem,
        scopeLabel: storeLabel(store),
        primaryAction: convertedWork
          ? { label: `Open ${convertedWork.number}`, href: `/app/work-orders/${convertedWork.id}` }
          : canConvert
            ? { label: "Create work order", href: `/app/work-orders/new?request=${request.id}` }
            : latestApprovalState === "pending" || latestApprovalState === "escalated"
              ? { label: `Approval needed: ${latestApprovalRequest ? approvalRoleLabels[latestApprovalRequest.requiredRole] : "manager"}`, href: "#approval-decision" }
              : !impactReviewed
                ? { label: "Review request facts", href: "#request-review" }
                : undefined,
        secondaryAction: store ? { label: "Open store", href: `/app/stores/${store.id}` } : undefined,
      },
      statusLabel: sentence(request.status),
      statusTone: request.status === "converted" ? "positive" : request.priority === "emergency" ? "critical" : request.priority === "urgent" ? "warning" : "info",
      facts: [
        { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
        { label: "Reported by", value: request.reporterName, helperText: request.reporterEmployeeId ? `Employee ID ${request.reporterEmployeeId}` : "Employee ID not entered" },
        { label: "Reported", value: dateTime(request.submittedAt, store?.timeZone), helperText: "Store-local time" },
        { label: "Priority", value: sentence(request.priority) },
        { label: "Work order", value: convertedWork?.number ?? "Not created", link: convertedWork ? { href: `/app/work-orders/${convertedWork.id}`, label: "Open work order" } : undefined },
        approval.fact,
        { label: "Attached evidence", value: String(linkedFiles.length), helperText: "Original evidence remains tied to this report" },
      ],
      sections: [
        approval.section,
        impactEvidenceSection(impactAssessments, `/app/requests/${request.id}`),
        {
          id: "source-report",
          title: "Original store report",
          description: "The original report stays unchanged while managers add updates or create work.",
          facts: [
            { label: "Observed problem", value: request.problem },
            { label: "Review state", value: conversionState },
          ],
          action: !convertedWork && canConvert ? { label: "Create work order", href: `/app/work-orders/new?request=${request.id}` } : undefined,
        },
        {
          id: "decision-path",
          title: "What happens next",
          description: convertedWork
            ? "This report is linked to its work order, where vendor activity, visits, outcomes, costs, and follow-up continue."
            : "Review what was reported, then create a work order when service is approved. Equipment can be added later.",
          facts: [
            { label: "Original report", value: "Cannot be deleted", helperText: "Later corrections are recorded separately" },
            { label: "Equipment", value: "Optional at intake", helperText: "Link it now or after diagnosis" },
            { label: "Outside vendor", value: "Receives work only after the work order is sent" },
          ],
        },
        {
          id: "timeline",
          title: "Audit timeline",
          timeline: audit.map((event) => ({
            id: event.id,
            title: sentence(event.eventType.replaceAll(".", " ")),
            description: auditDescription(event.payloadJson),
            timestampLabel: dateTime(event.occurredAt, store?.timeZone),
            actorLabel: event.actorName,
          })),
        },
      ],
      backLink: { label: "Back to requests", href: "/app/requests" },
    };
  }

  if (route === "equipment") {
    const asset = scoped.assets.find((item) => item.id === id);
    if (!asset) return missingDetail("Equipment", "/app/equipment");
    const store = scoped.stores.find((item) => item.id === asset.storeId);
    const assetWork = scoped.workOrders.filter((work) => work.assetId === asset.id);
    const assetVisitIds = new Set(
      assetWork.flatMap((work) => visitsForWorkOrder(fixture, scoped, work.id).map((visit) => visit.id)),
    );
    const assetVisits = scoped.visits.filter((visit) => assetVisitIds.has(visit.id));
    const components = fixture.components.filter(
      (component) => component.organizationId === scoped.organizationId && component.assetId === asset.id,
    );
    const componentById = new Map(components.map((component) => [component.id, component]));
    const pmOccurrences = fixture.pmOccurrences
      .filter(
        (occurrence) =>
          occurrence.organizationId === scoped.organizationId &&
          occurrence.assetId === asset.id,
      )
      .sort((a, b) => b.dueAt.localeCompare(a.dueAt));
    const lifecycle = lifecycleRows(fixture, scoped, costByWork).find((row) => row.asset.id === asset.id);
    const expectedReplacementYear = asset.installedAt && asset.expectedLifeYears
      ? new Date(asset.installedAt).getUTCFullYear() + asset.expectedLifeYears
      : undefined;
    const canCreateWork = roleCan(session.role, "create_work_order");
    return {
      state: { kind: "ready" },
      page: {
        title: asset.name,
        eyebrow: assetHierarchyPath(asset).join(" / "),
        description: `${asset.assetTag} at ${storeLabel(store)}. Identity, components, service history, PM, cost, warranty, and replacement inputs stay connected here.`,
        scopeLabel: storeLabel(store),
        primaryAction: canCreateWork
          ? { label: "Create work order", href: hrefWithQuery("/app/work-orders/new", { store: asset.storeId, asset: asset.id }) }
          : undefined,
        secondaryAction: roleCanAccessProgramRoute(session.role, "lifecycle")
          ? { label: "Review lifecycle evidence", href: hrefWithQuery("/app/lifecycle", { store: asset.storeId, asset: asset.id }) }
          : undefined,
      },
      statusLabel: equipmentStatusLabel(asset.status),
      statusTone: asset.status === "operational" ? "positive" : asset.status === "watch" ? "warning" : "critical",
      facts: [
        { label: "Asset tag", value: asset.assetTag },
        { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
        { label: "Manufacturer / model", value: [asset.manufacturer, asset.model].filter(Boolean).join(" / ") || "Not entered" },
        { label: "Serial number", value: asset.serialNumber ?? "Not entered" },
        { label: "Installed", value: date(asset.installedAt), helperText: asset.expectedLifeYears ? `${asset.expectedLifeYears}-year expected-life planning reference; not an expiration date` : "Expected-life reference not entered" },
        { label: "Warranty", value: asset.warrantyEndsAt ? date(asset.warrantyEndsAt) : "Not entered", helperText: asset.warrantyEndsAt && Date.parse(asset.warrantyEndsAt) < Date.parse(fixture.asOf) ? "Expired as of this view" : "Check coverage before authorizing work" },
        { label: "Recorded work cost", value: money(lifecycle?.workCost ?? 0), helperText: "Entered cost lines only" },
        { label: "Replacement outlook", value: lifecycle?.replacement ? money(lifecycle.replacement) : "Not entered", helperText: lifecycle ? `${lifecycle.replacementResolution.explanation}${expectedReplacementYear ? ` Expected-life year ${expectedReplacementYear}.` : ""}` : "Planning inputs remain optional" },
      ],
      sections: [
        {
          id: "lifecycle-evidence",
          title: "Repair decision and lifecycle context",
          description: "Age against expected life and the current repair-versus-replacement facts appear together. Small bridge repairs are not treated as replacement signals, historical facts stay separate, and the decision remains human.",
          facts: [
            { label: "Current decision", value: lifecycle?.decisionState.label ?? "Inputs not available", helperText: lifecycle?.decisionState.helper },
            { label: "Current repair estimate", value: lifecycle?.screening.comparison.repairEstimateMinor === undefined ? "Not entered" : money(lifecycle.screening.comparison.repairEstimateMinor), helperText: "Current proposal only; not accumulated historical spend" },
            { label: "Required service runway", value: lifecycle?.screening.comparison.requiredEconomicRunwayMonths === undefined ? "Not calculable" : formatRunway(lifecycle.screening.comparison.requiredEconomicRunwayMonths), helperText: "Calculated from the current repair, installed replacement estimate, and expected life of a replacement; not a promise about repair life" },
            { label: "Entered service estimate", value: lifecycle?.screening.comparison.estimatedServiceExtensionMonths === undefined ? "Not entered" : formatRunway(lifecycle.screening.comparison.estimatedServiceExtensionMonths), helperText: "Vendor or operator planning estimate; kept visibly separate from the calculated runway" },
            { label: "Age against expected life", value: lifecycle?.screening.age.ageYears === undefined || lifecycle?.screening.age.expectedLifeYears === undefined ? "Not available" : `${lifecycle.screening.age.ageYears} of ${lifecycle.screening.age.expectedLifeYears} years`, helperText: lifecycle?.screening.age.lifeUsedPercentage === undefined ? undefined : `${Math.round(lifecycle.screening.age.lifeUsedPercentage)}% of the planning reference used; expected life is not an expiration date` },
            { label: "Expected life remaining", value: lifecycle?.screening.age.chronologicalRemainingExpectedLifeYears === undefined ? "Not available" : `${lifecycle.screening.age.chronologicalRemainingExpectedLifeYears} ${lifecycle.screening.age.chronologicalRemainingExpectedLifeYears === 1 ? "year" : "years"}`, helperText: "Chronological planning reference before any entered repair extension" },
            { label: "Repair share of replacement", value: lifecycle?.screening.comparison.repairToReplacementRatio === undefined ? "Not available" : `${Math.round(lifecycle.screening.comparison.repairToReplacementRatio * 100)}%`, helperText: "One transparent materiality fact; never a replacement rule by itself" },
            { label: "Additional capital to replace now", value: lifecycle?.screening.comparison.repairEstimateMinor === undefined || lifecycle?.screening.comparison.replacementEstimateMinor === undefined ? "Not available" : money(Math.max(0, lifecycle.screening.comparison.replacementEstimateMinor - lifecycle.screening.comparison.repairEstimateMinor)), helperText: "Replacement estimate less the current repair estimate; excludes effects not entered here" },
            { label: "Missing comparison inputs", value: lifecycle?.screening.dataGaps.length ? lifecycle.screening.dataGaps.map(lifecycleGapLabel).join(", ") : "None" },
            { label: "12 / 24 / 36 month work", value: `${lifecycle?.work12.length ?? 0} / ${lifecycle?.work24.length ?? 0} / ${lifecycle?.work36.length ?? 0}` },
            { label: "12 / 24 / 36 month cost", value: `${money(lifecycle?.cost12 ?? 0)} / ${money(lifecycle?.cost24 ?? 0)} / ${money(lifecycle?.cost36 ?? 0)}` },
            { label: "Observed service visits", value: String(lifecycle?.observedVisits.length ?? 0), helperText: "Visit count is presence context; it does not prove a repeat failure or billed labor" },
            { label: "Historical context", value: lifecycle?.contextFacts.join(" · ") || "No history recorded", helperText: "Visible for human review; excluded from the capital comparison" },
          ],
        },
        {
          id: "components",
          title: "Components",
          description: "Optional depth below the equipment record. Component-level history is retained when the team chooses to classify it.",
          table: {
            id: "equipment-components",
            caption: `Components for ${asset.name}`,
            columns: [
              { key: "component", label: "Component" },
              { key: "parent", label: "Parent" },
              { key: "part", label: "Part / serial" },
              { key: "installed", label: "Installed" },
              { key: "warranty", label: "Warranty" },
              { key: "work", label: "Linked work", align: "end" },
              { key: "cost", label: "Recorded cost", align: "end" },
            ],
            rows: components.map((component) => {
              const componentWork = assetWork.filter((work) => work.componentId === component.id);
              const componentCost = componentWork.reduce((sum, work) => sum + (costByWork.get(work.id) ?? 0), 0);
              const replacementCount = fixture.componentLifecycleEvents.filter(
                (event) =>
                  event.organizationId === scoped.organizationId &&
                  (event.removedComponentId === component.id || event.installedComponentId === component.id),
              ).length;
              return {
                id: component.id,
                label: component.name,
                href: `/app/equipment/${encodeURIComponent(asset.id)}/components/${encodeURIComponent(component.id)}`,
                cells: [
                  { key: "component", value: component.name },
                  { key: "parent", value: component.parentComponentId ? componentById.get(component.parentComponentId)?.name ?? "Unknown parent" : "Equipment" },
                  { key: "part", value: component.partNumber ?? "Part not entered", secondary: component.serialNumber ? `S/N ${component.serialNumber}` : "Serial not entered" },
                  { key: "installed", value: date(component.installedAt) },
                  { key: "warranty", value: date(component.warrantyEndsAt) },
                  { key: "work", value: String(componentWork.length), secondary: replacementCount ? `${replacementCount} replacement record${replacementCount === 1 ? "" : "s"}` : "No replacement recorded" },
                  { key: "cost", value: money(componentCost), secondary: "Recorded work cost" },
                ],
              };
            }),
          },
        },
        {
          id: "service-history",
          title: "Service history",
          description: `${assetVisits.length} observed visit${assetVisits.length === 1 ? "" : "s"} connect to this equipment through its work orders.`,
          table: {
            id: "equipment-work",
            caption: `Work orders for ${asset.name}`,
            columns: columns["work-orders"],
            rows: workRows(fixture, { ...scoped, workOrders: assetWork, visits: assetVisits, assets: [asset] }, {}),
          },
        },
        {
          id: "preventive-maintenance",
          title: "Preventive maintenance",
          table: {
            id: "equipment-pm",
            caption: `PM occurrences for ${asset.name}`,
            columns: [
              { key: "plan", label: "Plan" },
              { key: "window", label: "Completion window" },
              { key: "work", label: "Work order" },
              { key: "status", label: "Status" },
            ],
            rows: pmOccurrences.map((occurrence) => {
              const plan = fixture.pmPlans.find((item) => item.organizationId === scoped.organizationId && item.id === occurrence.planId);
              const status = effectivePmStatus(occurrence, fixture.asOf);
              return {
                id: occurrence.id,
                label: plan?.name ?? "PM occurrence",
                href: occurrence.workOrderId ? `/app/work-orders/${occurrence.workOrderId}` : hrefWithQuery("/app/pm", { occurrence: occurrence.id, store: asset.storeId }),
                cells: [
                  { key: "plan", value: plan?.name ?? "PM plan" },
                  { key: "window", value: `${date(occurrence.windowStartsAt)} – ${date(occurrence.windowEndsAt)}`, secondary: `Due ${date(occurrence.dueAt)}` },
                  { key: "work", value: occurrence.workOrderId ? assetWork.find((work) => work.id === occurrence.workOrderId)?.number ?? "Linked work outside current scope" : "Not created" },
                  { key: "status", value: sentence(status), tone: status === "completed" ? "positive" : status === "missed" ? "critical" : status === "due" ? "warning" : "info" },
                ],
              };
            }),
          },
        },
      ],
      backLink: { label: "Back to equipment", href: hrefWithQuery("/app/equipment", { store: asset.storeId }) },
    };
  }

  if (route === "invoice") {
    const invoice = fixture.invoiceReferences.find(
      (candidate) => candidate.organizationId === scoped.organizationId && candidate.id === id,
    );
    if (!invoice) return missingDetail("Invoice reference", "/app/invoices");
    const allAllocations = fixture.invoiceAllocations.filter(
      (allocation) => allocation.organizationId === scoped.organizationId && allocation.invoiceReferenceId === invoice.id,
    );
    const visibleAllocations = allAllocations.filter((allocation) => scoped.workOrders.some((work) => work.id === allocation.workOrderId));
    const hasRestrictedStoreScope = Boolean(session.regionIds?.length || session.storeIds?.length);
    if ((allAllocations.length > 0 && visibleAllocations.length === 0) || (allAllocations.length === 0 && hasRestrictedStoreScope)) {
      return missingDetail("Invoice reference", "/app/invoices");
    }
    const vendor = fixture.vendors.find((candidate) => candidate.organizationId === scoped.organizationId && candidate.id === invoice.vendorId);
    const allocatedMinor = visibleAllocations.reduce((sum, allocation) => sum + allocation.amount.amountMinor, 0);
    const rows: TableRowViewModel[] = visibleAllocations.map((allocation) => {
      const work = scoped.workOrders.find((candidate) => candidate.id === allocation.workOrderId)!;
      const store = scoped.stores.find((candidate) => candidate.id === work.storeId);
      const visits = scoped.visits.filter((visit) => visit.workOrderId === work.id);
      return {
        id: allocation.id,
        label: work.number,
        href: `/app/work-orders/${work.id}`,
        cells: [
          { key: "work", value: work.number, secondary: work.problem },
          { key: "store", value: storeLabel(store) },
          { key: "allocation", value: money(allocation.amount.amountMinor) },
          { key: "recorded", value: money(costByWork.get(work.id) ?? 0), secondary: "Entered work cost" },
          { key: "visits", value: String(visits.length), secondary: visits.length ? "Observed source visits" : "No visit recorded" },
          { key: "authorization", value: work.nte ? money(work.nte.amountMinor) : "Not set", secondary: "Not-to-exceed reference" },
        ],
      };
    });
    return {
      state: { kind: "ready" },
      page: { title: invoice.invoiceNumber, eyebrow: "Optional invoice safeguard", description: "A manually entered invoice reference connected to source work, visit, authorization, and recorded-cost facts. The platform does not approve or pay it.", scopeLabel: session.scopeLabel },
      statusLabel: sentence(invoice.matchStatus),
      statusTone: invoice.matchStatus === "confirmed" ? "positive" : ["unmatched", "rejected"].includes(invoice.matchStatus) ? "warning" : "info",
      facts: [
        { label: "Vendor", value: vendor?.name ?? "Unknown vendor", link: vendor ? { href: `/app/vendors/${vendor.id}`, label: "Open vendor" } : undefined },
        { label: "Invoice date", value: date(invoice.invoiceDate) },
        { label: "Gross amount", value: money(invoice.grossAmount.amountMinor) },
        { label: "Allocated to work", value: money(allocatedMinor), helperText: `${visibleAllocations.length} visible allocation${visibleAllocations.length === 1 ? "" : "s"}` },
        { label: "Unmatched balance", value: money(Math.max(0, invoice.grossAmount.amountMinor - allocatedMinor)), helperText: "Visible for human review; not an automatic rejection" },
        { label: "Operator WO reference", value: invoice.operatorWorkOrderNumber ?? "Not supplied", helperText: "The operator work-order number is the first match key" },
      ],
      sections: [
        {
          id: "linked-work",
          title: "Linked source work",
          description: visibleAllocations.length ? "Open a work order to inspect authorization, visits, cost lines, and audit history." : "No source work is linked yet. The reference stays visible for manual review.",
          table: { id: "invoice-work", caption: `Work linked to ${invoice.invoiceNumber}`, columns: [{ key: "work", label: "Work order" }, { key: "store", label: "Store" }, { key: "allocation", label: "Invoice allocation", align: "end" }, { key: "recorded", label: "Recorded cost", align: "end" }, { key: "visits", label: "Visits" }, { key: "authorization", label: "NTE", align: "end" }], rows },
        },
        {
          id: "review-boundary",
          title: "What this review means",
          description: "These are comparison facts for a person. Observed presence is approximate, and a difference does not prove that work or billing is invalid.",
          facts: [
            { label: "Matching", value: "Manual confirmation" },
            { label: "Payment", value: "Handled in the customer's accounting system" },
            { label: "Source of truth", value: "Operator work order and append-only service evidence" },
          ],
        },
      ],
      backLink: { label: "Back to invoice references", href: "/app/invoices" },
    };
  }

  if (route === "work-order") {
    const work = scoped.workOrders.find((item) => item.id === id);
    if (!work) return missingDetail("Work order", "/app/work-orders");
    const store = scoped.stores.find((item) => item.id === work.storeId);
    const storeTimeZone = store?.timeZone
      ?? fixture.organizations.find((organization) => organization.id === scoped.organizationId)?.timeZone
      ?? DEFAULT_OPERATIONS_TIME_ZONE;
    const assignment = assignmentForWork(fixture, scoped.organizationId, work.id);
    const vendor = assignment?.vendorId ? fixture.vendors.find((item) => item.id === assignment.vendorId && item.organizationId === scoped.organizationId) : undefined;
    const sourceRequest = work.requestId
      ? fixture.requests.find((request) => request.organizationId === scoped.organizationId && request.id === work.requestId)
      : undefined;
    const pmOccurrence = fixture.pmOccurrences.find((occurrence) =>
      occurrence.organizationId === scoped.organizationId && occurrence.workOrderId === work.id,
    );
    const pmPlan = pmOccurrence
      ? fixture.pmPlans.find((plan) => plan.organizationId === scoped.organizationId && plan.id === pmOccurrence.planId)
      : undefined;
    const visits = visitsForWorkOrder(fixture, scoped, work.id);
    const visitHistoryRows = workOrderVisitRows(visits, storeTimeZone);
    const noteHistory = workOrderNoteHistory(fixture, scoped.organizationId, work.id, visits, storeTimeZone);
    const sourceVisit = visits
      .filter((visit) => Date.parse(visit.checkedInAt) < Date.parse(work.createdAt))
      .sort((left, right) => left.checkedInAt.localeCompare(right.checkedInAt))[0];
    const costLines = fixture.costLines.filter((line) => line.organizationId === scoped.organizationId && line.workOrderId === work.id);
    const invoiceLinks = fixture.invoiceAllocations
      .filter((allocation) => allocation.organizationId === scoped.organizationId && allocation.workOrderId === work.id)
      .map((allocation) => ({
        allocation,
        invoice: fixture.invoiceReferences.find((invoice) => invoice.organizationId === scoped.organizationId && invoice.id === allocation.invoiceReferenceId),
      }))
      .filter((item): item is typeof item & { invoice: NonNullable<typeof item.invoice> } => Boolean(item.invoice));
    const audit = fixture.auditEvents.filter((event) => event.organizationId === scoped.organizationId && (event.aggregateId === work.id || visits.some((visit) => visit.id === event.aggregateId))).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const issuances = fixture.issuances.filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === work.id);
    const approval = approvalEvidence(fixture, scoped.organizationId, "work_order", work.id);
    const impactAssessments = work.requestId
      ? fixture.requestImpactAssessments.filter((assessment) => assessment.organizationId === scoped.organizationId && assessment.requestId === work.requestId)
      : [];
    return {
      state: { kind: "ready" },
      page: {
        title: work.number,
        eyebrow: "Operator work order",
        description: work.problem,
        scopeLabel: storeLabel(store),
        primaryAction: roleCan(session.role, "issue_work_order")
          && canRouteAndIssueWorkOrder(work.status)
          && assignment?.kind !== "internal"
          && (!assignment || !["completed", "cancelled", "superseded"].includes(assignment.status))
          ? {
              label: !assignment || assignment.kind === "choose_later" || assignment.status === "declined"
                ? "Choose vendor & generate handoff"
                : "Generate vendor handoff",
              href: `#issue-work`,
            }
          : undefined,
      },
      statusLabel: workStatusLabel(work.status),
      statusTone: workStatusTone(work.status),
      facts: [
        { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
        { label: "Assigned to", value: vendor?.name ?? (assignment?.kind === "internal" ? "Internal maintenance" : "Choose later") },
        ...(sourceVisit
          ? [{ label: "Record origin", value: "Created after service began", helperText: "The observed visit started first; this work order does not imply prior written authorization.", link: { href: `/app/visits/${sourceVisit.id}`, label: "Open original visit" } }]
          : pmOccurrence
            ? [{ label: "Record origin", value: "Preventive maintenance", helperText: `${pmPlan?.name ?? "Scheduled maintenance"} · due ${date(pmOccurrence.dueAt)}`, link: { href: hrefWithQuery("/app/pm", { occurrence: pmOccurrence.id }), label: "Open PM occurrence" } }]
            : sourceRequest
              ? [{ label: "Record origin", value: "Store report", helperText: `${sourceRequest.reference} was reviewed before this work order was created.`, link: { href: `/app/requests/${sourceRequest.id}`, label: "Open original report" } }]
              : [{ label: "Record origin", value: "Created directly by a manager", helperText: "No separate store report was required; creation remains visible in the audit history." }]),
        { label: "Accountable party", value: work.accountableParty },
        { label: "Next action", value: work.nextAction, helperText: work.dueAt ? `Due ${dateTime(work.dueAt, storeTimeZone)}` : "No due time entered" },
        approval.fact,
        { label: "Recorded work cost", value: money(costByWork.get(work.id) ?? 0), helperText: "Entered source lines; not inferred from observed time" },
        { label: "Classification", value: work.categoryKey ? sentence(work.categoryKey) : "Deferred", helperText: work.assetId
          ? "Equipment linked"
          : ["exterior", "store_sanitation"].includes(work.categoryKey ?? "")
            ? "Site-level work; equipment does not apply"
            : "Equipment has not been linked yet" },
      ],
      sections: [
        ...(sourceRequest ? [{
          id: "original-request",
          title: "Original store report",
          description: sourceRequest.problem,
          facts: [
            { label: "Request", value: sourceRequest.reference, helperText: sentence(sourceRequest.status), link: { href: `/app/requests/${sourceRequest.id}`, label: "Open original report" } },
            { label: "Reported by", value: sourceRequest.reporterName },
            { label: "Reported", value: dateTime(sourceRequest.submittedAt, storeTimeZone), helperText: "Store-local time" },
            { label: "Original priority", value: sentence(sourceRequest.priority) },
          ],
          action: { label: "Open original report", href: `/app/requests/${sourceRequest.id}` },
        }] : []),
        approval.section,
        ...(work.requestId ? [impactEvidenceSection(impactAssessments, `/app/work-orders/${work.id}`)] : []),
        { id: "authorization", title: sourceVisit ? "Service record and billing reference" : "Authorization", description: sourceVisit ? "This work order was created after the observed visit began. It provides a billing and spend-tracking reference without presenting the record as a prior written service authorization." : "The operator work-order number remains the billing reference; vendor ticket, invoice, and external PO stay separate.", action: work.id === NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId ? { label: "Preview vendor authorization", href: `/public/service/${NORTHLINE_DEMO_ENTRY_TOKENS.serviceAuthorization104}` } : undefined, facts: [
          { label: "Authorized scope", value: work.authorizedScope ?? "No additional scope entered" },
          { label: "Not to exceed", value: work.nte ? money(work.nte.amountMinor) : "Not set" },
          { label: "Issued revisions", value: String(issuances.length), helperText: issuances.length ? `Latest revision ${Math.max(...issuances.map((item) => item.revision))}` : "Not issued yet" },
          { label: "Vendor service ticket", value: work.vendorServiceTicketNumber ?? "Not entered" },
          { label: "Vendor invoice", value: work.vendorInvoiceNumber ?? (invoiceLinks.map((item) => item.invoice.invoiceNumber).join(", ") || "Not entered"), helperText: invoiceLinks.length ? "Optional invoice reference linked below" : undefined, link: invoiceLinks.length === 1 ? { href: `/app/invoices/${invoiceLinks[0].invoice.id}`, label: "Open invoice reference" } : undefined },
          { label: "External accounting PO", value: work.externalAccountingPo ?? "Not entered" },
        ] },
        {
          id: "visits",
          title: "Service visits and notes",
          description: visits.length
            ? "Every linked check-in, checkout, outcome, and recorded service note stays with this work order after it is closed. Notes are shown as entered and are not interpreted by the platform."
            : "No service visit or service note has been linked to this work order yet.",
          tableHeading: "Check-in and checkout history",
          table: {
            id: "work-visits",
            caption: "Visits linked to this work order",
            columns: [
              { key: "visit", label: "Checked in" },
              { key: "provider", label: "Technician / vendor" },
              { key: "checkout", label: "Checked out" },
              { key: "outcome", label: "Outcome and checkout note" },
            ],
            rows: visitHistoryRows,
          },
          timelineHeading: "Notes and updates",
          timeline: noteHistory,
        },
        { id: "cost", title: "Recorded work cost", description: "Cost lines are entered facts. Optional invoice evidence is reviewed separately.", table: { id: "work-cost", caption: "Recorded cost lines", columns: [{ key: "date", label: "Service date" }, { key: "kind", label: "Type" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount", align: "end" }], rows: costLines.map((line) => ({ id: line.id, label: line.description, href: `/app/work-orders/${work.id}`, cells: [{ key: "date", value: date(line.serviceDate) }, { key: "kind", value: sentence(line.kind) }, { key: "description", value: line.description }, { key: "amount", value: money(line.amount.amountMinor) }] })) } },
        { id: "invoice-references", title: "Invoice references", description: "Optional billing evidence is linked for review without making it a prerequisite for maintenance visibility.", table: { id: "work-invoices", caption: `Invoice references linked to ${work.number}`, columns: [{ key: "invoice", label: "Invoice" }, { key: "date", label: "Invoice date" }, { key: "gross", label: "Gross amount", align: "end" }, { key: "allocation", label: "Allocated here", align: "end" }, { key: "status", label: "Match status" }], rows: invoiceLinks.map(({ invoice, allocation }) => ({ id: invoice.id, label: invoice.invoiceNumber, href: `/app/invoices/${invoice.id}`, cells: [{ key: "invoice", value: invoice.invoiceNumber }, { key: "date", value: date(invoice.invoiceDate) }, { key: "gross", value: money(invoice.grossAmount.amountMinor) }, { key: "allocation", value: money(allocation.amount.amountMinor) }, { key: "status", value: sentence(invoice.matchStatus), tone: invoice.matchStatus === "confirmed" ? "positive" : "warning" }] })) } },
        { id: "timeline", title: "Work-order activity", description: "See when the work order was created, sent, updated, visited, followed up, or corrected. Times are shown in the store's local timezone.", timeline: audit.map((event) => ({ id: event.id, title: sentence(event.eventType.replaceAll(".", " ")), description: auditDescription(event.payloadJson), timestampLabel: dateTime(event.occurredAt, storeTimeZone), actorLabel: event.actorName })) },
      ],
      backLink: { label: "Back to work orders", href: "/app/work-orders" },
    };
  }

  if (route === "visit") {
    const visit = scoped.visits.find((item) => item.id === id);
    if (!visit) return missingDetail("Service visit", "/app/visits");
    const store = scoped.stores.find((item) => item.id === visit.storeId);
    const storeTimeZone = store?.timeZone
      ?? fixture.organizations.find((organization) => organization.id === scoped.organizationId)?.timeZone
      ?? DEFAULT_OPERATIONS_TIME_ZONE;
    const visitWorkLinks = fixture.siteVisitWorkOrders
      .filter((link) => link.organizationId === scoped.organizationId && link.visitId === visit.id)
      .sort((left, right) => left.ordinal - right.ordinal);
    const linkedWorks = visitWorkLinks.flatMap((link) => {
      const linkedWork = scoped.workOrders.find((item) => item.id === link.workOrderId);
      return linkedWork ? [{ link, work: linkedWork }] : [];
    });
    const work = visit.workOrderId
      ? scoped.workOrders.find((item) => item.id === visit.workOrderId) ?? linkedWorks[0]?.work
      : linkedWorks[0]?.work;
    const evidence = fixture.visitEvidence
      .filter((item) => item.organizationId === scoped.organizationId && item.visitId === visit.id)
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
    const checkIn = evidence.find((item) => item.kind === "check_in");
    const checkOut = evidence.find((item) => item.kind === "check_out");
    const exceptions = fixture.exceptions
      .filter((item) => item.organizationId === scoped.organizationId && item.visitId === visit.id)
      .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt));
    const openUnmatchedException = linkedWorks.length === 0
      ? exceptions.find((exception) => exception.kind === "no_work_order" && exception.status !== "resolved")
      : undefined;
    const canCreateVisitWorkOrder = Boolean(openUnmatchedException && roleCan(session.role, "create_work_order"));
    const createFromVisitHref = openUnmatchedException
      ? `/app/work-orders/new?sourceException=${encodeURIComponent(openUnmatchedException.id)}`
      : undefined;
    const linkedFiles = fixture.entityFiles.filter(
      (link) => link.organizationId === scoped.organizationId && link.entityType === "visit" && link.entityId === visit.id,
    );
    const audit = fixture.auditEvents
      .filter(
        (event) =>
          event.organizationId === scoped.organizationId &&
          (event.aggregateId === visit.id ||
            linkedWorks.some(({ work: linkedWork }) => linkedWork.id === event.aggregateId) ||
            exceptions.some((exception) => exception.id === event.aggregateId)),
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    const locationLabel = (result: typeof checkIn) => result?.location?.result ? sentence(result.location.result) : "Not recorded";
    return {
      state: { kind: "ready" },
      page: {
        title: `${visit.providerName} at Store ${store?.storeNumber ?? ""}`.trim(),
        eyebrow: visit.status === "active" ? "Onsite now" : "Observed service visit",
        description: visit.purpose,
        scopeLabel: storeLabel(store),
        primaryAction: canCreateVisitWorkOrder && createFromVisitHref
          ? { label: "Create work order from visit", href: createFromVisitHref }
          : exceptions.find((exception) => exception.status !== "resolved")
            ? { label: "Review visit exception", href: `/app/action-center/${exceptions.find((exception) => exception.status !== "resolved")!.id}` }
          : work
            ? { label: `Open ${work.number}`, href: `/app/work-orders/${work.id}` }
            : undefined,
        secondaryAction: canCreateVisitWorkOrder && openUnmatchedException
          ? { label: "Review other options", href: `/app/action-center/${openUnmatchedException.id}` }
          : store ? { label: "Open store", href: `/app/stores/${store.id}` } : undefined,
      },
      statusLabel: visit.status === "active" ? "Onsite now" : sentence(visit.outcome ?? visit.status),
      statusTone: visit.status === "active" ? "info" : visit.outcome && unresolvedOutcomesForPresentation.has(visit.outcome) ? "warning" : "positive",
      facts: [
        { label: "Technician", value: visit.technicianName, helperText: visit.providerName },
        { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
        {
          label: linkedWorks.length === 1 ? "Operator work order" : "Operator work orders",
          value: linkedWorks.length ? linkedWorks.map(({ work: linkedWork }) => linkedWork.number).join(" · ") : "Not linked",
          helperText: linkedWorks.length
            ? `${linkedWorks.length} canonical service record${linkedWorks.length === 1 ? "" : "s"} covered during this visit`
            : visit.unmatchedReason ?? "Entered without a work order",
          link: linkedWorks.length === 1 ? { href: `/app/work-orders/${linkedWorks[0].work.id}`, label: "Open work order" } : undefined,
        },
        { label: "Observed arrival", value: formatOperationsDateTime(visit.checkedInAt, storeTimeZone, { seconds: true }), helperText: `Store-local time · started via ${sentence(visit.startedChannel)}` },
        { label: "Observed departure", value: visit.checkedOutAt ? formatOperationsDateTime(visit.checkedOutAt, storeTimeZone, { seconds: true }) : "Still onsite", helperText: visit.endedChannel ? `Store-local time · finished via ${sentence(visit.endedChannel)}` : "No checkout event yet" },
        { label: "Approximate observed time", value: visit.observedDurationSeconds === undefined ? "In progress" : `${Math.round(visit.observedDurationSeconds / 60)} minutes`, helperText: "Presence context, not certified labor" },
      ],
      sections: [
        ...(linkedWorks.length ? [{
          id: "work-orders",
          title: "Work orders and checkout notes",
          description: "A single observed visit can cover more than one operator work order. Each work order keeps its own outcome and technician note.",
          table: {
            id: "visit-work-orders",
            caption: `Work orders covered during this ${visit.providerName} visit`,
            columns: [
              { key: "work", label: "Work order" },
              { key: "problem", label: "Problem" },
              { key: "outcome", label: "Outcome and technician note" },
              { key: "status", label: "Work status" },
            ],
            rows: linkedWorks.map(({ link, work: linkedWork }) => ({
              id: link.id,
              label: linkedWork.number,
              href: `/app/work-orders/${linkedWork.id}`,
              cells: [
                { key: "work", value: linkedWork.number },
                { key: "problem", value: linkedWork.problem },
                { key: "outcome", value: link.outcome ? sentence(link.outcome) : "Not recorded", secondary: link.outcomeNotes?.trim() || "No checkout note recorded", tone: link.outcome ? (["completed", "no_issue_found"].includes(link.outcome) ? "positive" : "warning") : workStatusTone(linkedWork.status) },
                { key: "status", value: workStatusLabel(linkedWork.status), tone: workStatusTone(linkedWork.status) },
              ],
            })),
          },
        }] : []),
        ...(openUnmatchedException ? [{
          id: "missing-work-order",
          title: "Create the missing work order",
          description: "Use this when the vendor was called directly and service began before anyone could create the operator record.",
          facts: [
            { label: "Technician checkout", value: visit.outcome ? sentence(visit.outcome) : visit.status === "active" ? "Still onsite" : "Outcome not recorded", helperText: visit.outcomeNotes ?? "No technician notes were entered." },
            { label: "What stays unchanged", value: "Original check-in and checkout evidence", helperText: "Observed times are never backdated or replaced." },
            { label: "What gets added", value: "One canonical work order linked to this visit", helperText: "Recorded costs and optional invoice evidence can then use the operator work-order number." },
            { label: "Authorization treatment", value: "Created after service began", helperText: "The record documents the verbal or emergency path; it does not claim a prior written authorization." },
          ],
          action: canCreateVisitWorkOrder && createFromVisitHref
            ? { label: "Create and link work order", href: createFromVisitHref }
            : { label: "Open visit review", href: `/app/action-center/${openUnmatchedException.id}` },
        }] : []),
        {
          id: "evidence",
          title: "Check-in and checkout evidence",
          description: "Authoritative event timestamps are displayed in the store's local timezone with seconds for camera review. Channel and point-in-time location results stay separate; location is never tracked continuously.",
          facts: [
            { label: "Check-in location", value: locationLabel(checkIn), helperText: checkIn?.location?.accuracyM !== undefined ? `${checkIn.location.accuracyM} m accuracy · ${checkIn.location.distanceM ?? "Unknown"} m from store` : "Accuracy or distance not available" },
            { label: "Checkout location", value: locationLabel(checkOut), helperText: checkOut?.location?.accuracyM !== undefined ? `${checkOut.location.accuracyM} m accuracy · ${checkOut.location.distanceM ?? "Unknown"} m from store` : visit.status === "active" ? "Captured only when checkout occurs" : "Accuracy or distance not available" },
            {
              label: "Outcome",
              value: linkedWorks.length
                ? `${visitWorkLinks.filter((link) => link.outcome).length} work-order outcome${visitWorkLinks.filter((link) => link.outcome).length === 1 ? "" : "s"} recorded`
                : visit.outcome ? sentence(visit.outcome) : "Not recorded",
              helperText: linkedWorks.length
                ? "Open Work orders and checkout notes for the outcome recorded against each job."
                : visit.outcomeNotes,
            },
            { label: "Attached evidence", value: String(linkedFiles.length), helperText: "Photos and documents remain linked to this visit" },
          ],
          table: {
            id: "visit-evidence",
            caption: `Evidence events for ${visit.providerName}`,
            columns: [{ key: "event", label: "Evidence event" }, { key: "time", label: "Store-local time" }, { key: "channel", label: "Channel" }, { key: "result", label: "Result" }],
            rows: evidence.map((item) => ({
              id: item.id,
              label: sentence(item.kind),
              href: `/app/visits/${visit.id}#evidence`,
              cells: [
                { key: "event", value: sentence(item.kind) },
                { key: "time", value: formatOperationsDateTime(item.observedAt, storeTimeZone, { seconds: true }) },
                { key: "channel", value: sentence(item.channel) },
                { key: "result", value: item.location?.result ? sentence(item.location.result) : "Recorded", tone: item.location?.result === "verified" || item.location?.result === "trusted_store_device" ? "positive" : item.location ? "warning" : "neutral" },
              ],
            })),
          },
        },
        {
          id: "exceptions",
          title: "Review history",
          description: exceptions.length ? "Exceptions remain visible after acknowledgement or resolution." : "No visit exceptions were recorded.",
          table: {
            id: "visit-exceptions",
            caption: "Exceptions linked to this visit",
            columns: [{ key: "item", label: "Review item" }, { key: "detected", label: "Detected" }, { key: "severity", label: "Severity" }, { key: "status", label: "Status" }],
            rows: exceptions.map((exception) => ({
              id: exception.id,
              label: exception.summary,
              href: `/app/action-center/${exception.id}`,
              cells: [
                { key: "item", value: exception.summary, secondary: sentence(exception.kind) },
                { key: "detected", value: dateTime(exception.detectedAt, storeTimeZone) },
                { key: "severity", value: sentence(exception.severity), tone: exception.severity === "urgent" ? "critical" : "warning" },
                { key: "status", value: sentence(exception.status), tone: exception.status === "resolved" ? "positive" : "warning" },
              ],
            })),
          },
        },
        {
          id: "timeline",
          title: "Append-only activity",
          description: "The original timestamps and evidence remain intact when an operator later reconciles or corrects the record.",
          timeline: audit.map((event) => ({ id: event.id, title: sentence(event.eventType.replaceAll(".", " ")), description: auditDescription(event.payloadJson), timestampLabel: dateTime(event.occurredAt, storeTimeZone), actorLabel: event.actorName })),
        },
      ],
      backLink: { label: "Back to visits", href: "/app/visits" },
    };
  }

  if (route === "store") {
    const store = scoped.stores.find((item) => item.id === id);
    if (!store) return missingDetail("Store", "/app/stores");
    const storeWork = scoped.workOrders.filter((work) => work.storeId === store.id);
    const storeVisits = scoped.visits.filter((visit) => visit.storeId === store.id);
    const storeAssets = scoped.assets.filter((asset) => asset.storeId === store.id);
    const storeScopedFixture = { ...scoped, stores: [store], storeIds: new Set([store.id]), workOrders: storeWork, visits: storeVisits, assets: storeAssets };
    const storeUpcomingVisits = visitRows(fixture, storeScopedFixture, { status: "upcoming" });
    const storeActiveHolds = (fixture.workOrderVisitHolds ?? [])
      .filter((hold) => hold.organizationId === scoped.organizationId && hold.status === "active" && storeWork.some((work) => work.id === hold.workOrderId && work.status === "approved"))
      .sort((left, right) => left.deadlineAt.localeCompare(right.deadlineAt));
    const heldWorkRows: TableRowViewModel[] = storeActiveHolds.map((hold) => {
      const work = storeWork.find((candidate) => candidate.id === hold.workOrderId)!;
      return {
        id: hold.id,
        label: work.number,
        href: `/app/work-orders/${work.id}`,
        cells: [
          { key: "work", value: work.number, secondary: work.problem },
          { key: "category", value: sentence(work.categoryKey ?? "Service") },
          { key: "instruction", value: heldWorkInstruction(hold.posture) },
          { key: "review", value: heldWorkReviewLabel(hold.deadlineAt, fixture.asOf), secondary: date(hold.deadlineAt), tone: hold.deadlineAt < fixture.asOf ? "critical" : "warning" },
        ],
      };
    });
    const openStoreRequestIds = new Set(
      fixture.requests
        .filter((request) => request.organizationId === scoped.organizationId && request.storeId === store.id && ["submitted", "under_review"].includes(request.status))
        .map((request) => request.id),
    );
    const currentOperatingStates = fixture.requestImpactAssessments
      .filter((assessment) => assessment.organizationId === scoped.organizationId && assessment.storeId === store.id && openStoreRequestIds.has(assessment.requestId))
      .map((assessment) => assessment.storeOperatingState);
    const storeStatusLabel = store.status === "inactive"
      ? "Inactive"
      : currentOperatingStates.includes("unable_to_operate")
        ? "Unable to operate"
        : currentOperatingStates.includes("partially_operational")
          ? "Limited operations"
          : "Active";
    const storeStatusTone: Tone = store.status === "inactive"
      ? "neutral"
      : currentOperatingStates.includes("unable_to_operate")
        ? "critical"
        : currentOperatingStates.includes("partially_operational")
          ? "warning"
          : "positive";
    if (session.demoEdition === "accountability") {
      const isDemoEntryStore = store.id === NORTHLINE_DEMO_HANDLES.storyStoreId;
      return {
        state: { kind: "ready" },
        page: {
          title: `Store ${store.storeNumber}`,
          eyebrow: store.name,
          description: storeAddress(store),
          scopeLabel: session.scopeLabel,
          primaryAction: roleCan(session.role, "create_work_order") ? { label: "Create work order", href: `/app/work-orders/new?store=${store.id}` } : undefined,
          secondaryAction: isDemoEntryStore ? { label: "Open vendor check-in", href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}` } : { label: "View service visits", href: `/app/visits?store=${store.id}` },
        },
        statusLabel: storeStatusLabel,
        statusTone: storeStatusTone,
        facts: [
          { label: "Open work orders", value: String(storeWork.filter((work) => !["closed", "cancelled"].includes(work.status)).length), link: { href: `/app/work-orders?store=${store.id}&status=open`, label: "Open work orders" } },
          { label: "Upcoming visits", value: String(storeUpcomingVisits.length), link: { href: `/app/visits?store=${store.id}&status=upcoming`, label: "Open upcoming visits" } },
          { label: "Approved for next suitable visit", value: String(storeActiveHolds.length), link: { href: `/app/work-orders?store=${store.id}&visitPlan=ready`, label: "Open approved work" } },
          { label: "Vendors onsite now", value: String(storeVisits.filter((visit) => visit.status === "active").length), link: { href: `/app/visits?store=${store.id}&status=active`, label: "Open active visits" } },
          { label: "Recorded visits", value: String(storeVisits.length), link: { href: `/app/visits?store=${store.id}`, label: "Open visit history" } },
        ],
        sections: [
          ...(isDemoEntryStore ? [{
            id: "demo-entry-points",
            title: "Vendor check-in options",
            description: "The QR/mobile page and trusted store computer record the same visit. Times display in the store's local timezone.",
            facts: [
              { label: "QR or mobile web", value: "Vendor check-in and checkout", link: { href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.store104}`, label: "Open QR/mobile check-in" } },
              { label: "Trusted store computer", value: "Check a vendor in or finish an onsite visit", link: { href: `/public/store/${NORTHLINE_DEMO_ENTRY_TOKENS.trustedStore104}`, label: "Open store check-in" } },
            ],
          }] : []),
          ...(storeUpcomingVisits.length ? [{
            id: "upcoming-visits",
            title: "Upcoming visits",
            description: "Vendor-confirmed appointments for this store, shown in the store’s local time.",
            table: { id: "store-upcoming-visits", caption: `Upcoming visits for Store ${store.storeNumber}`, columns: columns.visits, rows: storeUpcomingVisits },
            action: { label: "Open all upcoming visits", href: `/app/visits?store=${store.id}&status=upcoming` },
          }] : []),
          ...(storeActiveHolds.length ? [{
            id: "ready-to-bundle",
            title: "Approved for next suitable visit",
            description: "These jobs can wait for a suitable vendor already onsite or be sent together after a manager reviews the store’s list.",
            table: { id: "store-held-work", caption: `Approved for next suitable visit at Store ${store.storeNumber}`, columns: [{ key: "work", label: "Work order" }, { key: "category", label: "Service area" }, { key: "instruction", label: "What the vendor may do" }, { key: "review", label: "Review timing" }], rows: heldWorkRows },
            action: { label: "Send approved jobs together", href: `/app/store-sweeps/new?store=${store.id}` },
          }] : []),
          { id: "work", title: "Work orders", description: "The customer work-order numbers available for vendor service.", table: { id: "store-work", caption: `Work orders for Store ${store.storeNumber}`, columns: columns["work-orders"].filter((column) => column.key !== "cost"), rows: workRows(fixture, storeScopedFixture, {}) } },
          { id: "visits", title: "Check-in and checkout history", description: "Technician, vendor, selected work order, observed times, and checkout outcome.", table: { id: "store-visits", caption: `Visits for Store ${store.storeNumber}`, columns: columns.visits, rows: visitRows(fixture, storeScopedFixture, {}) } },
        ],
        backLink: { label: "Back to stores", href: "/app/stores" },
      };
    }
    const rollingCostByWork = recordedCostByWork(fixture, scoped.organizationId, rollingYearStart(fixture.asOf));
    const storePm = fixture.pmOccurrences.filter((occurrence) => occurrence.organizationId === scoped.organizationId && occurrence.storeId === store.id);
    const eligiblePm = storePm.filter((occurrence) => occurrence.status !== "waived" && Date.parse(occurrence.windowEndsAt) < Date.parse(fixture.asOf));
    const completedPm = eligiblePm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "completed");
    const pmByPlan = new Map(fixture.pmPlans.filter((plan) => plan.organizationId === scoped.organizationId).map((plan) => [plan.id, plan]));
    const programById = new Map(fixture.maintenancePrograms.filter((program) => program.organizationId === scoped.organizationId).map((program) => [program.id, program]));
    const storePlans = fixture.pmPlans
      .filter((plan) => plan.organizationId === scoped.organizationId && plan.storeId === store.id && plan.active)
      .sort((left, right) => left.name.localeCompare(right.name));
    const serviceAreas = [...new Set([
      ...storeWork.map((work) => work.categoryKey).filter((value): value is string => Boolean(value)),
      ...storeAssets.map((asset) => asset.categoryKey),
    ])].sort();
    const serviceAreaRows: TableRowViewModel[] = serviceAreas.map((category) => {
      const work = storeWork.filter((item) => item.categoryKey === category);
      const assets = storeAssets.filter((asset) => asset.categoryKey === category);
      const pm = storePm.filter((occurrence) => pmByPlan.get(occurrence.planId)?.categoryKey === category);
      const eligibleCategoryPm = pm.filter((occurrence) => occurrence.status !== "waived" && Date.parse(occurrence.windowEndsAt) < Date.parse(fixture.asOf));
      const completedCategoryPm = eligibleCategoryPm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "completed").length;
      const missed = eligibleCategoryPm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "missed").length;
      const due = pm.filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "due").length;
      const open = work.filter((item) => !["closed", "cancelled"].includes(item.status)).length;
      return {
        id: category,
        label: sentence(category),
        href: hrefWithQuery("/app/spend", { store: store.id, category }),
        cells: [
          { key: "area", value: sentence(category), secondary: `${assets.length} tracked equipment record${assets.length === 1 ? "" : "s"}` },
          { key: "cost", value: money(costForWorkIds(rollingCostByWork, work.map((item) => item.id))) },
          { key: "open", value: String(open), tone: open ? "warning" : "positive" },
          { key: "pm", value: eligibleCategoryPm.length ? `${completedCategoryPm}/${eligibleCategoryPm.length} eligible completed` : pm.length ? "No closed window" : "Not configured", secondary: missed ? `${missed} missed in closed windows` : due ? `${due} due now` : eligibleCategoryPm.length ? "Closed-window compliance basis" : undefined, tone: missed ? "critical" : due ? "warning" : "positive" },
          { key: "status", value: missed ? "PM exception" : open ? "Open work" : "No current exception", tone: missed ? "critical" : open ? "warning" : "positive" },
        ],
      };
    });
    const storePmStatus = storePm.map((occurrence) => ({ occurrence, status: effectivePmStatus(occurrence, fixture.asOf) }));
    const duePm = storePmStatus.filter(({ status }) => status === "due");
    const missedPm = storePmStatus.filter(({ status }) => status === "missed");
    const nextPm = storePmStatus
      .filter(({ status }) => !["completed", "waived", "cancelled", "missed"].includes(status))
      .sort((left, right) => left.occurrence.dueAt.localeCompare(right.occurrence.dueAt))[0]?.occurrence;
    const lastCompletedPm = storePm
      .filter((occurrence) => effectivePmStatus(occurrence, fixture.asOf) === "completed")
      .sort((left, right) => (right.completedAt ?? right.dueAt).localeCompare(left.completedAt ?? left.dueAt))[0];
    const pmPriority: Record<ReturnType<typeof effectivePmStatus>, number> = {
      missed: 0,
      due: 1,
      proposed: 2,
      scheduled: 3,
      upcoming: 4,
      unscheduled: 5,
      completed: 6,
      completed_early: 6,
      completed_on_time: 6,
      completed_late: 6,
      waived: 7,
      cancelled: 8,
    };
    const pmPlanRows: TableRowViewModel[] = storePlans.map((plan) => {
      const asset = storeAssets.find((candidate) => candidate.id === plan.assetId);
      const program = plan.programId ? programById.get(plan.programId) : undefined;
      const occurrences = storePm
        .filter((occurrence) => occurrence.planId === plan.id)
        .sort((left, right) => {
          const leftStatus = effectivePmStatus(left, fixture.asOf);
          const rightStatus = effectivePmStatus(right, fixture.asOf);
          return pmPriority[leftStatus] - pmPriority[rightStatus] || left.dueAt.localeCompare(right.dueAt);
        });
      const occurrence = occurrences.find((candidate) => !["completed", "waived", "cancelled"].includes(effectivePmStatus(candidate, fixture.asOf)))
        ?? occurrences.sort((left, right) => (right.completedAt ?? right.dueAt).localeCompare(left.completedAt ?? left.dueAt))[0];
      const status = occurrence ? effectivePmStatus(occurrence, fixture.asOf) : undefined;
      const work = occurrence?.workOrderId ? storeWork.find((candidate) => candidate.id === occurrence.workOrderId) : undefined;
      const source = program && (plan.cadenceDays !== program.frequencyDays || plan.completionWindowDays !== program.dueWindowDays || Boolean(plan.cadenceOverrideReason))
        ? "Store adjustment"
        : program
          ? "Company schedule"
          : "Store schedule";
      return {
        id: plan.id,
        label: plan.name,
        href: work ? `/app/work-orders/${work.id}` : roleCan(session.role, "setup_pm") ? `/app/pm/plans/${plan.id}` : `/app/pm?store=${store.id}`,
        cells: [
          { key: "plan", value: program?.name ?? plan.name, secondary: asset ? `${asset.name} · ${asset.assetTag}` : plan.name },
          { key: "timing", value: occurrence ? date(occurrence.dueAt, store.timeZone) : "Not generated", secondary: occurrence ? `${date(occurrence.windowStartsAt, store.timeZone)} – ${date(occurrence.windowEndsAt, store.timeZone)}` : `Every ${plan.cadenceDays} days` },
          { key: "status", value: status ? sentence(status) : "Schedule only", tone: status === "missed" ? "critical" : status === "due" ? "warning" : status === "completed" ? "positive" : "info" },
          { key: "evidence", value: work?.number ?? (occurrence?.completedAt ? "Completion recorded" : "No completion yet"), secondary: occurrence?.result ?? source },
        ],
      };
    });
    const allStoreWorkRows = workRows(fixture, storeScopedFixture, {});
    const openStoreWorkIds = new Set(storeWork.filter((work) => !["closed", "cancelled"].includes(work.status)).map((work) => work.id));
    const storeHistoryRows = [
      ...allStoreWorkRows.filter((row) => openStoreWorkIds.has(row.id)),
      ...allStoreWorkRows.filter((row) => !openStoreWorkIds.has(row.id)),
    ].slice(0, 12);
    const storeVisitTimeline = [...storeVisits]
      .sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt))
      .slice(0, 8)
      .map((visit) => {
        const work = visit.workOrderId ? storeWork.find((candidate) => candidate.id === visit.workOrderId) : undefined;
        const outcome = visit.outcome ? sentence(visit.outcome) : visit.status === "active" ? "Onsite now" : "Outcome not recorded";
        return {
          id: visit.id,
          title: `${visit.providerName} · ${visit.technicianName}`,
          description: `${work?.number ?? "No work order"} · ${visit.purpose} · ${outcome}`,
          timestampLabel: dateTime(visit.checkedInAt, store.timeZone),
          actorLabel: visit.status === "active" ? "Active check-in" : visit.checkedOutAt ? `Checked out ${dateTime(visit.checkedOutAt, store.timeZone)}` : "Checkout not recorded",
          tone: visit.status === "active" ? "info" as const : visit.outcome && unresolvedOutcomesForPresentation.has(visit.outcome) ? "warning" as const : "positive" as const,
          link: { href: `/app/visits/${visit.id}`, label: "Open visit" },
        };
      });
    const storeLifecycle = lifecycleRows(fixture, storeScopedFixture, recordedCostByWork(fixture, scoped.organizationId));
    const storeAssetRows: TableRowViewModel[] = storeLifecycle
      .sort((left, right) => {
        const rank = { out_of_service: 0, watch: 1, operational: 2, retired: 3 } as const;
        return rank[left.asset.status] - rank[right.asset.status] || left.asset.name.localeCompare(right.asset.name);
      })
      .map((row) => {
        const openWork = row.work.filter((work) => !["closed", "cancelled"].includes(work.status)).length;
        const age = row.ageYears === undefined
          ? "Not recorded"
          : row.asset.expectedLifeYears
            ? `${row.ageYears.toFixed(1)} of ${row.asset.expectedLifeYears} years`
            : `${row.ageYears.toFixed(1)} years`;
        return {
          id: row.asset.id,
          label: row.asset.name,
          href: `/app/equipment/${row.asset.id}`,
          cells: [
            { key: "equipment", value: row.asset.name, secondary: `${row.asset.assetTag} · ${row.asset.groupPath.at(-1) ?? sentence(row.asset.categoryKey)}` },
            { key: "area", value: sentence(row.asset.categoryKey), secondary: row.asset.groupPath.length ? row.asset.groupPath.join(" › ") : undefined },
            { key: "age", value: age, secondary: row.asset.expectedLifeYears ? "Expected life is a planning reference" : "Expected life not entered" },
            { key: "cost", value: money(costForWorkIds(rollingCostByWork, row.work.map((work) => work.id))) },
            { key: "open", value: String(openWork), tone: openWork ? "warning" : "positive" },
            { key: "status", value: row.asset.status === "out_of_service" ? "Out of service" : row.asset.status === "watch" ? "Needs review" : sentence(row.asset.status), tone: row.asset.status === "out_of_service" ? "critical" : row.asset.status === "watch" ? "warning" : row.asset.status === "operational" ? "positive" : "neutral" },
          ],
        };
      });
    const equipmentReviewCount = storeAssets.filter((asset) => asset.status === "watch" || asset.status === "out_of_service").length;
    const replacementOutlook = storeLifecycle.reduce((sum, row) => sum + (row.replacement ?? 0), 0);
    return {
      state: { kind: "ready" },
      page: { title: `Store ${store.storeNumber}`, eyebrow: store.name, description: storeAddress(store), scopeLabel: session.scopeLabel, primaryAction: roleCan(session.role, "create_work_order") ? { label: "Create work order", href: `/app/work-orders/new?store=${store.id}` } : undefined, secondaryAction: { label: "View recorded cost", href: `/app/spend?store=${store.id}` } },
      statusLabel: storeStatusLabel,
      statusTone: storeStatusTone,
      facts: [
        { label: "Open work", value: String(storeWork.filter((work) => !["closed", "cancelled"].includes(work.status)).length), link: { href: `/app/work-orders?store=${store.id}&status=open`, label: "Open work" } },
        { label: "Upcoming visits", value: String(storeUpcomingVisits.length), helperText: storeUpcomingVisits.length ? "Vendor-confirmed appointments" : "No confirmed appointments", link: { href: `/app/visits?store=${store.id}&status=upcoming`, label: "Open upcoming visits" } },
        { label: "Approved for next suitable visit", value: String(storeActiveHolds.length), helperText: storeActiveHolds.length ? "Approved work waiting for a practical opportunity" : "No work is waiting for a suitable visit", link: { href: `/app/work-orders?store=${store.id}&visitPlan=ready`, label: "Open approved work" } },
        { label: "Onsite now", value: String(storeVisits.filter((visit) => visit.status === "active").length), link: { href: `/app/visits?store=${store.id}&status=active`, label: "Open visits" } },
        { label: "Rolling 12-month cost", value: money(costForWorkIds(rollingCostByWork, storeWork.map((work) => work.id))), link: { href: `/app/spend?store=${store.id}`, label: "Explain cost" } },
        { label: "PM compliance", value: eligiblePm.length ? `${Math.round((completedPm.length / eligiblePm.length) * 100)}%` : "No closed window", helperText: eligiblePm.length ? `${completedPm.length} completed / ${eligiblePm.length} eligible occurrences` : "Future and open windows are excluded", link: { href: `/app/pm?store=${store.id}`, label: "Open PM evidence" } },
        { label: "Tracked equipment", value: String(storeAssets.length), link: { href: `/app/equipment?store=${store.id}`, label: "Open equipment" } },
        { label: "Capital review", value: String(storeAssets.filter((asset) => asset.status === "watch").length), helperText: "Human review; no automatic replacement", link: { href: `/app/lifecycle?store=${store.id}`, label: "Open lifecycle evidence" } },
      ],
      sections: [
        ...(storeUpcomingVisits.length ? [{
          id: "upcoming-visits",
          title: "Upcoming visits",
          description: "Vendor-confirmed appointments for this store, shown in the store’s local time.",
          table: { id: "store-upcoming-visits", caption: `Upcoming visits for Store ${store.storeNumber}`, columns: columns.visits, rows: storeUpcomingVisits },
          action: { label: "Open all upcoming visits", href: `/app/visits?store=${store.id}&status=upcoming` },
        }] : []),
        ...(storeActiveHolds.length ? [{
          id: "ready-to-bundle",
          title: "Approved for next suitable visit",
          description: "Group several small jobs for one vendor, or leave them available for a suitable vendor who is already onsite.",
          table: { id: "store-held-work", caption: `Approved for next suitable visit at Store ${store.storeNumber}`, columns: [{ key: "work", label: "Work order" }, { key: "category", label: "Service area" }, { key: "instruction", label: "What the vendor may do" }, { key: "review", label: "Review timing" }], rows: heldWorkRows },
          action: { label: "Send approved jobs together", href: `/app/store-sweeps/new?store=${store.id}` },
        }] : []),
        {
          id: "preventive-maintenance-plans",
          title: "Preventive maintenance",
          description: "See what is due, missed, and completed at this store. Company schedules remain the default; store adjustments stay visible and auditable.",
          facts: [
            { label: "Due now", value: String(duePm.length), link: { href: `/app/pm?store=${store.id}&status=due`, label: "Open due PM" } },
            { label: "Missed", value: String(missedPm.length), link: { href: `/app/pm?store=${store.id}&status=missed`, label: "Open missed PM" } },
            { label: "Next due", value: nextPm ? date(nextPm.dueAt, store.timeZone) : "Nothing scheduled", helperText: nextPm ? pmByPlan.get(nextPm.planId)?.name : "No future occurrence is on the calendar" },
            { label: "Last completed", value: lastCompletedPm ? date(lastCompletedPm.completedAt ?? lastCompletedPm.dueAt, store.timeZone) : "No completion recorded", helperText: lastCompletedPm ? pmByPlan.get(lastCompletedPm.planId)?.name : undefined },
          ],
          tableHeading: "Current schedule by program",
          table: {
            id: "store-pm-plans",
            caption: `Preventive maintenance schedule for Store ${store.storeNumber}`,
            columns: [
              { key: "plan", label: "Program / equipment" },
              { key: "timing", label: "Due / service window" },
              { key: "status", label: "Status" },
              { key: "evidence", label: "Work or evidence" },
            ],
            rows: pmPlanRows,
          },
          action: { label: "Open full PM record", href: `/app/pm?store=${store.id}` },
        },
        { id: "service-areas", title: "Service areas and spending", description: "See where this store is spending money, where work remains open, and whether preventive maintenance is current.", table: { id: "store-service-areas", caption: `Service areas and spending for Store ${store.storeNumber}`, columns: [{ key: "area", label: "Service area" }, { key: "cost", label: "12-month cost", align: "end" }, { key: "open", label: "Open work", align: "end" }, { key: "pm", label: "PM" }, { key: "status", label: "Current signal" }], rows: serviceAreaRows } },
        {
          id: "equipment",
          title: "Equipment and lifecycle",
          description: "Review every tracked equipment record at this store, including age context, recorded cost, open work, and operating state.",
          facts: [
            { label: "Tracked equipment", value: String(storeAssets.length), link: { href: `/app/equipment?store=${store.id}`, label: "Open all equipment" } },
            { label: "Needs review", value: String(equipmentReviewCount), helperText: "Includes equipment marked for review or out of service", link: { href: `/app/lifecycle?store=${store.id}`, label: "Open lifecycle review" } },
            { label: "Out of service", value: String(storeAssets.filter((asset) => asset.status === "out_of_service").length), link: { href: `/app/equipment?store=${store.id}&status=out_of_service`, label: "Open out-of-service equipment" } },
            { label: "Replacement outlook", value: replacementOutlook ? money(replacementOutlook) : "Not entered", helperText: "Current planning estimates; not an approved budget", link: { href: `/app/lifecycle?store=${store.id}`, label: "Open replacement evidence" } },
          ],
          tableHeading: "All equipment at this store",
          table: { id: "store-equipment", caption: `Equipment and lifecycle for Store ${store.storeNumber}`, columns: [{ key: "equipment", label: "Equipment" }, { key: "area", label: "Service area" }, { key: "age", label: "Age / expected life" }, { key: "cost", label: "12-month cost", align: "end" }, { key: "open", label: "Open work", align: "end" }, { key: "status", label: "Operating state" }], rows: storeAssetRows },
          action: { label: "Open equipment workspace", href: `/app/equipment?store=${store.id}` },
        },
        {
          id: "work-history",
          title: "Work and visit history",
          description: "Open current work first, then use observed visit records to confirm who came onsite, when they were there, and what outcome they recorded.",
          facts: [
            { label: "Work orders", value: String(storeWork.length), link: { href: `/app/work-orders?store=${store.id}`, label: "Open all work orders" } },
            { label: "Open work", value: String(openStoreWorkIds.size), link: { href: `/app/work-orders?store=${store.id}&status=open`, label: "Open current work" } },
            { label: "Recorded visits", value: String(storeVisits.length), link: { href: `/app/visits?store=${store.id}`, label: "Open all visits" } },
            { label: "Visits without a work order", value: String(storeVisits.filter((visit) => !visit.workOrderId).length), helperText: "Reviewable onsite evidence; not hidden from history", link: { href: `/app/visits?store=${store.id}&review=true`, label: "Review unmatched visits" } },
          ],
          tableHeading: "Current and recent work orders",
          table: { id: "store-work", caption: `Current and recent work orders for Store ${store.storeNumber}`, columns: columns["work-orders"], rows: storeHistoryRows },
          timelineHeading: "Latest observed visits",
          timeline: storeVisitTimeline,
          action: { label: "Open full work history", href: `/app/work-orders?store=${store.id}` },
        },
      ],
      backLink: { label: "Back to stores", href: "/app/stores" },
    };
  }

  const vendor = fixture.vendors.find((item) => item.id === id && item.organizationId === scoped.organizationId);
  if (!vendor) return missingDetail("Vendor", "/app/vendors");
  const assignments = fixture.assignments.filter((assignment) => assignment.organizationId === scoped.organizationId && assignment.vendorId === vendor.id);
  const workIds = new Set(assignments.map((assignment) => assignment.workOrderId));
  const vendorWork = scoped.workOrders.filter((work) => workIds.has(work.id));
  const vendorVisits = scoped.visits.filter((visit) => visit.vendorId === vendor.id);
  const specialties = fixture.vendorSpecialties.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
  const vendorResponses = fixture.vendorResponses
    .filter((response) => response.organizationId === scoped.organizationId && workIds.has(response.workOrderId))
    .sort((left, right) => right.respondedAt.localeCompare(left.respondedAt));
  const issuanceById = new Map(fixture.issuances.filter((item) => item.organizationId === scoped.organizationId).map((item) => [item.id, item]));
  const responseHours = vendorResponses
    .map((response) => {
      const issuance = issuanceById.get(response.issuanceId);
      return issuance ? (Date.parse(response.respondedAt) - Date.parse(issuance.issuedAt)) / 3_600_000 : undefined;
    })
    .filter((hours): hours is number => hours !== undefined && Number.isFinite(hours) && hours >= 0);
  const terminalResponses = vendorResponses.filter((response) => response.response === "accepted" || response.response === "declined");
  const acceptedResponses = terminalResponses.filter((response) => response.response === "accepted");
  const checkedOutVisits = vendorVisits.filter((visit) => visit.status !== "active");
  const visitCountsByWork = new Map<string, number>();
  for (const visit of vendorVisits) if (visit.workOrderId) visitCountsByWork.set(visit.workOrderId, (visitCountsByWork.get(visit.workOrderId) ?? 0) + 1);
  const returnVisitWork = [...visitCountsByWork.values()].filter((count) => count > 1).length;
  const unresolvedVisits = checkedOutVisits.filter((visit) => visit.outcome && unresolvedOutcomesForPresentation.has(visit.outcome));
  const vendorExceptions = fixture.exceptions
    .filter((exception) => exception.organizationId === scoped.organizationId && exception.vendorId === vendor.id && exception.status !== "resolved")
    .sort((left, right) => right.detectedAt.localeCompare(left.detectedAt));
  const vendorFollowUps = fixture.followUps
    .filter((followUp) => followUp.organizationId === scoped.organizationId && followUp.status === "open" && workIds.has(followUp.workOrderId))
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  const coverage = fixture.vendorCoverage.filter((item) => item.organizationId === scoped.organizationId && item.vendorId === vendor.id);
  const workById = new Map(vendorWork.map((work) => [work.id, work]));
  const storeById = new Map(scoped.stores.map((store) => [store.id, store]));
  const averageResponseHours = responseHours.length ? responseHours.reduce((total, hours) => total + hours, 0) / responseHours.length : undefined;
  const responseHistoryRows: TableRowViewModel[] = vendorResponses.slice(0, 12).map((response) => {
    const work = workById.get(response.workOrderId);
    const store = work ? storeById.get(work.storeId) : undefined;
    return {
      id: response.id,
      label: `${sentence(response.response)} - ${work?.number ?? "Work order"}`,
      href: work ? `/app/work-orders/${work.id}` : `/app/vendors/${vendor.id}`,
      cells: [
        { key: "response", value: sentence(response.response), secondary: response.message ?? (response.proposedAt ? `Proposed ${dateTime(response.proposedAt, store?.timeZone)}` : undefined), tone: response.response === "accepted" ? "positive" : response.response === "declined" ? "critical" : "warning" },
        { key: "work", value: work?.number ?? "Unknown work", secondary: work?.problem },
        { key: "store", value: storeLabel(store) },
        { key: "responder", value: response.responderName },
        { key: "time", value: dateTime(response.respondedAt, store?.timeZone) },
      ],
    };
  });
  const accountabilityRows: TableRowViewModel[] = [
    ...vendorExceptions.map<TableRowViewModel>((exception) => ({
      id: exception.id,
      label: exception.summary,
      href: `/app/action-center/${exception.id}`,
      cells: [
        { key: "item", value: exception.summary, secondary: sentence(exception.kind) },
        { key: "work", value: exception.workOrderId ? workById.get(exception.workOrderId)?.number ?? "Linked work" : "Visit evidence" },
        { key: "owner", value: "Facilities coordinator" },
        { key: "due", value: exception.severity === "urgent" ? "Review now" : "Needs review" },
        { key: "status", value: sentence(exception.status), tone: exception.severity === "urgent" ? "critical" : "warning" },
      ],
    })),
    ...vendorFollowUps.map<TableRowViewModel>((followUp) => ({
      id: followUp.id,
      label: followUp.nextAction,
      href: `/app/action-center/${followUp.id}`,
      cells: [
        { key: "item", value: followUp.nextAction, secondary: "Accountable follow-up" },
        { key: "work", value: workById.get(followUp.workOrderId)?.number ?? "Linked work" },
        { key: "owner", value: followUp.accountableParty },
        { key: "due", value: dateTime(followUp.dueAt, storeById.get(workById.get(followUp.workOrderId)?.storeId ?? "")?.timeZone) },
        { key: "status", value: Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "Overdue" : "Open", tone: Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "critical" : "warning" },
      ],
    })),
  ];
  return {
    state: { kind: "ready" },
    page: { title: vendor.name, eyebrow: vendor.preferred ? "Preferred approved vendor" : "Approved vendor", description: specialties.map((item) => item.displayName).join(" · "), scopeLabel: session.scopeLabel, primaryAction: roleCan(session.role, "create_work_order") ? { label: "Create work order", href: `/app/work-orders/new?vendor=${vendor.id}` } : undefined },
    statusLabel: sentence(vendor.status),
    statusTone: vendor.status === "approved" ? "positive" : "warning",
    facts: [
      { label: "Dispatch", value: vendor.dispatchEmail, helperText: vendor.dispatchPhone },
      { label: "Open work", value: String(vendorWork.filter((work) => !["closed", "cancelled"].includes(work.status)).length) },
      { label: "Onsite now", value: String(vendorVisits.filter((visit) => visit.status === "active").length), link: { href: `/app/visits?vendor=${vendor.id}&status=active`, label: "Open active visits" } },
      { label: "Recorded visits", value: String(vendorVisits.length), helperText: `${returnVisitWork} work order${returnVisitWork === 1 ? "" : "s"} required more than one visit`, link: { href: `/app/visits?vendor=${vendor.id}`, label: "Open visit records" } },
      { label: "Response time", value: averageResponseHours === undefined ? "Not enough history" : averageResponseHours < 1 ? `${Math.round(averageResponseHours * 60)} min average` : `${averageResponseHours.toFixed(1)} hr average`, helperText: `${responseHours.length} issuance-to-response observation${responseHours.length === 1 ? "" : "s"}` },
      { label: "Accepted authorizations", value: terminalResponses.length ? `${Math.round((acceptedResponses.length / terminalResponses.length) * 100)}%` : "No terminal responses", helperText: terminalResponses.length ? `${acceptedResponses.length} accepted / ${terminalResponses.length} accepted or declined` : "Questions and proposed dates are not counted" },
      { label: "Open items", value: String(vendorExceptions.length + vendorFollowUps.length), helperText: `${vendorExceptions.length} exception${vendorExceptions.length === 1 ? "" : "s"} · ${vendorFollowUps.length} follow-up${vendorFollowUps.length === 1 ? "" : "s"}`, link: vendorExceptions.length + vendorFollowUps.length ? { href: "/app/action-center", label: "See what needs attention" } : undefined },
      { label: "Recorded work cost", value: money(costForWorkIds(costByWork, vendorWork.map((work) => work.id))) },
    ],
    sections: [
      { id: "accountability", title: "Needs attention", description: accountabilityRows.length ? "Every open item leads to the work, evidence, or follow-up that needs a person." : "This vendor has no unresolved exceptions or follow-ups in this view.", table: { id: "vendor-accountability", caption: `Open items for ${vendor.name}`, columns: [{ key: "item", label: "What needs attention" }, { key: "work", label: "Work order" }, { key: "owner", label: "Owner" }, { key: "due", label: "Due" }, { key: "status", label: "Status" }], rows: accountabilityRows } },
      { id: "response-history", title: "Authorization response history", description: "Acceptance, declines, proposed dates, and questions remain attributed to the exact authorization and work record.", table: { id: "vendor-responses", caption: `Vendor responses from ${vendor.name}`, columns: [{ key: "response", label: "Response" }, { key: "work", label: "Work order" }, { key: "store", label: "Store" }, { key: "responder", label: "Responder" }, { key: "time", label: "Recorded" }], rows: responseHistoryRows } },
      { id: "coverage", title: "Specialties & coverage", description: `${coverage.length} approved coverage relationship${coverage.length === 1 ? "" : "s"}. Search aliases help operators find the vendor in plain language.`, facts: [
        ...specialties.map((specialty) => ({ label: specialty.displayName, value: specialty.searchAliases.join(", ") || "No search aliases" })),
        ...coverage.map((item, index) => ({ label: index === 0 ? "Service coverage" : `Coverage ${index + 1}`, value: item.scopeKind === "organization" ? `All ${scoped.stores.length} stores` : item.scopeKind === "region" ? fixture.regions.find((region) => region.id === item.scopeId)?.name ?? "Selected region" : storeLabel(storeById.get(item.scopeId)) })),
      ] },
      { id: "work", title: "Issued work", table: { id: "vendor-work", caption: `Work assigned to ${vendor.name}`, columns: columns["work-orders"], rows: workRows(fixture, { ...scoped, workOrders: vendorWork }, {}) } },
      { id: "visits", title: "Observed service visits", description: `${checkedOutVisits.length} completed observations - ${unresolvedVisits.length} recorded unresolved outcome${unresolvedVisits.length === 1 ? "" : "s"}. Presence, outcomes, and exceptions are facts, not a black-box score.`, table: { id: "vendor-visits", caption: `Visits by ${vendor.name}`, columns: columns.visits, rows: visitRows(fixture, { ...scoped, visits: vendorVisits }, {}) } },
    ],
    backLink: { label: "Back to vendors", href: "/app/vendors" },
  };
}

function missingDetail(label: string, href: string): DetailPageViewModel {
  return {
    state: { kind: "error", title: `${label} not available`, message: "This record does not exist or is outside your authorized operating scope." },
    page: { title: label, description: "The requested source record is unavailable.", scopeLabel: "Authorized scope" },
    statusLabel: "Unavailable",
    facts: [],
    sections: [],
    backLink: { label: `Back to ${label === "Equipment" ? "equipment" : `${label.toLocaleLowerCase("en-US")}s`}`, href },
  };
}

function storesAsOptions(scoped: ScopedFixture) {
  return scoped.stores.map((store) => ({ value: store.id, label: `Store ${store.storeNumber} · ${store.name}`, description: storeAddress(store) }));
}

export function buildCreateRequestModel(fixture: OpsFixture, session: OperatorSession): CreateRequestPageViewModel {
  const scoped = scopeFixture(fixture, session);
  return {
    state: { kind: "ready" },
    page: { title: "Report an issue", eyebrow: "Issue intake", description: "Capture what the store can observe. A store and plain-language problem are enough to begin review.", scopeLabel: `${session.scopeLabel} · Requests remain visible after submission` },
    submitAction: "/api/ops/requests",
    cancelLink: { label: "Back to requests", href: "/app/requests" },
    stores: storesAsOptions(scoped),
    priorityOptions: [
      { value: "routine", label: "Routine", description: "Normal service need" },
      { value: "urgent", label: "Urgent", description: "Material operating impact" },
      { value: "emergency", label: "Emergency", description: "Immediate safety, fuel, food-safety, or major operating impact" },
    ],
  };
}

export function buildCreateWorkOrderModel(
  fixture: OpsFixture,
  session: OperatorSession,
  query: OperatorSearchParameters = {},
): CreateWorkOrderPageViewModel {
  const scoped = scopeFixture(fixture, session);
  const vendors = fixture.vendors.filter((vendor) => vendor.organizationId === scoped.organizationId && vendor.status === "approved");
  const internal = fixture.memberships.filter((membership) => membership.organizationId === scoped.organizationId && membership.role === "internal_technician" && membership.status === "active");
  const userById = new Map(fixture.users.map((user) => [user.id, user]));
  const requestedRequestId = first(query.request);
  const sourceRequest = requestedRequestId
    ? fixture.requests.find(
        (request) =>
          request.id === requestedRequestId &&
          request.organizationId === scoped.organizationId &&
          scoped.storeIds.has(request.storeId) &&
          request.status !== "closed",
      )
    : undefined;
  const requestedAssetId = first(query.asset);
  const requestedAsset = requestedAssetId
    ? scoped.assets.find((asset) => asset.id === requestedAssetId)
    : undefined;
  const requestedStoreId = first(query.store);
  const requestedStore = requestedStoreId && scoped.storeIds.has(requestedStoreId)
    ? requestedStoreId
    : undefined;
  const requestedPmOccurrenceId = first(query.pmOccurrence);
  const sourcePmOccurrence = requestedPmOccurrenceId
    ? fixture.pmOccurrences.find((occurrence) =>
        occurrence.id === requestedPmOccurrenceId
        && occurrence.organizationId === scoped.organizationId
        && scoped.storeIds.has(occurrence.storeId)
        && !occurrence.workOrderId
        && ["due", "missed", "scheduled", "proposed"].includes(occurrence.status),
      )
    : undefined;
  const sourcePmPlan = sourcePmOccurrence
    ? fixture.pmPlans.find((plan) => plan.organizationId === scoped.organizationId && plan.id === sourcePmOccurrence.planId)
    : undefined;
  const sourcePmProgram = sourcePmOccurrence?.programId
    ? fixture.maintenancePrograms.find((program) => program.organizationId === scoped.organizationId && program.id === sourcePmOccurrence.programId)
    : undefined;
  const sourceExceptionId = first(query.sourceException);
  const sourceException = sourceExceptionId
    ? fixture.exceptions.find((exception) => (
        exception.id === sourceExceptionId
        && exception.organizationId === scoped.organizationId
        && exception.kind === "no_work_order"
        && exception.status !== "resolved"
        && exception.visitId
      ))
    : undefined;
  const sourceVisit = sourceException?.visitId
    ? scoped.visits.find((visit) => visit.id === sourceException.visitId && !visit.workOrderId)
    : undefined;
  const sourceRequestTimeZone = sourceRequest
    ? scoped.stores.find((store) => store.id === sourceRequest.storeId)?.timeZone
    : undefined;
  const sourceVisitTimeZone = sourceVisit
    ? scoped.stores.find((store) => store.id === sourceVisit.storeId)?.timeZone
    : undefined;
  return {
    state: { kind: "ready" },
    page: sourceVisit ? {
      title: "Create work order from visit",
      eyebrow: "After-the-fact service record",
      description: "Use the observed check-in to document work that began after a phone call, verbal dispatch, or missing work-order number.",
      scopeLabel: `${session.scopeLabel} · The original check-in time stays unchanged and no prior written authorization is implied`,
    } : sourcePmOccurrence ? {
      title: "Create PM work order",
      eyebrow: "Preventive maintenance",
      description: "Create the canonical service record for this scheduled maintenance occurrence, then choose who will perform it.",
      scopeLabel: `${session.scopeLabel} · PM occurrence, work order, visit, and outcome remain linked`,
    } : { title: "Create work order", eyebrow: "Service control", description: "Create the canonical record now; assign, classify, and add equipment detail only when it is useful and known.", scopeLabel: `${session.scopeLabel} · Store and problem are the only required work facts` },
    submitAction: "/api/ops/work-orders",
    cancelLink: sourceVisit
      ? { label: "Back to service visit", href: `/app/visits/${encodeURIComponent(sourceVisit.id)}` }
      : { label: "Back to work orders", href: "/app/work-orders" },
    stores: storesAsOptions(scoped),
    vendors: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name, description: fixture.vendorSpecialties.filter((item) => item.vendorId === vendor.id && item.organizationId === scoped.organizationId).flatMap((item) => [item.displayName, ...item.searchAliases]).join(", ") })),
    internalAssignees: internal.map((membership) => ({ value: membership.id, label: userById.get(membership.userId)?.displayName ?? "Internal technician" })),
    priorityOptions: [
      { value: "routine", label: "Routine" },
      { value: "urgent", label: "Urgent" },
      { value: "emergency", label: "Emergency" },
      { value: "planned", label: "Planned / preventive" },
    ],
    categories: [...new Set(scoped.assets.map((asset) => asset.categoryKey).concat(scoped.workOrders.map((work) => work.categoryKey ?? "")).filter(Boolean))].sort().map((category) => ({ value: category, label: sentence(category) })),
    assetLifecycleInputs: scoped.assets.map((asset) => ({
      id: asset.id,
      organizationId: asset.organizationId,
      storeId: asset.storeId,
      label: `${asset.name} · ${asset.assetTag}`,
      description: `${storeLabel(scoped.stores.find((store) => store.id === asset.storeId))} · ${assetHierarchyPath(asset).join(" › ")}`,
      installedAt: asset.installedAt,
      expectedLifeYears: asset.expectedLifeYears,
      replacementEstimate: asset.replacementEstimate,
    })),
    lifecycleAsOf: fixture.asOf,
    defaults: requestedAsset || requestedStore || sourceVisit || sourcePmOccurrence ? {
      storeId: sourceRequest?.storeId ?? sourceVisit?.storeId ?? sourcePmOccurrence?.storeId ?? requestedAsset?.storeId ?? requestedStore,
      assetId: sourcePmOccurrence?.assetId ?? requestedAsset?.id,
      categoryKey: sourcePmProgram?.tradeKey ?? requestedAsset?.categoryKey,
      ...(sourcePmOccurrence ? {
        problem: sourcePmProgram?.name ?? sourcePmPlan?.name ?? "Complete scheduled preventive maintenance",
        priority: "planned" as const,
        assignmentKind: "choose_later" as const,
      } : {}),
      ...(sourceVisit ? {
        problem: sourceVisit.purpose,
        priority: "routine" as const,
        assignmentKind: sourceVisit.providerKind === "outside_vendor" ? "outside_vendor" as const : sourceVisit.providerKind === "internal" ? "internal" as const : "choose_later" as const,
        vendorId: sourceVisit.vendorId,
        internalMembershipId: sourceVisit.internalMembershipId,
      } : {}),
    } : undefined,
    sourceRequest: sourceRequest ? {
      id: sourceRequest.id,
      reference: sourceRequest.reference,
      storeId: sourceRequest.storeId,
      problem: sourceRequest.problem,
      reporterName: sourceRequest.reporterName,
      submittedLabel: `on ${dateTime(sourceRequest.submittedAt, sourceRequestTimeZone)}`,
    } : undefined,
    sourceVisit: sourceVisit && sourceException ? {
      exceptionId: sourceException.id,
      visitId: sourceVisit.id,
      technicianName: sourceVisit.technicianName,
      providerName: sourceVisit.providerName,
      checkedInLabel: dateTime(sourceVisit.checkedInAt, sourceVisitTimeZone),
      checkedOutLabel: sourceVisit.checkedOutAt ? dateTime(sourceVisit.checkedOutAt, sourceVisitTimeZone) : undefined,
      unmatchedReason: sourceVisit.unmatchedReason ?? "No operator work order was provided at check-in",
      outcomeLabel: sourceVisit.outcome ? sentence(sourceVisit.outcome) : undefined,
      outcomeNotes: sourceVisit.outcomeNotes,
    } : undefined,
    sourcePm: sourcePmOccurrence ? {
      occurrenceId: sourcePmOccurrence.id,
      planName: sourcePmProgram?.name ?? sourcePmPlan?.name ?? "scheduled preventive maintenance",
      dueLabel: date(sourcePmOccurrence.dueAt),
      statusLabel: sentence(sourcePmOccurrence.status),
    } : undefined,
  };
}

export function buildCreateStoreModel(fixture: OpsFixture, session: OperatorSession): CreateStorePageViewModel {
  const organizationTimeZone = fixture.organizations.find((organization) => organization.id === session.organizationId)?.timeZone ?? DEFAULT_OPERATIONS_TIME_ZONE;
  return {
    state: { kind: "ready" },
    page: { title: "Add a store", eyebrow: "Network setup", description: "Create the location first, then add equipment, PM, and deeper classification only where it creates value.", scopeLabel: session.scopeLabel },
    submitAction: "/api/ops/stores",
    cancelLink: { label: "Back to stores", href: "/app/stores" },
    regions: fixture.regions.filter((region) => region.organizationId === session.organizationId).map((region) => ({ value: region.id, label: region.name, description: region.code })),
    timeZones: [{ value: "America/New_York", label: "Eastern time" }, { value: "America/Chicago", label: "Central time" }, { value: "America/Denver", label: "Mountain time" }, { value: "America/Los_Angeles", label: "Pacific time" }],
    defaultTimeZone: organizationTimeZone,
  };
}

export function buildCreateVendorModel(fixture: OpsFixture, session: OperatorSession): CreateVendorPageViewModel {
  const specialtyNames = new Map(fixture.vendorSpecialties.filter((item) => item.organizationId === session.organizationId).map((item) => [item.canonicalKey, item.displayName]));
  return {
    state: { kind: "ready" },
    page: { title: "Add an approved vendor", eyebrow: "Vendor onboarding", description: "Add dispatch details, searchable specialties, and service coverage. A portal account is optional.", scopeLabel: session.scopeLabel },
    submitAction: "/api/ops/vendors",
    cancelLink: { label: "Back to vendors", href: "/app/vendors" },
    specialties: [...specialtyNames.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    coverageScopes: [{ value: session.organizationId, label: "All stores", description: "Companywide coverage" }, ...fixture.regions.filter((region) => region.organizationId === session.organizationId).map((region) => ({ value: region.id, label: region.name, description: "Regional coverage" }))],
  };
}

export function buildVendorIssuanceModel(fixture: OpsFixture, session: OperatorSession, workOrderId: string): VendorIssuanceViewModel {
  const scoped = scopeFixture(fixture, session);
  const work = scoped.workOrders.find((item) => item.id === workOrderId);
  const assignment = work ? assignmentForWork(fixture, scoped.organizationId, work.id) : undefined;
  const revisions = fixture.issuances.filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === workOrderId);
  const estimateRequests = (fixture.estimateRequests ?? []).filter((item) => (
    item.organizationId === scoped.organizationId && item.workOrderId === workOrderId
  ));
  const selectedEstimate = estimateRequests.find((item) => (
    item.organizationId === scoped.organizationId && item.workOrderId === workOrderId && item.status === "selected"
  ));
  const workflowBlocked = !selectedEstimate && estimateRequests.some((item) => (
    ["requested", "opened", "submitted"].includes(item.status)
  ));
  const workflowBlockMessage = workflowBlocked
    ? "Bid sourcing is still open. Select a bid for service authorization, or withdraw every open bid request before sending service directly to a vendor."
    : undefined;
  const selectedEstimateVendor = selectedEstimate
    ? fixture.vendors.find((vendor) => vendor.organizationId === scoped.organizationId && vendor.id === selectedEstimate.vendorId)
    : undefined;
  const available = Boolean(
    work &&
    (canRouteAndIssueWorkOrder(work.status) || workflowBlocked) &&
    assignment?.kind !== "internal" &&
    (!assignment || !["completed", "cancelled", "superseded"].includes(assignment.status)),
  );
  const rolePermitted = Boolean(work && roleCan(session.role, "issue_work_order"));
  const previewDeliveryText = "A secure response link is always generated. When email delivery is configured in Setup, choosing email sends it to the vendor dispatch address; otherwise the link remains available for manual sharing. SMS requires a later integration.";
  return {
    available,
    permitted: available && rolePermitted,
    rolePermitted,
    workflowBlocked,
    workflowBlockMessage,
    submitAction: `/api/ops/work-orders/${encodeURIComponent(workOrderId)}/issue`,
    workOrderId,
    workOrderNumber: work?.number ?? workOrderId,
    assignmentKind: assignment?.kind ?? "choose_later",
    selectedVendorId: selectedEstimate?.vendorId ?? (assignment?.status === "declined" ? undefined : assignment?.vendorId),
    vendorSelectionLocked: Boolean(selectedEstimate),
    vendors: fixture.vendors
      .filter((vendor) => (
        vendor.organizationId === scoped.organizationId
        && vendor.status === "approved"
        && (!selectedEstimate || vendor.id === selectedEstimate.vendorId)
      ))
      .map((vendor) => ({ value: vendor.id, label: vendor.name })),
    channels: [{ value: "email", label: "Generate email-ready link" }, { value: "sms", label: "Generate SMS-ready link" }, { value: "print", label: "Print / PDF handoff" }, { value: "manual", label: "Record phone or manual handoff" }],
    currentRevision: revisions.length ? Math.max(...revisions.map((item) => item.revision)) : 0,
    helperText: workflowBlocked
      ? "Service issuance is paused while vendor bid requests remain open."
      : selectedEstimate
      ? `${selectedEstimateVendor?.name ?? "The selected vendor"} is locked to this service authorization because its bid was deliberately selected. The bid remains pricing evidence and does not become recorded cost. ${previewDeliveryText}`
      : assignment?.status === "declined"
        ? `The prior vendor declined the service work. Choose another approved vendor and create a new immutable service-authorization revision. ${previewDeliveryText}`
        : `Send authorized service work to one chosen vendor. This creates an immutable service-authorization revision and account-free response link—not a bid request. ${previewDeliveryText}`,
  };
}

export function buildEstimateComparisonModel(
  fixture: OpsFixture,
  session: OperatorSession,
  workOrderId: string,
): EstimateComparisonViewModel {
  const scoped = scopeFixture(fixture, session);
  const work = scoped.workOrders.find((item) => item.id === workOrderId);
  const estimateRequests = (fixture.estimateRequests ?? [])
    .filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === workOrderId)
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id));
  const selectedEstimate = estimateRequests.find((request) => request.status === "selected");
  const assignment = work ? assignmentForWork(fixture, scoped.organizationId, work.id) : undefined;
  const workflowBlocked = Boolean(
    work
    && assignment?.kind === "outside_vendor"
    && ["issued", "opened", "accepted"].includes(assignment.status)
    && fixture.issuances.some((issuance) => (
      issuance.organizationId === scoped.organizationId
      && issuance.workOrderId === work.id
      && issuance.assignmentId === assignment.id
    )),
  );
  const workflowBlockMessage = workflowBlocked
    ? "Authorized outside service is active. That service authorization must be cancelled or declined before you can source vendor bids."
    : undefined;
  const hasActiveVisit = Boolean(work && fixture.visits.some((visit) => (
    visit.organizationId === scoped.organizationId && visit.workOrderId === work.id && visit.status === "active"
  )));
  const canManage = Boolean(
    work &&
    !["in_progress", "completed_pending_review", "resolved", "closed", "cancelled"].includes(work.status) &&
    !hasActiveVisit,
  );
  const requestVendorIds = new Set(
    estimateRequests
      .filter((request) => ["requested", "opened", "submitted"].includes(request.status))
      .map((request) => request.vendorId),
  );
  const coveredVendorIds = new Set(
    work
      ? fixture.vendorCoverage
          .filter((coverage) => {
            if (coverage.organizationId !== scoped.organizationId) return false;
            if (coverage.scopeKind === "organization") return coverage.scopeId === scoped.organizationId;
            if (coverage.scopeKind === "store") return coverage.scopeId === work.storeId;
            const store = fixture.stores.find((item) => item.organizationId === scoped.organizationId && item.id === work.storeId);
            return coverage.scopeKind === "region" && coverage.scopeId === store?.regionId;
          })
          .map((coverage) => coverage.vendorId)
      : [],
  );
  const rolePermitted = Boolean(
    work
    && roleCan(session.role, "request_estimate")
    && roleCan(session.role, "select_estimate"),
  );
  const permitted = canManage && rolePermitted;
  const statusLabels = {
    requested: "Link generated",
    opened: "Opened by vendor",
    submitted: "Bid received",
    declined: "Vendor declined",
    expired: "Expired",
    withdrawn: "Withdrawn",
    selected: "Selected",
    not_selected: "Not selected",
  } as const;

  const requests = estimateRequests.map((request) => {
    const vendor = fixture.vendors.find((item) => item.organizationId === scoped.organizationId && item.id === request.vendorId);
    const proposal = (fixture.estimateProposals ?? [])
      .filter((item) => item.organizationId === scoped.organizationId && item.requestId === request.id)
      .sort((left, right) => right.revision - left.revision || right.submittedAt.localeCompare(left.submittedAt))[0];
    const proposalExpiresAt = proposal?.validUntil ? Date.parse(proposal.validUntil) : Number.NaN;
    const proposalExpired = Boolean(
      proposal
      && ["submitted", "not_selected"].includes(request.status)
      && Number.isFinite(proposalExpiresAt)
      && proposalExpiresAt <= Date.parse(fixture.asOf),
    );
    const responseDeadlineExpired = Boolean(
      request.dueAt
      && ["requested", "opened"].includes(request.status)
      && Date.parse(request.dueAt) <= Date.parse(fixture.asOf),
    );
    const presentedStatus = responseDeadlineExpired || proposalExpired ? "expired" as const : request.status;
    return {
      id: request.id,
      vendorId: request.vendorId,
      vendorName: vendor?.name ?? "Unknown vendor",
      decisionKind: request.decisionKind,
      kindLabel: request.decisionKind === "replacement_quote"
        ? "Replacement quote - capital pricing only"
        : request.kind === "diagnostic_and_estimate"
          ? "Bid request - onsite diagnosis requires separate authorization"
          : "Service bid - pricing only",
      requestedScope: request.requestedScope,
      status: presentedStatus,
      statusLabel: statusLabels[presentedStatus],
      requestedLabel: dateTime(request.requestedAt),
      dueLabel: request.dueAt ? dateTime(request.dueAt) : undefined,
      openedLabel: request.openedAt ? dateTime(request.openedAt) : undefined,
      respondedLabel: request.respondedAt ? dateTime(request.respondedAt) : proposal ? dateTime(proposal.submittedAt) : undefined,
      decisionLabel: request.decisionAt ? `${statusLabels[request.status]} ${dateTime(request.decisionAt)}` : undefined,
      latestProposal: proposal ? {
        id: proposal.id,
        revision: proposal.revision,
        amountLabel: estimateMoney(proposal.amount.amountMinor, proposal.amount.currency),
        scope: proposal.scope,
        exclusions: proposal.exclusions,
        leadTimeLabel: proposal.leadTimeDays === undefined ? undefined : `${proposal.leadTimeDays} day${proposal.leadTimeDays === 1 ? "" : "s"}`,
        validUntilLabel: proposal.validUntil ? date(proposal.validUntil) : undefined,
        submittedLabel: dateTime(proposal.submittedAt),
      } : undefined,
      canSelect: Boolean(permitted && !selectedEstimate && !proposalExpired && ["submitted", "not_selected"].includes(request.status) && proposal),
      canWithdraw: Boolean(permitted && !selectedEstimate && ["requested", "opened", "submitted"].includes(request.status)),
      canReopen: Boolean(permitted && request.status === "selected" && proposal && (!assignment || assignment.status === "pending")),
      decisionAction: `/api/ops/work-orders/${encodeURIComponent(workOrderId)}/estimates/${encodeURIComponent(request.id)}`,
    };
  });
  const selected = requests.find((request) => request.status === "selected");

  return {
    available: Boolean(work),
    permitted,
    rolePermitted,
    workflowBlocked,
    workflowBlockMessage,
    workOrderId,
    workOrderNumber: work?.number ?? workOrderId,
    submitAction: `/api/ops/work-orders/${encodeURIComponent(workOrderId)}/estimates`,
    defaultRequestedScope: work?.authorizedScope ?? work?.problem ?? "",
    vendors: fixture.vendors
      .filter((vendor) => (
        vendor.organizationId === scoped.organizationId &&
        vendor.status === "approved" &&
        coveredVendorIds.has(vendor.id) &&
        (!work?.categoryKey || fixture.vendorSpecialties.some((specialty) => (
          specialty.organizationId === scoped.organizationId
          && specialty.vendorId === vendor.id
          && specialty.canonicalKey === work.categoryKey
        ))) &&
        !requestVendorIds.has(vendor.id) &&
        vendor.id !== assignment?.vendorId
      ))
      .sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.name.localeCompare(right.name))
      .map((vendor) => ({
        value: vendor.id,
        label: vendor.name,
        description: fixture.vendorSpecialties
          .filter((specialty) => specialty.organizationId === scoped.organizationId && specialty.vendorId === vendor.id)
          .map((specialty) => specialty.displayName)
          .join(", "),
      })),
    requests,
    selectedVendorName: selected?.vendorName,
    selectedDecisionKind: estimateRequests.find((request) => request.status === "selected")?.decisionKind ?? "service_bid",
    comparisonClosed: Boolean(selected),
    activeRequestCount: requests.filter((request) => ["requested", "opened", "submitted"].includes(request.status)).length,
    proposalCount: requests.filter((request) => Boolean(request.latestProposal)).length,
  };
}

function providerLabelForAssignment(fixture: OpsFixture, organizationId: string, assignment: ReturnType<typeof assignmentForWork>) {
  if (!assignment) return "Not routed";
  if (assignment.kind === "choose_later") return "Provider to be chosen";
  if (assignment.kind === "outside_vendor") return vendorName(fixture, organizationId, assignment.vendorId) ?? "Outside vendor";
  const membership = fixture.memberships.find((item) => item.organizationId === organizationId && item.id === assignment.internalMembershipId);
  return fixture.users.find((user) => user.id === membership?.userId)?.displayName ?? "Internal maintenance";
}

function workOrderStages(
  fixture: OpsFixture,
  organizationId: string,
  work: WorkOrder,
): WorkOrderControlViewModel["stages"] {
  const storeTimeZone = fixture.stores.find((store) => store.organizationId === organizationId && store.id === work.storeId)?.timeZone
    ?? fixture.organizations.find((organization) => organization.id === organizationId)?.timeZone
    ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const assignment = assignmentForWork(fixture, organizationId, work.id);
  const issuances = fixture.issuances
    .filter((item) => item.organizationId === organizationId && item.workOrderId === work.id)
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
  const responses = fixture.vendorResponses
    .filter((item) => item.organizationId === organizationId && item.workOrderId === work.id && (!issuances[0] || item.issuanceId === issuances[0].id))
    .sort((left, right) => right.respondedAt.localeCompare(left.respondedAt));
  const visits = fixture.visits
    .filter((item) => item.organizationId === organizationId && item.workOrderId === work.id)
    .sort((left, right) => right.checkedInAt.localeCompare(left.checkedInAt));
  const latestVisit = visits[0];
  const authorizationOpened = fixture.auditEvents
    .filter((item) => item.organizationId === organizationId && item.aggregateId === work.id && item.eventType === "service_authorization.opened")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  const openFollowUps = fixture.followUps.filter(
    (item) => item.organizationId === organizationId && item.workOrderId === work.id && item.status === "open",
  );
  const terminal = work.status === "closed" || work.status === "cancelled";
  const completedStatus = work.status === "completed_pending_review" || work.status === "resolved" || terminal;
  const vendorNeedsDecision = responses[0] &&
    ["declined", "proposed_date", "question"].includes(responses[0].response) &&
    !["scheduled", "in_progress", "waiting_on_parts", "completed_pending_review", "resolved", "closed", "cancelled"].includes(work.status);

  return [
    {
      id: "intake",
      label: "Issue captured",
      state: "complete",
      detail: work.requestId ? "Created from a preserved store request" : "Created directly by an operator",
      timestampLabel: dateTime(work.createdAt, storeTimeZone),
    },
    {
      id: "authorization",
      label: "Operator approval",
      state: work.status === "draft" || work.status === "awaiting_approval" ? "current" : "complete",
      detail: work.status === "draft" || work.status === "awaiting_approval"
        ? "A manager decision is required before routing or requesting bids"
        : `Internal approval recorded · Priority: ${sentence(work.priority)}`,
    },
    {
      id: "assignment",
      label: "Provider selection",
      state: assignment ? (assignment.kind === "choose_later" ? "current" : "complete") : "blocked",
      detail: providerLabelForAssignment(fixture, organizationId, assignment),
      timestampLabel: assignment ? dateTime(assignment.assignedAt, storeTimeZone) : undefined,
    },
    {
      id: "issuance",
      label: "Service authorization",
      state: assignment?.kind === "internal" ? "complete" : issuances.length ? "complete" : assignment?.kind === "outside_vendor" ? "current" : "upcoming",
      detail: assignment?.kind === "internal"
        ? "Internal assignment does not require an outside-vendor link"
        : authorizationOpened || assignment?.status === "opened"
          ? `Opened by vendor · revision ${issuances[0]?.revision ?? "current"}`
          : issuances[0]
            ? `Link generated · revision ${issuances[0].revision} via ${sentence(issuances[0].channel)}`
            : "Generate or record a service authorization",
      timestampLabel: authorizationOpened ? dateTime(authorizationOpened.occurredAt, storeTimeZone) : issuances[0] ? dateTime(issuances[0].issuedAt, storeTimeZone) : undefined,
    },
    {
      id: "response",
      label: "Provider response",
      state: assignment?.kind === "internal" ? "complete" : vendorNeedsDecision ? "blocked" : responses.length ? "complete" : issuances.length ? "current" : "upcoming",
      detail: assignment?.kind === "internal" ? "Internal provider acknowledged through assignment" : responses[0] ? `${sentence(responses[0].response)} by ${responses[0].responderName}` : "Awaiting or manually record the vendor response",
      timestampLabel: responses[0] ? dateTime(responses[0].respondedAt, storeTimeZone) : undefined,
    },
    {
      id: "visit",
      label: "Service observed",
      state: latestVisit?.status === "active" ? "current" : latestVisit ? "complete" : ["accepted", "scheduled", "in_progress"].includes(work.status) ? "current" : "upcoming",
      detail: latestVisit ? (latestVisit.status === "active" ? `${latestVisit.technicianName} is onsite` : `${visits.length} observed visit${visits.length === 1 ? "" : "s"}`) : "No check-in recorded yet",
      timestampLabel: latestVisit ? dateTime(latestVisit.checkedInAt, storeTimeZone) : undefined,
    },
    {
      id: "outcome",
      label: "Outcome recorded",
      state: latestVisit?.outcome ? "complete" : latestVisit?.status === "active" ? "current" : "upcoming",
      detail: latestVisit?.outcome ? sentence(latestVisit.outcome) : "Checkout records the observable service outcome",
      timestampLabel: latestVisit?.checkedOutAt ? dateTime(latestVisit.checkedOutAt, storeTimeZone) : undefined,
    },
    {
      id: "closeout",
      label: "Follow-up / close",
      state: terminal ? "complete" : openFollowUps.length || completedStatus ? "current" : "upcoming",
      detail: terminal ? workStatusLabel(work.status) : openFollowUps.length ? `${openFollowUps.length} accountable follow-up${openFollowUps.length === 1 ? "" : "s"} open` : work.status === "resolved" ? "Accepted verification is ready for explicit closure" : completedStatus ? "Internal verification is required before resolution" : "Outcome determines the next accountable action",
      timestampLabel: work.closedAt ? dateTime(work.closedAt, storeTimeZone) : undefined,
    },
  ];
}

export function buildWorkOrderControlModel(
  fixture: OpsFixture,
  session: OperatorSession,
  workOrderId: string,
): WorkOrderControlViewModel {
  const scoped = scopeFixture(fixture, session);
  const work = scoped.workOrders.find((item) => item.id === workOrderId);
  const permitted = roleCan(session.role, "control_work_order");
  const workflowTasks = buildWorkflowTaskWorkspaceModel(fixture, session, workOrderId);
  if (!work) {
    return {
      available: false,
      permitted: false,
      submitAction: "",
      followUpAction: "",
      manualResponseAction: "",
      workOrderId,
      workOrderNumber: workOrderId,
      timeZone: DEFAULT_OPERATIONS_TIME_ZONE,
      expectedStatus: "draft",
      status: "draft",
      statusOptions: [],
      priority: "routine",
      priorityOptions: [],
      accountableParty: "",
      nextAction: "",
      isTerminal: false,
      stages: [],
      workflowTasks,
      followUps: [],
      canRecordManualVendorResponse: false,
      vendorResponseOptions: [],
    };
  }
  const pendingApprovalRequest = fixture.approvalRequests
    .filter((request) => (
      request.organizationId === scoped.organizationId
      && request.subjectType === "work_order"
      && request.subjectId === work.id
      && approvalRequestState(request, fixture.approvalDecisions) === "pending"
    ))
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id))[0];
  const approvalMembership = session.membershipId
    ? fixture.memberships.find((membership) => (
        membership.organizationId === scoped.organizationId
        && membership.id === session.membershipId
        && membership.status === "active"
      ))
    : undefined;
  const pendingApproval = pendingApprovalRequest
    ? (() => {
        const requiredRoleLabel = approvalRoleLabels[pendingApprovalRequest.requiredRole];
        const escalationRoleLabel = pendingApprovalRequest.escalationRole
          ? approvalRoleLabels[pendingApprovalRequest.escalationRole]
          : undefined;
        const hasRequiredRole = approvalMembership?.role === pendingApprovalRequest.requiredRole;
        const isRequester = approvalMembership?.id === pendingApprovalRequest.requestedByMembershipId;
        const canDecide = Boolean(hasRequiredRole && !isRequester);
        const decisionOptions: NonNullable<WorkOrderControlViewModel["pendingApproval"]>["decisionOptions"] = [
          {
            value: "approved",
            label: "Approve authorization",
            description: "Authorize the presented amount and release the work order for its next service action.",
            reasonRequired: false,
          },
          {
            value: "rejected",
            label: "Reject authorization",
            description: "Return the authorization for revision or cancellation. A reason is required.",
            reasonRequired: true,
          },
        ];
        if (pendingApprovalRequest.escalationRole && escalationRoleLabel) {
          decisionOptions.push({
            value: "escalated",
            label: `Escalate to ${escalationRoleLabel}`,
            description: `Create the next immutable review for ${escalationRoleLabel}. A reason is required.`,
            reasonRequired: true,
          });
        }
        return {
          requestId: pendingApprovalRequest.id,
          subjectLabel: "work order" as const,
          decisionAction: `/api/ops/approvals/${encodeURIComponent(pendingApprovalRequest.id)}/decision`,
          policyName: pendingApprovalRequest.policyName,
          policyVersion: pendingApprovalRequest.policyVersion,
          amountLabel: estimateMoney(pendingApprovalRequest.amount.amountMinor, pendingApprovalRequest.amount.currency),
          requiredRoleLabel,
          dueAt: pendingApprovalRequest.dueAt,
          dueLabel: pendingApprovalRequest.dueAt ? dateTime(pendingApprovalRequest.dueAt) : "No deadline set",
          escalationRoleLabel,
          canDecide,
          decisionAccessMessage: canDecide
            ? undefined
            : !approvalMembership
              ? "This preview session is not backed by an active organization membership."
              : !hasRequiredRole
                ? `An active ${requiredRoleLabel} membership must record this decision.`
                : `You requested this authorization. A different active ${requiredRoleLabel} must record the decision.`,
          decisionOptions,
        };
      })()
    : undefined;
  const assignment = assignmentForWork(fixture, scoped.organizationId, work.id);
  const storeTimeZone = fixture.stores.find((store) => store.organizationId === scoped.organizationId && store.id === work.storeId)?.timeZone
    ?? fixture.organizations.find((organization) => organization.id === scoped.organizationId)?.timeZone
    ?? DEFAULT_OPERATIONS_TIME_ZONE;
  const latestIssuance = fixture.issuances
    .filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === work.id)
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt))[0];
  const latestVendorResponse = fixture.vendorResponses
    .filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === work.id && (!assignment || item.assignmentId === assignment.id) && (!latestIssuance || item.issuanceId === latestIssuance.id))
    .sort((left, right) => right.respondedAt.localeCompare(left.respondedAt))[0];
  const deliveryMessage = latestIssuance
    ? fixture.outboxMessages
        .filter((item) => item.organizationId === scoped.organizationId && item.aggregateId === work.id && item.topic === "ops.work_order.issued")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    : undefined;
  const handoffOnly = latestIssuance && ["print", "manual"].includes(latestIssuance.channel);
  const deliveryStateLabel = !latestIssuance
    ? "Not issued"
    : assignment?.status === "opened" || assignment?.status === "accepted"
      ? "Opened by vendor"
    : handoffOnly
      ? "Handoff recorded"
      : deliveryMessage?.status === "delivered"
        ? "Delivery processed"
        : deliveryMessage?.status === "failed"
          ? "Delivery failed"
          : "Link generated";
  const deliveryStateDetail = !latestIssuance
    ? "No vendor authorization revision exists"
    : assignment?.status === "opened" || assignment?.status === "accepted"
      ? "The current vendor link was opened; vendor acceptance or another response remains a separate event"
    : handoffOnly
      ? "The platform recorded the manual or printable handoff; it did not send a message"
      : deliveryMessage?.status === "delivered"
        ? "The configured delivery worker marked this handoff delivered"
        : deliveryMessage?.status === "failed"
          ? "The delivery record requires operator attention"
          : "Secure links can be shared manually; configured email delivery sends authorizations to the vendor dispatch address, while SMS requires a later integration";
  const statuses = pendingApproval
    ? [work.status]
    : [work.status, ...allowedWorkOrderControlTransitions(work.status)];
  const terminal = work.status === "closed" || work.status === "cancelled";
  const canRecordManualVendorResponse = Boolean(
    permitted &&
    assignment?.kind === "outside_vendor" &&
    latestIssuance &&
    latestIssuance.assignmentId === assignment.id &&
    !terminal &&
    !["declined", "completed", "cancelled", "superseded"].includes(assignment.status) &&
    !["accepted", "declined"].includes(latestVendorResponse?.response ?? ""),
  );
  const linkedVisitIds = new Set([
    ...fixture.siteVisitWorkOrders
      .filter((link) => link.organizationId === scoped.organizationId && link.workOrderId === work.id)
      .map((link) => link.visitId),
    ...fixture.visits
      .filter((visit) => visit.organizationId === scoped.organizationId && visit.workOrderId === work.id)
      .map((visit) => visit.id),
  ]);
  const closeoutVerification = fixture.workOrderVerifications
    .filter((verification) => verification.organizationId === scoped.organizationId && verification.workOrderId === work.id)
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))[0];
  const closeoutCostMinor = fixture.costLines
    .filter((line) => line.organizationId === scoped.organizationId && line.workOrderId === work.id)
    .reduce((total, line) => total + line.amount.amountMinor, 0);
  const closeoutInvoiceCount = fixture.invoiceAllocations
    .filter((allocation) => allocation.organizationId === scoped.organizationId && allocation.workOrderId === work.id)
    .length;
  const closeoutEvidenceCount = fixture.visitEvidence
    .filter((evidence) => evidence.organizationId === scoped.organizationId && linkedVisitIds.has(evidence.visitId))
    .length;
  const closeoutFollowUpCount = fixture.followUps
    .filter((followUp) => followUp.organizationId === scoped.organizationId && followUp.workOrderId === work.id && followUp.status === "open")
    .length;
  const closeout = work.status === "resolved" ? {
    ready: closeoutVerification?.decision === "verified" && closeoutFollowUpCount === 0,
    outcomeLabel: closeoutVerification?.decision === "verified"
      ? `Verified by ${closeoutVerification.decidedByName} on ${dateTime(closeoutVerification.decidedAt, storeTimeZone)}`
      : "A verified service outcome is still required",
    visitEvidenceLabel: `${linkedVisitIds.size} visit${linkedVisitIds.size === 1 ? "" : "s"} · ${closeoutEvidenceCount} evidence record${closeoutEvidenceCount === 1 ? "" : "s"}`,
    costEvidenceLabel: closeoutCostMinor ? `${money(closeoutCostMinor)} recorded work cost` : "No work cost entered — deferral is allowed",
    invoiceEvidenceLabel: closeoutInvoiceCount ? `${closeoutInvoiceCount} linked invoice allocation${closeoutInvoiceCount === 1 ? "" : "s"}` : "No invoice linked — optional safeguard not used",
    classificationLabel: [work.categoryKey ? sentence(work.categoryKey) : "Category deferred", work.assetId ? "Equipment linked" : "Equipment deferred", work.componentId ? "Component linked" : "Component deferred"].join(" · "),
    openFollowUpCount: closeoutFollowUpCount,
  } : undefined;
  return {
    available: true,
    permitted,
    submitAction: `/api/ops/work-orders/${encodeURIComponent(work.id)}/control`,
    followUpAction: `/api/ops/work-orders/${encodeURIComponent(work.id)}/follow-ups`,
    manualResponseAction: `/api/ops/work-orders/${encodeURIComponent(work.id)}/control`,
    workOrderId: work.id,
    workOrderNumber: work.number,
    timeZone: storeTimeZone,
    expectedStatus: work.status,
    status: work.status,
    statusOptions: statuses.map((status) => ({ value: status, label: sentence(status), description: status === work.status ? "Current state" : "Administrative closeout" })),
    priority: work.priority,
    priorityOptions: ["emergency", "urgent", "routine", "planned"].map((priority) => ({ value: priority, label: sentence(priority) })),
    accountableParty: work.accountableParty,
    nextAction: work.nextAction,
    // Keep the persisted instant intact for display. The form helper derives
    // its datetime-local shape separately; stripping the offset here made the
    // same deadline render four hours differently across the case header.
    dueAt: work.dueAt,
    dueInputValue: work.dueAt ? dateTimeInputInZone(work.dueAt, storeTimeZone) : undefined,
    escalationTo: work.escalationTo,
    isTerminal: terminal,
    pendingApproval,
    stages: workOrderStages(fixture, scoped.organizationId, work),
    workflowTasks,
    assignment: assignment ? {
      kind: assignment.kind,
      status: assignment.status,
      providerLabel: providerLabelForAssignment(fixture, scoped.organizationId, assignment),
      assignedLabel: dateTime(assignment.assignedAt, storeTimeZone),
    } : undefined,
    latestIssuance: latestIssuance ? {
      id: latestIssuance.id,
      revision: latestIssuance.revision,
      channelLabel: sentence(latestIssuance.channel),
      issuedLabel: dateTime(latestIssuance.issuedAt, storeTimeZone),
      deliveryStateLabel,
      deliveryStateDetail,
    } : undefined,
    latestVendorResponse: latestVendorResponse ? {
      response: latestVendorResponse.response,
      responderName: latestVendorResponse.responderName,
      respondedLabel: dateTime(latestVendorResponse.respondedAt, storeTimeZone),
      proposedAt: latestVendorResponse.proposedAt,
      message: latestVendorResponse.message,
    } : undefined,
    closeout,
    followUps: fixture.followUps
      .filter((item) => item.organizationId === scoped.organizationId && item.workOrderId === work.id && item.status === "open")
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
      .map((item) => ({
        id: item.id,
        status: item.status,
        accountableParty: item.accountableParty,
        nextAction: item.nextAction,
        dueAt: item.dueAt.slice(0, 16),
        dueLabel: dateTimeInZone(item.dueAt, storeTimeZone),
        escalationTo: item.escalationTo,
      })),
    canRecordManualVendorResponse,
    manualVendorResponseTarget: canRecordManualVendorResponse && assignment && latestIssuance
      ? {
          expectedAssignmentId: assignment.id,
          expectedIssuanceId: latestIssuance.id,
          expectedIssuanceRevision: latestIssuance.revision,
        }
      : undefined,
    vendorResponseOptions: [
      { value: "accepted", label: "Accepted", description: "Vendor agreed to the work" },
      { value: "declined", label: "Declined", description: "Facilities must select another provider" },
      { value: "proposed_date", label: "Proposed a date", description: "Facilities must review the proposed schedule" },
      { value: "question", label: "Asked a question", description: "Facilities owes the vendor a response" },
    ],
  };
}

export function buildRequestReviewModel(
  fixture: OpsFixture,
  session: OperatorSession,
  requestId: string,
): RequestReviewViewModel {
  const scoped = scopeFixture(fixture, session);
  const request = fixture.requests.find(
    (item) => item.id === requestId && item.organizationId === scoped.organizationId && scoped.storeIds.has(item.storeId),
  );
  const available = Boolean(request && (request.status === "submitted" || request.status === "under_review"));
  const permitted = available && roleCan(session.role, "review_request");
  const impactHistory = request
    ? fixture.requestImpactAssessments
      .filter((assessment) => assessment.organizationId === scoped.organizationId && assessment.requestId === request.id)
      .sort((left, right) => right.assessedAt.localeCompare(left.assessedAt) || right.id.localeCompare(left.id))
    : [];
  const latestImpact = impactHistory[0];
  const requestApprovals = request
    ? fixture.approvalRequests
      .filter((approvalRequest) => (
        approvalRequest.organizationId === scoped.organizationId
        && approvalRequest.subjectType === "service_request"
        && approvalRequest.subjectId === request.id
      ))
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id))
    : [];
  const latestApprovalRequest = requestApprovals[0];
  const latestApprovalState = latestApprovalRequest
    ? approvalRequestState(latestApprovalRequest, fixture.approvalDecisions)
    : undefined;
  const pendingApprovalRequest = requestApprovals.find(
    (approvalRequest) => approvalRequestState(approvalRequest, fixture.approvalDecisions) === "pending",
  );
  const approvalMembership = session.membershipId
    ? fixture.memberships.find((membership) => (
        membership.organizationId === scoped.organizationId
        && membership.id === session.membershipId
        && membership.status === "active"
      ))
    : undefined;
  const pendingApproval: ApprovalDecisionViewModel | undefined = pendingApprovalRequest
    ? (() => {
        const requiredRoleLabel = approvalRoleLabels[pendingApprovalRequest.requiredRole];
        const escalationRoleLabel = pendingApprovalRequest.escalationRole
          ? approvalRoleLabels[pendingApprovalRequest.escalationRole]
          : undefined;
        const hasRequiredRole = approvalMembership?.role === pendingApprovalRequest.requiredRole;
        const isRequester = approvalMembership?.id === pendingApprovalRequest.requestedByMembershipId;
        const canDecide = Boolean(hasRequiredRole && !isRequester);
        const decisionOptions: ApprovalDecisionViewModel["decisionOptions"] = [
          {
            value: "approved",
            label: "Approve authorization",
            description: "Authorize the presented amount and release this request for work-order creation.",
            reasonRequired: false,
          },
          {
            value: "rejected",
            label: "Reject authorization",
            description: "Return the authorization for revision or closeout. A reason is required.",
            reasonRequired: true,
          },
        ];
        if (pendingApprovalRequest.escalationRole && escalationRoleLabel) {
          decisionOptions.push({
            value: "escalated",
            label: `Escalate to ${escalationRoleLabel}`,
            description: `Create the next immutable review for ${escalationRoleLabel}. A reason is required.`,
            reasonRequired: true,
          });
        }
        return {
          requestId: pendingApprovalRequest.id,
          subjectLabel: "request" as const,
          decisionAction: `/api/ops/approvals/${encodeURIComponent(pendingApprovalRequest.id)}/decision`,
          policyName: pendingApprovalRequest.policyName,
          policyVersion: pendingApprovalRequest.policyVersion,
          amountLabel: estimateMoney(pendingApprovalRequest.amount.amountMinor, pendingApprovalRequest.amount.currency),
          requiredRoleLabel,
          dueAt: pendingApprovalRequest.dueAt,
          dueLabel: pendingApprovalRequest.dueAt ? dateTime(pendingApprovalRequest.dueAt) : "No deadline set",
          escalationRoleLabel,
          canDecide,
          decisionAccessMessage: canDecide
            ? undefined
            : !approvalMembership
              ? "This preview session is not backed by an active organization membership."
              : !hasRequiredRole
                ? `An active ${requiredRoleLabel} membership must record this decision.`
                : `You requested this authorization. A different active ${requiredRoleLabel} must record the decision.`,
          decisionOptions,
        };
      })()
    : undefined;
  const canPrepareWorkOrder = Boolean(
    request
    && !request.convertedWorkOrderId
    && (!latestApprovalRequest || latestApprovalState === "approved")
    && roleCan(session.role, "create_work_order"),
  );
  const impactReviewed = latestImpact?.assessmentKind === "review" && latestImpact.source === "manager_review";
  const canCreateWorkOrder = Boolean(
    canPrepareWorkOrder
    && request?.status === "under_review"
    && impactReviewed,
  );
  return {
    available,
    permitted,
    submitAction: request ? `/api/ops/requests/${encodeURIComponent(request.id)}/review` : "",
    requestId,
    reference: request?.reference ?? requestId,
    expectedStatus: request?.status === "under_review" ? "under_review" : "submitted",
    statusLabel: request ? sentence(request.status) : "Unavailable",
    impactReviewed,
    canPrepareWorkOrder,
    canCreateWorkOrder,
    createWorkOrderHref: canPrepareWorkOrder && request
      ? `/app/work-orders/new?request=${encodeURIComponent(request.id)}`
      : undefined,
    impactSubmitAction: request ? `/api/ops/requests/${encodeURIComponent(request.id)}/impact` : "",
    pendingApproval,
    latestImpact: latestImpact ? {
      id: latestImpact.id,
      storeOperatingState: latestImpact.storeOperatingState,
      safetyConcern: latestImpact.safetyConcern,
      productInventoryRisk: latestImpact.productInventoryRisk,
      productInventoryValueInput: latestImpact.productInventoryValue ? String(latestImpact.productInventoryValue.amountMinor / 100) : undefined,
      productInventoryValueLabel: impactMoney(latestImpact.productInventoryValue),
      customersAffected: latestImpact.customersAffected,
      complianceImpact: latestImpact.complianceImpact,
      capacityUnavailablePercentInput: latestImpact.capacityUnavailableBps === undefined ? undefined : String(latestImpact.capacityUnavailableBps / 100),
      capacityUnavailableLabel: latestImpact.capacityUnavailableBps === undefined ? "Not estimated" : `${latestImpact.capacityUnavailableBps / 100}%`,
      redundantEquipment: latestImpact.redundantEquipment,
      revenueFunctionImpact: latestImpact.revenueFunctionImpact,
      estimatedDailyRevenueExposureInput: latestImpact.estimatedDailyRevenueExposure ? String(latestImpact.estimatedDailyRevenueExposure.amountMinor / 100) : undefined,
      estimatedDailyRevenueExposureLabel: impactMoney(latestImpact.estimatedDailyRevenueExposure),
      estimatedDowntimeMinutesInput: latestImpact.estimatedDowntimeMinutes === undefined ? undefined : String(latestImpact.estimatedDowntimeMinutes),
      estimatedDowntimeLabel: latestImpact.estimatedDowntimeMinutes === undefined ? "Not estimated" : `${latestImpact.estimatedDowntimeMinutes} minutes`,
      confidence: latestImpact.confidence,
      notes: latestImpact.notes,
    } : undefined,
    impactHistory: impactHistory.map((assessment) => ({
      id: assessment.id,
      kindLabel: assessment.assessmentKind === "review" ? `Manager ${sentence(assessment.reviewDisposition ?? "review")}` : "Initial store report",
      summary: `${sentence(assessment.storeOperatingState)} · Safety ${sentence(assessment.safetyConcern)} · Customers ${sentence(assessment.customersAffected)}`,
      provenanceLabel: `${assessment.assessedByActorName} · ${dateTime(assessment.assessedAt)}`,
    })),
    impactCaveat: IMPACT_ESTIMATE_CAVEAT,
  };
}

export function buildWorkOrderRecordingModel(
  fixture: OpsFixture,
  session: OperatorSession,
  workOrderId: string,
): WorkOrderRecordingViewModel {
  const scoped = scopeFixture(fixture, session);
  const work = scoped.workOrders.find((item) => item.id === workOrderId);
  if (!work) {
    return {
      available: false,
      canClassify: false,
      canRecordCost: false,
      submitAction: "",
      workOrderId,
      workOrderNumber: workOrderId,
      classificationSubmissionKey: "classification:unavailable",
      costSubmissionKey: "work-cost:unavailable",
      categories: [],
      assets: [],
      components: [],
      costKinds: [],
      defaultServiceDate: fixture.asOf.slice(0, 10),
      recordedCostLabel: money(0),
      recordedCostLineCount: 0,
    };
  }
  const storeAssets = scoped.assets.filter((asset) => asset.storeId === work.storeId);
  const storeAssetIds = new Set(storeAssets.map((asset) => asset.id));
  const categoryKeys = new Set([
    ...fixture.taxonomyNodes
      .filter((node) => node.organizationId === scoped.organizationId && node.nodeKind === "category" && node.active)
      .map((node) => node.canonicalKey)
      .filter((value): value is string => Boolean(value)),
    ...storeAssets.map((asset) => asset.categoryKey),
    ...scoped.workOrders.map((item) => item.categoryKey).filter((value): value is string => Boolean(value)),
  ]);
  const costLines = fixture.costLines.filter((line) => line.organizationId === scoped.organizationId && line.workOrderId === work.id);
  return {
    available: true,
    canClassify: roleCan(session.role, "classify_work_order"),
    canRecordCost: roleCan(session.role, "record_work_cost"),
    submitAction: `/api/ops/work-orders/${encodeURIComponent(work.id)}/records`,
    workOrderId: work.id,
    workOrderNumber: work.number,
    currentCategory: work.categoryKey,
    currentAssetId: work.assetId,
    currentComponentId: work.componentId,
    classificationSubmissionKey: `classification:${crypto.randomUUID()}`,
    costSubmissionKey: `work-cost:${crypto.randomUUID()}`,
    categories: [...categoryKeys].sort().map((category) => ({ value: category, label: sentence(category) })),
    assets: storeAssets
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((asset) => ({ value: asset.id, label: `${asset.name} - ${asset.assetTag}`, description: assetHierarchyPath(asset).join(" / "), categoryKey: asset.categoryKey })),
    components: fixture.components
      .filter((component) => component.organizationId === scoped.organizationId && storeAssetIds.has(component.assetId))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((component) => ({ value: component.id, label: component.name, description: component.partNumber ?? component.serialNumber, assetId: component.assetId })),
    costKinds: [
      { value: "labor", label: "Labor" },
      { value: "parts", label: "Parts" },
      { value: "travel", label: "Travel" },
      { value: "materials", label: "Materials" },
      { value: "other", label: "Other recorded cost" },
    ],
    defaultServiceDate: fixture.asOf.slice(0, 10),
    recordedCostLabel: money(costLines.reduce((total, line) => total + line.amount.amountMinor, 0)),
    recordedCostLineCount: costLines.length,
  };
}

export function buildAttentionItemModel(
  fixture: OpsFixture,
  session: OperatorSession,
  itemId: string,
): { detail: DetailPageViewModel; control: AttentionItemControlViewModel } {
  const scoped = scopeFixture(fixture, session);
  const permitted = roleCan(session.role, "review_attention");
  const exception = fixture.exceptions.find(
    (item) => item.id === itemId && item.organizationId === scoped.organizationId && (!item.storeId || scoped.storeIds.has(item.storeId)),
  );
  if (exception) {
    const store = exception.storeId ? scoped.stores.find((item) => item.id === exception.storeId) : undefined;
    const work = exception.workOrderId ? scoped.workOrders.find((item) => item.id === exception.workOrderId) : undefined;
    const asset = work?.assetId ? scoped.assets.find((item) => item.id === work.assetId) : undefined;
    const visit = exception.visitId ? scoped.visits.find((item) => item.id === exception.visitId) : undefined;
    const vendor = exception.vendorId ? fixture.vendors.find((item) => item.id === exception.vendorId && item.organizationId === scoped.organizationId) : undefined;
    const timeline = fixture.auditEvents
      .filter((event) => event.organizationId === scoped.organizationId && [exception.id, visit?.id, work?.id].filter(Boolean).includes(event.aggregateId))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    const reconciliationOptions = exception.kind === "no_work_order" && visit && !visit.workOrderId
      ? scoped.workOrders
          .filter((candidate) => candidate.storeId === visit.storeId && !["closed", "cancelled"].includes(candidate.status))
          .filter((candidate) => {
            if (!visit.vendorId) return true;
            const assignment = assignmentForWork(fixture, scoped.organizationId, candidate.id);
            return assignment?.kind === "outside_vendor" && assignment.vendorId === visit.vendorId;
          })
          .map((candidate) => ({ value: candidate.id, label: candidate.number, description: `${sentence(candidate.status)} - ${candidate.problem}` }))
      : undefined;
    return {
      detail: {
        state: { kind: "ready" },
        page: {
          title: exception.summary,
          eyebrow: `${sentence(exception.severity)} service exception`,
          description: "Review the source evidence, record the decision, and keep any correction attributable.",
          scopeLabel: store ? storeLabel(store) : session.scopeLabel,
          primaryAction: visit ? { label: "Open service visit", href: `/app/visits/${visit.id}` } : work ? { label: `Open ${work.number}`, href: `/app/work-orders/${work.id}` } : undefined,
          secondaryAction: store ? { label: "Open store", href: `/app/stores/${store.id}` } : undefined,
        },
        statusLabel: sentence(exception.status),
        statusTone: exception.status === "resolved" ? "positive" : exception.severity === "urgent" ? "critical" : "warning",
        facts: [
          { label: "Exception type", value: sentence(exception.kind) },
          { label: "Detected", value: dateTime(exception.detectedAt) },
          { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
          { label: "Vendor", value: vendor?.name ?? visit?.providerName ?? "Not applicable", link: vendor ? { href: `/app/vendors/${vendor.id}`, label: "Open vendor" } : undefined },
          { label: "Work order", value: work?.number ?? "Not linked", link: work ? { href: `/app/work-orders/${work.id}`, label: "Open work order" } : undefined },
          ...(asset ? [{ label: "Equipment", value: asset.name, helperText: asset.assetTag, link: { href: `/app/equipment/${asset.id}?section=service-history`, label: "Open equipment history" } }] : []),
          { label: "Observed visit", value: visit ? `${visit.technicianName} - ${dateTime(visit.checkedInAt)}` : "Not linked", link: visit ? { href: `/app/visits/${visit.id}`, label: "Open visit evidence" } : undefined },
        ],
        sections: [
          {
            id: "source-evidence",
            title: "Source evidence",
            description: exception.kind === "no_work_order" ? "The visit is valid evidence even though the technician could not identify a work order. Link it only when the store, vendor, and intended work agree." : "Observed facts remain separate from the manager's review decision.",
            facts: visit ? [
              { label: "Purpose", value: visit.purpose },
              { label: "Visit status", value: sentence(visit.status) },
              { label: "Unmatched reason", value: visit.unmatchedReason ?? "Not applicable" },
              { label: "Outcome", value: visit.outcome ? sentence(visit.outcome) : "Not recorded" },
              ...(visit.outcomeNotes ? [{ label: "Technician checkout notes", value: visit.outcomeNotes }] : []),
            ] : [{ label: "Summary", value: exception.summary }],
          },
          {
            id: "timeline",
            title: "Decision and evidence timeline",
            timeline: timeline.map((event) => ({ id: event.id, title: sentence(event.eventType.replaceAll(".", " ")), description: auditDescription(event.payloadJson), timestampLabel: dateTime(event.occurredAt), actorLabel: event.actorName })),
          },
        ],
        backLink: { label: "Back to Needs attention", href: "/app/action-center" },
      },
      control: {
        available: true,
        permitted,
        submitAction: `/api/ops/action-items/${encodeURIComponent(exception.id)}`,
        id: exception.id,
        kind: "exception",
        status: exception.status,
        title: exception.summary,
        description: exception.kind === "no_work_order" ? "Link this visit to eligible work or record an acknowledged/resolved review decision." : "Acknowledge or resolve this exception with an attributable note.",
        reconciliationOptions,
        unmatchedVisit: exception.kind === "no_work_order" && visit && !visit.workOrderId ? {
          createWorkOrderHref: `/app/work-orders/new?sourceException=${encodeURIComponent(exception.id)}`,
          providerLabel: vendor?.name ?? visit.providerName,
          purpose: visit.purpose,
        } : undefined,
      },
    };
  }

  const followUp = fixture.followUps.find((item) => item.id === itemId && item.organizationId === scoped.organizationId);
  const work = followUp ? scoped.workOrders.find((item) => item.id === followUp.workOrderId) : undefined;
  if (followUp && work) {
    const store = scoped.stores.find((item) => item.id === work.storeId);
    const asset = work.assetId ? scoped.assets.find((item) => item.id === work.assetId) : undefined;
    const visit = followUp.sourceVisitId ? scoped.visits.find((item) => item.id === followUp.sourceVisitId) : undefined;
    const storeTimeZone = store?.timeZone
      ?? fixture.organizations.find((organization) => organization.id === scoped.organizationId)?.timeZone
      ?? DEFAULT_OPERATIONS_TIME_ZONE;
    const serviceVisits = visitsForWorkOrder(fixture, scoped, work.id);
    const serviceVisitRows = workOrderVisitRows(serviceVisits, storeTimeZone, followUp.sourceVisitId);
    const noteHistory = workOrderNoteHistory(fixture, scoped.organizationId, work.id, serviceVisits, storeTimeZone);
    const timeline = fixture.auditEvents
      .filter((event) => event.organizationId === scoped.organizationId && (event.aggregateId === followUp.id || event.aggregateId === work.id || serviceVisits.some((candidate) => candidate.id === event.aggregateId)))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    return {
      detail: {
        state: { kind: "ready" },
        page: {
          title: followUp.nextAction,
          eyebrow: "Accountable service follow-up",
          description: `${work.number} remains visible until this next action is completed or reassigned.`,
          scopeLabel: storeLabel(store),
          primaryAction: { label: `Open ${work.number}`, href: `/app/work-orders/${work.id}` },
          secondaryAction: visit ? { label: "Open source visit", href: `/app/visits/${visit.id}` } : undefined,
        },
        statusLabel: sentence(followUp.status),
        statusTone: followUp.status === "completed" ? "positive" : Date.parse(followUp.dueAt) < Date.parse(fixture.asOf) ? "critical" : "warning",
        facts: [
          { label: "Accountable party", value: followUp.accountableParty },
          { label: "Due", value: dateTime(followUp.dueAt, storeTimeZone) },
          { label: "Escalates to", value: followUp.escalationTo },
          { label: "Work order", value: work.number, link: { href: `/app/work-orders/${work.id}`, label: "Open work order" } },
          ...(asset ? [{ label: "Equipment", value: asset.name, helperText: asset.assetTag, link: { href: `/app/equipment/${asset.id}?section=service-history`, label: "Open equipment history" } }] : []),
          { label: "Store", value: storeLabel(store), link: store ? { href: `/app/stores/${store.id}`, label: "Open store" } : undefined },
          { label: "Source visit", value: visit ? `${visit.technicianName} - ${dateTime(visit.checkedInAt, storeTimeZone)}` : "Not visit-generated", link: visit ? { href: `/app/visits/${visit.id}`, label: "Open visit" } : undefined },
        ],
        sections: [
          { id: "required-action", title: "Required next action", description: "Completing or changing this follow-up also updates the work order's accountable next-action projection.", facts: [{ label: "Next action", value: followUp.nextAction }, { label: "Owner", value: followUp.accountableParty }, { label: "Escalation", value: followUp.escalationTo }] },
          {
            id: "service-visits",
            title: "Service visits and technician notes",
            description: serviceVisitRows.length ? "These are the observed visits tied to this work order. Checkout notes are shown as recorded and are not interpreted by the platform." : "No service visit is linked to this follow-up yet.",
            tableHeading: "Check-in and checkout history",
            table: {
              id: "follow-up-service-visits",
              caption: `Service visits tied to ${work.number}`,
              columns: [
                { key: "visit", label: "Checked in" },
                { key: "provider", label: "Technician / vendor" },
                { key: "checkout", label: "Checked out" },
                { key: "outcome", label: "Outcome and notes" },
              ],
              rows: serviceVisitRows,
            },
            timelineHeading: "Notes and updates",
            timeline: noteHistory,
          },
          { id: "timeline", title: "Service timeline", timeline: timeline.map((event) => ({ id: event.id, title: sentence(event.eventType.replaceAll(".", " ")), description: auditDescription(event.payloadJson), timestampLabel: dateTime(event.occurredAt), actorLabel: event.actorName })) },
        ],
        backLink: { label: "Back to Needs attention", href: "/app/action-center" },
      },
      control: {
        available: true,
        permitted,
        submitAction: `/api/ops/action-items/${encodeURIComponent(followUp.id)}`,
        id: followUp.id,
        kind: "follow_up",
        status: followUp.status,
        title: followUp.nextAction,
        description: "Complete the action with a resolution note, or change its owner, deadline, next action, and escalation destination.",
        accountableParty: followUp.accountableParty,
        nextAction: followUp.nextAction,
        dueAt: followUp.dueAt.slice(0, 16),
        escalationTo: followUp.escalationTo,
      },
    };
  }

  return {
    detail: missingDetail("Attention item", "/app/action-center"),
    control: { available: false, permitted: false, submitAction: "", id: itemId, kind: "exception", status: "unavailable", title: "Attention item unavailable", description: "This item does not exist or is outside your operating scope." },
  };
}
