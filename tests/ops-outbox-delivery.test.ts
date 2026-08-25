import { describe, expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import {
  NORTHLINE_ORGANIZATION_ID,
  buildNorthlinePresentationFixture,
} from "@/lib/ops/fixtures";
import type { OpsFixture } from "@/lib/ops/types";
import type { OpsRepository } from "@/lib/ops/repository";
import {
  createOperationalLogDeliveryTransport,
  runOutboxDeliveryCycle,
  type OutboxDeliveryMessage,
  type OutboxDeliveryTransport,
} from "@/lib/ops/outbox-delivery";

const BASE_NOW = "2026-09-01T12:00:00.000Z";

function outboxHarness(overrides?: (fixture: OpsFixture) => void, startNow = BASE_NOW) {
  const fixture = buildNorthlinePresentationFixture();
  overrides?.(fixture);
  // Keep the queue small and deterministic: the seeded presentation fixture
  // carries hundreds of pending messages, which is irrelevant to these tests.
  fixture.outboxMessages = fixture.outboxMessages.slice(0, 8);
  const repository = createOpsFixtureRepository(fixture);
  let current = startNow;
  return {
    repository,
    services: { repository, clock: { now: () => current } },
    setNow(value: string) {
      current = value;
    },
  };
}

function snapshot(repository: ReturnType<typeof createOpsFixtureRepository>) {
  return repository.snapshot();
}

function transportRecording(delivered: OutboxDeliveryMessage[], failures: Map<string, number> = new Map()): OutboxDeliveryTransport {
  return {
    name: "test-transport",
    async deliver(message) {
      const remainingFailures = failures.get(message.id) ?? 0;
      if (remainingFailures > 0) {
        failures.set(message.id, remainingFailures - 1);
        throw new Error("simulated transport failure");
      }
      delivered.push(message);
    },
  };
}

describe("transactional outbox delivery worker", () => {
  it("delivers every due pending message exactly once and settles it atomically", async () => {
    const harness = outboxHarness();
    const delivered: OutboxDeliveryMessage[] = [];
    const lines: string[] = [];
    const pendingBefore = snapshot(harness.repository).outboxMessages.filter((row) => row.status === "pending");
    expect(pendingBefore.length).toBeGreaterThan(0);

    const logTransport = createOperationalLogDeliveryTransport((line) => lines.push(line));
    const summary = await runOutboxDeliveryCycle(harness.services, logTransport);

    expect(summary.recoveredStaleCount).toBe(0);
    expect(summary.consideredCount).toBe(pendingBefore.length);
    expect(summary.deliveredCount).toBe(pendingBefore.length);
    expect(summary.retryScheduledCount + summary.failedPermanentlyCount + summary.skippedCount).toBe(0);
    expect(lines).toHaveLength(pendingBefore.length);
    const firstLine = JSON.parse(lines[0]!) as { channel: string };
    expect(firstLine.channel).toBe("ops.outbox.delivery");

    const after = snapshot(harness.repository).outboxMessages;
    for (const message of pendingBefore) {
      const settled = after.find((row) => row.id === message.id)!;
      expect(settled.status).toBe("delivered");
      expect(settled.deliveredAt).toBeTruthy();
      expect(settled.organizationId).toBe(message.organizationId);
      expect(settled.topic).toBe(message.topic);
      expect(settled.payloadJson).toBe(message.payloadJson);
      expect(settled.attemptCount).toBe(1);
    }

    const rerun = await runOutboxDeliveryCycle(harness.services, transportRecording(delivered));
    expect(rerun.consideredCount).toBe(0);
    expect(rerun.deliveredCount).toBe(0);
  });

  it("schedules exponential-backoff retries and delivers after the backoff window", async () => {
    const harness = outboxHarness();
    const target = snapshot(harness.repository).outboxMessages.find((row) => row.status === "pending")!;
    const delivered: OutboxDeliveryMessage[] = [];
    const failures = new Map([[target.id, 2]]);

    await runOutboxDeliveryCycle(harness.services, transportRecording(delivered, failures), { baseRetryDelaySeconds: 60 });
    expect(delivered.map((message) => message.id)).not.toContain(target.id);
    let state = snapshot(harness.repository).outboxMessages.find((row) => row.id === target.id)!;
    expect(state.status).toBe("pending");
    expect(state.attemptCount).toBe(1);
    expect(state.lastError).toBe("simulated transport failure");
    expect(state.claimedAt ?? null).toBeNull();
    expect(state.availableAt).toBe("2026-09-01T12:01:00.000Z");

    // Before the retry window opens the message is not considered again.
    const early = await runOutboxDeliveryCycle(harness.services, transportRecording(delivered, failures), { baseRetryDelaySeconds: 60 });
    state = snapshot(harness.repository).outboxMessages.find((row) => row.id === target.id)!;
    expect(state.attemptCount).toBe(1);
    expect(early.consideredCount).toBe(0);

    // After the window opens the second attempt fails and doubles the delay.
    harness.setNow("2026-09-01T12:01:01.000Z");
    await runOutboxDeliveryCycle(harness.services, transportRecording(delivered, failures), { baseRetryDelaySeconds: 60 });
    state = snapshot(harness.repository).outboxMessages.find((row) => row.id === target.id)!;
    expect(state.attemptCount).toBe(2);
    expect(state.status).toBe("pending");
    expect(state.availableAt).toBe("2026-09-01T12:03:01.000Z");

    // The third attempt succeeds.
    harness.setNow("2026-09-01T12:03:02.000Z");
    const third = await runOutboxDeliveryCycle(harness.services, transportRecording(delivered, failures), { baseRetryDelaySeconds: 60 });
    expect(third.deliveredCount).toBe(1);
    state = snapshot(harness.repository).outboxMessages.find((row) => row.id === target.id)!;
    expect(state.status).toBe("delivered");
    expect(state.attemptCount).toBe(3);
    // The prior attempt's error is retained for forensics after success.
    expect(state.deliveredAt).toBeTruthy();
    expect(state.lastError).toBe("simulated transport failure");
    expect(delivered.filter((message) => message.id === target.id)).toHaveLength(1);
  });

  it("marks a message permanently failed after maxAttempts and never reclaims it", async () => {
    const harness = outboxHarness();
    const pendingCount = snapshot(harness.repository).outboxMessages.filter((row) => row.status === "pending").length;
    const target = snapshot(harness.repository).outboxMessages.find((row) => row.status === "pending")!;
    const alwaysFails: OutboxDeliveryTransport = {
      name: "always-fails",
      async deliver() {
        throw new Error("destination unavailable");
      },
    };

    await runOutboxDeliveryCycle(harness.services, alwaysFails, { maxAttempts: 2, baseRetryDelaySeconds: 30 });
    harness.setNow("2026-09-01T13:00:00.000Z");
    const second = await runOutboxDeliveryCycle(harness.services, alwaysFails, { maxAttempts: 2, baseRetryDelaySeconds: 30 });

    expect(second.failedPermanentlyCount).toBe(pendingCount);
    let state = snapshot(harness.repository).outboxMessages.find((row) => row.id === target.id)!;
    expect(state.status).toBe("failed");
    expect(state.attemptCount).toBe(2);
    expect(state.lastError).toBe("destination unavailable");
    expect(state.claimedAt ?? null).toBeNull();

    const third = await runOutboxDeliveryCycle(harness.services, alwaysFails, { maxAttempts: 2 });
    expect(third.consideredCount).toBe(0);
    state = snapshot(harness.repository).outboxMessages.find((row) => row.id === target.id)!;
    expect(state.status).toBe("failed");
    expect(state.attemptCount).toBe(2);
  });

  it("recovers abandoned processing leases but leaves fresh leases untouched", async () => {
    const staleClaimedAt = "2026-09-01T10:00:00.000Z"; // more than staleProcessingSeconds old
    const freshClaimedAt = BASE_NOW;
    let staleId = "";
    let freshId = "";
    const harness = outboxHarness((fixture) => {
      const candidates = fixture.outboxMessages.filter((row) => row.status === "pending");
      const [stale, fresh] = candidates;
      if (!stale || !fresh) throw new Error("fixture needs at least two pending messages");
      Object.assign(stale, { status: "processing", claimedAt: staleClaimedAt, attemptCount: 5 });
      Object.assign(fresh, { status: "processing", claimedAt: freshClaimedAt, attemptCount: 5 });
      staleId = stale.id;
      freshId = fresh.id;
    });

    const summary = await runOutboxDeliveryCycle(harness.services, transportRecording([]), { staleProcessingSeconds: 900 });
    expect(summary.recoveredStaleCount).toBe(1);
    // The recovered message is requeued and delivered within the same cycle.
    expect(summary.deliveredCount).toBeGreaterThanOrEqual(1);

    const after = snapshot(harness.repository).outboxMessages;
    const freshRow = after.find((row) => row.id === freshId)!;
    expect(freshRow.status).toBe("processing");
    expect(freshRow.claimedAt).toBe(freshClaimedAt);
    expect(freshRow.attemptCount).toBe(5);
    const staleRow = after.find((row) => row.id === staleId)!;
    expect(staleRow.status).toBe("delivered");
    // Recovery requeued the message, then the same cycle claimed it again.
    expect(staleRow.attemptCount).toBe(6);
    expect(staleRow.lastError).toBe("delivery lease expired before settlement; requeued");
  });

  it("counts a message as skipped when another worker wins the claim race", async () => {
    const harness = outboxHarness();
    const target = snapshot(harness.repository).outboxMessages.find((row) => row.status === "pending")!;
    const guardedRepository = Object.create(harness.repository) as OpsRepository;
    guardedRepository.claimOutboxMessage = async (organizationId: string, id: string) => {
      if (id === target.id) return false;
      return harness.repository.claimOutboxMessage(organizationId, id, BASE_NOW);
    };

    const summary = await runOutboxDeliveryCycle({ repository: guardedRepository, clock: harness.services.clock }, transportRecording([]));
    expect(summary.skippedCount).toBe(1);
    const state = snapshot(harness.repository).outboxMessages.find((row) => row.id === target.id)!;
    expect(state.status).toBe("pending");
    expect(state.attemptCount ?? 0).toBe(0);
    expect(NORTHLINE_ORGANIZATION_ID).toBe(target.organizationId);
  });

  it("is a no-op when no messages are due yet", async () => {
    const harness = outboxHarness(undefined, "2020-01-01T00:00:00.000Z");
    const before = snapshot(harness.repository);
    const summary = await runOutboxDeliveryCycle(harness.services, transportRecording([]));
    expect(summary).toEqual({
      recoveredStaleCount: 0,
      consideredCount: 0,
      deliveredCount: 0,
      retryScheduledCount: 0,
      failedPermanentlyCount: 0,
      skippedCount: 0,
    });
    expect(snapshot(harness.repository).outboxMessages).toEqual(before.outboxMessages);
  });
});

