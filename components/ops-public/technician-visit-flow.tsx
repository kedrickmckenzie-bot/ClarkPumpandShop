"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Clock3, MapPin } from "lucide-react";
import type {
  LocationEvidenceInput,
  StorePortalView,
  TechnicianCheckInReceipt,
  TechnicianCheckOutReceipt,
  VendorVisitContextView,
  VisitOutcome,
} from "./contracts";
import { LocationEvidenceControl } from "./location-evidence-control";
import { formatPublicDateTime, PublicFrame, ServerReceipt } from "./public-ui";
import styles from "./public-workflows.module.css";

type FlowMode = "check_in" | "check_out";
type VisitReceipt = TechnicianCheckInReceipt | TechnicianCheckOutReceipt;

const NO_WORK_ORDER = "__no_work_order__";
const SUBMISSION_KEY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const OUTCOMES: Array<{ id: VisitOutcome; title: string; description: string }> = [
  { id: "resolved", title: "Resolved", description: "The reported problem is operating normally now." },
  { id: "temporary_repair", title: "Temporary repair", description: "Service was restored, but permanent work is still needed." },
  { id: "diagnosed_waiting_parts", title: "Waiting on parts", description: "Diagnosis is complete and parts are required." },
  { id: "return_required", title: "Return visit needed", description: "More work or another technician visit is required." },
  { id: "unable_to_reproduce", title: "Could not reproduce", description: "The reported condition did not occur during this visit." },
  { id: "unable_to_complete", title: "Unable to complete", description: "The visit could not be completed today." },
  { id: "other", title: "Other", description: "Record another clear outcome in the notes." },
];

function startedViaLabel(channel: string): string {
  return {
    qr: "store QR",
    secure_link: "secure service link",
    store_device: "store device",
    vendor_portal: "vendor portal",
    future_app: "vendor app",
  }[channel] ?? "another channel";
}

