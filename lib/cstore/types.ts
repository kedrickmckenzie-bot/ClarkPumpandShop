export type EntityId = string;
export type OrganizationId = EntityId;
export type IsoDate = string;
export type IsoTimestamp = string;
export type CurrencyCode = "USD";
export type MinorUnits = number;

export type MaintenanceCategoryKey =
  | "refrigeration"
  | "hvac"
  | "fuel_forecourt"
  | "foodservice"
  | "electrical_lighting"
  | "plumbing"
  | "building_exterior"
  | "grounds"
  | "fire_life_safety"
  | "security"
  | `custom_${string}`;

export type WorkPriority = "routine" | "soon" | "urgent" | "emergency";

export type WorkStatus =
  | "draft"
  | "ready_to_issue"
  | "issued"
  | "awaiting_vendor_response"
  | "accepted"
  | "scheduled"
  | "onsite"
  | "waiting_parts"
  | "unresolved"
  | "completed"
  | "awaiting_invoice"
  | "invoice_received"
  | "closed"
  | "cancelled";

export type FulfillmentMode = "internal" | "external" | "blended" | "unassigned";
export type AssignmentPartyType = "person" | "team" | "vendor";
export type AssignmentStatus =
  | "offered"
  | "acknowledged"
  | "accepted"
  | "active"
  | "completed"
  | "declined";
export type SpendBasis = "requested" | "approved" | "recorded" | "invoiced";
export type EvidenceStrength =
  | "location_verified"
  | "store_kiosk"
  | "employee_confirmed"
  | "manual_unverified";
export type VisitChannel =
  | "vendor_app"
  | "qr_mobile_web"
  | "secure_work_link"
  | "store_kiosk"
  | "manual_exception";

export interface Money {
  amountMinor: MinorUnits;
  currency: CurrencyCode;
}

export interface Organization {
  id: OrganizationId;
  displayName: string;
  legalName: string;
  timezone: string;
  currency: CurrencyCode;
  demoMode: boolean;
  storeLabel: string;
  workOrderPrefix: string;
}

export interface Division {
  id: EntityId;
  organizationId: OrganizationId;
  name: string;
  code: string;
  status: "active" | "inactive";
}

export interface Region {
  id: EntityId;
  organizationId: OrganizationId;
  divisionId?: EntityId;
  name: string;
  code: string;
  managerPersonId: EntityId;
  description: string;
  sortOrder: number;
}

export interface PostalAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: "US";
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface StoreAlias {
  value: string;
  type: "previous_number" | "alternate_name" | "legacy_id";
}

export interface Store {
  id: EntityId;
  organizationId: OrganizationId;
  divisionId?: EntityId;
  regionId?: EntityId;
  storeNumber: string;
  name: string;
  normalizedAddress: string;
  address: PostalAddress;
  coordinates: GeoPoint;
  externalIdentifiers: Record<string, string>;
  aliases: StoreAlias[];
  phone: string;
  managerPersonId: EntityId;
  format: "fuel_and_market" | "market_only" | "travel_center";
  open24Hours: boolean;
  openedOn: IsoDate;
  squareFeet: number;
  activeCategoryIds: EntityId[];
  status: "open" | "temporarily_closed" | "closed";
  searchTerms: string[];
}

export interface MaintenanceCategory {
  id: EntityId;
  organizationId: OrganizationId;
  key: MaintenanceCategoryKey;
  label: string;
  description: string;
  aliases: string[];
  color: string;
  sortOrder: number;
  active?: boolean;
}

export interface TaxonomyNode {
  id: EntityId;
  organizationId: OrganizationId;
  categoryId: EntityId;
  parentId?: EntityId;
  canonicalKey: string;
  label: string;
  aliases: string[];
  kind: "group" | "system" | "equipment_type";
  sortOrder: number;
  active?: boolean;
}

export interface WarrantyDetails {
  provider: string;
  startsOn: IsoDate;
  endsOn: IsoDate;
  coverage: string;
  reference: string;
}

export interface Asset {
  id: EntityId;
  organizationId: OrganizationId;
  storeId: EntityId;
  categoryId: EntityId;
  taxonomyNodeId: EntityId;
  taxonomyPathIds: EntityId[];
  assetCode: string;
  name: string;
  assetType: string;
  locationDetail: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  installedOn: IsoDate;
  expectedLifeYears: number;
  replacementEstimateMinor: MinorUnits;
  currency: CurrencyCode;
  supplierVendorId?: EntityId;
  warranty?: WarrantyDetails;
  status: "active" | "out_of_service" | "retired";
  criticality: "standard" | "important" | "critical";
  searchTerms: string[];
}

