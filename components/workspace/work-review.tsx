"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, PanelRightOpen, X } from "lucide-react";
import type { ReviewEvidence, WorkReviewModel } from "@/lib/ops/work-review";
import { workReviewTarget } from "@/lib/ops/navigation-trail";
import styles from "./work-review.module.css";

type ReviewTarget = { id: string; href: string; label: string; context?: string };
const ReviewContext = createContext<((target: ReviewTarget) => void) | undefined>(undefined);

/** Explicit companion to the normal record link; never intercepts workflow actions. */
export function WorkReviewButton({ href, label, context }: { href: string; label: string; context?: string }) {
  const open = useContext(ReviewContext);
  const id = workReviewTarget(href);
  if (!open || !id) return null;
  return <button type="button" className={styles.reviewButton} aria-label={`Review ${label} here`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); open({ id, href, label, context }); }}><PanelRightOpen size={15} aria-hidden="true" /><span>Review here</span></button>;
}

function EvidenceList({ rows, related = false }: { rows: ReviewEvidence[]; related?: boolean }) {
  return <ul className={styles.evidence}>{rows.map((row) => <li key={row.id}><div>{row.href ? <Link href={row.href}>{row.label}<ArrowUpRight size={14} aria-hidden="true" /></Link> : <strong>{row.label}</strong>}<p>{row.detail}</p></div>{related && row.href ? <WorkReviewButton href={row.href} label={row.label} /> : null}</li>)}</ul>;
}

function EvidenceSection({ title, rows, count = rows.length, empty, href, related = false }: { title: string; rows: ReviewEvidence[]; count?: number; empty: string; href?: string; related?: boolean }) {
  return <section className={styles.section}><h3>{title}</h3>{rows.length ? <EvidenceList rows={rows} related={related} /> : <p className={styles.empty}>{empty}</p>}{count > rows.length ? <p className={styles.more}>Showing {rows.length} of {count}. {href ? <Link href={href}>Review all evidence</Link> : null}</p> : null}</section>;
}

/** The same assembled model can be rendered in a full record or in the review drawer. */
export function WorkReviewContent({ model }: { model: WorkReviewModel }) {
  return <div className={styles.content}>
    <p className={styles.scope}>{model.scope} · {model.status} · All recorded dates for this work order</p>
    <p className={styles.problem}>{model.problem}</p>
    <section className={styles.outcome} aria-label="Current service evidence"><EvidenceList rows={[model.outcome]} /></section>
    <EvidenceSection title="What this work concerns" rows={model.context} empty="No additional context recorded." />
    <EvidenceSection title="What remains open" rows={model.obligations} empty="No open follow-up or next action is recorded. Reviewing this work does not create a task." />
    <EvidenceSection title="What happened" rows={model.history} count={model.historyCount} empty="No linked visits have been recorded." href={`${model.openHref}?view=visits`} />
    <section className={styles.section}><h3>Costs and invoice evidence</h3><dl className={styles.amounts}><div><dt>Recorded work cost</dt><dd>{model.costTotal}</dd></div><div><dt>Linked invoice amount</dt><dd>{model.invoiceTotal}</dd></div></dl><p className={styles.empty}>These are separate bases for this work order, across all recorded dates.</p>
      <details><summary>Entered cost lines ({model.costCount})</summary><EvidenceList rows={model.costs} />{model.costCount > model.costs.length ? <Link href={`${model.openHref}?view=cost`}>Review all {model.costCount} cost lines</Link> : null}</details>
      <details><summary>Confirmed invoice allocations ({model.invoiceCount})</summary><EvidenceList rows={model.invoices} />{model.invoiceCount > model.invoices.length ? <Link href={`${model.openHref}?view=cost`}>Review all allocations</Link> : null}</details>
    </section>
    <EvidenceSection title="Available options" rows={model.quotes} count={model.quoteCount} empty="No current quote is recorded for this work order." href={`${model.openHref}?view=service&path=bids`} />
    {model.equipmentScope ? <><section className={styles.section}><h3>Equipment history and responsibility</h3><p>{model.equipmentScope}</p><EvidenceList rows={model.warranties} />{!model.warranties.length ? <p className={styles.empty}>No warranty terms recorded for this scope.</p> : null}{model.warrantyCount > model.warranties.length ? <p>Showing {model.warranties.length} of {model.warrantyCount} warranty records. <Link href={model.equipmentHref ?? `${model.openHref}?view=equipment`}>Review equipment evidence</Link></p> : null}</section>
      <EvidenceSection title="Other work on this equipment scope" rows={model.related} empty="No other work is recorded in this equipment scope." related />
      {model.relatedMoreHref ? <Link className={styles.more} href={model.relatedMoreHref}>Review all work in this equipment scope<ArrowUpRight size={15} aria-hidden="true" /></Link> : null}</> : null}
    {model.missing.length ? <section className={styles.section}><h3>Information still missing</h3><ul className={styles.gaps}>{model.missing.map((gap) => <li key={gap}>{gap}</li>)}</ul></section> : null}
    <details className={styles.method}><summary>How this review is assembled</summary><p>Visit outcomes belong to the explicitly linked job. A manager review applies only to that outcome; an earlier confirmation does not verify a later visit. Other work is related by recorded equipment and component links, and does not establish a repeated failure or its cause. History includes the latest five other work orders in that scope. Warranty dates and original terms do not confirm eligibility for the current problem. Entered cost and reconciled invoice allocations remain separate; missing records do not establish zero spending or full historical coverage.</p></details>
  </div>;
}

