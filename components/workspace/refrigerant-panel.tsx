import { randomUUID } from "node:crypto";
import Link from "next/link";
import { RecordForm } from "@/components/ops/record-form";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import { plainDay } from "@/lib/ops/plain-time";
import {
  CHARGE_SOURCE_LABELS, CHRONIC_LEAK_BPS, CLOCK_LABELS, LEAK_STATUS_LABELS, REFRIGERANTS, SYSTEM_USE_LABELS,
  formatCharge, formatRate, leakClocks, refrigerantCoverage, yearlyLossBps,
  type LeakClock, type RefrigerantEvent,
} from "@/lib/ops/refrigerant";
import styles from "./refrigerant.module.css";

const RECORD_ROLES = ["facilities", "regional", "technician"];
const FACT_ROLES = [...RECORD_ROLES, "store_manager"];

function eventSummary(event: RefrigerantEvent) {
  if (event.kind === "verification") return `${event.verificationStage === "follow_up" ? "Follow-up" : "First"} leak check ${event.verificationResult === "passed" ? "passed" : "failed"}`;
  return `${event.addedOz ? `Added ${formatCharge(event.addedOz)}` : "No refrigerant added"} · ${LEAK_STATUS_LABELS[event.leakStatus ?? "not_checked"]}`;
}

export function clockSentence(clock: LeakClock, today: string, zone?: string) {
  const day = (date: string) => plainDay(`${date}T17:00:00.000Z`, `${today}T17:00:00.000Z`, zone);
  if (clock.status === "repair_due") return `Leak over the limit (${formatRate(clock.leakRateBps)} a year, limit ${formatRate(clock.thresholdBps)}). Repair by ${day(clock.repairDueOn)}.`;
  if (clock.status === "repair_overdue") return `Repair was due ${day(clock.repairDueOn)}. Repair it now, or make a plan to replace or retire it.`;
  if (clock.status === "check_due") return `Repaired ${day(clock.repairedOn!)}. Do a follow-up leak check by ${day(clock.checkDueOn!)}.`;
  if (clock.status === "check_overdue") return `Follow-up leak check was due ${day(clock.checkDueOn!)}.`;
  return `Closed ${day(clock.closedOn!)}.`;
}

/**
 * Refrigerant type, charge, whether the EPA leak rules apply, any open repair clock and the full log for one unit.
 * Shown on the equipment page and the work order. Forms appear only for people allowed to use them.
 */
