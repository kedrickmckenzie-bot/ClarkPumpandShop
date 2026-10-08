import Link from "next/link";
import { CalendarClock, Download } from "lucide-react";
import type { ReportDoc, Section } from "@/lib/ops/reports/doc";
import { AUDIENCE_LABELS, WORK_LABELS, reportOptionsQuery } from "@/lib/ops/reports/options";
import { periodChoices } from "@/lib/ops/reports/period";
import { productPresentation } from "@/lib/product/presentation";
import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import type { ReportChoices } from "@/lib/server/report-model";
import { PrintButton } from "./print-button";
import styles from "./report-document.module.css";

/**
 * A report on screen and on paper. Reading order for a busy owner: what to look at, the headline numbers
 * with their comparisons, where the money went, then the detail. "How this is counted" closes the report.
 */
export function ReportDocument({ doc, choices, today, preparedBy, generatedAt, timeZone, built, run }: {
  doc: ReportDoc; choices: ReportChoices; today: string; preparedBy: string; generatedAt: string; built: boolean;
  /** The organization's zone, so "Prepared" shows local time. */
  timeZone: string;
  /** Set when showing a saved scheduled run. */
  run?: { label: string };
}) {
  const generated = cachedDateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(generatedAt));
  const query = reportOptionsQuery(doc.options).toString();
  const periodLabel = doc.periodLabel ?? doc.period?.label ?? "";
  const compared = doc.period ? [doc.period.prior?.label, doc.period.lastYear.label].filter(Boolean).join(" and ") : "";
  const all = doc.options.detail === "all";
  return (
    <div className={styles.report}>
      <div className={styles.toolbar}>
        <Link href="/app/reports" className={styles.back}>← Reports</Link>
        <div className={styles.actions}>
          <PrintButton />
          <a href={`/api/ops/reports/${doc.reportId}${query ? `?${query}` : ""}`}><Download size={16} aria-hidden="true" /> CSV</a>
          {built ? <Link href={`/app/reports/schedules/new?${new URLSearchParams({ report: doc.reportId, ...Object.fromEntries(reportOptionsQuery(doc.options)) })}`}><CalendarClock size={16} aria-hidden="true" /> Schedule</Link> : null}
        </div>
      </div>

      {run ? <p className={styles.runNote}>{run.label}</p> : (
        <form className={styles.options} method="get">
          {built ? <label>Period<select name="period" defaultValue={doc.options.period}>{periodChoices(today).map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label> : null}
          {built && choices.stores.length > 1 ? <label>Store<select name="store" defaultValue={doc.options.store ?? ""}><option value="">{doc.reportId === "store-report" ? "Every store, side by side" : "All stores"}</option>{choices.stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label> : null}
          {built && choices.regions.length > 1 ? <label>Area<select name="region" defaultValue={doc.options.region ?? ""}><option value="">All areas</option>{choices.regions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label> : null}
          {built && doc.audience === "both" ? <label>Who did the work<select name="work" defaultValue={doc.options.work}>{(["both", "vendor", "in_house"] as const).map(w => <option key={w} value={w}>{WORK_LABELS[w]}</option>)}</select></label> : null}
          {doc.reportId === "vendor-ap" ? <label>Vendor<select name="vendor" defaultValue={doc.options.vendor ?? ""}><option value="">All vendors</option>{choices.vendors.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></label> : null}
          <fieldset><legend>Show</legend>
            <label className={styles.radio}><input type="radio" name="detail" value="summary" defaultChecked={!all} /> Summary</label>
            <label className={styles.radio}><input type="radio" name="detail" value="all" defaultChecked={all} /> Every record</label>
          </fieldset>
          <button type="submit">Update</button>
        </form>
      )}

      <article className={styles.paper}>
        <header className={styles.head}>
          <div>
            <p className={styles.brand}>{productPresentation.identity.workingName} · {AUDIENCE_LABELS[doc.audience]}</p>
            <h1>{doc.title}</h1>
            <p className={styles.org}>{doc.organizationName}</p>
          </div>
          <dl className={styles.facts}>
            <div><dt>Period</dt><dd>{periodLabel}</dd></div>
            {compared ? <div><dt>Compared</dt><dd>{compared}</dd></div> : null}
            <div><dt>Covers</dt><dd>{doc.scopeLabel}</dd></div>
            <div><dt>Prepared</dt><dd>{generated} · {preparedBy}</dd></div>
            <div><dt>Shows</dt><dd>{all ? "Every record" : "Summary"}</dd></div>
          </dl>
        </header>
        <p className={styles.purpose}>{doc.purpose}</p>

        {doc.highlights.length ? (
          <section className={styles.highlights} aria-label="What to look at">
            <h2>What to look at</h2>
            <ul>{doc.highlights.map(h => <li key={h}>{h}</li>)}</ul>
          </section>
        ) : null}

        {doc.kpis.length ? (
          <section className={styles.kpis} aria-label="Headline numbers">
            {doc.kpis.map(k => (
              <div key={k.label}>
                <span>{k.label}</span>
                <strong>{k.value}</strong>
                {k.changes?.map(c => <small key={c.text} className={styles[c.tone]}>{c.tone === "good" ? "▼ " : c.tone === "bad" ? "▲ " : ""}{c.text}</small>)}
                {k.note ? <small>{k.note}</small> : null}
              </div>
            ))}
          </section>
        ) : null}

        {doc.sections.map(section => <ReportSection key={section.id} section={section} />)}

        <section className={styles.how}>
          <h2>How this is counted</h2>
          <ul>{doc.howCounted.map(line => <li key={line}>{line}</li>)}</ul>
        </section>
        <footer className={styles.foot}>
          {(doc.notes ?? []).map(n => <p key={n}>{n}</p>)}
          <p>Every number comes from recorded work orders, visits, costs and invoices. Open the report in {productPresentation.identity.workingName} to see any record in full.</p>
        </footer>
      </article>
    </div>
  );
}

/** Work order numbers and dates read badly when they wrap. */
const NOWRAP = new Set(["number", "done", "date", "due", "last", "opened"]);

function ReportSection({ section }: { section: Section }) {
  if (section.kind === "split") {
    const total = section.parts.reduce((s, p) => s + p.value, 0) || 1;
    return (
      <section className={`${styles.section} ${styles.keep}`}>
        <h2>{section.title}</h2>
        <div className={styles.split}>
          {section.parts.map(part => (
            <div key={part.label} className={styles[`part_${part.tone}`]}>
              <span>{part.label}</span>
              <strong>{part.display}</strong>
              <div className={styles.share}><i style={{ width: `${Math.round(part.value / total * 100)}%` }} /></div>
              <small>{Math.round(part.value / total * 100)}% of spend</small>
              <ul>{part.facts.map(f => <li key={f}>{f}</li>)}</ul>
            </div>
          ))}
        </div>
        {section.note ? <p className={styles.note}>{section.note}</p> : null}
      </section>
    );
  }
  if (section.kind === "bars") {
    // "Other N stores" is a sum, so it never sets the scale and draws in grey.
    const max = Math.max(1, ...section.items.filter(i => !i.other).map(i => i.value));
    return (
      <section className={`${styles.section} ${section.items.length <= 16 ? styles.keep : ""}`}>
        <h2>{section.title}</h2>
        {section.items.length ? (
          <ol className={styles.bars}>
            {section.items.map(item => (
              <li key={item.label}>
                <span className={styles.barLabel}>{item.href ? <Link href={item.href}>{item.label}</Link> : item.label}</span>
                <span className={`${styles.barTrack} ${item.other ? styles.otherBar : ""}`}><i style={{ width: `${Math.min(100, Math.max(1, Math.round(item.value / max * 100)))}%` }} /></span>
                <strong>{item.display}</strong>
                {item.extra ? <small>{item.extra}</small> : <small />}
              </li>
            ))}
          </ol>
        ) : <p className={styles.note}>{section.empty}</p>}
        {section.note ? <p className={styles.note}>{section.note}</p> : null}
      </section>
    );
  }
  return (
    <section className={styles.section}>
      <h2>{section.title} {section.rows.length ? <span>· {section.rows.length} {section.rows.length === 1 ? "row" : "rows"}</span> : null}</h2>
      {section.note ? <p className={styles.note}>{section.note}</p> : null}
      {section.rows.length ? (
        <div className={styles.tableWrap}>
          <table>
            <thead><tr>{section.columns.map(c => <th key={c.key} scope="col" className={[c.align === "end" ? styles.end : "", c.width === "wide" ? styles.wide : ""].join(" ")}>{c.label}</th>)}</tr></thead>
            <tbody>
              {section.rows.flatMap((row, index) => {
                const header = row.group && row.group !== section.rows[index - 1]?.group ? <tr key={`g-${row.group}`} className={styles.groupRow}><th colSpan={section.columns.length} scope="colgroup">{row.group}</th></tr> : null;
                const line = (
                  <tr key={row.id} className={row.tone === "warn" ? styles.warn : row.tone === "muted" ? styles.muted : undefined}>
                    {section.columns.map((c, i) => (
                      <td key={c.key} className={c.align === "end" ? styles.end : NOWRAP.has(c.key) ? styles.nowrap : undefined}>
                        {i === 0 && row.href ? <Link href={row.href}>{row.cells[c.key] ?? ""}</Link> : row.cells[c.key] ?? ""}
                        {row.sub?.[c.key] ? <small>{row.sub[c.key]}</small> : null}
                      </td>
                    ))}
                  </tr>
                );
                return header ? [header, line] : [line];
              })}
            </tbody>
            {section.totals ? <tfoot><tr>{section.columns.map(c => <td key={c.key} className={c.align === "end" ? styles.end : undefined}>{section.totals?.[c.key] ?? ""}</td>)}</tr></tfoot> : null}
          </table>
        </div>
      ) : <p className={styles.note}>{section.empty ?? "Nothing to show."}</p>}
      {section.more ? <p className={styles.note}>{section.more}</p> : null}
    </section>
  );
}

