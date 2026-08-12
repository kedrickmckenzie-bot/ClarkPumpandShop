import { NextResponse } from "next/server";
import { assignWorkOrder, issueWorkOrder, OpsDomainError } from "@/lib/ops/commands";
import {
  assertStoreInSessionScope,
  formText,
  getOpsRequestContext,
  opsApiError,
} from "@/lib/server/ops-request-context";

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
    if (["closed", "cancelled", "completed_pending_review"].includes(workOrder.status)) {
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

    const currentAssignment = await context.repository.getActiveAssignment(
      context.session.organizationId,
      workOrder.id,
    );
    if (currentAssignment?.kind === "internal") {
      throw new OpsDomainError("CONFLICT", "Internal work must be reassigned before it can be issued to a vendor.");
    }

    let assignment = currentAssignment;
    if (!assignment || assignment.kind === "choose_later" || assignment.vendorId !== vendor.id) {
      assignment = await assignWorkOrder(
        { repository: context.repository },
        {
          organizationId: context.session.organizationId,
          workOrderId: workOrder.id,
          kind: "outside_vendor",
          vendorId: vendor.id,
          actor: context.actor,
        },
      );
    }

    const channel = formText(formData, "channel", { required: true, max: 20 });
    if (!channels.has(channel)) throw new OpsDomainError("VALIDATION", "Choose a supported delivery method.");
    const latestIssuance = await context.repository.getLatestIssuanceForWorkOrder(
      context.session.organizationId,
      workOrder.id,
    );
    const currentRevision = latestIssuance?.revision ?? 0;
    const expectedRevisionText = formText(formData, "expectedRevision", { max: 12 });
    if (expectedRevisionText && Number(expectedRevisionText) !== currentRevision) {
      throw new OpsDomainError("CONFLICT", "This work order changed. Refresh before issuing a new revision.");
    }

    const rawToken = createRawToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const asset = workOrder.assetId
      ? await context.repository.getAsset(context.session.organizationId, workOrder.assetId)
      : null;
    await issueWorkOrder(
      { repository: context.repository },
      {
        organizationId: context.session.organizationId,
        workOrderId: workOrder.id,
        assignmentId: assignment.id,
        revision: currentRevision + 1,
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

    return NextResponse.redirect(
      new URL(`/public/service/${encodeURIComponent(rawToken)}`, request.url),
      303,
    );
  } catch (error) {
    return opsApiError(error);
  }
}
