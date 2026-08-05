"use client";

import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Download,
  Filter,
  Gauge,
  LineChart,
  PieChart,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Store,
  UsersRound,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  PlatformBadge,
  PlatformPageHeader,
  PlatformProgress,
  PlatformSectionHeader,
  PlatformStat,
} from "@/components/platform-ui";
import Link from "@/components/site-link";
import {
  classificationCoverage,
  formatCurrency,
  formatPercent,
  isOpenWorkOrder,
  pmCompliance,
  spendForPeriod,
  storeComparison,
} from "@/lib/domain/analytics";
import { platformData, PLATFORM_NOW } from "@/lib/platform/data";
import {
  rollupFinancialPosition,
  rollupFinancialPositionBy,
} from "@/lib/platform/finance";
import { useState } from "react";

type ReportKey =
  | "portfolio"
  | "store-cost"
  | "category-cost"
  | "providers"
  | "pm"
  | "equipment"
  | "financial"
  | "data-quality";
const reports: Array<{
  key: ReportKey;
  name: string;
  description: string;
  icon: typeof BarChart3;
  audience: string;
}> = [
  {
    key: "portfolio",
    name: "Portfolio operating review",
    description:
      "Cost, work, PM, exceptions, and store outliers in one management view.",
    icon: Gauge,
    audience: "Executive · Facilities",
  },
  {
    key: "store-cost",
    name: "Store cost comparison",
    description:
      "Compare actual, change, PM, reactive ratio, and repeat visits across locations.",
    icon: Store,
    audience: "Regional · Facilities",
  },
  {
    key: "category-cost",
    name: "Service category cost",
    description:
      "Drill from trade to system, equipment, component, work order, and allocation.",
    icon: PieChart,
    audience: "Facilities · Finance",
  },
  {
    key: "providers",
    name: "Provider accountability",
    description:
      "Internal and external response, completion, repeat visits, and open obligations.",
    icon: UsersRound,
    audience: "Facilities · Procurement",
  },
  {
    key: "pm",
    name: "Preventive maintenance compliance",
    description:
      "Plan, store, equipment, provider, due window, and verification performance.",
    icon: ShieldCheck,
    audience: "Facilities · Regional",
  },
  {
    key: "equipment",
    name: "Equipment cost and replacement",
    description:
      "Asset cost, age, failures, components, warranty, and explainable watchlist rules.",
    icon: Wrench,
    audience: "Facilities · Capital",
  },
  {
    key: "financial",
    name: "Maintenance financial position",
    description:
      "Requested, quoted, approved, committed, accrued, invoiced, credited, and paid.",
    icon: CircleDollarSign,
    audience: "Finance · Facilities",
  },
  {
    key: "data-quality",
    name: "Classification and coding quality",
    description:
      "Coverage, unclassified cost, missing dimensions, and records needing enrichment.",
    icon: Boxes,
    audience: "Administrator · Finance",
  },
];

const now = new Date(PLATFORM_NOW);
const ttmStart = new Date(Date.UTC(2025, 7, 5));

