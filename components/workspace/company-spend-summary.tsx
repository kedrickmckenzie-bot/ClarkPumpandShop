import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BreakdownViewModel } from "@/components/ops/data-contract";
import styles from "./control-tower.module.css";

export function CompanySpendSummary({ breakdowns }: { breakdowns: BreakdownViewModel[] }) {
  if (!breakdowns.length) return null;
  return (
    <section className={styles.section} aria-labelledby="spend-focus-heading">
      <header className={styles.sectionHeader}>
        <div><h2 id="spend-focus-heading">Where maintenance dollars go</h2><p>Recorded work cost · last 12 months</p></div>
        <strong className={styles.spendTotal}>{breakdowns[0].totalLabel}</strong>
      </header>
      <div className={styles.spendGrid}>
        {breakdowns.map(breakdown => {
          const maximum = Math.max(1, ...breakdown.segments.map(segment => segment.value));
          const isStore = breakdown.id === "recorded-cost-by-store";
          return (
            <div className={styles.spendPanel} key={breakdown.id}>
              <h3>{isStore ? "Highest-cost stores" : "By service area"}</h3>
              <div className={styles.spendRanking}>
                {breakdown.segments.length && breakdown.totalValue ? breakdown.segments.map(segment => (
                  <Link className={styles.spendRow} href={segment.link.href} key={segment.id}>
                    <span className={styles.spendRowHeading}><strong>{segment.label}</strong><span>{segment.formattedValue}</span></span>
                    <span className={styles.spendRowDetail}><span className={styles.barTrack} aria-hidden="true"><span style={{width:`${Math.max(0, segment.value) / maximum * 100}%`}} /></span><small>{segment.shareLabel}</small></span>
                  </Link>
                )) : <p className={styles.empty}>No recorded work cost in this period.</p>}
              </div>
              <footer className={styles.spendFooter}>
                {breakdown.coverageLabel ? <small>{breakdown.coverageLabel}</small> : null}
                <Link className={styles.textLink} href={breakdown.sourceLink.href}>{breakdown.sourceLink.label}<ArrowRight size={14} aria-hidden="true" /></Link>
              </footer>
            </div>
          );
        })}
      </div>
    </section>
  );
}
