import {dispatchBackfillRegression} from "./helpers/dispatch-backfill-regression";
import {Miniflare} from "miniflare";
import {readdirSync,readFileSync} from "node:fs";
import {it,expect} from "vitest";
import {buildSyntheticScaleFixture} from "@/lib/ops/fixtures";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
import {createOpsD1Repository} from "@/lib/ops/d1-repository";
import {buildOpsSeedStatements} from "@/lib/ops/seed";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {dispatchNow,internalDispatchRegression} from "./helpers/internal-dispatch-regression";

it("runs internal dispatch on the actual D1 SQLite adapter",async()=>{
  const runtime=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",d1Databases:["DB"]});
  try {
    const db=await runtime.getD1Database("DB");
    for(const file of readdirSync("drizzle").filter(f=>/^\d.*\.sql$/.test(f)).sort()) {
      for(const sql of readFileSync(`drizzle/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean)) await db.prepare(sql).run();
    }
    const fixture=buildShowcaseFixture(dispatchNow); fixture.outboxMessages=[];
    const statements=buildOpsSeedStatements(fixture);
    for(let i=0;i<statements.length;i+=100) await db.batch(statements.slice(i,i+100).map(s=>db.prepare(s.sql).bind(...s.params.map(v=>typeof v==="boolean"?Number(v):v??null))));
    await dispatchBackfillRegression(createOpsD1Repository(db as unknown as D1Database));
    await internalDispatchRegression(createOpsD1Repository(db as unknown as D1Database));
    // Access checks pass inside each save and leave no marker rows behind.
    const markers=await db.prepare("SELECT COUNT(*) AS n FROM ops_idempotency_keys WHERE command='dispatch.access_assertion'").first<{n:number}>();
    expect(markers?.n).toBe(0);
  } finally {await runtime.dispose();}
},120000);

for(const storeCount of [1,65]) it(`pages internal dispatch with ${storeCount} stores on native D1 and fixture`,async()=>{
  const runtime=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",d1Databases:["DB"]});
  try {
    const db=await runtime.getD1Database("DB");
    for(const file of readdirSync("drizzle").filter(f=>/^\d.*\.sql$/.test(f)).sort()) for(const sql of readFileSync(`drizzle/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean)) await db.prepare(sql).run();
    const fixture=buildSyntheticScaleFixture(storeCount);
    const sample=buildShowcaseFixture(dispatchNow);
    const template=sample.workOrders.find(w=>w.id==="dispatch-demo-pool")!;
    const task=sample.workflowTasks.find(t=>t.workOrderId===template.id)!;
    for(const store of fixture.stores) for(let i=0;i<9;i++) {
      const id=`dispatch-scale-${store.storeNumber}-${i}`;
      const target=(["pool","person","awaiting_allocation"] as const)[i%3];
      fixture.workOrders.push({...template,id,number:`SCALE-${store.storeNumber}-${i}`,storeId:store.id,problem:`Scale job ${i}`,createdAt:dispatchNow});
      fixture.assignments.push({id:`${id}-assignment`,organizationId:template.organizationId,workOrderId:id,kind:"internal",internalTarget:target,internalMembershipId:target==="person"?"membership-northline-tech-1":undefined,status:"pending",assignedAt:dispatchNow});
      fixture.workflowTasks.push({...task,id:`${id}-task`,workOrderId:id});
    }
    const tables=new Set(["ops_organizations","ops_divisions","ops_regions","ops_stores","ops_users","ops_memberships","ops_scope_grants","ops_work_orders","ops_work_order_assignments","ops_workflow_tasks"]);
    const statements=buildOpsSeedStatements(fixture).filter(s=>tables.has(s.sql.match(/^INSERT INTO (\w+)/)![1]));
    for(let i=0;i<statements.length;i+=100) await db.batch(statements.slice(i,i+100).map(s=>db.prepare(s.sql).bind(...s.params.map(v=>typeof v==="boolean"?Number(v):v??null))));
    const native=createOpsD1Repository(db as unknown as D1Database),memory=createOpsFixtureRepository(fixture);
    const org=template.organizationId,scope={organizationId:org};
    let cursor:string|undefined;const ids:string[]=[];
    do {
      const query={internalOnly:true,internalTarget:"pool" as const,limit:25,cursor};
      const actual=await native.listWorkOrders(scope,query),expected=await memory.listWorkOrders(scope,query);
      expect(actual.items.map(w=>w.id)).toEqual(expected.items.map(w=>w.id));
      expect(actual.items.length).toBeLessThanOrEqual(25);
      ids.push(...actual.items.map(w=>w.id));cursor=actual.nextCursor;
      if(ids.length===25&&cursor) {
        const claimed=actual.items.at(-1)!;
        const statements=[{sql:"UPDATE ops_work_order_assignments SET status = ? WHERE organization_id = ? AND id = ?",params:["superseded",org,claimed.assignmentId!]}];
        await native.atomicWrite(statements);await memory.atomicWrite(statements);
      }
    } while(cursor);
    expect(new Set(ids).size).toBe(storeCount*3);
    expect(ids.length).toBe(storeCount*3);
    const storeId=fixture.stores[0].id;
    expect((await native.listWorkOrders({organizationId:org,storeIds:[storeId]},{internalTarget:"pool",limit:25})).items).toHaveLength(3);
    expect((await native.listWorkOrders({organizationId:org,storeIds:[]},{internalOnly:true})).items).toEqual([]);
    const people=await native.listDispatchPeople(scope,storeId,"",undefined,"technician");
    expect(people.items.map(p=>p.id)).toEqual((await memory.listDispatchPeople(scope,storeId,"",undefined,"technician")).items.map(p=>p.id));
    expect(people.items).toHaveLength(6);
  } finally {await runtime.dispose();}
},120000);
