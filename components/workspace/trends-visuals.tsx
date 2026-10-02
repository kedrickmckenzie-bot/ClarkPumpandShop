import Link from "next/link";
import type { TrendBridgeViewModel, TrendHeatmapViewModel } from "@/components/ops/data-contract";
import styles from "./trends-visuals.module.css";

/**
 * "What changed": the earlier total, each biggest change stacked on it, then the
 * selected total. Bars start at zero so a change is never exaggerated; every bar
 * opens the records behind it.
 */
export function ChangeBridge({ bridge, metricLabel }: { bridge: TrendBridgeViewModel; metricLabel: string }) {
  // Each step starts where the previous one ended.
  const steps = bridge.steps.map((step, index) => {
    const from = bridge.startValue + bridge.steps.slice(0, index).reduce((sum, earlier) => sum + earlier.value, 0);
    const to = from + step.value;
    return { ...step, low: Math.min(from, to), high: Math.max(from, to) };
  });
  const top = Math.max(bridge.startValue, bridge.endValue, ...steps.map((step) => step.high)) * 1.08 || 1;
  const pct = (value: number) => `${Math.max(0, Math.min(100, (value / top) * 100))}%`;
  const change = bridge.endValue - bridge.startValue;
  const columns = [
    { id: "start", label: bridge.startLabel, low: 0, high: bridge.startValue, formatted: bridge.startFormatted, kind: "total", link: bridge.startLink },
    ...steps.map((step) => ({ id: step.id, label: step.label, low: step.low, high: step.high, formatted: step.formatted, kind: step.value >= 0 ? "up" : "down", link: step.link })),
    { id: "end", label: bridge.endLabel, low: 0, high: bridge.endValue, formatted: bridge.endFormatted, kind: "end", link: bridge.endLink },
  ];
  return <section className={styles.panel} aria-labelledby="bridge-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>What changed</p><h2 id="bridge-title">{metricLabel}: {bridge.startFormatted} → {bridge.endFormatted}</h2>
        <p className={styles.lede}><strong className={change >= 0 ? styles.upText : styles.downText}>{change >= 0 ? "Up" : "Down"} {bridge.changeFormatted}</strong> · biggest changes first. Each bar opens the records behind it.</p></div>
      <ul className={styles.key} aria-label="Key"><li><i className={styles.keyUp} aria-hidden="true" />Spending up</li><li><i className={styles.keyDown} aria-hidden="true" />Spending down</li><li><i className={styles.keyTotal} aria-hidden="true" />Period total</li></ul>
    </header>
    <ol className={styles.bridge} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(64px, 1fr))` }}>
      {columns.map((column) => <li key={column.id}>
        <Link href={column.link.href} className={styles.column} aria-label={`${column.label}: ${column.formatted}. ${column.link.label}`} title={`${column.label}: ${column.formatted}`}>
          <span className={styles.plot}>
            <span className={`${styles.bar} ${styles[column.kind]}`} style={{ bottom: pct(column.low), height: `max(3px, calc(${pct(column.high)} - ${pct(column.low)}))` }}>
              <b className={styles.value}>{column.formatted}</b>
            </span>
          </span>
          <span className={styles.label}>{column.label}</span>
        </Link>
      </li>)}
    </ol>
    <p className={styles.note}>Changes are differences in {metricLabel.toLowerCase()} between the two periods. They add up exactly to the change in the total.</p>
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
        <p className={styles.lede}>Darker cells cost more. Select a cell to open exactly those records.</p></div>
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
