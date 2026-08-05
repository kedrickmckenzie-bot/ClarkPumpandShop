import { platformData as demoData, PLATFORM_NOW as DEMO_NOW } from "@/lib/platform/data";
import type { WorkOrder } from "@/lib/domain/types";

/**
 * Maintenance-finance seed and framework-independent rollups.
 *
 * Every amount is an integer number of minor currency units. Financial stages
 * are parallel measures of the maintenance lifecycle and must never be added
 * together to produce a single "spend" number.
 */

export type CurrencyCode = "USD";

export type FinancialStage =
  | "requested"
  | "quoted"
  | "approved"
  | "committed"
  | "accrued"
  | "invoiced"
  | "credited"
  | "warranty_recovered"
  | "paid";

export type FinancialSourceType =
  | "work_order_estimate"
  | "proposal_quote"
  | "authorization"
  | "purchase_order"
  | "accrual"
  | "invoice"
  | "credit"
  | "payment";

export interface GlAccount {
  organizationId: string;
  id: string;
  code: string;
  name: string;
  accountType: "expense" | "asset" | "liability" | "contra_expense";
  categoryId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
}

export interface AccountingCostCenter {
  organizationId: string;
  id: string;
  code: string;
  name: string;
  scope: "organization" | "region" | "store" | "department";
  parentCostCenterId?: string;
  regionId?: string;
  storeId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
}

export interface BudgetLine {
  organizationId: string;
  id: string;
  budgetId: string;
  regionId?: string;
  storeId?: string;
  categoryId?: string;
  costCenterId: string;
  glAccountId: string;
  approvedCents: number;
  currency: CurrencyCode;
}

export interface MaintenanceBudget {
  organizationId: string;
  id: string;
  name: string;
  fiscalYear: number;
  regionId?: string;
  status: "draft" | "approved" | "closed";
  approvedAt?: string;
  approvedBy?: string;
  approvedCents: number;
  currency: CurrencyCode;
  lines: BudgetLine[];
}

export interface AccountingAllocation {
  organizationId: string;
  id: string;
  sourceType: FinancialSourceType;
  sourceId: string;
  amountCents: number;
  currency: CurrencyCode;
  workOrderId?: string;
  storeId?: string;
  regionId?: string;
  categoryId?: string;
  systemId?: string;
  assetId?: string;
  componentId?: string;
  vendorId?: string;
  costCenterId?: string;
  glAccountId?: string;
  budgetId?: string;
  budgetLineId?: string;
  workClass?:
    | "planned_pm"
    | "reactive"
    | "emergency"
    | "diagnostic"
    | "capital"
    | "warranty"
    | "internal";
  costCategory?:
    | "labor"
    | "parts"
    | "travel"
    | "emergency_surcharge"
    | "rental"
    | "tax"
    | "other";
}

export type ProposalQuoteStatus =
  | "requested"
  | "submitted"
  | "under_review"
  | "approved"
  | "declined"
  | "expired"
  | "superseded";

export interface ProposalQuoteView {
  organizationId: string;
  id: string;
  sourceQuoteId?: string;
  workOrderId: string;
  vendorId?: string;
  kind: "quote_request" | "vendor_quote" | "internal_proposal";
  number: string;
  revision: number;
  status: ProposalQuoteStatus;
  requestedEstimateCents: number;
  quotedCents?: number;
  approvedCents: number;
  currency: CurrencyCode;
  requestedAt: string;
  submittedAt?: string;
  validThrough?: string;
  approvedAt?: string;
  allocations: AccountingAllocation[];
}

export type PurchaseOrderStatus =
  | "draft"
  | "issued"
  | "acknowledged"
  | "partially_invoiced"
  | "fully_invoiced"
  | "closed"
  | "cancelled";

export interface PurchaseOrder {
  organizationId: string;
  id: string;
  number: string;
  workOrderId: string;
  vendorId: string;
  authorizationId: string;
  quoteId?: string;
  status: PurchaseOrderStatus;
  committedCents: number;
  invoicedCents: number;
  remainingCommitmentCents: number;
  currency: CurrencyCode;
  issuedAt: string;
  expectedCompletionAt?: string;
  closedAt?: string;
  allocations: AccountingAllocation[];
}

export type MaintenanceInvoiceStatus =
  | "received"
  | "under_review"
  | "approved"
  | "paid"
  | "void";

export interface MaintenanceInvoice {
  organizationId: string;
  id: string;
  sourceInvoiceId: string;
  number: string;
  workOrderId: string;
  vendorId: string;
  purchaseOrderId?: string;
  status: MaintenanceInvoiceStatus;
  grossAmountCents: number;
  proposedCreditCents: number;
  creditedCents: number;
  netInvoicedCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  currency: CurrencyCode;
  issuedAt: string;
  receivedAt: string;
  dueAt: string;
  approvedAt?: string;
  paidAt?: string;
  allocations: AccountingAllocation[];
}

export type CreditStatus = "proposed" | "approved" | "posted" | "void";

export interface CreditAllocation extends AccountingAllocation {
  invoiceAllocationId: string;
}

export interface CreditMemo {
  organizationId: string;
  id: string;
  reference: string;
  invoiceId: string;
  workOrderId: string;
  vendorId: string;
  status: CreditStatus;
  recoveryType: "vendor_credit" | "warranty_recovery";
  reason: string;
  amountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  currency: CurrencyCode;
  issuedAt: string;
  postedAt?: string;
  allocations: CreditAllocation[];
}

export interface PaymentAllocation extends AccountingAllocation {
  invoiceAllocationId: string;
}

export interface PaymentRecord {
  organizationId: string;
  id: string;
  invoiceId: string;
  vendorId: string;
  status: "observed_partial" | "observed_paid" | "void";
  amountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  currency: CurrencyCode;
  observedAt: string;
  externalReference: string;
  sourceSystem: "demo_ap_export";
  allocations: PaymentAllocation[];
}

export interface Accrual {
  organizationId: string;
  id: string;
  workOrderId: string;
  vendorId?: string;
  status: "open" | "reversed";
  basis: "completed_unbilled_work_order" | "received_not_invoiced";
  amountCents: number;
  currency: CurrencyCode;
  accountingPeriod: string;
  accruedAt: string;
  serviceThroughAt: string;
  reversedAt?: string;
  reversalInvoiceId?: string;
  allocations: AccountingAllocation[];
}

export interface ApprovalTier {
  id: string;
  sequence: number;
  minimumAmountCents: number;
  maximumAmountCents?: number;
  requiredApproverRoles: string[];
  minimumApprovals: number;
}

export interface ApprovalPolicy {
  organizationId: string;
  id: string;
  name: string;
  appliesTo: {
    workTypes?: WorkOrder["workType"][];
    fulfillmentModes?: Array<"internal" | "external" | "blended">;
    categoryIds?: string[];
  };
  effectiveFrom: string;
  effectiveTo?: string;
  emergencyAfterTheFactReviewHours?: number;
  active: boolean;
  tiers: ApprovalTier[];
}

export interface ProviderFinancialProfile {
  organizationId: string;
  id: string;
  providerId: string;
  providerName: string;
  providerType: "external_vendor";
  currency: CurrencyCode;
  paymentTermsDays: number;
  invoiceSubmissionEmail: string;
  taxDocumentationStatus: "on_file" | "pending" | "expired";
  insuranceStatus: "current" | "expiring" | "expired";
  defaultGlAccountId: string;
  allowedRegionIds: string[];
  active: boolean;
}

export interface InternalTeamFinancialProfile {
  organizationId: string;
  id: string;
  teamId: string;
  teamName: string;
  regionIds: string[];
  memberIds: string[];
  regularBurdenedRateCents: number;
  overtimeBurdenedRateCents: number;
  currency: CurrencyCode;
  defaultGlAccountId: string;
  active: boolean;
  costingOnly: true;
}

export interface MaintenanceLedgerEntry {
  organizationId: string;
  id: string;
  stage: FinancialStage;
  sourceType: FinancialSourceType;
  sourceId: string;
  sourceAllocationId: string;
  amountCents: number;
  currency: CurrencyCode;
  effectiveAt: string;
  workOrderId?: string;
  storeId?: string;
  regionId?: string;
  categoryId?: string;
  systemId?: string;
  assetId?: string;
  componentId?: string;
  vendorId?: string;
  costCenterId?: string;
  glAccountId?: string;
  budgetId?: string;
  budgetLineId?: string;
}

export interface FinancialPosition {
  organizationId: string;
  requestedCents: number;
  quotedCents: number;
  approvedCents: number;
  committedCents: number;
  accruedCents: number;
  invoicedCents: number;
  creditedCents: number;
  warrantyRecoveredCents: number;
  paidCents: number;
  netInvoicedCents: number;
  unpaidCents: number;
  entryCount: number;
}

