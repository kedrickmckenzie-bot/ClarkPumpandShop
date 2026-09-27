"use client";

import { useState } from "react";
import type { VendorPerformanceDetailViewModel } from "./vendor-performance-contract";
import styles from "./vendor-performance-workspace.module.css";

export function VendorCoverageEditor({ model }: { model: NonNullable<VendorPerformanceDetailViewModel["coverageEditor"]> }) {
  const [all, setAll] = useState(model.selectedIds.includes(model.organizationId));
  const [selected, setSelected] = useState(model.selectedIds);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function toggle(id: string) { setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]); }
  const count = model.stores.filter(store => all || selected.includes(store.id) || (store.regionId && selected.includes(store.regionId))).length;
  return <details className={styles.coverageEditor}>
    <summary>Edit coverage</summary>
    <form action={model.action} method="post" className={styles.relationshipForm} onSubmit={async event => {
      event.preventDefault();
      const body = new FormData(event.currentTarget);
      setSaving(true); setError("");
      try {
        const response = await fetch(model.action, { method: "POST", body });
        if (!response.ok) {
          const result: unknown = await response.json();
          const message = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Coverage could not be saved.";
          throw new Error(message);
        }
        window.location.assign(response.url);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Coverage could not be saved. Try again."); setSaving(false); }
    }}>
      <input type="hidden" name="operation" value="update_coverage" />
      <input type="hidden" name="coverageVersion" value={model.version} />
      {(all ? [model.organizationId] : selected.filter(id => id !== model.organizationId)).map(id => <input type="hidden" name="coverageScopeIds" value={id} key={id} />)}
      <fieldset className={styles.coverageChoices}><legend>Service area</legend>
        <label><input type="radio" name="coverageMode" checked={all} onChange={() => setAll(true)} />All stores</label>
        <label><input type="radio" name="coverageMode" checked={!all} onChange={() => setAll(false)} />Selected regions or stores</label>
      </fieldset>
      {all ? <p>Includes new stores added to the company.</p> : <>
        <fieldset className={styles.coverageChoices}><legend>Whole regions</legend>
          {model.regions.map(region => <label key={region.id}><input type="checkbox" checked={selected.includes(region.id)} onChange={() => toggle(region.id)} />{region.name}</label>)}
        </fieldset>
        <label><span>Find a store</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Store number, name or address" /></label>
        <fieldset className={styles.coverageChoices}><legend>Individual stores</legend>
          <div className={styles.coverageStoreList}>{model.stores.filter(store => (store.searchText ?? store.label).toLowerCase().includes(query.toLowerCase())).map(store => {
            const included = Boolean(store.regionId && selected.includes(store.regionId));
            return <label key={store.id}><input type="checkbox" checked={included || selected.includes(store.id)} disabled={included} onChange={() => toggle(store.id)} /><span>{store.label}{store.address ? <small>{store.address}</small> : null}{included ? <small>Included through region</small> : null}</span></label>;
          })}</div>
          {!model.stores.some(store => (store.searchText ?? store.label).toLowerCase().includes(query.toLowerCase())) ? <p>No matching stores</p> : null}
        </fieldset>
      </>}
      {error ? <p role="alert">{error}</p> : null}
      <div className={styles.relationshipFormFooter}><p>{count} of {model.stores.length} stores covered</p><button type="submit" disabled={saving || (!all && !selected.some(id => id !== model.organizationId))}>{saving ? "Saving…" : "Save coverage"}</button></div>
    </form>
  </details>;
}
