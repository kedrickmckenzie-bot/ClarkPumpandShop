import { civilDate, mondayOf } from "./dispatch-calendar";
import type { InternalSchedule } from "./internal-schedule-types";
import type { OpsFixture, SiteVisitWorkOrderOutcome, WorkOrder } from "./types";

/**
 * A year of everyday in-house maintenance for the fictional showcase, so the team scorecard has
 * honest source records: about one job a week for each of the six technicians, each with
 * a planned day, one or two visits, and the result recorded at checkout.
 *
 * Each technician works differently, so the scorecard has something real to show:
 * - Maria (refrigeration, HVAC) and Devon (plumbing) are steady.
 * - Sam (refrigeration, foodservice) fixes first time, but more of his refrigeration fixes need
 *   another repair on the same equipment within 30 days.
 * - Alex (North) often goes back for parts — outside his control, so it is shown but not flagged —
 *   and misses more planned days.
 * - Jordan (electrical) and Riley (South: plumbing, electrical, fuel) sit in between.
 *
 * Insert-only and stable: every ID is index-based (prefix "inhouse-demo-"), so a hosted demo can
 * receive these records without a reset and a second run never duplicates them.
 */

const HOUR = 3_600_000, DAY = 86_400_000;
const ZONE = "America/New_York";
const CENTRAL = "region-northline-central", NORTH = "region-northline-north", SOUTH = "region-northline-south";

type Trade = "refrigeration" | "hvac" | "plumbing" | "electrical" | "foodservice" | "forecourt" | "doors";
interface TechPlan { id: string; trades: Array<[Trade, number]>; region: string; firstFix: number; partsShare: number; planMiss: number; repeat: number }

const TECHS: TechPlan[] = [
  { id: "membership-northline-tech-1", trades: [["refrigeration", 0.55], ["hvac", 0.45]], region: CENTRAL, firstFix: 0.9, partsShare: 0.5, planMiss: 0.08, repeat: 0.06 },
  { id: "membership-northline-tech-2", trades: [["plumbing", 0.8], ["doors", 0.2]], region: CENTRAL, firstFix: 0.92, partsShare: 0.5, planMiss: 0.1, repeat: 0.04 },
  { id: "membership-northline-tech-3", trades: [["plumbing", 0.45], ["electrical", 0.45], ["doors", 0.1]], region: NORTH, firstFix: 0.74, partsShare: 0.85, planMiss: 0.32, repeat: 0.06 },
  { id: "membership-northline-tech-4", trades: [["electrical", 0.8], ["doors", 0.2]], region: CENTRAL, firstFix: 0.9, partsShare: 0.5, planMiss: 0.08, repeat: 0.05 },
  { id: "membership-northline-tech-5", trades: [["refrigeration", 0.7], ["foodservice", 0.3]], region: CENTRAL, firstFix: 0.88, partsShare: 0.5, planMiss: 0.04, repeat: 0.6 },
  { id: "membership-northline-tech-6", trades: [["plumbing", 0.4], ["electrical", 0.3], ["forecourt", 0.3]], region: SOUTH, firstFix: 0.87, partsShare: 0.6, planMiss: 0.12, repeat: 0.05 },
];