export interface FinancialRollupFilter {
  organizationId: string;
  regionId?: string;
  storeId?: string;
  workOrderId?: string;
  vendorId?: string;
  categoryId?: string;
  costCenterId?: string;
  glAccountId?: string;
  budgetId?: string;
  budgetLineId?: string;
  effectiveFrom?: string;
  effectiveThrough?: string;
}

export type FinancialRollupDimension =
  | "regionId"
  | "storeId"
  | "workOrderId"
  | "vendorId"
  | "categoryId"
  | "costCenterId"
  | "glAccountId"
  | "budgetId";

export interface FinancialPositionRow extends FinancialPosition {
  dimension: FinancialRollupDimension;
  dimensionId: string;
}

export interface BudgetPosition extends FinancialPosition {
  budgetId: string;
  approvedBudgetCents: number;
  lifecycleExposureCents: number;
  forecastCents: number;
  availableCents: number;
}

export interface InvoiceReconciliation {
  organizationId: string;
  invoiceId: string;
  grossAmountCents: number;
  allocatedCents: number;
  unallocatedCents: number;
  overallocatedCents: number;
  proposedCreditCents: number;
  postedCreditCents: number;
  netInvoicedCents: number;
  paidCents: number;
  paymentOutstandingCents: number;
}

export interface MaintenanceFinanceData {
  organizationId: string;
  asOf: string;
  currency: CurrencyCode;
  glAccounts: GlAccount[];
  accountingCostCenters: AccountingCostCenter[];
  budgets: MaintenanceBudget[];
  proposalQuoteViews: ProposalQuoteView[];
  purchaseOrders: PurchaseOrder[];
  invoices: MaintenanceInvoice[];
  credits: CreditMemo[];
  payments: PaymentRecord[];
  accruals: Accrual[];
  approvalPolicies: ApprovalPolicy[];
  providerFinancialProfiles: ProviderFinancialProfile[];
  internalTeamFinancialProfiles: InternalTeamFinancialProfile[];
  ledgerEntries: MaintenanceLedgerEntry[];
}

const ORGANIZATION_ID = demoData.organization.id;
const CURRENCY: CurrencyCode = "USD";
const FISCAL_YEAR = 2026;
const EFFECTIVE_FROM = "2026-01-01T00:00:00.000Z";

const addDays = (value: string, days: number): string =>
  new Date(new Date(value).getTime() + days * 86_400_000).toISOString();

const sumCents = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const required = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) throw new Error(message);
  return value;
};

const workOrderById = new Map(demoData.workOrders.map((record) => [record.id, record]));
const storeById = new Map(demoData.stores.map((record) => [record.id, record]));

const categoryGlCodes: Record<string, string> = {
  unclassified: "6999",
  hvac: "6100",
  refrigeration: "6110",
  foodservice: "6120",
  plumbing: "6130",
  electrical: "6140",
  fuel: "6150",
  building: "6160",
  "life-safety": "6170",
  grounds: "6180",
  snow: "6185",
  janitorial: "6190",
  pest: "6195",
  signage: "6200",
  waste: "6205",
};

const INTERNAL_LABOR_GL_CODE = "6210";
const INTERNAL_LABOR_GL_ID = `gl-${INTERNAL_LABOR_GL_CODE}`;
const RECOVERIES_GL_CODE = "6290";
const RECOVERIES_GL_ID = `gl-${RECOVERIES_GL_CODE}`;

const categoryGlCode = (categoryId: string): string =>
  required(categoryGlCodes[categoryId], `Missing GL mapping for category ${categoryId}`);

const categoryGlAccountId = (categoryId: string): string =>
  `gl-${categoryGlCode(categoryId)}`;

const nonSystemBudgetCents: Record<string, number> = {
  foodservice: 950_000,
  plumbing: 650_000,
  electrical: 725_000,
  fuel: 850_000,
  building: 900_000,
  "life-safety": 500_000,
};

export const glAccounts: GlAccount[] = [
  ...demoData.categories.map((category) => ({
    organizationId: ORGANIZATION_ID,
    id: categoryGlAccountId(category.id),
    code: categoryGlCode(category.id),
    name: `${category.name} maintenance expense`,
    accountType: "expense" as const,
    categoryId: category.id,
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  })),
  {
    organizationId: ORGANIZATION_ID,
    id: INTERNAL_LABOR_GL_ID,
    code: INTERNAL_LABOR_GL_CODE,
    name: "Internal maintenance labor",
    accountType: "expense",
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  },
  {
    organizationId: ORGANIZATION_ID,
    id: "gl-1300",
    code: "1300",
    name: "Maintenance capital in progress",
    accountType: "asset",
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  },
  {
    organizationId: ORGANIZATION_ID,
    id: "gl-2150",
    code: "2150",
    name: "Accrued maintenance services",
    accountType: "liability",
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  },
  {
    organizationId: ORGANIZATION_ID,
    id: RECOVERIES_GL_ID,
    code: RECOVERIES_GL_CODE,
    name: "Maintenance credits and recoveries",
    accountType: "contra_expense",
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  },
];

export const accountingCostCenters: AccountingCostCenter[] = [
  {
    organizationId: ORGANIZATION_ID,
    id: "cc-facilities",
    code: "FAC",
    name: "Facilities and maintenance",
    scope: "organization",
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  },
  ...demoData.regions.map((region) => ({
    organizationId: ORGANIZATION_ID,
    id: `cc-${region.id}`,
    code: `FAC-${region.id.replace("region-", "").toUpperCase()}`,
    name: `${region.name} facilities`,
    scope: "region" as const,
    parentCostCenterId: "cc-facilities",
    regionId: region.id,
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  })),
  ...demoData.stores.map((store) => ({
    organizationId: ORGANIZATION_ID,
    id: `cc-${store.id}`,
    code: `STR-${store.code.padStart(4, "0")}`,
    name: `Store ${store.code} maintenance`,
    scope: "store" as const,
    parentCostCenterId: store.regionId ? `cc-${store.regionId}` : "cc-facilities",
    regionId: store.regionId,
    storeId: store.id,
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
  })),
];

const budgetAmountFor = (storeId: string, categoryId: string, storeIndex: number): number => {
  const systemBudget = demoData.systems.find(
    (system) => system.storeId === storeId && system.categoryId === categoryId,
  )?.annualBudgetCents;
  if (systemBudget !== undefined) return systemBudget;
  return (nonSystemBudgetCents[categoryId] ?? 500_000) + (storeIndex % 5) * 25_000;
};

const regionalBudgetLines = new Map<string, BudgetLine[]>();

demoData.regions.forEach((region) => regionalBudgetLines.set(region.id, []));

demoData.stores.forEach((store, storeIndex) => {
  const regionKey = store.regionId ?? "unassigned";
  const lines = regionalBudgetLines.get(regionKey) ?? [];
  demoData.categories.forEach((category) => {
    const budgetId = `budget-${FISCAL_YEAR}-${regionKey}`;
    lines.push({
      organizationId: ORGANIZATION_ID,
      id: `budget-line-${store.id}-${category.id}`,
      budgetId,
      regionId: store.regionId,
      storeId: store.id,
      categoryId: category.id,
      costCenterId: `cc-${store.id}`,
      glAccountId: categoryGlAccountId(category.id),
      approvedCents: budgetAmountFor(store.id, category.id, storeIndex),
      currency: CURRENCY,
    });
  });
  regionalBudgetLines.set(regionKey, lines);
});

export const budgets: MaintenanceBudget[] = [...regionalBudgetLines.entries()].map(
  ([regionId, lines]) => ({
    organizationId: ORGANIZATION_ID,
    id: `budget-${FISCAL_YEAR}-${regionId}`,
    name: `${
      demoData.regions.find((region) => region.id === regionId)?.name ?? "Unassigned stores"
    } maintenance budget`,
    fiscalYear: FISCAL_YEAR,
    regionId: regionId === "unassigned" ? undefined : regionId,
    status: "approved",
    approvedAt: "2025-12-15T17:00:00.000Z",
    approvedBy: "Finance Director",
    approvedCents: sumCents(lines.map((line) => line.approvedCents)),
    currency: CURRENCY,
    lines,
  }),
);

const budgetLineByStoreAndCategory = new Map(
  budgets.flatMap((budget) =>
    budget.lines.map((line) => [`${line.storeId}:${line.categoryId}`, line] as const),
  ),
);

const allocationForWorkOrder = (
  sourceType: FinancialSourceType,
  sourceId: string,
  allocationId: string,
  workOrder: WorkOrder,
  amountCents: number,
): AccountingAllocation => {
  const store = required(
    storeById.get(workOrder.storeId),
    `Unknown store ${workOrder.storeId} for work order ${workOrder.id}`,
  );
  const budgetLine = budgetLineByStoreAndCategory.get(
    `${workOrder.storeId}:${workOrder.categoryId}`,
  );
  const glAccountId =
    workOrder.workType === "capital"
      ? "gl-1300"
      : workOrder.workType === "internal"
        ? INTERNAL_LABOR_GL_ID
        : categoryGlAccountId(workOrder.categoryId);

  return {
    organizationId: ORGANIZATION_ID,
    id: allocationId,
    sourceType,
    sourceId,
    amountCents,
    currency: CURRENCY,
    workOrderId: workOrder.id,
    storeId: store.id,
    regionId: store.regionId,
    categoryId: workOrder.categoryId,
    systemId: workOrder.systemId,
    assetId: workOrder.assetId,
    componentId: workOrder.componentId,
    vendorId: workOrder.vendorId,
    costCenterId: `cc-${store.id}`,
    glAccountId,
    budgetId: budgetLine?.budgetId,
    budgetLineId: budgetLine?.id,
  };
};

