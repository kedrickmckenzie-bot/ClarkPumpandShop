import { randomUUID } from "node:crypto";
import { RecordForm } from "@/components/ops/record-form";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { dispatchIdentity } from "@/lib/ops/internal-dispatch";
import styles from "./internal-dispatch.module.css";
export async function StoreAccessNotes({id,saved}:{id:string;saved?:boolean}) {
  const {repository,session}=await getOpsRequestContext(["facilities","regional","store_manager","executive","finance"]);
  if (!await repository.getStoreDetail(await internalDispatchScope(repository,session),id)) return null;
  const store=await repository.getStore(session.organizationId,id);
  let editable=false;
  try {await dispatchIdentity(repository,session.organizationId,session.membershipId!,id,["facilities_admin","regional_manager","field_manager","store_manager"]);editable=session.accessMode==="preview" || Boolean(session.permissions?.length && session.permissions.every(value=>["ops:*","ops:write","ops:read_write","ops:store_manage"].includes(value)));}catch{/* Read-only members see saved instructions. */}
  return <section className={styles.jobBody}><h2 className={styles.subHeading}>Store access notes</h2>{saved?<p role="status">Saved. Store access notes updated.</p>:null}
    {store?.accessNotes?<p style={{whiteSpace:"pre-wrap"}}>{store.accessNotes}</p>:<p className={styles.muted}>No access notes yet.</p>}
    {editable?<details><summary>Edit access notes</summary><RecordForm action={`/api/ops/stores/${encodeURIComponent(id)}/access-notes`} offerSavedWork={false} className={styles.form}>
      <input type="hidden" name="submissionKey" value={randomUUID()}/><input type="hidden" name="expectedVersion" value={store?.accessNotesVersion??0}/>
      <label>How to get in<textarea name="notes" rows={3} maxLength={3000} defaultValue={store?.accessNotes??""}/></label><button type="submit">Save notes</button>
    </RecordForm></details>:null}</section>;
}
