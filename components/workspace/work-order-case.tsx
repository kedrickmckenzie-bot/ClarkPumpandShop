import type { ReactNode } from "react";
import Link from "next/link";
import { WorkReviewButton, WorkEquipmentContext } from "./work-review";
import type { WorkReviewModel } from "@/lib/ops/work-review";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CircleDollarSign,
  CircleDot,
  Clock3,
  FileText,
  Gauge,
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
  DemoEdition,
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
import { WorkflowTaskPanel } from "@/components/ops/workflow-task-panel";
import { WorkOrderVerificationPanel } from "@/components/ops/work-order-verification-panel";
import type { WorkOrderVerificationViewModel } from "@/app/app/_data/work-order-verification-presenter";
import {
  WorkOrderReplacementIntelligencePanel,
  type WorkOrderReplacementIntelligenceViewModel,
} from "@/components/ops/replacement-intelligence-panel";
import { WorkOrderStageRail } from "@/components/workspace/work-order-case-stage-rail";
import styles from "./work-order-case.module.css";
import { domainLabel } from "@/lib/product/domain-label";
import { workspaceStartHref } from "@/lib/ops/navigation-trail";
import { DEFAULT_OPERATIONS_TIME_ZONE, formatOperationsDateTime } from "@/lib/ops/local-time";
import type { WorkOrderCaseView } from "@/lib/ops/work-order-case";
import { HeldWorkActions, type HeldWorkActionsModel } from "@/components/workspace/held-work-actions";
import { VendorResponseActions, type VendorResponseActionsModel } from "@/components/workspace/vendor-response-actions";
import {
  resolveWorkOrderWorkspace,
  type WorkOrderServicePath,
  type WorkOrderWorkspaceMode,
} from "@/lib/ops/work-order-workspace";

interface WorkOrderCaseProps {
  connectedReview?: WorkReviewModel | null;
  model: DetailPageViewModel;
  control: WorkOrderControlViewModel;
  recording: WorkOrderRecordingViewModel;
  estimateComparison: EstimateComparisonViewModel;
  issuance: VendorIssuanceViewModel;
  replacement: WorkOrderReplacementIntelligenceViewModel;
  verification: WorkOrderVerificationViewModel;
  canonicalCase: WorkOrderCaseView;
  viewerAction?: { href: string; label: string };
  heldWork: HeldWorkActionsModel;
  vendorResponse?: VendorResponseActionsModel;
  activeView: WorkOrderView;
  activeServicePath?: WorkOrderServicePath;
  edition?: DemoEdition;
  updated?: string;
}

export type WorkOrderView = "overview" | "service" | "visits" | "cost" | "equipment" | "activity";

const caseViews: Array<{ id: WorkOrderView; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Overview", icon: <Gauge aria-hidden="true" size={16} /> },
  { id: "service", label: "Service", icon: <Wrench aria-hidden="true" size={16} /> },
  { id: "visits", label: "Visits & notes", icon: <MapPin aria-hidden="true" size={16} /> },
  { id: "cost", label: "Costs", icon: <ReceiptText aria-hidden="true" size={16} /> },
  { id: "equipment", label: "Equipment", icon: <PackageSearch aria-hidden="true" size={16} /> },
  { id: "activity", label: "History & follow-up", icon: <History aria-hidden="true" size={16} /> },
];

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

