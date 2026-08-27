import type { OpsRepository } from "./repository";
import type { NotificationEventKey, NotificationRecipient, NotificationRecipientRole, OutboxMessage, ServiceRun, Store, WorkOrder } from "./types";
import type { OutboxDeliveryMessage, OutboxDeliveryTransport } from "./outbox-delivery";

export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  replyTo?: string;
}

export interface TransactionalEmailProvider {
  readonly name: string;
  send(email: TransactionalEmail): Promise<{ messageId: string }>;
}

export interface EmailEnvironment {
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

export interface EmailRuntime {
  provider: TransactionalEmailProvider | null;
  baseUrl: string;
  configured: boolean;
  providerLabel: string;
  missing: string[];
}

function cleanBaseUrl(value: string | undefined) {
  const candidate = value?.trim() || "http://localhost:3000";
  try { return new URL(candidate).origin; } catch { return "http://localhost:3000"; }
}

export function emailRuntimeFromEnvironment(
  environment: EmailEnvironment,
  fetcher: typeof fetch = fetch,
): EmailRuntime {
  const providerName = environment.EMAIL_PROVIDER?.trim().toLocaleLowerCase("en-US") ?? "";
  const apiKey = environment.EMAIL_API_KEY?.trim() ?? "";
  const from = environment.EMAIL_FROM?.trim() ?? "";
  const missing = [!providerName && "EMAIL_PROVIDER", !apiKey && "EMAIL_API_KEY", !from && "EMAIL_FROM"].filter((value): value is string => Boolean(value));
  if (providerName && providerName !== "resend") missing.push("EMAIL_PROVIDER=resend");
  const configured = missing.length === 0;
  return {
    provider: configured ? createResendEmailProvider({ apiKey, from, replyTo: environment.EMAIL_REPLY_TO?.trim(), fetcher }) : null,
    baseUrl: cleanBaseUrl(environment.NEXT_PUBLIC_SITE_URL),
    configured,
    providerLabel: providerName === "resend" ? "Resend" : providerName || "Not configured",
    missing,
  };
}

export function createResendEmailProvider(input: {
  apiKey: string;
  from: string;
  replyTo?: string;
  fetcher?: typeof fetch;
}): TransactionalEmailProvider {
  const fetcher = input.fetcher ?? fetch;
  return {
    name: "resend",
    async send(email) {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": email.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({
          from: input.from,
          to: [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          reply_to: email.replyTo ?? input.replyTo,
        }),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`Resend rejected the message (${response.status}): ${body.slice(0, 500)}`);
      }
      let parsed: { id?: unknown } = {};
      try { parsed = JSON.parse(body) as { id?: unknown }; } catch { /* handled below */ }
      if (typeof parsed.id !== "string" || !parsed.id) throw new Error("Resend did not return a message id");
      return { messageId: parsed.id };
    },
  };
}

