"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Clock3, MapPin } from "lucide-react";
import type {
  ActiveVisitView,
  LocationEvidenceInput,
  PerWorkOrderVisitOutcome,
  StorePortalView,
  TechnicianCheckInReceipt,
  TechnicianCheckOutReceipt,
  VendorVisitContextView,
  VisitOutcome,
  WorkOrderVisitOutcome,
} from "./contracts";
import { LocationEvidenceControl } from "./location-evidence-control";
import type { PendingVisitCheckout } from "./pending-visit-cookie";
import { formatPublicDateTime, PublicFrame, ServerReceipt } from "./public-ui";
import { PendingVisitCard } from "./store-portal-home";
import styles from "./public-workflows.module.css";

type FlowMode = "check_in" | "check_out";
type VisitReceipt = TechnicianCheckInReceipt | TechnicianCheckOutReceipt;
type OutcomeDraft = {
  outcome: WorkOrderVisitOutcome | "";
  outcomeNotes: string;
  accountableParty: string;
  nextAction: string;
  dueAt: string;
  escalationTo: string;
};

const SUBMISSION_KEY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SUBMISSION_STORAGE_NAMESPACE = "ops:technician-visit";
const LEGACY_SUBMISSION_STORAGE_NAMESPACE = "traceops:technician-visit";
const UNRESOLVED_OUTCOMES = new Set<WorkOrderVisitOutcome>([
  "diagnosis_only",
  "quote_required",
  "parts_required",
  "return_visit_required",
  "store_access_unavailable",
  "work_not_authorized",
  "not_addressed",
]);

const WORK_ORDER_OUTCOMES: Array<{ id: WorkOrderVisitOutcome; title: string; description: string }> = [
  { id: "completed", title: "Completed", description: "The authorized work is complete and ready for internal verification." },
  { id: "diagnosis_only", title: "Diagnosis only", description: "Diagnosis is complete; additional action is still required." },
  { id: "quote_required", title: "Quote required", description: "The next work requires a quote and operator decision." },
  { id: "parts_required", title: "Parts required", description: "Parts are needed before this work can be completed." },
  { id: "return_visit_required", title: "Return visit required", description: "A separate return visit must be scheduled." },
  { id: "no_issue_found", title: "No issue found", description: "The reported condition could not be observed during this visit." },
  { id: "store_access_unavailable", title: "Store access unavailable", description: "Required access or a safe work area was unavailable." },
  { id: "work_not_authorized", title: "Work not authorized", description: "The needed work was outside the current authorization." },
  { id: "not_addressed", title: "Not addressed", description: "This selected work order was not addressed during the visit." },
];

const UNMATCHED_OUTCOMES: Array<{ id: VisitOutcome; title: string }> = [
  { id: "resolved", title: "Service completed" },
  { id: "temporary_repair", title: "Temporary repair" },
  { id: "diagnosed_waiting_parts", title: "Diagnosed · waiting on parts" },
  { id: "return_required", title: "Return visit required" },
  { id: "unable_to_reproduce", title: "Could not reproduce" },
  { id: "unable_to_complete", title: "Unable to complete" },
  { id: "other", title: "Other" },
];

function emptyOutcome(): OutcomeDraft {
  return { outcome: "", outcomeNotes: "", accountableParty: "", nextAction: "", dueAt: "", escalationTo: "" };
}

function startedViaLabel(channel: string): string {
  return {
    qr: "store QR",
    secure_link: "secure service link",
    store_device: "store device",
    vendor_portal: "vendor portal",
    future_app: "vendor app",
  }[channel] ?? "another channel";
}

function wallClockNow(): number {
  return Date.now();
}

function checkoutHref(checkoutUrl: string, storeOptionsHref: string | undefined): string {
  return storeOptionsHref ? `${checkoutUrl}?returnTo=${encodeURIComponent(storeOptionsHref)}` : checkoutUrl;
}

