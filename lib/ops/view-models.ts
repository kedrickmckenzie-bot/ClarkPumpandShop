import type {
  AssignmentKind,
  AssignmentStatus,
  CurrencyCode,
  ExceptionKind,
  ExceptionStatus,
  IsoDateTime,
  LocationResult,
  OpsId,
  Page,
  VisitChannel,
  VisitOutcome,
  VendorResponseKind,
  WorkOrderPriority,
  WorkOrderStatus,
} from "./types";

export interface PublicStoreGatewayView {
  organizationId: OpsId;
  organizationName: string;
  store: {
    id: OpsId;
    storeNumber: string;
    name: string;
    formattedAddress: string;
    locationPolicyEnabled: boolean;
  };
  approvedVendors: Array<{ id: OpsId; name: string; specialties: string[] }>;
  actions: readonly ["report_issue", "vendor_sign_in", "current_visits"];
}

export interface RequestListRow {
  id: OpsId;
  reference: string;
  storeId: OpsId;
  storeNumber: string;
  storeName: string;
  reporterName: string;
  problem: string;
  priority: WorkOrderPriority;
  status: string;
  submittedAt: IsoDateTime;
  convertedWorkOrderId?: OpsId;
}

export interface VendorDirectoryRow {
  id: OpsId;
  name: string;
  status: string;
  preferred: boolean;
  specialties: string[];
  coverageLabels: string[];
  openWorkOrders: number;
  activeVisits: number;
  returnVisitWorkOrders: number;
}

export interface VisitListRow {
  id: OpsId;
  storeId: OpsId;
  storeNumber: string;
  storeName: string;
  providerKind: "outside_vendor" | "internal";
  vendorId?: OpsId;
  internalMembershipId?: OpsId;
  providerName: string;
  workOrderId?: OpsId;
  workOrderNumber?: string;
  technicianName: string;
  purpose: string;
  status: string;
  checkedInAt: IsoDateTime;
  checkedOutAt?: IsoDateTime;
  outcome?: VisitOutcome;
  locationResult: LocationResult;
  approximateObservedSeconds?: number;
}

export interface WorkOrderDetailView extends WorkOrderListRow {
  request?: RequestListRow;
  authorizedScope?: string;
  asset?: { id: OpsId; name: string; assetTag: string };
  component?: { id: OpsId; name: string };
  nte?: { amountMinor: number; currency: CurrencyCode };
  vendorServiceTicketNumber?: string;
  vendorInvoiceNumber?: string;
  externalAccountingPo?: string;
  visits: VisitListRow[];
  followUps: Array<{ id: OpsId; nextAction: string; accountableParty: string; dueAt: IsoDateTime; status: string }>;
  costs: Array<{ id: OpsId; kind: string; description: string; amountMinor: number; currency: CurrencyCode; serviceDate: string }>;
}

export interface StoreDetailView extends StoreSearchRow {
  regionId?: OpsId;
  status: string;
  activeVisits: VisitListRow[];
  openWorkOrders: WorkOrderListRow[];
  assets: Array<{ id: OpsId; assetTag: string; name: string; categoryKey: string; status: string; recordedCostMinor: number }>;
}

