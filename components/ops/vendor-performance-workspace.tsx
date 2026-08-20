import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileSearch,
  MapPinned,
  Search,
  ShieldCheck,
  Store,
  Wrench,
} from "lucide-react";
import type {
  VendorEvidenceMeasure,
  VendorPerformanceDetailViewModel,
  VendorPerformanceListViewModel,
  VendorPerformanceSummary,
} from "./vendor-performance-contract";
import styles from "./vendor-performance-workspace.module.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function money(amountMinor: number) {
  return currency.format(amountMinor / 100);
}

function EvidenceMeasure({ measure, compact = false }: { measure: VendorEvidenceMeasure; compact?: boolean }) {
  const stateClass = measure.state === "insufficient"
    ? styles.insufficient
    : measure.tone === "warning" || measure.tone === "critical"
      ? styles.attention
      : measure.tone === "positive"
        ? styles.positive
        : "";
  return (
    <Link
      className={`${compact ? styles.measureCell : styles.measureCard} ${stateClass}`}
      href={measure.sourceLink.href}
      aria-label={`${measure.label}: ${measure.value}. ${measure.denominatorLabel}. ${measure.sourceLink.label}`}
    >
      <span className={styles.measureLabel}>{measure.label}</span>
      <strong>{measure.value}</strong>
      <small>{measure.denominatorLabel}</small>
      {!compact ? <p>{measure.definition}</p> : null}
      <span className={styles.sourcePrompt}>{measure.sourceLink.label}<ArrowRight aria-hidden="true" size={14} /></span>
    </Link>
  );
}

function PageContext({ scopeLabel, updatedLabel }: { scopeLabel: string; updatedLabel: string }) {
  return (
    <div className={styles.contextBar} aria-label="Current vendor evidence context">
      <span><small>Operating scope</small><strong>{scopeLabel}</strong></span>
      <span><small>Evidence current</small><strong>{updatedLabel}</strong></span>
      <span><small>Method</small><strong>Source records with denominators</strong></span>
    </div>
  );
}

function VendorIdentity({ vendor }: { vendor: VendorPerformanceSummary }) {
  return (
    <div className={styles.vendorIdentity}>
      <span className={styles.vendorMark} aria-hidden="true"><Building2 size={19} /></span>
      <span>
        <strong>{vendor.name}</strong>
        <small>{vendor.code} · {vendor.statusLabel}{vendor.preferred ? " · Preferred" : ""}</small>
        <em>{vendor.specialties.join(" · ") || "Specialties not classified"}</em>
      </span>
    </div>
  );
}

