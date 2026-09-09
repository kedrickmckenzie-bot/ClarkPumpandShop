import Link from "next/link";
import type { ConfigurableMaintenanceCapability, OrganizationRole, OrganizationWorkflowPolicy, RoleCapabilityOverride } from "@/lib/ops/types";
import { defaultCapabilityEnabled } from "@/lib/ops/capability-policy";
import styles from "./setup-workspaces.module.css";

const capabilityRows: Array<{ value: ConfigurableMaintenanceCapability; label: string; description: string }> = [
  { value: "confirm_observable_result", label: "Confirm the store result", description: "Answer fixed, not fixed, or not sure for the reported problem. This is not technical certification." },
  { value: "create_work_order", label: "Create routine work orders", description: "Turn a store issue into a canonical work order within the role's assigned stores." },
  { value: "issue_work_order", label: "Dispatch routine work", description: "Send routine work within existing approval and NTE limits. Requires work-order creation." },
];

const roleOptions: Array<{ value: OrganizationRole; label: string }> = [
  { value: "store_manager", label: "Store managers" },
  { value: "regional_manager", label: "Regional managers" },
  { value: "facilities_admin", label: "Facilities administrators" },
];

export function MaintenanceResponsibilities({ model, notice }: { model: { organizationName: string; overrides: RoleCapabilityOverride[]; policy: OrganizationWorkflowPolicy | null }; notice?: string }) {
  return <section className={styles.workspace}>
    <header className={styles.heading}><div><p>Company setup</p><h1>Maintenance responsibilities</h1><span>Delegate a small set of routine maintenance actions by role. Store scope and approval limits still apply.</span></div><Link href="/app/admin">Back to setup</Link></header>
    {notice ? <div className={styles.notice}>{notice}</div> : null}
    <div className={styles.statusWarning}><strong>Dispatch has two safeguards</strong><span>A role must also be allowed to create work orders, and every dispatch remains subject to store scope, routine priority, vendor eligibility, approval policy, and NTE limits.</span></div>
    {roleOptions.map((role) => <form key={role.value} className={styles.controls} action="/api/ops/maintenance-responsibilities" method="post">
      <input type="hidden" name="role" value={role.value}/>
      <div><strong>{role.label}</strong><span>Responsibilities for {model.organizationName}</span></div>
      <div>{capabilityRows.map((capability) => {
        const override = model.overrides.find((row) => row.role === role.value && row.capability === capability.value);
        const checked = override?.enabled ?? defaultCapabilityEnabled(role.value, capability.value);
        return <label className={styles.toggle} key={capability.value}><input aria-label={`${role.label}: ${capability.label}`} type="checkbox" name="enabledCapability" value={capability.value} defaultChecked={checked}/><span><strong>{capability.label}</strong><small>{capability.description}</small></span></label>;
      })}</div>
      <div><label className={styles.toggle}><input aria-label={`${role.label}: close eligible routine work after confirmation`} type="checkbox" name="autoCloseRoutineAfterVerification" value="true" defaultChecked={model.policy?.autoCloseRoutineAfterVerification ?? false}/><span><strong>Close eligible routine work after confirmation</strong><small>Operational work closes only when there is no active visit, open operational follow-up, or other blocking operational task. Financial review stays open.</small></span></label><label className={styles.toggle}><input aria-label={`${role.label}: apply policy to active work`} type="checkbox" name="appliesToActiveWork" value="true" defaultChecked={model.policy?.appliesToActiveWork ?? false}/><span>Apply this version to already active eligible work</span></label><button type="submit">Save responsibilities</button></div>
    </form>)}
    <aside className={styles.explainer}><strong>Changes are organization-specific and audited.</strong><span>Removing access takes effect on the next request. Prior confirmations and policy versions remain attributable in history.</span></aside>
  </section>;
}
