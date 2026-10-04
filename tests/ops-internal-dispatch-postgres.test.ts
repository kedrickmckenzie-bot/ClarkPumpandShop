import {Pool} from "pg";
import {readdirSync,readFileSync} from "node:fs";
import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {createOpsPostgresRepository} from "@/lib/ops/postgres-repository";
import {seedOpsRepository} from "@/lib/ops/seed";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {changeInternalDispatch} from "@/lib/ops/internal-dispatch";
import {assignWorkOrder} from "@/lib/ops/commands";
import {dispatchActor,dispatchJob,dispatchNow,dispatchOrg,dispatchServices,dispatchTech,internalDispatchRegression} from "./helpers/internal-dispatch-regression";
import type {OpsRepository} from "@/lib/ops/repository";

// Opt in with a disposable local test database. Never migrate a customer database.
const url=process.env.OPS_DISPATCH_TEST_DATABASE_URL;
describe.skipIf(!url)("internal dispatch on separate PostgreSQL connections",()=>{
  let pool:Pool;
  let repository:OpsRepository;
  let databaseName:string;
  beforeAll(async()=>{
    const parsed=new URL(url!);
    if(!["127.0.0.1","localhost"].includes(parsed.hostname)||!/^\/dispatch_.*test$/.test(parsed.pathname)) throw new Error("Use an isolated localhost dispatch_*test database.");
    pool=new Pool({connectionString:url,max:8});
    databaseName=`dispatch_${crypto.randomUUID().replaceAll("-","")}_test`;
    await pool.query(`CREATE DATABASE ${databaseName}`);
    await pool.end();
    parsed.pathname=`/${databaseName}`;
    pool=new Pool({connectionString:parsed.toString(),max:8});
    for(const file of readdirSync("drizzle-postgres").filter(f=>/^\d.*\.sql$/.test(f)).sort()) {
      for(const sql of readFileSync(`drizzle-postgres/${file}`,"utf8").split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean)) await pool.query(sql);
    }
    repository=createOpsPostgresRepository(pool);
    const fixture=buildShowcaseFixture(dispatchNow);fixture.outboxMessages=[];
    await seedOpsRepository(repository,fixture);
  },120000);
  afterAll(async()=>{await pool?.end();if(databaseName){const cleanup=new Pool({connectionString:url});try{await cleanup.query(`DROP DATABASE ${databaseName}`);}finally{await cleanup.end();}}});
  it("runs the same persistence and policy scenarios as D1 and fixture",async()=>{await internalDispatchRegression(repository);},30000);
  it("rolls back when technician access is revoked after the command precheck",async()=>{
    const work=await dispatchJob(repository);
    const revoked=new Proxy(repository,{get(target,property){
      if(property==="atomicWrite") return async(statements:Parameters<OpsRepository["atomicWrite"]>[0])=>{await pool.query("UPDATE ops_memberships SET status='suspended' WHERE organization_id=$1 AND id=$2",[dispatchOrg,dispatchTech[0]]);return target.atomicWrite(statements);};
      const value=Reflect.get(target,property);return typeof value==="function"?value.bind(target):value;
    }});
    try {
      await expect(changeInternalDispatch(dispatchServices(revoked),{organizationId:dispatchOrg,workOrderId:work.id,action:"claim",actor:dispatchActor(dispatchTech[0]),expectedVersion:0,expectedAssignmentId:work.initialAssignment!.id,key:crypto.randomUUID()})).rejects.toMatchObject({code:"FORBIDDEN"});
      expect((await repository.getWorkOrder(dispatchOrg,work.id))?.version).toBe(0);
      expect((await repository.getActiveAssignment(dispatchOrg,work.id))?.internalTarget).toBe("pool");
      const rows=await pool.query("SELECT count(*)::int AS n FROM ops_audit_events WHERE organization_id=$1 AND aggregate_id=$2 AND event_type='internal_dispatch.claim'",[dispatchOrg,work.id]);
      expect(rows.rows[0].n).toBe(0);
    } finally {await pool.query("UPDATE ops_memberships SET status='active' WHERE organization_id=$1 AND id=$2",[dispatchOrg,dispatchTech[0]]);}
  });

  function overlap() {
    let arrivals=0;let release!:()=>void;
    const gate=new Promise<void>(r=>{release=r;});
    return new Proxy(repository,{get(target,property){
      if(property==="atomicWrite") return async(statements:Parameters<OpsRepository["atomicWrite"]>[0])=>{if(++arrivals===2)release();await gate;return target.atomicWrite(statements);};
      const value=Reflect.get(target,property);return typeof value==="function"?value.bind(target):value;
    }});
  }
  for(const contender of ["technician","manager","provider"] as const) for(const reverse of [false,true]) {
    it(`commits one ${contender} race winner (${reverse?"reverse":"forward"} start)`,async()=>{
      const work=await dispatchJob(repository);const r=overlap();
      const common={organizationId:dispatchOrg,workOrderId:work.id,expectedVersion:0,expectedAssignmentId:work.initialAssignment!.id};
      const inputs=[{...common,action:"claim" as const,actor:dispatchActor(dispatchTech[0]),key:crypto.randomUUID()},contender==="technician"?{...common,action:"claim" as const,actor:dispatchActor(dispatchTech[1]),key:crypto.randomUUID()}:{...common,action:"assign" as const,target:"person" as const,membershipId:dispatchTech[1],actor:dispatchActor(),key:crypto.randomUUID()}];
      const operations=[()=>changeInternalDispatch(dispatchServices(r),inputs[0]),()=>contender==="provider"?assignWorkOrder(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:work.id,kind:"choose_later",actor:dispatchActor()}):changeInternalDispatch(dispatchServices(r),inputs[1])];
      if(reverse)operations.reverse();
      const results=await Promise.allSettled(operations.map(operation=>operation()));
      expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(1);
      const loser=results.find(x=>x.status==="rejected") as PromiseRejectedResult;
      expect(loser.reason).toMatchObject({code:"CONFLICT"});
      const counts=await pool.query("SELECT count(*)::int AS n FROM ops_work_order_assignments WHERE organization_id=$1 AND work_order_id=$2 AND status IN ('pending','issued','opened','accepted')",[dispatchOrg,work.id]);
      expect(counts.rows[0].n).toBe(1);
      const audits=await pool.query("SELECT count(*)::int AS n FROM ops_audit_events WHERE organization_id=$1 AND aggregate_id=$2 AND event_type IN ('internal_dispatch.claim','internal_dispatch.assign','work_order.assigned') AND payload_json->>'assignmentId' <> $3",[dispatchOrg,work.id,work.initialAssignment!.id]);
      expect(audits.rows[0].n).toBe(1);
      expect((await repository.getWorkOrder(dispatchOrg,work.id))?.version).toBe(1);
    },30000);
  }
  it("replays one simultaneous command receipt without duplicate alerts",async()=>{
    const work=await dispatchJob(repository,"person",{priority:"urgent"});const r=overlap();
    const input={organizationId:dispatchOrg,workOrderId:work.id,expectedVersion:0,expectedAssignmentId:work.initialAssignment!.id,actor:dispatchActor(dispatchTech[0]),action:"return" as const,key:crypto.randomUUID()};
    const results=await Promise.all([changeInternalDispatch(dispatchServices(r),input),changeInternalDispatch(dispatchServices(r),input)]);
    expect(results[0].assignment.id).toBe(results[1].assignment.id);
    expect(results.filter(x=>x.replayed)).toHaveLength(1);
    const rows=await pool.query("SELECT count(*)::int AS n FROM ops_outbox_messages WHERE organization_id=$1 AND aggregate_id=$2 AND topic='ops.internal_dispatch.notification' AND payload_json->>'initialAssignment' IS DISTINCT FROM 'true'",[dispatchOrg,work.id]);
    expect(rows.rows[0].n).toBe(1);
  },30000);
});
