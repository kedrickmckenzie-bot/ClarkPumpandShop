import { createOpsPostgresRepository } from "../lib/ops/postgres-repository";
import {
  createOperationalLogDeliveryTransport,
  runOutboxDeliveryCycle,
} from "../lib/ops/outbox-delivery";
import { runPmRecurrenceCycle, runSlaEscalationCycle } from "../lib/ops/job-workers";
import { getPostgresPool } from "../lib/server/postgres-pool";

// Idempotent platform-job entry point for PostgreSQL runtimes (Render
// cron/worker context). Each invocation runs the transactional-outbox
// delivery cycle followed by the SLA escalation cycle. Safe to schedule
// repeatedly; concurrent invocations cannot double-claim messages or
// double-execute a job slot.

async function main() {
  const pool = await getPostgresPool();
  const repository = createOpsPostgresRepository(pool);
  const outbox = await runOutboxDeliveryCycle({ repository }, createOperationalLogDeliveryTransport());
  const slaEscalation = await runSlaEscalationCycle({ repository });
  const pmRecurrence = await runPmRecurrenceCycle({ repository });
  console.log(JSON.stringify({ channel: "ops.jobs.cycle", runtime: "postgres", transport: "operational-log", outbox, slaEscalation, pmRecurrence }));
}

try {
  await main();
} finally {
  const pool = await getPostgresPool();
  await pool.end?.();
}
