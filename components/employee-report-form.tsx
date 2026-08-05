"use client";

import { ArrowLeft, Camera, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "@/components/site-link";
import { useEffect, useMemo, useState } from "react";
import { platformData } from "@/lib/platform/data";

export function EmployeeReportForm() {
  const [storeId, setStoreId] = useState("store-45");
  const [area, setArea] = useState("Beer cave");
  const [description, setDescription] = useState("Beer cave feels warm; thermometer reads 49°F.");
  const [urgency, setUrgency] = useState("high");
  const [created, setCreated] = useState<{ id: string; reference: string } | null>(null);
  const [createdStores, setCreatedStores] = useState<Array<{ id: string; name: string; city: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/registry?entity=stores").then((response) => response.json()).then((raw) => {
      const result = raw as { ok?: boolean; records?: Array<Record<string, unknown>> };
      if (result.ok) setCreatedStores((result.records ?? []).map((item) => ({ id: String(item.id ?? ""), name: String(item.name ?? `Store ${item.code ?? "New"}`), city: String(item.city ?? "") })).filter((item) => item.id));
    }).catch(() => undefined);
  }, []);
  const storeOptions = useMemo(() => [...new Map([...platformData.stores.map((store) => ({ id: store.id, name: store.name, city: store.city })), ...createdStores].map((store) => [store.id, store])).values()], [createdStores]);

  async function submitReport() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity: "requests", data: { storeId, area, description, urgency, reporterName: "Store team member" } }),
      });
      const result = await response.json() as { ok?: boolean; id?: string; reference?: string; error?: string };
      if (!response.ok || !result.ok || !result.id || !result.reference) throw new Error(result.error ?? "Unable to submit this request");
      setCreated({ id: result.id, reference: result.reference });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this request");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <div className="mobile-surface"><div className="mobile-frame"><div className="mobile-head"><div className="brand"><div className="brand-mark">MI</div><div className="brand-copy"><strong>Maintenance Intelligence</strong><span>Pilot store issue reporting</span></div></div></div><div className="mobile-body"><div className="result-state"><CheckCircle2 size={27} color="#0e6255" /><h1>Report received</h1><p>Your original wording is locked as report {created.reference}. Store review and facilities can add context without changing what you submitted.</p></div><div className="callout"><strong>What happens next</strong><p>The store manager reviews urgency. If service is needed, the customer team creates an internal work order and keeps you out of vendor coordination.</p></div><Link className="mobile-action" style={{ marginTop: 14 }} href="/requests#maintenance-original-reports">Open the request triage queue</Link></div></div></div>;

  return <div className="mobile-surface"><div className="mobile-frame"><div className="mobile-head"><div className="mobile-head-row"><div className="brand-copy"><strong>Report a store issue</strong><span>About two minutes</span></div><Link href="/" aria-label="Back to operations"><ArrowLeft /></Link></div></div><div className="mobile-body"><span className="step-label">Employee intake · Store + Category</span><h1>What needs attention?</h1><p>Describe what you can observe. Equipment details are optional and can be added later by facilities or the vendor.</p>
    <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void submitReport(); }}>
      <label className="form-field"><span>Store</span><select value={storeId} onChange={(event) => setStoreId(event.target.value)}>{storeOptions.map((store) => <option value={store.id} key={store.id}>{store.name} · {store.city}</option>)}</select></label>
      <label className="form-field"><span>Area or system</span><select value={area} onChange={(event) => setArea(event.target.value)}><option>Beer cave</option><option>Sales floor HVAC</option><option>Walk-in freezer</option><option>Restroom</option><option>Fuel canopy</option><option>Other / not sure</option></select><small>Plain-language choices map to the operational category.</small></label>
      <label className="form-field"><span>What did you notice?</span><textarea required value={description} onChange={(event) => setDescription(event.target.value)} /><small><LockKeyhole size={10} style={{ verticalAlign: "middle" }} /> This wording becomes an immutable source record after submission.</small></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="form-field" style={{ marginBottom: 6 }}><span>Urgency</span></legend><div className="option-list">{[["critical", "Immediate danger or store cannot operate", "Safety risk, flooding, major outage or product at risk"], ["high", "Needs attention today", "Operations are affected but the site can remain open"], ["routine", "Can be scheduled", "No immediate operational or safety impact"]].map(([value, label, help]) => <label className="option-card" aria-label={label} key={value}><input type="radio" name="urgency" value={value} checked={urgency === value} onChange={() => setUrgency(value)} /><span><strong>{label}</strong><span>{help}</span></span></label>)}</div></fieldset>
      <label className="button" htmlFor="report-photo" style={{ minHeight: 46 }}><Camera />Add a photo (optional)</label><input id="report-photo" className="sr-only" type="file" accept="image/*" />
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="mobile-action" type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit report"}</button>
    </form></div></div></div>;
}
