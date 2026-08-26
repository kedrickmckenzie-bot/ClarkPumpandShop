import type { NotificationEventKey, NotificationRecipientRole } from "@/lib/ops/types";
import { OpsDomainError } from "@/lib/ops/commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const events = new Set<NotificationEventKey>(["vendor_response_received", "workflow_task_escalated", "follow_up_created", "vendor_reminder_created"]);
const roles = new Set<NotificationRecipientRole>(["facilities_admin", "regional_manager", "executive", "finance_reviewer"]);
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const form = await request.formData();
    const eventKey = formText(form, "eventKey", { required: true, max: 80 }) as NotificationEventKey;
    const recipientRole = formText(form, "recipientRole", { required: true, max: 40 }) as NotificationRecipientRole;
    if (!events.has(eventKey) || !roles.has(recipientRole)) throw new OpsDomainError("VALIDATION", "Choose a supported notification event and recipient role.");
    await context.repository.upsertNotificationRule({ organizationId: context.session.organizationId, id: `notification-rule-${crypto.randomUUID()}`, eventKey, emailEnabled: form.get("emailEnabled") === "on", recipientRole, updatedByMembershipId: context.session.membershipId, occurredAt: new Date().toISOString() });
    return relativeRedirect303(`/app/admin/notifications?notice=${encodeURIComponent("Notification rule saved.")}`);
  } catch (error) { return opsApiError(error); }
}
