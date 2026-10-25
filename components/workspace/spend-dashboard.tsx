import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Inbox, X } from "lucide-react";
import type { FilterOptionViewModel } from "@/components/ops/data-contract";
import { PaginationControls } from "@/components/ops/pagination-controls";
import { StoreJump } from "@/components/ops/store-jump";
import type { buildSpendDashboard, buildSpendEquipment, buildSpendStores, buildSpendVendors, SpendGridModel, SpendScope, SpendSegment } from "@/app/app/_data/spend-dashboard";
import styles from "./spend-dashboard.module.css";

/** Sequential blue, light → dark: darker squares cost more. */
const RAMP = ["#e3edfb", "#c3d8f6", "#9cbfee", "#6fa1e4", "#3f7fd6", "#245fb3", "#163f80"];
const shade = (value: number, max: number) => value > 0 ? RAMP[Math.min(RAMP.length - 1, Math.floor(value / max * RAMP.length))] : undefined;

function Segments({ label, options }: { label: string; options: FilterOptionViewModel[] }) {
  return <nav className={styles.segments} aria-label={label}>{options.map(option => <Link key={option.value} href={option.href} aria-current={option.selected ? "page" : undefined}>{option.label}</Link>)}</nav>;
}

function Pick({ label, options }: { label: string; options: FilterOptionViewModel[] }) {
  if (options.length < 2) return null;
  const chosen = options.find(option => option.selected) ?? options[0];
  return <details className={styles.pick}><summary><small>{label}</small><strong>{chosen.label}</strong><ChevronDown size={15} aria-hidden="true" /></summary>
    <div>{options.map(option => <Link key={option.value} href={option.href} aria-current={option.selected ? "true" : undefined}>{option.label}</Link>)}</div></details>;
}

