import type { DemoDataset } from "./types";

export type DemoRoleId =
  | "facilities_manager"
  | "owner_executive"
  | "regional_manager"
  | "store_manager"
  | "finance_reviewer";

export type RoleView = "story" | "today" | "requests" | "exceptions" | "visits" | "stores" | "work" | "vendors" | "spend" | "equipment" | "pm" | "reports";

export type RolePermission =
  | "createWork"
  | "issueVendorWork"
  | "simulateVendorResponse"
  | "recordVisits"
  | "createStore"
  | "manageSuite"
  | "classifyWork"
  | "generateReports"
  | "reviewInvoiceEvidence";

export interface DemoRolePolicy {
  id: DemoRoleId;
  label: string;
  personId: string;
  scope: { kind: "organization" } | { kind: "region"; id: string } | { kind: "store"; id: string };
  defaultView: RoleView;
  allowedViews: RoleView[];
  permissions: Record<RolePermission, boolean>;
  accessSummary: string;
}

const noMutationPermissions: Record<RolePermission, boolean> = {
  createWork: false,
  issueVendorWork: false,
  simulateVendorResponse: false,
  recordVisits: false,
  createStore: false,
  manageSuite: false,
  classifyWork: false,
  generateReports: true,
  reviewInvoiceEvidence: false,
};

export const demoRolePolicies: DemoRolePolicy[] = [
  {
    id: "facilities_manager",
    label: "Facilities manager",
    personId: "person-dana-brooks",
    scope: { kind: "organization" },
    defaultView: "today",
    allowedViews: ["today", "requests", "exceptions", "visits", "stores", "work", "vendors", "spend", "equipment", "pm", "reports"],
    permissions: {
      createWork: true,
      issueVendorWork: true,
      simulateVendorResponse: true,
      recordVisits: true,
      createStore: true,
      manageSuite: true,
      classifyWork: true,
      generateReports: true,
      reviewInvoiceEvidence: true,
    },
    accessSummary: "Full operational control",
  },
  {
    id: "owner_executive",
    label: "Owner / executive",
    personId: "person-alex-morgan",
    scope: { kind: "organization" },
    defaultView: "spend",
    allowedViews: ["today", "requests", "exceptions", "visits", "stores", "work", "vendors", "spend", "equipment", "pm", "reports"],
    permissions: noMutationPermissions,
    accessSummary: "Portfolio intelligence · read only",
  },
  {
    id: "regional_manager",
    label: "Regional manager",
    personId: "person-maya-chen",
    scope: { kind: "region", id: "region-central-ohio" },
    defaultView: "today",
    allowedViews: ["today", "requests", "exceptions", "visits", "stores", "work", "vendors", "spend", "equipment", "pm", "reports"],
    permissions: {
      createWork: true,
      issueVendorWork: true,
      simulateVendorResponse: true,
      recordVisits: false,
      createStore: false,
      manageSuite: false,
      classifyWork: true,
      generateReports: true,
      reviewInvoiceEvidence: true,
    },
    accessSummary: "Regional operations",
  },
  {
    id: "store_manager",
    label: "Store manager",
    personId: "person-manager-101",
    scope: { kind: "store", id: "store-101" },
    defaultView: "today",
    allowedViews: ["today", "requests", "exceptions", "visits", "stores", "work", "vendors", "spend", "equipment", "pm"],
    permissions: {
      createWork: true,
      issueVendorWork: true,
      simulateVendorResponse: false,
      recordVisits: true,
      createStore: false,
      manageSuite: false,
      classifyWork: true,
      generateReports: false,
      reviewInvoiceEvidence: false,
    },
    accessSummary: "Store workflow access",
  },
  {
    id: "finance_reviewer",
    label: "Invoice reviewer",
    personId: "person-evan-rhodes",
    scope: { kind: "organization" },
    defaultView: "spend",
    allowedViews: ["stores", "work", "vendors", "spend", "reports"],
    permissions: {
      ...noMutationPermissions,
      reviewInvoiceEvidence: true,
    },
    accessSummary: "Maintenance invoice evidence",
  },
];

