"use client";
import { useEffect, useState } from "react";
import { useWorkOrderScope } from "./work-order-scope";
import styles from "./ops.module.css";
export function WorkConfirmationFields({ required }: { required: boolean }) {
  const { storeId } = useWorkOrderScope();
  return <Fields key={storeId} storeId={storeId} required={required} />;
}
function Fields({ storeId, required }: { storeId: string; required: boolean }) {
  const [enabled, setEnabled] = useState(required);
  const [people, setPeople] = useState<Array<{id:string;name:string}>>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!storeId || !enabled) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/ops/work-orders/confirmation-assignees?store=${encodeURIComponent(storeId)}&q=${encodeURIComponent(search)}`, { signal: abort.signal })
        .then(response => { if (!response.ok) throw new Error(); return response.json(); })
        .then(data => { setPeople((data as {items:Array<{id:string;name:string}>}).items); setError(false); })
        .catch(() => { if (!abort.signal.aborted) setError(true); });
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [storeId, enabled, search]);
  return <div className={`${styles.field} ${styles.confirmationSetting}`}>
    <input type="hidden" name="confirmationSettingPresent" value="true" />
    <label><input type="checkbox" name="requireConfirmation" value="true" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Require confirmation</label>
    {enabled ? <>
      <label className={styles.field}><span>Find a reviewer <small>Optional</small></span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search people at this store" disabled={!storeId} /></label>
      <label className={styles.field}><span>Who should confirm?</span><select name="confirmationMembershipId" defaultValue=""><option value="">Store team</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      {error ? <small>Couldn’t load people. Retry your search, or leave this with the store team.</small> : null}
    </> : <small>Completed work closes when no other required actions remain.</small>}
  </div>;
}
