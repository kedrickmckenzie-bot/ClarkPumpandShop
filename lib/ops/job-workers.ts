import type { OpsCommandServices } from "./commands";
import { escalateWorkflowTask } from "./workflow-task-commands";
import { productPresentation } from "../product/presentation";
import type { VendorComplianceAlertStage, VendorComplianceDocument, WorkflowTask } from "./types";

/**
 * SLA escalation worker.
 *
 * Reuses the exact domain command a human operator uses
 * (`escalateWorkflowTask`) so automated escalation produces the same audit
 * events, outbox intent, version fencing, and projections as a manual one —
 * only with the platform `system` actor.
 *
 * Idempotency: each cycle executes inside one slot per organization
 * (`ops_job_runs` unique on organization + job type + slot). The default slot
 * is the UTC hour, so scheduling the cycle repeatedly within an hour is safe,
 * and overdue tasks climb at most one level per slot up to `maxLevel`.
 */

export interface SlaEscalationOptions {
  /** Maximum overdue tasks considered per cycle (1–100). */
  limit?: number;
  /** Escalation-level ceiling per task. */
  maxLevel?: number;
  /** Override the idempotency slot (defaults to the UTC hour of `now`). */
  slotKey?: string;
}

export interface SlaEscalationCycleSummary {
  slotKey: string;
  organizationsConsidered: number;
  organizationsSkipped: number;
  escalatedCount: number;
  /** Tasks already at the ceiling; left untouched. */
  cappedCount: number;
  failedCount: number;
}

const workerName = productPresentation.identity.workingName;
const systemActorName = `${workerName} SLA worker`;
const jobType = "sla_escalation";

export async function runSlaEscalationCycle(
  services: OpsCommandServices,
  options: SlaEscalationOptions = {},
): Promise<SlaEscalationCycleSummary> {
  const repository = services.repository;
  const clock = services.clock ?? { now: () => new Date().toISOString() };
  const ids = services.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  const now = clock.now();
  const slotKey = options.slotKey ?? `${now.slice(0, 13)}:00`;
  const maxLevel = Math.max(1, Math.floor(options.maxLevel ?? 3));
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 50)));

  const summary: SlaEscalationCycleSummary = {
    slotKey,
    organizationsConsidered: 0,
    organizationsSkipped: 0,
    escalatedCount: 0,
    cappedCount: 0,
    failedCount: 0,
  };

  const candidates = await repository.listOverdueEscalationCandidates(now, limit);
  const byOrganization = new Map<string, WorkflowTask[]>();
  for (const task of candidates) {
    const bucket = byOrganization.get(task.organizationId);
    if (bucket) bucket.push(task);
    else byOrganization.set(task.organizationId, [task]);
  }
  summary.organizationsConsidered = byOrganization.size;

  for (const [organizationId, tasks] of byOrganization) {
    const jobRunId = ids.next("job");
    const began = await repository.tryBeginJobRun({ organizationId, jobRunId, jobType, slotKey, startedAt: clock.now() });
    if (!began) {
      summary.organizationsSkipped += 1;
      continue;
    }
    let processed = 0;
    let failed = 0;
    for (const task of tasks) {
      if (task.escalationLevel >= maxLevel) {
        summary.cappedCount += 1;
        processed += 1;
        continue;
      }
      try {
        await escalateWorkflowTask({ repository, clock, ids }, {
          organizationId,
          workflowTaskId: task.id,
          escalationDestination: task.escalationDestination,
          escalationLevel: task.escalationLevel + 1,
          reason: `SLA overdue since ${task.dueAt}; automatically escalated by the SLA worker`,
          actor: { organizationId, actorType: "system", actorName: systemActorName },
        });
        summary.escalatedCount += 1;
      } catch {
        summary.failedCount += 1;
        failed += 1;
      }
      processed += 1;
    }
    await repository.finishJobRun({
      organizationId,
      jobRunId,
      status: jobRunStatus(processed, failed),
      finishedAt: clock.now(),
      processedCount: processed,
      failedCount: failed,
    });
  }

  return summary;
}


