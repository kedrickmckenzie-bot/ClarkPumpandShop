export type OperatorRole =
  | "executive"
  | "facilities"
  | "regional"
  | "store_manager"
  | "finance";

export type DemoEdition = "accountability" | "complete";

export type Tone = "neutral" | "positive" | "warning" | "critical" | "info";

export interface OperatorSession {
  userId: string;
  membershipId?: string;
  displayName: string;
  email: string;
  role: OperatorRole;
  organizationId: string;
  organizationName: string;
  scopeLabel: string;
  regionIds?: string[];
  storeIds?: string[];
  permissions?: string[];
  /** Visible showcase packaging only; production entitlements remain server-enforced separately. */
  demoEdition?: DemoEdition;
}

export interface SupportingLink {
  href: string;
  label: string;
}

export type DataState =
  | { kind: "ready" }
  | { kind: "loading"; label?: string }
  | { kind: "empty"; title: string; message: string; action?: SupportingLink }
  | { kind: "error"; title: string; message: string; retryHref?: string };

export interface PageContext {
  title: string;
  eyebrow?: string;
  description: string;
  scopeLabel: string;
  periodLabel?: string;
  updatedLabel?: string;
  primaryAction?: SupportingLink;
  secondaryAction?: SupportingLink;
}

export interface MetricViewModel {
  id: string;
  label: string;
  value: string;
  supportingText: string;
  tone?: Tone;
  trendLabel?: string;
  link: SupportingLink;
}

export interface SegmentViewModel {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  shareLabel?: string;
  tone?: Tone;
  link: SupportingLink;
}

export interface SeriesPointViewModel {
  id: string;
  label: string;
  value: number;
  formattedValue: string;
  link: SupportingLink;
}

export interface BreakdownViewModel {
  id: string;
  title: string;
  description?: string;
  totalLabel?: string;
  segments: SegmentViewModel[];
  sourceLink: SupportingLink;
}

export interface TrendViewModel {
  id: string;
  title: string;
  description?: string;
  points: SeriesPointViewModel[];
  sourceLink: SupportingLink;
}

export interface ActionItemViewModel {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  storeLabel?: string;
  recordLabel?: string;
  dueLabel: string;
  ownerLabel: string;
  priorityLabel?: string;
  tone: Tone;
  link: SupportingLink;
}

export interface JourneyStageViewModel {
  id: string;
  label: string;
  value: string;
  supportingText: string;
  tone?: Tone;
  link: SupportingLink;
}

export interface TimelineEventViewModel {
  id: string;
  title: string;
  description?: string;
  timestampLabel: string;
  actorLabel: string;
  tone?: Tone;
  link?: SupportingLink;
}

export interface DetailFactViewModel {
  label: string;
  value: string;
  helperText?: string;
  link?: SupportingLink;
}

export interface FilterOptionViewModel {
  value: string;
  label: string;
  href: string;
  selected: boolean;
}

export interface FilterGroupViewModel {
  id: string;
  label: string;
  options: FilterOptionViewModel[];
}

export interface AppliedFilterViewModel {
  id: string;
  label: string;
  removeHref: string;
}

export interface TableColumnViewModel {
  key: string;
  label: string;
  align?: "start" | "end";
}

export interface TableCellViewModel {
  key: string;
  value: string;
  secondary?: string;
  tone?: Tone;
}

export interface TableRowViewModel {
  id: string;
  label: string;
  href: string;
  cells: TableCellViewModel[];
}

export interface TableViewModel {
  id: string;
  caption: string;
  columns: TableColumnViewModel[];
  rows: TableRowViewModel[];
}

export interface ListPageViewModel {
  state: DataState;
  page: PageContext;
  metrics?: MetricViewModel[];
  filters?: FilterGroupViewModel[];
  appliedFilters?: AppliedFilterViewModel[];
  clearFiltersHref?: string;
  table: TableViewModel;
  resultSummary: string;
  search?: {
    label: string;
    placeholder: string;
    value?: string;
    action: string;
    preservedParameters?: Array<{ name: string; value: string }>;
  };
  pagination?: {
    summary: string;
    previousHref?: string;
    nextHref?: string;
  };
}

export interface DashboardPageViewModel {
  state: DataState;
  page: PageContext;
  layout?: "executive" | "finance" | "operations" | "regional" | "store";
  journey?: JourneyStageViewModel[];
  metrics: MetricViewModel[];
  priorityActions: ActionItemViewModel[];
  prioritySection?: {
    title: string;
    description: string;
    link: SupportingLink;
    display?: "expanded" | "summary";
  };
  breakdowns: BreakdownViewModel[];
  trends: TrendViewModel[];
  spotlight?: {
    eyebrow?: string;
    title: string;
    description: string;
    facts: DetailFactViewModel[];
    link: SupportingLink;
  };
}

