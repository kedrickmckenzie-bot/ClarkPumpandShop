export type OperatorRole =
  | "executive"
  | "facilities"
  | "regional"
  | "store_manager"
  | "finance";

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
  dueLabel: string;
  ownerLabel: string;
  tone: Tone;
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
  table: TableViewModel;
  resultSummary: string;
  search?: {
    label: string;
    placeholder: string;
    value?: string;
    action: string;
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
  metrics: MetricViewModel[];
  priorityActions: ActionItemViewModel[];
  breakdowns: BreakdownViewModel[];
  trends: TrendViewModel[];
  spotlight?: {
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
  table?: TableViewModel;
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

export interface SelectOptionViewModel {
  value: string;
  label: string;
  description?: string;
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
  assets: SelectOptionViewModel[];
  defaults?: {
    storeId?: string;
    assetId?: string;
    categoryKey?: string;
  };
  sourceRequest?: {
    id: string;
    reference: string;
    storeId: string;
    problem: string;
    reporterName: string;
    submittedLabel: string;
  };
}

export interface VendorIssuanceViewModel {
  available: boolean;
  permitted: boolean;
  submitAction: string;
  workOrderId: string;
  workOrderNumber: string;
  assignmentKind: "internal" | "outside_vendor" | "choose_later";
  selectedVendorId?: string;
  vendors: SelectOptionViewModel[];
  channels: SelectOptionViewModel[];
  currentRevision?: number;
  helperText: string;
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
