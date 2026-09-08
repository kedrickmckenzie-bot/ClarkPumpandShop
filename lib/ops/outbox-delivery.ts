import type { OpsRepository } from "./repository";
import type { IsoDateTime, OpsId } from "./types";

/**
 * Transactional-outbox delivery worker.
 *
 * Domain commands already persist outbox intent inside the same transaction
 * as their state change. This module owns the other half of the pattern: a
 * repeatable, idempotent cycle that recovers abandoned leases, claims due
 * messages, hands them to an injected transport, and records the outcome
 * (delivered, retry with exponential backoff, or terminal failure).
 *
 * Transport contract: `deliver` must be idempotent per message id, because
 * two concurrent workers can race between claim and settlement and deliver
 * the same message twice (at-least-once semantics).
 */

export interface OutboxDeliveryClock {
  now(): IsoDateTime;
}

export interface OutboxDeliveryServices {
  repository: OpsRepository;
  clock?: OutboxDeliveryClock;
}

export interface OutboxDeliveryMessage {
  organizationId: OpsId;
  id: OpsId;
  topic: string;
  aggregateType: string;
  aggregateId: OpsId;
  payloadJson: string;
  attemptCount: number;
}

export interface OutboxDeliveryTransport {
  /** Stable transport name for operational logs. */
  readonly name: string;
  /** Idempotent per message id; at-least-once delivery is possible. */
  deliver(message: OutboxDeliveryMessage): Promise<void>;
}

export interface OutboxDeliveryOptions {
  /** Maximum messages claimed per cycle (1–100). */
  limit?: number;
  /** Delivery attempts before a message is marked permanently failed. */
  maxAttempts?: number;
  /** First retry delay; doubles per attempt up to `maxRetryDelaySeconds`. */
  baseRetryDelaySeconds?: number;
  maxRetryDelaySeconds?: number;
  /** Processing leases older than this are treated as abandoned. */
  staleProcessingSeconds?: number;
}

export interface OutboxDeliveryCycleSummary {
  recoveredStaleCount: number;
  consideredCount: number;
  deliveredCount: number;
  retryScheduledCount: number;
  failedPermanentlyCount: number;
  skippedCount: number;
}

const defaultClock: OutboxDeliveryClock = { now: () => new Date().toISOString() };

function clampOption(value: number | undefined, fallback: number) {
  const parsed = value ?? fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(1_000_000, Math.floor(parsed)));
}

/**
 * Honest default transport: the message is delivered to the structured
 * operational log. No external email/SMS/vendor-notification channel exists
 * yet; when one is added it must be a separate named transport that is
 * idempotent per message id.
 */
export function createOperationalLogDeliveryTransport(sink?: (line: string) => void): OutboxDeliveryTransport {
  const write = sink ?? ((line: string) => console.log(line));
  return {
    name: "operational-log",
    async deliver(message) {
      write(JSON.stringify({
        channel: "ops.outbox.delivery",
        transport: "operational-log",
        organizationId: message.organizationId,
        messageId: message.id,
        topic: message.topic,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        attempt: message.attemptCount,
        payload: JSON.parse(message.payloadJson) as unknown,
      }));
    },
  };
}

export async function runOutboxDeliveryCycle(
  services: OutboxDeliveryServices,
  transport: OutboxDeliveryTransport,
  options: OutboxDeliveryOptions = {},
): Promise<OutboxDeliveryCycleSummary> {
  const repository = services.repository;
  const clock = services.clock ?? defaultClock;
  const now = clock.now();
  const limit = clampOption(options.limit, 25);
  const maxAttempts = clampOption(options.maxAttempts, 8);
  const baseRetryDelaySeconds = clampOption(options.baseRetryDelaySeconds, 60);
  const maxRetryDelaySeconds = clampOption(options.maxRetryDelaySeconds, 3600);
  const staleProcessingSeconds = clampOption(options.staleProcessingSeconds, 900);

  const summary: OutboxDeliveryCycleSummary = {
    recoveredStaleCount: 0,
    consideredCount: 0,
    deliveredCount: 0,
    retryScheduledCount: 0,
    failedPermanentlyCount: 0,
    skippedCount: 0,
  };

  // 1. Recover leases abandoned by a crashed or partitioned worker so the
  // messages become claimable again instead of staying stuck in processing.
  const staleBefore = new Date(Date.parse(now) - staleProcessingSeconds * 1000).toISOString();
  const stale = await repository.listStaleProcessingOutboxMessages(staleBefore, limit);
  for (const message of stale) {
    await repository.recordOutboxDeliveryOutcome({
      outcome: "retry",
      organizationId: message.organizationId,
      id: message.id,
      retryAt: now,
      lastError: "delivery lease expired before settlement; requeued",
    });
    summary.recoveredStaleCount += 1;
  }

  // 2. Claim and deliver due messages one at a time. The conditional claim
  // makes concurrent cycles safe; a lost race is counted as skipped.
  const due = await repository.listDueOutboxMessages(now, limit);
  summary.consideredCount = due.length;
  for (const candidate of due) {
    const claimed = await repository.claimOutboxMessage(candidate.organizationId, candidate.id, now);
    if (!claimed) {
      summary.skippedCount += 1;
      continue;
    }
    const attemptCount = (candidate.attemptCount ?? 0) + 1;
    try {
      await transport.deliver({
        organizationId: candidate.organizationId,
        id: candidate.id,
        topic: candidate.topic,
        aggregateType: candidate.aggregateType,
        aggregateId: candidate.aggregateId,
        payloadJson: candidate.payloadJson,
        attemptCount,
      });
      await repository.recordOutboxDeliveryOutcome({
        outcome: "delivered",
        organizationId: candidate.organizationId,
        id: candidate.id,
        deliveredAt: clock.now(),
      });
      summary.deliveredCount += 1;
    } catch (error) {
      const lastError = error instanceof Error ? error.message : String(error);
      if (attemptCount >= maxAttempts) {
        await repository.recordOutboxDeliveryOutcome({
          outcome: "failed",
          organizationId: candidate.organizationId,
          id: candidate.id,
          lastError,
        });
        summary.failedPermanentlyCount += 1;
        continue;
      }
      const backoffExponent = Math.min(attemptCount - 1, 16);
      const delaySeconds = Math.min(baseRetryDelaySeconds * 2 ** backoffExponent, maxRetryDelaySeconds);
      await repository.recordOutboxDeliveryOutcome({
        outcome: "retry",
        organizationId: candidate.organizationId,
        id: candidate.id,
        retryAt: new Date(Date.parse(now) + delaySeconds * 1000).toISOString(),
        lastError,
      });
      summary.retryScheduledCount += 1;
    }
  }

  return summary;
}
