import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { createOpsD1Repository } from "@/lib/ops/d1-repository";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";

it("loads the hosted dashboard within actual D1 query limits", async () => {
  const runtime = new Miniflare({ modules: true, script: "export default {fetch() {return new Response('ok')}}", d1Databases: ["DB"] });
  try {
    const db = await runtime.getD1Database("DB");
    for (const file of readdirSync("drizzle").filter(file => /^\d.*\.sql$/.test(file)).sort()) {
      for (const sql of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint").map(sql => sql.trim()).filter(Boolean)) await db.prepare(sql).run();
    }
    const fixture = buildNorthlinePresentationFixture();
    const statements = buildOpsSeedStatements(fixture);
    for (let offset = 0; offset < statements.length; offset += 100) {
      await db.batch(statements.slice(offset, offset + 100).map(({sql, params}) => db.prepare(sql).bind(...params.map(value => typeof value === "boolean" ? Number(value) : value ?? null))));
    }
    const repository = createOpsD1Repository(db as unknown as D1Database);
    const reference = createOpsFixtureRepository(fixture);
    const scope = { organizationId: fixture.organizations[0].id };
    const access = { role: "facilities_admin" as const, canOpenWarranty: true, canOpenRequest: true };
    for (const scoped of [scope, {...scope, storeIds:[fixture.stores[0].id]}, {organizationId:"another-tenant"}]) {
      expect(await repository.listAttention(scoped, access, {asOf:fixture.asOf, limit:7})).toEqual(await reference.listAttention(scoped, access, {asOf:fixture.asOf, limit:7}));
      expect(await repository.getDashboardLifecycle(scoped, fixture.asOf)).toEqual(await reference.getDashboardLifecycle(scoped, fixture.asOf));
    }
  } finally { await runtime.dispose(); }
}, 120_000);
