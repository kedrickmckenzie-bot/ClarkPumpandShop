import type {
  Asset, CostLine, FollowUp, InvoiceAllocation, InvoiceReference, Organization, ServiceAppointment, Store, Vendor,
  VendorResponse, VisitEvidence, VisitOutcome, VisitSession, WorkOrder, WorkOrderAssignment, WorkOrderIssuance, WorkOrderVerification,
} from "./types";

/**
 * Two years of everyday maintenance for the fictional Clark Pump and Shop showcase.
 *
 * The story it tells, so every page has honest data behind it:
 * - Central District stores sit near the shop: the in-house team does most of their work.
 *   North and South are mostly vendor work; vendors still do Central jobs that need a specialist.
 * - Work follows the seasons: refrigeration and cooling peak in summer, heating and snow in winter.
 * - Each vendor behaves differently, so scorecards show real differences: ColdLine is fast and
 *   reliable but costs the most; ClearFlow is good in Central and slower in the South, with more
 *   HVAC return visits; PumpPro answers fastest; BrightLine sometimes declines or pushes a date;
 *   GreenLot is busy in winter. ColdLine and ClearFlow both do HVAC, so one type of work compares.
 * - Most vendor jobs need a repair check before they close; a few checks are rejected and the
 *   vendor comes back. The last days hold open work in every state (waiting for a check, some
 *   overdue; waiting on a vendor; a recent decline; new urgent jobs).
 *
 * Deterministic: the same records every time. Dates are relative to the fixture's as-of moment.
 */

export interface OperatingHistoryInput {
  organization: Organization;
  stores: Store[];
  vendors: Vendor[];
  assets: Asset[];
  asOf: string;
  technicianNames: Record<string, string>;
  storeManagerNames: Record<string, string>;
  facilitiesMembershipId: string;
}

export interface OperatingHistory {
  workOrders: WorkOrder[];
  assignments: WorkOrderAssignment[];
  issuances: WorkOrderIssuance[];
  vendorResponses: VendorResponse[];
  serviceAppointments: ServiceAppointment[];
  visits: VisitSession[];
  visitEvidence: VisitEvidence[];
  followUps: FollowUp[];
  workOrderVerifications: WorkOrderVerification[];
  costLines: CostLine[];
  invoiceReferences: InvoiceReference[];
  invoiceAllocations: InvoiceAllocation[];
}

const HOUR = 3_600_000, DAY = 86_400_000;
const COLDLINE = "vendor-northline-summit", CLEARFLOW = "vendor-northline-cedar", PUMPPRO = "vendor-northline-forecourt", BRIGHTLINE = "vendor-northline-brightpath", GREENLOT = "vendor-northline-four-seasons";
const CENTRAL = "region-northline-central";
/** Home districts: four techs at the Central shop, one each in North and South for small jobs. */
const TECH = { maria: "membership-northline-tech-1", devon: "membership-northline-tech-2", alex: "membership-northline-tech-3", jordan: "membership-northline-tech-4", sam: "membership-northline-tech-5", riley: "membership-northline-tech-6" };

type Trade = "refrigeration" | "hvac" | "forecourt" | "plumbing" | "electrical" | "foodservice" | "exterior";