export interface PmRecurrenceOptions {
  /** Create the next occurrence when its due date falls within this many days. */
  horizonDays?: number;
  /** Override the idempotency slot (defaults to the UTC day of `now`). */
  slotKey?: string;
}

export interface PmRecurrenceCycleSummary {
  slotKey: string;
  organizationsConsidered: number;
  organizationsSkipped: number;
  occurrencesCreated: number;
  plansWithoutOccurrences: number;
  plansWithOpenOccurrence: number;
  beyondHorizonCount: number;
}

const pmJobType = "pm_recurrence";
const pmActorName = `${workerName} PM recurrence worker`;

/** Per-organization job-run status: failed only when every item this org processed failed. */
function jobRunStatus(processed: number, failed: number): "succeeded" | "failed" {
  return processed > 0 && failed >= processed ? "failed" : "succeeded";
}

function insertStatement(table: string, values: Record<string, unknown>) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  return { sql: `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(() => "?").join(", ")})`, params: entries.map(([, value]) => value) };
}

export async function runPmRecurrenceCycle(
  services: OpsCommandServices,
  options: PmRecurrenceOptions = {},
): Promise<PmRecurrenceCycleSummary> {
  const repository = services.repository;
  const clock = services.clock ?? { now: () => new Date().toISOString() };
  const ids = services.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  const now = clock.now();
  const slotKey = options.slotKey ?? now.slice(0, 10);
  const horizonDays = Math.max(1, Math.floor(options.horizonDays ?? 45));
  const summary: PmRecurrenceCycleSummary = { slotKey, organizationsConsidered: 0, organizationsSkipped: 0, occurrencesCreated: 0, plansWithoutOccurrences: 0, plansWithOpenOccurrence: 0, beyondHorizonCount: 0 };
  const plansByOrganization = new Map<string, typeof plans>();
  const plans = await repository.listAllPmPlansForWorker();
  for (const plan of plans) {
    const bucket = plansByOrganization.get(plan.organizationId);
    if (bucket) bucket.push(plan);
    else plansByOrganization.set(plan.organizationId, [plan]);
  }
  summary.organizationsConsidered = plansByOrganization.size;
  const horizon = Date.parse(now) + horizonDays * 24 * 60 * 60 * 1000;
  for (const [organizationId, orgPlans] of plansByOrganization) {
    const jobRunId = ids.next("job");
    const began = await repository.tryBeginJobRun({ organizationId, jobRunId, jobType: pmJobType, slotKey, startedAt: clock.now() });
    if (!began) { summary.organizationsSkipped += 1; continue; }
    let processed = 0;
    let failed = 0;
    for (const plan of orgPlans) {
      try {
        const occurrences = await repository.listPmOccurrencesForPlan(organizationId, plan.id);
        if (occurrences.length === 0) { summary.plansWithoutOccurrences += 1; continue; }
        const last = occurrences.reduce((latest, row) => (row.dueAt >= latest.dueAt ? row : latest), occurrences[0]);
        if (!(last.status === "completed_early" || last.status === "completed_on_time" || last.status === "completed")) { summary.plansWithOpenOccurrence += 1; continue; }
        const candidateDueAt = new Date(Date.parse(last.dueAt) + plan.cadenceDays * 24 * 60 * 60 * 1000).toISOString();
        const recurrenceKey = candidateDueAt.slice(0, 10);
        if (occurrences.some((row) => row.recurrenceKey === recurrenceKey)) continue;
        if (Date.parse(candidateDueAt) > horizon) { summary.beyondHorizonCount += 1; continue; }
        const windowEndsAt = new Date(Date.parse(candidateDueAt) + Math.max(1, plan.completionWindowDays) * 24 * 60 * 60 * 1000).toISOString();
        const occurrenceId = ids.next("pm-occurrence");
        const occurredAt = clock.now();
        const payload = JSON.stringify({ planId: plan.id, dueAt: candidateDueAt, recurrenceKey, sourceOccurrenceId: last.id });
        await repository.atomicWrite([
          insertStatement("ops_pm_occurrences", { id: occurrenceId, organization_id: organizationId, plan_id: plan.id, store_id: last.storeId, asset_id: last.assetId ?? null, program_id: last.programId ?? null, program_version: last.programVersion ?? null, plan_version: last.planVersion ?? null, due_at: candidateDueAt, window_starts_at: candidateDueAt, window_ends_at: windowEndsAt, status: "upcoming", recurrence_key: recurrenceKey, created_at: occurredAt }),
          insertStatement("ops_audit_events", { id: ids.next("audit"), organization_id: organizationId, aggregate_type: "pm_occurrence", aggregate_id: occurrenceId, event_type: "pm_occurrence.recurrence_scheduled", actor_type: "system", actor_name: pmActorName, occurred_at: occurredAt, payload_json: payload }),
          insertStatement("ops_outbox_messages", { id: ids.next("outbox"), organization_id: organizationId, topic: "ops.pm_occurrence.recurrence_scheduled", aggregate_type: "pm_occurrence", aggregate_id: occurrenceId, payload_json: payload, status: "pending", available_at: occurredAt, created_at: occurredAt, attempt_count: 0 }),
        ]);
        summary.occurrencesCreated += 1;
      } catch {
        failed += 1;
      }
      processed += 1;
    }
    await repository.finishJobRun({ organizationId, jobRunId, status: jobRunStatus(processed, failed), finishedAt: clock.now(), processedCount: processed, failedCount: failed });
  }
  return summary;
}

