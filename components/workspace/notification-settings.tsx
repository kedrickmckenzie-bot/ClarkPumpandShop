import Link from "next/link";
import type { NotificationEventKey, NotificationRecipientRole, NotificationRule } from "@/lib/ops/types";
import styles from "./setup-workspaces.module.css";

const events: Array<{ key: NotificationEventKey; label: string; description: string }> = [
  { key: "vendor_commitment_received", label: "Vendor accepted work", description: "A vendor accepted a reactive authorization or a proposed multi-store Service Run." },
  { key: "vendor_response_received", label: "Other vendor response received", description: "Decline, proposed date, question, or requested Service Run change." },
  { key: "workflow_task_escalated", label: "Accountable action escalated", description: "The assigned response window expired and the next owner must act." },
  { key: "follow_up_created", label: "Service follow-up created", description: "A checkout outcome created a required next step." },
  { key: "vendor_reminder_created", label: "Vendor reminder created", description: "A relationship-level reminder was added for a vendor." },
];
const roles: Array<{ value: NotificationRecipientRole; label: string }> = [
  { value: "facilities_admin", label: "Maintenance" },
  { value: "store_manager", label: "Affected store" },
  { value: "regional_manager", label: "Affected region" },
  { value: "executive", label: "Executives" },
  { value: "finance_reviewer", label: "Finance" },
];

function ruleKey(eventKey: NotificationEventKey, role: NotificationRecipientRole) {
  return `${eventKey}:${role}`;
}

export function NotificationSettings({ model, notice }: { model: { organizationName: string; rules: NotificationRule[]; providerConfigured: boolean; providerLabel: string; fromAddress?: string }; notice?: string }) {
  const byEventAndRole = new Map(model.rules.map((rule) => [ruleKey(rule.eventKey, rule.recipientRole), rule]));
  return <section className={styles.workspace}>
    <header className={styles.heading}><div><p>Company setup</p><h1>Notification delivery</h1><span>Choose which workflow events create email and who receives it.</span></div><Link href="/app/admin">Back to setup</Link></header>
    {notice ? <div className={styles.notice}>{notice}</div> : null}
    <div className={model.providerConfigured ? styles.statusGood : styles.statusWarning}>
      <strong>{model.providerConfigured ? `${model.providerLabel} email is configured` : "Email provider is not configured"}</strong>
      <span>{model.providerConfigured ? `Messages send from ${model.fromAddress}. Delivery attempts remain visible in job health.` : "Rules can be prepared now, but enabled email will retry and surface a delivery failure until EMAIL_PROVIDER, EMAIL_API_KEY, and EMAIL_FROM are configured."}</span>
    </div>
    <div className={`${styles.tableWrap} ${styles.notificationTable}`}><table><caption>Notification rules for {model.organizationName}</caption><thead><tr><th>Workflow event</th><th>Recipients</th><th>Save</th></tr></thead><tbody>
      {events.map((event) => <tr key={event.key}><td><strong>{event.label}</strong><small>{event.description}</small></td><td colSpan={2}><form className={`${styles.inlineForm} ${styles.recipientForm}`} action="/api/ops/notification-rules" method="post"><input type="hidden" name="eventKey" value={event.key}/>{roles.map((role) => <label className={styles.toggle} key={role.value}><input type="checkbox" name="enabledRole" value={role.value} defaultChecked={byEventAndRole.get(ruleKey(event.key, role.value))?.emailEnabled ?? false}/><span>{role.label}</span></label>)}<button type="submit">Save event</button></form></td></tr>)}
    </tbody></table></div>
    <aside className={styles.explainer}><strong>Only the people involved are notified.</strong><span>Affected-store and affected-region notices are bounded by access grants. Multi-store Service Runs produce one consolidated Maintenance notice and a store-specific notice for each participating store. Vendor authorizations remain separate and go to the selected vendor dispatch address.</span></aside>
  </section>;
}
