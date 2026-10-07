import {WorkflowSummary} from "@/components/workspace/workflow-summary";
import {OperatingProblems} from "@/components/workspace/operating-problems";
import {roleCanAccessProgramRoute} from "@/components/ops/role-policy";
import type { Metadata } from "next";
import { ControlTower } from "@/components/workspace/control-tower";
import Link from "next/link";
import { redirect } from "next/navigation";
import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import styles from "@/components/workspace/compliance.module.css";
import { loadOperatorSession, loadDashboardModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Overview" };
const TECHNICIAN_HOME = "/app/my-work";

export default async function OverviewPage() {
  // Technicians have no manager overview; their home is their own open jobs.
  if ((await loadOperatorSession()).role === "technician") redirect(TECHNICIAN_HOME);
  const model = await loadDashboardModel().catch(error => {
    console.error("Overview workspace loading failed", error instanceof Error ? error.message : String(error));
    throw error;
  });
  const session=await loadOperatorSession(),repository=await getServerOpsRepository();
  const risks=await repository.listOperatingRisks(session);
  const operatingSummary=<><WorkflowSummary session={session} repository={repository}/><OperatingProblems rows={risks}/></>;
  const pendingInvoices=["executive","facilities","finance"].includes(session.role)&&session.storeIds===undefined&&session.regionIds===undefined?await repository.listInvoiceUploads(session.organizationId,{status:"pending"}):[];
  const invoiceAttention=pendingInvoices.length?<div className={`${styles.panel} ${styles.bar}`}><div><strong>Invoices need attention</strong><p>Review unmatched files or resume interrupted reading.</p></div><Link href="/app/invoices?view=review#uploaded-invoices">Review invoices →</Link></div>:null;
  // Replacement planning lives under Spend & planning. Only the owner sees one line, and only when units await a decision.
  const review=session.role==="executive"&&roleCanAccessProgramRoute(session.role,"lifecycle")?await repository.queryLifecycleQueue(session,{view:"review"}):undefined;
  const replacementLine=review?.total?<div className={`${styles.panel} ${styles.bar}`}><div><strong>{review.total} {review.total===1?"unit":"units"} to decide: repair or replace</strong></div><Link href="/app/lifecycle?view=review">Review →</Link></div>:null;
  return <ControlTower model={model} operatingSummary={operatingSummary} capitalSummary={<>{invoiceAttention}{replacementLine}</>}/>;
}
