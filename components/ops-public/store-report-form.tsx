"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, ShieldAlert } from "lucide-react";
import type { StoreIssueReceipt, StorePortalView } from "./contracts";
import { PublicFrame, ServerReceipt } from "./public-ui";
import styles from "./public-workflows.module.css";

type Urgency = "routine" | "priority" | "urgent_safety";
type StoreOperatingState = "open" | "partially_operational" | "unable_to_operate" | "unknown";
type SafetyConcern = "none_reported" | "potential" | "immediate" | "unknown";
type InventoryRisk = "none_reported" | "at_risk" | "loss_reported" | "unknown";
type YesNoUnknown = "yes" | "no" | "unknown";

const URGENCY_OPTIONS: Array<{ id: Urgency; title: string; description: string }> = [
  { id: "routine", title: "Routine", description: "The store can operate normally while this is reviewed." },
  { id: "priority", title: "Needs attention soon", description: "Product, service, or customer experience may be affected." },
  { id: "urgent_safety", title: "Safety or shutdown concern", description: "There may be immediate risk or a critical store system is down." },
];

const OPERATING_OPTIONS: Array<{ id: StoreOperatingState; label: string }> = [
  { id: "open", label: "Open and operating" },
  { id: "partially_operational", label: "Open, but partly affected" },
  { id: "unable_to_operate", label: "Unable to operate" },
  { id: "unknown", label: "Not sure" },
];

const SAFETY_OPTIONS: Array<{ id: SafetyConcern; label: string }> = [
  { id: "none_reported", label: "No safety concern noticed" },
  { id: "potential", label: "Possible safety concern" },
  { id: "immediate", label: "Immediate safety concern" },
  { id: "unknown", label: "Not sure" },
];

const INVENTORY_OPTIONS: Array<{ id: InventoryRisk; label: string }> = [
  { id: "none_reported", label: "No product or inventory at risk" },
  { id: "at_risk", label: "Product or inventory may be at risk" },
  { id: "loss_reported", label: "Product loss has been reported" },
  { id: "unknown", label: "Not sure" },
];

const CUSTOMER_OPTIONS: Array<{ id: YesNoUnknown; label: string }> = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "unknown", label: "Not sure" },
];

const STORE_REPORT_SUBMISSION_NAMESPACE = "ops-public-store-report-v1";
const SUBMISSION_KEY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,120}$/;

