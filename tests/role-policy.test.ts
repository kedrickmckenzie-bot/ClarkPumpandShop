import { describe, expect, it } from "vitest";

import { demoData } from "../lib/cstore/demo-data";
import {
  demoRolePolicies,
  getDemoRolePolicy,
  roleScopeLabel,
  scopeDatasetForRole,
} from "../lib/cstore/role-policy";

describe("TraceOps demo role policy", () => {
  it("defines five distinct management personas with safe landing views", () => {
    expect(demoRolePolicies.map((policy) => policy.id)).toEqual([
      "facilities_manager",
      "owner_executive",
      "regional_manager",
      "store_manager",
      "finance_reviewer",
    ]);
    for (const policy of demoRolePolicies) {
      expect(policy.allowedViews).toContain(policy.defaultView);
      expect(demoData.people.some((person) => person.id === policy.personId)).toBe(true);
    }
    expect(getDemoRolePolicy("owner_executive").defaultView).toBe("spend");
    expect(getDemoRolePolicy("finance_reviewer").defaultView).toBe("spend");
    expect(getDemoRolePolicy("facilities_manager").defaultView).toBe("story");
    expect(demoRolePolicies.filter((policy) => policy.allowedViews.includes("story")).map((policy) => policy.id)).toEqual(["facilities_manager"]);
  });

  it("limits the regional manager to Central Ohio records", () => {
    const policy = getDemoRolePolicy("regional_manager");
    const scoped = scopeDatasetForRole(demoData, policy);
    const storeIds = new Set(scoped.stores.map((store) => store.id));

    expect(scoped.stores).toHaveLength(5);
    expect(scoped.stores.every((store) => store.regionId === "region-central-ohio")).toBe(true);
    expect(scoped.workOrders.every((work) => storeIds.has(work.storeId))).toBe(true);
    expect(scoped.assets.every((asset) => storeIds.has(asset.storeId))).toBe(true);
    expect(scoped.invoiceWorkLinks.every((link) => storeIds.has(link.storeId))).toBe(true);
    expect(roleScopeLabel(demoData, policy)).toBe("Central Ohio · 5 stores");
  });

  it("limits the store manager to Store 101 and its connected records", () => {
    const policy = getDemoRolePolicy("store_manager");
    const scoped = scopeDatasetForRole(demoData, policy);
    const workIds = new Set(scoped.workOrders.map((work) => work.id));
    const invoiceIds = new Set(scoped.invoices.map((invoice) => invoice.id));

    expect(scoped.stores.map((store) => store.storeNumber)).toEqual(["101"]);
    expect(scoped.workOrders.every((work) => work.storeId === "store-101")).toBe(true);
    expect(scoped.visits.every((visit) => visit.storeId === "store-101")).toBe(true);
    expect(scoped.invoiceWorkLinks.every((link) => workIds.has(link.workOrderId) && invoiceIds.has(link.invoiceId))).toBe(true);
    expect(scoped.assets.every((asset) => asset.storeId === "store-101")).toBe(true);
    expect(scoped.exceptions.every((exception) => !exception.storeId || exception.storeId === "store-101")).toBe(true);
    expect(roleScopeLabel(demoData, policy)).toContain("Store 101");
  });

  it("makes executive and finance roles read-only while preserving organization visibility", () => {
    for (const roleId of ["owner_executive", "finance_reviewer"] as const) {
      const policy = getDemoRolePolicy(roleId);
      const scoped = scopeDatasetForRole(demoData, policy);
      expect(scoped.stores).toHaveLength(15);
      expect(policy.permissions.createWork).toBe(false);
      expect(policy.permissions.issueVendorWork).toBe(false);
      expect(policy.permissions.recordVisits).toBe(false);
      expect(policy.permissions.manageSuite).toBe(false);
      expect(policy.permissions.generateReports).toBe(true);
    }
  });

  it("does not expose company reports or configuration to the store manager", () => {
    const policy = getDemoRolePolicy("store_manager");
    expect(policy.allowedViews).not.toContain("reports");
    expect(policy.permissions.createStore).toBe(false);
    expect(policy.permissions.manageSuite).toBe(false);
    expect(policy.permissions.createWork).toBe(true);
    expect(policy.permissions.recordVisits).toBe(true);
  });
});