function dueLabel(value: string | undefined, timeZone = DEFAULT_OPERATIONS_TIME_ZONE) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not set";
  return formatOperationsDateTime(value, timeZone);
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
                  <td data-label={column.label} data-align={column.align ?? "start"} key={column.key}>
                    {(cell?.link || index === 0) ? <Link className={styles.rowLink} href={workspaceStartHref(cell?.link?.href ?? row.href)}>{cellContent}</Link> : cellContent}
                  </td>
                );
              })}
              <td className={styles.openColumn}><WorkReviewButton href={row.href} label={row.label} /><Link href={workspaceStartHref(row.href)} aria-label={`Open ${row.label}`}><ChevronRight aria-hidden="true" size={16} /></Link></td>
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
  workOrderId,
}: {
  control: WorkOrderControlViewModel;
  issuance: VendorIssuanceViewModel;
  estimateComparison: EstimateComparisonViewModel;
  workOrderId: string;
}) {
  const directState = issuance.currentRevision
    ? `Authorization version ${issuance.currentRevision} sent`
    : issuance.workflowBlocked
      ? "Paused while quote sourcing is open"
      : issuance.permitted
        ? "Available now"
        : "Review only in the current state";
  const bidState = estimateComparison.selectedVendorName
    ? `${estimateComparison.selectedVendorName} selected`
    : estimateComparison.activeRequestCount
      ? `${estimateComparison.activeRequestCount} open request${estimateComparison.activeRequestCount === 1 ? "" : "s"}`
      : estimateComparison.proposalCount
        ? `${estimateComparison.proposalCount} quote${estimateComparison.proposalCount === 1 ? "" : "s"} received`
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
        <p><strong>Choose how you want to handle this work.</strong> A service authorization permits work and technician check-in. A quote request asks for pricing only and creates no assignment, visit, or billable service.</p>
      </div>
      <div className={styles.pathGrid}>
        <article className={styles.pathCard} data-path="service">
          <header><span><Send aria-hidden="true" size={19} /></span><div><small>Direct service</small><h3>Authorize a known provider</h3></div></header>
          <p>Use this when the operator has chosen who should perform the work. Sending creates a versioned service authorization.</p>
          <footer><span><CircleDot aria-hidden="true" size={14} />{directState}</span>{issuance.available ? <Link href={`/app/work-orders/${workOrderId}?view=service&path=direct#issue-work`}>Choose direct service<ArrowRight aria-hidden="true" size={15} /></Link> : null}</footer>
        </article>
        <article className={styles.pathCard} data-path="pricing">
          <header><span><CircleDollarSign aria-hidden="true" size={19} /></span><div><small>Pricing only</small><h3>Request and compare quotes</h3></div></header>
          <p>Use this before selecting a provider or when replacement pricing is needed. Vendors are not authorized to travel or check in.</p>
          <footer><span><CircleDot aria-hidden="true" size={14} />{bidState}</span>{estimateComparison.available ? <Link href={`/app/work-orders/${workOrderId}?view=service&path=bids#bid-requests`}>Choose pricing first<ArrowRight aria-hidden="true" size={15} /></Link> : null}</footer>
        </article>
      </div>
    </div>
  );
}

function CaseOverview({
  control,
  recording,
  replacement,
  visits,
  invoices,
  recordedCost,
  nte,
  recordOrigin,
  accountabilityOnly,
  canonicalCase,
}: {
  control: WorkOrderControlViewModel;
  recording: WorkOrderRecordingViewModel;
  replacement: WorkOrderReplacementIntelligenceViewModel;
  visits?: DetailSectionViewModel;
  invoices?: DetailSectionViewModel;
  recordedCost?: DetailFactViewModel;
  nte?: DetailFactViewModel;
  recordOrigin?: DetailFactViewModel;
  accountabilityOnly: boolean;
  canonicalCase: WorkOrderCaseView;
}) {
  const base = `/app/work-orders/${control.workOrderId}`;
  const visitCount = visits?.table?.rows.length ?? 0;
  const noteCount = visits?.timeline?.length ?? 0;
  const invoiceCount = invoices?.table?.rows.length ?? 0;
  const selectedAsset = recording.assets.find((asset) => asset.value === recording.currentAssetId);
  const equipmentHref = selectedAsset
    ? `/app/equipment/${selectedAsset.value}#equipment-review`
    : `${base}?view=equipment`;

  return (
    <div className={styles.overviewWorkspace}>
      {recordOrigin ? (
        <section className={styles.afterFactNotice} aria-label="Work-order record origin">
          <History aria-hidden="true" size={19} />
          <div>
            <strong>{recordOrigin.value}</strong>
            <p>{recordOrigin.helperText}</p>
          </div>
          {recordOrigin.link ? <Link href={recordOrigin.link.href}>{recordOrigin.link.label}<ArrowRight aria-hidden="true" size={15} /></Link> : null}
        </section>
      ) : null}
      <section className={styles.recordMap} aria-label="Work-order evidence map">
        <Link href={canonicalCase.primaryNextAction.href}>
          <span><Truck size={18} aria-hidden="true" />Service workflow</span>
          <strong>{canonicalCase.serviceSubStage?.label ?? canonicalCase.stageLabel}</strong>
          <small>{canonicalCase.primaryNextAction.label} · {control.assignment?.providerLabel ?? "Provider not selected"}</small>
          <em>Open service workflow<ChevronRight size={15} aria-hidden="true" /></em>
        </Link>
        <Link href={`${base}?view=visits`}>
          <span><MapPin size={18} aria-hidden="true" />Visits & notes</span>
          <strong>{visitCount} linked visit{visitCount === 1 ? "" : "s"}</strong>
          <small>{noteCount} recorded note{noteCount === 1 ? "" : "s"} · check-in, checkout, and outcome history</small>
          <em>Review service history<ChevronRight size={15} aria-hidden="true" /></em>
        </Link>
        {!accountabilityOnly ? <Link href={`${base}?view=cost`}>
          <span><ReceiptText size={18} aria-hidden="true" />Cost evidence</span>
          <strong>{recordedCost?.value ?? recording.recordedCostLabel}</strong>
          <small>{nte?.value ? `${nte.value} authorization limit` : "No authorization limit recorded"} · {invoiceCount ? `${invoiceCount} invoice reference${invoiceCount === 1 ? "" : "s"}` : "No invoice entered — valid"}</small>
          <em>Explain cost<ChevronRight size={15} aria-hidden="true" /></em>
        </Link> : null}
        {!accountabilityOnly ? <Link href={equipmentHref}>
          <span><PackageSearch size={18} aria-hidden="true" />Equipment & lifecycle</span>
          <strong>{selectedAsset?.label ?? replacement.assetName ?? "Classification deferred"}</strong>
          <small>{selectedAsset ? "Open this equipment record, prior work orders, and service history" : "No equipment is linked to this work order yet"}</small>
          <em>{selectedAsset ? "Open equipment history" : "Link equipment"}<ChevronRight size={15} aria-hidden="true" /></em>
        </Link> : null}
      </section>
    </div>
  );
}

