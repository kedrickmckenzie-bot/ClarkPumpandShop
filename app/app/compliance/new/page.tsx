import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "../../_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { ComplianceCreateForm } from "@/components/workspace/compliance-create-form";
import styles from "@/components/workspace/compliance.module.css";
import { storeTeamOwner } from "@/lib/ops/compliance";
export default async function NewCompliance({searchParams}:{searchParams:Promise<{error?:string;store?:string}>}) {
 const session=await loadOperatorSession();if(!["facilities","regional"].includes(session.role))notFound();
 const r=await getServerOpsRepository(),q=await searchParams;
 const stores=await r.searchStores(session,"",{limit:100});
 // Shown on the form so "Store team" names the person each store's inspection goes to.
 const owners=Object.fromEntries(await Promise.all(stores.items.map(async store=>[store.id,(await storeTeamOwner(r,session.organizationId,store))?.displayName ?? null] as const)));
 return <div className={styles.page}><header><Link href="/app/compliance">← Compliance</Link><h1>New inspection schedule</h1><p>Choose the work, timing and who handles it.</p></header>{q.error?<p role="alert">{q.error}</p>:null}<section className={styles.panel}><ComplianceCreateForm teamOwners={owners} defaultStoreId={stores.items.some(s=>s.id===q.store)?q.store:undefined} stores={stores.items}/></section></div>;
}