export function StoreReportForm({ token, portal }: { token: string; portal: StorePortalView }) {
  const storeOptionsHref = `/public/store/${encodeURIComponent(token)}`;
  const submissionKeyRef = useRef<string | null>(null);
  const [step, setStep] = useState(1);
  const [reporterName, setReporterName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [problem, setProblem] = useState("");
  const [area, setArea] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("routine");
  const [storeOperatingState, setStoreOperatingState] = useState<StoreOperatingState | "">("");
  const [safetyConcern, setSafetyConcern] = useState<SafetyConcern | "">("");
  const [productInventoryRisk, setProductInventoryRisk] = useState<InventoryRisk | "">("");
  const [customersAffected, setCustomersAffected] = useState<YesNoUnknown | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<StoreIssueReceipt | null>(null);

  function submissionStorageKey() {
    return `${STORE_REPORT_SUBMISSION_NAMESPACE}:${token}`;
  }

  function clearSubmissionKey() {
    submissionKeyRef.current = null;
    try {
      window.sessionStorage.removeItem(submissionStorageKey());
    } catch {
      // A successful response or deliberate edit still clears the mounted-form key.
    }
  }

  function submissionKey() {
    if (submissionKeyRef.current) return submissionKeyRef.current;
    try {
      const persisted = JSON.parse(window.sessionStorage.getItem(submissionStorageKey()) ?? "null") as { key?: unknown; createdAt?: unknown } | null;
      if (
        typeof persisted?.key === "string"
        && SUBMISSION_KEY_PATTERN.test(persisted.key)
        && typeof persisted.createdAt === "number"
        && Date.now() - persisted.createdAt < SUBMISSION_KEY_MAX_AGE_MS
      ) {
        submissionKeyRef.current = persisted.key;
        return persisted.key;
      }
    } catch {
      // Generate a mounted-form key when session storage is unavailable or corrupt.
    }
    const created = crypto.randomUUID();
    submissionKeyRef.current = created;
    try {
      window.sessionStorage.setItem(submissionStorageKey(), JSON.stringify({ key: created, createdAt: Date.now() }));
    } catch {
      // The in-memory key remains stable for immediate retries.
    }
    return created;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (!storeOperatingState || !safetyConcern || !productInventoryRisk || !customersAffected) {
        throw new Error("Complete each business-impact question before sending the report.");
      }
      const command = {
        reporterName,
        employeeId,
        problem,
        urgency,
        area,
        impact: { storeOperatingState, safetyConcern, productInventoryRisk, customersAffected },
      };
      const formData = new FormData();
      formData.set("command", JSON.stringify(command));
      files.forEach((file) => formData.append("evidence", file));
      const result = await fetch(`/api/ops-public/store/${encodeURIComponent(token)}/report`, {
        method: "POST",
        headers: { "idempotency-key": submissionKey() },
        body: formData,
      });
      const body = (await result.json()) as StoreIssueReceipt & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "The issue could not be reported. Try again.");
      clearSubmissionKey();
      setReceipt(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The issue could not be reported. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <PublicFrame backHref={storeOptionsHref} organizationName={portal.organizationName} context={`Store ${portal.store.number} · Report an issue`} mode={portal.mode}>
        <div className={styles.hero}><div><span className={styles.eyebrow}>Server-confirmed receipt</span><h1 className={styles.title}>Report received</h1></div></div>
        <ServerReceipt receipt={receipt} />
      </PublicFrame>
    );
  }

  return (
    <PublicFrame backHref={storeOptionsHref} organizationName={portal.organizationName} context={`Store ${portal.store.number} · Report an issue`} mode={portal.mode}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Store {portal.store.number}</span>
          <h1 className={styles.title}>Report a problem</h1>
          <p className={styles.lede}>Tell the store manager what needs attention. You only need to identify the store and describe the problem.</p>
        </div>
      </div>
      <div className={styles.layout}>
        <section className={styles.card} aria-labelledby="report-step-title">
          <span className={styles.eyebrow}>Step {step} of 3</span>
          <h2 className={styles.sectionTitle} id="report-step-title">{step === 1 ? "Who is reporting this?" : step === 2 ? "What is happening?" : "Review and send"}</h2>

          {step === 1 ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <label className={styles.label}>Your name <span className={styles.required} aria-hidden="true">*</span>
                <input autoComplete="name" className={styles.input} maxLength={100} onChange={(event) => setReporterName(event.target.value)} value={reporterName} />
              </label>
              <label className={styles.label}>Employee ID <span className={styles.helper}>(optional)</span>
                <input className={styles.input} maxLength={80} onChange={(event) => setEmployeeId(event.target.value)} value={employeeId} />
              </label>
              <button className={styles.button} disabled={!reporterName.trim()} onClick={() => setStep(2)} type="button">Continue <ArrowRight aria-hidden="true" size={17} /></button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <label className={styles.label}>What needs attention? <span className={styles.required} aria-hidden="true">*</span>
                <textarea className={styles.textarea} maxLength={2000} onChange={(event) => setProblem(event.target.value)} placeholder="Describe what you see, hear, smell, or cannot use. Include readings or error messages if available." value={problem} />
              </label>
              <label className={styles.label}>Area or equipment <span className={styles.helper}>(optional)</span>
                <input className={styles.input} maxLength={120} onChange={(event) => setArea(event.target.value)} placeholder="Example: Beer cave, pump 4, women's restroom" value={area} />
              </label>
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>What is the business impact right now?</legend>
                <p className={styles.helper}>Plain-language answers are enough. A manager will confirm or revise them before creating a work order.</p>
                <label className={styles.label}>Is the store still operating? <span className={styles.required} aria-hidden="true">*</span>
                  <select className={styles.select} onChange={(event) => setStoreOperatingState(event.target.value as StoreOperatingState | "")} value={storeOperatingState}>
                    <option value="">Choose an answer</option>
                    {OPERATING_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <label className={styles.label}>Is there a safety concern? <span className={styles.required} aria-hidden="true">*</span>
                  <select className={styles.select} onChange={(event) => setSafetyConcern(event.target.value as SafetyConcern | "")} value={safetyConcern}>
                    <option value="">Choose an answer</option>
                    {SAFETY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <label className={styles.label}>Is product or inventory at risk? <span className={styles.required} aria-hidden="true">*</span>
                  <select className={styles.select} onChange={(event) => setProductInventoryRisk(event.target.value as InventoryRisk | "")} value={productInventoryRisk}>
                    <option value="">Choose an answer</option>
                    {INVENTORY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <label className={styles.label}>Are customers affected? <span className={styles.required} aria-hidden="true">*</span>
                  <select className={styles.select} onChange={(event) => setCustomersAffected(event.target.value as YesNoUnknown | "")} value={customersAffected}>
                    <option value="">Choose an answer</option>
                    {CUSTOMER_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>How urgent is it?</legend>
                <div className={styles.choiceGrid}>
                  {URGENCY_OPTIONS.map((option) => (
                    <label className={`${styles.choiceCard} ${urgency === option.id ? styles.choiceCardSelected : ""}`} key={option.id}>
                      <input checked={urgency === option.id} className={styles.choiceInput} name="urgency" onChange={() => setUrgency(option.id)} type="radio" value={option.id} />
                      <span className={styles.choiceTitle}>{option.title}</span>
                      <span className={styles.choiceDescription}>{option.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {urgency === "urgent_safety" ? <p className={styles.error}><ShieldAlert aria-hidden="true" size={18} /> Follow store emergency procedures now. This form does not contact 911 or replace emergency services.</p> : null}
              <label className={styles.label}><Camera aria-hidden="true" size={18} /> Add photos <span className={styles.helper}>(optional, up to 3)</span>
                <input accept="image/*" className={styles.fileInput} multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 3))} type="file" />
              </label>
              {files.length ? <ul className={styles.fileList}>{files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</li>)}</ul> : null}
              <div className={styles.actions}>
                <button className={styles.secondaryButton} onClick={() => setStep(1)} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button>
                <button className={styles.button} disabled={!problem.trim() || !storeOperatingState || !safetyConcern || !productInventoryRisk || !customersAffected} onClick={() => setStep(3)} type="button">Review report <ArrowRight aria-hidden="true" size={17} /></button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className={styles.form} style={{ marginTop: "1.1rem" }}>
              <div className={styles.detailGrid}>
                <div className={styles.detail}><span className={styles.detailLabel}>Reported by</span><p className={styles.detailValue}>{reporterName}{employeeId ? ` · Employee ${employeeId}` : ""}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Urgency</span><p className={styles.detailValue}>{URGENCY_OPTIONS.find((option) => option.id === urgency)?.title}</p></div>
                <div className={`${styles.detail} ${styles.detailWide}`}><span className={styles.detailLabel}>Problem</span><p className={styles.detailValue}>{problem}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Area</span><p className={styles.detailValue}>{area || "Not specified"}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Store operation</span><p className={styles.detailValue}>{OPERATING_OPTIONS.find((option) => option.id === storeOperatingState)?.label}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Safety</span><p className={styles.detailValue}>{SAFETY_OPTIONS.find((option) => option.id === safetyConcern)?.label}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Product / inventory</span><p className={styles.detailValue}>{INVENTORY_OPTIONS.find((option) => option.id === productInventoryRisk)?.label}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Customers affected</span><p className={styles.detailValue}>{CUSTOMER_OPTIONS.find((option) => option.id === customersAffected)?.label}</p></div>
                <div className={styles.detail}><span className={styles.detailLabel}>Photos</span><p className={styles.detailValue}>{files.length}</p></div>
              </div>
              <div className={styles.callout}>
                <strong>The original report stays in the record</strong>
                <p>The manager can review, classify, approve, escalate, or create a work order. They cannot silently erase what was submitted.</p>
              </div>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.actions}>
                <button className={styles.secondaryButton} disabled={submitting} onClick={() => { clearSubmissionKey(); setStep(2); }} type="button"><ArrowLeft aria-hidden="true" size={17} /> Back</button>
                <button className={styles.button} disabled={submitting} onClick={submit} type="button">{submitting ? "Sending…" : "Send report"}</button>
              </div>
            </div>
          ) : null}
        </section>
        <aside className={styles.stack}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{portal.store.name}</h2>
            <p className={styles.muted}>{portal.store.address}</p>
          </section>
          <section className={styles.notice}>
            <strong>No equipment record required</strong>
            <p className={styles.helper}>Report the problem in plain language. The manager can connect it to a category or asset later.</p>
          </section>
        </aside>
      </div>
    </PublicFrame>
  );
}