export function TechnicianVisitFlow({
  token,
  portal,
  pendingVisit,
  storeOptionsHref,
}: {
  token: string;
  portal: StorePortalView;
  pendingVisit: PendingVisitCheckout | null;
  storeOptionsHref?: string;
}) {
  const initialMode: FlowMode = portal.capabilities.startVisit ? "check_in" : "check_out";
  const [mode, setMode] = useState<FlowMode>(initialMode);
  const [step, setStep] = useState(1);
  const [context, setContext] = useState<VendorVisitContextView | null>(null);
  const [contextNonce, setContextNonce] = useState(0);
  const [loadingContext, setLoadingContext] = useState(true);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<string[]>([]);
  const [selectedServiceRunId, setSelectedServiceRunId] = useState("");
  const [plannedWorkOrderRemovalReason, setPlannedWorkOrderRemovalReason] = useState("");
  const [unmatched, setUnmatched] = useState(false);
  const [unmatchedVendorId, setUnmatchedVendorId] = useState("");
  const [noWorkOrderReason, setNoWorkOrderReason] = useState("");
  const [activeVisitId, setActiveVisitId] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [crewCount, setCrewCount] = useState(1);
  const [arrivalNote, setArrivalNote] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, OutcomeDraft>>({});
  const [unmatchedOutcome, setUnmatchedOutcome] = useState<VisitOutcome | "">("");
  const [unmatchedOutcomeNotes, setUnmatchedOutcomeNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<LocationEvidenceInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<VisitReceipt | null>(null);
  const submissionKeys = useRef<Partial<Record<FlowMode, string>>>({});
  const totalSteps = mode === "check_in" ? 2 : 3;

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/ops-public/store/${encodeURIComponent(token)}/visit-context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).then(async (result) => {
      const body = (await result.json()) as VendorVisitContextView & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "The store's visit context could not be loaded.");
      if (!cancelled) {
        setContext(body);
        if (mode === "check_out" && body.activeVisits.length === 1) {
          const visit = body.activeVisits[0]!;
          setActiveVisitId(visit.id);
          setOutcomes(Object.fromEntries(visit.workOrders.map((workOrder) => [workOrder.id, emptyOutcome()])));
        }
      }
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "The store's visit context could not be loaded.");
    }).finally(() => {
      if (!cancelled) setLoadingContext(false);
    });
    return () => { cancelled = true; };
  }, [contextNonce, mode, token]);

  const eligibleById = useMemo(() => new Map((context?.eligibleWorkOrders ?? []).map((work) => [work.id, work])), [context]);
  const selectedWorkOrders = selectedWorkOrderIds.map((id) => eligibleById.get(id)).filter((work): work is NonNullable<typeof work> => Boolean(work));
  const inferredVendor = selectedWorkOrders[0]?.assignedVendor;
  const visibleEligibleWork = (context?.eligibleWorkOrders ?? []).filter((work) => !inferredVendor || work.assignedVendor.id === inferredVendor.id);
  const selectedVisit = context?.activeVisits.find((visit) => visit.id === activeVisitId);
  const selectedServiceRun = context?.plannedServiceRuns.find((run) => run.id === selectedServiceRunId);
  const removedPlannedWorkOrderIds = selectedServiceRun?.plannedWorkOrderIds.filter((id) => !selectedWorkOrderIds.includes(id)) ?? [];
  function reset(nextMode: FlowMode = initialMode) {
    clearSubmissionKey("check_in");
    clearSubmissionKey("check_out");
    submissionKeys.current = {};
    setMode(nextMode);
    setStep(1);
    setContext(null);
    setLoadingContext(true);
    setContextNonce((value) => value + 1);
    setSelectedWorkOrderIds([]);
    setSelectedServiceRunId("");
    setPlannedWorkOrderRemovalReason("");
    setUnmatched(false);
    setUnmatchedVendorId("");
    setNoWorkOrderReason("");
    setActiveVisitId("");
    setTechnicianName("");
    setCrewCount(1);
    setArrivalNote("");
    setOutcomes({});
    setUnmatchedOutcome("");
    setUnmatchedOutcomeNotes("");
    setFiles([]);
    setLocation(null);
    setError(null);
    setReceipt(null);
  }

  function submissionStorageKey(flowMode: FlowMode, namespace = SUBMISSION_STORAGE_NAMESPACE): string {
    return `${namespace}:${token}:${flowMode}`;
  }

  function clearSubmissionKey(flowMode: FlowMode) {
    delete submissionKeys.current[flowMode];
    try {
      window.sessionStorage.removeItem(submissionStorageKey(flowMode));
      window.sessionStorage.removeItem(submissionStorageKey(flowMode, LEGACY_SUBMISSION_STORAGE_NAMESPACE));
    } catch {
      // Retry safety still works for the mounted form when storage is blocked.
    }
  }

  function submissionKey(flowMode: FlowMode): string {
    const existing = submissionKeys.current[flowMode];
    if (existing) return existing;
    try {
      for (const namespace of [SUBMISSION_STORAGE_NAMESPACE, LEGACY_SUBMISSION_STORAGE_NAMESPACE]) {
        const persisted = JSON.parse(window.sessionStorage.getItem(submissionStorageKey(flowMode, namespace)) ?? "null") as { key?: unknown; createdAt?: unknown } | null;
        if (typeof persisted?.key === "string" && /^[A-Za-z0-9._:-]{16,120}$/.test(persisted.key) && typeof persisted.createdAt === "number" && wallClockNow() - persisted.createdAt < SUBMISSION_KEY_MAX_AGE_MS) {
          submissionKeys.current[flowMode] = persisted.key;
          if (namespace === LEGACY_SUBMISSION_STORAGE_NAMESPACE) {
            window.sessionStorage.setItem(submissionStorageKey(flowMode), JSON.stringify(persisted));
            window.sessionStorage.removeItem(submissionStorageKey(flowMode, namespace));
          }
          return persisted.key;
        }
      }
    } catch {
      // Generate a mounted-form key when session storage is unavailable.
    }
    const created = crypto.randomUUID();
    submissionKeys.current[flowMode] = created;
    try {
      window.sessionStorage.setItem(submissionStorageKey(flowMode), JSON.stringify({ key: created, createdAt: wallClockNow() }));
    } catch {
      // The in-memory key remains stable for retries in this mounted form.
    }
    return created;
  }

  function toggleWorkOrder(workOrderId: string) {
    setUnmatched(false);
    setUnmatchedVendorId("");
    const work = eligibleById.get(workOrderId);
    setSelectedWorkOrderIds((current) => {
      if (current.includes(workOrderId)) return current.filter((id) => id !== workOrderId);
      if (work?.plannedServiceRun) {
        const run = context?.plannedServiceRuns.find((candidate) => candidate.id === work.plannedServiceRun!.id);
        if (run) {
          setSelectedServiceRunId(run.id);
          setPlannedWorkOrderRemovalReason("");
          return [...new Set([...current, ...run.plannedWorkOrderIds])];
        }
      }
      return [...current, workOrderId];
    });
  }

  function chooseUnmatched() {
    setUnmatched((current) => !current);
    setSelectedWorkOrderIds([]);
    setSelectedServiceRunId("");
    setPlannedWorkOrderRemovalReason("");
  }

  function chooseActiveVisit(visit: ActiveVisitView) {
    setActiveVisitId(visit.id);
    setOutcomes(Object.fromEntries(visit.workOrders.map((workOrder) => [workOrder.id, emptyOutcome()])));
  }

  function updateOutcome(workOrderId: string, change: Partial<OutcomeDraft>) {
    setOutcomes((current) => ({ ...current, [workOrderId]: { ...(current[workOrderId] ?? emptyOutcome()), ...change } }));
  }

  function checkoutDetailsComplete(): boolean {
    if (!selectedVisit) return false;
    if (!selectedVisit.workOrders.length) return Boolean(unmatchedOutcome);
    return selectedVisit.workOrders.every((workOrder) => {
      const draft = outcomes[workOrder.id];
      if (!draft?.outcome) return false;
      return !UNRESOLVED_OUTCOMES.has(draft.outcome) || Boolean(draft.accountableParty.trim() && draft.nextAction.trim() && draft.dueAt && draft.escalationTo.trim());
    });
  }

  async function submitCheckIn() {
    if ((!location && portal.locationPolicy.enabled) || !context) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await fetch(`/api/ops-public/store/${encodeURIComponent(token)}/check-in`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": submissionKey("check_in") },
        body: JSON.stringify({
          workOrderIds: unmatched ? undefined : selectedWorkOrderIds,
          serviceRunId: unmatched ? undefined : selectedServiceRunId || undefined,
          plannedWorkOrderRemovalReason: removedPlannedWorkOrderIds.length ? plannedWorkOrderRemovalReason : undefined,
          vendorId: unmatched ? unmatchedVendorId : undefined,
          noWorkOrderReason: unmatched ? noWorkOrderReason : undefined,
          technicianName,
          crewCount,
          arrivalNote: arrivalNote || undefined,
          location: location ?? { captureResult: "not_requested" },
        }),
      });
      const body = (await result.json()) as TechnicianCheckInReceipt & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "Check-in could not be completed.");
      clearSubmissionKey("check_in");
      setReceipt(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Check-in could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCheckOut() {
    if ((!location && portal.locationPolicy.enabled) || !selectedVisit || !checkoutDetailsComplete()) return;
    setSubmitting(true);
    setError(null);
    try {
      const perWorkOrderOutcomes: PerWorkOrderVisitOutcome[] | undefined = selectedVisit.workOrders.length
        ? selectedVisit.workOrders.map((workOrder) => {
            const draft = outcomes[workOrder.id]!;
            const unresolved = UNRESOLVED_OUTCOMES.has(draft.outcome as WorkOrderVisitOutcome);
            return {
              workOrderId: workOrder.id,
              outcome: draft.outcome as WorkOrderVisitOutcome,
              outcomeNotes: draft.outcomeNotes || undefined,
              followUp: unresolved ? {
                accountableParty: draft.accountableParty,
                nextAction: draft.nextAction,
                dueAt: new Date(draft.dueAt).toISOString(),
                escalationTo: draft.escalationTo,
              } : undefined,
            };
          })
        : undefined;
      const command = {
        visitId: selectedVisit.id,
        perWorkOrderOutcomes,
        outcome: selectedVisit.workOrders.length ? undefined : unmatchedOutcome,
        outcomeNotes: selectedVisit.workOrders.length ? undefined : unmatchedOutcomeNotes,
        location: location ?? { captureResult: "not_requested" },
      };
      const formData = new FormData();
      formData.set("command", JSON.stringify(command));
      files.forEach((file) => formData.append("evidence", file));
      const result = await fetch(`/api/ops-public/store/${encodeURIComponent(token)}/check-out`, {
        method: "POST",
        headers: { "idempotency-key": submissionKey("check_out") },
        body: formData,
      });
      const body = (await result.json()) as TechnicianCheckOutReceipt & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "Checkout could not be completed.");
      clearSubmissionKey("check_out");
      setReceipt(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    const checkedIn = "checkedInAt" in receipt;
    return (
      <PublicFrame backHref={storeOptionsHref} organizationName={portal.organizationName} context={`Store ${portal.store.number} · Technician visit`} mode={portal.mode}>
        <div className={styles.hero}><div><span className={styles.eyebrow}>Server-confirmed receipt</span><h1 className={styles.title}>{checkedIn ? "Visit started" : "Visit completed"}</h1></div></div>
        <ServerReceipt receipt={receipt} />
        {checkedIn ? (
          <section className={styles.checkoutNextStep}>
            <div><span className={styles.eyebrow}>Keep this page available</span><h2>When the work is done, finish this visit</h2><p>This secure checkout is now tied only to {receipt.technicianName}&apos;s visit. It will also reappear if this store QR is reopened on this device.</p></div>
            <Link className={styles.button} href={checkoutHref(receipt.checkoutUrl, storeOptionsHref)}>Check out this visit <ArrowRight aria-hidden="true" size={17} /></Link>
          </section>
        ) : null}
      </PublicFrame>
    );
  }

  const selectionReady = mode === "check_in" ? (selectedWorkOrderIds.length > 0 && (!removedPlannedWorkOrderIds.length || Boolean(plannedWorkOrderRemovalReason.trim()))) || (unmatched && Boolean(unmatchedVendorId && noWorkOrderReason.trim())) : Boolean(selectedVisit);
  const personnelReady = Boolean(technicianName.trim());

  return (
    <PublicFrame backHref={storeOptionsHref} organizationName={portal.organizationName} context={`Store ${portal.store.number} · Technician visit`} mode={portal.mode}>
      <div className={styles.hero}>
        <div><span className={styles.eyebrow}>Store {portal.store.number}</span><h1 className={styles.title}>Vendor visit</h1><p className={styles.lede}><MapPin aria-hidden="true" size={18} /> {portal.store.address}</p></div>
      </div>

      {pendingVisit && portal.capabilities.startVisit && !portal.capabilities.finishVisit ? <PendingVisitCard pendingVisit={pendingVisit} /> : null}

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="visit-flow-title">
          {portal.capabilities.startVisit && portal.capabilities.finishVisit ? <div className={styles.tabs} aria-label="Visit action"><button className={`${styles.tab} ${mode === "check_in" ? styles.tabActive : ""}`} onClick={() => reset("check_in")} type="button">Start a visit</button><button className={`${styles.tab} ${mode === "check_out" ? styles.tabActive : ""}`} onClick={() => reset("check_out")} type="button">Finish a visit</button></div> : null}
          <div style={{ marginTop: "1.3rem" }}><span className={styles.eyebrow}>Step {step} of {totalSteps}</span><h2 className={styles.sectionTitle} id="visit-flow-title">{step === 1 ? (mode === "check_in" ? "Choose the work" : "Choose the active visit") : step === 2 ? (mode === "check_in" ? "Check in the crew" : "Record every work-order outcome") : "Confirm checkout"}</h2></div>

          {step === 1 && loadingContext ? <p className={styles.notice} style={{ marginTop: "1rem" }}>Loading the store&apos;s authorized work…</p> : null}
          {step === 1 && error ? <div className={styles.form} style={{ marginTop: "1rem" }}><p className={styles.error} role="alert">{error}</p><button className={styles.secondaryButton} onClick={() => { setLoadingContext(true); setError(null); setContextNonce((value) => value + 1); }} type="button">Try again</button></div> : null}

          {step === 1 && context && mode === "check_in" ? (
            <fieldset className={styles.fieldset} style={{ marginTop: "1.1rem" }}>
              <legend className={styles.legend}>Select the operator work first</legend>
              <p className={styles.helper}>The first work order determines the assigned vendor. You can then add other work at this store assigned to that same vendor.</p>
              <div className={styles.stack}>
                {visibleEligibleWork.map((work) => {
                  const selected = selectedWorkOrderIds.includes(work.id);
                  return <label className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ""}`} key={work.id}><input checked={selected} className={styles.choiceInput} onChange={() => toggleWorkOrder(work.id)} type="checkbox" value={work.id} /><span className={styles.choiceTitle}>{work.number} · {work.priority}</span><span className={styles.choiceDescription}>{work.problem}</span><span className={styles.choiceDescription}>{[work.area, work.category, work.asset].filter(Boolean).join(" · ") || "Classification pending"}</span><span className={styles.choiceDescription}>{work.dueOrScheduledAt ? `${work.dueOrScheduledLabel}: ${formatPublicDateTime(work.dueOrScheduledAt)}` : "No due or scheduled date"} · Assigned Vendor: {work.assignedVendor.name}</span>{work.plannedServiceRun ? <span className={styles.choiceDescription}><strong>Planned Service Run · Stop {work.plannedServiceRun.stopSequence} · {formatPublicDateTime(work.plannedServiceRun.startsAt)}</strong></span> : null}</label>;
                })}
                {!visibleEligibleWork.length ? <p className={styles.notice}>No eligible outside-vendor work orders are available at this store.</p> : null}
                {!context.workOrderSelectionBound ? <label className={`${styles.choiceCard} ${unmatched ? styles.choiceCardSelected : ""}`}><input checked={unmatched} className={styles.choiceInput} onChange={chooseUnmatched} type="checkbox" /><span className={styles.choiceTitle}>No work order provided</span><span className={styles.choiceDescription}>Choose this if dispatch did not provide a work-order number or the expected work is not listed. A reason for the visit is required.</span></label> : null}
              </div>
              {inferredVendor ? <div className={styles.callout}><strong>Assigned Vendor (inferred)</strong><p>{inferredVendor.name}. The vendor cannot be changed for matched work.</p></div> : null}
              {selectedServiceRun ? <div className={styles.callout}><strong>Accepted Service Run · Stop {selectedServiceRun.stopSequence}</strong><p>All {selectedServiceRun.plannedWorkOrderIds.length} planned Work Orders at this Store were offered automatically. Other eligible {inferredVendor?.name} work remains available.</p>{removedPlannedWorkOrderIds.length ? <label className={styles.label} style={{ marginTop: ".8rem" }}>Why is planned work being removed? <span className={styles.required} aria-hidden="true">*</span><textarea className={styles.textarea} maxLength={1000} onChange={(event) => setPlannedWorkOrderRemovalReason(event.target.value)} value={plannedWorkOrderRemovalReason} /></label> : null}</div> : null}
              {unmatched ? <div className={styles.form}><label className={styles.label}>Approved vendor <span className={styles.required} aria-hidden="true">*</span><select className={styles.select} onChange={(event) => setUnmatchedVendorId(event.target.value)} value={unmatchedVendorId}><option value="">Choose the arriving vendor</option>{portal.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label className={styles.label}>Reason for visit <span className={styles.required} aria-hidden="true">*</span><textarea className={styles.textarea} maxLength={500} onChange={(event) => setNoWorkOrderReason(event.target.value)} placeholder="Example: Emergency call from the store manager; no operator work-order number was provided." value={noWorkOrderReason} /></label></div> : null}
              <div className={styles.actions}><button className={styles.button} disabled={!selectionReady} onClick={() => setStep(2)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button></div>
            </fieldset>
          ) : null}

          {step === 1 && context && mode === "check_out" ? (
            <fieldset className={styles.fieldset} style={{ marginTop: "1.1rem" }}>
              <legend className={styles.legend}>Who is finishing their visit?</legend>
              {context.activeVisits.length ? <div className={styles.stack}>{context.activeVisits.map((visit) => <label className={`${styles.choiceCard} ${activeVisitId === visit.id ? styles.choiceCardSelected : ""}`} key={visit.id}><input checked={activeVisitId === visit.id} className={styles.choiceInput} name="active-visit" onChange={() => chooseActiveVisit(visit)} type="radio" value={visit.id} /><span className={styles.choiceTitle}>{visit.technicianName} · {visit.vendorName}</span><span className={styles.choiceDescription}>{visit.workOrders.length ? visit.workOrders.map((workOrder) => workOrder.number).join(" · ") : "No work order provided"}</span><span className={styles.choiceDescription}>Crew of {visit.crewCount} · Started {formatPublicDateTime(visit.checkedInAt)} via {startedViaLabel(visit.startedVia)}. {visit.checkInLocationLabel}.</span></label>)}</div> : <p className={styles.notice}>No active outside-vendor visit is available from this link or trusted store device.</p>}
              {selectedVisit ? <div className={styles.callout}><strong>{selectedVisit.vendorName} · {selectedVisit.technicianName}</strong><p>{selectedVisit.workOrders.length ? selectedVisit.workOrders.map((workOrder) => `${workOrder.number}: ${workOrder.problem}`).join(" · ") : `Reason for visit: ${selectedVisit.noWorkOrderReason}`}</p></div> : null}
              <div className={styles.actions}><button className={styles.button} disabled={!selectionReady} onClick={() => { if (selectedVisit) chooseActiveVisit(selectedVisit); setStep(2); }} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button></div>
            </fieldset>
          ) : null}

          {step === 2 && mode === "check_in" ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <div className={styles.twoColumns}><label className={styles.label}>Technician checking in <span className={styles.required} aria-hidden="true">*</span><input autoComplete="name" className={styles.input} maxLength={100} onChange={(event) => setTechnicianName(event.target.value)} value={technicianName} /></label><label className={styles.label}>Number of technicians onsite <span className={styles.required} aria-hidden="true">*</span><input className={styles.input} max={100} min={1} onChange={(event) => setCrewCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} type="number" value={crewCount} /></label></div>
              {!unmatched ? <label className={styles.label}>Visit note <span className={styles.helper}>(optional)</span><textarea className={styles.textarea} maxLength={1000} onChange={(event) => setArrivalNote(event.target.value)} placeholder="Add access details or anything the operator should know before work begins." value={arrivalNote} /></label> : <div className={styles.callout}><strong>Reason for visit</strong><p>{noWorkOrderReason}</p></div>}
              {portal.trustedStoreDevice ? <p className={styles.notice}><strong>Trusted store computer</strong><br />The server records the time when you confirm. No location permission is needed.</p> : portal.locationPolicy.enabled ? <LocationEvidenceControl actionLabel="check-in" onChange={(nextLocation) => { clearSubmissionKey("check_in"); setLocation(nextLocation); }} value={location} /> : <p className={styles.notice}>This operator does not require location evidence for this visit.</p>}
              {portal.locationPolicy.enabled && !portal.trustedStoreDevice ? <p className={styles.helper}>If location is declined or unavailable, you may continue. The receipt preserves that exact result and never presents it as verified.</p> : null}
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.actions}><button className={styles.secondaryButton} disabled={submitting} onClick={() => { clearSubmissionKey("check_in"); setStep(1); }} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button><button className={styles.button} disabled={!personnelReady || (portal.locationPolicy.enabled && !location) || submitting} onClick={submitCheckIn} type="button">{submitting ? "Checking in…" : "Check in"}</button></div>
            </div>
          ) : null}

          {step === 2 && mode === "check_out" && selectedVisit ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              {selectedVisit.workOrders.length ? selectedVisit.workOrders.map((workOrder) => {
                const draft = outcomes[workOrder.id] ?? emptyOutcome();
                const unresolved = Boolean(draft.outcome && UNRESOLVED_OUTCOMES.has(draft.outcome));
                return <section className={styles.card} key={workOrder.id} aria-labelledby={`outcome-${workOrder.id}`}><h3 className={styles.cardTitle} id={`outcome-${workOrder.id}`}>{workOrder.number}</h3><p className={styles.helper}>{workOrder.problem}</p><label className={styles.label} style={{ marginTop: "0.9rem" }}>Outcome <span className={styles.required} aria-hidden="true">*</span><select className={styles.select} onChange={(event) => updateOutcome(workOrder.id, { outcome: event.target.value as WorkOrderVisitOutcome })} value={draft.outcome}><option value="">Choose an outcome</option>{WORK_ORDER_OUTCOMES.map((option) => <option key={option.id} value={option.id}>{option.title} — {option.description}</option>)}</select></label><label className={styles.label}>Notes for {workOrder.number} <span className={styles.helper}>(separate from other work)</span><textarea className={styles.textarea} maxLength={2000} onChange={(event) => updateOutcome(workOrder.id, { outcomeNotes: event.target.value })} placeholder="Diagnosis, work completed, readings, parts, or access conditions." value={draft.outcomeNotes} /></label>{unresolved ? <div className={styles.form}><p className={styles.notice}><strong>Accountable follow-up required</strong><br />This unresolved outcome cannot be submitted without a separate owner, action, due time, and escalation destination.</p><div className={styles.twoColumns}><label className={styles.label}>Accountable party <span className={styles.required} aria-hidden="true">*</span><input className={styles.input} maxLength={160} onChange={(event) => updateOutcome(workOrder.id, { accountableParty: event.target.value })} value={draft.accountableParty} /></label><label className={styles.label}>Due date and time <span className={styles.required} aria-hidden="true">*</span><input className={styles.input} onChange={(event) => updateOutcome(workOrder.id, { dueAt: event.target.value })} type="datetime-local" value={draft.dueAt} /></label></div><label className={styles.label}>Next action <span className={styles.required} aria-hidden="true">*</span><textarea className={styles.textarea} maxLength={1000} onChange={(event) => updateOutcome(workOrder.id, { nextAction: event.target.value })} value={draft.nextAction} /></label><label className={styles.label}>Escalate to <span className={styles.required} aria-hidden="true">*</span><input className={styles.input} maxLength={160} onChange={(event) => updateOutcome(workOrder.id, { escalationTo: event.target.value })} value={draft.escalationTo} /></label></div> : null}</section>;
              }) : <fieldset className={styles.fieldset}><legend className={styles.legend}>Visit outcome</legend><div className={styles.choiceGrid}>{UNMATCHED_OUTCOMES.map((option) => <label className={`${styles.choiceCard} ${unmatchedOutcome === option.id ? styles.choiceCardSelected : ""}`} key={option.id}><input checked={unmatchedOutcome === option.id} className={styles.choiceInput} name="unmatched-outcome" onChange={() => setUnmatchedOutcome(option.id)} type="radio" /><span className={styles.choiceTitle}>{option.title}</span></label>)}</div><label className={styles.label}>Visit notes <span className={styles.helper}>(optional)</span><textarea className={styles.textarea} maxLength={2000} onChange={(event) => setUnmatchedOutcomeNotes(event.target.value)} value={unmatchedOutcomeNotes} /></label></fieldset>}
              <label className={styles.label}><Camera aria-hidden="true" size={18} /> Shared photos or service files <span className={styles.helper}>(optional, up to 4)</span><input accept="image/*,application/pdf" className={styles.fileInput} multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} type="file" /></label>
              {files.length ? <ul className={styles.fileList}>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</li>)}</ul> : null}
              <div className={styles.actions}><button className={styles.secondaryButton} onClick={() => setStep(1)} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button><button className={styles.button} disabled={!checkoutDetailsComplete()} onClick={() => setStep(3)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button></div>
            </div>
          ) : null}

          {step === 3 && mode === "check_out" ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <div className={styles.callout}><strong>{selectedVisit?.technicianName} · {selectedVisit?.vendorName}</strong><p>{selectedVisit?.workOrders.length ? selectedVisit.workOrders.map((workOrder) => `${workOrder.number}: ${WORK_ORDER_OUTCOMES.find((option) => option.id === outcomes[workOrder.id]?.outcome)?.title}`).join(" · ") : UNMATCHED_OUTCOMES.find((option) => option.id === unmatchedOutcome)?.title}</p></div>
              {portal.trustedStoreDevice ? <p className={styles.notice}><strong>Trusted store computer</strong><br />The server records the time when you confirm. No location permission is needed.</p> : portal.locationPolicy.enabled ? <LocationEvidenceControl actionLabel="checkout" onChange={(nextLocation) => { clearSubmissionKey("check_out"); setLocation(nextLocation); }} value={location} /> : <p className={styles.notice}>This operator does not require location evidence for this visit.</p>}
              {portal.locationPolicy.enabled && !portal.trustedStoreDevice ? <p className={styles.helper}>If location is declined or unavailable, you may continue. The receipt preserves that exact result and never presents it as verified.</p> : null}
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.actions}><button className={styles.secondaryButton} disabled={submitting} onClick={() => { clearSubmissionKey("check_out"); setStep(2); }} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button><button className={styles.button} disabled={(portal.locationPolicy.enabled && !location) || submitting} onClick={submitCheckOut} type="button">{submitting ? "Sending…" : "Confirm all outcomes and checkout"}</button></div>
            </div>
          ) : null}
        </section>

        <aside className={styles.stack} aria-label="Visit information">
          <section className={styles.card}><Clock3 aria-hidden="true" color="#0d6b62" size={23} /><h2 className={styles.cardTitle} style={{ marginTop: "0.6rem" }}>What this records</h2><ul className={styles.list} style={{ marginTop: "0.85rem" }}><li className={styles.listItem}><strong>One presence boundary</strong><p>One check-in and checkout can cover several work orders assigned to the same Vendor.</p></li><li className={styles.listItem}><strong>One outcome per work order</strong><p>Checkout is atomic: every selected work order must have an outcome before anything is recorded.</p></li><li className={styles.listItem}><strong>Accountable unresolved work</strong><p>Every unresolved outcome needs its own owner, next action, due time, and escalation destination.</p></li></ul></section>
          <section className={styles.notice}><strong>Presence evidence, not a timesheet</strong><p className={styles.helper}>The observed onsite window is approximate. It does not certify billable labor or automatically approve an invoice.</p></section>
        </aside>
      </div>
    </PublicFrame>
  );
}
