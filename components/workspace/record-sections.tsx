"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight, CircleDot, Clock3, FileSearch } from "lucide-react";
import type { DetailSectionViewModel, TableViewModel, Tone } from "@/components/ops/data-contract";
import styles from "./record-sections.module.css";

const toneClass: Record<Tone, string> = {
  neutral: styles.neutral,
  positive: styles.positive,
  warning: styles.warning,
  critical: styles.critical,
  info: styles.info,
};

function DataTable({ table }: { table: TableViewModel }) {
  if (!table.rows.length) return <div className={styles.empty}><FileSearch aria-hidden="true" size={20} /><p>Nothing has been added here yet.</p></div>;
  return (
    <div className={styles.tableFrame}>
      <table>
        <caption>{table.caption}</caption>
        <thead><tr>{table.columns.map((column) => <th data-align={column.align ?? "start"} key={column.key}>{column.label}</th>)}<th><span className={styles.visuallyHidden}>Open</span></th></tr></thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {table.columns.map((column, index) => {
                const cell = row.cells.find((candidate) => candidate.key === column.key);
                const value = <><strong className={cell?.tone ? toneClass[cell.tone] : undefined}>{cell?.value ?? "—"}</strong>{cell?.secondary ? <small>{cell.secondary}</small> : null}</>;
                return <td data-align={column.align ?? "start"} key={column.key}>{(cell?.link || index === 0) ? <Link href={cell?.link?.href ?? row.href}>{value}</Link> : value}</td>;
              })}
              <td><Link className={styles.rowAction} href={row.href} aria-label={`Open ${row.label}`}><ChevronRight aria-hidden="true" size={16} /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionContent({ section }: { section: DetailSectionViewModel }) {
  return (
    <section className={styles.section} aria-labelledby={`record-section-${section.id}`}>
      <header className={styles.sectionHeader}>
        <div><p>Details</p><h2 id={`record-section-${section.id}`}>{section.title}</h2>{section.description ? <span>{section.description}</span> : null}</div>
        {section.action ? <Link href={section.action.href}>{section.action.label}<ArrowRight aria-hidden="true" size={15} /></Link> : null}
      </header>
      {section.facts?.length ? (
        <dl className={styles.factGrid}>
          {section.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.link ? <Link href={fact.link.href}><strong>{fact.value}</strong><ChevronRight aria-hidden="true" size={15} /></Link> : <strong>{fact.value}</strong>}{fact.helperText ? <small>{fact.helperText}</small> : null}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {section.table ? <>{section.tableHeading ? <h3 className={styles.contentHeading}>{section.tableHeading}</h3> : null}<DataTable table={section.table} /></> : null}
      {section.timeline?.length ? (
        <>{section.timelineHeading ? <h3 className={styles.contentHeading}>{section.timelineHeading}</h3> : null}<ol className={styles.timeline}>
          {section.timeline.map((event) => (
            <li key={event.id}>
              <span className={`${styles.timelineDot} ${toneClass[event.tone ?? "neutral"]}`} aria-hidden="true" />
              <div><header><strong>{event.title}</strong><time>{event.timestampLabel}</time></header>{event.description ? <p>{event.description}</p> : null}<footer><span>{event.actorLabel}</span>{event.link ? <Link href={event.link.href}>{event.link.label}<ChevronRight aria-hidden="true" size={14} /></Link> : null}</footer></div>
            </li>
          ))}
        </ol></>
      ) : null}
      {!section.facts?.length && !section.table && !section.timeline?.length ? <div className={styles.empty}><FileSearch aria-hidden="true" size={20} /><p>No information has been recorded in this section yet.</p></div> : null}
    </section>
  );
}

function SectionCard({ section, onOpen }: { section: DetailSectionViewModel; onOpen: () => void }) {
  const sourceCount = section.table?.rows.length ?? section.timeline?.length ?? section.facts?.length ?? 0;
  const preview = section.facts?.slice(0, 2) ?? [];
  return (
    <button className={styles.sectionCard} type="button" onClick={onOpen}>
      <span className={styles.cardHeading}><span><CheckCircle2 aria-hidden="true" size={17} /></span><strong>{section.title}</strong></span>
      {section.description ? <p>{section.description}</p> : null}
      {preview.length ? <dl>{preview.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : <small>{sourceCount} record{sourceCount === 1 ? "" : "s"}</small>}
      <em>Open details<ChevronRight aria-hidden="true" size={15} /></em>
    </button>
  );
}

export function RecordSections({ sections, initialSection = "overview" }: { sections: DetailSectionViewModel[]; initialSection?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const validInitialSection = sections.some((section) => section.id === initialSection) ? initialSection : "overview";
  const activeId = requestedSection && sections.some((section) => section.id === requestedSection)
    ? requestedSection
    : validInitialSection;
  const active = sections.find((section) => section.id === activeId);

  const openSection = (sectionId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sectionId === validInitialSection) params.delete("section");
    else params.set("section", sectionId);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!sections.length) return <div className={styles.empty}><FileSearch aria-hidden="true" size={20} /><p>No record history is available yet.</p></div>;

  return (
    <div className={styles.workspace}>
      <nav className={styles.tabs} aria-label="Record sections">
        <button aria-current={activeId === "overview" ? "page" : undefined} data-active={activeId === "overview"} onClick={() => openSection("overview")} type="button"><CircleDot aria-hidden="true" size={15} />Overview</button>
        {sections.map((section) => <button aria-current={activeId === section.id ? "page" : undefined} data-active={activeId === section.id} onClick={() => openSection(section.id)} type="button" key={section.id}>{section.title}</button>)}
      </nav>
      {active ? <SectionContent section={active} /> : (
        <section className={styles.overview} aria-labelledby="record-map-heading">
          <header><div><p>Record detail</p><h2 id="record-map-heading">Explore this record</h2><span>Open the history, source evidence, or related work you came here to review.</span></div><span><Clock3 aria-hidden="true" size={16} />Current record</span></header>
          <div className={styles.cardGrid}>{sections.map((section) => <SectionCard section={section} onOpen={() => openSection(section.id)} key={section.id} />)}</div>
        </section>
      )}
    </div>
  );
}
