import { cachedDateTimeFormat } from "./intl-format-cache";
import { OpsDomainError } from "./errors";
import { addCalendarDays, type ScheduleProjection } from "./internal-schedule-types";
import { formatOperationsDate, formatOperationsDateTime } from "./local-time";
import { dispatchTime } from "./dispatch-board";

export function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + "T12:00:00Z")) || new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value) throw new OpsDomainError("VALIDATION", "Choose a valid calendar date.");
  return value;
}
export function assertPlanningZone(zone: string) {
  try { cachedDateTimeFormat("en", { timeZone: zone }).format(0); }
  catch { throw new OpsDomainError("VALIDATION", "A valid planning time zone is required."); }
  return zone;
}
export function civilDate(instant: string, zone: string) {
  const parts = cachedDateTimeFormat("en-CA", { timeZone: assertPlanningZone(zone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const pick = (kind: string) => parts.find(p => p.type === kind)!.value;
  return pick("year") + "-" + pick("month") + "-" + pick("day");
}
export function mondayOf(value: string) {
  calendarDate(value);
  return addCalendarDays(value, -((new Date(value + "T12:00:00Z").getUTCDay() + 6) % 7));
}
function localParts(instant: number, zone: string) {
  const parts = cachedDateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const pick = (kind: string) => parts.find(p => p.type === kind)!.value;
  return pick("year") + "-" + pick("month") + "-" + pick("day") + "T" + pick("hour") + ":" + pick("minute");
}
/** Enumerate zone offsets near the civil time; require an explicit choice for a fold. */
export function exactStoreInstant(local: string, zone: string, choice?: "earlier" | "later") {
  if (choice && !["earlier","later"].includes(choice)) throw new OpsDomainError("VALIDATION","Choose the earlier or later occurrence.");
  assertPlanningZone(zone);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new OpsDomainError("VALIDATION", "Enter the appointment date and time at the store.");
  calendarDate(local.slice(0,10));
  const candidate = Date.parse(local + ":00Z");
  if (!Number.isFinite(candidate) || new Date(candidate).toISOString().slice(0,16) !== local) throw new OpsDomainError("VALIDATION", "Choose a valid appointment time.");
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = candidate + hours * 3600000;
    offsets.add(Date.parse(localParts(sample, zone) + ":00Z") - sample);
  }
  const instants = [...offsets].map(offset => candidate - offset).filter(instant => localParts(instant, zone) === local).sort((a,b) => a-b);
  if (!instants.length) throw new OpsDomainError("VALIDATION", "This local time does not exist because the clocks change. Choose another time.");
  if (instants.length > 1 && !choice) throw new OpsDomainError("VALIDATION", "This time occurs twice when clocks change. Choose the earlier or later occurrence.");
  return new Date(choice === "later" ? instants.at(-1)! : instants[0]!).toISOString();
}
export function scheduleLabel(plan?: ScheduleProjection) {
  if (!plan) return "Unscheduled";
  const label = plan.precision === "week" ? "Week of " + formatOperationsDate(plan.week) : plan.precision === "appointment" && plan.startsAt ? formatOperationsDateTime(plan.startsAt, plan.entryZone) : formatOperationsDate(plan.day ?? plan.week) + " · Anytime";
  return label + (plan.tentative ? " · Tentative" : "");
}

/** Plain wording for a job's plan, used on lists and in the "Saved" note. */
export function plainScheduleLabel(plan?: Pick<ScheduleProjection, "precision" | "week" | "day" | "startsAt" | "entryZone" | "tentative">, organizationZone = plan?.entryZone ?? "America/New_York") {
  if (!plan || plan.precision === "removed") return "Not scheduled";
  const label = plan.precision === "week"
    ? `Week of ${formatOperationsDate(plan.week)}`
    : plan.precision === "appointment" && plan.startsAt
      ? dispatchTime(plan.startsAt, plan.entryZone ?? organizationZone, organizationZone)
      : `${formatOperationsDate(plan.day ?? plan.week)}, any time`;
  return plan.tentative ? `${label} (not confirmed)` : label;
}

const plainActions: Record<string, string> = {
  "Begin internal work": "Ready to work",
  "Arrange team pickup": "Needs a technician",
  "Arrange internal work": "Manager to assign",
  "Wait for a suitable internal visit": "Do on next visit",
  "Complete planned internal work": "Do the planned work",
  "Arrange remaining internal work": "Plan the rest of the work",
  "Confirm work was completed as expected": "Confirm the work is done",
};
/** Shows saved next-step wording for in-house work in everyday words. */
export function plainNextAction(text: string) {
  return plainActions[text] ?? text;
}