export async function RefrigerantPanel({ assetId, workOrderId, returnTo, saved }: { assetId: string; workOrderId?: string; returnTo: string; saved?: boolean }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const scope = session.role === "technician" ? await internalDispatchScope(repository, session) : session;
  const detail = await repository.getAssetDetail(scope, assetId);
  if (!detail) return null;
  const [facts, events, store, organization] = await Promise.all([
    repository.getAssetRefrigerant(session.organizationId, assetId),
    repository.listRefrigerantEvents(session.organizationId, [assetId]),
    repository.getStore(session.organizationId, detail.storeId),
    repository.getOrganization(session.organizationId),
  ]);
  const zone = store?.timeZone ?? organization?.timeZone ?? "America/New_York";
  const today = civilDate(new Date().toISOString(), zone);
  const isCoolingEquipment = ["refrigeration", "hvac"].includes(detail.categoryKey);
  if (!facts && !isCoolingEquipment) return null;
  const coverage = refrigerantCoverage(facts ?? undefined, today);
  const clocks = leakClocks(events, today);
  const openClock = clocks.find((clock) => clock.status !== "closed");
  const year = Number(today.slice(0, 4));
  const lossBps = yearlyLossBps(events, year, facts?.fullChargeOz);
  const addedThisYear = events.filter((event) => event.kind === "service" && event.occurredAt.startsWith(String(year))).reduce((sum, event) => sum + event.addedOz, 0);
  const canEditFacts = FACT_ROLES.includes(session.role);
  const canRecord = RECORD_ROLES.includes(session.role) && Boolean(facts);
  const action = `/api/ops/equipment/${encodeURIComponent(assetId)}/refrigerant`;
  const hidden = (kind: string) => <>
    <input type="hidden" name="action" value={kind} />
    <input type="hidden" name="submissionKey" value={randomUUID()} />
    <input type="hidden" name="returnTo" value={returnTo} />
    {workOrderId ? <input type="hidden" name="workOrderId" value={workOrderId} /> : null}
  </>;
  const chip = coverage.covered === true ? <span className={`${styles.chip} ${styles.chipCovered}`}>EPA leak rules apply</span>
    : coverage.covered === false ? <span className={styles.chip}>Leak rules don&apos;t apply</span>
      : <span className={`${styles.chip} ${styles.chipMissing}`}>Needs info</span>;
  const recent = [...events].reverse();

  return (
    <section className={styles.panel} id="refrigerant" aria-labelledby="refrigerant-title">
      <div className={styles.head}>
        <h2 id="refrigerant-title">Refrigerant</h2>
        {chip}
      </div>
      {saved ? <p className={styles.saved} role="status">Saved.</p> : null}
      {facts ? (
        <dl className={styles.facts}>
          <div><dt>Refrigerant</dt><dd>{facts.refrigerant}</dd></div>
          <div><dt>Full charge</dt><dd>{formatCharge(facts.fullChargeOz)}{facts.chargeSource ? <small>{CHARGE_SOURCE_LABELS[facts.chargeSource]}</small> : null}</dd></div>
          <div><dt>Used for</dt><dd>{SYSTEM_USE_LABELS[facts.systemUse].split(" (")[0]}</dd></div>
          <div><dt>Added in {year}</dt><dd>{formatCharge(addedThisYear)}{lossBps !== undefined ? <small>{formatRate(lossBps)} of full charge</small> : null}</dd></div>
        </dl>
      ) : <p className={styles.empty}>No refrigerant recorded yet. Add the type and amount from the tag on the unit.</p>}
      <p className={styles.reason}>{coverage.reason}</p>
      {openClock ? (
        <p className={`${styles.clock} ${openClock.status.endsWith("overdue") ? styles.clockLate : ""}`} role="status">
          <strong>{CLOCK_LABELS[openClock.status]}</strong>{clockSentence(openClock, today, zone)}
        </p>
      ) : null}
      {coverage.covered && lossBps !== undefined && lossBps >= CHRONIC_LEAK_BPS ? (
        <p className={`${styles.clock} ${styles.clockLate}`}><strong>Chronic leaker</strong>Lost {formatRate(lossBps)} of its charge in {year}. Report it to the EPA by March 1, {year + 1}.</p>
      ) : null}

      {recent.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>Refrigerant log, newest first</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">What happened</th><th scope="col">Leak rate</th><th scope="col">Technician</th><th scope="col">Work order</th></tr></thead>
            <tbody>
              {recent.slice(0, 25).map((event) => (
                <tr key={event.id}>
                  <td>{plainDay(`${event.occurredAt.slice(0, 10)}T17:00:00.000Z`, `${today}T17:00:00.000Z`, zone)}</td>
                  <td>{eventSummary(event)}{event.notes ? <small>{event.notes}</small> : null}</td>
                  <td>{event.leakRateBps !== undefined ? <span className={event.thresholdBps !== undefined && event.leakRateBps > event.thresholdBps ? styles.over : undefined}>{formatRate(event.leakRateBps)}{event.thresholdBps !== undefined ? ` (limit ${formatRate(event.thresholdBps)})` : ""}</span> : "—"}</td>
                  <td>{event.technicianName}{event.technicianCert ? <small>EPA cert {event.technicianCert}</small> : null}<small>{event.source === "vendor" ? "Entered by the vendor" : event.source === "internal" ? "In-house" : `Entered by ${event.recordedByName}`}</small></td>
                  <td>{event.workOrderId ? <Link href={`/app/work-orders/${encodeURIComponent(event.workOrderId)}`}>Open work order</Link> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length > 25 ? <p className={styles.reason}>Showing the latest 25 of {recent.length}. Every record is kept.</p> : null}
        </div>
      ) : facts ? <p className={styles.empty}>No refrigerant work recorded yet.</p> : null}

      <div className={styles.actions}>
        {canRecord ? (
          <details className={styles.drawer} open={Boolean(workOrderId) && coverage.covered === true && !events.some((event) => event.workOrderId === workOrderId)}>
            <summary>Record refrigerant work</summary>
            <RecordForm action={action} offerSavedWork={false} className={styles.form}>
              {hidden("service")}
              <div className={styles.row}>
                <label>Date<input type="date" name="occurredOn" required defaultValue={today} max={today} /></label>
                <label>Refrigerant added (lb)<input name="addedLb" inputMode="decimal" required placeholder="0" pattern="[0-9]*[.]?[0-9]*" /></label>
              </div>
              <fieldset className={styles.choices}>
                <legend>Leak</legend>
                {(["none_found", "found_repaired", "found_not_repaired", "not_checked"] as const).map((status) => (
                  <label key={status}><input type="radio" name="leakStatus" value={status} required defaultChecked={status === "none_found"} />{LEAK_STATUS_LABELS[status]}</label>
                ))}
              </fieldset>
              <div className={styles.row}>
                <label>Technician<input name="technicianName" required maxLength={120} defaultValue={session.role === "technician" ? session.displayName : ""} /></label>
                <label>EPA certification # <span className={styles.optional}>optional</span><input name="technicianCert" maxLength={40} /></label>
              </div>
              <label>Notes <span className={styles.optional}>optional</span><input name="notes" maxLength={1000} /></label>
              <button type="submit">Save refrigerant record</button>
            </RecordForm>
          </details>
        ) : null}
        {canRecord && openClock ? (
          <details className={styles.drawer}>
            <summary>Record a leak check</summary>
            <RecordForm action={action} offerSavedWork={false} className={styles.form}>
              {hidden("check")}
              <div className={styles.row}>
                <label>Date<input type="date" name="occurredOn" required defaultValue={today} max={today} /></label>
                <label>Which check<select name="stage" defaultValue={openClock.repairedOn ? "follow_up" : "initial"}><option value="initial">First check after the repair</option><option value="follow_up">Follow-up check</option></select></label>
              </div>
              <fieldset className={styles.choices}>
                <legend>Result</legend>
                <label><input type="radio" name="result" value="passed" required defaultChecked />Passed, no leak</label>
                <label><input type="radio" name="result" value="failed" required />Failed, still leaking</label>
              </fieldset>
              <div className={styles.row}>
                <label>Technician<input name="technicianName" required maxLength={120} defaultValue={session.role === "technician" ? session.displayName : ""} /></label>
                <label>EPA certification # <span className={styles.optional}>optional</span><input name="technicianCert" maxLength={40} /></label>
              </div>
              <button type="submit">Save leak check</button>
            </RecordForm>
          </details>
        ) : null}
        {canEditFacts ? (
          <details className={styles.drawer} open={!facts && !recent.length && session.role === "technician"}>
            <summary>{facts ? "Change refrigerant details" : "Add refrigerant details"}</summary>
            <RecordForm action={action} offerSavedWork={false} className={styles.form}>
              {hidden("facts")}
              <input type="hidden" name="expectedVersion" value={facts?.version ?? 0} />
              <p className={styles.reason}>Both are on the metal tag on the unit. For walk-ins and beer caves, ask the installer or vendor for the full charge.</p>
              <div className={styles.row}>
                <label>Refrigerant<select name="refrigerant" required defaultValue={facts?.refrigerant ?? ""}>
                  <option value="" disabled>Choose</option>
                  {REFRIGERANTS.map((row) => <option key={row.code} value={row.code}>{row.code} · {row.usedIn}</option>)}
                </select></label>
                <label>Full charge (lb) <span className={styles.optional}>if known</span><input name="fullChargeLb" inputMode="decimal" pattern="[0-9]*[.]?[0-9]*" defaultValue={facts?.fullChargeOz !== undefined ? String(Math.round((facts.fullChargeOz / 16) * 10) / 10) : ""} /></label>
              </div>
              <div className={styles.row}>
                <label>Used for<select name="systemUse" defaultValue={facts?.systemUse ?? (detail.categoryKey === "hvac" ? "comfort_cooling" : "commercial_refrigeration")}>
                  {Object.entries(SYSTEM_USE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                <label>Charge came from<select name="chargeSource" defaultValue={facts?.chargeSource ?? "nameplate"}>
                  {Object.entries(CHARGE_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              </div>
              <button type="submit">Save refrigerant details</button>
            </RecordForm>
          </details>
        ) : null}
      </div>
    </section>
  );
}

/**
 * On a work order's overview: the open leak clock for its equipment, or a short ask to record refrigerant once
 * someone has been out to a unit the leak rules cover and nothing has been recorded for this job yet.
 */
export async function WorkRefrigerantNotice({ workOrderId }: { workOrderId: string }) {
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const work = await repository.getWorkOrderDetail(session, workOrderId);
  if (!work?.asset) return null;
  const facts = await repository.getAssetRefrigerant(session.organizationId, work.asset.id);
  if (!facts) return null;
  const [events, store] = await Promise.all([repository.listRefrigerantEvents(session.organizationId, [work.asset.id]), repository.getStore(session.organizationId, work.storeId)]);
  const zone = store?.timeZone ?? "America/New_York", today = civilDate(new Date().toISOString(), zone);
  const openClock = leakClocks(events, today).find((clock) => clock.status !== "closed");
  const href = `/app/work-orders/${encodeURIComponent(workOrderId)}?view=equipment#refrigerant`;
  if (openClock) return (
    <p className={`${styles.clock} ${openClock.status.endsWith("overdue") ? styles.clockLate : ""}`} role="status">
      <strong>Refrigerant: {CLOCK_LABELS[openClock.status].toLowerCase()}</strong>{clockSentence(openClock, today, zone)} <Link href={href}>Open the refrigerant log</Link>
    </p>
  );
  const visited = work.visits.some((visit) => visit.status !== "active") || ["completed_pending_review", "resolved", "closed"].includes(work.status);
  if (!visited || !refrigerantCoverage(facts, today).covered || events.some((event) => event.workOrderId === workOrderId)) return null;
  return <p className={styles.clock} role="status"><strong>Was refrigerant added on this job?</strong>This unit falls under the EPA leak rules, so each addition needs a record. <Link href={href}>Record refrigerant</Link></p>;
}