export interface VendorComplianceCycleSummary {
  slotKey: string;
  organizationsConsidered: number;
  organizationsSkipped: number;
  vendorsConsidered: number;
  quietNoticesCreated: number;
  actionNoticesCreated: number;
  expiredNoticesCreated: number;
  remindersCreated: number;
  failedCount: number;
}

const complianceJobType = "vendor_compliance_expiry";
const complianceActorName = `${workerName} vendor compliance worker`;
const dayMs = 24 * 60 * 60 * 1000;

function complianceStage(expiresAt: string, currentTime: string): VendorComplianceAlertStage | undefined {
  const days = Math.ceil((Date.parse(expiresAt) - Date.parse(currentTime)) / dayMs);
  if (days <= 0) return "expired";
  if (days <= 7) return "7_day";
  if (days <= 14) return "14_day";
  if (days <= 30) return "30_day";
  if (days <= 60) return "60_day";
  return undefined;
}

function currentApprovedComplianceDocuments(rows: VendorComplianceDocument[]) {
  const byVendorAndType = new Map<string, VendorComplianceDocument[]>();
  for (const row of rows.filter((candidate) => candidate.reviewStatus === "approved" && candidate.expiresAt)) {
    const key = `${row.organizationId}:${row.vendorId}:${row.documentType}`;
    byVendorAndType.set(key, [...(byVendorAndType.get(key) ?? []), row]);
  }
  return [...byVendorAndType.values()].map((records) => [...records]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0]!);
}

/**
 * Creates one low-noise vendor-level compliance notice per daily cycle while
 * preserving document-level facts for audit and routing. Sixty-day notices
 * are dashboard-only; 30/14/7-day and expired notices enter the outbox.
 */
