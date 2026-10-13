/**
 * Refrigerant leak rules for equipment, kept plain and transparent.
 *
 * EPA AIM Act rule (from January 1, 2026): equipment holding 15 lb or more of an HFC refrigerant (or a substitute
 * with a climate-impact number, GWP, above 53) must have its leak rate worked out every time refrigerant is added.
 * Over the limit (20% commercial refrigeration, 10% comfort cooling) the leak must be repaired within 30 days and
 * checked again afterwards. Equipment that loses 125% or more of its full charge in a year is reported by March 1.
 * Small rooftop or split AC units (residential and light commercial AC) are exempt.
 * Older ozone-depleting refrigerants such as R-22 follow the same limits under Section 608 at 50 lb or more.
 *
 * The app records facts and does the math. It never decides whether a leak "really" happened.
 */

export type RefrigerantSystemUse = "commercial_refrigeration" | "comfort_cooling" | "light_commercial_ac";
export type RefrigerantChargeSource = "nameplate" | "installer" | "estimate";
export type RefrigerantLeakStatus = "none_found" | "found_repaired" | "found_not_repaired" | "not_checked";
export type RefrigerantRule = "aim" | "section608";

/** The refrigerant facts for one piece of equipment. Each change is a new version; old versions stay. */
export interface AssetRefrigerant {
  organizationId: string;
  assetId: string;
  version: number;
  refrigerant: string;
  fullChargeOz?: number;
  systemUse: RefrigerantSystemUse;
  chargeSource?: RefrigerantChargeSource;
  recordedByName: string;
  recordedByActorId?: string;
  createdAt: string;
}

/** One refrigerant record: refrigerant added and leak found, or a leak check after a repair. Never edited. */
export interface RefrigerantEvent {
  id: string;
  organizationId: string;
  assetId: string;
  storeId: string;
  workOrderId?: string;
  visitId?: string;
  kind: "service" | "verification";
  /** The day the work happened, as reported. */
  occurredAt: string;
  addedOz: number;
  leakStatus?: RefrigerantLeakStatus;
  verificationStage?: "initial" | "follow_up";
  verificationResult?: "passed" | "failed";
  /** Facts as they stood when this was recorded, so later edits never rewrite history. */
  refrigerant: string;
  fullChargeOz?: number;
  rule?: RefrigerantRule;
  leakRateBps?: number;
  thresholdBps?: number;
  technicianName: string;
  technicianCert?: string;
  source: "vendor" | "internal" | "office";
  recordedByName: string;
  recordedByActorId?: string;
  notes?: string;
  createdAt: string;
}

export interface RefrigerantEquipmentRow {
  assetId: string;
  assetName: string;
  assetTag: string;
  categoryKey: string;
  storeId: string;
  storeNumber: string;
  storeName: string;
  refrigerant?: AssetRefrigerant;
}