export interface DetailSectionViewModel {
  id: string;
  title: string;
  description?: string;
  facts?: DetailFactViewModel[];
  table?: TableViewModel;
  timeline?: TimelineEventViewModel[];
  action?: SupportingLink;
}

export interface DetailPageViewModel {
  state: DataState;
  page: PageContext;
  statusLabel: string;
  statusTone?: Tone;
  facts: DetailFactViewModel[];
  sections: DetailSectionViewModel[];
  backLink: SupportingLink;
}

export interface ProgramPageViewModel extends DashboardPageViewModel {
  filters?: FilterGroupViewModel[];
  appliedFilters?: AppliedFilterViewModel[];
  clearFiltersHref?: string;
  table?: TableViewModel;
  resultSummary?: string;
  search?: ListPageViewModel["search"];
  pagination?: ListPageViewModel["pagination"];
}

export interface OperatorPageModels {
  overview: DashboardPageViewModel;
  actionCenter: ListPageViewModel;
  requests: ListPageViewModel;
  workOrders: ListPageViewModel;
  visits: ListPageViewModel;
  stores: ListPageViewModel;
  vendors: ListPageViewModel;
  invoices: ListPageViewModel;
  spend: ProgramPageViewModel;
  equipment: ProgramPageViewModel;
  preventiveMaintenance: ProgramPageViewModel;
  lifecycle: ProgramPageViewModel;
  reports: ListPageViewModel;
  admin: ListPageViewModel;
}

export interface SearchResultGroupViewModel {
  id: string;
  label: string;
  resultCount: number;
  rows: TableRowViewModel[];
}

export interface SearchPageViewModel {
  state: DataState;
  page: PageContext;
  query: string;
  placeholder?: string;
  resultSummary: string;
  groups: SearchResultGroupViewModel[];
}

export interface SelectOptionViewModel {
  value: string;
  label: string;
  description?: string;
}

export interface AssetLifecycleInputViewModel {
  id: string;
  organizationId: string;
  storeId: string;
  label: string;
  description?: string;
  installedAt?: string;
  expectedLifeYears?: number;
  replacementEstimate?: {
    amountMinor: number;
    currency: string;
  };
}

export interface CreateRequestPageViewModel {
  state: DataState;
  page: PageContext;
  submitAction: string;
  cancelLink: SupportingLink;
  stores: SelectOptionViewModel[];
  priorityOptions: SelectOptionViewModel[];
}

export interface CreateWorkOrderPageViewModel {
  state: DataState;
  page: PageContext;
  submitAction: string;
  cancelLink: SupportingLink;
  stores: SelectOptionViewModel[];
  vendors: SelectOptionViewModel[];
  internalAssignees: SelectOptionViewModel[];
  priorityOptions: SelectOptionViewModel[];
  categories: SelectOptionViewModel[];
  assetLifecycleInputs: AssetLifecycleInputViewModel[];
  lifecycleAsOf: string;
  defaults?: {
    storeId?: string;
    assetId?: string;
    categoryKey?: string;
    problem?: string;
    priority?: "routine" | "urgent" | "emergency" | "planned";
    assignmentKind?: "internal" | "outside_vendor" | "choose_later";
    vendorId?: string;
    internalMembershipId?: string;
  };
  sourceRequest?: {
    id: string;
    reference: string;
    storeId: string;
    problem: string;
    reporterName: string;
    submittedLabel: string;
  };
  sourceVisit?: {
    exceptionId: string;
    visitId: string;
    technicianName: string;
    providerName: string;
    checkedInLabel: string;
    unmatchedReason: string;
  };
}

export interface VendorIssuanceViewModel {
  available: boolean;
  permitted: boolean;
  rolePermitted: boolean;
  workflowBlocked: boolean;
  workflowBlockMessage?: string;
  submitAction: string;
  workOrderId: string;
  workOrderNumber: string;
  assignmentKind: "internal" | "outside_vendor" | "choose_later";
  selectedVendorId?: string;
  vendorSelectionLocked: boolean;
  vendors: SelectOptionViewModel[];
  channels: SelectOptionViewModel[];
  currentRevision?: number;
  helperText: string;
}

export type EstimateRequestStatusViewModel =
  | "requested"
  | "opened"
  | "submitted"
  | "declined"
  | "expired"
  | "withdrawn"
  | "selected"
  | "not_selected";

