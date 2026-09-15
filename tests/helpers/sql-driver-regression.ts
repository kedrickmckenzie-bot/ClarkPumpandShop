import { expect } from "vitest";
import type { OpsRepository } from "@/lib/ops/repository";

/** Run against both migrated SQL engines, including returned-row mutation semantics. */
export async function sqlDriverRegression(repository: OpsRepository) {
  const organizationId = "org-northline-demo";
  const ownerMembershipId = "membership-northline-facilities";
  const now = "2026-08-25T18:00:00.000Z";
  await repository.putSavedView({ organizationId, ownerMembershipId, id: "driver-view", surface: "trends", name: "Driver check", queryString: "store=104", createdAt: now });
  expect(await repository.deleteSavedView("foreign-org", ownerMembershipId, "driver-view")).toBe(false);
  expect(await repository.deleteSavedView(organizationId, ownerMembershipId, "driver-view")).toBe(true);
  expect(await repository.deleteSavedView(organizationId, ownerMembershipId, "driver-view")).toBe(false);
  const job = { organizationId, jobRunId: "driver-job", jobType: "driver-check", slotKey: "one", startedAt: now };
  expect(await repository.tryBeginJobRun(job)).toBe(true);
  expect(await repository.tryBeginJobRun({ ...job, jobRunId: "driver-job-retry" })).toBe(false);
  await repository.atomicWrite([{ sql: "INSERT INTO ops_outbox_messages (id, organization_id, topic, aggregate_type, aggregate_id, payload_json, status, available_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params: ["driver-outbox", organizationId, "driver.check", "work_order", "wo-northline-104", "{}", "pending", now, now] }]);
  expect(await repository.claimOutboxMessage("foreign-org", "driver-outbox", now)).toBe(false);
  expect(await repository.claimOutboxMessage(organizationId, "driver-outbox", now)).toBe(true);
  expect(await repository.claimOutboxMessage(organizationId, "driver-outbox", now)).toBe(false);
}
