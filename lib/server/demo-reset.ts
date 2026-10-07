import "server-only";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { resetDemoTenant } from "@/lib/ops/reset-demo-tenant";
import { wipeD1DemoTenant, type D1ResetBinding } from "@/lib/ops/reset-demo-tenant-d1";
import { resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { seedOpsRepository } from "@/lib/ops/seed";
import { buildNorthlineCurrentSeedMarker } from "@/lib/ops/northline-seed-release";
import { OpsDomainError } from "@/lib/ops/errors";
import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { getPostgresPool } from "./postgres-pool";
import { getServerOpsRepository } from "./ops-repository-provider";
import { isFictionalPreview } from "./operator-access";

/**
 * "Reset demo data": replaces the fictional Clark Pump and Shop tenant with a fresh showcase dated from now,
 * so edge testing never leaves a pile of overdue work. Only in the fictional preview; a customer deployment
 * refuses it. Other tenants, the schema and stored uploads are untouched.
 */
export async function resetDemoData(now = new Date().toISOString()) {
  if (!isFictionalPreview()) throw new OpsDomainError("FORBIDDEN", "Demo reset is only available in the demo.");
  const repository = await getServerOpsRepository();
  if (repository.kind === "fixture") {
    resetNorthlineFixtureRepository();
    return { resetAt: now };
  }
  if (repository.kind === "postgres") {
    const pool = await getPostgresPool();
    const client = await pool.connect();
    try {
      // One transaction: if anything fails, the old demo stays exactly as it was.
      await resetDemoTenant(client, buildShowcaseFixture(now));
    } finally {
      client.release();
    }
    return { resetAt: now };
  }
  const binding = await (await import("@/db")).getD1Binding();
  if (!binding) throw new OpsDomainError("CONFLICT", "The demo database is not available.");
  // D1 cannot wipe and reseed in one transaction. The seed is conflict-safe and writes its marker last,
  // so if it stops partway the next start finishes seeding the demo.
  await wipeD1DemoTenant(binding as unknown as D1ResetBinding);
  await seedOpsRepository(createOpsD1Repository(binding), buildShowcaseFixture(now), [buildNorthlineCurrentSeedMarker()]);
  return { resetAt: now };
}
