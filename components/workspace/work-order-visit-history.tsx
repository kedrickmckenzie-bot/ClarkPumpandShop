import Link from "next/link";
import type { DetailSectionViewModel } from "@/components/ops/data-contract";
import styles from "./work-order-case.module.css";

export function WorkOrderVisitHistory({ section }: { section?: DetailSectionViewModel }) {
  const visits = [...(section?.table?.rows ?? [])].reverse();
  return <section className={styles.visitHistory} aria-label="Visit history">
    <h2>Visit history <small>{visits.length} visit{visits.length === 1 ? "" : "s"}</small></h2>
    {!visits.length ? <p>No visits recorded yet.</p> : <ol>
      {visits.map((visit, index) => {
        const cell = (key: string) => visit.cells.find((item) => item.key === key);
        const notes = section?.timeline?.filter((event) => event.link?.href === visit.href) ?? [];
        return <li key={visit.id}>
          <header><h3>Visit {index + 1} · {cell("visit")?.value}</h3><Link href={visit.href}>Visit details</Link></header>
          <p><strong>{cell("provider")?.value}</strong> · {cell("provider")?.secondary}</p>
          <p className={styles.visitTiming}>Checked out: {cell("checkout")?.value} · <strong>{cell("outcome")?.value}</strong></p>
          {notes.length ? notes.map((note) => <div className={styles.visitNote} key={note.id}><p>{note.description}</p><small>{note.actorLabel} · {note.timestampLabel}</small></div>) : <p className={styles.visitNote}>{cell("outcome")?.secondary ?? "No notes recorded for this visit."}</p>}
        </li>;
      })}
    </ol>}
  </section>;
}