const PROBLEMS: Record<Trade, Array<{ text: string; asset?: string; did: string }>> = {
  refrigeration: [
    { text: "Beer cave is running a few degrees warm", asset: "beer-cave", did: "Cleaned the condenser coil and reset the controller." },
    { text: "Walk-in freezer door gasket is torn", asset: "walk-in-freezer", did: "Replaced the door gasket and checked the seal." },
    { text: "Ice machine is making thin, slow ice", asset: "ice-machine", did: "Descaled the evaporator and cleaned the water filter." },
    { text: "Beer cave fan is noisy", asset: "beer-cave", did: "Replaced the evaporator fan motor." },
  ],
  hvac: [
    { text: "Sales floor is warm in the afternoon", asset: "rtu-1", did: "Replaced the filters and cleaned the condenser coil." },
    { text: "Thermostat does not hold the set temperature", asset: "rtu-1", did: "Recalibrated the thermostat and replaced its batteries." },
    { text: "Rooftop unit is short-cycling", asset: "rtu-1", did: "Replaced the contactor and tested the cycle." },
  ],
  plumbing: [
    { text: "Restroom sink drains slowly", did: "Cleared the drain line and tested the flow." },
    { text: "Toilet runs constantly in the men's restroom", did: "Replaced the flapper and fill valve." },
    { text: "Mop sink faucet is dripping", did: "Replaced the faucet cartridge." },
    { text: "Coffee bar sink is backing up", did: "Snaked the drain and cleaned the trap." },
  ],
  electrical: [
    { text: "Two lights are out over the checkout counter", did: "Replaced the lamps and one ballast." },
    { text: "Outlet behind the coffee bar has no power", did: "Reset the GFCI and replaced the faulty outlet." },
    { text: "Parking lot light pole is out", did: "Replaced the photocell and lamp." },
  ],
  foodservice: [
    { text: "Rapid-cook oven shows a heating error", asset: "rapid-cook-oven", did: "Cleaned the sensor and replaced the door switch." },
    { text: "Roller grill is not heating evenly", did: "Replaced a heating element." },
  ],
  forecourt: [
    { text: "Dispenser receipt printer is jamming", asset: "dispenser-2", did: "Cleared the jam and replaced the paper guide." },
    { text: "Pump handle holster is broken", asset: "dispenser-3", did: "Replaced the nozzle boot." },
  ],
  doors: [
    { text: "Front door closer is slamming", did: "Adjusted and replaced the door closer." },
    { text: "Back door lock is sticking", did: "Lubricated and replaced the lock cylinder." },
  ],
};