const quoteRequestViews: ProposalQuoteView[] = demoData.workOrders
  .filter((workOrder) => workOrder.status === "waiting_on_quote")
  .map((workOrder) => ({
    organizationId: ORGANIZATION_ID,
    id: `quote-request-${workOrder.id}`,
    workOrderId: workOrder.id,
    vendorId: workOrder.vendorId,
    kind: "quote_request",
    number: `RFQ-${workOrder.number.replace("CWO-", "")}`,
    revision: 0,
    status: "requested",
    requestedEstimateCents: Math.min(
      workOrder.nteCents,
      Math.max(workOrder.costExposureCents, 0),
    ),
    approvedCents: 0,
    currency: CURRENCY,
    requestedAt: workOrder.createdAt,
    allocations: [],
  }));

const submittedQuoteViews: ProposalQuoteView[] = demoData.quotes.map((quote) => {
  const workOrder = required(
    workOrderById.get(quote.workOrderId),
    `Unknown work order ${quote.workOrderId} for quote ${quote.id}`,
  );
  const authorization = demoData.authorizations.find((record) => record.quoteId === quote.id);
  return {
    organizationId: ORGANIZATION_ID,
    id: `proposal-${quote.id}`,
    sourceQuoteId: quote.id,
    workOrderId: quote.workOrderId,
    vendorId: quote.vendorId,
    kind: "vendor_quote",
    number: quote.number,
    revision: 1,
    status: quote.status,
    requestedEstimateCents: workOrder.costExposureCents,
    quotedCents: quote.amountCents,
    approvedCents: quote.status === "approved" ? quote.amountCents : 0,
    currency: CURRENCY,
    requestedAt: workOrder.createdAt,
    submittedAt: quote.submittedAt,
    validThrough: addDays(quote.submittedAt, 30),
    approvedAt: authorization?.approvedAt,
    allocations: [
      allocationForWorkOrder(
        "proposal_quote",
        `proposal-${quote.id}`,
        `proposal-allocation-${quote.id}`,
        workOrder,
        quote.amountCents,
      ),
    ],
  };
});

export const proposalQuoteViews: ProposalQuoteView[] = [
  ...submittedQuoteViews,
  ...quoteRequestViews,
];

const authorizationHasInvoice = (workOrderId: string): boolean =>
  demoData.invoices.some((invoice) => invoice.workOrderId === workOrderId);

export const purchaseOrders: PurchaseOrder[] = demoData.authorizations
  .filter(
    (authorization) =>
      authorization.status === "committed" || authorizationHasInvoice(authorization.workOrderId),
  )
  .map((authorization, index) => {
    const workOrder = required(
      workOrderById.get(authorization.workOrderId),
      `Unknown work order ${authorization.workOrderId} for authorization ${authorization.id}`,
    );
    const vendorId = required(
      workOrder.vendorId,
      `Authorization ${authorization.id} cannot create a purchase order without a vendor`,
    );
    const relatedInvoices = demoData.invoices.filter(
      (invoice) => invoice.workOrderId === workOrder.id && invoice.status !== "void",
    );
    const invoicedCents = sumCents(relatedInvoices.map((invoice) => invoice.totalCents));
    const hasPaidInvoice = relatedInvoices.some((invoice) => invoice.status === "paid");
    const status: PurchaseOrderStatus = hasPaidInvoice
      ? "closed"
      : invoicedCents >= authorization.amountCents
        ? "fully_invoiced"
        : invoicedCents > 0
          ? "partially_invoiced"
          : "issued";
    const id = `po-${authorization.id}`;
    return {
      organizationId: ORGANIZATION_ID,
      id,
      number: `PO-${FISCAL_YEAR}-${String(index + 1).padStart(5, "0")}`,
      workOrderId: workOrder.id,
      vendorId,
      authorizationId: authorization.id,
      quoteId: authorization.quoteId,
      status,
      committedCents: authorization.amountCents,
      invoicedCents,
      remainingCommitmentCents: Math.max(0, authorization.amountCents - invoicedCents),
      currency: CURRENCY,
      issuedAt: authorization.approvedAt,
      expectedCompletionAt: workOrder.targetCompletionAt ?? workOrder.dueAt,
      closedAt: hasPaidInvoice
        ? relatedInvoices.find((invoice) => invoice.status === "paid")?.paidAt
        : undefined,
      allocations: [
        allocationForWorkOrder(
          "purchase_order",
          id,
          `po-allocation-${authorization.id}`,
          workOrder,
          authorization.amountCents,
        ),
      ],
    };
  });

const purchaseOrderByWorkOrderId = new Map(
  purchaseOrders.map((purchaseOrder) => [purchaseOrder.workOrderId, purchaseOrder]),
);

const invoiceDrafts: MaintenanceInvoice[] = demoData.invoices.map((invoice) => {
  const maintenanceInvoiceId = `maintenance-${invoice.id}`;
  const workOrder = required(
    workOrderById.get(invoice.workOrderId),
    `Unknown work order ${invoice.workOrderId} for invoice ${invoice.id}`,
  );
  const store = required(
    storeById.get(workOrder.storeId),
    `Unknown store ${workOrder.storeId} for invoice ${invoice.id}`,
  );
  const allocations: AccountingAllocation[] = demoData.allocations
    .filter((allocation) => allocation.invoiceId === invoice.id)
    .map((allocation) => {
      const budgetLine = budgetLineByStoreAndCategory.get(
        `${allocation.storeId}:${allocation.categoryId}`,
      );
      return {
        organizationId: ORGANIZATION_ID,
        id: allocation.id,
        sourceType: "invoice",
        sourceId: maintenanceInvoiceId,
        amountCents: allocation.amountCents,
        currency: CURRENCY,
        workOrderId: allocation.workOrderId,
        storeId: allocation.storeId,
        regionId: store.regionId,
        categoryId: allocation.categoryId,
        systemId: allocation.systemId,
        assetId: allocation.assetId,
        componentId: allocation.componentId,
        vendorId: invoice.vendorId,
        costCenterId: `cc-${allocation.storeId}`,
        glAccountId: categoryGlAccountId(allocation.categoryId),
        budgetId: budgetLine?.budgetId,
        budgetLineId: budgetLine?.id,
        workClass: allocation.workClass,
        costCategory: allocation.costCategory,
      };
    });
  const allocatedCents = sumCents(allocations.map((allocation) => allocation.amountCents));
  const status: MaintenanceInvoiceStatus =
    invoice.status === "submitted"
      ? "received"
      : invoice.status === "review"
        ? "under_review"
        : invoice.status;
  return {
    organizationId: ORGANIZATION_ID,
    id: maintenanceInvoiceId,
    sourceInvoiceId: invoice.id,
    number: invoice.number,
    workOrderId: invoice.workOrderId,
    vendorId: invoice.vendorId,
    purchaseOrderId: purchaseOrderByWorkOrderId.get(invoice.workOrderId)?.id,
    status,
    grossAmountCents: invoice.totalCents,
    proposedCreditCents: 0,
    creditedCents: 0,
    netInvoicedCents: invoice.totalCents,
    allocatedCents,
    unallocatedCents: Math.max(0, invoice.totalCents - allocatedCents),
    currency: CURRENCY,
    issuedAt: invoice.issuedAt,
    receivedAt: addDays(invoice.issuedAt, 1),
    dueAt: addDays(invoice.issuedAt, 30),
    approvedAt:
      invoice.status === "approved" || invoice.status === "paid"
        ? addDays(invoice.issuedAt, 3)
        : undefined,
    paidAt: invoice.paidAt,
    allocations,
  };
});

const storyInvoiceDraft = required(
  invoiceDrafts.find((invoice) => invoice.sourceInvoiceId === "invoice-wo-0245"),
  "Expected story invoice invoice-wo-0245",
);
const store57InvoiceDraft = required(
  invoiceDrafts.find((invoice) => {
    const workOrder = workOrderById.get(invoice.workOrderId);
    return workOrder?.storeId === "store-57" && invoice.status === "paid";
  }),
  "Expected a paid Store 57 invoice",
);
const storyCreditTarget = required(
  storyInvoiceDraft.allocations.find((allocation) => allocation.costCategory === "parts") ??
    storyInvoiceDraft.allocations[0],
  "Expected an allocation on the story invoice",
);
const store57CreditTarget = required(
  store57InvoiceDraft.allocations[0],
  "Expected an allocation on the Store 57 invoice",
);

