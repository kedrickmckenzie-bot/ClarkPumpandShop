"use client";

import Link from "next/link";
import { oneLine } from "@/lib/product/one-line";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, MapPin } from "lucide-react";
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
import { formatPublicDate, formatPublicDateTime, PublicFrame, ServerReceipt } from "./public-ui";
import { PendingVisitCard } from "./store-portal-home";
import styles from "./public-workflows.module.css";

type FlowMode = "check_in" | "check_out";
type SubmissionAction = FlowMode | "add_work";
type VisitReceipt = TechnicianCheckInReceipt | TechnicianCheckOutReceipt;
type OutcomeDraft = {
  partsEta?: string;
  outcome: WorkOrderVisitOutcome | "";
  outcomeNotes: string;
  vendorFollowUpTiming: PerWorkOrderVisitOutcome["vendorFollowUpTiming"] | "";
};

const SUBMISSION_KEY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SUBMISSION_STORAGE_NAMESPACE = "ops:technician-visit";
const LEGACY_SUBMISSION_STORAGE_NAMESPACE = "traceops:technician-visit";
const WORK_ORDER_OUTCOMES: Array<{ id: WorkOrderVisitOutcome; title: string; description: string }> = [
  { id: "completed", title: "Work completed", description: "The requested work is finished." },
  { id: "parts_required", title: "Waiting on parts", description: "Parts are needed before the work can be finished." },
  { id: "return_visit_required", title: "Return visit needed", description: "Another visit must be scheduled." },
  { id: "quote_required", title: "Quote or approval needed", description: "The operator must review pricing or authorize more work." },
  { id: "no_issue_found", title: "Could not find the issue", description: "The reported condition was not present during this visit." },
  { id: "not_addressed", title: "Could not complete the work", description: "Access, time, safety, or another condition prevented completion." },
];

const HELD_COMPLETE_OUTCOMES: typeof WORK_ORDER_OUTCOMES = [
  { id: "completed", title: "Completed", description: "This approved item is finished." },
  { id: "temporary_repair", title: "Temporary repair — follow-up needed", description: "The immediate issue is stabilized, but permanent work is still needed." },
  { id: "diagnosis_only", title: "Inspected — follow-up needed", description: "You inspected the item and recorded what the operator should do next." },
  { id: "not_addressed", title: "Not attempted", description: "Return this item to the approved held-work list." },
];

const HELD_INSPECT_OUTCOMES: typeof WORK_ORDER_OUTCOMES = [
  { id: "diagnosis_only", title: "Inspection recorded", description: "You inspected the item and recorded your findings." },
  { id: "no_issue_found", title: "No issue found", description: "The reported condition was not present during inspection." },
  { id: "not_addressed", title: "Not attempted", description: "Return this item to the approved held-work list." },
];

const UNMATCHED_OUTCOMES: Array<{ id: VisitOutcome; title: string; description: string }> = [
  { id: "resolved", title: "Work completed", description: "The reason for the visit was addressed." },
  { id: "diagnosed_waiting_parts", title: "Waiting on parts", description: "Parts are needed before the work can be finished." },
  { id: "return_required", title: "Return visit needed", description: "Another visit must be scheduled." },
  { id: "other", title: "Quote or approval needed", description: "The operator must review the next step." },
  { id: "unable_to_reproduce", title: "Could not find the issue", description: "The reported condition was not present during this visit." },
  { id: "unable_to_complete", title: "Could not complete the work", description: "Access, time, safety, or another condition prevented completion." },
];

