import { addAiDiagnosticDemo } from "./ai-demo-fixture";
import type { OpsFixture } from "./types";
import { addCalendarDays } from "./internal-schedule-types";
import { mondayOf } from "./dispatch-calendar";
const examples = [
  {
    "store": 104,
    "problem": "The beer cave is above temperature and the evaporator fan stops intermittently. Product has been moved to backup coolers.",
    "status": "Work started",
    "urgent": true
  },
  {
    "store": 101,
    "problem": "The walk-in freezer door does not seal along the lower hinge and frost is building up inside.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 105,
    "problem": "The rooftop unit shuts down after twenty minutes and the sales floor gets warm each afternoon.",
    "status": "Waiting on parts",
    "urgent": false
  },
  {
    "store": 109,
    "problem": "Water is collecting under the reach-in cooler near the sandwich display. Check the drain and insulation.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 112,
    "problem": "The beverage cooler door gasket is torn at the bottom; replace it during the next suitable visit.",
    "status": "Next visit",
    "urgent": false
  },
  {
    "store": 106,
    "problem": "The customer restroom sink is leaking from the trap into the cabinet. The sink is temporarily closed.",
    "status": "Work started",
    "urgent": true
  },
  {
    "store": 111,
    "problem": "The mop sink faucet will not fully shut off and runs continuously after cleaning.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 108,
    "problem": "The handwashing sink in food prep drains slowly and backs up during the lunch rush.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 115,
    "problem": "The exterior hose bib leaks at the handle whenever the washdown hose is connected.",
    "status": "Next visit",
    "urgent": false
  },
  {
    "store": 102,
    "problem": "The replacement flush valve has not arrived; the second customer toilet remains closed.",
    "status": "Waiting on parts",
    "urgent": false
  },
  {
    "store": 103,
    "problem": "Two canopy lights over the east fuel island flicker and then go dark after sunset.",
    "status": "Ready",
    "urgent": true
  },
  {
    "store": 107,
    "problem": "The stockroom light switch is loose in its box and the cover plate is cracked.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 110,
    "problem": "The replacement driver for the entrance sign is on order; the lower sign panel remains dark.",
    "status": "Waiting on parts",
    "urgent": false
  },
  {
    "store": 114,
    "problem": "The loading-area motion light does not switch on when staff leave through the rear door.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 108,
    "problem": "The main entrance door drags on the threshold and does not close without being pulled shut.",
    "status": "Work started",
    "urgent": true
  },
  {
    "store": 113,
    "problem": "The stockroom door closer slams the door and needs adjustment before the afternoon delivery.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 104,
    "problem": "The rear delivery door weather strip is missing and rainwater enters along the lower edge.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 110,
    "problem": "The ice machine is leaking onto the beverage-island floor. Staff have isolated the area and shut off the water.",
    "status": "Work started",
    "urgent": true
  },
  {
    "store": 102,
    "problem": "The hot holding cabinet does not maintain its set temperature; it is out of service pending inspection.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 112,
    "problem": "The air station hose coupling leaks and customers cannot inflate their tires reliably.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 115,
    "problem": "A loose bumper at the west parking space needs securing; the store has marked the space off.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 103,
    "problem": "The windshield-wash station bracket is detached from its post beside the north island.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 109,
    "problem": "The rear gate wheel is seized and staff cannot open it fully for waste collection.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 105,
    "problem": "The bollard sleeve at the front entrance is cracked; replace it during a suitable store visit.",
    "status": "Next visit",
    "urgent": false
  },
  {
    "store": 114,
    "problem": "The back-room floor drain is backing up and water is approaching stored cartons. The manager needs help today.",
    "status": "Ready",
    "urgent": true
  },
  {
    "store": 101,
    "problem": "The automatic entrance door stalls halfway open, restricting customer access during busy periods.",
    "status": "Ready",
    "urgent": true
  },
  {
    "store": 113,
    "problem": "The food-prep faucet handle spins without controlling the hot water. Staff are using the second sink.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 107,
    "problem": "A shelf support in the stockroom is bent; the affected shelf has been emptied and marked off.",
    "status": "Ready",
    "urgent": false
  },
  {
    "store": 108,
    "problem": "The rear door sweep is worn and leaves a gap at the bottom. Replace when a technician is nearby.",
    "status": "Next visit",
    "urgent": false
  },
  {
    "store": 106,
    "problem": "The coffee counter splash guard needs reattaching after a cleaning crew removed its loose fasteners.",
    "status": "Next visit",
    "urgent": false
  }
];
const people = [
  ["Maria Santos", "refrigeration", "hvac"], ["Devon Price", "plumbing", "general_repairs"],
  ["Alex Morgan", "electrical", "lighting"], ["Jordan Brooks", "doors", "general_repairs"],
  ["Sam Patel", "foodservice", "refrigeration"], ["Riley Chen", "forecourt", "plumbing"],
];
/** Fictional stable-ID additions. Persisted facts win during insert-only backfill. */
// Planning labels for demo jobs whose opening words don't make a good short name.
const demoShortNames: Record<string, string> = {
  "Water is collecting under the reach-in c": "Reach-in cooler leak",
  "The replacement flush valve has not arri": "Toilet flush valve",
  "The replacement driver for the entrance ": "Entrance sign",
  "The rear delivery door weather strip is ": "Rear door weather strip",
};