/** Small seeded random generator, separate from the operating history's, so neither shifts the other. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296; };
}

export function addInHouseWorkDemo(f: OpsFixture): OpsFixture {
  const org = f.organizations[0]?.id;
  const techs = TECHS.filter(t => f.memberships.some(m => m.id === t.id && m.organizationId === org && m.role === "internal_technician"));
  const stores = f.stores.filter(s => s.organizationId === org && /^store-northline-1\d\d$/u.test(s.id));
  if (!org || techs.length < 6 || stores.length !== 15 || f.workOrders.some(w => w.id.startsWith("inhouse-demo-"))) return f;
  const facilities = f.memberships.find(m => m.id === "membership-northline-facilities");
  const facilitiesName = f.users.find(u => u.id === facilities?.userId)?.displayName ?? "Facilities";
  const name = (membershipId: string) => f.users.find(u => u.id === f.memberships.find(m => m.id === membershipId)?.userId)?.displayName ?? "Technician";
  const assets = new Set(f.assets.filter(a => a.organizationId === org).map(a => a.id));
  const asOf = Date.parse(f.asOf), iso = (ms: number) => new Date(ms).toISOString();
  const rnd = random(20261015);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rnd() * items.length)]!;
  const between = (low: number, high: number) => low + rnd() * (high - low);
  const weighted = (items: Array<[Trade, number]>) => { let roll = rnd() * items.reduce((s, [, w]) => s + w, 0); for (const [t, w] of items) { roll -= w; if (roll <= 0) return t; } return items[0]![0]; };
  // Business hours in the stores' time zone: a weekday, 8am–3pm Eastern (UTC-4/5; 13:00 UTC is 8–9am).
  // Never earlier than the moment asked for: a time already past today moves to the next working day.
  const workday = (ms: number): number => {
    let d = ms;
    while ([0, 6].includes(new Date(d).getUTCDay())) d += DAY;
    const at = Date.parse(`${iso(d).slice(0, 10)}T13:00:00.000Z`) + between(0, 7) * HOUR;
    return at >= ms ? at : workday(Date.parse(`${iso(d + DAY).slice(0, 10)}T13:00:00.000Z`));
  };
  const schedules = (f.internalSchedules ??= []);
  let n = 0;

  const job = (tech: TechPlan, trade: Trade, created: number, forced?: { assetId: string; storeId: string; problem: string }) => {
    n++;
    const id = `inhouse-demo-${String(n).padStart(4, "0")}`;
    const home = stores.filter(s => s.regionId === tech.region);
    const problem = forced ? { text: forced.problem, did: "Found the same unit acting up again; repaired and tested.", asset: undefined } : pick(PROBLEMS[trade]);
    const store = forced ? stores.find(s => s.id === forced.storeId)! : pick(home);
    // Most in-house work is small and not tied to an equipment record; about one job in three is (more for refrigeration work).
    const assetId = forced?.assetId ?? (problem.asset && rnd() < (tech.repeat > 0.2 ? 0.55 : 0.2) && assets.has(`asset-${store.storeNumber}-${problem.asset}`) ? `asset-${store.storeNumber}-${problem.asset}` : undefined);
    const priority: WorkOrder["priority"] = rnd() < 0.2 ? "urgent" : "routine";
    const assignedAt = created + between(0.3, 3) * HOUR;
    const assignmentId = `${id}-assignment`;
    // Planned day: a day or two out for urgent work, within the week otherwise.
    const plannedMs = workday(assignedAt + (priority === "urgent" ? between(2, 20) : between(20, 110)) * HOUR);
    const planned = !forced && rnd() < 0.75;
    const missed = planned && rnd() < tech.planMiss;
    const movedAhead = planned && !missed && rnd() < 0.1;
    let start = missed ? workday(plannedMs + between(1, 3) * DAY) : movedAhead ? workday(plannedMs + between(1, 2) * DAY) : planned ? plannedMs : workday(assignedAt + between(2, 30) * HOUR);
    if (forced) start = workday(created + between(2, 26) * HOUR);
    const fixedFirst = forced ? true : rnd() < tech.firstFix;
    const reason: SiteVisitWorkOrderOutcome = rnd() < tech.partsShare ? "parts_required" : "return_visit_required";
    const visits: Array<{ start: number; end: number; outcome: SiteVisitWorkOrderOutcome }> = [];
    let end = start + between(30, 140) * 60_000;
    visits.push({ start, end, outcome: fixedFirst ? "completed" : reason });
    if (!fixedFirst) {
      start = workday(end + (reason === "parts_required" ? between(1, 4) : between(0.6, 2)) * DAY);
      end = start + between(30, 120) * 60_000;
      visits.push({ start, end, outcome: "completed" });
    }
    if (end > asOf - HOUR) return undefined;
    const number = `CPS-${new Date(created).getUTCFullYear()}-${String(7000 + n).padStart(4, "0")}`;
    // About one job in eleven is something the tech spotted on site and reported themselves.
    f.workOrders.push({ id, organizationId: org, number, storeId: store.id, problem: problem.text, categoryKey: trade, assetId, priority, status: "closed", version: 0, foundByMembershipId: !forced && n % 11 === 0 ? tech.id : undefined,
      accountableParty: "No action required", nextAction: "No action required", createdAt: iso(created), dueAt: iso(plannedMs + 10 * HOUR), closedAt: iso(end + between(0.2, 2) * HOUR), requireConfirmation: false });
    f.assignments.push({ id: assignmentId, organizationId: org, workOrderId: id, kind: "internal", internalTarget: "person", internalMembershipId: tech.id, status: "completed", assignedAt: iso(assignedAt) });
    if (planned) {
      const plan = (revision: number, dayMs: number, recordedAt: number): InternalSchedule => {
        const day = civilDate(iso(dayMs), ZONE);
        return { id: `${id}-plan-${revision}`, organizationId: org, workOrderId: id, assignmentId, revision, attempt: 1, precision: "day", planningZone: ZONE, week: mondayOf(day), day, tentative: false,
          supersedesId: revision > 1 ? `${id}-plan-${revision - 1}` : undefined, recordedBy: facilities?.id ?? "membership-northline-facilities", recordedByName: facilitiesName, recordedAt: iso(recordedAt) };
      };
      schedules.push(plan(1, plannedMs, assignedAt + 20 * 60_000));
      // Moved ahead of time (the day before): the new day is the one that counts.
      if (movedAhead) schedules.push(plan(2, visits[0]!.start, Math.max(assignedAt + 30 * 60_000, plannedMs - 14 * HOUR)));
      // Missed, then re-planned the next morning: the miss still counts.
      if (missed) schedules.push(plan(2, visits[0]!.start, Math.min(visits[0]!.start - 2 * HOUR, workday(plannedMs + DAY) - 4 * HOUR)));
    }
    visits.forEach((visit, index) => {
      const visitId = `${id}-visit-${index + 1}`, done = visit.outcome === "completed";
      const outcomeNotes = done ? problem.did : visit.outcome === "parts_required" ? "Diagnosed; ordered the part. Coming back to install it." : "Need more time on site; coming back to finish.";
      f.visits.push({ id: visitId, organizationId: org, storeId: store.id, providerKind: "internal", internalMembershipId: tech.id, workOrderId: id, technicianName: name(tech.id), providerName: `${f.organizations[0]!.name} Maintenance`, purpose: problem.text, crewCount: 1,
        status: "checked_out", startedChannel: "store_device", endedChannel: "store_device", checkedInAt: iso(visit.start), checkedOutAt: iso(visit.end), outcome: done ? "resolved" : visit.outcome === "parts_required" ? "diagnosed_waiting_parts" : "return_required", outcomeNotes, observedDurationSeconds: Math.round((visit.end - visit.start) / 1000) });
      const followUpId = done ? undefined : `${visitId}-follow-up`;
      if (followUpId) f.followUps.push({ id: followUpId, organizationId: org, workOrderId: id, sourceVisitId: visitId, accountableParty: name(tech.id), nextAction: visit.outcome === "parts_required" ? "Return with the part" : "Return to finish the repair", dueAt: iso(visit.end + 72 * HOUR), escalationTo: "Facilities director", status: "completed", createdAt: iso(visit.end), completedAt: iso(visits[index + 1]!.end) });
      f.siteVisitWorkOrders.push({ id: `site-visit-work-${visitId}-${id}`, organizationId: org, visitId, workOrderId: id, ordinal: 1, linkedByActorType: "system", linkedByActorName: "Deterministic demo fixture", linkedAt: iso(visit.start),
        outcome: visit.outcome, outcomeNotes, outcomeRecordedByActorType: "user", outcomeRecordedByActorId: tech.id, outcomeRecordedByActorName: name(tech.id), outcomeRecordedAt: iso(visit.end), followUpId });
      // No check-in location records: in-house check-in is optional, and the scorecard never uses them.
    });
    rnd(); // One draw kept where parts costs used to be, so the tuned demo story stays the same.
    return { id, end, assetId, storeId: store.id, problem: problem.text };
  };

  // One year back, oldest first: about one job a week for each technician.
  for (let week = 52; week >= 1; week--) {
    for (const tech of techs) {
      const count = rnd() < 0.15 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const trade = weighted(tech.trades);
        const done = job(tech, trade, workday(asOf - week * 7 * DAY + between(0, 4) * DAY));
        // Another repair on the same equipment within 30 days.
        if (done?.assetId && rnd() < tech.repeat) {
          // The pattern is the technician's own: they go back to it (a draw is kept so dates stay put).
          rnd();
          const fixer = tech;
          job(fixer, trade, done.end + between(4, 24) * DAY, { assetId: done.assetId, storeId: done.storeId, problem: `${done.problem} again` });
        }
      }
    }
  }
  return f;
}
