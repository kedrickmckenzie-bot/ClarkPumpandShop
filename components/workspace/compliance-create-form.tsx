"use client";
import { InspectionAssigneePicker } from "./inspection-assignee-picker";
import { useEffect, useState } from "react";
import styles from "./compliance.module.css";
import pmStyles from "@/components/ops/pm-schedule.module.css";

type StoreOption = { id: string; storeNumber: string; name: string; formattedAddress?: string; regionName?: string };
type Who = "team" | "vendor" | "person";

/** Vendor search for several stores; the server confirms the vendor covers every selected store. */
function VendorPicker({ storeId }: { storeId: string }) {
  const [query, setQuery] = useState(""), [items, setItems] = useState<Array<{ id: string; name: string }>>([]), [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/ops/compliance/assignees?${new URLSearchParams({ store: storeId, q: query })}`, { signal: controller.signal });
        const data = await response.json() as { items: Array<{ id: string; name: string; kind: string }> };
        if (response.ok) setItems(data.items.filter((item) => item.kind === "vendor"));
      } catch { /* search is optional; the list stays as it was */ }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [storeId, query]);
  return <div>
    <label>Vendor<input type="search" placeholder="Search vendors" value={query} maxLength={160} required={!selected} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
    <input type="hidden" name="assignmentVendorId" value={selected?.id ?? ""} />
    {selected
      ? <p role="status"><strong>{selected.name}</strong> <button type="button" onClick={() => { setSelected(null); setQuery(""); }}>Change</button></p>
      : <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>{items.map((item) => <li key={item.id}><button type="button" onClick={() => { setSelected(item); setQuery(item.name); }}>{item.name}</button></li>)}{!items.length ? <li>No matching vendors.</li> : null}</ul>}
    <small>The vendor must cover every selected store.</small>
  </div>;
}

export function ComplianceCreateForm({ stores, defaultStoreId }: { defaultStoreId?: string; stores: StoreOption[] }) {
  const [selected, setSelected] = useState<string[]>(defaultStoreId ? [defaultStoreId] : []);
  const [search, setSearch] = useState(""), [region, setRegion] = useState(""), [unit, setUnit] = useState("months");
  const [who, setWho] = useState<Who>("team");
  const visible = stores.filter((s) => (!region || s.regionName === region) && `Store ${s.storeNumber} ${s.name} ${s.formattedAddress ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const single = selected.length === 1;
  const effectiveWho: Who = who === "person" && !single ? "team" : who;
  return <form action="/api/ops/compliance" method="post" encType="multipart/form-data" className={styles.form}>
    <input type="hidden" name="action" value="create" />
    <label>Inspection or renewal name<input name="name" required maxLength={160} placeholder="e.g. Fire extinguisher inspection" /></label>
    <label>Type<select name="kind"><option value="inspection">Inspection</option><option value="permit">Permit / renewal</option></select></label>

    <fieldset className={styles.form}>
      <legend>Stores</legend>
      <div className={styles.pair}>
        <label>Find a store<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Store number, name or address" /></label>
        <label>Region<select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">All regions</option>{[...new Set(stores.map((s) => s.regionName).filter(Boolean))].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      </div>
      <div><button type="button" onClick={() => setSelected([...new Set([...selected, ...visible.map((s) => s.id)])])}>Select shown</button> <button type="button" onClick={() => setSelected(selected.filter((id) => !visible.some((s) => s.id === id)))}>Clear shown</button></div>
      <p role="status">{visible.length} stores shown · {selected.length} selected</p>
      {selected.map((id) => <input type="hidden" name="storeId" value={id} key={id} />)}
      <div className={pmStyles.storeList}>{visible.map((s) => <label className={pmStyles.storeRow} key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id))} /><span><strong>Store {s.storeNumber} · {s.name}</strong>{s.formattedAddress ? <small> {s.formattedAddress}</small> : null}</span></label>)}</div>
    </fieldset>

    <fieldset className={styles.form}>
      <legend>Who does it?</legend>
      <label><input type="radio" name="assignment" value="team" checked={effectiveWho === "team"} onChange={() => setWho("team")} /> Store team — each store&apos;s manager handles their own store</label>
      <label><input type="radio" name="assignment" value="vendor" checked={effectiveWho === "vendor"} onChange={() => setWho("vendor")} /> Outside vendor — one company handles every selected store</label>
      {single ? <label><input type="radio" name="assignment" value="person" checked={effectiveWho === "person"} onChange={() => setWho("person")} /> A specific person or vendor at this store</label> : null}
      {effectiveWho === "vendor" && selected[0] ? <VendorPicker storeId={selected[0]} /> : null}
      {effectiveWho === "vendor" && !selected[0] ? <p>Choose stores first.</p> : null}
      {effectiveWho === "person" && single ? <InspectionAssigneePicker key={selected[0]} storeId={selected[0]} /> : null}
    </fieldset>

    <div className={styles.pair}><label>First due date<input type="date" name="firstDueDate" required /></label><label>Repeat<select name="intervalUnit" value={unit} onChange={(event) => setUnit(event.target.value)}><option value="once">One time</option><option value="days">Every number of days</option><option value="months">Every number of months</option></select></label></div>
    {unit !== "once" ? <label>Every<input type="number" name="intervalCount" min="1" max="365" defaultValue="12" required /><small>{unit} · Monthly = 1 month; annual = 12 months</small></label> : <input type="hidden" name="intervalCount" value="1" />}
    <label>Prepare and remind this many days before due<input type="number" name="leadDays" min="0" max="90" defaultValue="30" required /><small>The assignee receives a work order with a secure inspection link. Open items get weekly reminders.</small></label>
    <label>Instructions & blank forms (optional)<input type="file" name="templates" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" /><small>Included with each inspection work order. Up to 5 files · 8 MB total.</small></label>
    <label>Required evidence<input name="evidenceLabel" required maxLength={300} defaultValue="Inspection report or photos" /></label>
    <label>Paperwork required to close?<select name="evidenceRequired" defaultValue="1"><option value="1">Yes</option><option value="0">No — result and notes are enough</option></select></label>
    <details><summary>Instructions, requirement and escalation</summary><div className={styles.form}>
      <label>Instructions<textarea name="instructions" rows={3} maxLength={4000} /></label>
      <label>Requirement / reference<input name="requirementSource" maxLength={500} placeholder="Agency, permit, company policy or reference URL" /></label>
      {single ? <label>Equipment tag (optional)<input name="assetTag" maxLength={100} /><small>Leave blank for a store-wide inspection.</small></label> : null}
      <div className={styles.pair}><label>Escalate days before due<input name="escalationDays" type="number" min="0" max="90" defaultValue="0" /></label><label>Escalation owner<input name="escalationTo" defaultValue="Facilities coordinator" required maxLength={160} /></label></div><small>Escalations notify the facilities team and identify this owner.</small>
    </div></details>
    <button type="submit" disabled={!selected.length}>{selected.length > 1 ? `Create schedule for ${selected.length} stores` : "Create schedule"}</button>
  </form>;
}
