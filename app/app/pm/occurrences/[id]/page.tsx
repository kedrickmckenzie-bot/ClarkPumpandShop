import Link from "next/link";
import { loadPmOccurrenceRecord } from "@/app/app/_data/pm-record-loader";
import { formatOperationsDateTime } from "@/lib/ops/local-time";
import styles from "@/components/workspace/pm-record.module.css";

export default async function OccurrencePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; visitPage?: string }>;
}) {
  const { id } = await params, query = await searchParams;
  const { occurrence, store, storeLabel, plan, asset, work, status, visits, page, canAdjustPlan, canCreateWork, grouped, coverageAssets } = await loadPmOccurrenceRecord(id, query.visitPage);
  const fromBrief = query.returnTo?.startsWith("/app/brief/records?");
  const back = fromBrief || query.returnTo?.startsWith("/app/pm?") ? query.returnTo! : "/app/pm";
  const date = (value: string) => formatOperationsDateTime(value, store.timeZone);
  const visitHref = (nextPage: number) => {
    const params = new URLSearchParams({ visitPage: String(nextPage), returnTo: back });
    return `/app/pm/occurrences/${encodeURIComponent(id)}?${params}#visit-evidence`;
  };
  const lastPage = Math.max(1, Math.ceil(visits.totalCount / 25));
  const statusLabel = status === "missed" ? "Past due" : status === "cancelled" ? "Canceled" : (status[0].toUpperCase() + status.slice(1)).replaceAll("_", " ");
  return <div className={styles.page}>
    <Link className={styles.back} href={back}>← {fromBrief ? "Back to brief records" : "Back to PM"}</Link>
    <header className={styles.header}>
      <div><h1>{plan?.name ?? "Planned maintenance"}</h1><p><Link href={`/app/stores/${encodeURIComponent(store.id)}`}>{storeLabel}</Link>{asset ? <> · <Link href={`/app/equipment/${encodeURIComponent(asset.id)}`}>{asset.name}</Link></> : null}</p></div>
      <strong className={styles.status} data-status={status}>{statusLabel}</strong>
    </header>
    <dl className={styles.window} aria-label="Maintenance window">
      <div><dt>Window starts</dt><dd>{date(occurrence.windowStartsAt)}</dd></div>
      <div><dt>Due</dt><dd>{date(occurrence.dueAt)}</dd></div>
      <div><dt>Window ends</dt><dd>{date(occurrence.windowEndsAt)}</dd></div>
    </dl>
    <section className={styles.section} aria-labelledby="pm-result">
      <h2 id="pm-result">Result</h2>
      <p>{occurrence.result ?? "No result recorded."}</p>
      {occurrence.completedAt ? <p>Completed {date(occurrence.completedAt)}</p> : null}
      {occurrence.exceptionReason ? <p>{occurrence.exceptionReason}</p> : null}
      {work ? <Link className={styles.action} href={`/app/work-orders/${encodeURIComponent(work.id)}`}>Work order {work.number} →</Link> : <p>{occurrence.workOrderId ? "Linked work order unavailable." : "No work order linked."}</p>}
    </section>
    {grouped ? <section className={styles.section}>
      <h2>Equipment covered ({coverageAssets.length})</h2>
      <p>{work ? "Coverage saved with this work order." : "Current coverage. Finalized when the work order is created."}</p>
      {coverageAssets.length ? <table className={styles.table}><thead><tr><th>Equipment</th><th>Status</th></tr></thead><tbody>{coverageAssets.map(a => <tr key={a.id}><td><Link href={`/app/equipment/${encodeURIComponent(a.id)}`}>{a.name}</Link></td><td>{a.status.replaceAll("_", " ")}</td></tr>)}</tbody></table> : <p>Store service covers the selected area. Equipment list needs review.</p>}
    </section> : null}
    <section className={styles.section} id="visit-evidence" aria-labelledby="pm-visits">
      <h2 id="pm-visits">Visit evidence <span>({visits.totalCount})</span></h2>
      {visits.items.length ? <>
        <p className={styles.note}>Check-in and check-out show presence, not billed labor.</p>
        <table className={styles.table}><thead><tr><th>Provider / technician</th><th>Checked in</th><th>Checked out</th></tr></thead>
          <tbody>{visits.items.map(visit => <tr key={visit.id}>
            <td><Link href={`/app/visits/${encodeURIComponent(visit.id)}`}>{visit.providerName} →</Link><span>{visit.technicianName}</span></td>
            <td data-label="Checked in">{date(visit.checkedInAt)}</td>
            <td data-label="Checked out">{visit.checkedOutAt ? date(visit.checkedOutAt) : visit.status === "active" ? "Still onsite" : "Not recorded"}</td>
          </tr>)}</tbody>
        </table>
      </> : <p>{visits.totalCount ? "No visits on this page." : "No visit recorded."}</p>}
      {lastPage > 1 || page > 1 ? <nav className={styles.pagination} aria-label="Visit pages">
        {page > 1 ? <Link href={visitHref(Math.min(page - 1, lastPage))}>Previous</Link> : null}
        <span>{page <= lastPage ? `Page ${page} of ${lastPage}` : `${visits.totalCount} visits`}</span>
        {visits.nextOffset !== undefined ? <Link href={visitHref(page + 1)}>Next</Link> : null}
      </nav> : null}
    </section>
    <nav className={styles.actions} aria-label="PM record actions">
      {canAdjustPlan && plan ? <Link className={styles.action} href={`/app/pm/plans/${encodeURIComponent(plan.id)}`}>Adjust schedule</Link> : null}
      {!work && !occurrence.workOrderId && ["due", "missed", "scheduled"].includes(status) && canCreateWork ? <Link className={styles.primary} href={`/app/work-orders/new?pmOccurrence=${encodeURIComponent(occurrence.id)}`}>Create work order</Link> : null}
    </nav>
  </div>;
}
