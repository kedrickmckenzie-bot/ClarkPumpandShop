import "server-only";
import Link from "next/link";
import { getOpsRequestContext } from "./ops-request-context";
import { internalDispatchScope } from "./internal-dispatch-context";
import { TechnicianHistory } from "@/components/workspace/technician-history";
import { dispatchStatus, dispatchTime } from "@/lib/ops/dispatch-board";
import { plainNextAction } from "@/lib/ops/dispatch-calendar";
import { FileLinks } from "@/components/workspace/file-links";
import { RecordFiles } from "@/components/workspace/record-files";
import { EquipmentDocuments } from "@/components/workspace/equipment-documents";
import styles from "@/components/workspace/internal-dispatch.module.css";
const openStatuses=["approved","issued","accepted","scheduled","in_progress","waiting_on_vendor","waiting_on_parts"];
async function context() {const value=await getOpsRequestContext(["technician"]);return {...value,scope:await internalDispatchScope(value.repository,value.session)};}
const unavailable=(label:string,back:string)=><section><h1>{label} not available</h1><p>You don&apos;t have access to this store, or the record no longer exists.</p><Link href={back}>← {label==="Equipment"?"Equipment":label==="Job"?"My work":"Stores"}</Link></section>;

export async function TechnicianStore({id,cursor}:{id:string;cursor?:string}) {
  const {repository,scope}=await context();
  if(!await repository.getStoreDetail(scope,id))return unavailable("Store","/app/stores");
  const store=(await repository.getStore(scope.organizationId,id))!;
  const scoped={...scope,storeIds:[id]};
  const [equipment,jobs,managers]=await Promise.all([repository.searchAssets(scoped,"",{limit:25}),repository.listWorkOrders(scoped,{storeId:id,statuses:openStatuses,limit:25,cursor}),repository.listNotificationRecipients(scope.organizationId,"store_manager",{storeId:id})]);
  const contacts=await Promise.all(managers.map(manager=>repository.getUserInOrganization(scope.organizationId,manager.userId)));
  const address=[store.address1,store.address2,`${store.city}, ${store.state} ${store.postalCode}`].filter(Boolean).join(", ");
  return <div className={styles.workspace}><header className={styles.jobHeader}><Link href="/app/stores">← Stores</Link><h1>Store {store.storeNumber}</h1><p>{store.name}</p><p>{address}</p>
    <div className={styles.rowActions}><a className={`${styles.btn} ${styles.btnPrimary}`} href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Directions</a>{store.phone?<a className={`${styles.btn} ${styles.btnSecondary}`} href={`tel:${store.phone}`}>Call store · {store.phone}</a>:null}</div>
  </header><section className={styles.jobBody}><h2 className={styles.subHeading}>Store manager</h2>{contacts.length?contacts.filter(person=>person!==null).map(person=><p key={person.id}>{person.displayName}{person.phone?<> · <a href={`tel:${person.phone}`}>{person.phone}</a></>:null} · <a href={`mailto:${person.email}`}>Email</a></p>):<p>No manager contact recorded. Ask your maintenance manager.</p>}
    {store.accessNotes?<><h2 className={styles.subHeading}>How to get in</h2><p style={{whiteSpace:"pre-wrap"}}>{store.accessNotes}</p></>:null}</section>
    <section className={styles.jobBody}><h2 className={styles.subHeading}>Open jobs</h2>{jobs.items.length?<ul className={styles.historyList}>{jobs.items.map(job=><li key={job.id}><Link href={`/app/work-orders/${encodeURIComponent(job.id)}`}>{job.problem}</Link><p>{job.internalAssigneeName??job.vendorName??"Manager arranging work"} · {dispatchStatus(job).label}</p></li>)}</ul>:<p>No open jobs at this store.</p>}{jobs.nextCursor?<p>Showing {jobs.items.length} of {jobs.totalCount} · <Link href={`?jobsCursor=${encodeURIComponent(jobs.nextCursor)}`}>Show more jobs</Link></p>:null}</section>
    <section className={styles.jobBody}><h2 className={styles.subHeading}>Equipment</h2>{equipment.items.length?<ul>{equipment.items.map(asset=><li key={asset.id}><Link href={`/app/equipment/${encodeURIComponent(asset.id)}`}>{asset.name} · {asset.assetTag}</Link></li>)}</ul>:<p>No equipment recorded at this store yet.</p>}{equipment.nextCursor?<Link href={`/app/equipment?store=${encodeURIComponent(id)}`}>See more equipment</Link>:null}</section>
    <TechnicianHistory repository={repository} scope={scoped} storeId={id} limit={5} zone={store.timeZone}/><Link href={`/app/work-history?store=${encodeURIComponent(id)}`}>All work history at this store</Link>
  </div>;
}
export async function TechnicianEquipment({id}:{id:string}) {
  const {repository,scope}=await context(),asset=await repository.getAssetDetail(scope,id);
  if(!asset)return unavailable("Equipment","/app/equipment");
  const store=(await repository.getStore(scope.organizationId,asset.storeId))!;
  // Only show the per-unit files box when something is attached; the library below covers manuals.
  const unitFiles=await repository.listFilesForEntity(scope.organizationId,"asset",id);
  return <div className={styles.workspace}><header className={styles.jobHeader}><Link href="/app/equipment">← Equipment</Link><h1>{asset.name}</h1><p>{asset.assetTag} · <Link href={`/app/stores/${encodeURIComponent(store.id)}`}>Store {store.storeNumber}</Link></p></header>
    <section className={styles.jobBody}><dl className={styles.facts}>{[["Manufacturer",asset.manufacturer],["Model",asset.model],["Serial number",asset.serialNumber]].filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{asset.components.length?<details><summary>Equipment parts</summary><ul>{asset.components.map(component=><li key={component.id}>{component.name}{component.partNumber?` · ${component.partNumber}`:""}</li>)}</ul></details>:null}{unitFiles.length?<RecordFiles kind="asset" id={id}/>:null}</section>
    <EquipmentDocuments assetId={id} />
    <TechnicianHistory repository={repository} scope={scope} assetId={id} limit={10} title="Work on this equipment" zone={store.timeZone}/><Link href={`/app/work-history?asset=${encodeURIComponent(id)}`}>All work history on this equipment</Link>
  </div>;
}
export async function TechnicianWorkRecord({id}:{id:string}) {
  const {repository,scope,session}=await context(),job=await repository.getWorkOrderDetail(scope,id);
  if(!job)return unavailable("Job","/app/my-work");
  const results=await repository.listWorkResults(scope.organizationId,id);
  const store=await repository.getStore(scope.organizationId,job.storeId),files=await repository.listFilesForEntity(scope.organizationId,"work_order",id);
  return <div className={styles.workspace}><header className={styles.jobHeader}><Link href="/app/work-history">← Work history</Link><h1>{job.problem}</h1><p><Link href={`/app/stores/${encodeURIComponent(job.storeId)}`}>Store {job.storeNumber} · {job.storeName}</Link></p><p>{job.number} · {dispatchStatus(job).label}</p></header>
    <section className={styles.jobBody}>{job.asset?<p>Equipment: <Link href={`/app/equipment/${encodeURIComponent(job.asset.id)}`}>{job.asset.name}</Link></p>:null}{job.authorizedScope?<p>{job.authorizedScope}</p>:null}<p>{job.internalAssigneeName??job.vendorName??job.accountableParty}</p><p>{plainNextAction(job.nextAction)}</p>
      {job.assignmentKind==="internal"&&!job.inspectionId&&(job.internalMembershipId===session.membershipId || job.internalTarget==="pool"&&!job.hasOpenFollowUp)&&!["closed","cancelled","resolved","completed_pending_review"].includes(job.status)?<Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/app/my-work/${encodeURIComponent(id)}`}>Open job tools</Link>:null}
      {results.filter(result=>!result.siteVisitWorkOrderId).map(result=><p key={result.id}>{result.performerName} · {dispatchTime(result.outcomeRecordedAt,store?.timeZone??"America/New_York",store?.timeZone??"America/New_York")}{result.outcomeNotes?` — ${result.outcomeNotes}`:""}</p>)}
      {job.visits.length?<ul className={styles.historyList}>{job.visits.map(visit=><li key={visit.id}><strong>{visit.technicianName??visit.providerName??"Maintenance team"}</strong><p>{dispatchTime(visit.checkedOutAt??visit.checkedInAt,store?.timeZone??"America/New_York",store?.timeZone??"America/New_York")}</p>{visit.workOutcomeNotes?<p>{visit.workOutcomeNotes}</p>:null}</li>)}</ul>:<p>No visit recorded.</p>}
      {files.length?<><h2 className={styles.subHeading}>Notes and photos</h2><ul>{files.map(file=><li key={file.id}><FileLinks file={file} href={`/api/ops/work-orders/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`}/></li>)}</ul></>:null}
    </section><TechnicianHistory repository={repository} scope={scope} storeId={job.storeId} assetId={job.asset?.id} excludeId={id} limit={5} title={job.asset?"Recent work on this equipment":"Recent work at this store"} zone={store?.timeZone}/>
  </div>;
}

export async function TechnicianList({kind,query}:{kind:"stores"|"equipment";query:Record<string,string|undefined>}) {
  const {repository,scope}=await context();
  if(query.store&&!await repository.getStoreDetail(scope,query.store))return unavailable("Store","/app/stores");
  const scoped=query.store?{...scope,storeIds:[query.store]}:scope, q=query.q??"";
  const page=kind==="stores"?await repository.searchStores(scoped,q,{limit:25,cursor:query.cursor}):await repository.searchAssets(scoped,q,{limit:25,cursor:query.cursor});
  return <div className={styles.workspace}><header className={styles.jobHeader}><h1>{kind==="stores"?"Stores":"Equipment"}</h1><form method="get" className={styles.search}><label>Search<input name="q" type="search" defaultValue={q} maxLength={160}/></label>{query.store?<input type="hidden" name="store" value={query.store}/>:null}<button type="submit">Search</button></form></header>
    <section className={styles.jobBody}>{page.items.length?<ul className={styles.historyList}>{page.items.map(row=><li key={row.id}><Link href={`/app/${kind}/${encodeURIComponent(row.id)}`}>{"assetTag" in row?`${row.name} · ${row.assetTag}`:`Store ${row.storeNumber} · ${row.name}`}</Link><p>{"formattedAddress" in row?row.formattedAddress:`Store ${row.storeNumber}`}</p></li>)}</ul>:<p>No matches. Try another search.</p>}{page.nextCursor?<p>Showing {page.items.length} of {page.totalCount ?? page.items.length} · <Link href={`?${new URLSearchParams({...query,cursor:page.nextCursor})}`}>Show more</Link></p>:null}</section>
  </div>;
}
