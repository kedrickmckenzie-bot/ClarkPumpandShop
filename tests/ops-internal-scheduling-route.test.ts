import { beforeEach,describe,expect,it,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { POST } from "@/app/api/ops/work-orders/[id]/internal-schedule/route";
import SchedulePage from "@/app/app/dispatch/schedule/[id]/page";
import { renderInternalDispatch } from "@/lib/server/internal-dispatch-page";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";
import { saveInternalSchedule } from "@/lib/ops/internal-scheduling";
import { recordInternalWorkResult } from "@/lib/ops/internal-execution";
import { checkInVisit } from "@/lib/ops/commands";
import InternalJob from "@/app/app/my-work/[id]/page";
import { dispatchActor,dispatchJob,dispatchNow,dispatchOrg,dispatchServices,dispatchTech } from "./helpers/internal-dispatch-regression";
import type { OperatorSession } from "@/components/ops/data-contract";
vi.mock("next/navigation",async()=>({...await vi.importActual("next/navigation"),useRouter:()=>({refresh:vi.fn(),push:vi.fn(),replace:vi.fn()})}));
const mocks=vi.hoisted(()=>({session:vi.fn(),repository:vi.fn()}));
vi.mock("@/app/app/_data/operator-loader",()=>({loadOperatorSession:mocks.session}));
vi.mock("@/lib/server/ops-repository-provider",()=>({getServerOpsRepository:mocks.repository}));
describe("P3 authenticated scheduling and rendered journeys",()=>{
 let r:ReturnType<typeof createOpsFixtureRepository>,session:OperatorSession;
 beforeEach(()=>{r=createOpsFixtureRepository(buildShowcaseFixture(dispatchNow));session={accessMode:"authenticated",role:"facilities",userId:"user-northline-facilities",membershipId:"membership-northline-facilities",organizationId:dispatchOrg,organizationName:"Fictional QA",displayName:"Jordan",email:"qa@example.test",companywide:true,scopeLabel:"Test scope",permissions:["ops:write"]};mocks.session.mockImplementation(async()=>session);mocks.repository.mockResolvedValue(r);});
 function technician(index=0){session={...session,role:"technician",userId:"user-northline-tech-"+(index+1),membershipId:dispatchTech[index]};}
 async function form(id:string,values:Record<string,string>={}){const w=(await r.getWorkOrder(dispatchOrg,id))!,a=(await r.getActiveAssignment(dispatchOrg,id))!;const f=new FormData();Object.entries({precision:"day",date:"2026-10-08",expectedVersion:String(w.version??0),expectedAssignmentId:a.id,expectedScheduleId:w.internalScheduleId??"",submissionKey:crypto.randomUUID(),returnTo:"/app/dispatch?week=2026-10-05",...values}).forEach(([k,v])=>f.set(k,v));return f;}
 async function post(id:string,data:FormData,origin="http://localhost"){return POST(new Request("http://localhost/api/ops/work-orders/"+id+"/internal-schedule",{method:"POST",headers:{Origin:origin},body:data}),{params:Promise.resolve({id})});}
 it("saves through the real handler and retains filters on the redirect",async()=>{const job=await dispatchJob(r,"person"),response=await post(job.id,await form(job.id));expect(response.status).toBe(303);expect(response.headers.get("location")).toContain("/app/dispatch?week=2026-10-05");expect(response.headers.get("location")).toContain("saved="+encodeURIComponent(job.number));expect(decodeURIComponent(response.headers.get("location")!.replaceAll("+"," "))).toContain("savedWhen=Oct 8, 2026, any time");expect((await r.getWorkOrder(dispatchOrg,job.id))?.internalScheduleId).toBeTruthy();});
 it("enforces own flexible work and target/appointment authority server-side",async()=>{
  const job=await dispatchJob(r,"person");technician();
  expect((await post(job.id,await form(job.id))).status).toBe(303);
  expect((await post(job.id,await form(job.id,{precision:"appointment",localStart:"2026-10-08T10:00"}))).status).toBe(403);
  expect((await post(job.id,await form(job.id,{action:"target",localTarget:"2026-10-08T17:00",reason:"Unauthorized"}))).status).toBe(403);
  technician(1);expect((await post(job.id,await form(job.id))).status).toBe(403);
 });
 it("rejects invalid dates, DST gaps and malformed versions without mutation",async()=>{const job=await dispatchJob(r,"person");for(const fields of [{date:"2026-02-30"},{expectedVersion:"NaN"},{precision:"appointment",localStart:"2026-03-08T02:30"},{precision:"appointment",localStart:"2026-11-01T01:30"}] as Record<string,string>[])expect((await post(job.id,await form(job.id,fields))).status).toBe(422);expect((await r.getWorkOrder(dispatchOrg,job.id))?.version).toBe(0);});
 it("rejects stale forms and cross-origin writes without redirecting externally",async()=>{const job=await dispatchJob(r,"person"),stale=await form(job.id);expect((await post(job.id,await form(job.id),"https://bad.example")).status).toBe(403);await post(job.id,await form(job.id));expect((await post(job.id,stale)).status).toBe(409);const response=await post(job.id,await form(job.id,{returnTo:"https://bad.example"}));expect(response.status).toBe(303);expect(response.headers.get("location")).not.toContain("bad.example");});
 it("uses manager names and live-save wording without exposing draft controls",async()=>{const job=await dispatchJob(r,"person"),html=renderToStaticMarkup(await SchedulePage({params:Promise.resolve({id:job.id}),searchParams:Promise.resolve({})}));expect(html).toContain("The technician sees the change as soon as you save.");expect(html).toContain("Set a finish-by date");expect(html).not.toContain("No date yet");expect(html).toContain("At a set time");expect(html).not.toContain("Publish");});
 it("renders a focused technician flexible form with no appointment or target editing",async()=>{const job=await dispatchJob(r,"person");technician();const html=renderToStaticMarkup(await SchedulePage({params:Promise.resolve({id:job.id}),searchParams:Promise.resolve({})}));expect(html).toContain("Your manager sees the change as soon as you save.");expect(html).not.toContain('value="appointment"');expect(html).not.toContain('name="localTarget"');expect(html).not.toContain('name="internalMembershipId"');});
 it("shows week-only allocation once and keeps current and unfinished technician views available",async()=>{
  const job=await dispatchJob(r,"pool");await saveInternalSchedule(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,expectedScheduleId:null,key:crypto.randomUUID(),precision:"week",date:"2026-10-05"});
  const html=renderToStaticMarkup(await renderInternalDispatch({week:"2026-10-05",q:job.problem},false));expect(html).toContain("Drag a job to move it");expect(html.match(new RegExp(`problem[^"]*">${job.problem.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}<`,"g"))).toHaveLength(1);expect(html).toContain(job.problem);expect(html).toContain("Needs a tech");expect(html).toContain("This week");
  technician();const tech=renderToStaticMarkup(await renderInternalDispatch({},true));for(const tab of ["Today","Coming up","All my jobs","Jobs to take"])expect(tech).toContain(tab);
 });
 it("does not reveal job titles through empty store scope",async()=>{const job=await dispatchJob(r,"person");session={...session,companywide:false,storeIds:[]};const html=renderToStaticMarkup(await SchedulePage({params:Promise.resolve({id:job.id}),searchParams:Promise.resolve({})}));expect(html).toContain("Job not available");expect(html).not.toContain(job.problem);});
 it("returns the current saved plan with a stale scheduling conflict",async()=>{
  const job=await dispatchJob(r,"person"),stale=await form(job.id);
  await post(job.id,await form(job.id,{date:"2026-10-09"}));
  const conflict=await post(job.id,stale);expect(conflict.status).toBe(409);
  expect(JSON.stringify(await conflict.json())).toContain("Current plan: Oct 9, 2026 · Anytime");
 });
 it("offers pool pickup before technician planning and hides unauthorized schedule controls",async()=>{
  const job=await dispatchJob(r,"pool");technician();
  const page=renderToStaticMarkup(await SchedulePage({params:Promise.resolve({id:job.id}),searchParams:Promise.resolve({})}));
  expect(page).not.toContain("Save date");expect(page).not.toContain("Your manager sees the change");
  const pool=renderToStaticMarkup(await renderInternalDispatch({view:"pool",q:job.problem},true));
  expect(pool).toContain("Take job");expect(pool).not.toContain("/app/dispatch/schedule/");
 });
 it("renders Today and needs-replanning using each plan's saved timezone",async()=>{
  const current=await dispatchJob(r,"person"),old=await dispatchJob(r,"person");
  for(const [job,date] of [[current,"2026-10-04"],[old,"2026-10-03"]] as const)await saveInternalSchedule(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,expectedScheduleId:null,key:crypto.randomUUID(),precision:"day",date});
  await r.atomicWrite([{sql:"UPDATE ops_organizations SET time_zone = ? WHERE id = ?",params:["America/Chicago",dispatchOrg]}]);
  technician();vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime("2026-10-04T04:30:00.000Z");
  try{
   const today=renderToStaticMarkup(await renderInternalDispatch({q:"Dispatch regression"},true));
   expect(today).toContain("Today (1)");expect(today).toContain("Missed: pick a new date (1)");
   expect(today.indexOf(current.number)).toBeLessThan(today.indexOf("Missed: pick a new date (1)"));
   expect(today.indexOf(old.number)).toBeGreaterThan(today.indexOf("Missed: pick a new date (1)"));
   const upcoming=renderToStaticMarkup(await renderInternalDispatch({view:"upcoming",q:"Dispatch regression"},true));expect(upcoming).toContain("Coming up (0)");expect(upcoming).not.toContain(current.number);
  }finally{vi.useRealTimers();}
 });
 it("shows a technician's jobs without a date on Today so the page is never empty by mistake",async()=>{
  const job=await dispatchJob(r,"person");technician();
  const today=renderToStaticMarkup(await renderInternalDispatch({},true));
  expect(today).toContain("My jobs without a date");expect(today).toContain(job.number);
 });
 it("shows upcoming jobs immediately when Today and undated work are empty",async()=>{
  const job=await dispatchJob(r,"person");
  await saveInternalSchedule(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,expectedScheduleId:null,key:crypto.randomUUID(),precision:"day",date:"2026-10-06"});
  technician();vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime("2026-10-04T12:00:00.000Z");
  try{const html=renderToStaticMarkup(await renderInternalDispatch({q:job.problem},true));expect(html).toContain(job.number);expect(html).toContain("Coming up (1)");expect(html).not.toContain("Nothing is scheduled for today");expect(html).not.toContain("My jobs without a date");}
  finally{vi.useRealTimers();}
 });
 it("keeps store-team checks assigned to store staff off the dispatch board",async()=>{
  const html=renderToStaticMarkup(await renderInternalDispatch({},false));
  expect(html).not.toContain("Weekly store walk");
  expect(html).toContain("Needs a tech");
 });
 it("sends owners and read-only roles to the full work order, not the technician job page",async()=>{
  const job=await dispatchJob(r,"person");session={...session,role:"executive",userId:"user-northline-executive",membershipId:"membership-northline-executive"};
  const html=renderToStaticMarkup(await renderInternalDispatch({q:job.problem,view:"list"},false));
  expect(html).toContain(job.number);expect(html).not.toContain(">Schedule</button>");expect(html).not.toContain('draggable="true"');
  expect(html).not.toContain(`/app/my-work/${job.id}`);
 });
 it("labels checked-in work as started, and onsite only with an active visit",async()=>{
  const job=await dispatchJob(r,"person");
  await checkInVisit(dispatchServices(r),{organizationId:dispatchOrg,storeId:job.storeId,internalMembershipId:dispatchTech[0],technicianName:"Maria Santos",workOrderIds:[job.id],purpose:"Internal maintenance",channel:"internal_web",location:{result:"not_requested",capturedAt:dispatchNow},actor:dispatchActor(dispatchTech[0])});
  expect((await r.getWorkOrder(dispatchOrg,job.id))?.status).toBe("in_progress");
  const board=renderToStaticMarkup(await renderInternalDispatch({q:job.problem,view:"list"},false));
  expect(board).toContain("Work started");expect(board.match(/>Ready to work</g)??[]).toHaveLength(0); // Started work is never offered as ready.
  technician();
  const page=renderToStaticMarkup(await InternalJob({params:Promise.resolve({id:job.id})}));
  expect(page).toContain("Onsite now");expect(page).not.toContain(">Ready to work<");
 });
 it("retains reported completion in the manager's results-review queue",async()=>{
  const job=await dispatchJob(r,"person");
  await recordInternalWorkResult(dispatchServices(r),{organizationId:dispatchOrg,workOrderId:job.id,actor:dispatchActor(dispatchTech[0]),expectedVersion:0,expectedAssignmentId:job.initialAssignment!.id,key:crypto.randomUUID(),outcome:"completed"});
  const html=renderToStaticMarkup(await renderInternalDispatch({q:job.problem,view:"list"},false));expect(html).toContain("Reported done, needs a check");expect(html).toContain(job.number);expect(html).toContain("Reported done");
 });
});
