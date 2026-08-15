"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, Building2, Calculator, CheckCircle2, DatabaseZap, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import styles from "./ops.module.css";

export interface ReplacementProfileViewModel {
  id: string;
  code: string;
  name: string;
  categoryLabel: string;
  description: string;
  specificationLabel: string;
  expectedLifeLabel: string;
  escalationLabel: string;
  benchmarkAmountLabel: string;
  benchmarkSourceLabel: string;
  benchmarkEffectiveLabel: string;
  evidenceHistoryLabel: string;
  peerCount: number;
}

export interface AssetReplacementIntelligenceViewModel {
  assetId: string;
  permitted: boolean;
  action: string;
  currentAmountLabel: string;
  rangeLabel: string;
  sourceLabel: string;
  effectiveLabel: string;
  freshnessLabel: string;
  explanation: string;
  currentProfileId?: string;
  profileName?: string;
  specificationLabel: string;
  adjustmentLabel: string;
  inheritedPeerCount: number;
  profiles: ReplacementProfileViewModel[];
  event?: { id: string; approvedAmountLabel: string; approvedAtLabel: string; workOrderNumber: string };
  assetDefaults: { tag: string; name: string; manufacturer: string; model: string; supplier: string };
}

export interface WorkOrderReplacementIntelligenceViewModel {
  workOrderId: string;
  permitted: boolean;
  action: string;
  assetName?: string;
  selectedQuote?: { vendorName: string; amountLabel: string; amountInput: string; currency: string; scope: string; submittedLabel: string };
  profiles: ReplacementProfileViewModel[];
  selectedProfileId?: string;
  existingDecision?: { approvedAmountLabel: string; profileName: string; affectedAssetCount: number; benchmarkEffectiveLabel: string; applicationLabel: string };
}

export interface ReplacementProfileManagerViewModel {
  permitted: boolean;
  action: string;
  profiles: ReplacementProfileViewModel[];
  categories: Array<{ id: string; label: string; taxonomyNodeId?: string }>;
}

function useMutation() {
  const [state, setState] = useState<{ pending: boolean; error?: string }>({ pending: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState({ pending: true });
    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin", headers: { "x-traceops-client": "replacement-intelligence" } });
      const payload = await response.json().catch(() => null) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) return setState({ pending: false, error: payload?.error ?? "The replacement update could not be recorded." });
      window.location.assign(payload?.redirectTo ?? window.location.href);
    } catch { setState({ pending: false, error: "The replacement update could not be recorded. Check your connection and try again." }); }
  }
  return { state, submit };
}

function ErrorText({ value }: { value?: string }) { return value ? <p className={styles.replacementError} role="alert">{value}</p> : null; }

