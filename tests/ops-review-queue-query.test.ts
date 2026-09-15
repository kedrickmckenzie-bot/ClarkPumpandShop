import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync,readdirSync } from "node:fs";
import { expect,it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";
import { queryAttention } from "@/lib/ops/attention-sql";
import { queryAttentionSources } from "@/lib/ops/attention-sources-sql";
import { attentionFromFixture,type AttentionQueueRow } from "@/lib/ops/attention-query";
import type { OpsSqlDriver,SqlRow } from "@/lib/ops/sql-driver";

it("pages completed history and large quote evidence while excluding conflicting source references",async()=>{
  const fixture=buildNorthlinePresentationFixture(),org=fixture.organizations[0].id;
  const base=fixture.workflowTasks.find(t=>t.workOrderId && t.status==="open")!;
  const stamp="2026-08-24T15:00:00.123Z";
  fixture.workflowTasks.push(...Array.from({length:230},(_,i)=>({...base,id:`history-density-${String(i).padStart(3,"0")}`,taskType:"schedule_service" as const,title:"History density",status:"completed" as const,blocking:false,requiredForProgress:false,sourceFollowUpId:undefined,sourceApprovalRequestId:undefined,completedAt:i%2?"2026-08-24T11:00:00.123-04:00":stamp,completedByActorType:"system" as const,completedByActorName:"Test",resolutionNote:"Test complete"})));
  const quote=fixture.estimateRequests.find(q=>["requested","opened","submitted"].includes(q.status))!;
  const proposal=fixture.estimateProposals[0];
  fixture.estimateProposals.push(...Array.from({length:230},(_,i)=>({...proposal,id:`proposal-density-${String(i).padStart(3,"0")}`,organizationId:org,requestId:quote.id,workOrderId:quote.workOrderId,vendorId:quote.vendorId,revision:i+1000})));
  const db=new DatabaseSync(":memory:"),returned:number[]=[];
  const driver:OpsSqlDriver={dialect:"sqlite",async query<Row extends SqlRow>(statement:{sql:string;params:readonly unknown[]}){const rows=db.prepare(statement.sql).all(...statement.params as SQLInputValue[]) as Row[];returned.push(rows.length);return{rows,affectedRows:0};},async atomic(){throw new Error("Read must not mutate");}};
  const scope={organizationId:org},access={role:"facilities_admin" as const,canOpenWarranty:true,canOpenRequest:true};
  try{
    db.exec("PRAGMA foreign_keys=ON");
    for(const file of readdirSync("drizzle").filter(file=>/^\d.*\.sql$/.test(file)).sort()) db.exec(readFileSync(`drizzle/${file}`,"utf8"));
    for(const statement of buildOpsSeedStatements(fixture)) db.prepare(statement.sql).run(...statement.params.map(v=>typeof v==="boolean"?Number(v):v??null) as SQLInputValue[]);
    const history:AttentionQueueRow[]=[];let cursor:string|undefined;
    do {const page=await queryAttention(driver,scope,access,{asOf:fixture.asOf,lane:"history",q:"History density",limit:25,cursor});expect(page.totalCount).toBe(230);history.push(...page.items);cursor=page.nextCursor;if(history.length>230)throw new Error("Cursor did not advance");}while(cursor);
    expect(history.map(row=>row.id)).toEqual(Array.from({length:230},(_,i)=>`history-density-${String(i).padStart(3,"0")}`));
    expect(history.slice(0,100)).toEqual(attentionFromFixture(fixture,scope,access,{asOf:fixture.asOf,lane:"history",q:"History density",limit:100}).items);
    const item=`quote-round-${quote.workOrderId}`,ids:string[]=[];let offset=0,total=0;
    do {const page=(await queryAttentionSources(driver,scope,access,{asOf:fixture.asOf},item,{limit:25,offset}))!;total=page.totalCount;ids.push(...page.items.map(row=>row.id));if(page.nextOffset===undefined)break;offset=page.nextOffset;if(offset>1000)throw new Error("Source page did not advance");}while(offset<=1000);
    expect(ids.length).toBe(total);expect(new Set(ids).size).toBe(total);expect(ids.filter(id=>id.startsWith("proposal-density-")).length).toBe(230);
    const parent=(await queryAttention(driver,scope,access,{asOf:fixture.asOf,itemIds:[item],limit:1})).items[0];expect(parent.sourceCount).toBe(total);
    const otherStore=fixture.stores.find(s=>s.id!==parent.storeId)!;
    expect(await queryAttentionSources(driver,{...scope,storeIds:[otherStore.id]},access,{asOf:fixture.asOf},item,{limit:25})).toBeNull();
    const otherWork=fixture.workOrders.find(w=>w.storeId===otherStore.id)!;
    // Deliberately malformed historical reference, confined to this disposable database.
    db.exec("PRAGMA foreign_keys=OFF");
    db.prepare("UPDATE ops_vendor_estimate_proposals SET work_order_id=? WHERE id=?").run(otherWork.id,ids.find(id=>id.startsWith("proposal-density-"))!);
    const amended=(await queryAttentionSources(driver,scope,access,{asOf:fixture.asOf},item,{limit:25,offset:10000}))!;
    expect(amended.totalCount).toBe(total-1);expect(amended.item.sourceCount).toBe(total-1);expect(amended.items).toEqual([]);
    expect(Math.max(...returned)).toBeLessThanOrEqual(26);
  }finally{db.close();}
},120_000);
