import type { OpsRepository } from "./repository";
import type { NotificationEventKey, OutboxMessage, WorkOrder } from "./types";
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

const topicRules: Array<{ matches(topic: string): boolean; eventKey: NotificationEventKey }> = [
  { matches: (topic) => ["ops.vendor.accepted", "ops.vendor.declined", "ops.vendor.proposed_date", "ops.vendor.question"].includes(topic), eventKey: "vendor_response_received" },
  { matches: (topic) => topic === "ops.workflow_task.escalated", eventKey: "workflow_task_escalated" },
  { matches: (topic) => topic === "ops.follow_up.created", eventKey: "follow_up_created" },
  { matches: (topic) => topic === "ops.vendor.reminder_created", eventKey: "vendor_reminder_created" },
];

export function notificationEventForTopic(topic: string): NotificationEventKey | undefined {
  return topicRules.find((rule) => rule.matches(topic))?.eventKey;
}

function payload(message: OutboxDeliveryMessage) {
  try { return JSON.parse(message.payloadJson) as Record<string, unknown>; } catch { return {}; }
}

function notificationCopy(eventKey: NotificationEventKey, message: OutboxDeliveryMessage, workOrder: WorkOrder | null, storeName?: string) {
  const values = payload(message);
  const record = workOrder?.number ?? String(values.workOrderId ?? message.aggregateId);
  const context = storeName ? `${record} · ${storeName}` : record;
  if (eventKey === "vendor_response_received") return { subject: `Vendor response received · ${record}`, headline: "A vendor response needs review", detail: `${context}. Response: ${String(values.response ?? message.topic.replace("ops.vendor.", "")).replaceAll("_", " ")}.` };
  if (eventKey === "workflow_task_escalated") return { subject: `Overdue action escalated · ${record}`, headline: "An accountable action was escalated", detail: `${context}. ${String(values.reason ?? "The response window expired.")}` };
  if (eventKey === "follow_up_created") return { subject: `Service follow-up created · ${record}`, headline: "A follow-up now has an accountable owner", detail: `${context}. Due ${String(values.dueAt ?? "date recorded in the platform")}.` };
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
      const rule = (await input.repository.listNotificationRules(message.organizationId)).find((candidate) => candidate.eventKey === eventKey);
      if (!rule?.emailEnabled) {
        sink(JSON.stringify({ channel: "ops.notification.skipped", messageId: message.id, eventKey, reason: rule ? "email_disabled" : "no_rule" }));
        return;
      }
      if (!input.provider) throw new Error(`Email delivery is enabled for ${eventKey}, but no email provider is configured`);
      const values = payload(message);
      const workOrderId = typeof values.workOrderId === "string" ? values.workOrderId : message.aggregateType === "work_order" ? message.aggregateId : undefined;
      const workOrder = workOrderId ? await input.repository.getWorkOrder(message.organizationId, workOrderId) : null;
      const store = workOrder ? await input.repository.getStore(message.organizationId, workOrder.storeId) : null;
      const recipients = await input.repository.listNotificationRecipients(message.organizationId, rule.recipientRole);
      if (!recipients.length) throw new Error(`No active ${rule.recipientRole} email recipient is configured`);
      const copy = notificationCopy(eventKey, message, workOrder, store ? `Store ${store.storeNumber} · ${store.name}` : undefined);
      const href = eventKey === "vendor_reminder_created" ? `/app/vendors/${encodeURIComponent(message.aggregateId)}` : workOrder ? `/app/work-orders/${encodeURIComponent(workOrder.id)}?view=service` : "/app/action-center";
      const actionUrl = new URL(href, input.baseUrl).toString();
      for (const recipient of recipients) {
        const text = `${copy.headline}\n\n${copy.detail}\n\nOpen the supporting record: ${actionUrl}`;
        const html = `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.55;max-width:680px"><p>Hello ${escapeEmailHtml(recipient.displayName)},</p><h2>${escapeEmailHtml(copy.headline)}</h2><p>${escapeEmailHtml(copy.detail)}</p><p><a href="${escapeEmailHtml(actionUrl)}" style="display:inline-block;background:#2457d6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Open supporting record</a></p><p style="color:#64748b;font-size:13px">This notice was generated from source workflow records. Open the platform for the current accountable state.</p></div>`;
        const result = await input.provider.send({ to: recipient.email, subject: copy.subject, text, html, idempotencyKey: `${message.id}/${recipient.membershipId}` });
        sink(JSON.stringify({ channel: "ops.notification.delivered", transport: input.provider.name, messageId: message.id, providerMessageId: result.messageId, eventKey, recipientMembershipId: recipient.membershipId }));
      }
    },
  };
}

export function outboxMessageAsRecord(message: OutboxMessage): OutboxDeliveryMessage {
  return { organizationId: message.organizationId, id: message.id, topic: message.topic, aggregateType: message.aggregateType, aggregateId: message.aggregateId, payloadJson: message.payloadJson, attemptCount: message.attemptCount ?? 0 };
}