export function getDemoRolePolicy(roleId: DemoRoleId) {
  return demoRolePolicies.find((policy) => policy.id === roleId) ?? demoRolePolicies[0];
}

export function roleScopeLabel(dataset: DemoDataset, policy: DemoRolePolicy) {
  const scope = policy.scope;
  if (scope.kind === "organization") return `All ${dataset.stores.length} stores`;
  if (scope.kind === "region") {
    const region = dataset.regions.find((record) => record.id === scope.id);
    const count = dataset.stores.filter((record) => record.regionId === scope.id).length;
    return `${region?.name ?? "Assigned region"} · ${count} stores`;
  }
  const store = dataset.stores.find((record) => record.id === scope.id);
  return store ? `Store ${store.storeNumber} · ${store.name.replace(/^Northline\s+/, "")}` : "Assigned store";
}

export function scopeDatasetForRole(dataset: DemoDataset, policy: DemoRolePolicy): DemoDataset {
  const scope = policy.scope;
  if (scope.kind === "organization") return dataset;

  const stores = dataset.stores.filter((store) =>
    scope.kind === "region" ? store.regionId === scope.id : store.id === scope.id,
  );
  const storeIds = new Set(stores.map((store) => store.id));
  const regionIds = new Set(stores.map((store) => store.regionId).filter((id): id is string => Boolean(id)));
  const workOrders = dataset.workOrders.filter((work) => storeIds.has(work.storeId));
  const workOrderIds = new Set(workOrders.map((work) => work.id));
  const requests = dataset.requests.filter((request) => storeIds.has(request.storeId));
  const requestIds = new Set(requests.map((request) => request.id));
  const assignments = dataset.assignments.filter((assignment) => workOrderIds.has(assignment.workOrderId));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const vendorIssuances = dataset.vendorIssuances.filter((issuance) => workOrderIds.has(issuance.workOrderId));
  const issuanceIds = new Set(vendorIssuances.map((issuance) => issuance.id));
  const visits = dataset.visits.filter((visit) => storeIds.has(visit.storeId));
  const visitIds = new Set(visits.map((visit) => visit.id));
  const costLines = dataset.costLines.filter((line) => storeIds.has(line.storeId) && workOrderIds.has(line.workOrderId));
  const invoiceWorkLinks = dataset.invoiceWorkLinks.filter((link) => storeIds.has(link.storeId) && workOrderIds.has(link.workOrderId));
  const invoiceIds = new Set(invoiceWorkLinks.map((link) => link.invoiceId));
  dataset.documents.forEach((document) => {
    if (document.invoiceId && document.storeId && storeIds.has(document.storeId)) invoiceIds.add(document.invoiceId);
  });
  dataset.exceptions.forEach((exception) => {
    if (exception.invoiceId && exception.storeId && storeIds.has(exception.storeId)) invoiceIds.add(exception.invoiceId);
    if ((exception.storeId && storeIds.has(exception.storeId)) || (exception.workOrderId && workOrderIds.has(exception.workOrderId))) {
      exception.sourceRecordIds.forEach((sourceId) => {
        if (dataset.invoices.some((invoice) => invoice.id === sourceId)) invoiceIds.add(sourceId);
      });
    }
  });
  const invoices = dataset.invoices
    .filter((invoice) => invoiceIds.has(invoice.id))
    .map((invoice) => {
      const sourceLinks = dataset.invoiceWorkLinks.filter((link) => link.invoiceId === invoice.id);
      const invoiceFullyVisible = sourceLinks.every((link) => workOrderIds.has(link.workOrderId));
      return {
        ...invoice,
        customerWorkOrderReferences: invoice.customerWorkOrderReferences.filter((reference) =>
          workOrders.some((work) => work.number === reference),
        ),
        lineItems: invoice.lineItems.filter((line) =>
          line.workOrderId ? workOrderIds.has(line.workOrderId) : invoiceFullyVisible,
        ),
      };
    });
  const assets = dataset.assets.filter((asset) => storeIds.has(asset.storeId));
  const assetIds = new Set(assets.map((asset) => asset.id));
  const assetComponents = dataset.assetComponents.filter((component) => assetIds.has(component.assetId));
  const pmPlans = dataset.pmPlans.filter((plan) => storeIds.has(plan.storeId));
  const pmPlanIds = new Set(pmPlans.map((plan) => plan.id));
  const pmOccurrences = dataset.pmOccurrences.filter((occurrence) => storeIds.has(occurrence.storeId) && pmPlanIds.has(occurrence.pmPlanId));
  const occurrenceIds = new Set(pmOccurrences.map((occurrence) => occurrence.id));
  const exceptions = dataset.exceptions.filter((exception) =>
    Boolean(
      (exception.storeId && storeIds.has(exception.storeId)) ||
      (exception.workOrderId && workOrderIds.has(exception.workOrderId)) ||
      (exception.visitId && visitIds.has(exception.visitId)) ||
      (exception.invoiceId && invoiceIds.has(exception.invoiceId)) ||
      (exception.assetId && assetIds.has(exception.assetId)) ||
      exception.sourceRecordIds.some((sourceId) =>
        workOrderIds.has(sourceId) ||
        visitIds.has(sourceId) ||
        invoiceIds.has(sourceId) ||
        assetIds.has(sourceId) ||
        occurrenceIds.has(sourceId),
      ),
    ),
  );
  const exceptionIds = new Set(exceptions.map((exception) => exception.id));
  const documents = dataset.documents.filter((document) =>
    Boolean(
      (document.storeId && storeIds.has(document.storeId)) ||
      (document.workOrderId && workOrderIds.has(document.workOrderId)) ||
      (document.visitId && visitIds.has(document.visitId)) ||
      (document.invoiceId && invoiceIds.has(document.invoiceId)),
    ),
  );
  const permittedEntityIds = new Set([
    ...requestIds,
    ...workOrderIds,
    ...assignmentIds,
    ...issuanceIds,
    ...visitIds,
    ...invoiceIds,
    ...invoiceWorkLinks.map((link) => link.id),
    ...occurrenceIds,
    ...exceptionIds,
  ]);
  const auditEvents = dataset.auditEvents.filter((event) => {
    if (permittedEntityIds.has(event.entityId)) return true;
    const payloadStoreId = event.payloadSnapshot.storeId;
    const payloadWorkOrderId = event.payloadSnapshot.workOrderId;
    return (
      (typeof payloadStoreId === "string" && storeIds.has(payloadStoreId)) ||
      (typeof payloadWorkOrderId === "string" && workOrderIds.has(payloadWorkOrderId))
    );
  });
  const vendors = dataset.vendors
    .filter((vendor) => vendor.coverageRegionIds.some((regionId) => regionIds.has(regionId)))
    .map((vendor) => ({
      ...vendor,
      coverageRegionIds: vendor.coverageRegionIds.filter((regionId) => regionIds.has(regionId)),
      preferredStoreIds: vendor.preferredStoreIds.filter((storeId) => storeIds.has(storeId)),
    }));

  return {
    ...dataset,
    regions: dataset.regions.filter((region) => regionIds.has(region.id)),
    stores,
    vendors,
    requests,
    workOrders,
    assignments,
    vendorIssuances,
    visits,
    costLines,
    invoices,
    invoiceWorkLinks,
    assets,
    assetComponents,
    pmPlans,
    pmOccurrences,
    documents,
    exceptions,
    auditEvents,
    teams: dataset.teams.filter((team) => team.regionIds.some((regionId) => regionIds.has(regionId))),
    people: dataset.people.filter((person) =>
      person.id === policy.personId ||
      person.scopeIds.includes(dataset.organization.id) ||
      person.scopeIds.some((scopeId) => regionIds.has(scopeId) || storeIds.has(scopeId)),
    ),
  };
}
