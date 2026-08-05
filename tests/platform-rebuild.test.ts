import { describe, expect, it } from "vitest";
import { platformData, platformSummary, taxonomyConfiguration } from "@/lib/platform/data";
import {
  approvalPolicies,
  financeData,
  maintenanceInvoices,
  reconcileInvoice,
  rollupFinancialPosition,
  rollupFinancialPositionBy,
} from "@/lib/platform/finance";
import { isRuntimeCreatedId, isRuntimeRegistryRecord } from "@/lib/platform/registry";

describe("regional and independent operating model", () => {
  it("keeps the showcase concise while retaining the 65-store product target", () => {
    expect(platformData.stores).toHaveLength(12);
    expect(platformSummary.pilotScaleStores).toBe(65);
    expect(platformData.organization.id).toBe("org-clarks");
    expect(new Set(platformData.stores.map((store) => store.id)).size).toBe(12);
    expect({ ...platformData.stores[0], regionId: undefined }.regionId).toBeUndefined();
  });

  it("keeps the larger legacy D1 seed out of the public showcase", () => {
    const createdStoreId = "store-06d81347-d654-4f77-98d9-31323abcdbca";
    expect(isRuntimeCreatedId(createdStoreId, "store")).toBe(true);
    expect(isRuntimeRegistryRecord("stores", { id: createdStoreId })).toBe(true);
    expect(isRuntimeRegistryRecord("stores", { id: "store-45" })).toBe(false);
    expect(isRuntimeRegistryRecord("stores", { id: "store-13" })).toBe(false);
    expect(isRuntimeRegistryRecord("work-orders", { id: createdStoreId })).toBe(false);
  });

  it("supports every requested trade while preserving HVAC and refrigeration depth", () => {
    const categoryIds = new Set(platformData.categories.map((category) => category.id));
    expect([...categoryIds]).toEqual(
      expect.arrayContaining([
        "refrigeration",
        "hvac",
        "foodservice",
        "plumbing",
        "electrical",
        "fuel",
        "building",
        "life-safety",
        "grounds",
        "snow",
        "janitorial",
        "pest",
        "signage",
        "waste",
      ]),
    );
    expect(platformData.assets.some((asset) => asset.id === "asset-45-ref-beer-cave")).toBe(true);
    expect(platformData.components.some((component) => component.assetId === "asset-45-ref-beer-cave")).toBe(true);
  });

  it("uses one work stream for internal, vendor, blended, and progressively classified work", () => {
    const assignmentTypes = new Set(platformData.workOrders.map((workOrder) => workOrder.assignmentType));
    expect([...assignmentTypes]).toEqual(expect.arrayContaining(["internal", "vendor", "blended"]));
    expect(platformData.workOrders.some((workOrder) => !workOrder.assetId)).toBe(true);
    expect(platformData.workOrders.some((workOrder) => Boolean(workOrder.componentId))).toBe(true);
  });

  it("keeps every showcase record connected to a valid parent", () => {
    const storeIds = new Set(platformData.stores.map((store) => store.id));
    const categoryIds = new Set(platformData.categories.map((category) => category.id));
    const vendorIds = new Set(platformData.vendors.map((vendor) => vendor.id));
    const technicianIds = new Set(platformData.technicians.map((technician) => technician.id));
    const systems = new Map(platformData.systems.map((system) => [system.id, system]));
    const assets = new Map(platformData.assets.map((asset) => [asset.id, asset]));
    const components = new Map(platformData.components.map((component) => [component.id, component]));
    const workOrders = new Map(platformData.workOrders.map((workOrder) => [workOrder.id, workOrder]));
    const invoices = new Map(platformData.invoices.map((invoice) => [invoice.id, invoice]));

    const expectPhysicalPath = (record: {
      storeId: string;
      categoryId: string;
      systemId?: string;
      assetId?: string;
      componentId?: string;
    }) => {
      expect(storeIds.has(record.storeId)).toBe(true);
      expect(categoryIds.has(record.categoryId)).toBe(true);
      const system = record.systemId ? systems.get(record.systemId) : undefined;
      const asset = record.assetId ? assets.get(record.assetId) : undefined;
      const component = record.componentId ? components.get(record.componentId) : undefined;
      if (record.systemId) expect(system).toBeDefined();
      if (record.assetId) expect(asset).toBeDefined();
      if (record.componentId) expect(component).toBeDefined();
      if (system) {
        expect(system.storeId).toBe(record.storeId);
        expect(system.categoryId).toBe(record.categoryId);
      }
      if (asset) {
        const assetSystem = systems.get(asset.storeSystemId);
        expect(assetSystem?.storeId).toBe(record.storeId);
        expect(assetSystem?.categoryId).toBe(record.categoryId);
        if (system) expect(asset.storeSystemId).toBe(system.id);
      }
      if (component) {
        const componentAsset = assets.get(component.assetId);
        const componentSystem = componentAsset
          ? systems.get(componentAsset.storeSystemId)
          : undefined;
        expect(componentSystem?.storeId).toBe(record.storeId);
        expect(componentSystem?.categoryId).toBe(record.categoryId);
        if (asset) expect(component.assetId).toBe(asset.id);
        if (system) expect(componentSystem?.id).toBe(system.id);
      }
    };

    platformData.systems.forEach((system) => expectPhysicalPath(system));
    expect(platformData.assets.every((asset) => systems.has(asset.storeSystemId))).toBe(true);
    expect(
      platformData.components.every(
        (component) => assets.has(component.assetId) && vendorIds.has(component.vendorId),
      ),
    ).toBe(true);
    platformData.workOrders.forEach((workOrder) => {
      expectPhysicalPath(workOrder);
      if (workOrder.vendorId) expect(vendorIds.has(workOrder.vendorId)).toBe(true);
    });
    expect(
      platformData.laborEntries.every(
        (entry) => workOrders.has(entry.workOrderId) && technicianIds.has(entry.technicianId),
      ),
    ).toBe(true);
    expect(platformData.partsUsed.every((usage) => workOrders.has(usage.workOrderId))).toBe(true);
    platformData.invoices.forEach((invoice) => {
      expect(vendorIds.has(invoice.vendorId)).toBe(true);
      expect(workOrders.get(invoice.workOrderId)?.vendorId).toBe(invoice.vendorId);
    });
    platformData.allocations.forEach((allocation) => {
      const invoice = invoices.get(allocation.invoiceId);
      expect(invoice?.workOrderId).toBe(allocation.workOrderId);
      expectPhysicalPath(allocation);
    });
  });

  it("records completed internal work as labor and materials without vendor invoices", () => {
    const completedInternalWorkOrders = platformData.workOrders.filter(
      (workOrder) =>
        workOrder.assignmentType === "internal" &&
        ["closed", "completed_pending_verification"].includes(workOrder.status),
    );
    expect(completedInternalWorkOrders.length).toBeGreaterThan(0);

    completedInternalWorkOrders.forEach((workOrder) => {
      const laborCents = Math.round(
        platformData.laborEntries
          .filter((entry) => entry.workOrderId === workOrder.id)
          .reduce(
            (total, entry) =>
              total + (entry.regularHours + entry.overtimeHours) * entry.hourlyRateCents,
            0,
          ),
      );
      const materialCents = platformData.partsUsed
        .filter((usage) => usage.workOrderId === workOrder.id)
        .reduce((total, usage) => total + usage.quantity * usage.unitCostCents, 0);

      expect(workOrder.vendorId).toBeUndefined();
      expect(laborCents).toBe(workOrder.laborCostCents);
      expect(materialCents).toBe(workOrder.partsCostCents);
      expect(platformData.invoices.some((invoice) => invoice.workOrderId === workOrder.id)).toBe(false);
    });
  });

  it("keeps canonical taxonomy labels beneath customer-specific naming", () => {
    expect(taxonomyConfiguration.levelLabels.find((level) => level.key === "system")?.organizationLabel).toBe("Cost center");
    expect(taxonomyConfiguration.aliases.find((alias) => alias.canonical === "Walk-In Cooler")?.aliases).toContain("Beer Cave");
  });
});

