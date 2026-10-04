import {beforeEach,describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {GET as detail} from "@/app/api/ops/internal-dispatch/jobs/[id]/route";
import {GET as dayJobs} from "@/app/api/ops/internal-dispatch/jobs/route";
import {POST as schedule} from "@/app/api/ops/work-orders/[id]/internal-schedule/route";
import {createOpsFixtureRepository} from "@/lib/ops/fixture-repository";
import {buildShowcaseFixture} from "@/lib/ops/showcase-fixture";
import {renderDispatchBoard} from "@/lib/server/dispatch-board-page";
import TechnicianPage from "@/app/app/dispatch/technicians/[id]/page";
import {TechnicianHistory} from "@/components/workspace/technician-history";
import {technicianSearch} from "@/lib/server/technician-search";
import {navigationChildren,navigationForRole} from "@/components/ops/navigation";
import {dispatchTime,dispatchStatus} from "@/lib/ops/dispatch-board";
import {plainScheduleLabel} from "@/lib/ops/dispatch-calendar";
import {dispatchActor,dispatchJob,dispatchNow,dispatchOrg,dispatchServices,dispatchTech} from "./helpers/internal-dispatch-regression";
import {setInternalCompletionTarget} from "@/lib/ops/internal-scheduling";
import type {OperatorSession} from "@/components/ops/data-contract";
const mocks=vi.hoisted(()=>({session:vi.fn(),repository:vi.fn()}));
vi.mock("@/app/app/_data/operator-loader",()=>({loadOperatorSession:mocks.session}));
vi.mock("@/lib/server/ops-repository-provider",()=>({getServerOpsRepository:mocks.repository}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn(),push:vi.fn(),replace:vi.fn()})}));

