import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileSearch,
  Filter,
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
import type { DemoEdition } from "./data-contract";
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
      <span><small>Viewing</small><strong>{scopeLabel}</strong></span>
      <span><small>Updated</small><strong>{updatedLabel}</strong></span>
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

function VendorPerformanceListComplete({ model }: { model: VendorPerformanceListViewModel }) {
  const attentionVendors = model.vendors.filter((vendor) => vendor.relationshipState !== "stable");
  return (
    <div className={styles.workspace}>
      <header className={styles.directoryHeader}>
        <div>
          <p className={styles.eyebrow}>Approved vendors</p>
          <h1>{model.title}</h1>
          <p>{model.description}</p>
        </div>
        {model.createVendorLink ? <Link className={styles.primaryButton} href={model.createVendorLink.href}>{model.createVendorLink.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
        <div className={styles.directoryContext}>
          <span><small>Viewing</small><strong>{model.scopeLabel}</strong></span>
          <span><small>Updated</small><strong>{model.updatedLabel}</strong></span>
        </div>
      </header>

      <section className={styles.portfolioStrip} aria-label="Vendor portfolio evidence">
        {model.portfolioMetrics.map((metric) => (
          <Link
            aria-label={`${metric.label}: ${metric.value}. ${metric.context}. ${metric.sourceLink.label}`}
            href={metric.sourceLink.href}
            key={metric.id}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.context}</small>
            <em>{metric.sourceLink.label}<ArrowRight aria-hidden="true" size={14} /></em>
          </Link>
        ))}
      </section>

      {attentionVendors.length ? <section className={styles.attentionRail} aria-labelledby="vendor-attention-heading">
        <div className={styles.attentionRailHeader}><span><AlertTriangle aria-hidden="true" size={18} /></span><div><h2 id="vendor-attention-heading">Vendors to review</h2><p>Open follow-ups or missing onboarding items. This is not a vendor grade.</p></div><strong>{attentionVendors.length}</strong></div>
        <div className={styles.attentionRailItems}>{attentionVendors.map((vendor) => <Link href={vendor.href} key={vendor.id}><span data-state={vendor.relationshipState}>{vendor.relationshipLabel}</span><strong>{vendor.name}</strong><p>{vendor.relationshipSummary}</p><em>Open vendor<ArrowRight aria-hidden="true" size={14} /></em></Link>)}</div>
      </section> : null}

      <section className={styles.directoryPanel} aria-labelledby="vendor-directory-heading">
        <div className={styles.directoryToolbar}>
          <div><h2 id="vendor-directory-heading">Vendor directory</h2><p>Search the approved network by company, trade, alias, or service coverage.</p></div>
          <form className={styles.toolbar} action="/app/vendors" method="get" role="search">
            <label>
              <span className={styles.visuallyHidden}>Search vendors</span>
              <Search aria-hidden="true" size={17} />
              <input name="q" type="search" defaultValue={model.searchValue} placeholder="Name, plumber, refrigeration…" />
            </label>
            <label>
              <Filter aria-hidden="true" size={16} />
              <span className={styles.visuallyHidden}>Filter relationship state</span>
              <select name="view" defaultValue={model.view}>
                <option value="all">All approved vendors</option>
                <option value="attention">Needs review</option>
                <option value="preferred">Preferred providers</option>
                <option value="stable">Operating normally</option>
              </select>
            </label>
            <label>
              <span className={styles.visuallyHidden}>Filter vendor specialty</span>
              <select name="specialty" defaultValue={model.specialty ?? ""}>
                <option value="">All specialties</option>
                {model.specialtyOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span className={styles.visuallyHidden}>Sort vendor directory</span>
              <select name="sort" defaultValue={model.sort}>
                <option value="attention">Action required first</option>
                <option value="name">Vendor name</option>
                <option value="response">Median response</option>
                <option value="cost">Recorded cost</option>
              </select>
            </label>
            <button type="submit">Apply</button>
          </form>
        </div>
        <div className={styles.resultLine}><strong>{model.resultSummary}</strong><span>Response rates appear after three recorded responses. Select any number to see the work behind it.</span></div>

        {model.vendors.length ? (
          <div className={styles.tableShell}>
            <table className={styles.vendorDirectoryTable}>
              <caption className={styles.visuallyHidden}>Approved vendor relationship directory with source-linked operating evidence</caption>
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Ready to use</th>
                  <th scope="col">Open work</th>
                  <th scope="col">Response history</th>
                  <th scope="col">Visit history</th>
                  <th scope="col">Recorded cost</th>
                </tr>
              </thead>
              <tbody>
                {model.vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className={styles.identityCell}>
                      <Link href={vendor.href}>
                        <VendorIdentity vendor={vendor} />
                        <span className={styles.relationshipBadge} data-state={vendor.relationshipState}>{vendor.relationshipLabel}</span>
                        <span className={styles.relationshipSummary}>{vendor.relationshipSummary}</span>
                        <span className={styles.openRecord}>Open vendor record<ArrowRight aria-hidden="true" size={14} /></span>
                      </Link>
                    </td>
                    <td><Link className={styles.directoryCell} href={`${vendor.href}#coverage-evidence`}><strong><MapPinned aria-hidden="true" size={15} />{vendor.coverageLabel}</strong><span>{vendor.coverageRegionCount} region{vendor.coverageRegionCount === 1 ? "" : "s"} · {vendor.observedStoreCount} stores observed</span><div className={styles.tagRow}>{vendor.specialties.slice(0, 3).map((specialty) => <em key={specialty}>{specialty}</em>)}</div></Link></td>
                    <td><Link className={styles.directoryCell} href={`${vendor.href}#compliance-evidence`}><span className={styles.complianceState} data-state={vendor.compliance.state}><BadgeCheck aria-hidden="true" size={15} />{vendor.compliance.label}</span><span>{vendor.compliance.detail}</span><small>{vendor.compliance.activeQualificationCount} active qualification{vendor.compliance.activeQualificationCount === 1 ? "" : "s"}</small></Link></td>
                    <td><Link className={styles.directoryCell} href={`/app/work-orders?vendor=${vendor.id}`}><strong>{vendor.openWorkCount} open work order{vendor.openWorkCount === 1 ? "" : "s"}</strong><span>{vendor.assignedWorkCount} total attributed</span><small className={vendor.measures.accountability.numerator ? styles.warningText : undefined}>{vendor.measures.accountability.denominatorLabel}</small></Link></td>
                    <td><Link className={styles.directoryCell} href={vendor.measures.responseTime.sourceLink.href}><strong>{vendor.measures.responseTime.value}</strong><span>Median first response</span><small>{vendor.measures.acceptance.value} acceptance · {vendor.measures.acceptance.denominator} decisions</small></Link></td>
                    <td><Link className={styles.directoryCell} href={vendor.measures.visitCoverage.sourceLink.href}><strong>{vendor.measures.visitCoverage.value}</strong><span>Eligible work with an observed visit</span><small className={vendor.measures.noWorkOrder.numerator || vendor.measures.unresolvedOutcomes.numerator ? styles.warningText : undefined}>{vendor.measures.noWorkOrder.numerator} no-WO · {vendor.measures.unresolvedOutcomes.numerator} unresolved</small></Link></td>
                    <td><Link className={`${styles.directoryCell} ${styles.costDirectoryCell}`} href={`${vendor.href}#cost-evidence`}><strong>{money(vendor.recordedCostMinor)}</strong><span>{vendor.recordedCostLineCount} entered cost line{vendor.recordedCostLineCount === 1 ? "" : "s"}</span><small>Recorded work cost only</small></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}><FileSearch aria-hidden="true" size={24} /><strong>No vendors match this search</strong><p>Try a vendor name, specialty, trade, or coverage term.</p></div>
        )}
      </section>

      <section className={styles.methodBanner}>
        <span><ShieldCheck aria-hidden="true" size={21} /></span>
        <div><strong>How vendor measures work</strong><p>Response, visits, open follow-ups, documents, and cost stay separate. The platform shows what happened; it does not automatically grade a vendor or decide whether a bill is valid.</p></div>
      </section>
    </div>
  );
}

function VendorAccountabilityList({ model }: { model: VendorPerformanceListViewModel }) {
  return (
    <div className={styles.workspace}>
      <header className={styles.directoryHeader}>
        <div>
          <p className={styles.eyebrow}>Work-order routing</p>
          <h1>Approved vendors</h1>
          <p>Find the right vendor and use the contact information recorded for work-order delivery.</p>
        </div>
        {model.createVendorLink ? <Link className={styles.primaryButton} href={model.createVendorLink.href}>{model.createVendorLink.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
        <div className={styles.directoryContext}>
          <span><small>Viewing</small><strong>{model.scopeLabel}</strong></span>
          <span><small>Updated</small><strong>{model.updatedLabel}</strong></span>
        </div>
      </header>

      <section className={styles.directoryPanel} aria-labelledby="vendor-directory-heading">
        <div className={styles.directoryToolbar}>
          <div><h2 id="vendor-directory-heading">Vendor directory</h2><p>Search by company name or the type of work you need performed.</p></div>
          <form className={styles.toolbar} action="/app/vendors" method="get" role="search">
            <label>
              <span className={styles.visuallyHidden}>Search vendors</span>
              <Search aria-hidden="true" size={17} />
              <input name="q" type="search" defaultValue={model.searchValue} placeholder="Name, plumber, refrigeration…" />
            </label>
            <label>
              <span className={styles.visuallyHidden}>Filter vendor specialty</span>
              <select name="specialty" defaultValue={model.specialty ?? ""}>
                <option value="">All specialties</option>
                {model.specialtyOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="submit">Search</button>
          </form>
        </div>
        <div className={styles.resultLine}><strong>{model.resultSummary}</strong><span>Contact and routing information only.</span></div>

        {model.vendors.length ? (
          <div className={styles.tableShell}>
            <table className={styles.vendorDirectoryTable}>
              <caption className={styles.visuallyHidden}>Approved vendors available for work-order routing</caption>
              <thead><tr><th scope="col">Vendor</th><th scope="col">What they handle</th><th scope="col">Dispatch contact</th><th scope="col">Coverage</th><th scope="col">Open work</th></tr></thead>
              <tbody>
                {model.vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className={styles.identityCell}><Link href={vendor.href}><VendorIdentity vendor={vendor} /><span className={styles.openRecord}>Open vendor record<ArrowRight aria-hidden="true" size={14} /></span></Link></td>
                    <td><Link className={styles.directoryCell} href={vendor.href}><strong>{vendor.specialties.join(" · ") || "Not classified"}</strong><span>Used when selecting a vendor for a work order</span></Link></td>
                    <td><Link className={styles.directoryCell} href={vendor.href}><strong>{vendor.dispatchPhone ?? "Phone not entered"}</strong><span>{vendor.dispatchEmail}</span></Link></td>
                    <td><Link className={styles.directoryCell} href={`${vendor.href}#coverage-evidence`}><strong>{vendor.coverageLabel}</strong><span>{vendor.coverageRegionCount} region{vendor.coverageRegionCount === 1 ? "" : "s"}</span></Link></td>
                    <td><Link className={styles.directoryCell} href={`/app/work-orders?vendor=${vendor.id}`}><strong>{vendor.openWorkCount} open</strong><span>{vendor.assignedWorkCount} total work order{vendor.assignedWorkCount === 1 ? "" : "s"}</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className={styles.emptyState}><FileSearch aria-hidden="true" size={24} /><strong>No vendors match this search</strong><p>Try a company name or service specialty.</p></div>}
      </section>
    </div>
  );
}

export function VendorPerformanceList({ model, edition = "complete" }: { model: VendorPerformanceListViewModel; edition?: DemoEdition }) {
  return edition === "accountability"
    ? <VendorAccountabilityList model={model} />
    : <VendorPerformanceListComplete model={model} />;
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

function VendorAccountabilityDetail({ model }: { model: VendorPerformanceDetailViewModel }) {
  if (model.state === "missing" || !model.summary) {
    return (
      <div className={styles.workspace}>
        <Link className={styles.backLink} href={model.backLink.href}><ArrowLeft aria-hidden="true" size={16} />{model.backLink.label}</Link>
        <section className={styles.emptyState}><FileSearch aria-hidden="true" size={26} /><h1>{model.title}</h1><p>{model.description}</p></section>
      </div>
    );
  }

  const vendor = model.summary;
  return (
    <div className={styles.workspace}>
      <Link className={styles.backLink} href={model.backLink.href}><ArrowLeft aria-hidden="true" size={16} />{model.backLink.label}</Link>
      <header className={styles.detailHero}>
        <div className={styles.detailTitle}>
          <span className={styles.heroMark}><Building2 aria-hidden="true" size={25} /></span>
          <div><p className={styles.eyebrow}>Approved vendor</p><h1>{model.title}</h1><p>{vendor.specialties.join(" · ") || "Specialties not classified"}</p></div>
        </div>
        {model.createWorkOrderLink ? <Link className={styles.primaryButton} href={model.createWorkOrderLink.href}>{model.createWorkOrderLink.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
        <PageContext scopeLabel={model.scopeLabel} updatedLabel={model.updatedLabel} />
      </header>

      {model.notice ? <div className={styles.successNotice} role="status"><CheckCircle2 aria-hidden="true" size={18} /><strong>{model.notice}</strong></div> : null}

      <nav className={styles.recordNav} aria-label="Vendor record sections">
        <a href="#work-sent">Work orders sent</a>
        <a href="#visit-evidence">Check-in & checkout</a>
        <a href="#coverage-evidence">Coverage</a>
      </nav>

      <section className={styles.vendorFacts} aria-label="Vendor contact and routing information">
        <div><span>Dispatch phone</span><strong>{vendor.dispatchPhone ?? "Not entered"}</strong><small>Use for scheduling or urgent coordination</small></div>
        <div><span>Dispatch email</span><strong>{vendor.dispatchEmail}</strong><small>Receives work-order delivery</small></div>
        <div><span>Specialties</span><strong>{vendor.specialties.join(" · ") || "Not classified"}</strong><small>Used in vendor search</small></div>
        <div><span>Approved coverage</span><strong>{vendor.coverageLabel}</strong><small>{vendor.coverageRegionCount} region{vendor.coverageRegionCount === 1 ? "" : "s"}</small></div>
        <div><span>Open work orders</span><strong>{vendor.openWorkCount}</strong><small>{vendor.assignedWorkCount} total assigned</small></div>
      </section>

      <div className={styles.evidenceStack}>
        <section className={styles.evidenceSection} aria-labelledby="work-sent-heading" id="work-sent">
          <SectionHeader id="work-sent-heading" icon={<Clock3 size={20} />} title="Work orders sent" description="The service authorizations delivered to this vendor and the response recorded for each one." count={`${model.authorizationRows.length} sent`} />
          {model.authorizationRows.length ? <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Work orders sent to this vendor</caption><thead><tr><th>Work order / store</th><th>Sent</th><th>Vendor response</th><th>Decision</th></tr></thead><tbody>
            {model.authorizationRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.workOrderNumber}</strong><small>{row.storeLabel} · {row.workOrderProblem}</small></Link></td><td><Link href={row.href}>{row.issuedAtLabel}</Link></td><td><Link href={row.href}><strong>{row.responseLabel}</strong><small>{row.responderLabel}</small></Link></td><td><Link href={row.href}>{row.decisionLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
          </tbody></table></div> : <EmptyEvidence>No work order has been sent to this vendor in the selected scope.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="visit-evidence-heading" id="visit-evidence">
          <SectionHeader id="visit-evidence-heading" icon={<MapPinned size={20} />} title="Check-in and checkout history" description="Who arrived, where they worked, which work order they selected, and how the visit ended." count={`${model.visitRows.length} visits`} />
          {model.visitRows.length ? <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Vendor check-in and checkout history</caption><thead><tr><th>Technician / store</th><th>Work order</th><th>Observed visit</th><th>Checkout outcome</th></tr></thead><tbody>
            {model.visitRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.technicianName}</strong></Link>{row.storeHref ? <Link href={row.storeHref}><small>{row.storeLabel}</small></Link> : <small>{row.storeLabel}</small>}</td><td><Link className={row.isNoWorkOrder ? styles.warningText : undefined} href={row.workOrderHref ?? row.href}>{row.workOrderLabel}</Link></td><td><Link href={row.href}>{row.observedLabel}</Link></td><td><Link className={row.isUnresolved ? styles.warningText : undefined} href={row.href}>{row.outcomeLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
          </tbody></table></div> : <EmptyEvidence>No visits are recorded for this vendor.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="coverage-evidence-heading" id="coverage-evidence">
          <SectionHeader id="coverage-evidence-heading" icon={<Store size={20} />} title="Service specialties and coverage" description="The locations and types of work this vendor can be selected for." count={`${vendor.coverageStoreCount}/${vendor.coverageStoreDenominator} stores`} />
          <div className={styles.coverageGrid}>
            <article><span><Wrench aria-hidden="true" size={17} />Specialties</span><strong>{vendor.specialties.join(" · ") || "Not classified"}</strong></article>
            <article><span><Store aria-hidden="true" size={17} />Stores</span><strong>{vendor.coverageLabel}</strong></article>
            <article><span><MapPinned aria-hidden="true" size={17} />Regions</span><strong>{model.regionLabels.join(" · ") || "No approved region coverage"}</strong></article>
          </div>
        </section>
      </div>
    </div>
  );
}

function VendorPerformanceDetailComplete({ model }: { model: VendorPerformanceDetailViewModel }) {
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
            <div className={styles.detailStatusLine}><p className={styles.eyebrow}>{vendor.preferred ? "Preferred approved vendor" : "Approved vendor"}</p><span className={styles.relationshipBadge} data-state={vendor.relationshipState}>{vendor.relationshipLabel}</span></div>
            <h1>{model.title}</h1>
            <p>{vendor.relationshipSummary}</p>
          </div>
        </div>
        {model.createWorkOrderLink ? <Link className={styles.primaryButton} href={model.createWorkOrderLink.href}>{model.createWorkOrderLink.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
        <PageContext scopeLabel={model.scopeLabel} updatedLabel={model.updatedLabel} />
      </header>

      {model.notice ? <div className={styles.successNotice} role="status"><CheckCircle2 aria-hidden="true" size={18} /><strong>{model.notice}</strong><span>The vendor relationship record and audit history have been updated.</span></div> : null}

      <nav className={styles.recordNav} aria-label="Vendor record sections">
        <a href="#relationship-evidence">Overview</a>
        <a href="#vendor-reminders">Reminders</a>
        <a href="#accountability-evidence">Open items</a>
        <a href="#compliance-evidence">Documents & capabilities</a>
        <a href="#authorization-evidence">Work sent</a>
        <a href="#visit-evidence">Visits</a>
        <a href="#cost-evidence">Costs</a>
      </nav>

      <section className={styles.vendorFacts} id="relationship-evidence" aria-label="Vendor identity and coverage">
        <div><span>Dispatch</span><strong>{vendor.dispatchEmail}</strong><small>{vendor.dispatchPhone ?? "Phone not entered"}</small></div>
        <div><span>Specialties</span><strong>{vendor.specialties.join(" · ") || "Not classified"}</strong><small>Organization-approved search language</small></div>
        <div><span>Approved coverage</span><strong>{vendor.coverageLabel}</strong><small>{vendor.coverageRegionCount} regions · {model.regionLabels.join(" · ") || "No region coverage"}</small></div>
        <div><span>Stores visited</span><strong>{vendor.observedStoreCount} stores</strong><small>Stores with at least one recorded visit</small></div>
        <div><span>Assigned work</span><strong>{vendor.assignedWorkCount} work orders</strong><small>{vendor.openWorkCount} currently open</small></div>
        <div><span>Recorded work cost</span><strong>{money(vendor.recordedCostMinor)}</strong><small>{vendor.recordedCostLineCount} entered cost lines</small></div>
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
        <div><strong>Numbers, not a grade</strong><p>Each measure explains what is counted. Response rates appear after three observations, and visit time is approximate—not certified labor.</p></div>
      </section>

      <div className={styles.evidenceStack}>
        <section className={styles.evidenceSection} aria-labelledby="vendor-reminders-heading" id="vendor-reminders">
          <SectionHeader id="vendor-reminders-heading" icon={<BellRing size={20} />} title="Vendor relationship reminders" description="General callbacks, renewals, rate reviews, and other vendor obligations that are not tied to a work order." count={`${model.vendorReminderRows.filter((row) => row.status === "open").length} open`} />
          {model.manageRemindersAction ? (
            <details className={styles.reminderCreate}>
              <summary><span><BellRing aria-hidden="true" size={17} /><strong>Set a vendor reminder</strong><small>Give it a clear owner, due time, and escalation path.</small></span><ArrowRight aria-hidden="true" size={16} /></summary>
              <form action={model.manageRemindersAction} method="post" className={styles.relationshipForm}>
                <input type="hidden" name="operation" value="create" />
                <div className={styles.relationshipFormGrid}>
                  <label><span>Reminder</span><input name="title" required maxLength={240} placeholder="Confirm renewal, pricing, paperwork, or callback" /></label>
                  <label><span>Owner</span><input name="accountableParty" required maxLength={200} defaultValue={model.defaultReminderOwner} /></label>
                  <label><span>Due</span><input name="dueAt" type="datetime-local" required /></label>
                  <label><span>If overdue, notify</span><input name="escalationTo" required maxLength={200} defaultValue={model.defaultReminderEscalation} /></label>
                </div>
                <label className={styles.reminderNote}><span>Context <small>Optional</small></span><textarea name="note" rows={3} maxLength={2000} placeholder="What should the owner know before following up?" /></label>
                <div className={styles.relationshipFormFooter}><p>Uses {model.timeZone.replaceAll("_", " ")} for the due time. This reminder does not create or change a work order.</p><button type="submit">Set reminder</button></div>
              </form>
            </details>
          ) : null}
          {model.vendorReminderRows.length ? (
            <div className={styles.reminderList}>
              {model.vendorReminderRows.map((reminder) => (
                <article className={styles.reminderRecord} data-status={reminder.status} key={reminder.id}>
                  <div className={styles.reminderSummary}>
                    <span className={styles.reminderStatus}>{reminder.statusLabel}</span>
                    <div><strong>{reminder.title}</strong><p>{reminder.note ?? "No additional context entered."}</p><small>Created by {reminder.createdLabel}{reminder.completionLabel ? ` · Completed by ${reminder.completionLabel}` : ""}</small></div>
                    <dl><div><dt>Owner</dt><dd>{reminder.accountableParty}</dd></div><div><dt>Due</dt><dd>{reminder.dueLabel}</dd></div><div><dt>Escalates to</dt><dd>{reminder.escalationTo}</dd></div></dl>
                  </div>
                  {model.manageRemindersAction && reminder.status === "open" ? (
                    <details className={styles.reminderEdit}>
                      <summary>Update or complete<ArrowRight aria-hidden="true" size={14} /></summary>
                      <div className={styles.reminderEditGrid}>
                        <form action={model.manageRemindersAction} method="post" className={styles.relationshipForm}>
                          <input type="hidden" name="operation" value="update" /><input type="hidden" name="reminderId" value={reminder.id} />
                          <label><span>Reminder</span><input name="title" required maxLength={240} defaultValue={reminder.title} /></label>
                          <label><span>Owner</span><input name="accountableParty" required maxLength={200} defaultValue={reminder.accountableParty} /></label>
                          <label><span>Due</span><input name="dueAt" type="datetime-local" required defaultValue={reminder.dueInputValue} /></label>
                          <label><span>If overdue, notify</span><input name="escalationTo" required maxLength={200} defaultValue={reminder.escalationTo} /></label>
                          <label className={styles.reminderNote}><span>Context <small>Optional</small></span><textarea name="note" rows={3} maxLength={2000} defaultValue={reminder.note} /></label>
                          <label className={styles.reminderNote}><span>Why is it changing?</span><textarea name="updateNote" rows={2} required maxLength={2000} placeholder="Record the reason for the new owner, date, or wording." /></label>
                          <button type="submit">Save reminder changes</button>
                        </form>
                        <form action={model.manageRemindersAction} method="post" className={styles.completeReminderForm}>
                          <input type="hidden" name="operation" value="complete" /><input type="hidden" name="reminderId" value={reminder.id} />
                          <label><span>Completion note</span><textarea name="completionNote" rows={3} required maxLength={2000} placeholder="What was confirmed or completed?" /></label>
                          <button type="submit">Mark complete</button>
                        </form>
                      </div>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          ) : <EmptyEvidence>No relationship reminder has been recorded for this vendor.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="accountability-evidence" id="accountability-evidence">
          <SectionHeader id="accountability-evidence-heading" icon={<AlertTriangle size={20} />} title="Open follow-ups" description="Items tied to this vendor that still need an update or decision." count={`${model.accountabilityRows.length} open`} />
          {model.accountabilityRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Active accountability evidence</caption><thead><tr><th>Record</th><th>Work order</th><th>Owner</th><th>Due</th></tr></thead><tbody>
              {model.accountabilityRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.summary}</strong><small>{row.kindLabel}</small></Link></td><td><Link href={row.workOrderHref ?? row.href}>{row.workOrderLabel}</Link></td><td><Link href={row.href}>{row.ownerLabel}</Link></td><td><Link className={row.tone === "critical" ? styles.criticalText : styles.warningText} href={row.href}>{row.dueLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>No vendor follow-ups are open.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="compliance-evidence-heading" id="compliance-evidence">
          <SectionHeader id="compliance-evidence-heading" icon={<BadgeCheck size={20} />} title="Documents and service capabilities" description="Company-level onboarding documents and the types of work this vendor is approved to receive." count={vendor.compliance.label} />
          <div className={styles.complianceOverview}>
            <div><span>Document control</span><strong>{vendor.compliance.label}</strong><small>{vendor.compliance.detail}</small></div>
            <div><span>Current documents</span><strong>{vendor.compliance.approvedDocumentCount}/{vendor.compliance.documentCount}</strong><small>Approved and not expired as of this evidence date</small></div>
            <div><span>Active qualifications</span><strong>{vendor.compliance.activeQualificationCount}</strong><small>Trade and service-routing capabilities currently configured</small></div>
          </div>
          {model.manageRelationshipAction ? <div className={styles.relationshipManagement}>
            <div className={styles.relationshipManagementIntro}>
              <span><ShieldCheck aria-hidden="true" size={19} /></span>
              <div><h3>Update vendor records</h3><p>Add a document, renewal, or approved service capability. Earlier records remain in the history.</p></div>
            </div>
            <div className={styles.relationshipActions}>
              <details>
                <summary><span><BadgeCheck aria-hidden="true" size={17} /><strong>Add compliance record</strong><small>Insurance, license, W-9, safety, or certification</small></span><ArrowRight aria-hidden="true" size={16} /></summary>
                <form action={model.manageRelationshipAction} method="post" className={styles.relationshipForm}>
                  <input type="hidden" name="operation" value="record_compliance" />
                  <div className={styles.relationshipFormGrid}>
                    <label><span>Document type</span><select name="documentType" required defaultValue="insurance"><option value="insurance">Insurance</option><option value="license">License</option><option value="certification">Certification</option><option value="tax">Tax / W-9</option><option value="safety">Safety</option><option value="other">Other</option></select></label>
                    <label><span>Review status</span><select name="reviewStatus" required defaultValue="approved"><option value="approved">Approved</option><option value="pending">Pending review</option><option value="rejected">Rejected</option><option value="expired">Expired</option></select></label>
                    <label><span>Reference</span><input name="reference" required maxLength={200} placeholder="Policy, license, or document reference" /></label>
                    <label><span>Issuer</span><input name="issuer" maxLength={160} placeholder="Carrier, agency, or issuing authority" /></label>
                    <label><span>Effective date</span><input name="effectiveAt" type="date" /></label>
                    <label><span>Expiration date</span><input name="expiresAt" type="date" /></label>
                  </div>
                  <label className={styles.relationshipCheck} aria-label="Required for routing"><input type="checkbox" name="blocking" value="true" /><span><strong>Required for routing</strong><small>A missing, rejected, or expired current record places this vendor on routing hold.</small></span></label>
                  <div className={styles.relationshipFormFooter}><p>This records reviewed metadata. File evidence can remain in the customer&apos;s document system until private upload is configured.</p><button type="submit">Record document</button></div>
                </form>
              </details>
              <details>
                <summary><span><Wrench aria-hidden="true" size={17} /><strong>Add routing qualification</strong><small>Trade rights, job limit, and service capabilities</small></span><ArrowRight aria-hidden="true" size={16} /></summary>
                <form action={model.manageRelationshipAction} method="post" className={styles.relationshipForm}>
                  <input type="hidden" name="operation" value="record_qualification" />
                  <div className={styles.relationshipFormGrid}>
                    <label><span>Approved trade</span><select name="tradeKey" required defaultValue=""><option value="" disabled>Choose a profile specialty</option>{model.specialtyOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                    <label><span>Service capability</span><input name="serviceType" maxLength={160} placeholder="Reactive service, installation, inspection…" /></label>
                    <label><span>Maximum job amount</span><input name="maximumJobAmount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="No qualification limit" /></label>
                    <label><span>Required license</span><input name="requiredLicense" maxLength={160} placeholder="License class or number" /></label>
                    <label><span>Required certification</span><input name="requiredCertification" maxLength={160} placeholder="EPA 608, OEM certification…" /></label>
                    <label><span>Effective date</span><input name="effectiveAt" type="date" /></label>
                    <label><span>Expiration date</span><input name="expiresAt" type="date" /></label>
                  </div>
                  <div className={styles.serviceRights}>
                    <label><input type="checkbox" name="pmWork" value="true" /><span>Preventive maintenance</span></label>
                    <label><input type="checkbox" name="emergencyResponse" value="true" /><span>Emergency response</span></label>
                    <label><input type="checkbox" name="warrantyWork" value="true" /><span>Warranty work</span></label>
                    <label><input type="checkbox" name="afterHours" value="true" /><span>After-hours service</span></label>
                  </div>
                  <div className={styles.relationshipFormFooter}><p>These are company-level routing controls. They do not certify every individual technician.</p><button type="submit">Add qualification</button></div>
                </form>
              </details>
            </div>
          </div> : null}
          <div className={styles.relationshipSubsection}><div><h3>Compliance documents</h3><p>Insurance, licensing, tax, certification, and other onboarding records remain independently reviewable.</p></div>
            {model.complianceRows.length ? <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Vendor compliance document evidence</caption><thead><tr><th>Document</th><th>Reference</th><th>Review state</th><th>Effective</th><th>Expires</th><th>Routing effect</th></tr></thead><tbody>{model.complianceRows.map((row) => <tr key={row.id}><td className={styles.plainCell}><strong>{row.documentTypeLabel}</strong></td><td className={styles.plainCell}>{row.referenceLabel}</td><td className={`${styles.plainCell} ${row.tone === "critical" ? styles.criticalText : row.tone === "warning" ? styles.warningText : row.tone === "positive" ? styles.positiveText : styles.neutralText}`}>{row.statusLabel}</td><td className={styles.plainCell}>{row.effectiveLabel}</td><td className={styles.plainCell}>{row.expiryLabel}</td><td className={styles.plainCell}>{row.blockingLabel}</td></tr>)}</tbody></table></div> : <EmptyEvidence>No compliance documents are configured for this approved vendor.</EmptyEvidence>}
          </div>
          <div className={styles.relationshipSubsection}><div><h3>Approved routing qualifications</h3><p>Capabilities used by vendor search and routing, including emergency, warranty, PM, after-hours, and job-limit rules.</p></div>
            {model.qualificationRows.length ? <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Vendor qualification evidence</caption><thead><tr><th>Trade</th><th>Approved capability</th><th>Service rights</th><th>Job limit</th><th>Expires</th><th>Status</th></tr></thead><tbody>{model.qualificationRows.map((row) => <tr key={row.id}><td className={styles.plainCell}><strong>{row.tradeLabel}</strong></td><td className={styles.plainCell}>{row.capabilityLabel}</td><td className={styles.plainCell}>{row.serviceRightsLabel}</td><td className={styles.plainCell}>{row.limitLabel}</td><td className={styles.plainCell}>{row.expiryLabel}</td><td className={`${styles.plainCell} ${row.tone === "critical" ? styles.criticalText : styles.positiveText}`}>{row.statusLabel}</td></tr>)}</tbody></table></div> : <EmptyEvidence>No routing qualification is configured for this vendor.</EmptyEvidence>}
          </div>
        </section>

        <section className={styles.evidenceSection} aria-labelledby="authorization-evidence" id="authorization-evidence">
          <SectionHeader id="authorization-evidence-heading" icon={<Clock3 size={20} />} title="Work-order response history" description="See when work was sent and when the vendor first responded." count={`${model.authorizationRows.length} sent`} />
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
              {model.repeatVisitRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.workOrderNumber}</strong><small>{row.storeLabel} · {row.problem}</small></Link></td><td><Link href={`${row.href.split("?")[0]}?view=visits`}>{row.visitCount}</Link></td><td><Link href={row.href}>{row.latestOutcomeLabel}</Link></td><td><Link href={`${row.href.split("?")[0]}?view=cost`}>{row.recordedCostLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>No work order has more than one observed visit from this vendor.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="visit-evidence" id="visit-evidence">
          <SectionHeader id="visit-evidence-heading" icon={<MapPinned size={20} />} title="Visit and checkout history" description="See who checked in, where, for which work order, and how the visit ended." count={`${model.visitRows.length} visits`} />
          {model.visitRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Observed vendor visit evidence</caption><thead><tr><th>Technician / store</th><th>Work order</th><th>Observed presence</th><th>Checkout outcome</th></tr></thead><tbody>
              {model.visitRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.technicianName}</strong></Link>{row.storeHref ? <Link href={row.storeHref}><small>{row.storeLabel}</small></Link> : <small>{row.storeLabel}</small>}</td><td><Link className={row.isNoWorkOrder ? styles.warningText : undefined} href={row.workOrderHref ?? row.href}>{row.workOrderLabel}</Link></td><td><Link href={row.href}>{row.observedLabel}<small>Approximate presence, not labor</small></Link></td><td><Link className={row.isUnresolved ? styles.warningText : undefined} href={row.href}>{row.outcomeLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>Not enough history: no observed visit is linked to this vendor in the selected scope.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="cost-evidence" id="cost-evidence">
          <SectionHeader id="cost-evidence-heading" icon={<CircleDollarSign size={20} />} title="Recorded work costs" description="Work-order costs entered in the platform. Quotes, approval limits, and invoices are not added to this total." count={money(vendor.recordedCostMinor)} />
          {model.costRows.length ? (
            <div className={styles.tableShell}><table className={styles.evidenceTable}><caption className={styles.visuallyHidden}>Work orders with recorded cost attributed to this vendor</caption><thead><tr><th>Work / store</th><th>Status</th><th>Source lines</th><th>Recorded cost</th></tr></thead><tbody>
              {model.costRows.map((row) => <tr key={row.id}><td><Link href={row.href}><strong>{row.workOrderNumber}</strong><small>{row.storeLabel} · {row.problem}</small></Link></td><td><Link href={row.href}>{row.statusLabel}</Link></td><td><Link href={row.href}>{row.costLineCount}</Link></td><td><Link href={`${row.href.split("?")[0]}?view=cost`}>{row.costLabel}<ArrowRight aria-hidden="true" size={14} /></Link></td></tr>)}
            </tbody></table></div>
          ) : <EmptyEvidence>No entered cost line is attached to work currently attributed to this vendor.</EmptyEvidence>}
        </section>

        <section className={styles.evidenceSection} aria-labelledby="coverage-evidence" id="coverage-evidence">
          <SectionHeader id="coverage-evidence-heading" icon={<Store size={20} />} title="Service specialties and coverage" description="The stores, regions, and types of work this vendor is approved to receive." count={`${vendor.coverageStoreCount}/${vendor.coverageStoreDenominator} stores`} />
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
        <p><strong>Before making a decision:</strong> these numbers describe recorded activity. They do not prove service quality, billed labor, invoice validity, or vendor fault. Open the supporting work first.</p>
      </footer>
    </div>
  );
}

export function VendorPerformanceDetail({ model, edition = "complete" }: { model: VendorPerformanceDetailViewModel; edition?: DemoEdition }) {
  return edition === "accountability"
    ? <VendorAccountabilityDetail model={model} />
    : <VendorPerformanceDetailComplete model={model} />;
}