function emptyOutcome(): OutcomeDraft {
  return { outcome: "", outcomeNotes: "", vendorFollowUpTiming: "" };
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
  const [step, setStep] = useState(initialMode === "check_in" ? 0 : 1);
  const [context, setContext] = useState<VendorVisitContextView | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [additionalWorkDone, setAdditionalWorkDone] = useState(false);
  const [contextNonce, setContextNonce] = useState(0);
  const [contextVendorId, setContextVendorId] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<string[]>([]);
  const [selectedHeldWorkOrderIds, setSelectedHeldWorkOrderIds] = useState<string[]>([]);
  const [selectedServiceRunId, setSelectedServiceRunId] = useState("");
  const [plannedWorkOrderRemovalReason, setPlannedWorkOrderRemovalReason] = useState("");
  const [unmatched, setUnmatched] = useState(false);
  const [unmatchedVendorId, setUnmatchedVendorId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
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
  const [addWorkNotice, setAddWorkNotice] = useState<string | null>(null);
  const submissionKeys = useRef<Partial<Record<SubmissionAction, string>>>({});
  const totalSteps = 3;

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/ops-public/store/${encodeURIComponent(token)}/visit-context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendorId: contextVendorId || undefined }),
    }).then(async (result) => {
      const body = (await result.json()) as VendorVisitContextView & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "The store's visit context could not be loaded.");
      if (!cancelled) {
        setContext(body);
        if (body.workOrderSelectionBound && mode === "check_in") setStep(current => current === 0 ? 1 : current);
        if(body.workOrderSelectionBound && body.activeVisits.length && mode === "check_in")setMode("check_out");
        if (mode === "check_out" && body.activeVisits.length === 1) {
          const visit = body.activeVisits[0]!;
          setActiveVisitId(visit.id);
          // A reload must never wipe an outcome the technician already chose.
          setOutcomes((current) => Object.fromEntries(visit.workOrders.map((workOrder) => [workOrder.id, current[workOrder.id] ?? emptyOutcome()])));
        }
      }
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "The store's visit context could not be loaded.");
    }).finally(() => {
      if (!cancelled) setLoadingContext(false);
    });
    return () => { cancelled = true; };
  }, [contextNonce, contextVendorId, mode, token]);

  const eligibleById = useMemo(() => new Map((context?.eligibleWorkOrders ?? []).map((work) => [work.id, work])), [context]);
  const selectedWorkOrders = selectedWorkOrderIds.map((id) => eligibleById.get(id)).filter((work): work is NonNullable<typeof work> => Boolean(work));
  const inferredVendor = selectedWorkOrders[0]?.assignedVendor;
  const visibleEligibleWork = (unmatchedVendorId === "unlisted" ? [] : context?.eligibleWorkOrders ?? []).filter((work) => work.assignedVendor.id === (contextVendorId || context?.vendorId || inferredVendor?.id));
  const selectedVisit = context?.activeVisits.find((visit) => visit.id === activeVisitId);
  const selectedServiceRun = context?.plannedServiceRuns.find((run) => run.id === selectedServiceRunId);
  const removedPlannedWorkOrderIds = selectedServiceRun?.plannedWorkOrderIds.filter((id) => !selectedWorkOrderIds.includes(id)) ?? [];
  function reset(nextMode: FlowMode = initialMode) {
    clearSubmissionKey("check_in");
    clearSubmissionKey("check_out");
    clearSubmissionKey("add_work");
    submissionKeys.current = {};
    setMode(nextMode);
    setStep(nextMode === "check_in" ? 0 : 1);
    setAdditionalWorkDone(false);
    setCompanySearch("");
    setContext(null);
    setLoadingContext(true);
    setContextNonce((value) => value + 1);
    setSelectedWorkOrderIds([]);
    setSelectedHeldWorkOrderIds([]);
    setContextVendorId("");
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
    setAddWorkNotice(null);
  }

  function submissionStorageKey(flowMode: SubmissionAction, namespace = SUBMISSION_STORAGE_NAMESPACE): string {
    return `${namespace}:${token}:${flowMode}`;
  }

  function clearSubmissionKey(flowMode: SubmissionAction) {
    delete submissionKeys.current[flowMode];
    try {
      window.sessionStorage.removeItem(submissionStorageKey(flowMode));
      window.sessionStorage.removeItem(submissionStorageKey(flowMode, LEGACY_SUBMISSION_STORAGE_NAMESPACE));
    } catch {
      // Retry safety still works for the mounted form when storage is blocked.
    }
  }

  function submissionKey(flowMode: SubmissionAction): string {
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

  function chooseCompany(vendorId: string) {
    const nextContextVendor = vendorId === "unlisted" ? "" : vendorId;
    clearSubmissionKey("check_in");
    setContextVendorId(nextContextVendor);
    setUnmatchedVendorId(vendorId);
    setUnmatched(vendorId === "unlisted");
    setSelectedWorkOrderIds([]);
    setSelectedHeldWorkOrderIds([]);
    setSelectedServiceRunId("");
    setPlannedWorkOrderRemovalReason("");
    setNoWorkOrderReason("");
    setLoadingContext(nextContextVendor !== contextVendorId);
    setError(null);
    setStep(1);
  }

  function toggleWorkOrder(workOrderId: string) {
    setUnmatched(false);
    setUnmatchedVendorId("");
    const work = eligibleById.get(workOrderId);
    if (work) {
      if (contextVendorId !== work.assignedVendor.id) {
        setLoadingContext(true);
        setError(null);
        setSelectedHeldWorkOrderIds([]);
      }
      setContextVendorId(work.assignedVendor.id);
    }
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
    setSelectedHeldWorkOrderIds([]);
    setUnmatchedVendorId(contextVendorId || unmatchedVendorId);
    setSelectedServiceRunId("");
    setPlannedWorkOrderRemovalReason("");
  }

  function toggleHeldWork(workOrderId: string) {
    clearSubmissionKey("add_work");
    setSelectedHeldWorkOrderIds((current) => current.includes(workOrderId)
      ? current.filter((id) => id !== workOrderId)
      : [...current, workOrderId]);
  }

  function chooseActiveVisit(visit: ActiveVisitView) {
    setActiveVisitId(visit.id);
    setContextVendorId(context?.vendorId || portal.vendors.find((vendor) => vendor.name === visit.vendorName)?.id || "");
    setSelectedHeldWorkOrderIds([]);
    setAddWorkNotice(null);
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
      if (workOrder.heldWorkPosture && ["temporary_repair", "diagnosis_only"].includes(draft.outcome) && !draft.outcomeNotes.trim()) return false;
      return true;
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
          heldWorkOrderIds: [],
          serviceRunId: unmatched ? undefined : selectedServiceRunId || undefined,
          plannedWorkOrderRemovalReason: removedPlannedWorkOrderIds.length ? plannedWorkOrderRemovalReason : undefined,
          vendorId: unmatched && unmatchedVendorId !== "unlisted" ? unmatchedVendorId : undefined,
          unlistedVendor: unmatched && unmatchedVendorId === "unlisted" ? { name: companyName, email: companyEmail, phone: companyPhone || undefined } : undefined,
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
    if (!selectedVisit || !checkoutDetailsComplete()) { setError("Choose an outcome for each job, then finish the visit."); setStep(2); return; }
    if (!location && portal.locationPolicy.enabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const perWorkOrderOutcomes: PerWorkOrderVisitOutcome[] | undefined = selectedVisit.workOrders.length
        ? selectedVisit.workOrders.map((workOrder) => {
            const draft = outcomes[workOrder.id]!;
            return {
              workOrderId: workOrder.id,
              outcome: draft.outcome as WorkOrderVisitOutcome,
              outcomeNotes: draft.outcomeNotes || undefined,
              partsEta: draft.outcome === "parts_required" ? draft.partsEta || undefined : undefined,
              vendorFollowUpTiming: draft.vendorFollowUpTiming || undefined,
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

  async function addSelectedWorkToVisit() {
    const arrivalReceipt = receipt && "checkedInAt" in receipt ? receipt : null;
    const visitId = arrivalReceipt?.visitId ?? selectedVisit?.id;
    if (!visitId || !selectedHeldWorkOrderIds.length) return;
    const actionToken = arrivalReceipt ? new URL(arrivalReceipt.checkoutUrl, window.location.origin).pathname.split("/")[3]! : token;
    setSubmitting(true);
    setError(null);
    setAddWorkNotice(null);
    try {
      const result = await fetch(`/api/ops-public/store/${encodeURIComponent(actionToken)}/active-visit-work`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": submissionKey("add_work") },
        body: JSON.stringify({ visitId, heldWorkOrderIds: selectedHeldWorkOrderIds }),
      });
      const body = (await result.json()) as VendorVisitContextView & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "The additional work could not be added to this visit.");
      clearSubmissionKey("add_work");
      setContext(body);
      setSelectedHeldWorkOrderIds([]);
      const refreshedVisit = body.activeVisits.find((visit) => visit.id === visitId);
      if (refreshedVisit && !arrivalReceipt) chooseActiveVisit(refreshedVisit);
      if (arrivalReceipt) {
        if (refreshedVisit) setReceipt({ ...arrivalReceipt, workOrders: refreshedVisit.workOrders });
        setAdditionalWorkDone(true);
      }
      setAddWorkNotice("The selected work is now part of this visit. Record one outcome for each item at checkout.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The additional work could not be added to this visit.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    const checkedIn = "checkedInAt" in receipt;
    const hasAdditionalWork = checkedIn && unmatchedVendorId !== "unlisted" && Boolean(context?.heldWork.length) && !additionalWorkDone;
    return (
      <PublicFrame backHref={storeOptionsHref} organizationName={portal.organizationName} context={`Store ${portal.store.number} · Technician visit`} mode={portal.mode}>
        <div className={styles.hero}><div><span className={styles.eyebrow}>Server-confirmed receipt</span><h1 className={styles.title}>{checkedIn ? "You’re checked in" : "Visit completed"}</h1></div></div>
        {hasAdditionalWork && checkedIn ? <p className={styles.lede}>{receipt.vendorName} · Arrived {formatPublicDateTime(receipt.checkedInAt, portal.store.timeZone)}</p> : <ServerReceipt receipt={receipt} headingOverride={checkedIn ? "Visit details" : undefined} timeZone={portal.store.timeZone} />}
        {hasAdditionalWork && context ? <section className={styles.card} aria-labelledby="additional-work-title">
          <h2 id="additional-work-title">Other approved work at this store</h2><p>Would you like to handle any of these during this visit?</p>
          <div className={styles.stack}>{context.heldWork.map(work => <section className={styles.callout} key={work.id}><h3 className={styles.choiceTitle}>{[work.number, work.asset || work.category].filter(Boolean).join(" · ")}</h3><p>{work.problem}</p><strong>{work.instruction}</strong>{work.disclosures.map(disclosure => <p className={styles.helper} key={disclosure}>{disclosure}</p>)}<label className={styles.jobSelection}><input aria-label={`Add work order ${work.number} to my visit`} type="checkbox" checked={selectedHeldWorkOrderIds.includes(work.id)} onChange={() => toggleHeldWork(work.id)} /><span>Add to my visit</span></label></section>)}</div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <div className={styles.actions}><button className={styles.button} type="button" disabled={submitting || !selectedHeldWorkOrderIds.length} onClick={addSelectedWorkToVisit}>{submitting ? "Adding…" : "Add selected work to my visit"}</button><button className={styles.secondaryButton} type="button" disabled={submitting} onClick={() => { setSelectedHeldWorkOrderIds([]); setAdditionalWorkDone(true); }}>Continue with my original job</button></div>
        </section> : null}
        {hasAdditionalWork ? <details className={styles.callout}><summary>Check-in receipt</summary><ServerReceipt receipt={receipt} headingOverride={checkedIn ? "Visit details" : undefined} timeZone={portal.store.timeZone} /></details> : null}
        {addWorkNotice ? <p className={styles.notice} role="status">{addWorkNotice}</p> : null}
        {checkedIn ? (
          <section className={styles.checkoutNextStep}>
            <div><span className={styles.eyebrow}>Keep this page available</span><h2>When the work is done, finish this visit</h2><p>This secure checkout is now tied only to {receipt.technicianName}&apos;s visit. It will also reappear if this store QR is reopened on this device.</p></div>
            <Link className={styles.button} href={checkoutHref(receipt.checkoutUrl, storeOptionsHref)}>Check out this visit <ArrowRight aria-hidden="true" size={17} /></Link>
          </section>
        ) : null}
      </PublicFrame>
    );
  }

  const selectionReady = mode === "check_in" ? (selectedWorkOrderIds.length > 0 && (!removedPlannedWorkOrderIds.length || Boolean(plannedWorkOrderRemovalReason.trim()))) || (unmatched && Boolean(unmatchedVendorId && noWorkOrderReason.trim() && (unmatchedVendorId !== "unlisted" || (companyName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail))))) : Boolean(selectedVisit);
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
          <div style={{ marginTop: "1.3rem" }}><span className={styles.eyebrow}>Step {mode === "check_in" ? step + 1 : step} of {totalSteps}</span><h2 className={styles.sectionTitle} id="visit-flow-title">{step === 0 ? "Who are you with?" : step === 1 ? (mode === "check_in" ? "Choose the work" : "Choose the active visit") : step === 2 ? (mode === "check_in" ? "Check in the crew" : "How did the visit end?") : "Confirm checkout"}</h2></div>

          {step <= 1 && loadingContext ? <p className={styles.notice} style={{ marginTop: "1rem" }}>Loading the store&apos;s authorized work…</p> : null}
          {step <= 1 && error ? <div className={styles.form} style={{ marginTop: "1rem" }}><p className={styles.error} role="alert">{error}</p><button className={styles.secondaryButton} onClick={() => { setLoadingContext(true); setError(null); setContextNonce((value) => value + 1); }} type="button">Try again</button></div> : null}

          {step === 0 && context && !loadingContext && mode === "check_in" ? <div className={styles.form}>
            <label className={styles.label}>Search your company<input className={styles.input} type="search" value={companySearch} onChange={event => setCompanySearch(event.target.value)} placeholder="Company name" /></label>
            <div className={styles.stack}>{portal.vendors.filter(vendor => vendor.name.toLowerCase().includes(companySearch.toLowerCase())).map(vendor => <button className={styles.secondaryButton} key={vendor.id} type="button" onClick={() => chooseCompany(vendor.id)}>{vendor.name}<ArrowRight size={17} aria-hidden="true" /></button>)}</div>
            {portal.vendors.filter(vendor => vendor.name.toLowerCase().includes(companySearch.toLowerCase())).length === 0 ? <p className={styles.notice}>No matching company.</p> : null}
            <button className={styles.secondaryButton} type="button" onClick={() => chooseCompany("unlisted")}>My company isn’t listed</button>
          </div> : null}

          {step === 1 && context && !loadingContext && mode === "check_in" ? (
            <fieldset className={styles.fieldset} style={{ marginTop: "1.1rem" }}>
              <legend className={styles.legend}>Choose the job you came to complete</legend>
              <p className={styles.helper}>Tick each job you are here for.</p>{!context.workOrderSelectionBound ? <button className={styles.secondaryButton} type="button" onClick={() => { setStep(0); setSelectedWorkOrderIds([]); }}>Change company</button> : null}
              <div className={styles.stack}>
                {visibleEligibleWork.map((work) => {
                  const selected = selectedWorkOrderIds.includes(work.id);
                  const where = [work.asset, work.area].filter(Boolean).join(" · ") || work.category;
                  // A job someone is already checked in on cannot start a second visit; say who and how to finish.
                  if (work.activeVisit) return <div className={styles.choiceCard} key={work.id} aria-disabled="true"><span className={styles.choiceTitle}>{oneLine(work.problem)}</span><span className={styles.choiceDescription}>{work.number}{where ? ` · ${where}` : ""}</span><span className={styles.choiceDescription}><strong>Already checked in</strong> by {work.activeVisit.technicianName} at {formatPublicDateTime(work.activeVisit.checkedInAt, portal.store.timeZone)}. To finish, use the checkout link from check-in, the vendor work-order link, or the store&apos;s trusted computer.</span></div>;
                  // One tap selects the job; the problem and timing are visible without opening anything.
                  return <label className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ""}`} key={work.id}><input aria-label={`I'm here for work order ${work.number}`} className={styles.choiceInput} checked={selected} onChange={() => toggleWorkOrder(work.id)} type="checkbox" value={work.id} /><span className={styles.choiceTitle}>{oneLine(work.problem)}</span><span className={styles.choiceDescription}>{work.number}{where ? ` · ${where}` : ""} · {work.dueOrScheduledAt ? `${work.dueOrScheduledLabel}: ${formatPublicDateTime(work.dueOrScheduledAt, portal.store.timeZone)}` : "No scheduled date"}</span></label>;
                })}
                {!visibleEligibleWork.length ? <p className={styles.notice}>No assigned work is listed for your company at this store.</p> : null}
                {!context.workOrderSelectionBound ? <label className={`${styles.choiceCard} ${unmatched ? styles.choiceCardSelected : ""}`}><input checked={unmatched} className={styles.choiceInput} onChange={chooseUnmatched} type="checkbox" /><span className={styles.choiceTitle}>I don’t see my work order</span><span className={styles.choiceDescription}>Choose this if dispatch did not provide a work-order number or the expected work is not listed. A reason for the visit is required.</span></label> : null}
              </div>

              {selectedServiceRun ? <div className={styles.callout}><strong>Accepted planned visit · Stop {selectedServiceRun.stopSequence}</strong><p>All {selectedServiceRun.plannedWorkOrderIds.length} work orders planned for this store were added automatically. Other eligible {inferredVendor?.name} work remains available.</p>{removedPlannedWorkOrderIds.length ? <label className={styles.label} style={{ marginTop: ".8rem" }}>Why is planned work being removed? <span className={styles.required} aria-hidden="true">*</span><textarea className={styles.textarea} maxLength={1000} onChange={(event) => setPlannedWorkOrderRemovalReason(event.target.value)} value={plannedWorkOrderRemovalReason} /></label> : null}</div> : null}
              {unmatched ? <div className={styles.form}><strong>{portal.vendors.find(vendor => vendor.id === unmatchedVendorId)?.name ?? "New company"}</strong>{unmatchedVendorId === "unlisted" ? <><p className={styles.notice}>Your company and visit will be reviewed. This does not approve or authorize work.</p><label className={styles.label}>Company name<input className={styles.input} maxLength={160} value={companyName} onChange={e=>setCompanyName(e.target.value)} /></label><label className={styles.label}>Contact email<input className={styles.input} type="email" maxLength={254} value={companyEmail} onChange={e=>setCompanyEmail(e.target.value)} /></label><label className={styles.label}>Contact phone (optional)<input className={styles.input} type="tel" maxLength={60} value={companyPhone} onChange={e=>setCompanyPhone(e.target.value)} /></label></> : null}<label className={styles.label}>Reason for visit <span className={styles.required} aria-hidden="true">*</span><textarea className={styles.textarea} maxLength={500} onChange={(event) => setNoWorkOrderReason(event.target.value)} placeholder="Example: Emergency call from the store manager; no operator work-order number was provided." value={noWorkOrderReason} /></label></div> : null}
              <div className={styles.actions}><button className={styles.button} disabled={!selectionReady} onClick={() => setStep(2)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button></div>
            </fieldset>
          ) : null}

          {step === 1 && context && mode === "check_out" ? (
            <fieldset className={styles.fieldset} style={{ marginTop: "1.1rem" }}>
              <legend className={styles.legend}>Who is finishing their visit?</legend>
              {context.activeVisits.length ? <div className={styles.stack}>{context.activeVisits.map((visit) => <label className={`${styles.choiceCard} ${activeVisitId === visit.id ? styles.choiceCardSelected : ""}`} key={visit.id}><input checked={activeVisitId === visit.id} className={styles.choiceInput} name="active-visit" onChange={() => chooseActiveVisit(visit)} type="radio" value={visit.id} /><span className={styles.choiceTitle}>{visit.technicianName} · {visit.vendorName}</span><span className={styles.choiceDescription}>{visit.workOrders.length ? visit.workOrders.map((workOrder) => workOrder.number).join(" · ") : "No work order provided"}</span><span className={styles.choiceDescription}>Crew of {visit.crewCount} · Started {formatPublicDateTime(visit.checkedInAt, portal.store.timeZone)} via {startedViaLabel(visit.startedVia)}. {visit.checkInLocationLabel}.</span></label>)}</div> : <p className={styles.notice}>No active outside-vendor visit is available from this link or trusted store device.</p>}
              {selectedVisit ? <div className={styles.callout}><strong>{selectedVisit.vendorName} · {selectedVisit.technicianName}</strong><p>{selectedVisit.workOrders.length ? selectedVisit.workOrders.map((workOrder) => `${workOrder.number}: ${workOrder.problem}`).join(" · ") : `Reason for visit: ${selectedVisit.noWorkOrderReason}`}</p></div> : null}
              {selectedVisit && context.heldWork.length ? <details className={styles.callout}><summary className={styles.choiceTitle}>Add more work (optional)</summary><p>You can add work now without ending or restarting the visit. Select only what your company can handle today.</p><div className={styles.stack} style={{ marginTop: ".8rem" }}>{context.heldWork.map((work) => { const selected = selectedHeldWorkOrderIds.includes(work.id); return <label className={`${styles.choiceCard} ${selected ? styles.choiceCardSelected : ""}`} key={work.id}><input aria-label={`Add work order ${work.number} to my visit`} checked={selected} className={styles.choiceInput} onChange={() => toggleHeldWork(work.id)} type="checkbox" /><span className={styles.choiceTitle}>{[work.number, work.category].filter(Boolean).join(" · ")}</span><span className={styles.choiceDescription}>{work.problem}</span><span className={styles.choiceDescription}><strong>{work.instruction}</strong> · Review by {formatPublicDate(work.deadlineAt, portal.store.timeZone)}</span>{work.disclosures.map((disclosure) => <span className={styles.choiceDescription} key={disclosure}>{disclosure}</span>)}</label>; })}</div><div className={styles.actions}><button className={styles.secondaryButton} disabled={!selectedHeldWorkOrderIds.length || submitting} onClick={addSelectedWorkToVisit} type="button">{submitting ? "Adding…" : `Add ${selectedHeldWorkOrderIds.length || "selected"} to this visit`}</button></div></details> : null}
              {addWorkNotice ? <p className={styles.notice} role="status">{addWorkNotice}</p> : null}
              <div className={styles.actions}><button className={styles.button} disabled={!selectionReady} onClick={() => { if (selectedVisit) chooseActiveVisit(selectedVisit); setStep(2); }} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button></div>
            </fieldset>
          ) : null}

          {step === 2 && mode === "check_in" ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              {selectedWorkOrders.length ? <div className={styles.callout}><strong>{inferredVendor?.name}</strong><ul>{selectedWorkOrders.map(work => <li key={work.id}>{[work.number, work.asset || work.category].filter(Boolean).join(" · ")}</li>)}</ul></div> : null}
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
                const outcomeOptions = workOrder.heldWorkPosture === "look_and_report"
                    ? HELD_INSPECT_OUTCOMES
                    : workOrder.heldWorkPosture === "complete_using_professional_judgment"
                      ? HELD_COMPLETE_OUTCOMES
                      : WORK_ORDER_OUTCOMES;
                const notesRequired = Boolean(workOrder.heldWorkPosture) && ["temporary_repair", "diagnosis_only"].includes(draft.outcome);
                const heldSourceLabel = workOrder.selectionSource === "service_run" ? "Planned as part of this store visit" : "Added while onsite";
                return <section className={styles.card} key={workOrder.id} aria-labelledby={`outcome-${workOrder.id}`}><h3 className={styles.cardTitle} id={`outcome-${workOrder.id}`}>{workOrder.number}</h3><p className={styles.helper}>{workOrder.problem}</p>{workOrder.heldWorkPosture ? <p className={styles.notice}><strong>{heldSourceLabel}</strong><br />{workOrder.heldWorkPosture === "look_and_report" ? "The operator asked for an inspection and findings—not automatic completion." : "The operator approved completion using your professional judgment."}</p> : null}<label className={styles.label} style={{ marginTop: "0.9rem" }}>Outcome <span className={styles.required} aria-hidden="true">*</span><select className={styles.select} onChange={(event) => updateOutcome(workOrder.id, { outcome: event.target.value as WorkOrderVisitOutcome, vendorFollowUpTiming: "" })} value={draft.outcome}><option value="">Choose an outcome</option>{outcomeOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label><p className={styles.helper}>{outcomeOptions.find((option) => option.id === draft.outcome)?.description ?? "Choose the closest result. The platform creates any required follow-up for the operator."}</p>{draft.outcome === "parts_required" ? <label className={styles.label}>Expected parts arrival (optional)<input className={styles.input} maxLength={120} placeholder="For example: Oct 2 or about 3 days" value={draft.partsEta ?? ""} onChange={e=>updateOutcome(workOrder.id,{partsEta:e.target.value})}/></label> : null}<label className={styles.label}>Visit notes {notesRequired ? <span className={styles.required} aria-hidden="true">*</span> : <span className={styles.helper}>(optional)</span>}<textarea className={styles.textarea} maxLength={2000} onChange={(event) => updateOutcome(workOrder.id, { outcomeNotes: event.target.value })} placeholder={notesRequired ? "Briefly explain the temporary repair or inspection findings." : "Diagnosis, work completed, readings, parts, or access conditions."} value={draft.outcomeNotes} /></label>{draft.outcome === "temporary_repair" ? <label className={styles.label}>When should this be checked again? <span className={styles.helper}>(optional)</span><select className={styles.select} onChange={(event) => updateOutcome(workOrder.id, { vendorFollowUpTiming: event.target.value as OutcomeDraft["vendorFollowUpTiming"] })} value={draft.vendorFollowUpTiming}><option value="">No estimate</option><option value="within_7_days">Within 7 days</option><option value="within_30_days">Within 30 days</option><option value="within_90_days">Within 90 days</option><option value="next_pm">At the next PM visit</option><option value="unknown">Unknown</option></select><span className={styles.helper}>This is guidance for the operator, not a guarantee or a deadline change.</span></label> : null}</section>;
              }) : <fieldset className={styles.fieldset}><legend className={styles.legend}>Visit outcome</legend><div className={styles.choiceGrid}>{UNMATCHED_OUTCOMES.map((option) => <label className={`${styles.choiceCard} ${unmatchedOutcome === option.id ? styles.choiceCardSelected : ""}`} key={option.id}><input checked={unmatchedOutcome === option.id} className={styles.choiceInput} name="unmatched-outcome" onChange={() => setUnmatchedOutcome(option.id)} type="radio" /><span className={styles.choiceTitle}>{option.title}</span><span className={styles.helper}>{option.description}</span></label>)}</div><label className={styles.label}>Visit notes <span className={styles.helper}>(optional)</span><textarea className={styles.textarea} maxLength={2000} onChange={(event) => setUnmatchedOutcomeNotes(event.target.value)} value={unmatchedOutcomeNotes} /></label></fieldset>}
              <label className={styles.label}><Camera aria-hidden="true" size={18} /> Shared photos or service files <span className={styles.helper}>(optional, up to 4)</span>{Object.values(outcomes).some((draft) => draft.outcome === "temporary_repair") ? <span className={styles.notice}>A photo is strongly recommended for a temporary repair so the operator can plan the permanent work.</span> : null}<input accept="image/*,application/pdf" className={styles.fileInput} multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} type="file" /></label>
              {files.length ? <ul className={styles.fileList}>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</li>)}</ul> : null}
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.actions}><button className={styles.secondaryButton} onClick={() => setStep(1)} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button><button className={styles.button} disabled={!checkoutDetailsComplete()} onClick={() => { setError(null); setStep(3); }} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button></div>
            </div>
          ) : null}

          {step === 3 && mode === "check_out" ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <div className={styles.callout}><strong>{selectedVisit?.technicianName} · {selectedVisit?.vendorName}</strong><p>{selectedVisit?.workOrders.length ? selectedVisit.workOrders.map((workOrder) => `${workOrder.number}: ${(workOrder.heldWorkPosture === "look_and_report" ? HELD_INSPECT_OUTCOMES : workOrder.heldWorkPosture ? HELD_COMPLETE_OUTCOMES : WORK_ORDER_OUTCOMES).find((option) => option.id === outcomes[workOrder.id]?.outcome)?.title ?? "Choose an outcome"}`).join(" · ") : UNMATCHED_OUTCOMES.find((option) => option.id === unmatchedOutcome)?.title}</p></div>
              {portal.trustedStoreDevice ? <p className={styles.notice}><strong>Trusted store computer</strong><br />The server records the time when you confirm. No location permission is needed.</p> : portal.locationPolicy.enabled ? <LocationEvidenceControl actionLabel="checkout" onChange={(nextLocation) => { clearSubmissionKey("check_out"); setLocation(nextLocation); }} value={location} /> : <p className={styles.notice}>This operator does not require location evidence for this visit.</p>}
              {portal.locationPolicy.enabled && !portal.trustedStoreDevice ? <p className={styles.helper}>If location is declined or unavailable, you may continue. The receipt preserves that exact result and never presents it as verified.</p> : null}
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.actions}><button className={styles.secondaryButton} disabled={submitting} onClick={() => { clearSubmissionKey("check_out"); setStep(2); }} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button><button className={styles.button} disabled={(portal.locationPolicy.enabled && !location) || submitting} onClick={submitCheckOut} type="button">{submitting ? "Sending…" : "Finish visit"}</button></div>
            </div>
          ) : null}
        </section>

        <aside className={styles.stack} aria-label="Visit information">

          <section className={styles.notice}><strong>Recorded arrival and departure</strong><p className={styles.helper}>Visit time is approximate. Labor charges and invoices are reviewed separately.</p></section>
        </aside>
      </div>
    </PublicFrame>
  );
}