type Kind = "hfc" | "hcfc" | "low_gwp";
/** Common c-store refrigerants with their GWP (the EPA's AR4 values). */
export const REFRIGERANTS: ReadonlyArray<{ code: string; gwp: number; kind: Kind; usedIn: string }> = [
  { code: "R-404A", gwp: 3922, kind: "hfc", usedIn: "Walk-ins, freezers, ice machines" },
  { code: "R-448A", gwp: 1387, kind: "hfc", usedIn: "Walk-ins, beer caves (R-404A replacement)" },
  { code: "R-449A", gwp: 1397, kind: "hfc", usedIn: "Walk-ins, beer caves (R-404A replacement)" },
  { code: "R-407A", gwp: 2107, kind: "hfc", usedIn: "Refrigeration racks" },
  { code: "R-407F", gwp: 1825, kind: "hfc", usedIn: "Refrigeration racks" },
  { code: "R-507A", gwp: 3985, kind: "hfc", usedIn: "Freezers" },
  { code: "R-134a", gwp: 1430, kind: "hfc", usedIn: "Reach-ins, coolers" },
  { code: "R-513A", gwp: 631, kind: "hfc", usedIn: "Coolers (R-134a replacement)" },
  { code: "R-450A", gwp: 605, kind: "hfc", usedIn: "Coolers (R-134a replacement)" },
  { code: "R-452A", gwp: 2140, kind: "hfc", usedIn: "Condensing units" },
  { code: "R-422D", gwp: 2729, kind: "hfc", usedIn: "R-22 retrofits" },
  { code: "R-438A", gwp: 2265, kind: "hfc", usedIn: "R-22 retrofits" },
  { code: "R-407C", gwp: 1774, kind: "hfc", usedIn: "Older AC" },
  { code: "R-410A", gwp: 2088, kind: "hfc", usedIn: "Rooftop units, AC" },
  { code: "R-454B", gwp: 466, kind: "hfc", usedIn: "Newer rooftop units, AC" },
  { code: "R-32", gwp: 675, kind: "hfc", usedIn: "Newer AC" },
  { code: "R-454C", gwp: 148, kind: "hfc", usedIn: "Newer refrigeration" },
  { code: "R-455A", gwp: 148, kind: "hfc", usedIn: "Newer refrigeration" },
  { code: "R-22", gwp: 1810, kind: "hcfc", usedIn: "Older AC and refrigeration (Section 608)" },
  { code: "R-290", gwp: 3, kind: "low_gwp", usedIn: "Propane reach-ins and coolers" },
  { code: "R-600a", gwp: 3, kind: "low_gwp", usedIn: "Small coolers" },
  { code: "R-744", gwp: 1, kind: "low_gwp", usedIn: "CO2 systems" },
  { code: "R-1234yf", gwp: 1, kind: "low_gwp", usedIn: "Newer low-impact systems" },
  { code: "R-1234ze", gwp: 1, kind: "low_gwp", usedIn: "Newer low-impact systems" },
];

export const SYSTEM_USE_LABELS: Record<RefrigerantSystemUse, string> = {
  commercial_refrigeration: "Refrigeration (walk-ins, beer caves, cases, ice machines)",
  comfort_cooling: "Building cooling (larger rooftop units, over about 5 tons)",
  light_commercial_ac: "Small AC (rooftop or split, about 5 tons or less)",
};

export const CHARGE_SOURCE_LABELS: Record<RefrigerantChargeSource, string> = {
  nameplate: "From the equipment tag",
  installer: "From the installer or vendor",
  estimate: "Best estimate",
};

export const LEAK_STATUS_LABELS: Record<RefrigerantLeakStatus, string> = {
  none_found: "No leak found",
  found_repaired: "Leak found and repaired",
  found_not_repaired: "Leak found, not repaired yet",
  not_checked: "Didn't check for a leak",
};

export const AIM_START = "2026-01-01";
const OZ_PER_LB = 16;
const AIM_MIN_OZ = 15 * OZ_PER_LB;
const SECTION_608_MIN_OZ = 50 * OZ_PER_LB;
const LIMIT_BPS: Record<Exclude<RefrigerantSystemUse, "light_commercial_ac">, number> = { commercial_refrigeration: 2000, comfort_cooling: 1000 };
export const REPAIR_DAYS = 30;
export const FOLLOW_UP_CHECK_DAYS = 10;
const DAY_MS = 86_400_000;

export function refrigerantInfo(code: string | undefined) {
  return REFRIGERANTS.find((row) => row.code.toLowerCase() === code?.trim().toLowerCase());
}

/** "22 lb", "1.5 lb", "12 oz" */
export function formatCharge(oz: number | undefined) {
  if (oz === undefined) return "Not recorded";
  if (oz > 0 && oz < OZ_PER_LB) return `${oz} oz`;
  const pounds = Math.round((oz / OZ_PER_LB) * 10) / 10;
  return `${pounds.toLocaleString("en-US")} lb`;
}