export function ReportingSuite({ initialReport, initialRegion, initialCategory }: { initialReport?: string; initialRegion?: string; initialCategory?: string }) {
  const normalized = reports.some((report) => report.key === initialReport)
    ? (initialReport as ReportKey)
    : "portfolio";
  const initialMode =
    initialReport === "builder" || initialReport === "scheduled"
      ? initialReport
      : initialReport === "library" || !initialReport
        ? "library"
        : "report";
  const [mode, setMode] = useState<
    "library" | "report" | "builder" | "scheduled"
  >(initialMode);
  const [selected, setSelected] = useState<ReportKey>(normalized);
  const [region, setRegion] = useState(platformData.regions.some((item) => item.id === initialRegion) ? initialRegion! : "all");
  const [category, setCategory] = useState(platformData.categories.some((item) => item.id === initialCategory) ? initialCategory! : "all");
  const [query, setQuery] = useState("");

  function openReport(report: ReportKey) {
    setSelected(report);
    setMode("report");
  }

  return (
    <AppShell>
      <div className="pf-page reporting-page">
        <PlatformPageHeader
          eyebrow="Insights · explainable and reversible"
          title="Reporting that always opens the records behind the number."
          description="Use the standard management library or build a view from operational, equipment, provider, and maintenance-financial dimensions."
        >
          <button className="pf-secondary-button" type="button">
            <Download />
            Export current view
          </button>
          <button
            className="pf-primary-button"
            type="button"
            onClick={() => setMode("builder")}
          >
            <Plus />
            Build report
          </button>
        </PlatformPageHeader>
        <nav className="reporting-nav">
          <button
            className={mode === "library" ? "active" : ""}
            onClick={() => setMode("library")}
          >
            <Bookmark />
            Report library
          </button>
          <button
            className={mode === "report" ? "active" : ""}
            onClick={() => setMode("report")}
          >
            <BarChart3 />
            Open report
          </button>
          <button
            className={mode === "builder" ? "active" : ""}
            onClick={() => setMode("builder")}
          >
            <Filter />
            Report builder
          </button>
          <button
            className={mode === "scheduled" ? "active" : ""}
            onClick={() => setMode("scheduled")}
          >
            <CalendarClock />
            Scheduled delivery
          </button>
        </nav>
        {mode === "library" && <ReportLibrary onOpen={openReport} />}
        {mode === "report" && (
          <>
            <div className="report-control-bar">
              <label>
                <span>Report</span>
                <select
                  value={selected}
                  onChange={(event) =>
                    setSelected(event.target.value as ReportKey)
                  }
                >
                  {reports.map((report) => (
                    <option value={report.key} key={report.key}>
                      {report.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Region</span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="all">All regions</option>
                  {platformData.regions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Service category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {platformData.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="report-search">
                <span>Filter records</span>
                <div>
                  <Search />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Store, address, work order…"
                  />
                </div>
              </label>
              <button type="button">
                <Save />
                Save view
              </button>
            </div>
            <ReportView
              report={selected}
              region={region}
              category={category}
              query={query}
            />
          </>
        )}
        {mode === "builder" && <ReportBuilder />}
        {mode === "scheduled" && <ScheduledReports />}
      </div>
    </AppShell>
  );
}

function ReportLibrary({ onOpen }: { onOpen: (report: ReportKey) => void }) {
  return (
    <>
      <section className="report-library-feature">
        <div>
          <PlatformBadge tone="info">Management standard</PlatformBadge>
          <h2>Monthly portfolio operating review</h2>
          <p>
            A connected management pack for actual and committed cost, open
            exposure, exceptions, PM, provider accountability, and store
            outliers.
          </p>
          <button
            className="pf-primary-button"
            type="button"
            onClick={() => onOpen("portfolio")}
          >
            Open management report
            <ArrowRight />
          </button>
        </div>
        <div className="report-feature-metrics">
          <span>
            <small>Report sections</small>
            <strong>8</strong>
          </span>
          <span>
            <small>Drill-through paths</small>
            <strong>24</strong>
          </span>
          <span>
            <small>Scheduled recipients</small>
            <strong>6</strong>
          </span>
        </div>
      </section>
      <section className="report-library-grid">
        {reports.map(({ key, name, description, icon: Icon, audience }) => (
          <article key={key}>
            <header>
              <span>
                <Icon />
              </span>
              <PlatformBadge tone="neutral">{audience}</PlatformBadge>
            </header>
            <h3>{name}</h3>
            <p>{description}</p>
            <footer>
              <span>Updated with live operational records</span>
              <button type="button" onClick={() => onOpen(key)}>
                Open
                <ArrowRight />
              </button>
            </footer>
          </article>
        ))}
      </section>
    </>
  );
}

function ReportView({
  report,
  region,
  category,
  query,
}: {
  report: ReportKey;
  region: string;
  category: string;
  query: string;
}) {
  if (report === "financial") return <FinancialPositionReport />;
  if (report === "providers") return <ProviderReport />;
  if (report === "pm") return <PmReport />;
  if (report === "equipment") return <EquipmentReport />;
  if (report === "data-quality") return <DataQualityReport />;
  if (report === "category-cost") return <CategoryCostReport region={region} category={category} />;
  return (
    <StoreReport
      portfolio={report === "portfolio"}
      region={region}
      category={category}
      query={query}
    />
  );
}

function StoreReport({
  portfolio,
  region,
  category,
  query,
}: {
  portfolio: boolean;
  region: string;
  category: string;
  query: string;
}) {
  const comparison = storeComparison(platformData, PLATFORM_NOW)
    .filter((row) => {
      if (region !== "all" && row.store.regionId !== region) return false;
      if (
        query &&
        !`${row.store.code} ${row.store.name} ${row.store.address1} ${row.store.city}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      return true;
    })
    .map((row) =>
      category === "all"
        ? row
        : {
            ...row,
            spend: spendForPeriod(platformData, ttmStart, now, {
              storeId: row.store.id,
              categoryId: category,
            }),
          },
    )
    .sort((a, b) => b.spend - a.spend);
  const spend = comparison.reduce((sum, row) => sum + row.spend, 0);
  const open = comparison.reduce((sum, row) => sum + row.openCount, 0);
  const pm =
    comparison.reduce((sum, row) => sum + row.pm.value, 0) /
    Math.max(1, comparison.length);
  return (
    <>
      <section className="pf-stat-grid report-stat-grid">
        <PlatformStat
          label="Selected actual"
          value={formatCurrency(spend, true)}
          note="Paid less posted credits"
          icon={CircleDollarSign}
        />
        <PlatformStat
          label="Open work"
          value={String(open)}
          note="Supporting records available"
          icon={ClipboardList}
        />
        <PlatformStat
          label="Average PM"
          value={formatPercent(pm)}
          note="Selected store cohort"
          icon={ShieldCheck}
        />
        <PlatformStat
          label="Cost outliers"
          value={String(comparison.filter((row) => row.isOutlier).length)}
          note="Rule-based and explainable"
          icon={Gauge}
          tone="warning"
        />
      </section>
      {portfolio && (
        <section className="report-summary-band">
          <div>
            <LineChart />
            <span>
              <strong>Management interpretation</strong>
              <p>
                {comparison.filter((row) => row.isOutlier).length} stores meet
                the current outlier rule. Store 45 remains the leading
                refrigeration driver because repeated Beer Cave repairs are
                classified to the same equipment history.
              </p>
            </span>
          </div>
          <Link href="/stores/store-45">
            Open Store 45 evidence
            <ArrowRight />
          </Link>
        </section>
      )}
      <section className="pf-panel">
        <PlatformSectionHeader
          title={
            portfolio ? "Portfolio store performance" : "Store cost comparison"
          }
          description="Sorted by selected actual cost. Select any row to open its management dashboard."
        />
        <div className="pf-table-scroll">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Rank / store</th>
                <th>Selected actual</th>
                <th>Vs prior</th>
                <th>Open work</th>
                <th>PM</th>
                <th>Repeat visits</th>
                <th>Replacement</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, index) => (
                <tr key={row.store.id}>
                  <td>
                    <Link href={`/stores/${row.store.id}`}>
                      <strong>
                        {index + 1}. Store {row.store.code} · {row.store.city}
                      </strong>
                      <small>{row.store.address1}</small>
                    </Link>
                  </td>
                  <td>
                    <strong>{formatCurrency(row.spend)}</strong>
                  </td>
                  <td>
                    <strong
                      className={
                        row.change > 0.1
                          ? "text-negative"
                          : row.change < 0
                            ? "text-positive"
                            : ""
                      }
                    >
                      {row.change >= 0 ? "+" : ""}
                      {formatPercent(row.change, 0)}
                    </strong>
                  </td>
                  <td>
                    <strong>{row.openCount}</strong>
                    <small>{row.criticalCount} critical</small>
                  </td>
                  <td>
                    <PlatformProgress
                      value={row.pm.value}
                      tone={row.pm.value >= 0.9 ? "teal" : "amber"}
                      label={formatPercent(row.pm.value)}
                    />
                  </td>
                  <td>
                    <strong>{row.repeatVisits}</strong>
                  </td>
                  <td>
                    <strong>{row.replacementCandidates}</strong>
                  </td>
                  <td>
                    {row.isOutlier ? (
                      <PlatformBadge tone="critical">
                        Cost outlier
                      </PlatformBadge>
                    ) : (
                      <PlatformBadge tone="good">Within range</PlatformBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CategoryCostReport({ region, category: categoryScope = "all" }: { region: string; category?: string }) {
  const storeIds = new Set(
    platformData.stores
      .filter((store) => region === "all" || store.regionId === region)
      .map((store) => store.id),
  );
  const rows = platformData.categories
    .filter((category) => categoryScope === "all" || category.id === categoryScope)
    .map((category) => {
      const work = platformData.workOrders.filter(
        (item) => storeIds.has(item.storeId) && item.categoryId === category.id,
      );
      const amount = [...storeIds].reduce(
        (sum, storeId) =>
          sum +
          spendForPeriod(platformData, ttmStart, now, {
            storeId,
            categoryId: category.id,
          }),
        0,
      );
      const assetCoverage = work.length
        ? work.filter((item) => item.assetId).length / work.length
        : 0;
      return {
        category,
        amount,
        open: work.filter(isOpenWorkOrder).length,
        work: work.length,
        assetCoverage,
      };
    })
    .sort((a, b) => b.amount - a.amount);
  const max = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <section className="pf-panel category-report">
      <PlatformSectionHeader
        title="Cost by service category"
        description="Store-only and category-only work remains in totals; deeper levels expose an unclassified bucket."
      />
      <div className="category-report-bars">
        {rows.map((row) => (
          <Link href={`/systems/${row.category.id}`} key={row.category.id}>
            <span style={{ background: row.category.color }}>
              <i style={{ width: `${(row.amount / max) * 100}%` }} />
            </span>
            <div>
              <strong>{row.category.name}</strong>
              <small>
                {row.work} work orders · {row.open} open ·{" "}
                {formatPercent(row.assetCoverage)} equipment classified
              </small>
            </div>
            <b>{formatCurrency(row.amount)}</b>
            <ArrowRight />
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProviderReport() {
  const rows = platformData.vendors
    .map((vendor) => {
      const work = platformData.workOrders.filter(
        (item) => item.vendorId === vendor.id,
      );
      const ids = new Set(work.map((item) => item.id));
      const visits = platformData.visits.filter((visit) =>
        ids.has(visit.workOrderId),
      );
      const responses = platformData.vendorResponses.filter(
        (response) => response.vendorId === vendor.id,
      );
      const accepted = responses.filter(
        (response) => response.response === "accepted",
      );
      return {
        vendor,
        work,
        open: work.filter(isOpenWorkOrder).length,
        visits: visits.length,
        responseRate: responses.length ? accepted.length / responses.length : 1,
        repeat: Math.max(
          0,
          visits.length -
            new Set(visits.map((visit) => visit.workOrderId)).size,
        ),
        exposure: work
          .filter(isOpenWorkOrder)
          .reduce((sum, item) => sum + item.costExposureCents, 0),
      };
    })
    .sort((a, b) => b.open - a.open);
  return (
    <section className="pf-panel">
      <PlatformSectionHeader
        title="Outside-provider accountability"
        description="Only directly observable behavior is measured; internal teams use the same work-order milestones."
        href="/providers"
      />
      <table className="pf-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Recorded work</th>
            <th>Open</th>
            <th>Acceptance</th>
            <th>Visits</th>
            <th>Repeat visits</th>
            <th>Open exposure</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.vendor.id}>
              <td>
                <Link href={`/providers/${row.vendor.id}`}>
                  <strong>{row.vendor.name}</strong>
                  <small>{row.vendor.trade}</small>
                </Link>
              </td>
              <td>
                <strong>{row.work.length}</strong>
              </td>
              <td>
                <strong>{row.open}</strong>
              </td>
              <td>
                <PlatformProgress
                  value={row.responseRate}
                  label={formatPercent(row.responseRate)}
                />
              </td>
              <td>
                <strong>{row.visits}</strong>
              </td>
              <td>
                <strong>{row.repeat}</strong>
              </td>
              <td>
                <strong>{formatCurrency(row.exposure)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PmReport() {
  const overall = pmCompliance(platformData, {}, PLATFORM_NOW);
  const rows = platformData.regions.map((region) => {
    const storeIds = platformData.stores
      .filter((store) => store.regionId === region.id)
      .map((store) => store.id);
    const values = storeIds.map(
      (storeId) => pmCompliance(platformData, { storeId }, PLATFORM_NOW).value,
    );
    return {
      region,
      compliance: values.reduce((sum, value) => sum + value, 0) / values.length,
      missed: platformData.pmOccurrences.filter(
        (item) => storeIds.includes(item.storeId) && item.status === "missed",
      ).length,
      pending: platformData.pmOccurrences.filter(
        (item) =>
          storeIds.includes(item.storeId) &&
          ["documentation_pending", "acceptance_pending"].includes(item.status),
      ).length,
    };
  });
  return (
    <>
      <section className="pf-stat-grid report-stat-grid">
        <PlatformStat
          label="Company compliance"
          value={formatPercent(overall.value)}
          note={`${overall.numerator} of ${overall.denominator} verified on time`}
          icon={ShieldCheck}
        />
        <PlatformStat
          label="Missed occurrences"
          value={String(
            platformData.pmOccurrences.filter(
              (item) => item.status === "missed",
            ).length,
          )}
          note="Each links to its source work"
          icon={CalendarClock}
          tone="critical"
        />
        <PlatformStat
          label="Documentation pending"
          value={String(
            platformData.pmOccurrences.filter(
              (item) => item.status === "documentation_pending",
            ).length,
          )}
          note="Cannot close as compliant"
          icon={ClipboardList}
          tone="warning"
        />
      </section>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="PM compliance by region"
          description="Waived and not-applicable occurrences are excluded from the denominator."
        />
        <table className="pf-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Compliance</th>
              <th>Missed</th>
              <th>Pending evidence</th>
              <th>Drill-through</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.region.id}>
                <td>
                  <strong>{row.region.name}</strong>
                </td>
                <td>
                  <PlatformProgress
                    value={row.compliance}
                    tone={row.compliance >= 0.9 ? "teal" : "amber"}
                    label={formatPercent(row.compliance)}
                  />
                </td>
                <td>
                  <strong>{row.missed}</strong>
                </td>
                <td>
                  <strong>{row.pending}</strong>
                </td>
                <td>
                  <Link href={`/pm?region=${row.region.id}`}>
                    Open occurrences
                    <ArrowRight />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function EquipmentReport() {
  const watch = platformData.assets
    .map((asset) => {
      const cost = spendForPeriod(platformData, ttmStart, now, {
        assetId: asset.id,
      });
      const system = platformData.systems.find(
        (item) => item.id === asset.storeSystemId,
      )!;
      const store = platformData.stores.find(
        (item) => item.id === system.storeId,
      )!;
      return {
        asset,
        cost,
        store,
        open: platformData.workOrders.filter(
          (item) => item.assetId === asset.id && isOpenWorkOrder(item),
        ).length,
      };
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 30);
  return (
    <section className="pf-panel">
      <PlatformSectionHeader
        title="Highest-cost equipment"
        description="Cost totals show classification coverage and open the exact work and allocations."
      />
      <table className="pf-table">
        <thead>
          <tr>
            <th>Equipment</th>
            <th>Store</th>
            <th>TTM cost</th>
            <th>Open work</th>
            <th>Condition</th>
            <th>Warranty</th>
          </tr>
        </thead>
        <tbody>
          {watch.map((row) => (
            <tr key={row.asset.id}>
              <td>
                <Link href={`/assets/${row.asset.id}`}>
                  <strong>
                    {row.asset.assetTag} · {row.asset.name}
                  </strong>
                  <small>{row.asset.assetClass}</small>
                </Link>
              </td>
              <td>
                <Link href={`/stores/${row.store.id}`}>
                  <strong>
                    #{row.store.code} · {row.store.city}
                  </strong>
                </Link>
              </td>
              <td>
                <strong>{formatCurrency(row.cost)}</strong>
              </td>
              <td>
                <strong>{row.open}</strong>
              </td>
              <td>
                <PlatformBadge
                  tone={
                    row.asset.condition === "poor"
                      ? "critical"
                      : row.asset.condition === "fair"
                        ? "warning"
                        : "good"
                  }
                >
                  {row.asset.condition}
                </PlatformBadge>
              </td>
              <td>
                <strong>
                  {new Date(row.asset.warrantyEndsAt) > now
                    ? "Active"
                    : "Expired"}
                </strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FinancialPositionReport() {
  const position = rollupFinancialPosition({ organizationId: "org-clarks" });
  const rows = rollupFinancialPositionBy(
    { organizationId: "org-clarks" },
    "regionId",
  );
  const stages = [
    { label: "Requested", value: position.requestedCents },
    { label: "Quoted", value: position.quotedCents },
    { label: "Approved", value: position.approvedCents },
    { label: "Committed", value: position.committedCents },
    { label: "Accrued", value: position.accruedCents },
    { label: "Invoiced", value: position.invoicedCents },
    { label: "Credited", value: position.creditedCents },
    { label: "Paid", value: position.paidCents },
  ];
  const max = Math.max(...stages.map((stage) => Math.abs(stage.value)), 1);
  return (
    <>
      <section className="financial-stage-band">
        {stages.map((stage) => (
          <div key={stage.label}>
            <span>{stage.label}</span>
            <strong>{formatCurrency(stage.value, true)}</strong>
            <i>
              <em
                style={{ width: `${(Math.abs(stage.value) / max) * 100}%` }}
              />
            </i>
          </div>
        ))}
      </section>
      <div className="report-warning">
        <CircleDollarSign />
        <p>
          <strong>Financial stages are parallel measures.</strong> Requested,
          approved, committed, invoiced, and paid are never added together as
          “total spend.”
        </p>
      </div>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="Financial position by region"
          description="Each row retains accounting and physical allocation dimensions."
          href="/financials"
        />
        <table className="pf-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Requested</th>
              <th>Committed</th>
              <th>Accrued</th>
              <th>Invoiced</th>
              <th>Credited</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
          {rows.map((row) => (
            <tr key={row.dimensionId}>
              <td>
                <strong>
                  {platformData.regions.find(
                    (item) => item.id === row.dimensionId,
                  )?.name ?? row.dimensionId}
                  </strong>
                </td>
                <td>{formatCurrency(row.requestedCents)}</td>
                <td>{formatCurrency(row.committedCents)}</td>
                <td>{formatCurrency(row.accruedCents)}</td>
                <td>{formatCurrency(row.invoicedCents)}</td>
                <td>{formatCurrency(row.creditedCents)}</td>
                <td>
                  <strong>{formatCurrency(row.paidCents)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function DataQualityReport() {
  const coverage = classificationCoverage(platformData);
  const checks = [
    {
      label: "Service category assigned",
      value: coverage.categorized,
      note: "All formal work orders",
    },
    {
      label: "System / group assigned",
      value: coverage.systemMapped,
      note: "Progressive classification",
    },
    {
      label: "Cost mapped to equipment",
      value: coverage.assetSpend,
      note: "Paid allocation coverage",
    },
    {
      label: "Cost mapped to component",
      value: coverage.componentSpend,
      note: "Optional component depth",
    },
  ];
  const missing = platformData.workOrders
    .filter(
      (item) =>
        !item.systemId || !item.assetId || !item.dueAt || !item.assignedToName,
    )
    .slice(0, 40);
  return (
    <>
      <section className="data-quality-grid">
        {checks.map((check) => (
          <article key={check.label}>
            <strong>{formatPercent(check.value)}</strong>
            <span>{check.label}</span>
            <PlatformProgress
              value={check.value}
              tone={
                check.value >= 0.9
                  ? "teal"
                  : check.value >= 0.6
                    ? "blue"
                    : "amber"
              }
            />
            <small>{check.note}</small>
          </article>
        ))}
      </section>
      <section className="pf-panel">
        <PlatformSectionHeader
          title="Records requiring enrichment"
          description="Incomplete depth remains visible and never prevents legitimate store- or category-level work."
        />
        <table className="pf-table">
          <thead>
            <tr>
              <th>Work order</th>
              <th>Store</th>
              <th>Missing system</th>
              <th>Missing equipment</th>
              <th>Missing assignment</th>
              <th>Missing deadline</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((item) => {
              const store = platformData.stores.find(
                (candidate) => candidate.id === item.storeId,
              )!;
              return (
                <tr key={item.id}>
                  <td>
                    <Link href={`/work-orders/${item.id}`}>
                      <strong>{item.number}</strong>
                      <small>{item.title}</small>
                    </Link>
                  </td>
                  <td>
                    <Link href={`/stores/${store.id}`}>
                      <strong>
                        #{store.code} · {store.city}
                      </strong>
                    </Link>
                  </td>
                  <td>
                    {item.systemId ? (
                      <PlatformBadge tone="good">No</PlatformBadge>
                    ) : (
                      <PlatformBadge tone="warning">Yes</PlatformBadge>
                    )}
                  </td>
                  <td>
                    {item.assetId ? (
                      <PlatformBadge tone="good">No</PlatformBadge>
                    ) : (
                      <PlatformBadge tone="warning">Yes</PlatformBadge>
                    )}
                  </td>
                  <td>
                    {item.assignedToName ? (
                      <PlatformBadge tone="good">No</PlatformBadge>
                    ) : (
                      <PlatformBadge tone="critical">Yes</PlatformBadge>
                    )}
                  </td>
                  <td>
                    {item.dueAt ? (
                      <PlatformBadge tone="good">No</PlatformBadge>
                    ) : (
                      <PlatformBadge tone="critical">Yes</PlatformBadge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

function ReportBuilder() {
  const [dimensions, setDimensions] = useState(["Store", "Service category"]);
  const [measures, setMeasures] = useState(["Paid cost", "Open work orders"]);
  const dimensionOptions = [
    "Region",
    "District",
    "Store",
    "Service category",
    "System / group",
    "Equipment class",
    "Equipment",
    "Component",
    "Provider",
    "GL account",
    "Accounting cost center",
    "Work type",
    "Priority",
  ];
  const measureOptions = [
    "Requested",
    "Quoted",
    "Approved",
    "Committed",
    "Accrued",
    "Invoiced",
    "Credits",
    "Paid cost",
    "Open exposure",
    "Work-order count",
    "Open work orders",
    "Median completion time",
    "PM compliance",
    "Repeat visits",
  ];
  return (
    <div className="report-builder-layout">
      <aside className="pf-panel report-field-library">
        <PlatformSectionHeader
          title="Field library"
          description="Physical, accounting, work, and provider dimensions."
        />
        <div>
          <h3>Dimensions</h3>
          {dimensionOptions.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() =>
                !dimensions.includes(item) &&
                setDimensions([...dimensions, item])
              }
            >
              <Plus />
              {item}
            </button>
          ))}
          <h3>Measures</h3>
          {measureOptions.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() =>
                !measures.includes(item) && setMeasures([...measures, item])
              }
            >
              <Plus />
              {item}
            </button>
          ))}
        </div>
      </aside>
      <main className="pf-panel report-builder-canvas">
        <PlatformSectionHeader
          title="Untitled custom report"
          description="Drag-free builder preview for the pilot."
        >
          <button className="pf-secondary-button">
            <Save />
            Save report
          </button>
        </PlatformSectionHeader>
        <section>
          <p className="builder-field-label">Rows / grouping</p>
          <div className="builder-chip-list">
            {dimensions.map((item) => (
              <button
                type="button"
                onClick={() =>
                  setDimensions(dimensions.filter((value) => value !== item))
                }
                key={item}
              >
                {item} ×
              </button>
            ))}
          </div>
          <p className="builder-field-label">Measures</p>
          <div className="builder-chip-list measures">
            {measures.map((item) => (
              <button
                type="button"
                onClick={() =>
                  setMeasures(measures.filter((value) => value !== item))
                }
                key={item}
              >
                {item} ×
              </button>
            ))}
          </div>
          <p className="builder-field-label">Filters</p>
          <div className="builder-filter-row">
            <select>
              <option>Trailing 12 months</option>
            </select>
            <select>
              <option>All regions</option>
            </select>
            <select>
              <option>All maintenance trades</option>
            </select>
            <button>
              <Plus />
              Add filter
            </button>
          </div>
        </section>
        <div className="builder-preview">
          <header>
            <BarChart3 />
            <span>
              <strong>Live preview</strong>
              <small>
                {dimensions.join(" → ")} · {measures.join(", ")}
              </small>
            </span>
          </header>
          <CategoryCostReport region="all" />
        </div>
      </main>
    </div>
  );
}

function ScheduledReports() {
  const schedules = [
    {
      name: "Monday exception digest",
      report: "Portfolio operating review",
      cadence: "Every Monday · 7:00 AM",
      recipients: "Facilities Director, 3 Regional Managers",
      format: "Email link + PDF",
    },
    {
      name: "Month-end maintenance financials",
      report: "Maintenance financial position",
      cadence: "1st business day · 8:00 AM",
      recipients: "Controller, AP Manager, Facilities Director",
      format: "XLSX + secure link",
    },
    {
      name: "Vendor scorecards",
      report: "Provider accountability",
      cadence: "Monthly · 5th day",
      recipients: "Facilities, Procurement",
      format: "Secure link",
    },
  ];
  return (
    <section className="pf-panel">
      <PlatformSectionHeader
        title="Scheduled report delivery"
        description="Saved scopes and filters are evaluated from current source records at send time."
      >
        <button className="pf-primary-button">
          <Plus />
          New schedule
        </button>
      </PlatformSectionHeader>
      <div className="scheduled-report-list">
        {schedules.map((item) => (
          <article key={item.name}>
            <span>
              <Send />
            </span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.report}</small>
            </div>
            <div>
              <strong>{item.cadence}</strong>
              <small>{item.recipients}</small>
            </div>
            <PlatformBadge tone="info">{item.format}</PlatformBadge>
            <button>
              Manage
              <ArrowRight />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
