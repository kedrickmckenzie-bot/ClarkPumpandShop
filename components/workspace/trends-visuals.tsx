import Link from "next/link";
import type { TrendBridgeViewModel, TrendHeatmapViewModel, TrendStoryViewModel } from "@/components/ops/data-contract";
import styles from "./trends-visuals.module.css";

/** The short answer: a few plain sentences, each opening the records behind it. */
export function TrendStory({ story }: { story: TrendStoryViewModel }) {
  if (!story.sentences.length) return null;
  return <section className={`${styles.panel} ${styles.story}`} aria-labelledby="story-title">
    <p className={styles.eyebrow} id="story-title">The short answer</p>
    <ul className={styles.storyList}>
      {story.sentences.map((sentence) => <li key={sentence.id}><span>{sentence.text}</span>{sentence.link ? <Link href={sentence.link.href}>{sentence.link.label} →</Link> : null}</li>)}
    </ul>
  </section>;
}

/**
 * "Where the change came from": one row per biggest mover plus "All other",
 * as bars growing right (increase) or left (decrease) from a shared zero line.
 * Rows add up exactly to the change in the total; every row opens its records.
 */
export function ChangeBridge({ bridge, metricLabel }: { bridge: TrendBridgeViewModel; metricLabel: string }) {
  const change = bridge.endValue - bridge.startValue;
  const largest = Math.max(1, ...bridge.steps.map((step) => Math.abs(step.value)));
  // The zero line sits in the middle only when changes go both ways; otherwise bars use the full width.
  const mixed = bridge.steps.some((step) => step.value > 0) && bridge.steps.some((step) => step.value < 0);
  const zero = mixed ? "middle" : bridge.steps.some((step) => step.value < 0) ? "right" : "left";
  const width = (value: number) => `${(Math.abs(value) / largest) * (mixed ? 50 : 100)}%`;
  return <section className={styles.panel} aria-labelledby="bridge-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Where the change came from</p><h2 id="bridge-title">{metricLabel}: <Link href={bridge.startLink.href}>{bridge.startFormatted}</Link> → <Link href={bridge.endLink.href}>{bridge.endFormatted}</Link></h2>
        <p className={styles.lede}><strong className={change >= 0 ? styles.upText : styles.downText}>{change >= 0 ? "Up" : "Down"} {bridge.changeFormatted}</strong> · {bridge.startLabel.toLowerCase()} → {bridge.endLabel.toLowerCase()}. Biggest changes first; select a row to open its records.</p></div>
      <ul className={styles.key} aria-label="Key"><li><i className={styles.keyUp} aria-hidden="true" />Increase</li><li><i className={styles.keyDown} aria-hidden="true" />Decrease</li></ul>
    </header>
    <ol className={styles.changeRows}>
      {bridge.steps.map((step) => <li key={step.id}>
        <Link href={step.link.href} className={styles.changeRow} aria-label={`${step.label}: ${step.formatted}. ${step.link.label}`} title={`${step.label}: ${step.formatted}`}>
          <span className={styles.changeLabel}>{step.label}</span>
          <span className={styles.changeTrack} data-zero={zero} aria-hidden="true">
            <i className={step.value >= 0 ? styles.changeUp : styles.changeDown} style={{ width: width(step.value) }} />
          </span>
          <b className={step.value >= 0 ? styles.upText : styles.downText}>{step.formatted}</b>
        </Link>
      </li>)}
    </ol>
    <p className={styles.note}>The rows add up exactly to the change in the total.</p>
  </section>;
}

/** Sequential blue, light → dark, for magnitude. */
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
function shade(value: number, max: number) {
  if (value <= 0 || max <= 0) return undefined;
  return RAMP[Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length))];
}

/** Every store (or breakdown) by month in one grid; darker cells cost more. Each cell opens its records. */
export function SpendHeatmap({ heatmap, metricLabel }: { heatmap: TrendHeatmapViewModel; metricLabel: string }) {
  return <section className={styles.panel} aria-labelledby="heatmap-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Where and when</p><h2 id="heatmap-title">{metricLabel} by {heatmap.noun.replace(/s$/, "")} and month</h2>
        <p className={styles.lede}>Darker means more. Select a cell to open exactly those records.</p></div>
      <div className={styles.scale} aria-label="Color scale"><span>Less</span>{RAMP.map((color) => <i key={color} style={{ background: color }} aria-hidden="true" />)}<span>More</span></div>
    </header>
    <div className={styles.gridScroll}>
      <table className={styles.heatmap}>
        <caption className={styles.hidden}>{metricLabel} by {heatmap.noun} and month</caption>
        <thead><tr><th scope="col">{heatmap.noun[0].toUpperCase() + heatmap.noun.slice(1, -1)}</th>{heatmap.months.map((month) => <th scope="col" key={month.key}>{month.label}</th>)}<th scope="col">Total</th></tr></thead>
        <tbody>{heatmap.rows.map((row) => <tr key={row.id}>
          <th scope="row">{row.label}</th>
          {row.cells.map((cell) => {
            const month = heatmap.months.find((candidate) => candidate.key === cell.month)?.label ?? cell.month;
            const color = shade(cell.value, heatmap.max);
            const dark = color && RAMP.indexOf(color) >= 3;
            return <td key={cell.month}>{cell.count
              ? <Link href={cell.href} className={styles.cell} style={{ background: color }} data-dark={dark || undefined} title={`${row.label} · ${month}: ${cell.formatted} · ${cell.count} record${cell.count === 1 ? "" : "s"}`} aria-label={`${row.label}, ${month}: ${cell.formatted}, ${cell.count} record${cell.count === 1 ? "" : "s"}`}>{cell.formatted}</Link>
              : <span className={`${styles.cell} ${styles.empty}`} aria-label={`${row.label}, ${month}: none`}>—</span>}</td>;
          })}
          <td className={styles.total}>{row.totalFormatted}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className={styles.note}>{heatmap.totalRows > heatmap.rows.length ? <>Showing the {heatmap.rows.length} highest of {heatmap.totalRows} {heatmap.noun}. <Link href={heatmap.allLink.href}>{heatmap.allLink.label} →</Link></> : <>All {heatmap.totalRows} {heatmap.noun} shown.</>}</p>
  </section>;
}