function CurrentStepPanel({ model, mode }: { model: WorkOrderCaseView; mode: WorkOrderWorkspaceMode }) {
  const terminal = mode === "closed";
  const waiting = mode === "waiting_on_vendor" || mode === "current_record";
  return (
    <section id={mode === "waiting_on_vendor" ? "vendor-response" : undefined} className={styles.currentStepPanel} aria-labelledby="current-step-heading">
      <div className={styles.currentStepCopy}>
        <p>{terminal ? "Completed case" : "What is happening now"}</p>
        <h3 id="current-step-heading">{model.plainLanguageState}</h3>
        <span>{model.blockingReason ?? (terminal
          ? "This work order is complete. Service controls are read-only; the full record remains available below."
          : waiting
            ? "No new routing decision is needed here. Open the recommended action or use another work-order section."
            : "Complete this step before the work order advances.")}</span>
      </div>
      <dl>
        <div><dt>{terminal ? "Record" : "Internal owner"}</dt><dd>{model.internalAccountableParty}</dd></div>
        <div><dt>{terminal ? "Open task" : "Next action owner"}</dt><dd>{model.nextActionOwner}</dd></div>
        <div><dt>{terminal ? "Deadline" : "Due"}</dt><dd>{terminal ? "None" : dueLabel(model.dueAt, model.timeZone)}<small>{model.deadlinePolicy}</small></dd></div>
        <div><dt>{terminal ? "Escalation" : "Escalation"}</dt><dd>{model.escalationDestination}<small>{model.escalationTrigger}</small></dd></div>
      </dl>
    </section>
  );
}

