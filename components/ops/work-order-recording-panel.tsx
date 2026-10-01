"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { AlertTriangle, Boxes, CircleDollarSign, FilePlus2 } from "lucide-react";
import type { WorkOrderRecordingViewModel } from "./data-contract";
import styles from "./ops.module.css";

function usePostMutation() {
  const [state, setState] = useState<{ pending: boolean; error?: string }>({ pending: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState({ pending: true });
    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setState({ pending: false, error: payload?.error ?? "The work record could not be updated." });
        return;
      }
      window.location.assign(response.url || window.location.href);
    } catch {
      setState({ pending: false, error: "The work record could not be updated. Check your connection and try again." });
    }
  }
  return { state, submit };
}

function ErrorMessage({ message }: { message?: string }) {
  return message ? <p className={styles.controlError} role="alert"><AlertTriangle aria-hidden="true" size={17} />{message}</p> : null;
}

function ClassificationForm({ model }: { model: WorkOrderRecordingViewModel }) {
  const mutation = usePostMutation();
  const [categoryKey, setCategoryKey] = useState(model.currentCategory ?? "");
  const [assetId, setAssetId] = useState(model.currentAssetId ?? "");
  const [componentId, setComponentId] = useState(model.currentComponentId ?? "");
  const componentOptions = model.components.filter((component) => component.assetId === assetId);

  function changeAsset(nextAssetId: string) {
    setAssetId(nextAssetId);
    const selected = model.assets.find((asset) => asset.value === nextAssetId);
    if (selected) setCategoryKey(selected.categoryKey);
    if (!model.components.some((component) => component.value === componentId && component.assetId === nextAssetId)) setComponentId("");
  }

  return (
    <form action={model.submitAction} method="post" onSubmit={mutation.submit} className={styles.controlForm}>
      <input type="hidden" name="operation" value="classification" />
      <input type="hidden" name="submissionKey" value={model.classificationSubmissionKey} />
      <div className={styles.fieldGrid}>
        <label className={styles.field} htmlFor={`record-category-${model.workOrderId}`}>
          <span>Service area <small>Optional</small></span>
          <select id={`record-category-${model.workOrderId}`} name="categoryKey" value={categoryKey} onChange={(event) => { setCategoryKey(event.target.value); if (assetId && model.assets.find((asset) => asset.value === assetId)?.categoryKey !== event.target.value) { setAssetId(""); setComponentId(""); } }}>
            <option value="">Leave unclassified</option>
            {model.categories.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <small>You can leave this blank.</small>
        </label>
        <label className={styles.field} htmlFor={`record-asset-${model.workOrderId}`}>
          <span>Equipment <small>Optional</small></span>
          <select id={`record-asset-${model.workOrderId}`} name="assetId" value={assetId} onChange={(event) => changeAsset(event.target.value)}>
            <option value="">No equipment linked</option>
            {model.assets.filter((asset) => !categoryKey || asset.categoryKey === categoryKey).map((asset) => <option value={asset.value} key={asset.value}>{asset.label}</option>)}
          </select>
          <small>Only equipment at this work-order store is available.</small>
        </label>
      </div>
      <label className={styles.field} htmlFor={`record-component-${model.workOrderId}`}>
        <span>Component <small>Optional</small></span>
        <select id={`record-component-${model.workOrderId}`} name="componentId" value={componentId} onChange={(event) => setComponentId(event.target.value)} disabled={!assetId}>
          <option value="">No component linked</option>
          {componentOptions.map((component) => <option value={component.value} key={component.value}>{component.label}{component.description ? ` - ${component.description}` : ""}</option>)}
        </select>
        <small>Select a component if known.</small>
      </label>
      <label className={styles.field} htmlFor={`record-classification-note-${model.workOrderId}`}>
        <span>Note <small>Optional</small></span>
        <textarea id={`record-classification-note-${model.workOrderId}`} name="note" rows={2} placeholder="What was identified, if anything." />
      </label>
      <ErrorMessage message={mutation.state.error} />
      <div className={styles.formFooter}><span className={styles.formMeta}>Changes are additive and attributed.</span><button className={styles.secondaryButton} type="submit" disabled={mutation.state.pending}>{mutation.state.pending ? "Saving…" : "Save equipment"}<Boxes aria-hidden="true" size={17} /></button></div>
    </form>
  );
}

function CostForm({ model }: { model: WorkOrderRecordingViewModel }) {
  const mutation = usePostMutation();
  const [provider,setProvider] = useState(model.defaultCostProvider ?? "internal");
  const [breakdown,setBreakdown] = useState(false);
  const [lines,setLines] = useState([{id:0,description:"",amount:""}]);
  const [nextLine,setNextLine] = useState(1);
  const itemized = provider === "vendor" && breakdown;
  const total = lines.reduce((sum,line)=>sum+Math.round((Number(line.amount)||0)*100),0);
  function updateLine(id:number,field:"description"|"amount",value:string) { setLines(rows=>rows.map(row=>row.id===id?{...row,[field]:value}:row)); }
  return <form action={model.submitAction} method="post" onSubmit={mutation.submit} className={styles.controlForm}>
    <input type="hidden" name="operation" value="cost" />
    <input type="hidden" name="submissionKey" value={model.costSubmissionKey} />
    <input type="hidden" name="kind" value="other" />
    <p className={styles.formMeta}>Add the amount you know. Costs are optional, even after the work is closed.</p>
    <div className={styles.fieldGrid}>
      <label className={styles.field}><span>Expense for</span><select name="providerType" value={provider} onChange={e=>setProvider(e.target.value === "vendor" ? "vendor" : "internal")}><option value="internal">Internal expense</option><option value="vendor">Vendor cost</option></select></label>
      <label className={styles.field}><span>Total (USD)</span><input key={itemized ? "calculated" : "entered"} name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" readOnly={itemized} {...(itemized ? {value:(total/100).toFixed(2)} : {})} />{itemized ? <small>Calculated from line items</small> : null}</label>
    </div>
    {provider === "vendor" ? <><div className={styles.costHint}><CircleDollarSign aria-hidden="true" size={18}/><p>Have the invoice? <a href={`/app/invoices/new?workOrderId=${encodeURIComponent(model.workOrderId)}`}>Upload it instead</a> and we’ll match the cost.</p></div><div className={styles.field}><span>Assigned vendor</span>{model.costVendors?.[0] ? <><strong>{model.costVendors[0].label}</strong><input type="hidden" name="vendorId" value={model.costVendors[0].value}/></> : <p>Assign a vendor in <a href={`/app/work-orders/${encodeURIComponent(model.workOrderId)}?view=overview`}>the work order</a> before adding a vendor cost.</p>}</div></> : <p className={styles.formMeta}>Parts, supplies, or any known expense. No labor estimate needed.</p>}
    <div className={styles.fieldGrid}>
      <label className={styles.field}><span>Service date</span><input name="serviceDate" type="date" required defaultValue={model.defaultServiceDate}/></label>
      <label className={styles.field}><span>Note <small>Optional</small></span><input name="description" maxLength={500} placeholder={provider === "internal" ? "Replacement part, supplies…" : "Invoice total or known charge…"}/></label>
    </div>
    <label className={styles.checkField}><input type="checkbox" checked={breakdown} onChange={e=>setBreakdown(e.target.checked)}/> {provider === "vendor" ? "Add line items" : "Add breakdown"}</label>
    {itemized ? <div className={styles.costLines}>
      <input type="hidden" name="lineCount" value={lines.length}/>
      {lines.map((line,index)=><div className={styles.costLine} key={line.id}>
        <label className={styles.field}><span>Description</span><input name={`lineDescription_${index}`} aria-label={`Line ${index+1} description`} value={line.description} onChange={e=>updateLine(line.id,"description",e.target.value)} required maxLength={500} placeholder="Compressor replacement, service call…"/></label>
        <label className={styles.field}><span>Amount (USD)</span><input name={`lineAmount_${index}`} aria-label={`Line ${index+1} amount`} value={line.amount} onChange={e=>updateLine(line.id,"amount",e.target.value)} required type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00"/></label>
        <button type="button" className={styles.secondaryButton} aria-label={`Remove line ${index+1}`} disabled={lines.length===1} onClick={()=>setLines(rows=>rows.filter(row=>row.id!==line.id))}>Remove</button>
      </div>)}
      <button type="button" className={styles.secondaryButton} disabled={lines.length>=100} onClick={()=>{setLines(rows=>[...rows,{id:nextLine,description:"",amount:""}]);setNextLine(nextLine+1);}}>Add line item</button>
    </div> : breakdown ? <div className={styles.fieldGrid}>{model.costKinds.map(kind=><label key={kind.value} className={styles.field}><span>{kind.value === "other" ? "Other" : kind.label} <small>Optional</small></span><input name={`breakdown_${kind.value}`} type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00"/></label>)}<p className={styles.formMeta}>Entered amounts must add up to the total.</p></div> : null}
    {provider === "vendor" && model.recordedCostLineCount > 0 ? <label className={styles.checkField}><input type="checkbox" name="additionalExpense" value="yes"/> This is separate from any invoice already recorded.</label> : null}
    <ErrorMessage message={mutation.state.error}/>
    <div className={styles.formFooter}><span className={styles.formMeta}>{model.recordedCostLabel}</span><button className={styles.primaryButton} type="submit" disabled={mutation.state.pending || (provider === "vendor" && !model.costVendors?.length)}>{mutation.state.pending ? "Saving…" : "Save cost"}<FilePlus2 aria-hidden="true" size={17}/></button></div>
  </form>;
}

export function WorkOrderRecordingPanel({ model, section }: { model: WorkOrderRecordingViewModel; section?: "cost" | "equipment" }) {
  if (!model.available || (!model.canClassify && !model.canRecordCost)) return null;
  if (section === "cost" && model.canRecordCost) return <section className={styles.controlPanel} id="work-records" aria-label="Add cost"><div className={styles.controlHeading}><span><CircleDollarSign aria-hidden="true" size={19}/></span><div><h2>Add cost</h2><p>Record what you know.</p></div></div><CostForm model={model}/></section>;
  return (
    <section className={styles.controlPanel} id="work-records" aria-labelledby="work-records-heading">
      <div className={styles.controlHeading}>
        <span><FilePlus2 aria-hidden="true" size={19} /></span>
        <div><h2 id="work-records-heading">Optional details</h2><p>Add details as they become available.</p></div>
      </div>
      {model.canClassify && section !== "cost" ? <details open={section === "equipment"} className={`${styles.subControlPanel} ${styles.controlDisclosure}`}><summary className={styles.subControlHeading}><Boxes aria-hidden="true" size={18} /><div><h3>Link equipment</h3><p>Equipment and component are optional.</p></div></summary><ClassificationForm model={model} /></details> : null}
      {model.canRecordCost && section !== "equipment" ? <details open={section === "cost"} className={`${styles.subControlPanel} ${styles.controlDisclosure}`}><summary className={styles.subControlHeading}><CircleDollarSign aria-hidden="true" size={18} /><div><h3>Add cost</h3><p>{model.recordedCostLabel}</p></div></summary><CostForm model={model} /></details> : null}
    </section>
  );
}
