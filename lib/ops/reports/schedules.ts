import type { OpsCommandServices } from "../commands";
import type { OpsRepository, OpsStatement } from "../repository";
import type { ActorContext } from "../types";
import { OpsDomainError } from "../errors";
import { civilDate, exactStoreInstant } from "../dispatch-calendar";
import { addDays } from "./period";
import { isPeriodKey, resolvePeriod } from "./period";
import type { TransactionalEmailProvider } from "../email-delivery";
import type { OutboxDeliveryMessage } from "../outbox-delivery";
import { reportCatalogEntry } from "../report-catalog";
import { canOpenReport } from "./registry";
import type { ReportOptions } from "./options";

export type ScheduleFrequency = "weekly" | "monthly";
export type ScheduleStatus = "active" | "paused" | "removed";
/** Where a scheduled run's email stands. Email delivery is optional: without it, runs are still saved to open. */
export type RunDelivery = "queued" | "sent" | "email_not_set_up" | "no_recipients" | "failed";

export interface ReportSchedule {
  id: string;
  organizationId: string;
  reportId: string;
  title: string;
  optionsJson: string;
  frequency: ScheduleFrequency;
  /** 0 = Sunday … 6 = Saturday (weekly). */
  weekday?: number | null;
  /** 1–28 (monthly); 28 keeps every month valid. */
  monthDay?: number | null;
  sendHour: number;
  timeZone: string;
  /** Membership ids, as JSON. */
  recipientsJson: string;
  status: ScheduleStatus;
  version: number;
  createdByMembershipId?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
}

