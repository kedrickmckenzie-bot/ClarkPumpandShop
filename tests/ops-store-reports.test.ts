import { afterAll,beforeAll,describe,it,vi,expect } from "vitest";
import { DatabaseSync,type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import type { OpsSqlDriver,SqlRow } from "@/lib/ops/sql-driver";
import {matchesRequestStatus} from "@/lib/ops/dashboard-cohorts";
vi.mock("server-only",()=>({}));
const fixture=buildNorthlinePresentationFixture();
const template=fixture.requests.find(r=>r.storeId==='store-northline-104'&&r.status==='under_review')!;
for(const [index,status] of ['submitted','under_review','acknowledged','closed','converted','acknowledged','submitted'].entries())fixture.requests.push({...template,id:`report-queue-test-${index}`,reference:`TEST-${index}`,status:status as typeof template.status,linkedWorkOrderId:index===5?fixture.workOrders.find(w=>w.storeId===template.storeId)!.id:undefined,acknowledgedAt:template.submittedAt,acknowledgedByActorName:"Test manager",convertedWorkOrderId:[4,6].includes(index)?fixture.workOrders.find(w=>w.storeId===template.storeId)!.id:undefined});
for(const request of fixture.requests.filter(r=>r.id.startsWith('report-queue-test-')))for(const assessment of fixture.requestImpactAssessments.filter(a=>a.requestId===template.id))fixture.requestImpactAssessments.push({...assessment,id:`${request.id}-${assessment.id}`,requestId:request.id});
const db=new DatabaseSync(":memory:");
const params=(values:readonly unknown[])=>values.map(value=>typeof value==="boolean"?Number(value):value??null) as SQLInputValue[];
const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(statement: {sql:string;params:readonly unknown[]}){return {rows:db.prepare(statement.sql).all(...params(statement.params)) as Row[],affectedRows:0};},async atomic(statements){db.exec("BEGIN");try{for(const statement of statements) db.prepare(statement.sql).run(...params(statement.params));db.exec("COMMIT");}catch(error){db.exec("ROLLBACK");throw error;}}};
beforeAll(()=>{db.exec("PRAGMA foreign_keys=ON");for(const file of readdirSync("drizzle").filter(file=>/^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`,"utf8"));for(const statement of buildOpsSeedStatements(fixture))db.prepare(statement.sql).run(...params(statement.params));});
afterAll(()=>db.close());

describe("store open reports",()=>{
 for(const mode of ["fixture","sql"] as const)it(`counts and filters open unlinked reports in ${mode}`,async()=>{
  const r=mode==='fixture'?createOpsFixtureRepository(fixture):createOpsSqlRepository(driver,"d1");
  const scope={organizationId:fixture.organizations[0].id,storeIds:['store-northline-104']};
  const expected=fixture.requests.filter(r=>r.storeId==='store-northline-104'&&matchesRequestStatus(r,'open_unlinked'));
  const page=await r.listRequests(scope,{status:'open_unlinked',storeId:'store-northline-104',limit:1});
  expect(page.totalCount).toBe(expected.length);expect(page.items).toHaveLength(1);expect(page.nextCursor).toBeTruthy();
  const next=await r.listRequests(scope,{status:'open_unlinked',cursor:page.nextCursor,limit:1});expect(next.totalCount).toBe(expected.length);expect(next.items[0].id).not.toBe(page.items[0].id);
  const all=await r.listRequests(scope,{status:'open_unlinked',limit:50});expect(all.items.map(r=>r.id).sort()).toEqual(expected.map(r=>r.id).sort());
  expect((await r.listRequests({...scope,storeIds:[]},{status:'open_unlinked'})).totalCount).toBe(0);
  expect((await r.listRequests({organizationId:'another-org'},{status:'open_unlinked'})).totalCount).toBe(0);
 },60000);
});
