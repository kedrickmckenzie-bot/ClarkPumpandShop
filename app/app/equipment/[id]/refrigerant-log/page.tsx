import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { PrintButton } from "@/components/workspace/print-button";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { formatOperationsDate } from "@/lib/ops/local-time";
import {
  CHARGE_SOURCE_LABELS, CLOCK_LABELS, LEAK_STATUS_LABELS, SYSTEM_USE_LABELS, formatCharge, formatRate, leakClocks, refrigerantCoverage,
} from "@/lib/ops/refrigerant";
import styles from "@/components/workspace/refrigerant-log.module.css";

export const metadata: Metadata = { title: "Refrigerant log" };

const date = (day: string, zone: string) => formatOperationsDate(`${day.slice(0, 10)}T17:00:00.000Z`, zone);

/** One unit's complete refrigerant record, laid out to print or save as PDF for an inspector. */
export default async function RefrigerantLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const scope = session.role === "technician" ? await internalDispatchScope(repository, session) : session;
  const detail = await repository.getAssetDetail(scope, id);
  if (!detail) notFound();
  const [facts, events, store, organization] = await Promise.all([
    repository.getAssetRefrigerant(session.organizationId, id), repository.listRefrigerantEvents(session.organizationId, [id]),
    repository.getStore(session.organizationId, detail.storeId), repository.getOrganization(session.organizationId),
  ]);
  const zone = store?.timeZone ?? organization?.timeZone ?? "America/New_York", today = civilDate(new Date().toISOString(), zone);
  const coverage = refrigerantCoverage(facts ?? undefined, today);
  const clocks = leakClocks(events, today);
  return (
    <article className={styles.page}>
      <div className={styles.toolbar}><Link href={`/app/equipment/${encodeURIComponent(id)}#refrigerant`}>← Back to equipment</Link><PrintButton /></div>
      <header className={styles.header}>
        <p>{organization?.name} · Refrigerant log</p>
        <h1>{detail.name}</h1>
        <p>Store {store?.storeNumber} · {store?.name} · Tag {detail.assetTag}{detail.manufacturer ? ` · ${detail.manufacturer}` : ""}{detail.model ? ` ${detail.model}` : ""}{detail.serialNumber ? ` · Serial ${detail.serialNumber}` : ""}</p>
      </header>
      <dl className={styles.facts}>
        <div><dt>Refrigerant</dt><dd>{facts?.refrigerant ?? "Not recorded"}</dd></div>
        <div><dt>Full charge</dt><dd>{formatCharge(facts?.fullChargeOz)}{facts?.chargeSource ? ` (${CHARGE_SOURCE_LABELS[facts.chargeSource].toLowerCase()})` : ""}</dd></div>
        <div><dt>Used for</dt><dd>{facts ? SYSTEM_USE_LABELS[facts.systemUse] : "Not recorded"}</dd></div>
        <div><dt>Leak rules</dt><dd>{coverage.reason}</dd></div>
      </dl>
      {clocks.length ? (
        <section>
          <h2>Leak repairs</h2>
          <table className={styles.table}>
            <thead><tr><th>Started</th><th>Leak rate</th><th>Repair due</th><th>Repaired</th><th>Follow-up check</th><th>Status</th></tr></thead>
            <tbody>{clocks.map((clock) => <tr key={clock.startEventId}><td>{date(clock.startedOn, zone)}</td><td>{formatRate(clock.leakRateBps)} (limit {formatRate(clock.thresholdBps)})</td><td>{date(clock.repairDueOn, zone)}</td><td>{clock.repairedOn ? date(clock.repairedOn, zone) : "—"}</td><td>{clock.closedOn ? `Passed ${date(clock.closedOn, zone)}` : clock.checkDueOn ? `Due ${date(clock.checkDueOn, zone)}` : "—"}</td><td>{CLOCK_LABELS[clock.status]}</td></tr>)}</tbody>
          </table>
        </section>
      ) : null}
      <section>
        <h2>Every record ({events.length})</h2>
        {events.length ? (
          <table className={styles.table}>
            <thead><tr><th>Date</th><th>What happened</th><th>Added</th><th>Leak rate</th><th>Technician</th><th>EPA cert</th><th>Recorded by</th></tr></thead>
            <tbody>{events.map((event) => <tr key={event.id}>
              <td>{date(event.occurredAt, zone)}</td>
              <td>{event.kind === "verification" ? `${event.verificationStage === "follow_up" ? "Follow-up" : "First"} leak check ${event.verificationResult}` : LEAK_STATUS_LABELS[event.leakStatus ?? "not_checked"]}{event.notes ? ` · ${event.notes}` : ""}</td>
              <td>{event.kind === "service" ? formatCharge(event.addedOz) : "—"}</td>
              <td>{event.leakRateBps !== undefined ? `${formatRate(event.leakRateBps)}${event.thresholdBps !== undefined ? ` (limit ${formatRate(event.thresholdBps)})` : ""}` : "—"}</td>
              <td>{event.technicianName}</td>
              <td>{event.technicianCert ?? "—"}</td>
              <td>{event.source === "vendor" ? "Vendor" : event.source === "internal" ? "In-house" : event.recordedByName} · {formatOperationsDate(event.createdAt, zone)}</td>
            </tr>)}</tbody>
          </table>
        ) : <p>No refrigerant records yet.</p>}
      </section>
      <footer className={styles.footer}>Printed {date(today, zone)}. Leak rates use the EPA annualizing method from the records above. Records are kept at least 3 years and are never edited; corrections are added as new records.</footer>
    </article>
  );
}
