export type Role =
  | "executive"
  | "facilities"
  | "regional"
  | "store_manager"
  | "employee"
  | "vendor_office"
  | "technician";

export type Priority = "critical" | "high" | "routine" | "low";
export type WorkType =
  | "reactive"
  | "preventive"
  | "inspection"
  | "emergency"
  | "warranty"
  | "capital"
  | "internal";
export type WorkOrderStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "awaiting_vendor_acceptance"
  | "accepted"
  | "visit_active"
  | "follow_up_required"
  | "waiting_on_vendor"
  | "waiting_on_quote"
  | "waiting_on_approval"
  | "waiting_on_parts"
  | "return_visit_scheduled"
  | "completed_pending_verification"
  | "completed_pending_invoice"
  | "closed"
  | "reopened"
  | "cancelled";
export type VisitOutcome =
  | "resolved"
  | "temporary"
  | "diagnosed_unresolved"
  | "unable_to_diagnose"
  | "no_issue_found"
  | "unable_to_perform";
export type VerificationState =
  | "verified"
  | "outside_geofence"
  | "inaccurate"
  | "permission_denied"
  | "exception";

export interface Region {
  id: string;
  name: string;
}

export interface Store {
  id: string;
  regionId?: string;
  code: string;
  name: string;
  city: string;
  state: string;
  address1: string;
  postalCode: string;
  phone: string;
  managerName: string;
  district: string;
  status: "active" | "opening" | "temporarily_closed" | "inactive";
  openedAt: string;
  squareFeet: number;
  latitude: number;
  longitude: number;
  geofenceRadiusM: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
}

export interface StoreSystem {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  type: string;
  code: string;
  description: string;
  location: string;
  glCode: string;
  annualBudgetCents: number;
  ownerName: string;
  maintenanceStrategy: "run_to_failure" | "preventive" | "condition_based" | "statutory";
  state: "normal" | "watch" | "exception";
}

export interface Asset {
  id: string;
  storeSystemId: string;
  assetClass: string;
  name: string;
  manufacturer: string;
  model: string;
  serial: string;
  assetTag: string;
  location: string;
  condition: "excellent" | "good" | "fair" | "poor" | "failed";
  purchaseCostCents: number;
  lastServiceAt?: string;
  maintenanceStrategy: "run_to_failure" | "preventive" | "condition_based" | "statutory";
  meterType?: string;
  meterReading?: number;
  installedAt: string;
  expectedLifeYears: number;
  replacementCostCents: number;
  warrantyEndsAt: string;
  criticality: "critical" | "high" | "standard";
  state: "operational" | "watch" | "service_due" | "offline";
}

export interface Component {
  id: string;
  assetId: string;
  type: string;
  name: string;
  partNumber: string;
  serial?: string;
  quantity: number;
  unitCostCents: number;
  criticalSpare: boolean;
  installedAt: string;
  warrantyEndsAt: string;
  vendorId: string;
}

export interface Vendor {
  id: string;
  name: string;
  shortName: string;
  trade: string;
  dispatchEmail: string;
  accent: string;
}

export interface EmployeeReport {
  id: string;
  reference: string;
  storeId: string;
  reporterName: string;
  reporterRole: string;
  area: string;
  originalDescription: string;
  urgency: Priority;
  submittedAt: string;
  photoDocumentId?: string;
  status: "submitted" | "reviewed" | "duplicate" | "no_action" | "escalated";
}

export interface ReportReview {
  id: string;
  reportId: string;
  reviewerName: string;
  reviewerRole: string;
  decision: string;
  context: string;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  number: string;
  title: string;
  description: string;
  location?: string;
  problemCode?: string;
  failureCode?: string;
  requestedBy?: string;
  origin: "employee_report" | "manager" | "facilities" | "pm" | "inspection" | "warranty" | "capital" | "emergency";
  storeId: string;
  categoryId: string;
  systemId?: string;
  assetId?: string;
  componentId?: string;
  priority: Priority;
  workType: WorkType;
  status: WorkOrderStatus;
  accountableParty: string;
  assignmentType?: "internal" | "vendor" | "blended" | "unassigned";
  assignedToId?: string;
  assignedToName?: string;
  nextAction: string;
  dueAt?: string;
  escalation: string;
  vendorId?: string;
  vendorAcceptance: "not_issued" | "pending" | "accepted" | "declined" | "clarification";
  createdAt: string;
  requestedServiceAt?: string;
  targetResponseAt?: string;
  targetCompletionAt?: string;
  scheduledStartAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  downtimeMinutes?: number;
  safetyRisk?: "none" | "low" | "moderate" | "high";
  accessInstructions?: string;
  resolutionSummary?: string;
  laborCostCents?: number;
  partsCostCents?: number;
  travelCostCents?: number;
  purchaseOrderNumber?: string;
  tags?: string[];
  closedAt?: string;
  nteCents: number;
  costExposureCents: number;
  reportIds: string[];
  demoStory?: boolean;
}

export interface Technician {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  regionIds: string[];
  trades: string[];
  certifications: string[];
  employmentType: "internal" | "vendor";
  vendorId?: string;
  status: "available" | "assigned" | "off_duty" | "leave";
  weeklyCapacityHours: number;
}

