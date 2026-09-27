import { afterAll,beforeAll,describe,expect,it,vi } from "vitest";
import { DatabaseSync,type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture,NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import type { OpsSqlDriver,SqlRow } from "@/lib/ops/sql-driver";
import { communicationRegression } from "./helpers/communication-regression";
import { buildVendorServiceReport } from "@/lib/ops/vendor-service-report";
import { verifyEmailSignature } from "@/lib/server/email-intake-ingress";
import { loadWorkCostPrompts } from "@/lib/ops/work-cost-prompts";
vi.mock("server-only",()=>({}));
const fixture=buildNorthlinePresentationFixture();
const db=new DatabaseSync(":memory:");
const params=(values:readonly unknown[])=>values.map(value=>typeof value==="boolean"?Number(value):value??null) as SQLInputValue[];
const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(statement: {sql:string;params:readonly unknown[]}){return {rows:db.prepare(statement.sql).all(...params(statement.params)) as Row[],affectedRows:0};},async atomic(statements){db.exec("BEGIN");try{for(const statement of statements) db.prepare(statement.sql).run(...params(statement.params));db.exec("COMMIT");}catch(error){db.exec("ROLLBACK");throw error;}}};
beforeAll(()=>{db.exec("PRAGMA foreign_keys=ON");for(const file of readdirSync("drizzle").filter(file=>/^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`,"utf8"));for(const statement of buildOpsSeedStatements(fixture))db.prepare(statement.sql).run(...params(statement.params));});
afterAll(()=>db.close());
describe("email and routine follow-ups",()=>{
  it("keeps fixture routing, attachments, replay and stale reminders coherent",async()=>{await communicationRegression(createOpsFixtureRepository(fixture));},30000);
  it("keeps SQL routing, attachments, replay and stale reminders coherent",async()=>{await communicationRegression(createOpsSqlRepository(driver,"d1"));},30000);
  it("rejects forged, stale and changed email deliveries",async()=>{
    const secret="test-only-secret-with-at-least-32-characters";const body='{"body":"hello"}';const stamp="1788264000";
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
    const sig=[...new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${stamp}.${body}`)))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
    expect(await verifyEmailSignature(body,stamp,sig,secret,Number(stamp)*1000)).toBe(true);
    expect(await verifyEmailSignature(body+"x",stamp,sig,secret,Number(stamp)*1000)).toBe(false);
    expect(await verifyEmailSignature(body,stamp,sig,secret,Number(stamp)*1000+301000)).toBe(false);
  });
});
describe("cost prompts and fair vendor evidence",()=>{
  it("has fixture/SQL prompt parity and enforces scope",async()=>{
    const memory=createOpsFixtureRepository(fixture);const sql=createOpsSqlRepository(driver,"d1");
    for(const work of fixture.workOrders.filter(row=>row.assetId).slice(0,6)) expect(await loadWorkCostPrompts(sql,{organizationId:NORTHLINE_ORGANIZATION_ID},work.id,fixture.asOf)).toEqual(await loadWorkCostPrompts(memory,{organizationId:NORTHLINE_ORGANIZATION_ID},work.id,fixture.asOf));
  });
  it("does not treat missing arrivals as late or repeated visits as callbacks",()=>{
    const vendor=fixture.vendors[0];const model=buildVendorServiceReport(fixture,vendor.organizationId,vendor.id,fixture.workOrders);
    expect(model.arrivals.observed).toBeLessThanOrEqual(model.arrivals.due);
    expect(model.arrivals.onTime).toBeLessThanOrEqual(model.arrivals.observed);
    expect(model.callbacks.work).toBeLessThanOrEqual(model.callbacks.verified);
    const empty=buildVendorServiceReport(fixture,"other",vendor.id,fixture.workOrders);
    expect(empty.followUps.total).toBe(0);expect(empty.evidence).toEqual([]);
  });
  it("shows missing cost coverage and withholds small-sample medians",()=>{
    const vendor=fixture.vendors[0];const model=buildVendorServiceReport(fixture,vendor.organizationId,vendor.id,fixture.workOrders);
    expect(model.evidence.length).toBeLessThanOrEqual(20);
    for(const cohort of model.cohorts) {expect(cohort.withCost).toBeLessThanOrEqual(cohort.count);if(cohort.withCost<5)expect(cohort.medianMinor).toBeNull();}
  });
});