function CaseStateDimensions({ model }: { model: WorkOrderCaseView }) {
  const dimensions = [
    { eyebrow: "Service progress", value: model.serviceProgress },
    { eyebrow: "Operating condition", value: model.operatingCondition },
    { eyebrow: "Financial review", value: model.financialReview },
  ];
  return (
    <section className={styles.stateDimensions} aria-label="Independent work-order states">
      {dimensions.map(({ eyebrow, value }) => <article key={eyebrow}>
        <span>{eyebrow}</span>
        <strong>{value.label}</strong>
        <p>{value.detail}</p>
        {value.facts?.length ? <dl>{value.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
        {value.sourceLabel ? <small>{value.sourceLabel}{value.observedAt ? ` · ${dueLabel(value.observedAt, model.timeZone)}` : ""}{value.certainty ? ` · ${sentence(value.certainty)}` : ""}</small> : null}
      </article>)}
      {model.additionalObligations.length ? <details>
        <summary>{model.additionalObligations.length} additional open task{model.additionalObligations.length === 1 ? "" : "s"}<ChevronRight aria-hidden="true" size={16} /></summary>
        <div>{model.additionalObligations.map((obligation) => <Link href={obligation.href} key={obligation.id}>
          <strong>{obligation.label}</strong><span>{obligation.owner} · {obligation.dueAt ? dueLabel(obligation.dueAt, model.timeZone) : obligation.deadlinePolicy}</span>
        </Link>)}</div>
      </details> : null}
    </section>
  );
}

function VendorUpdateSummary({ model }: { model: VendorResponseActionsModel }) {
  const responseLabel = model.kind === "proposed_date" ? "Proposed a date"
    : model.kind === "question" ? "Asked a question"
      : model.kind === "declined" ? "Declined"
        : "Accepted";
  return (
    <section className={styles.vendorUpdate} aria-label="Latest vendor update">
      <div><small>Latest vendor update</small><strong>{responseLabel}</strong><p>{model.responderName}</p></div>
      {model.proposedAtLabel ? <div><small>Proposed service time</small><strong>{model.proposedAtLabel}</strong></div> : null}
      <div><small>Vendor message</small><strong>{model.message ?? "No additional message recorded"}</strong></div>
    </section>
  );
}

function BidHistory({ model }: { model: EstimateComparisonViewModel }) {
  if (!model.requests.length) return <p className={styles.emptyMessage}>No pricing requests have been recorded.</p>;
  return (
    <div className={styles.tableFrame}>
      <table>
        <caption>Vendor pricing history for {model.workOrderNumber}</caption>
        <thead><tr><th scope="col">Vendor</th><th scope="col">Request</th><th scope="col">Status</th><th scope="col">Latest proposal</th></tr></thead>
        <tbody>{model.requests.map((request) => (
          <tr key={request.id}>
            <td><strong>{request.vendorName}</strong></td>
            <td><span>{request.kindLabel}</span><small>{request.requestedLabel}</small></td>
            <td><span>{request.statusLabel}</span></td>
            <td><span>{request.latestProposal?.amountLabel ?? "No proposal recorded"}</span>{request.latestProposal ? <small>Revision {request.latestProposal.revision}</small> : null}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function ServiceRecordHistory({
  authorization,
  estimateComparison,
}: {
  authorization?: DetailSectionViewModel;
  estimateComparison: EstimateComparisonViewModel;
}) {
  if (!authorization && !estimateComparison.requests.length) return null;
  return (
    <details id="service-authorization-history" className={styles.historyDisclosure}>
      <summary>
        <span><History aria-hidden="true" size={18} /></span>
        <div><strong>Earlier authorization and pricing</strong><small>Read-only records from completed or inactive steps</small></div>
        <ChevronRight aria-hidden="true" size={17} />
      </summary>
      <div className={styles.historyDisclosureBody}>
        <RecordBlock section={authorization} icon={<FileText aria-hidden="true" size={18} />} />
        {estimateComparison.requests.length ? <section className={styles.historyBlock}><header><h3>Vendor pricing history</h3><p>Pricing requests remain separate from service authorization.</p></header><BidHistory model={estimateComparison} /></section> : null}
      </div>
    </details>
  );
}

function workspaceHeading(mode: WorkOrderWorkspaceMode, accountabilityOnly: boolean) {
  if (mode === "held") return { eyebrow: "Approved work", title: "Approved for a future visit", description: "This work stays open until a suitable onsite vendor accepts it, or a manager returns it to normal service." };
  if (mode === "closed") return { eyebrow: "Completed case", title: "Service record", description: "Review what happened. No authorization, quote, or routing action is available on a closed work order." };
  if (mode === "vendor_response") return { eyebrow: "Vendor response", title: "Respond to the vendor", description: "Resolve the vendor's current response before any later service step becomes available." };
  if (mode === "waiting_on_vendor") return { eyebrow: "Vendor handoff", title: "Waiting on the current vendor step", description: "The work is already routed. Track the current response or confirmed appointment without starting another sourcing path." };
  if (mode === "choose_path") return { eyebrow: "Provider decision", title: accountabilityOnly ? "Choose the vendor" : "Choose how this work should be sourced", description: accountabilityOnly ? "Select the outside vendor that should receive this work order." : "Authorize a known provider or request pricing first. Choosing one opens only that workflow." };
  if (mode === "direct_service") return { eyebrow: "Direct service", title: "Send the service authorization", description: "Confirm the provider and send the operator work order that authorizes service." };
  if (mode === "bids") return { eyebrow: "Pricing only", title: "Request and compare vendor pricing", description: "Collect numbers without assigning a provider or permitting a technician visit." };
  return { eyebrow: "Current work", title: "Follow the active service step", description: "Routing history remains available below, but this work order advances only through the current stage." };
}

export function WorkOrderCase({
  connectedReview,
  model,
  control,
  recording,
  estimateComparison,
  issuance,
  replacement,
  verification,
  canonicalCase,
  viewerAction,
  heldWork,
  vendorResponse,
  activeView,
  activeServicePath,
  edition = "complete",
  updated,
}: WorkOrderCaseProps) {
  if (model.state.kind !== "ready") {
    return <div className={styles.page}><DataStatePanel state={model.state} /></div>;
  }

  const store = factByLabel(model, "Store");
  const assigned = factByLabel(model, "Assigned to");
  const classification = factByLabel(model, "Classification");
  const recordedCost = factByLabel(model, "Recorded work cost");
  const recordOrigin = factByLabel(model, "Record origin");
  const originalRequest = sectionById(model, "original-request");
  const relatedReports = sectionById(model, "related-reports");
  const authorization = sectionById(model, "authorization");
  const visits = sectionById(model, "visits");
  const costs = sectionById(model, "cost");
  const invoices = sectionById(model, "invoice-references");
  const timeline = sectionById(model, "timeline");
  const nte = sectionFact(authorization, "Not to exceed");
  const selectedAsset = recording.assets.find((asset) => asset.value === recording.currentAssetId);
  const selectedComponent = recording.components.find((component) => component.value === recording.currentComponentId);
  const canonicalStatus = canonicalCase.plainLanguageState;
  const canonicalTone: Tone = canonicalCase.stage === "closed"
    ? "positive"
    : canonicalCase.primaryActionOverdue
      ? "critical"
      : canonicalCase.stage === "onsite_service" || canonicalCase.stage === "vendor_response_scheduling"
        ? "info"
        : "warning";
  const accountabilityOnly = edition === "accountability";
  const workspaceMode = resolveWorkOrderWorkspace({
    stage: canonicalCase.stage,
    serviceSubStage: canonicalCase.serviceSubStage?.id,
    heldStatus: heldWork.hold?.status,
    vendorResponseKind: vendorResponse?.kind,
    activeBidRequestCount: estimateComparison.activeRequestCount,
    proposalCount: estimateComparison.proposalCount,
    selectedVendorName: estimateComparison.selectedVendorName,
    selectedDecisionKind: estimateComparison.selectedDecisionKind,
    currentIssuanceRevision: issuance.currentRevision,
    requestedPath: activeServicePath,
  });
  const serviceHeading = workspaceHeading(workspaceMode, accountabilityOnly);
  const canChangeRequestedServicePath = Boolean(activeServicePath)
    && (canonicalCase.stage === "provider_decision" || vendorResponse?.kind === "declined");
  const hasDedicatedFollowUpAction = canonicalCase.stage === "followup_closeout"
    && canonicalCase.primaryNextAction.href.startsWith("/app/action-center/");
  const visibleCaseViews = accountabilityOnly
    ? caseViews.filter((view) => ["overview", "service", "visits"].includes(view.id))
    : caseViews
  ;

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
          <span className={`${styles.statusPill} ${toneStyles[canonicalTone]}`}><CircleDot aria-hidden="true" size={14} />{canonicalStatus}</span>
          <div className={styles.headerActions}>
            <CaseAction action={model.page.secondaryAction} />
            <CaseAction action={viewerAction} primary />
          </div>
        </div>
        <nav className={styles.caseTabs} aria-label="Work-order sections">
          {visibleCaseViews.map((view) => (
            <Link
              aria-current={activeView === view.id ? "page" : undefined}
              className={activeView === view.id ? styles.activeTab : undefined}
              href={`/app/work-orders/${control.workOrderId}?view=${view.id}`}
              key={view.id}
            >
              {view.icon}{view.label}
            </Link>
          ))}
        </nav>
      </header>

      {activeView === "overview" ? (
        <section className={styles.caseBrief} aria-label="Work-order summary">
          <div className={styles.problemStatement}>
            <div className={styles.problemStatementHeader}>
              <span>{originalRequest ? "Original store report" : "Service need"}</span>
              {originalRequest?.action ? <Link href={originalRequest.action.href}>{originalRequest.action.label}<ArrowRight aria-hidden="true" size={15} /></Link> : null}
            </div>
            <h2>{originalRequest?.description ?? model.page.description}</h2>
            <p>
              {originalRequest
                ? `${sectionFact(originalRequest, "Request")?.value ?? "Request"} · Reported by ${sectionFact(originalRequest, "Reported by")?.value ?? "Not recorded"} · ${sectionFact(originalRequest, "Reported")?.value ?? "Time not recorded"}`
                : model.page.scopeLabel}
            </p>
          </div>
          <div className={styles.accountabilityGrid}>
            <div><span><UserRound aria-hidden="true" size={16} />Responsible person or team</span><strong>{canonicalCase.internalAccountableParty}<small>{canonicalCase.internalAccountabilityStructured ? canonicalCase.internalAccountableType === "team" ? "Accountable team" : "Named accountable person" : "Facilities can assign a named person or team"}</small></strong></div>
            <div className={styles.nextAction}><span><CheckCircle2 aria-hidden="true" size={16} />Next action</span><strong>{canonicalCase.primaryNextAction.label}<small>{canonicalCase.nextActionOwner}</small></strong></div>
            <div><span><Gauge aria-hidden="true" size={16} />Latest operating observation</span><strong>{canonicalCase.operatingCondition.label}<small>{canonicalCase.operatingCondition.sourceLabel ?? "No source observation"}{canonicalCase.operatingCondition.observedAt ? ` · ${dueLabel(canonicalCase.operatingCondition.observedAt, canonicalCase.timeZone)}` : ""}</small></strong></div>
            <div><span><Clock3 aria-hidden="true" size={16} />Expected by</span><strong>{dueLabel(canonicalCase.dueAt, canonicalCase.timeZone)}<small>{canonicalCase.deadlinePolicy}</small></strong></div>
          </div>
          <dl className={styles.caseMeta}>
            <div><dt>Priority</dt><dd>{sentence(control.priority)}</dd></div>
            <div><dt>Fulfillment</dt><dd><FactValue fact={assigned} /></dd></div>
            <div><dt>Escalates to</dt><dd>{canonicalCase.escalationDestination}</dd></div>
            {recordOrigin ? <div><dt>{recordOrigin.label}</dt><dd><FactValue fact={recordOrigin} /></dd></div> : null}
            {!accountabilityOnly ? <div><dt>Authorization limit</dt><dd>{nte?.value ?? "Not set"}</dd></div> : null}
            {!accountabilityOnly ? <div><dt>Classification</dt><dd>{classification?.value ?? "Deferred"}</dd></div> : null}
          </dl>
        </section>
      ) : (
        <section className={styles.caseContextStrip} aria-label="Current work-order context">
          <Link href={`/app/work-orders/${control.workOrderId}?view=overview`}><span>Service need</span><strong>{model.page.description}</strong><small>Open work-order summary</small></Link>
          <Link className={styles.contextPrimary} href={canonicalCase.primaryNextAction.href}><span>Service progress</span><strong>{canonicalCase.plainLanguageState}</strong><small>Recommended: {canonicalCase.primaryNextAction.label}</small></Link>
          <Link href={`/app/work-orders/${control.workOrderId}?view=activity`}><span>Internal / next owner</span><strong>{canonicalCase.internalAccountableParty} / {canonicalCase.nextActionOwner}</strong><small>Due {dueLabel(canonicalCase.dueAt, canonicalCase.timeZone)}</small></Link>
        </section>
      )}

      <MutationReceipt code={updated} />

      {activeView === "overview" && !accountabilityOnly ? <WorkOrderStageRail model={canonicalCase} /> : null}

      {activeView === "overview" ? <CaseStateDimensions model={canonicalCase} /> : null}

      {activeView === "overview" ? (
        <>
          <CaseOverview
            control={control}
            recording={recording}
            replacement={replacement}
            visits={visits}
            invoices={invoices}
            recordedCost={recordedCost}
            nte={nte}
            recordOrigin={recordOrigin}
            accountabilityOnly={accountabilityOnly}
            canonicalCase={canonicalCase}
          />
          {connectedReview?.equipmentScope && !accountabilityOnly ? <WorkspaceSection id="equipment-context" eyebrow="Related service evidence" title="Equipment history and current options" description="Prior outcomes, recorded warranty terms, and available quotes for the equipment scope of this work." icon={<PackageSearch aria-hidden="true" size={20} />}><WorkEquipmentContext model={connectedReview} /></WorkspaceSection> : null}
          <WorkspaceSection
            id="work-history"
            eyebrow="Complete case file"
            title="Work history"
            description="The original report, vendor responses, technician visits, checkout notes, and work-order updates stay together here. Open a visit only when you need its detailed check-in evidence."
            icon={<History aria-hidden="true" size={20} />}
          >
            <RecordBlock section={relatedReports} icon={<ClipboardCheck aria-hidden="true" size={18} />} keepAnchor={false} />
            <RecordBlock section={visits} icon={<MapPin aria-hidden="true" size={18} />} keepAnchor={false} />
            <RecordBlock section={timeline} icon={<History aria-hidden="true" size={18} />} keepAnchor={false} />
          </WorkspaceSection>
        </>
      ) : null}

      {activeView === "activity" ? <WorkspaceSection
        id="activity"
        eyebrow="Status and history"
        title="Work status and follow-up"
        description={hasDedicatedFollowUpAction
          ? "Complete the open follow-up first. The broader work-order controls and full history remain available without competing with that decision."
          : "See who owns the work, make an update when needed, and review what changed over time."}
        icon={<History aria-hidden="true" size={20} />}
      >
        {hasDedicatedFollowUpAction ? <CurrentStepPanel model={canonicalCase} mode={workspaceMode} /> : null}
        {hasDedicatedFollowUpAction ? (
          <details id="service-authorization-history" className={styles.historyDisclosure}>
            <summary>
              <span><Wrench aria-hidden="true" size={17} /></span>
              <div><strong>Additional work-order controls</strong><small>Create another task, record a status update, or add a separate follow-up only when needed.</small></div>
              <ChevronRight aria-hidden="true" size={17} />
            </summary>
            <div className={styles.historyDisclosureBody}>
              <div className={styles.panelRegion}><WorkflowTaskPanel model={control.workflowTasks} /></div>
              <div className={styles.panelRegion}><WorkOrderControlPanel model={control} /></div>
            </div>
          </details>
        ) : (
          <>
            <div className={styles.panelRegion}><WorkflowTaskPanel model={control.workflowTasks} /></div>
            <div className={styles.panelRegion}><WorkOrderControlPanel model={control} /></div>
          </>
        )}
        <RecordBlock section={timeline} icon={<History aria-hidden="true" size={18} />} />
      </WorkspaceSection> : null}

      {activeView === "service" ? <WorkspaceSection
        id="service"
        eyebrow={serviceHeading.eyebrow}
        title={serviceHeading.title}
        description={serviceHeading.description}
        icon={<Truck aria-hidden="true" size={20} />}
      >
        <CurrentStepPanel model={canonicalCase} mode={workspaceMode} />
        {workspaceMode === "held" && !accountabilityOnly ? <HeldWorkActions model={heldWork} /> : null}
        {workspaceMode === "vendor_response" && vendorResponse ? <VendorResponseActions model={vendorResponse} /> : null}
        {workspaceMode === "waiting_on_vendor" && vendorResponse ? <VendorUpdateSummary model={vendorResponse} /> : null}
        {workspaceMode === "choose_path" ? <ServicePathChoice control={control} issuance={issuance} estimateComparison={estimateComparison} workOrderId={control.workOrderId} /> : null}
        {canChangeRequestedServicePath && (workspaceMode === "direct_service" || workspaceMode === "bids") ? (
          <Link className={styles.changePathLink} href={`/app/work-orders/${control.workOrderId}?view=service`}>
            <ArrowLeft aria-hidden="true" size={15} />Change service path
          </Link>
        ) : null}
        {workspaceMode === "direct_service" ? <div className={styles.panelRegion} data-panel="authorization"><VendorIssuancePanel model={issuance} edition={edition} /></div> : null}
        {workspaceMode === "bids" && !accountabilityOnly ? <div className={styles.panelRegion} data-panel="pricing"><EstimateComparisonPanel model={estimateComparison} /></div> : null}
        {workspaceMode !== "held" ? <ServiceRecordHistory authorization={authorization} estimateComparison={estimateComparison} /> : null}
      </WorkspaceSection> : null}

      {activeView === "visits" ? <WorkspaceSection
        id="visits"
        eyebrow="Service record"
        title="Technician visits and notes"
        description="See every linked check-in, checkout, outcome, and service note. This history remains with the work order after it is closed."
        icon={<MapPin aria-hidden="true" size={20} />}
      >
        <div className={styles.panelRegion}><WorkOrderVerificationPanel model={verification} /></div>
        <RecordBlock section={visits} icon={<MapPin aria-hidden="true" size={18} />} keepAnchor={false} />
      </WorkspaceSection> : null}

      {activeView === "cost" ? <WorkspaceSection
        id="cost"
        eyebrow="Costs"
        title="Work costs and invoices"
        description="Entered work costs, authorization limits, and optional invoice references stay separate and easy to trace."
        icon={<ReceiptText aria-hidden="true" size={20} />}
      >
        <div className={styles.costSummary}>
          <div><small>Recorded work cost</small><FactValue fact={recordedCost} /></div>
          <div><small>Authorization limit</small><FactValue fact={nte} /></div>
          <div><small>Invoice references</small><strong>{invoices?.table?.rows.length ?? 0} linked reference{invoices?.table?.rows.length === 1 ? "" : "s"}</strong></div>
        </div>
        <div className={styles.panelRegion}><WorkOrderRecordingPanel model={recording} /></div>
        <RecordBlock section={costs} icon={<CircleDollarSign aria-hidden="true" size={18} />} keepAnchor={false} />
        <RecordBlock section={invoices} icon={<ReceiptText aria-hidden="true" size={18} />} />
      </WorkspaceSection> : null}

      {activeView === "equipment" ? <WorkspaceSection
        id="equipment"
        eyebrow="Equipment"
        title="Equipment details"
        description="Equipment and components are optional. Link them when useful for service history, repeat repairs, and replacement planning."
        icon={<PackageSearch aria-hidden="true" size={20} />}
      >
        {connectedReview ? <WorkEquipmentContext model={connectedReview} /> : null}
        <div className={styles.equipmentSummary}>
          <div><span><Tags aria-hidden="true" size={16} />Service area</span><strong>{recording.currentCategory ? sentence(recording.currentCategory) : classification?.value ?? "Deferred"}</strong><small>Can be classified after diagnosis</small></div>
          <div><span><PackageSearch aria-hidden="true" size={16} />Equipment</span><strong>{selectedAsset?.label ?? replacement.assetName ?? "Not linked"}</strong><small>{selectedAsset?.description ?? "This work order does not have an equipment history until an equipment record is linked"}</small></div>
          <div><span><Wrench aria-hidden="true" size={16} />Component</span><strong>{selectedComponent?.label ?? "Not linked"}</strong><small>{selectedComponent?.description ?? "Optional depth for repeat work and warranty history"}</small></div>
          <div><span><CircleDollarSign aria-hidden="true" size={16} />Capital context</span><strong>{replacement.assetName ? "Available for review" : "Needs linked equipment"}</strong><small>Human planning evidence, never an automatic replacement decision</small></div>
        </div>
        <div className={styles.inlineActions}>
          {selectedAsset ? <Link className={styles.inlineAction} href={`/app/equipment/${selectedAsset.value}#equipment-review`}>Open equipment history<ArrowRight aria-hidden="true" size={15} /></Link> : null}
          {recording.canClassify ? <Link className={styles.inlineAction} href={`/app/work-orders/${control.workOrderId}?view=cost#work-records`}>{selectedAsset ? "Change linked equipment" : "Link equipment to this work order"}<ArrowRight aria-hidden="true" size={15} /></Link> : null}
        </div>
        <div className={styles.panelRegion}><WorkOrderReplacementIntelligencePanel model={replacement} /></div>
      </WorkspaceSection> : null}
    </div>
  );
}
