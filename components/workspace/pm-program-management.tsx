import Link from "next/link";
import { ArrowRight, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, FileSearch, Layers3 } from "lucide-react";
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
    evidenceReviews: number;
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
    dueOccurrences: number;
    missedOccurrences: number;
    nextWindowLabel: string;
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
  planView: {
    mode: "exceptions" | "all" | "store";
    title: string;
    description: string;
    resultLabel: string;
    toggleHref?: string;
    toggleLabel?: string;
    previousHref?: string;
    nextHref?: string;
  };
  reconciliations: Array<{
    id: string;
    programName: string;
    storeLabel: string;
    periodLabel: string;
    billedUnits: number;
    observedVisits: number;
    missingEvidence: number;
    invoicedAmountLabel: string;
    reviewAmountLabel: string;
    invoiceHref: string;
    occurrencesHref: string;
    note: string;
  }>;
}

export function PmProgramManagement({ model }: { model: PmProgramManagementModel }) {
  return (
    <section className={styles.workspace} aria-labelledby="pm-programs-title">
      <header className={styles.heading}>
        <div>
          <p>Company scheduling</p>
          <h2 id="pm-programs-title">Master PM schedules</h2>
          <span>Define the standard once, automatically cover matching equipment, and keep store-specific schedule changes visible.</span>
        </div>
        {model.canCreateMasterSchedule ? <Link href="/app/pm/programs/new">Create master schedule<ArrowRight size={16} aria-hidden="true" /></Link> : null}
      </header>

      <div className={styles.summary} aria-label="PM program coverage summary">
        <Link href="#pm-programs-title"><CalendarRange size={18} aria-hidden="true" /><span><small>Active schedules</small><strong>{model.summary.activePrograms}</strong><em>Open schedules</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        <Link href="#pm-programs-title"><Layers3 size={18} aria-hidden="true" /><span><small>Matching equipment</small><strong>{model.summary.matchingEquipment}</strong><em>Review coverage rules</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        <Link href="/app/pm?enrollments=all#store-pm-plans"><CheckCircle2 size={18} aria-hidden="true" /><span><small>Enrolled plans</small><strong>{model.summary.enrolledPlans}</strong><em>Open store schedules</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        <Link data-alert={model.summary.coverageGaps > 0 || undefined} href="#pm-programs-title"><CircleAlert size={18} aria-hidden="true" /><span><small>Coverage gaps</small><strong>{model.summary.coverageGaps}</strong><em>Open coverage details</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        <Link data-alert={model.summary.evidenceReviews > 0 || undefined} href={model.summary.evidenceReviews ? "#pm-evidence-review-title" : "/app/pm?view=attention"}><FileSearch size={18} aria-hidden="true" /><span><small>Evidence reviews</small><strong>{model.summary.evidenceReviews}</strong><em>{model.summary.evidenceReviews ? "Open evidence review" : "Open PM review"}</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
      </div>

      <div className={styles.tableWrap}>
        <table>
          <caption>Company preventive-maintenance schedules and equipment coverage</caption>
          <thead><tr><th>Master schedule</th><th>Coverage rule</th><th>Default timing</th><th>Coverage</th><th>Current obligations</th><th><span className={styles.srOnly}>Open</span></th></tr></thead>
          <tbody>{model.programs.length ? model.programs.map((program) => (
            <tr data-selected={program.selected || undefined} key={program.id}>
              <td><Link href={program.href}><strong>{program.name}</strong><small>{program.serviceAreaLabel}</small></Link></td>
              <td><Link href={program.href}><strong>{program.equipmentTypeLabels.join(", ") || "No equipment types"}</strong><small>Auto-enrollment rule</small></Link></td>
              <td><Link href={program.href}><strong>{program.cadenceLabel}</strong><small>{program.windowLabel} · anchor {program.anchorLabel}</small></Link></td>
              <td><Link href={program.href}><strong>{program.enrolledPlans} of {program.matchingEquipment}</strong><small>{program.coverageGaps ? `${program.coverageGaps} equipment records need a plan` : "All matching equipment covered"}</small></Link></td>
              <td><Link href={program.href}><strong>{program.missedOccurrences ? `${program.missedOccurrences} missed` : program.dueOccurrences ? `${program.dueOccurrences} due` : "On track"}</strong><small>{program.dueOccurrences ? `${program.dueOccurrences} currently due · ` : ""}{program.nextWindowLabel}</small></Link></td>
              <td><Link aria-label={`Open ${program.name}`} href={program.href}><ChevronRight size={17} aria-hidden="true" /></Link></td>
            </tr>
          )) : <tr><td className={styles.empty} colSpan={6}><strong>No company schedules yet</strong><small>Create a master schedule to enroll matching equipment across the company automatically.</small></td></tr>}</tbody>
        </table>
      </div>

      {model.reconciliations.length ? <section className={styles.reconciliation} aria-labelledby="pm-evidence-review-title">
        <header><div><p>Invoice safeguard</p><h3 id="pm-evidence-review-title">PM billed versus observed visits</h3><span>A missing platform visit is a review fact—not proof that service was not performed.</span></div><FileSearch size={22} aria-hidden="true" /></header>
        {model.reconciliations.map((item) => <article key={item.id}>
          <div><strong>{item.storeLabel} · {item.programName}</strong><span>{item.periodLabel}</span></div>
          <dl><div><dt>Billed service units</dt><dd>{item.billedUnits}</dd></div><div><dt>Observed PM visits</dt><dd>{item.observedVisits}</dd></div><div data-alert={item.missingEvidence > 0 || undefined}><dt>Without visit evidence</dt><dd>{item.missingEvidence}</dd></div><div><dt>Amount to reconcile</dt><dd>{item.reviewAmountLabel}</dd></div></dl>
          <p>{item.note} Total invoiced service in this comparison: {item.invoicedAmountLabel}.</p>
          <footer><Link href={item.occurrencesHref}>Open PM occurrences<ArrowRight size={15} aria-hidden="true" /></Link><Link href={item.invoiceHref}>Open supporting invoice<ArrowRight size={15} aria-hidden="true" /></Link></footer>
        </article>)}
      </section> : null}

      <div className={styles.planHeader} id="store-pm-plans">
        <div><h3>{model.planView.title}</h3><p>{model.planView.description}</p></div>
        <div className={styles.planHeaderActions}><strong>{model.planView.resultLabel}</strong>{model.planView.toggleHref && model.planView.toggleLabel ? <Link href={model.planView.toggleHref}>{model.planView.toggleLabel}</Link> : null}</div>
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
      {model.planView.previousHref || model.planView.nextHref ? <nav className={styles.pagination} aria-label="Store plan pages"><span>{model.planView.resultLabel}</span><div>{model.planView.previousHref ? <Link href={model.planView.previousHref}><ChevronLeft size={15} aria-hidden="true" />Previous</Link> : <span aria-disabled="true"><ChevronLeft size={15} aria-hidden="true" />Previous</span>}{model.planView.nextHref ? <Link href={model.planView.nextHref}>Next<ChevronRight size={15} aria-hidden="true" /></Link> : <span aria-disabled="true">Next<ChevronRight size={15} aria-hidden="true" /></span>}</div></nav> : null}
    </section>
  );
}