const creditAllocationFrom = (
  creditId: string,
  target: AccountingAllocation,
  amountCents: number,
): CreditAllocation => ({
  ...target,
  id: `${creditId}-allocation-1`,
  sourceType: "credit",
  sourceId: creditId,
  amountCents,
  glAccountId: RECOVERIES_GL_ID,
  invoiceAllocationId: target.id,
});

export const creditMemos: CreditMemo[] = [
  {
    organizationId: ORGANIZATION_ID,
    id: "credit-warranty-0245",
    reference: "CM-NS-88421-W",
    invoiceId: storyInvoiceDraft.id,
    workOrderId: storyInvoiceDraft.workOrderId,
    vendorId: storyInvoiceDraft.vendorId,
    status: "posted",
    recoveryType: "warranty_recovery",
    reason: "Manufacturer warranty allowance received for the replacement fan motor.",
    amountCents: 25_000,
    allocatedCents: 25_000,
    unallocatedCents: 0,
    currency: CURRENCY,
    issuedAt: "2026-06-02T14:00:00.000Z",
    postedAt: "2026-06-03T14:00:00.000Z",
    allocations: [creditAllocationFrom("credit-warranty-0245", storyCreditTarget, 25_000)],
  },
  {
    organizationId: ORGANIZATION_ID,
    id: "credit-proposed-store-57",
    reference: "PCR-57-001",
    invoiceId: store57InvoiceDraft.id,
    workOrderId: store57InvoiceDraft.workOrderId,
    vendorId: store57InvoiceDraft.vendorId,
    status: "proposed",
    recoveryType: "vendor_credit",
    reason: "Potential callback credit remains under review and is not included in posted totals.",
    amountCents: 38_000,
    allocatedCents: 38_000,
    unallocatedCents: 0,
    currency: CURRENCY,
    issuedAt: "2026-07-22T14:00:00.000Z",
    allocations: [creditAllocationFrom("credit-proposed-store-57", store57CreditTarget, 38_000)],
  },
];

export const maintenanceInvoices: MaintenanceInvoice[] = invoiceDrafts.map((invoice) => {
  const relatedCredits = creditMemos.filter((credit) => credit.invoiceId === invoice.id);
  const proposedCreditCents = sumCents(
    relatedCredits
      .filter((credit) => credit.status === "proposed" || credit.status === "approved")
      .map((credit) => credit.amountCents),
  );
  const creditedCents = sumCents(
    relatedCredits
      .filter((credit) => credit.status === "posted")
      .map((credit) => credit.amountCents),
  );
  return {
    ...invoice,
    proposedCreditCents,
    creditedCents,
    netInvoicedCents: invoice.grossAmountCents - creditedCents,
  };
});

const postedCreditByInvoiceAllocation = new Map<string, number>();

creditMemos
  .filter((credit) => credit.status === "posted")
  .flatMap((credit) => credit.allocations)
  .forEach((allocation) => {
    postedCreditByInvoiceAllocation.set(
      allocation.invoiceAllocationId,
      (postedCreditByInvoiceAllocation.get(allocation.invoiceAllocationId) ?? 0) +
        allocation.amountCents,
    );
  });

export const payments: PaymentRecord[] = maintenanceInvoices
  .filter((invoice) => invoice.status === "paid" && invoice.paidAt)
  .map((invoice) => {
    const allocations: PaymentAllocation[] = invoice.allocations
      .map((allocation) => ({
        ...allocation,
        id: `payment-${invoice.sourceInvoiceId}-${allocation.id}`,
        sourceType: "payment" as const,
        sourceId: `payment-${invoice.sourceInvoiceId}`,
        amountCents: Math.max(
          0,
          allocation.amountCents -
            (postedCreditByInvoiceAllocation.get(allocation.id) ?? 0),
        ),
        invoiceAllocationId: allocation.id,
      }))
      .filter((allocation) => allocation.amountCents > 0);
    const allocatedCents = sumCents(allocations.map((allocation) => allocation.amountCents));
    return {
      organizationId: ORGANIZATION_ID,
      id: `payment-${invoice.sourceInvoiceId}`,
      invoiceId: invoice.id,
      vendorId: invoice.vendorId,
      status: "observed_paid",
      amountCents: invoice.netInvoicedCents,
      allocatedCents,
      unallocatedCents: Math.max(0, invoice.netInvoicedCents - allocatedCents),
      currency: CURRENCY,
      observedAt: required(invoice.paidAt, `Paid invoice ${invoice.id} requires paidAt`),
      externalReference: `AP-${invoice.number}`,
      sourceSystem: "demo_ap_export",
      allocations,
    };
  });

export const accruals: Accrual[] = demoData.workOrders
  .filter((workOrder) => workOrder.status === "completed_pending_invoice")
  .map((workOrder) => {
    const recordedCostCents =
      (workOrder.laborCostCents ?? 0) +
      (workOrder.partsCostCents ?? 0) +
      (workOrder.travelCostCents ?? 0);
    const amountCents = Math.min(
      workOrder.nteCents,
      Math.max(recordedCostCents, workOrder.costExposureCents),
    );
    const id = `accrual-${workOrder.id}-2026-07`;
    return {
      organizationId: ORGANIZATION_ID,
      id,
      workOrderId: workOrder.id,
      vendorId: workOrder.vendorId,
      status: "open",
      basis: "completed_unbilled_work_order",
      amountCents,
      currency: CURRENCY,
      accountingPeriod: "2026-07",
      accruedAt: "2026-07-31T23:59:59.000Z",
      serviceThroughAt: workOrder.targetCompletionAt ?? workOrder.dueAt ?? DEMO_NOW,
      allocations: [
        allocationForWorkOrder(
          "accrual",
          id,
          `${id}-allocation-1`,
          workOrder,
          amountCents,
        ),
      ],
    };
  });

export const approvalPolicies: ApprovalPolicy[] = [
  {
    organizationId: ORGANIZATION_ID,
    id: "approval-standard-maintenance",
    name: "Standard maintenance authorization",
    appliesTo: {
      workTypes: ["reactive", "preventive", "inspection", "warranty", "internal"],
      fulfillmentModes: ["internal", "external", "blended"],
    },
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
    tiers: [
      {
        id: "approval-standard-tier-1",
        sequence: 1,
        minimumAmountCents: 0,
        maximumAmountCents: 100_000,
        requiredApproverRoles: ["Maintenance Manager"],
        minimumApprovals: 1,
      },
      {
        id: "approval-standard-tier-2",
        sequence: 2,
        minimumAmountCents: 100_001,
        maximumAmountCents: 500_000,
        requiredApproverRoles: ["Regional Manager"],
        minimumApprovals: 1,
      },
      {
        id: "approval-standard-tier-3",
        sequence: 3,
        minimumAmountCents: 500_001,
        maximumAmountCents: 1_500_000,
        requiredApproverRoles: ["Facilities Director"],
        minimumApprovals: 1,
      },
      {
        id: "approval-standard-tier-4",
        sequence: 4,
        minimumAmountCents: 1_500_001,
        requiredApproverRoles: ["Facilities Director", "Finance Director"],
        minimumApprovals: 2,
      },
    ],
  },
  {
    organizationId: ORGANIZATION_ID,
    id: "approval-emergency-maintenance",
    name: "Emergency stabilization authorization",
    appliesTo: {
      workTypes: ["emergency"],
      fulfillmentModes: ["internal", "external", "blended"],
    },
    effectiveFrom: EFFECTIVE_FROM,
    emergencyAfterTheFactReviewHours: 24,
    active: true,
    tiers: [
      {
        id: "approval-emergency-tier-1",
        sequence: 1,
        minimumAmountCents: 0,
        maximumAmountCents: 500_000,
        requiredApproverRoles: ["Regional Manager"],
        minimumApprovals: 1,
      },
      {
        id: "approval-emergency-tier-2",
        sequence: 2,
        minimumAmountCents: 500_001,
        requiredApproverRoles: ["Facilities Director", "Finance Director"],
        minimumApprovals: 2,
      },
    ],
  },
  {
    organizationId: ORGANIZATION_ID,
    id: "approval-capital-maintenance",
    name: "Capital maintenance authorization",
    appliesTo: {
      workTypes: ["capital"],
      fulfillmentModes: ["internal", "external", "blended"],
    },
    effectiveFrom: EFFECTIVE_FROM,
    active: true,
    tiers: [
      {
        id: "approval-capital-tier-1",
        sequence: 1,
        minimumAmountCents: 0,
        maximumAmountCents: 2_500_000,
        requiredApproverRoles: ["Facilities Director", "Finance Director"],
        minimumApprovals: 2,
      },
      {
        id: "approval-capital-tier-2",
        sequence: 2,
        minimumAmountCents: 2_500_001,
        requiredApproverRoles: ["Chief Operating Officer", "Finance Director"],
        minimumApprovals: 2,
      },
    ],
  },
];