export function escapeEmailHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function sendVendorServiceAuthorizationEmail(input: {
  provider: TransactionalEmailProvider;
  vendorEmail: string;
  vendorName: string;
  organizationName: string;
  workOrder: WorkOrder;
  storeLabel: string;
  authorizedScope?: string;
  actionUrl: string;
  replyTo?: string;
  issuanceId: string;
}) {
  const subject = `${input.organizationName} service authorization ${input.workOrder.number}`;
  const nte = input.workOrder.nte ? new Intl.NumberFormat("en-US", { style: "currency", currency: input.workOrder.nte.currency }).format(input.workOrder.nte.amountMinor / 100) : "Not specified";
  const text = [
    `Hello ${input.vendorName},`,
    "",
    `${input.organizationName} issued service authorization ${input.workOrder.number} for ${input.storeLabel}.`,
    `Problem: ${input.workOrder.problem}`,
    `Authorized scope: ${input.authorizedScope || "See the authorization"}`,
    `Not-to-exceed amount: ${nte}`,
    "",
    `Open the secure authorization: ${input.actionUrl}`,
    "",
    `Include ${input.workOrder.number} on service paperwork and invoices.`,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:680px"><p>Hello ${escapeEmailHtml(input.vendorName)},</p><p><strong>${escapeEmailHtml(input.organizationName)}</strong> issued service authorization <strong>${escapeEmailHtml(input.workOrder.number)}</strong> for ${escapeEmailHtml(input.storeLabel)}.</p><table style="border-collapse:collapse;width:100%;margin:20px 0"><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Problem</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.workOrder.problem)}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Authorized scope</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(input.authorizedScope || "See the authorization")}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b">Not to exceed</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeEmailHtml(nte)}</td></tr></table><p><a href="${escapeEmailHtml(input.actionUrl)}" style="display:inline-block;background:#2457d6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Open secure authorization</a></p><p style="color:#475569">Include <strong>${escapeEmailHtml(input.workOrder.number)}</strong> on service paperwork and invoices.</p></div>`;
  return input.provider.send({ to: input.vendorEmail, subject, text, html, replyTo: input.replyTo, idempotencyKey: `service-authorization/${input.issuanceId}/${input.vendorEmail}` });
}

export async function sendVendorStoreSweepEmail(input: {
  provider: TransactionalEmailProvider;
  vendorEmail: string;
  vendorName: string;
  organizationName: string;
  run: ServiceRun;
  store: Store;
  workOrders: WorkOrder[];
  actionUrl: string;
  replyTo?: string;
}) {
  const label = `Store ${input.store.storeNumber} · ${input.store.name}`;
  const neededBy = input.run.neededByAt
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: input.store.timeZone }).format(new Date(input.run.neededByAt))
    : "the earliest job review date";
  const subject = `${input.organizationName} approved jobs · Store ${input.store.storeNumber}`;
  const jobs = input.workOrders.map((workOrder) => `${workOrder.number} — ${workOrder.problem}`);
  const text = [
    `Hello ${input.vendorName},`,
    "",
    `${input.organizationName} is sending approved jobs for ${label} together.`,
    `Requested completion by: ${neededBy}. Your company chooses the visit date, crew, route, and time onsite.`,
    `${jobs.length} already-approved ${jobs.length === 1 ? "job is" : "jobs are"} included:`,
    ...jobs.map((job) => `• ${job}`),
    "",
    `Review the jobs, choose your planned date, and respond: ${input.actionUrl}`,
    "",
    "Each job keeps its own operator work-order number for service paperwork and invoicing.",
  ].join("\n");
  const jobRows = input.workOrders.map((workOrder) => `<li style="margin:0 0 9px"><strong>${escapeEmailHtml(workOrder.number)}</strong> — ${escapeEmailHtml(workOrder.problem)}</li>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:680px"><p>Hello ${escapeEmailHtml(input.vendorName)},</p><p><strong>${escapeEmailHtml(input.organizationName)}</strong> is sending approved jobs for <strong>${escapeEmailHtml(label)}</strong> together.</p><p>Requested completion by <strong>${escapeEmailHtml(neededBy)}</strong>. Your company chooses the visit date, crew, route, and time onsite.</p><p>${jobs.length} already-approved ${jobs.length === 1 ? "job is" : "jobs are"} included:</p><ul style="padding-left:22px">${jobRows}</ul><p><a href="${escapeEmailHtml(input.actionUrl)}" style="display:inline-block;background:#2457d6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Review jobs and choose a date</a></p><p style="color:#475569">Each job keeps its own operator work-order number for service paperwork and invoicing.</p></div>`;
  return input.provider.send({
    to: input.vendorEmail,
    subject,
    text,
    html,
    replyTo: input.replyTo,
    idempotencyKey: `store-sweep/${input.run.id}/${input.vendorEmail}`,
  });
}

