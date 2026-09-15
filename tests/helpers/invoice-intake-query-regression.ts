import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { invoiceIntakeFromFixture, invoiceIntakeChecksFromFixture, type InvoiceIntakeQuery } from "@/lib/ops/invoice-intake-query";

export async function invoiceIntakeQueryRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id;
  for (const kind of ["work", "vendor", "agreement"] as const) {
    const base: InvoiceIntakeQuery = { kind, vendorId: "vendor-northline-summit", limit: 2 };
    for (const scope of [{ organizationId }, { organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId, storeIds: [fixture.stores[0].id] }, { organizationId: "other" }]) {
      expect(await repository.listInvoiceIntakeOptions(scope, base)).toEqual(invoiceIntakeFromFixture(fixture, scope, base));
    }
    for (const change of [{ offset: 2 }, { offset: 10000 }, { search: "104" }, { search: "%_\\" }, { vendorId: "missing" }]) {
      const query = { ...base, ...change };
      expect(await repository.listInvoiceIntakeOptions({ organizationId }, query)).toEqual(invoiceIntakeFromFixture(fixture, { organizationId }, query));
    }
  }
  for (const org of [organizationId, "other"]) for (const number of [" sum-104-2607 ", "New number"]) {
    expect(await repository.readInvoiceIntakeChecks(org, "wo-northline-104", "vendor-northline-summit", number)).toEqual(invoiceIntakeChecksFromFixture(fixture, org, "wo-northline-104", "vendor-northline-summit", number));
  }
}
