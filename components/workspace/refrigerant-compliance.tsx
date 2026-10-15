import Link from "next/link";
import { StoreJump } from "@/components/ops/store-jump";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import {
  CHRONIC_LEAK_BPS, CLOCK_LABELS, formatCharge, formatRate, leakClocks, refrigerantCoverage, yearlyLossBps,
  type LeakClock, type RefrigerantEquipmentRow, type RefrigerantEvent,
} from "@/lib/ops/refrigerant";
import { clockSentence } from "./refrigerant-panel";
import styles from "./compliance.module.css";
import own from "./refrigerant.module.css";

export type RefrigerantView = "open" | "covered" | "missing" | "chronic" | "all";
const VIEWS: RefrigerantView[] = ["open", "covered", "missing", "chronic", "all"];
const VIEW_LABELS: Record<RefrigerantView, string> = { open: "Leak repairs open", covered: "Covered by the rules", missing: "Needs refrigerant info", chronic: "Chronic leakers", all: "All cooling equipment" };
const PAGE = 50;

interface Row extends RefrigerantEquipmentRow {
  covered?: boolean;
  missing?: "refrigerant" | "charge";
  reason: string;
  clock?: LeakClock;
  lastRateBps?: number;
  thresholdBps?: number;
  addedThisYearOz: number;
  lossBps?: number;
}

/** Compliance tabs shared by Inspections and Refrigerant. */
export function ComplianceTabs({ active }: { active: "inspections" | "refrigerant" | "fuel-tanks" }) {
  return (
    <nav className={styles.filters} aria-label="Compliance areas">
      <Link href="/app/compliance" aria-current={active === "inspections" ? "page" : undefined}>Inspections</Link>
      <Link href="/app/compliance/refrigerant" aria-current={active === "refrigerant" ? "page" : undefined}>Refrigerant</Link>
      <Link href="/app/compliance/fuel-tanks" aria-current={active === "fuel-tanks" ? "page" : undefined}>Fuel tanks</Link>
    </nav>
  );
}

