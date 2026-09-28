import { DatabaseSync,type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { expect,it } from "vitest";
import { createOpsSqlRepository } from "@/lib/ops/sql-repository";
import type { OpsSqlDriver,SqlRow } from "@/lib/ops/sql-driver";
import type { OpsStatement } from "@/lib/ops/repository";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { invoiceUploadRegression } from "./helpers/invoice-upload-regression";
it("retains original invoice files and review transitions in foreign-key-enforced SQLite",async()=>{
 const db=new DatabaseSync(":memory:");db.exec("PRAGMA foreign_keys=ON");
 const values=(s:OpsStatement)=>s.params.map(v=>v==null?null:typeof v==="boolean"?Number(v):v as SQLInputValue);
 const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(s:OpsStatement){return {rows:db.prepare(s.sql).all(...values(s)) as Row[],affectedRows:0};},async atomic(statements){db.exec("BEGIN");try{for(const s of statements)db.prepare(s.sql).run(...values(s));db.exec("COMMIT");}catch(e){db.exec("ROLLBACK");throw e;}}};
 try{for(const name of readdirSync("drizzle").filter(n=>/^\d.*\.sql$/.test(n)).sort())db.exec(readFileSync(`drizzle/${name}`,"utf8"));await driver.atomic(buildOpsSeedStatements(buildNorthlinePresentationFixture()));await invoiceUploadRegression(createOpsSqlRepository(driver,"d1"));expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);}finally{db.close();}
},60000);