const topicRules: Array<{ matches(topic: string): boolean; eventKey: NotificationEventKey }> = [
  { matches: (topic) => ["ops.vendor.accepted", "ops.service_run.vendor_accepted", "ops.service_run.counter_accepted"].includes(topic), eventKey: "vendor_commitment_received" },
  { matches: (topic) => ["ops.vendor.declined", "ops.vendor.proposed_date", "ops.vendor.question"].includes(topic) || topic.startsWith("ops.service_run.vendor_"), eventKey: "vendor_response_received" },
  { matches: (topic) => topic === "ops.workflow_task.escalated", eventKey: "workflow_task_escalated" },
  { matches: (topic) => topic === "ops.follow_up.created", eventKey: "follow_up_created" },
  { matches: (topic) => topic === "ops.vendor.reminder_created", eventKey: "vendor_reminder_created" },
  { matches: (topic) => topic === "ops.held_work.claimed", eventKey: "held_work_claimed" },
  { matches: (topic) => topic === "ops.held_work.outcomes_recorded", eventKey: "held_work_outcomes_recorded" },
  { matches: (topic) => topic === "ops.vendor.compliance_due", eventKey: "vendor_compliance_due" },
];

export function notificationEventForTopic(topic: string): NotificationEventKey | undefined {
  return topicRules.find((rule) => rule.matches(topic))?.eventKey;
}

function payload(message: OutboxDeliveryMessage) {
  try { return JSON.parse(message.payloadJson) as Record<string, unknown>; } catch { return {}; }
}

interface NotificationWorkContext {
  workOrder: WorkOrder;
  store: Store;
  kind: "PM" | "Reactive";
  arrivalAt: string | undefined;
}

interface NotificationContext {
  serviceRun?: ServiceRun;
  vendor?: Awaited<ReturnType<OpsRepository["getVendor"]>>;
  vendorName?: string;
  work: NotificationWorkContext[];
}

