"use client";

import Link from "next/link";
import { WorkReviewButton } from "./work-review";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronRight, CircleDot, FileSearch } from "lucide-react";
import type { DetailSectionViewModel, TableViewModel, Tone } from "@/components/ops/data-contract";
import { workspaceStartHref } from "@/lib/ops/navigation-trail";
import styles from "./record-sections.module.css";

const toneClass: Record<Tone, string> = {
  neutral: styles.neutral,
  positive: styles.positive,
  warning: styles.warning,
  critical: styles.critical,
  info: styles.info,
};

function DataTable({ table }: { table: TableViewModel }) {
  if (!table.rows.length) return <div className={styles.empty}><FileSearch aria-hidden="true" size={20} /><p>No records are listed here for {table.caption.toLocaleLowerCase("en-US")}.</p></div>;
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
                return <td data-label={column.label} data-align={column.align ?? "start"} key={column.key}>{(cell?.link || index === 0) ? <Link href={workspaceStartHref(cell?.link?.href ?? row.href)}>{value}</Link> : value}</td>;
              })}
              <td className={styles.openColumn}><WorkReviewButton href={row.href} label={row.label} /><Link className={styles.rowAction} href={workspaceStartHref(row.href)} aria-label={`Open ${row.label}`}><ChevronRight aria-hidden="true" size={16} /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionContent({ section, previewHref }: { section: DetailSectionViewModel; previewHref?: string }) {
  const facts = previewHref ? section.facts?.slice(0, 4) : section.facts;
  const table = previewHref && section.table ? { ...section.table, rows: section.table.rows.slice(0, 3) } : section.table;
  const timeline = previewHref ? section.timeline?.slice(0, 2) : section.timeline;
  const available = [section.table ? `${table?.rows.length} of ${section.table.rows.length} listed records` : undefined, section.timeline?.length ? `${timeline?.length} of ${section.timeline.length} recorded updates` : undefined].filter(Boolean).join(" · ");
  return (
    <section className={styles.section} id={section.id} aria-labelledby={`record-section-${section.id}`}>
      <header className={styles.sectionHeader}>
        <div><h2 id={`record-section-${section.id}`}>{section.title}</h2>{section.description ? <span>{section.description}</span> : null}</div>
        {section.action ? <Link href={workspaceStartHref(section.action.href)}>{section.action.label}<ArrowRight aria-hidden="true" size={15} /></Link> : null}
      </header>
      {facts?.length ? (
        <dl className={styles.factGrid}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.link ? <><Link href={workspaceStartHref(fact.link.href)}><strong>{fact.value}</strong><ChevronRight aria-hidden="true" size={15} /></Link><WorkReviewButton href={fact.link.href} label={fact.value} /></> : <strong>{fact.value}</strong>}{fact.helperText ? <small>{fact.helperText}</small> : null}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {table ? <>{section.tableHeading ? <h3 className={styles.contentHeading}>{section.tableHeading}{previewHref ? " · Preview" : ""}</h3> : null}<DataTable table={table} /></> : null}
      {timeline?.length ? (
        <>{section.timelineHeading ? <h3 className={styles.contentHeading}>{section.timelineHeading}</h3> : null}<ol className={styles.timeline}>
          {timeline.map((event) => (
            <li key={event.id}>
              <span className={`${styles.timelineDot} ${toneClass[event.tone ?? "neutral"]}`} aria-hidden="true" />
              <div><header><strong>{event.title}</strong><time>{event.timestampLabel}</time></header>{event.description ? <p>{event.description}</p> : null}<footer><span>{event.actorLabel}</span>{event.link ? <Link href={workspaceStartHref(event.link.href)}>{event.link.label}<ChevronRight aria-hidden="true" size={14} /></Link> : null}</footer></div>
            </li>
          ))}
        </ol></>
      ) : null}
      {!section.facts?.length && !section.table && !section.timeline?.length ? <div className={styles.empty}><FileSearch aria-hidden="true" size={20} /><p>No information has been recorded in this section yet.</p></div> : null}
      {previewHref ? <footer className={styles.previewFooter}><span>{available ? `${available} · preview above` : "Recorded details"}</span><Link href={previewHref}>Review {section.title.toLocaleLowerCase("en-US")}<ArrowRight aria-hidden="true" size={15} /></Link></footer> : null}
    </section>
  );
}

export function RecordSections({ sections, initialSection = "overview" }: { sections: DetailSectionViewModel[]; initialSection?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const validInitialSection = sections.some((section) => section.id === initialSection) ? initialSection : "overview";
  const activeId = requestedSection && sections.some((section) => section.id === requestedSection)
    ? requestedSection
    : validInitialSection;
  const active = sections.find((section) => section.id === activeId);
  const tabs = useRef<HTMLElement>(null);
  useEffect(() => {
    const current = tabs.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (current && tabs.current) tabs.current.scrollLeft = current.offsetLeft - tabs.current.offsetLeft;
  }, [activeId]);

  const sectionHref = (sectionId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sectionId === validInitialSection) params.delete("section");
    else params.set("section", sectionId);
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}#record-review-start`;
  };

  if (!sections.length) return <div className={styles.empty}><FileSearch aria-hidden="true" size={20} /><p>No record history is available yet.</p></div>;

  return (
    <div className={styles.workspace} id="record-review-start">
      <nav className={styles.tabs} aria-label="Record sections" ref={tabs}>
        <Link aria-current={activeId === "overview" ? "page" : undefined} data-active={activeId === "overview"} href={sectionHref("overview")}><CircleDot aria-hidden="true" size={15} />Overview</Link>
        {sections.map((section) => <Link aria-current={activeId === section.id ? "page" : undefined} data-active={activeId === section.id} href={sectionHref(section.id)} key={section.id}>{section.title}</Link>)}
      </nav>
      {active ? <SectionContent section={active} /> : (
        <div className={styles.review} aria-label="Record evidence overview">
          <header><h2>Review this record</h2><p>Facts, history, and connected records. Each section shows a preview of the available information.</p></header>
          {sections.map((section) => <SectionContent section={section} previewHref={sectionHref(section.id)} key={section.id} />)}
        </div>
      )}
    </div>
  );
}