export interface WorkOrderChecklistItem {
  id: string;
  workOrderId: string;
  sequence: number;
  label: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface LaborEntry {
  id: string;
  workOrderId: string;
  technicianId: string;
  technicianName: string;
  startedAt: string;
  endedAt: string;
  regularHours: number;
  overtimeHours: number;
  hourlyRateCents: number;
  notes: string;
}

export interface PartUsage {
  id: string;
  workOrderId: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitCostCents: number;
  source: "truck_stock" | "storeroom" | "purchased" | "vendor_supplied";
  recordedBy: string;
  recordedAt: string;
}

export interface WorkOrderNote {
  id: string;
  workOrderId: string;
  author: string;
  authorRole: string;
  body: string;
  visibility: "internal" | "store" | "vendor";
  createdAt: string;
}

export interface VendorResponse {
  id: string;
  workOrderId: string;
  vendorId: string;
  response: "accepted" | "declined" | "clarification";
  responder: string;
  respondedAt: string;
  issuedAt: string;
  simulated?: boolean;
}

export interface LocationEvidence {
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  distanceM?: number;
  state: VerificationState;
  capturedAt: string;
  simulated?: boolean;
}

export interface ServiceVisit {
  id: string;
  workOrderId: string;
  vendorId: string;
  technicianName: string;
  sessionHash: string;
  checkedInAt: string;
  checkedOutAt?: string;
  checkIn: LocationEvidence;
  checkOut?: LocationEvidence;
  outcome?: VisitOutcome;
}

export interface FollowUp {
  id: string;
  workOrderId: string;
  sourceVisitId?: string;
  accountableParty: string;
  nextAction: string;
  dueAt: string;
  escalation: string;
  status: "open" | "completed" | "cancelled";
  createdAt: string;
  completedAt?: string;
}

export interface PmPlan {
  id: string;
  name: string;
  categoryId: string;
  scopeLabel: string;
  targetType: "store" | "system" | "asset_class" | "asset";
  targetId: string;
  frequency: "monthly" | "quarterly" | "semiannual" | "annual";
  earlyWindowDays: number;
  lateWindowDays: number;
  vendorId: string;
  requiredDocument: string;
  active: boolean;
}

export type PmOccurrenceStatus =
  | "scheduled"
  | "due_soon"
  | "acceptance_pending"
  | "accepted"
  | "completed_early"
  | "completed_on_time"
  | "completed_late"
  | "documentation_pending"
  | "missed"
  | "rescheduled"
  | "waived"
  | "not_applicable";

export interface PmOccurrence {
  id: string;
  planId: string;
  storeId: string;
  systemId?: string;
  assetId?: string;
  dueAt: string;
  windowStart: string;
  windowEnd: string;
  completedAt?: string;
  status: PmOccurrenceStatus;
  workOrderId?: string;
  verified: boolean;
  waiverReason?: string;
}

export interface Quote {
  id: string;
  workOrderId: string;
  vendorId: string;
  number: string;
  amountCents: number;
  status: "submitted" | "approved" | "declined";
  submittedAt: string;
}

export interface Authorization {
  id: string;
  workOrderId: string;
  quoteId?: string;
  amountCents: number;
  status: "approved" | "committed" | "cancelled";
  approvedAt: string;
}

export interface Invoice {
  id: string;
  workOrderId: string;
  vendorId: string;
  number: string;
  totalCents: number;
  status: "submitted" | "review" | "approved" | "paid" | "void";
  issuedAt: string;
  paidAt?: string;
}

export interface Credit {
  id: string;
  invoiceId: string;
  amountCents: number;
  status: "potential" | "posted";
  issuedAt: string;
}

export interface CostAllocation {
  id: string;
  invoiceId: string;
  workOrderId: string;
  storeId: string;
  categoryId: string;
  systemId?: string;
  assetId?: string;
  componentId?: string;
  amountCents: number;
  workClass: "planned_pm" | "reactive" | "emergency" | "diagnostic" | "capital" | "warranty" | "internal";
  costCategory: "labor" | "parts" | "travel" | "emergency_surcharge" | "rental" | "tax" | "other";
}

export interface DocumentRecord {
  id: string;
  name: string;
  classification: "employee_photo" | "quote" | "service_ticket" | "invoice" | "credit" | "proof" | "correspondence" | "warranty" | "equipment" | "manual" | "other";
  mimeType: string;
  bytes: number;
  uploadedBy: string;
  uploadedAt: string;
  workOrderId?: string;
  storeId?: string;
  systemId?: string;
  assetId?: string;
  componentId?: string;
  visitId?: string;
  vendorId?: string;
  href: string;
  visibility: "internal" | "vendor_shared" | "store_shared";
}

export interface AuditEvent {
  id: string;
  entityType: "report" | "work_order" | "visit" | "follow_up" | "pm" | "invoice" | "asset";
  entityId: string;
  type: string;
  actor: string;
  at: string;
  summary: string;
  detail?: string;
  simulated?: boolean;
}

export interface DemoData {
  organization: { id: string; name: string };
  regions: Region[];
  stores: Store[];
  categories: ServiceCategory[];
  systems: StoreSystem[];
  assets: Asset[];
  components: Component[];
  vendors: Vendor[];
  technicians: Technician[];
  reports: EmployeeReport[];
  reportReviews: ReportReview[];
  workOrders: WorkOrder[];
  checklistItems: WorkOrderChecklistItem[];
  laborEntries: LaborEntry[];
  partsUsed: PartUsage[];
  workOrderNotes: WorkOrderNote[];
  vendorResponses: VendorResponse[];
  visits: ServiceVisit[];
  followUps: FollowUp[];
  pmPlans: PmPlan[];
  pmOccurrences: PmOccurrence[];
  quotes: Quote[];
  authorizations: Authorization[];
  invoices: Invoice[];
  credits: Credit[];
  allocations: CostAllocation[];
  documents: DocumentRecord[];
  auditEvents: AuditEvent[];
}