const providerDefaultGlAccount = (trade: string): string => {
  const normalizedTrade = trade.toLowerCase();
  if (normalizedTrade.includes("refrigeration")) return categoryGlAccountId("refrigeration");
  if (normalizedTrade.includes("hvac") || normalizedTrade.includes("climate")) {
    return categoryGlAccountId("hvac");
  }
  if (normalizedTrade.includes("food") || normalizedTrade.includes("oven")) {
    return categoryGlAccountId("foodservice");
  }
  if (normalizedTrade.includes("plumb")) return categoryGlAccountId("plumbing");
  if (normalizedTrade.includes("electrical")) return categoryGlAccountId("electrical");
  if (normalizedTrade.includes("fuel")) return categoryGlAccountId("fuel");
  if (normalizedTrade.includes("fire") || normalizedTrade.includes("safety")) {
    return categoryGlAccountId("life-safety");
  }
  if (normalizedTrade.includes("landscap") || normalizedTrade.includes("snow")) {
    return categoryGlAccountId("grounds");
  }
  if (normalizedTrade.includes("janitorial") || normalizedTrade.includes("clean")) {
    return categoryGlAccountId("janitorial");
  }
  if (normalizedTrade.includes("pest")) return categoryGlAccountId("pest");
  if (normalizedTrade.includes("sign")) return categoryGlAccountId("signage");
  if (normalizedTrade.includes("waste") || normalizedTrade.includes("recycl")) {
    return categoryGlAccountId("waste");
  }
  return categoryGlAccountId("building");
};

export const providerFinancialProfiles: ProviderFinancialProfile[] = demoData.vendors.map(
  (vendor, index) => ({
    organizationId: ORGANIZATION_ID,
    id: `provider-finance-${vendor.id}`,
    providerId: vendor.id,
    providerName: vendor.name,
    providerType: "external_vendor",
    currency: CURRENCY,
    paymentTermsDays: index % 4 === 0 ? 45 : 30,
    invoiceSubmissionEmail: vendor.dispatchEmail,
    taxDocumentationStatus: "on_file",
    insuranceStatus: index === demoData.vendors.length - 1 ? "expiring" : "current",
    defaultGlAccountId: providerDefaultGlAccount(vendor.trade),
    allowedRegionIds: demoData.regions.map((region) => region.id),
    active: true,
  }),
);

export const internalTeamFinancialProfiles: InternalTeamFinancialProfile[] = [
  ...demoData.regions.map((region, index) => ({
    organizationId: ORGANIZATION_ID,
    id: `internal-team-finance-${region.id}`,
    teamId: `internal-maintenance-${region.id}`,
    teamName: `${region.name} internal maintenance`,
    regionIds: [region.id],
    memberIds: demoData.technicians
      .filter(
        (technician) =>
          technician.employmentType === "internal" && technician.regionIds.includes(region.id),
      )
      .map((technician) => technician.id),
    regularBurdenedRateCents: 6_800 + index * 350,
    overtimeBurdenedRateCents: 10_200 + index * 525,
    currency: CURRENCY,
    defaultGlAccountId: INTERNAL_LABOR_GL_ID,
    active: true,
    costingOnly: true as const,
  })),
  {
    organizationId: ORGANIZATION_ID,
    id: "internal-team-finance-central",
    teamId: "internal-maintenance-central-support",
    teamName: "Central maintenance support",
    regionIds: demoData.regions.map((region) => region.id),
    memberIds: demoData.technicians
      .filter((technician) => technician.employmentType === "internal")
      .map((technician) => technician.id),
    regularBurdenedRateCents: 7_600,
    overtimeBurdenedRateCents: 11_400,
    currency: CURRENCY,
    defaultGlAccountId: INTERNAL_LABOR_GL_ID,
    active: true,
    costingOnly: true,
  },
];

const ledgerFromAllocations = (
  stage: FinancialStage,
  sourceType: FinancialSourceType,
  sourceId: string,
  effectiveAt: string,
  allocations: readonly AccountingAllocation[],
): MaintenanceLedgerEntry[] =>
  allocations.map((allocation) => ({
    organizationId: allocation.organizationId,
    id: `ledger-${stage}-${sourceId}-${allocation.id}`,
    stage,
    sourceType,
    sourceId,
    sourceAllocationId: allocation.id,
    amountCents: allocation.amountCents,
    currency: allocation.currency,
    effectiveAt,
    workOrderId: allocation.workOrderId,
    storeId: allocation.storeId,
    regionId: allocation.regionId,
    categoryId: allocation.categoryId,
    systemId: allocation.systemId,
    assetId: allocation.assetId,
    componentId: allocation.componentId,
    vendorId: allocation.vendorId,
    costCenterId: allocation.costCenterId,
    glAccountId: allocation.glAccountId,
    budgetId: allocation.budgetId,
    budgetLineId: allocation.budgetLineId,
  }));

const requestEstimateEntries: MaintenanceLedgerEntry[] = demoData.workOrders
  .filter((workOrder) => workOrder.status !== "closed" && workOrder.costExposureCents > 0)
  .flatMap((workOrder) => {
    const amountCents = Math.min(workOrder.nteCents, workOrder.costExposureCents);
    const sourceId = `estimate-${workOrder.id}`;
    const allocation = allocationForWorkOrder(
      "work_order_estimate",
      sourceId,
      `${sourceId}-allocation-1`,
      workOrder,
      amountCents,
    );
    return ledgerFromAllocations(
      "requested",
      "work_order_estimate",
      sourceId,
      workOrder.createdAt,
      [allocation],
    );
  });

const quoteEntries = submittedQuoteViews.flatMap((quote) =>
  quote.quotedCents && quote.status !== "declined"
    ? ledgerFromAllocations(
        "quoted",
        "proposal_quote",
        quote.id,
        quote.submittedAt ?? quote.requestedAt,
        quote.allocations,
      )
    : [],
);

const authorizationEntries = demoData.authorizations.flatMap((authorization) => {
  if (authorization.status === "cancelled") return [];
  const workOrder = required(
    workOrderById.get(authorization.workOrderId),
    `Unknown work order ${authorization.workOrderId} for authorization ${authorization.id}`,
  );
  const allocation = allocationForWorkOrder(
    "authorization",
    authorization.id,
    `authorization-allocation-${authorization.id}`,
    workOrder,
    authorization.amountCents,
  );
  return ledgerFromAllocations(
    "approved",
    "authorization",
    authorization.id,
    authorization.approvedAt,
    [allocation],
  );
});

const purchaseOrderEntries = purchaseOrders
  .filter((purchaseOrder) => purchaseOrder.status !== "draft" && purchaseOrder.status !== "cancelled")
  .flatMap((purchaseOrder) =>
    ledgerFromAllocations(
      "committed",
      "purchase_order",
      purchaseOrder.id,
      purchaseOrder.issuedAt,
      purchaseOrder.allocations,
    ),
  );

const accrualEntries = accruals
  .filter((accrual) => accrual.status === "open")
  .flatMap((accrual) =>
    ledgerFromAllocations(
      "accrued",
      "accrual",
      accrual.id,
      accrual.accruedAt,
      accrual.allocations,
    ),
  );

const invoiceEntries = maintenanceInvoices
  .filter((invoice) => invoice.status !== "void")
  .flatMap((invoice) =>
    ledgerFromAllocations(
      "invoiced",
      "invoice",
      invoice.id,
      invoice.issuedAt,
      invoice.allocations,
    ),
  );

const creditEntries = creditMemos
  .filter((credit) => credit.status === "posted")
  .flatMap((credit) => [
    ...ledgerFromAllocations(
      "credited",
      "credit",
      credit.id,
      required(credit.postedAt, `Posted credit ${credit.id} requires postedAt`),
      credit.allocations,
    ),
    ...(credit.recoveryType === "warranty_recovery"
      ? ledgerFromAllocations(
          "warranty_recovered",
          "credit",
          credit.id,
          required(credit.postedAt, `Posted credit ${credit.id} requires postedAt`),
          credit.allocations,
        )
      : []),
  ]);

const paymentEntries = payments
  .filter((payment) => payment.status !== "void")
  .flatMap((payment) =>
    ledgerFromAllocations(
      "paid",
      "payment",
      payment.id,
      payment.observedAt,
      payment.allocations,
    ),
  );

export const maintenanceLedgerEntries: MaintenanceLedgerEntry[] = [
  ...requestEstimateEntries,
  ...quoteEntries,
  ...authorizationEntries,
  ...purchaseOrderEntries,
  ...accrualEntries,
  ...invoiceEntries,
  ...creditEntries,
  ...paymentEntries,
];