export interface AssetComponent {
  id: EntityId;
  organizationId: OrganizationId;
  assetId: EntityId;
  parentComponentId?: EntityId;
  componentCode: string;
  name: string;
  componentType: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installedOn?: IsoDate;
  status: "active" | "monitor" | "replaced";
}

export interface Person {
  id: EntityId;
  organizationId: OrganizationId;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  employeeNumber: string;
  roles: Array<
    | "owner"
    | "facilities_manager"
    | "regional_manager"
    | "store_manager"
    | "store_employee"
    | "internal_technician"
    | "finance_reviewer"
  >;
  scopeIds: EntityId[];
  active: boolean;
}

export interface InternalTeam {
  id: EntityId;
  organizationId: OrganizationId;
  name: string;
  description: string;
  memberPersonIds: EntityId[];
  categoryIds: EntityId[];
  regionIds: EntityId[];
}

export interface VendorSpecialty {
  categoryId: EntityId;
  label: string;
  aliases: string[];
  equipmentTypes: string[];
}

export interface VendorContact {
  id: EntityId;
  name: string;
  role: "dispatch" | "billing" | "manager" | "after_hours";
  email: string;
  phone: string;
  preferredChannel: "email" | "sms" | "phone";
}

export interface Vendor {
  id: EntityId;
  organizationId: OrganizationId;
  legalName: string;
  displayName: string;
  customerVendorNumber: string;
  description: string;
  aliases: string[];
  specialties: VendorSpecialty[];
  searchTerms: string[];
  coverageRegionIds: EntityId[];
  preferredStoreIds: EntityId[];
  contacts: VendorContact[];
  afterHoursAvailable: boolean;
  status: "approved" | "preferred" | "inactive";
  insuranceExpiresOn?: IsoDate;
  portalEnabled: boolean;
}

export interface ServiceRequest {
  id: EntityId;
  organizationId: OrganizationId;
  storeId: EntityId;
  workOrderId?: EntityId;
  submittedByPersonId: EntityId;
  submittedAt: IsoTimestamp;
  immutableDescription: string;
  reportedLocation: string;
  urgency: WorkPriority;
  categoryHint?: string;
  attachmentDocumentIds: EntityId[];
  reviewStatus: "new" | "reviewed" | "converted";
}

export interface Accountability {
  partyType: AssignmentPartyType;
  partyId: EntityId;
  nextAction: string;
  dueAt: IsoTimestamp;
  escalationPartyId: EntityId;
}

export interface RequestedWindow {
  startsAt: IsoTimestamp;
  endsAt: IsoTimestamp;
}

export interface WorkOrder {
  id: EntityId;
  organizationId: OrganizationId;
  number: string;
  storeId: EntityId;
  requestId?: EntityId;
  pmOccurrenceId?: EntityId;
  categoryId?: EntityId;
  taxonomyNodeId?: EntityId;
  assetId?: EntityId;
  componentId?: EntityId;
  title: string;
  problemDescription: string;
  scopeOfWork: string;
  priority: WorkPriority;
  source: "employee_request" | "manager_direct" | "pm" | "unplanned_visit";
  fulfillmentMode: FulfillmentMode;
  status: WorkStatus;
  createdByPersonId: EntityId;
  createdAt: IsoTimestamp;
  requestedWindow: RequestedWindow;
  scheduledWindow?: RequestedWindow;
  accountable?: Accountability;
  notToExceedMinor?: MinorUnits;
  currency: CurrencyCode;
  outcome?:
    | "resolved"
    | "diagnosed_waiting_parts"
    | "temporary_repair"
    | "unresolved"
    | "preventive_complete";
  completedAt?: IsoTimestamp;
  closedAt?: IsoTimestamp;
  classificationDeferred: boolean;
  tags: string[];
}

export interface WorkAssignment {
  id: EntityId;
  organizationId: OrganizationId;
  workOrderId: EntityId;
  partyType: AssignmentPartyType;
  partyId: EntityId;
  status: AssignmentStatus;
  assignedAt: IsoTimestamp;
  acknowledgedAt?: IsoTimestamp;
  completedAt?: IsoTimestamp;
  assignmentNote: string;
}

