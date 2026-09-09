"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { OPS_CLIENT_HEADER } from "@/lib/ops/http-contract";
import { AlertTriangle, ArrowRight, Building2, Calculator, CheckCircle2, CircleOff, DatabaseZap, Layers3, ListChecks, MapPin, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
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
  impact: { affectedAssetCount: number; affectedStoreCount: number; overrideCount: number };
  freshness: "current" | "aging" | "stale" | "unavailable";
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
  recommendation: { recommendationLabel: string; confidenceLabel: string; explanation: string; missingData: string[] };
  recommendationHistory: Array<{ id: string; version: number; modelVersion: string; recommendationLabel: string; confidenceLabel: string; decisionLabel: string; planningLabel: string; reason: string; decidedAtLabel: string; explanation: string; missingData: string[]; actualOutcomeLabel: string }>;
  latestRecommendationId?: string;
  defaultPlanningYear: number;
  assetDefaults: { tag: string; name: string; manufacturer: string; model: string; supplier: string };
}

export interface WorkOrderReplacementIntelligenceViewModel {
  workOrderId: string;
  permitted: boolean;
  canPublishGroup: boolean;
  action: string;
  assetName?: string;
  selectedQuote?: { vendorName: string; amountLabel: string; amountInput: string; currency: string; scope: string; submittedLabel: string };
  profiles: ReplacementProfileViewModel[];
  selectedProfileId?: string;
  existingDecision?: { approvedAmountLabel: string; profileName: string; affectedAssetCount: number; benchmarkEffectiveLabel: string; applicationLabel: string };
}

export interface ReplacementProfileManagerViewModel {
  permitted: boolean;
  canManageGroups: boolean;
  action: string;
  profiles: ReplacementProfileViewModel[];
  categories: Array<{ id: string; label: string; taxonomyNodeId?: string }>;
  coverage: {
    activeAssetCount: number;
    lifecycleTrackedCount: number;
    assignedCount: number;
    currentEstimateCount: number;
    needsClassificationCount: number;
    excludedCount: number;
    staleProfileCount: number;
    coveragePercentage: number;
  };
  classificationRows: Array<{
    assetId: string;
    assetName: string;
    assetTag: string;
    storeLabel: string;
    categoryLabel: string;
    status: "needs_classification" | "not_tracked";
    currentEstimateLabel: string;
    defaultDecision: string;
    candidates: Array<{ profileId: string; profileName: string; confidenceLabel: string; explanation: string }>;
    exclusionReason?: string;
  }>;
  classificationTotalCount: number;
  staleProfiles: Array<{ id: string; name: string; effectiveLabel: string; peerCount: number }>;
}

