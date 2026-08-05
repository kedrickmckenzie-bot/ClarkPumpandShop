"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  ShieldCheck,
  Store,
  Wrench,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import Link from "@/components/site-link";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  isOpenWorkOrder,
  median,
  pmCompliance,
  replacementAnalysis,
  trailingPeriods,
} from "@/lib/domain/analytics";
import { platformData, PLATFORM_NOW } from "@/lib/platform/data";

type PmFocus = "all" | "overdue" | "upcoming" | "completed";
type LifecycleBand = "monitor" | "plan" | "capital";
type LifecycleFilter = "all" | LifecycleBand;

type PreventiveLifecycleDashboardProps = {
  initialStoreId?: string;
  initialCategoryId?: string;
};

const COMPLETED_PM = new Set([
  "completed_early",
  "completed_on_time",
  "completed_late",
]);
const ON_TIME_PM = new Set(["completed_early", "completed_on_time"]);
const EXCLUDED_PM = new Set(["waived", "not_applicable"]);
const now = new Date(PLATFORM_NOW);
const { ttmStart } = trailingPeriods(PLATFORM_NOW);

function percentStyle(name: string, value: number): CSSProperties {
  return {
    [name]: `${Math.max(0, Math.min(1, value)) * 100}%`,
  } as CSSProperties;
}

function bandLabel(band: LifecycleBand) {
  if (band === "capital") return "Capital review";
  if (band === "plan") return "Plan replacement";
  return "Monitor";
}

