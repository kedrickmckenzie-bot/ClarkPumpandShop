import { routeAndIssueWorkOrder, OpsDomainError } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { emailRuntimeFromEnvironment, sendVendorServiceAuthorizationEmail } from "@/lib/ops/email-delivery";

const channels = new Set(["email", "sms", "print", "manual"]);

function createRawToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const { id: workOrderId } = await params;
    const formData = await request.formData();
    const workOrder = await context.repository.getWorkOrder(context.session.organizationId, workOrderId);
    if (!workOrder) throw new OpsDomainError("NOT_FOUND", "Work order was not found in your organization.");
    await assertStoreInSessionScope(context.session, workOrder.storeId);
    if (["closed", "cancelled", "completed_pending_review", "resolved"].includes(workOrder.status)) {
      throw new OpsDomainError("CONFLICT", "Closed or completed work cannot be issued again.");
    }

    const vendorId = formText(formData, "vendorId", { required: true, max: 120 });
    const vendor = await context.repository.getVendor(context.session.organizationId, vendorId);
    if (!vendor || vendor.status !== "approved") {
      throw new OpsDomainError("VALIDATION", "Choose an approved vendor.");
    }
    const store = await context.repository.getStore(context.session.organizationId, workOrder.storeId);
    if (!store) throw new OpsDomainError("NOT_FOUND", "Store was not found in your organization.");
    const covered = await context.repository.vendorCoversStore(
      context.session.organizationId,
      vendor.id,
      workOrder.storeId,
    );
    if (!covered) throw new OpsDomainError("FORBIDDEN", "This vendor is not approved for the selected store.");

    const channel = formText(formData, "channel", { required: true, max: 20 });
    if (!channels.has(channel)) throw new OpsDomainError("VALIDATION", "Choose a supported delivery method.");
    const expectedRevisionText = formText(formData, "expectedRevision", { required: true, max: 12 });
    const expectedRevision = Number(expectedRevisionText);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new OpsDomainError("VALIDATION", "Expected issuance revision is invalid.");
    }

    const rawToken = createRawToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const asset = workOrder.assetId
      ? await context.repository.getAsset(context.session.organizationId, workOrder.assetId)
      : null;
    const issued = await routeAndIssueWorkOrder(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        workOrderId: workOrder.id,
        vendorId: vendor.id,
        expectedRevision,
        channel: channel as "email" | "sms" | "print" | "manual",
        authorizationSnapshot: {
          organizationName: context.session.organizationName,
          workOrderNumber: workOrder.number,
          store: {
            id: store.id,
            storeNumber: store.storeNumber,
            name: store.name,
            formattedAddress: [store.address1, store.address2, `${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", "),
          },
          vendor: { id: vendor.id, name: vendor.name },
          problem: workOrder.problem,
          priority: workOrder.priority,
          authorizedScope: workOrder.authorizedScope,
          categoryKey: workOrder.categoryKey,
          asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined,
          requestedTiming: workOrder.dueAt,
          nte: workOrder.nte,
          dispatchMessage: formText(formData, "message", { max: 1_000 }) || undefined,
          billingInstruction: `Include operator work-order number ${workOrder.number} on service paperwork and invoices.`,
        },
        publicToken: { tokenHash, expiresAt },
        actor: context.actor,
      },
    );

    if (channel === "email") {
      const runtime = emailRuntimeFromEnvironment({ EMAIL_PROVIDER: process.env.EMAIL_PROVIDER, EMAIL_API_KEY: process.env.EMAIL_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM, EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL });
      const actionUrl = new URL(`/public/service/${encodeURIComponent(rawToken)}`, runtime.baseUrl).toString();
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
            organizationName: context.session.organizationName,
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
      await context.repository.atomicWrite([{
        sql: "INSERT INTO ops_audit_events (id, organization_id, aggregate_type, aggregate_id, event_type, actor_type, actor_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params: [`audit-email-${crypto.randomUUID()}`, context.session.organizationId, "work_order", workOrder.id, eventType, "system", "Transactional email delivery", attemptedAt, JSON.stringify(payload)],
      }]);
      return relativeRedirect303(`/app/work-orders/${encodeURIComponent(workOrder.id)}?view=service&notice=${encodeURIComponent(notice)}`);
    }

    return relativeRedirect303(`/public/service/${encodeURIComponent(rawToken)}`);
  } catch (error) {
    return opsApiError(error);
  }
}
