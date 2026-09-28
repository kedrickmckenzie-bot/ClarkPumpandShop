import Link from "next/link";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import styles from "./invoice-upload-workspace.module.css";
export async function InvoiceUploadQueue({page=1,review=false}:{page?:number;review?:boolean}){
 const session=await loadOperatorSession();
 if(!["executive","facilities","finance"].includes(session.role)||session.storeIds!==undefined||session.regionIds!==undefined)return null;
 const grants=session.membershipId?await (await getServerOpsRepository()).listScopeGrantsForMembership(session.organizationId,session.membershipId):[];
 const canWrite=grants.some(g=>g.scopeKind==="organization"&&g.scopeId===session.organizationId&&["ops:*","ops:write","ops:read_write"].includes(g.permission));
 const rows=await (await getServerOpsRepository()).listInvoiceUploads(session.organizationId,{offset:(page-1)*25,status:review?"pending":undefined});
 if(!rows.length&&page===1)return null;
 return <section className={styles.surface} id="uploaded-invoices"><h2>{review?"Files needing review":"Uploaded files"}</h2><ul className={styles.list}>{rows.slice(0,25).map(row=><li key={row.id}><div><strong>{row.filename}</strong><span>{row.status==="queued"?"Reading not finished — resume below":row.status==="review"?"Needs review":row.status==="recorded"?"Recorded":"Dismissed"}</span>{row.status==="review"?<span>{(JSON.parse(row.issuesJson) as string[])[0]}</span>:null}</div><div className={styles.actions}><a href={`/api/ops/invoice-uploads/${encodeURIComponent(row.id)}/file`} target="_blank" rel="noreferrer">Open file</a>{row.status!=="dismissed"&&(row.invoiceId||canWrite)?<Link href={row.invoiceId?`/app/invoices/${encodeURIComponent(row.invoiceId)}`:`/app/invoices/new?upload=${encodeURIComponent(row.id)}`}>{row.invoiceId?"View invoice":"Review upload"}</Link>:null}</div></li>)}</ul><nav className={styles.actions} aria-label="Uploaded file pages">{page>1?<Link href={`/app/invoices?view=${review?"review":"all"}&uploadsPage=${page-1}#uploaded-invoices`}>Previous uploads</Link>:null}{rows.length>25?<Link href={`/app/invoices?view=${review?"review":"all"}&uploadsPage=${page+1}#uploaded-invoices`}>More uploads →</Link>:null}</nav></section>;
}