const PROBLEMS: Record<Trade, Array<{ text: string; asset?: string; taxonomy: string }>> = {
  refrigeration: [
    { text: "Beer cave is running warm during the afternoon rush", asset: "beer-cave", taxonomy: "taxonomy-northline-beer_caves" },
    { text: "Beer cave evaporator is icing over", asset: "beer-cave", taxonomy: "taxonomy-northline-beer_caves" },
    { text: "Walk-in freezer is not holding temperature", asset: "walk-in-freezer", taxonomy: "taxonomy-northline-freezers" },
    { text: "Walk-in freezer door is frosting at the hinge side", asset: "walk-in-freezer", taxonomy: "taxonomy-northline-freezers" },
    { text: "Ice machine stopped making ice", asset: "ice-machine", taxonomy: "taxonomy-northline-ice_machines" },
    { text: "Ice machine is leaking onto the floor", asset: "ice-machine", taxonomy: "taxonomy-northline-ice_machines" },
  ],
  hvac: [
    { text: "Sales floor is too warm; rooftop unit is blowing warm air", asset: "rtu-1", taxonomy: "taxonomy-northline-rooftop_units" },
    { text: "Rooftop unit is short-cycling", asset: "rtu-1", taxonomy: "taxonomy-northline-rooftop_units" },
    { text: "No heat on the sales floor this morning", asset: "rtu-1", taxonomy: "taxonomy-northline-rooftop_units" },
    { text: "Rooftop unit is making a loud rattling noise", asset: "rtu-2", taxonomy: "taxonomy-northline-rooftop_units" },
  ],
  forecourt: [
    { text: "Pump will not authorize card payments", asset: "dispenser-1", taxonomy: "taxonomy-northline-payment_terminals" },
    { text: "Nozzle is dripping after the handle is released", asset: "dispenser-2", taxonomy: "taxonomy-northline-hoses_nozzles" },
    { text: "Dispenser display is blank", asset: "dispenser-3", taxonomy: "taxonomy-northline-dispensers" },
    { text: "Pump is running very slowly", asset: "dispenser-4", taxonomy: "taxonomy-northline-dispensers" },
  ],
  plumbing: [
    { text: "Restroom toilet keeps running", taxonomy: "taxonomy-northline-restrooms" },
    { text: "Floor drain by the soda fountain is backing up", taxonomy: "taxonomy-northline-drains" },
    { text: "Hand sink faucet is leaking under the cabinet", taxonomy: "taxonomy-northline-restrooms" },
    { text: "Water heater is not keeping up", taxonomy: "taxonomy-northline-plumbing" },
  ],
  electrical: [
    { text: "Canopy lights are out over two pumps", taxonomy: "taxonomy-northline-canopy_lighting" },
    { text: "Price sign is partly dark", taxonomy: "taxonomy-northline-signage" },
    { text: "Breaker keeps tripping on the coffee bar circuit", taxonomy: "taxonomy-northline-electrical" },
    { text: "Rear security light is out", taxonomy: "taxonomy-northline-canopy_lighting" },
  ],
  foodservice: [
    { text: "Rapid-cook oven shows an error and will not heat", asset: "rapid-cook-oven", taxonomy: "taxonomy-northline-ovens" },
    { text: "Rapid-cook oven door does not close fully", asset: "rapid-cook-oven", taxonomy: "taxonomy-northline-ovens" },
  ],
  exterior: [
    { text: "Ice on the walkway after freezing rain", taxonomy: "taxonomy-northline-snow_removal" },
    { text: "Snow piled in the drive lane after plowing", taxonomy: "taxonomy-northline-snow_removal" },
  ],
};

/** How each vendor tends to behave; numbers are probabilities and typical times. */
const PERSONALITY: Record<string, { responseMinutes: [number, number]; onTime: number; firstFix: number; declines: number; proposes: number; rejected: number; cost: [number, number] }> = {
  [COLDLINE]: { responseMinutes: [15, 75], onTime: 0.93, firstFix: 0.88, declines: 0.01, proposes: 0.03, rejected: 0.03, cost: [65_000, 240_000] },
  [CLEARFLOW]: { responseMinutes: [45, 240], onTime: 0.84, firstFix: 0.74, declines: 0.02, proposes: 0.06, rejected: 0.09, cost: [38_000, 150_000] },
  [PUMPPRO]: { responseMinutes: [8, 40], onTime: 0.95, firstFix: 0.93, declines: 0.01, proposes: 0.02, rejected: 0.02, cost: [32_000, 95_000] },
  [BRIGHTLINE]: { responseMinutes: [90, 720], onTime: 0.76, firstFix: 0.82, declines: 0.14, proposes: 0.18, rejected: 0.05, cost: [26_000, 90_000] },
  [GREENLOT]: { responseMinutes: [20, 120], onTime: 0.82, firstFix: 0.96, declines: 0.03, proposes: 0.02, rejected: 0.02, cost: [42_000, 92_000] },
};

