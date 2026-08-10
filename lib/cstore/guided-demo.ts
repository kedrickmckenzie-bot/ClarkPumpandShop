import type {
  DemoDataset,
  EvidenceDocument,
  Invoice,
  InvoiceWorkLink,
  ServiceRequest,
  VendorIssuance,
  WorkAssignment,
  WorkOrder,
} from "./types";

export const GUIDED_DEMO_IDS = {
  store: "store-104",
  employee: "person-employee-104",
  manager: "person-manager-104",
  category: "category-refrigeration",
  taxonomy: "tax-refrigeration-beer-cave",
  asset: "asset-104-beer-cave",
  preferredVendor: "vendor-summit-refrigeration",
  request: "guided-request-beer-cave",
  workOrder: "guided-work-order-beer-cave",
  assignment: "guided-assignment-beer-cave",
  issuance: "guided-issuance-beer-cave",
  invoice: "guided-invoice-beer-cave",
  invoiceLink: "guided-invoice-link-beer-cave",
  invoiceDocument: "guided-document-invoice-beer-cave",
} as const;

export const GUIDED_WORK_ORDER_NUMBER = "NLM-104-DEMO-001";
export const GUIDED_REQUEST_NUMBER = "REQ-104-DEMO-001";
export const GUIDED_VENDOR_REFERENCE = "SUM-DEMO-104";
export const GUIDED_NTE_MINOR = 75_000;
export const GUIDED_INVOICE_TOTAL_MINOR = 68_500;

