import { OpsDomainError } from "@/lib/ops/errors";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import { createStoreSweep } from "@/lib/ops/service-run-commands";
import { emailRuntimeFromEnvironment, sendVendorStoreSweepEmail } from "@/lib/ops/email-delivery";
import { assertStoreInSessionScope, formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

function safeReturnTo(value: string) {
  if (!value.startsWith("/app/work-orders") || value.startsWith("//")) return "/app/work-orders?visitPlan=ready";
  const parsed = new URL(value, "https://operator.invalid");
  return parsed.origin === "https://operator.invalid" && parsed.pathname === "/app/work-orders" ? `${parsed.pathname}${parsed.search}` : "/app/work-orders?visitPlan=ready";
}

function newActionToken() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities", "regional"]);
    const formData = await request.formData();
    const storeId = formText(formData, "storeId", { required: true, max: 120 });
    const vendorId = formText(formData, "vendorId", { required: true, max: 120 });
    const contractVersionId = formText(formData, "contractVersionId", { required: true, max: 120 });
    const returnTo = safeReturnTo(formText(formData, "returnTo", { max: 2_000 }));
    const workOrderIds = [...new Set(formData.getAll("workOrderId").filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))];
    if (!workOrderIds.length) throw new OpsDomainError("VALIDATION", "Choose at least one approved job for this store visit.");
    if (workOrderIds.length > 50) throw new OpsDomainError("VALIDATION", "Choose no more than 50 approved jobs for one store visit.");
    const store = await assertStoreInSessionScope(context.session, storeId);
    const [vendor, organization, workOrders] = await Promise.all([
      context.repository.getVendor(context.session.organizationId, vendorId),
      context.repository.getOrganization(context.session.organizationId),
      Promise.all(workOrderIds.map((id) => context.repository.getWorkOrder(context.session.organizationId, id))),
    ]);
    if (!vendor || vendor.status !== "approved") throw new OpsDomainError("VALIDATION", "Choose an approved vendor.");
    if (!organization) throw new OpsDomainError("NOT_FOUND", "Organization was not found.");
    if (workOrders.some((workOrder) => !workOrder)) throw new OpsDomainError("CONFLICT", "One of the selected jobs is no longer available.");
    const storeTimeZone = store.timeZone ?? "America/New_York";
    const responseDueAt = localDateTimeToIso(formText(formData, "responseDueAt", { required: true, max: 40 }), storeTimeZone);
    const rawToken = newActionToken();
    const result = await createStoreSweep({
      organizationId: context.session.organizationId,
      storeId,
      vendorId,
      contractVersionId,
      responseDueAt,
      accessRequirements: formText(formData, "accessRequirements", { max: 500 }) || undefined,
      work: workOrderIds.map((workOrderId) => ({ workOrderId })),
      publicToken: { tokenHash: await sha256(rawToken), expiresAt: responseDueAt },
      actor: context.actor,
    }, { repository: context.repository });
    const publicPath = `/public/service-run/${rawToken}`;
    const emailRuntime = emailRuntimeFromEnvironment({
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
      EMAIL_API_KEY: process.env.EMAIL_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    });
    let notice = `The approved jobs were sent together to ${vendor.name}. The vendor will choose the visit date.`;
    if (emailRuntime.provider) {
      try {
        await sendVendorStoreSweepEmail({
          provider: emailRuntime.provider,
          vendorEmail: vendor.dispatchEmail,
          vendorName: vendor.name,
          organizationName: organization.name,
          run: result.run,
          store,
          workOrders: workOrders.filter((row): row is NonNullable<typeof row> => Boolean(row)),
          actionUrl: `${emailRuntime.baseUrl}${publicPath}`,
          replyTo: process.env.EMAIL_REPLY_TO,
        });
        notice = `The approved jobs were emailed to ${vendor.name}. The vendor will choose the visit date.`;
      } catch (error) {
        console.error("Store-sweep email delivery failed", error);
        notice = `The visit was saved, but email delivery failed. Use the vendor link shown below.`;
      }
    } else {
      notice = `The visit was saved. Email delivery is not configured, so use the vendor link shown below.`;
    }
    return relativeRedirect303(`/app/store-sweeps/${encodeURIComponent(result.run.id)}?vendorLink=${encodeURIComponent(publicPath)}&notice=${encodeURIComponent(notice)}&returnTo=${encodeURIComponent(returnTo)}`);
  } catch (error) {
    return opsApiError(error);
  }
}
