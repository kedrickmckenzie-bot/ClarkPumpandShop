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
  /** Server-resolved organization policy; UI visibility mirrors command authorization. */
  effectiveCapabilities?: string[];
  capabilityWarnings?: string[];
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

export type TrendMetricId =
  | "recorded_cost"
  | "linked_invoice"
  | "work_orders"
  | "service_visits"
  | "vendor_response"
  | "pm_completion";

export type TrendComparisonId = "previous_period" | "previous_year" | "none";

export interface TrendFilterSelectViewModel {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  group?: "analysis" | "operating_scope" | "maintenance_scope";
  helperText?: string;
}

export interface TrendComparisonPointViewModel {
  id: string;
  label: string;
  currentMonthLabel: string;
  currentValue: number;
  currentFormattedValue: string;
  currentSourceCount: number;
  currentHasData: boolean;
  isPartialPeriod?: boolean;
  comparisonMonthLabel?: string;
  comparisonValue?: number;
  comparisonFormattedValue?: string;
  comparisonSourceCount?: number;
  comparisonHasData?: boolean;
  changeLabel?: string;
  currentLink: SupportingLink;
  comparisonLink?: SupportingLink;
}

export interface TrendOutlookViewModel {
  kind: "projection" | "measured_baseline" | "insufficient_history";
  eyebrow: string;
  label: string;
  value: string;
  description: string;
  facts: Array<{ label: string; value: string }>;
  caution: string;
  evidenceLink?: SupportingLink;
}

export type TrendBenchmarkSortId = "store" | "actual" | "comparable" | "expected" | "variance" | "ratio" | "signal" | "coverage";
export type TrendDriverSortId = "segment" | "current" | "comparison" | "change" | "evidence";
export type TrendSourceSortId = "record" | "store" | "service" | "date" | "value";
export type TrendSortDirection = "asc" | "desc";
export type TrendAnalysisView = "overview" | "stores" | "drivers" | "records";

export interface TrendBenchmarkSortLinkViewModel {
  id: TrendBenchmarkSortId;
  label: string;
  link: SupportingLink;
  active: boolean;
  direction?: TrendSortDirection;
}

export interface TrendDriverSortLinkViewModel {
  id: TrendDriverSortId;
  label: string;
  link: SupportingLink;
  active: boolean;
  direction?: TrendSortDirection;
}

export interface TrendSourceSortLinkViewModel {
  id: TrendSourceSortId;
  label: string;
  link: SupportingLink;
  active: boolean;
  direction?: TrendSortDirection;
}

export interface TrendBenchmarkRowViewModel {
  id: string;
  label: string;
  context: string;
  actualValue?: number;
  actualLabel: string;
  comparableActualValue?: number;
  comparableActualLabel: string;
  excludedActualLabel?: string;
  expectedValue?: number;
  expectedLabel: string;
  rangeLowValue?: number;
  rangeHighValue?: number;
  rangeLabel: string;
  varianceValue?: number;
  varianceLabel: string;
  ratioValue?: number;
  ratioLabel: string;
  signalRank: number;
  signalLabel: string;
  signalTone: Tone;
  findingExplanation?: string;
  persistenceLabel?: string;
  driverLink?: SupportingLink;
  largestRecordLink?: SupportingLink;
  coverageValue: number;
  coverageLabel: string;
  focusLink: SupportingLink;
  recordsLink: SupportingLink;
  /** @deprecated Use recordsLink for the exact evidence set. */
  link: SupportingLink;
  peerLink?: SupportingLink;
}

export type TrendBreakdownId = "region" | "store" | "category" | "group" | "profile" | "component" | "vendor";

export interface TrendDriverRowViewModel {
  id: string;
  label: string;
  context?: string;
  currentValue?: number;
  currentLabel: string;
  comparisonValue?: number;
  comparisonLabel: string;
  changeValue?: number;
  changeLabel: string;
  shareLabel?: string;
  currentSourceCount: number;
  comparisonSourceCount: number;
  focusLink?: SupportingLink;
  recordsLink: SupportingLink;
  /** @deprecated Use recordsLink for the exact evidence set. */
  link: SupportingLink;
}

export interface TrendInvestigationCrumbViewModel {
  id: string;
  label: string;
  link?: SupportingLink;
}

export interface TrendInvestigationTrailViewModel {
  id: "location" | "maintenance" | "vendor";
  label: string;
  crumbs: TrendInvestigationCrumbViewModel[];
}

export interface TrendEvidenceFocusViewModel {
  label: string;
  description: string;
  clearLink: SupportingLink;
}

export interface TrendRelatedMeasureViewModel {
  metricId: TrendMetricId;
  label: string;
  value: string;
  comparisonLabel?: string;
  evidenceLabel: string;
  description: string;
  link: SupportingLink;
}

export interface TrendInsightViewModel {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  tone: Tone;
  link: SupportingLink;
}