export function AssetReplacementIntelligencePanel({ model }: { model: AssetReplacementIntelligenceViewModel }) {
  const assignment = useMutation();
  const override = useMutation();
  const closeout = useMutation();
  return (
    <section className={styles.replacementPanel} id="replacement-intelligence">
      <header className={styles.replacementHeading}><span><Calculator aria-hidden="true" size={24} /></span><div><p>Replacement intelligence</p><h2>A current, explainable capital-planning estimate</h2><span>One dated quote can be useful immediately. Comparable equipment inherits it; unique site conditions stay equipment-specific.</span></div></header>
      <div className={styles.replacementSummary}>
        <div><small>Current outlook</small><strong>{model.currentAmountLabel}</strong><span>{model.rangeLabel}</span></div>
        <div><small>Evidence source</small><strong>{model.sourceLabel}</strong><span>{model.effectiveLabel} · {model.freshnessLabel}</span></div>
        <div><small>Comparable equipment</small><strong>{model.inheritedPeerCount}</strong><span>Active records using this profile</span></div>
      </div>
      <p className={styles.replacementExplanation}><ShieldCheck aria-hidden="true" size={18} />{model.explanation}</p>
      <div className={styles.replacementProfileLine}><div><small>Functional replacement profile</small><strong>{model.profileName ?? "No profile assigned"}</strong><span>{model.specificationLabel}</span></div><div><small>Equipment adjustment</small><strong>{model.adjustmentLabel}</strong><span>For site-specific scope only</span></div></div>
      {model.event ? <div className={styles.replacementDecision}><CheckCircle2 aria-hidden="true" size={21} /><div><strong>Replacement approved on {model.event.workOrderNumber}</strong><span>{model.event.approvedAmountLabel} approved {model.event.approvedAtLabel}. Close out the installation to retire this record, create its successor, and publish final installed cost.</span></div></div> : null}
      {model.permitted ? (
        <div className={styles.replacementForms}>
          <details><summary><RefreshCw aria-hidden="true" size={17} />Change profile or adjustment</summary><form action={model.action} method="post" onSubmit={assignment.submit}><input type="hidden" name="operation" value="assign-profile" /><label>Replacement profile<select name="profileId" defaultValue={model.currentProfileId} required>{model.profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name} · {profile.benchmarkAmountLabel}</option>)}</select></label><label>Equipment adjustment (%)<input name="adjustmentPercent" type="number" step="0.01" defaultValue="0" /><small>Use only for a repeatable site condition, such as crane access or an unusually long line set.</small></label><button className={styles.secondaryButton} type="submit" disabled={assignment.state.pending}>{assignment.state.pending ? "Saving..." : "Save equipment mapping"}</button><ErrorText value={assignment.state.error} /></form></details>
          <details><summary><Building2 aria-hidden="true" size={17} />Set an equipment-only estimate</summary><form action={model.action} method="post" onSubmit={override.submit}><input type="hidden" name="operation" value="set-override" /><div className={styles.replacementFieldRow}><label>Estimate (USD)<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Effective date<input name="effectiveAt" type="date" required /></label></div><label>Why this equipment is different<textarea name="reason" rows={3} required placeholder="Example: restricted roof access and structural curb work are unique to this store." /></label><button className={styles.secondaryButton} type="submit" disabled={override.state.pending}>{override.state.pending ? "Saving..." : "Save equipment-only estimate"}</button><ErrorText value={override.state.error} /></form></details>
          {model.event ? <details open><summary><Wrench aria-hidden="true" size={17} />Close out the approved replacement</summary><form action={model.action} method="post" onSubmit={closeout.submit}><input type="hidden" name="operation" value="complete-replacement" /><input type="hidden" name="eventId" value={model.event.id} /><div className={styles.replacementFieldRow}><label>Final installed cost (USD)<input name="finalAmount" type="number" min="0.01" step="0.01" required /></label><label>Installed date<input name="installedAt" type="date" required /></label></div><div className={styles.replacementFieldRow}><label>New equipment tag<input name="newAssetTag" defaultValue={`${model.assetDefaults.tag}-R`} required /></label><label>New equipment name<input name="newAssetName" defaultValue={model.assetDefaults.name} required /></label></div><div className={styles.replacementFieldRow}><label>Manufacturer<input name="manufacturer" defaultValue={model.assetDefaults.manufacturer} /></label><label>Model<input name="model" defaultValue={model.assetDefaults.model} /></label></div><div className={styles.replacementFieldRow}><label>Serial number<input name="serialNumber" /></label><label>Supplier<input name="supplier" defaultValue={model.assetDefaults.supplier} /></label></div><label>Warranty end date<input name="warrantyEndsAt" type="date" /></label><button className={styles.primaryButton} type="submit" disabled={closeout.state.pending}>{closeout.state.pending ? "Closing out..." : "Retire old equipment and create successor"}<ArrowRight aria-hidden="true" size={17} /></button><ErrorText value={closeout.state.error} /></form></details> : null}
        </div>
      ) : null}
    </section>
  );
}