const entryMatches = (
  entry: MaintenanceLedgerEntry,
  filter: FinancialRollupFilter,
): boolean => {
  if (entry.organizationId !== filter.organizationId) return false;
  if (filter.regionId !== undefined && entry.regionId !== filter.regionId) return false;
  if (filter.storeId !== undefined && entry.storeId !== filter.storeId) return false;
  if (filter.workOrderId !== undefined && entry.workOrderId !== filter.workOrderId) return false;
  if (filter.vendorId !== undefined && entry.vendorId !== filter.vendorId) return false;
  if (filter.categoryId !== undefined && entry.categoryId !== filter.categoryId) return false;
  if (filter.costCenterId !== undefined && entry.costCenterId !== filter.costCenterId) return false;
  if (filter.glAccountId !== undefined && entry.glAccountId !== filter.glAccountId) return false;
  if (filter.budgetId !== undefined && entry.budgetId !== filter.budgetId) return false;
  if (filter.budgetLineId !== undefined && entry.budgetLineId !== filter.budgetLineId) return false;
  if (filter.effectiveFrom !== undefined && entry.effectiveAt < filter.effectiveFrom) return false;
  if (filter.effectiveThrough !== undefined && entry.effectiveAt > filter.effectiveThrough) return false;
  return true;
};

const emptyPosition = (organizationId: string): FinancialPosition => ({
  organizationId,
  requestedCents: 0,
  quotedCents: 0,
  approvedCents: 0,
  committedCents: 0,
  accruedCents: 0,
  invoicedCents: 0,
  creditedCents: 0,
  warrantyRecoveredCents: 0,
  paidCents: 0,
  netInvoicedCents: 0,
  unpaidCents: 0,
  entryCount: 0,
});

export const rollupFinancialPosition = (
  filter: FinancialRollupFilter,
  entries: readonly MaintenanceLedgerEntry[] = maintenanceLedgerEntries,
): FinancialPosition => {
  const position = emptyPosition(filter.organizationId);
  entries.forEach((entry) => {
    if (!entryMatches(entry, filter)) return;
    position.entryCount += 1;
    switch (entry.stage) {
      case "requested":
        position.requestedCents += entry.amountCents;
        break;
      case "quoted":
        position.quotedCents += entry.amountCents;
        break;
      case "approved":
        position.approvedCents += entry.amountCents;
        break;
      case "committed":
        position.committedCents += entry.amountCents;
        break;
      case "accrued":
        position.accruedCents += entry.amountCents;
        break;
      case "invoiced":
        position.invoicedCents += entry.amountCents;
        break;
      case "credited":
        position.creditedCents += entry.amountCents;
        break;
      case "warranty_recovered":
        position.warrantyRecoveredCents += entry.amountCents;
        break;
      case "paid":
        position.paidCents += entry.amountCents;
        break;
    }
  });
  position.netInvoicedCents = Math.max(0, position.invoicedCents - position.creditedCents);
  position.unpaidCents = Math.max(0, position.netInvoicedCents - position.paidCents);
  return position;
};

export const rollupFinancialPositionBy = (
  filter: FinancialRollupFilter,
  dimension: FinancialRollupDimension,
  entries: readonly MaintenanceLedgerEntry[] = maintenanceLedgerEntries,
): FinancialPositionRow[] => {
  const matchingEntries = entries.filter((entry) => entryMatches(entry, filter));
  const dimensionIds = [
    ...new Set(matchingEntries.map((entry) => entry[dimension] ?? "unassigned")),
  ].sort();
  return dimensionIds.map((dimensionId) => ({
    ...rollupFinancialPosition(
      {
        ...filter,
        ...(dimensionId === "unassigned" ? {} : { [dimension]: dimensionId }),
      },
      dimensionId === "unassigned"
        ? matchingEntries.filter((entry) => entry[dimension] === undefined)
        : matchingEntries,
    ),
    dimension,
    dimensionId,
  }));
};

const lifecycleExposure = (entries: readonly MaintenanceLedgerEntry[]): number => {
  const byWorkOrder = new Map<string, MaintenanceLedgerEntry[]>();
  entries.forEach((entry) => {
    const key = entry.workOrderId ?? `${entry.sourceType}:${entry.sourceId}`;
    const records = byWorkOrder.get(key) ?? [];
    records.push(entry);
    byWorkOrder.set(key, records);
  });
  return sumCents(
    [...byWorkOrder.values()].map((records) => {
      const position = rollupFinancialPosition(
        { organizationId: records[0].organizationId },
        records,
      );
      return Math.max(
        position.committedCents,
        position.accruedCents,
        position.netInvoicedCents,
      );
    }),
  );
};

export const rollupBudgetPosition = (
  organizationId: string,
  budgetId: string,
  entries: readonly MaintenanceLedgerEntry[] = maintenanceLedgerEntries,
): BudgetPosition => {
  const budget = required(
    budgets.find(
      (record) => record.organizationId === organizationId && record.id === budgetId,
    ),
    `Unknown budget ${budgetId} for organization ${organizationId}`,
  );
  const matchingEntries = entries.filter(
    (entry) => entry.organizationId === organizationId && entry.budgetId === budgetId,
  );
  const position = rollupFinancialPosition(
    { organizationId, budgetId },
    matchingEntries,
  );
  const exposureCents = lifecycleExposure(matchingEntries);
  const forecastCents = Math.max(
    position.requestedCents,
    position.quotedCents,
    position.approvedCents,
    exposureCents,
  );
  return {
    ...position,
    budgetId,
    approvedBudgetCents: budget.approvedCents,
    lifecycleExposureCents: exposureCents,
    forecastCents,
    availableCents: budget.approvedCents - exposureCents,
  };
};

export const reconcileInvoice = (
  organizationId: string,
  invoiceId: string,
): InvoiceReconciliation => {
  const invoice = required(
    maintenanceInvoices.find(
      (record) => record.organizationId === organizationId && record.id === invoiceId,
    ),
    `Unknown invoice ${invoiceId} for organization ${organizationId}`,
  );
  const paymentCents = sumCents(
    payments
      .filter(
        (payment) =>
          payment.organizationId === organizationId &&
          payment.invoiceId === invoiceId &&
          payment.status !== "void",
      )
      .map((payment) => payment.amountCents),
  );
  return {
    organizationId,
    invoiceId,
    grossAmountCents: invoice.grossAmountCents,
    allocatedCents: invoice.allocatedCents,
    unallocatedCents: invoice.unallocatedCents,
    overallocatedCents: Math.max(0, invoice.allocatedCents - invoice.grossAmountCents),
    proposedCreditCents: invoice.proposedCreditCents,
    postedCreditCents: invoice.creditedCents,
    netInvoicedCents: invoice.netInvoicedCents,
    paidCents: paymentCents,
    paymentOutstandingCents: Math.max(0, invoice.netInvoicedCents - paymentCents),
  };
};

const stageOrder: Record<FinancialStage, number> = {
  requested: 0,
  quoted: 1,
  approved: 2,
  committed: 3,
  accrued: 4,
  invoiced: 5,
  credited: 6,
  warranty_recovered: 7,
  paid: 8,
};

export const getWorkOrderFinancialTrail = (
  organizationId: string,
  workOrderId: string,
): MaintenanceLedgerEntry[] =>
  maintenanceLedgerEntries
    .filter(
      (entry) =>
        entry.organizationId === organizationId && entry.workOrderId === workOrderId,
    )
    .sort(
      (left, right) =>
        left.effectiveAt.localeCompare(right.effectiveAt) ||
        stageOrder[left.stage] - stageOrder[right.stage] ||
        left.id.localeCompare(right.id),
    );

