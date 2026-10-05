"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "./dispatch-board";
import { JobPreparationFields } from "./job-preparation-fields";
import type { WorkOrder, ServiceRequest } from "@/lib/ops/types";
import styles from "./review-routing.module.css";
type Review = {
  kind: "work" | "request";
  item: WorkOrder | ServiceRequest;
  storeLabel: string;
  vendors: { id: string; name: string }[];
  assignmentId?: string;
  latestUpdate?: string;
  canReady: boolean;
  needsManagerReview: boolean;
};
export function ReviewRouteButton({
  id,
  kind,
}: {
  id: string;
  kind: "work" | "request";
}) {
  const router = useRouter(),
    [open, setOpen] = useState(false),
    [data, setData] = useState<Review>(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [decision, setDecision] = useState("internal"),
    [saved, setSaved] = useState<{ message: string; href: string }>();
  const loadRevision = useRef(0);
  async function load(search = "") {
    const revision = ++loadRevision.current;
    setError("");
    try {
      const response = await fetch(
          `/api/ops/review?${new URLSearchParams({ id, kind, vendorSearch: search })}`,
          { cache: "no-store" },
        ),
        value = (await response.json()) as Review & { error?: string };
      if (!response.ok) throw Error(value.error ?? "Could not open this item.");
      if (revision === loadRevision.current) setData(value);
    } catch (e) {
      if (revision === loadRevision.current)
        setError(e instanceof Error ? e.message : "Could not load.");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || pending) return;
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/ops/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            kind,
            decision,
            expectedVersion: data.item.version ?? 0,
            assignmentId: data.assignmentId,
            key: crypto.randomUUID(),
            priority: form.get("priority"),
            technicianNotes: form.get("technicianNotes") || undefined,
            estimatedMinutes: form.get("estimatedMinutes")
              ? Number(form.get("estimatedMinutes"))
              : undefined,
            confirmationDelay: form.get("confirmationDelay") || undefined,
            vendorId: form.get("vendorId") || undefined,
            reason: form.get("reason") || undefined,
            holdDeadlineAt: form.get("holdDeadlineAt")
              ? String(form.get("holdDeadlineAt"))
              : undefined,
          }),
        }),
        value = (await response.json()) as {
          error?: string;
          message: string;
          href: string;
        };
      if (!response.ok)
        throw Error(
          value.error ?? "Could not save. Your decision has not been applied.",
        );
      setSaved(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }
  const work = data?.kind === "work" ? (data.item as WorkOrder) : undefined;
  return (
    <>
      <button
        className={styles.open}
        onClick={() => {
          setOpen(true);
          setSaved(undefined);
          void load();
        }}
      >
        Review and route
      </button>
      {open ? (
        <Sheet
          title="Review and route"
          onClose={() => {
            if (!pending) {
              setOpen(false);
              router.refresh();
            }
          }}
        >
          <div className={styles.panel}>
            {error ? (
              <p role="alert">
                {error}{" "}
                <button onClick={() => void load()}>Refresh item</button>
              </p>
            ) : null}
            {saved ? (
              <div role="status">
                <h2>{saved.message}</h2>
                <Link href={saved.href}>
                  {saved.href.includes("dispatch")
                    ? "Open Plan"
                    : saved.href.includes("work-orders")
                      ? "Open work order"
                      : "Back to Review"}{" "}
                  →
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    router.refresh();
                  }}
                >
                  Done
                </button>
              </div>
            ) : !data ? (
              <p>Loading review…</p>
            ) : (
              <>
                <p>{data.storeLabel}</p>
                <h2>{data.item.problem}</h2>
                {data.latestUpdate ? <section aria-label="Latest technician update"><strong>Latest technician update</strong><p style={{whiteSpace:"pre-wrap"}}>{data.latestUpdate}</p></section> : null}
                {data.needsManagerReview ? (
                  <p>
                    This report needs the store manager&apos;s confirmation.{" "}
                    <Link href={`/app/requests/${id}`}>Review report</Link>
                  </p>
                ) : null}
                <form onSubmit={save}>
                  <fieldset>
                    <legend>Decision</legend>
                    <div className={styles.decisions}>
                      {[
                        ["internal", "Our team"],
                        ["outside_vendor", "Outside vendor"],
                        ["next_visit", "Do on next visit"],
                        ["not_needed", "Not needed"],
                        ...(data.canReady ? [["ready", "Mark ready"]] : []),
                      ].map(([value, label]) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name="decision"
                            value={value}
                            checked={decision === value}
                            onChange={() => setDecision(value)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    Urgency
                    <select name="priority" defaultValue={data.item.priority}>
                      <option value="routine">Routine</option>
                      <option value="urgent">Urgent</option>
                      <option value="emergency">Emergency</option>
                      <option value="planned">Planned</option>
                    </select>
                  </label>
                  {!["not_needed", "ready"].includes(decision) ? (
                    <JobPreparationFields
                      notes={work?.technicianNotes}
                      minutes={work?.estimatedMinutes}
                      confirmationDelay={work?.confirmationDelay}
                    />
                  ) : null}
                  {decision === "outside_vendor" ? (
                    <>
                      <label>
                        Find vendor
                        <input
                          type="search"
                          placeholder="Name or specialty"
                          onChange={(e) => void load(e.target.value)}
                        />
                      </label>
                      <label>
                        Outside vendor
                        <select name="vendorId" required>
                          <option value="">Choose vendor</option>
                          {data.vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p>Review the service authorization before issuing it.</p>
                    </>
                  ) : null}
                  {decision === "next_visit" ? (
                    <label>
                      Review by
                      <input type="date" name="holdDeadlineAt" required />
                    </label>
                  ) : null}
                  {["not_needed", "ready"].includes(decision) ? (
                    <label>
                      {decision === "ready"
                        ? "What changed?"
                        : "Why is work not needed?"}
                      <textarea name="reason" required maxLength={1000} />
                    </label>
                  ) : null}
                  {work ? (
                    <Link
                      href={`/app/tasks/new?work=${encodeURIComponent(work.id)}`}
                    >
                      Assign a task
                    </Link>
                  ) : null}
                  <footer>
                    <button
                      className={styles.primary}
                      disabled={
                        pending ||
                        (data.needsManagerReview && decision !== "not_needed")
                      }
                      type="submit"
                    >
                      {pending
                        ? "Saving…"
                        : decision === "ready"
                          ? "Mark ready"
                          : "Save decision"}
                    </button>
                  </footer>
                </form>
              </>
            )}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