export interface TrendAnalysisPageViewModel {
  state: DataState;
  page: PageContext;
  canonicalQuery: string;
  activeView: TrendAnalysisView;
  scopeSummary: string;
  views: Array<{ id: TrendAnalysisView; label: string; description: string; link: SupportingLink }>;
  filterAction: string;
  filters: TrendFilterSelectViewModel[];
  clearFiltersHref: string;
  metricId: TrendMetricId;
  metricLabel: string;
  metricDefinition: string;
  comparisonId: TrendComparisonId;
  comparisonLabel: string;
  currentPeriodName: string;
  comparisonPeriodName?: string;
  currentPeriodLabel: string;
  comparisonPeriodLabel?: string;
  comparisonNote?: string;
  investigation: {
    trails: TrendInvestigationTrailViewModel[];
    evidence?: TrendEvidenceFocusViewModel;
  };
  relatedMeasures: TrendRelatedMeasureViewModel[];
  summary: MetricViewModel[];
  series: TrendComparisonPointViewModel[];
  outlook: TrendOutlookViewModel;
  insights: TrendInsightViewModel[];
  drivers: {
    breakdownId: TrendBreakdownId;
    title: string;
    description: string;
    reconciliationLabel: string;
    sampleLabel: string;
    sortLinks: TrendDriverSortLinkViewModel[];
    pagination?: PaginationViewModel;
    rows: TrendDriverRowViewModel[];
  };
  benchmark: {
    title: string;
    description: string;
    methodology: string;
    sampleLabel: string;
    sortLinks: TrendBenchmarkSortLinkViewModel[];
    pagination?: PaginationViewModel;
    rows: TrendBenchmarkRowViewModel[];
  };
  sourceTable: TableViewModel;
  sourceHeading: string;
  sourceDescription: string;
  sourceSortLinks: TrendSourceSortLinkViewModel[];
  sourceSummary: string;
  sourcePeriodLabel: string;
  sourceExportLink: SupportingLink;
  sourcePagination: PaginationViewModel;
  notes: string[];
}

export interface ActionItemViewModel {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  attentionType?: "service_record" | "follow_up" | "vendor_task";
  attentionLane?: "mine" | "team" | "waiting" | "upcoming";
  attentionGroup?: "work_vendor" | "completion" | "service_record" | "financial" | "vendor_relationship";
  sourceCount?: number;
  reasonLabel?: string;
  storeLabel?: string;
  recordLabel?: string;
  dueAt?: string;
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

export interface ApprovedLaterManagementViewModel {
  kind: "approved_later";
  workOrderId: string;
  workOrderNumber: string;
  organizationName: string;
  storeId: string;
  storeLabel: string;
  storeAddress: string;
  storeTimeZone: string;
  problem: string;
  workScope: string;
  categoryLabel: string;
  equipmentLabel?: string;
  requestedTimingLabel?: string;
  posture: "complete_using_professional_judgment" | "look_and_report";
  priority: "emergency" | "urgent" | "routine" | "planned";
  deadlineInputValue: string;
  reviewByLabel: string;
  internalReviewThresholdInputValue?: string;
  currentIssuanceRevision: number;
  selectedVendorId?: string;
  vendors: Array<{
    value: string;
    label: string;
    description: string;
    dispatchEmail: string;
    preferred: boolean;
  }>;
  canManage: boolean;
}

export interface TableRowViewModel {
  id: string;
  label: string;
  href: string;
  cells: TableCellViewModel[];
  management?: ApprovedLaterManagementViewModel;
}

export interface TableViewModel {
  id: string;
  caption: string;
  columns: TableColumnViewModel[];
  rows: TableRowViewModel[];
}

export interface PaginationPageLinkViewModel {
  page: number;
  href: string;
  current: boolean;
}

export interface PaginationViewModel {
  summary: string;
  currentPage: number;
  totalPages: number;
  pageLinks: PaginationPageLinkViewModel[];
  previousHref?: string;
  nextHref?: string;
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
  pagination?: PaginationViewModel;
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
  tableHeading?: string;
  table?: TableViewModel;
  timelineHeading?: string;
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
    checkedOutLabel?: string;
    unmatchedReason: string;
    outcomeLabel?: string;
    outcomeNotes?: string;
  };
  sourcePm?: {
    occurrenceId: string;
    planName: string;
    dueLabel: string;
    statusLabel: string;
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
  previousProposals?: EstimateProposalViewModel[];
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
  expectedVersion: number;
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
  internalAccountability: {
    structured: boolean;
    ownerName: string;
    ownerType?: "membership" | "team";
    ownerId?: string;
    reassignAction: string;
    options: SelectOptionViewModel[];
  };
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
  linkExistingWorkAction?: string;
  relatedOpenWork: Array<{
    id: string;
    number: string;
    problem: string;
    statusLabel: string;
    internalOwner: string;
  }>;
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
  defaultTimeZone: string;
}

export interface CreateVendorPageViewModel {
  state: DataState;
  page: PageContext;
  submitAction: string;
  cancelLink: SupportingLink;
  specialties: SelectOptionViewModel[];
  coverageScopes: SelectOptionViewModel[];
}
