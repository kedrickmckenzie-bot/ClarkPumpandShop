import Link from "next/link";
import type { ListPageViewModel, ProgramPageViewModel } from "@/components/ops/data-contract";
import type { ReportCatalogEntry } from "@/lib/ops/report-catalog";
import { productPresentation } from "@/lib/product/presentation";
import { cachedDateTimeFormat } from "@/lib/ops/intl-format-cache";
import { PrintButton } from "./print-button";
import styles from "./printable-report.module.css";

/**
 * Paper/PDF layout for a report: who it covers, the period, how it is counted, the headline numbers,
 * and every source record. Built from the same model as the live view, so the numbers always match.
 */
export function PrintableReport({ definition, model, preparedFor, preparedBy, generatedAt }: {
  definition: ReportCatalogEntry;
  model: ListPageViewModel | ProgramPageViewModel;
  preparedFor: string;
  preparedBy: string;
  generatedAt: string;
}) {
  const generated = cachedDateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(generatedAt));
  const metrics = (model.metrics ?? []).slice(0, 6);
  const breakdowns = ("breakdowns" in model ? model.breakdowns : []).filter(b => b.segments.length).slice(0, 2);
  const table = model.table;
  return (
    <div className={styles.report}>
      <div className={styles.toolbar}>
        <Link href="/app/reports">← Reports</Link>
        <PrintButton />
      </div>
      <article className={styles.paper}>
        <header className={styles.head}>
          <div>
            <p className={styles.brand}>{productPresentation.identity.workingName}</p>
            <h1>{definition.title}</h1>
            <p className={styles.org}>{preparedFor}</p>
          </div>
          <dl className={styles.facts}>
            <div><dt>Covers</dt><dd>{model.page.scopeLabel}</dd></div>
            <div><dt>Period</dt><dd>{model.page.periodLabel ?? model.page.updatedLabel ?? "Current records"}</dd></div>
            <div><dt>Prepared</dt><dd>{generated} · {preparedBy}</dd></div>
          </dl>
        </header>

        <section className={styles.how}>
          <h2>How this is counted</h2>
          <p>{definition.definition}</p>
        </section>

        {metrics.length ? (
          <section className={styles.metrics} aria-label="Summary">
            {metrics.map(metric => (
              <div key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                {metric.supportingText ? <small>{metric.supportingText}</small> : null}
              </div>
            ))}
          </section>
        ) : null}

        {breakdowns.map(breakdown => (
          <section key={breakdown.id} className={styles.breakdown}>
            <h2>{breakdown.title}{breakdown.totalLabel ? <span> · {breakdown.totalLabel}</span> : null}</h2>
            <table>
              <tbody>
                {breakdown.segments.slice(0, 10).map(segment => (
                  <tr key={segment.id}>
                    <th scope="row">{segment.label}</th>
                    <td>{segment.formattedValue}</td>
                    <td>{segment.shareLabel ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {breakdown.coverageLabel ? <p className={styles.note}>{breakdown.coverageLabel}</p> : null}
          </section>
        ))}

        {table ? (
          <section className={styles.records}>
            <h2>{table.caption || "Records"} <span>· {table.rows.length} {table.rows.length === 1 ? "record" : "records"}</span></h2>
            {model.pagination && model.pagination.totalPages > 1 ? <p className={styles.note}>{model.pagination.summary}. The live report lists the rest.</p> : null}
            {table.rows.length ? (
              <table>
                <thead>
                  <tr>{table.columns.map(column => <th key={column.key} scope="col" className={column.align === "end" ? styles.end : undefined}>{column.label}</th>)}</tr>
                </thead>
                <tbody>
                  {table.rows.map(row => (
                    <tr key={row.id}>
                      {table.columns.map(column => {
                        const cell = row.cells.find(candidate => candidate.key === column.key);
                        return <td key={column.key} className={column.align === "end" ? styles.end : undefined}>
                          {cell?.value ?? ""}
                          {cell?.secondary ? <small>{cell.secondary}</small> : null}
                        </td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className={styles.note}>No records in this scope and period.</p>}
          </section>
        ) : null}

        <footer className={styles.foot}>
          <p>{definition.description}</p>
          <p>Every number above comes from the records listed in this report. Open the live report to see each record in full.</p>
        </footer>
      </article>
    </div>
  );
}
