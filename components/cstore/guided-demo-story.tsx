"use client";

import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  DollarSign,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MapPin,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  Wrench,
} from "lucide-react";

import type { VisitEvidenceState, VisitOutcome, WorkPriority } from "./types";
import styles from "./guided-demo-story.module.css";

export type GuidedDemoStepId =
  | "employee_request"
  | "manager_review"
  | "vendor_selection"
  | "external_work_order"
  | "technician_visit"
  | "analytics_handoff";

export type GuidedDemoAction =
  | "submit_employee_request"
  | "approve_and_create_work_order"
  | "select_outside_vendor"
  | "issue_service_authorization"
  | "record_technician_visit";

export type GuidedDemoAnalyticsDestination =
  | "store_spend"
  | "refrigeration_drilldown"
  | "vendor_accountability"
  | "asset_history";

export interface GuidedDemoScenario {
  store: {
    id: string;
    number: string;
    name: string;
    address: string;
    region: string;
  };
  employee: {
    name: string;
    role: string;
  };
  manager: {
    name: string;
    approvalLimitLabel: string;
  };
  request: {
    number: string;
    submittedAtLabel: string;
    problem: string;
    reportedLocation: string;
    priority: WorkPriority;
    photoCount: number;
  };
  vendor: {
    id: string;
    name: string;
    specialty: string;
    coverageLabel: string;
    relationshipLabel: string;
  };
  workOrder: {
    number: string;
    title: string;
    categoryLabel: string;
    taxonomyLabel: string;
    assetLabel: string;
    nteLabel: string;
    requestedWindowLabel: string;
  };
  visit: {
    technicianName: string;
    channelLabel: string;
    checkInLabel: string;
    checkOutLabel: string;
    observedDurationLabel: string;
    evidenceState: VisitEvidenceState;
    evidenceLabel: string;
    outcome: VisitOutcome;
    outcomeLabel: string;
    photoCount: number;
  };
  analytics: {
    recordedCostLabel: string;
    linkedInvoiceLabel: string;
    visitCount: number;
    workStatusLabel: string;
  };
}

export interface GuidedDemoStoryProps {
  activeStep: GuidedDemoStepId;
  onStepChange: (step: GuidedDemoStepId) => void;
  onReset: () => void;
  onAction?: (action: GuidedDemoAction) => void;
  onAnalyticsNavigate?: (destination: GuidedDemoAnalyticsDestination) => void;
  completedSteps?: GuidedDemoStepId[];
  unlockedSteps?: GuidedDemoStepId[];
  pendingAction?: GuidedDemoAction | null;
  activeActionLabel?: string;
  actionDisabled?: boolean;
  authorizationContent?: ReactNode;
  visitContent?: ReactNode;
  scenario?: Partial<GuidedDemoScenario>;
  className?: string;
}

interface StepDefinition {
  id: GuidedDemoStepId;
  shortLabel: string;
  label: string;
  description: string;
  icon: ComponentType<{ "aria-hidden"?: boolean }>;
  action?: GuidedDemoAction;
  actionLabel?: string;
}

const steps: StepDefinition[] = [
  {
    id: "employee_request",
    shortLabel: "Request",
    label: "Employee reports the issue",
    description: "The store captures the problem without diagnosing equipment.",
    icon: CircleAlert,
    action: "submit_employee_request",
    actionLabel: "Submit the issue",
  },
  {
    id: "manager_review",
    shortLabel: "Review",
    label: "Manager reviews and approves",
    description: "The original report stays visible while the manager decides what happens next.",
    icon: ShieldCheck,
    action: "approve_and_create_work_order",
    actionLabel: "Approve & create work order",
  },
  {
    id: "vendor_selection",
    shortLabel: "Vendor",
    label: "Choose the right service partner",
    description: "Search plain language, specialties, coverage, and preferred relationships.",
    icon: Search,
    action: "select_outside_vendor",
    actionLabel: "Use Summit Refrigeration",
  },
  {
    id: "external_work_order",
    shortLabel: "Issue",
    label: "Issue the external work order",
    description: "The operator number becomes the vendor's billing reference—not a dispatch mandate.",
    icon: Send,
    action: "issue_service_authorization",
    actionLabel: "Send service authorization",
  },
  {
    id: "technician_visit",
    shortLabel: "Visit",
    label: "Observe the technician visit",
    description: "Check-in and checkout create low-friction evidence across QR, app, or store device.",
    icon: MapPin,
    action: "record_technician_visit",
    actionLabel: "Record check-in & checkout",
  },
  {
    id: "analytics_handoff",
    shortLabel: "Visibility",
    label: "Hand the facts to analytics",
    description: "Every dashboard number opens the exact request, work order, visit, and cost beneath it.",
    icon: BarChart3,
  },
];