/**
 * Home districts. In the seeded showcase the in-house team is based near the Central shop
 * (four techs), with one tech each in North and South for small jobs.
 */
const CENTRAL_TEAM_HOMES = ["region-northline-central", "region-northline-central", "region-northline-north", "region-northline-central", "region-northline-central", "region-northline-south"];

/** Central-team showcase: most open in-house jobs sit at Central stores; the Store 104/101 refrigeration stories stay put. */
function centralStore(store: number, index: number) {
  if (store >= 106 && store <= 110 || store === 104 || store === 101) return store;
  return index % 3 === 0 ? store : 106 + index % 5;
}

export function addDispatchDemo(f: OpsFixture, options: { centralTeam?: boolean } = {}): OpsFixture {
  const org=f.organizations[0].id, date=f.asOf.slice(0,10), createdAt=`${addCalendarDays(date,-1)}T12:00:00.000Z`;
  const facility="membership-northline-facilities", manager="membership-northline-field-manager";
  const managerName=f.users.find(u=>u.id===f.memberships.find(m=>m.id===manager)?.userId)!.displayName;
  const facilityName=f.users.find(u=>u.id===f.memberships.find(m=>m.id===facility)?.userId)!.displayName;
  people.forEach(([name,...skills],i)=>{
    const membershipId=`membership-northline-tech-${i+1}`;
    if(i>=2){
      const userId=`dispatch-study-user-${i+1}`;
      f.users.push({id:userId,displayName:name,email:`dispatch.tech${i+1}@northline.example`,status:"active",createdAt});
      f.memberships.push({id:membershipId,organizationId:org,userId,role:"internal_technician",status:"active",createdAt});
      f.scopeGrants.push({id:`dispatch-study-grant-${i+1}`,organizationId:org,membershipId,scopeKind:"organization",scopeId:org,permission:"ops:write",createdAt});
    }
    (f.technicianProfiles??=[]).push({id:`dispatch-study-profile-${i+1}`,organizationId:org,membershipId,homeRegionId:options.centralTeam&&f.regions.some(r=>r.id===CENTRAL_TEAM_HOMES[i])?CENTRAL_TEAM_HOMES[i]:f.regions[i%f.regions.length].id,skillsJson:JSON.stringify(skills)});
  });
  const allocation=[0,0,0,0,0,1,1,1,1,1,2,2,2,2,3,3,3,4,4,5,5,5,5,5];
  examples.forEach((e,i)=>{
    const tech=allocation[i], membershipId=tech===undefined?undefined:`membership-northline-tech-${tech+1}`;
    const id=`dispatch-study-job-${i+1}`, assignmentId=`${id}-assignment`, storeId=`store-northline-${options.centralTeam?centralStore(e.store,i):e.store}`;
    const waiting=e.status==="Waiting on parts", held=e.status==="Next visit", started=e.status==="Work started";
    const who=tech===undefined?managerName:people[tech][0];
    const day=addCalendarDays(date,started?0:i%4===0?0:i%5===0?2:i%3===0?1:0);
    const dueAt=`${addCalendarDays(date,i===25?-1:i%3===0?0:2)}T16:00:00.000Z`;
    const nextAction=waiting?"Arrange parts":held?"Wait for a suitable internal visit":membershipId?"Begin internal work":"Arrange team pickup";
    const categoryKey=tech===undefined?["plumbing","doors","plumbing","general_repairs","doors","foodservice"][i-24]:people[tech][1];
    f.workOrders.push({id,organizationId:org,number:`CPS-2026-${String(8401+i).padStart(4,"0")}`,storeId,problem:e.problem,shortName:demoShortNames[e.problem.slice(0,40)],categoryKey,priority:e.urgent?"urgent":"routine",status:waiting?"waiting_on_parts":started?"in_progress":"approved",version:0,internalAccountableType:"membership",internalAccountableId:manager,internalAccountableParty:managerName,accountableParty:waiting||held?managerName:who,nextAction,dueAt,escalationTo:"Facilities leadership",createdAt});
    f.assignments.push({id:assignmentId,organizationId:org,workOrderId:id,kind:"internal",internalTarget:membershipId?"person":"pool",internalMembershipId:membershipId,status:membershipId?"accepted":"pending",assignedAt:createdAt});
    if(!held && (started||i%7!==0)){
      const scheduleId=`${id}-schedule`;
      (f.internalSchedules??=[]).push({id:scheduleId,organizationId:org,workOrderId:id,assignmentId,revision:1,attempt:1,precision:"day",planningZone:f.organizations[0].timeZone,week:mondayOf(day),day,durationMinutes:i%3===0?undefined:[30,90,180,240,45][i%5],tentative:waiting,reviewReason:waiting?"Replacement part requested":undefined,recordedBy:facility,recordedByName:facilityName,recordedAt:createdAt});
      f.workOrders.at(-1)!.internalScheduleId=scheduleId;
    }
    f.workflowTasks.push({id:`${id}-task`,organizationId:org,workOrderId:id,taskType:"other",title:nextAction,reason:e.problem,assigneeType:"user",assigneeId:waiting||held?manager:membershipId??manager,assigneeName:waiting||held?managerName:who,priority:e.urgent?"high":"normal",status:"open",blocking:true,requiredForProgress:true,dueAt,completionCriteria:"Arrange internal service and record its outcome",escalationDestination:"Facilities leadership",escalationLevel:0,createdByActorType:"user",createdByActorId:facility,createdByActorName:facilityName,createdAt});
    if(waiting){
      const followUpId=`${id}-follow-up`;
      const task=f.workflowTasks.at(-1)!;task.taskType="schedule_return_visit";task.sourceFollowUpId=followUpId;
      f.followUps.push({id:followUpId,organizationId:org,workOrderId:id,accountableParty:managerName,nextAction:"Arrange replacement parts",dueAt,escalationTo:"Facilities leadership",status:"open",createdAt});
      (f.workResults??=[]).push({id:`${id}-result`,organizationId:org,workOrderId:id,assignmentId,performerMembershipId:membershipId,performerName:who,source:"technician_report",blocker:"parts",outcome:"parts_required",outcomeNotes:e.problem,outcomeRecordedAt:createdAt,outcomeRecordedByActorType:"user",outcomeRecordedByActorId:membershipId,outcomeRecordedByActorName:who,cycleVersion:1,linkedAt:createdAt,followUpId});
    }
    f.auditEvents.push({id:`${id}-audit`,organizationId:org,aggregateType:"work_order",aggregateId:id,eventType:"internal_dispatch.seeded",actorType:"system",actorName:"Fictional dispatch demo",occurredAt:createdAt,payloadJson:JSON.stringify({meaning:"fictional_example",internalTarget:membershipId?"person":"pool"})});
    if(held)(f.workOrderVisitHolds??=[]).push({id:`${id}-hold`,organizationId:org,workOrderId:id,posture:"complete_using_professional_judgment",status:"active",deadlineAt:dueAt,version:0,createdByMembershipId:facility,createdByName:facilityName,createdAt,updatedAt:createdAt});
  });
  return addAiDiagnosticDemo(f);
}