export function TechnicianVisitFlow({ token, portal }: { token: string; portal: StorePortalView }) {
  const initialMode: FlowMode = portal.capabilities.startVisit ? "check_in" : "check_out";
  const [mode, setMode] = useState<FlowMode>(initialMode);
  const [step, setStep] = useState(1);
  const [vendorId, setVendorId] = useState("");
  const [context, setContext] = useState<VendorVisitContextView | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [workSelection, setWorkSelection] = useState("");
  const [noWorkOrderReason, setNoWorkOrderReason] = useState("");
  const [activeVisitId, setActiveVisitId] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [outcome, setOutcome] = useState<VisitOutcome | "">("");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<LocationEvidenceInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<VisitReceipt | null>(null);
  const submissionKeys = useRef<Partial<Record<FlowMode, string>>>({});

  const selectedVendor = useMemo(() => portal.vendors.find((vendor) => vendor.id === vendorId), [portal.vendors, vendorId]);
  const totalSteps = 4;

  function reset(nextMode: FlowMode = initialMode) {
    clearSubmissionKey("check_in");
    clearSubmissionKey("check_out");
    submissionKeys.current = {};
    setMode(nextMode);
    setStep(1);
    setVendorId("");
    setContext(null);
    setWorkSelection("");
    setNoWorkOrderReason("");
    setActiveVisitId("");
    setTechnicianName("");
    setOutcome("");
    setOutcomeNotes("");
    setFiles([]);
    setLocation(null);
    setError(null);
    setReceipt(null);
  }

  function submissionStorageKey(flowMode: FlowMode): string {
    return `traceops:technician-visit:${token}:${flowMode}`;
  }

  function clearSubmissionKey(flowMode: FlowMode) {
    delete submissionKeys.current[flowMode];
    try {
      window.sessionStorage.removeItem(submissionStorageKey(flowMode));
    } catch {
      // Retry safety still works for the mounted form when storage is blocked.
    }
  }

  function submissionKey(flowMode: FlowMode): string {
    const existing = submissionKeys.current[flowMode];
    if (existing) return existing;
    try {
      const persisted = JSON.parse(window.sessionStorage.getItem(submissionStorageKey(flowMode)) ?? "null") as {
        key?: unknown;
        createdAt?: unknown;
      } | null;
      if (
        typeof persisted?.key === "string"
        && /^[A-Za-z0-9._:-]{16,120}$/.test(persisted.key)
        && typeof persisted.createdAt === "number"
        && Date.now() - persisted.createdAt < SUBMISSION_KEY_MAX_AGE_MS
      ) {
        submissionKeys.current[flowMode] = persisted.key;
        return persisted.key;
      }
    } catch {
      // Generate a mounted-form key when session storage is unavailable.
    }
    const created = crypto.randomUUID();
    submissionKeys.current[flowMode] = created;
    try {
      window.sessionStorage.setItem(submissionStorageKey(flowMode), JSON.stringify({ key: created, createdAt: Date.now() }));
    } catch {
      // The in-memory key remains stable for retries in this mounted form.
    }
    return created;
  }

  function editSubmission() {
    clearSubmissionKey(mode);
    setStep(3);
  }

  async function loadVendorContext() {
    if (!vendorId) return;
    setLoadingContext(true);
    setError(null);
    try {
      const result = await fetch(`/api/ops-public/store/${encodeURIComponent(token)}/visit-context`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendorId }),
      });
      const body = (await result.json()) as VendorVisitContextView & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "The store's work list could not be loaded.");
      setContext(body);
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The store's work list could not be loaded.");
    } finally {
      setLoadingContext(false);
    }
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
          vendorId,
          workOrderId: workSelection !== NO_WORK_ORDER ? workSelection : undefined,
          noWorkOrderReason: workSelection === NO_WORK_ORDER ? noWorkOrderReason : undefined,
          technicianName,
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
    if ((!location && portal.locationPolicy.enabled) || !context || !outcome) return;
    setSubmitting(true);
    setError(null);
    try {
      const command = { vendorId, visitId: activeVisitId, outcome, outcomeNotes, location: location ?? { captureResult: "not_requested" } };
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
      <PublicFrame organizationName={portal.organizationName} context={`Store ${portal.store.number} · Technician visit`} mode={portal.mode}>
        <div className={styles.hero}>
          <div><span className={styles.eyebrow}>Server-confirmed receipt</span><h1 className={styles.title}>{checkedIn ? "Visit started" : "Visit completed"}</h1></div>
        </div>
        <ServerReceipt receipt={receipt} />
        {checkedIn ? (
          <div className={styles.actions} style={{ marginTop: "1rem" }}>
            <Link className={styles.button} href={receipt.checkoutUrl}>Open secure checkout <ArrowRight aria-hidden="true" size={17} /></Link>
          </div>
        ) : null}
      </PublicFrame>
    );
  }

  return (
    <PublicFrame organizationName={portal.organizationName} context={`Store ${portal.store.number} · Technician visit`} mode={portal.mode}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Store {portal.store.number}</span>
          <h1 className={styles.title}>Vendor visit</h1>
          <p className={styles.lede}><MapPin aria-hidden="true" size={18} /> {portal.store.address}</p>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="visit-flow-title">
          {portal.capabilities.startVisit && portal.capabilities.finishVisit ? (
            <div className={styles.tabs} aria-label="Visit action">
              <button className={`${styles.tab} ${mode === "check_in" ? styles.tabActive : ""}`} onClick={() => reset("check_in")} type="button">Start a visit</button>
              <button className={`${styles.tab} ${mode === "check_out" ? styles.tabActive : ""}`} onClick={() => reset("check_out")} type="button">Finish a visit</button>
            </div>
          ) : null}

          <div style={{ marginTop: "1.3rem" }}>
            <span className={styles.eyebrow}>Step {step} of {totalSteps}</span>
            <h2 className={styles.sectionTitle} id="visit-flow-title">
              {step === 1 ? "Choose your company" : step === 2 ? (mode === "check_in" ? "Choose the work" : "Choose the active visit") : step === 3 ? (mode === "check_in" ? "Identify the technician" : "Record the outcome") : `Confirm ${mode === "check_in" ? "check-in" : "checkout"}`}
            </h2>
          </div>

          {step === 1 ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <label className={styles.label}>Vendor company <span className={styles.required} aria-hidden="true">*</span>
                <select className={styles.select} onChange={(event) => { setVendorId(event.target.value); setContext(null); }} value={vendorId}>
                  <option value="">Choose your company</option>
                  {portal.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                </select>
              </label>
              <p className={styles.helper}>{selectedVendor ? selectedVendor.specialties : "Only work assigned to the company you choose will be shown."}</p>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <button className={styles.button} disabled={!vendorId || loadingContext} onClick={loadVendorContext} type="button">
                {loadingContext ? "Loading work…" : "Continue"} <ArrowRight aria-hidden="true" size={17} />
              </button>
            </div>
          ) : null}

          {step === 2 && context && mode === "check_in" ? (
            <fieldset className={styles.fieldset} style={{ marginTop: "1.1rem" }}>
              <legend className={styles.legend}>What are you here to work on?</legend>
              <div className={styles.stack}>
                {context.eligibleWorkOrders.map((work) => (
                  <label className={`${styles.choiceCard} ${workSelection === work.id ? styles.choiceCardSelected : ""}`} key={work.id}>
                    <input checked={workSelection === work.id} className={styles.choiceInput} name="work" onChange={() => setWorkSelection(work.id)} type="radio" value={work.id} />
                    <span className={styles.choiceTitle}>{work.number} · {work.priority}</span>
                    <span className={styles.choiceDescription}>{work.problem}{work.asset ? ` · ${work.asset}` : ""}</span>
                  </label>
                ))}
                <label className={`${styles.choiceCard} ${workSelection === NO_WORK_ORDER ? styles.choiceCardSelected : ""}`}>
                  <input checked={workSelection === NO_WORK_ORDER} className={styles.choiceInput} name="work" onChange={() => setWorkSelection(NO_WORK_ORDER)} type="radio" value={NO_WORK_ORDER} />
                  <span className={styles.choiceTitle}>No work order provided / I don&apos;t see my work order</span>
                  <span className={styles.choiceDescription}>Service is not blocked. The visit will be marked for operator review.</span>
                </label>
              </div>
              {workSelection === NO_WORK_ORDER ? (
                <label className={styles.label}>Why are you here? <span className={styles.required} aria-hidden="true">*</span>
                  <textarea className={styles.textarea} maxLength={500} onChange={(event) => setNoWorkOrderReason(event.target.value)} placeholder="Example: Emergency call from store manager for active water leak" value={noWorkOrderReason} />
                </label>
              ) : null}
              <div className={styles.actions}>
                <button className={styles.secondaryButton} onClick={() => setStep(1)} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button>
                <button className={styles.button} disabled={!workSelection || (workSelection === NO_WORK_ORDER && !noWorkOrderReason.trim())} onClick={() => setStep(3)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button>
              </div>
            </fieldset>
          ) : null}

          {step === 2 && context && mode === "check_out" ? (
            <fieldset className={styles.fieldset} style={{ marginTop: "1.1rem" }}>
              <legend className={styles.legend}>Who is finishing their visit?</legend>
              {context.activeVisits.length ? (
                <div className={styles.stack}>
                  {context.activeVisits.map((visit) => (
                    <label className={`${styles.choiceCard} ${activeVisitId === visit.id ? styles.choiceCardSelected : ""}`} key={visit.id}>
                      <input checked={activeVisitId === visit.id} className={styles.choiceInput} name="active-visit" onChange={() => setActiveVisitId(visit.id)} type="radio" value={visit.id} />
                      <span className={styles.choiceTitle}>{visit.technicianName} · {visit.workOrderNumber ?? "No work order"}</span>
                      <span className={styles.choiceDescription}>Started {formatPublicDateTime(visit.checkedInAt)} via {startedViaLabel(visit.startedVia)}. {visit.checkInLocationLabel}.</span>
                    </label>
                  ))}
                </div>
              ) : <p className={styles.notice}>No active visit was found for {context.vendorName}. Check that you selected the correct vendor, or start a visit first.</p>}
              <div className={styles.actions}>
                <button className={styles.secondaryButton} onClick={() => setStep(1)} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button>
                <button className={styles.button} disabled={!activeVisitId} onClick={() => setStep(3)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button>
              </div>
            </fieldset>
          ) : null}

          {step === 3 && mode === "check_in" ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <label className={styles.label}>Technician name <span className={styles.required} aria-hidden="true">*</span>
                <input autoComplete="name" className={styles.input} maxLength={100} onChange={(event) => setTechnicianName(event.target.value)} value={technicianName} />
              </label>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} onClick={() => setStep(2)} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button>
                <button className={styles.button} disabled={!technicianName.trim()} onClick={() => setStep(4)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button>
              </div>
            </div>
          ) : null}

          {step === 3 && mode === "check_out" ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>What was the result?</legend>
                <div className={styles.choiceGrid}>
                  {OUTCOMES.map((option) => (
                    <label className={`${styles.choiceCard} ${outcome === option.id ? styles.choiceCardSelected : ""}`} key={option.id}>
                      <input checked={outcome === option.id} className={styles.choiceInput} name="outcome" onChange={() => setOutcome(option.id)} type="radio" value={option.id} />
                      <span className={styles.choiceTitle}>{option.title}</span>
                      <span className={styles.choiceDescription}>{option.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={styles.label}>What did you find or do? {outcome === "resolved" ? <span className={styles.helper}>(optional)</span> : <span className={styles.required} aria-hidden="true">*</span>}
                <textarea className={styles.textarea} maxLength={2000} onChange={(event) => setOutcomeNotes(event.target.value)} placeholder="Add diagnosis, work completed, parts needed, or the next recommended action." value={outcomeNotes} />
              </label>
              <label className={styles.label}><Camera aria-hidden="true" size={18} /> Photos or service files <span className={styles.helper}>(optional, up to 4)</span>
                <input accept="image/*,application/pdf" className={styles.fileInput} multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} type="file" />
              </label>
              {files.length ? <ul className={styles.fileList}>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</li>)}</ul> : null}
              <div className={styles.actions}>
                <button className={styles.secondaryButton} onClick={() => setStep(2)} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button>
                <button className={styles.button} disabled={!outcome || (outcome !== "resolved" && !outcomeNotes.trim())} onClick={() => setStep(4)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <div className={styles.callout}>
                <strong>{mode === "check_in" ? `${technicianName} · ${selectedVendor?.name}` : `${context?.activeVisits.find((visit) => visit.id === activeVisitId)?.technicianName} · ${selectedVendor?.name}`}</strong>
                <p>{mode === "check_in" ? (workSelection === NO_WORK_ORDER ? `No work order · ${noWorkOrderReason}` : context?.eligibleWorkOrders.find((work) => work.id === workSelection)?.number) : OUTCOMES.find((option) => option.id === outcome)?.title}</p>
              </div>
              {portal.trustedStoreDevice ? (
                <p className={styles.notice}><strong>Trusted store computer</strong><br />The server records the time when you confirm. No location permission or PIN is needed.</p>
              ) : portal.locationPolicy.enabled ? (
                <LocationEvidenceControl actionLabel={mode === "check_in" ? "check-in" : "checkout"} onChange={(nextLocation) => { clearSubmissionKey(mode); setLocation(nextLocation); }} value={location} />
              ) : (
                <p className={styles.notice}>This operator does not require location evidence for this visit.</p>
              )}
              {portal.locationPolicy.enabled && !portal.trustedStoreDevice ? <p className={styles.helper}>If location is declined or unavailable, you may continue. The server receipt will preserve that exact result; it will never be shown as verified.</p> : null}
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.actions}>
                <button className={styles.secondaryButton} disabled={submitting} onClick={editSubmission} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button>
                <button className={styles.button} disabled={(portal.locationPolicy.enabled && !location) || submitting} onClick={mode === "check_in" ? submitCheckIn : submitCheckOut} type="button">
                  {submitting ? "Sending…" : mode === "check_in" ? "Confirm check-in" : "Confirm checkout"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className={styles.stack} aria-label="Visit information">
          <section className={styles.card}>
            <Clock3 aria-hidden="true" color="#0d6b62" size={23} />
            <h2 className={styles.cardTitle} style={{ marginTop: "0.6rem" }}>What this records</h2>
            <ul className={styles.list} style={{ marginTop: "0.85rem" }}>
              <li className={styles.listItem}><strong>Server time</strong><p>The system records when it receives check-in and checkout. Verified times are never backdated.</p></li>
              <li className={styles.listItem}><strong>Visit purpose</strong><p>Choose assigned work or explain why no work order is available.</p></li>
              <li className={styles.listItem}><strong>Outcome</strong><p>Unresolved results create a visible operator follow-up.</p></li>
            </ul>
          </section>
          <section className={styles.notice}>
            <strong>Presence evidence, not a timesheet</strong>
            <p className={styles.helper}>The observed onsite window is approximate. It does not certify billable labor or automatically approve an invoice.</p>
          </section>
        </aside>
      </div>
    </PublicFrame>
  );
}