const defaultScenario: GuidedDemoScenario = {
  store: {
    id: "store-104",
    number: "104",
    name: "Northline West Broad",
    address: "2875 West Broad Street, Columbus, OH 43204",
    region: "Central Ohio",
  },
  employee: {
    name: "Lee Bryant",
    role: "Store associate",
  },
  manager: {
    name: "Robin Flores",
    approvalLimitLabel: "$1,500 store approval limit",
  },
  request: {
    number: "REQ-104-DEMO-001",
    submittedAtLabel: "Today · 9:12 AM",
    problem: "The beer cave is warm. The display reads 48°F and the product feels warmer than normal.",
    reportedLocation: "Beer cave · rear sales floor",
    priority: "urgent",
    photoCount: 2,
  },
  vendor: {
    id: "vendor-summit-refrigeration",
    name: "Summit Refrigeration",
    specialty: "Commercial refrigeration · walk-ins · beer caves · freezers",
    coverageLabel: "Covers Store 104 and the Central Ohio region",
    relationshipLabel: "Preferred refrigeration partner",
  },
  workOrder: {
    number: "NLM-104-DEMO-001",
    title: "Beer cave holding at 48°F",
    categoryLabel: "Refrigeration",
    taxonomyLabel: "Walk-in refrigeration › Beer cave",
    assetLabel: "Beer Cave Refrigeration System · 104-REF-BC-1",
    nteLabel: "$750 not to exceed",
    requestedWindowLabel: "Service requested today, before 2:00 PM",
  },
  visit: {
    technicianName: "Marcus Hill",
    channelLabel: "Store QR → kiosk checkout",
    checkInLabel: "10:03 AM",
    checkOutLabel: "11:24 AM",
    observedDurationLabel: "1 hr 21 min observed onsite",
    evidenceState: "location_verified",
    evidenceLabel: "Location verified · 24 m from Store 104",
    outcome: "resolved",
    outcomeLabel: "Resolved · final temperature 37°F and falling",
    photoCount: 4,
  },
  analytics: {
    recordedCostLabel: "$685 linked invoice",
    linkedInvoiceLabel: "SUM-DEMO-685 · matched",
    visitCount: 1,
    workStatusLabel: "Invoice received",
  },
};

const priorityLabels: Record<WorkPriority, string> = {
  routine: "Routine",
  soon: "Needs attention",
  urgent: "Urgent",
  emergency: "Emergency",
};

