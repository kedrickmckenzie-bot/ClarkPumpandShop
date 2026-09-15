import Link from "next/link";
import { ArrowRight, CalendarRange, CheckCircle2, ChevronRight, CircleAlert, FileSearch, Layers3 } from "lucide-react";
import type { PaginationViewModel } from "@/components/ops/data-contract";
import { PaginationControls } from "@/components/ops/pagination-controls";
import styles from "./pm-program-management.module.css";

export interface PmProgramManagementModel {
  scopeLabel: string;
  enrolledPlansHref?: string;
  attentionHref?: string;
  programsHref?: string;
  targetsHref?: string;
  gapsHref?: string;
  programPagination?: PaginationViewModel;
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
    coveredTargets?: number;
    coverageHref?: string;
    gapsHref?: string;
  }>;
  plans: Array<{
    id: string;
    planName: string;
    storeLabel: string;
    assetLabel: string;
    storeHref?: string;
    assetHref?: string;
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
    pagination?: PaginationViewModel;
  };
  canReviewInvoices?: boolean;
  reconciliationHref?: string;
  reconciliations: Array<{
    id:string; programName:string; storeLabel:string; periodLabel:string;
    invoiceCount:number; visitCount:number; missingCount:number; unavailableLinks:number;
    amountLabel:string; missingAmountLabel:string;
    href:string; invoicesHref:string; visitsHref:string; missingHref:string; missingAmountHref:string;
  }>;
}

