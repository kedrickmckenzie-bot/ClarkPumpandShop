import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  FileWarning,
  Gauge,
  Landmark,
  ReceiptText,
  ShieldAlert,
  Store,
  UsersRound,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PlatformBadge, PlatformPageHeader, PlatformProgress, PlatformSectionHeader, PlatformStat } from "@/components/platform-ui";
import Link from "@/components/site-link";
import { commandCenterMetrics, formatCurrency, formatPercent, isOpenWorkOrder, spendForPeriod, storeComparison } from "@/lib/domain/analytics";
import { platformData, PLATFORM_NOW } from "@/lib/platform/data";

const now = new Date(PLATFORM_NOW);
const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
const ttmStart = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1)));
}

function monthlySpend() {
  return Array.from({ length: 12 }, (_, index) => {
    const month = (now.getUTCMonth() - 11 + index + 12) % 12;
    const year = now.getUTCFullYear() - (now.getUTCMonth() - 11 + index < 0 ? 1 : 0);
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    return { label: monthLabel(month), value: spendForPeriod(platformData, start, end) };
  });
}

export function PlatformOverview() {
  const metrics = commandCenterMetrics(platformData, PLATFORM_NOW);
  const storeRows = storeComparison(platformData, PLATFORM_NOW)
    .sort((a, b) => (b.criticalCount * 8 + b.openCount + b.replacementCandidates * 4 + (b.isOutlier ? 12 : 0)) - (a.criticalCount * 8 + a.openCount + a.replacementCandidates * 4 + (a.isOutlier ? 12 : 0)))
    .slice(0, 7);
  const openWork = platformData.workOrders.filter(isOpenWorkOrder);
  const ytdSpend = spendForPeriod(platformData, yearStart, now);
  const openExposure = openWork.reduce((sum, item) => sum + item.costExposureCents, 0);
  const annualBudget = platformData.systems.reduce((sum, item) => sum + item.annualBudgetCents, 0);
  const committed = platformData.authorizations.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.amountCents, 0);
  const overdue = openWork.filter((item) => item.dueAt && new Date(item.dueAt) < now);
  const pendingVerification = openWork.filter((item) => item.status === "completed_pending_verification");
  const invoiceExceptions = platformData.invoices.filter((item) => ["review", "submitted"].includes(item.status));
  const proposed = platformData.quotes.filter((item) => item.status === "submitted");
  const months = monthlySpend();
  const maxMonth = Math.max(...months.map((item) => item.value), 1);

  const categorySpend = platformData.categories.map((category) => ({
    category,
    spend: spendForPeriod(platformData, ttmStart, now, { categoryId: category.id }),
    work: platformData.workOrders.filter((item) => item.categoryId === category.id).length,
    open: openWork.filter((item) => item.categoryId === category.id).length,
  })).sort((a, b) => b.spend - a.spend);
  const maxCategory = Math.max(...categorySpend.map((item) => item.spend), 1);

  const actionQueues = [
    { label: "Past due response or completion", count: overdue.length, note: "Internal and vendor obligations", href: "/accountability?queue=overdue", icon: CalendarClock, tone: "critical" },
    { label: "Awaiting acceptance", count: metrics.awaitingVendor, note: "Offers without acknowledgement", href: "/accountability?queue=acceptance", icon: UsersRound, tone: "warning" },
    { label: "Proposal or approval required", count: proposed.length + openWork.filter((item) => ["waiting_on_quote", "waiting_on_approval"].includes(item.status)).length, note: "Financial decision needed", href: "/financials?view=approvals", icon: CircleDollarSign, tone: "info" },
    { label: "Completion verification", count: pendingVerification.length, note: "Store or facilities confirmation", href: "/accountability?queue=verification", icon: ClipboardCheck, tone: "purple" },
    { label: "Invoice exceptions", count: invoiceExceptions.length, note: "Validation or allocation issue", href: "/financials?view=invoices", icon: FileWarning, tone: "warning" },
  ] as const;

  return (
    <AppShell>
      <div className="pf-page pf-overview-page">
        <PlatformPageHeader eyebrow="Portfolio control · Aug 5, 2026" title="See the money, the work, and who owns what next." description="A focused 12-store showcase spanning every maintenance trade, internal teams, and outside providers—built on the same model intended for the full 65-store operation.">
          <div className="pf-period-control"><button className="active">YTD</button><button>Trailing 12</button><button>Custom</button></div>
          <Link className="pf-secondary-button" href="/reports"><Gauge />Open report library</Link>
        </PlatformPageHeader>

        <section className="pf-stat-grid pf-stat-grid-six">
          <PlatformStat label="YTD actual" value={formatCurrency(ytdSpend, true)} note={`${formatPercent(metrics.yearChange, 1)} vs prior YTD`} icon={Banknote} tone={metrics.yearChange > 0.08 ? "warning" : "positive"} href="/financials?view=payments" badge="Paid less credits" />
          <PlatformStat label="Approved commitments" value={formatCurrency(committed, true)} note="Authorized, not fully invoiced" icon={Landmark} href="/financials?view=purchase-orders" />
          <PlatformStat label="Open cost exposure" value={formatCurrency(openExposure, true)} note={`${openWork.length} non-terminal work orders`} icon={CircleDollarSign} tone="info" href="/work-orders?status=open" />
          <PlatformStat label="Portfolio budget" value={formatCurrency(annualBudget, true)} note={`${formatPercent(annualBudget ? ytdSpend / annualBudget : 0, 0)} consumed YTD`} icon={ReceiptText} href="/financials?view=budgets" />
          <PlatformStat label="Past-due obligations" value={String(overdue.length)} note="Internal + external providers" icon={ShieldAlert} tone="critical" href="/accountability?queue=overdue" />
          <PlatformStat label="PM compliance" value={formatPercent(metrics.pm.value, 0)} note={`${metrics.pm.numerator} of ${metrics.pm.denominator} verified on time`} icon={Wrench} tone={metrics.pm.value >= 0.9 ? "positive" : "warning"} href="/pm" />
        </section>

        <div className="pf-dashboard-grid pf-dashboard-grid-main">
          <section className="pf-panel pf-action-hub">
            <PlatformSectionHeader title="Needs attention" description="Prioritized by due time, financial exposure, and operational impact." href="/accountability" linkLabel="Open accountability center" />
            <div className="pf-action-list">
              {actionQueues.map(({ label, count, note, href, icon: Icon, tone }) => (
                <Link href={href} key={label} className="pf-action-row">
                  <i className={tone}><Icon /></i><span><strong>{label}</strong><small>{note}</small></span><b>{count}</b><ArrowUpRight />
                </Link>
              ))}
            </div>
          </section>

          <section className="pf-panel pf-spend-panel">
            <PlatformSectionHeader title="Monthly maintenance cost" description="Paid invoices less posted credits · trailing 12 months" href="/financials?view=payments" linkLabel="Financial detail" />
            <div className="pf-bar-chart" aria-label="Monthly maintenance cost bar chart">
              {months.map((month) => <div key={`${month.label}-${month.value}`}><span><i style={{ height: `${Math.max(6, (month.value / maxMonth) * 100)}%` }} /></span><small>{month.label}</small></div>)}
            </div>
            <div className="pf-chart-summary"><span><small>Trailing 12-month actual</small><strong>{formatCurrency(metrics.ttmSpend, true)}</strong></span><span><small>Approved, not invoiced</small><strong>{formatCurrency(metrics.approvedNotInvoiced, true)}</strong></span><span><small>Invoice review queue</small><strong>{invoiceExceptions.length}</strong></span></div>
          </section>
        </div>

        <div className="pf-dashboard-grid pf-dashboard-grid-equal">
          <section className="pf-panel">
            <PlatformSectionHeader title="Stores requiring management attention" description="Cost outliers, open critical work, repeated visits, and replacement candidates." href="/stores" linkLabel="Compare all stores" />
            <div className="pf-table-scroll"><table className="pf-table pf-store-risk-table"><thead><tr><th>Store</th><th>Open</th><th>TTM cost</th><th>PM</th><th>Signal</th></tr></thead><tbody>
              {storeRows.map((row) => <tr key={row.store.id}><td><Link href={`/stores/${row.store.id}`}><strong>#{row.store.code} · {row.store.city}</strong><small>{row.store.address1}</small></Link></td><td><strong>{row.openCount}</strong><small>{row.criticalCount ? `${row.criticalCount} critical` : "No critical"}</small></td><td><strong>{formatCurrency(row.spend)}</strong><small>{row.change >= 0 ? "+" : ""}{formatPercent(row.change, 0)} vs prior</small></td><td><PlatformProgress value={row.pm.value} tone={row.pm.value >= .9 ? "teal" : "amber"} label={formatPercent(row.pm.value)} /></td><td>{row.isOutlier ? <PlatformBadge tone="critical">Cost outlier</PlatformBadge> : row.replacementCandidates ? <PlatformBadge tone="warning">Replacement review</PlatformBadge> : <PlatformBadge tone="info">Open exposure</PlatformBadge>}</td></tr>)}
            </tbody></table></div>
          </section>

          <section className="pf-panel pf-category-panel">
            <PlatformSectionHeader title="Cost by service category" description="Every row drills to systems, equipment, work orders, and allocations." href="/reports?report=category-cost" linkLabel="Full category report" />
            <div className="pf-category-list">
              {categorySpend.slice(0, 9).map(({ category, spend, work, open }) => (
                <Link key={category.id} href={`/systems/${category.id}`}>
                  <span className="pf-category-dot" style={{ background: category.color }} /><span><strong>{category.name}</strong><small>{work} work orders · {open} open</small><i><em style={{ width: `${Math.max(2, (spend / maxCategory) * 100)}%`, background: category.color }} /></i></span><b>{formatCurrency(spend, true)}</b>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="pf-dashboard-grid pf-dashboard-grid-thirds">
          <section className="pf-panel pf-compact-panel"><PlatformSectionHeader title="Provider accountability" description="Comparable observable milestones, regardless of channel." href="/providers" /><div className="pf-compare-cards"><article><i><UsersRound /></i><span><small>Outside providers</small><strong>88% on-time response</strong><em>14 active companies · 11 exceptions</em></span></article><article><i><Wrench /></i><span><small>Internal maintenance</small><strong>94% work acknowledged</strong><em>8 technicians · 4 overdue updates</em></span></article></div></section>
          <section className="pf-panel pf-compact-panel"><PlatformSectionHeader title="Data confidence" description="Classification depth is shown beside every cost view." href="/reports?report=data-quality" /><div className="pf-data-quality"><div><span>Service category</span><PlatformProgress value={.98} label="98%" /></div><div><span>System / group</span><PlatformProgress value={.87} tone="blue" label="87%" /></div><div><span>Individual equipment</span><PlatformProgress value={.62} tone="purple" label="62%" /></div><div><span>Component</span><PlatformProgress value={.18} tone="amber" label="18%" /></div></div></section>
          <section className="pf-panel pf-compact-panel"><PlatformSectionHeader title="Financial controls" description="Maintenance accounting without replacing the general ledger." href="/financials" /><div className="pf-control-checks"><p><ClipboardCheck /><span><strong>3-way validation</strong><small>PO · receipt · invoice</small></span><PlatformBadge tone="good">Active</PlatformBadge></p><p><AlertCircle /><span><strong>Unallocated balance</strong><small>2 invoices need coding</small></span><PlatformBadge tone="warning">$1,842</PlatformBadge></p><p><Store /><span><strong>Store budgets</strong><small>{platformData.stores.length} showcase locations loaded</small></span><PlatformBadge tone="good">Complete</PlatformBadge></p></div></section>
        </div>
      </div>
    </AppShell>
  );
}