export function WorkEquipmentContext({ model }: { model: WorkReviewModel }) {
  if (!model.equipmentScope) return null;
  return <div className={styles.content} id="work-equipment-context"><p className={styles.scope}>{model.equipmentScope} · All recorded dates</p>
    <EvidenceSection title="Other work on this equipment scope" rows={model.related} empty="No other work is recorded in this equipment scope." related />
    <EvidenceSection title="Warranty and responsibility" rows={model.warranties} count={model.warrantyCount} empty="No warranty terms recorded for this scope." href={model.equipmentHref} />
    <EvidenceSection title="Available options and missing quote details" rows={model.quotes} count={model.quoteCount} empty="No current quote recorded for this work order." href={`${model.openHref}?view=service&path=bids`} />
    <p className={styles.empty}>Other work is related by its equipment classification. A similar complaint does not establish the same failed part. Warranty terms require checking against the current diagnosis.</p>
  </div>;
}

export function WorkReviewProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [targets, setTargets] = useState<ReviewTarget[]>([]);
  const [source, setSource] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [model, setModel] = useState<WorkReviewModel | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const target = targets.at(-1);
  const isOpen = Boolean(target);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);
  const close = () => { dialog.current?.close(); setTargets([]); opener.current?.focus({ preventScroll: true }); };
  const open = (next: ReviewTarget) => {
    if (!dialog.current?.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSource(document.querySelector("main h1")?.textContent?.trim() || "Your current view");
      setSourceContext(next.context ?? "");
      setTargets([next]);
      dialog.current?.showModal();
    } else setTargets((current) => [...current, next]);
    setModel(null); setError("");
    dialog.current?.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    fetch(`/api/ops/work-orders/${encodeURIComponent(target.id)}/review`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const result = await response.json() as WorkReviewModel & { error?: string }; if (!response.ok) throw new Error(result.error || "This work review could not load."); return result; })
      .then((result) => { if (!controller.signal.aborted) { setModel(result); setError(""); } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "This work review could not load."); });
    return () => controller.abort();
  }, [target, attempt]);
  // Leaving the source view discards the read model, including when a role changes.
  useEffect(() => { dialog.current?.close(); }, [pathname, query]);
  return <ReviewContext.Provider value={open}>{children}<dialog className={styles.dialog} ref={dialog} aria-labelledby="work-review-title" onClose={() => { setTargets([]); setModel(null); }} onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className={styles.header}><div><small>Reviewing from {source}</small><h2 id="work-review-title">{model?.number ?? "Work review"}</h2></div><button type="button" onClick={close} aria-label="Close work review"><X size={22} aria-hidden="true" /></button></header>
    <nav className={styles.actions} aria-label="Work review navigation">{targets.length > 1 ? <button type="button" onClick={() => { setModel(null); setError(""); setTargets((current) => current.slice(0, -1)); }}><ArrowLeft size={15} aria-hidden="true" />Previous work review</button> : <span>Your original view stays open</span>}{target ? <Link href={target.href}>Open full record<ArrowUpRight size={15} aria-hidden="true" /></Link> : null}</nav>
    {sourceContext ? <p className={styles.sourceContext}>Source view: {sourceContext}</p> : null}
    {error ? <div className={styles.message} role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Try again</button></div> : model ? <WorkReviewContent model={model} /> : <p className={styles.message} role="status">Assembling this work’s source records…</p>}
  </dialog></ReviewContext.Provider>;
}
