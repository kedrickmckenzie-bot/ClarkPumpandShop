import Link from "next/link";
import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import styles from "@/components/workspace/internal-dispatch.module.css";

export default async function UnmatchedInternalVisit({searchParams}:{searchParams:Promise<{q?:string;cursor?:string}>}){
  const query=await searchParams,c=await getOpsRequestContext(["technician"]),stores=await c.repository.searchStores(await internalDispatchScope(c.repository,c.session),(query.q??"").slice(0,120),{limit:25,cursor:query.cursor});
  return <div className={styles.workspace}><header><Link href="/app/my-work">← My work</Link><h1>Check in for a job that isn&apos;t listed</h1></header><form method="get" className={styles.search}><label>Find store<input name="q" type="search" defaultValue={query.q} maxLength={120}/></label><button type="submit">Search</button></form>
    <RecordForm action="/api/ops/internal-visits" offerSavedWork={false} className={styles.form}><input name="submissionKey" type="hidden" value={randomUUID()}/><label>Store<select name="storeId" required defaultValue=""><option value="" disabled>Choose a store</option>{stores.items.map(store=><option key={store.id} value={store.id}>Store {store.storeNumber} · {store.name}</option>)}</select></label><label>What are you here to do?<textarea name="unmatchedReason" required maxLength={1000}/></label><button type="submit" name="action" value="check_in">Check in</button></RecordForm>
    {stores.nextCursor?<Link href={`/app/my-work/check-in?${new URLSearchParams({q:query.q??"",cursor:stores.nextCursor})}`}>More stores →</Link>:null}
  </div>;
}
