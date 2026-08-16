import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CircleDot,
  Clock3,
  FileText,
  History,
  MapPin,
  PackageSearch,
  ReceiptText,
  Send,
  ShieldAlert,
  Tags,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import type {
  DataState,
  DetailFactViewModel,
  DetailPageViewModel,
  DetailSectionViewModel,
  EstimateComparisonViewModel,
  TableViewModel,
  Tone,
  VendorIssuanceViewModel,
  WorkOrderControlViewModel,
  WorkOrderRecordingViewModel,
} from "@/components/ops/data-contract";
import { VendorIssuancePanel } from "@/components/ops/forms";
import { EstimateComparisonPanel } from "@/components/ops/estimate-comparison-panel";
import {
  MutationReceipt,
  WorkOrderControlPanel,
} from "@/components/ops/service-control-panels";
import { WorkOrderRecordingPanel } from "@/components/ops/work-order-recording-panel";
import {
  WorkOrderReplacementIntelligencePanel,
  type WorkOrderReplacementIntelligenceViewModel,
} from "@/components/ops/replacement-intelligence-panel";
import styles from "./work-order-case.module.css";
import { domainLabel } from "@/lib/product/domain-label";

interface WorkOrderCaseProps {
  model: DetailPageViewModel;
  control: WorkOrderControlViewModel;
  recording: WorkOrderRecordingViewModel;
  estimateComparison: EstimateComparisonViewModel;
  issuance: VendorIssuanceViewModel;
  replacement: WorkOrderReplacementIntelligenceViewModel;
  updated?: string;
}

const toneStyles: Record<Tone, string> = {
  neutral: styles.toneNeutral,
  positive: styles.tonePositive,
  warning: styles.toneWarning,
  critical: styles.toneCritical,
  info: styles.toneInfo,
};

function factByLabel(model: DetailPageViewModel, label: string) {
  return model.facts.find((fact) => fact.label === label);
}

function sectionById(model: DetailPageViewModel, id: string) {
  return model.sections.find((section) => section.id === id);
}

function sectionFact(section: DetailSectionViewModel | undefined, label: string) {
  return section?.facts?.find((fact) => fact.label === label);
}

function sentence(value: string | undefined) {
  return domainLabel(value);
}

function dueLabel(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function DataStatePanel({ state }: { state: DataState }) {
  if (state.kind === "ready") return null;
  if (state.kind === "loading") {
    return (
      <section className={styles.statePanel} aria-live="polite">
        <CircleDot aria-hidden="true" size={22} />
        <h1>Loading work order</h1>
        <p>{state.label ?? "Retrieving the current service record."}</p>
      </section>
    );
  }

  const title = state.title;
  const message = state.message;
  const action = state.kind === "empty" ? state.action : state.retryHref
    ? { href: state.retryHref, label: "Try again" }
    : undefined;

  return (
    <section className={`${styles.statePanel} ${state.kind === "error" ? styles.stateError : ""}`}>
      <ShieldAlert aria-hidden="true" size={24} />
      <h1>{title}</h1>
      <p>{message}</p>
      {action ? <Link href={action.href}>{action.label}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
    </section>
  );
}

function FactValue({ fact }: { fact?: DetailFactViewModel }) {
  if (!fact) return <strong>Not recorded</strong>;
  const content = (
    <>
      <strong>{fact.value}</strong>
      {fact.helperText ? <small>{fact.helperText}</small> : null}
    </>
  );
  return fact.link ? (
    <Link className={styles.inlineFactLink} href={fact.link.href}>
      <span>{content}</span>
      <ChevronRight aria-hidden="true" size={15} />
    </Link>
  ) : <span className={styles.factValue}>{content}</span>;
}

function CaseAction({ action, primary = false }: {
  action?: { href: string; label: string };
  primary?: boolean;
}) {
  if (!action) return null;
  return (
    <Link className={primary ? styles.primaryAction : styles.secondaryAction} href={action.href}>
      {action.label}
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

function EvidenceTable({ table }: { table: TableViewModel }) {
  if (!table.rows.length) {
    return <p className={styles.emptyMessage}>No source records have been added here yet.</p>;
  }

  return (
    <div className={styles.tableFrame}>
      <table>
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th data-align={column.align ?? "start"} scope="col" key={column.key}>{column.label}</th>
            ))}
            <th className={styles.openColumn} scope="col"><span className={styles.visuallyHidden}>Open record</span></th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id}>
              {table.columns.map((column, index) => {
                const cell = row.cells.find((candidate) => candidate.key === column.key);
                const cellContent = (
                  <>
                    <span className={cell?.tone ? toneStyles[cell.tone] : undefined}>{cell?.value ?? "—"}</span>
                    {cell?.secondary ? <small>{cell.secondary}</small> : null}
                  </>
                );
                return (
                  <td data-align={column.align ?? "start"} key={column.key}>
                    {index === 0 ? <Link className={styles.rowLink} href={row.href}>{cellContent}</Link> : cellContent}
                  </td>
                );
              })}
              <td className={styles.openColumn}><Link href={row.href} aria-label={`Open ${row.label}`}><ChevronRight aria-hidden="true" size={16} /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactGrid({ facts }: { facts: DetailFactViewModel[] }) {
  if (!facts.length) return <p className={styles.emptyMessage}>No details have been recorded yet.</p>;
  return (
    <dl className={styles.factGrid}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd><FactValue fact={fact} /></dd>
        </div>
      ))}
    </dl>
  );
}