/** Title, back link, the one-line scope and the filters every Spending page shares. */
export function SpendFrame({ scope, title, subtitle, back = true, action, children }: { scope: SpendScope; title: string; subtitle: string; back?: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.page}>
      {back ? <Link className={styles.back} href={scope.href("/app/spend")}><ArrowLeft size={15} aria-hidden="true" />Spending</Link> : null}
      <header className={styles.header}>
        <div><h1>{title}</h1><p>{subtitle} · {scope.scopeLabel} · through {new Date(`${scope.through}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</p></div>
        {action}
      </header>
      <section className={styles.controls} aria-label="What to show">
        <Segments label="Period" options={scope.controls.periods} />
        <StoreJump always />
        <Pick label="Region" options={scope.controls.regions} />
        <Pick label="Service area" options={scope.controls.areas} />
      </section>
      {scope.chips.length ? <div className={styles.chips}>{scope.chips.map(chip => <Link key={chip.label} href={chip.removeHref} aria-label={`Remove ${chip.label}`}>{chip.label}<X size={14} aria-hidden="true" /></Link>)}</div> : null}
      {children}
    </div>
  );
}

function Card({ title, href, linkLabel, children, wide = false }: { title: string; href: string; linkLabel: string; children: ReactNode; wide?: boolean }) {
  return <section className={`${styles.card} ${wide ? styles.wide : ""}`} aria-label={title}>
    <header><h2>{title}</h2><Link href={href}>{linkLabel}<ArrowRight size={14} aria-hidden="true" /></Link></header>
    {children}
  </section>;
}

function Empty({ children = "No costs in this view." }: { children?: ReactNode }) {
  return <p className={styles.empty}><Inbox size={18} aria-hidden="true" />{children}</p>;
}

/** Stores × service areas (or vendors); darker squares cost more and every square opens exactly those costs. */
export function SpendGrid({ grid, firstColumn }: { grid: SpendGridModel; firstColumn: string }) {
  if (!grid.rows.length) return <Empty />;
  return (
    <div className={styles.gridScroll}>
      <table className={styles.grid}>
        <caption className={styles.hidden}>Cost by {firstColumn.toLowerCase()} and {grid.columns.map(column => column.label).join(", ")}</caption>
        <thead><tr><th scope="col">{firstColumn}</th>{grid.columns.map(column => <th scope="col" key={column.key}><Link href={column.href}>{column.label}</Link></th>)}<th scope="col">Total</th></tr></thead>
        <tbody>
          {grid.rows.map(row => <tr key={row.id}>
            <th scope="row"><Link href={row.href}><strong>{row.label}</strong>{row.secondary ? <small>{row.secondary}</small> : null}</Link></th>
            {row.cells.map(cell => { const color = shade(cell.amount, grid.max); return <td key={cell.key}>{cell.amount
              ? <Link href={cell.href} className={styles.cell} style={{ background: color }} data-dark={color && RAMP.indexOf(color) >= 4 || undefined} title={`${row.label} · ${grid.columns.find(column => column.key === cell.key)?.label}: ${cell.label}`}>{cell.label}</Link>
              : <span className={`${styles.cell} ${styles.none}`}>—</span>}</td>; })}
            <td className={styles.total}>{row.total}</td>
          </tr>)}
        </tbody>
        <tfoot>
          {grid.average ? <tr className={styles.average}><th scope="row">{grid.average.label}</th>{grid.average.cells.map((value, index) => <td key={index}>{value}</td>)}<td className={styles.total}>{grid.average.total}</td></tr> : null}
          <tr><th scope="row">All stores shown</th>{grid.totals.map((value, index) => <td key={index}>{value}</td>)}<td className={styles.total}>{grid.grandTotal}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Share of spending as a ring; each slice opens its costs and names itself on hover. */
function Donut({ segments, total }: { segments: SpendSegment[]; total: string }) {
  const sum = segments.reduce((value, segment) => value + segment.amount, 0) || 1;
  const radius = 60, circumference = 2 * Math.PI * radius, gap = segments.length > 1 ? 2 : 0;
  const lengths = segments.map(segment => segment.amount / sum * circumference);
  const offsets = lengths.map((_, index) => lengths.slice(0, index).reduce((total, value) => total + value, 0));
  return <svg className={styles.donut} viewBox="0 0 160 160" role="img" aria-label={`Share of spending by service area: ${segments.map(segment => `${segment.label} ${segment.share}`).join(", ")}`}>
    <circle cx="80" cy="80" r={radius} fill="none" stroke="#eef1f5" strokeWidth="24" />
    {segments.map((segment, index) => {
      const dash = Math.max(0, lengths[index] - gap);
      return <a key={segment.key} href={segment.href}><circle cx="80" cy="80" r={radius} fill="none" stroke={segment.color} strokeWidth="24" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offsets[index]} transform="rotate(-90 80 80)"><title>{`${segment.label}: ${segment.amountLabel} (${segment.share})`}</title></circle></a>;
    })}
    <text x="80" y="76" textAnchor="middle" className={styles.donutValue}>{total}</text>
    <text x="80" y="96" textAnchor="middle" className={styles.donutLabel}>total</text>
  </svg>;
}

/** A bar split by service area; each piece shows its area, amount and share on hover. */
function SegmentedBar({ width, segments }: { width: number; segments: Array<{ key: string; label: string; amount: number; amountLabel: string; share: string; color: string }> }) {
  return <span className={styles.barTrack} aria-hidden="true"><span style={{ width: `${width}%` }}>{segments.map(segment => <i key={segment.key} className={styles.seg} style={{ flexGrow: segment.amount, background: segment.color }}><span className={styles.tip}><b>{segment.label}</b>{segment.amountLabel} · {segment.share}</span></i>)}</span></span>;
}

export function SpendDashboard({ model }: { model: ReturnType<typeof buildSpendDashboard> }) {
  const { scope } = model;
  const single = Boolean(scope.singleStoreId);
  return (
    <SpendFrame scope={scope} title="Spending" subtitle="Where maintenance money goes" back={false}
      action={<Link className={styles.secondary} href={scope.href("/app/spend/costs")}>All costs<ArrowRight size={15} aria-hidden="true" /></Link>}>
      <nav className={styles.metrics} aria-label="Spending at a glance">{model.metrics.map(metric => (
        <Link key={metric.id} href={metric.href} className={styles.metric}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></Link>
      ))}</nav>

      <div className={styles.cards}>
        <Card wide title={single ? "Where the money goes, by machine" : "Where the money goes"} href={scope.href("/app/spend/stores")} linkLabel={single ? "Open" : "All stores"}>
          <SpendGrid grid={model.grid} firstColumn={single ? "Machine" : "Store"} />
        </Card>

        <Card title="Service areas" href={scope.href("/app/spend/costs", { by: "area" })} linkLabel="Open">
          {model.areas.length ? <>
            <div className={styles.donutWrap}><Donut segments={model.areas} total={model.grid.grandTotal} />
            <ul className={styles.legend}>{model.areas.map(segment => <li key={segment.key}><Link href={segment.href}><i style={{ background: segment.color }} aria-hidden="true" /><span>{segment.label}</span><strong>{segment.amountLabel}</strong><small>{segment.share}</small></Link></li>)}</ul></div>
          </> : <Empty />}
        </Card>

        <Card title="Vendors" href={scope.href("/app/spend/vendors")} linkLabel="All vendors">
          {model.vendors.length ? <ul className={styles.bars}>{model.vendors.map(vendor => <li key={vendor.key}><Link href={vendor.href}>
            <span className={styles.barName}><strong>{vendor.label}</strong><small>{vendor.amountLabel} · {vendor.share}</small></span>
            <SegmentedBar width={vendor.amount / model.vendorMax * 100} segments={vendor.segments} />
          </Link></li>)}</ul> : <Empty />}
          {model.vendors.length ? <p className={styles.note}>Colors are service areas. Point at a color to see it.</p> : null}
        </Card>

        <Card wide title="Costliest equipment" href={scope.href("/app/spend/equipment")} linkLabel="All equipment">
          {model.equipment.length ? <EquipmentTable rows={model.equipment} offset={0} /> : <Empty>No costs linked to machines.</Empty>}
        </Card>
      </div>
    </SpendFrame>
  );
}

function EquipmentTable({ rows, offset }: { rows: ReturnType<typeof buildSpendEquipment>["rows"]; offset: number }) {
  return <div className={styles.tableScroll}><table className={styles.table}>
    <thead><tr><th>#</th><th>Machine</th><th>Store</th><th>Service area</th><th data-align="end">Jobs</th><th data-align="end">Cost</th><th><span className={styles.hidden}>Actions</span></th></tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.id}>
      <td className={styles.rank}>{offset + index + 1}</td>
      <td><Link href={row.href} className={styles.strongLink}>{row.name}</Link></td>
      <td>{row.store}</td><td>{row.area}</td>
      <td data-align="end">{row.jobs}</td>
      <td data-align="end"><Link href={row.costsHref}>{row.amountLabel}</Link></td>
      <td data-align="end"><Link href={row.replaceHref} className={styles.quiet}>Repair or replace</Link></td>
    </tr>)}</tbody>
  </table></div>;
}

export function SpendStoresPage({ model }: { model: ReturnType<typeof buildSpendStores> }) {
  const single = Boolean(model.scope.singleStoreId);
  return <SpendFrame scope={model.scope} title={single ? "By machine" : "By store"} subtitle="Darker squares cost more">
    <section className={styles.panel}>
      <header><Segments label="Columns" options={model.byOptions} /><span className={styles.count}>{model.grid.rowCount} {single ? "machines" : "stores"} · highest first</span></header>
      <SpendGrid grid={model.grid} firstColumn={single ? "Machine" : "Store"} />
      {model.pagination ? <PaginationControls pagination={model.pagination} label="Store pages" /> : null}
    </section>
  </SpendFrame>;
}

export function SpendVendorsPage({ model }: { model: ReturnType<typeof buildSpendVendors> }) {
  return <SpendFrame scope={model.scope} title="Vendors" subtitle="Who was paid, and for what">
    <section className={styles.panel}>
      <header><h2>Who was paid</h2><span className={styles.count}>Colors are service areas · point at a color to see it</span></header>
      {model.rows.length ? <ul className={styles.vendorRows}>{model.rows.map(row => <li key={row.key}>
        <div className={styles.vendorName}>{row.vendorHref ? <Link href={row.vendorHref} className={styles.strongLink}>{row.label}</Link> : <strong>{row.label}</strong>}<small>{row.jobs} jobs · {row.stores} {row.stores === 1 ? "store" : "stores"}</small></div>
        <Link href={row.href} className={styles.vendorBar} aria-label={`${row.label}: ${row.amountLabel}. ${row.segments.map(segment => `${segment.label} ${segment.share}`).join(", ")}`}>
          <SegmentedBar width={row.amount / model.max * 100} segments={row.segments} />
          <small>{row.segments.slice(0, 3).map(segment => `${segment.label} ${segment.share}`).join(" · ")}</small>
        </Link>
        <div className={styles.vendorAmount}><strong>{row.amountLabel}</strong><small>{row.share} of spending</small></div>
        <Link href={row.href} className={styles.quiet}>Costs<ChevronRight size={14} aria-hidden="true" /></Link>
      </li>)}</ul> : <Empty />}
      {model.pagination ? <PaginationControls pagination={model.pagination} label="Vendor pages" /> : null}
    </section>
  </SpendFrame>;
}

export function SpendEquipmentPage({ model }: { model: ReturnType<typeof buildSpendEquipment> }) {
  return <SpendFrame scope={model.scope} title="Equipment" subtitle="Machines costing the most">
    <section className={styles.panel}>
      <header><h2>{model.count} machines with cost</h2>{model.unlinked ? <span className={styles.count}>{model.unlinked} is on jobs not linked to a machine</span> : null}</header>
      {model.rows.length ? <EquipmentTable rows={model.rows} offset={model.offset} /> : <Empty>No costs linked to machines.</Empty>}
      {model.pagination ? <PaginationControls pagination={model.pagination} label="Equipment pages" /> : null}
    </section>
  </SpendFrame>;
}