export interface VendorIssuance {
  id: EntityId;
  organizationId: OrganizationId;
  workOrderId: EntityId;
  vendorId: EntityId;
  assignmentId: EntityId;
  version: number;
  issuedAt: IsoTimestamp;
  issuedByPersonId: EntityId;
  channels: Array<"email" | "sms" | "portal">;
  recipientContactIds: EntityId[];
  deliveryStatus: "queued" | "delivered" | "failed";
  /** Whether the operator asked the vendor to respond through the secure link. */
  acceptanceRequested?: boolean;
  viewedAt?: IsoTimestamp;
  response?: "accepted" | "declined" | "date_proposed" | "question";
  respondedAt?: IsoTimestamp;
  proposedArrivalAt?: IsoTimestamp;
  vendorReference?: string;
  customerBillingInstruction: string;
  scopeSnapshot: string;
  notToExceedMinor?: MinorUnits;
  currency: CurrencyCode;
}

export interface VisitLocationEvidence {
  required: boolean;
  consented: boolean;
  capturedAt?: IsoTimestamp;
  coordinates?: GeoPoint;
  accuracyMeters?: number;
  distanceFromStoreMeters?: number;
  verification: "inside_geofence" | "outside_geofence" | "not_collected";
}

export interface Visit {
  id: EntityId;
  organizationId: OrganizationId;
  storeId: EntityId;
  workOrderId?: EntityId;
  vendorId?: EntityId;
  internalPersonId?: EntityId;
  technicianName: string;
  technicianIdentifier: string;
  purposeWhenUnmatched?: string;
  channelStarted: VisitChannel;
  channelEnded?: VisitChannel;
  checkedInAt: IsoTimestamp;
  checkedOutAt?: IsoTimestamp;
  reportedArrivalAt?: IsoTimestamp;
  evidenceStrength: EvidenceStrength;
  locationEvidence: VisitLocationEvidence;
  outcome?:
    | "resolved"
    | "diagnosed_waiting_parts"
    | "temporary_repair"
    | "unresolved"
    | "preventive_complete";
  checkoutNote?: string;
  documentIds: EntityId[];
  correctedByEventId?: EntityId;
}

export interface CostLine {
  id: EntityId;
  organizationId: OrganizationId;
  workOrderId: EntityId;
  storeId: EntityId;
  categoryId?: EntityId;
  assetId?: EntityId;
  vendorId?: EntityId;
  basis: Exclude<SpendBasis, "invoiced">;
  costType: "labor" | "materials" | "trip" | "rental" | "miscellaneous";
  description: string;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  recordedAt: IsoTimestamp;
  source: "requester_estimate" | "manager_authorization" | "vendor_quote" | "internal_entry";
}

export interface InvoiceLineItem {
  id: EntityId;
  workOrderId?: EntityId;
  description: string;
  costType: "labor" | "materials" | "trip" | "rental" | "miscellaneous" | "tax";
  quantity: number;
  unitAmountMinor: MinorUnits;
  amountMinor: MinorUnits;
}

export interface Invoice {
  id: EntityId;
  organizationId: OrganizationId;
  vendorId: EntityId;
  invoiceNumber: string;
  customerWorkOrderReferences: string[];
  vendorServiceReferences: string[];
  invoiceDate: IsoDate;
  receivedAt: IsoTimestamp;
  status: "received" | "needs_review" | "approved" | "archived";
  currency: CurrencyCode;
  lineItems: InvoiceLineItem[];
  documentId: EntityId;
}

export interface InvoiceWorkLink {
  id: EntityId;
  organizationId: OrganizationId;
  invoiceId: EntityId;
  workOrderId: EntityId;
  storeId: EntityId;
  categoryId?: EntityId;
  assetId?: EntityId;
  attributedAmountMinor: MinorUnits;
  currency: CurrencyCode;
  matchMethod: "work_order_reference" | "manual" | "suggested";
  matchStatus: "matched" | "review_needed";
  linkedAt: IsoTimestamp;
  linkedByPersonId: EntityId;
}

export interface PreventiveMaintenancePlan {
  id: EntityId;
  organizationId: OrganizationId;
  storeId: EntityId;
  categoryId: EntityId;
  assetId?: EntityId;
  name: string;
  description: string;
  cadence: "monthly" | "quarterly" | "semiannual" | "annual";
  fulfillmentMode: FulfillmentMode;
  assignedPartyType: AssignmentPartyType;
  assignedPartyId: EntityId;
  active: boolean;
  nextDueAt: IsoTimestamp;
  requiredEvidence: Array<"checklist" | "photo" | "reading" | "visit">;
}