function useMutation() {
  const [state, setState] = useState<{ pending: boolean; error?: string }>({ pending: false });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState({ pending: true });
    try {
      const response = await fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin", headers: { [OPS_CLIENT_HEADER]: "replacement-intelligence" } });
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
  const recommendation = useMutation();
  const [managerDecision, setManagerDecision] = useState("investigate");
  const requiresPlanningYear = managerDecision === "replace" || managerDecision === "defer";
  return (
    <section className={styles.replacementPanel} id="replacement-intelligence">
      <header className={styles.replacementHeading}><span><Calculator aria-hidden="true" size={24} /></span><div><p>Replacement intelligence</p><h2>A current, explainable capital-planning estimate</h2><span>One dated quote can be useful immediately. Comparable equipment inherits it; unique site conditions stay equipment-specific.</span></div></header>
      <div className={styles.replacementSummary}>
        <div><small>Current outlook</small><strong>{model.currentAmountLabel}</strong><span>{model.rangeLabel}</span></div>
        <div><small>Evidence source</small><strong>{model.sourceLabel}</strong><span>{model.effectiveLabel} · {model.freshnessLabel}</span></div>
        <div><small>Comparable equipment</small><strong>{model.inheritedPeerCount}</strong><span>Active records using this profile</span></div>
      </div>
      <p className={styles.replacementExplanation}><ShieldCheck aria-hidden="true" size={18} />{model.explanation}</p>
      <div className={styles.replacementRecommendation}>
        <div><small>Current transparent rule result</small><strong>{model.recommendation.recommendationLabel} · {model.recommendation.confidenceLabel} confidence</strong><p>{model.recommendation.explanation}</p><span>Known gaps: {model.recommendation.missingData.join(" · ") || "None"}</span></div>
        {model.permitted ? <form action={model.action} method="post" onSubmit={recommendation.submit}><input type="hidden" name="operation" value="record-recommendation" /><label>Manager decision<select name="userDecision" required value={managerDecision} onChange={(event) => setManagerDecision(event.target.value)}><option value="repair">Proceed with repair</option><option value="replace">Plan replacement</option><option value="defer">Defer replacement</option><option value="investigate">Investigate further</option></select></label>{requiresPlanningYear ? <label>Capital-planning year<input name="plannedForYear" type="number" min="2000" max="2200" defaultValue={model.defaultPlanningYear} required /><small>This becomes the management plan year. It can be revised later without rewriting the earlier decision.</small></label> : null}<label>Decision reason<textarea name="userReason" rows={3} required placeholder="Explain why this choice is reasonable given the visible evidence and missing data." /></label><button className={styles.primaryButton} type="submit" disabled={recommendation.state.pending}>{recommendation.state.pending ? "Recording..." : "Record decision"}</button><ErrorText value={recommendation.state.error} /></form> : null}
      </div>
      {model.recommendationHistory.length ? <details className={styles.replacementHistory} open><summary>Decision history ({model.recommendationHistory.length})</summary>{model.recommendationHistory.map((row) => <article key={row.id}><div><strong>Version {row.version} · {row.decisionLabel}</strong><span>{row.recommendationLabel} system result · {row.confidenceLabel} confidence · {row.decidedAtLabel}</span></div><p>{row.explanation}</p><dl><div><dt>Capital plan</dt><dd>{row.planningLabel}</dd></div><div><dt>Reason</dt><dd>{row.reason}</dd></div><div><dt>Later outcome</dt><dd>{row.actualOutcomeLabel}</dd></div><div><dt>Missing data at decision</dt><dd>{row.missingData.join(" · ") || "None"}</dd></div></dl></article>)}</details> : null}
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
  const [profileId, setProfileId] = useState(model.selectedProfileId ?? model.profiles[0]?.id ?? "");
  const [application, setApplication] = useState<"planning_group" | "asset_only">(model.canPublishGroup ? "planning_group" : "asset_only");
  const selectedProfile = model.profiles.find((profile) => profile.id === profileId);
  if (!model.assetName) return null;
  return (
    <section className={styles.replacementPanel} id="replacement-intelligence">
      <header className={styles.replacementHeading}><span><DatabaseZap aria-hidden="true" size={24} /></span><div><p>Capital decision handoff</p><h2>Turn an approved replacement quote into reusable planning evidence</h2><span>The quote remains tied to this work order. A single quote is enough to start; it is never presented as a market average.</span></div></header>
      {model.existingDecision ? <div className={styles.replacementDecision}><CheckCircle2 aria-hidden="true" size={21} /><div><strong>Replacement decision recorded</strong><span>{model.existingDecision.approvedAmountLabel} approved against {model.existingDecision.profileName}. {model.existingDecision.applicationLabel}</span></div></div> : model.selectedQuote ? (
        <>
          <div className={styles.replacementQuote}><div><small>Selected vendor quote</small><strong>{model.selectedQuote.vendorName} · {model.selectedQuote.amountLabel}</strong><span>{model.selectedQuote.scope}</span></div><span>{model.selectedQuote.submittedLabel}</span></div>
          {model.permitted ? <form className={styles.replacementApprovalForm} action={model.action} method="post" onSubmit={mutation.submit}>
            <div className={styles.replacementFieldRow}><label>Company planning group<select name="profileId" value={profileId} onChange={(event) => setProfileId(event.target.value)} required>{model.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select><small>A planning group shares one replacement-cost reference. It does not certify technical fit.</small></label><label>Quote effective date<input name="effectiveAt" type="date" required /></label></div>
            <label>Use this quote for<select name="planningApplication" value={application} onChange={(event) => setApplication(event.target.value as "planning_group" | "asset_only")} required>{model.canPublishGroup ? <option value="planning_group">This equipment and its planning group</option> : null}<option value="asset_only">This equipment only</option></select><small>{model.canPublishGroup ? "Choose equipment only when this store has unusual installation scope, access, or size." : "A companywide planning-group update requires facilities-level review; your decision will stay with this equipment."}</small></label>
            {application === "planning_group" && selectedProfile ? <div className={styles.replacementImpact}>
              <div><Layers3 aria-hidden="true" size={21} /><span><small>Equipment updated</small><strong>{selectedProfile.impact.affectedAssetCount}</strong></span></div>
              <div><MapPin aria-hidden="true" size={21} /><span><small>Stores represented</small><strong>{selectedProfile.impact.affectedStoreCount}</strong></span></div>
              <div><ShieldCheck aria-hidden="true" size={21} /><span><small>Equipment-only estimates kept</small><strong>{selectedProfile.impact.overrideCount}</strong></span></div>
              <p>This publishes a new planning reference for the group. Equipment-only estimates remain unchanged and continue to win.</p>
              <label className={styles.replacementImpactConfirm}><input name="impactConfirmed" value="yes" type="checkbox" required />I reviewed this portfolio impact.</label>
              <input type="hidden" name="confirmedAffectedAssetCount" value={selectedProfile.impact.affectedAssetCount} />
              <input type="hidden" name="confirmedOverrideCount" value={selectedProfile.impact.overrideCount} />
            </div> : <p className={styles.replacementExplanation}><CircleOff aria-hidden="true" size={18} />This quote will remain specific to {model.assetName}. No other store’s planning estimate will change.</p>}
            <div className={styles.replacementCostSplit}><label>Equipment (USD)<input name="equipmentAmount" defaultValue={model.selectedQuote.amountInput} type="number" min="0" step="0.01" required /></label><label>Installation (USD)<input name="installationAmount" defaultValue="0.00" type="number" min="0" step="0.01" required /></label><label>Other (USD)<input name="otherAmount" defaultValue="0.00" type="number" min="0" step="0.01" required /></label></div>
            <label>Decision note <small>Optional</small><textarea name="notes" rows={3} placeholder="Document what the vendor included or why this quote is a useful planning reference." /></label>
            <p className={styles.replacementExplanation}><ShieldCheck aria-hidden="true" size={18} />The vendor remains responsible for technical selection. The platform records the quote, the client’s planning choice, and exactly which equipment records inherit it.</p>
            <button className={styles.primaryButton} type="submit" disabled={mutation.state.pending}>{mutation.state.pending ? "Recording..." : "Approve replacement and save planning reference"}<ArrowRight aria-hidden="true" size={17} /></button><ErrorText value={mutation.state.error} />
          </form> : null}
        </>
      ) : <p className={styles.replacementBlank}>Select a submitted vendor quote above before recording a replacement decision. Repair work can continue without using this feature.</p>}
    </section>
  );
}

export function ReplacementProfileManager({ model }: { model: ReplacementProfileManagerViewModel }) {
  const create = useMutation();
  const publish = useMutation();
  const classify = useMutation();
  return (
    <section className={styles.replacementPanel} id="replacement-coverage">
      <header className={styles.replacementHeading}><span><ListChecks aria-hidden="true" size={24} /></span><div><p>Replacement planning setup</p><h2>Keep companywide estimates current without updating stores one by one</h2><span>Assign equipment to a plain-language planning group once. New quotes and final installed costs can then refresh that group while unusual stores keep their own estimate.</span></div></header>
      <div className={styles.replacementCoverageSummary}>
        <div><small>Shared planning coverage</small><strong>{model.coverage.assignedCount} of {model.coverage.lifecycleTrackedCount}</strong><span>{model.coverage.coveragePercentage}% of equipment included in lifecycle planning</span></div>
        <div data-tone={model.coverage.needsClassificationCount ? "warning" : "good"}><small>Needs a quick choice</small><strong>{model.coverage.needsClassificationCount}</strong><span>Choose a suggested group or mark it not tracked</span></div>
        <div><small>Planning estimates available</small><strong>{model.coverage.currentEstimateCount}</strong><span>Current, aging, or equipment-specific sources</span></div>
        <div><small>Not tracked by choice</small><strong>{model.coverage.excludedCount}</strong><span>Excluded without retiring the equipment record</span></div>
      </div>
      {model.classificationRows.length ? <form className={styles.replacementCoverageForm} action={model.action} method="post" onSubmit={classify.submit}>
        <input type="hidden" name="operation" value="bulk-classify" />
        <div className={styles.replacementCoverageHeading}><div><h3>Finish the remaining planning choices</h3><p>The best company-group suggestion is selected when the recorded details match. Review the name and location—no technical verification is required.</p></div><strong>{model.classificationTotalCount} to review</strong></div>
        <div className={styles.replacementCoverageRows}>{model.classificationRows.map((row) => <div className={styles.replacementCoverageRow} key={row.assetId}>
          <div><small>{row.storeLabel} · {row.assetTag}</small><strong>{row.assetName}</strong><span>{row.categoryLabel} · {row.currentEstimateLabel}</span></div>
          <label>Planning choice<select name={`assetDecision.${row.assetId}`} defaultValue={row.defaultDecision}>
            <option value="leave">Leave unchanged</option>
            {row.candidates.map((candidate) => <option value={`profile:${candidate.profileId}`} key={candidate.profileId}>{candidate.profileName} · {candidate.confidenceLabel}</option>)}
            <option value="exclude">Do not include in lifecycle planning</option>
          </select><small>{row.status === "not_tracked" ? row.exclusionReason : row.candidates[0]?.explanation ?? "No company planning group currently matches this equipment."}</small></label>
        </div>)}</div>
        {model.classificationTotalCount > model.classificationRows.length ? <p className={styles.replacementCoverageMore}>{model.classificationRows.length} records are shown in this review batch. Save them, then continue with the remaining {model.classificationTotalCount - model.classificationRows.length}.</p> : null}
        <label className={styles.replacementExclusionReason}>Reason used only for “do not include” choices <small>Optional</small><textarea name="exclusionReason" rows={2} placeholder="Example: landlord-owned equipment is not part of the company capital plan." /></label>
        <div className={styles.replacementCoverageActions}><p><ShieldCheck aria-hidden="true" size={18} />Nothing is assigned automatically. Every choice stays auditable and can be changed later.</p><button className={styles.primaryButton} type="submit" disabled={classify.state.pending}>{classify.state.pending ? "Saving..." : "Save planning choices"}</button></div>
        <ErrorText value={classify.state.error} />
      </form> : <div className={styles.replacementCoverageComplete}><CheckCircle2 aria-hidden="true" size={22} /><div><strong>No equipment is waiting for classification</strong><span>Shared planning coverage is complete for every active equipment record that the company chose to track.</span></div></div>}

      {model.staleProfiles.length ? <div className={styles.replacementStaleReview}><AlertTriangle aria-hidden="true" size={22} /><div><strong>{model.staleProfiles.length} planning group{model.staleProfiles.length === 1 ? "" : "s"} should be refreshed</strong><p>This is one low-noise review per group—not one alert per equipment record.</p>{model.staleProfiles.map((profile) => <a href={`#profile-${profile.id}`} key={profile.id}>{profile.name} · {profile.peerCount} equipment · source dated {profile.effectiveLabel}</a>)}</div></div> : null}

      <details className={styles.replacementLibrary} id="replacement-profiles"><summary><DatabaseZap aria-hidden="true" size={18} /><span><strong>Company planning groups</strong><small>{model.profiles.length} groups · open to review sources or publish a newer benchmark</small></span></summary>
        <div className={styles.replacementProfileGrid}>{model.profiles.map((profile) => <article id={`profile-${profile.id}`} key={profile.id}><small>{profile.code} · {profile.categoryLabel}</small><strong>{profile.name}</strong><p>{profile.description}</p><dl><div><dt>Comparison details</dt><dd>{profile.specificationLabel}</dd></div><div><dt>Current estimate</dt><dd>{profile.benchmarkAmountLabel}</dd></div><div><dt>Source</dt><dd>{profile.benchmarkSourceLabel} · {profile.benchmarkEffectiveLabel}<br />{profile.evidenceHistoryLabel}</dd></div><div><dt>Portfolio use</dt><dd>{profile.impact.affectedAssetCount} equipment across {profile.impact.affectedStoreCount} stores</dd></div></dl>{model.canManageGroups ? <details><summary>Publish a newer estimate</summary><form action={model.action} method="post" onSubmit={publish.submit}><input type="hidden" name="operation" value="publish-benchmark" /><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="confirmedAffectedAssetCount" value={profile.impact.affectedAssetCount} /><input type="hidden" name="confirmedOverrideCount" value={profile.impact.overrideCount} /><div className={styles.replacementCostSplit}><label>Equipment<input name="equipmentAmount" type="number" min="0" step="0.01" required /></label><label>Installation<input name="installationAmount" type="number" min="0" step="0.01" required /></label><label>Other<input name="otherAmount" type="number" min="0" step="0.01" required /></label></div><label>Effective date<input name="effectiveAt" type="date" required /></label><label>Where the estimate came from<textarea name="notes" rows={2} required /></label><label className={styles.replacementImpactConfirm}><input name="impactConfirmed" value="yes" type="checkbox" required />Update {profile.impact.affectedAssetCount} equipment across {profile.impact.affectedStoreCount} stores; keep {profile.impact.overrideCount} equipment-only estimate{profile.impact.overrideCount === 1 ? "" : "s"}.</label><button className={styles.secondaryButton} type="submit" disabled={publish.state.pending}>Publish dated estimate</button><ErrorText value={publish.state.error} /></form></details> : null}</article>)}</div>
        {model.canManageGroups ? <details className={styles.replacementCreate}><summary>Create another planning group</summary><form action={model.action} method="post" onSubmit={create.submit}><input type="hidden" name="operation" value="create-profile" /><div className={styles.replacementFieldRow}><label>Short code<input name="code" required placeholder="REF-WALKIN-MED" /></label><label>Plain-language name<input name="name" required placeholder="Medium walk-in refrigeration system" /></label></div><label>What belongs in this group<textarea name="description" rows={2} required /></label><div className={styles.replacementFieldRow}><label>Service area<select name="categoryKey" required>{model.categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>Typical planning life (years)<input name="expectedLifeYears" type="number" min="1" max="100" defaultValue="15" required /></label></div><details className={styles.replacementAdvanced}><summary>Optional comparison details</summary><label>Known details <small>One key=value per line; only use details that materially change replacement cost.</small><textarea name="attributes" rows={4} placeholder={"capacity_tons=5\nrefrigerant=R-448A"} /></label><label>Details that must match <small>Comma separated</small><input name="matchKeys" placeholder="capacity_tons, refrigerant" /></label><div className={styles.replacementCostSplit}><label>Annual escalation (basis points)<input name="annualEscalationBps" type="number" defaultValue="300" required /></label><label>Low range (basis points)<input name="lowVarianceBps" type="number" defaultValue="1000" required /></label><label>High range (basis points)<input name="highVarianceBps" type="number" defaultValue="2000" required /></label></div></details><button className={styles.primaryButton} type="submit" disabled={create.state.pending}>{create.state.pending ? "Creating..." : "Create planning group"}</button><ErrorText value={create.state.error} /></form></details> : null}
      </details>
    </section>
  );
}
