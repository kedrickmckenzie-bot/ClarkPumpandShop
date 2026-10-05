import Link from "next/link";
import type { Metadata } from "next";
import { getOpsRequestContext } from "@/lib/server/ops-request-context";
import { openEquipmentNotes, type EquipmentNote } from "@/lib/ops/equipment-notes";
import { OpsDomainError } from "@/lib/ops/errors";
import styles from "@/components/workspace/internal-dispatch.module.css";

export const metadata: Metadata = { title: "AI repair notes" };

const resultLabel: Record<EquipmentNote["tried"][number]["result"], string> = { fixed: "Fixed it", helped: "Helped", no_change: "No change", unknown: "Not said" };

/**
 * The raw AI repair notes for one unit. Top admins only, for checking what the AI reads. Nothing is shown
 * or recorded until "Open notes" is pressed, so prefetching or a stray visit never counts as reading them.
 */
export default async function EquipmentAiNotes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ open?: string }> }) {
  const { id } = await params, open = (await searchParams).open === "1";
  const back = <Link href={`/app/equipment/${encodeURIComponent(id)}`}>← Equipment</Link>;
  const notAllowed = <section className={styles.workspace}>{back}<h1>AI repair notes</h1><p>Only the top admin can open these notes. Ask the AI about this equipment instead.</p></section>;
  const context = await getOpsRequestContext(["facilities"]).catch((error: unknown) => { if (error instanceof OpsDomainError && error.code === "FORBIDDEN") return null; throw error; });
  if (!context || context.session.persona) return notAllowed;
  const { session, repository, actor } = context;
  if (!open) return <section className={styles.workspace}>
    {back}
    <h1>AI repair notes</h1>
    <p>The AI writes these from technicians&apos; checkout chats and reads them for future repairs. They are here only to check what the AI is reading. Opening them is recorded.</p>
    <form method="get"><input type="hidden" name="open" value="1"/><button type="submit">Open notes</button></form>
  </section>;
  const opened = await openEquipmentNotes({ repository }, { organizationId: session.organizationId, actor, assetId: id }).catch((error: unknown) => { if (error instanceof OpsDomainError && error.code === "FORBIDDEN") return null; throw error; });
  if (!opened) return notAllowed;
  const { asset, notes } = opened;
  return <section className={styles.workspace}>
    {back}
    <h1>AI repair notes · {asset.name}</h1>
    <p>{notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}, newest first.` : "No notes yet. They are written when a technician finishes a job by chat."}</p>
    {notes.map(note => <article key={note.id} style={{ display: "grid", gap: 6, padding: "14px 16px", background: "white", border: "1px solid #dbe2ec", borderRadius: 6 }}>
      <strong>{note.createdAt.slice(0, 10)} · <Link href={`/app/work-orders/${encodeURIComponent(note.workOrderId)}`}>Job</Link></strong>
      {note.symptoms ? <p style={{ margin: 0 }}><b>Symptoms:</b> {note.symptoms}</p> : null}
      {note.readings.length ? <p style={{ margin: 0 }}><b>Readings:</b> {note.readings.join("; ")}</p> : null}
      {note.tried.length ? <ul style={{ margin: 0, paddingLeft: 20 }}>{note.tried.map((t, i) => <li key={i}>{t.action}: <b>{resultLabel[t.result]}</b>{t.detail ? ` (${t.detail})` : ""}</li>)}</ul> : null}
      {note.fixedBy ? <p style={{ margin: 0 }}><b>Fixed by:</b> {note.fixedBy}</p> : null}
      {note.parts.length ? <p style={{ margin: 0 }}><b>Parts:</b> {note.parts.join("; ")}</p> : null}
      {note.stillOpen ? <p style={{ margin: 0 }}><b>Still open:</b> {note.stillOpen}</p> : null}
      {note.other ? <p style={{ margin: 0 }}><b>Other:</b> {note.other}</p> : null}
    </article>)}
  </section>;
}
