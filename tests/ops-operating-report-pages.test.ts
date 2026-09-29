import {it,expect} from "vitest";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {buildNorthlinePresentationFixture} from "@/lib/ops/fixtures";
import {buildOpsSeedStatements} from "@/lib/ops/seed";
import {operatingRisksFromFixture,queryOperatingRisks} from "@/lib/ops/operating-risks";
import type {OpsSqlDriver,SqlRow} from "@/lib/ops/sql-driver";
it("counts beyond the preview and pages every matching report without duplicates in scoped SQL and fixture queries",async()=>{
 const f=buildNorthlinePresentationFixture(),scope={organizationId:f.organizations[0].id};
 const risk=operatingRisksFromFixture(f,scope).items[0],source=f.requests.find(r=>r.id===risk.id)!,assessment=f.requestImpactAssessments.find(a=>a.requestId===source.id)!;
 for(let i=0;i<31;i++){const id=`risk-page-${i}`;f.requests.push({...source,status:"submitted",id,reference:`RISK-${i}`});f.requestImpactAssessments.push({...assessment,id:`impact-${id}`,requestId:id,storeOperatingState:"partially_operational"});}
 const db=new DatabaseSync(":memory:");
 const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(s:{sql:string;params:readonly unknown[]}){return {rows:db.prepare(s.sql).all(...s.params as SQLInputValue[]) as Row[],affectedRows:0};},async atomic(){throw new Error("read only");}};
 try{
 for(const file of readdirSync("drizzle").filter(n=>/^\d.*\.sql$/.test(n)).sort())db.exec(readFileSync(`drizzle/${file}`,"utf8"));
 for(const s of buildOpsSeedStatements(f))db.prepare(s.sql).run(...s.params.map(v=>typeof v==="boolean"?Number(v):v??null) as SQLInputValue[]);
 const preview=await queryOperatingRisks(driver,scope);expect(preview.items).toHaveLength(3);expect(preview.totalCount).toBeGreaterThan(31);expect(preview).toEqual(operatingRisksFromFixture(f,scope));
 const ids:string[]=[];
 for(let offset=0;offset<preview.totalCount;offset+=25){const page=await queryOperatingRisks(driver,scope,{limit:25,offset});expect(page).toEqual(operatingRisksFromFixture(f,scope,{limit:25,offset}));ids.push(...page.items.map(r=>r.id));}
 expect(new Set(ids).size).toBe(preview.totalCount);
 expect(await queryOperatingRisks(driver,scope,{limit:25,offset:1000})).toEqual({items:[],totalCount:preview.totalCount});
 for(const scoped of [{...scope,storeIds:[]},{organizationId:"foreign"},{...scope,storeIds:[source.storeId]}])expect(await queryOperatingRisks(driver,scoped)).toEqual(operatingRisksFromFixture(f,scoped));
 }finally{db.close();}
});
