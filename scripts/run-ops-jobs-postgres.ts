import { createOpsPostgresRepository } from "../lib/ops/postgres-repository";
import { runOutboxDeliveryCycle } from "../lib/ops/outbox-delivery";
import { createNotificationEmailTransport, emailRuntimeFromEnvironment } from "../lib/ops/email-delivery";
import { runPmRecurrenceCycle, runSlaEscalationCycle, runVendorComplianceCycle } from "../lib/ops/job-workers";
import { getPostgresPool } from "../lib/server/postgres-pool";

// Idempotent platform-job entry point for PostgreSQL runtimes (Render
// cron/worker context). Each invocation runs the transactional-outbox
// source-record cycles before outbox delivery, so notifications created by this
// invocation can be delivered without waiting for the next scheduled run. Safe to schedule
// repeatedly; concurrent invocations cannot double-claim messages or
// double-execute a job slot.

async function main() {
  const pool = await getPostgresPool();
  const repository = createOpsPostgresRepository(pool);
  const email = emailRuntimeFromEnvironment({ EMAIL_PROVIDER: process.env.EMAIL_PROVIDER, EMAIL_API_KEY: process.env.EMAIL_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM, EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL });
  const transport = createNotificationEmailTransport({ repository, provider: email.provider, baseUrl: email.baseUrl });
  const slaEscalation = await runSlaEscalationCycle({ repository });
  const pmRecurrence = await runPmRecurrenceCycle({ repository });
  const vendorCompliance = await runVendorComplianceCycle({ repository });
  const outbox = await runOutboxDeliveryCycle({ repository }, transport);
  console.log(JSON.stringify({ channel: "ops.jobs.cycle", runtime: "postgres", transport: transport.name, outbox, slaEscalation, pmRecurrence, vendorCompliance }));
}

try {
  await main();
} finally {
  const pool = await getPostgresPool();
  await pool.end?.();
}