/** Every refrigerant number on this page is worked out from the equipment facts and the refrigerant log. */
export default async function RefrigerantCompliance({ searchParams }: { searchParams: Promise<{ view?: string; offset?: string; store?: string }> }) {
  const query = await searchParams;
  const session = await loadOperatorSession(), repository = await getServerOpsRepository();
  const scope = session.role === "technician" ? await internalDispatchScope(repository, session) : session;
  const organization = await repository.getOrganization(session.organizationId);
  const today = civilDate(new Date().toISOString(), organization?.timeZone ?? "America/New_York"), year = Number(today.slice(0, 4));
  const equipment = (await repository.listRefrigerantEquipment(scope)).filter((row) => !query.store || row.storeId === query.store);
  const events = await repository.listRefrigerantEvents(session.organizationId, equipment.filter((row) => row.refrigerant).map((row) => row.assetId));
  const byAsset = new Map<string, RefrigerantEvent[]>();
  for (const event of events) byAsset.set(event.assetId, [...(byAsset.get(event.assetId) ?? []), event]);
  const rows: Row[] = equipment.map((row) => {
    const history = byAsset.get(row.assetId) ?? [];
    const coverage = refrigerantCoverage(row.refrigerant, today);
    const lastAdd = [...history].reverse().find((event) => event.kind === "service" && event.leakRateBps !== undefined);
    return {
      ...row, covered: coverage.covered, missing: coverage.missing, reason: coverage.reason,
      clock: leakClocks(history, today).find((clock) => clock.status !== "closed"),
      lastRateBps: lastAdd?.leakRateBps, thresholdBps: lastAdd?.thresholdBps ?? coverage.thresholdBps,
      addedThisYearOz: history.filter((event) => event.kind === "service" && event.occurredAt.startsWith(String(year))).reduce((sum, event) => sum + event.addedOz, 0),
      lossBps: yearlyLossBps(history, year, row.refrigerant?.fullChargeOz),
    };
  });
  const inView: Record<RefrigerantView, Row[]> = {
    open: rows.filter((row) => row.clock).sort((a, b) => (a.clock!.status.endsWith("overdue") ? 0 : 1) - (b.clock!.status.endsWith("overdue") ? 0 : 1) || a.clock!.repairDueOn.localeCompare(b.clock!.repairDueOn)),
    covered: rows.filter((row) => row.covered),
    missing: rows.filter((row) => row.missing),
    chronic: rows.filter((row) => row.covered && (row.lossBps ?? 0) >= CHRONIC_LEAK_BPS),
    all: rows,
  };
  const overdue = inView.open.filter((row) => row.clock!.status.endsWith("overdue")).length;
  const requested = VIEWS.includes(query.view as RefrigerantView) ? query.view as RefrigerantView : undefined;
  const view = requested ?? (inView.open.length ? "open" : "covered");
  const offset = Math.min(100_000, Math.max(0, Math.floor(Number(query.offset) || 0)));
  const shown = inView[view].slice(offset, offset + PAGE);
  const href = (next: RefrigerantView, start = 0) => `/app/compliance/refrigerant?${new URLSearchParams({ view: next, ...(query.store ? { store: query.store } : {}), ...(start ? { offset: String(start) } : {}) })}`;
  const status = (row: Row) => row.clock
    ? <span className={`${styles.tag} ${row.clock.status.endsWith("overdue") ? styles.danger : ""}`}>{CLOCK_LABELS[row.clock.status]}</span>
    : row.missing ? <span className={styles.tag}>{row.missing === "charge" ? "Add full charge" : "Add refrigerant"}</span>
      : row.covered ? <span className={styles.tag}>Covered · no open leak</span> : <span className={styles.muted}>Rules don&apos;t apply</span>;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Compliance</h1>
          <p>Refrigerant leak rules (EPA AIM Act and Section 608).</p>
          <small>{session.scopeLabel}</small>
        </div>
      </header>
      <ComplianceTabs active="refrigerant" />
      <StoreJump />
      <div className={styles.metrics}>
        <Link className={styles.metric} href={href("open")}>Leak repairs open<strong>{inView.open.length}</strong>{overdue ? <small className={own.over}>{overdue} overdue</small> : null}</Link>
        <Link className={styles.metric} href={href("covered")}>Covered by the rules<strong>{inView.covered.length}</strong></Link>
        <Link className={styles.metric} href={href("chronic")}>Chronic leakers {year}<strong>{inView.chronic.length}</strong></Link>
        <Link className={styles.metric} href={href("missing")}>Needs refrigerant info<strong>{inView.missing.length}</strong></Link>
        <Link className={styles.metric} href={href("all")}>All cooling equipment<strong>{rows.length}</strong></Link>
      </div>
      <section className={styles.panel}>
        <h2>{VIEW_LABELS[view]} · {inView[view].length}</h2>
        {view === "missing" ? <p>Add the refrigerant type and full charge from the tag on each unit. Walk-ins and beer caves usually need the installer or vendor for the full charge.</p> : null}
        {view === "chronic" ? <p>Lost 125% or more of their full charge in {year}. These are reported to the EPA by March 1, {year + 1}.</p> : null}
        {shown.length ? (
          <div className={styles.scroll}>
            <table className={`${styles.table} ${styles.operatingTable}`}>
              <thead><tr><th>Equipment</th><th>Refrigerant</th><th>Status</th><th>Last leak rate</th><th>Added in {year}</th></tr></thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.assetId}>
                    <td data-label="Equipment"><Link href={`/app/equipment/${encodeURIComponent(row.assetId)}#refrigerant`}>{row.assetName}</Link><p><small>Store {row.storeNumber} · {row.storeName}</small></p></td>
                    <td data-label="Refrigerant">{row.refrigerant ? <>{row.refrigerant.refrigerant}<p><small>{formatCharge(row.refrigerant.fullChargeOz)} full charge</small></p></> : <span className={styles.muted}>Not recorded</span>}</td>
                    <td data-label="Status">{status(row)}{row.clock ? <p><small>{clockSentence(row.clock, today)}</small></p> : null}</td>
                    <td data-label="Last leak rate">{row.lastRateBps !== undefined ? <span className={row.thresholdBps !== undefined && row.lastRateBps > row.thresholdBps ? own.over : undefined}>{formatRate(row.lastRateBps)}</span> : "—"}{row.thresholdBps !== undefined ? <p><small>Limit {formatRate(row.thresholdBps)}</small></p> : null}</td>
                    <td data-label={`Added in ${year}`}>{row.addedThisYearOz ? formatCharge(row.addedThisYearOz) : "None"}{row.lossBps ? <p><small>{formatRate(row.lossBps)} of full charge</small></p> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>{view === "open" ? "No open leak repairs." : "Nothing in this view."}</p>}
        {inView[view].length > PAGE ? (
          <nav className={styles.bar} aria-label="Pages">
            {offset > 0 ? <Link href={href(view, Math.max(0, offset - PAGE))}>Previous</Link> : <span />}
            <span>{offset + 1}–{Math.min(offset + PAGE, inView[view].length)} of {inView[view].length}</span>
            {offset + PAGE < inView[view].length ? <Link href={href(view, offset + PAGE)}>Next</Link> : <span />}
          </nav>
        ) : null}
      </section>
      <p className={styles.muted}>Leak rates use the EPA annualizing method from what&apos;s recorded. Records are kept at least 3 years. This page doesn&apos;t file anything with the EPA.</p>
    </div>
  );
}
