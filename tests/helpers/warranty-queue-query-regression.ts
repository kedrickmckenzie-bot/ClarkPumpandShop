import { expect } from "vitest";
import type { OpsRepository, OrganizationScope } from "@/lib/ops/repository";
import type { OpsFixture } from "@/lib/ops/types";
import { warrantyQueueFromFixture, warrantyQueueViews } from "@/lib/ops/warranty-queue-query";

export async function warrantyQueueRegression(repository: OpsRepository, fixture: OpsFixture) {
  const organizationId = fixture.organizations[0].id;
  const scopes: OrganizationScope[] = [{ organizationId }, { organizationId, storeIds: ["store-northline-104"] }, { organizationId, regionIds: [fixture.regions[0].id] }, { organizationId, storeIds: [] }, { organizationId, regionIds: [] }, { organizationId: "other" }];
  for (const scope of scopes) for (const view of warrantyQueueViews) {
    for (const change of [{}, { offset: 2 }, { offset: 10000 }, { currency: "CAD" }, { search: "104" }, { search: "%_" }]) {
      const query = { view, currency: "USD", limit: 2, ...change };
      expect(await repository.listWarrantyQueue(scope, query)).toEqual(warrantyQueueFromFixture(fixture, scope, query));
    }
  }
  const seen: string[] = [];
  let offset: number | undefined = 0;
  while (offset !== undefined) {
    const page = await repository.listWarrantyQueue({ organizationId }, { view: "all", currency: "USD", limit: 2, offset });
    seen.push(...page.rows.map(r => r.id));
    expect(page.rows.length).toBeLessThanOrEqual(2);
    if (page.nextOffset !== undefined) expect(page.nextOffset).toBeGreaterThan(offset);
    offset = page.nextOffset;
  }
  expect(new Set(seen).size).toBe(seen.length);
  expect(seen.length).toBe(warrantyQueueFromFixture(fixture, { organizationId }, { view: "all", currency: "USD" }).totalCount);
}
