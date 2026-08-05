import {
  ArrowRight,
  ClipboardList,
  FileWarning,
  Plus,
  Search,
  Store,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import Link from "@/components/site-link";
import {
  formatCurrency,
  isOpenWorkOrder,
  spendForPeriod,
} from "@/lib/domain/analytics";
import { platformData, PLATFORM_NOW } from "@/lib/platform/data";

const now = new Date(PLATFORM_NOW);
const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

const priorityWeight = {
  critical: 4,
  high: 3,
  routine: 2,
  low: 1,
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function plainPriority(value: keyof typeof priorityWeight) {
  if (value === "critical") return "Urgent";
  if (value === "high") return "High priority";
  return "Normal priority";
}

export function PlatformOverview() {
  const openWork = platformData.workOrders.filter(isOpenWorkOrder);
  const overdue = openWork.filter(
    (item) => item.dueAt && new Date(item.dueAt) < now,
  );
  const ytdSpend = spendForPeriod(platformData, yearStart, now);

  const attentionWork = [...openWork]
    .sort((a, b) => {
      const aLate = a.dueAt && new Date(a.dueAt) < now ? 1 : 0;
      const bLate = b.dueAt && new Date(b.dueAt) < now ? 1 : 0;
      if (aLate !== bLate) return bLate - aLate;
      if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })
    .slice(0, 4);

  const categorySpend = platformData.categories
    .map((category) => ({
      category,
      spend: spendForPeriod(platformData, yearStart, now, {
        categoryId: category.id,
      }),
      open: openWork.filter((item) => item.categoryId === category.id).length,
    }))
    .filter((item) => item.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 4);

  return (
    <AppShell>
      <div className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Demo Mode · Wednesday, August 5</p>
            <h1>Start here</h1>
            <p>
              This page shows only what needs attention. Choose a store or an
              action; the details stay out of the way until you open them.
            </p>
          </div>
        </header>

        <div className="brief-grid">
          <section className="control-brief" aria-labelledby="today-heading">
            <div className="control-kicker">
              <span className="signal" /> Today across {platformData.stores.length} demo stores
            </div>
            <h2 id="today-heading">
              {overdue.length
                ? `${overdue.length} jobs are late and need an update.`
                : "Nothing is late right now."}
            </h2>
            <p>
              Open the list to see the store, what is wrong, who is responsible,
              and what they need to do next.
            </p>
            <div className="brief-actions">
              <Link className="brief-action" href="/accountability?queue=overdue">
                <strong>{overdue.length}</strong> Review late jobs <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="brief-action" href="/work-orders?status=open">
                <strong>{openWork.length}</strong> See all open jobs <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="panel panel-pad" aria-labelledby="common-tasks-heading">
            <header className="panel-title">
              <div>
                <h2 id="common-tasks-heading">What do you want to do?</h2>
                <p>
                  You can start without knowing any equipment details.
                </p>
              </div>
            </header>
            <div className="stack">
              <Link
                className="button primary"
                href="/stores"
                style={{ justifyContent: "flex-start", minHeight: 48, width: "100%" }}
              >
                <Search aria-hidden="true" /> Find a store by number or address
              </Link>
              <Link
                className="button"
                href="/requests/new"
                style={{ justifyContent: "flex-start", minHeight: 48, width: "100%" }}
              >
                <FileWarning aria-hidden="true" /> Report a problem
              </Link>
              <Link
                className="button"
                href="/work-orders/new"
                style={{ justifyContent: "flex-start", minHeight: 48, width: "100%" }}
              >
                <Plus aria-hidden="true" /> Create a work order
              </Link>
            </div>
          </section>
        </div>

        <div className="split-grid">
          <section className="panel panel-pad" aria-labelledby="attention-heading">
            <header className="panel-title">
              <div>
                <h2 id="attention-heading">What needs attention now</h2>
                <p>
                  Open a job to see its full history and update the next step.
                </p>
              </div>
              <Link href="/accountability">See everything</Link>
            </header>
            <div className="exception-list">
              {attentionWork.map((item) => {
                const store = platformData.stores.find(
                  (candidate) => candidate.id === item.storeId,
                );
                const late = Boolean(item.dueAt && new Date(item.dueAt) < now);
                return (
                  <Link className="exception-row" href={`/work-orders/${item.id}`} key={item.id}>
                    <span
                      className={`exception-bar ${late || item.priority === "critical" ? "red" : ""}`}
                    />
                    <span className="exception-copy">
                      <strong>
                        Store {store?.code ?? "—"}: {item.title}
                      </strong>
                      <span>
                        Next: {item.accountableParty} — {item.nextAction}
                      </span>
                    </span>
                    <span className="exception-meta">
                      <strong>
                        {item.dueAt
                          ? `${late ? "Late since" : "Due"} ${shortDate(item.dueAt)}`
                          : "Date not set"}
                      </strong>
                      <small>
                        {plainPriority(item.priority)}
                      </small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="panel panel-pad spend-panel" aria-labelledby="spend-heading">
            <header className="panel-title">
              <div>
                <h2 id="spend-heading">Where the money is going</h2>
                <p>Paid maintenance bills, less credits, since January 1.</p>
              </div>
            </header>
            <div className="spend-total">
              <span className="spend-label">Spent this year</span>
              <strong>{formatCurrency(ytdSpend, true)}</strong>
            </div>
            <div className="exception-list">
              {categorySpend.map(({ category, spend, open }) => (
                <Link className="exception-row" href={`/systems/${category.id}`} key={category.id}>
                  <span className="exception-bar" style={{ background: category.color }} />
                  <span className="exception-copy">
                    <strong>{category.name}</strong>
                    <span>
                      {open} open {open === 1 ? "job" : "jobs"}
                    </span>
                  </span>
                  <strong className="spend-row-amount">{formatCurrency(spend, true)}</strong>
                </Link>
              ))}
            </div>
            <Link className="spend-footer" href="/financials?view=payments">
              See all spending <ArrowRight aria-hidden="true" />
            </Link>
          </section>
        </div>

        <details className="panel panel-pad home-deeper">
          <summary>
            Need a deeper view?
          </summary>
          <p className="home-deeper-copy">
            Open these only when you need to compare stores, inspect equipment,
            review invoices, or build a report.
          </p>
          <div className="brief-actions">
            <Link className="button" href="/stores"><Store aria-hidden="true" /> Compare stores</Link>
            <Link className="button" href="/equipment"><ClipboardList aria-hidden="true" /> View equipment</Link>
            <Link className="button" href="/financials">Review invoices and budgets</Link>
            <Link className="button" href="/reports">Open detailed reports</Link>
          </div>
        </details>
      </div>
    </AppShell>
  );
}
