import { beforeEach, describe, expect, it } from "vitest";
import {
  PUBLIC_DEMO_LINKS,
  getPublicOperationsGateway,
} from "@/components/ops-public/server-gateway";
import {
  getNorthlineFixtureRepository,
  resetNorthlineFixtureRepository,
} from "@/lib/ops/fixture-repository";

describe("public store issue business-impact intake", () => {
  beforeEach(() => {
    resetNorthlineFixtureRepository();
  });

  it("persists the plain-language operating facts with the request, review task, and audit trail", async () => {
    const repository = getNorthlineFixtureRepository();
    const before = repository.snapshot();

    const receipt = await getPublicOperationsGateway().reportStoreIssue(
      PUBLIC_DEMO_LINKS.storeToken,
      {
        submissionKey: "public-store-impact-report-0001",
        reporterName: "Avery Clerk",
        employeeId: "NFM-4102",
        problem: "The beer cave is warming and the evaporator fan is grinding.",
        urgency: "priority",
        area: "Beer cave",
        impact: {
          storeOperatingState: "partially_operational",
          safetyConcern: "none_reported",
          productInventoryRisk: "at_risk",
          customersAffected: "yes",
        },
        evidence: [],
      },
    );

    const after = repository.snapshot();
    const request = after.requests.find((candidate) => candidate.reference === receipt.requestNumber)!;
    const assessment = after.requestImpactAssessments.find((candidate) => candidate.requestId === request.id)!;
    const reviewTask = after.workflowTasks.find((candidate) => candidate.serviceRequestId === request.id)!;

    expect(request).toMatchObject({
      storeId: "store-northline-104",
      status: "submitted",
      priority: "urgent",
    });
    expect(assessment).toMatchObject({
      requestId: request.id,
      assessmentKind: "initial_report",
      storeOperatingState: "partially_operational",
      safetyConcern: "none_reported",
      productInventoryRisk: "at_risk",
      customersAffected: "yes",
      complianceImpact: "unknown",
      redundantEquipment: "unknown",
      confidence: "low",
      source: "store_report",
    });
    expect(assessment.notes).toContain("not verified losses");
    expect(reviewTask).toMatchObject({
      taskType: "review_issue",
      status: "open",
      requiredForProgress: true,
      serviceRequestId: request.id,
    });
    expect(after.auditEvents.filter((event) => event.aggregateId === request.id).map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["request.submitted", "request.impact_assessed"]),
    );
    expect(after.requests).toHaveLength(before.requests.length + 1);
    expect(after.requestImpactAssessments).toHaveLength(before.requestImpactAssessments.length + 1);
  });
});