/** Small seeded random generator so the history is the same on every build. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296; };
}

export function buildOperatingHistory(input: OperatingHistoryInput): OperatingHistory {
  const out: OperatingHistory = { workOrders: [], assignments: [], issuances: [], vendorResponses: [], serviceAppointments: [], visits: [], visitEvidence: [], followUps: [], workOrderVerifications: [], costLines: [], invoiceReferences: [], invoiceAllocations: [] };
  const rnd = random(20261007);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rnd() * items.length)]!;
  const between = (low: number, high: number) => low + rnd() * (high - low);
  const iso = (ms: number) => new Date(ms).toISOString();
  const org = input.organization.id, asOfMs = Date.parse(input.asOf);
  const vendorById = new Map(input.vendors.map(v => [v.id, v]));
  const assetFor = (store: Store, key?: string) => key ? input.assets.find(a => a.id === `asset-${store.storeNumber}-${key}`) : undefined;
  let sequence = 0;

  /** Seasonal weights by month (0 = January). Summer refrigeration and cooling; winter heat and snow. */
  const tradeWeights = (month: number, store: Store): Array<[Trade, number]> => {
    const summer = month >= 5 && month <= 8, winter = month === 11 || month <= 2;
    return [
      ["refrigeration", summer ? 0.42 : 0.26], ["hvac", summer ? 0.26 : winter ? 0.2 : 0.12], ["forecourt", 0.15], ["plumbing", winter ? 0.13 : 0.1],
      ["electrical", 0.09], ["foodservice", assetFor(store, "rapid-cook-oven") ? 0.06 : 0], ["exterior", winter ? 0.12 : 0],
    ];
  };
  const chooseTrade = (month: number, store: Store): Trade => {
    const weights = tradeWeights(month, store), total = weights.reduce((sum, [, w]) => sum + w, 0);
    let roll = rnd() * total;
    for (const [trade, weight] of weights) { roll -= weight; if (roll <= 0) return trade; }
    return "refrigeration";
  };

  /** Who does the job: the in-house team covers Central; vendors cover North and South and specialist work. */
  const chooseProvider = (trade: Trade, store: Store): { vendorId?: string; techId?: string } => {
    const central = store.regionId === CENTRAL, roll = rnd();
    if (trade === "exterior") return { vendorId: GREENLOT };
    if (central) {
      if (trade === "plumbing") return roll < 0.85 ? { techId: TECH.devon } : { vendorId: CLEARFLOW };
      if (trade === "electrical") return roll < 0.7 ? { techId: TECH.jordan } : { vendorId: BRIGHTLINE };
      if (trade === "refrigeration") return roll < 0.5 ? { techId: rnd() < 0.6 ? TECH.maria : TECH.sam } : { vendorId: COLDLINE };
      if (trade === "hvac") return roll < 0.4 ? { techId: TECH.maria } : { vendorId: rnd() < 0.55 ? CLEARFLOW : COLDLINE };
      if (trade === "foodservice") return roll < 0.5 ? { techId: TECH.sam } : { vendorId: CLEARFLOW };
      return roll < 0.15 ? { techId: TECH.riley } : { vendorId: PUMPPRO };
    }
    const local = store.regionId === "region-northline-north" ? TECH.alex : TECH.riley;
    if (trade === "plumbing") return roll < 0.2 ? { techId: local } : { vendorId: CLEARFLOW };
    if (trade === "electrical") return roll < 0.25 ? { techId: local } : { vendorId: BRIGHTLINE };
    if (trade === "refrigeration") return { vendorId: COLDLINE };
    if (trade === "hvac") return { vendorId: rnd() < 0.55 ? CLEARFLOW : COLDLINE };
    if (trade === "foodservice") return { vendorId: CLEARFLOW };
    return roll < 0.1 && local === TECH.riley ? { techId: TECH.riley } : { vendorId: PUMPPRO };
  };

  const vendorTech = (vendorId: string) => ({
    [COLDLINE]: ["Imani Lewis", "Carlos Vega", "Tom Becker"], [CLEARFLOW]: ["Dana Ruiz", "Chris Walker", "Mike Olsen"],
    [PUMPPRO]: ["Lena Park", "Victor Hale"], [BRIGHTLINE]: ["Grace Kim", "Owen Burke"], [GREENLOT]: ["Drew Miller", "Pat Nolan"],
  } as Record<string, string[]>)[vendorId] ?? ["Field technician"];

  function evidence(visitId: string, checkedInAt: string, checkedOutAt: string | undefined, channel: VisitSession["startedChannel"], outcome?: string) {
    out.visitEvidence.push({ id: `evidence-${visitId}-in`, organizationId: org, visitId, kind: "check_in", channel, observedAt: checkedInAt, location: { result: "verified", accuracyM: 12 + Math.round(rnd() * 15), distanceM: 8 + Math.round(rnd() * 30), capturedAt: checkedInAt }, payloadJson: JSON.stringify({ history: true }) });
    if (checkedOutAt) out.visitEvidence.push({ id: `evidence-${visitId}-out`, organizationId: org, visitId, kind: "check_out", channel, observedAt: checkedOutAt, location: { result: "verified", accuracyM: 12 + Math.round(rnd() * 15), distanceM: 8 + Math.round(rnd() * 30), capturedAt: checkedOutAt }, payloadJson: JSON.stringify({ outcome }) });
  }

  interface JobPlan {
    store: Store; trade: Trade; createdMs: number; priority: WorkOrder["priority"];
    /** "closed" history, or one of the open states used in the final days. */
    state: "closed" | "limbo" | "awaiting_vendor" | "scheduled" | "declined_open" | "fixed_recent";
    forceVendor?: string; forceAsset?: string; forceRejected?: boolean; forceFirstVisitFail?: boolean; checkOverdue?: boolean;
  }

  function addJob(plan: JobPlan) {
    const { store, trade } = plan;
    sequence++;
    const id = `wo-history-${String(sequence).padStart(4, "0")}`;
    const created = plan.createdMs;
    const year = new Date(created).getUTCFullYear();
    const problem = plan.forceAsset ? PROBLEMS[trade].find(p => p.asset === plan.forceAsset) ?? pick(PROBLEMS[trade]) : pick(PROBLEMS[trade]);
    const asset = assetFor(store, problem.asset);
    const provider = plan.forceVendor ? { vendorId: plan.forceVendor } : chooseProvider(trade, store);
    const number = `CPS-${year}-${String(5000 + sequence).padStart(4, "0")}`;
    const managerId = `membership-northline-store-${store.storeNumber}`;
    const manager = input.storeManagerNames[managerId] ?? "Store manager";
    const work: WorkOrder = {
      id, organizationId: org, number, storeId: store.id, problem: problem.text, categoryKey: trade, taxonomyNodeId: problem.taxonomy, assetId: asset?.id,
      priority: plan.priority, status: "closed", version: 0, accountableParty: "No action required", nextAction: "No action required", createdAt: iso(created),
      requireConfirmation: provider.vendorId ? true : rnd() < 0.4,
    };
    out.workOrders.push(work);
    const urgentHours = plan.priority === "emergency" ? 2 : plan.priority === "urgent" ? 6 : 36;

    if (provider.techId) {
      // In-house: assigned, visited, fixed (or once in a while needing a second trip).
      const assignmentId = `${id}-assignment`;
      const assignedAt = created + between(0.2, 2) * HOUR;
      out.assignments.push({ id: assignmentId, organizationId: org, workOrderId: id, kind: "internal", internalTarget: "person", internalMembershipId: provider.techId, status: "completed", assignedAt: iso(assignedAt) });
      const start = assignedAt + between(1, urgentHours * 3) * HOUR;
      const end = start + between(35, 150) * 60_000;
      const visitId = `${id}-visit-1`;
      out.visits.push({ id: visitId, organizationId: org, storeId: store.id, providerKind: "internal", internalMembershipId: provider.techId, workOrderId: id, technicianName: input.technicianNames[provider.techId] ?? "Technician", providerName: `${input.organization.name} Maintenance`, purpose: problem.text, crewCount: 1, status: "checked_out", startedChannel: "store_device", endedChannel: "store_device", checkedInAt: iso(start), checkedOutAt: iso(end), outcome: "resolved", outcomeNotes: "Repaired and tested before leaving.", observedDurationSeconds: Math.round((end - start) / 1000) });
      evidence(visitId, iso(start), iso(end), "store_device", "resolved");
      if (rnd() < 0.35) out.costLines.push({ id: `${id}-parts`, organizationId: org, workOrderId: id, kind: "parts", description: "Parts and materials", amount: { amountMinor: Math.round(between(2_500, 32_000)), currency: "USD" }, serviceDate: iso(end).slice(0, 10), recordedAt: iso(end + HOUR), providerType: "internal" });
      if (work.requireConfirmation) {
        const decided = end + between(3, 30) * HOUR;
        out.workOrderVerifications.push({ id: `${id}-check-1`, organizationId: org, workOrderId: id, siteVisitWorkOrderId: `site-visit-work-${visitId}-${id}`, outcome: "completed", outcomeRecordedAt: iso(end), cycle: 1, decision: "verified", basis: "observable_result", verificationScope: "reported_problem", decidedByMembershipId: managerId, decidedByName: manager, decidedAt: iso(decided) });
        work.resolvedAt = iso(decided);
        work.closedAt = iso(decided + between(1, 20) * HOUR);
      } else work.closedAt = iso(end);
      work.dueAt = iso(created + urgentHours * HOUR);
      return work;
    }

    // Outside vendor: issue, respond (sometimes decline or push the date), visit, check the repair, invoice.
    const personality = PERSONALITY[provider.vendorId!]!;
    let vendorId = provider.vendorId!;
    let assignedAt = created + between(0.3, 1.5) * HOUR;
    const southClearFlow = vendorId === CLEARFLOW && store.regionId === "region-northline-south";
    let attempt = 1;
    let assignmentId = `${id}-assignment-1`;
    const issue = (forVendor: string, at: number, supersedes?: string) => {
      const vendor = vendorById.get(forVendor)!;
      assignmentId = `${id}-assignment-${attempt}`;
      out.assignments.push({ id: assignmentId, organizationId: org, workOrderId: id, kind: "outside_vendor", vendorId: forVendor, status: "accepted", assignedAt: iso(at), supersedesAssignmentId: supersedes });
      const issuanceId = `${id}-issuance-${attempt}`;
      out.issuances.push({ id: issuanceId, organizationId: org, workOrderId: id, assignmentId, revision: attempt, channel: "email", issuedAt: iso(at + 5 * 60_000), immutablePayloadJson: JSON.stringify({ organizationName: input.organization.name, workOrderNumber: number, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: { id: vendor.id, name: vendor.name }, problem: problem.text, priority: plan.priority, categoryKey: trade, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, billingInstruction: `Reference operator work order ${number} on all service paperwork and invoices.` }) });
      return { issuanceId, vendor };
    };
    let { issuanceId, vendor } = issue(vendorId, assignedAt);
    const [low, high] = personality.responseMinutes;
    const slowFactor = southClearFlow ? 2.2 : 1;
    let respondedAt = assignedAt + 5 * 60_000 + between(low, high) * slowFactor * 60_000;
    // A decline sends the job to a backup vendor (or back to facilities when it is still open).
    const declines = plan.state === "declined_open" || (plan.state === "closed" && created < asOfMs - 45 * DAY && !plan.forceAsset && rnd() < personality.declines);
    if (declines) {
      out.vendorResponses.push({ id: `${id}-response-${attempt}`, organizationId: org, workOrderId: id, assignmentId, issuanceId, response: "declined", responderName: `${vendor.name} dispatch`, message: pick(["No technician available in that area this week.", "Outside our current service area.", "Crew is committed to emergency work."]), respondedAt: iso(respondedAt) });
      out.assignments.at(-1)!.status = "declined";
      if (plan.state === "declined_open") {
        // Back with facilities to choose someone else.
        out.assignments.push({ id: `${id}-assignment-choose`, organizationId: org, workOrderId: id, kind: "choose_later", status: "pending", assignedAt: iso(respondedAt + 60_000), supersedesAssignmentId: assignmentId });
        Object.assign(work, { status: "approved", accountableParty: "Facilities team", nextAction: "Choose another vendor", dueAt: iso(respondedAt + 24 * HOUR), escalationTo: "Facilities director" });
        delete work.closedAt;
        return work;
      }
      const backup = vendorId === BRIGHTLINE ? CLEARFLOW : vendorId === CLEARFLOW ? COLDLINE : vendorId === COLDLINE ? CLEARFLOW : vendorId;
      attempt++;
      const previous = assignmentId;
      assignedAt = respondedAt + between(0.5, 3) * HOUR;
      vendorId = backup;
      ({ issuanceId, vendor } = issue(vendorId, assignedAt, previous));
      respondedAt = assignedAt + 5 * 60_000 + between(...PERSONALITY[vendorId]!.responseMinutes) * 60_000;
    }
    // Recent stories stay short so they finish before today; history uses each vendor's real pace.
    const recent = plan.state !== "closed" || created > asOfMs - 45 * DAY;
    const proposes = !recent && rnd() < personality.proposes;
    const leadHours = recent ? between(2, 10) : (plan.priority === "emergency" ? between(1, 4) : plan.priority === "urgent" ? between(3, 18) : between(18, 96)) * (proposes ? 2.5 : 1) * slowFactor;
    let appointmentAt = respondedAt + leadHours * HOUR;
    if (plan.state === "scheduled") appointmentAt = Math.max(appointmentAt, asOfMs + between(18, 40) * HOUR);
    out.vendorResponses.push({ id: `${id}-response-${attempt}`, organizationId: org, workOrderId: id, assignmentId, issuanceId, response: proposes ? "proposed_date" : "accepted", responderName: `${vendor.name} dispatch`, proposedAt: iso(appointmentAt), respondedAt: iso(respondedAt) });
    work.vendorServiceTicketNumber = `${vendor.code.toUpperCase()}-${String(70000 + sequence)}`;
    work.dueAt = iso(created + urgentHours * HOUR);
    const hasAppointment = plan.priority !== "emergency" && rnd() < 0.7;
    if (hasAppointment) out.serviceAppointments.push({ id: `${id}-appointment`, organizationId: org, workOrderId: id, assignmentId, issuanceId, sourceVendorResponseId: `${id}-response-${attempt}`, status: "confirmed", proposedBy: proposes ? "vendor" : "operator", startsAt: iso(appointmentAt), createdByMembershipId: input.facilitiesMembershipId, createdAt: iso(respondedAt + 10 * 60_000) });

    if (plan.state === "awaiting_vendor") {
      out.vendorResponses.pop();
      if (hasAppointment) out.serviceAppointments.pop();
      out.assignments.at(-1)!.status = "issued";
      Object.assign(work, { status: "issued", accountableParty: vendor.name, nextAction: "Accept the work order or propose a time", dueAt: iso(assignedAt + (plan.priority === "routine" ? 24 : 4) * HOUR), escalationTo: "Facilities director" });
      delete work.closedAt; delete work.vendorServiceTicketNumber;
      return work;
    }
    if (plan.state === "scheduled") {
      Object.assign(work, { status: "scheduled", accountableParty: vendor.name, nextAction: "Complete the scheduled visit", dueAt: iso(appointmentAt + 4 * HOUR), escalationTo: "Facilities director" });
      delete work.closedAt;
      return work;
    }

    // First visit: on time or late, fixed or needing another trip.
    const late = !recent && rnd() > personality.onTime * (southClearFlow ? 0.8 : 1);
    const arrive = (hasAppointment ? appointmentAt : respondedAt + leadHours * HOUR) + (late ? between(1.2, 4) : between(-0.4, 0.6)) * HOUR;
    const fixed = plan.forceFirstVisitFail ? false : recent || rnd() < personality.firstFix * (southClearFlow || (vendorId === CLEARFLOW && trade === "hvac") ? 0.88 : 1);
    const techs = vendorTech(vendorId);
    let visitNumber = 0, lastVisitId = "", lastOut = 0, lastOutcome: VisitOutcome = "resolved";
    const visit = (start: number, outcome: VisitOutcome) => {
      visitNumber++;
      const visitId = `${id}-visit-${visitNumber}`, end = start + between(45, 190) * 60_000;
      const channel = pick(["qr", "secure_link", "store_device"] as const);
      out.visits.push({ id: visitId, organizationId: org, storeId: store.id, providerKind: "outside_vendor", vendorId, workOrderId: id, technicianName: pick(techs), providerName: vendor.name, purpose: problem.text, crewCount: 1, status: "checked_out", startedChannel: channel, endedChannel: channel, checkedInAt: iso(start), checkedOutAt: iso(end), outcome, outcomeNotes: outcome === "resolved" ? "Repaired and tested; operating normally at departure." : outcome === "diagnosed_waiting_parts" ? "Diagnosed the failed part; ordered a replacement." : "Temporary fix in place; returning to finish the repair.", observedDurationSeconds: Math.round((end - start) / 1000) });
      evidence(visitId, iso(start), iso(end), channel, outcome);
      lastVisitId = visitId; lastOut = end; lastOutcome = outcome;
      if (outcome !== "resolved") {
        out.followUps.push({ id: `${visitId}-follow-up`, organizationId: org, workOrderId: id, sourceVisitId: visitId, accountableParty: vendor.name, nextAction: outcome === "diagnosed_waiting_parts" ? "Return with the replacement part" : "Return to complete the repair", dueAt: iso(end + 72 * HOUR), escalationTo: "Facilities director", status: "completed", createdAt: iso(end), completedAt: iso(end + between(24, 96) * HOUR) });
      }
      return end;
    };
    let end = visit(arrive, fixed ? "resolved" : pick(["diagnosed_waiting_parts", "return_required"] as const));
    if (!fixed) end = visit(out.followUps.at(-1)!.completedAt ? Date.parse(out.followUps.at(-1)!.completedAt!) - between(1, 3) * HOUR : end + 48 * HOUR, "resolved");

    let cost = Math.round(between(...personality.cost) * (visitNumber > 1 ? 1.45 : 1));
    if (plan.state === "limbo") {
      // Reported fixed, waiting for the store to confirm. Some are past their check time.
      const due = lastOut + (plan.checkOverdue ? 24 : between(30, 60)) * HOUR;
      Object.assign(work, { status: "completed_pending_review", accountableParty: "Store team", nextAction: "Confirm the repair worked", dueAt: iso(due), escalationTo: "Facilities director" });
      delete work.closedAt;
    } else {
      // The store checks the repair. Occasionally it did not hold and the vendor returns.
      const checkAt = (start: number) => start + (plan.state === "fixed_recent" ? between(4, 20) : between(3, 40)) * HOUR;
      let cycle = 1, decided = checkAt(lastOut);
      const rejected = plan.forceRejected || plan.state === "closed" && !recent && rnd() < personality.rejected * (vendorId === CLEARFLOW && trade === "hvac" ? 1.6 : 1);
      if (rejected) {
        out.workOrderVerifications.push({ id: `${id}-check-${cycle}`, organizationId: org, workOrderId: id, siteVisitWorkOrderId: `site-visit-work-${lastVisitId}-${id}`, outcome: "completed", outcomeRecordedAt: iso(lastOut), cycle, decision: "rejected", basis: "observable_result", verificationScope: "reported_problem", reason: pick(["Temperature climbed again the same evening.", "Same noise returned the next morning.", "Still leaking after the visit."]), decidedByMembershipId: managerId, decidedByName: manager, decidedAt: iso(decided) });
        cycle++;
        visit(decided + between(18, 60) * HOUR, "resolved");
        cost += Math.round(between(15_000, 45_000));
        decided = checkAt(lastOut);
      }
      out.workOrderVerifications.push({ id: `${id}-check-${cycle}`, organizationId: org, workOrderId: id, siteVisitWorkOrderId: `site-visit-work-${lastVisitId}-${id}`, outcome: "completed", outcomeRecordedAt: iso(lastOut), cycle, decision: "verified", basis: "observable_result", verificationScope: "reported_problem", decidedByMembershipId: managerId, decidedByName: manager, decidedAt: iso(decided) });
      work.resolvedAt = iso(decided);
      work.closedAt = iso(decided + between(1, 12) * HOUR);
      out.assignments.at(-1)!.status = "completed";
    }
    void lastOutcome;
    // What the vendor charged, recorded against that vendor; about half arrive with a matched invoice.
    out.costLines.push({ id: `${id}-cost`, organizationId: org, workOrderId: id, kind: rnd() < 0.6 ? "labor" : "parts", description: `${vendor.name} service charge`, amount: { amountMinor: cost, currency: "USD" }, serviceDate: iso(end).slice(0, 10), recordedAt: iso(end + 2 * HOUR), providerType: "vendor", vendorId });
    if (plan.state === "closed" && rnd() < 0.5) {
      const invoiceId = `${id}-invoice`;
      out.invoiceReferences.push({ id: invoiceId, organizationId: org, vendorId, invoiceNumber: `${vendor.code.toUpperCase()}-${String(400000 + sequence)}`, invoiceDate: iso(end + 3 * DAY).slice(0, 10), grossAmount: { amountMinor: cost, currency: "USD" }, operatorWorkOrderNumber: number, matchStatus: "confirmed", createdAt: iso(end + 3 * DAY) });
      out.invoiceAllocations.push({ id: `${invoiceId}-allocation`, organizationId: org, invoiceReferenceId: invoiceId, workOrderId: id, amount: { amountMinor: cost, currency: "USD" }, confirmedByMembershipId: "membership-northline-finance", confirmedAt: iso(end + 5 * DAY) });
    }
    return work;
  }

  // Two years of history, about one job per store per month, up to a few days ago. Jobs from the
  // last six weeks follow a quick timeline (see `recent`), so nothing finishes after today.
  const start = asOfMs - 730 * DAY, stop = asOfMs - 5 * DAY;
  for (const store of input.stores) {
    for (let day = start + rnd() * 20 * DAY; day < stop; day += between(22, 44) * DAY) {
      const month = new Date(day).getUTCMonth(), trade = chooseTrade(month, store);
      const drawn: WorkOrder["priority"] = trade === "refrigeration" && rnd() < 0.12 ? "emergency" : rnd() < 0.22 ? "urgent" : "routine";
      // The final week's everyday jobs stay routine, so "new urgent" on the Overview shows a believable handful.
      const priority: WorkOrder["priority"] = day > asOfMs - 8 * DAY ? "routine" : drawn;
      addJob({ store, trade, createdMs: day + between(7, 15) * HOUR, priority, state: "closed" });
    }
  }

  // Deliberate stories in the last two months.
  const storeNumber = (n: string) => input.stores.find(s => s.storeNumber === n)!;
  const daysAgo = (days: number, hour = 10) => asOfMs - days * DAY + (hour - 18) * HOUR;
  // Store 112 ice machine keeps failing: a repeat problem on the Overview.
  // Calls 31 days apart, then 15: still 3 calls in 60 days, but only one counts against the vendor as "broke again within 30 days".
  for (const days of [58, 27, 12]) addJob({ store: storeNumber("112"), trade: "refrigeration", createdMs: daysAgo(days), priority: "urgent", state: "closed", forceVendor: COLDLINE, forceAsset: "ice-machine" });
  // ClearFlow HVAC in the South: a fix that did not hold, then a return visit.
  addJob({ store: storeNumber("113"), trade: "hvac", createdMs: daysAgo(28), priority: "urgent", state: "closed", forceVendor: CLEARFLOW, forceAsset: "rtu-1", forceRejected: true });
  addJob({ store: storeNumber("114"), trade: "hvac", createdMs: daysAgo(19), priority: "routine", state: "closed", forceVendor: CLEARFLOW, forceAsset: "rtu-1", forceFirstVisitFail: true });

  // The last days: work in every open state, so "Since you last looked", Review and the scorecards have something current.
  addJob({ store: storeNumber("102"), trade: "refrigeration", createdMs: daysAgo(6), priority: "routine", state: "fixed_recent", forceVendor: COLDLINE, forceAsset: "walk-in-freezer" });
  addJob({ store: storeNumber("107"), trade: "plumbing", createdMs: daysAgo(5), priority: "routine", state: "fixed_recent", forceVendor: CLEARFLOW });
  addJob({ store: storeNumber("111"), trade: "forecourt", createdMs: daysAgo(4), priority: "routine", state: "fixed_recent", forceVendor: PUMPPRO });
  addJob({ store: storeNumber("105"), trade: "hvac", createdMs: daysAgo(5), priority: "routine", state: "limbo", forceVendor: CLEARFLOW, checkOverdue: true });
  addJob({ store: storeNumber("115"), trade: "refrigeration", createdMs: daysAgo(4), priority: "urgent", state: "limbo", forceVendor: COLDLINE, checkOverdue: true });
  addJob({ store: storeNumber("103"), trade: "forecourt", createdMs: daysAgo(3), priority: "routine", state: "limbo", forceVendor: PUMPPRO });
  addJob({ store: storeNumber("113"), trade: "electrical", createdMs: daysAgo(2), priority: "routine", state: "declined_open", forceVendor: BRIGHTLINE });
  addJob({ store: storeNumber("101"), trade: "electrical", createdMs: daysAgo(1, 9), priority: "urgent", state: "awaiting_vendor", forceVendor: BRIGHTLINE });
  addJob({ store: storeNumber("114"), trade: "refrigeration", createdMs: daysAgo(1, 14), priority: "emergency", state: "awaiting_vendor", forceVendor: COLDLINE, forceAsset: "beer-cave" });
  addJob({ store: storeNumber("110"), trade: "hvac", createdMs: daysAgo(2), priority: "routine", state: "scheduled", forceVendor: COLDLINE, forceAsset: "rtu-2" });
  addJob({ store: storeNumber("112"), trade: "forecourt", createdMs: daysAgo(3), priority: "routine", state: "scheduled", forceVendor: PUMPPRO });

  // Nothing finished may be dated after today.
  const late = out.workOrders.find(w => [w.closedAt, w.resolvedAt].some(at => at && Date.parse(at) > asOfMs))
    ?? out.visits.find(v => Date.parse(v.checkedInAt) > asOfMs || (v.checkedOutAt && Date.parse(v.checkedOutAt) > asOfMs));
  if (late) throw new Error(`Operating history record ${late.id} is dated after the demo's today`);
  return out;
}

/**
 * The earlier hand-built recurring jobs all answered 25 minutes after sending. In the showcase,
 * re-time those replies by each vendor's pace (still after the job was sent and before the visit),
 * so response times on scorecards reflect the vendor rather than a fixed demo constant.
 */
export function retimeRecurringResponses(responses: VendorResponse[], issuances: WorkOrderIssuance[], visits: VisitSession[], assignments: WorkOrderAssignment[]) {
  const rnd = random(1007);
  const issued = new Map(issuances.map(i => [i.id, Date.parse(i.issuedAt)]));
  const vendorOf = new Map(assignments.map(a => [a.id, a.vendorId]));
  for (const response of responses) {
    if (!response.id.startsWith("response-recurring-")) continue;
    const pace = PERSONALITY[vendorOf.get(response.assignmentId) ?? ""];
    const sent = issued.get(response.issuanceId);
    const visit = visits.find(v => v.workOrderId === response.workOrderId);
    if (!pace || sent === undefined || !visit) continue;
    const [low, high] = pace.responseMinutes;
    const at = Math.min(sent + (low + rnd() * (high - low)) * 60_000, Date.parse(visit.checkedInAt) - HOUR);
    if (at > sent) response.respondedAt = new Date(at).toISOString();
  }
}
