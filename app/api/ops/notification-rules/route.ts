import type { NotificationEventKey, NotificationRecipientRole } from "@/lib/ops/types";
import { OpsDomainError } from "@/lib/ops/commands";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const events = new Set<NotificationEventKey>(["vendor_response_received", "vendor_commitment_received", "workflow_task_escalated", "follow_up_created", "vendor_reminder_created", "held_work_claimed", "held_work_outcomes_recorded", "vendor_compliance_due"]);
const roles = new Set<NotificationRecipientRole>(["facilities_admin", "store_manager", "regional_manager", "executive", "finance_reviewer"]);
export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext(["facilities"]);
    const form = await request.formData();
    const eventKey = formText(form, "eventKey", { required: true, max: 80 }) as NotificationEventKey;
    const enabledRoles = new Set(form.getAll("enabledRole").map(String));
    if (!events.has(eventKey) || [...enabledRoles].some((role) => !roles.has(role as NotificationRecipientRole))) throw new OpsDomainError("VALIDATION", "Choose supported notification recipients.");
    const occurredAt = new Date().toISOString();
    for (const recipientRole of roles) {
      await context.repository.upsertNotificationRule({ organizationId: context.session.organizationId, id: `notification-rule-${crypto.randomUUID()}`, eventKey, emailEnabled: enabledRoles.has(recipientRole), recipientRole, updatedByMembershipId: context.session.membershipId, occurredAt });
    }
    return relativeRedirect303(`/app/admin/notifications?notice=${encodeURIComponent("Notification rule saved.")}`);
  } catch (error) { return opsApiError(error); }
}