interface RecipientGroup {
  recipient: NotificationRecipient;
  work: NotificationWorkContext[];
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function loadNotificationContext(repository: OpsRepository, message: OutboxDeliveryMessage): Promise<NotificationContext> {
  const values = payload(message);
  if (message.topic === "ops.vendor.compliance_due") {
    const vendor = await repository.getVendor(message.organizationId, message.aggregateId);
    return { vendor: vendor ?? undefined, vendorName: vendor?.name, work: [] };
  }
  if (message.topic.startsWith("ops.held_work.")) {
    const workOrderIds = Array.isArray(values.workOrderIds) ? values.workOrderIds.filter((id): id is string => typeof id === "string") : [];
    const workRows = await Promise.all(workOrderIds.map(async (workOrderId): Promise<NotificationWorkContext | null> => {
      const workOrder = await repository.getWorkOrder(message.organizationId, workOrderId);
      const store = workOrder ? await repository.getStore(message.organizationId, workOrder.storeId) : null;
      return workOrder && store ? { workOrder, store, kind: "Reactive" as const, arrivalAt: undefined } : null;
    }));
    const work = workRows.filter((row): row is NotificationWorkContext => row !== null);
    const vendorId = typeof values.vendorId === "string" ? values.vendorId : undefined;
    const vendor = vendorId ? await repository.getVendor(message.organizationId, vendorId) : null;
    return { vendor: vendor ?? undefined, vendorName: vendor?.name, work };
  }
  if (message.aggregateType === "service_run" || message.topic.startsWith("ops.service_run.")) {
    const run = await repository.getServiceRun(message.organizationId, message.aggregateId);
    if (!run) return { work: [] };
    const [links, stops, vendor] = await Promise.all([
      repository.listServiceRunWorkOrders(message.organizationId, run.id),
      repository.listRouteStops(message.organizationId, run.id),
      repository.getVendor(message.organizationId, run.vendorId),
    ]);
    const work = (await Promise.all(links.filter((link) => link.planned).map(async (link) => {
      const workOrder = await repository.getWorkOrder(message.organizationId, link.workOrderId);
      if (!workOrder) return null;
      const store = await repository.getStore(message.organizationId, workOrder.storeId);
      if (!store) return null;
      const stop = stops.find((candidate) => candidate.id === link.routeStopId);
      return { workOrder, store, kind: link.occurrenceId ? "PM" as const : "Reactive" as const, arrivalAt: stop?.committedArrivalAt ?? stop?.proposedArrivalAt };
    }))).filter((row): row is NotificationWorkContext => row !== null);
    return { serviceRun: run, vendorName: vendor?.name, work };
  }
  const workOrderId = typeof values.workOrderId === "string" ? values.workOrderId : message.aggregateType === "work_order" ? message.aggregateId : undefined;
  const workOrder = workOrderId ? await repository.getWorkOrder(message.organizationId, workOrderId) : null;
  const store = workOrder ? await repository.getStore(message.organizationId, workOrder.storeId) : null;
  const assignment = typeof values.assignmentId === "string" ? await repository.getAssignment(message.organizationId, values.assignmentId) : null;
  const vendor = assignment?.vendorId ? await repository.getVendor(message.organizationId, assignment.vendorId) : null;
  return { vendorName: vendor?.name, work: workOrder && store ? [{ workOrder, store, kind: "Reactive", arrivalAt: undefined }] : [] };
}

async function recipientGroups(repository: OpsRepository, message: OutboxDeliveryMessage, role: NotificationRecipientRole, context: NotificationContext): Promise<RecipientGroup[]> {
  if (role !== "store_manager" && role !== "regional_manager") {
    return (await repository.listNotificationRecipients(message.organizationId, role)).map((recipient) => ({ recipient, work: context.work }));
  }
  const groups = new Map<string, RecipientGroup>();
  for (const item of context.work) {
    const recipients = await repository.listNotificationRecipients(message.organizationId, role, { storeId: item.store.id, regionId: item.store.regionId });
    for (const recipient of recipients) {
      const group = groups.get(recipient.membershipId) ?? { recipient, work: [] };
      group.work.push(item);
      groups.set(recipient.membershipId, group);
    }
  }
  return [...groups.values()].map((group) => ({ ...group, work: [...new Map(group.work.map((item) => [item.workOrder.id, item])).values()] }));
}

function storeLabel(store: Store) {
  return `Store ${store.storeNumber} · ${store.name}`;
}

function formatWhen(value: string | undefined, timeZone?: string) {
  if (!value) return undefined;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: timeZone || "America/New_York", timeZoneName: "short" }).format(new Date(value));
}