function Timeline({ section }: { section?: DetailSectionViewModel }) {
  const events = section?.timeline ?? [];
  if (!events.length) return <p className={styles.emptyMessage}>No activity has been recorded yet.</p>;
  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id}>
          <span className={`${styles.timelineDot} ${toneStyles[event.tone ?? "neutral"]}`} aria-hidden="true" />
          <div>
            <header><strong>{event.title}</strong><time>{event.timestampLabel}</time></header>
            {event.description ? <p>{event.description}</p> : null}
            <footer>
              <span>{event.actorLabel}</span>
              {event.link ? <Link href={event.link.href}>{event.link.label}<ChevronRight aria-hidden="true" size={14} /></Link> : null}
            </footer>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RecordBlock({ section, icon, keepAnchor = true }: { section?: DetailSectionViewModel; icon: ReactNode; keepAnchor?: boolean }) {
  if (!section) return null;
  return (
    <article className={styles.recordBlock} id={keepAnchor ? section.id : undefined}>
      <header className={styles.recordBlockHeader}>
        <span>{icon}</span>
        <div><h3>{section.title}</h3>{section.description ? <p>{section.description}</p> : null}</div>
        {section.action ? <Link href={section.action.href}>{section.action.label}<ArrowRight aria-hidden="true" size={15} /></Link> : null}
      </header>
      {section.facts ? <FactGrid facts={section.facts} /> : null}
      {section.table ? <EvidenceTable table={section.table} /> : null}
      {section.timeline ? <Timeline section={section} /> : null}
      {!section.facts && !section.table && !section.timeline ? <p className={styles.emptyMessage}>No details have been recorded yet.</p> : null}
    </article>
  );
}