export interface ReportRun {
  id: string;
  organizationId: string;
  scheduleId: string;
  reportId: string;
  optionsJson: string;
  periodLabel: string;
  runAt: string;
  createdAt: string;
  deliveryStatus: RunDelivery;
  recipientCount: number;
  deliveredAt?: string | null;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;

export function scheduleLabel(s: Pick<ReportSchedule, "frequency" | "weekday" | "monthDay" | "sendHour">) {
  return s.frequency === "weekly" ? `Every ${WEEKDAYS[s.weekday ?? 1]} at ${hourLabel(s.sendHour)}` : `Monthly on the ${ordinal(s.monthDay ?? 1)} at ${hourLabel(s.sendHour)}`;
}

/** The next send time strictly after `after`, at the chosen local hour in the organization's zone. */
export function nextRunAt(s: Pick<ReportSchedule, "frequency" | "weekday" | "monthDay" | "sendHour" | "timeZone">, after: string) {
  const start = civilDate(after, s.timeZone);
  for (let i = 0; i < 62; i++) {
    const day = addDays(start, i);
    const date = new Date(`${day}T12:00:00Z`);
    const matches = s.frequency === "weekly" ? date.getUTCDay() === (s.weekday ?? 1) : date.getUTCDate() === (s.monthDay ?? 1);
    if (!matches) continue;
    const at = exactStoreInstant(`${day}T${String(s.sendHour).padStart(2, "0")}:00`, s.timeZone, "earlier");
    if (at > after) return at;
  }
  throw new OpsDomainError("VALIDATION", "Choose a valid schedule.");
}

const audit = (ids: { next(prefix: string): string }, organizationId: string, scheduleId: string, eventType: string, actor: ActorContext, at: string, payload: unknown): OpsStatement => ({
  sql: "INSERT INTO ops_audit_events (id, organization_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, actor_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  params: [ids.next("audit"), organizationId, "report_schedule", scheduleId, eventType, actor.actorType, actor.actorId ?? null, actor.actorName ?? null, at, JSON.stringify(payload)],
});

export interface ScheduleInput {
  organizationId: string;
  actor: ActorContext;
  reportId: string;
  options: ReportOptions;
  frequency: ScheduleFrequency;
  weekday?: number;
  monthDay?: number;
  sendHour: number;
  recipients: string[];
  /** The creator's role, checked against who may open the report. */
  role: string;
}

/** Saves a new schedule. Recipients must be active members of the organization; each sees only their own stores. */
export async function createReportSchedule(svc: OpsCommandServices, input: ScheduleInput) {
  const now = svc.clock?.now() ?? new Date().toISOString();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  const entry = reportCatalogEntry(input.reportId);
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user" || !input.actor.actorId) throw new OpsDomainError("FORBIDDEN", "Sign in to schedule reports.");
  if (!entry || entry.source.kind !== "built") throw new OpsDomainError("VALIDATION", "This report can't be scheduled.");
  if (!canOpenReport(entry, input.role)) throw new OpsDomainError("FORBIDDEN", "Your role can't open this report.");
  if (!["weekly", "monthly"].includes(input.frequency) || !Number.isInteger(input.sendHour) || input.sendHour < 0 || input.sendHour > 23) throw new OpsDomainError("VALIDATION", "Choose how often and what time.");
  if (input.frequency === "weekly" && !(Number.isInteger(input.weekday) && input.weekday! >= 0 && input.weekday! <= 6)) throw new OpsDomainError("VALIDATION", "Choose a day of the week.");
  if (input.frequency === "monthly" && !(Number.isInteger(input.monthDay) && input.monthDay! >= 1 && input.monthDay! <= 28)) throw new OpsDomainError("VALIDATION", "Choose a day from 1 to 28.");
  if (!isPeriodKey(input.options.period)) throw new OpsDomainError("VALIDATION", "Choose a period.");
  const recipients = [...new Set(input.recipients)].slice(0, 25);
  if (!recipients.length) throw new OpsDomainError("VALIDATION", "Choose at least one person to send it to.");
  for (const id of recipients) {
    const member = await svc.repository.getMembership(input.organizationId, id);
    if (!member || member.status !== "active") throw new OpsDomainError("VALIDATION", "One of the people chosen is no longer active.");
  }
  const organization = await svc.repository.getOrganization(input.organizationId);
  const timeZone = organization?.timeZone ?? "America/New_York";
  const schedule = { frequency: input.frequency, weekday: input.frequency === "weekly" ? input.weekday! : null, monthDay: input.frequency === "monthly" ? input.monthDay! : null, sendHour: input.sendHour, timeZone };
  const id = ids.next("report-schedule");
  const options: ReportOptions = { ...input.options, work: entry.audience === "both" ? input.options.work : entry.audience };
  const next = nextRunAt(schedule, now);
  await svc.repository.atomicWrite([
    { sql: "INSERT INTO ops_report_schedules (id, organization_id, report_id, title, options_json, frequency, weekday, month_day, send_hour, time_zone, recipients_json, status, version, created_by_membership_id, created_by_name, created_at, updated_at, next_run_at, last_run_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [id, input.organizationId, entry.id, entry.title, JSON.stringify(options), schedule.frequency, schedule.weekday, schedule.monthDay, schedule.sendHour, timeZone, JSON.stringify(recipients), "active", 0, input.actor.actorId, input.actor.actorName ?? "Team member", now, now, next, null] },
    audit(ids, input.organizationId, id, "report_schedule.created", input.actor, now, { reportId: entry.id, options, ...schedule, recipients }),
  ]);
  return { id, nextRunAt: next };
}

/** Pause, resume or remove a schedule. Version-fenced and audited; removed schedules stay on record. */
export async function changeReportSchedule(svc: OpsCommandServices, input: { organizationId: string; actor: ActorContext; scheduleId: string; action: "pause" | "resume" | "remove"; expectedVersion: number; role: string }) {
  const now = svc.clock?.now() ?? new Date().toISOString();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user") throw new OpsDomainError("FORBIDDEN", "Sign in to change schedules.");
  const schedule = await svc.repository.getReportSchedule(input.organizationId, input.scheduleId);
  if (!schedule || schedule.status === "removed") throw new OpsDomainError("NOT_FOUND", "Schedule not found.");
  // Leaders can manage every schedule; everyone else manages the ones they made.
  if (!["executive", "facilities"].includes(input.role) && schedule.createdByMembershipId !== input.actor.actorId) throw new OpsDomainError("FORBIDDEN", "Only the person who made this schedule can change it.");
  if (schedule.version !== input.expectedVersion) throw new OpsDomainError("CONFLICT", "This schedule changed. Refresh and try again.");
  const status: ScheduleStatus = input.action === "pause" ? "paused" : input.action === "resume" ? "active" : "removed";
  const next = status === "active" ? nextRunAt(schedule, now) : null;
  await svc.repository.atomicWrite([
    { sql: "UPDATE ops_report_schedules SET status = ?, next_run_at = ?, updated_at = ?, version = ? WHERE organization_id = ? AND id = ? AND version = ?", params: [status, next, now, schedule.version + 1, input.organizationId, schedule.id, schedule.version] },
    audit(ids, input.organizationId, schedule.id, `report_schedule.${input.action === "remove" ? "removed" : input.action === "pause" ? "paused" : "resumed"}`, input.actor, now, { from: schedule.status, to: status }),
  ]);
}

function runStatements(schedule: ReportSchedule, runAt: string, now: string, ids: { next(prefix: string): string }): { runId: string; statements: OpsStatement[] } {
  const runId = `report-run-${schedule.id}-${runAt.replace(/[^0-9]/g, "")}`;
  const options = JSON.parse(schedule.optionsJson) as ReportOptions;
  const period = resolvePeriod(options.period, civilDate(runAt, schedule.timeZone));
  const recipients = JSON.parse(schedule.recipientsJson) as string[];
  return { runId, statements: [
    { sql: "INSERT INTO ops_report_runs (id, organization_id, schedule_id, report_id, options_json, period_label, run_at, created_at, delivery_status, recipient_count, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [runId, schedule.organizationId, schedule.id, schedule.reportId, schedule.optionsJson, period.label, runAt, now, "queued", recipients.length, null] },
    { sql: "INSERT INTO ops_outbox_messages (id, organization_id, topic, aggregate_type, aggregate_id, payload_json, status, available_at, created_at, attempt_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      params: [ids.next("outbox"), schedule.organizationId, "ops.report.scheduled", "report_run", runId, JSON.stringify({ runId, scheduleId: schedule.id }), "pending", now, now, 0] },
  ] };
}

/**
 * Worker cycle: for each schedule that is due, save one run and queue its email, then move to the next send time.
 * Idempotent: the run id is fixed by schedule and send time, so a repeated cycle can't double-send.
 */
export async function runReportScheduleCycle(svc: OpsCommandServices, limit = 50) {
  const now = svc.clock?.now() ?? new Date().toISOString();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  const summary = { due: 0, queued: 0, skipped: 0, failed: 0 };
  for (const schedule of await svc.repository.listDueReportSchedules(now, limit)) {
    summary.due++;
    const runAt = schedule.nextRunAt!;
    try {
      const { runId, statements } = runStatements(schedule, runAt, now, ids);
      // A missed send (worker down) is sent once, then the schedule moves to its next future time.
      const advance = { sql: "UPDATE ops_report_schedules SET next_run_at = ?, last_run_at = ? WHERE organization_id = ? AND id = ? AND next_run_at = ?", params: [nextRunAt(schedule, runAt > now ? runAt : now), runAt, schedule.organizationId, schedule.id, runAt] };
      if (await svc.repository.getReportRun(schedule.organizationId, runId)) { await svc.repository.atomicWrite([advance]); summary.skipped++; continue; }
      await svc.repository.atomicWrite([...statements, advance]);
      summary.queued++;
    } catch {
      summary.failed++;
    }
  }
  return summary;
}

/** "Send now": saves a run right away (and queues its email) without changing the regular schedule. Audited. */
export async function runReportScheduleNow(svc: OpsCommandServices, input: { organizationId: string; actor: ActorContext; scheduleId: string; role: string }) {
  const now = svc.clock?.now() ?? new Date().toISOString();
  const ids = svc.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user") throw new OpsDomainError("FORBIDDEN", "Sign in to send reports.");
  const schedule = await svc.repository.getReportSchedule(input.organizationId, input.scheduleId);
  if (!schedule || schedule.status === "removed") throw new OpsDomainError("NOT_FOUND", "Schedule not found.");
  if (!["executive", "facilities"].includes(input.role) && schedule.createdByMembershipId !== input.actor.actorId) throw new OpsDomainError("FORBIDDEN", "Only the person who made this schedule can send it.");
  const { runId, statements } = runStatements(schedule, now, now, ids);
  if (await svc.repository.getReportRun(input.organizationId, runId)) return { runId };
  await svc.repository.atomicWrite([...statements, audit(ids, input.organizationId, schedule.id, "report_schedule.sent_now", input.actor, now, { runId })]);
  return { runId };
}

/**
 * Sends a run's email: the report name, period and a link. The numbers stay in the app, so each person sees only
 * the stores they may see. Without an email service the run is marked "email not set up" and stays openable.
 */
export async function deliverScheduledReport(input: { repository: OpsRepository; provider: TransactionalEmailProvider | null; baseUrl: string }, message: OutboxDeliveryMessage, now = new Date().toISOString()) {
  const { runId } = JSON.parse(message.payloadJson) as { runId: string };
  const run = await input.repository.getReportRun(message.organizationId, runId);
  const schedule = run ? await input.repository.getReportSchedule(message.organizationId, run.scheduleId) : null;
  if (!run || !schedule || run.deliveryStatus === "sent") return;
  const mark = (status: RunDelivery) => input.repository.atomicWrite([{ sql: "UPDATE ops_report_runs SET delivery_status = ?, delivered_at = ? WHERE organization_id = ? AND id = ?", params: [status, status === "sent" ? now : null, run.organizationId, run.id] }]);
  const people: Array<{ email: string; name: string }> = [];
  for (const id of JSON.parse(schedule.recipientsJson) as string[]) {
    const member = await input.repository.getMembership(run.organizationId, id);
    const entry = reportCatalogEntry(run.reportId);
    const user = member?.status === "active" ? await input.repository.getUserInOrganization(run.organizationId, member.userId) : null;
    // Someone whose role no longer opens the report is skipped rather than sent a link they can't use.
    if (member && user?.email && user.status === "active" && entry && canOpenReport(entry, operatorRoleFor(member.role))) people.push({ email: user.email, name: user.displayName });
  }
  if (!people.length) { await mark("no_recipients"); return; }
  if (!input.provider) { await mark("email_not_set_up"); return; }
  const href = new URL(`/app/reports/runs/${encodeURIComponent(run.id)}`, input.baseUrl).toString();
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  for (const person of people) {
    const text = `${schedule.title} · ${run.periodLabel}\n\nYour scheduled report is ready.\n\nOpen it: ${href}\n\nYou'll see the stores you have access to. You can print it or save it as a PDF from there.`;
    await input.provider.send({ to: person.email, subject: `${schedule.title} · ${run.periodLabel}`, text,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5"><p><strong>${escape(schedule.title)}</strong> · ${escape(run.periodLabel)}</p><p>Your scheduled report is ready.</p><p><a href="${escape(href)}">Open the report</a></p><p style="color:#5b6b80">You'll see the stores you have access to. You can print it or save it as a PDF from there.</p></div>`,
      idempotencyKey: `${message.id}/${person.email.toLowerCase()}` });
  }
  await mark("sent");
}

/** Organization role → the operator role reports are gated by. */
export function operatorRoleFor(role: string) {
  return role === "facilities_admin" ? "facilities" : role === "regional_manager" || role === "field_manager" ? "regional" : role === "finance_reviewer" ? "finance" : role === "internal_technician" ? "technician" : role;
}
