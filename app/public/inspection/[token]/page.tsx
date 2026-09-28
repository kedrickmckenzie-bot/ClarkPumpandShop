import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {resolveInspectionLink,inspectionSubmissionFiles} from "@/lib/ops/inspection-access";
import {masterDocuments} from "@/lib/ops/compliance-documents";
import {InspectionLinkForm} from "@/components/workspace/inspection-link-form";
import styles from "@/components/workspace/compliance.module.css";
export const dynamic="force-dynamic";
export default async function InspectionLinkPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{saved?:string}>}) {
 const {token}=await params,r=await getServerOpsRepository();
 const context=await resolveInspectionLink(r,token).catch(()=>null);
 if(!context)return <main className={`${styles.page} ${styles.publicPage}`}><section className={styles.panel}><h1>Inspection link unavailable</h1><p>This link may have expired or the assignment changed. Ask maintenance for a new link.</p></section></main>;
 const {inspection:i,schedule:s,work,store,assignee}=context,q=await searchParams;
 const files=await inspectionSubmissionFiles(r,i.organizationId,i.id,work.id);
 return <main className={`${styles.page} ${styles.publicPage}`}><header><p>Inspection work order · {work.number}</p><h1>{s.name}</h1><p>Store {store.storeNumber} · {store.name}</p><p>{[store.address1,store.city,store.state,store.postalCode].filter(Boolean).join(", ")}</p></header>
 {q.saved?<p className={styles.notice} role="status">Inspection submitted. Maintenance can review your results and attachments.</p>:null}
 <section className={styles.panel}><h2>Due {i.dueDate}</h2><p>Assigned to {assignee.name}</p><p>{s.instructions}</p><p>Evidence: {s.evidenceLabel}</p><h3>Instructions & blank forms</h3>{masterDocuments(i).length?<ul>{masterDocuments(i).map(f=><li key={f.id}><a href={`/api/ops-public/inspection/${token}/files/${f.id}`} target="_blank" rel="noreferrer">{f.originalName}</a> · <a href={`/api/ops-public/inspection/${token}/files/${f.id}?download=1`}>Download</a></li>)}</ul>:<p>No blank forms attached.</p>}</section>
 <section className={styles.panel}><h2>Submitted paperwork & photos</h2>{files.length?<ul>{files.map(f=><li key={f.id}><a href={`/api/ops-public/inspection/${token}/files/${f.id}`} target="_blank" rel="noreferrer">{f.originalName}</a></li>)}</ul>:<p>No files submitted yet.</p>}</section>
 <section className={styles.panel}><h2>{i.status==="passed"?"Reviewed & closed":i.status==="pending"?"Complete inspection":"Add an update or more paperwork"}</h2>{i.status==="passed"?<p>This inspection has been reviewed and closed.</p>:<InspectionLinkForm key={i.version} token={token} version={i.version} date={i.completedAt??new Date().toISOString().slice(0,10)}/>}</section>
 </main>;
}
