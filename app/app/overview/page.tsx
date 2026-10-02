import { cachedNumberFormat } from "@/lib/ops/intl-format-cache";
import {OperatingProblems} from "@/components/workspace/operating-problems";
import {roleCanAccessProgramRoute} from "@/components/ops/role-policy";
import type { Metadata } from "next";
import { ControlTower } from "@/components/workspace/control-tower";
import Link from "next/link";
import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {validMonth} from "@/lib/ops/capital-planning";
import styles from "@/components/workspace/compliance.module.css";
import { loadOperatorSession, loadDashboardModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const model = await loadDashboardModel().catch(error => {
    console.error("Overview workspace loading failed", error instanceof Error ? error.message : String(error));
    throw error;
  });
  const session=await loadOperatorSession(),repository=await getServerOpsRepository(),start=new Date().toISOString().slice(0,7);
  const risks=await repository.listOperatingRisks(session);
  const operatingSummary=<OperatingProblems rows={risks}/>;
  const pendingInvoices=["executive","facilities","finance"].includes(session.role)&&session.storeIds===undefined&&session.regionIds===undefined?await repository.listInvoiceUploads(session.organizationId,{status:"pending"}):[];
  const invoiceAttention=pendingInvoices.length?<div className={`${styles.panel} ${styles.bar}`}><div><strong>Invoices need attention</strong><p>Review unmatched files or resume interrupted reading.</p></div><Link href="/app/invoices?view=review#uploaded-invoices">Review invoices →</Link></div>:null;
  if(!roleCanAccessProgramRoute(session.role,"lifecycle"))return <ControlTower model={model} operatingSummary={operatingSummary} capitalSummary={invoiceAttention}/>;
  const capital=await repository.queryCapitalPlans(session,{start,months:12,currency:"USD"}),buckets=capital.buckets.filter(b=>validMonth(b.month));
  const amount=buckets.reduce((n,b)=>n+b.amountMinor,0),missing=buckets.reduce((n,b)=>n+b.missing,0),undated=capital.buckets.filter(b=>b.month==="undated"||b.month.length===4).reduce((n,b)=>n+b.count,0),unscheduled=capital.buckets.filter(b=>b.month==="undated"||b.month.length===4).reduce((n,b)=>n+b.amountMinor,0);
  return <ControlTower model={model} operatingSummary={operatingSummary} capitalSummary={<>{invoiceAttention}<div className={`${styles.panel} ${styles.bar}`}><div><strong>Replacement planning · next 12 months</strong><p>{cachedNumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(amount/100)} USD scheduled · {missing} scheduled plans need a cost. {undated} plans without a month · {cachedNumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(unscheduled/100)} known cost across all years</p></div><Link href={`/app/lifecycle?view=capital&start=${start}&months=12&currency=USD`}>View capital forecast →</Link></div></>} />;
}