function notificationCopy(eventKey: NotificationEventKey, message: OutboxDeliveryMessage, context: NotificationContext, work: NotificationWorkContext[]) {
  const values = payload(message);
  const record = work[0]?.workOrder.number ?? String(values.workOrderId ?? message.aggregateId);
  const stores = uniqueById(work.map((item) => item.store));
  const scopeLabel = stores.length === 1 ? storeLabel(stores[0]!) : `${stores.length} stores`;
  const workLabel = work.length === 1 ? record : `${work.length} work orders`;
  if (eventKey === "vendor_commitment_received") {
    const vendorName = context.vendorName ?? "The vendor";
    const startsAt = context.serviceRun?.committedStartsAt ?? context.serviceRun?.proposedStartsAt;
    const when = formatWhen(startsAt, stores[0]?.timeZone);
    const mix = [...new Set(work.map((item) => item.kind))].join(" and ");
    const combinedStoreVisit = context.serviceRun?.schedulerVersion === "store-sweep-v1";
    return {
      subject: `${vendorName} accepted work · ${scopeLabel}`,
      headline: combinedStoreVisit ? "The vendor supplied its planned visit date" : context.serviceRun ? "A vendor service schedule is confirmed" : "A vendor accepted the service authorization",
      detail: `${vendorName} accepted ${workLabel}${stores.length ? ` for ${scopeLabel}` : ""}${mix ? ` (${mix})` : ""}.${when ? ` Planned start: ${when}.` : " A service date has not been recorded yet."}`,
    };
  }
  if (eventKey === "vendor_response_received") return { subject: `Vendor response received · ${record}`, headline: "A vendor response needs review", detail: `${workLabel}${stores.length ? ` · ${scopeLabel}` : ""}. Response: ${String(values.response ?? message.topic.replace("ops.vendor.", "").replace("ops.service_run.vendor_", "")).replaceAll("_", " ")}.` };
  if (eventKey === "held_work_claimed") return { subject: `${context.vendorName ?? "Vendor"} selected approved held work · ${scopeLabel}`, headline: "Additional approved work is in progress", detail: `${context.vendorName ?? "The vendor"} selected ${Number(values.completeCount ?? 0)} item(s) approved for completion and ${Number(values.inspectCount ?? 0)} item(s) for inspection at ${scopeLabel}. Final cost has not been recorded.` };
  if (eventKey === "held_work_outcomes_recorded") return { subject: `Held-work results recorded · ${scopeLabel}`, headline: "Additional onsite work has been recorded", detail: `${scopeLabel}: ${Number(values.completed ?? 0)} completed, ${Number(values.temporaryRepair ?? 0)} temporary repair, ${Number(values.inspectionCaptured ?? 0)} inspection, and ${Number(values.notAttempted ?? 0)} not attempted. No price or invoice amount is implied by these counts.` };
  if (eventKey === "vendor_compliance_due") {
    const documents = Array.isArray(values.documents) ? values.documents as Array<Record<string, unknown>> : [];
    const expired = documents.filter((document) => document.stage === "expired").length;
    return { subject: `${context.vendorName ?? "Vendor"} compliance ${expired ? "expired" : "renewal due"}`, headline: expired ? "A customer-required vendor document has expired" : "Vendor documents need renewal", detail: `${context.vendorName ?? "This vendor"} has ${documents.length} compliance document${documents.length === 1 ? "" : "s"} requiring attention. ${values.routingEffect === "new_routine_work_paused_active_jobs_unchanged" ? "New routine assignments are paused; active jobs are unchanged." : "No active work was changed."}` };
  }
  const recordContext = `${workLabel}${stores.length ? ` · ${scopeLabel}` : ""}`;
  if (eventKey === "workflow_task_escalated") return { subject: `Overdue action escalated · ${record}`, headline: "An accountable action was escalated", detail: `${recordContext}. ${String(values.reason ?? "The response window expired.")}` };
  if (eventKey === "follow_up_created") return { subject: `Service follow-up created · ${record}`, headline: "A follow-up now has an accountable owner", detail: `${recordContext}. Due ${String(values.dueAt ?? "date recorded in the platform")}.` };
  return { subject: "Vendor relationship reminder created", headline: "A vendor relationship reminder needs follow-up", detail: String(values.title ?? "Open the vendor record for the due date and accountable owner.") };
}