/** Pounds as typed ("22", "1.5", "0") to whole ounces. Undefined when blank. */
export function poundsToOz(value: unknown, label = "Amount") {
  const raw = typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
  if (!raw) return undefined;
  const pounds = Number(raw);
  if (!Number.isFinite(pounds) || pounds < 0 || pounds > 5000) throw new RangeError(`${label} must be a number of pounds between 0 and 5,000.`);
  return Math.round(pounds * OZ_PER_LB);
}

export function formatRate(bps: number | undefined) {
  return bps === undefined ? "—" : `${(Math.round(bps / 10) / 10).toLocaleString("en-US")}%`;
}

export interface RefrigerantCoverage {
  /** true = the leak rules apply, false = they don't, undefined = we can't tell yet. */
  covered?: boolean;
  rule?: RefrigerantRule;
  thresholdBps?: number;
  /** One plain sentence saying why. */
  reason: string;
  /** What to add so the app can tell, when covered is undefined. */
  missing?: "refrigerant" | "charge";
}

/** Whether the EPA leak rules apply to this equipment on a given day. */
export function refrigerantCoverage(facts: Pick<AssetRefrigerant, "refrigerant" | "fullChargeOz" | "systemUse"> | undefined, onDate = new Date().toISOString()): RefrigerantCoverage {
  if (!facts?.refrigerant) return { reason: "Add the refrigerant type to see if the leak rules apply.", missing: "refrigerant" };
  const info = refrigerantInfo(facts.refrigerant);
  if (!info) return { reason: `${facts.refrigerant} isn't in our list. Check the equipment tag.`, missing: "refrigerant" };
  if (info.kind === "low_gwp") return { covered: false, reason: `${info.code} has a very low climate impact, so the leak rules don't apply.` };
  if (facts.fullChargeOz === undefined) return { reason: "Add how much refrigerant it holds to see if the leak rules apply.", missing: "charge" };
  if (info.kind === "hcfc") {
    if (facts.fullChargeOz < SECTION_608_MIN_OZ) return { covered: false, reason: `Holds less than 50 lb of ${info.code}, so the leak repair rules don't apply.` };
    if (facts.systemUse === "light_commercial_ac") return { covered: true, rule: "section608", thresholdBps: LIMIT_BPS.comfort_cooling, reason: `Holds 50 lb or more of ${info.code}. Leak limit 10% a year (Section 608).` };
    const limit = LIMIT_BPS[facts.systemUse];
    return { covered: true, rule: "section608", thresholdBps: limit, reason: `Holds 50 lb or more of ${info.code}. Leak limit ${limit / 100}% a year (Section 608).` };
  }
  if (facts.systemUse === "light_commercial_ac") return { covered: false, reason: "Small AC units are exempt from the AIM leak rules." };
  if (facts.fullChargeOz < AIM_MIN_OZ) return { covered: false, reason: `Holds less than 15 lb, so the AIM leak rules don't apply.` };
  if (onDate.slice(0, 10) < AIM_START) return { covered: false, reason: "The AIM leak rules start January 1, 2026." };
  const limit = LIMIT_BPS[facts.systemUse];
  return { covered: true, rule: "aim", thresholdBps: limit, reason: `Holds 15 lb or more of ${info.code}. Leak limit ${limit / 100}% a year (AIM Act).` };
}

/**
 * EPA "annualizing" leak rate, in basis points (100 = 1%):
 * pounds added ÷ full charge × 365 ÷ (days since refrigerant was last added, at most 365).
 */