describe("Dispatch redesign boundaries and user choices",()=>{
  let r:ReturnType<typeof createOpsFixtureRepository>,session:OperatorSession;
  beforeEach(()=>{r=createOpsFixtureRepository(buildShowcaseFixture(dispatchNow));session={accessMode:"authenticated",demoEdition:"complete",role:"facilities",userId:"user-northline-facilities",membershipId:"membership-northline-facilities",organizationId:dispatchOrg,organizationName:"Fictional QA",displayName:"Jordan",email:"qa@example.test",companywide:true,scopeLabel:"Test",permissions:["ops:write"]};mocks.repository.mockResolvedValue(r);mocks.session.mockImplementation(async()=>session);});
  function asTechnician(){session={...session,role:"technician",membershipId:dispatchTech[0],userId:"user-northline-tech-1"};}
  it("opens Assign with readable incoming work and six technicians",async()=>{
    const html=renderToStaticMarkup(await renderDispatchBoard({}));
    for(const label of ["Dispatch views", "Needs a tech", "Today", "Compare", "Current job", "Next planned stop", "Duration unknown", "Alex Morgan", "Riley Chen"])expect(html).toContain(label);
    expect(html).toContain("The back-room floor drain is backing up and water is approaching stored cartons. The manager needs help today.");
    expect(html).not.toContain("Weekly store walk");expect(html).not.toContain("recordedCostMinor");
    expect(html).toContain('draggable="true"');expect(html).not.toContain('>0 jobs<');
  });
  it("keeps owner and read-only boards free of editing actions",async()=>{
    session={...session,role:"executive",membershipId:"membership-northline-executive",userId:"user-northline-executive",permissions:["ops:read"]};
    const html=renderToStaticMarkup(await renderDispatchBoard({}));expect(html).not.toContain('draggable="true"');expect(html).not.toContain(">Schedule</button>");
    expect(html).not.toContain('data-can-drag="true"');
  });
  it("keeps the searchable list without empty date placeholders",async()=>{
    const html=renderToStaticMarkup(await renderDispatchBoard({view:"list"}));
    expect(html).toContain("Team jobs");expect(html).toContain("Restroom faucet");
    expect(html).not.toMatch(/No date yet|Not scheduled|Not set/);
  });
  it("returns an operational job sheet without financial or unscoped detail fields",async()=>{
    const job=await dispatchJob(r,"person"),response=await detail(new Request("http://localhost/api/ops/internal-dispatch/jobs/"+job.id),{params:Promise.resolve({id:job.id})});
    expect(response.status).toBe(200);const data=await response.json() as {job:Record<string,unknown>};expect(data.job.id).toBe(job.id);
    for(const key of ["recordedCostMinor","currency","nte","costs","vendorInvoiceNumber","externalAccountingPo"])expect(data.job).not.toHaveProperty(key);
    session={...session,storeIds:[],companywide:false};expect((await detail(new Request("http://localhost/x"),{params:Promise.resolve({id:job.id})})).status).toBe(404);
  });
  it("rejects technician board APIs and does not retain revoked store scope",async()=>{
    const job=await dispatchJob(r,"person");asTechnician();expect((await detail(new Request("http://localhost/x"),{params:Promise.resolve({id:job.id})})).status).toBe(403);
    session={...session,role:"facilities",userId:"user-northline-facilities",membershipId:"membership-northline-facilities"};
    await r.atomicWrite([{sql:"UPDATE ops_scope_grants SET scope_id = ? WHERE organization_id = ? AND membership_id = ?",params:["revoked",dispatchOrg,session.membershipId]}]);
    const response=await dayJobs(new Request("http://localhost/api/ops/internal-dispatch/jobs?day=2026-10-08"));expect(response.status).toBe(200);expect((await response.json() as {items:unknown[]}).items).toEqual([]);
  });
  it("returns specific date warnings and requires a separate explicit keep action",async()=>{
    const job=await dispatchJob(r,"person");await setInternalCompletionTarget(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,key:crypto.randomUUID(),localTarget:"2026-10-07T17:00",reason:"Store opens"});
    const data=new FormData();Object.entries({precision:"day",date:"2026-10-08",expectedVersion:"1",expectedAssignmentId:job.initialAssignment!.id,expectedScheduleId:"",submissionKey:crypto.randomUUID()}).forEach(([key,value])=>data.set(key,value));
    const request=()=>new Request("http://localhost/api/ops/work-orders/"+job.id+"/internal-schedule",{method:"POST",headers:{Origin:"http://localhost",Accept:"application/json"},body:data});
    const warning=await schedule(request(),{params:Promise.resolve({id:job.id})});expect(warning.status).toBe(422);expect(await warning.json()).toMatchObject({details:{kind:"schedule_warning",warnings:["After the finish-by date."]}});expect((await r.getWorkOrder(dispatchOrg,job.id))?.version).toBe(1);
    data.set("keepConflicts","yes");expect((await schedule(request(),{params:Promise.resolve({id:job.id})})).status).toBe(200);expect((await r.getWorkOrder(dispatchOrg,job.id))?.targetCompletionAt).toBe("2026-10-07T21:00:00.000Z");
  });
  it("shows a scoped technician directory with a phone and preserves view-only behavior",async()=>{
    const html=renderToStaticMarkup(await TechnicianPage({params:Promise.resolve({id:dispatchTech[0]}),searchParams:Promise.resolve({})}));
    for(const label of ["Maria Santos","606-555-0161","This week","Open jobs","Waiting","Recently finished","Stores covered"])expect(html).toContain(label);
    expect(html).not.toContain("timesheet");expect(html).not.toContain("recordedCost");
    expect(html).not.toMatch(/No date yet|Not set/);
    session={...session,storeIds:[],companywide:false};const denied=renderToStaticMarkup(await TechnicianPage({params:Promise.resolve({id:dispatchTech[0]}),searchParams:Promise.resolve({})}));expect(denied).toContain("Technician not available");expect(denied).not.toContain("Maria Santos");
  });
  it("shows internal and vendor notes while technician search has no financial groups",async()=>{
    asTechnician();const html=renderToStaticMarkup(await TechnicianHistory({repository:r,scope:{organizationId:dispatchOrg,storeIds:["store-northline-104"]},storeId:"store-northline-104",limit:5}));
    expect(html).toContain("Past work");expect(html).not.toMatch(/Recorded work cost|Prices &amp; costs|Linked invoice|currency/);
    const results=await technicianSearch("104");expect(results.groups.map(group=>group.id)).toEqual(["stores","equipment","work"]);expect(JSON.stringify(results)).not.toMatch(/recordedCost|currency|invoice|contract/);
  });
  it("keeps six manager sections and puts the same scoped children under Work",()=>{
    for(const role of ["facilities","regional","executive","store_manager","finance"] as const)expect(navigationForRole(role,"complete").length).toBeLessThanOrEqual(6);
    const work=navigationForRole("facilities","complete").find(item=>item.id==="work")!;
    expect(navigationChildren("facilities",work,"complete").map(item=>item.label)).toEqual(["Review queue","Dispatch","Work orders","Requests","Quotes","Service visits","Tasks","Compliance"]);
    expect(navigationForRole("technician","complete").map(item=>item.label)).toEqual(["My work","Stores","Equipment","Work history","Search"]);
  });
  it("keeps vendor visit states distinct from the internal team",()=>{
    expect(dispatchStatus({status:"scheduled",assignmentKind:"outside_vendor"}).label).toBe("Vendor visit planned");
    expect(dispatchStatus({status:"issued",assignmentKind:"outside_vendor"}).label).toBe("Waiting on vendor");
  });
  it("shows a friendly zone only when the store's zone differs",()=>{
    expect(dispatchTime("2026-10-08T19:00:00Z","America/Chicago","America/New_York")).toContain("2:00 PM Central");
    expect(dispatchTime("2026-10-08T19:00:00Z","America/New_York","America/New_York")).not.toMatch(/Eastern|America\//);
    expect(plainScheduleLabel({precision:"appointment",week:"2026-10-05",startsAt:"2026-10-08T19:00:00Z",entryZone:"America/Chicago",tentative:false},"America/New_York")).toContain("2:00 PM Central");
    expect(plainScheduleLabel({precision:"appointment",week:"2026-10-05",startsAt:"2026-10-08T19:00:00Z",entryZone:"America/New_York",tentative:false},"America/New_York")).not.toMatch(/Eastern|EDT|America\//);
  });
});
