import {it,expect} from "vitest";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
import {buildNorthlinePresentationFixture} from "@/lib/ops/fixtures";
import {buildOpsSeedStatements} from "@/lib/ops/seed";
import {upcomingAppointmentsFromFixture,queryUpcomingAppointments} from "@/lib/ops/upcoming-appointments";
import type {OpsSqlDriver,SqlRow} from "@/lib/ops/sql-driver";
it("lists the same future appointments as the dashboard, with scoped search and stable pagination",async()=>{
 const f=buildNorthlinePresentationFixture(),scope={organizationId:f.organizations[0].id},now=f.asOf;
 const base=upcomingAppointmentsFromFixture(f,scope,{now,limit:100});expect(base.items.length).toBeGreaterThan(0);
 const original=f.serviceAppointments!.find(a=>a.id===base.items[0].id)!;
 for(let i=0;i<30;i++)f.serviceAppointments!.push({...original,id:`appointment-page-${i}`});
 const db=new DatabaseSync(":memory:");
 const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(s:{sql:string;params:readonly unknown[]}){return {rows:db.prepare(s.sql).all(...s.params as SQLInputValue[]) as Row[],affectedRows:0};},async atomic(){throw new Error("read only");}};
 try{
 for(const file of readdirSync("drizzle").filter(n=>/^\d.*\.sql$/.test(n)).sort())db.exec(readFileSync(`drizzle/${file}`,"utf8"));
 for(const s of buildOpsSeedStatements(f))db.prepare(s.sql).run(...s.params.map(v=>typeof v==="boolean"?Number(v):v??null) as SQLInputValue[]);
 const expected=upcomingAppointmentsFromFixture(f,scope,{now,limit:100});
 const ids:string[]=[];
 for(let offset=0;offset<expected.totalCount!;offset+=25){const q={now,limit:25,offset};const page=await queryUpcomingAppointments(driver,scope,q);expect(page).toEqual(upcomingAppointmentsFromFixture(f,scope,q));ids.push(...page.items.map(r=>r.id));}
 expect(new Set(ids).size).toBe(expected.totalCount);
 for(const sc of [scope,{...scope,storeIds:[]},{...scope,regionIds:[]},{organizationId:"foreign"},{...scope,storeIds:[base.items[0].storeId]}]){
 for(const search of [undefined,base.items[0].storeNumber,base.items[0].vendorName,"no match","%"]){const q={now,search,limit:100};expect(await queryUpcomingAppointments(driver,sc,q)).toEqual(upcomingAppointmentsFromFixture(f,sc,q));}}
 expect((await queryUpcomingAppointments(driver,scope,{now,offset:1000})).totalCount).toBe(expected.totalCount);
 }finally{db.close();}
});
