import Link from "next/link";
import type { NotificationEventKey, NotificationRecipientRole, NotificationRule } from "@/lib/ops/types";
import styles from "./setup-workspaces.module.css";

const events: Array<{ key: NotificationEventKey; label: string; description: string }> = [
  { key: "vendor_response_received", label: "Vendor response received", description: "Accept, decline, proposed date, or vendor question." },
  { key: "workflow_task_escalated", label: "Accountable action escalated", description: "The assigned response window expired and the next owner must act." },
  { key: "follow_up_created", label: "Service follow-up created", description: "A checkout outcome created a required next step." },
  { key: "vendor_reminder_created", label: "Vendor relationship reminder due", description: "A vendor-level reminder reached its due point." },
];
const roles: Array<{ value: NotificationRecipientRole; label: string }> = [
  { value: "facilities_admin", label: "Maintenance administrators" },
  { value: "regional_manager", label: "Regional managers" },
  { value: "executive", label: "Executives" },
  { value: "finance_reviewer", label: "Finance reviewers" },
];

export function NotificationSettings({ model, notice }: { model: { organizationName: string; rules: NotificationRule[]; providerConfigured: boolean; providerLabel: string; fromAddress?: string }; notice?: string }) {
  const byEvent = new Map(model.rules.map((rule) => [rule.eventKey, rule]));
  return <section className={styles.workspace}>
    <header className={styles.heading}><div><p>Company setup</p><h1>Notification delivery</h1><span>Choose which workflow events create email, and which accountable role receives it.</span></div><Link href="/app/admin">Back to setup</Link></header>
    {notice ? <div className={styles.notice}>{notice}</div> : null}
    <div className={model.providerConfigured ? styles.statusGood : styles.statusWarning}>
      <strong>{model.providerConfigured ? `${model.providerLabel} email is configured` : "Email provider is not configured"}</strong>
      <span>{model.providerConfigured ? `Messages send from ${model.fromAddress}. Delivery attempts remain visible in job health.` : "Rules can be prepared now, but enabled email will retry and surface a delivery failure until EMAIL_PROVIDER, EMAIL_API_KEY, and EMAIL_FROM are configured."}</span>
    </div>
    <div className={styles.tableWrap}><table><caption>Notification rules for {model.organizationName}</caption><thead><tr><th>Workflow event</th><th>Email</th><th>Recipients</th><th>Save</th></tr></thead><tbody>
      {events.map((event) => { const rule = byEvent.get(event.key); return <tr key={event.key}><td><strong>{event.label}</strong><small>{event.description}</small></td><td colSpan={3}><form className={styles.inlineForm} action="/api/ops/notification-rules" method="post"><input type="hidden" name="eventKey" value={event.key}/><label className={styles.toggle}><input type="checkbox" name="emailEnabled" defaultChecked={rule?.emailEnabled ?? false}/><span>Email enabled</span></label><label><span className={styles.srOnly}>Recipient role</span><select name="recipientRole" defaultValue={rule?.recipientRole ?? "facilities_admin"}>{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><button type="submit">Save rule</button></form></td></tr>; })}
    </tbody></table></div>
    <aside className={styles.explainer}><strong>Vendor authorizations are separate.</strong><span>When “Email” is selected while issuing a work order, the secure authorization is sent to that vendor&apos;s dispatch address. These rules control internal accountability notices.</span></aside>
  </section>;
}
