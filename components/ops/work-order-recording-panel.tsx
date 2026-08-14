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
          <small>Use the company-wide service language. Classification can remain deferred.</small>
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
        <small>Component depth is useful for repeat repairs and warranties, but never required.</small>
      </label>
      <label className={styles.field} htmlFor={`record-classification-note-${model.workOrderId}`}>
        <span>Classification note <em>Required</em></span>
        <textarea id={`record-classification-note-${model.workOrderId}`} name="note" required rows={3} placeholder="Record what was identified, diagnosed, or corrected." />
      </label>
      <ErrorMessage message={mutation.state.error} />
      <div className={styles.formFooter}><span className={styles.formMeta}>Changes are additive and attributed.</span><button className={styles.secondaryButton} type="submit" disabled={mutation.state.pending}>{mutation.state.pending ? "Recording…" : "Update classification"}<Boxes aria-hidden="true" size={17} /></button></div>
    </form>
  );
}

function CostForm({ model }: { model: WorkOrderRecordingViewModel }) {
  const mutation = usePostMutation();
  return (
    <form action={model.submitAction} method="post" onSubmit={mutation.submit} className={styles.controlForm}>
      <input type="hidden" name="operation" value="cost" />
      <input type="hidden" name="submissionKey" value={model.costSubmissionKey} />
      <div className={styles.fieldGrid}>
        <label className={styles.field} htmlFor={`record-cost-kind-${model.workOrderId}`}>
          <span>Cost type <em>Required</em></span>
          <select id={`record-cost-kind-${model.workOrderId}`} name="kind" required defaultValue="labor">
            {model.costKinds.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.field} htmlFor={`record-cost-amount-${model.workOrderId}`}>
          <span>Recorded amount <em>Required</em></span>
          <input id={`record-cost-amount-${model.workOrderId}`} name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" />
        </label>
      </div>
      <div className={styles.fieldGrid}>
        <label className={styles.field} htmlFor={`record-cost-date-${model.workOrderId}`}>
          <span>Service date <em>Required</em></span>
          <input id={`record-cost-date-${model.workOrderId}`} name="serviceDate" type="date" required defaultValue={model.defaultServiceDate} />
        </label>
        <label className={styles.field} htmlFor={`record-cost-description-${model.workOrderId}`}>
          <span>Description <em>Required</em></span>
          <input id={`record-cost-description-${model.workOrderId}`} name="description" required placeholder="Diagnostic labor, replacement motor, travel…" />
        </label>
      </div>
      <div className={styles.controlWarning}><CircleDollarSign aria-hidden="true" size={18} /><p>This is a recorded work-cost fact, not an invoice, approval, or payment. Invoice safeguards remain optional and separate.</p></div>
      <ErrorMessage message={mutation.state.error} />
      <div className={styles.formFooter}><span className={styles.formMeta}>{model.recordedCostLabel} across {model.recordedCostLineCount} existing source line{model.recordedCostLineCount === 1 ? "" : "s"}</span><button className={styles.primaryButton} type="submit" disabled={mutation.state.pending}>{mutation.state.pending ? "Recording…" : "Add recorded cost"}<FilePlus2 aria-hidden="true" size={17} /></button></div>
    </form>
  );
}

export function WorkOrderRecordingPanel({ model }: { model: WorkOrderRecordingViewModel }) {
  if (!model.available || (!model.canClassify && !model.canRecordCost)) return null;
  return (
    <section className={styles.controlPanel} id="work-records" aria-labelledby="work-records-heading">
      <div className={styles.controlHeading}>
        <span><FilePlus2 aria-hidden="true" size={19} /></span>
        <div><h2 id="work-records-heading">Record the facts that power visibility</h2><p>Classify work after diagnosis and add entered cost as separate source facts. Dashboards and lifecycle drilldowns derive from these records.</p></div>
      </div>
      {model.canClassify ? <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}><summary className={styles.subControlHeading}><Boxes aria-hidden="true" size={18} /><div><h3>Classify after intake</h3><p>Service area, equipment, and component remain optional until the facts are known.</p></div></summary><ClassificationForm model={model} /></details> : null}
      {model.canRecordCost ? <details className={`${styles.subControlPanel} ${styles.controlDisclosure}`}><summary className={styles.subControlHeading}><CircleDollarSign aria-hidden="true" size={18} /><div><h3>Add recorded work cost</h3><p>{model.recordedCostLabel} across {model.recordedCostLineCount} existing source line{model.recordedCostLineCount === 1 ? "" : "s"}; invoices remain optional.</p></div></summary><CostForm model={model} /></details> : null}
    </section>
  );
}