export function createNotificationEmailTransport(input: {
  repository: OpsRepository;
  provider: TransactionalEmailProvider | null;
  baseUrl: string;
  sink?: (line: string) => void;
}): OutboxDeliveryTransport {
  const sink = input.sink ?? ((line: string) => console.log(line));
  return {
    name: input.provider ? `email:${input.provider.name}` : "email:not-configured",
    async deliver(message) {
      const eventKey = notificationEventForTopic(message.topic);
      if (!eventKey) {
        sink(JSON.stringify({ channel: "ops.outbox.delivery", transport: "operational-log", messageId: message.id, topic: message.topic, notification: "not_routed" }));
        return;
      }
      const rules = (await input.repository.listNotificationRules(message.organizationId)).filter((candidate) => candidate.eventKey === eventKey && candidate.emailEnabled);
      const context = await loadNotificationContext(input.repository, message);
      const vendorComplianceRecipient = eventKey === "vendor_compliance_due" ? context.vendor : undefined;
      if (!rules.length && !vendorComplianceRecipient) {
        sink(JSON.stringify({ channel: "ops.notification.skipped", messageId: message.id, eventKey, reason: "no_enabled_rule" }));
        return;
      }
      if (!input.provider) throw new Error(`Email delivery is enabled for ${eventKey}, but no email provider is configured`);
      let delivered = 0;
      if (vendorComplianceRecipient) {
        const copy = notificationCopy(eventKey, message, context, []);
        const text = `${copy.headline}\n\n${copy.detail}\n\nPlease send the renewed document to your customer contact. The prior record remains preserved while a replacement is reviewed.`;
        const html = `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:680px"><p>Hello ${escapeEmailHtml(vendorComplianceRecipient.name)},</p><h2>${escapeEmailHtml(copy.headline)}</h2><p>${escapeEmailHtml(copy.detail)}</p><p>Please send the renewed document to your customer contact. The prior record remains preserved while a replacement is reviewed.</p></div>`;
        const result = await input.provider.send({ to: vendorComplianceRecipient.dispatchEmail, subject: copy.subject, text, html, idempotencyKey: `${message.id}/vendor-dispatch/${vendorComplianceRecipient.id}` });
        delivered += 1;
        sink(JSON.stringify({ channel: "ops.notification.delivered", transport: input.provider.name, messageId: message.id, providerMessageId: result.messageId, eventKey, recipientRole: "vendor_dispatch", vendorId: vendorComplianceRecipient.id }));
      }
      for (const rule of rules) {
        const groups = await recipientGroups(input.repository, message, rule.recipientRole, context);
        if (!groups.length) {
          sink(JSON.stringify({ channel: "ops.notification.missing_recipient", messageId: message.id, eventKey, recipientRole: rule.recipientRole }));
          continue;
        }
        for (const group of groups) {
          const copy = notificationCopy(eventKey, message, context, group.work);
          const workOrder = group.work[0]?.workOrder ?? context.work[0]?.workOrder;
          const href = eventKey === "vendor_reminder_created" || eventKey === "vendor_compliance_due" ? `/app/vendors/${encodeURIComponent(message.aggregateId)}` : workOrder ? `/app/work-orders/${encodeURIComponent(workOrder.id)}?view=service` : "/app/action-center";
          const actionUrl = new URL(href, input.baseUrl).toString();
          const text = `${copy.headline}\n\n${copy.detail}\n\nOpen the supporting record: ${actionUrl}`;
          const html = `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:680px"><p>Hello ${escapeEmailHtml(group.recipient.displayName)},</p><h2>${escapeEmailHtml(copy.headline)}</h2><p>${escapeEmailHtml(copy.detail)}</p><p><a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;background:#2457d6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Open supporting record</a></p><p style="color:#64748b;font-size:13px">This notice was generated from source workflow records. Open the platform for the current accountable state.</p></div>`;
          const result = await input.provider.send({ to: group.recipient.email, subject: copy.subject, text, html, idempotencyKey: `${message.id}/${rule.recipientRole}/${group.recipient.membershipId}` });
          delivered += 1;
          sink(JSON.stringify({ channel: "ops.notification.delivered", transport: input.provider.name, messageId: message.id, providerMessageId: result.messageId, eventKey, recipientRole: rule.recipientRole, recipientMembershipId: group.recipient.membershipId }));
        }
      }
      if (!delivered) throw new Error(`No scoped email recipient is configured for ${eventKey}`);
    },
  };
}

export function outboxMessageAsRecord(message: OutboxMessage): OutboxDeliveryMessage {
  return { organizationId: message.organizationId, id: message.id, topic: message.topic, aggregateType: message.aggregateType, aggregateId: message.aggregateId, payloadJson: message.payloadJson, attemptCount: message.attemptCount ?? 0 };
}
