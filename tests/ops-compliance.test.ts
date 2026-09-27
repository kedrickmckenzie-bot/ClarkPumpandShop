import { afterAll,beforeAll,describe,it,vi } from "vitest";
import { DatabaseSync,type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import type { OpsSqlDriver,SqlRow } from "@/lib/ops/sql-driver";
import { complianceRegression } from "./helpers/compliance-regression";
vi.mock("server-only",()=>({}));
const fixture=buildNorthlinePresentationFixture();
const db=new DatabaseSync(":memory:");
const params=(values:readonly unknown[])=>values.map(value=>typeof value==="boolean"?Number(value):value??null) as SQLInputValue[];
const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(statement: {sql:string;params:readonly unknown[]}){return {rows:db.prepare(statement.sql).all(...params(statement.params)) as Row[],affectedRows:0};},async atomic(statements){db.exec("BEGIN");try{for(const statement of statements) db.prepare(statement.sql).run(...params(statement.params));db.exec("COMMIT");}catch(error){db.exec("ROLLBACK");throw error;}}};
beforeAll(()=>{db.exec("PRAGMA foreign_keys=ON");for(const file of readdirSync("drizzle").filter(file=>/^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`,"utf8"));for(const statement of buildOpsSeedStatements(fixture))db.prepare(statement.sql).run(...params(statement.params));});
afterAll(()=>db.close());

describe("custom compliance schedules",()=>{
 it("preserves recurrence, evidence review, corrective work and vendor issuance in memory",async()=>{await complianceRegression(createOpsFixtureRepository(fixture));},60000);
 it("preserves recurrence, evidence review, corrective work and vendor issuance in SQLite",async()=>{await complianceRegression(createOpsSqlRepository(driver,"d1"));},60000);
});