export interface AssetDetailView {
  id: OpsId;
  storeId: OpsId;
  assetTag: string;
  name: string;
  categoryKey: string;
  groupPath: string[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installedAt?: IsoDateTime;
  expectedLifeYears?: number;
  warrantyEndsAt?: IsoDateTime;
  replacementEstimateMinor?: number;
  currency: CurrencyCode;
  status: string;
  components: Array<{ id: OpsId; parentComponentId?: OpsId; name: string; partNumber?: string; serialNumber?: string }>;
  workOrders: WorkOrderListRow[];
  recordedCostMinor: number;
}

export interface PmOccurrenceRow {
  id: OpsId;
  planId: OpsId;
  planName: string;
  storeId: OpsId;
  storeNumber: string;
  assetId?: OpsId;
  assetName?: string;
  dueAt: IsoDateTime;
  windowStartsAt: IsoDateTime;
  windowEndsAt: IsoDateTime;
  status: string;
  workOrderId?: OpsId;
}

export interface StoreSearchRow {
  id: OpsId;
  storeNumber: string;
  name: string;
  regionName?: string;
  formattedAddress: string;
  openWorkCount: number;
  activeVisitCount: number;
  recordedCostMinor: number;
  currency: CurrencyCode;
}

export interface WorkOrderListRow {
  id: OpsId;
  number: string;
  storeId: OpsId;
  storeNumber: string;
  storeName: string;
  problem: string;
  categoryKey?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignmentKind: AssignmentKind;
  assignmentStatus?: AssignmentStatus;
  vendorId?: OpsId;
  vendorName?: string;
  accountableParty: string;
  nextAction: string;
  dueAt?: IsoDateTime;
  createdAt: IsoDateTime;
  visitCount: number;
  recordedCostMinor: number;
  currency: CurrencyCode;
}

export interface ServiceAuthorizationView {
  organizationId: OpsId;
  organizationName: string;
  workOrderId: OpsId;
  assignmentId: OpsId;
  issuanceId: OpsId;
  workOrderNumber: string;
  revision: number;
  status: WorkOrderStatus;
  assignmentStatus: AssignmentStatus;
  store: {
    id: OpsId;
    storeNumber: string;
    name: string;
    formattedAddress: string;
    accessNotes?: string;
  };
  vendor: { id: OpsId; name: string };
  problem: string;
  priority: WorkOrderPriority;
  authorizedScope?: string;
  categoryKey?: string;
  asset?: { id: OpsId; name: string; assetTag: string };
  requestedTiming?: string;
  nte?: { amountMinor: number; currency: CurrencyCode };
  billingInstruction: string;
  issuedAt: IsoDateTime;
  latestResponse?: {
    response: VendorResponseKind;
    responderName: string;
    proposedAt?: IsoDateTime;
    message?: string;
    respondedAt: IsoDateTime;
  };
}

export interface ServiceAuthorizationSnapshot {
  organizationName: string;
  workOrderNumber: string;
  store: ServiceAuthorizationView["store"];
  vendor: ServiceAuthorizationView["vendor"];
  problem: string;
  priority: WorkOrderPriority;
  authorizedScope?: string;
  categoryKey?: string;
  asset?: ServiceAuthorizationView["asset"];
  requestedTiming?: string;
  nte?: ServiceAuthorizationView["nte"];
  billingInstruction: string;
  dispatchMessage?: string;
}

export interface StoreVisitContextView {
  organizationName: string;
  store: {
    id: OpsId;
    storeNumber: string;
    name: string;
    formattedAddress: string;
    locationPolicyEnabled: boolean;
  };
  vendor: { id: OpsId; name: string };
  eligibleWorkOrders: Array<{
    id: OpsId;
    number: string;
    problem: string;
    categoryKey?: string;
    status: WorkOrderStatus;
  }>;
  allowsNoWorkOrder: true;
}

export interface ActiveVisitView {
  organizationId: OpsId;
  id: OpsId;
  storeId: OpsId;
  storeNumber: string;
  storeName: string;
  vendorId: OpsId;
  vendorName: string;
  workOrderId?: OpsId;
  workOrderNumber?: string;
  unmatchedReason?: string;
  technicianName: string;
  purpose: string;
  checkedInAt: IsoDateTime;
  startedChannel: VisitChannel;
  checkInLocationResult: LocationResult;
  approximateObservedSeconds: number;
}

export interface TrustedStoreActiveVisitRow {
  id: OpsId;
  providerKind: "outside_vendor" | "internal";
  vendorId?: OpsId;
  internalMembershipId?: OpsId;
  providerName: string;
  technicianName: string;
  workOrderId?: OpsId;
  workOrderNumber?: string;
  unmatchedReason?: string;
  purpose: string;
  checkedInAt: IsoDateTime;
  startedChannel: VisitChannel;
}

export interface TrustedStoreDeviceView {
  organizationId: OpsId;
  organizationName: string;
  store: {
    id: OpsId;
    storeNumber: string;
    name: string;
    formattedAddress: string;
  };
  activeVisits: TrustedStoreActiveVisitRow[];
}

export interface VisitReceiptView extends ActiveVisitView {
  checkedOutAt: IsoDateTime;
  endedChannel: VisitChannel;
  outcome: VisitOutcome;
  outcomeNotes?: string;
  approximateObservedSeconds: number;
  disclaimer: "Observed onsite duration is approximate presence evidence, not certified labor.";
}

export interface ExceptionQueueRow {
  id: OpsId;
  kind: ExceptionKind;
  status: ExceptionStatus;
  severity: "info" | "attention" | "urgent";
  summary: string;
  storeId?: OpsId;
  storeNumber?: string;
  workOrderId?: OpsId;
  workOrderNumber?: string;
  visitId?: OpsId;
  detectedAt: IsoDateTime;
}

export interface ExecutiveSnapshotView {
  organizationId: OpsId;
  period: { startsAt: IsoDateTime; endsAt: IsoDateTime };
  scope: { regionId?: OpsId; storeId?: OpsId };
  activeVisits: number;
  unexpectedVisits: number;
  openExceptions: number;
  noWorkOrderVisits: number;
  missingCheckouts: number;
  openWorkOrders: number;
  overdueFollowUps: number;
  recordedCost: { amountMinor: number; currency: CurrencyCode };
  sourceCounts: {
    visits: number;
    workOrders: number;
    followUps: number;
    exceptions: number;
    costLines: number;
  };
}

export type StoreSearchPage = Page<StoreSearchRow>;
export type WorkOrderListPage = Page<WorkOrderListRow>;
export type ExceptionQueuePage = Page<ExceptionQueueRow>;
export type RequestListPage = Page<RequestListRow>;
export type VendorDirectoryPage = Page<VendorDirectoryRow>;
export type VisitListPage = Page<VisitListRow>;
export type PmOccurrencePage = Page<PmOccurrenceRow>;