function guidedTimestamp(dataset: DemoDataset, hour: number, minute: number) {
  const date = dataset.asOf.slice(0, 10);
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

export function createGuidedRequest(dataset: DemoDataset): ServiceRequest {
  return {
    id: GUIDED_DEMO_IDS.request,
    organizationId: dataset.organization.id,
    storeId: GUIDED_DEMO_IDS.store,
    submittedByPersonId: GUIDED_DEMO_IDS.employee,
    submittedAt: guidedTimestamp(dataset, 13, 12),
    immutableDescription: "The beer cave is warm. The display reads 48°F and the product feels warmer than normal.",
    reportedLocation: "Rear sales floor · Beer cave entrance",
    urgency: "urgent",
    categoryHint: "Refrigeration · Beer cave",
    attachmentDocumentIds: [],
    reviewStatus: "new",
  };
}

export function createGuidedWorkOrder(dataset: DemoDataset): WorkOrder {
  const createdAt = guidedTimestamp(dataset, 13, 18);
  const due = guidedTimestamp(dataset, 18, 0);
  return {
    id: GUIDED_DEMO_IDS.workOrder,
    organizationId: dataset.organization.id,
    number: GUIDED_WORK_ORDER_NUMBER,
    storeId: GUIDED_DEMO_IDS.store,
    requestId: GUIDED_DEMO_IDS.request,
    categoryId: GUIDED_DEMO_IDS.category,
    taxonomyNodeId: GUIDED_DEMO_IDS.taxonomy,
    assetId: GUIDED_DEMO_IDS.asset,
    title: "Beer cave temperature is high",
    problemDescription: "Store employee reported a 48°F display and warm product at the beer cave.",
    scopeOfWork: "Diagnose the warm beer cave, document findings, and restore safe normal temperature. Call before exceeding authorization.",
    priority: "urgent",
    source: "employee_request",
    fulfillmentMode: "unassigned",
    status: "draft",
    createdByPersonId: GUIDED_DEMO_IDS.manager,
    createdAt,
    requestedWindow: { startsAt: createdAt, endsAt: due },
    accountable: {
      partyType: "person",
      partyId: GUIDED_DEMO_IDS.manager,
      nextAction: "Choose an internal team or approved outside vendor",
      dueAt: due,
      escalationPartyId: GUIDED_DEMO_IDS.manager,
    },
    currency: "USD",
    classificationDeferred: false,
    tags: ["guided-demo", "beer-cave", "employee-request"],
  };
}

export function createGuidedAssignment(dataset: DemoDataset, vendorId: string): WorkAssignment {
  return {
    id: GUIDED_DEMO_IDS.assignment,
    organizationId: dataset.organization.id,
    workOrderId: GUIDED_DEMO_IDS.workOrder,
    partyType: "vendor",
    partyId: vendorId,
    status: "offered",
    assignedAt: guidedTimestamp(dataset, 13, 20),
    assignmentNote: "Approved vendor selected during the guided demo.",
  };
}

export function createGuidedIssuance(dataset: DemoDataset, vendorId: string): VendorIssuance {
  const vendor = dataset.vendors.find((record) => record.id === vendorId);
  const dispatchContact = vendor?.contacts.find((contact) => contact.role === "dispatch");
  return {
    id: GUIDED_DEMO_IDS.issuance,
    organizationId: dataset.organization.id,
    workOrderId: GUIDED_DEMO_IDS.workOrder,
    vendorId,
    assignmentId: GUIDED_DEMO_IDS.assignment,
    version: 1,
    issuedAt: guidedTimestamp(dataset, 13, 22),
    issuedByPersonId: GUIDED_DEMO_IDS.manager,
    channels: ["email"],
    recipientContactIds: dispatchContact ? [dispatchContact.id] : [],
    deliveryStatus: "delivered",
    acceptanceRequested: true,
    customerBillingInstruction: `Include ${GUIDED_WORK_ORDER_NUMBER} on every invoice and service document.`,
    scopeSnapshot: "Diagnose the warm beer cave, document findings, and restore safe normal temperature.",
    notToExceedMinor: GUIDED_NTE_MINOR,
    currency: "USD",
  };
}

export function createGuidedInvoice(dataset: DemoDataset, vendorId: string): Invoice {
  return {
    id: GUIDED_DEMO_IDS.invoice,
    organizationId: dataset.organization.id,
    vendorId,
    invoiceNumber: "SUM-DEMO-685",
    customerWorkOrderReferences: [GUIDED_WORK_ORDER_NUMBER],
    vendorServiceReferences: [GUIDED_VENDOR_REFERENCE],
    invoiceDate: dataset.asOf.slice(0, 10),
    receivedAt: guidedTimestamp(dataset, 17, 5),
    status: "received",
    currency: "USD",
    lineItems: [
      { id: "guided-invoice-line-labor", workOrderId: GUIDED_DEMO_IDS.workOrder, description: "Refrigeration diagnostics and repair labor", costType: "labor", quantity: 2, unitAmountMinor: 16_000, amountMinor: 32_000 },
      { id: "guided-invoice-line-parts", workOrderId: GUIDED_DEMO_IDS.workOrder, description: "Temperature control and electrical materials", costType: "materials", quantity: 1, unitAmountMinor: 28_500, amountMinor: 28_500 },
      { id: "guided-invoice-line-trip", workOrderId: GUIDED_DEMO_IDS.workOrder, description: "Service call", costType: "trip", quantity: 1, unitAmountMinor: 8_000, amountMinor: 8_000 },
    ],
    documentId: GUIDED_DEMO_IDS.invoiceDocument,
  };
}

export function createGuidedInvoiceLink(dataset: DemoDataset): InvoiceWorkLink {
  return {
    id: GUIDED_DEMO_IDS.invoiceLink,
    organizationId: dataset.organization.id,
    invoiceId: GUIDED_DEMO_IDS.invoice,
    workOrderId: GUIDED_DEMO_IDS.workOrder,
    storeId: GUIDED_DEMO_IDS.store,
    categoryId: GUIDED_DEMO_IDS.category,
    assetId: GUIDED_DEMO_IDS.asset,
    attributedAmountMinor: GUIDED_INVOICE_TOTAL_MINOR,
    currency: "USD",
    matchMethod: "work_order_reference",
    matchStatus: "matched",
    linkedAt: guidedTimestamp(dataset, 17, 8),
    linkedByPersonId: "person-evan-rhodes",
  };
}

export function createGuidedInvoiceDocument(dataset: DemoDataset): EvidenceDocument {
  return {
    id: GUIDED_DEMO_IDS.invoiceDocument,
    organizationId: dataset.organization.id,
    storeId: GUIDED_DEMO_IDS.store,
    workOrderId: GUIDED_DEMO_IDS.workOrder,
    invoiceId: GUIDED_DEMO_IDS.invoice,
    kind: "invoice",
    fileName: "SUM-DEMO-685.pdf",
    mediaType: "application/pdf",
    createdAt: guidedTimestamp(dataset, 17, 5),
    createdByLabel: "Summit Refrigeration billing",
    visibility: "operator_only",
  };
}
