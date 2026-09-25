"use client";

import { useState } from "react";
import Link from "next/link";
import type { CreatePmProgramSetupModel } from "./setup-types";
import styles from "./ops.module.css";
import pmStyles from "./pm-schedule.module.css";

export function CreatePmProgramSetupForm({ model }: { model: CreatePmProgramSetupModel }) {
  const [category, setCategory] = useState(model.initial?.categoryKey ?? model.categories[0]?.value ?? "");
  const [stores, setStores] = useState<string[]>(model.initial?.storeIds ?? model.defaultStoreIds ?? model.stores.map(s => s.value));
  const [region, setRegion] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const selected = model.stores.filter(s => stores.includes(s.value));
  const count = selected.reduce((n, s) => n + (s.equipmentCounts[category] ?? 0), 0);
  const categoryLabel = model.categories.find(c => c.value === category)?.label ?? "equipment";
  const visible = model.stores.filter(s => (!region || s.region === region) && `${s.label} ${s.description ?? ""}`.toLowerCase().includes(storeSearch.trim().toLowerCase()));
  return <div className={`${styles.formPage} ${pmStyles.page}`}>
    <header className={styles.formPageHeader}><Link className={styles.backLink} href={model.cancelHref}>← Back to PM</Link><h1>{model.initial ? "Edit PM schedule" : "Create PM schedule"}</h1></header>
    <form className={styles.recordForm} action={model.submitAction} method="post">
      {model.initial ? <input type="hidden" name="programId" value={model.initial.programId} /> : null}
      <section className={styles.formSection}>
        <h2>1. Schedule</h2>{model.initial ? <><input type="hidden" name="categoryKey" value={category} /><p>Changes apply to future cycles. Store exceptions are kept.</p></> : null}
        <label className={styles.field}><span>Schedule name</span><input name="name" required maxLength={180} placeholder="Quarterly HVAC service" defaultValue={model.initial?.name} /></label>
        <div className={styles.fieldGrid}>
          <label className={styles.field}><span>Service area</span><select name="categoryKey" disabled={Boolean(model.initial)} value={category} onChange={e => setCategory(e.target.value)} required>{model.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label className={styles.field}><span>Repeat every (days)</span><input name="cadenceDays" type="number" min={1} max={3650} defaultValue={model.initial?.cadenceDays ?? 90} required /></label>
          <label className={styles.field}><span>First due date</span><input name="firstDueAt" type="date" defaultValue={model.initial?.firstDueAt} required /></label>
          <label className={styles.field}><span>Days allowed before / after</span><input name="completionWindowDays" type="number" min={1} max={365} defaultValue={model.initial?.completionWindowDays ?? 7} required /></label>
        </div>
        <label className={styles.field}><span>Service instructions (optional)</span><textarea name="checklist" defaultValue={model.initial?.checklist} rows={3} maxLength={4000} placeholder="Inspect units, replace filters, and record any repairs needed." /></label>
      </section>
      <section className={styles.formSection}>
        <h2>2. Stores</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}><span>Find a store</span><input type="search" value={storeSearch} onChange={e => setStoreSearch(e.target.value)} placeholder="Store number, name or address" /></label>
          <label className={styles.field}><span>Region</span><select value={region} onChange={e => setRegion(e.target.value)}><option value="">All regions</option>{[...new Set(model.stores.map(s => s.region).filter(Boolean))].map(r => <option key={r} value={r}>{r}</option>)}</select></label>
          <div><button type="button" className={styles.secondaryButton} onClick={() => setStores([...new Set([...stores, ...visible.map(s => s.value)])])}>Select shown</button> <button type="button" className={styles.secondaryButton} onClick={() => setStores(stores.filter(id => !visible.some(s => s.value === id)))}>Clear shown</button></div>
        </div>
        <p role="status">{visible.length} stores shown · {stores.length} selected</p>
        {stores.map(id => <input type="hidden" name="storeId" value={id} key={id} />)}
        <div className={pmStyles.storeList}>{visible.map(s => <label className={pmStyles.storeRow} key={s.value} aria-label={s.label} htmlFor={`pm-store-${s.value}`}><input id={`pm-store-${s.value}`} type="checkbox" checked={stores.includes(s.value)} onChange={e => setStores(e.target.checked ? [...stores, s.value] : stores.filter(id => id !== s.value))} /><span><strong>{s.label}</strong><small>{s.equipmentCounts[category] ?? 0} equipment records</small></span></label>)}</div>
      </section>
      <section className={styles.formSection} aria-live="polite">
        <h2>3. Coverage</h2>
        <strong>{selected.length} stores · {count} equipment records</strong>
        <p>All {categoryLabel} equipment at these stores. New equipment joins automatically.</p>
        <p>Customize equipment and timing for each store after saving.</p>
        {selected.some(s => !s.equipmentCounts[category]) ? <p>Stores without equipment records can still receive service. Review their equipment lists.</p> : null}
      </section>
      <div className={styles.formFooter}><Link className={styles.secondaryButton} href={model.cancelHref}>Cancel</Link><button className={styles.primaryButton} disabled={!stores.length} type="submit">{model.initial ? "Save schedule" : "Create schedule"}</button></div>
    </form>
  </div>;
}