function WorkspaceSection({
  id,
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.workspaceSection} id={id} aria-labelledby={`${id}-heading`}>
      <header className={styles.sectionHeader}>
        <span>{icon}</span>
        <div><p>{eyebrow}</p><h2 id={`${id}-heading`}>{title}</h2><span>{description}</span></div>
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function ServicePathChoice({
  control,
  issuance,
  estimateComparison,
}: {
  control: WorkOrderControlViewModel;
  issuance: VendorIssuanceViewModel;
  estimateComparison: EstimateComparisonViewModel;
}) {
  const directState = issuance.currentRevision
    ? `Authorization revision ${issuance.currentRevision} issued`
    : issuance.workflowBlocked
      ? "Paused while bid sourcing is open"
      : issuance.permitted
        ? "Available now"
        : "Review only in the current state";
  const bidState = estimateComparison.selectedVendorName
    ? `${estimateComparison.selectedVendorName} selected`
    : estimateComparison.activeRequestCount
      ? `${estimateComparison.activeRequestCount} open request${estimateComparison.activeRequestCount === 1 ? "" : "s"}`
      : estimateComparison.proposalCount
        ? `${estimateComparison.proposalCount} bid${estimateComparison.proposalCount === 1 ? "" : "s"} received`
        : estimateComparison.permitted
          ? "Available now"
          : "Review only in the current state";

  return (
    <div className={styles.serviceChoice}>
      {control.assignment?.kind === "internal" ? (
        <div className={styles.internalAssignment}>
          <span><Wrench aria-hidden="true" size={18} /></span>
          <div><small>Current fulfillment</small><strong>Internal maintenance</strong><p>{control.assignment.providerLabel} · {sentence(control.assignment.status)}</p></div>
        </div>
      ) : null}
      <div className={styles.choiceGuardrail}>
        <ShieldAlert aria-hidden="true" size={18} />
        <p><strong>Choose one next step deliberately.</strong> A service authorization permits work and technician check-in. A bid request asks for pricing only and creates no assignment, visit, or billable service.</p>
      </div>
      <div className={styles.pathGrid}>
        <article className={styles.pathCard} data-path="service">
          <header><span><Send aria-hidden="true" size={19} /></span><div><small>Direct service</small><h3>Authorize a known provider</h3></div></header>
          <p>Use this when the operator has chosen who should perform the work. Sending creates a versioned service authorization.</p>
          <footer><span><CircleDot aria-hidden="true" size={14} />{directState}</span>{issuance.available ? <a href="#issue-work">Open service authorization<ArrowRight aria-hidden="true" size={15} /></a> : null}</footer>
        </article>
        <article className={styles.pathCard} data-path="pricing">
          <header><span><CircleDollarSign aria-hidden="true" size={19} /></span><div><small>Pricing only</small><h3>Request and compare bids</h3></div></header>
          <p>Use this before selecting a provider or when replacement pricing is needed. Vendors are not authorized to travel or check in.</p>
          <footer><span><CircleDot aria-hidden="true" size={14} />{bidState}</span>{estimateComparison.available ? <a href="#bid-requests">Open bid workspace<ArrowRight aria-hidden="true" size={15} /></a> : null}</footer>
        </article>
      </div>
    </div>
  );
}

export function WorkOrderCase({
  model,
  control,
  recording,
  estimateComparison,
  issuance,
  replacement,
  updated,
}: WorkOrderCaseProps) {
  if (model.state.kind !== "ready") {
    return <div className={styles.page}><DataStatePanel state={model.state} /></div>;
  }

  const store = factByLabel(model, "Store");
  const assigned = factByLabel(model, "Assigned to");
  const classification = factByLabel(model, "Classification");
  const recordedCost = factByLabel(model, "Recorded work cost");
  const authorization = sectionById(model, "authorization");
  const visits = sectionById(model, "visits");
  const costs = sectionById(model, "cost");
  const invoices = sectionById(model, "invoice-references");
  const timeline = sectionById(model, "timeline");
  const nte = sectionFact(authorization, "Not to exceed");
  const selectedAsset = recording.assets.find((asset) => asset.value === recording.currentAssetId);
  const selectedComponent = recording.components.find((component) => component.value === recording.currentComponentId);

  return (
    <div className={styles.page}>
      <header className={styles.caseHeader}>
        <div className={styles.caseIdentityRow}>
          <Link className={styles.backLink} href={model.backLink.href} aria-label={model.backLink.label}><ArrowLeft aria-hidden="true" size={18} /></Link>
          <div className={styles.caseIdentity}>
            <span>{model.page.eyebrow ?? "Operator work order"}</span>
            <h1>{model.page.title}</h1>
            {store ? <FactValue fact={store} /> : <small>{model.page.scopeLabel}</small>}
          </div>
          <span className={`${styles.statusPill} ${toneStyles[model.statusTone ?? "neutral"]}`}><CircleDot aria-hidden="true" size={14} />{model.statusLabel}</span>
          <div className={styles.headerActions}>
            <CaseAction action={model.page.secondaryAction} />
            <CaseAction action={model.page.primaryAction} primary />
          </div>
        </div>
        <nav className={styles.caseTabs} aria-label="Work-order sections">
          <a href="#activity"><History aria-hidden="true" size={16} />Activity</a>
          <a href="#service"><Wrench aria-hidden="true" size={16} />Service</a>
          <a href="#visits"><MapPin aria-hidden="true" size={16} />Visits</a>
          <a href="#cost"><ReceiptText aria-hidden="true" size={16} />Cost</a>
          <a href="#equipment"><PackageSearch aria-hidden="true" size={16} />Equipment</a>
        </nav>
      </header>

      <section className={styles.caseBrief} aria-label="Work-order accountability">
        <div className={styles.problemStatement}>
          <span>Service need</span>
          <h2>{model.page.description}</h2>
          <p>{model.page.scopeLabel}</p>
        </div>
        <div className={styles.accountabilityGrid}>
          <div><span><UserRound aria-hidden="true" size={16} />Accountable party</span><strong>{control.accountableParty || "Not assigned"}</strong></div>
          <div className={styles.nextAction}><span><CheckCircle2 aria-hidden="true" size={16} />Next required action</span><strong>{control.nextAction || "No next action recorded"}</strong></div>
          <div><span><Clock3 aria-hidden="true" size={16} />Due</span><strong>{dueLabel(control.dueAt)}</strong></div>
          <div><span><ShieldAlert aria-hidden="true" size={16} />Escalate to</span><strong>{control.escalationTo || "Not set"}</strong></div>
        </div>
        <dl className={styles.caseMeta}>
          <div><dt>Priority</dt><dd>{sentence(control.priority)}</dd></div>
          <div><dt>Fulfillment</dt><dd>{assigned?.value ?? control.assignment?.providerLabel ?? "Choose later"}</dd></div>
          <div><dt>Authorization limit</dt><dd>{nte?.value ?? "Not set"}</dd></div>
          <div><dt>Classification</dt><dd>{classification?.value ?? "Deferred"}</dd></div>
        </dl>
      </section>

      <MutationReceipt code={updated} />

      <WorkspaceSection
        id="activity"
        eyebrow="Control and history"
        title="Accountable work state"
        description="The current owner and next action stay visible while every change remains attributable."
        icon={<History aria-hidden="true" size={20} />}
      >
        <div className={styles.panelRegion}><WorkOrderControlPanel model={control} /></div>
        <RecordBlock section={timeline} icon={<History aria-hidden="true" size={18} />} />
      </WorkspaceSection>

      <WorkspaceSection
        id="service"
        eyebrow="Routing and authorization"
        title="Choose the service path"
        description="Direct service and vendor pricing are separate workflows with separate consequences."
        icon={<Truck aria-hidden="true" size={20} />}
      >
        <ServicePathChoice control={control} issuance={issuance} estimateComparison={estimateComparison} />
        <div className={styles.servicePanels}>
          <div className={styles.panelRegion} data-panel="authorization"><VendorIssuancePanel model={issuance} /></div>
          <div className={styles.panelRegion} data-panel="pricing"><EstimateComparisonPanel model={estimateComparison} /></div>
        </div>
        <RecordBlock section={authorization} icon={<FileText aria-hidden="true" size={18} />} />
      </WorkspaceSection>

      <WorkspaceSection
        id="visits"
        eyebrow="Observed presence"
        title="Technician visits"
        description="Check-in and checkout add approximate presence evidence without claiming certified labor."
        icon={<MapPin aria-hidden="true" size={20} />}
      >
        <RecordBlock section={visits} icon={<MapPin aria-hidden="true" size={18} />} keepAnchor={false} />
      </WorkspaceSection>

      <WorkspaceSection
        id="cost"
        eyebrow="Source-linked cost"
        title="Recorded work and invoice evidence"
        description="Entered work cost, authorization, and optional invoice references stay distinct and explainable."
        icon={<ReceiptText aria-hidden="true" size={20} />}
      >
        <div className={styles.costSummary}>
          <div><small>Recorded work cost</small><FactValue fact={recordedCost} /></div>
          <div><small>Authorization limit</small><FactValue fact={nte} /></div>
          <div><small>Invoice safeguards</small><strong>{invoices?.table?.rows.length ?? 0} linked reference{invoices?.table?.rows.length === 1 ? "" : "s"}</strong></div>
        </div>
        <div className={styles.panelRegion}><WorkOrderRecordingPanel model={recording} /></div>
        <RecordBlock section={costs} icon={<CircleDollarSign aria-hidden="true" size={18} />} keepAnchor={false} />
        <RecordBlock section={invoices} icon={<ReceiptText aria-hidden="true" size={18} />} />
      </WorkspaceSection>

      <WorkspaceSection
        id="equipment"
        eyebrow="Classification and lifecycle"
        title="Equipment context"
        description="Equipment and component depth remain optional; when linked, the same work record powers repeat-repair and planning evidence."
        icon={<PackageSearch aria-hidden="true" size={20} />}
      >
        <div className={styles.equipmentSummary}>
          <div><span><Tags aria-hidden="true" size={16} />Service area</span><strong>{recording.currentCategory ? sentence(recording.currentCategory) : classification?.value ?? "Deferred"}</strong><small>Can be classified after diagnosis</small></div>
          <div><span><PackageSearch aria-hidden="true" size={16} />Equipment</span><strong>{selectedAsset?.label ?? replacement.assetName ?? "Not linked"}</strong><small>{selectedAsset?.description ?? "Equipment is not required to keep work moving"}</small></div>
          <div><span><Wrench aria-hidden="true" size={16} />Component</span><strong>{selectedComponent?.label ?? "Not linked"}</strong><small>{selectedComponent?.description ?? "Optional depth for repeat work and warranty history"}</small></div>
          <div><span><CircleDollarSign aria-hidden="true" size={16} />Capital context</span><strong>{replacement.assetName ? "Available for review" : "Needs linked equipment"}</strong><small>Human planning evidence, never an automatic replacement decision</small></div>
        </div>
        {recording.canClassify ? <a className={styles.inlineAction} href="#work-records">Update service area or equipment classification<ArrowRight aria-hidden="true" size={15} /></a> : null}
        <div className={styles.panelRegion}><WorkOrderReplacementIntelligencePanel model={replacement} /></div>
      </WorkspaceSection>
    </div>
  );
}