export function WorkOrderReplacementIntelligencePanel({ model }: { model: WorkOrderReplacementIntelligenceViewModel }) {
  const mutation = useMutation();
  if (!model.assetName) return null;
  return (
    <section className={styles.replacementPanel} id="replacement-intelligence">
      <header className={styles.replacementHeading}><span><DatabaseZap aria-hidden="true" size={24} /></span><div><p>Capital decision handoff</p><h2>Turn an approved replacement quote into reusable planning evidence</h2><span>The quote remains tied to this work order. A single quote is enough to start; it is never presented as a market average.</span></div></header>
      {model.existingDecision ? <div className={styles.replacementDecision}><CheckCircle2 aria-hidden="true" size={21} /><div><strong>Replacement decision recorded</strong><span>{model.existingDecision.approvedAmountLabel} approved against {model.existingDecision.profileName}. {model.existingDecision.applicationLabel}</span></div></div> : model.selectedQuote ? (
        <>
          <div className={styles.replacementQuote}><div><small>Selected vendor quote</small><strong>{model.selectedQuote.vendorName} · {model.selectedQuote.amountLabel}</strong><span>{model.selectedQuote.scope}</span></div><span>{model.selectedQuote.submittedLabel}</span></div>
          {model.permitted ? <form className={styles.replacementApprovalForm} action={model.action} method="post" onSubmit={mutation.submit}><div className={styles.replacementFieldRow}><label>Planning group<select name="profileId" defaultValue={model.selectedProfileId} required>{model.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><small>This is the budgeting group, not a technical compatibility certification.</small></label><label>Quote effective date<input name="effectiveAt" type="date" required /></label></div><label>Where should this planning reference apply?<select name="planningApplication" defaultValue="planning_group" required><option value="planning_group">Update this planning group</option><option value="asset_only">This equipment only</option></select><small>Use the group for a normal example. Use equipment only when access, size, or installation scope makes this location unusually expensive.</small></label><div className={styles.replacementCostSplit}><label>Equipment (USD)<input name="equipmentAmount" defaultValue={model.selectedQuote.amountInput} type="number" min="0" step="0.01" required /></label><label>Installation (USD)<input name="installationAmount" defaultValue="0.00" type="number" min="0" step="0.01" required /></label><label>Other (USD)<input name="otherAmount" defaultValue="0.00" type="number" min="0" step="0.01" required /></label></div><label>Decision note <small>Optional</small><textarea name="notes" rows={3} placeholder="Document what the vendor included or any known site-specific scope." /></label><p className={styles.replacementExplanation}><ShieldCheck aria-hidden="true" size={18} />TraceOps records the vendor’s recommendation and the client’s planning choice. It does not certify the vendor’s technical selection. The three cost fields must equal the selected quote.</p><button className={styles.primaryButton} type="submit" disabled={mutation.state.pending}>{mutation.state.pending ? "Recording..." : "Approve replacement and save planning reference"}<ArrowRight aria-hidden="true" size={17} /></button><ErrorText value={mutation.state.error} /></form> : null}
        </>
      ) : <p className={styles.replacementBlank}>Select a submitted vendor bid above before recording a replacement decision. Repair work can continue without using this feature.</p>}
    </section>
  );
}

export function ReplacementProfileManager({ model }: { model: ReplacementProfileManagerViewModel }) {
  const create = useMutation();
  const publish = useMutation();
  return (
    <section className={styles.replacementPanel} id="replacement-profiles">
      <header className={styles.replacementHeading}><span><DatabaseZap aria-hidden="true" size={24} /></span><div><p>Company replacement library</p><h2>One functional profile, many equipment records</h2><span>Whole-equipment capital benchmarks stay separate from component service costs. One dated source can be published; later evidence strengthens the history.</span></div></header>
      <div className={styles.replacementProfileGrid}>{model.profiles.map((profile) => <article key={profile.id}><small>{profile.code} · {profile.categoryLabel}</small><strong>{profile.name}</strong><p>{profile.description}</p><dl><div><dt>Specification</dt><dd>{profile.specificationLabel}</dd></div><div><dt>Current benchmark</dt><dd>{profile.benchmarkAmountLabel}</dd></div><div><dt>Evidence</dt><dd>{profile.benchmarkSourceLabel} · {profile.benchmarkEffectiveLabel}<br />{profile.evidenceHistoryLabel}</dd></div><div><dt>Active equipment</dt><dd>{profile.peerCount}</dd></div></dl>{model.permitted ? <details><summary>Publish a newer benchmark</summary><form action={model.action} method="post" onSubmit={publish.submit}><input type="hidden" name="operation" value="publish-benchmark" /><input type="hidden" name="profileId" value={profile.id} /><div className={styles.replacementCostSplit}><label>Equipment<input name="equipmentAmount" type="number" min="0" step="0.01" required /></label><label>Installation<input name="installationAmount" type="number" min="0" step="0.01" required /></label><label>Other<input name="otherAmount" type="number" min="0" step="0.01" required /></label></div><label>Effective date<input name="effectiveAt" type="date" required /></label><label>Evidence note<textarea name="notes" rows={2} required /></label><button className={styles.secondaryButton} type="submit" disabled={publish.state.pending}>Publish dated benchmark</button><ErrorText value={publish.state.error} /></form></details> : null}</article>)}</div>
      {model.permitted ? <details className={styles.replacementCreate}><summary>Create a functional replacement profile</summary><form action={model.action} method="post" onSubmit={create.submit}><input type="hidden" name="operation" value="create-profile" /><div className={styles.replacementFieldRow}><label>Profile code<input name="code" required placeholder="REF-WALKIN-MED" /></label><label>Name<input name="name" required placeholder="Medium walk-in refrigeration system" /></label></div><label>Description<textarea name="description" rows={2} required /></label><div className={styles.replacementFieldRow}><label>Service area<select name="categoryKey" required>{model.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>Expected life (years)<input name="expectedLifeYears" type="number" min="1" max="100" defaultValue="15" required /></label></div><label>Known comparison details <small>Optional; one key=value per line</small><textarea name="attributes" rows={4} placeholder={"capacity_tons=5\nvoltage=208-230\nrefrigerant=R-448A"} /><small>Start broad. Add a detail only when it materially changes which equipment is comparable.</small></label><label>Details that must match <small>Optional; comma separated</small><input name="matchKeys" placeholder="capacity_tons, voltage" /><small>If left blank, the known details above are used. If both are blank, this starts as a broad profile you can refine later.</small></label><div className={styles.replacementCostSplit}><label>Annual escalation (basis points)<input name="annualEscalationBps" type="number" defaultValue="300" required /></label><label>Low range (basis points)<input name="lowVarianceBps" type="number" defaultValue="1000" required /></label><label>High range (basis points)<input name="highVarianceBps" type="number" defaultValue="2000" required /></label></div><button className={styles.primaryButton} type="submit" disabled={create.state.pending}>{create.state.pending ? "Creating..." : "Create profile"}</button><ErrorText value={create.state.error} /></form></details> : null}
    </section>
  );
}
