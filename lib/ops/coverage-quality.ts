import type { OpsFixture } from "./types";

/**
 * Closed-Loop Maintenance Coverage, policy v1.
 *
 * A resolved or closed Work Order is "complete" when the operating record can
 * answer every question management will eventually ask: did someone service it
 * (visit outcome), did the vendor's claim survive internal verification (only
 * required for outside-vendor work), and was the money recorded (cost lines).
 * The policy version is stamped into every result so restating the rules later
 * never rewrites historical coverage.
 */

export const CLOSED_LOOP_POLICY_VERSION = "closed-loop-v1";

export interface CoverageRequirement {
  key: "outcome_recorded" | "verification_verified" | "cost_recorded";
  label: string;
  satisfiedCount: number;
}

export interface IncompleteWorkOrder {
  workOrderId: string;
  storeId: string;
  missing: CoverageRequirement["key"][];
}

export interface ClosedLoopCoverageResult {
  policyVersion: string;
  denominator: number;
  numerator: number;
  /** numerator / denominator; null when nothing has closed yet. */
  coverageRate: number | null;
  requirements: CoverageRequirement[];
  incompleteWorkOrders: IncompleteWorkOrder[];
}

const TERMINAL_STATUSES = new Set(["resolved", "closed"]);

export function buildClosedLoopCoverage(
  fixture: Pick<OpsFixture, "workOrders" | "assignments" | "siteVisitWorkOrders" | "workOrderVerifications" | "costLines">,
  organizationId: string,
): ClosedLoopCoverageResult {
  const closedWorkOrders = fixture.workOrders.filter((row) => row.organizationId === organizationId && TERMINAL_STATUSES.has(row.status));
  const requirements: CoverageRequirement[] = [
    { key: "outcome_recorded", label: "Visit outcome recorded", satisfiedCount: 0 },
    { key: "verification_verified", label: "Vendor claim verified internally", satisfiedCount: 0 },
    { key: "cost_recorded", label: "Recorded cost evidence exists", satisfiedCount: 0 },
  ];
  const incompleteWorkOrders: IncompleteWorkOrder[] = [];

  for (const workOrder of closedWorkOrders) {
    const outcomes = fixture.siteVisitWorkOrders.filter((row) => row.organizationId === organizationId && row.workOrderId === workOrder.id && row.outcome != null);
    const verifications = fixture.workOrderVerifications.filter((row) => row.organizationId === organizationId && outcomes.some((outcome) => outcome.id === row.siteVisitWorkOrderId));
    const vendorAssigned = fixture.assignments.some((row) => row.organizationId === organizationId && row.workOrderId === workOrder.id && row.vendorId != null);
    const costRecorded = fixture.costLines.some((row) => row.organizationId === organizationId && row.workOrderId === workOrder.id);

    const missing: CoverageRequirement["key"][] = [];
    if (outcomes.length > 0) requirements[0].satisfiedCount += 1;
    else missing.push("outcome_recorded");
    if (!vendorAssigned || verifications.some((row) => row.decision === "verified")) requirements[1].satisfiedCount += 1;
    else missing.push("verification_verified");
    if (costRecorded) requirements[2].satisfiedCount += 1;
    else missing.push("cost_recorded");
    if (missing.length > 0) incompleteWorkOrders.push({ workOrderId: workOrder.id, storeId: workOrder.storeId, missing });
  }

  return {
    policyVersion: CLOSED_LOOP_POLICY_VERSION,
    denominator: closedWorkOrders.length,
    numerator: closedWorkOrders.length - incompleteWorkOrders.length,
    coverageRate: closedWorkOrders.length > 0 ? (closedWorkOrders.length - incompleteWorkOrders.length) / closedWorkOrders.length : null,
    requirements,
    incompleteWorkOrders,
  };
}


/**
 * Operational data-quality queue: records whose gaps limit dispatch, analysis,
 * or cost rollup. Every issue names its entity so the fix happens at the
 * source record, never in a side table.
 */

export type DataQualitySeverity = "high" | "medium" | "low";

export interface DataQualityIssue {
  severity: DataQualitySeverity;
  entityType: "work_order" | "invoice" | "asset";
  entityId: string;
  label: string;
  detail: string;
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  counts: Record<DataQualitySeverity, number>;
}

export function buildDataQualityIssues(
  fixture: Pick<OpsFixture, "workOrders" | "workflowTasks" | "invoices" | "invoiceExceptions" | "assets">,
  organizationId: string,
  now: string,
): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  const agingCutoff = new Date(Date.parse(now) - 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const workOrder of fixture.workOrders.filter((row) => row.organizationId === organizationId && !TERMINAL_STATUSES.has(row.status))) {
    const hasOpenTask = fixture.workflowTasks.some((row) => row.organizationId === organizationId && row.workOrderId === workOrder.id && (row.status === "open" || row.status === "in_progress"));
    if (!hasOpenTask) {
      issues.push({ severity: "high", entityType: "work_order", entityId: workOrder.id, label: "Active work without an accountable next action", detail: `Work Order ${workOrder.number} is active but holds no open Workflow Task. Every nonterminal obligation needs an owner, a due time, and a destination.` });
    }
    if (!workOrder.categoryKey) {
      issues.push({ severity: "medium", entityType: "work_order", entityId: workOrder.id, label: "Problem not yet classified", detail: `Work Order ${workOrder.number} has no category path, which limits spend rollups and vendor routing.` });
    }
    if (!workOrder.assetId) {
      issues.push({ severity: "low", entityType: "work_order", entityId: workOrder.id, label: "Equipment link missing", detail: `Work Order ${workOrder.number} is not tied to an asset, so reliability history cannot accumulate.` });
    }
  }

  const openExceptionInvoiceIds = new Set(fixture.invoiceExceptions.filter((row) => row.organizationId === organizationId && row.status === "open").map((row) => row.invoiceId));
  for (const invoice of fixture.invoices.filter((row) => row.organizationId === organizationId && openExceptionInvoiceIds.has(row.id))) {
    const oldestOpen = fixture.invoiceExceptions.filter((row) => row.invoiceId === invoice.id && row.status === "open").map((row) => row.detectedAt).sort()[0];
    if (oldestOpen && oldestOpen <= agingCutoff) {
      issues.push({ severity: "medium", entityType: "invoice", entityId: invoice.id, label: "Invoice review aging past 30 days", detail: `Vendor invoice ${invoice.vendorInvoiceNumber} has held an open review flag since ${oldestOpen}. Exposure stays identified until a human decides.` });
    }
  }

  for (const asset of fixture.assets.filter((row) => row.organizationId === organizationId && row.status !== "retired")) {
    if (!asset.expectedLifeYears) {
      issues.push({ severity: "low", entityType: "asset", entityId: asset.id, label: "Lifecycle inputs incomplete", detail: `Asset ${asset.name} has no expected useful life, so replacement recommendations run at reduced confidence.` });
    }
  }

  const counts: Record<DataQualitySeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const issue of issues) counts[issue.severity] += 1;
  return { issues, counts };
}