function pmStatusLabel(status: string) {
  const labels: Record<string, string> = {
    scheduled: "Scheduled",
    due_soon: "Due soon",
    acceptance_pending: "Vendor response needed",
    accepted: "Accepted",
    completed_early: "Completed early",
    completed_on_time: "Completed on time",
    completed_late: "Completed late",
    documentation_pending: "Proof needed",
    missed: "Missed",
    rescheduled: "Rescheduled",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function PreventiveLifecycleDashboard({
  initialStoreId,
  initialCategoryId,
}: PreventiveLifecycleDashboardProps = {}) {
  const [storeId, setStoreId] = useState(() =>
    platformData.stores.some((store) => store.id === initialStoreId)
      ? initialStoreId!
      : "",
  );
  const [categoryId, setCategoryId] = useState(() =>
    platformData.categories.some((category) => category.id === initialCategoryId)
      ? initialCategoryId!
      : "",
  );
  const [pmFocus, setPmFocus] = useState<PmFocus>("all");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<LifecycleFilter>("all");
  const [selectedAssetId, setSelectedAssetId] = useState("");

  const scope = useMemo(() => {
    const systems = platformData.systems.filter(
      (system) =>
        (!storeId || system.storeId === storeId) &&
        (!categoryId || system.categoryId === categoryId),
    );
    const systemIds = new Set(systems.map((system) => system.id));
    const assets = platformData.assets.filter((asset) =>
      systemIds.has(asset.storeSystemId),
    );
    const plans = platformData.pmPlans.filter(
      (plan) => !categoryId || plan.categoryId === categoryId,
    );
    const planIds = new Set(plans.map((plan) => plan.id));
    const occurrences = platformData.pmOccurrences.filter(
      (occurrence) =>
        (!storeId || occurrence.storeId === storeId) &&
        planIds.has(occurrence.planId),
    );
    return { systems, assets, plans, occurrences };
  }, [categoryId, storeId]);

  const preventive = useMemo(() => {
    const overdue = scope.occurrences
      .filter(
        (occurrence) =>
          occurrence.status === "missed" ||
          (!COMPLETED_PM.has(occurrence.status) &&
            !EXCLUDED_PM.has(occurrence.status) &&
            new Date(occurrence.dueAt) < now),
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const upcomingHorizon = new Date(now);
    upcomingHorizon.setUTCDate(upcomingHorizon.getUTCDate() + 120);
    const upcoming = scope.occurrences
      .filter((occurrence) => {
        const dueAt = new Date(occurrence.dueAt);
        return (
          !COMPLETED_PM.has(occurrence.status) &&
          !EXCLUDED_PM.has(occurrence.status) &&
          dueAt >= now &&
          dueAt <= upcomingHorizon
        );
      })
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const completed = scope.occurrences
      .filter(
        (occurrence) =>
          COMPLETED_PM.has(occurrence.status) && occurrence.verified,
      )
      .sort((a, b) =>
        (b.completedAt ?? b.dueAt).localeCompare(a.completedAt ?? a.dueAt),
      );
    const compliance = pmCompliance(
      platformData,
      {
        ...(storeId ? { storeId } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      PLATFORM_NOW,
    );

    const trendMap = new Map<
      string,
      { due: number; completed: number; onTime: number; date: Date }
    >();
    scope.occurrences
      .filter(
        (occurrence) =>
          new Date(occurrence.dueAt) <= now &&
          !EXCLUDED_PM.has(occurrence.status),
      )
      .forEach((occurrence) => {
        const key = occurrence.dueAt.slice(0, 7);
        const row = trendMap.get(key) ?? {
          due: 0,
          completed: 0,
          onTime: 0,
          date: new Date(`${key}-01T12:00:00.000Z`),
        };
        row.due += 1;
        if (COMPLETED_PM.has(occurrence.status) && occurrence.verified) {
          row.completed += 1;
        }
        if (ON_TIME_PM.has(occurrence.status) && occurrence.verified) {
          row.onTime += 1;
        }
        trendMap.set(key, row);
      });
    const trend = [...trendMap.values()]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-6)
      .map((row) => ({
        ...row,
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }).format(row.date),
        completionRate: row.due ? row.completed / row.due : 0,
        onTimeRate: row.due ? row.onTime / row.due : 0,
      }));

    return { overdue, upcoming, completed, compliance, trend };
  }, [categoryId, scope.occurrences, storeId]);

  const lifecycleRows = useMemo(() => {
    const allAnalyses = new Map(
      platformData.assets.map((asset) => [
        asset.id,
        replacementAnalysis(platformData, asset, PLATFORM_NOW),
      ]),
    );
    const peerCosts = new Map<string, number[]>();
    platformData.assets.forEach((asset) => {
      const system = platformData.systems.find(
        (candidate) => candidate.id === asset.storeSystemId,
      );
      if (!system || (categoryId && system.categoryId !== categoryId)) return;
      const key = `${system.categoryId}|${asset.assetClass}`;
      const values = peerCosts.get(key) ?? [];
      values.push(allAnalyses.get(asset.id)!.currentReactive);
      peerCosts.set(key, values);
    });

    return scope.assets
      .map((asset) => {
        const system = platformData.systems.find(
          (candidate) => candidate.id === asset.storeSystemId,
        )!;
        const store = platformData.stores.find(
          (candidate) => candidate.id === system.storeId,
        )!;
        const category = platformData.categories.find(
          (candidate) => candidate.id === system.categoryId,
        )!;
        const analysis = allAnalyses.get(asset.id)!;
        const peerValues = peerCosts.get(
          `${system.categoryId}|${asset.assetClass}`,
        ) ?? [analysis.currentReactive];
        const peerMedian = median(peerValues);
        const peerOutlier =
          peerValues.length >= 3 &&
          analysis.currentReactive >= peerMedian * 1.5 &&
          analysis.currentReactive - peerMedian >= 250_000;
        const workOrders = platformData.workOrders.filter(
          (workOrder) =>
            workOrder.assetId === asset.id &&
            new Date(workOrder.createdAt) >= ttmStart &&
            new Date(workOrder.createdAt) < now,
        );
        const ageRatio =
          asset.expectedLifeYears > 0
            ? analysis.ageYears / asset.expectedLifeYears
            : 0;
        const band: LifecycleBand = analysis.recommended
          ? "capital"
          : analysis.reasons.length >= 2 ||
              ageRatio >= 0.7 ||
              analysis.burden >= 0.25 ||
              peerOutlier
            ? "plan"
            : "monitor";
        const reasons = analysis.reasons.map((reason) => ({
          key: reason.key,
          label: reason.label,
          value: reason.value,
          threshold: reason.threshold,
        }));
        if (ageRatio >= 0.7 && !reasons.some((reason) => reason.key === "age")) {
          reasons.push({
            key: "age-plan",
            label: "Asset is entering its later service years",
            value: `${analysis.ageYears.toFixed(1)} of ${asset.expectedLifeYears} years`,
            threshold: "At least 70% of expected service life",
          });
        }
        if (
          analysis.burden >= 0.25 &&
          !reasons.some((reason) => reason.key === "burden")
        ) {
          reasons.push({
            key: "burden-plan",
            label: "Repair spend merits budget planning",
            value: formatPercent(analysis.burden),
            threshold: "At least 25% of replacement estimate",
          });
        }
        if (peerOutlier) {
          reasons.push({
            key: "peer",
            label: "Reactive cost is above comparable equipment",
            value: `${formatCurrency(analysis.currentReactive)} vs ${formatCurrency(peerMedian)} median`,
            threshold: "At least 1.5× peer median and $2,500 above it",
          });
        }
        return {
          asset,
          system,
          store,
          category,
          analysis,
          peerMedian,
          peerCount: peerValues.length,
          peerOutlier,
          openWork: workOrders.filter(isOpenWorkOrder).length,
          ageRatio,
          band,
          reasons,
        };
      })
      .sort(
        (a, b) =>
          ({ capital: 0, plan: 1, monitor: 2 })[a.band] -
            ({ capital: 0, plan: 1, monitor: 2 })[b.band] ||
          b.analysis.burden - a.analysis.burden ||
          b.analysis.currentReactive - a.analysis.currentReactive,
      );
  }, [categoryId, scope.assets]);

  const bandCounts = lifecycleRows.reduce(
    (counts, row) => ({ ...counts, [row.band]: counts[row.band] + 1 }),
    { monitor: 0, plan: 0, capital: 0 },
  );
  const visibleLifecycle = lifecycleRows.filter(
    (row) => lifecycleFilter === "all" || row.band === lifecycleFilter,
  );
  const selectedLifecycle =
    visibleLifecycle.find((row) => row.asset.id === selectedAssetId) ??
    visibleLifecycle[0];
  const peerOutliers = lifecycleRows
    .filter((row) => row.peerOutlier)
    .sort(
      (a, b) =>
        b.analysis.currentReactive - b.peerMedian -
        (a.analysis.currentReactive - a.peerMedian),
    );

  const pmList =
    pmFocus === "overdue"
      ? preventive.overdue
      : pmFocus === "upcoming"
        ? preventive.upcoming
        : pmFocus === "completed"
          ? preventive.completed
          : [...preventive.overdue, ...preventive.upcoming];
  const selectedStore = platformData.stores.find((store) => store.id === storeId);
  const selectedCategory = platformData.categories.find(
    (category) => category.id === categoryId,
  );
  const pmScopeHref = `/pm?${[
    storeId ? `store=${encodeURIComponent(storeId)}` : "",
    categoryId ? `category=${encodeURIComponent(categoryId)}` : "",
  ]
    .filter(Boolean)
    .join("&")}`.replace(/\?$/, "");

  return (
    <section className="pl-dashboard" aria-labelledby="pl-title">
      <header className="pl-heading">
        <div>
          <p className="pl-eyebrow">Preventive maintenance + lifecycle</p>
          <h2 id="pl-title">Keep equipment reliable. Plan replacements before they become emergencies.</h2>
          <p>
            Preventive work, repair history, age, warranty, and paid cost stay
            connected to the equipment and work records behind them.
          </p>
        </div>
        <Link className="pl-heading-link" href={pmScopeHref}>
          Open PM program <ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <div className="pl-filters" aria-label="Preventive maintenance and lifecycle scope">
        <label>
          <span><Store aria-hidden="true" /> Store</span>
          <select
            value={storeId}
            onChange={(event) => {
              setStoreId(event.target.value);
              setSelectedAssetId("");
            }}
          >
            <option value="">All stores</option>
            {platformData.stores.map((store) => (
              <option value={store.id} key={store.id}>
                Store {store.code} · {store.city}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span><Wrench aria-hidden="true" /> Category</span>
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setSelectedAssetId("");
            }}
          >
            <option value="">All maintenance categories</option>
            {platformData.categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <p className="pl-scope-summary">
          <strong>{selectedStore ? `Store ${selectedStore.code}` : "Company"}</strong>
          <span>{selectedCategory?.name ?? "All maintenance categories"}</span>
          <small>{scope.assets.length} equipment records · {scope.occurrences.length} PM occurrences</small>
        </p>
      </div>

      <div className="pl-pm-grid">
        <section className="pl-panel pl-pm-summary" aria-labelledby="pl-pm-summary-title">
          <header className="pl-panel-heading">
            <div>
              <p className="pl-kicker">Preventive maintenance</p>
              <h3 id="pl-pm-summary-title">What needs attention</h3>
            </div>
            {pmFocus !== "all" && (
              <button type="button" onClick={() => setPmFocus("all")}>Show all</button>
            )}
          </header>
          <div className="pl-compliance-visual">
            <div
              className="pl-compliance-ring"
              style={percentStyle("--pl-ring-value", preventive.compliance.value)}
              role="img"
              aria-label={`${formatPercent(preventive.compliance.value)} of eligible preventive work was completed and checked on time`}
            >
              <strong>{formatPercent(preventive.compliance.value)}</strong>
              <span>on time</span>
            </div>
            <p>
              <strong>{preventive.compliance.numerator} of {preventive.compliance.denominator}</strong>
              <span>eligible visits completed, verified, and inside the service window</span>
            </p>
          </div>
          <div className="pl-pm-metrics">
            <button
              type="button"
              className={pmFocus === "overdue" ? "pl-active" : ""}
              aria-pressed={pmFocus === "overdue"}
              onClick={() => setPmFocus("overdue")}
            >
              <AlertTriangle aria-hidden="true" />
              <strong>{preventive.overdue.length}</strong>
              <span>Overdue or missed</span>
              <small>Recovery action required</small>
            </button>
            <button
              type="button"
              className={pmFocus === "upcoming" ? "pl-active" : ""}
              aria-pressed={pmFocus === "upcoming"}
              onClick={() => setPmFocus("upcoming")}
            >
              <CalendarClock aria-hidden="true" />
              <strong>{preventive.upcoming.length}</strong>
              <span>Due in 120 days</span>
              <small>Plan access and provider capacity</small>
            </button>
            <button
              type="button"
              className={pmFocus === "completed" ? "pl-active" : ""}
              aria-pressed={pmFocus === "completed"}
              onClick={() => setPmFocus("completed")}
            >
              <CheckCircle2 aria-hidden="true" />
              <strong>{preventive.completed.length}</strong>
              <span>Completed and checked</span>
              <small>Proof accepted</small>
            </button>
          </div>
        </section>

        <section className="pl-panel pl-pm-plan" aria-labelledby="pl-plan-title">
          <header className="pl-panel-heading">
            <div>
              <p className="pl-kicker">Source schedule</p>
              <h3 id="pl-plan-title">
                {pmFocus === "overdue"
                  ? "Overdue recovery"
                  : pmFocus === "completed"
                    ? "Recently completed"
                    : "Upcoming plan"}
              </h3>
            </div>
            <span>{pmList.length} in view</span>
          </header>
          <div className="pl-pm-list">
            {pmList.slice(0, 7).map((occurrence) => {
              const plan = platformData.pmPlans.find((item) => item.id === occurrence.planId);
              const store = platformData.stores.find((item) => item.id === occurrence.storeId);
              const asset = platformData.assets.find((item) => item.id === occurrence.assetId);
              const workOrder = platformData.workOrders.find((item) => item.id === occurrence.workOrderId);
              return (
                <article className="pl-pm-row" key={occurrence.id}>
                  <span className={`pl-pm-status pl-${occurrence.status}`} aria-hidden="true" />
                  <div>
                    <strong>{plan?.name ?? "Preventive maintenance"}</strong>
                    <span>Store {store?.code} · {asset?.name ?? plan?.scopeLabel}</span>
                    <small>
                      Due {formatDate(occurrence.dueAt)} · Window {formatDate(occurrence.windowStart)}–{formatDate(occurrence.windowEnd)}
                    </small>
                  </div>
                  <span className="pl-pm-state">{pmStatusLabel(occurrence.status)}</span>
                  <div className="pl-pm-actions">
                    {workOrder && (
                      <Link href={`/work-orders/${workOrder.id}`}>
                        {workOrder.number} <ArrowRight aria-hidden="true" />
                      </Link>
                    )}
                    {asset && <Link href={`/assets/${asset.id}`}>Equipment record</Link>}
                    {!workOrder && !asset && (
                      <Link href={`/pm?store=${occurrence.storeId}&category=${plan?.categoryId ?? ""}`}>
                        Open PM records
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
            {!pmList.length && (
              <div className="pl-empty">
                <ShieldCheck aria-hidden="true" />
                <strong>No records in this view</strong>
                <p>Change the status view or widen the store and category scope.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="pl-panel pl-trend" aria-labelledby="pl-trend-title">
        <header className="pl-panel-heading">
          <div>
            <p className="pl-kicker">Completion trend</p>
            <h3 id="pl-trend-title">Was planned work finished and on time?</h3>
          </div>
          <div className="pl-trend-legend" aria-label="Chart legend">
            <span><i className="pl-completed-key" /> Completed and checked</span>
            <span><i className="pl-ontime-key" /> On time</span>
          </div>
        </header>
        <div className="pl-trend-chart">
          {preventive.trend.map((period) => (
            <div className="pl-trend-period" key={period.label}>
              <div
                className="pl-trend-bars"
                role="img"
                aria-label={`${period.label}: ${formatPercent(period.completionRate)} completed and checked, ${formatPercent(period.onTimeRate)} on time, ${period.due} due`}
              >
                <span className="pl-completed-bar" style={{ height: `${period.completionRate * 100}%` }} />
                <span className="pl-ontime-bar" style={{ height: `${period.onTimeRate * 100}%` }} />
              </div>
              <strong>{formatPercent(period.onTimeRate)}</strong>
              <span>{period.label}</span>
              <small>{period.due} due</small>
            </div>
          ))}
          {!preventive.trend.length && <div className="pl-empty">No completed service periods in this scope.</div>}
        </div>
      </section>

      <section className="pl-lifecycle" aria-labelledby="pl-lifecycle-title">
        <header className="pl-section-heading">
          <div>
            <p className="pl-eyebrow">Equipment lifecycle planning</p>
            <h2 id="pl-lifecycle-title">Repair, budget, or bring to capital review</h2>
            <p>These are transparent planning bands, not automatic replacement decisions.</p>
          </div>
          {lifecycleFilter !== "all" && (
            <button type="button" onClick={() => setLifecycleFilter("all")}>Show all equipment</button>
          )}
        </header>
        <div className="pl-band-grid" aria-label="Lifecycle planning bands">
          {([
            { key: "monitor", icon: ShieldCheck, title: "Monitor", copy: "No planning threshold is currently triggered." },
            { key: "plan", icon: CalendarCheck2, title: "Plan replacement", copy: "Build timing and budget before the risk becomes urgent." },
            { key: "capital", icon: Gauge, title: "Capital review", copy: "Three or more evidence rules, including age or cost trend, need management review." },
          ] as const).map(({ key, icon: Icon, title, copy }) => (
            <button
              type="button"
              className={`pl-band pl-band-${key} ${lifecycleFilter === key ? "pl-active" : ""}`}
              aria-pressed={lifecycleFilter === key}
              onClick={() => {
                setLifecycleFilter(key);
                setSelectedAssetId("");
              }}
              key={key}
            >
              <Icon aria-hidden="true" />
              <strong>{bandCounts[key]}</strong>
              <span>{title}</span>
              <small>{copy}</small>
            </button>
          ))}
        </div>

        <div className="pl-lifecycle-grid">
          <section className="pl-panel pl-asset-list" aria-label="Equipment by lifecycle planning band">
            {visibleLifecycle.slice(0, 12).map((row) => (
              <article
                className={`pl-asset-row ${selectedLifecycle?.asset.id === row.asset.id ? "pl-selected" : ""}`}
                key={row.asset.id}
              >
                <button type="button" onClick={() => setSelectedAssetId(row.asset.id)}>
                  <span className={`pl-band-dot pl-${row.band}`} aria-hidden="true" />
                  <span>
                    <strong>{row.asset.name}</strong>
                    <small>Store {row.store.code} · {row.category.name} · {row.asset.assetClass}</small>
                  </span>
                  <span>
                    <strong>{formatCurrency(row.analysis.currentReactive)}</strong>
                    <small>reactive cost · 12 months</small>
                  </span>
                  <span className={`pl-band-label pl-${row.band}`}>{bandLabel(row.band)}</span>
                </button>
                <footer>
                  <Link href={`/assets/${row.asset.id}`}>Equipment record</Link>
                  <Link href={`/work-orders?asset=${row.asset.id}`}>
                    {row.openWork} open · Work records <ArrowRight aria-hidden="true" />
                  </Link>
                </footer>
              </article>
            ))}
            {!visibleLifecycle.length && (
              <div className="pl-empty">
                <ShieldCheck aria-hidden="true" />
                <strong>No equipment is in this planning band</strong>
                <button type="button" onClick={() => setLifecycleFilter("all")}>Show all equipment</button>
              </div>
            )}
          </section>

          <aside className="pl-panel pl-decision-detail" aria-live="polite">
            {selectedLifecycle ? (
              <>
                <header>
                  <span className={`pl-band-label pl-${selectedLifecycle.band}`}>
                    {bandLabel(selectedLifecycle.band)}
                  </span>
                  <h3>{selectedLifecycle.asset.name}</h3>
                  <p>Store {selectedLifecycle.store.code} · {selectedLifecycle.system.name}</p>
                </header>
                <div className="pl-evidence-grid">
                  <article>
                    <CalendarCheck2 aria-hidden="true" />
                    <span>Age</span>
                    <strong>{selectedLifecycle.analysis.ageYears.toFixed(1)} years</strong>
                    <small>{formatPercent(selectedLifecycle.ageRatio)} of expected life</small>
                  </article>
                  <article>
                    <CircleDollarSign aria-hidden="true" />
                    <span>Repair vs replacement</span>
                    <strong>{formatPercent(selectedLifecycle.analysis.burden)}</strong>
                    <small>{formatCurrency(selectedLifecycle.analysis.currentReactive)} of {formatCurrency(selectedLifecycle.asset.replacementCostCents)}</small>
                  </article>
                  <article>
                    <Wrench aria-hidden="true" />
                    <span>Repeat failures</span>
                    <strong>{selectedLifecycle.analysis.repeatFailures}</strong>
                    <small>{selectedLifecycle.analysis.failureCount} reactive work orders</small>
                  </article>
                  <article>
                    <ShieldCheck aria-hidden="true" />
                    <span>Warranty</span>
                    <strong>{new Date(selectedLifecycle.asset.warrantyEndsAt) >= now ? "Active" : "Expired"}</strong>
                    <small>Through {formatDate(selectedLifecycle.asset.warrantyEndsAt)}</small>
                  </article>
                  <article>
                    <Clock3 aria-hidden="true" />
                    <span>Last service</span>
                    <strong>
                      {selectedLifecycle.asset.lastServiceAt
                        ? formatDate(selectedLifecycle.asset.lastServiceAt)
                        : "Not recorded"}
                    </strong>
                    <small>Equipment service record</small>
                  </article>
                </div>
                <section className="pl-reasons">
                  <h4>Why it is in this band</h4>
                  {selectedLifecycle.reasons.map((reason) => (
                    <article key={reason.key}>
                      <CheckCircle2 aria-hidden="true" />
                      <span>
                        <strong>{reason.label}</strong>
                        <small>Rule: {reason.threshold}</small>
                      </span>
                      <b>{reason.value}</b>
                    </article>
                  ))}
                  {!selectedLifecycle.reasons.length && (
                    <p>No planning threshold is currently triggered. Continue recording work, cost, and PM evidence.</p>
                  )}
                </section>
                <footer>
                  <Link href={`/assets/${selectedLifecycle.asset.id}`}>
                    Open lifecycle record <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link href={`/work-orders?asset=${selectedLifecycle.asset.id}`}>See supporting work</Link>
                </footer>
              </>
            ) : (
              <div className="pl-empty">Select equipment to review its decision evidence.</div>
            )}
          </aside>
        </div>
      </section>

      <section className="pl-panel pl-peer-outliers" aria-labelledby="pl-peer-title">
        <header className="pl-panel-heading">
          <div>
            <p className="pl-kicker">Comparable equipment</p>
            <h3 id="pl-peer-title">Reactive-cost outliers</h3>
            <p>Compared only with the same category and equipment class across this company.</p>
          </div>
          <span>{peerOutliers.length} flagged</span>
        </header>
        <p className="pl-rule-note">
          Outlier rule: at least 3 company peers, and trailing-12-month reactive cost is both 1.5× the peer median and $2,500 above it. This is a review signal, not a cause or replacement order.
        </p>
        <div className="pl-peer-list">
          {peerOutliers.slice(0, 6).map((row) => {
            const maxSpend = Math.max(
              ...peerOutliers.map((item) => item.analysis.currentReactive),
              1,
            );
            return (
              <article className="pl-peer-row" key={row.asset.id}>
                <div>
                  <Link href={`/assets/${row.asset.id}`}>{row.asset.name}</Link>
                  <span>Store {row.store.code} · {row.category.name} · {row.asset.assetClass}</span>
                  <small>{row.peerCount} company peers</small>
                </div>
                <div className="pl-peer-bar" aria-hidden="true">
                  <span style={{ width: `${(row.analysis.currentReactive / maxSpend) * 100}%` }} />
                </div>
                <div>
                  <strong>{formatCurrency(row.analysis.currentReactive)}</strong>
                  <span>Peer median {formatCurrency(row.peerMedian)}</span>
                  <small>{formatCurrency(row.analysis.currentReactive - row.peerMedian)} above median</small>
                </div>
                <Link href={`/work-orders?asset=${row.asset.id}`}>
                  Source work <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            );
          })}
          {!peerOutliers.length && (
            <div className="pl-empty">
              <ShieldCheck aria-hidden="true" />
              <strong>No reactive-cost outliers in this scope</strong>
              <p>The company peer rule did not flag any of the selected equipment.</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
