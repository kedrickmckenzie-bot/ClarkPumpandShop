import {cameraInput} from "@/lib/ops/store-task-time";
import Link from "next/link";
import {getOpsRequestContext,assertStoreInSessionScope} from "@/lib/server/ops-request-context";
import {taskRoles,type CameraWindow} from "@/lib/ops/store-task-types";
import {taskIdentity,taskScope} from "@/lib/ops/store-tasks";
import {NewTaskForm} from "@/components/workspace/store-task-forms";
import styles from "@/components/workspace/store-tasks.module.css";
import {notFound} from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const {session,repository:r,actor}=await getOpsRequestContext(taskRoles),q=await searchParams;
 await taskIdentity(r,session.organizationId,actor.actorId!);
 const sources:Record<string,string>={};const sourceLinks:Array<{label:string;href:string}>=[];let store=q.store;let windows:CameraWindow[]=[];
 if(q.work){const w=await r.getWorkOrder(session.organizationId,q.work);if(!w)notFound();store=w.storeId;sources.workOrderId=w.id;sourceLinks.push({label:`Work order ${w.number}`,href:`/app/work-orders/${w.id}`});}
 if(q.asset){const a=await r.getAsset(session.organizationId,q.asset);if(!a)notFound();store=a.storeId;sources.assetId=a.id;sourceLinks.push({label:a.name,href:`/app/equipment/${a.id}`});}
 if(q.visit){const v=await r.getVisit(session.organizationId,q.visit);if(!v)notFound();store=v.storeId;sources.visitId=v.id;sourceLinks.push({label:"Service visit",href:`/app/visits/${v.id}`});if(v.checkedOutAt)windows=[{start:new Date(Date.parse(v.checkedInAt)-15*60000).toISOString(),end:new Date(Date.parse(v.checkedOutAt)+15*60000).toISOString(),area:''}];}
 if(q.invoice){const inv=await r.getInvoice(session.organizationId,q.invoice);if(!inv)notFound();const allocations=(await Promise.all((await r.listInvoiceLines(session.organizationId,inv.id)).map(l=>r.listInvoiceLineAllocations(session.organizationId,l.id)))).flat();if(!store&&allocations.length)store=allocations[0].storeId;const grants=await r.listScopeGrantsForMembership(session.organizationId,actor.actorId!);if(!allocations.length&&!grants.some(g=>g.scopeKind==='organization'&&g.scopeId===session.organizationId))notFound();if(allocations.some(a=>a.storeId!==store))notFound();sources.invoiceId=inv.id;sourceLinks.push({label:`Invoice ${inv.vendorInvoiceNumber}`,href:`/app/invoices/${inv.id}`});}
 if(store){const location=await assertStoreInSessionScope(session,store);windows=windows.map(w=>({...w,start:cameraInput(w.start,location.timeZone),end:cameraInput(w.end,location.timeZone)}));}
 const stores=await r.searchStores(await taskScope(r,session,actor.actorId!),'',{limit:50});
 const selected=store?await r.getStore(session.organizationId,store):null;
 const options=stores.items.map(s=>({id:s.id,storeNumber:s.storeNumber,name:s.name,formattedAddress:s.formattedAddress}));if(selected&&!options.some(s=>s.id===selected.id))options.unshift({id:selected.id,storeNumber:selected.storeNumber,name:selected.name,formattedAddress:selected.address1});
 return <div className={styles.page}><header><Link href="/app/tasks">← Tasks</Link><h1>New task</h1>{selected?<p>Store {selected.storeNumber} · {selected.name}</p>:null}</header>{sourceLinks.length?<nav className={styles.actions} aria-label="Linked records">{sourceLinks.map(l=><Link href={l.href} key={l.href}>{l.label}</Link>)}</nav>:null}{q.invoice?<p className={styles.muted}>For camera checks, enter the date and times service was claimed. The invoice date is not a service date.</p>:null}<NewTaskForm stores={options} storeId={store} sources={sources} windows={windows} fallbackId={actor.actorId!}/></div>;
}
