export type WorkFulfillmentMode = "internal" | "external" | "decide_later";

export type WorkPriority = "routine" | "soon" | "urgent" | "emergency";

export interface StoreOption {
  id: string;
  storeNumber: string;
  name: string;
  address: string;
  regionName?: string;
}

export interface InternalTeamOption {
  id: string;
  name: string;
  description?: string;
  coverageLabel?: string;
}

export interface VendorOption {
  id: string;
  name: string;
  description?: string;
  specialties: string[];
  aliases?: string[];
  coverage: string[];
  coveredStoreIds?: string[];
  preferredStoreIds?: string[];
  dispatchEmail?: string;
  dispatchPhone?: string;
  afterHoursLabel?: string;
}

export interface WorkOrderCreationValue {
  storeId: string;
  problem: string;
  priority: WorkPriority;
  fulfillmentMode: WorkFulfillmentMode;
  internalTeamId?: string;
  vendorId?: string;
}

export interface ServiceAuthorizationRecord {
  workOrderId: string;
  customerWorkOrderNumber: string;
  store: StoreOption;
  vendor: VendorOption;
  problem: string;
  requestedService?: string;
  priority: WorkPriority;
  requestedWindow?: string;
  accessInstructions?: string;
  nteMinorUnits?: number;
  currency: string;
}

export interface ServiceAuthorizationIssueValue {
  workOrderId: string;
  customerWorkOrderNumber: string;
  nteMinorUnits?: number;
  currency: string;
  sendByEmail: boolean;
  email?: string;
  sendByText: boolean;
  phone?: string;
  acceptanceRequested: boolean;
  vendorNote?: string;
}

export interface VisitWorkOrderOption {
  id: string;
  number: string;
  title: string;
  storeId: string;
  assetLabel?: string;
  requestedService?: string;
}

export type VisitChannel = "app" | "qr" | "store_kiosk" | "secure_link";

export type VisitEvidenceState =
  | "pending"
  | "location_verified"
  | "store_kiosk_recorded"
  | "location_not_shared"
  | "outside_geofence"
  | "manual_exception";

export interface VisitEvidence {
  state: VisitEvidenceState;
  capturedAt?: string;
  accuracyMeters?: number;
  distanceMeters?: number;
  note?: string;
}

export interface VisitCheckInValue {
  storeId: string;
  technicianName: string;
  vendorName: string;
  workOrderId?: string;
  noWorkOrderReason?: string;
  channel: VisitChannel;
  evidence: VisitEvidence;
  recordedAt: string;
}

export type VisitOutcome =
  | "resolved"
  | "diagnosed_waiting_parts"
  | "return_visit_required"
  | "unresolved"
  | "preventive_service_complete";

export interface ActiveVisit {
  id: string;
  storeId: string;
  technicianName: string;
  vendorName: string;
  workOrderId?: string;
  noWorkOrderReason?: string;
  channel: VisitChannel;
  evidence: VisitEvidence;
  startedAt: string;
}

export interface VisitCheckOutValue {
  visitId: string;
  outcome: VisitOutcome;
  notes?: string;
  files: File[];
  channel: VisitChannel;
  evidence: VisitEvidence;
  recordedAt: string;
}
