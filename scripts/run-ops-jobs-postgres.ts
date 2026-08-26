import { createOpsPostgresRepository } from "../lib/ops/postgres-repository";
import { runOutboxDeliveryCycle } from "../lib/ops/outbox-delivery";
import { createNotificationEmailTransport, emailRuntimeFromEnvironment } from "../lib/ops/email-delivery";
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
  const email = emailRuntimeFromEnvironment({ EMAIL_PROVIDER: process.env.EMAIL_PROVIDER, EMAIL_API_KEY: process.env.EMAIL_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM, EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL });
  const transport = createNotificationEmailTransport({ repository, provider: email.provider, baseUrl: email.baseUrl });
  const outbox = await runOutboxDeliveryCycle({ repository }, transport);
  const slaEscalation = await runSlaEscalationCycle({ repository });
  const pmRecurrence = await runPmRecurrenceCycle({ repository });
  console.log(JSON.stringify({ channel: "ops.jobs.cycle", runtime: "postgres", transport: transport.name, outbox, slaEscalation, pmRecurrence }));
}

try {
  await main();
} finally {
  const pool = await getPostgresPool();
  await pool.end?.();
}
