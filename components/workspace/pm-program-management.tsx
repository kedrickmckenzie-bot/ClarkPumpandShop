import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
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
    editHref?: string;
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
    invoiceCount:number; visitCount:number; missingCount:number; unavailableLinks:number; occurrenceCount?:number; completedCount?:number; occurrencesHref?:string;
    amountLabel:string; missingAmountLabel:string;
    href:string; invoicesHref:string; visitsHref:string; missingHref:string; missingAmountHref:string;
  }>;
}

export function PmProgramManagement({ model }: { model: PmProgramManagementModel }) {
  const counts = [
    { label: `${model.summary.enrolledPlans} store plans`, href: model.enrolledPlansHref ?? "/app/pm?enrollments=all#store-pm-plans" },
    { label: `${model.summary.coverageGaps} machines without a plan`, href: model.gapsHref ?? "#pm-programs-title", alert: model.summary.coverageGaps > 0 },
    ...(model.canReviewInvoices !== false ? [{ label: `${model.summary.evidenceReviews} invoice ${model.summary.evidenceReviews === 1 ? "review" : "reviews"}`, href: model.reconciliationHref ?? "#pm-evidence-review-title", alert: model.summary.evidenceReviews > 0 }] : []),
  ];
  return (
    <section className={styles.workspace} aria-labelledby="pm-programs-title">
      <header className={styles.heading}>
        <div><h2 id="pm-programs-title">Schedules</h2><nav className={styles.counts} aria-label="Schedule setup">{counts.map(count => <Link key={count.label} href={count.href} data-alert={count.alert || undefined}>{count.label}</Link>)}</nav></div>
      </header>

      <ol className={styles.rows}>{model.programs.length ? model.programs.map((program) => (
        <li key={program.id} data-selected={program.selected || undefined}>
          <Link href={program.href} className={styles.name}><strong>{program.name}</strong><small>{program.equipmentTypeLabels.join(", ") || program.serviceAreaLabel}</small></Link>
          <span><strong>{program.cadenceLabel}</strong><small>{program.nextWindowLabel.replace(/^Next window /i, "Next ")}</small></span>
          <Link href={program.coverageHref ?? program.href}><strong>{program.coveredTargets ?? program.enrolledPlans} of {program.matchingEquipment}</strong><small>{program.coverageGaps ? `${program.coverageGaps} not covered` : "All covered"}</small></Link>
          <Link href={program.href} data-state={program.missedOccurrences ? "missed" : program.dueOccurrences ? "due" : "ok"}><strong>{program.missedOccurrences ? `${program.missedOccurrences} missed` : program.dueOccurrences ? `${program.dueOccurrences} due` : "On track"}</strong></Link>
          {program.editHref ? <Link className={styles.edit} href={program.editHref}>Edit</Link> : <span />}
        </li>
      )) : <li className={styles.empty}>No company schedules here yet.</li>}</ol>
      {model.programPagination ? <PaginationControls pagination={model.programPagination} label="Company schedule pages" /> : null}

      {model.canReviewInvoices !== false && model.reconciliations.length ? <section className={styles.sub} aria-labelledby="pm-evidence-review-title">
        <header><h3 id="pm-evidence-review-title">Invoices to check against visits</h3><Link href={model.reconciliationHref ?? "#pm-evidence-review-title"}>All ({model.summary.evidenceReviews})<ArrowRight size={14} aria-hidden="true" /></Link></header>
        <ol className={styles.reviews}>{model.reconciliations.map((item) => <li key={item.id}>
          <Link href={item.href} className={styles.name}><strong>{item.storeLabel}</strong><small>{item.programName} · {item.periodLabel}</small></Link>
          <Link href={item.invoicesHref}><strong>{item.amountLabel}</strong><small>invoiced</small></Link>
          <Link href={item.visitsHref}><strong>{item.visitCount}</strong><small>visits recorded</small></Link>
          <Link href={item.missingHref} data-state={item.missingCount ? "missed" : "ok"}><strong>{item.missingCount}</strong><small>without a visit</small></Link>
        </li>)}</ol>
      </section> : null}

      <details className={styles.sub} id="store-pm-plans" open={model.planView.mode !== "exceptions" || undefined}>
        <summary><span><strong>{model.planView.title}</strong><small>{model.planView.resultLabel}</small></span><ChevronRight size={16} aria-hidden="true" /></summary>
        <p className={styles.note}>{model.planView.description}{model.planView.toggleHref && model.planView.toggleLabel ? <> <Link href={model.planView.toggleHref}>{model.planView.toggleLabel}</Link></> : null}</p>
        <ol className={styles.reviews}>{model.plans.length ? model.plans.map((plan) => <li key={plan.id}>
          <Link href={plan.storeHref ?? plan.href} className={styles.name}><strong>{plan.storeLabel}</strong><small>{plan.assetLabel}</small></Link>
          <Link href={plan.href}><strong>{plan.programName}</strong>{plan.planName !== plan.programName ? <small>{plan.planName}</small> : null}</Link>
          <Link href={plan.href}><strong>{plan.cadenceLabel}</strong>{plan.overrideReason ? <small>{plan.overrideReason}</small> : null}</Link>
          <span className={plan.overrideReason ? styles.override : styles.inherited}>{plan.sourceLabel}</span>
        </li>) : <li className={styles.empty}>No store plans in this view.</li>}</ol>
        {model.planView.pagination ? <PaginationControls pagination={model.planView.pagination} label="Store plan pages" /> : null}
      </details>
    </section>
  );
}