export function PmProgramManagement({ model }: { model: PmProgramManagementModel }) {
  return (
    <section className={styles.workspace} aria-labelledby="pm-programs-title">
      <header className={styles.heading}>
        <div>

          <h2 id="pm-programs-title">Company schedules</h2>
          <span>Set shared timing and review store changes.</span>
        </div>
        {model.canCreateMasterSchedule ? <Link href="/app/pm/programs/new">Create company schedule<ArrowRight size={16} aria-hidden="true" /></Link> : null}
      </header>

      <div className={styles.summary} aria-label="PM program coverage summary">
        <Link href={model.programsHref ?? "#pm-programs-title"}><CalendarRange size={18} aria-hidden="true" /><span><small>Active schedules</small><strong>{model.summary.activePrograms}</strong><em>Open schedules</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        <Link href={model.targetsHref ?? "#pm-programs-title"}><Layers3 size={18} aria-hidden="true" /><span><small>Coverage targets</small><strong>{model.summary.matchingEquipment}</strong><em>Equipment and stores</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        <Link href={model.enrolledPlansHref ?? "/app/pm?enrollments=all#store-pm-plans"}><CheckCircle2 size={18} aria-hidden="true" /><span><small>Enrolled plans</small><strong>{model.summary.enrolledPlans}</strong><em>Open store schedules</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        <Link data-alert={model.summary.coverageGaps > 0 || undefined} href={model.gapsHref ?? "#pm-programs-title"}><CircleAlert size={18} aria-hidden="true" /><span><small>Coverage gaps</small><strong>{model.summary.coverageGaps}</strong><em>Open coverage details</em></span><ChevronRight size={15} aria-hidden="true" /></Link>
        {model.canReviewInvoices !== false ? <Link data-alert={model.summary.evidenceReviews > 0 || undefined} href={model.reconciliationHref ?? "#pm-evidence-review-title"}><FileSearch size={18} aria-hidden="true" /><span><small>Invoice reviews</small><strong>{model.summary.evidenceReviews}</strong><em>{model.summary.evidenceReviews ? "Open evidence review" : "Open PM review"}</em></span><ChevronRight size={15} aria-hidden="true" /></Link> : null}
      </div>

      <div className={styles.tableWrap}>
        <table>
          <caption>Company preventive-maintenance schedules and equipment coverage</caption>
          <thead><tr><th>Company schedule</th><th>Coverage rule</th><th>Default timing</th><th>Coverage</th><th>Current obligations</th><th><span className={styles.srOnly}>Open</span></th></tr></thead>
          <tbody>{model.programs.length ? model.programs.map((program) => (
            <tr data-selected={program.selected || undefined} key={program.id}>
              <td><Link href={program.href}><strong>{program.name}</strong><small>{program.serviceAreaLabel}</small></Link></td>
              <td><Link href={program.coverageHref ?? program.href}><strong>{program.equipmentTypeLabels.join(", ") || "No equipment types"}</strong><small>Review matching records</small></Link></td>
              <td><Link href={program.href}><strong>{program.cadenceLabel}</strong><small>{program.windowLabel} · anchor {program.anchorLabel}</small></Link></td>
              <td><Link href={program.coverageHref ?? program.href}><strong>{program.coveredTargets ?? program.enrolledPlans} of {program.matchingEquipment} covered</strong><small>{program.matchingEquipment ? program.coverageGaps ? `${program.coverageGaps} need a plan` : "All targets covered" : "No matching records"}</small></Link></td>
              <td><Link href={program.href}><strong>{program.missedOccurrences ? `${program.missedOccurrences} missed` : program.dueOccurrences ? `${program.dueOccurrences} due` : "On track"}</strong><small>{program.dueOccurrences ? `${program.dueOccurrences} currently due · ` : ""}{program.nextWindowLabel}</small></Link></td>
              <td><Link aria-label={`Open ${program.name}`} href={program.href}><ChevronRight size={17} aria-hidden="true" /></Link></td>
            </tr>
          )) : <tr><td className={styles.empty} colSpan={6}><strong>No company schedules in this scope</strong><small>Choose a different scope or create a company schedule.</small></td></tr>}</tbody>
        </table>
      </div>

      {model.programPagination ? <PaginationControls pagination={model.programPagination} label="Company schedule pages" /> : null}
      {model.canReviewInvoices !== false && model.reconciliations.length ? <section className={styles.reviewSection} aria-labelledby="pm-evidence-review-title">
        <header><div><h3 id="pm-evidence-review-title">PM invoice review</h3><p>Check linked invoices and visit evidence.</p></div><Link href={model.reconciliationHref ?? "#pm-evidence-review-title"}>All reviews ({model.summary.evidenceReviews})<ArrowRight size={16} aria-hidden="true" /></Link></header>
        <div className={styles.tableWrap}><table><caption>Open PM invoice reviews</caption><thead><tr><th>Store / schedule</th><th>Linked invoice amount</th><th>Recorded visits</th><th>Without visit evidence</th></tr></thead><tbody>{model.reconciliations.map(item=><tr key={item.id}>
          <td><Link href={item.href}><strong>{item.storeLabel}</strong><small>{item.programName}</small><small>{item.periodLabel}</small></Link></td>
          <td><Link href={item.invoicesHref}><strong>{item.amountLabel}</strong><small>{item.invoiceCount} invoices</small></Link></td>
          <td><Link href={item.visitsHref}><strong>{item.visitCount} visits</strong><small>{item.unavailableLinks ? `${item.unavailableLinks} links unavailable` : "Open visit records"}</small></Link></td>
          <td><Link href={item.missingHref}><strong>{item.missingCount} PM windows</strong><small>Open windows without visits</small></Link><Link href={item.missingAmountHref}><strong>{item.missingAmountLabel}</strong><small>Linked invoice amount</small></Link></td>
        </tr>)}</tbody></table></div>
      </section> : null}
      <div className={styles.planHeader} id="store-pm-plans">
        <div><h3>{model.planView.title}</h3><p>{model.planView.description}</p></div>
        <div className={styles.planHeaderActions}><strong>{model.planView.resultLabel}</strong>{model.planView.toggleHref && model.planView.toggleLabel ? <Link href={model.planView.toggleHref}>{model.planView.toggleLabel}</Link> : null}</div>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <caption>Store preventive-maintenance plans</caption>
          <thead><tr><th>Store / equipment</th><th>Company schedule</th><th>Current cadence</th><th>Schedule source</th><th><span className={styles.srOnly}>Open</span></th></tr></thead>
          <tbody>{model.plans.length ? model.plans.map((plan) => (
            <tr key={plan.id}>
              <td><Link href={plan.storeHref ?? plan.href}><strong>{plan.storeLabel}</strong></Link>{plan.assetHref ? <Link href={plan.assetHref}><small>{plan.assetLabel}</small></Link> : <small>{plan.assetLabel}</small>}</td>
              <td><Link href={plan.href}><strong>{plan.programName}</strong>{plan.planName !== plan.programName ? <small>{plan.planName}</small> : null}</Link></td>
              <td><Link href={plan.href}><strong>{plan.cadenceLabel}</strong>{plan.overrideReason ? <small>{plan.overrideReason}</small> : null}</Link></td>
              <td><Link href={plan.href}><span className={plan.overrideReason ? styles.override : styles.inherited}>{plan.sourceLabel}</span></Link></td>
              <td><Link aria-label={`Open ${plan.planName}`} href={plan.href}><ChevronRight size={17} aria-hidden="true" /></Link></td>
            </tr>
          )) : <tr><td className={styles.empty} colSpan={5}><strong>No store plans in this view</strong><small>Change the filters or create a plan.</small></td></tr>}</tbody>
        </table>
      </div>
      {model.planView.pagination ? <PaginationControls pagination={model.planView.pagination} label="Store plan pages" /> : null}
    </section>
  );
}
