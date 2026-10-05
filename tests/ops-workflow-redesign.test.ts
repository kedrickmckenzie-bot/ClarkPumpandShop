import { it, expect } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { dispatchNow } from "./helpers/internal-dispatch-regression";
import { workflowRedesignRegression } from "./helpers/workflow-redesign-regression";
it("keeps preparation, bulk plans, status and delayed confirmation durable", async () => {
  await workflowRedesignRegression(
    createOpsFixtureRepository(buildShowcaseFixture(dispatchNow)),
  );
});

it("uses the store's next morning and permits a company or job delay override", async () => {
  const { confirmationWindow } = await import("@/lib/ops/delayed-confirmation");
  const { dispatchOrg } =
    await import("./helpers/internal-dispatch-regression");
  const fixture = buildShowcaseFixture(dispatchNow),
    work = fixture.workOrders.find((w) => w.organizationId === dispatchOrg)!;
  const r = createOpsFixtureRepository(fixture);
  expect(
    (
      await confirmationWindow(
        r,
        { ...work, confirmationDelay: undefined },
        dispatchNow,
      )
    ).availableAt,
  ).toBe("2026-10-04T12:00:00.000Z");
  expect(
    (
      await confirmationWindow(
        r,
        { ...work, confirmationDelay: "four_hours" },
        dispatchNow,
      )
    ).availableAt,
  ).toBe("2026-10-03T22:00:00.000Z");
});

it("keeps an employee report with the store manager before facilities routing",async()=>{
 const {createServiceRequest}=await import("@/lib/ops/commands");
 const {dispatchOrg,dispatchActor,dispatchServices}=await import("./helpers/internal-dispatch-regression");
 const fixture=buildShowcaseFixture(dispatchNow),member=fixture.memberships.find(m=>m.id==="membership-northline-store-101")!;
 member.role="store_employee";
 const r=createOpsFixtureRepository(fixture);
 const report=await createServiceRequest(dispatchServices(r),{organizationId:dispatchOrg,storeId:"store-northline-101",reporterName:"Store employee",problem:"Door needs attention",actor:dispatchActor(member.id)});
 expect(report.status).toBe("submitted");expect(report.workflowTask.assigneeRole).toBe("store_manager");
});
it("does not let capped old tasks starve a new overdue confirmation in a bounded worker batch",async()=>{
 const fixture=buildShowcaseFixture(dispatchNow),source=fixture.workflowTasks.find(t=>t.dueAt)!;
 fixture.workflowTasks=Array.from({length:100},(_,i)=>({...source,id:`capped-${i}`,status:"open" as const,escalationLevel:3,dueAt:"2026-01-01T00:00:00.000Z"}));
 fixture.workflowTasks.push({...source,id:"new-confirmation",taskType:"verify_repair",status:"open",escalationLevel:0,dueAt:dispatchNow});
 const r=createOpsFixtureRepository(fixture);
 expect((await r.listOverdueEscalationCandidates(dispatchNow,1)).map(t=>t.id)).toEqual(["new-confirmation"]);
});