export interface EstimateProposalViewModel {
  id: string;
  revision: number;
  amountLabel: string;
  scope: string;
  exclusions?: string;
  leadTimeLabel?: string;
  validUntilLabel?: string;
  submittedLabel: string;
}

export interface EstimateRequestComparisonViewModel {
  id: string;
  vendorId: string;
  vendorName: string;
  decisionKind?: "service_bid" | "replacement_quote";
  kindLabel: string;
  requestedScope: string;
  status: EstimateRequestStatusViewModel;
  statusLabel: string;
  requestedLabel: string;
  dueLabel?: string;
  openedLabel?: string;
  respondedLabel?: string;
  decisionLabel?: string;
  latestProposal?: EstimateProposalViewModel;
  canSelect: boolean;
  canWithdraw: boolean;
  canReopen: boolean;
  decisionAction: string;
}

export interface EstimateComparisonViewModel {
  available: boolean;
  permitted: boolean;
  rolePermitted: boolean;
  workflowBlocked: boolean;
  workflowBlockMessage?: string;
  workOrderId: string;
  workOrderNumber: string;
  submitAction: string;
  defaultRequestedScope: string;
  vendors: SelectOptionViewModel[];
  requests: EstimateRequestComparisonViewModel[];
  selectedVendorName?: string;
  selectedDecisionKind?: "service_bid" | "replacement_quote";
  comparisonClosed: boolean;
  activeRequestCount: number;
  proposalCount: number;
}

export type WorkflowStageState = "complete" | "current" | "upcoming" | "blocked";

export interface WorkflowStageViewModel {
  id: string;
  label: string;
  state: WorkflowStageState;
  detail: string;
  timestampLabel?: string;
}

export interface WorkflowTaskPauseViewModel {
  id: string;
  state: "active" | "resumed";
  reasonLabel: string;
  reasonDetail: string;
  ownerLabel: string;
  affectedClocksLabel: string;
  expectedResumeLabel?: string;
  pausedByLabel: string;
  pausedLabel: string;
  resumedByLabel?: string;
  resumedLabel?: string;
  resumeNote?: string;
}

export interface WorkflowTaskItemViewModel {
  id: string;
  action: string;
  typeLabel: string;
  title: string;
  reason: string;
  assigneeTypeLabel: string;
  assigneeLabel: string;
  priorityLabel: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  statusLabel: string;
  statusTone: Tone;
  blocking: boolean;
  requiredForProgress: boolean;
  dueAt?: string;
  dueLabel: string;
  noSlaReason?: string;
  slaClockLabel?: string;
  completionCriteria: string;
  escalationDestination: string;
  escalationLevel: number;
  createdByLabel: string;
  createdLabel: string;
  startedLabel?: string;
  completedLabel?: string;
  cancelledLabel?: string;
  resolutionNote?: string;
  activePauseId?: string;
  pauses: WorkflowTaskPauseViewModel[];
  availableActions: Array<"start" | "complete" | "cancel" | "pause" | "resume" | "escalate">;
}

export interface WorkflowTaskWorkspaceViewModel {
  permitted: boolean;
  permissionMessage: string;
  createAction: string;
  activeTasks: WorkflowTaskItemViewModel[];
  history: WorkflowTaskItemViewModel[];
  taskTypeOptions: SelectOptionViewModel[];
  priorityOptions: SelectOptionViewModel[];
  assigneeTypeOptions: SelectOptionViewModel[];
  memberOptions: SelectOptionViewModel[];
  vendorOptions: SelectOptionViewModel[];
  roleOptions: SelectOptionViewModel[];
  slaClockOptions: SelectOptionViewModel[];
  pauseReasonOptions: SelectOptionViewModel[];
  pauseOwnerTypeOptions: SelectOptionViewModel[];
}

export interface ApprovalDecisionViewModel {
  requestId: string;
  subjectLabel: "request" | "work order";
  decisionAction: string;
  policyName: string;
  policyVersion: number;
  amountLabel: string;
  requiredRoleLabel: string;
  dueAt?: string;
  dueLabel: string;
  escalationRoleLabel?: string;
  canDecide: boolean;
  decisionAccessMessage?: string;
  decisionOptions: Array<{
    value: "approved" | "rejected" | "escalated";
    label: string;
    description: string;
    reasonRequired: boolean;
  }>;
}

