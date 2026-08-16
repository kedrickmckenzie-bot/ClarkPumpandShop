import Link from "next/link";
import {
  ArrowRight,
  Database,
  Download,
  FileBarChart2,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import type { ListPageViewModel } from "@/components/ops/data-contract";
import { DataStatePanel } from "@/components/ops/views";
import { reportCatalogEntry } from "@/lib/ops/report-catalog";
import styles from "./reporting-center.module.css";

function cell(model: ListPageViewModel, rowId: string, key: string) {
  return model.table.rows.find((row) => row.id === rowId)?.cells.find((item) => item.key === key);
}

export function ReportingCenter({ model }: { model: ListPageViewModel }) {
  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <div><p>{model.page.eyebrow}</p><h1>{model.page.title}</h1><span>{model.page.description}</span></div>
      </header>
      <div className={styles.context} aria-label="Current reporting context">
        <span><Layers3 size={16} aria-hidden="true" /><small>Scope</small><strong>{model.page.scopeLabel}</strong></span>
        <span><Database size={16} aria-hidden="true" /><small>Basis</small><strong>Persisted source records</strong></span>
        <span><ShieldCheck size={16} aria-hidden="true" /><small>Governance</small><strong>Definitions travel with every export</strong></span>
      </div>
      {model.state.kind !== "ready" ? <DataStatePanel state={model.state} /> : (
        <>
          <section className={styles.intro}>
            <span><FileBarChart2 size={21} aria-hidden="true" /></span>
            <div><small>Management reporting</small><strong>Start with a governed live view, then export the exact supporting rows.</strong><p>Each report preserves a plain-language definition and opens the operational workspace behind it. CSV exports are generated from the same scoped presenter rows shown in the application.</p></div>
          </section>
          <section className={styles.grid} aria-label="Available management reports">
            {model.table.rows.map((row) => {
              const definition = reportCatalogEntry(row.id);
              const report = cell(model, row.id, "report");
              const scope = cell(model, row.id, "scope");
              const period = cell(model, row.id, "period");
              const basis = cell(model, row.id, "basis");
              return (
                <article key={row.id}>
                  <header><span><FileBarChart2 size={18} aria-hidden="true" /></span><div><small>Live report</small><h2>{report?.value ?? row.label}</h2></div></header>
                  <p>{definition?.description ?? basis?.value}</p>
                  <dl>
                    <div><dt>Scope</dt><dd>{scope?.value ?? model.page.scopeLabel}</dd></div>
                    <div><dt>Period</dt><dd>{period?.value ?? "Current source view"}</dd></div>
                    <div><dt>Definition</dt><dd>{basis?.value ?? definition?.definition}</dd></div>
                    <div><dt>Source</dt><dd>{report?.secondary ?? "Scoped operational records"}</dd></div>
                  </dl>
                  <footer>
                    <Link href={row.href}>Open live view<ArrowRight size={14} aria-hidden="true" /></Link>
                    {definition ? <a href={`/api/ops/reports/${definition.id}`}>Export CSV<Download size={14} aria-hidden="true" /></a> : null}
                  </footer>
                </article>
              );
            })}
          </section>
          <section className={styles.controlNote}>
            <ShieldCheck size={19} aria-hidden="true" />
            <div><strong>Financial bases remain separate.</strong><p>Recorded work cost, approved amount, vendor proposals, linked invoice amount, and unmatched invoice amount are never blended into one unexplained number.</p></div>
          </section>
        </>
      )}
    </main>
  );
}