describe("maintenance financial control model", () => {
  it("uses one unique, exhaustive GL mapping for every service category", () => {
    const accountIds = financeData.glAccounts.map((account) => account.id);
    const accountCodes = financeData.glAccounts.map((account) => account.code);
    const categoryIds = new Set(platformData.categories.map((category) => category.id));
    const categoryAccounts = financeData.glAccounts.filter((account) => account.categoryId);
    const glAccountIds = new Set(accountIds);

    expect(accountIds.every((id) => id.trim().length > 0 && !id.includes("undefined"))).toBe(true);
    expect(accountCodes.every((code) => code.trim().length > 0)).toBe(true);
    expect(new Set(accountIds).size).toBe(accountIds.length);
    expect(new Set(accountCodes).size).toBe(accountCodes.length);
    expect(categoryAccounts).toHaveLength(categoryIds.size);
    expect(new Set(categoryAccounts.map((account) => account.categoryId))).toEqual(categoryIds);
    expect(
      financeData.budgets.every((budget) =>
        budget.lines.every((line) => glAccountIds.has(line.glAccountId)),
      ),
    ).toBe(true);
    expect(financeData.ledgerEntries.every((entry) => glAccountIds.has(entry.glAccountId!))).toBe(true);
  });

  it("keeps every finance allocation owned by its exposed parent record", () => {
    const owners = [
      ...financeData.proposalQuoteViews.map((source) => ["proposal_quote", source] as const),
      ...financeData.purchaseOrders.map((source) => ["purchase_order", source] as const),
      ...financeData.invoices.map((source) => ["invoice", source] as const),
      ...financeData.credits.map((source) => ["credit", source] as const),
      ...financeData.payments.map((source) => ["payment", source] as const),
      ...financeData.accruals.map((source) => ["accrual", source] as const),
    ];
    owners.forEach(([sourceType, source]) => {
      source.allocations.forEach((allocation) => {
        expect([allocation.organizationId, allocation.sourceType, allocation.sourceId]).toEqual([
          source.organizationId,
          sourceType,
          source.id,
        ]);
      });
    });

    const platformInvoiceIds = new Set(platformData.invoices.map((invoice) => invoice.id));
    financeData.invoices.forEach((invoice) => {
      expect(platformInvoiceIds.has(invoice.sourceInvoiceId)).toBe(true);
      expect(invoice.allocations.every((allocation) => allocation.sourceId === invoice.id)).toBe(true);
    });
    [...financeData.credits, ...financeData.payments].forEach((record) => {
      const invoice = financeData.invoices.find((candidate) => candidate.id === record.invoiceId)!;
      const invoiceAllocationIds = new Set(invoice.allocations.map((allocation) => allocation.id));
      expect(
        record.allocations.every((allocation) =>
          invoiceAllocationIds.has(allocation.invoiceAllocationId),
        ),
      ).toBe(true);
    });
  });

  it("keeps requested, committed, invoiced, credited, and paid as parallel stages", () => {
    const position = rollupFinancialPosition({ organizationId: financeData.organizationId });
    expect(position.requestedCents).toBeGreaterThan(0);
    expect(position.committedCents).toBeGreaterThan(0);
    expect(position.invoicedCents).toBeGreaterThan(0);
    expect(position.netInvoicedCents).toBe(position.invoicedCents - position.creditedCents);
    expect(position.unpaidCents).toBe(Math.max(0, position.netInvoicedCents - position.paidCents));
  });

  it("retains region dimensions and reconciles invoice allocations", () => {
    const regions = rollupFinancialPositionBy(
      { organizationId: financeData.organizationId },
      "regionId",
    );
    expect(regions.length).toBeGreaterThan(1);
    expect(regions.every((row) => row.dimension === "regionId" && row.dimensionId.length > 0)).toBe(true);

    const invoice = maintenanceInvoices.find((item) => item.sourceInvoiceId === "invoice-wo-0245")!;
    const reconciliation = reconcileInvoice(financeData.organizationId, invoice.id);
    expect(reconciliation.allocatedCents + reconciliation.unallocatedCents).toBe(reconciliation.grossAmountCents);
    expect(reconciliation.netInvoicedCents).toBe(reconciliation.grossAmountCents - reconciliation.postedCreditCents);
  });

  it("contains rule-driven approval policies for ordinary, emergency, and capital maintenance", () => {
    expect(approvalPolicies.map((policy) => policy.id)).toEqual(
      expect.arrayContaining([
        "approval-standard-maintenance",
        "approval-emergency-maintenance",
        "approval-capital-maintenance",
      ]),
    );
    expect(approvalPolicies.every((policy) => policy.tiers.every((tier) => tier.requiredApproverRoles.length >= tier.minimumApprovals))).toBe(true);
  });
});