export interface WorkOrderControlViewModel {
  available: boolean;
  permitted: boolean;
  submitAction: string;
  followUpAction: string;
  manualResponseAction: string;
  workOrderId: string;
  workOrderNumber: string;
  timeZone: string;
  expectedStatus: string;
  status: string;
  statusOptions: SelectOptionViewModel[];
  priority: string;
  priorityOptions: SelectOptionViewModel[];
  accountableParty: string;
  nextAction: string;
  dueAt?: string;
  dueInputValue?: string;
  escalationTo?: string;
  isTerminal: boolean;
  pendingApproval?: ApprovalDecisionViewModel;
  stages: WorkflowStageViewModel[];
  workflowTasks: WorkflowTaskWorkspaceViewModel;
  assignment?: {
    kind: "internal" | "outside_vendor" | "choose_later";
    status: string;
    providerLabel: string;
    assignedLabel: string;
  };
  latestIssuance?: {
    id: string;
    revision: number;
    channelLabel: string;
    issuedLabel: string;
    deliveryStateLabel: string;
    deliveryStateDetail: string;
  };
  latestVendorResponse?: {
    response: string;
    responderName: string;
    respondedLabel: string;
    proposedAt?: string;
    message?: string;
  };
  closeout?: {
    ready: boolean;
    outcomeLabel: string;
    visitEvidenceLabel: string;
    costEvidenceLabel: string;
    invoiceEvidenceLabel: string;
    classificationLabel: string;
    openFollowUpCount: number;
  };
  followUps: Array<{
    id: string;
    status: string;
    accountableParty: string;
    nextAction: string;
    dueAt: string;
    dueLabel: string;
    escalationTo: string;
  }>;
  canRecordManualVendorResponse: boolean;
  manualVendorResponseTarget?: {
    expectedAssignmentId: string;
    expectedIssuanceId: string;
    expectedIssuanceRevision: number;
  };
  vendorResponseOptions: SelectOptionViewModel[];
}

export interface WorkOrderRecordingViewModel {
  available: boolean;
  canClassify: boolean;
  canRecordCost: boolean;
  submitAction: string;
  workOrderId: string;
  workOrderNumber: string;
  currentCategory?: string;
  currentAssetId?: string;
  currentComponentId?: string;
  classificationSubmissionKey: string;
  costSubmissionKey: string;
  categories: SelectOptionViewModel[];
  assets: Array<SelectOptionViewModel & { categoryKey: string }>;
  components: Array<SelectOptionViewModel & { assetId: string }>;
  costKinds: SelectOptionViewModel[];
  defaultServiceDate: string;
  recordedCostLabel: string;
  recordedCostLineCount: number;
}

export interface RequestReviewViewModel {
  available: boolean;
  permitted: boolean;
  submitAction: string;
  requestId: string;
  reference: string;
  expectedStatus: "submitted" | "under_review";
  statusLabel: string;
  impactReviewed: boolean;
  canPrepareWorkOrder: boolean;
  canCreateWorkOrder: boolean;
  createWorkOrderHref?: string;
  impactSubmitAction: string;
  pendingApproval?: ApprovalDecisionViewModel;
  latestImpact?: {
    id: string;
    storeOperatingState: string;
    safetyConcern: string;
    productInventoryRisk: string;
    productInventoryValueInput?: string;
    productInventoryValueLabel: string;
    customersAffected: string;
    complianceImpact: string;
    capacityUnavailablePercentInput?: string;
    capacityUnavailableLabel: string;
    redundantEquipment: string;
    revenueFunctionImpact?: string;
    estimatedDailyRevenueExposureInput?: string;
    estimatedDailyRevenueExposureLabel: string;
    estimatedDowntimeMinutesInput?: string;
    estimatedDowntimeLabel: string;
    confidence: string;
    notes?: string;
  };
  impactHistory: Array<{
    id: string;
    kindLabel: string;
    summary: string;
    provenanceLabel: string;
  }>;
  impactCaveat: string;
}

export interface AttentionItemControlViewModel {
  available: boolean;
  permitted: boolean;
  submitAction: string;
  id: string;
  kind: "exception" | "follow_up";
  status: string;
  title: string;
  description: string;
  accountableParty?: string;
  nextAction?: string;
  dueAt?: string;
  escalationTo?: string;
  reconciliationOptions?: SelectOptionViewModel[];
  unmatchedVisit?: {
    createWorkOrderHref: string;
    providerLabel: string;
    purpose: string;
  };
}

export interface CreateStorePageViewModel {
  state: DataState;
  page: PageContext;
  submitAction: string;
  cancelLink: SupportingLink;
  regions: SelectOptionViewModel[];
  timeZones: SelectOptionViewModel[];
}

export interface CreateVendorPageViewModel {
  state: DataState;
  page: PageContext;
  submitAction: string;
  cancelLink: SupportingLink;
  specialties: SelectOptionViewModel[];
  coverageScopes: SelectOptionViewModel[];
}