export function VendorPerformanceList({ model }: { model: VendorPerformanceListViewModel }) {
  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Vendor accountability</p>
          <h1>{model.title}</h1>
          <p>{model.description}</p>
        </div>
        {model.createVendorLink ? <Link className={styles.primaryButton} href={model.createVendorLink.href}>{model.createVendorLink.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
        <PageContext scopeLabel={model.scopeLabel} updatedLabel={model.updatedLabel} />
      </header>

      <section className={styles.portfolioStrip} aria-label="Vendor portfolio evidence">
        {model.portfolioMetrics.map((metric) => (
          <article key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.context}</small>
          </article>
        ))}
      </section>

      <section className={styles.methodBanner}>
        <span><ShieldCheck aria-hidden="true" size={21} /></span>
        <div>
          <strong>No composite vendor score</strong>
          <p>Response, acceptance, visit, exception, repeat-work, outcome, and cost evidence stay separate. A high or low percentage is a review fact—not an automatic judgment.</p>
        </div>
      </section>

      <section className={styles.scorecardSection}>
        <div className={styles.scorecardHeader}>
          <div><h2>Comparable vendor evidence</h2><p>Open any measure to inspect the records behind that vendor.</p></div>
          <form className={styles.toolbar} action="/app/vendors" method="get" role="search">
            <label>
              <span className={styles.visuallyHidden}>Search vendors</span>
              <Search aria-hidden="true" size={17} />
              <input name="q" type="search" defaultValue={model.searchValue} placeholder="Vendor, trade, or coverage" />
            </label>
            <label>
              <span className={styles.visuallyHidden}>Sort vendor evidence</span>
              <select name="sort" defaultValue={model.sort}>
                <option value="attention">Open accountability</option>
                <option value="name">Vendor name</option>
                <option value="response">Median response</option>
                <option value="cost">Recorded cost</option>
              </select>
            </label>
            <button type="submit">Apply</button>
          </form>
        </div>
        <div className={styles.resultLine}><strong>{model.resultSummary}</strong><span>Minimum history for comparative response and acceptance percentages: 3 observations.</span></div>

        {model.vendors.length ? (
          <div className={styles.tableShell}>
            <table className={styles.scorecardTable}>
              <caption className={styles.visuallyHidden}>Vendor performance evidence with source-linked denominators</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor / approved coverage</th>
                  <th scope="col">Response</th>
                  <th scope="col">Acceptance</th>
                  <th scope="col">Visit coverage</th>
                  <th scope="col">No-WO visits</th>
                  <th scope="col">Open accountability</th>
                  <th scope="col">Repeat visits</th>
                  <th scope="col">Unresolved outcomes</th>
                  <th scope="col">Recorded cost</th>
                </tr>
              </thead>
              <tbody>
                {model.vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className={styles.identityCell}>
                      <Link href={vendor.href}>
                        <VendorIdentity vendor={vendor} />
                        <span className={styles.coverageLine}><MapPinned aria-hidden="true" size={14} />{vendor.coverageLabel} · {vendor.coverageRegionCount} region{vendor.coverageRegionCount === 1 ? "" : "s"}</span>
                        <span className={styles.openRecord}>Open vendor evidence<ArrowRight aria-hidden="true" size={14} /></span>
                      </Link>
                    </td>
                    <td><EvidenceMeasure compact measure={vendor.measures.responseTime} /></td>
                    <td><EvidenceMeasure compact measure={vendor.measures.acceptance} /></td>
                    <td><EvidenceMeasure compact measure={vendor.measures.visitCoverage} /></td>
                    <td><EvidenceMeasure compact measure={vendor.measures.noWorkOrder} /></td>
                    <td><EvidenceMeasure compact measure={vendor.measures.accountability} /></td>
                    <td><EvidenceMeasure compact measure={vendor.measures.repeatVisits} /></td>
                    <td><EvidenceMeasure compact measure={vendor.measures.unresolvedOutcomes} /></td>
                    <td>
                      <Link className={styles.costCell} href={`${vendor.href}#cost-evidence`}>
                        <span>Recorded work cost</span>
                        <strong>{money(vendor.recordedCostMinor)}</strong>
                        <small>{vendor.recordedCostLineCount} entered cost line{vendor.recordedCostLineCount === 1 ? "" : "s"}</small>
                        <em>Open cost sources<ArrowRight aria-hidden="true" size={14} /></em>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}><FileSearch aria-hidden="true" size={24} /><strong>No vendors match this search</strong><p>Try a vendor name, specialty, trade, or coverage term.</p></div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ id, icon, title, description, count }: { id: string; icon: ReactNode; title: string; description: string; count?: string }) {
  return (
    <div className={styles.sectionHeader}>
      <span aria-hidden="true">{icon}</span>
      <div><h2 id={id}>{title}</h2><p>{description}</p></div>
      {count ? <strong>{count}</strong> : null}
    </div>
  );
}

function EmptyEvidence({ children }: { children: ReactNode }) {
  return <div className={styles.emptyEvidence}><CheckCircle2 aria-hidden="true" size={20} /><span>{children}</span></div>;
}

export function VendorPerformanceDetail({ model }: { model: VendorPerformanceDetailViewModel }) {
  if (model.state === "missing" || !model.summary) {
    return (
      <div className={styles.workspace}>
        <Link className={styles.backLink} href={model.backLink.href}><ArrowLeft aria-hidden="true" size={16} />{model.backLink.label}</Link>
        <section className={styles.emptyState}><FileSearch aria-hidden="true" size={26} /><h1>{model.title}</h1><p>{model.description}</p></section>
      </div>
    );
  }

  const vendor = model.summary;
  const measures = [
    vendor.measures.responseTime,
    vendor.measures.acceptance,
    vendor.measures.visitCoverage,
    vendor.measures.noWorkOrder,
    vendor.measures.accountability,
    vendor.measures.repeatVisits,
    vendor.measures.unresolvedOutcomes,
  ];

  return (
    <div className={styles.workspace}>
      <Link className={styles.backLink} href={model.backLink.href}><ArrowLeft aria-hidden="true" size={16} />{model.backLink.label}</Link>
      <header className={styles.detailHero}>
        <div className={styles.detailTitle}>
          <span className={styles.heroMark}><Building2 aria-hidden="true" size={25} /></span>
          <div>
            <p className={styles.eyebrow}>{vendor.preferred ? "Preferred approved vendor" : "Approved vendor"}</p>
            <h1>{model.title}</h1>
            <p>{model.description}</p>
          </div>
        </div>
        {model.createWorkOrderLink ? <Link className={styles.primaryButton} href={model.createWorkOrderLink.href}>{model.createWorkOrderLink.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
        <PageContext scopeLabel={model.scopeLabel} updatedLabel={model.updatedLabel} />
      </header>

      <section className={styles.vendorFacts} aria-label="Vendor identity and coverage">
        <div><span>Dispatch</span><strong>{vendor.dispatchEmail}</strong><small>{vendor.dispatchPhone ?? "Phone not entered"}</small></div>
        <div><span>Specialties</span><strong>{vendor.specialties.join(" · ") || "Not classified"}</strong><small>Organization-approved search language</small></div>
        <div><span>Approved coverage</span><strong>{vendor.coverageLabel}</strong><small>{vendor.coverageRegionCount} regions · {model.regionLabels.join(" · ") || "No region coverage"}</small></div>
        <div><span>Observed footprint</span><strong>{vendor.observedStoreCount} stores</strong><small>Stores with at least one source visit</small></div>
        <div><span>Work currently attributed</span><strong>{vendor.assignedWorkCount} work orders</strong><small>{vendor.openWorkCount} currently open</small></div>
        <div><span>Recorded work cost</span><strong>{money(vendor.recordedCostMinor)}</strong><small>{vendor.recordedCostLineCount} entered source lines</small></div>
      </section>

      <section className={styles.measureGrid} aria-label="Vendor evidence measures">
        {measures.map((measure) => <EvidenceMeasure key={measure.id} measure={measure} />)}
        <Link className={`${styles.measureCard} ${styles.costMeasure}`} href="#cost-evidence">
          <span className={styles.measureLabel}>Recorded work cost</span>
          <strong>{money(vendor.recordedCostMinor)}</strong>
          <small>{vendor.recordedCostLineCount} entered cost line{vendor.recordedCostLineCount === 1 ? "" : "s"}</small>
          <p>Cost lines on work currently attributed to this vendor. Estimate, authorization, and invoice amounts are not combined into this total.</p>
          <span className={styles.sourcePrompt}>Open cost evidence<ArrowRight aria-hidden="true" size={14} /></span>
        </Link>
      </section>

      <section className={styles.methodBanner}>
        <span><ShieldCheck aria-hidden="true" size={21} /></span>
        <div><strong>Evidence, not a rating</strong><p>Each card states its denominator and definition. “Not enough history” appears until response or acceptance has at least three observations. Visit duration is approximate presence—not certified labor.</p></div>
      </section>

      <div className={styles.evidenceStack}>
        <section className={styles.evidenceSection} aria-labelledby="accountability-evidence" id="accountability-evidence">
          <SectionHeader id="accountability-evidence-heading" icon={<AlertTriangle size={20} />} title="Active accountability" description="Vendor-specific exceptions and open follow-ups on work currently attributed to this vendor." count={`${model.accountabilityRows.length} open`} />
          {model.accountabilityRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Active accountability evidence</caption><thead><tr><th>Record</th><th>Work order</th><th>Owner</th><th>Due</th></tr></thead><tbody>
              {model.accountabilityRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.summary}</strong><small>{row.kindLabel}</small></Link></td><td><Link href={row.href}>{row.workOrderLabel}</Link></td><td><Link href={row.href}>{row.ownerLabel}</Link></td><td><Link className={row.tone === "critical" ? styles.criticalText : styles.warningText} href={row.href}>{row.dueLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>No active vendor exceptions or attributed follow-ups are open.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="authorization-evidence" id="authorization-evidence">
          <SectionHeader id="authorization-evidence-heading" icon={<Clock3 size={20} />} title="Authorization response evidence" description="One row per issued authorization revision. Response time begins at issuance and ends at the first valid recorded response." count={`${model.authorizationRows.length} issued`} />
          {model.authorizationRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Authorization response and acceptance evidence</caption><thead><tr><th>Work / store</th><th>Issued</th><th>First response</th><th>Elapsed</th><th>Acceptance decision</th></tr></thead><tbody>
              {model.authorizationRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.workOrderNumber} · Revision {row.revision}</strong><small>{row.storeLabel} · {row.workOrderProblem}</small></Link></td><td><Link href={row.href}>{row.issuedAtLabel}</Link></td><td><Link href={row.href}><strong>{row.responseLabel}</strong><small>{row.responderLabel} · {row.responseAtLabel}</small></Link></td><td><Link href={row.href}>{row.responseTimeLabel}</Link></td><td><Link href={row.href}><strong>{row.decisionLabel}</strong><small>{row.decisionAtLabel}</small><ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>Not enough history: no service authorization has been issued to this vendor in the selected scope.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="repeat-visits" id="repeat-visits">
          <SectionHeader id="repeat-visits-heading" icon={<Wrench size={20} />} title="Repeat-visit work orders" description="More than one observed visit on the same work order. This is context for review, not an automatic callback or quality judgment." count={`${model.repeatVisitRows.length} work orders`} />
          {model.repeatVisitRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Work orders with repeat observed visits</caption><thead><tr><th>Work / store</th><th>Observed visits</th><th>Latest outcome</th><th>Recorded cost</th></tr></thead><tbody>
              {model.repeatVisitRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.workOrderNumber}</strong><small>{row.storeLabel} · {row.problem}</small></Link></td><td><Link href={row.href}>{row.visitCount}</Link></td><td><Link href={row.href}>{row.latestOutcomeLabel}</Link></td><td><Link href={row.href}>{row.recordedCostLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>No work order has more than one observed visit from this vendor.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="visit-evidence" id="visit-evidence">
          <SectionHeader id="visit-evidence-heading" icon={<MapPinned size={20} />} title="Observed visit and checkout evidence" description="Every visit channel creates the same source record. No-WO and unresolved outcomes remain visible without implying billed labor or invalid service." count={`${model.visitRows.length} visits`} />
          {model.visitRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Observed vendor visit evidence</caption><thead><tr><th>Technician / store</th><th>Work order</th><th>Observed presence</th><th>Checkout outcome</th></tr></thead><tbody>
              {model.visitRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.technicianName}</strong><small>{row.storeLabel}</small></Link></td><td><Link className={row.isNoWorkOrder ? styles.warningText : undefined} href={row.href}>{row.workOrderLabel}</Link></td><td><Link href={row.href}>{row.observedLabel}<small>Approximate presence, not labor</small></Link></td><td><Link className={row.isUnresolved ? styles.warningText : undefined} href={row.href}>{row.outcomeLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>Not enough history: no observed visit is linked to this vendor in the selected scope.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="cost-evidence" id="cost-evidence">
          <SectionHeader id="cost-evidence-heading" icon={<CircleDollarSign size={20} />} title="Recorded cost sources" description="Entered work-order cost only. Quotes, NTE amounts, invoice references, and recorded cost remain separate bases." count={money(vendor.recordedCostMinor)} />
          {model.costRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Work orders with recorded cost attributed to this vendor</caption><thead><tr><th>Work / store</th><th>Status</th><th>Source lines</th><th>Recorded cost</th></tr></thead><tbody>
              {model.costRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.workOrderNumber}</strong><small>{row.storeLabel} · {row.problem}</small></Link></td><td><Link href={row.href}>{row.statusLabel}</Link></td><td><Link href={row.href}>{row.costLineCount}</Link></td><td><Link href={row.href}>{row.costLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>No entered cost line is attached to work currently attributed to this vendor.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="coverage-evidence" id="coverage-evidence">
          <SectionHeader id="coverage-evidence-heading" icon={<Store size={20} />} title="Approved specialties and coverage" description="Configured service relationships—not inferred from where a technician happened to visit." count={`${vendor.coverageStoreCount}/${vendor.coverageStoreDenominator} stores`} />
          <div className={styles.coverageGrid}>
            <article><span><Wrench aria-hidden="true" size={17} />Specialties</span><strong>{vendor.specialties.join(" · ") || "Not classified"}</strong><small>Used for approved-vendor search and routing.</small></article>
            <article><span><Store aria-hidden="true" size={17} />Stores</span><strong>{vendor.coverageLabel}</strong><small>{vendor.observedStoreCount} stores have observed visit history.</small></article>
            <article><span><MapPinned aria-hidden="true" size={17} />Regions</span><strong>{model.regionLabels.join(" · ") || "No approved region coverage"}</strong><small>{vendor.coverageRegionCount} regions represented in the current scope.</small></article>
          </div>
          {model.coverageRows.length ? <div className={styles.coverageRows}>{model.coverageRows.map((row) => <div key={row.id}><strong>{row.scopeLabel}</strong><span>{row.includedStoresLabel}</span><small>{row.preferredRankLabel}</small></div>)}</div> : <EmptyEvidence>No approved coverage relationship is configured.</EmptyEvidence>}
        </section>
      </div>

      <footer className={styles.boundaryNote}>
        <ExternalLink aria-hidden="true" size={17} />
        <p><strong>Interpretation boundary:</strong> these measures describe captured records. They do not prove service quality, billed labor, invoice validity, or vendor fault. Open the source before making a decision.</p>
      </footer>
    </div>
  );
}
