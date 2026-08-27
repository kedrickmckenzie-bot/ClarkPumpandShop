import { routeAndIssueWorkOrder, OpsDomainError } from "@/lib/ops/commands";
import { emailRuntimeFromEnvironment, sendVendorServiceAuthorizationEmail } from "@/lib/ops/email-delivery";
import type { OpsRepository } from "@/lib/ops/repository";
import type { ActorContext } from "@/lib/ops/types";

export type ServiceAuthorizationChannel = "email" | "sms" | "print" | "manual";

function createRawToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function issueWorkOrderToVendor(input: {
  repository: OpsRepository;
  organizationId: string;
  organizationName: string;
  workOrderId: string;
  vendorId: string;
  expectedRevision: number;
  channel: ServiceAuthorizationChannel;
  message?: string;
  actor: ActorContext;
}) {
  const [workOrder, vendor] = await Promise.all([
    input.repository.getWorkOrder(input.organizationId, input.workOrderId),
    input.repository.getVendor(input.organizationId, input.vendorId),
  ]);
  if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
  if (!vendor || vendor.status !== "approved") throw new OpsDomainError("VALIDATION", "Choose an approved vendor.");
  const store = await input.repository.getStore(input.organizationId, workOrder.storeId);
  if (!store) throw new OpsDomainError("NOT_FOUND", "Store was not found in your organization.");
  const asset = workOrder.assetId ? await input.repository.getAsset(input.organizationId, workOrder.assetId) : null;
  const rawToken = createRawToken();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const issued = await routeAndIssueWorkOrder(
    { repository: input.repository },
    {
      organizationId: input.organizationId,
      workOrderId: workOrder.id,
      vendorId: vendor.id,
      expectedRevision: input.expectedRevision,
      channel: input.channel,
      authorizationSnapshot: {
        organizationName: input.organizationName,
        workOrderNumber: workOrder.number,
        store: {
          id: store.id,
          storeNumber: store.storeNumber,
          name: store.name,
          formattedAddress: [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "),
          timeZone: store.timeZone,
        },
        vendor: { id: vendor.id, name: vendor.name },
        problem: workOrder.problem,
        priority: workOrder.priority,
        authorizedScope: workOrder.authorizedScope,
        categoryKey: workOrder.categoryKey,
        asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined,
        requestedTiming: workOrder.dueAt,
        nte: workOrder.nte,
        dispatchMessage: input.message,
        billingInstruction: `Include operator work-order number ${workOrder.number} on service paperwork and invoices.`,
      },
      publicToken: { tokenHash, expiresAt },
      actor: input.actor,
    },
  );
  const publicPath = `/public/service/${encodeURIComponent(rawToken)}`;
  if (input.channel !== "email") {
    return { issued, workOrder, vendor, store, publicPath, notice: `Authorization ${workOrder.number} was issued.` };
  }

  const runtime = emailRuntimeFromEnvironment({
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  const actionUrl = new URL(publicPath, runtime.baseUrl).toString();
  const attemptedAt = new Date().toISOString();
  let eventType = "work_order.email_delivery_failed";
  let payload: Record<string, unknown> = {
    issuanceId: issued.issuance.id,
    vendorId: vendor.id,
    recipient: vendor.dispatchEmail,
    provider: runtime.providerLabel,
  };
  let notice = "The authorization was issued, but email delivery is not configured. Open Administration → Notifications before using live vendor addresses.";
  if (runtime.provider) {
    try {
      const delivery = await sendVendorServiceAuthorizationEmail({
        provider: runtime.provider,
        vendorEmail: vendor.dispatchEmail,
        vendorName: vendor.name,
        organizationName: input.organizationName,
        workOrder,
        storeLabel: `Store ${store.storeNumber} · ${store.name}`,
        authorizedScope: workOrder.authorizedScope,
        actionUrl,
        replyTo: process.env.EMAIL_REPLY_TO,
        issuanceId: issued.issuance.id,
      });
      eventType = "work_order.email_delivered";
      payload = { ...payload, providerMessageId: delivery.messageId };
      notice = `Authorization ${workOrder.number} was emailed to ${vendor.name}.`;
    } catch (error) {
      payload = { ...payload, error: (error instanceof Error ? error.message : String(error)).slice(0, 500) };
      notice = `Authorization ${workOrder.number} was issued, but the email could not be delivered. Review notification status before reissuing.`;
    }
  } else {
    payload = { ...payload, missingConfiguration: runtime.missing };
  }
  await input.repository.atomicWrite([{
    sql: "INSERT INTO ops_audit_events (id, organization_id, aggregate_type, aggregate_id, event_type, actor_type, actor_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    params: [`audit-email-${crypto.randomUUID()}`, input.organizationId, "work_order", workOrder.id, eventType, "system", "Transactional email delivery", attemptedAt, JSON.stringify(payload)],
  }]);
  return { issued, workOrder, vendor, store, publicPath, notice };
}
