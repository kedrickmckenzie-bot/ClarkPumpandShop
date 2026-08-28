import type { SupportingLink, Tone } from "./data-contract";

export type VendorEvidenceState = "ready" | "insufficient";

export interface VendorEvidenceMeasure {
  id: string;
  label: string;
  value: string;
  numerator: number;
  denominator: number;
  denominatorLabel: string;
  definition: string;
  state: VendorEvidenceState;
  tone?: Tone;
  sourceLink: SupportingLink;
}

export interface VendorPerformanceSummary {
  id: string;
  name: string;
  code: string;
  statusLabel: string;
  preferred: boolean;
  dispatchEmail: string;
  dispatchPhone?: string;
  specialties: string[];
  coverageLabel: string;
  coverageStoreCount: number;
  coverageStoreDenominator: number;
  coverageRegionCount: number;
  observedStoreCount: number;
  openWorkCount: number;
  openReminderCount: number;
  assignedWorkCount: number;
  recordedCostMinor: number;
  recordedCostLineCount: number;
  relationshipState: "attention" | "watch" | "stable";
  relationshipLabel: string;
  relationshipSummary: string;
  compliance: {
    state: "ready" | "due_soon" | "blocked" | "unconfigured";
    label: string;
    detail: string;
    approvedDocumentCount: number;
    documentCount: number;
    activeQualificationCount: number;
  };
  measures: {
    responseTime: VendorEvidenceMeasure;
    acceptance: VendorEvidenceMeasure;
    visitCoverage: VendorEvidenceMeasure;
    noWorkOrder: VendorEvidenceMeasure;
    accountability: VendorEvidenceMeasure;
    repeatVisits: VendorEvidenceMeasure;
    unresolvedOutcomes: VendorEvidenceMeasure;
  };
  href: string;
}

export interface VendorPortfolioMetric {
  id: string;
  label: string;
  value: string;
  context: string;
  sourceLink: SupportingLink;
}

export interface VendorPerformanceListViewModel {
  title: string;
  description: string;
  scopeLabel: string;
  updatedLabel: string;
  searchValue?: string;
  view: "all" | "attention" | "preferred" | "stable";
  specialty?: string;
  specialtyOptions: Array<{ value: string; label: string }>;
  sort: "attention" | "name" | "response" | "cost";
  resultSummary: string;
  createVendorLink?: SupportingLink;
  portfolioMetrics: VendorPortfolioMetric[];
  vendors: VendorPerformanceSummary[];
}

export interface VendorComplianceEvidenceRow {
  id: string;
  documentTypeLabel: string;
  referenceLabel: string;
  statusLabel: string;
  effectiveLabel: string;
  expiryLabel: string;
  blockingLabel: string;
  tone: Tone;
}

export interface VendorQualificationEvidenceRow {
  id: string;
  tradeLabel: string;
  capabilityLabel: string;
  serviceRightsLabel: string;
  limitLabel: string;
  expiryLabel: string;
  statusLabel: string;
  tone: Tone;
}

export interface VendorAuthorizationEvidenceRow {
  id: string;
  workOrderNumber: string;
  workOrderProblem: string;
  storeLabel: string;
  revision: number;
  issuedAtLabel: string;
  responseLabel: string;
  responderLabel: string;
  responseAtLabel: string;
  responseTimeLabel: string;
  decisionLabel: string;
  decisionAtLabel: string;
  href: string;
}

export interface VendorAccountabilityEvidenceRow {
  id: string;
  kindLabel: string;
  summary: string;
  workOrderLabel: string;
  ownerLabel: string;
  dueLabel: string;
  tone: Tone;
  href: string;
}

export interface VendorRepeatVisitEvidenceRow {
  id: string;
  workOrderNumber: string;
  problem: string;
  storeLabel: string;
  visitCount: number;
  latestOutcomeLabel: string;
  recordedCostLabel: string;
  href: string;
}

export interface VendorVisitEvidenceRow {
  id: string;
  technicianName: string;
  storeLabel: string;
  workOrderLabel: string;
  observedLabel: string;
  outcomeLabel: string;
  isNoWorkOrder: boolean;
  isUnresolved: boolean;
  href: string;
}

export interface VendorCostEvidenceRow {
  id: string;
  workOrderNumber: string;
  problem: string;
  storeLabel: string;
  statusLabel: string;
  costLabel: string;
  costLineCount: number;
  href: string;
}

export interface VendorCoverageEvidenceRow {
  id: string;
  scopeLabel: string;
  includedStoresLabel: string;
  preferredRankLabel: string;
}

export interface VendorReminderViewModel {
  id: string;
  title: string;
  note?: string;
  accountableParty: string;
  dueAt: string;
  dueInputValue: string;
  dueLabel: string;
  escalationTo: string;
  status: "open" | "completed" | "cancelled";
  statusLabel: string;
  createdLabel: string;
  completionLabel?: string;
}

export interface VendorPerformanceDetailViewModel {
  state: "ready" | "missing";
  title: string;
  description: string;
  scopeLabel: string;
  updatedLabel: string;
  backLink: SupportingLink;
  createWorkOrderLink?: SupportingLink;
  manageRelationshipAction?: string;
  manageRemindersAction?: string;
  timeZone: string;
  defaultReminderOwner: string;
  defaultReminderEscalation: string;
  specialtyOptions: Array<{ value: string; label: string }>;
  notice?: string;
  summary?: VendorPerformanceSummary;
  authorizationRows: VendorAuthorizationEvidenceRow[];
  accountabilityRows: VendorAccountabilityEvidenceRow[];
  repeatVisitRows: VendorRepeatVisitEvidenceRow[];
  visitRows: VendorVisitEvidenceRow[];
  costRows: VendorCostEvidenceRow[];
  coverageRows: VendorCoverageEvidenceRow[];
  complianceRows: VendorComplianceEvidenceRow[];
  qualificationRows: VendorQualificationEvidenceRow[];
  vendorReminderRows: VendorReminderViewModel[];
  regionLabels: string[];
}