export function leakRateBps(addedOz: number, fullChargeOz: number, daysSinceLastAdd?: number) {
  if (addedOz <= 0 || fullChargeOz <= 0) return 0;
  const days = Math.min(365, Math.max(1, daysSinceLastAdd ?? 365));
  return Math.round((addedOz / fullChargeOz) * (365 / days) * 10_000);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY_MS);
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(date.slice(0, 10)) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The leak rate for a new addition, given the earlier records for the same equipment. */
export function leakRateForAddition(previous: readonly RefrigerantEvent[], occurredAt: string, addedOz: number, fullChargeOz: number) {
  const lastAdd = previous
    .filter((event) => event.kind === "service" && event.addedOz > 0 && event.occurredAt <= occurredAt)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt))[0];
  return leakRateBps(addedOz, fullChargeOz, lastAdd ? daysBetween(lastAdd.occurredAt, occurredAt) : undefined);
}

export type LeakClockStatus = "repair_due" | "repair_overdue" | "check_due" | "check_overdue" | "closed";
export interface LeakClock {
  assetId: string;
  /** The over-limit record that started the clock. */
  startEventId: string;
  startedOn: string;
  leakRateBps: number;
  thresholdBps: number;
  repairDueOn: string;
  repairedOn?: string;
  checkDueOn?: string;
  closedOn?: string;
  status: LeakClockStatus;
  workOrderId?: string;
}

/**
 * Walks one unit's records in date order. An addition over the limit starts a 30-day repair clock; a repair moves
 * it to "follow-up check due" (about 10 days); a passed follow-up check closes it; a failed check reopens the repair.
 */
export function leakClocks(events: readonly RefrigerantEvent[], today: string): LeakClock[] {
  const clocks: LeakClock[] = [];
  let open: LeakClock | undefined;
  const ordered = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt));
  for (const event of ordered) {
    const day = event.occurredAt.slice(0, 10);
    const overLimit = event.kind === "service" && event.leakRateBps !== undefined && event.thresholdBps !== undefined && event.leakRateBps > event.thresholdBps;
    if (overLimit && !open) {
      open = { assetId: event.assetId, startEventId: event.id, startedOn: day, leakRateBps: event.leakRateBps!, thresholdBps: event.thresholdBps!, repairDueOn: addDays(day, REPAIR_DAYS), status: "repair_due", workOrderId: event.workOrderId };
      clocks.push(open);
    }
    if (!open) continue;
    if (event.kind === "service" && event.leakStatus === "found_repaired") {
      open.repairedOn = day;
      open.checkDueOn = addDays(day, FOLLOW_UP_CHECK_DAYS);
    }
    if (event.kind === "verification") {
      if (event.verificationResult === "failed") { open.repairedOn = undefined; open.checkDueOn = undefined; }
      else if (event.verificationResult === "passed" && event.verificationStage === "follow_up" && open.repairedOn) { open.closedOn = day; open = undefined; }
      else if (event.verificationResult === "passed" && !open.repairedOn) { open.repairedOn = day; open.checkDueOn = addDays(day, FOLLOW_UP_CHECK_DAYS); }
    }
  }
  for (const clock of clocks) {
    clock.status = clock.closedOn ? "closed"
      : clock.repairedOn ? (today > clock.checkDueOn! ? "check_overdue" : "check_due")
        : today > clock.repairDueOn ? "repair_overdue" : "repair_due";
  }
  return clocks;
}

export const CLOCK_LABELS: Record<LeakClockStatus, string> = {
  repair_due: "Repair due",
  repair_overdue: "Repair overdue",
  check_due: "Follow-up leak check due",
  check_overdue: "Follow-up leak check overdue",
  closed: "Closed",
};

/** Refrigerant added in one calendar year as a share of the full charge (basis points). 12,500 = chronic leaker. */
export function yearlyLossBps(events: readonly RefrigerantEvent[], year: number, fullChargeOz: number | undefined) {
  if (!fullChargeOz) return undefined;
  const added = events.filter((event) => event.kind === "service" && event.occurredAt.startsWith(String(year))).reduce((sum, event) => sum + event.addedOz, 0);
  return Math.round((added / fullChargeOz) * 10_000);
}

export const CHRONIC_LEAK_BPS = 12_500;
