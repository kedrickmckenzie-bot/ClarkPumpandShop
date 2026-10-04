import {describe,it,expect} from "vitest";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {buildDispatchDemoBackfill} from "@/lib/ops/seed";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
import {dueLabel} from "@/lib/ops/dispatch-board";
import {dispatchJob as projection} from "@/lib/ops/dispatch-board";
import {dispatchOrg} from "./helpers/internal-dispatch-regression";

describe("Approved Assign dataset and insert-only release",()=>{
  it("has six technicians and 36 internal team jobs with varied commitments",async()=>{
    const fixture=buildShowcaseFixture("2026-10-07");
    const repository=createOpsFixtureRepository(fixture);
    const page=await repository.listWorkOrders({organizationId:dispatchOrg},{internalOnly:true,maintenanceTeamOnly:true,statuses:["accepted","approved","in_progress","waiting_on_parts","completed_pending_review","scheduled","resolved"],limit:100});
    expect(page.totalCount).toBe(36);
    expect((await repository.getDispatchFilters({organizationId:dispatchOrg})).people).toHaveLength(6);
    const assigned=page.items.filter(j=>j.internalMembershipId);
    const loads=new Map<string,number>();for(const job of assigned)loads.set(job.internalMembershipId!,1+(loads.get(job.internalMembershipId!)??0));
    expect(new Set(loads.values()).size).toBeGreaterThan(3);
    expect(new Set(fixture.internalSchedules!.map(s=>s.durationMinutes)).size).toBeGreaterThan(3);
    expect(fixture.workResults?.some(r=>r.blocker==="parts"&&r.followUpId)).toBe(true);
    expect(dueLabel(projection(page.items.find(j=>j.id==="dispatch-study-job-25")!,"America/New_York"),"2026-10-07","America/New_York","2026-10-07T14:00:00.000Z")).toBe("Due today, noon");
  });
  it("marks a passed deadline late even when it is still today",()=>{
    expect(dueLabel({dueAt:"2026-10-07T16:00:00.000Z",storeZone:"America/New_York"},"2026-10-07","America/New_York","2026-10-07T17:00:00.000Z")).toBe("Late · due today, noon");
  });
  it("finds and pages dated commitments in planning order, independently of priority pages",async()=>{
    const repository=createOpsFixtureRepository(buildShowcaseFixture("2026-10-07"));
    const query={internalOnly:true,scheduleDayFrom:"2026-10-07",dispatchPlanOrder:true,limit:2} as const;
    const first=await repository.listWorkOrders({organizationId:dispatchOrg},query);
    const next=await repository.listWorkOrders({organizationId:dispatchOrg},{...query,cursor:first.nextCursor});
    const jobs=[...first.items,...next.items];expect(new Set(jobs.map(j=>j.id)).size).toBe(4);
    const keys=jobs.map(j=>`${j.schedule!.day}|${j.schedule!.startsAt??"9999"}|${({emergency:0,urgent:1,routine:2,planned:3})[j.priority]}|${j.id}`);
    expect(keys).toEqual([...keys].sort());
  });
  it("limits the backfill to inserts of the new dispatch identities",async()=>{
    const repository=createOpsFixtureRepository(buildShowcaseFixture("2026-10-07"));
    const statements=buildDispatchDemoBackfill("2026-11-01");
    expect(statements.length).toBeGreaterThan(100);
    expect(statements.every(s=>s.sql.startsWith("INSERT INTO ")&&s.sql.endsWith("ON CONFLICT DO NOTHING"))).toBe(true);
    expect((await repository.getDispatchFilters({organizationId:dispatchOrg,storeIds:[]})).people).toEqual([]);
  });
});