export interface PmOccurrence {
  id: EntityId;
  organizationId: OrganizationId;
  pmPlanId: EntityId;
  storeId: EntityId;
  workOrderId?: EntityId;
  dueAt: IsoTimestamp;
  status: "upcoming" | "due" | "overdue" | "completed" | "skipped";
  completedAt?: IsoTimestamp;
  completedByPartyId?: EntityId;
  completionNote?: string;
  evidenceRecords?: Array<{
    id: EntityId;
    requirement: PreventiveMaintenancePlan["requiredEvidence"][number];
    status: "satisfied" | "overridden";
    source: "visit" | "document" | "manager_confirmation" | "manager_override";
    sourceRecordIds: EntityId[];
    value?: string;
    recordedAt: IsoTimestamp;
    recordedByPersonId: EntityId;
  }>;
}

export interface EvidenceDocument {
  id: EntityId;
  organizationId: OrganizationId;
  storeId?: EntityId;
  workOrderId?: EntityId;
  visitId?: EntityId;
  invoiceId?: EntityId;
  kind: "request_photo" | "before_photo" | "after_photo" | "service_ticket" | "invoice" | "quote";
  fileName: string;
  mediaType: string;
  createdAt: IsoTimestamp;
  createdByLabel: string;
  visibility: "operator_only" | "engagement_parties";
}

export type ExceptionType =
  | "invoice_over_nte"
  | "invoice_missing_work_order"
  | "duplicate_invoice_reference"
  | "visit_without_work_order"
  | "missing_checkout"
  | "outside_geofence"
  | "pm_overdue"
  | "repeat_repair"
  | "warranty_review"
  | "classification_incomplete"
  | "follow_up_overdue";

export interface ExceptionRecord {
  id: EntityId;
  organizationId: OrganizationId;
  type: ExceptionType;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved";
  title: string;
  description: string;
  storeId?: EntityId;
  workOrderId?: EntityId;
  visitId?: EntityId;
  invoiceId?: EntityId;
  assetId?: EntityId;
  vendorId?: EntityId;
  sourceRecordIds: EntityId[];
  assignedPersonId: EntityId;
  openedAt: IsoTimestamp;
  dueAt: IsoTimestamp;
  resolvedAt?: IsoTimestamp;
}

export interface AuditEvent {
  id: EntityId;
  organizationId: OrganizationId;
  entityType:
    | "request"
    | "work_order"
    | "assignment"
    | "vendor_issuance"
    | "visit"
    | "invoice"
    | "invoice_work_link"
    | "pm_occurrence"
    | "exception"
    | "report"
    | "store"
    | "vendor"
    | "asset"
    | "taxonomy";
  entityId: EntityId;
  eventType: string;
  actorType: "person" | "vendor_contact" | "technician" | "system";
  actorId?: EntityId;
  channel: "manager_web" | "store_portal" | "vendor_link" | "vendor_app" | "qr" | "kiosk" | "system";
  occurredAt: IsoTimestamp;
  summary: string;
  payloadSnapshot: Record<string, string | number | boolean | null>;
  demoMode: true;
}

export interface DemoDataset {
  asOf: IsoTimestamp;
  organization: Organization;
  divisions: Division[];
  regions: Region[];
  stores: Store[];
  categories: MaintenanceCategory[];
  taxonomyNodes: TaxonomyNode[];
  assets: Asset[];
  assetComponents: AssetComponent[];
  people: Person[];
  teams: InternalTeam[];
  vendors: Vendor[];
  requests: ServiceRequest[];
  workOrders: WorkOrder[];
  assignments: WorkAssignment[];
  vendorIssuances: VendorIssuance[];
  visits: Visit[];
  costLines: CostLine[];
  invoices: Invoice[];
  invoiceWorkLinks: InvoiceWorkLink[];
  pmPlans: PreventiveMaintenancePlan[];
  pmOccurrences: PmOccurrence[];
  documents: EvidenceDocument[];
  exceptions: ExceptionRecord[];
  auditEvents: AuditEvent[];
}

export interface RecordScope {
  regionId?: EntityId;
  storeId?: EntityId;
  categoryId?: EntityId;
  vendorId?: EntityId;
  assetId?: EntityId;
  from?: IsoTimestamp;
  to?: IsoTimestamp;
}

export interface SpendFilter extends RecordScope {
  basis: SpendBasis;
}