function mergeScenario(overrides?: Partial<GuidedDemoScenario>): GuidedDemoScenario {
  if (!overrides) return defaultScenario;
  return {
    store: { ...defaultScenario.store, ...overrides.store },
    employee: { ...defaultScenario.employee, ...overrides.employee },
    manager: { ...defaultScenario.manager, ...overrides.manager },
    request: { ...defaultScenario.request, ...overrides.request },
    vendor: { ...defaultScenario.vendor, ...overrides.vendor },
    workOrder: { ...defaultScenario.workOrder, ...overrides.workOrder },
    visit: { ...defaultScenario.visit, ...overrides.visit },
    analytics: { ...defaultScenario.analytics, ...overrides.analytics },
  };
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function StepBody({
  step,
  scenario,
  onAnalyticsNavigate,
}: {
  step: GuidedDemoStepId;
  scenario: GuidedDemoScenario;
  onAnalyticsNavigate?: (destination: GuidedDemoAnalyticsDestination) => void;
}) {
  if (step === "employee_request") {
    return (
      <div className={styles.storyGrid}>
        <div className={styles.storyCopy}>
          <span className={styles.actorPill}>Store employee · no login friction</span>
          <h3>Report what is wrong, not what caused it.</h3>
          <p>
            {scenario.employee.name} opens Store {scenario.store.number}’s issue form from the
            store portal and records exactly what they can observe.
          </p>
          <div className={styles.callout}>
            <CircleAlert aria-hidden="true" />
            <div>
              <strong>Original employee report</strong>
              <span>It can be reviewed and corrected by amendment, but never silently deleted.</span>
            </div>
          </div>
        </div>
        <article className={styles.recordCard} aria-label="Employee service request">
          <div className={styles.recordHeader}>
            <div>
              <span>Service request</span>
              <strong>{scenario.request.number}</strong>
            </div>
            <span className={`${styles.statusBadge} ${styles.statusUrgent}`}>
              {priorityLabels[scenario.request.priority]}
            </span>
          </div>
          <blockquote>“{scenario.request.problem}”</blockquote>
          <dl className={styles.detailList}>
            <DetailRow label="Store">
              #{scenario.store.number} · {scenario.store.name}
            </DetailRow>
            <DetailRow label="Location">{scenario.request.reportedLocation}</DetailRow>
            <DetailRow label="Reported by">
              {scenario.employee.name} · {scenario.employee.role}
            </DetailRow>
            <DetailRow label="Submitted">{scenario.request.submittedAtLabel}</DetailRow>
          </dl>
          <div className={styles.evidenceLine}>
            <Camera aria-hidden="true" /> {scenario.request.photoCount} employee photos attached
          </div>
        </article>
      </div>
    );
  }

  if (step === "manager_review") {
    return (
      <div className={styles.storyGrid}>
        <div className={styles.storyCopy}>
          <span className={styles.actorPill}>Store manager · focused decision</span>
          <h3>Review the impact, preserve the source, and create accountable work.</h3>
          <p>
            {scenario.manager.name} sees the employee’s exact report, checks store authority,
            and converts it into the operator’s canonical work order.
          </p>
          <ul className={styles.checkList}>
            <li>
              <Check aria-hidden="true" /> Original request stays linked
            </li>
            <li>
              <Check aria-hidden="true" /> Classification can be refined later
            </li>
            <li>
              <Check aria-hidden="true" /> An owner and next action are required
            </li>
          </ul>
        </div>
        <article className={styles.decisionCard} aria-label="Manager review decision">
          <div className={styles.decisionTop}>
            <ShieldCheck aria-hidden="true" />
            <div>
              <span>Manager review</span>
              <strong>Ready to approve</strong>
            </div>
          </div>
          <dl className={styles.detailList}>
            <DetailRow label="Decision owner">{scenario.manager.name}</DetailRow>
            <DetailRow label="Authority">{scenario.manager.approvalLimitLabel}</DetailRow>
            <DetailRow label="Priority">{priorityLabels[scenario.request.priority]}</DetailRow>
            <DetailRow label="Suggested category">Refrigeration</DetailRow>
          </dl>
          <div className={styles.resultStrip}>
            <FileText aria-hidden="true" />
            <span>
              Approval creates <strong>{scenario.workOrder.number}</strong> and retains the request
              as its source.
            </span>
          </div>
        </article>
      </div>
    );
  }

  if (step === "vendor_selection") {
    return (
      <div className={styles.storyGrid}>
        <div className={styles.storyCopy}>
          <span className={styles.actorPill}>Outside vendor · selected after approval</span>
          <h3>Search the way managers actually talk.</h3>
          <p>
            Searching “beer cave” finds approved vendors by specialty, aliases, equipment type,
            geography, and preferred store relationship.
          </p>
          <div className={styles.searchPreview}>
            <Search aria-hidden="true" />
            <span>beer cave</span>
            <kbd>1 result</kbd>
          </div>
        </div>
        <article className={`${styles.vendorCard} ${styles.selectedCard}`} aria-label="Selected vendor">
          <div className={styles.vendorMark}>
            {scenario.vendor.name.split(" ").map((word) => word[0]).join("").slice(0, 2)}
          </div>
          <div className={styles.vendorIdentity}>
            <span className={styles.preferredBadge}>Preferred</span>
            <h4>{scenario.vendor.name}</h4>
            <p>{scenario.vendor.specialty}</p>
          </div>
          <dl className={styles.detailList}>
            <DetailRow label="Coverage">{scenario.vendor.coverageLabel}</DetailRow>
            <DetailRow label="Relationship">{scenario.vendor.relationshipLabel}</DetailRow>
            <DetailRow label="Routing">Outside vendor</DetailRow>
          </dl>
          <div className={styles.selectionLine}>
            <CheckCircle2 aria-hidden="true" /> Best match for this store and service category
          </div>
        </article>
      </div>
    );
  }

  if (step === "external_work_order") {
    return (
      <div className={styles.storyGrid}>
        <div className={styles.storyCopy}>
          <span className={styles.actorPill}>Service authorization · portal account optional</span>
          <h3>Give the vendor one durable customer reference.</h3>
          <p>
            The outside vendor receives a secure link and printable service authorization. They
            may use their own dispatch system; the TraceOps number belongs on their invoice.
          </p>
          <div className={styles.channelRow} aria-label="Delivery channels">
            <span>
              <Mail aria-hidden="true" /> Email
            </span>
            <span>
              <Smartphone aria-hidden="true" /> Secure mobile link
            </span>
            <span>
              <FileText aria-hidden="true" /> Printable copy
            </span>
          </div>
        </div>
        <article className={styles.authorizationCard} aria-label="External work order and service authorization">
          <div className={styles.authorizationTop}>
            <div>
              <span>Work Order / Service Authorization</span>
              <strong>{scenario.workOrder.number}</strong>
            </div>
            <span className={styles.statusBadge}>Ready to issue</span>
          </div>
          <h4>{scenario.workOrder.title}</h4>
          <dl className={styles.detailList}>
            <DetailRow label="Vendor">{scenario.vendor.name}</DetailRow>
            <DetailRow label="Store">
              #{scenario.store.number} · {scenario.store.address}
            </DetailRow>
            <DetailRow label="Classification">
              {scenario.workOrder.categoryLabel} › {scenario.workOrder.taxonomyLabel}
            </DetailRow>
            <DetailRow label="Asset">{scenario.workOrder.assetLabel}</DetailRow>
            <DetailRow label="Authorization">{scenario.workOrder.nteLabel}</DetailRow>
            <DetailRow label="Requested window">{scenario.workOrder.requestedWindowLabel}</DetailRow>
          </dl>
          <div className={styles.billingInstruction}>
            <Link2 aria-hidden="true" />
            <span>
              Include customer work-order number <strong>{scenario.workOrder.number}</strong> on
              the invoice.
            </span>
          </div>
        </article>
      </div>
    );
  }

  if (step === "technician_visit") {
    return (
      <div className={styles.storyGrid}>
        <div className={styles.storyCopy}>
          <span className={styles.actorPill}>Technician · QR, app, or trusted store device</span>
          <h3>Capture presence without turning it into certified labor.</h3>
          <p>
            {scenario.visit.technicianName} selects {scenario.workOrder.number}, checks in, records
            the outcome, and checks out. Location is sampled only at those two events.
          </p>
          <div className={styles.callout}>
            <Clock3 aria-hidden="true" />
            <div>
              <strong>{scenario.visit.observedDurationLabel}</strong>
              <span>Approximate presence evidence—not automatic proof of billable labor.</span>
            </div>
          </div>
        </div>
        <article className={styles.visitCard} aria-label="Technician visit evidence">
          <div className={styles.visitHeader}>
            <div className={styles.technicianAvatar}>JL</div>
            <div>
              <strong>{scenario.visit.technicianName}</strong>
              <span>{scenario.vendor.name} · {scenario.visit.channelLabel}</span>
            </div>
            <span className={`${styles.statusBadge} ${styles.statusVerified}`}>
              <ShieldCheck aria-hidden="true" /> Verified
            </span>
          </div>
          <div className={styles.visitTimeline}>
            <div>
              <span className={styles.timelineDot} />
              <small>Check-in</small>
              <strong>{scenario.visit.checkInLabel}</strong>
              <p>{scenario.visit.evidenceLabel}</p>
            </div>
            <div>
              <span className={styles.timelineDot} />
              <small>Checkout</small>
              <strong>{scenario.visit.checkOutLabel}</strong>
              <p>{scenario.visit.outcomeLabel}</p>
            </div>
          </div>
          <div className={styles.visitEvidence}>
            <Camera aria-hidden="true" /> {scenario.visit.photoCount} service photos
            <span />
            <Wrench aria-hidden="true" /> Follow-up required
          </div>
        </article>
      </div>
    );
  }

  const destinations: Array<{
    id: GuidedDemoAnalyticsDestination;
    label: string;
    description: string;
    icon: ComponentType<{ "aria-hidden"?: boolean }>;
  }> = [
    {
      id: "store_spend",
      label: "Store 104 spending",
      description: "See every recorded cost and linked work order at this store.",
      icon: Store,
    },
    {
      id: "refrigeration_drilldown",
      label: "Refrigeration drill-down",
      description: "Move from refrigeration to beer caves, assets, and components.",
      icon: BarChart3,
    },
    {
      id: "vendor_accountability",
      label: "Vendor accountability",
      description: `Open visits, outcomes, evidence, and work awarded to ${scenario.vendor.name}.`,
      icon: Truck,
    },
    {
      id: "asset_history",
      label: "Beer Cave 1 history",
      description: "Review repeat work, cost, warranty, PM, and lifecycle facts.",
      icon: Wrench,
    },
  ];

  return (
    <div className={styles.analyticsLayout}>
      <div className={styles.analyticsSummary}>
        <span className={styles.actorPill}>Source-linked visibility</span>
        <h3>One store problem becomes decision-ready evidence.</h3>
        <p>
          Nothing is re-entered for reporting. The dashboard follows the connected records that
          the employee, manager, vendor, and technician already created.
        </p>
        <div className={styles.metricGrid}>
          <div>
            <DollarSign aria-hidden="true" />
            <span>Cost</span>
            <strong>{scenario.analytics.recordedCostLabel}</strong>
          </div>
          <div>
            <MapPin aria-hidden="true" />
            <span>Visits</span>
            <strong>{scenario.analytics.visitCount} observed visit</strong>
          </div>
          <div>
            <Clock3 aria-hidden="true" />
            <span>Status</span>
            <strong>{scenario.analytics.workStatusLabel}</strong>
          </div>
          <div>
            <FileText aria-hidden="true" />
            <span>Invoice</span>
            <strong>{scenario.analytics.linkedInvoiceLabel}</strong>
          </div>
        </div>
        <div className={styles.sourceChain}>
          <span>{scenario.request.number}</span>
          <ChevronRight aria-hidden="true" />
          <span>{scenario.workOrder.number}</span>
          <ChevronRight aria-hidden="true" />
          <span>Verified visit</span>
          <ChevronRight aria-hidden="true" />
          <span>Recorded cost</span>
        </div>
      </div>
      <div className={styles.destinationPanel}>
        <span className={styles.panelLabel}>Open a live destination</span>
        {destinations.map((destination) => {
          const Icon = destination.icon;
          return (
            <button
              key={destination.id}
              type="button"
              onClick={() => onAnalyticsNavigate?.(destination.id)}
            >
              <span className={styles.destinationIcon}>
                <Icon aria-hidden={true} />
              </span>
              <span>
                <strong>{destination.label}</strong>
                <small>{destination.description}</small>
              </span>
              <ExternalLink aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GuidedDemoStory({
  activeStep,
  onStepChange,
  onReset,
  onAction,
  onAnalyticsNavigate,
  completedSteps,
  unlockedSteps,
  pendingAction = null,
  activeActionLabel,
  actionDisabled = false,
  authorizationContent,
  visitContent,
  scenario: scenarioOverrides,
  className,
}: GuidedDemoStoryProps) {
  const scenario = mergeScenario(scenarioOverrides);
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeStep),
  );
  const activeDefinition = steps[activeIndex] ?? steps[0];
  const completed = new Set(
    completedSteps ?? steps.slice(0, activeIndex).map((step) => step.id),
  );
  const unlocked = new Set(unlockedSteps ?? steps.map((step) => step.id));
  const ActiveIcon = activeDefinition.icon;
  const activeIsComplete = completed.has(activeDefinition.id);

  function runCurrentAction() {
    if (!activeDefinition.action) return;
    if (activeIsComplete) {
      const nextStep = steps[activeIndex + 1];
      if (nextStep) onStepChange(nextStep.id);
      return;
    }
    if (onAction) {
      onAction(activeDefinition.action);
      return;
    }
    const nextStep = steps[activeIndex + 1];
    if (nextStep) onStepChange(nextStep.id);
  }

  const hasFooterAction = Boolean(activeDefinition.action) &&
    !(activeDefinition.id === "technician_visit" && visitContent);

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-labelledby="guided-demo-title"
    >
      <header className={styles.demoHeader}>
        <div>
          <span className={styles.demoEyebrow}>Guided TraceOps story · Demo mode</span>
          <h2 id="guided-demo-title">Follow one Store 104 service event end to end</h2>
          <p>
            Beer cave issue → accountable work → observed service → decision-ready visibility
          </p>
        </div>
        <button className={styles.resetButton} type="button" onClick={onReset}>
          <RotateCcw aria-hidden="true" /> Reset story
        </button>
      </header>

      <nav className={styles.progressRail} aria-label="Guided demo steps">
        <ol>
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === activeStep;
            const isComplete = completed.has(step.id);
            const isUnlocked = unlocked.has(step.id);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={`${styles.railStep} ${isActive ? styles.railStepActive : ""} ${
                    isComplete ? styles.railStepComplete : ""
                  }`}
                  onClick={() => onStepChange(step.id)}
                  disabled={!isUnlocked}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${step.label}${isComplete ? ", complete" : ""}`}
                >
                  <span className={styles.railIcon}>
                    {isComplete ? <Check aria-hidden="true" /> : <Icon aria-hidden={true} />}
                  </span>
                  <span className={styles.railCopy}>
                    <small>Step {index + 1}</small>
                    <strong>{step.shortLabel}</strong>
                  </span>
                </button>
                {index < steps.length - 1 ? <span className={styles.railConnector} /> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={styles.stepHeader}>
        <span className={styles.stepIcon}>
          <ActiveIcon aria-hidden={true} />
        </span>
        <div>
          <span>Step {activeIndex + 1} of {steps.length}</span>
          <h3>{activeDefinition.label}</h3>
          <p>{activeDefinition.description}</p>
        </div>
      </div>

      <div className={styles.stepStage} aria-live="polite">
        <StepBody
          step={activeDefinition.id}
          scenario={scenario}
          onAnalyticsNavigate={onAnalyticsNavigate}
        />
        {activeDefinition.id === "external_work_order" && authorizationContent ? (
          <div className={styles.embeddedContent}>{authorizationContent}</div>
        ) : null}
        {activeDefinition.id === "technician_visit" && visitContent ? (
          <div className={styles.embeddedContent}>{visitContent}</div>
        ) : null}
      </div>

      <footer className={styles.demoFooter}>
        <div className={styles.storeContext}>
          <Store aria-hidden="true" />
          <span>
            <strong>Store {scenario.store.number}</strong>
            {scenario.store.region} · {scenario.store.address}
          </span>
        </div>
        {hasFooterAction ? (
          <button
            className={styles.advanceButton}
            type="button"
            onClick={runCurrentAction}
            disabled={pendingAction !== null || actionDisabled}
          >
            {pendingAction === activeDefinition.action
              ? "Updating story…"
              : activeIsComplete
                ? "Continue to the next step"
                : activeActionLabel ?? activeDefinition.actionLabel}
            <ChevronRight aria-hidden="true" />
          </button>
        ) : activeDefinition.id === "technician_visit" ? (
          activeIsComplete ? (
            <button
              className={styles.advanceButton}
              type="button"
              onClick={() => onStepChange("analytics_handoff")}
            >
              Continue to visibility
              <ChevronRight aria-hidden="true" />
            </button>
          ) : (
            <span className={styles.completePill}>
              <Clock3 aria-hidden="true" /> Complete check-in and checkout above
            </span>
          )
        ) : (
          <span className={styles.completePill}>
            <CheckCircle2 aria-hidden="true" /> Story complete · choose a destination above
          </span>
        )}
      </footer>
    </section>
  );
}