const assertCents = (label: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer number of cents; received ${value}`);
  }
};

const assertAllocationsReconcile = (
  label: string,
  totalCents: number,
  allocations: readonly AccountingAllocation[],
  allowUnallocated = false,
): void => {
  assertCents(`${label}.totalCents`, totalCents);
  allocations.forEach((allocation) =>
    assertCents(`${label}.${allocation.id}.amountCents`, allocation.amountCents),
  );
  const allocatedCents = sumCents(allocations.map((allocation) => allocation.amountCents));
  if (allocatedCents > totalCents || (!allowUnallocated && allocatedCents !== totalCents)) {
    throw new Error(
      `${label} allocation reconciliation failed: ${allocatedCents} allocated against ${totalCents}`,
    );
  }
};

const assertUniqueValues = <T>(
  label: string,
  records: readonly T[],
  valueOf: (record: T) => string,
): void => {
  const values = new Set<string>();
  records.forEach((record) => {
    const value = valueOf(record);
    if (!value || values.has(value)) {
      throw new Error(`${label} requires unique non-empty values; received ${value}`);
    }
    values.add(value);
  });
};

const validateFinanceSeed = (): void => {
  if (demoData.stores.length === 0) {
    throw new Error("Finance seed requires at least one showcase store");
  }

  assertUniqueValues("GL account ids", glAccounts, (record) => record.id);
  assertUniqueValues("GL account codes", glAccounts, (record) => record.code);
  assertUniqueValues("cost center ids", accountingCostCenters, (record) => record.id);
  assertUniqueValues("cost center codes", accountingCostCenters, (record) => record.code);
  assertUniqueValues("budget ids", budgets, (record) => record.id);
  assertUniqueValues(
    "budget line ids",
    budgets.flatMap((budget) => budget.lines),
    (record) => record.id,
  );
  assertUniqueValues("proposal ids", proposalQuoteViews, (record) => record.id);
  assertUniqueValues("purchase order ids", purchaseOrders, (record) => record.id);
  assertUniqueValues("finance invoice ids", maintenanceInvoices, (record) => record.id);
  assertUniqueValues("credit ids", creditMemos, (record) => record.id);
  assertUniqueValues("payment ids", payments, (record) => record.id);
  assertUniqueValues("accrual ids", accruals, (record) => record.id);
  assertUniqueValues("ledger entry ids", maintenanceLedgerEntries, (record) => record.id);

  const categoryIds = new Set(demoData.categories.map((record) => record.id));
  const configuredCategoryIds = new Set(Object.keys(categoryGlCodes));
  if (
    categoryIds.size !== configuredCategoryIds.size ||
    [...categoryIds].some((categoryId) => !configuredCategoryIds.has(categoryId))
  ) {
    throw new Error("Every service category must have exactly one configured GL mapping");
  }
  demoData.categories.forEach((category) => {
    const expectedAccountId = categoryGlAccountId(category.id);
    const matchingAccounts = glAccounts.filter(
      (account) => account.categoryId === category.id && account.id === expectedAccountId,
    );
    if (matchingAccounts.length !== 1) {
      throw new Error(`${category.id} must resolve to exactly one category GL account`);
    }
  });

  const regionIds = new Set(demoData.regions.map((record) => record.id));
  const storeIds = new Set(demoData.stores.map((record) => record.id));
  const vendorIds = new Set(demoData.vendors.map((record) => record.id));
  const technicianIds = new Set(demoData.technicians.map((record) => record.id));
  const systemById = new Map(demoData.systems.map((record) => [record.id, record]));
  const assetById = new Map(demoData.assets.map((record) => [record.id, record]));
  const componentById = new Map(demoData.components.map((record) => [record.id, record]));
  const glAccountIds = new Set(glAccounts.map((record) => record.id));
  const costCenterIds = new Set(accountingCostCenters.map((record) => record.id));
  const budgetById = new Map(budgets.map((record) => [record.id, record]));
  const budgetLineById = new Map(
    budgets.flatMap((budget) => budget.lines.map((line) => [line.id, line] as const)),
  );
  const sourceInvoiceIds = new Set(demoData.invoices.map((record) => record.id));
  const sourceQuoteIds = new Set(demoData.quotes.map((record) => record.id));
  const authorizationIds = new Set(demoData.authorizations.map((record) => record.id));
  const quoteById = new Map(proposalQuoteViews.map((record) => [record.id, record]));
  const purchaseOrderById = new Map(purchaseOrders.map((record) => [record.id, record]));
  const invoiceById = new Map(maintenanceInvoices.map((record) => [record.id, record]));
  const creditById = new Map(creditMemos.map((record) => [record.id, record]));
  const paymentById = new Map(payments.map((record) => [record.id, record]));
  const accrualById = new Map(accruals.map((record) => [record.id, record]));

  const assertOrganization = (label: string, organizationId: string): void => {
    if (organizationId !== ORGANIZATION_ID) {
      throw new Error(`${label} belongs to invalid organization ${organizationId}`);
    }
  };

  glAccounts.forEach((account) => {
    assertOrganization(account.id, account.organizationId);
    if (account.categoryId && !categoryIds.has(account.categoryId)) {
      throw new Error(`${account.id} has invalid category ${account.categoryId}`);
    }
  });
  accountingCostCenters.forEach((costCenter) => {
    assertOrganization(costCenter.id, costCenter.organizationId);
    if (costCenter.parentCostCenterId && !costCenterIds.has(costCenter.parentCostCenterId)) {
      throw new Error(`${costCenter.id} has invalid parent ${costCenter.parentCostCenterId}`);
    }
    if (costCenter.regionId && !regionIds.has(costCenter.regionId)) {
      throw new Error(`${costCenter.id} has invalid region ${costCenter.regionId}`);
    }
    if (costCenter.storeId && !storeIds.has(costCenter.storeId)) {
      throw new Error(`${costCenter.id} has invalid store ${costCenter.storeId}`);
    }
  });

  const budgetedStoreIds = new Set(
    budgets.flatMap((budget) => budget.lines.map((line) => line.storeId).filter(Boolean)),
  );
  if (budgetedStoreIds.size !== demoData.stores.length) {
    throw new Error(
      `Finance seed expected budget coverage for ${demoData.stores.length} stores; received ${budgetedStoreIds.size}`,
    );
  }
  budgets.forEach((budget) => {
    assertOrganization(budget.id, budget.organizationId);
    if (budget.regionId && !regionIds.has(budget.regionId)) {
      throw new Error(`${budget.id} has invalid region ${budget.regionId}`);
    }
    assertCents(`${budget.id}.approvedCents`, budget.approvedCents);
    const lineTotal = sumCents(budget.lines.map((line) => line.approvedCents));
    if (lineTotal !== budget.approvedCents) {
      throw new Error(`${budget.id} lines do not reconcile to the approved budget`);
    }
    budget.lines.forEach((line) => {
      assertOrganization(line.id, line.organizationId);
      assertCents(`${line.id}.approvedCents`, line.approvedCents);
      if (
        line.budgetId !== budget.id ||
        !line.storeId ||
        !storeIds.has(line.storeId) ||
        !line.categoryId ||
        !categoryIds.has(line.categoryId) ||
        !costCenterIds.has(line.costCenterId) ||
        !glAccountIds.has(line.glAccountId)
      ) {
        throw new Error(`${line.id} has an invalid budget dimension or parent`);
      }
      if (line.glAccountId !== categoryGlAccountId(line.categoryId)) {
        throw new Error(`${line.id} does not use its category GL account`);
      }
    });
  });

  const validateDimensions = (
    allocation: AccountingAllocation | MaintenanceLedgerEntry,
    label: string,
  ): void => {
    assertOrganization(label, allocation.organizationId);
    assertCents(`${label}.amountCents`, allocation.amountCents);
    const workOrder = allocation.workOrderId
      ? workOrderById.get(allocation.workOrderId)
      : undefined;
    const store = allocation.storeId ? storeById.get(allocation.storeId) : undefined;
    const system = allocation.systemId ? systemById.get(allocation.systemId) : undefined;
    const asset = allocation.assetId ? assetById.get(allocation.assetId) : undefined;
    const component = allocation.componentId
      ? componentById.get(allocation.componentId)
      : undefined;

    if (!workOrder || !store || !allocation.categoryId || !categoryIds.has(allocation.categoryId)) {
      throw new Error(`${label} requires valid work-order, store and category dimensions`);
    }
    if (
      allocation.storeId !== workOrder.storeId ||
      allocation.categoryId !== workOrder.categoryId ||
      allocation.regionId !== store.regionId ||
      allocation.vendorId !== workOrder.vendorId
    ) {
      throw new Error(`${label} dimensions do not match work order ${workOrder.id}`);
    }
    const assetSystem = asset ? systemById.get(asset.storeSystemId) : undefined;
    const componentAsset = component ? assetById.get(component.assetId) : undefined;
    const componentSystem = componentAsset
      ? systemById.get(componentAsset.storeSystemId)
      : undefined;
    if (
      (allocation.systemId &&
        (!system || system.storeId !== store.id || system.categoryId !== allocation.categoryId)) ||
      (allocation.assetId &&
        (!assetSystem ||
          assetSystem.storeId !== store.id ||
          assetSystem.categoryId !== allocation.categoryId ||
          (system && assetSystem.id !== system.id))) ||
      (allocation.componentId &&
        (!component ||
          !componentAsset ||
          !componentSystem ||
          componentSystem.storeId !== store.id ||
          componentSystem.categoryId !== allocation.categoryId ||
          (asset && component.assetId !== asset.id) ||
          (system && componentSystem.id !== system.id))) ||
      (allocation.vendorId && !vendorIds.has(allocation.vendorId)) ||
      !allocation.costCenterId ||
      !costCenterIds.has(allocation.costCenterId) ||
      !allocation.glAccountId ||
      !glAccountIds.has(allocation.glAccountId)
    ) {
      throw new Error(`${label} has an invalid accounting or physical parent`);
    }
    if (allocation.budgetId || allocation.budgetLineId) {
      const budget = allocation.budgetId
        ? budgetById.get(allocation.budgetId)
        : undefined;
      const budgetLine = allocation.budgetLineId
        ? budgetLineById.get(allocation.budgetLineId)
        : undefined;
      if (
        !budget ||
        !budgetLine ||
        budgetLine.budgetId !== budget.id ||
        budgetLine.storeId !== allocation.storeId ||
        budgetLine.categoryId !== allocation.categoryId ||
        budgetLine.costCenterId !== allocation.costCenterId
      ) {
        throw new Error(`${label} has an invalid budget-line parent chain`);
      }
    }
  };

  const allAllocationIds = new Set<string>();
  const allocationOwnerById = new Map<string, string>();
  const validateOwnedAllocations = (
    sourceType: FinancialSourceType,
    parentId: string,
    allocations: readonly AccountingAllocation[],
  ): void => {
    allocations.forEach((allocation) => {
      if (allocation.sourceType !== sourceType || allocation.sourceId !== parentId) {
        throw new Error(`${allocation.id} does not identify its owning ${sourceType} ${parentId}`);
      }
      if (allAllocationIds.has(allocation.id)) {
        throw new Error(`Finance allocation id ${allocation.id} is not unique`);
      }
      allAllocationIds.add(allocation.id);
      allocationOwnerById.set(allocation.id, `${sourceType}:${parentId}`);
      validateDimensions(allocation, allocation.id);
    });
  };

  proposalQuoteViews.forEach((quote) => {
    assertOrganization(quote.id, quote.organizationId);
    const workOrder = workOrderById.get(quote.workOrderId);
    if (!workOrder || (quote.vendorId && quote.vendorId !== workOrder.vendorId)) {
      throw new Error(`${quote.id} has an invalid work-order/vendor parent`);
    }
    if (quote.sourceQuoteId && !sourceQuoteIds.has(quote.sourceQuoteId)) {
      throw new Error(`${quote.id} has invalid source quote ${quote.sourceQuoteId}`);
    }
    validateOwnedAllocations("proposal_quote", quote.id, quote.allocations);
    if (quote.quotedCents !== undefined) {
      assertAllocationsReconcile(quote.id, quote.quotedCents, quote.allocations);
    }
  });
  purchaseOrders.forEach((purchaseOrder) =>
    {
      assertOrganization(purchaseOrder.id, purchaseOrder.organizationId);
      const workOrder = workOrderById.get(purchaseOrder.workOrderId);
      if (
        !workOrder ||
        purchaseOrder.vendorId !== workOrder.vendorId ||
        !authorizationIds.has(purchaseOrder.authorizationId) ||
        (purchaseOrder.quoteId && !sourceQuoteIds.has(purchaseOrder.quoteId))
      ) {
        throw new Error(`${purchaseOrder.id} has an invalid work-order/vendor/source parent`);
      }
      validateOwnedAllocations("purchase_order", purchaseOrder.id, purchaseOrder.allocations);
      assertAllocationsReconcile(
        purchaseOrder.id,
        purchaseOrder.committedCents,
        purchaseOrder.allocations,
      );
    },
  );
  maintenanceInvoices.forEach((invoice) => {
    assertOrganization(invoice.id, invoice.organizationId);
    const workOrder = workOrderById.get(invoice.workOrderId);
    const purchaseOrder = invoice.purchaseOrderId
      ? purchaseOrderById.get(invoice.purchaseOrderId)
      : undefined;
    if (
      !sourceInvoiceIds.has(invoice.sourceInvoiceId) ||
      !workOrder ||
      invoice.vendorId !== workOrder.vendorId ||
      (invoice.purchaseOrderId &&
        (!purchaseOrder ||
          purchaseOrder.workOrderId !== invoice.workOrderId ||
          purchaseOrder.vendorId !== invoice.vendorId))
    ) {
      throw new Error(`${invoice.id} has an invalid source/work-order/vendor/PO parent`);
    }
    validateOwnedAllocations("invoice", invoice.id, invoice.allocations);
    assertAllocationsReconcile(
      invoice.id,
      invoice.grossAmountCents,
      invoice.allocations,
      true,
    );
  });
  creditMemos.forEach((credit) => {
    assertOrganization(credit.id, credit.organizationId);
    const invoice = invoiceById.get(credit.invoiceId);
    if (
      !invoice ||
      credit.workOrderId !== invoice.workOrderId ||
      credit.vendorId !== invoice.vendorId
    ) {
      throw new Error(`${credit.id} has an invalid invoice/work-order/vendor parent`);
    }
    validateOwnedAllocations("credit", credit.id, credit.allocations);
    const invoiceAllocationIds = new Set(invoice.allocations.map((allocation) => allocation.id));
    if (credit.allocations.some((allocation) => !invoiceAllocationIds.has(allocation.invoiceAllocationId))) {
      throw new Error(`${credit.id} references an allocation outside invoice ${invoice.id}`);
    }
    assertAllocationsReconcile(credit.id, credit.amountCents, credit.allocations);
  });
  payments.forEach((payment) => {
    assertOrganization(payment.id, payment.organizationId);
    const invoice = invoiceById.get(payment.invoiceId);
    if (!invoice || payment.vendorId !== invoice.vendorId) {
      throw new Error(`${payment.id} has an invalid invoice/vendor parent`);
    }
    validateOwnedAllocations("payment", payment.id, payment.allocations);
    const invoiceAllocationIds = new Set(invoice.allocations.map((allocation) => allocation.id));
    if (payment.allocations.some((allocation) => !invoiceAllocationIds.has(allocation.invoiceAllocationId))) {
      throw new Error(`${payment.id} references an allocation outside invoice ${invoice.id}`);
    }
    assertAllocationsReconcile(payment.id, payment.amountCents, payment.allocations, true);
  });
  accruals.forEach((accrual) => {
    assertOrganization(accrual.id, accrual.organizationId);
    const workOrder = workOrderById.get(accrual.workOrderId);
    if (!workOrder || accrual.vendorId !== workOrder.vendorId) {
      throw new Error(`${accrual.id} has an invalid work-order/vendor parent`);
    }
    validateOwnedAllocations("accrual", accrual.id, accrual.allocations);
    assertAllocationsReconcile(accrual.id, accrual.amountCents, accrual.allocations);
  });

  providerFinancialProfiles.forEach((profile) => {
    assertOrganization(profile.id, profile.organizationId);
    if (
      !vendorIds.has(profile.providerId) ||
      !glAccountIds.has(profile.defaultGlAccountId) ||
      profile.allowedRegionIds.some((regionId) => !regionIds.has(regionId))
    ) {
      throw new Error(`${profile.id} has an invalid vendor, GL account or region`);
    }
  });
  internalTeamFinancialProfiles.forEach((profile) => {
    assertOrganization(profile.id, profile.organizationId);
    if (
      !glAccountIds.has(profile.defaultGlAccountId) ||
      profile.regionIds.some((regionId) => !regionIds.has(regionId)) ||
      profile.memberIds.some((memberId) => !technicianIds.has(memberId))
    ) {
      throw new Error(`${profile.id} has an invalid GL account, region or member`);
    }
  });

  const validLedgerParent = (entry: MaintenanceLedgerEntry): boolean => {
    switch (entry.sourceType) {
      case "work_order_estimate":
        return entry.sourceId === `estimate-${entry.workOrderId}`;
      case "authorization":
        return authorizationIds.has(entry.sourceId);
      case "proposal_quote":
        return quoteById.has(entry.sourceId);
      case "purchase_order":
        return purchaseOrderById.has(entry.sourceId);
      case "accrual":
        return accrualById.has(entry.sourceId);
      case "invoice":
        return invoiceById.has(entry.sourceId);
      case "credit":
        return creditById.has(entry.sourceId);
      case "payment":
        return paymentById.has(entry.sourceId);
    }
  };
  const expectedStageBySource: Record<FinancialSourceType, readonly FinancialStage[]> = {
    work_order_estimate: ["requested"],
    proposal_quote: ["quoted"],
    authorization: ["approved"],
    purchase_order: ["committed"],
    accrual: ["accrued"],
    invoice: ["invoiced"],
    credit: ["credited", "warranty_recovered"],
    payment: ["paid"],
  };
  maintenanceLedgerEntries.forEach((entry) => {
    validateDimensions(entry, entry.id);
    if (!validLedgerParent(entry) || !expectedStageBySource[entry.sourceType].includes(entry.stage)) {
      throw new Error(`${entry.id} has an invalid financial source or lifecycle stage`);
    }
    const owner = allocationOwnerById.get(entry.sourceAllocationId);
    const expectedOwner = `${entry.sourceType}:${entry.sourceId}`;
    if (
      entry.sourceType === "work_order_estimate"
        ? entry.sourceAllocationId !== `${entry.sourceId}-allocation-1`
        : entry.sourceType === "authorization"
          ? entry.sourceAllocationId !== `authorization-allocation-${entry.sourceId}`
          : owner !== expectedOwner
    ) {
      throw new Error(`${entry.id} does not reference an allocation owned by ${expectedOwner}`);
    }
  });
};

validateFinanceSeed();

export const financeData: MaintenanceFinanceData = {
  organizationId: ORGANIZATION_ID,
  asOf: DEMO_NOW,
  currency: CURRENCY,
  glAccounts,
  accountingCostCenters,
  budgets,
  proposalQuoteViews,
  purchaseOrders,
  invoices: maintenanceInvoices,
  credits: creditMemos,
  payments,
  accruals,
  approvalPolicies,
  providerFinancialProfiles,
  internalTeamFinancialProfiles,
  ledgerEntries: maintenanceLedgerEntries,
};
