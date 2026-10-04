import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { OperatorSession } from "@/components/ops/data-contract";
import { navigationForRole, sessionRoleLabel } from "@/components/ops/navigation";
import { roleCan, roleCanAccessDetailRoute, roleCanAccessListRoute, roleCanAccessProgramRoute, roleCanOpenOperatorHref, roleCanSeeWorkNavigation } from "@/components/ops/role-policy";
import { resolveRoleCapabilities } from "@/lib/ops/capability-policy";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture, NORTHLINE_FIELD_MANAGER, NORTHLINE_ORGANIZATION_ID, NORTHLINE_PREVIEW_PERSONAS } from "@/lib/ops/fixtures";
import { buildPreviewPeopleStatements } from "@/lib/ops/seed";

vi.mock("server-only", () => ({}));

const fixture = buildNorthlinePresentationFixture();
const technician: OperatorSession = { role: "technician", userId: "user-northline-tech-1", membershipId: "membership-northline-tech-1", displayName: "Maria Santos", email: "m@example.test", organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Clark", scopeLabel: "All stores", permissions: ["ops:*"], effectiveCapabilities: [] };
const params = (href: string) => Object.fromEntries(new URL(href, "https://example.test").searchParams);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("technician role", () => {
  it("opens only its jobs, stores, visits and equipment, and can create or approve nothing", () => {
    for (const route of ["work-orders", "visits", "stores"] as const) expect(roleCanAccessListRoute("technician", route)).toBe(true);
    for (const route of ["action-center", "requests", "estimates", "vendors", "warranties", "invoices", "reports", "admin"] as const) expect(roleCanAccessListRoute("technician", route)).toBe(false);
    expect(roleCanAccessProgramRoute("technician", "equipment")).toBe(true);
    for (const route of ["trends", "spend", "pm", "lifecycle"] as const) expect(roleCanAccessProgramRoute("technician", route)).toBe(false);
    for (const route of ["work-order", "visit", "store", "equipment"] as const) expect(roleCanAccessDetailRoute("technician", route)).toBe(true);
    for (const href of ["/app/work-orders/new", "/app/vendors", "/app/spend", "/app/trends", "/app/action-center", "/app/compliance/new", "/app/equipment/new"]) expect(roleCanOpenOperatorHref("technician", href), href).toBe(false);
    expect(["create_request", "create_work_order", "issue_work_order", "record_work_cost", "administer"].some((capability) => roleCan("technician", capability as never))).toBe(false);
    expect(roleCanSeeWorkNavigation("technician", "tasks")).toBe(false);
    expect(resolveRoleCapabilities("internal_technician", []).capabilities).toEqual(["schedule_internal_work", "record_internal_result", "claim_internal_work", "return_internal_work"]);
    expect(roleCan("technician", "manage_internal_target")).toBe(false);
  });

  it("has a short menu that opens on their own open jobs", () => {
    const nav = navigationForRole("technician");
    expect(nav.map((item) => item.label)).toEqual(["My work", "Stores", "Equipment", "Work history", "Search"]);
    expect(nav[0].href).toBe("/app/my-work");
    expect(sessionRoleLabel(technician)).toBe("Technician");
  });

  it("'My work' lists exactly the open jobs currently assigned to that technician, and 'All jobs' widens it", async () => {
    const { buildQueryListModel } = await import("@/app/app/_data/operator-query-presenter");
    const repository = createOpsFixtureRepository(fixture);
    const current = (workOrderId: string) => fixture.assignments.filter((row) => row.workOrderId === workOrderId).at(-1);
    const expected = fixture.workOrders.filter((work) => !["closed", "cancelled"].includes(work.status) && current(work.id)?.kind === "internal" && current(work.id)?.internalMembershipId === technician.membershipId).map((work) => work.id).sort();
    const mine = await buildQueryListModel(repository, technician, "work-orders", { assignee: "me", status: "open" });
    expect(mine.page.title).toBe("My work");
    expect(mine.table.rows.map((row) => row.id).sort()).toEqual(expected);
    expect(mine.filters?.[0]).toMatchObject({ id: "assignee", options: [{ label: "My jobs", selected: true }, { label: "All jobs at my stores", selected: false }] });
    const all = await buildQueryListModel(repository, technician, "work-orders", params(mine.filters![0].options[1].href));
    expect(all.table.rows.length).toBeGreaterThan(mine.table.rows.length);
    expect(mine.appliedFilters?.map((filter) => filter.label)).toContain("Assigned to me");
    const devon = await buildQueryListModel(repository, { ...technician, membershipId: "membership-northline-tech-2" }, "work-orders", { assignee: "me", status: "all" });
    expect(devon.table.rows.every((row) => current(row.id)?.internalMembershipId === "membership-northline-tech-2")).toBe(true);
  });
});

describe("field manager", () => {
  it("is its own person and stored role, with the regional manager's access and capabilities", async () => {
    const { expectedDomainRole, operatorRoleForDomainRole } = await import("@/lib/server/operator-membership");
    expect(fixture.memberships.find((row) => row.id === NORTHLINE_FIELD_MANAGER.membership.id)).toMatchObject({ role: "field_manager", status: "active" });
    expect(fixture.users.find((row) => row.id === NORTHLINE_FIELD_MANAGER.user.id)?.displayName).toBe("Chris Delgado");
    expect(NORTHLINE_PREVIEW_PERSONAS.field_manager.membershipId).toBe(NORTHLINE_FIELD_MANAGER.membership.id);
    expect(operatorRoleForDomainRole("field_manager")).toEqual({ role: "regional", persona: "field_manager" });
    expect(operatorRoleForDomainRole("internal_technician")).toEqual({ role: "technician" });
    expect(expectedDomainRole({ role: "regional", persona: "field_manager" })).toBe("field_manager");
    expect(expectedDomainRole({ role: "regional" })).toBe("regional_manager");
    expect(resolveRoleCapabilities("field_manager", []).capabilities.sort()).toEqual(resolveRoleCapabilities("regional_manager", []).capabilities.sort());
    expect(sessionRoleLabel({ role: "regional", persona: "field_manager" })).toBe("Field manager");
  });

  it("is allowed everywhere a regional manager is allowed by an internal role list", () => {
    const missing: string[] = [];
    for (const path of ["lib", "app"].flatMap(sourceFiles)) {
      if (path.endsWith("fixtures.ts")) continue;
      for (const [index, line] of readFileSync(path, "utf8").split("\n").entries()) {
        for (const list of line.match(/\[[^\][]*regional_manager[^\][]*\]/g) ?? []) {
          if (!list.includes("field_manager")) missing.push(`${path}:${index + 1}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("can be added to an already-seeded preview without overwriting anything", () => {
    const statements = buildPreviewPeopleStatements();
    expect(statements.map((statement) => statement.sql.split(" (")[0])).toEqual(["INSERT INTO ops_users", "INSERT INTO ops_memberships", "INSERT INTO ops_scope_grants"]);
    expect(statements.every((statement) => statement.sql.endsWith("ON CONFLICT DO NOTHING"))).toBe(true);
    expect(statements.map((statement) => statement.params[0])).toEqual([NORTHLINE_FIELD_MANAGER.user.id, NORTHLINE_FIELD_MANAGER.membership.id, NORTHLINE_FIELD_MANAGER.scopeGrant.id]);
  });
});
