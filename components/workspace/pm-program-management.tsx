import Link from "next/link";
import { ArrowRight, CalendarRange, CheckCircle2, ChevronRight, CircleAlert, Layers3, SlidersHorizontal } from "lucide-react";
import styles from "./pm-program-management.module.css";

export interface PmProgramManagementModel {
  scopeLabel: string;
  canCreateMasterSchedule: boolean;
  summary: {
    activePrograms: number;
    matchingEquipment: number;
    enrolledPlans: number;
    coverageGaps: number;
    localOverrides: number;
  };
  programs: Array<{
    id: string;
    name: string;
    serviceAreaLabel: string;
    equipmentTypeLabels: string[];
    cadenceLabel: string;
    windowLabel: string;
    anchorLabel: string;
    matchingEquipment: number;
    enrolledPlans: number;
    coverageGaps: number;
    localOverrides: number;
    href: string;
    selected: boolean;
  }>;
  plans: Array<{
    id: string;
    planName: string;
    storeLabel: string;
    assetLabel: string;
    programName: string;
    cadenceLabel: string;
    sourceLabel: string;
    overrideReason?: string;
    href: string;
  }>;
}

export function PmProgramManagement({ model }: { model: PmProgramManagementModel }) {
  return (
    <section className={styles.workspace} aria-labelledby="pm-programs-title">
      <header className={styles.heading}>
        <div>
          <p>Company scheduling</p>
          <h2 id="pm-programs-title">Master PM schedules</h2>
          <span>Define the standard once, automatically cover matching equipment, and keep local exceptions visible.</span>
        </div>
        {model.canCreateMasterSchedule ? <Link href="/app/pm/programs/new">Create master schedule<ArrowRight size={16} aria-hidden="true" /></Link> : null}
      </header>

      <div className={styles.summary} aria-label="PM program coverage summary">
        <div><CalendarRange size={18} aria-hidden="true" /><span><small>Active schedules</small><strong>{model.summary.activePrograms}</strong></span></div>
        <div><Layers3 size={18} aria-hidden="true" /><span><small>Matching equipment</small><strong>{model.summary.matchingEquipment}</strong></span></div>
        <div><CheckCircle2 size={18} aria-hidden="true" /><span><small>Enrolled plans</small><strong>{model.summary.enrolledPlans}</strong></span></div>
        <div data-alert={model.summary.coverageGaps > 0 || undefined}><CircleAlert size={18} aria-hidden="true" /><span><small>Coverage gaps</small><strong>{model.summary.coverageGaps}</strong></span></div>
        <div><SlidersHorizontal size={18} aria-hidden="true" /><span><small>Store overrides</small><strong>{model.summary.localOverrides}</strong></span></div>
      </div>

      <div className={styles.tableWrap}>
        <table>
          <caption>Company preventive-maintenance schedules and equipment coverage</caption>
          <thead><tr><th>Master schedule</th><th>Equipment types</th><th>Default timing</th><th>Coverage</th><th>Store overrides</th><th><span className={styles.srOnly}>Open</span></th></tr></thead>
          <tbody>{model.programs.length ? model.programs.map((program) => (
            <tr data-selected={program.selected || undefined} key={program.id}>
              <td><Link href={program.href}><strong>{program.name}</strong><small>{program.serviceAreaLabel}</small></Link></td>
              <td><Link href={program.href}><strong>{program.equipmentTypeLabels.join(", ") || "No equipment types"}</strong><small>Auto-enrollment rule</small></Link></td>
              <td><Link href={program.href}><strong>{program.cadenceLabel}</strong><small>{program.windowLabel} · anchor {program.anchorLabel}</small></Link></td>
              <td><Link href={program.href}><strong>{program.enrolledPlans} of {program.matchingEquipment}</strong><small>{program.coverageGaps ? `${program.coverageGaps} equipment records need a plan` : "All matching equipment covered"}</small></Link></td>
              <td><Link href={program.href}><strong>{program.localOverrides}</strong><small>Documented store exceptions</small></Link></td>
              <td><Link aria-label={`Open ${program.name}`} href={program.href}><ChevronRight size={17} aria-hidden="true" /></Link></td>
            </tr>
          )) : <tr><td className={styles.empty} colSpan={6}><strong>No company schedules yet</strong><small>Create a master schedule to enroll matching equipment across the company automatically.</small></td></tr>}</tbody>
        </table>
      </div>

      <div className={styles.planHeader}>
        <div><h3>Store plans</h3><p>Every row inherits a company standard or remains visibly store-created. Open a row to adjust that store&apos;s future cadence.</p></div>
        <strong>{model.plans.length} shown</strong>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <caption>Store preventive-maintenance plans</caption>
          <thead><tr><th>Store / equipment</th><th>Master schedule</th><th>Current cadence</th><th>Schedule source</th><th><span className={styles.srOnly}>Open</span></th></tr></thead>
          <tbody>{model.plans.length ? model.plans.map((plan) => (
            <tr key={plan.id}>
              <td><Link href={plan.href}><strong>{plan.storeLabel}</strong><small>{plan.assetLabel}</small></Link></td>
              <td><Link href={plan.href}><strong>{plan.programName}</strong><small>{plan.planName}</small></Link></td>
              <td><Link href={plan.href}><strong>{plan.cadenceLabel}</strong>{plan.overrideReason ? <small>{plan.overrideReason}</small> : null}</Link></td>
              <td><Link href={plan.href}><span className={plan.overrideReason ? styles.override : styles.inherited}>{plan.sourceLabel}</span></Link></td>
              <td><Link aria-label={`Open ${plan.planName}`} href={plan.href}><ChevronRight size={17} aria-hidden="true" /></Link></td>
            </tr>
          )) : <tr><td className={styles.empty} colSpan={5}><strong>No store plans in this view</strong><small>Create a company schedule or change the current store/program filters.</small></td></tr>}</tbody>
        </table>
      </div>
    </section>
  );
}
