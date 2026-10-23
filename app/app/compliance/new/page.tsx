import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "../../_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { ComplianceCreateForm } from "@/components/workspace/compliance-create-form";
import styles from "@/components/workspace/compliance.module.css";
import { storeTeamOwner } from "@/lib/ops/compliance";
import { COMPLIANCE_TEMPLATES, TEMPLATE_GROUPS, complianceTemplate, type ComplianceTemplateGroup } from "@/lib/ops/compliance-templates";
import own from "@/components/workspace/compliance-templates.module.css";
import { addDays } from "@/lib/ops/refrigerant";
export default async function NewCompliance({searchParams}:{searchParams:Promise<{error?:string;store?:string;template?:string}>}) {
 const session=await loadOperatorSession();if(!["facilities","regional","executive"].includes(session.role))notFound();
 const r=await getServerOpsRepository(),q=await searchParams;
 const stores=await r.searchStores(session,"",{limit:100});
 // Shown on the form so "Store team" names the person each store's inspection goes to.
 const owners=Object.fromEntries(await Promise.all(stores.items.map(async store=>[store.id,(await storeTeamOwner(r,session.organizationId,store))?.displayName ?? null] as const)));
 const template=complianceTemplate(q.template);
 const keep=(key?:string)=>`/app/compliance/new?${new URLSearchParams({...(key?{template:key}:{}),...(q.store?{store:q.store}:{})})}#form`;
 const firstDue=addDays(new Date().toISOString().slice(0,10),30);
 const groups=Object.keys(TEMPLATE_GROUPS) as ComplianceTemplateGroup[];
 return <div className={styles.page}><header><Link href="/app/compliance">← Compliance</Link><h1>New inspection schedule</h1><p>Start from a ready-made schedule, or fill in your own.</p></header>{q.error?<p role="alert">{q.error}</p>:null}
  <section className={styles.panel} id="templates" aria-labelledby="templates-title"><h2 id="templates-title">Ready-made schedules</h2>
   <div className={own.groups}>{groups.map(group=><div key={group}><h3>{TEMPLATE_GROUPS[group]}</h3><ul>{COMPLIANCE_TEMPLATES.filter(t=>t.group===group).map(t=><li key={t.key}><Link aria-current={template?.key===t.key?"true":undefined} href={keep(t.key)}>{t.name}</Link><small>{t.intervalCount===1?"Every month":t.intervalCount===12?"Every year":t.intervalCount===36?"Every 3 years":`Every ${t.intervalCount} months`} · {t.who==="vendor"?"Vendor":"Store team"}</small></li>)}</ul></div>)}</div>
   <p className={styles.muted}>Frequencies follow the common federal or national rule. Your state, fire marshal or water authority may be stricter.</p>
  </section>
  <section className={styles.panel} id="form">{template?<p className={styles.notice}>Using “{template.name}”. Pick the stores, check the details and save. <Link href={keep()}>Start blank instead</Link></p>:null}<ComplianceCreateForm key={template?.key??"blank"} template={template} defaultFirstDue={template?firstDue:undefined} teamOwners={owners} defaultStoreId={stores.items.some(s=>s.id===q.store)?q.store:undefined} stores={stores.items}/></section></div>;
}
