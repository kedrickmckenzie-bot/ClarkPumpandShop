import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";

const MULTI_VISIT_ID = "visit-northline-104-2";

describe("site visit work-order persistence", () => {
  it("keeps both database migrations tenant-bound and backfills legacy scalar visits", () => {
    const sqlite = readFileSync("drizzle/0018_warm_kinsey_walden.sql", "utf8");
    const postgres = readFileSync("drizzle-postgres/0012_cold_reptil.sql", "utf8");

    for (const migration of [sqlite, postgres]) {
      expect(migration).toContain("ops_site_visit_work_orders");
      expect(migration).toContain("site-visit-work-backfill-");
      expect(migration).toMatch(/organization_id[^\n]+id[^\n]+work_order_id/i);
      expect(migration).toMatch(/WHERE v\.[`"]work_order_id[`"] IS NOT NULL/);
      expect(migration).toContain("parts_required");
      expect(migration).toContain("crew_count");
      expect(migration).toContain("additional_technician_names_json");
    }

    expect(sqlite).toContain("NULL, 1, '[]', NULL, NULL");
    expect(postgres).toContain('DROP CONSTRAINT "chk_ops_visits_work_or_reason"');
  });

  it("loads one shared presence visit through each linked work-order detail", async () => {
    const repository = createNorthlineFixtureRepository();
    const [story, second] = await Promise.all([
      repository.getWorkOrderDetail({ organizationId: NORTHLINE_ORGANIZATION_ID }, "wo-northline-104"),
      repository.getWorkOrderDetail({ organizationId: NORTHLINE_ORGANIZATION_ID }, "wo-history-104-4"),
    ]);

    expect(story?.visits.find((visit) => visit.id === MULTI_VISIT_ID)).toMatchObject({
      workOrderId: "wo-northline-104",
      workOutcome: "completed",
      crewCount: 2,
      additionalTechnicianNames: ["Morgan Reed"],
    });
    expect(second?.visits.find((visit) => visit.id === MULTI_VISIT_ID)).toMatchObject({
      workOrderId: "wo-history-104-4",
      workOutcome: "completed",
    });

    const evidence = repository.snapshot().visitEvidence.filter((row) => row.visitId === MULTI_VISIT_ID);
    expect(evidence.filter((row) => row.kind === "check_in")).toHaveLength(1);
    expect(evidence.filter((row) => row.kind === "check_out")).toHaveLength(1);
  });
});
