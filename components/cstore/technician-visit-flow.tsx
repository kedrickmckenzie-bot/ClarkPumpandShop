"use client";

import { type FormEvent, useId, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileUp,
  LogIn,
  LogOut,
  MapPin,
  MapPinned,
  ShieldAlert,
  UserRound,
} from "lucide-react";

import styles from "./cstore-workflows.module.css";
import type {
  ActiveVisit,
  StoreOption,
  VisitChannel,
  VisitCheckInValue,
  VisitCheckOutValue,
  VisitEvidence,
  VisitOutcome,
  VisitWorkOrderOption,
} from "./types";

export interface TechnicianVisitFlowProps {
  store: StoreOption;
  vendorName: string;
  workOrders: VisitWorkOrderOption[];
  channel: VisitChannel;
  evidence: VisitEvidence;
  onCheckIn?: (value: VisitCheckInValue) => ActiveVisit | void | Promise<ActiveVisit | void>;
  onCheckOut?: (value: VisitCheckOutValue) => void | Promise<void>;
  initialActiveVisit?: ActiveVisit;
  initialCompleted?: boolean;
  defaultTechnicianName?: string;
  requireVerifiedEvidence?: boolean;
  className?: string;
}

interface EvidencePresentation {
  label: string;
  description: string;
  tone: "verified" | "neutral" | "warning";
  icon: typeof MapPin;
}

const channelLabels: Record<VisitChannel, string> = {
  app: "Vendor app",
  qr: "Store QR link",
  store_kiosk: "Store self-service kiosk",
  secure_link: "Secure work-order link",
};

const outcomeOptions: Array<{ value: VisitOutcome; label: string }> = [
  { value: "resolved", label: "Resolved" },
  { value: "diagnosed_waiting_parts", label: "Diagnosed — waiting on parts" },
  { value: "return_visit_required", label: "Return visit required" },
  { value: "unresolved", label: "Unresolved" },
  { value: "preventive_service_complete", label: "Preventive service complete" },
];

function evidencePresentation(evidence: VisitEvidence): EvidencePresentation {
  switch (evidence.state) {
    case "location_verified": {
      const detail = [
        evidence.distanceMeters !== undefined
          ? `${Math.round(evidence.distanceMeters)} m from the store`
          : null,
        evidence.accuracyMeters !== undefined
          ? `±${Math.round(evidence.accuracyMeters)} m accuracy`
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        label: "Location verified at this event",
        description: detail || "The device was inside the operator’s configured store boundary.",
        tone: "verified",
        icon: MapPinned,
      };
    }
    case "store_kiosk_recorded":
      return {
        label: "Recorded on the store kiosk",
        description: "The technician used the trusted store device. No continuous location tracking was used.",
        tone: "verified",
        icon: Building2,
      };
    case "location_not_shared":
      return {
        label: "Location was not shared",
        description: evidence.note || "The visit can continue when operator policy permits, but the event remains unverified.",
        tone: "warning",
        icon: ShieldAlert,
      };
    case "outside_geofence":
      return {
        label: "Outside the store boundary",
        description: evidence.note || "The recorded event is retained as an exception and should not be silently treated as verified.",
        tone: "warning",
        icon: ShieldAlert,
      };
    case "manual_exception":
      return {
        label: "Manual exception",
        description: evidence.note || "This event was recorded without normal device or location evidence.",
        tone: "warning",
        icon: CircleAlert,
      };
    case "pending":
    default:
      return {
        label: "Evidence check pending",
        description: evidence.note || "The location or kiosk result has not returned yet.",
        tone: "neutral",
        icon: MapPin,
      };
  }
}

function formatRecordedTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function VisitEvidenceBadge({ evidence }: { evidence: VisitEvidence }) {
  const presentation = evidencePresentation(evidence);
  const Icon = presentation.icon;

  return (
    <div className={styles.evidenceCard} data-tone={presentation.tone}>
      <span className={styles.evidenceIcon}>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <strong>{presentation.label}</strong>
        <p>
          {presentation.description}
          {evidence.capturedAt ? ` · Captured ${formatRecordedTime(evidence.capturedAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

export function TechnicianVisitFlow({
  store,
  vendorName,
  workOrders,
  channel,
  evidence,
  onCheckIn,
  onCheckOut,
  initialActiveVisit,
  initialCompleted = false,
  defaultTechnicianName = "",
  requireVerifiedEvidence = false,
  className,
}: TechnicianVisitFlowProps) {
  const formId = useId();
  const storeWorkOrders = useMemo(
    () => workOrders.filter((workOrder) => workOrder.storeId === store.id),
    [store.id, workOrders],
  );
  const [technicianName, setTechnicianName] = useState(defaultTechnicianName);
  const [visitType, setVisitType] = useState<"work_order" | "no_work_order">(
    storeWorkOrders.length > 0 ? "work_order" : "no_work_order",
  );
  const [workOrderId, setWorkOrderId] = useState("");
  const [noWorkOrderReason, setNoWorkOrderReason] = useState("");
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | undefined>(initialActiveVisit);
  const [outcome, setOutcome] = useState<VisitOutcome>("resolved");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(initialCompleted);
  const [error, setError] = useState<string | null>(null);

  const selectedWorkOrder = storeWorkOrders.find(
    (workOrder) => workOrder.id === workOrderId,
  );
  const evidenceIsVerified =
    evidence.state === "location_verified" || evidence.state === "store_kiosk_recorded";

  async function handleCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!technicianName.trim()) {
      setError("Enter the technician’s name.");
      return;
    }
    if (visitType === "work_order" && !workOrderId) {
      setError("Choose the customer work order for this visit.");
      return;
    }
    if (visitType === "no_work_order" && noWorkOrderReason.trim().length < 5) {
      setError("Briefly explain why you are at this store.");
      return;
    }
    if (requireVerifiedEvidence && !evidenceIsVerified) {
      setError("This operator requires verified location or store-kiosk evidence to check in.");
      return;
    }

    const recordedAt = new Date().toISOString();
    const value: VisitCheckInValue = {
      storeId: store.id,
      technicianName: technicianName.trim(),
      vendorName,
      ...(visitType === "work_order" ? { workOrderId } : {}),
      ...(visitType === "no_work_order"
        ? { noWorkOrderReason: noWorkOrderReason.trim() }
        : {}),
      channel,
      evidence,
      recordedAt,
    };

    try {
      setSubmitting(true);
      const createdVisit = await onCheckIn?.(value);
      setActiveVisit(
        createdVisit ?? {
          id: `local-visit-${recordedAt}`,
          storeId: value.storeId,
          technicianName: value.technicianName,
          vendorName: value.vendorName,
          workOrderId: value.workOrderId,
          noWorkOrderReason: value.noWorkOrderReason,
          channel: value.channel,
          evidence: value.evidence,
          startedAt: recordedAt,
        },
      );
    } catch {
      setError("Check-in was not recorded. Please retry before starting work.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckOut(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeVisit) return;
    setError(null);

    const value: VisitCheckOutValue = {
      visitId: activeVisit.id,
      outcome,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      files,
      channel,
      evidence,
      recordedAt: new Date().toISOString(),
    };

    try {
      setSubmitting(true);
      await onCheckOut?.(value);
      setActiveVisit(undefined);
      setCompleted(true);
    } catch {
      setError("Checkout was not recorded. Your active visit remains open; please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForAnotherVisit() {
    setCompleted(false);
    setWorkOrderId("");
    setNoWorkOrderReason("");
    setOutcome("resolved");
    setNotes("");
    setFiles([]);
    setError(null);
  }

  return (
    <div className={[styles.root, styles.surface, className].filter(Boolean).join(" ")}>
      <header className={styles.visitHero}>
        <div className={styles.visitHeroTop}>
          <div>
            <span className={styles.eyebrow}>Vendor visit</span>
            <h2>{activeVisit ? "Finish this visit" : "Technician check-in"}</h2>
            <p>
              {vendorName} · {channelLabels[channel]}
            </p>
          </div>
          <div className={styles.storeBadge}>
            <Building2 aria-hidden="true" />
            <div>
              <strong>
                Store #{store.storeNumber} · {store.name}
              </strong>
              <span>{store.address}</span>
            </div>
          </div>
        </div>
        <VisitEvidenceBadge evidence={activeVisit?.evidence ?? evidence} />
      </header>

      {completed ? (
        <section className={styles.completedPanel} aria-live="polite">
          <span className={styles.completedIcon}>
            <CheckCircle2 aria-hidden="true" />
          </span>
          <h3>Checkout recorded</h3>
          <p>
            The visit outcome and evidence are now attached to the operator’s record. The
            recorded timestamp is preserved exactly as captured.
          </p>
          <button className={styles.secondaryButton} type="button" onClick={resetForAnotherVisit}>
            Start another visit
          </button>
        </section>
      ) : activeVisit ? (
        <form className={styles.visitForm} onSubmit={handleCheckOut} noValidate>
          <div className={styles.activeVisitStrip}>
            <div>
              <strong>{activeVisit.technicianName} is checked in</strong>
              <span>
                {activeVisit.workOrderId
                  ? storeWorkOrders.find((item) => item.id === activeVisit.workOrderId)?.number ??
                    "Customer work order"
                  : `No work order · ${activeVisit.noWorkOrderReason ?? "Reason recorded"}`}
              </span>
            </div>
            <span className={styles.activeClock}>
              <Clock3 aria-hidden="true" />
              Since {formatRecordedTime(activeVisit.startedAt)}
            </span>
          </div>

          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor={`${formId}-outcome`}>What is the outcome?</label>
              <select
                id={`${formId}-outcome`}
                className={styles.select}
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as VisitOutcome)}
              >
                {outcomeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHint}>
                Unresolved outcomes remain open with the appropriate next action.
              </span>
            </div>

            <div className={styles.field}>
              <label htmlFor={`${formId}-checkout-notes`}>Work summary (optional)</label>
              <textarea
                id={`${formId}-checkout-notes`}
                className={styles.textarea}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What was found, what was done, and what should happen next?"
              />
            </div>
          </div>

          <div className={`${styles.field} ${styles.documentBlock}`}>
            <label htmlFor={`${formId}-files`}>Photos or service documents (optional)</label>
            <input
              id={`${formId}-files`}
              className={styles.fileInput}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
            <span className={styles.fieldHint}>
              {files.length > 0
                ? `${files.length} ${files.length === 1 ? "file" : "files"} selected`
                : "Photos are useful evidence but remain optional unless the operator configures a requirement."}
            </span>
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              <CircleAlert aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <div className={styles.visitActions}>
            <button className={styles.primaryButton} type="submit" disabled={submitting}>
              <LogOut aria-hidden="true" />
              {submitting ? "Recording checkout…" : "Check out"}
            </button>
          </div>
        </form>
      ) : (
        <form className={styles.visitForm} onSubmit={handleCheckIn} noValidate>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label htmlFor={`${formId}-technician`}>Technician name</label>
              <input
                id={`${formId}-technician`}
                className={styles.input}
                type="text"
                value={technicianName}
                onChange={(event) => setTechnicianName(event.target.value)}
                placeholder="First and last name"
                autoComplete="name"
                required
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Vendor</span>
              <div className={styles.workOrderPreview}>
                <UserRound aria-hidden="true" />
                <div>
                  <strong>{vendorName}</strong>
                  <span>For privacy, only work orders assigned to this vendor appear here.</span>
                </div>
              </div>
            </div>
          </div>

          <fieldset className={`${styles.visitFieldset} ${styles.documentBlock}`}>
            <legend className={styles.fieldLabel}>What are you here to work on?</legend>
            <div className={styles.visitTypeGrid}>
              <div>
                <input
                  id={`${formId}-type-work-order`}
                  className={styles.choiceInput}
                  type="radio"
                  name={`${formId}-visit-type`}
                  checked={visitType === "work_order"}
                  onChange={() => setVisitType("work_order")}
                  disabled={storeWorkOrders.length === 0}
                />
                <label className={styles.visitTypeCard} htmlFor={`${formId}-type-work-order`}>
                  <ClipboardList aria-hidden="true" />
                  <span>
                    <strong>Customer work order</strong>
                    <span>Select the number provided by this operator.</span>
                  </span>
                </label>
              </div>
              <div>
                <input
                  id={`${formId}-type-no-work-order`}
                  className={styles.choiceInput}
                  type="radio"
                  name={`${formId}-visit-type`}
                  checked={visitType === "no_work_order"}
                  onChange={() => setVisitType("no_work_order")}
                />
                <label className={styles.visitTypeCard} htmlFor={`${formId}-type-no-work-order`}>
                  <CircleHelp aria-hidden="true" />
                  <span>
                    <strong>No work order</strong>
                    <span>Record an unplanned visit for later matching.</span>
                  </span>
                </label>
              </div>
            </div>
          </fieldset>

          {visitType === "work_order" ? (
            <div className={`${styles.field} ${styles.documentBlock}`}>
              <label htmlFor={`${formId}-work-order`}>Customer work order</label>
              <select
                id={`${formId}-work-order`}
                className={styles.select}
                value={workOrderId}
                onChange={(event) => setWorkOrderId(event.target.value)}
                required
              >
                <option value="">Choose a work order</option>
                {storeWorkOrders.map((workOrder) => (
                  <option key={workOrder.id} value={workOrder.id}>
                    {workOrder.number} · {workOrder.title}
                  </option>
                ))}
              </select>
              {selectedWorkOrder ? (
                <div className={styles.workOrderPreview}>
                  <ClipboardList aria-hidden="true" />
                  <div>
                    <strong>
                      {selectedWorkOrder.number} · {selectedWorkOrder.title}
                    </strong>
                    <span>
                      {selectedWorkOrder.assetLabel ?? "Store-level work"}
                      {selectedWorkOrder.requestedService
                        ? ` · ${selectedWorkOrder.requestedService}`
                        : ""}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={`${styles.field} ${styles.documentBlock}`}>
              <label htmlFor={`${formId}-reason`}>Why are you at this store?</label>
              <textarea
                id={`${formId}-reason`}
                className={styles.textarea}
                value={noWorkOrderReason}
                onChange={(event) => setNoWorkOrderReason(event.target.value)}
                placeholder="Example: Called by the store about a leaking sink; no customer work-order number was provided."
                minLength={5}
                required
              />
              <span className={styles.fieldHint}>
                This creates an unmatched visit for the operator to review. It does not invent a
                backdated authorization.
              </span>
            </div>
          )}

          {error ? (
            <div className={styles.error} role="alert">
              <CircleAlert aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <div className={styles.visitActions}>
            <button className={styles.primaryButton} type="submit" disabled={submitting}>
              <LogIn aria-hidden="true" />
              {submitting ? "Recording check-in…" : "Check in now"}
            </button>
          </div>

          <div className={styles.footerNote}>
            <FileUp aria-hidden="true" />
            <span>
              Location, when required, is captured only for this event. The recorded time is
              never silently backdated, and the visit is approximate presence evidence—not an
              automatic billable-hours decision.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
