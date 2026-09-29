import {afterAll,beforeAll,describe,it,expect} from "vitest";
import {readFile,readdir} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {assertDemoTenantReset,resetDemoTenant} from "@/lib/ops/reset-demo-tenant";
import type {PostgresClientLike,PostgresQueryResult} from "@/lib/ops/postgres-repository";
let db:PGlite;
const client:PostgresClientLike={async query<Row extends Record<string,unknown>>(sql:string,values:readonly unknown[]=[]):Promise<PostgresQueryResult<Row>>{const result=await db.query<Row>(sql,[...values]);return {rows:result.rows,rowCount:result.affectedRows??result.rows.length};},release(){}};
beforeAll(async()=>{db=new PGlite();const files=(await readdir("drizzle-postgres")).filter(f=>/^\d.*\.sql$/.test(f)).sort();await db.transaction(async tx=>{for(const file of files)for(const sql of (await readFile(`drizzle-postgres/${file}`,"utf8")).split("--> statement-breakpoint"))if(sql.trim()&&!/pg_trgm|gin_trgm_ops/i.test(sql))await tx.exec(sql);});},120000);
afterAll(async()=>{await db?.close();});
describe("bounded demo reset",()=>{
 it("requires exact demo intent",()=>{
  expect(()=>assertDemoTenantReset({OPS_ENVIRONMENT:"production",OPS_RESET_TENANT_CONFIRM:"org-northline-demo"})).toThrow();
  expect(()=>assertDemoTenantReset({OPS_ENVIRONMENT:"demo"})).toThrow();
  expect(()=>assertDemoTenantReset({OPS_ENVIRONMENT:"demo",OPS_RESET_TENANT_CONFIRM:"org-northline-demo"})).not.toThrow();
 });
 it("replaces the demo atomically and retains another tenant",async()=>{
  const fixture=buildShowcaseFixture("2026-09-29");
  await resetDemoTenant(client,fixture);
  await db.exec("INSERT INTO ops_organizations SELECT 'other-tenant', 'Other tenant', 'other-tenant', time_zone, work_order_prefix, created_at FROM ops_organizations LIMIT 1");
  await db.exec("INSERT INTO ops_audit_events (id,organization_id,aggregate_type,aggregate_id,event_type,actor_type,actor_name,occurred_at,payload_json) VALUES ('other-audit','other-tenant','organization','other-tenant','test','system','Test',CURRENT_TIMESTAMP,'{}')");
  await db.query("UPDATE ops_store_tasks SET title='old demo edit' WHERE id=$1",[fixture.storeTasks![0].id]);
  await resetDemoTenant(client,buildShowcaseFixture("2026-10-29"));
  expect((await db.query("SELECT id FROM ops_organizations WHERE id='other-tenant'")).rows).toHaveLength(1);
  expect((await db.query("SELECT id FROM ops_audit_events WHERE organization_id='other-tenant'")).rows).toHaveLength(1);
  expect((await db.query("SELECT id FROM ops_store_tasks WHERE title='old demo edit'")).rows).toHaveLength(0);
  expect((await db.query("SELECT id FROM ops_store_tasks")).rows).toHaveLength(5);
  const broken=buildShowcaseFixture("2026-11-29");broken.storeTasks![0].requesterId='missing-member';
  await expect(resetDemoTenant(client,broken)).rejects.toThrow();
  expect((await db.query<{due_at:string}>("SELECT due_at FROM ops_store_tasks WHERE id=$1",[fixture.storeTasks![0].id])).rows[0].due_at).toContain("2026-10-30");
 },240000);
});