export async function runVendorComplianceCycle(
  services: OpsCommandServices,
  options: { slotKey?: string } = {},
): Promise<VendorComplianceCycleSummary> {
  const repository = services.repository;
  const clock = services.clock ?? { now: () => new Date().toISOString() };
  const ids = services.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  const currentTime = clock.now();
  const slotKey = options.slotKey ?? currentTime.slice(0, 10);
  const documents = currentApprovedComplianceDocuments(await repository.listAllVendorComplianceDocumentsForWorker());
  const byOrganization = new Map<string, VendorComplianceDocument[]>();
  for (const document of documents) byOrganization.set(document.organizationId, [...(byOrganization.get(document.organizationId) ?? []), document]);
  const summary: VendorComplianceCycleSummary = { slotKey, organizationsConsidered: byOrganization.size, organizationsSkipped: 0, vendorsConsidered: 0, quietNoticesCreated: 0, actionNoticesCreated: 0, expiredNoticesCreated: 0, remindersCreated: 0, failedCount: 0 };

  for (const [organizationId, organizationDocuments] of byOrganization) {
    const jobRunId = ids.next("job");
    const began = await repository.tryBeginJobRun({ organizationId, jobRunId, jobType: complianceJobType, slotKey, startedAt: currentTime });
    if (!began) { summary.organizationsSkipped += 1; continue; }
    let processed = 0;
    let failed = 0;
    const byVendor = new Map<string, VendorComplianceDocument[]>();
    for (const document of organizationDocuments) byVendor.set(document.vendorId, [...(byVendor.get(document.vendorId) ?? []), document]);
    summary.vendorsConsidered += byVendor.size;
    for (const [vendorId, vendorDocuments] of byVendor) {
      processed += 1;
      try {
        const existingAlerts = await repository.listVendorComplianceAlerts(organizationId, vendorId);
        const existingKeys = new Set(existingAlerts.map((alert) => `${alert.documentId}:${alert.stage}`));
        const due = vendorDocuments.map((document) => ({ document, stage: complianceStage(document.expiresAt!, currentTime) }))
          .filter((row): row is { document: VendorComplianceDocument; stage: VendorComplianceAlertStage } => Boolean(row.stage))
          .filter((row) => !existingKeys.has(`${row.document.id}:${row.stage}`));
        if (!due.length) continue;
        const actionable = due.some((row) => row.stage !== "60_day");
        const existingReminderId = existingAlerts.find((alert) => alert.reminderId)?.reminderId;
        const reminderId = actionable ? existingReminderId ?? ids.next("vendor-reminder") : undefined;
        const statements = due.map(({ document, stage }) => insertStatement("ops_vendor_compliance_alerts", { id: ids.next("compliance-alert"), organization_id: organizationId, vendor_id: vendorId, document_id: document.id, stage, expires_at: document.expiresAt, reminder_id: reminderId ?? null, created_at: currentTime }));
        if (actionable && !existingReminderId) {
          statements.push(insertStatement("ops_vendor_reminders", { id: reminderId, organization_id: organizationId, vendor_id: vendorId, title: "Renew customer-required vendor documents", note: "Review the expiring document records and record the replacement without deleting prior evidence.", accountable_party: "Facilities administrator", due_at: due.map((row) => row.document.expiresAt!).sort()[0], escalation_to: "Facilities director", status: "open", created_by_actor_type: "system", created_by_name: complianceActorName, created_at: currentTime }));
          summary.remindersCreated += 1;
        }
        const payload = JSON.stringify({ vendorId, documents: due.map(({ document, stage }) => ({ documentId: document.id, documentType: document.documentType, reference: document.reference, expiresAt: document.expiresAt, stage, blocking: document.blocking })), routingEffect: due.some(({ document, stage }) => document.blocking && stage === "expired") ? "new_routine_work_paused_active_jobs_unchanged" : "no_automatic_work_change" });
        statements.push(insertStatement("ops_audit_events", { id: ids.next("audit"), organization_id: organizationId, aggregate_type: "vendor", aggregate_id: vendorId, event_type: "vendor.compliance_notice_created", actor_type: "system", actor_name: complianceActorName, occurred_at: currentTime, payload_json: payload }));
        if (actionable) statements.push(insertStatement("ops_outbox_messages", { id: ids.next("outbox"), organization_id: organizationId, topic: "ops.vendor.compliance_due", aggregate_type: "vendor", aggregate_id: vendorId, payload_json: payload, status: "pending", available_at: currentTime, created_at: currentTime, attempt_count: 0 }));
        await repository.atomicWrite(statements);
        summary.quietNoticesCreated += due.filter((row) => row.stage === "60_day").length;
        summary.actionNoticesCreated += due.filter((row) => row.stage !== "60_day").length;
        summary.expiredNoticesCreated += due.filter((row) => row.stage === "expired").length;
      } catch {
        failed += 1;
        summary.failedCount += 1;
      }
    }
    await repository.finishJobRun({ organizationId, jobRunId, status: jobRunStatus(processed, failed), finishedAt: clock.now(), processedCount: processed, failedCount: failed });
  }
  return summary;
}
