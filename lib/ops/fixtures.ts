import type {
  Asset,
  ApprovalDecision,
  ApprovalPolicy,
  ApprovalRequest,
  AssetComponent,
  AssetReplacementOverride,
  AuditEvent,
  CostLine,
  ComponentTemplate,
  ComponentLifecycleEvent,
  Division,
  EquipmentTemplate,
  InvoiceAllocation,
  InvoiceReference,
  Membership,
  OpsException,
  OpsFixture,
  OutboxMessage,
  PmOccurrence,
  PmPlan,
  PublicActionToken,
  ReplacementBenchmark,
  ReplacementEvent,
  ReplacementProfile,
  RequestImpactAssessment,
  ScopeGrant,
  ServiceAppointment,
  ServiceRequest,
  SiteVisitWorkOrder,
  Store,
  TaxonomyNode,
  User,
  Vendor,
  VendorReminder,
  VendorCoverage,
  VendorEstimateProposal,
  VendorResponse,
  VendorContinuation,
  VendorSpecialty,
  VisitEvidence,
  VisitSession,
  WorkOrder,
  WorkOrderVerification,
  WorkOrderAssignment,
  WorkOrderEstimateRequest,
  WorkOrderIssuance,
  WorkflowTask,
  WorkflowTaskSlaPause,
  WorkflowTaskSlaResume,
  FollowUp,
  StoredFile,
  EntityFileLink,
} from "./types";
import { siteVisitOutcomeFromLegacy, siteVisitOutcomeRequiresFollowUp } from "./site-visit-outcomes";

export const NORTHLINE_ORGANIZATION_ID = "org-northline-demo";
export const NORTHLINE_AS_OF = "2026-08-25T18:00:00.000Z";
export const DEMO_ORGANIZATION_NAME = "Clark Pump and Shop";
export const DEMO_WORK_ORDER_PREFIX = "CPS";
export const DEMO_VENDOR_NAMES = {
  summit: "ColdLine Refrigeration & HVAC",
  cedar: "ClearFlow HVAC, Plumbing & Kitchen Repair",
  forecourt: "PumpPro Fuel & Dispenser Repair",
  brightpath: "BrightLine Electrical & Lighting",
  fourSeasons: "GreenLot Landscaping & Snow Removal",
} as const;

export const NORTHLINE_DEMO_ENTRY_TOKENS = {
  store104: "yxXEL85UZIlTAPwVDanaA1n5n2O0Sx5cmQc2s3TQYUM",
  serviceAuthorization104: "zdRfp4QemuXSqKVoHtsMHuwXGz4wlruU89tmDjNk7Ts",
  upcomingService104: "VR-jsOQgSKTNDLPXl1nv4TCVMSRdVs6TcIvEj8FapGM",
  activeVisit112: "L0HMN2vA08eONSnasubFYbEiklRGSjpQQpbP6Ld6vMo",
  trustedStore104: "wjru_t6__2kW59QM_kQw62VgYgeNZporOvMEzA1Sf5w",
  estimate105Summit: "LvS1x4HpenFPweeAyDmSa4ZRo-zemfa_sZpZrnlQWbw",
  estimate105Cedar: "Sq3z2tPc9fnBoy7K_qr3caQzey4BSWhGNGZD9o8Xp4E",
  serviceRunSummit: "NorthlineServiceRunDemoVendorResponse2026",
} as const;

export const NORTHLINE_DEMO_TOKEN_HASHES = {
  store104: "380a766b446fd70df62f1707d101e515b07fb211397c65b5a2f3a26864f79db1",
  serviceAuthorization104: "5682e8cb6a878b9abb5c7b0cfd870af97c933cd79ce9fb2bcb9d8b88ccf20fa8",
  upcomingService104: "2cdb7abf25bf34445a846272109a0a2245f1022c4074cf757e78990ad42dc54d",
  activeVisit112: "1934698154df94b020ccec22c3cab4023bcd4b0b2c6a5ac62c914d42b395832d",
  trustedStore104: "04ba6edfb1020edc3253848bacd7bf9441371f1dde84d8b4a079f8e0f8b94046",
  estimate105Summit: "1d82353ab0ce89b2414d3763529186420dad5ca03d48b77b39f91113baa1b81a",
  estimate105Cedar: "2a1e058b63bbae4102b951756a71a0ed25176e69aba067bca2101475b7184c2a",
  serviceRunSummit: "36be3c1b87d9043f0b65d78197e1b4e8991c97ca12ad261793f5a5736d024478",
} as const;

export const NORTHLINE_DEMO_HANDLES = {
  organizationId: NORTHLINE_ORGANIZATION_ID,
  storyStoreId: "store-northline-104",
  storyWorkOrderId: "wo-northline-104",
  publicServiceWorkOrderId: "wo-northline-104-issued",
  storyAssetId: "asset-104-beer-cave",
  activeVisitId: "visit-northline-112-active",
  unmatchedVisitId: "visit-northline-107-no-wo",
} as const;

export type NorthlinePreviewPersona = "executive" | "facilities" | "regional_north" | "store_104" | "finance";
export const NORTHLINE_PREVIEW_PERSONAS = {
  executive: { label: "Executive", membershipId: "membership-northline-executive", organizationId: NORTHLINE_ORGANIZATION_ID },
  facilities: { label: "Facilities coordinator", membershipId: "membership-northline-facilities", organizationId: NORTHLINE_ORGANIZATION_ID },
  regional_north: { label: "North regional manager", membershipId: "membership-northline-regional-1", organizationId: NORTHLINE_ORGANIZATION_ID, regionIds: ["region-northline-north"] },
  store_104: { label: "Store 104 manager", membershipId: "membership-northline-store-104", organizationId: NORTHLINE_ORGANIZATION_ID, storeIds: ["store-northline-104"] },
  finance: { label: "Finance reviewer", membershipId: "membership-northline-finance", organizationId: NORTHLINE_ORGANIZATION_ID },
} as const;

export function getNorthlinePreviewPersona(persona: NorthlinePreviewPersona) {
  return clone(NORTHLINE_PREVIEW_PERSONAS[persona]);
}

const regionSeeds = [
  ["north", "North District"],
  ["central", "Central District"],
  ["south", "South District"],
] as const;

const storeSeeds = [
  ["101", "Cedar Grove", "101 Market Way", "Cedar Grove", "MI", "49001", 42091234, -85612345],
  ["102", "Mill Creek", "22 Mill Creek Road", "Mill Creek", "MI", "49014", 42103456, -85598765],
  ["103", "Harbor Point", "303 Harbor Avenue", "Harbor Point", "MI", "49022", 42065432, -86234567],
  ["104", "Ridgeview", "104 Ridgeview Drive", "Ridgeview", "MI", "49031", 41987654, -85654321],
  ["105", "Pine Valley", "55 Pine Valley Parkway", "Pine Valley", "MI", "49045", 42145678, -85765432],
  ["106", "Westgate", "606 Westgate Boulevard", "Westgate", "IN", "46701", 41654321, -85234567],
  ["107", "Junction City", "17 Junction Plaza", "Junction City", "IN", "46712", 41598765, -85123456],
  ["108", "Brookfield", "808 Brookfield Street", "Brookfield", "IN", "46725", 41456789, -85456789],
  ["109", "Lakeview", "9 Lakeview Lane", "Lakeview", "IN", "46738", 41678901, -85567890],
  ["110", "Hillcrest", "1100 Hillcrest Road", "Hillcrest", "IN", "46749", 41345678, -85098765],
  ["111", "Maple Run", "11 Maple Run Avenue", "Maple Run", "OH", "43501", 41543210, -84123456],
  ["112", "Airport Road", "1212 Airport Road", "Fairfield", "OH", "43516", 41498765, -84345678],
  ["113", "Riverbend", "313 Riverbend Parkway", "Riverbend", "OH", "43529", 41387654, -84234567],
  ["114", "North Market", "1414 North Market Street", "North Market", "OH", "43540", 41612345, -84456789],
  ["115", "Southgate", "1515 Southgate Drive", "Southgate", "OH", "43552", 41298765, -84098765],
] as const;

const vendorSeeds = [
  ["summit", "coldline", DEMO_VENDOR_NAMES.summit, "service@coldline-demo.example", "(555) 010-2201", true],
  ["cedar", "clearflow", DEMO_VENDOR_NAMES.cedar, "dispatch@clearflow-demo.example", "(555) 010-2202", true],
  ["forecourt", "pumppro", DEMO_VENDOR_NAMES.forecourt, "dispatch@pumppro-demo.example", "(555) 010-2203", true],
  ["brightpath", "brightline", DEMO_VENDOR_NAMES.brightpath, "service@brightline-demo.example", "(555) 010-2204", false],
  ["four-seasons", "greenlot", DEMO_VENDOR_NAMES.fourSeasons, "dispatch@greenlot-demo.example", "(555) 010-2205", false],
] as const;

const specialtySeeds: Record<string, Array<[string, string, string[]]>> = {
  coldline: [["refrigeration", "Refrigeration", ["beer cave", "walk-in cooler", "freezer", "ice machine", "cooler"]], ["hvac", "HVAC", ["rooftop unit", "air conditioning", "heat"]]],
  clearflow: [["hvac", "HVAC", ["rooftop unit", "air conditioning"]], ["plumbing", "Plumbing", ["plumber", "drain", "leak"]], ["foodservice", "Foodservice equipment", ["oven", "fryer", "hot case"]]],
  pumppro: [["forecourt", "Fuel and forecourt", ["dispenser", "pump", "payment terminal", "fuel system"]]],
  brightline: [["electrical", "Electrical", ["electrician", "canopy lighting", "sign", "low voltage", "security"]]],
  greenlot: [["exterior", "Exterior and grounds", ["landscaping", "snow", "parking lot", "striping", "lot"]]],
};

const categoryCycle = ["refrigeration", "hvac", "forecourt", "plumbing", "electrical", "exterior", "foodservice"] as const;
const taxonomySeeds: ReadonlyArray<{
  key: string;
  parent?: string;
  kind: "category" | "group";
  name: string;
  aliases: string[];
}> = [
  { key: "refrigeration", kind: "category", name: "Refrigeration", aliases: ["cold equipment", "cooling"] },
  { key: "walk_in_refrigeration", parent: "refrigeration", kind: "group", name: "Walk-in refrigeration", aliases: ["walk-ins"] },
  { key: "coolers", parent: "walk_in_refrigeration", kind: "group", name: "Coolers", aliases: ["walk-in coolers"] },
  { key: "beer_caves", parent: "coolers", kind: "group", name: "Beer caves", aliases: ["beer cooler", "beer cave"] },
  { key: "freezers", parent: "walk_in_refrigeration", kind: "group", name: "Freezers", aliases: ["walk-in freezer"] },
  { key: "reach_in_refrigeration", parent: "refrigeration", kind: "group", name: "Reach-in refrigeration", aliases: ["reach-ins", "display coolers"] },
  { key: "ice_machines", parent: "refrigeration", kind: "group", name: "Ice machines", aliases: ["ice maker"] },
  { key: "hvac", kind: "category", name: "HVAC", aliases: ["heating", "air conditioning"] },
  { key: "rooftop_units", parent: "hvac", kind: "group", name: "Rooftop units", aliases: ["RTU", "package unit"] },
  { key: "split_systems", parent: "hvac", kind: "group", name: "Split systems", aliases: ["mini split"] },
  { key: "hvac_controls", parent: "hvac", kind: "group", name: "Controls and thermostats", aliases: ["thermostat", "building controls"] },
  { key: "forecourt", kind: "category", name: "Fuel and forecourt", aliases: ["fuel systems", "gas pumps"] },
  { key: "dispensers", parent: "forecourt", kind: "group", name: "Dispensers", aliases: ["pumps", "fuel dispensers"] },
  { key: "payment_terminals", parent: "dispensers", kind: "group", name: "Payment terminals", aliases: ["card readers", "CRIND"] },
  { key: "hoses_nozzles", parent: "dispensers", kind: "group", name: "Hoses and nozzles", aliases: ["breakaways"] },
  { key: "fuel_systems", parent: "forecourt", kind: "group", name: "Underground fuel systems", aliases: ["UST", "tank monitoring"] },
  { key: "plumbing", kind: "category", name: "Plumbing", aliases: ["plumber", "water"] },
  { key: "restrooms", parent: "plumbing", kind: "group", name: "Restrooms", aliases: ["toilets", "sinks"] },
  { key: "drains", parent: "plumbing", kind: "group", name: "Drains and sewer", aliases: ["drain", "sewer"] },
  { key: "electrical", kind: "category", name: "Electrical", aliases: ["electrician", "power"] },
  { key: "canopy_lighting", parent: "electrical", kind: "group", name: "Canopy lighting", aliases: ["forecourt lights"] },
  { key: "signage", parent: "electrical", kind: "group", name: "Signs and price displays", aliases: ["sign", "price sign"] },
  { key: "low_voltage_security", parent: "electrical", kind: "group", name: "Low voltage and security", aliases: ["cameras", "alarm"] },
  { key: "foodservice", kind: "category", name: "Foodservice equipment", aliases: ["kitchen equipment", "hot food"] },
  { key: "ovens", parent: "foodservice", kind: "group", name: "Ovens", aliases: ["rapid cook", "convection oven"] },
  { key: "fryers", parent: "foodservice", kind: "group", name: "Fryers and hot holding", aliases: ["fryer", "hot case"] },
  { key: "exterior", kind: "category", name: "Exterior and grounds", aliases: ["site services", "outside"] },
  { key: "landscaping", parent: "exterior", kind: "group", name: "Landscaping", aliases: ["mowing", "grounds"] },
  { key: "snow_removal", parent: "exterior", kind: "group", name: "Snow and ice", aliases: ["plowing", "salting"] },
  { key: "parking_lots", parent: "exterior", kind: "group", name: "Parking lots", aliases: ["pavement", "striping", "lot repair"] },
];
const problemByCategory: Record<string, string> = {
  refrigeration: "Walk-in cooler temperature is above the safe operating range",
  hvac: "Sales floor rooftop unit is running but not cooling",
  forecourt: "Dispenser payment terminal intermittently loses connection",
  plumbing: "Restroom supply line is leaking below the fixture",
  electrical: "Canopy lighting bank is dark after sunset",
  exterior: "Parking-lot drain and surrounding pavement need service",
  foodservice: "Rapid-cook oven is not reaching the programmed temperature",
};
const vendorByCategory: Record<string, string> = {
  refrigeration: "vendor-northline-summit",
  hvac: "vendor-northline-cedar",
  forecourt: "vendor-northline-forecourt",
  plumbing: "vendor-northline-cedar",
  electrical: "vendor-northline-brightpath",
  exterior: "vendor-northline-four-seasons",
  foodservice: "vendor-northline-cedar",
};

function at(month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(2026, month - 1, day, hour, minute)).toISOString();
}

function atYear(year: number, month: number, day: number, hour = 12) {
  return new Date(Date.UTC(year, month - 1, day, hour)).toISOString();
}

function durationSeconds(start: string, end: string) {
  return Math.floor((Date.parse(end) - Date.parse(start)) / 1000);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildFixture(): OpsFixture {
  const organization = { id: NORTHLINE_ORGANIZATION_ID, name: DEMO_ORGANIZATION_NAME, slug: "clark-pump-shop-demo", timeZone: "America/New_York", workOrderPrefix: DEMO_WORK_ORDER_PREFIX, createdAt: at(1, 2, 14) };
  const divisions: Division[] = [{ id: "division-northline-retail", organizationId: organization.id, code: "retail", name: "Convenience Retail", createdAt: organization.createdAt }];
  const regions = regionSeeds.map(([code, name]) => ({ id: `region-northline-${code}`, organizationId: organization.id, divisionId: divisions[0].id, code, name, createdAt: organization.createdAt }));
  const taxonomyNodes: TaxonomyNode[] = [];
  for (const [sortOrder, seed] of taxonomySeeds.entries()) {
    const parent = seed.parent ? taxonomyNodes.find((node) => node.canonicalKey === seed.parent) : undefined;
    if (seed.parent && !parent) throw new Error(`Taxonomy parent ${seed.parent} must be defined before ${seed.key}`);
    taxonomyNodes.push({
      id: `taxonomy-northline-${seed.key}`,
      organizationId: organization.id,
      parentNodeId: parent?.id,
      nodeKind: seed.kind,
      canonicalKey: seed.key,
      name: seed.name,
      aliases: seed.aliases,
      depth: parent ? parent.depth + 1 : 0,
      sortOrder,
      active: true,
      createdAt: organization.createdAt,
    });
  }
  const equipmentTemplates: EquipmentTemplate[] = [
    ["beer-cave", "taxonomy-northline-beer_caves", "Standard beer cave / walk-in cooler", 12],
    ["walk-in-freezer", "taxonomy-northline-freezers", "Standard walk-in freezer", 12],
    ["ice-machine", "taxonomy-northline-ice_machines", "Commercial ice machine", 10],
    ["rtu-5ton", "taxonomy-northline-rooftop_units", "5-ton packaged rooftop unit", 15],
    ["rtu-3ton", "taxonomy-northline-rooftop_units", "3-ton packaged rooftop unit", 15],
    ["fuel-dispenser", "taxonomy-northline-dispensers", "Two-sided fuel dispenser", 15],
    ["rapid-cook-oven", "taxonomy-northline-ovens", "Rapid-cook oven", 8],
  ].map(([key, taxonomyNodeId, name, life]) => ({ id: `equipment-template-${key}`, organizationId: organization.id, taxonomyNodeId: String(taxonomyNodeId), name: String(name), defaultExpectedLifeYears: Number(life), active: true, createdAt: organization.createdAt }));
  const componentTemplates: ComponentTemplate[] = [];
  const addTemplateComponents = (equipmentKey: string, rows: Array<[string, string, string?]>) => rows.forEach(([key, name, parentKey], sortOrder) => componentTemplates.push({ id: `component-template-${equipmentKey}-${key}`, organizationId: organization.id, equipmentTemplateId: `equipment-template-${equipmentKey}`, parentComponentTemplateId: parentKey ? `component-template-${equipmentKey}-${parentKey}` : undefined, name, sortOrder, createdAt: organization.createdAt }));
  addTemplateComponents("beer-cave", [["condensing-unit", "Condensing unit"], ["compressor", "Compressor", "condensing-unit"], ["condenser-fan", "Condenser fan motor", "condensing-unit"], ["evaporator", "Evaporator"], ["evaporator-fan", "Evaporator fan motor", "evaporator"], ["controller", "Temperature controller"], ["shelving", "Shelving"]]);
  addTemplateComponents("walk-in-freezer", [["condensing-unit", "Condensing unit"], ["compressor", "Compressor", "condensing-unit"], ["evaporator", "Evaporator"], ["evaporator-fan", "Evaporator fan motor", "evaporator"], ["defrost", "Defrost system"], ["controller", "Temperature controller"], ["door-heater", "Door heater"]]);
  addTemplateComponents("ice-machine", [["compressor", "Compressor"], ["water-pump", "Water pump"], ["evaporator", "Evaporator plate"], ["control-board", "Control board"], ["bin", "Storage bin"]]);
  addTemplateComponents("rtu-5ton", [["compressor", "Compressor"], ["supply-fan", "Supply fan motor"], ["condenser-fan", "Condenser fan motor"], ["heat-exchanger", "Heat exchanger"], ["controls", "Controls"], ["thermostat", "Thermostat", "controls"]]);
  addTemplateComponents("rtu-3ton", [["compressor", "Compressor"], ["supply-fan", "Supply fan motor"], ["condenser-fan", "Condenser fan motor"], ["heat-exchanger", "Heat exchanger"], ["controls", "Controls"], ["thermostat", "Thermostat", "controls"]]);
  addTemplateComponents("fuel-dispenser", [["payment-terminal", "Payment terminal"], ["meter", "Meter"], ["display", "Display"], ["hose", "Hose"], ["nozzle", "Nozzle", "hose"], ["breakaway", "Breakaway", "hose"]]);
  addTemplateComponents("rapid-cook-oven", [["control-board", "Control board"], ["magnetron", "Magnetron"], ["blower-motor", "Blower motor"], ["door-switch", "Door switch"], ["temperature-probe", "Temperature probe"]]);
  const stores: Store[] = storeSeeds.map(([number, name, address1, city, state, postalCode, latitudeE6, longitudeE6], index) => ({
    id: `store-northline-${number}`, organizationId: organization.id, divisionId: divisions[0].id, regionId: regions[Math.floor(index / 5)].id,
    storeNumber: number, name: `${DEMO_ORGANIZATION_NAME} - ${name}`, address1, city, state, postalCode,
    aliases: [name, `Store ${number}`, `${number} ${city}`], latitudeE6, longitudeE6, geofenceRadiusM: index === 6 ? 125 : 180, locationPolicyEnabled: true, timeZone: "America/New_York", status: "active", createdAt: at(1, 3, 14),
  }));

  const storeManagerNames = [
    "Cameron Blake", "Dana Ortiz", "Elliot Warren", "Robin Carter", "Harper Nguyen",
    "Avery Bennett", "Quinn Foster", "Reese Sullivan", "Skyler James", "Peyton Murphy",
    "Emerson Diaz", "Rowan Cooper", "Finley Ross", "Dakota Bailey", "Sage Perry",
  ];
  const users: User[] = [
    { id: "user-northline-executive", email: "alex.morgan@clark-demo.example", displayName: "Alex Morgan", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-facilities", email: "jordan.lee@clark-demo.example", displayName: "Jordan Lee", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-tech-1", email: "maria.santos@clark-demo.example", displayName: "Maria Santos", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-tech-2", email: "devon.price@clark-demo.example", displayName: "Devon Price", status: "active", createdAt: at(1, 2, 15) },
    ...regions.map((region, index) => ({ id: `user-northline-regional-${index + 1}`, email: `regional${index + 1}@clark-demo.example`, displayName: ["Taylor Reed", "Morgan Hayes", "Casey Brooks"][index], status: "active" as const, createdAt: at(1, 2, 15) })),
    ...stores.map((store, index) => ({ id: `user-northline-store-${store.storeNumber}`, email: `store${store.storeNumber}.manager@clark-demo.example`, displayName: storeManagerNames[index]!, status: "active" as const, createdAt: at(1, 2, 15) })),
    { id: "user-northline-finance", email: "finance.review@clark-demo.example", displayName: "Parker Shaw", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-facilities-approver", email: "samir.patel@clark-demo.example", displayName: "Samir Patel", status: "active", createdAt: at(1, 2, 15) },
  ];
  const memberships: Membership[] = [
    { id: "membership-northline-executive", organizationId: organization.id, userId: users[0].id, role: "executive", status: "active", createdAt: users[0].createdAt },
    { id: "membership-northline-facilities", organizationId: organization.id, userId: users[1].id, role: "facilities_admin", status: "active", createdAt: users[1].createdAt },
    { id: "membership-northline-tech-1", organizationId: organization.id, userId: users[2].id, role: "internal_technician", status: "active", createdAt: users[2].createdAt },
    { id: "membership-northline-tech-2", organizationId: organization.id, userId: users[3].id, role: "internal_technician", status: "active", createdAt: users[3].createdAt },
    ...regions.map((region, index) => ({ id: `membership-northline-regional-${index + 1}`, organizationId: organization.id, userId: users[index + 4].id, role: "regional_manager" as const, status: "active" as const, createdAt: users[index + 4].createdAt })),
    ...stores.map((store) => ({ id: `membership-northline-store-${store.storeNumber}`, organizationId: organization.id, userId: `user-northline-store-${store.storeNumber}`, role: "store_manager" as const, status: "active" as const, createdAt: at(1, 2, 15) })),
    { id: "membership-northline-finance", organizationId: organization.id, userId: "user-northline-finance", role: "finance_reviewer", status: "active", createdAt: at(1, 2, 15) },
    { id: "membership-northline-facilities-approver", organizationId: organization.id, userId: "user-northline-facilities-approver", role: "facilities_admin", status: "active", createdAt: at(1, 2, 15) },
  ];
  const scopeGrants: ScopeGrant[] = [
    ...memberships.slice(0, 4).map((membership) => ({ id: `scope-${membership.id}`, organizationId: organization.id, membershipId: membership.id, scopeKind: "organization" as const, scopeId: organization.id, permission: "ops:*", createdAt: membership.createdAt })),
    ...regions.map((region, index) => ({ id: `scope-northline-regional-${index + 1}`, organizationId: organization.id, membershipId: `membership-northline-regional-${index + 1}`, scopeKind: "region" as const, scopeId: region.id, permission: "ops:read_write", createdAt: at(1, 2, 15) })),
    ...stores.map((store) => ({ id: `scope-membership-northline-store-${store.storeNumber}`, organizationId: organization.id, membershipId: `membership-northline-store-${store.storeNumber}`, scopeKind: "store" as const, scopeId: store.id, permission: "ops:store_manage", createdAt: at(1, 2, 15) })),
    { id: "scope-membership-northline-finance", organizationId: organization.id, membershipId: "membership-northline-finance", scopeKind: "organization", scopeId: organization.id, permission: "ops:finance_read", createdAt: at(1, 2, 15) },
    { id: "scope-membership-northline-facilities-approver", organizationId: organization.id, membershipId: "membership-northline-facilities-approver", scopeKind: "organization", scopeId: organization.id, permission: "ops:*", createdAt: at(1, 2, 15) },
  ];

  const vendors: Vendor[] = vendorSeeds.map(([stableKey, code, name, email, phone, preferred]) => ({ id: `vendor-northline-${stableKey}`, organizationId: organization.id, code, name, dispatchEmail: email, dispatchPhone: phone, status: "approved", preferred, createdAt: at(1, 4, 14) }));
  const vendorReminders: VendorReminder[] = [
    { id: "vendor-reminder-summit-fall-capacity", organizationId: organization.id, vendorId: "vendor-northline-summit", title: "Confirm fall refrigeration PM availability", note: "Confirm crew capacity for the September refrigeration route before the schedule is released.", accountableParty: "Jordan Lee", dueAt: at(8, 28, 15), escalationTo: "Alex Morgan", status: "open", createdByActorType: "user", createdByActorId: "membership-northline-facilities", createdByActorName: "Jordan Lee", createdAt: at(8, 20, 14) },
    { id: "vendor-reminder-brightpath-coi", organizationId: organization.id, vendorId: "vendor-northline-brightpath", title: "Request renewed insurance certificate", note: "The current certificate expires September 15. Request the renewal before assigning new October work.", accountableParty: "Jordan Lee", dueAt: at(9, 1, 16), escalationTo: "Samir Patel", status: "open", createdByActorType: "user", createdByActorId: "membership-northline-facilities", createdByActorName: "Jordan Lee", createdAt: at(8, 22, 13) },
    { id: "vendor-reminder-cedar-after-hours-complete", organizationId: organization.id, vendorId: "vendor-northline-cedar", title: "Confirm after-hours escalation contacts", accountableParty: "Jordan Lee", dueAt: at(8, 15, 15), escalationTo: "Samir Patel", status: "completed", createdByActorType: "user", createdByActorId: "membership-northline-facilities", createdByActorName: "Jordan Lee", createdAt: at(8, 8, 14), completedByActorType: "user", completedByActorId: "membership-northline-facilities", completedByActorName: "Jordan Lee", completedAt: at(8, 14, 16), completionNote: "Primary and backup contacts confirmed with ClearFlow dispatch." },
  ];
  const vendorSpecialties: VendorSpecialty[] = vendors.flatMap((vendor) => specialtySeeds[vendor.code].map(([canonicalKey, displayName, searchAliases]) => ({ id: `specialty-${vendor.code}-${canonicalKey}`, organizationId: organization.id, vendorId: vendor.id, canonicalKey, displayName, searchAliases })));
  const vendorCoverage: VendorCoverage[] = vendors.map((vendor, index) => ({ id: `coverage-${vendor.code}-all`, organizationId: organization.id, vendorId: vendor.id, scopeKind: "organization", scopeId: organization.id, preferredRank: index < 3 ? 1 : 2 }));
  const vendorQualifications: OpsFixture["vendorQualifications"] = [
    { id: "qualification-summit-refrigeration-north", organizationId: organization.id, vendorId: "vendor-northline-summit", tradeKey: "refrigeration", serviceType: "preventive_and_reactive", assetType: "refrigeration", pmWork: true, emergencyResponse: true, warrantyWork: true, manufacturerAuthorization: "Copeland", regionId: "region-northline-north", afterHours: true, maximumJobAmount: { amountMinor: 2_500_000, currency: "USD" }, requiredLicense: "Michigan mechanical contractor", requiredCertification: "EPA Section 608", effectiveAt: atYear(2026, 1, 1), expiresAt: atYear(2027, 1, 1), status: "active", createdAt: atYear(2026, 1, 1) },
    { id: "qualification-cedar-mechanical-companywide", organizationId: organization.id, vendorId: "vendor-northline-cedar", tradeKey: "mechanical", serviceType: "preventive_and_reactive", assetType: "hvac_plumbing_foodservice", pmWork: true, emergencyResponse: true, warrantyWork: true, afterHours: true, maximumJobAmount: { amountMinor: 1_500_000, currency: "USD" }, requiredLicense: "Michigan mechanical and plumbing contractor", effectiveAt: atYear(2026, 2, 1), expiresAt: atYear(2027, 2, 1), status: "active", createdAt: atYear(2026, 2, 1) },
    { id: "qualification-forecourt-fuel-systems", organizationId: organization.id, vendorId: "vendor-northline-forecourt", tradeKey: "fuel_systems", serviceType: "dispensers_payment_and_tank_monitoring", assetType: "forecourt", pmWork: true, emergencyResponse: true, warrantyWork: true, afterHours: true, maximumJobAmount: { amountMinor: 3_000_000, currency: "USD" }, requiredCertification: "Manufacturer-authorized petroleum equipment service", effectiveAt: atYear(2026, 3, 1), expiresAt: atYear(2027, 3, 1), status: "active", createdAt: atYear(2026, 3, 1) },
    { id: "qualification-brightpath-electrical", organizationId: organization.id, vendorId: "vendor-northline-brightpath", tradeKey: "electrical", serviceType: "power_lighting_signage_and_low_voltage", assetType: "electrical_and_security", pmWork: true, emergencyResponse: true, warrantyWork: true, afterHours: true, maximumJobAmount: { amountMinor: 2_000_000, currency: "USD" }, requiredLicense: "Michigan electrical contractor", effectiveAt: atYear(2026, 1, 15), expiresAt: atYear(2027, 1, 15), status: "active", createdAt: atYear(2026, 1, 15) },
    { id: "qualification-four-seasons-site", organizationId: organization.id, vendorId: "vendor-northline-four-seasons", tradeKey: "exterior_services", serviceType: "landscaping_snow_and_pavement", assetType: "site_and_parking", pmWork: true, emergencyResponse: true, warrantyWork: false, afterHours: true, maximumJobAmount: { amountMinor: 1_000_000, currency: "USD" }, effectiveAt: atYear(2026, 4, 1), expiresAt: atYear(2027, 4, 1), status: "active", createdAt: atYear(2026, 4, 1) },
  ];
  const vendorComplianceDocuments: OpsFixture["vendorComplianceDocuments"] = [
    { id: "compliance-summit-insurance-2026", organizationId: organization.id, vendorId: "vendor-northline-summit", documentType: "insurance", issuer: "Fictional Mutual", reference: "COI-COLDLINE-2026", effectiveAt: atYear(2026, 1, 1), expiresAt: atYear(2027, 1, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 1, 2) },
    { id: "compliance-summit-license-2026", organizationId: organization.id, vendorId: "vendor-northline-summit", documentType: "license", issuer: "State licensing demo registry", reference: "MECH-COLDLINE-608", effectiveAt: atYear(2026, 1, 1), expiresAt: atYear(2027, 1, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 1, 2) },
    { id: "compliance-summit-tax-2026", organizationId: organization.id, vendorId: "vendor-northline-summit", documentType: "tax", reference: "W9-ON-FILE", reviewStatus: "approved", blocking: false, createdAt: atYear(2026, 1, 2) },
    { id: "compliance-cedar-insurance-2026", organizationId: organization.id, vendorId: "vendor-northline-cedar", documentType: "insurance", issuer: "Fictional Commercial Indemnity", reference: "COI-CEDAR-2026", effectiveAt: atYear(2026, 2, 1), expiresAt: atYear(2027, 2, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 2, 2) },
    { id: "compliance-cedar-license-2026", organizationId: organization.id, vendorId: "vendor-northline-cedar", documentType: "license", issuer: "State licensing demo registry", reference: "MECH-PLUMB-CEDAR", effectiveAt: atYear(2026, 2, 1), expiresAt: atYear(2027, 2, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 2, 2) },
    { id: "compliance-cedar-tax-2026", organizationId: organization.id, vendorId: "vendor-northline-cedar", documentType: "tax", reference: "W9-ON-FILE", reviewStatus: "approved", blocking: false, createdAt: atYear(2026, 2, 2) },
    { id: "compliance-forecourt-insurance-2026", organizationId: organization.id, vendorId: "vendor-northline-forecourt", documentType: "insurance", issuer: "Fictional Specialty Risk", reference: "COI-FORECOURT-2026", effectiveAt: atYear(2026, 3, 1), expiresAt: atYear(2027, 3, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 3, 2) },
    { id: "compliance-forecourt-certification-2026", organizationId: organization.id, vendorId: "vendor-northline-forecourt", documentType: "certification", issuer: "Petroleum equipment demo registry", reference: "PETRO-SVC-FORECOURT", effectiveAt: atYear(2026, 3, 1), expiresAt: atYear(2027, 3, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 3, 2) },
    { id: "compliance-forecourt-tax-2026", organizationId: organization.id, vendorId: "vendor-northline-forecourt", documentType: "tax", reference: "W9-ON-FILE", reviewStatus: "approved", blocking: false, createdAt: atYear(2026, 3, 2) },
    { id: "compliance-brightpath-insurance-2026", organizationId: organization.id, vendorId: "vendor-northline-brightpath", documentType: "insurance", issuer: "Fictional Trade Insurance", reference: "COI-BRIGHTPATH-2026", effectiveAt: atYear(2025, 9, 15), expiresAt: atYear(2026, 9, 15), reviewStatus: "approved", blocking: true, createdAt: atYear(2025, 9, 15) },
    { id: "compliance-brightpath-insurance-2027-pending", organizationId: organization.id, vendorId: "vendor-northline-brightpath", documentType: "insurance", issuer: "Fictional Trade Insurance", reference: "COI-BRIGHTPATH-2027-RENEWAL", effectiveAt: atYear(2026, 9, 15), expiresAt: atYear(2027, 9, 15), reviewStatus: "pending", blocking: true, createdAt: at(8, 24, 16) },
    { id: "compliance-brightpath-license-2026", organizationId: organization.id, vendorId: "vendor-northline-brightpath", documentType: "license", issuer: "State licensing demo registry", reference: "ELEC-BRIGHTPATH-2026", effectiveAt: atYear(2026, 1, 15), expiresAt: atYear(2027, 1, 15), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 1, 16) },
    { id: "compliance-brightpath-tax-2026", organizationId: organization.id, vendorId: "vendor-northline-brightpath", documentType: "tax", reference: "W9-ON-FILE", reviewStatus: "approved", blocking: false, createdAt: atYear(2026, 1, 16) },
    { id: "compliance-four-seasons-insurance-2026", organizationId: organization.id, vendorId: "vendor-northline-four-seasons", documentType: "insurance", issuer: "Fictional Grounds and Fleet", reference: "COI-FOUR-SEASONS-2026", effectiveAt: atYear(2026, 4, 1), expiresAt: atYear(2027, 4, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 4, 2) },
    { id: "compliance-four-seasons-safety-2026", organizationId: organization.id, vendorId: "vendor-northline-four-seasons", documentType: "safety", issuer: "Clark Pump and Shop vendor onboarding", reference: "SITE-SAFETY-ACK-2026", effectiveAt: atYear(2026, 4, 1), reviewStatus: "approved", blocking: true, createdAt: atYear(2026, 4, 2) },
    { id: "compliance-four-seasons-tax-2026", organizationId: organization.id, vendorId: "vendor-northline-four-seasons", documentType: "tax", reference: "W9-ON-FILE", reviewStatus: "approved", blocking: false, createdAt: atYear(2026, 4, 2) },
  ];
  const vendorContracts: OpsFixture["vendorContracts"] = [
    { id: "contract-summit-refrigeration", organizationId: organization.id, vendorId: "vendor-northline-summit", name: "Refrigeration service and preventive maintenance", ownerMembershipId: "membership-northline-facilities", status: "active", createdAt: atYear(2026, 1, 1) },
    { id: "contract-cedar-work-terms", organizationId: organization.id, vendorId: "vendor-northline-cedar", name: "Approved HVAC, plumbing, and kitchen service terms", ownerMembershipId: "membership-northline-facilities", status: "active", createdAt: atYear(2026, 2, 1) },
    { id: "contract-forecourt-work-terms", organizationId: organization.id, vendorId: "vendor-northline-forecourt", name: "Approved fuel and dispenser service terms", ownerMembershipId: "membership-northline-facilities", status: "active", createdAt: atYear(2026, 3, 1) },
    { id: "contract-brightpath-work-terms", organizationId: organization.id, vendorId: "vendor-northline-brightpath", name: "Approved electrical and lighting service terms", ownerMembershipId: "membership-northline-facilities", status: "active", createdAt: atYear(2026, 1, 15) },
    { id: "contract-four-seasons-work-terms", organizationId: organization.id, vendorId: "vendor-northline-four-seasons", name: "Approved exterior and grounds service terms", ownerMembershipId: "membership-northline-facilities", status: "active", createdAt: atYear(2026, 4, 1) },
  ];
  const contractVersions: OpsFixture["contractVersions"] = [
    { id: "contract-version-summit-refrigeration-v1", organizationId: organization.id, contractId: "contract-summit-refrigeration", vendorId: "vendor-northline-summit", version: 1, sourceAgreementReference: "CPS-COLDLINE-MSA-2026", status: "active", effectiveStartsAt: atYear(2026, 1, 1), effectiveEndsAt: atYear(2026, 12, 31, 23), renewalAt: atYear(2027, 1, 1), noticeDays: 60, priceEscalationAt: atYear(2027, 1, 1), currency: "USD", preferredProvider: true, exclusiveProvider: false, reactiveWorkAllowed: true, emergencyWorkAllowed: true, pmWorkAllowed: true, subcontractorPolicy: "approval_required", schedulingMode: "platform_proposed_vendor_confirmed", reservedCapacityMinutes: 240, nteAmount: { amountMinor: 500_000, currency: "USD" }, materialsMarkupBps: 1500, routeDiscountBps: 1000, evidenceRequirements: ["check_in", "check_out", "photo", "checklist"], complianceRequirements: ["insurance", "license"], warrantyLaborDays: 90, warrantyPartsDays: 365, warrantyTravelDays: 30, createdByMembershipId: "membership-northline-facilities", createdAt: atYear(2026, 1, 1) },
    { id: "contract-version-cedar-work-terms-v1", organizationId: organization.id, contractId: "contract-cedar-work-terms", vendorId: "vendor-northline-cedar", version: 1, sourceAgreementReference: "CPS-CLEARFLOW-WORK-TERMS-2026", status: "active", effectiveStartsAt: atYear(2026, 2, 1), effectiveEndsAt: atYear(2027, 1, 31, 23), currency: "USD", preferredProvider: true, exclusiveProvider: false, reactiveWorkAllowed: true, emergencyWorkAllowed: true, pmWorkAllowed: true, subcontractorPolicy: "approval_required", schedulingMode: "platform_proposed_vendor_confirmed", reservedCapacityMinutes: 0, materialsMarkupBps: 0, routeDiscountBps: 0, evidenceRequirements: ["check_in", "check_out"], complianceRequirements: ["insurance", "license"], warrantyLaborDays: 30, warrantyPartsDays: 90, createdByMembershipId: "membership-northline-facilities", createdAt: atYear(2026, 2, 1) },
    { id: "contract-version-forecourt-work-terms-v1", organizationId: organization.id, contractId: "contract-forecourt-work-terms", vendorId: "vendor-northline-forecourt", version: 1, sourceAgreementReference: "CPS-PUMPPRO-WORK-TERMS-2026", status: "active", effectiveStartsAt: atYear(2026, 3, 1), effectiveEndsAt: atYear(2027, 2, 28, 23), currency: "USD", preferredProvider: true, exclusiveProvider: false, reactiveWorkAllowed: true, emergencyWorkAllowed: true, pmWorkAllowed: true, subcontractorPolicy: "approval_required", schedulingMode: "platform_proposed_vendor_confirmed", reservedCapacityMinutes: 0, materialsMarkupBps: 0, routeDiscountBps: 0, evidenceRequirements: ["check_in", "check_out"], complianceRequirements: ["insurance", "certification"], warrantyLaborDays: 30, warrantyPartsDays: 90, createdByMembershipId: "membership-northline-facilities", createdAt: atYear(2026, 3, 1) },
    { id: "contract-version-brightpath-work-terms-v1", organizationId: organization.id, contractId: "contract-brightpath-work-terms", vendorId: "vendor-northline-brightpath", version: 1, sourceAgreementReference: "CPS-BRIGHTLINE-WORK-TERMS-2026", status: "active", effectiveStartsAt: atYear(2026, 1, 15), effectiveEndsAt: atYear(2027, 1, 14, 23), currency: "USD", preferredProvider: false, exclusiveProvider: false, reactiveWorkAllowed: true, emergencyWorkAllowed: true, pmWorkAllowed: true, subcontractorPolicy: "approval_required", schedulingMode: "platform_proposed_vendor_confirmed", reservedCapacityMinutes: 0, materialsMarkupBps: 0, routeDiscountBps: 0, evidenceRequirements: ["check_in", "check_out"], complianceRequirements: ["insurance", "license"], warrantyLaborDays: 30, warrantyPartsDays: 90, createdByMembershipId: "membership-northline-facilities", createdAt: atYear(2026, 1, 15) },
    { id: "contract-version-four-seasons-work-terms-v1", organizationId: organization.id, contractId: "contract-four-seasons-work-terms", vendorId: "vendor-northline-four-seasons", version: 1, sourceAgreementReference: "CPS-GREENLOT-WORK-TERMS-2026", status: "active", effectiveStartsAt: atYear(2026, 4, 1), effectiveEndsAt: atYear(2027, 3, 31, 23), currency: "USD", preferredProvider: false, exclusiveProvider: false, reactiveWorkAllowed: true, emergencyWorkAllowed: true, pmWorkAllowed: true, subcontractorPolicy: "approval_required", schedulingMode: "platform_proposed_vendor_confirmed", reservedCapacityMinutes: 0, materialsMarkupBps: 0, routeDiscountBps: 0, evidenceRequirements: ["check_in", "check_out"], complianceRequirements: ["insurance", "safety"], warrantyLaborDays: 30, warrantyPartsDays: 30, createdByMembershipId: "membership-northline-facilities", createdAt: atYear(2026, 4, 1) },
  ];
  const contractScopes: OpsFixture["contractScopes"] = [
    { id: "contract-scope-summit-north", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", scopeKind: "region", scopeId: "region-northline-north", included: true },
    { id: "contract-scope-summit-refrigeration", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", scopeKind: "trade", scopeId: "refrigeration", included: true },
    { id: "contract-scope-summit-pm", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", scopeKind: "pm_program", scopeId: "maintenance-program-quarterly-refrigeration-v1", included: true },
    { id: "contract-scope-cedar-company", organizationId: organization.id, contractVersionId: "contract-version-cedar-work-terms-v1", scopeKind: "organization", scopeId: organization.id, included: true },
    { id: "contract-scope-cedar-hvac", organizationId: organization.id, contractVersionId: "contract-version-cedar-work-terms-v1", scopeKind: "trade", scopeId: "hvac", included: true },
    { id: "contract-scope-cedar-plumbing", organizationId: organization.id, contractVersionId: "contract-version-cedar-work-terms-v1", scopeKind: "trade", scopeId: "plumbing", included: true },
    { id: "contract-scope-forecourt-company", organizationId: organization.id, contractVersionId: "contract-version-forecourt-work-terms-v1", scopeKind: "organization", scopeId: organization.id, included: true },
    { id: "contract-scope-brightpath-company", organizationId: organization.id, contractVersionId: "contract-version-brightpath-work-terms-v1", scopeKind: "organization", scopeId: organization.id, included: true },
    { id: "contract-scope-brightpath-electrical", organizationId: organization.id, contractVersionId: "contract-version-brightpath-work-terms-v1", scopeKind: "trade", scopeId: "electrical", included: true },
    { id: "contract-scope-four-seasons-company", organizationId: organization.id, contractVersionId: "contract-version-four-seasons-work-terms-v1", scopeKind: "organization", scopeId: organization.id, included: true },
    { id: "contract-scope-four-seasons-exterior", organizationId: organization.id, contractVersionId: "contract-version-four-seasons-work-terms-v1", scopeKind: "trade", scopeId: "exterior", included: true },
  ];
  const rateCardLines: OpsFixture["rateCardLines"] = [
    { id: "rate-summit-trip", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", chargeType: "trip", description: "Standard refrigeration dispatch", unit: "visit", amount: { amountMinor: 12_500, currency: "USD" }, effectiveStartsAt: atYear(2026, 1, 1) },
    { id: "rate-summit-labor", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", chargeType: "labor", description: "Refrigeration service labor", unit: "hour", amount: { amountMinor: 14_500, currency: "USD" }, effectiveStartsAt: atYear(2026, 1, 1) },
    { id: "rate-summit-pm", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", chargeType: "pm", description: "Quarterly refrigeration PM per asset", unit: "occurrence", amount: { amountMinor: 42_500, currency: "USD" }, effectiveStartsAt: atYear(2026, 1, 1) },
  ];
  const serviceLevelPolicies: OpsFixture["serviceLevelPolicies"] = [
    { id: "sla-summit-urgent", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", priority: "urgent", responseMinutes: 60, arrivalMinutes: 240, completionMinutes: 720, calendar: "24x7" },
    { id: "sla-summit-planned", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", priority: "planned", responseMinutes: 1_440, arrivalMinutes: 4_320, completionMinutes: 10_080, calendar: "business_hours" },
  ];
  const schedulingPolicies: OpsFixture["schedulingPolicies"] = [
    { id: "scheduling-summit-v1", organizationId: organization.id, contractVersionId: "contract-version-summit-refrigeration-v1", maximumRouteMinutes: 600, maximumStores: 5, maximumTravelMinutes: 180, maximumUtilizationBps: 8000, perStopBufferMinutes: 15, travelBufferBps: 2000, documentationBufferMinutes: 10, uncertaintyBufferBps: 3000, emergencyReserveMinutes: 60 },
  ];
  const vendorCapacity: OpsFixture["vendorCapacity"] = [
    { id: "capacity-summit-north-2026-08-24", organizationId: organization.id, vendorId: "vendor-northline-summit", regionId: "region-northline-north", tradeKey: "refrigeration", startsAt: at(8, 24, 8), endsAt: at(8, 24, 18), crewMinutes: 600, committedMinutes: 120, maximumRouteMinutes: 600, maximumStores: 5, maximumTravelMinutes: 180, blackout: false, emergencyReserveMinutes: 60, variableWorkLimitMinutes: 180, specialEquipment: ["refrigerant-recovery", "coil-cleaning"], createdAt: at(8, 1, 12) },
  ];

  const replacementProfiles: ReplacementProfile[] = [
    { id: "replacement-profile-beer-cave-medium", organizationId: organization.id, code: "REF-BEER-CAVE-MED", name: "Medium beer cave refrigeration system", description: "Functionally equivalent medium beer-cave condensing system, independent of manufacturer or installer.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", matchKeys: ["application", "capacity_band", "refrigerant"], attributes: { application: "beer_cave", capacity_band: "medium", refrigerant: "r448a" }, expectedLifeYears: 12, annualEscalationBps: 350, lowVarianceBps: 1000, highVarianceBps: 1800, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-walk-in-freezer", organizationId: organization.id, code: "REF-WALKIN-FRZ", name: "Standard walk-in freezer system", description: "Walk-in freezer refrigeration system with a standard condensing unit, evaporator, controls, and installation allowance.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-freezers", matchKeys: ["application", "capacity_band"], attributes: { application: "walk_in_freezer", capacity_band: "standard" }, expectedLifeYears: 12, annualEscalationBps: 350, lowVarianceBps: 1000, highVarianceBps: 1800, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-ice-machine", organizationId: organization.id, code: "REF-ICE-650", name: "Commercial ice machine", description: "Air-cooled commercial ice machine in the 600–800 pound daily-output range, including normal installation and commissioning.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-ice_machines", matchKeys: ["equipment_type", "output_band"], attributes: { equipment_type: "commercial_ice_machine", output_band: "600_800_lb" }, expectedLifeYears: 10, annualEscalationBps: 325, lowVarianceBps: 900, highVarianceBps: 1600, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-rtu-5ton", organizationId: organization.id, code: "HVAC-RTU-5T", name: "5-ton sales-floor rooftop unit", description: "Packaged rooftop HVAC replacement including standard curb adaptation and controls.", categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", matchKeys: ["equipment_type", "capacity_tons", "heat_type"], attributes: { equipment_type: "packaged_rtu", capacity_tons: "5", heat_type: "gas" }, expectedLifeYears: 15, annualEscalationBps: 300, lowVarianceBps: 1200, highVarianceBps: 2200, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-rtu-3ton", organizationId: organization.id, code: "HVAC-RTU-3T", name: "3-ton back-room rooftop unit", description: "Smaller packaged rooftop HVAC replacement for foodservice and back-room zones.", categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", matchKeys: ["equipment_type", "capacity_tons", "heat_type"], attributes: { equipment_type: "packaged_rtu", capacity_tons: "3", heat_type: "gas" }, expectedLifeYears: 15, annualEscalationBps: 300, lowVarianceBps: 1200, highVarianceBps: 2200, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-dispenser-two-sided", organizationId: organization.id, code: "FUEL-DISP-2S", name: "Two-sided retail fuel dispenser", description: "Two-sided dispenser replacement with payment hardware and standard commissioning.", categoryKey: "forecourt", taxonomyNodeId: "taxonomy-northline-dispensers", matchKeys: ["equipment_type", "sides", "payment_enabled"], attributes: { equipment_type: "fuel_dispenser", sides: "2", payment_enabled: "yes" }, expectedLifeYears: 15, annualEscalationBps: 275, lowVarianceBps: 800, highVarianceBps: 1500, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-rapid-cook-oven", organizationId: organization.id, code: "FOOD-RAPID-OVEN", name: "Countertop rapid-cook oven", description: "Commercial ventless rapid-cook oven for a c-store hot-food program, including normal delivery and setup.", categoryKey: "foodservice", taxonomyNodeId: "taxonomy-northline-ovens", matchKeys: ["equipment_type", "size_class"], attributes: { equipment_type: "rapid_cook_oven", size_class: "countertop" }, expectedLifeYears: 8, annualEscalationBps: 300, lowVarianceBps: 800, highVarianceBps: 1500, active: true, createdAt: at(1, 5, 13) },
  ];

  // The presentation tenant carries a credible equipment register rather than
  // one token asset per category. Repeated equipment is named by its physical
  // location so a store manager can distinguish it without decoding asset tags.
  // The template key is fixture-only setup metadata; persisted assets remain
  // independent of the onboarding template that created them.
  const assets: Asset[] = [];
  const assetEquipmentTemplateKeys = new Map<string, string>();
  const seedAsset = (asset: Asset, equipmentTemplateKey: string) => {
    assets.push({ ...asset, equipmentTemplateId: `equipment-template-${equipmentTemplateKey}` });
    assetEquipmentTemplateKeys.set(asset.id, equipmentTemplateKey);
  };
  const dispenserLocations = ["Northwest island", "Northeast island", "Southwest island", "Southeast island"];

  stores.forEach((store, storeIndex) => {
    const storeNumber = store.storeNumber;
    const numericStore = Number(storeNumber);
    const createdAt = at(1, 5, 14);
    seedAsset({ id: `asset-${storeNumber}-beer-cave`, organizationId: organization.id, storeId: store.id, categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", groupPath: ["Refrigeration", "Walk-in refrigeration", "Coolers", "Beer caves"], assetTag: `${storeNumber}-REF-01`, name: "Beer cave - rear sales floor", manufacturer: storeNumber === "104" ? "Heatcraft" : "Copeland", model: storeNumber === "104" ? "LHT040L6C" : "M4FH-A050", serialNumber: `M4F${String(storeNumber === "115" ? 2019 : 2017 + (numericStore % 5)).slice(-2)}${storeNumber}A1`, supplier: "Regional Equipment Supply", installedAt: atYear(storeNumber === "115" ? 2019 : 2017 + (numericStore % 5), 4, 12), expectedLifeYears: 12, warrantyEndsAt: atYear(storeNumber === "115" ? 2024 : 2022 + (numericStore % 5), 4, 12), replacementProfileId: "replacement-profile-beer-cave-medium", replacementAttributes: { application: "beer_cave", capacity_band: "medium", refrigerant: "r448a" }, replacementAdjustmentBps: storeNumber === "104" ? 500 : undefined, replacementEstimate: { amountMinor: 2_800_000 + numericStore * 1000, currency: "USD" }, status: storeNumber === "115" ? "watch" : "operational", createdAt }, "beer-cave");
    seedAsset({ id: `asset-${storeNumber}-walk-in-freezer`, organizationId: organization.id, storeId: store.id, categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-freezers", groupPath: ["Refrigeration", "Walk-in refrigeration", "Freezers"], assetTag: `${storeNumber}-FRZ-01`, name: "Walk-in freezer - receiving", manufacturer: storeIndex % 2 ? "Heatcraft" : "Russell", model: storeIndex % 2 ? "H-IM-60" : "RLS-050", serialNumber: `WIF${18 + (storeIndex % 4)}${storeNumber}F1`, supplier: "Regional Equipment Supply", installedAt: atYear(2018 + (storeIndex % 4), 2, 18), expectedLifeYears: 12, warrantyEndsAt: atYear(2023 + (storeIndex % 4), 2, 18), replacementProfileId: storeNumber === "113" ? undefined : "replacement-profile-walk-in-freezer", replacementAttributes: { application: "walk_in_freezer", capacity_band: "standard" }, replacementEstimate: { amountMinor: 3_150_000 + storeIndex * 25_000, currency: "USD" }, status: storeNumber === "113" ? "out_of_service" : storeNumber === "103" ? "watch" : "operational", createdAt }, "walk-in-freezer");
    seedAsset({ id: `asset-${storeNumber}-ice-machine`, organizationId: organization.id, storeId: store.id, categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-ice_machines", groupPath: ["Refrigeration", "Ice machines"], assetTag: `${storeNumber}-ICE-01`, name: "Ice machine - beverage island", manufacturer: storeIndex % 3 ? "Manitowoc" : "Hoshizaki", model: storeIndex % 3 ? "IYT0750A" : "KM-660MAJ", serialNumber: `ICE${20 + (storeIndex % 4)}${storeNumber}B1`, supplier: "ColdLine Refrigeration & HVAC", installedAt: atYear(2020 + (storeIndex % 4), 5, 20), expectedLifeYears: 10, warrantyEndsAt: atYear(2025 + (storeIndex % 4), 5, 20), replacementProfileId: storeNumber === "114" ? undefined : "replacement-profile-ice-machine", replacementAttributes: { equipment_type: "commercial_ice_machine", output_band: "600_800_lb" }, replacementEstimate: { amountMinor: 1_180_000 + storeIndex * 12_500, currency: "USD" }, status: storeNumber === "114" ? "watch" : "operational", createdAt }, "ice-machine");
    seedAsset({ id: `asset-${storeNumber}-rtu-1`, organizationId: organization.id, storeId: store.id, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", groupPath: ["HVAC", "Rooftop units"], assetTag: `${storeNumber}-HVAC-01`, name: "Rooftop unit 1 - sales floor", manufacturer: "Trane", model: "Precedent YSC", serialNumber: `YSC${18 + (numericStore % 4)}${storeNumber}R1`, supplier: "ClearFlow HVAC, Plumbing & Kitchen Repair", installedAt: atYear(2018 + (numericStore % 4), 6, 1), expectedLifeYears: 15, warrantyEndsAt: atYear(2023 + (numericStore % 4), 6, 1), replacementProfileId: "replacement-profile-rtu-5ton", replacementAttributes: { equipment_type: "packaged_rtu", capacity_tons: "5", heat_type: "gas" }, replacementEstimate: { amountMinor: 1_950_000, currency: "USD" }, status: storeNumber === "112" ? "watch" : "operational", createdAt }, "rtu-5ton");
    if (storeIndex % 3 !== 1) seedAsset({ id: `asset-${storeNumber}-rtu-2`, organizationId: organization.id, storeId: store.id, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", groupPath: ["HVAC", "Rooftop units"], assetTag: `${storeNumber}-HVAC-02`, name: "Rooftop unit 2 - foodservice and back room", manufacturer: storeIndex % 2 ? "Carrier" : "Lennox", model: storeIndex % 2 ? "48FC" : "LGA036", serialNumber: `RTU${19 + (storeIndex % 3)}${storeNumber}R2`, supplier: "ClearFlow HVAC, Plumbing & Kitchen Repair", installedAt: atYear(2019 + (storeIndex % 3), 6, 1), expectedLifeYears: 15, warrantyEndsAt: atYear(2024 + (storeIndex % 3), 6, 1), replacementProfileId: "replacement-profile-rtu-3ton", replacementAttributes: { equipment_type: "packaged_rtu", capacity_tons: "3", heat_type: "gas" }, replacementAdjustmentBps: 300, replacementEstimate: { amountMinor: 1_650_000, currency: "USD" }, status: "operational", createdAt }, "rtu-3ton");
    dispenserLocations.forEach((location, dispenserIndex) => {
      const dispenserNumber = dispenserIndex + 1;
      seedAsset({ id: `asset-${storeNumber}-dispenser-${dispenserNumber}`, organizationId: organization.id, storeId: store.id, categoryKey: "forecourt", taxonomyNodeId: "taxonomy-northline-dispensers", groupPath: ["Fuel and forecourt", "Dispensers"], assetTag: `${storeNumber}-FUEL-${String(dispenserNumber).padStart(2, "0")}`, name: `Dispenser ${dispenserNumber} - ${location}`, manufacturer: "Gilbarco", model: "Encore 700 S", serialNumber: `E7S${19 + (numericStore % 3)}${storeNumber}${String(dispenserNumber).padStart(2, "0")}`, supplier: "PumpPro Fuel & Dispenser Repair", installedAt: atYear(2019 + (numericStore % 3), 9, 15), expectedLifeYears: 15, warrantyEndsAt: atYear(2024 + (numericStore % 3), 9, 15), replacementProfileId: "replacement-profile-dispenser-two-sided", replacementAttributes: { equipment_type: "fuel_dispenser", sides: "2", payment_enabled: "yes" }, replacementEstimate: { amountMinor: 2_250_000, currency: "USD" }, status: storeNumber === "109" && dispenserNumber === 4 ? "watch" : "operational", createdAt }, "fuel-dispenser");
    });
    if (storeIndex % 2 === 0) seedAsset({ id: `asset-${storeNumber}-rapid-cook-oven`, organizationId: organization.id, storeId: store.id, categoryKey: "foodservice", taxonomyNodeId: "taxonomy-northline-ovens", groupPath: ["Foodservice equipment", "Ovens"], assetTag: `${storeNumber}-FOOD-01`, name: "Rapid-cook oven - hot food line", manufacturer: storeIndex % 4 ? "TurboChef" : "Merrychef", model: storeIndex % 4 ? "Sota" : "eikon e2s", serialNumber: `RCO${21 + (storeIndex % 3)}${storeNumber}K1`, supplier: "ClearFlow HVAC, Plumbing & Kitchen Repair", installedAt: atYear(2021 + (storeIndex % 3), 3, 10), expectedLifeYears: 8, warrantyEndsAt: atYear(2024 + (storeIndex % 3), 3, 10), replacementProfileId: storeNumber === "101" ? undefined : "replacement-profile-rapid-cook-oven", replacementAttributes: { equipment_type: "rapid_cook_oven", size_class: "countertop" }, replacementPlanningExcludedAt: storeNumber === "101" ? at(7, 15, 10) : undefined, replacementPlanningExclusionReason: storeNumber === "101" ? "Landlord-owned foodservice equipment is outside Clark Pump and Shop's capital plan." : undefined, replacementEstimate: { amountMinor: 1_260_000 + storeIndex * 10_000, currency: "USD" }, status: "operational", createdAt }, "rapid-cook-oven");
  });
  const replacementBenchmarks: ReplacementBenchmark[] = [
    { id: "replacement-benchmark-beer-cave-2024", organizationId: organization.id, profileId: "replacement-profile-beer-cave-medium", sourceType: "manual", equipmentAmount: { amountMinor: 1_920_000, currency: "USD" }, installationAmount: { amountMinor: 730_000, currency: "USD" }, otherAmount: { amountMinor: 0, currency: "USD" }, totalAmount: { amountMinor: 2_650_000, currency: "USD" }, effectiveAt: atYear(2024, 2, 15), status: "published", notes: "Original planning benchmark entered from the 2024 refrigeration refresh.", createdAt: atYear(2024, 2, 15) },
    { id: "replacement-benchmark-walk-in-freezer-2024", organizationId: organization.id, profileId: "replacement-profile-walk-in-freezer", sourceType: "catalog", equipmentAmount: { amountMinor: 2_420_000, currency: "USD" }, installationAmount: { amountMinor: 780_000, currency: "USD" }, otherAmount: { amountMinor: 160_000, currency: "USD" }, totalAmount: { amountMinor: 3_360_000, currency: "USD" }, effectiveAt: atYear(2024, 3, 15), status: "published", notes: "Budgetary walk-in freezer system estimate reviewed for portfolio planning.", createdAt: atYear(2024, 3, 15) },
    { id: "replacement-benchmark-ice-machine-2023", organizationId: organization.id, profileId: "replacement-profile-ice-machine", sourceType: "catalog", equipmentAmount: { amountMinor: 940_000, currency: "USD" }, installationAmount: { amountMinor: 180_000, currency: "USD" }, otherAmount: { amountMinor: 60_000, currency: "USD" }, totalAmount: { amountMinor: 1_180_000, currency: "USD" }, effectiveAt: atYear(2023, 1, 20), status: "published", notes: "Original commercial ice-machine planning estimate; scheduled for annual source review.", createdAt: atYear(2023, 1, 20) },
    { id: "replacement-benchmark-rtu-2025", organizationId: organization.id, profileId: "replacement-profile-rtu-5ton", sourceType: "catalog", equipmentAmount: { amountMinor: 1_420_000, currency: "USD" }, installationAmount: { amountMinor: 610_000, currency: "USD" }, otherAmount: { amountMinor: 120_000, currency: "USD" }, totalAmount: { amountMinor: 2_150_000, currency: "USD" }, effectiveAt: atYear(2025, 10, 1), status: "published", notes: "Budgetary replacement benchmark reviewed with facilities.", createdAt: atYear(2025, 10, 1) },
    { id: "replacement-benchmark-dispenser-2025", organizationId: organization.id, profileId: "replacement-profile-dispenser-two-sided", sourceType: "catalog", equipmentAmount: { amountMinor: 2_150_000, currency: "USD" }, installationAmount: { amountMinor: 480_000, currency: "USD" }, otherAmount: { amountMinor: 170_000, currency: "USD" }, totalAmount: { amountMinor: 2_800_000, currency: "USD" }, effectiveAt: atYear(2025, 11, 1), status: "published", notes: "Budgetary dispenser benchmark including payment commissioning.", createdAt: atYear(2025, 11, 1) },
    { id: "replacement-benchmark-rapid-cook-oven-2025", organizationId: organization.id, profileId: "replacement-profile-rapid-cook-oven", sourceType: "catalog", equipmentAmount: { amountMinor: 1_080_000, currency: "USD" }, installationAmount: { amountMinor: 130_000, currency: "USD" }, otherAmount: { amountMinor: 50_000, currency: "USD" }, totalAmount: { amountMinor: 1_260_000, currency: "USD" }, effectiveAt: atYear(2025, 8, 1), status: "published", notes: "Rapid-cook oven replacement estimate reviewed with the foodservice equipment provider.", createdAt: atYear(2025, 8, 1) },
  ];
  const assetReplacementOverrides: AssetReplacementOverride[] = [
    { id: "replacement-override-104-beer-cave", organizationId: organization.id, assetId: "asset-104-beer-cave", amount: { amountMinor: 3_480_000, currency: "USD" }, effectiveAt: atYear(2026, 5, 1), reason: "Store 104 requires a longer line set and rooftop crane access.", status: "active", createdAt: atYear(2026, 5, 1) },
  ];
  const replacementEvents: ReplacementEvent[] = [];
  const lifecycleRecommendations: OpsFixture["lifecycleRecommendations"] = [];
  const components: AssetComponent[] = [];
  const componentLifecycleEvents: ComponentLifecycleEvent[] = [];
  const componentIdFor = (asset: Asset, templateId: string, equipmentTemplateKey: string) => {
    const componentKey = templateId.replace(`component-template-${equipmentTemplateKey}-`, "");
    if (asset.id === "asset-104-beer-cave") {
      if (componentKey === "compressor") return "component-104-compressor";
      if (componentKey === "controller") return "component-104-controller";
      if (componentKey === "evaporator-fan") return "component-104-evaporator-fan";
    }
    return `component-${asset.id.replace(/^asset-/, "")}-${componentKey}`;
  };
  assets.forEach((asset) => {
    const equipmentTemplateKey = assetEquipmentTemplateKeys.get(asset.id)!;
    const equipmentTemplateId = `equipment-template-${equipmentTemplateKey}`;
    const templateComponents = componentTemplates.filter((template) => template.equipmentTemplateId === equipmentTemplateId);
    const componentIds = new Map(templateComponents.map((template) => [template.id, componentIdFor(asset, template.id, equipmentTemplateKey)]));
    templateComponents.forEach((template) => {
      const componentId = componentIds.get(template.id)!;
      const storyComponent = asset.id === "asset-104-beer-cave" ? componentId : undefined;
      const storyDetails = storyComponent === "component-104-compressor"
        ? { partNumber: "ZB38KCE-TFD", serialNumber: "CMP104-2026-0710", installedAt: atYear(2026, 7, 10), warrantyEndsAt: atYear(2028, 7, 10) }
        : storyComponent === "component-104-controller"
          ? { partNumber: "XR60CX", serialNumber: "CTL104-44310", installedAt: atYear(2023, 3, 12), warrantyEndsAt: atYear(2025, 3, 12) }
          : storyComponent === "component-104-evaporator-fan"
            ? { partNumber: "ECM-5108", installedAt: atYear(2024, 8, 18), warrantyEndsAt: atYear(2026, 8, 18) }
            : {};
      components.push({ id: componentId, organizationId: organization.id, assetId: asset.id, parentComponentId: template.parentComponentTemplateId ? componentIds.get(template.parentComponentTemplateId) : undefined, name: template.name, installedAt: asset.installedAt, warrantyEndsAt: asset.warrantyEndsAt, createdAt: at(1, 5, 14), ...storyDetails });
    });
  });
  const compressor104 = components.find((component) => component.id === "component-104-compressor")!;
  components.push({
    id: "component-104-compressor-removed-2021", organizationId: organization.id, assetId: compressor104.assetId,
    parentComponentId: compressor104.parentComponentId, name: "Compressor (removed July 2026)", partNumber: "ZB38KCE-TFD",
    serialNumber: "CMP104-88214", installedAt: atYear(2021, 5, 6), warrantyEndsAt: atYear(2026, 5, 6),
    removedAt: atYear(2026, 7, 10), replacedByComponentId: compressor104.id, createdAt: at(1, 5, 14),
  });

  const requests: ServiceRequest[] = [];
  const requestImpactAssessments: RequestImpactAssessment[] = [];
  const workOrders: WorkOrder[] = [];
  const assignments: WorkOrderAssignment[] = [];
  const issuances: WorkOrderIssuance[] = [];
  const vendorResponses: VendorResponse[] = [];
  const serviceAppointments: ServiceAppointment[] = [];
  const vendorContinuations: VendorContinuation[] = [];
  const estimateRequests: WorkOrderEstimateRequest[] = [];
  const estimateProposals: VendorEstimateProposal[] = [];
  const visits: VisitSession[] = [];
  const siteVisitWorkOrders: SiteVisitWorkOrder[] = [];
  const workOrderVerifications: WorkOrderVerification[] = [];
  const visitEvidence: VisitEvidence[] = [];
  const followUps: FollowUp[] = [];
  const workflowTasks: WorkflowTask[] = [];
  const workflowTaskSlaPauses: WorkflowTaskSlaPause[] = [];
  const workflowTaskSlaResumes: WorkflowTaskSlaResume[] = [];
  const files: StoredFile[] = [];
  const entityFiles: EntityFileLink[] = [];
  const exceptions: OpsException[] = [];
  const costLines: CostLine[] = [];
  const invoiceReferences: InvoiceReference[] = [];
  const invoiceAllocations: InvoiceAllocation[] = [];
  const auditEvents: AuditEvent[] = [];
  const outboxMessages: OutboxMessage[] = [];
  const approvalPolicies: ApprovalPolicy[] = [
    { id: "approval-policy-store-routine-v1", organizationId: organization.id, policyKey: "store-routine", version: 1, name: "Routine store authorization", scopeKind: "organization", scopeId: organization.id, minAmountMinor: 0, maxAmountMinor: 99_999, currency: "USD", requiredRole: "store_manager", escalationRole: "regional_manager", status: "active", createdByMembershipId: "membership-northline-facilities", createdAt: at(1, 8, 14) },
    { id: "approval-policy-regional-service-v1", organizationId: organization.id, policyKey: "regional-service", version: 1, name: "Regional service authorization", scopeKind: "organization", scopeId: organization.id, minAmountMinor: 100_000, maxAmountMinor: 499_999, currency: "USD", requiredRole: "regional_manager", escalationRole: "facilities_admin", status: "active", createdByMembershipId: "membership-northline-facilities", createdAt: at(1, 8, 14, 5) },
    { id: "approval-policy-major-repair-v1", organizationId: organization.id, policyKey: "major-repair", version: 1, name: "Major repair authorization", scopeKind: "organization", scopeId: organization.id, minAmountMinor: 500_000, maxAmountMinor: 2_499_999, currency: "USD", requiredRole: "facilities_admin", escalationRole: "executive", status: "active", createdByMembershipId: "membership-northline-facilities", createdAt: at(1, 8, 14, 10) },
    { id: "approval-policy-refrigeration-capital-v1", organizationId: organization.id, policyKey: "refrigeration-capital", version: 1, name: "Refrigeration capital authorization", scopeKind: "organization", scopeId: organization.id, categoryKey: "refrigeration", minAmountMinor: 2_500_000, currency: "USD", requiredRole: "executive", status: "active", createdByMembershipId: "membership-northline-facilities", createdAt: at(1, 8, 14, 15) },
  ];
  const approvalRequests: ApprovalRequest[] = [];
  const approvalDecisions: ApprovalDecision[] = [];

  stores.forEach((store, index) => {
    const categoryKey = store.storeNumber === "104"
      ? "refrigeration"
      : store.storeNumber === "109"
        ? "forecourt"
        : store.storeNumber === "112"
          ? "hvac"
          : categoryCycle[index % categoryCycle.length];
    const internal = index === 6 || index === 9;
    const chooseLater = index === 14;
    const vendorId = internal || chooseLater ? undefined : vendorByCategory[categoryKey];
    const requestTime = store.storeNumber === "112" ? at(8, 9, 13) : at(7, 5 + index, 12);
    const workTime = store.storeNumber === "112" ? at(8, 9, 13, 30) : at(7, 5 + index, 12, 30);
    const requestId = `request-northline-${store.storeNumber}`;
    const workOrderId = `wo-northline-${store.storeNumber}`;
    const problem = store.storeNumber === "104" ? "Beer cave is warm; display reads 48°F and product is not holding temperature" : problemByCategory[categoryKey];
    requests.push({ id: requestId, organizationId: organization.id, reference: `REQ-26-${store.storeNumber}`, storeId: store.id, reporterName: ["Avery Johnson", "Jamie Cole", "Riley Adams"][index % 3], reporterEmployeeId: `E${3100 + index}`, problem, priority: ["urgent", "routine", "routine"][index % 3] as WorkOrder["priority"], status: "converted", submittedAt: requestTime, convertedWorkOrderId: workOrderId });
    const assetId = categoryKey === "refrigeration"
      ? `asset-${store.storeNumber}-beer-cave`
      : categoryKey === "hvac"
        ? `asset-${store.storeNumber}-rtu-1`
        : categoryKey === "forecourt"
          ? `asset-${store.storeNumber}-dispenser-4`
          : undefined;
    const currentActive = store.storeNumber === "112";
    workOrders.push({ id: workOrderId, organizationId: organization.id, number: `CPS-2026-${String(101 + index).padStart(4, "0")}`, storeId: store.id, requestId, problem, authorizedScope: `Diagnose and complete repairs necessary to restore ${categoryKey} operation. Document any additional recommended work separately.`, categoryKey, taxonomyNodeId: assetId ? (categoryKey === "refrigeration" ? "taxonomy-northline-beer_caves" : categoryKey === "hvac" ? "taxonomy-northline-rooftop_units" : "taxonomy-northline-dispensers") : `taxonomy-northline-${categoryKey}`, assetId, componentId: store.storeNumber === "104" ? "component-104-compressor" : undefined, priority: store.storeNumber === "104" || currentActive ? "urgent" : "routine", status: chooseLater ? "approved" : currentActive ? "in_progress" : "closed", accountableParty: chooseLater ? "Facilities coordinator" : currentActive ? "ClearFlow HVAC, Plumbing & Kitchen Repair" : "Facilities", nextAction: chooseLater ? "Choose service provider" : currentActive ? "Record service outcome" : "No action required", dueAt: chooseLater ? at(8, 29, 16) : currentActive ? at(8, 25, 22) : undefined, escalationTo: chooseLater || currentActive ? "Facilities director" : undefined, nte: !chooseLater ? { amountMinor: 125_000 + index * 5_000, currency: "USD" } : undefined, repairEstimate: store.storeNumber === "115" ? { amountMinor: 1_800_000, currency: "USD" } : undefined, estimatedServiceExtensionMonths: store.storeNumber === "115" ? 60 : undefined, vendorServiceTicketNumber: vendorId ? `SV-${26000 + index}` : undefined, createdAt: workTime, closedAt: !chooseLater && !currentActive ? at(7, 7 + index, 18) : undefined });
    const assignmentId = `assignment-northline-${store.storeNumber}`;
    assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: chooseLater ? "choose_later" : internal ? "internal" : "outside_vendor", vendorId, internalMembershipId: internal ? (index % 2 ? "membership-northline-tech-2" : "membership-northline-tech-1") : undefined, status: chooseLater ? "pending" : currentActive ? "accepted" : "completed", assignedAt: new Date(Date.parse(workTime) + 30 * 60_000).toISOString() });
    if (!chooseLater) {
      const issuanceId = `issuance-northline-${store.storeNumber}-r1`;
      const issuedAt = new Date(Date.parse(workTime) + 45 * 60_000).toISOString();
      const issuedWork = workOrders.at(-1)!;
      const issuedAsset = issuedWork.assetId ? assets.find((asset) => asset.id === issuedWork.assetId) : undefined;
      const assignedVendor = vendorId ? vendors.find((vendor) => vendor.id === vendorId) : undefined;
      const internalMember = internal ? memberships.find((membership) => membership.id === assignments.at(-1)!.internalMembershipId) : undefined;
      const internalUser = internalMember ? users.find((user) => user.id === internalMember.userId) : undefined;
      issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: issuedWork.number, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: assignedVendor ? { id: assignedVendor.id, name: assignedVendor.name } : { id: internalMember?.id ?? "internal-maintenance", name: internalUser?.displayName ?? "Clark Pump and Shop Maintenance" }, problem, priority: issuedWork.priority, authorizedScope: issuedWork.authorizedScope, categoryKey, asset: issuedAsset ? { id: issuedAsset.id, name: issuedAsset.name, assetTag: issuedAsset.assetTag } : undefined, requestedTiming: issuedWork.dueAt, nte: issuedWork.nte, billingInstruction: `Reference operator work order ${issuedWork.number} on all service paperwork and invoices.` }), channel: internal ? "manual" : "email", issuedAt });
      if (vendorId) vendorResponses.push({ id: `response-northline-${store.storeNumber}`, organizationId: organization.id, workOrderId, assignmentId, issuanceId, response: "accepted", responderName: "Vendor dispatch", respondedAt: new Date(Date.parse(issuedAt) + 25 * 60_000).toISOString(), proposedAt: currentActive ? at(8, 25, 17) : undefined });
    }
    if (!chooseLater) {
      const providerKind = internal ? "internal" as const : "outside_vendor" as const;
      const providerName = internal ? "Clark Pump and Shop Maintenance" : vendors.find((vendor) => vendor.id === vendorId)!.name;
      const start = currentActive ? at(8, 25, 17, 15) : at(7, 6 + index, 14);
      const end = currentActive ? undefined : at(7, 6 + index, 15, 20);
      const visitId = currentActive ? NORTHLINE_DEMO_HANDLES.activeVisitId : `visit-northline-${store.storeNumber}-1`;
      visits.push({ id: visitId, organizationId: organization.id, storeId: store.id, providerKind, vendorId, internalMembershipId: internal ? assignments.at(-1)!.internalMembershipId : undefined, workOrderId, technicianName: internal ? (index % 2 ? "Devon Price" : "Maria Santos") : ["Chris Walker", "Sam Patel", "Drew Miller"][index % 3], providerName, purpose: problem, status: currentActive ? "active" : "checked_out", startedChannel: currentActive ? "qr" : index % 2 ? "secure_link" : "qr", endedChannel: end ? (index % 2 ? "qr" : "store_device") : undefined, checkedInAt: start, checkedOutAt: end, outcome: end ? "resolved" : undefined, outcomeNotes: end ? "Work completed and operating condition confirmed before departure." : undefined, observedDurationSeconds: end ? durationSeconds(start, end) : undefined });
      visitEvidence.push({ id: `evidence-${visitId}-in`, organizationId: organization.id, visitId, kind: "check_in", channel: currentActive ? "qr" : index % 2 ? "secure_link" : "qr", observedAt: start, location: { result: index % 5 === 0 ? "permission_denied" : "verified", accuracyM: index % 5 === 0 ? undefined : 18 + index, distanceM: index % 5 === 0 ? undefined : 24 + index, capturedAt: start }, payloadJson: "{}" });
      if (end) visitEvidence.push({ id: `evidence-${visitId}-out`, organizationId: organization.id, visitId, kind: "check_out", channel: index % 2 ? "qr" : "store_device", observedAt: end, location: { result: index % 2 ? "verified" : "trusted_store_device", accuracyM: index % 2 ? 22 : undefined, distanceM: index % 2 ? 31 : undefined, capturedAt: end }, payloadJson: JSON.stringify({ outcome: "resolved" }) });
      if (!currentActive) {
        const labor = 18_500 + index * 750; const parts = 24_000 + index * 1_250;
        costLines.push({ id: `cost-${store.storeNumber}-labor`, organizationId: organization.id, workOrderId, kind: "labor", description: "Recorded service labor", amount: { amountMinor: labor, currency: "USD" }, serviceDate: end!.slice(0, 10), recordedAt: new Date(Date.parse(end!) + 30 * 60_000).toISOString() }, { id: `cost-${store.storeNumber}-parts`, organizationId: organization.id, workOrderId, kind: "parts", description: "Recorded repair materials", amount: { amountMinor: parts, currency: "USD" }, serviceDate: end!.slice(0, 10), recordedAt: new Date(Date.parse(end!) + 30 * 60_000).toISOString() });
        if (vendorId && index % 2 === 0) {
          const invoiceId = `invoice-northline-${store.storeNumber}`; const total = labor + parts;
          const matchStatus = index === 8 ? "unmatched" as const : index === 4 ? "suggested" as const : "confirmed" as const;
          invoiceReferences.push({ id: invoiceId, organizationId: organization.id, vendorId, invoiceNumber: `INV-${store.storeNumber}-26`, invoiceDate: end!.slice(0, 10), grossAmount: { amountMinor: total, currency: "USD" }, operatorWorkOrderNumber: matchStatus === "unmatched" ? undefined : `CPS-2026-${String(101 + index).padStart(4, "0")}`, matchStatus, createdAt: new Date(Date.parse(end!) + 86_400_000).toISOString() });
          if (matchStatus === "confirmed") invoiceAllocations.push({ id: `allocation-${store.storeNumber}`, organizationId: organization.id, invoiceReferenceId: invoiceId, workOrderId, amount: { amountMinor: total, currency: "USD" }, confirmedByMembershipId: "membership-northline-facilities", confirmedAt: new Date(Date.parse(end!) + 90_000_000).toISOString() });
        }
      }
    }
    auditEvents.push({ id: `audit-${workOrderId}-created`, organizationId: organization.id, aggregateType: "work_order", aggregateId: workOrderId, eventType: "work_order.created", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: workTime, payloadJson: JSON.stringify({ storeId: store.id, requestId }) });
  });

  // Four deterministic reactive records per store establish a real 20-month
  // trend without turning the presentation tenant into a wall of seed noise.
  // Every total shown by the product is still derived from these source facts.
  const historicalCostByCategory: Record<string, { labor: number; parts: number; partsKind: CostLine["kind"] }> = {
    refrigeration: { labor: 34_000, parts: 68_000, partsKind: "parts" },
    hvac: { labor: 38_000, parts: 52_000, partsKind: "parts" },
    forecourt: { labor: 32_000, parts: 29_000, partsKind: "parts" },
    plumbing: { labor: 24_000, parts: 18_000, partsKind: "materials" },
    electrical: { labor: 28_000, parts: 24_000, partsKind: "materials" },
    exterior: { labor: 21_000, parts: 15_000, partsKind: "materials" },
    foodservice: { labor: 31_000, parts: 37_000, partsKind: "parts" },
  };
  const taxonomyByCategory: Record<string, string> = {
    refrigeration: "taxonomy-northline-beer_caves",
    hvac: "taxonomy-northline-rooftop_units",
    forecourt: "taxonomy-northline-dispensers",
    plumbing: "taxonomy-northline-plumbing",
    electrical: "taxonomy-northline-electrical",
    exterior: "taxonomy-northline-exterior",
    foodservice: "taxonomy-northline-foodservice",
  };
  const historicalOutcomeByCategory: Record<string, string> = {
    refrigeration: "Repaired controls and verified a stable 36°F box temperature before departure.",
    hvac: "Restored cooling and verified supply-air temperature and thermostat operation.",
    forecourt: "Repaired dispenser communication and completed a successful test transaction.",
    plumbing: "Stopped the leak, tested the fixture, and left the area dry and operational.",
    electrical: "Restored the affected circuit and verified lighting operation at the panel.",
    exterior: "Completed the requested site repair and documented the finished condition.",
    foodservice: "Repaired the heating circuit and verified the programmed cook cycle.",
  };

  let historicalInvoiceIndex = 0;
  stores.forEach((store, storeIndex) => {
    for (let historyIndex = 0; historyIndex < 4; historyIndex += 1) {
      const monthOffset = (storeIndex * 4 + historyIndex) % 20;
      const visitStart = new Date(Date.UTC(2024, 11 + monthOffset, 5 + ((storeIndex + historyIndex * 3) % 20), 13 + (historyIndex % 3))).toISOString();
      const requestTime = new Date(Date.parse(visitStart) - 30 * 60 * 60_000).toISOString();
      const workTime = new Date(Date.parse(requestTime) + 45 * 60_000).toISOString();
      const assignedAt = new Date(Date.parse(workTime) + 30 * 60_000).toISOString();
      const issuedAt = new Date(Date.parse(assignedAt) + 15 * 60_000).toISOString();
      const durationMinutes = 48 + ((storeIndex * 17 + historyIndex * 23) % 112);
      const visitEnd = new Date(Date.parse(visitStart) + durationMinutes * 60_000).toISOString();
      const categoryKey = store.storeNumber === "104" && historyIndex === 3
        ? "refrigeration"
        : categoryCycle[(storeIndex + historyIndex) % categoryCycle.length];
      const vendorId = vendorByCategory[categoryKey];
      const internal = (storeIndex + historyIndex) % 9 === 0;
      const assignedVendor = vendors.find((vendor) => vendor.id === vendorId)!;
      const internalMembershipId = internal ? ((storeIndex + historyIndex) % 2 ? "membership-northline-tech-2" : "membership-northline-tech-1") : undefined;
      const internalMember = internalMembershipId ? memberships.find((membership) => membership.id === internalMembershipId) : undefined;
      const internalUser = internalMember ? users.find((user) => user.id === internalMember.userId) : undefined;
      const providerName = internal ? "Clark Pump and Shop Maintenance" : assignedVendor.name;
      const assetId = categoryKey === "refrigeration"
        ? `asset-${store.storeNumber}-beer-cave`
        : categoryKey === "hvac"
          ? `asset-${store.storeNumber}-rtu-1`
          : categoryKey === "forecourt"
            ? `asset-${store.storeNumber}-dispenser-4`
            : undefined;
      const componentId = store.storeNumber === "104" && categoryKey === "refrigeration" ? "component-104-compressor" : undefined;
      const asset = assetId ? assets.find((candidate) => candidate.id === assetId) : undefined;
      const idSuffix = `${store.storeNumber}-${historyIndex + 1}`;
      const requestId = `request-history-${idSuffix}`;
      const workOrderId = `wo-history-${idSuffix}`;
      const assignmentId = `assignment-history-${idSuffix}`;
      const issuanceId = `issuance-history-${idSuffix}-r1`;
      const visitId = `visit-history-${idSuffix}`;
      const workOrderNumber = `CPS-${visitStart.slice(0, 4)}-${String(20 + storeIndex * 4 + historyIndex).padStart(4, "0")}`;
      const problem = store.storeNumber === "104" && categoryKey === "refrigeration"
        ? "Beer cave compressor is short-cycling and tripping on high head pressure"
        : problemByCategory[categoryKey];
      const baseCost = historicalCostByCategory[categoryKey];
      const variance = 90 + ((storeIndex * 11 + historyIndex * 7) % 31);
      let labor = Math.round(baseCost.labor * variance / 100);
      let parts = Math.round(baseCost.parts * variance / 100);
      if (store.storeNumber === "104" && categoryKey === "refrigeration") {
        labor = 95_000;
        parts = 765_000;
      }
      const travel = internal ? 0 : (storeIndex + historyIndex) % 3 === 0 ? 12_500 : 0;
      const recordedTotal = labor + parts + travel;
      const nteAmountMinor = recordedTotal + 30_000;

      requests.push({ id: requestId, organizationId: organization.id, reference: `REQ-${visitStart.slice(2, 4)}-${idSuffix}`, storeId: store.id, reporterName: ["Avery Johnson", "Jamie Cole", "Riley Adams"][historyIndex % 3], reporterEmployeeId: `E${4000 + storeIndex * 4 + historyIndex}`, problem, priority: historyIndex === 0 && storeIndex % 5 === 0 ? "urgent" : "routine", status: "converted", submittedAt: requestTime, convertedWorkOrderId: workOrderId });
      workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: store.id, requestId, problem, authorizedScope: `Diagnose the reported ${categoryKey} issue, restore normal operation, and document the outcome and any additional recommended work.`, categoryKey, taxonomyNodeId: taxonomyByCategory[categoryKey], assetId, componentId, priority: historyIndex === 0 && storeIndex % 5 === 0 ? "urgent" : "routine", status: "closed", accountableParty: providerName, nextAction: "No action required", nte: { amountMinor: nteAmountMinor, currency: "USD" }, vendorServiceTicketNumber: internal ? undefined : `${assignedVendor.code.toUpperCase()}-${visitStart.slice(2, 4)}${String(5000 + storeIndex * 4 + historyIndex)}`, createdAt: workTime, closedAt: visitEnd });
      assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: internal ? "internal" : "outside_vendor", vendorId: internal ? undefined : vendorId, internalMembershipId, status: "completed", assignedAt });
      issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: internal ? { id: internalMembershipId ?? "internal-maintenance", name: internalUser?.displayName ?? "Clark Pump and Shop Maintenance" } : { id: assignedVendor.id, name: assignedVendor.name }, problem, priority: historyIndex === 0 && storeIndex % 5 === 0 ? "urgent" : "routine", authorizedScope: `Diagnose the reported ${categoryKey} issue, restore normal operation, and document the outcome and any additional recommended work.`, categoryKey, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, requestedTiming: visitStart, nte: { amountMinor: nteAmountMinor, currency: "USD" }, billingInstruction: `Reference operator work order ${workOrderNumber} on all service paperwork and invoices.` }), channel: internal ? "manual" : "email", issuedAt });
      if (!internal) vendorResponses.push({ id: `response-history-${idSuffix}`, organizationId: organization.id, workOrderId, assignmentId, issuanceId, response: "accepted", responderName: `${assignedVendor.name} dispatch`, respondedAt: new Date(Date.parse(issuedAt) + 20 * 60_000).toISOString(), proposedAt: visitStart });
      const visitOutcome: NonNullable<VisitSession["outcome"]> = store.storeNumber === "107" && historyIndex === 2 ? "unable_to_reproduce" : "resolved";
      const visitOutcomeNotes = visitOutcome === "unable_to_reproduce"
        ? "Tested the reported condition through three operating cycles; the fault did not recur and the store was asked to document the next event."
        : historicalOutcomeByCategory[categoryKey];
      visits.push({ id: visitId, organizationId: organization.id, storeId: store.id, providerKind: internal ? "internal" : "outside_vendor", vendorId: internal ? undefined : vendorId, internalMembershipId, workOrderId, technicianName: internal ? (internalUser?.displayName ?? "Clark Pump and Shop technician") : ["Chris Walker", "Sam Patel", "Drew Miller", "Dana Ruiz"][historyIndex], providerName, purpose: problem, status: "checked_out", startedChannel: internal ? "store_device" : historyIndex % 2 ? "secure_link" : "qr", endedChannel: internal ? "store_device" : historyIndex % 2 ? "qr" : "secure_link", checkedInAt: visitStart, checkedOutAt: visitEnd, outcome: visitOutcome, outcomeNotes: visitOutcomeNotes, observedDurationSeconds: durationSeconds(visitStart, visitEnd) });
      visitEvidence.push(
        { id: `evidence-${visitId}-in`, organizationId: organization.id, visitId, kind: "check_in", channel: internal ? "store_device" : historyIndex % 2 ? "secure_link" : "qr", observedAt: visitStart, location: internal ? { result: "trusted_store_device", capturedAt: visitStart } : { result: "verified", accuracyM: 14 + historyIndex * 3, distanceM: 18 + storeIndex, capturedAt: visitStart }, payloadJson: JSON.stringify({ workOrderNumber }) },
        { id: `evidence-${visitId}-out`, organizationId: organization.id, visitId, kind: "check_out", channel: internal ? "store_device" : historyIndex % 2 ? "qr" : "secure_link", observedAt: visitEnd, location: internal ? { result: "trusted_store_device", capturedAt: visitEnd } : { result: "verified", accuracyM: 17 + historyIndex * 3, distanceM: 21 + storeIndex, capturedAt: visitEnd }, payloadJson: JSON.stringify({ outcome: visitOutcome }) },
      );
      const recordedAt = new Date(Date.parse(visitEnd) + 45 * 60_000).toISOString();
      costLines.push(
        { id: `cost-history-${idSuffix}-labor`, organizationId: organization.id, workOrderId, kind: "labor", description: `${providerName} service labor`, amount: { amountMinor: labor, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt },
        { id: `cost-history-${idSuffix}-${baseCost.partsKind}`, organizationId: organization.id, workOrderId, kind: baseCost.partsKind, description: categoryKey === "exterior" ? "Site repair materials" : "Repair parts and materials", amount: { amountMinor: parts, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt },
      );
      if (travel) costLines.push({ id: `cost-history-${idSuffix}-travel`, organizationId: organization.id, workOrderId, kind: "travel", description: "Recorded service-call travel charge", amount: { amountMinor: travel, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt });

      if (!internal && (storeIndex + historyIndex) % 3 === 0) {
        const invoiceId = `invoice-history-${idSuffix}`;
        const matchRoll = historicalInvoiceIndex % 8;
        historicalInvoiceIndex += 1;
        const matchStatus: InvoiceReference["matchStatus"] = matchRoll === 0 ? "unmatched" : matchRoll === 1 ? "suggested" : matchRoll === 2 ? "rejected" : "confirmed";
        const invoiceTotal = matchStatus === "unmatched" ? recordedTotal + 50_000 : matchStatus === "rejected" ? recordedTotal + 15_000 : recordedTotal;
        invoiceReferences.push({ id: invoiceId, organizationId: organization.id, vendorId, invoiceNumber: `${assignedVendor.code.toUpperCase()}-${visitStart.slice(0, 7).replace("-", "")}-${store.storeNumber}-${historyIndex + 1}`, invoiceDate: visitEnd.slice(0, 10), grossAmount: { amountMinor: invoiceTotal, currency: "USD" }, operatorWorkOrderNumber: matchStatus === "unmatched" ? undefined : workOrderNumber, matchStatus, createdAt: new Date(Date.parse(visitEnd) + 2 * 86_400_000).toISOString() });
        if (matchStatus === "confirmed") invoiceAllocations.push({ id: `allocation-history-${idSuffix}`, organizationId: organization.id, invoiceReferenceId: invoiceId, workOrderId, amount: { amountMinor: invoiceTotal, currency: "USD" }, confirmedByMembershipId: "membership-northline-finance", confirmedAt: new Date(Date.parse(visitEnd) + 3 * 86_400_000).toISOString() });
        if (matchStatus === "unmatched") exceptions.push({ id: `exception-${invoiceId}-unmatched`, organizationId: organization.id, kind: "unmatched_invoice", storeId: store.id, vendorId, severity: "attention", status: "resolved", summary: `Invoice ${invoiceId} arrived without an operator work-order reference`, detectedAt: new Date(Date.parse(visitEnd) + 2 * 86_400_000).toISOString() });
      }
    }
  });

  // Recurring site services are a large, ordinary part of a convenience-store
  // facilities ledger. Keep unit prices realistic and create the missing event
  // volume instead of inflating a handful of repair invoices. These closed
  // records make the portfolio trend commercially believable while preserving
  // the deeper reactive stories above.
  const recurringServiceSeeds: ReadonlyArray<{
    key: string;
    year?: number;
    month: number;
    day: number;
    categoryKey: string;
    taxonomyNodeId: string;
    vendorId: string;
    problem: string;
    scope: string;
    amountMinor: number;
  }> = [
    { key: "grounds-apr", month: 4, day: 9, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-landscaping", vendorId: "vendor-northline-four-seasons", problem: "Scheduled spring grounds cleanup and landscape bed service", scope: "Complete scheduled grounds service and document site condition before departure.", amountMinor: 47_500 },
    { key: "grounds-may", month: 5, day: 8, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-landscaping", vendorId: "vendor-northline-four-seasons", problem: "Scheduled landscape and grounds service", scope: "Complete scheduled mowing, trimming, and grounds service.", amountMinor: 39_500 },
    { key: "grounds-jun", month: 6, day: 11, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-landscaping", vendorId: "vendor-northline-four-seasons", problem: "Scheduled landscape and grounds service", scope: "Complete scheduled mowing, trimming, and grounds service.", amountMinor: 39_500 },
    { key: "grounds-jul", month: 7, day: 9, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-landscaping", vendorId: "vendor-northline-four-seasons", problem: "Scheduled landscape and grounds service", scope: "Complete scheduled mowing, trimming, and grounds service.", amountMinor: 39_500 },
    { key: "grounds-aug", month: 8, day: 6, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-landscaping", vendorId: "vendor-northline-four-seasons", problem: "Scheduled landscape and grounds service", scope: "Complete scheduled mowing, trimming, and grounds service.", amountMinor: 39_500 },
    { key: "grounds-oct", year: 2025, month: 10, day: 16, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-landscaping", vendorId: "vendor-northline-four-seasons", problem: "Scheduled fall grounds cleanup", scope: "Complete fall cleanup, trim landscape areas, and remove accumulated debris.", amountMinor: 52_500 },
    { key: "snow-dec", year: 2025, month: 12, day: 14, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-snow_removal", vendorId: "vendor-northline-four-seasons", problem: "Snow and ice response after overnight accumulation", scope: "Clear vehicle and pedestrian areas and apply ice control according to the site service agreement.", amountMinor: 82_500 },
    { key: "snow-jan", month: 1, day: 19, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-snow_removal", vendorId: "vendor-northline-four-seasons", problem: "Snow and ice response after overnight accumulation", scope: "Clear vehicle and pedestrian areas and apply ice control according to the site service agreement.", amountMinor: 94_500 },
    { key: "snow-feb", month: 2, day: 7, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-snow_removal", vendorId: "vendor-northline-four-seasons", problem: "Snow and ice response after freezing precipitation", scope: "Treat vehicle and pedestrian areas and document completed ice control.", amountMinor: 71_500 },
    { key: "snow-mar", month: 3, day: 3, categoryKey: "exterior", taxonomyNodeId: "taxonomy-northline-snow_removal", vendorId: "vendor-northline-four-seasons", problem: "Late-season snow and ice response", scope: "Clear priority areas and apply ice control according to the site service agreement.", amountMinor: 68_500 },
    { key: "drain-jan", month: 1, day: 13, categoryKey: "plumbing", taxonomyNodeId: "taxonomy-northline-drains", vendorId: "vendor-northline-cedar", problem: "Scheduled drain and grease-line service", scope: "Complete scheduled drain service and report any condition requiring separate repair authorization.", amountMinor: 46_500 },
    { key: "drain-jul", month: 7, day: 14, categoryKey: "plumbing", taxonomyNodeId: "taxonomy-northline-drains", vendorId: "vendor-northline-cedar", problem: "Scheduled drain and grease-line service", scope: "Complete scheduled drain service and report any condition requiring separate repair authorization.", amountMinor: 46_500 },
    { key: "hvac-sep", year: 2025, month: 9, day: 18, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", vendorId: "vendor-northline-cedar", problem: "Quarterly rooftop-unit filter and operating inspection", scope: "Replace filters, inspect belts and drains, and record operating condition.", amountMinor: 64_500 },
    { key: "hvac-dec", year: 2025, month: 12, day: 8, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", vendorId: "vendor-northline-cedar", problem: "Quarterly rooftop-unit filter and heating inspection", scope: "Replace filters and verify safe heating operation before departure.", amountMinor: 69_500 },
    { key: "hvac-mar", month: 3, day: 17, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", vendorId: "vendor-northline-cedar", problem: "Quarterly rooftop-unit filter and cooling inspection", scope: "Replace filters, clear drains, and verify cooling readiness.", amountMinor: 72_500 },
    { key: "hvac-jun", month: 6, day: 16, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", vendorId: "vendor-northline-cedar", problem: "Quarterly rooftop-unit filter and operating inspection", scope: "Replace filters, inspect belts and drains, and record operating condition.", amountMinor: 67_500 },
    { key: "food-oct", year: 2025, month: 10, day: 21, categoryKey: "foodservice", taxonomyNodeId: "taxonomy-northline-ovens", vendorId: "vendor-northline-cedar", problem: "Scheduled hot-food equipment cleaning and safety inspection", scope: "Complete scheduled cleaning and inspection; report repair needs separately.", amountMinor: 57_500 },
    { key: "food-apr", month: 4, day: 21, categoryKey: "foodservice", taxonomyNodeId: "taxonomy-northline-ovens", vendorId: "vendor-northline-cedar", problem: "Scheduled hot-food equipment cleaning and safety inspection", scope: "Complete scheduled cleaning and inspection; report repair needs separately.", amountMinor: 57_500 },
  ];
  let recurringSequence = 2_000;
  stores.forEach((store, storeIndex) => {
    recurringServiceSeeds.forEach((service, serviceIndex) => {
      // Hot-food service belongs only at stores that actually carry the oven.
      // This keeps the register from fabricating identical recurring work at
      // every location merely to make the dashboard look busy.
      if (service.categoryKey === "foodservice" && !assets.some((asset) => asset.storeId === store.id && asset.categoryKey === "foodservice")) return;
      const year = service.year ?? 2026;
      const visitStart = new Date(Date.UTC(year, service.month - 1, Math.min(25, service.day + storeIndex % 4), 12 + serviceIndex % 4, 15)).toISOString();
      const createdAt = new Date(Date.parse(visitStart) - 3 * 86_400_000).toISOString();
      const assignedAt = new Date(Date.parse(createdAt) + 45 * 60_000).toISOString();
      const issuedAt = new Date(Date.parse(assignedAt) + 15 * 60_000).toISOString();
      const checkedOutAt = new Date(Date.parse(visitStart) + (55 + (storeIndex * 7 + serviceIndex * 11) % 70) * 60_000).toISOString();
      const suffix = `${store.storeNumber}-${service.key}`;
      const workOrderId = `wo-recurring-${suffix}`;
      const assignmentId = `assignment-recurring-${suffix}`;
      const issuanceId = `issuance-recurring-${suffix}`;
      const visitId = `visit-recurring-${suffix}`;
      const vendor = vendors.find((candidate) => candidate.id === service.vendorId)!;
      const amountMinor = service.amountMinor + (storeIndex % 5) * 2_500;
      const workOrderNumber = `CPS-${year}-${String(recurringSequence++).padStart(4, "0")}`;
      const assetId = service.categoryKey === "hvac" ? `asset-${store.storeNumber}-rtu-1` : undefined;
      const asset = assetId ? assets.find((candidate) => candidate.id === assetId) : undefined;
      workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: store.id, problem: service.problem, authorizedScope: service.scope, categoryKey: service.categoryKey, taxonomyNodeId: service.taxonomyNodeId, assetId, priority: "planned", status: "closed", accountableParty: vendor.name, nextAction: "No action required", dueAt: visitStart, nte: { amountMinor: amountMinor + 20_000, currency: "USD" }, vendorServiceTicketNumber: `${vendor.code.toUpperCase()}-${year}-${store.storeNumber}-${String(serviceIndex + 1).padStart(2, "0")}`, createdAt, closedAt: checkedOutAt });
      assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: "outside_vendor", vendorId: vendor.id, status: "completed", assignedAt });
      issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, channel: "email", issuedAt, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: { id: vendor.id, name: vendor.name }, problem: service.problem, priority: "planned", authorizedScope: service.scope, categoryKey: service.categoryKey, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, requestedTiming: visitStart, nte: { amountMinor: amountMinor + 20_000, currency: "USD" }, billingInstruction: `Reference operator work order ${workOrderNumber} on all service paperwork and invoices.` }) });
      vendorResponses.push({ id: `response-recurring-${suffix}`, organizationId: organization.id, workOrderId, assignmentId, issuanceId, response: "accepted", responderName: `${vendor.name} dispatch`, respondedAt: new Date(Date.parse(issuedAt) + 25 * 60_000).toISOString(), proposedAt: visitStart });
      visits.push({ id: visitId, organizationId: organization.id, storeId: store.id, providerKind: "outside_vendor", vendorId: vendor.id, workOrderId, technicianName: ["Chris Walker", "Dana Ruiz", "Sam Patel", "Drew Miller"][(storeIndex + serviceIndex) % 4]!, providerName: vendor.name, purpose: service.problem, crewCount: service.categoryKey === "exterior" ? 2 : 1, status: "checked_out", startedChannel: serviceIndex % 2 ? "secure_link" : "qr", endedChannel: serviceIndex % 3 ? "qr" : "store_device", checkedInAt: visitStart, checkedOutAt, outcome: "resolved", outcomeNotes: "Scheduled service completed and site condition documented before departure.", observedDurationSeconds: durationSeconds(visitStart, checkedOutAt) });
      visitEvidence.push(
        { id: `evidence-${visitId}-in`, organizationId: organization.id, visitId, kind: "check_in", channel: serviceIndex % 2 ? "secure_link" : "qr", observedAt: visitStart, location: { result: "verified", accuracyM: 15 + serviceIndex % 9, distanceM: 12 + storeIndex, capturedAt: visitStart }, payloadJson: JSON.stringify({ workOrderNumber, recurringService: service.key }) },
        { id: `evidence-${visitId}-out`, organizationId: organization.id, visitId, kind: "check_out", channel: serviceIndex % 3 ? "qr" : "store_device", observedAt: checkedOutAt, location: { result: serviceIndex % 3 ? "verified" : "trusted_store_device", accuracyM: serviceIndex % 3 ? 18 + serviceIndex % 8 : undefined, distanceM: serviceIndex % 3 ? 14 + storeIndex : undefined, capturedAt: checkedOutAt }, payloadJson: JSON.stringify({ outcome: "resolved", recurringService: service.key }) },
      );
      costLines.push({ id: `cost-recurring-${suffix}`, organizationId: organization.id, workOrderId, kind: service.categoryKey === "hvac" || service.categoryKey === "plumbing" ? "labor" : "other", description: `${service.problem} — recorded service charge`, amount: { amountMinor, currency: "USD" }, serviceDate: checkedOutAt.slice(0, 10), recordedAt: new Date(Date.parse(checkedOutAt) + 60 * 60_000).toISOString() });
      if ((storeIndex + serviceIndex) % 4 === 0) {
        const invoiceId = `invoice-recurring-${suffix}`;
        invoiceReferences.push({ id: invoiceId, organizationId: organization.id, vendorId: vendor.id, invoiceNumber: `${vendor.code.toUpperCase()}-${year}${String(service.month).padStart(2, "0")}-${store.storeNumber}`, invoiceDate: checkedOutAt.slice(0, 10), grossAmount: { amountMinor, currency: "USD" }, operatorWorkOrderNumber: workOrderNumber, matchStatus: "confirmed", createdAt: new Date(Date.parse(checkedOutAt) + 2 * 86_400_000).toISOString() });
        invoiceAllocations.push({ id: `allocation-${invoiceId}`, organizationId: organization.id, invoiceReferenceId: invoiceId, workOrderId, amount: { amountMinor, currency: "USD" }, confirmedByMembershipId: "membership-northline-finance", confirmedAt: new Date(Date.parse(checkedOutAt) + 3 * 86_400_000).toISOString() });
      }
    });
  });

  // A separate, current Store 104 authorization powers the account-free
  // accept/decline/propose/question flow without rewriting the closed
  // compressor history used for lifecycle drill-down.
  const publicRequestId = "request-northline-104-new";
  const publicWorkOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
  const publicAssignmentId = "assignment-northline-104-issued";
  const publicIssuanceId = "issuance-northline-104-issued-r1";
  const publicProblem = "Evaporator fan in the beer cave is cycling intermittently and making a grinding noise";
  requests.push({ id: publicRequestId, organizationId: organization.id, reference: "REQ-26-104B", storeId: "store-northline-104", reporterName: "Avery Johnson", reporterEmployeeId: "E3103", problem: publicProblem, priority: "urgent", status: "converted", submittedAt: at(8, 25, 14), convertedWorkOrderId: publicWorkOrderId });
  workOrders.push({ id: publicWorkOrderId, organizationId: organization.id, number: "CPS-2026-0116", storeId: "store-northline-104", requestId: publicRequestId, problem: publicProblem, authorizedScope: "Inspect the evaporator fan assembly, diagnose the noise, and restore normal operation. Document any additional recommended work separately.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: "asset-104-beer-cave", componentId: "component-104-evaporator-fan", priority: "urgent", status: "issued", accountableParty: "ColdLine Refrigeration & HVAC", nextAction: "Respond to service authorization", dueAt: at(8, 25, 23), escalationTo: "Clark Pump and Shop Facilities", nte: { amountMinor: 175_000, currency: "USD" }, repairEstimate: { amountMinor: 125_000, currency: "USD" }, estimatedServiceExtensionMonths: 12, createdAt: at(8, 25, 14, 10) });
  assignments.push({ id: publicAssignmentId, organizationId: organization.id, workOrderId: publicWorkOrderId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "issued", assignedAt: at(8, 25, 14, 20) });
  issuances.push({ id: publicIssuanceId, organizationId: organization.id, workOrderId: publicWorkOrderId, assignmentId: publicAssignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: "CPS-2026-0116", store: { id: "store-northline-104", storeNumber: "104", name: "Clark Pump and Shop - Ridgeview", formattedAddress: "104 Ridgeview Drive, Ridgeview, MI 49031" }, vendor: { id: "vendor-northline-summit", name: "ColdLine Refrigeration & HVAC" }, problem: publicProblem, priority: "urgent", authorizedScope: "Inspect the evaporator fan assembly, diagnose the noise, and restore normal operation. Document any additional recommended work separately.", categoryKey: "refrigeration", asset: { id: "asset-104-beer-cave", name: "Beer cave - rear sales floor", assetTag: "104-REF-01" }, requestedTiming: at(8, 25, 23), nte: { amountMinor: 175_000, currency: "USD" }, billingInstruction: "Reference operator work order CPS-2026-0116 on all service tickets and invoices." }), channel: "email", issuedAt: at(8, 25, 14, 30) });
  auditEvents.push({ id: "audit-wo-northline-104-issued", organizationId: organization.id, aggregateType: "work_order", aggregateId: publicWorkOrderId, eventType: "work_order.issued", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: at(8, 25, 14, 30), payloadJson: JSON.stringify({ assignmentId: publicAssignmentId, issuanceId: publicIssuanceId }) });

  // One canonical Store 105 HVAC repair decision can collect comparable pricing
  // from multiple vendors without fabricating duplicate work orders or costs.
  const priceCheckRequestId = "request-northline-105-price-check";
  const priceCheckWorkOrderId = "wo-northline-105-price-check";
  const priceCheckAssignmentId = "assignment-northline-105-price-check";
  const estimateScope = "Replace the failing rooftop-unit condenser fan motor and capacitor, verify rotation and amperage, and confirm the sales floor reaches setpoint. Include labor, materials, travel, and earliest available service date.";
  const priceCheckProblem = "Sales-floor rooftop unit is cooling intermittently and the condenser fan motor is overheating";
  requests.push({ id: priceCheckRequestId, organizationId: organization.id, reference: "REQ-26-105C", storeId: "store-northline-105", reporterName: "Jamie Collins", reporterEmployeeId: "E4105", problem: priceCheckProblem, priority: "routine", status: "converted", submittedAt: at(8, 25, 14, 40), convertedWorkOrderId: priceCheckWorkOrderId });
  workOrders.push({ id: priceCheckWorkOrderId, organizationId: organization.id, number: "CPS-2026-0117", storeId: "store-northline-105", requestId: priceCheckRequestId, problem: priceCheckProblem, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", assetId: "asset-105-rtu-1", priority: "routine", status: "awaiting_approval", accountableParty: "Facilities coordinator", nextAction: "Compare vendor bids and choose the service provider", dueAt: at(8, 26, 16), escalationTo: "Facilities director", createdAt: at(8, 25, 14, 45) });
  assignments.push({ id: priceCheckAssignmentId, organizationId: organization.id, workOrderId: priceCheckWorkOrderId, kind: "choose_later", status: "pending", assignedAt: at(8, 25, 14, 46) });
  estimateRequests.push(
    { id: "estimate-request-105-summit", organizationId: organization.id, workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-summit", kind: "estimate_only", requestedScope: estimateScope, status: "submitted", channel: "email", requestedAt: at(8, 25, 14, 50), dueAt: at(8, 26, 16), openedAt: at(8, 25, 15, 2), respondedAt: at(8, 25, 15, 31) },
    { id: "estimate-request-105-cedar", organizationId: organization.id, workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-cedar", kind: "estimate_only", requestedScope: estimateScope, status: "submitted", channel: "email", requestedAt: at(8, 25, 14, 51), dueAt: at(8, 26, 16), openedAt: at(8, 25, 15, 11), respondedAt: at(8, 25, 16, 4) },
  );
  estimateProposals.push(
    { id: "estimate-proposal-105-summit-r1", organizationId: organization.id, requestId: "estimate-request-105-summit", workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-summit", revision: 1, amount: { amountMinor: 245_000, currency: "USD" }, scope: "Replace the rooftop-unit condenser fan motor and matched capacitor; verify amperage, refrigerant pressures, and supply-air temperature.", exclusions: "Controls, refrigerant leak repair, and after-hours work are excluded.", leadTimeDays: 2, validUntil: at(9, 24, 15, 31), submittedAt: at(8, 25, 15, 31) },
    { id: "estimate-proposal-105-cedar-r1", organizationId: organization.id, requestId: "estimate-request-105-cedar", workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-cedar", revision: 1, amount: { amountMinor: 178_000, currency: "USD" }, scope: "Replace the condenser fan motor and capacitor, commission the rooftop unit, and document final amperage and temperature split.", exclusions: "Refrigerant-system repairs and additional failed components require approval.", leadTimeDays: 3, validUntil: at(9, 24, 16, 4), submittedAt: at(8, 25, 16, 4) },
  );
  estimateRequests.forEach((estimateRequest) => auditEvents.push({ id: `audit-${estimateRequest.id}-requested`, organizationId: organization.id, aggregateType: "work_order_estimate_request", aggregateId: estimateRequest.id, eventType: "work_order_estimate.requested", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: estimateRequest.requestedAt, payloadJson: JSON.stringify({ workOrderId: priceCheckWorkOrderId, vendorId: estimateRequest.vendorId, kind: estimateRequest.kind, channel: estimateRequest.channel }) }));
  estimateProposals.forEach((proposal) => auditEvents.push({ id: `audit-${proposal.id}-submitted`, organizationId: organization.id, aggregateType: "vendor_estimate_proposal", aggregateId: proposal.id, eventType: "vendor_estimate.submitted", actorType: "vendor_link", actorName: vendors.find((vendor) => vendor.id === proposal.vendorId)!.name, occurredAt: proposal.submittedAt, payloadJson: JSON.stringify({ requestId: proposal.requestId, workOrderId: proposal.workOrderId, vendorId: proposal.vendorId, revision: proposal.revision, amountMinor: proposal.amount.amountMinor, currency: proposal.amount.currency }) }));

  // Store 115 demonstrates the capital path: two replacement quotes stay on
  // one canonical work order, the selected quote publishes a dated functional
  // benchmark, and no technician assignment or billable visit is created.
  const replacementWork = workOrders.find((row) => row.id === "wo-northline-115")!;
  replacementWork.status = "approved";
  replacementWork.accountableParty = "Facilities coordinator";
  replacementWork.nextAction = "Schedule the approved beer-cave replacement and record final installed cost";
  replacementWork.dueAt = at(8, 29, 16);
  replacementWork.escalationTo = "Facilities director";
  const replacementScope = "Replace the medium beer-cave condensing system with a functionally equivalent R448A system. Include equipment, rigging, line-set connections, electrical reconnection, startup, commissioning, permits, freight, and disposal.";
  estimateRequests.push(
    { id: "estimate-request-115-summit", organizationId: organization.id, workOrderId: replacementWork.id, vendorId: "vendor-northline-summit", kind: "estimate_only", decisionKind: "replacement_quote", requestedScope: replacementScope, status: "selected", channel: "email", requestedAt: at(8, 7, 14), dueAt: at(8, 10, 16), openedAt: at(8, 7, 14, 22), respondedAt: at(8, 8, 16, 20), decisionAt: at(8, 9, 14) },
    { id: "estimate-request-115-cedar", organizationId: organization.id, workOrderId: replacementWork.id, vendorId: "vendor-northline-cedar", kind: "estimate_only", decisionKind: "replacement_quote", requestedScope: replacementScope, status: "not_selected", channel: "email", requestedAt: at(8, 7, 14, 2), dueAt: at(8, 10, 16), openedAt: at(8, 7, 14, 40), respondedAt: at(8, 8, 17, 5), decisionAt: at(8, 9, 14) },
  );
  estimateProposals.push(
    { id: "estimate-proposal-115-summit-r1", organizationId: organization.id, requestId: "estimate-request-115-summit", workOrderId: replacementWork.id, vendorId: "vendor-northline-summit", revision: 1, amount: { amountMinor: 3_280_000, currency: "USD" }, scope: replacementScope, exclusions: "Structural roof work and after-hours premium labor are excluded unless separately approved.", leadTimeDays: 35, validUntil: at(9, 15, 16, 20), submittedAt: at(8, 8, 16, 20) },
    { id: "estimate-proposal-115-cedar-r1", organizationId: organization.id, requestId: "estimate-request-115-cedar", workOrderId: replacementWork.id, vendorId: "vendor-northline-cedar", revision: 1, amount: { amountMinor: 3_545_000, currency: "USD" }, scope: replacementScope, exclusions: "Roof reinforcement, hazardous-material remediation, and temporary refrigeration are excluded.", leadTimeDays: 28, validUntil: at(9, 15, 17, 5), submittedAt: at(8, 8, 17, 5) },
  );
  replacementBenchmarks[0].status = "superseded";
  replacementBenchmarks[0].supersededAt = at(8, 9, 14);
  replacementBenchmarks.push({ id: "replacement-benchmark-beer-cave-2026-quote", organizationId: organization.id, profileId: "replacement-profile-beer-cave-medium", sourceType: "approved_quote", sourceWorkOrderId: replacementWork.id, sourceEstimateProposalId: "estimate-proposal-115-summit-r1", sourceAssetId: "asset-115-beer-cave", sourceVendorId: "vendor-northline-summit", equipmentAmount: { amountMinor: 2_310_000, currency: "USD" }, installationAmount: { amountMinor: 820_000, currency: "USD" }, otherAmount: { amountMinor: 150_000, currency: "USD" }, totalAmount: { amountMinor: 3_280_000, currency: "USD" }, effectiveAt: at(8, 8, 16, 20), status: "published", notes: "Selected replacement quote with equipment, installation, permits, freight, and disposal separated.", createdAt: at(8, 9, 14) });
  replacementEvents.push({ id: "replacement-event-115-approved", organizationId: organization.id, assetId: "asset-115-beer-cave", workOrderId: replacementWork.id, profileId: "replacement-profile-beer-cave-medium", sourceEstimateProposalId: "estimate-proposal-115-summit-r1", status: "approved", approvedAmount: { amountMinor: 3_280_000, currency: "USD" }, approvedAt: at(8, 9, 14), createdAt: at(8, 9, 14) });
  lifecycleRecommendations.push({ id: "lifecycle-recommendation-115-v1", organizationId: organization.id, assetId: "asset-115-beer-cave", workOrderId: replacementWork.id, version: 1, modelVersion: "transparent-rules-v1", recommendation: "replace", confidence: "medium", inputsJson: JSON.stringify({ asOf: at(8, 9, 14), assetAgeYears: 7.3, expectedLifeYears: 12, trailingRepairSpendMinor: 842000, replacementEstimateMinor: 3280000, failureCount36Months: 4, warrantyActive: false, downtimeMinutes: null }), explanation: "Repeated reactive work and the current major repair made this equipment worth a capital review. Management selected replacement after comparing vendor quotes; the platform did not make the decision automatically.", missingData: ["Verified downtime history", "Peer model failure cohort"], userDecision: "replace", userReason: "Approved the selected ColdLine quote after facilities review; the repeated failures and current repair scope make further major repair unattractive.", plannedForYear: 2027, decidedByMembershipId: "membership-northline-facilities", decidedAt: at(8, 9, 14), replacementEventId: "replacement-event-115-approved", createdAt: at(8, 9, 14) });
  lifecycleRecommendations.push(
    { id: "lifecycle-recommendation-105-beer-cave-v1", organizationId: organization.id, assetId: "asset-105-beer-cave", version: 1, modelVersion: "transparent-rules-v1", recommendation: "capital_review", confidence: "medium", inputsJson: JSON.stringify({ asOf: NORTHLINE_AS_OF, assetAgeYears: 9.4, expectedLifeYears: 12, replacementEstimateMinor: 3_285_278, warrantyActive: false }), explanation: "The asset is inside the final quarter of its reference life. Management recorded a funding year so the expected replacement is visible without creating a service task.", missingData: ["Installed replacement quote"], userDecision: "replace", userReason: "Include in the 2028 refrigeration capital plan; service can continue until a current quote and scope are approved.", plannedForYear: 2028, decidedByMembershipId: "membership-northline-facilities", decidedAt: at(8, 6, 10), createdAt: at(8, 6, 10) },
    { id: "lifecycle-recommendation-110-beer-cave-v1", organizationId: organization.id, assetId: "asset-110-beer-cave", version: 1, modelVersion: "transparent-rules-v1", recommendation: "capital_review", confidence: "medium", inputsJson: JSON.stringify({ asOf: NORTHLINE_AS_OF, assetAgeYears: 9.4, expectedLifeYears: 12, replacementEstimateMinor: 3_285_278, warrantyActive: false }), explanation: "Management placed this older beer-cave system into a later funding year after reviewing age, recorded repairs, and the current company benchmark.", missingData: ["Installed replacement quote"], userDecision: "replace", userReason: "Plan for 2029 and continue normal maintenance unless a future repair creates an earlier decision.", plannedForYear: 2029, decidedByMembershipId: "membership-northline-facilities", decidedAt: at(8, 6, 10, 5), createdAt: at(8, 6, 10, 5) },
    { id: "lifecycle-recommendation-101-freezer-v1", organizationId: organization.id, assetId: "asset-101-walk-in-freezer", version: 1, modelVersion: "transparent-rules-v1", recommendation: "capital_review", confidence: "medium", inputsJson: JSON.stringify({ asOf: NORTHLINE_AS_OF, assetAgeYears: 8.5, expectedLifeYears: 12, replacementEstimateMinor: 3_150_000, warrantyActive: false }), explanation: "The freezer remains operational, but management assigned a funding year using age, expected life, and the current installed-cost estimate.", missingData: ["Current vendor quote"], userDecision: "replace", userReason: "Carry in the 2029 capital outlook and refresh the estimate before authorization.", plannedForYear: 2029, decidedByMembershipId: "membership-northline-facilities", decidedAt: at(8, 6, 10, 10), createdAt: at(8, 6, 10, 10) },
    { id: "lifecycle-recommendation-103-freezer-v1", organizationId: organization.id, assetId: "asset-103-walk-in-freezer", version: 1, modelVersion: "transparent-rules-v1", recommendation: "capital_review", confidence: "medium", inputsJson: JSON.stringify({ asOf: NORTHLINE_AS_OF, assetAgeYears: 6.5, expectedLifeYears: 12, replacementEstimateMinor: 3_200_000, warrantyActive: false }), explanation: "The equipment is being watched, but no immediate replacement is directed. Management reserved a future year so repeated repair evidence can be evaluated against a known capital option.", missingData: ["Current vendor quote"], userDecision: "replace", userReason: "Hold a 2030 planning slot; revisit only if service history or a material repair changes the timing.", plannedForYear: 2030, decidedByMembershipId: "membership-northline-facilities", decidedAt: at(8, 6, 10, 15), createdAt: at(8, 6, 10, 15) },
    { id: "lifecycle-recommendation-114-freezer-v1", organizationId: organization.id, assetId: "asset-114-walk-in-freezer", version: 1, modelVersion: "transparent-rules-v1", recommendation: "capital_review", confidence: "medium", inputsJson: JSON.stringify({ asOf: NORTHLINE_AS_OF, assetAgeYears: 7.5, expectedLifeYears: 12, replacementEstimateMinor: 3_475_000, warrantyActive: false }), explanation: "Management recorded a replacement year from expected life and the existing installed-cost estimate. The record is a forecast, not an authorization.", missingData: ["Current vendor quote"], userDecision: "replace", userReason: "Carry in 2030 for portfolio funding visibility; obtain a current quote before any approval.", plannedForYear: 2030, decidedByMembershipId: "membership-northline-facilities", decidedAt: at(8, 6, 10, 20), createdAt: at(8, 6, 10, 20) },
    { id: "lifecycle-recommendation-112-rtu-v1", organizationId: organization.id, assetId: "asset-112-rtu-1", version: 1, modelVersion: "transparent-rules-v1", recommendation: "capital_review", confidence: "medium", inputsJson: JSON.stringify({ asOf: NORTHLINE_AS_OF, assetAgeYears: 8.2, expectedLifeYears: 15, replacementEstimateMinor: 2_207_880, warrantyActive: false }), explanation: "The watched rooftop unit has a documented future replacement year so HVAC capital needs can be viewed beside refrigeration without creating a current replacement task.", missingData: ["Current vendor quote"], userDecision: "replace", userReason: "Place in the 2031 HVAC plan and keep the timing subject to future service evidence.", plannedForYear: 2031, decidedByMembershipId: "membership-northline-facilities", decidedAt: at(8, 6, 10, 25), createdAt: at(8, 6, 10, 25) },
  );
  auditEvents.push({ id: "audit-replacement-event-115-approved", organizationId: organization.id, aggregateType: "asset", aggregateId: "asset-115-beer-cave", eventType: "asset.replacement_approved", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: at(8, 9, 14), payloadJson: JSON.stringify({ replacementEventId: "replacement-event-115-approved", profileId: "replacement-profile-beer-cave-medium", sourceEstimateProposalId: "estimate-proposal-115-summit-r1", benchmarkId: "replacement-benchmark-beer-cave-2026-quote" }) });

  // Store 104 has a second visit to make the linked repeat-work story real at
  // the exact compressor level rather than relying on a generic repeat flag.
  const first104 = visits.find((visit) => visit.id === "visit-northline-104-1")!;
  first104.outcome = "diagnosed_waiting_parts";
  first104.outcomeNotes = "Compressor is drawing high amperage; replacement required. Unit left in temporary operation.";
  const evidence104 = visitEvidence.find((event) => event.id === "evidence-visit-northline-104-1-out")!;
  evidence104.payloadJson = JSON.stringify({ outcome: "diagnosed_waiting_parts" });
  const followUp104: FollowUp = { id: "follow-up-northline-104-parts", organizationId: organization.id, workOrderId: "wo-northline-104", sourceVisitId: first104.id, accountableParty: "ColdLine Refrigeration & HVAC", nextAction: "Return with compressor and complete replacement", dueAt: at(7, 10, 20), escalationTo: "Clark Pump and Shop Facilities", status: "completed", createdAt: first104.checkedOutAt!, completedAt: at(7, 10, 17, 10) };
  followUps.push(followUp104);
  const visit104Start = at(7, 10, 14); const visit104End = at(7, 10, 17);
  visits.push({ id: "visit-northline-104-2", organizationId: organization.id, storeId: "store-northline-104", providerKind: "outside_vendor", vendorId: "vendor-northline-summit", workOrderId: "wo-northline-104", technicianName: "Chris Walker", providerName: "ColdLine Refrigeration & HVAC", purpose: "Return with approved compressor and complete replacement", status: "checked_out", startedChannel: "secure_link", endedChannel: "qr", checkedInAt: visit104Start, checkedOutAt: visit104End, outcome: "resolved", outcomeNotes: "Compressor replaced, system evacuated and charged, beer cave pulled down to 36°F.", observedDurationSeconds: durationSeconds(visit104Start, visit104End) });
  visitEvidence.push({ id: "evidence-visit-northline-104-2-in", organizationId: organization.id, visitId: "visit-northline-104-2", kind: "check_in", channel: "secure_link", observedAt: visit104Start, location: { result: "verified", accuracyM: 16, distanceM: 21, capturedAt: visit104Start }, payloadJson: "{}" }, { id: "evidence-visit-northline-104-2-out", organizationId: organization.id, visitId: "visit-northline-104-2", kind: "check_out", channel: "qr", observedAt: visit104End, location: { result: "verified", accuracyM: 19, distanceM: 25, capturedAt: visit104End }, payloadJson: JSON.stringify({ outcome: "resolved" }) });

  costLines.push(
    { id: "cost-104-compressor-labor", organizationId: organization.id, workOrderId: "wo-northline-104", kind: "labor", description: "Compressor replacement labor, evacuation, and commissioning", amount: { amountMinor: 165_000, currency: "USD" }, serviceDate: visit104End.slice(0, 10), recordedAt: new Date(Date.parse(visit104End) + 30 * 60_000).toISOString() },
    { id: "cost-104-compressor-parts", organizationId: organization.id, workOrderId: "wo-northline-104", kind: "parts", description: "Replacement compressor, filter drier, refrigerant, and electrical kit", amount: { amountMinor: 725_000, currency: "USD" }, serviceDate: visit104End.slice(0, 10), recordedAt: new Date(Date.parse(visit104End) + 30 * 60_000).toISOString() },
  );
  files.push(
    { id: "file-104-compressor-before", organizationId: organization.id, storageKey: "northline-demo/visits/visit-northline-104-2/compressor-before.jpg", sha256: "a".repeat(64), originalName: "compressor-before.jpg", contentType: "image/jpeg", byteLength: 1_284_112, status: "available", createdAt: visit104Start },
    { id: "file-104-compressor-after", organizationId: organization.id, storageKey: "northline-demo/visits/visit-northline-104-2/compressor-after.jpg", sha256: "b".repeat(64), originalName: "compressor-after.jpg", contentType: "image/jpeg", byteLength: 1_117_804, status: "available", createdAt: visit104End },
    { id: "file-104-service-report", organizationId: organization.id, storageKey: "northline-demo/work-orders/wo-northline-104/coldline-service-report.pdf", sha256: "c".repeat(64), originalName: "ColdLine-service-report-SV-26003.pdf", contentType: "application/pdf", byteLength: 284_612, status: "available", createdAt: new Date(Date.parse(visit104End) + 20 * 60_000).toISOString() },
    { id: "file-104-warranty", organizationId: organization.id, storageKey: "northline-demo/assets/asset-104-beer-cave/compressor-warranty.pdf", sha256: "d".repeat(64), originalName: "compressor-warranty-registration.pdf", contentType: "application/pdf", byteLength: 196_430, status: "available", createdAt: new Date(Date.parse(visit104End) + 86_400_000).toISOString() },
    { id: "file-109-unmatched-invoice", organizationId: organization.id, storageKey: "northline-demo/invoices/invoice-northline-109/vendor-invoice.pdf", sha256: "e".repeat(64), originalName: "FSG-INV-109-26.pdf", contentType: "application/pdf", byteLength: 172_220, status: "available", createdAt: at(7, 16, 18) },
  );
  entityFiles.push(
    { id: "entity-file-104-before", organizationId: organization.id, fileId: "file-104-compressor-before", entityType: "visit", entityId: "visit-northline-104-2", purpose: "photo", visibility: "vendor_shared", createdAt: visit104Start },
    { id: "entity-file-104-after", organizationId: organization.id, fileId: "file-104-compressor-after", entityType: "visit", entityId: "visit-northline-104-2", purpose: "photo", visibility: "vendor_shared", createdAt: visit104End },
    { id: "entity-file-104-report", organizationId: organization.id, fileId: "file-104-service-report", entityType: "work_order", entityId: "wo-northline-104", purpose: "service_document", visibility: "vendor_shared", createdAt: new Date(Date.parse(visit104End) + 20 * 60_000).toISOString() },
    { id: "entity-file-104-warranty", organizationId: organization.id, fileId: "file-104-warranty", entityType: "asset", entityId: "asset-104-beer-cave", purpose: "warranty", visibility: "internal", createdAt: new Date(Date.parse(visit104End) + 86_400_000).toISOString() },
    { id: "entity-file-109-invoice", organizationId: organization.id, fileId: "file-109-unmatched-invoice", entityType: "invoice_reference", entityId: "invoice-northline-109", purpose: "invoice", visibility: "internal", createdAt: at(7, 16, 18) },
  );

  // A no-WO forecourt visit is allowed to proceed, but remains conspicuous and
  // reviewable because the visit was not tied to an operator work order.
  const noWoStart = at(8, 25, 16, 20);
  visits.push({ id: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, organizationId: organization.id, storeId: "store-northline-107", providerKind: "outside_vendor", vendorId: "vendor-northline-forecourt", unmatchedReason: "Vendor dispatch did not provide an operator work-order number", technicianName: "Dana Ruiz", providerName: "PumpPro Fuel & Dispenser Repair", purpose: "Inspect intermittent card-reader failure at dispenser 4", status: "active", startedChannel: "qr", checkedInAt: noWoStart });
  visitEvidence.push({ id: "evidence-visit-northline-107-no-wo-in", organizationId: organization.id, visitId: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, kind: "check_in", channel: "qr", observedAt: noWoStart, location: { result: "outside_geofence", accuracyM: 20, distanceM: 171, capturedAt: noWoStart }, payloadJson: "{}" });
  exceptions.push({ id: "exception-northline-107-no-wo", organizationId: organization.id, kind: "no_work_order", storeId: "store-northline-107", visitId: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, vendorId: "vendor-northline-forecourt", severity: "urgent", status: "open", summary: "Unscheduled forecourt technician visit has no operator work order", detectedAt: noWoStart }, { id: "exception-northline-107-location", organizationId: organization.id, kind: "outside_geofence", storeId: "store-northline-107", visitId: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, vendorId: "vendor-northline-forecourt", severity: "attention", status: "open", summary: "Forecourt visit check-in was 171 m from the store geofence center", detectedAt: noWoStart });

  // A past unclosed visit is an exception; no checkout time is invented.
  const staleStart = at(8, 25, 10, 40);
  const reopened109 = workOrders.find((row) => row.organizationId === organization.id && row.id === "wo-northline-109")!;
  reopened109.status = "in_progress";
  reopened109.accountableParty = "PumpPro Fuel & Dispenser Repair";
  reopened109.nextAction = "Record return-visit outcome";
  reopened109.dueAt = at(8, 25, 17, 30);
  reopened109.escalationTo = "Clark Pump and Shop Facilities";
  reopened109.closedAt = undefined;
  const return109AssignmentId = "assignment-northline-109-return";
  const return109IssuanceId = "issuance-northline-109-return-r2";
  assignments.push({ id: return109AssignmentId, organizationId: organization.id, workOrderId: reopened109.id, kind: "outside_vendor", vendorId: "vendor-northline-forecourt", status: "accepted", assignedAt: at(8, 25, 9, 30), supersedesAssignmentId: "assignment-northline-109" });
  issuances.push({ id: return109IssuanceId, organizationId: organization.id, workOrderId: reopened109.id, assignmentId: return109AssignmentId, revision: 2, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: reopened109.number, store: { id: "store-northline-109", storeNumber: "109", name: "Clark Pump and Shop - Lakeview", formattedAddress: "9 Lakeview Lane, Lakeview, IN 46738" }, vendor: { id: "vendor-northline-forecourt", name: "PumpPro Fuel & Dispenser Repair" }, problem: reopened109.problem, priority: reopened109.priority, authorizedScope: "Recheck dispenser 4 communication and record the return-visit outcome.", categoryKey: "forecourt", asset: { id: "asset-109-dispenser-4", name: "Dispenser 4 - Southeast island", assetTag: "109-FUEL-04" }, requestedTiming: staleStart, nte: reopened109.nte, billingInstruction: `Reference operator work order ${reopened109.number} on all service paperwork and invoices.` }), channel: "email", issuedAt: at(8, 25, 9, 45) });
  vendorResponses.push({ id: "response-northline-109-return", organizationId: organization.id, workOrderId: reopened109.id, assignmentId: return109AssignmentId, issuanceId: return109IssuanceId, response: "accepted", responderName: "PumpPro Fuel & Dispenser Repair dispatch", proposedAt: staleStart, respondedAt: at(8, 25, 10) });
  visits.push({ id: "visit-northline-109-stale", organizationId: organization.id, storeId: "store-northline-109", providerKind: "outside_vendor", vendorId: "vendor-northline-forecourt", workOrderId: "wo-northline-109", technicianName: "Eli Thompson", providerName: "PumpPro Fuel & Dispenser Repair", purpose: "Recheck the intermittent payment terminal connection at dispenser 4", status: "active", startedChannel: "store_device", checkedInAt: staleStart });
  visitEvidence.push({ id: "evidence-visit-northline-109-stale-in", organizationId: organization.id, visitId: "visit-northline-109-stale", kind: "check_in", channel: "store_device", observedAt: staleStart, location: { result: "trusted_store_device", capturedAt: staleStart }, payloadJson: "{}" });
  exceptions.push({ id: "exception-northline-109-missing-checkout", organizationId: organization.id, kind: "missing_checkout", storeId: "store-northline-109", workOrderId: "wo-northline-109", visitId: "visit-northline-109-stale", vendorId: "vendor-northline-forecourt", severity: "attention", status: "open", summary: "Visit remains open more than 7 hours after check-in", detectedAt: at(8, 25, 17, 40) });

  // Recent checked-out visits keep the live-visit exception story in context:
  // three technicians are currently onsite, while the same workspace also has
  // a believable service history across every provider, both internal techs,
  // multiple channels, and outcomes that do not all pretend the first trip
  // solved the problem. Unresolved outcomes create accountable follow-ups.
  type RecentServiceStory = {
    key: string;
    storeNumber: string;
    categoryKey: string;
    problem: string;
    providerKind: VisitSession["providerKind"];
    vendorId?: string;
    internalMembershipId?: string;
    technicianName: string;
    providerName: string;
    priority: WorkOrder["priority"];
    submittedAt: string;
    checkedInAt: string;
    durationMinutes: number;
    startedChannel: VisitSession["startedChannel"];
    endedChannel: NonNullable<VisitSession["endedChannel"]>;
    locationResult: NonNullable<VisitEvidence["location"]>["result"];
    outcome: NonNullable<VisitSession["outcome"]>;
    outcomeNotes: string;
    workStatus: WorkOrder["status"];
    nteAmountMinor: number;
    laborAmountMinor: number;
    materialsAmountMinor: number;
    followUpAction?: string;
    followUpDueAt?: string;
  };
  const recentServiceStories: RecentServiceStory[] = [
    { key: "aug-101-refrigeration", storeNumber: "101", categoryKey: "refrigeration", problem: "Beer cave temperature climbed to 44°F during the afternoon rush", providerKind: "outside_vendor", vendorId: "vendor-northline-summit", technicianName: "Chris Walker", providerName: "ColdLine Refrigeration & HVAC", priority: "urgent", submittedAt: at(8, 1, 19, 20), checkedInAt: at(8, 2, 13, 10), durationMinutes: 112, startedChannel: "qr", endedChannel: "secure_link", locationResult: "verified", outcome: "resolved", outcomeNotes: "Cleared a blocked condensate path, replaced the failed controller probe, and documented a stable 36°F box temperature.", workStatus: "completed_pending_review", nteAmountMinor: 185_000, laborAmountMinor: 46_000, materialsAmountMinor: 31_500, followUpAction: "Verify the stable beer-cave temperature and accept or reject the recorded outcome", followUpDueAt: at(8, 25, 16) },
    { key: "aug-102-hvac", storeNumber: "102", categoryKey: "hvac", problem: "Sales floor rooftop unit runs continuously but cannot hold setpoint", providerKind: "outside_vendor", vendorId: "vendor-northline-cedar", technicianName: "Sam Patel", providerName: "ClearFlow HVAC, Plumbing & Kitchen Repair", priority: "urgent", submittedAt: at(8, 2, 21, 5), checkedInAt: at(8, 3, 14, 35), durationMinutes: 86, startedChannel: "secure_link", endedChannel: "qr", locationResult: "verified", outcome: "diagnosed_waiting_parts", outcomeNotes: "Confirmed a failed condenser-fan motor. The unit is safe to remain off until the approved motor arrives.", workStatus: "waiting_on_parts", nteAmountMinor: 240_000, laborAmountMinor: 39_500, materialsAmountMinor: 0, followUpAction: "Confirm motor availability and schedule the approved return visit", followUpDueAt: at(8, 27, 16) },
    { key: "aug-103-electrical", storeNumber: "103", categoryKey: "electrical", problem: "Manager reported intermittent power loss at the stockroom receptacles", providerKind: "internal", internalMembershipId: "membership-northline-tech-1", technicianName: "Maria Santos", providerName: "Clark Pump and Shop Maintenance", priority: "routine", submittedAt: at(8, 4, 11), checkedInAt: at(8, 4, 14, 5), durationMinutes: 54, startedChannel: "store_device", endedChannel: "store_device", locationResult: "trusted_store_device", outcome: "no_issue_found", outcomeNotes: "Tested the receptacles under load and checked the panel; no fault recurred. Store will monitor and photograph the next event.", workStatus: "closed", nteAmountMinor: 60_000, laborAmountMinor: 21_500, materialsAmountMinor: 0 },
    { key: "aug-105-forecourt", storeNumber: "105", categoryKey: "forecourt", problem: "Dispenser 4 card reader reboots during some contactless transactions", providerKind: "outside_vendor", vendorId: "vendor-northline-forecourt", technicianName: "Dana Ruiz", providerName: "PumpPro Fuel & Dispenser Repair", priority: "urgent", submittedAt: at(8, 4, 18, 40), checkedInAt: at(8, 5, 12, 50), durationMinutes: 74, startedChannel: "qr", endedChannel: "store_device", locationResult: "verified", outcome: "return_required", outcomeNotes: "Isolated the fault to the payment-terminal communication board. Dispenser remains available for chip transactions pending replacement.", workStatus: "waiting_on_vendor", nteAmountMinor: 275_000, laborAmountMinor: 48_000, materialsAmountMinor: 0, followUpAction: "Provide board availability and a return-service date", followUpDueAt: at(8, 26, 18) },
    { key: "aug-106-exterior", storeNumber: "106", categoryKey: "exterior", problem: "Standing water is forming beside the west parking-lot drain", providerKind: "outside_vendor", vendorId: "vendor-northline-four-seasons", technicianName: "Lena Brooks", providerName: "GreenLot Landscaping & Snow Removal", priority: "routine", submittedAt: at(8, 5, 15, 25), checkedInAt: at(8, 6, 13, 20), durationMinutes: 63, startedChannel: "secure_link", endedChannel: "qr", locationResult: "verified", outcome: "inspection_complete", outcomeNotes: "Cleared surface debris, photographed settled pavement, and submitted measurements for a separate repair estimate.", workStatus: "closed", nteAmountMinor: 95_000, laborAmountMinor: 32_000, materialsAmountMinor: 7_500 },
    { key: "aug-108-electrical", storeNumber: "108", categoryKey: "electrical", problem: "Two canopy-lighting circuits remain dark after lamp replacement", providerKind: "outside_vendor", vendorId: "vendor-northline-brightpath", technicianName: "Nolan Reed", providerName: "BrightLine Electrical & Lighting", priority: "routine", submittedAt: at(8, 6, 20, 10), checkedInAt: at(8, 7, 15, 15), durationMinutes: 91, startedChannel: "secure_link", endedChannel: "store_device", locationResult: "low_accuracy", outcome: "unable_to_complete", outcomeNotes: "Confirmed an underground-feed fault. A lift and utility locate are required before repair can proceed safely.", workStatus: "waiting_on_vendor", nteAmountMinor: 225_000, laborAmountMinor: 44_500, materialsAmountMinor: 0, followUpAction: "Submit the lift plan, utility-locate confirmation, and revised estimate", followUpDueAt: at(8, 27, 20) },
    { key: "aug-110-refrigeration", storeNumber: "110", categoryKey: "refrigeration", problem: "Walk-in cooler evaporator is icing and airflow is dropping", providerKind: "outside_vendor", vendorId: "vendor-northline-summit", technicianName: "Drew Miller", providerName: "ColdLine Refrigeration & HVAC", priority: "urgent", submittedAt: at(8, 7, 22, 15), checkedInAt: at(8, 8, 11, 40), durationMinutes: 128, startedChannel: "qr", endedChannel: "secure_link", locationResult: "permission_denied", outcome: "temporary_repair", outcomeNotes: "Defrosted the coil and restored airflow. A failed defrost-termination control requires an approved return repair.", workStatus: "waiting_on_parts", nteAmountMinor: 210_000, laborAmountMinor: 53_000, materialsAmountMinor: 12_500, followUpAction: "Price the defrost control and schedule the permanent repair", followUpDueAt: at(8, 28, 16) },
    { key: "aug-111-plumbing", storeNumber: "111", categoryKey: "plumbing", problem: "Restroom hand-sink supply connection is leaking into the cabinet", providerKind: "outside_vendor", vendorId: "vendor-northline-cedar", technicianName: "Imani Lewis", providerName: "ClearFlow HVAC, Plumbing & Kitchen Repair", priority: "routine", submittedAt: at(8, 9, 16, 45), checkedInAt: at(8, 10, 12, 15), durationMinutes: 82, startedChannel: "secure_link", endedChannel: "store_device", locationResult: "verified", outcome: "resolved", outcomeNotes: "Replaced the supply stop and flex connector, dried the cabinet, and verified no leakage under repeated use.", workStatus: "completed_pending_review", nteAmountMinor: 125_000, laborAmountMinor: 37_500, materialsAmountMinor: 18_900, followUpAction: "Review the store confirmation and recorded cost, then close the work order", followUpDueAt: at(8, 25, 17) },
  ];

  recentServiceStories.forEach((story, index) => {
    const store = stores.find((candidate) => candidate.storeNumber === story.storeNumber)!;
    const vendor = story.vendorId ? vendors.find((candidate) => candidate.id === story.vendorId) : undefined;
    const workOrderId = `wo-recent-${story.key}`;
    const requestId = `request-recent-${story.key}`;
    const assignmentId = `assignment-recent-${story.key}`;
    const issuanceId = `issuance-recent-${story.key}-r1`;
    const visitId = `visit-recent-${story.key}`;
    const createdAt = new Date(Date.parse(story.submittedAt) + 30 * 60_000).toISOString();
    const assignedAt = new Date(Date.parse(createdAt) + 20 * 60_000).toISOString();
    const issuedAt = new Date(Date.parse(assignedAt) + 15 * 60_000).toISOString();
    const checkedOutAt = new Date(Date.parse(story.checkedInAt) + story.durationMinutes * 60_000).toISOString();
    const assetId = story.categoryKey === "refrigeration"
      ? `asset-${story.storeNumber}-beer-cave`
      : story.categoryKey === "hvac"
        ? `asset-${story.storeNumber}-rtu-1`
        : story.categoryKey === "forecourt"
          ? `asset-${story.storeNumber}-dispenser-4`
          : undefined;
    const asset = assetId ? assets.find((candidate) => candidate.id === assetId) : undefined;
    const workOrderNumber = `CPS-2026-${String(201 + index).padStart(4, "0")}`;
    const nte = { amountMinor: story.nteAmountMinor, currency: "USD" };
    const open = !["closed", "cancelled"].includes(story.workStatus);

    requests.push({ id: requestId, organizationId: organization.id, reference: `REQ-26-AUG-${story.storeNumber}-${index + 1}`, storeId: store.id, reporterName: ["Taylor Kim", "Morgan Wells", "Avery Johnson", "Jamie Cole"][index % 4], reporterEmployeeId: `E${5200 + index}`, problem: story.problem, priority: story.priority, status: "converted", submittedAt: story.submittedAt, convertedWorkOrderId: workOrderId });
    workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: store.id, requestId, problem: story.problem, authorizedScope: `Diagnose the reported ${story.categoryKey} issue, complete authorized work, and record the observed outcome.`, categoryKey: story.categoryKey, taxonomyNodeId: taxonomyByCategory[story.categoryKey], assetId, priority: story.priority, status: story.workStatus, accountableParty: story.providerName, nextAction: open ? story.followUpAction! : "No action required", dueAt: open ? story.followUpDueAt : undefined, escalationTo: open ? "Clark Pump and Shop Facilities" : undefined, nte, vendorServiceTicketNumber: vendor ? `${vendor.code.toUpperCase()}-AUG-${story.storeNumber}-${index + 1}` : undefined, createdAt, closedAt: open ? undefined : checkedOutAt });
    assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: story.providerKind === "internal" ? "internal" : "outside_vendor", vendorId: story.vendorId, internalMembershipId: story.internalMembershipId, status: open ? "accepted" : "completed", assignedAt });
    issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: story.providerKind === "internal" ? { id: story.internalMembershipId, name: story.providerName } : { id: vendor!.id, name: vendor!.name }, problem: story.problem, priority: story.priority, authorizedScope: `Diagnose the reported ${story.categoryKey} issue, complete authorized work, and record the observed outcome.`, categoryKey: story.categoryKey, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, requestedTiming: story.checkedInAt, nte, billingInstruction: `Reference operator work order ${workOrderNumber} on all service paperwork and invoices.` }), channel: story.providerKind === "internal" ? "manual" : "email", issuedAt });
    if (vendor) vendorResponses.push({ id: `response-recent-${story.key}`, organizationId: organization.id, workOrderId, assignmentId, issuanceId, response: "accepted", responderName: `${vendor.name} dispatch`, proposedAt: story.checkedInAt, respondedAt: new Date(Date.parse(issuedAt) + 20 * 60_000).toISOString() });
    visits.push({ id: visitId, organizationId: organization.id, storeId: store.id, providerKind: story.providerKind, vendorId: story.vendorId, internalMembershipId: story.internalMembershipId, workOrderId, technicianName: story.technicianName, providerName: story.providerName, purpose: story.problem, status: "checked_out", startedChannel: story.startedChannel, endedChannel: story.endedChannel, checkedInAt: story.checkedInAt, checkedOutAt, outcome: story.outcome, outcomeNotes: story.outcomeNotes, observedDurationSeconds: durationSeconds(story.checkedInAt, checkedOutAt) });
    const location = story.locationResult === "verified"
      ? { result: story.locationResult, accuracyM: 13 + index * 2, distanceM: 16 + index * 3, capturedAt: story.checkedInAt }
      : story.locationResult === "low_accuracy"
        ? { result: story.locationResult, accuracyM: 146, distanceM: 58, capturedAt: story.checkedInAt }
        : { result: story.locationResult, capturedAt: story.checkedInAt };
    visitEvidence.push(
      { id: `evidence-${visitId}-in`, organizationId: organization.id, visitId, kind: "check_in", channel: story.startedChannel, observedAt: story.checkedInAt, location, payloadJson: JSON.stringify({ workOrderNumber }) },
      { id: `evidence-${visitId}-out`, organizationId: organization.id, visitId, kind: "check_out", channel: story.endedChannel, observedAt: checkedOutAt, location: story.endedChannel === "store_device" ? { result: "trusted_store_device", capturedAt: checkedOutAt } : { ...location, capturedAt: checkedOutAt }, payloadJson: JSON.stringify({ outcome: story.outcome }) },
    );
    if (story.key === "aug-111-plumbing") visitEvidence.push({ id: `evidence-${visitId}-store-confirmation`, organizationId: organization.id, visitId, kind: "store_confirmation", channel: "store_device", observedAt: new Date(Date.parse(checkedOutAt) + 5 * 60_000).toISOString(), location: { result: "trusted_store_device", capturedAt: new Date(Date.parse(checkedOutAt) + 5 * 60_000).toISOString() }, payloadJson: JSON.stringify({ confirmer: "Store shift lead", confirmation: "Technician departed and sink is dry" }) });
    costLines.push({ id: `cost-recent-${story.key}-labor`, organizationId: organization.id, workOrderId, kind: "labor", description: `${story.providerName} observed service visit`, amount: { amountMinor: story.laborAmountMinor, currency: "USD" }, serviceDate: checkedOutAt.slice(0, 10), recordedAt: new Date(Date.parse(checkedOutAt) + 30 * 60_000).toISOString() });
    if (story.materialsAmountMinor) costLines.push({ id: `cost-recent-${story.key}-materials`, organizationId: organization.id, workOrderId, kind: assetId ? "parts" : "materials", description: "Recorded repair parts and materials", amount: { amountMinor: story.materialsAmountMinor, currency: "USD" }, serviceDate: checkedOutAt.slice(0, 10), recordedAt: new Date(Date.parse(checkedOutAt) + 30 * 60_000).toISOString() });
    if (open) followUps.push({ id: `follow-up-recent-${story.key}`, organizationId: organization.id, workOrderId, sourceVisitId: visitId, accountableParty: story.providerName, nextAction: story.followUpAction!, dueAt: story.followUpDueAt!, escalationTo: "Clark Pump and Shop Facilities", status: "open", createdAt: checkedOutAt });
    if (story.locationResult === "low_accuracy") exceptions.push({ id: `exception-recent-${story.key}-location`, organizationId: organization.id, kind: "low_accuracy_location", storeId: store.id, workOrderId, visitId, vendorId: story.vendorId, severity: "attention", status: "acknowledged", summary: "Technician check-in location was captured with low GPS accuracy", detectedAt: story.checkedInAt });
  });

  // Current intake remains visible before conversion. These records prove that
  // an employee report does not disappear merely because a work order has not
  // been approved, and that a closed request does not invent maintenance cost.
  requests.push(
    { id: "request-current-101-freezer-door", organizationId: organization.id, reference: "REQ-26-101D", storeId: "store-northline-101", reporterName: "Taylor Kim", reporterEmployeeId: "E6101", problem: "Walk-in freezer door is not sealing along the lower hinge side", priority: "urgent", status: "submitted", submittedAt: at(8, 25, 15, 5) },
    { id: "request-current-104-beer-cave-door", organizationId: organization.id, reference: "REQ-26-104D", storeId: "store-northline-104", reporterName: "Robin Carter", reporterEmployeeId: "E6104", problem: "Beer cave door is not sealing and packaged beverages were moved to backup coolers", priority: "urgent", status: "under_review", submittedAt: at(8, 25, 15, 35) },
    { id: "request-current-106-ceiling-stain", organizationId: organization.id, reference: "REQ-26-106B", storeId: "store-northline-106", reporterName: "Morgan Wells", reporterEmployeeId: "E6106", problem: "A new ceiling stain is visible above the stockroom receiving door", priority: "routine", status: "under_review", submittedAt: at(8, 25, 13, 35) },
    { id: "request-current-110-ice-machine", organizationId: organization.id, reference: "REQ-26-110C", storeId: "store-northline-110", reporterName: "Avery Johnson", reporterEmployeeId: "E6110", problem: "Ice machine is leaking into the beverage-island floor drain", priority: "urgent", status: "under_review", submittedAt: at(8, 25, 14, 20) },
    { id: "request-current-114-pavement", organizationId: organization.id, reference: "REQ-26-114B", storeId: "store-northline-114", reporterName: "Jamie Cole", reporterEmployeeId: "E6114", problem: "Pavement has settled at the north entrance and is holding water", priority: "routine", status: "submitted", submittedAt: at(8, 24, 16, 10) },
    { id: "request-current-103-gfci-reset", organizationId: organization.id, reference: "REQ-26-103C", storeId: "store-northline-103", reporterName: "Riley Adams", reporterEmployeeId: "E6103", problem: "Coffee counter receptacles lost power during cleaning", priority: "routine", status: "closed", submittedAt: at(8, 24, 10, 15) },
  );

  // Two no-visit service authorizations make the current queue operationally
  // diverse: one vendor proposed a service date, while another explicitly
  // declined and returned provider selection to facilities.
  const scheduledRequestId = "request-current-113-freezer-service";
  const scheduledWorkOrderId = "wo-current-113-freezer-service";
  const scheduledAssignmentId = "assignment-current-113-freezer-service";
  const scheduledIssuanceId = "issuance-current-113-freezer-service-r1";
  const scheduledProblem = "Walk-in freezer temperature alarm returns after the nightly defrost cycle";
  requests.push({ id: scheduledRequestId, organizationId: organization.id, reference: "REQ-26-113B", storeId: "store-northline-113", reporterName: "Morgan Wells", reporterEmployeeId: "E6113", problem: scheduledProblem, priority: "urgent", status: "converted", submittedAt: at(8, 24, 18, 25), convertedWorkOrderId: scheduledWorkOrderId });
  workOrders.push({ id: scheduledWorkOrderId, organizationId: organization.id, number: "CPS-2026-0211", storeId: "store-northline-113", requestId: scheduledRequestId, problem: scheduledProblem, authorizedScope: "Diagnose the defrost-cycle alarm, restore stable freezer operation, record controller readings, and document any additional recommended work.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-freezers", assetId: "asset-113-walk-in-freezer", priority: "urgent", status: "waiting_on_vendor", accountableParty: "Facilities coordinator", nextAction: "Accept or counter ColdLine's proposed service date", dueAt: at(8, 25, 17, 15), escalationTo: "Facilities director", nte: { amountMinor: 225_000, currency: "USD" }, createdAt: at(8, 24, 18, 45) });
  assignments.push({ id: scheduledAssignmentId, organizationId: organization.id, workOrderId: scheduledWorkOrderId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "issued", assignedAt: at(8, 24, 19) });
  issuances.push({ id: scheduledIssuanceId, organizationId: organization.id, workOrderId: scheduledWorkOrderId, assignmentId: scheduledAssignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: "CPS-2026-0211", store: { id: "store-northline-113", storeNumber: "113", name: "Clark Pump and Shop - Riverbend", formattedAddress: "313 Riverbend Parkway, Riverbend, OH 43529" }, vendor: { id: "vendor-northline-summit", name: "ColdLine Refrigeration & HVAC" }, problem: scheduledProblem, priority: "urgent", authorizedScope: "Diagnose the defrost-cycle alarm, restore stable freezer operation, record controller readings, and document any additional recommended work.", categoryKey: "refrigeration", asset: { id: "asset-113-walk-in-freezer", name: "Walk-in freezer - receiving", assetTag: "113-FRZ-01" }, requestedTiming: at(8, 27, 16), nte: { amountMinor: 225_000, currency: "USD" }, billingInstruction: "Reference operator work order CPS-2026-0211 on all service paperwork and invoices." }), channel: "email", issuedAt: at(8, 24, 19, 10) });
  vendorResponses.push({ id: "response-current-113-proposed-date", organizationId: organization.id, workOrderId: scheduledWorkOrderId, assignmentId: scheduledAssignmentId, issuanceId: scheduledIssuanceId, response: "proposed_date", responderName: "ColdLine Refrigeration & HVAC dispatch", proposedAt: at(8, 28, 14), message: "Defrost technician and controller stock are available Friday afternoon.", respondedAt: at(8, 25, 9, 15) });

  // A separate confirmed appointment proves the post-decision state without
  // pretending that the still-pending Store 113 proposal was already accepted.
  const confirmedWorkOrderId = "wo-current-107-hvac-scheduled";
  const confirmedAssignmentId = "assignment-current-107-hvac-scheduled";
  const confirmedIssuanceId = "issuance-current-107-hvac-scheduled-r1";
  const confirmedResponseId = "response-current-107-hvac-accepted";
  const confirmedProblem = "Sales-floor rooftop unit is cooling intermittently during the afternoon peak";
  requests.push({ id: "request-current-107-hvac-scheduled", organizationId: organization.id, reference: "REQ-26-107H", storeId: "store-northline-107", reporterName: "Quinn Foster", reporterEmployeeId: "E6107", problem: confirmedProblem, priority: "urgent", status: "converted", submittedAt: at(8, 24, 13), convertedWorkOrderId: confirmedWorkOrderId });
  workOrders.push({ id: confirmedWorkOrderId, organizationId: organization.id, number: "CPS-2026-0213", storeId: "store-northline-107", requestId: "request-current-107-hvac-scheduled", problem: confirmedProblem, authorizedScope: "Diagnose the intermittent cooling condition, restore stable operation, record supply-air readings, and document any additional recommended work.", categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", assetId: "asset-107-rtu-1", priority: "urgent", status: "scheduled", accountableParty: "ClearFlow HVAC, Plumbing & Kitchen Repair", nextAction: "Arrive for the confirmed service window and check in", dueAt: at(8, 27, 13), escalationTo: "Facilities director", nte: { amountMinor: 185_000, currency: "USD" }, createdAt: at(8, 24, 13, 20) });
  assignments.push({ id: confirmedAssignmentId, organizationId: organization.id, workOrderId: confirmedWorkOrderId, kind: "outside_vendor", vendorId: "vendor-northline-cedar", status: "accepted", assignedAt: at(8, 24, 14) });
  issuances.push({ id: confirmedIssuanceId, organizationId: organization.id, workOrderId: confirmedWorkOrderId, assignmentId: confirmedAssignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: "CPS-2026-0213", store: { id: "store-northline-107", storeNumber: "107", name: "Clark Pump and Shop - Junction City", formattedAddress: "17 Junction Plaza, Junction City, IN 46712" }, vendor: { id: "vendor-northline-cedar", name: "ClearFlow HVAC, Plumbing & Kitchen Repair" }, problem: confirmedProblem, priority: "urgent", authorizedScope: "Diagnose the intermittent cooling condition, restore stable operation, record supply-air readings, and document any additional recommended work.", categoryKey: "hvac", requestedTiming: at(8, 27, 13), nte: { amountMinor: 185_000, currency: "USD" }, billingInstruction: "Reference operator work order CPS-2026-0213 on all service paperwork and invoices." }), channel: "email", issuedAt: at(8, 24, 14, 10) });
  vendorResponses.push({ id: confirmedResponseId, organizationId: organization.id, workOrderId: confirmedWorkOrderId, assignmentId: confirmedAssignmentId, issuanceId: confirmedIssuanceId, response: "accepted", responderName: "ClearFlow HVAC, Plumbing & Kitchen Repair dispatch", message: "Service window confirmed with the store manager.", respondedAt: at(8, 24, 14, 35) });
  serviceAppointments.push({ id: "appointment-current-107-hvac-confirmed", organizationId: organization.id, workOrderId: confirmedWorkOrderId, assignmentId: confirmedAssignmentId, issuanceId: confirmedIssuanceId, sourceVendorResponseId: confirmedResponseId, status: "confirmed", proposedBy: "operator", startsAt: at(8, 27, 13), createdByMembershipId: "membership-northline-facilities", createdAt: at(8, 24, 14, 40) });

  // A small but credible forward schedule makes the upcoming-visit queue
  // useful without turning the product into vendor dispatch software. Each
  // record is a vendor-confirmed customer appointment tied to one canonical
  // work order; the vendor still controls its crew and routing.
  const upcomingVisitSeeds = [
    {
      key: "102-ice-machine",
      number: "CPS-2026-0214",
      storeId: "store-northline-102",
      vendorId: "vendor-northline-summit",
      categoryKey: "refrigeration",
      assetId: "asset-102-ice-machine",
      problem: "Ice machine is producing thin sheets and dropping ice more slowly than normal",
      scope: "Inspect the ice machine, diagnose the reduced production, restore normal operation where practical, and document any follow-up work.",
      startsAt: at(8, 28, 13, 30),
      nteAmountMinor: 175_000,
    },
    {
      key: "105-dispenser-inspection",
      number: "CPS-2026-0215",
      storeId: "store-northline-105",
      vendorId: "vendor-northline-forecourt",
      categoryKey: "forecourt",
      assetId: "asset-105-dispenser-2",
      problem: "Dispenser 2 nozzle shuts off early during several customer fuelings",
      scope: "Inspect the nozzle, hose, and dispenser flow path; correct the reported premature shutoff and document the service outcome.",
      startsAt: at(8, 31, 14),
      nteAmountMinor: 165_000,
    },
    {
      key: "104-sign-lighting",
      number: "CPS-2026-0216",
      storeId: "store-northline-104",
      vendorId: "vendor-northline-brightpath",
      categoryKey: "electrical",
      problem: "One section of the roadside price sign is dark after sunset",
      scope: "Inspect the dark sign section, restore normal illumination where practical, and document any parts or access needed for follow-up.",
      startsAt: at(9, 1, 14, 30),
      nteAmountMinor: 185_000,
    },
    {
      key: "114-lot-drainage",
      number: "CPS-2026-0217",
      storeId: "store-northline-114",
      vendorId: "vendor-northline-four-seasons",
      categoryKey: "exterior",
      problem: "Standing water remains beside the north parking-lot drain after moderate rain",
      scope: "Inspect the drain approach and surrounding pavement, clear routine obstructions, and report any grading or pavement work needed.",
      startsAt: at(9, 3, 12, 30),
      nteAmountMinor: 125_000,
    },
  ] as const;

  upcomingVisitSeeds.forEach((seed, index) => {
    const store = stores.find((candidate) => candidate.id === seed.storeId)!;
    const vendor = vendors.find((candidate) => candidate.id === seed.vendorId)!;
    const requestId = `request-upcoming-${seed.key}`;
    const workOrderId = `wo-upcoming-${seed.key}`;
    const assignmentId = `assignment-upcoming-${seed.key}`;
    const issuanceId = `issuance-upcoming-${seed.key}-r1`;
    const responseId = `response-upcoming-${seed.key}`;
    const createdAt = at(8, 24, 10 + index);
    const assignedAt = at(8, 24, 11 + index);
    const issuedAt = at(8, 24, 11 + index, 10);
    const respondedAt = at(8, 25, 9 + index, 10);

    requests.push({ id: requestId, organizationId: organization.id, reference: `REQ-26-UP-${store.storeNumber}`, storeId: store.id, reporterName: ["Taylor Kim", "Morgan Wells", "Avery Johnson", "Jamie Cole"][index]!, reporterEmployeeId: `E${6302 + index}`, problem: seed.problem, priority: "routine", status: "converted", submittedAt: createdAt, convertedWorkOrderId: workOrderId });
    workOrders.push({ id: workOrderId, organizationId: organization.id, number: seed.number, storeId: store.id, requestId, problem: seed.problem, authorizedScope: seed.scope, categoryKey: seed.categoryKey, taxonomyNodeId: taxonomyByCategory[seed.categoryKey], assetId: "assetId" in seed ? seed.assetId : undefined, priority: "routine", status: "scheduled", accountableParty: vendor.name, nextAction: "Vendor arrives for the confirmed visit and checks in", dueAt: seed.startsAt, escalationTo: "Facilities coordinator", nte: { amountMinor: seed.nteAmountMinor, currency: "USD" }, createdAt });
    assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: "outside_vendor", vendorId: vendor.id, status: "accepted", assignedAt });
    issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: seed.number, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: { id: vendor.id, name: vendor.name }, problem: seed.problem, priority: "routine", authorizedScope: seed.scope, categoryKey: seed.categoryKey, requestedTiming: seed.startsAt, nte: { amountMinor: seed.nteAmountMinor, currency: "USD" }, billingInstruction: `Reference operator work order ${seed.number} on all service paperwork and invoices.` }), channel: "email", issuedAt });
    vendorResponses.push({ id: responseId, organizationId: organization.id, workOrderId, assignmentId, issuanceId, response: "accepted", responderName: `${vendor.name} dispatch`, message: "Requested visit date confirmed with the customer.", respondedAt });
    serviceAppointments.push({ id: `appointment-upcoming-${seed.key}`, organizationId: organization.id, workOrderId, assignmentId, issuanceId, sourceVendorResponseId: responseId, status: "confirmed", proposedBy: "vendor", startsAt: seed.startsAt, note: "Vendor-confirmed service appointment", createdByMembershipId: "membership-northline-facilities", createdAt: respondedAt });
  });

  const declinedRequestId = "request-current-114-canopy-service";
  const declinedWorkOrderId = "wo-current-114-canopy-service";
  const declinedAssignmentId = "assignment-current-114-canopy-declined";
  const declinedIssuanceId = "issuance-current-114-canopy-service-r1";
  const declinedProblem = "Canopy lighting at the west fuel island is dark after a breaker reset";
  requests.push({ id: declinedRequestId, organizationId: organization.id, reference: "REQ-26-114C", storeId: "store-northline-114", reporterName: "Jamie Cole", reporterEmployeeId: "E6214", problem: declinedProblem, priority: "urgent", status: "converted", submittedAt: at(8, 24, 20, 40), convertedWorkOrderId: declinedWorkOrderId });
  workOrders.push({ id: declinedWorkOrderId, organizationId: organization.id, number: "CPS-2026-0212", storeId: "store-northline-114", requestId: declinedRequestId, problem: declinedProblem, authorizedScope: "Diagnose the west-island canopy circuit, restore safe lighting, and document any additional recommended work.", categoryKey: "electrical", taxonomyNodeId: "taxonomy-northline-canopy_lighting", priority: "urgent", status: "waiting_on_vendor", accountableParty: "Facilities coordinator", nextAction: "Select a backup electrical vendor after BrightLine declined", dueAt: at(8, 26, 12), escalationTo: "Facilities director", nte: { amountMinor: 180_000, currency: "USD" }, createdAt: at(8, 24, 21) });
  assignments.push(
    { id: declinedAssignmentId, organizationId: organization.id, workOrderId: declinedWorkOrderId, kind: "outside_vendor", vendorId: "vendor-northline-brightpath", status: "declined", assignedAt: at(8, 24, 21, 10) },
    { id: "assignment-current-114-canopy-choose-later", organizationId: organization.id, workOrderId: declinedWorkOrderId, kind: "choose_later", status: "pending", assignedAt: at(8, 25, 8, 25), supersedesAssignmentId: declinedAssignmentId },
  );
  issuances.push({ id: declinedIssuanceId, organizationId: organization.id, workOrderId: declinedWorkOrderId, assignmentId: declinedAssignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: "CPS-2026-0212", store: { id: "store-northline-114", storeNumber: "114", name: "Clark Pump and Shop - North Market", formattedAddress: "1414 North Market Street, North Market, OH 43540" }, vendor: { id: "vendor-northline-brightpath", name: "BrightLine Electrical & Lighting" }, problem: declinedProblem, priority: "urgent", authorizedScope: "Diagnose the west-island canopy circuit, restore safe lighting, and document any additional recommended work.", categoryKey: "electrical", requestedTiming: at(8, 25, 16), nte: { amountMinor: 180_000, currency: "USD" }, billingInstruction: "Reference operator work order CPS-2026-0212 on all service paperwork and invoices." }), channel: "email", issuedAt: at(8, 24, 21, 20) });
  vendorResponses.push({ id: "response-current-114-declined", organizationId: organization.id, workOrderId: declinedWorkOrderId, assignmentId: declinedAssignmentId, issuanceId: declinedIssuanceId, response: "declined", responderName: "BrightLine Electrical & Lighting dispatch", message: "No lift-qualified technician is available within the requested service window.", respondedAt: at(8, 25, 8, 15) });

  const questionedIssuance = issuances.find((issuance) => issuance.id === "issuance-recent-aug-108-electrical-r1")!;
  vendorResponses.push({ id: "response-recent-aug-108-electrical-question", organizationId: organization.id, workOrderId: questionedIssuance.workOrderId, assignmentId: questionedIssuance.assignmentId, issuanceId: questionedIssuance.id, response: "question", responderName: "BrightLine Electrical & Lighting dispatch", message: "Does the store have overnight lift access, or should the quote include a lift rental?", respondedAt: new Date(Date.parse(questionedIssuance.issuedAt) + 5 * 60_000).toISOString() });

  // Every employee issue carries a structured, append-only impact report. A
  // manager confirmation is appended for requests that have moved beyond the
  // submitted queue; exposure amounts remain estimates, never verified loss.
  requests.forEach((request, index) => {
    const problem = request.problem.toLocaleLowerCase("en-US");
    const coldProduct = /beer cave|refriger|freezer|ice machine|temperature|warm/.test(problem);
    const potentialSafety = /leak|stain|pavement|power|receptacle|dark|fuel|breaker/.test(problem);
    const customerFacing = coldProduct || /coffee|canopy|fuel|door|lighting/.test(problem);
    const revenueFunctionImpact = /fuel|dispenser|canopy/.test(problem) ? "fuel" as const
      : /coffee|foodservice/.test(problem) ? "foodservice" as const
        : coldProduct ? "refrigerated_merchandise" as const : undefined;
    const partial = coldProduct || potentialSafety || customerFacing;
    const initialAt = request.submittedAt;
    const initial: RequestImpactAssessment = {
      id: `impact-${request.id}-initial`, organizationId: request.organizationId, requestId: request.id, storeId: request.storeId,
      assessmentKind: "initial_report", storeOperatingState: partial ? "partially_operational" : "open",
      safetyConcern: potentialSafety ? "potential" : "none_reported", productInventoryRisk: coldProduct ? "at_risk" : "none_reported",
      productInventoryValue: coldProduct ? { amountMinor: request.storeId === "store-northline-104" ? 285_000 : 95_000 + index * 250, currency: "USD" } : undefined,
      customersAffected: customerFacing ? "yes" : "no", complianceImpact: coldProduct || potentialSafety ? "potential" : "none_reported",
      capacityUnavailableBps: request.storeId === "store-northline-104" ? 10_000 : partial ? 2_500 : undefined,
      redundantEquipment: coldProduct ? "no" : "unknown", revenueFunctionImpact,
      estimatedDailyRevenueExposure: revenueFunctionImpact ? { amountMinor: request.storeId === "store-northline-104" ? 475_000 : 120_000 + index * 500, currency: "USD" } : undefined,
      estimatedDowntimeMinutes: partial ? 240 : undefined, confidence: "medium", source: "store_report",
      notes: coldProduct ? "Store-reported product and operating exposure; values require manager review." : "Store-reported operating impact.",
      assessedByActorType: "user", assessedByActorId: request.reporterEmployeeId, assessedByActorName: request.reporterName, assessedAt: initialAt,
    };
    requestImpactAssessments.push(initial);
    if (request.status === "submitted") return;
    const reviewedAt = new Date(Date.parse(initialAt) + 15 * 60_000).toISOString();
    requestImpactAssessments.push({
      ...initial, id: `impact-${request.id}-review`, assessmentKind: "review", reviewDisposition: "confirmed",
      confidence: "high", source: "manager_review", notes: "Manager confirmed the reported operating facts. Monetary and downtime figures remain estimates, not verified losses.",
      assessedByActorType: "user", assessedByActorId: "membership-northline-facilities", assessedByActorName: "Jordan Lee", assessedAt: reviewedAt,
    });
  });

  const pmPlans: PmPlan[] = stores.map((store) => ({ id: `pm-plan-${store.storeNumber}-refrigeration`, organizationId: organization.id, name: "Quarterly refrigeration inspection", programId: "maintenance-program-quarterly-refrigeration-v1", programVersion: 1, storeId: store.id, assetId: `asset-${store.storeNumber}-beer-cave`, categoryKey: "refrigeration", cadenceDays: store.storeNumber === "111" ? 60 : 90, completionWindowDays: 7, preferredVendorId: "vendor-northline-summit", backupVendorId: "vendor-northline-cedar", contractVersionId: "contract-version-summit-refrigeration-v1", effectiveStartsAt: atYear(2026, 1, 1), effectiveEndsAt: atYear(2026, 12, 31, 23), accessRequirements: "Manager unlocks the rear service entrance and confirms safe access to refrigeration equipment.", programAuthorizationMinor: 50_000, budgetMinor: 60_000, currency: "USD", serviceLevelPolicyId: "sla-summit-planned", schedulingMode: "platform_proposed_vendor_confirmed", escalationRules: "Escalate an unscheduled occurrence 48 hours before its due-window end.", cadenceOverrideReason: store.storeNumber === "111" ? "Lakefront Travel Center volume requires a shorter refrigeration service interval." : undefined, cadenceOverriddenAt: store.storeNumber === "111" ? at(8, 18, 14) : undefined, cadenceOverriddenByMembershipId: store.storeNumber === "111" ? "membership-northline-facilities" : undefined, active: true, createdAt: at(1, 6, 14) }));
  const pmOccurrences: PmOccurrence[] = [];
  const maintenancePrograms: OpsFixture["maintenancePrograms"] = [
    { id: "maintenance-program-quarterly-refrigeration-v1", organizationId: organization.id, programKey: "quarterly-refrigeration", version: 1, name: "Quarterly refrigeration preventive service", tradeKey: "refrigeration", workType: "preventive_maintenance", applicableAssetTypes: ["equipment-template-beer-cave"], frequencyDays: 90, recurrenceKind: "fixed_calendar", dueWindowDays: 7, scheduleAnchorAt: atYear(2026, 3, 14, 12), seasonalStartMonth: 1, seasonalEndMonth: 12, checklistTemplateId: "checklist-quarterly-refrigeration-v1", requiredEvidenceKinds: ["check_in", "check_out", "photo"], expectedDurationMinutes: 75, completionCriteria: "Every Asset-level Work Item has a complete checklist, required evidence, measurements, and a documented result.", correctiveWorkAuthorityMinor: 50_000, currency: "USD", deficiencyHandling: "quote_and_approval", status: "active", createdAt: atYear(2026, 1, 1) },
    { id: "maintenance-program-spring-hvac-v1", organizationId: organization.id, programKey: "spring-hvac-readiness", version: 1, name: "Spring HVAC cooling readiness", tradeKey: "hvac", workType: "preventive_maintenance", applicableAssetTypes: ["equipment-template-rtu-5ton", "equipment-template-rtu-3ton"], frequencyDays: 365, recurrenceKind: "fixed_calendar", dueWindowDays: 14, scheduleAnchorAt: atYear(2026, 4, 15, 12), seasonalStartMonth: 3, seasonalEndMonth: 5, checklistTemplateId: "checklist-spring-hvac-v1", requiredEvidenceKinds: ["check_in", "check_out", "photo"], expectedDurationMinutes: 60, completionCriteria: "Cooling operation, filters, coils, electrical condition, and temperature split are documented for each rooftop unit.", correctiveWorkAuthorityMinor: 35_000, currency: "USD", deficiencyHandling: "quote_and_approval", status: "active", createdAt: atYear(2026, 1, 2) },
    { id: "maintenance-program-fall-hvac-v1", organizationId: organization.id, programKey: "fall-hvac-readiness", version: 1, name: "Fall HVAC heating readiness", tradeKey: "hvac", workType: "preventive_maintenance", applicableAssetTypes: ["equipment-template-rtu-5ton", "equipment-template-rtu-3ton"], frequencyDays: 365, recurrenceKind: "fixed_calendar", dueWindowDays: 14, scheduleAnchorAt: atYear(2026, 10, 15, 12), seasonalStartMonth: 9, seasonalEndMonth: 11, checklistTemplateId: "checklist-fall-hvac-v1", requiredEvidenceKinds: ["check_in", "check_out", "photo"], expectedDurationMinutes: 55, completionCriteria: "Heating operation, heat exchanger condition, controls, and safety cutoffs are documented for each rooftop unit.", correctiveWorkAuthorityMinor: 35_000, currency: "USD", deficiencyHandling: "quote_and_approval", status: "active", createdAt: atYear(2026, 1, 2) },
    { id: "maintenance-program-foodservice-deep-clean-v1", organizationId: organization.id, programKey: "foodservice-deep-clean", version: 1, name: "Foodservice equipment deep clean", tradeKey: "foodservice", workType: "preventive_maintenance", applicableAssetTypes: ["equipment-template-rapid-cook-oven"], frequencyDays: 180, recurrenceKind: "fixed_calendar", dueWindowDays: 10, scheduleAnchorAt: atYear(2026, 2, 15, 12), seasonalStartMonth: 1, seasonalEndMonth: 12, checklistTemplateId: "checklist-foodservice-deep-clean-v1", requiredEvidenceKinds: ["check_in", "check_out", "photo"], expectedDurationMinutes: 50, completionCriteria: "Accessible cooking surfaces, filters, airflow paths, door condition, and operating checks are documented.", correctiveWorkAuthorityMinor: 25_000, currency: "USD", deficiencyHandling: "review", status: "active", createdAt: atYear(2026, 1, 3) },
    { id: "maintenance-program-pest-monitoring-v1", organizationId: organization.id, programKey: "monthly-pest-monitoring", version: 1, name: "Monthly pest-control monitoring", tradeKey: "store_sanitation", workType: "inspection", applicableAssetTypes: [], frequencyDays: 30, recurrenceKind: "fixed_calendar", dueWindowDays: 5, scheduleAnchorAt: atYear(2026, 1, 28, 12), seasonalStartMonth: 1, seasonalEndMonth: 12, checklistTemplateId: "checklist-pest-monitoring-v1", requiredEvidenceKinds: ["check_in", "check_out"], expectedDurationMinutes: 30, completionCriteria: "Monitoring points, observed activity, corrective recommendations, and service completion are documented for the store.", correctiveWorkAuthorityMinor: 15_000, currency: "USD", deficiencyHandling: "corrective_work_order", status: "active", createdAt: atYear(2026, 1, 3) },
  ];
  const checklistTemplates: OpsFixture["checklistTemplates"] = [
    { id: "checklist-quarterly-refrigeration-v1", organizationId: organization.id, name: "Quarterly refrigeration condition checklist", version: 1, items: [
      { key: "coil-condition", label: "Inspect and clean accessible condenser and evaporator coils", responseKind: "pass", required: true, evidenceRequired: true },
      { key: "discharge-temperature", label: "Record discharge temperature", responseKind: "measurement", required: true, measurementUnit: "°F", minimumValue: 30, maximumValue: 50 },
      { key: "door-seal", label: "Inspect door seal and closure", responseKind: "pass", required: true },
      { key: "deficiency", label: "Document any deficiency and required follow-up", responseKind: "text", required: true },
    ], status: "active", createdAt: atYear(2026, 1, 1) },
    { id: "checklist-spring-hvac-v1", organizationId: organization.id, name: "Spring rooftop-unit cooling checklist", version: 1, items: [
      { key: "filters-coils", label: "Inspect filters and accessible coils", responseKind: "pass", required: true, evidenceRequired: true },
      { key: "temperature-split", label: "Record supply and return temperature split", responseKind: "measurement", required: true, measurementUnit: "°F", minimumValue: 14, maximumValue: 24 },
      { key: "deficiency", label: "Document any cooling-readiness deficiency", responseKind: "text", required: true },
    ], status: "active", createdAt: atYear(2026, 1, 2) },
    { id: "checklist-fall-hvac-v1", organizationId: organization.id, name: "Fall rooftop-unit heating checklist", version: 1, items: [
      { key: "heat-operation", label: "Confirm heating operation and safety controls", responseKind: "pass", required: true, evidenceRequired: true },
      { key: "heat-exchanger", label: "Inspect accessible heat-exchanger surfaces", responseKind: "pass", required: true },
      { key: "deficiency", label: "Document any heating-readiness deficiency", responseKind: "text", required: true },
    ], status: "active", createdAt: atYear(2026, 1, 2) },
    { id: "checklist-foodservice-deep-clean-v1", organizationId: organization.id, name: "Foodservice equipment deep-clean checklist", version: 1, items: [
      { key: "cleaning", label: "Complete the manufacturer-safe deep-clean procedure", responseKind: "pass", required: true, evidenceRequired: true },
      { key: "airflow-door", label: "Inspect airflow paths and door condition", responseKind: "pass", required: true },
      { key: "deficiency", label: "Document any service recommendation", responseKind: "text", required: true },
    ], status: "active", createdAt: atYear(2026, 1, 3) },
    { id: "checklist-pest-monitoring-v1", organizationId: organization.id, name: "Store pest-control monitoring checklist", version: 1, items: [
      { key: "monitoring-points", label: "Inspect documented monitoring points", responseKind: "pass", required: true },
      { key: "activity", label: "Record observed activity or note none observed", responseKind: "text", required: true },
      { key: "recommendation", label: "Document any corrective recommendation", responseKind: "text", required: true },
    ], status: "active", createdAt: atYear(2026, 1, 3) },
  ];

  const addEquipmentProgramPlans = (input: {
    programId: string;
    planKey: string;
    templateKeys: string[];
    planName: string;
    cadenceDays: number;
    completionWindowDays: number;
    categoryKey: string;
    preferredVendorId?: string;
    backupVendorId?: string;
  }) => {
    const program = maintenancePrograms.find((candidate) => candidate.id === input.programId)!;
    assets.filter((asset) => input.templateKeys.includes(assetEquipmentTemplateKeys.get(asset.id) ?? "")).forEach((asset) => {
      const store = stores.find((candidate) => candidate.id === asset.storeId)!;
      pmPlans.push({ id: `pm-plan-${store.storeNumber}-${input.planKey}-${asset.assetTag.toLocaleLowerCase("en-US")}`, organizationId: organization.id, name: input.planName, programId: program.id, programVersion: program.version, storeId: store.id, assetId: asset.id, categoryKey: input.categoryKey, cadenceDays: input.cadenceDays, completionWindowDays: input.completionWindowDays, preferredVendorId: input.preferredVendorId, backupVendorId: input.backupVendorId, effectiveStartsAt: atYear(2026, 1, 1), programAuthorizationMinor: program.correctiveWorkAuthorityMinor, currency: "USD", schedulingMode: "platform_proposed_vendor_confirmed", escalationRules: "Escalate any occurrence that remains uncommitted when its due window opens.", active: true, createdAt: at(1, 6, 15) });
    });
  };
  addEquipmentProgramPlans({ programId: "maintenance-program-spring-hvac-v1", planKey: "spring-hvac", templateKeys: ["rtu-5ton", "rtu-3ton"], planName: "Spring HVAC cooling readiness", cadenceDays: 365, completionWindowDays: 14, categoryKey: "hvac", preferredVendorId: "vendor-northline-cedar", backupVendorId: "vendor-northline-brightpath" });
  addEquipmentProgramPlans({ programId: "maintenance-program-fall-hvac-v1", planKey: "fall-hvac", templateKeys: ["rtu-5ton", "rtu-3ton"], planName: "Fall HVAC heating readiness", cadenceDays: 365, completionWindowDays: 14, categoryKey: "hvac", preferredVendorId: "vendor-northline-cedar", backupVendorId: "vendor-northline-brightpath" });
  addEquipmentProgramPlans({ programId: "maintenance-program-foodservice-deep-clean-v1", planKey: "foodservice", templateKeys: ["rapid-cook-oven"], planName: "Foodservice equipment deep clean", cadenceDays: 180, completionWindowDays: 10, categoryKey: "foodservice", preferredVendorId: "vendor-northline-cedar" });
  stores.forEach((store) => pmPlans.push({ id: `pm-plan-${store.storeNumber}-pest-monitoring`, organizationId: organization.id, name: "Monthly pest-control monitoring", programId: "maintenance-program-pest-monitoring-v1", programVersion: 1, storeId: store.id, categoryKey: "store_sanitation", cadenceDays: 30, completionWindowDays: 5, effectiveStartsAt: atYear(2026, 1, 1), programAuthorizationMinor: 15_000, currency: "USD", schedulingMode: "vendor_planned", escalationRules: "Escalate if the monthly service window closes without documented completion.", active: true, createdAt: at(1, 6, 15) }));
  const pmWorkItems: OpsFixture["pmWorkItems"] = [];
  const checklistResponses: OpsFixture["checklistResponses"] = [];
  const serviceRuns: OpsFixture["serviceRuns"] = [];
  const routeStops: OpsFixture["routeStops"] = [];
  const serviceRunWorkOrders: OpsFixture["serviceRunWorkOrders"] = [];
  const serviceRunResponses: OpsFixture["serviceRunResponses"] = [];
  const vendorWarrantyProfiles: OpsFixture["vendorWarrantyProfiles"] = [];
  const warrantyRules: OpsFixture["warrantyRules"] = [];
  const warrantyCoverageLines: OpsFixture["warrantyCoverageLines"] = [];
  const repairItems: OpsFixture["repairItems"] = [];
  const appliedWarranties: OpsFixture["appliedWarranties"] = [];
  const warrantyAmendments: OpsFixture["warrantyAmendments"] = [];
  const manufacturerWarranties: OpsFixture["manufacturerWarranties"] = [];
  const warrantyCases: OpsFixture["warrantyCases"] = [];
  const quotes: OpsFixture["quotes"] = [];
  const authorizations: OpsFixture["authorizations"] = [];
  const invoices: OpsFixture["invoices"] = [];
  const invoiceLines: OpsFixture["invoiceLines"] = [];
  const invoiceLineAllocations: OpsFixture["invoiceLineAllocations"] = [];
  const invoiceExceptions: OpsFixture["invoiceExceptions"] = [];
  const invoiceAdjustments: OpsFixture["invoiceAdjustments"] = [];
  const serviceDiscrepancies: OpsFixture["serviceDiscrepancies"] = [];
  const valueEvents: OpsFixture["valueEvents"] = [];

  // Invoice review and spend reporting use different projections, but they
  // must describe the same source invoices. Seed the richer review projection
  // from every lightweight invoice reference so counts and drill-throughs do
  // not contradict one another. Unmatched references intentionally have no
  // invented line detail or allocation.
  invoiceReferences.forEach((reference) => {
    const allocation = invoiceAllocations.find((candidate) => candidate.invoiceReferenceId === reference.id);
    const workOrder = allocation ? workOrders.find((candidate) => candidate.id === allocation.workOrderId) : undefined;
    const needsReview = reference.matchStatus !== "confirmed";
    invoices.push({
      id: reference.id,
      organizationId: reference.organizationId,
      vendorId: reference.vendorId,
      vendorInvoiceNumber: reference.invoiceNumber,
      invoiceDate: reference.invoiceDate,
      subtotal: reference.grossAmount,
      tax: { amountMinor: 0, currency: reference.grossAmount.currency },
      fees: { amountMinor: 0, currency: reference.grossAmount.currency },
      total: reference.grossAmount,
      approvedForPayment: { amountMinor: 0, currency: reference.grossAmount.currency },
      paidAmount: { amountMinor: 0, currency: reference.grossAmount.currency },
      status: needsReview ? "exception" : "received",
      exceptionReason: needsReview
        ? reference.matchStatus === "unmatched"
          ? "No exact operator work-order reference was provided. A reviewer must identify the source work before allocating this invoice."
          : reference.matchStatus === "suggested"
            ? "A possible work-order match is available but has not been confirmed by a reviewer."
            : "The proposed match was rejected and the invoice remains unallocated."
        : undefined,
      createdAt: reference.createdAt,
    });
    if (allocation && workOrder) {
      const lineId = `invoice-line-reference-${reference.id}`;
      invoiceLines.push({ id: lineId, organizationId: reference.organizationId, invoiceId: reference.id, lineNumber: 1, category: "labor", description: "Imported invoice total; source line detail was not captured", quantityThousandths: 1_000, unitAmount: reference.grossAmount, lineAmount: reference.grossAmount, createdAt: reference.createdAt });
      invoiceLineAllocations.push({ id: `invoice-line-allocation-reference-${reference.id}`, organizationId: reference.organizationId, invoiceLineId: lineId, workOrderId: workOrder.id, assetId: workOrder.assetId, componentId: workOrder.componentId, storeId: workOrder.storeId, tradeKey: workOrder.categoryKey, amount: reference.grossAmount, method: "manual", confirmedByMembershipId: allocation.confirmedByMembershipId, confirmedAt: allocation.confirmedAt });
    }
    if (needsReview) {
      invoiceExceptions.push({ id: `invoice-exception-reference-${reference.id}`, organizationId: reference.organizationId, invoiceId: reference.id, kind: "allocation_mismatch", status: "open", summary: reference.matchStatus === "unmatched" ? "Invoice has no exact operator work-order reference." : reference.matchStatus === "suggested" ? "Suggested work-order match requires human confirmation." : "The prior match suggestion was rejected; select the correct source work.", amount: reference.grossAmount, detectedAt: reference.createdAt });
    }
  });
  const pmPeriods = [
    { key: "2025-q4", year: 2025, month: 11, linkWorkOrder: true },
    { key: "2026-q1", year: 2026, month: 2, linkWorkOrder: true },
    { key: "2026-q2", year: 2026, month: 5, linkWorkOrder: false },
    { key: "2026-q3", year: 2026, month: 8, linkWorkOrder: false },
    { key: "2026-q4", year: 2026, month: 11, linkWorkOrder: false },
  ] as const;
  pmPlans.filter((plan) => plan.programId === "maintenance-program-quarterly-refrigeration-v1").forEach((plan, storeIndex) => {
    const store = stores[storeIndex];
    const asset = assets.find((candidate) => candidate.id === plan.assetId)!;
    pmPeriods.forEach((period, periodIndex) => {
      const augustDay = storeIndex === 11 ? 15 : 20 + (storeIndex % 6);
      const due = store.storeNumber === "111" && period.key === "2026-q4"
        ? new Date(Date.UTC(2026, 9, 19, 12)).toISOString()
        : new Date(Date.UTC(period.year, period.month - 1, period.month === 8 ? augustDay : 14 + (storeIndex % 5), 12)).toISOString();
      const windowStartsAt = new Date(Date.parse(due) - 7 * 86_400_000).toISOString();
      const windowEndsAt = new Date(Date.parse(due) + 7 * 86_400_000).toISOString();
      const currentPeriod = period.key === "2026-q3";
      const status: PmOccurrence["status"] = period.key === "2026-q4"
        ? "scheduled"
        : currentPeriod
          ? storeIndex < 11
            ? "completed"
            : store.storeNumber === "115"
              ? "waived"
              : Date.parse(windowEndsAt) < Date.parse(NORTHLINE_AS_OF)
                ? "missed"
                : "due"
          : "completed";
      const calculatedCompletion = Date.parse(due) + ((storeIndex + periodIndex) % 3 - 1) * 86_400_000;
      const completedAt = status === "completed" ? new Date(Math.min(calculatedCompletion, Date.parse(NORTHLINE_AS_OF))).toISOString() : undefined;
      const occurrenceId = `pm-occurrence-${store.storeNumber}-${period.key}`;
      const workOrderId = period.linkWorkOrder ? `wo-pm-${store.storeNumber}-${period.key}` : undefined;
      pmOccurrences.push({ id: occurrenceId, organizationId: organization.id, planId: plan.id, storeId: store.id, assetId: plan.assetId, workOrderId, programId: plan.programId, programVersion: plan.programVersion, planVersion: 1, dueAt: due, windowStartsAt, windowEndsAt, status, completedAt, result: completedAt ? "Preventive service completed with checklist evidence" : status === "waived" ? "Waived by authorized operator" : undefined, exceptionReason: status === "waived" ? "Asset replacement is already approved" : status === "missed" ? "Vendor capacity was not committed inside the due window" : undefined, recurrenceKey: `${plan.id}:${period.key}`, createdAt: new Date(Date.parse(due) - 90 * 86_400_000).toISOString() });

      if (!workOrderId) return;
      const workOrderNumber = `CPS-${period.year}-PM-${store.storeNumber}-${periodIndex + 1}`;
      const createdAt = new Date(Date.parse(due) - 5 * 86_400_000).toISOString();
      const assignedAt = new Date(Date.parse(createdAt) + 30 * 60_000).toISOString();
      const issuedAt = new Date(Date.parse(assignedAt) + 15 * 60_000).toISOString();
      const visitStart = completedAt!;
      const visitEnd = new Date(Date.parse(visitStart) + (55 + storeIndex % 5 * 8) * 60_000).toISOString();
      const outsideVendorPm = store.storeNumber === "107";
      const internalMembershipId = storeIndex % 2 ? "membership-northline-tech-2" : "membership-northline-tech-1";
      const internalMember = memberships.find((membership) => membership.id === internalMembershipId)!;
      const internalUser = users.find((user) => user.id === internalMember.userId)!;
      const providerName = outsideVendorPm ? "ColdLine Refrigeration & HVAC" : "Clark Pump and Shop Maintenance";
      const technicianName = outsideVendorPm ? "Avery Chen" : internalUser.displayName;
      const assignmentId = `assignment-pm-${store.storeNumber}-${period.key}`;
      const issuanceId = `issuance-pm-${store.storeNumber}-${period.key}-r1`;
      const visitId = `visit-pm-${store.storeNumber}-${period.key}`;
      const problem = "Quarterly refrigeration inspection and documented operating check";
      const nte = { amountMinor: 45_000, currency: "USD" };
      workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: store.id, problem, authorizedScope: "Inspect the beer cave refrigeration system, clean accessible coils, record operating condition, and identify follow-up needs.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: plan.assetId, componentId: store.storeNumber === "104" && period.key === "2025-q4" ? "component-104-beer-cave-condensing-unit" : undefined, priority: "planned", status: "closed", accountableParty: providerName, nextAction: "No action required", nte, createdAt, closedAt: visitEnd });
      assignments.push(outsideVendorPm
        ? { id: assignmentId, organizationId: organization.id, workOrderId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "completed", assignedAt }
        : { id: assignmentId, organizationId: organization.id, workOrderId, kind: "internal", internalMembershipId, status: "completed", assignedAt });
      issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: outsideVendorPm ? { id: "vendor-northline-summit", name: providerName } : { id: internalMembershipId, name: providerName }, problem, priority: "planned", authorizedScope: "Inspect the beer cave refrigeration system, clean accessible coils, record operating condition, and identify follow-up needs.", categoryKey: "refrigeration", asset: { id: asset.id, name: asset.name, assetTag: asset.assetTag }, requestedTiming: due, nte, billingInstruction: `Reference operator work order ${workOrderNumber} on any related service paperwork.` }), channel: outsideVendorPm ? "email" : "manual", issuedAt });
      visits.push({ id: visitId, organizationId: organization.id, storeId: store.id, providerKind: outsideVendorPm ? "outside_vendor" : "internal", vendorId: outsideVendorPm ? "vendor-northline-summit" : undefined, internalMembershipId: outsideVendorPm ? undefined : internalMembershipId, workOrderId, technicianName, providerName, purpose: problem, status: "checked_out", startedChannel: outsideVendorPm ? "secure_link" : "store_device", endedChannel: "store_device", checkedInAt: visitStart, checkedOutAt: visitEnd, outcome: "pm_complete", outcomeNotes: "Inspection completed; temperatures, coil condition, and controller operation documented.", observedDurationSeconds: durationSeconds(visitStart, visitEnd) });
      visitEvidence.push(
        { id: `evidence-${visitId}-in`, organizationId: organization.id, visitId, kind: "check_in", channel: "store_device", observedAt: visitStart, location: { result: "trusted_store_device", capturedAt: visitStart }, payloadJson: JSON.stringify({ occurrenceId }) },
        { id: `evidence-${visitId}-out`, organizationId: organization.id, visitId, kind: "check_out", channel: "store_device", observedAt: visitEnd, location: { result: "trusted_store_device", capturedAt: visitEnd }, payloadJson: JSON.stringify({ outcome: "pm_complete", occurrenceId }) },
      );
      costLines.push({ id: `cost-pm-${store.storeNumber}-${period.key}`, organizationId: organization.id, workOrderId, kind: "labor", description: outsideVendorPm ? "Outside-vendor preventive-maintenance service" : "Internal preventive-maintenance labor", amount: { amountMinor: outsideVendorPm ? 42_500 : 18_500 + storeIndex * 250, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt: new Date(Date.parse(visitEnd) + 30 * 60_000).toISOString() });
      const workItemId = `pm-work-item-${store.storeNumber}-${period.key}-beer-cave`;
      pmWorkItems.push({ id: workItemId, organizationId: organization.id, occurrenceId, workOrderId, assetId: asset.id, requiredTask: "Inspect, clean, measure, and document the beer-cave refrigeration system", checklistTemplateId: "checklist-quarterly-refrigeration-v1", status: "completed", result: "Operating condition documented; no unresolved deficiency", costAllocationMinor: outsideVendorPm ? 42_500 : 18_500 + storeIndex * 250, currency: "USD", createdAt, completedAt: visitEnd });
      checklistResponses.push(
        { id: `${workItemId}-coil`, organizationId: organization.id, workItemId, checklistTemplateId: "checklist-quarterly-refrigeration-v1", itemKey: "coil-condition", responseKind: "pass", passed: true, evidenceFileIds: [], recordedByActorType: outsideVendorPm ? "technician" : "user", recordedByActorId: outsideVendorPm ? undefined : internalMembershipId, recordedByActorName: technicianName, recordedAt: visitEnd },
        { id: `${workItemId}-temp`, organizationId: organization.id, workItemId, checklistTemplateId: "checklist-quarterly-refrigeration-v1", itemKey: "discharge-temperature", responseKind: "measurement", numericValue: 37 + storeIndex % 4, measurementUnit: "°F", evidenceFileIds: [], recordedByActorType: outsideVendorPm ? "technician" : "user", recordedByActorId: outsideVendorPm ? undefined : internalMembershipId, recordedByActorName: technicianName, recordedAt: visitEnd },
        { id: `${workItemId}-door`, organizationId: organization.id, workItemId, checklistTemplateId: "checklist-quarterly-refrigeration-v1", itemKey: "door-seal", responseKind: "pass", passed: true, evidenceFileIds: [], recordedByActorType: outsideVendorPm ? "technician" : "user", recordedByActorId: outsideVendorPm ? undefined : internalMembershipId, recordedByActorName: technicianName, recordedAt: visitEnd },
        { id: `${workItemId}-deficiency`, organizationId: organization.id, workItemId, checklistTemplateId: "checklist-quarterly-refrigeration-v1", itemKey: "deficiency", responseKind: "text", textValue: "No unresolved deficiency observed.", evidenceFileIds: [], recordedByActorType: outsideVendorPm ? "technician" : "user", recordedByActorId: outsideVendorPm ? undefined : internalMembershipId, recordedByActorName: technicianName, recordedAt: visitEnd },
      );
    });
  });
  const addProgramOccurrence = (input: {
    plan: PmPlan;
    key: string;
    dueAt: string;
    status: PmOccurrence["status"];
    completedAt?: string;
    exceptionReason?: string;
  }) => {
    const windowStartsAt = new Date(Date.parse(input.dueAt) - input.plan.completionWindowDays * 86_400_000).toISOString();
    const windowEndsAt = new Date(Date.parse(input.dueAt) + input.plan.completionWindowDays * 86_400_000).toISOString();
    pmOccurrences.push({ id: `pm-occurrence-${input.plan.id.replace(/^pm-plan-/, "")}-${input.key}`, organizationId: organization.id, planId: input.plan.id, storeId: input.plan.storeId!, assetId: input.plan.assetId, programId: input.plan.programId, programVersion: input.plan.programVersion, planVersion: 1, dueAt: input.dueAt, windowStartsAt, windowEndsAt, status: input.status, completedAt: input.completedAt, result: input.completedAt ? "Program checklist completion recorded" : undefined, exceptionReason: input.exceptionReason, recurrenceKey: `${input.plan.id}:${input.key}`, createdAt: new Date(Date.parse(input.dueAt) - input.plan.cadenceDays * 86_400_000).toISOString() });
  };

  const newProgramPlans = pmPlans.filter((plan) => plan.programId !== "maintenance-program-quarterly-refrigeration-v1");
  const programPlanIndexes = new Map<string, number>();
  newProgramPlans.forEach((plan) => {
    const program = maintenancePrograms.find((candidate) => candidate.id === plan.programId)!;
    const index = programPlanIndexes.get(program.id) ?? 0;
    programPlanIndexes.set(program.id, index + 1);
    if (program.id === "maintenance-program-spring-hvac-v1") {
      const dueAt = atYear(2026, 4, 10 + (index % 10), 12);
      const missed = index === 3 || index === 17;
      addProgramOccurrence({ plan, key: "2026-spring", dueAt, status: missed ? "missed" : "completed", completedAt: missed ? undefined : new Date(Date.parse(dueAt) + ((index % 3) - 1) * 86_400_000).toISOString(), exceptionReason: missed ? "Cooling-readiness service was not documented before the seasonal window closed." : undefined });
      addProgramOccurrence({ plan, key: "2027-spring", dueAt: atYear(2027, 4, 10 + (index % 10), 12), status: "scheduled" });
    } else if (program.id === "maintenance-program-fall-hvac-v1") {
      const dueAt = atYear(2025, 10, 10 + (index % 10), 12);
      const missed = index === 8;
      addProgramOccurrence({ plan, key: "2025-fall", dueAt, status: missed ? "missed" : "completed", completedAt: missed ? undefined : new Date(Date.parse(dueAt) + ((index % 3) - 1) * 86_400_000).toISOString(), exceptionReason: missed ? "Heating-readiness service was not documented before the seasonal window closed." : undefined });
      addProgramOccurrence({ plan, key: "2026-fall", dueAt: atYear(2026, 10, 10 + (index % 10), 12), status: "scheduled" });
    } else if (program.id === "maintenance-program-foodservice-deep-clean-v1") {
      const dueAt = index === 0 ? atYear(2026, 8, 10, 12) : atYear(2026, 8, 28 + (index % 2), 12);
      const missed = index === 0;
      const due = index > 0 && index < 4;
      addProgramOccurrence({ plan, key: "2026-h2", dueAt, status: missed ? "missed" : due ? "due" : "completed", completedAt: missed || due ? undefined : at(8, 24, 12), exceptionReason: missed ? "The foodservice deep-clean window closed without recorded completion." : undefined });
      addProgramOccurrence({ plan, key: "2027-h1", dueAt: atYear(2027, 2, 15 + (index % 5), 12), status: "scheduled" });
    } else {
      const dueAt = index < 2 ? at(8, 15, 12) : index === 8 ? at(8, 28, 12) : at(8, 22, 12);
      const missed = index < 2;
      const due = index === 8;
      addProgramOccurrence({ plan, key: "2026-08", dueAt, status: missed ? "missed" : due ? "due" : "completed", completedAt: missed || due ? undefined : at(8, 22, 10 + (index % 5)), exceptionReason: missed ? "Monthly pest-control monitoring has no documented completion inside the August service window." : undefined });
      addProgramOccurrence({ plan, key: "2026-09", dueAt: at(9, 22 + (index % 5), 12), status: "scheduled" });
    }
  });

  // Store 107 carries a deliberately reviewable PM billing story. Four exact
  // PM work orders and invoices exist, while only the first two have observed
  // vendor check-in/check-out evidence. The gap is a reconciliation fact—not
  // proof that the undocumented visits did not happen.
  const pm107Periods = ["2025-q4", "2026-q1", "2026-q2", "2026-q3"] as const;
  const pm107Unobserved = new Set(["2026-q2", "2026-q3"]);
  const pm107Plan = pmPlans.find((plan) => plan.id === "pm-plan-107-refrigeration")!;
  const pm107Store = stores.find((store) => store.storeNumber === "107")!;
  const pm107Asset = assets.find((asset) => asset.id === pm107Plan.assetId)!;
  pm107Periods.filter((period) => pm107Unobserved.has(period)).forEach((period, index) => {
    const occurrence = pmOccurrences.find((candidate) => candidate.planId === pm107Plan.id && candidate.recurrenceKey === `${pm107Plan.id}:${period}`)!;
    const workOrderId = `wo-pm-107-${period}`;
    const workOrderNumber = `CPS-2026-PM-107-${index + 3}`;
    const completedAt = occurrence.completedAt!;
    const createdAt = new Date(Date.parse(occurrence.dueAt) - 5 * 86_400_000).toISOString();
    const assignedAt = new Date(Date.parse(createdAt) + 30 * 60_000).toISOString();
    const issuanceId = `issuance-pm-107-${period}-r1`;
    const assignmentId = `assignment-pm-107-${period}`;
    occurrence.workOrderId = workOrderId;
    workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: pm107Store.id, problem: "Quarterly refrigeration inspection and documented operating check", authorizedScope: "Inspect the beer cave refrigeration system, clean accessible coils, record operating condition, and identify follow-up needs.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: pm107Asset.id, priority: "planned", status: "closed", accountableParty: "ColdLine Refrigeration & HVAC", nextAction: "No action required", nte: { amountMinor: 45_000, currency: "USD" }, createdAt, closedAt: completedAt });
    assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "completed", assignedAt });
    issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber, store: { id: pm107Store.id, storeNumber: pm107Store.storeNumber, name: pm107Store.name, formattedAddress: [pm107Store.address1, `${pm107Store.city}, ${pm107Store.state} ${pm107Store.postalCode}`].join(", ") }, vendor: { id: "vendor-northline-summit", name: "ColdLine Refrigeration & HVAC" }, problem: "Quarterly refrigeration inspection and documented operating check", priority: "planned", authorizedScope: "Inspect the beer cave refrigeration system, clean accessible coils, record operating condition, and identify follow-up needs.", categoryKey: "refrigeration", asset: { id: pm107Asset.id, name: pm107Asset.name, assetTag: pm107Asset.assetTag }, requestedTiming: occurrence.dueAt, nte: { amountMinor: 45_000, currency: "USD" }, billingInstruction: `Reference operator work order ${workOrderNumber} on any related service paperwork.` }), channel: "email", issuedAt: new Date(Date.parse(assignedAt) + 15 * 60_000).toISOString() });
    const workItemId = `pm-work-item-107-${period}-beer-cave`;
    pmWorkItems.push({ id: workItemId, organizationId: organization.id, occurrenceId: occurrence.id, workOrderId, assetId: pm107Asset.id, requiredTask: "Inspect, clean, measure, and document the beer-cave refrigeration system", checklistTemplateId: "checklist-quarterly-refrigeration-v1", status: "completed", result: "Vendor-submitted checklist was recorded; platform visit evidence was not found", costAllocationMinor: 42_500, currency: "USD", createdAt, completedAt });
    checklistResponses.push({ id: `${workItemId}-deficiency`, organizationId: organization.id, workItemId, checklistTemplateId: "checklist-quarterly-refrigeration-v1", itemKey: "deficiency", responseKind: "text", textValue: "Vendor service paperwork reported no unresolved deficiency.", evidenceFileIds: [], recordedByActorType: "user", recordedByActorId: "membership-northline-facilities", recordedByActorName: "Jordan Lee", recordedAt: completedAt });
  });

  const pm107InvoiceIds: string[] = [];
  const pm107ObservedVisitIds: string[] = [];
  const pm107MissingOccurrenceIds: string[] = [];
  pm107Periods.forEach((period) => {
    const occurrence = pmOccurrences.find((candidate) => candidate.planId === pm107Plan.id && candidate.recurrenceKey === `${pm107Plan.id}:${period}`)!;
    const workOrder = workOrders.find((candidate) => candidate.id === occurrence.workOrderId)!;
    const invoiceId = `invoice-summit-107-pm-${period}`;
    const lineId = `invoice-line-summit-107-pm-${period}`;
    const visit = visits.find((candidate) => candidate.workOrderId === workOrder.id && candidate.vendorId === "vendor-northline-summit");
    const invoiceDate = new Date(Date.parse(occurrence.completedAt!) + 86_400_000).toISOString().slice(0, 10);
    const createdAt = `${invoiceDate}T14:00:00.000Z`;
    const amount = { amountMinor: 42_500, currency: "USD" } as const;
    pm107InvoiceIds.push(invoiceId);
    if (visit) pm107ObservedVisitIds.push(visit.id); else pm107MissingOccurrenceIds.push(occurrence.id);
    invoiceReferences.push({ id: invoiceId, organizationId: organization.id, vendorId: "vendor-northline-summit", invoiceNumber: `SUM-PM-107-${period.toLocaleUpperCase("en-US")}`, invoiceDate, grossAmount: amount, operatorWorkOrderNumber: workOrder.number, matchStatus: "confirmed", createdAt });
    invoiceAllocations.push({ id: `invoice-reference-allocation-${invoiceId}`, organizationId: organization.id, invoiceReferenceId: invoiceId, workOrderId: workOrder.id, amount, confirmedByMembershipId: "membership-northline-finance", confirmedAt: createdAt });
    invoices.push({ id: invoiceId, organizationId: organization.id, vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", vendorInvoiceNumber: `SUM-PM-107-${period.toLocaleUpperCase("en-US")}`, invoiceDate, subtotal: amount, tax: { amountMinor: 0, currency: "USD" }, fees: { amountMinor: 0, currency: "USD" }, total: amount, approvedForPayment: { amountMinor: 0, currency: "USD" }, paidAmount: { amountMinor: 0, currency: "USD" }, status: "received", createdAt });
    invoiceLines.push({ id: lineId, organizationId: organization.id, invoiceId, lineNumber: 1, category: "labor", description: `Quarterly refrigeration preventive service · ${period.toLocaleUpperCase("en-US")}`, quantityThousandths: 1_000, unitAmount: amount, lineAmount: amount, contractRateCardLineId: "rate-summit-pm", createdAt });
    invoiceLineAllocations.push({ id: `allocation-${lineId}`, organizationId: organization.id, invoiceLineId: lineId, workOrderId: workOrder.id, workItemId: pmWorkItems.find((item) => item.occurrenceId === occurrence.id)?.id, siteVisitWorkOrderId: visit ? `site-visit-work-${visit.id}-${workOrder.id}` : undefined, assetId: pm107Asset.id, storeId: pm107Store.id, tradeKey: "refrigeration", amount, method: "manual", confirmedByMembershipId: "membership-northline-finance", confirmedAt: createdAt });
  });
  serviceDiscrepancies.push({ id: "service-discrepancy-pm-107-observed-visits", organizationId: organization.id, workOrderId: "wo-pm-107-2026-q3", invoiceId: "invoice-summit-107-pm-2026-q3", discrepancyType: "evidence", status: "open", factsJson: JSON.stringify({ reconciliationKind: "pm_billed_vs_observed", programId: pm107Plan.programId, storeId: pm107Store.id, periodLabel: "Q4 2025 through Q3 2026", billedServiceUnits: 4, billedInvoiceIds: pm107InvoiceIds, invoicedAmountMinor: 170_000, observedVisitCount: pm107ObservedVisitIds.length, observedVisitIds: pm107ObservedVisitIds, missingOccurrenceIds: pm107MissingOccurrenceIds, reviewAmountMinor: pm107MissingOccurrenceIds.length * 42_500, determination: "review_only", note: "No platform visit evidence found does not prove service was not performed." }), createdAt: at(8, 26, 9) });

  exceptions.push(
    { id: "exception-northline-112-overdue-pm", organizationId: organization.id, kind: "overdue_pm", storeId: "store-northline-112", severity: "attention", status: "open", summary: "Quarterly refrigeration inspection is outside its completion window", detectedAt: NORTHLINE_AS_OF },
    { id: "exception-northline-113-overdue-pm", organizationId: organization.id, kind: "overdue_pm", storeId: "store-northline-113", severity: "attention", status: "open", summary: "Quarterly refrigeration inspection is outside its completion window", detectedAt: NORTHLINE_AS_OF },
  );

  const currentUnmatchedInvoice = invoiceReferences.find((invoice) => invoice.id === "invoice-northline-109");
  if (currentUnmatchedInvoice) {
    exceptions.push({ id: "exception-invoice-northline-109-unmatched", organizationId: organization.id, kind: "unmatched_invoice", storeId: "store-northline-109", vendorId: currentUnmatchedInvoice.vendorId, severity: "attention", status: "open", summary: "Forecourt invoice does not include an operator work-order reference", detectedAt: currentUnmatchedInvoice.createdAt });
  }

  // Approval evidence is intentionally mixed across a store issue and
  // canonical work orders. Requests and decisions are immutable snapshots;
  // the current state below is derived from the appended decision ledger.
  approvalRequests.push(
    { id: "approval-request-101-pending", organizationId: organization.id, subjectType: "service_request", subjectId: "request-current-101-freezer-door", storeId: "store-northline-101", categoryKey: "refrigeration", amount: { amountMinor: 65_000, currency: "USD" }, policyId: "approval-policy-store-routine-v1", policyKey: "store-routine", policyVersion: 1, policyName: "Routine store authorization", policyScopeKind: "organization", policyScopeId: organization.id, requiredRole: "store_manager", escalationRole: "regional_manager", requestedByMembershipId: "membership-northline-facilities", requestedByName: "Jordan Lee", reason: "Authorize a door-adjustment diagnostic allowance before work-order creation", requestedAt: at(8, 10, 15, 20), dueAt: at(8, 11, 15, 20) },
    { id: "approval-request-104-pending", organizationId: organization.id, subjectType: "service_request", subjectId: "request-current-104-beer-cave-door", storeId: "store-northline-104", categoryKey: "refrigeration", amount: { amountMinor: 65_000, currency: "USD" }, policyId: "approval-policy-store-routine-v1", policyKey: "store-routine", policyVersion: 1, policyName: "Routine store authorization", policyScopeKind: "organization", policyScopeId: organization.id, requiredRole: "store_manager", escalationRole: "regional_manager", requestedByMembershipId: "membership-northline-facilities", requestedByName: "Jordan Lee", reason: "Authorize a door-alignment diagnostic allowance before work-order creation", requestedAt: at(8, 10, 15, 55), dueAt: at(8, 11, 15, 55) },
    { id: "approval-request-106-escalated", organizationId: organization.id, subjectType: "service_request", subjectId: "request-current-106-ceiling-stain", storeId: "store-northline-106", categoryKey: "exterior", amount: { amountMinor: 180_000, currency: "USD" }, policyId: "approval-policy-regional-service-v1", policyKey: "regional-service", policyVersion: 1, policyName: "Regional service authorization", policyScopeKind: "organization", policyScopeId: organization.id, requiredRole: "regional_manager", escalationRole: "facilities_admin", requestedByMembershipId: "membership-northline-facilities", requestedByName: "Jordan Lee", reason: "Authorize investigation above the stockroom ceiling", requestedAt: at(8, 10, 13, 50), dueAt: at(8, 11, 13, 50) },
    { id: "approval-request-106-facilities-pending", organizationId: organization.id, subjectType: "service_request", subjectId: "request-current-106-ceiling-stain", storeId: "store-northline-106", categoryKey: "exterior", amount: { amountMinor: 180_000, currency: "USD" }, policyId: "approval-policy-regional-service-v1", policyKey: "regional-service", policyVersion: 1, policyName: "Regional service authorization", policyScopeKind: "organization", policyScopeId: organization.id, requiredRole: "facilities_admin", requestedByMembershipId: "membership-northline-regional-2", requestedByName: "Morgan Hayes", reason: "Escalated from Regional manager: possible roof penetration needs facilities review", requestedAt: at(8, 10, 14, 30), dueAt: at(8, 11, 14, 30), parentApprovalRequestId: "approval-request-106-escalated" },
    { id: "approval-request-115-approved", organizationId: organization.id, subjectType: "work_order", subjectId: "wo-northline-115", storeId: "store-northline-115", categoryKey: "refrigeration", amount: { amountMinor: 3_280_000, currency: "USD" }, policyId: "approval-policy-refrigeration-capital-v1", policyKey: "refrigeration-capital", policyVersion: 1, policyName: "Refrigeration capital authorization", policyScopeKind: "organization", policyScopeId: organization.id, requiredRole: "executive", requestedByMembershipId: "membership-northline-facilities", requestedByName: "Jordan Lee", reason: "Selected beer-cave replacement quote requires capital authorization", requestedAt: at(8, 9, 12, 30), dueAt: at(8, 10, 12, 30) },
  );
  approvalDecisions.push(
    { id: "approval-decision-106-escalated", organizationId: organization.id, approvalRequestId: "approval-request-106-escalated", decision: "escalated", decidedByMembershipId: "membership-northline-regional-2", decidedByName: "Morgan Hayes", decidedByRole: "regional_manager", reason: "Possible roof penetration needs facilities review before authorizing access", escalatedToRole: "facilities_admin", decidedAt: at(8, 10, 14, 30) },
    { id: "approval-decision-115-approved", organizationId: organization.id, approvalRequestId: "approval-request-115-approved", decision: "approved", decidedByMembershipId: "membership-northline-executive", decidedByName: "Alex Morgan", decidedByRole: "executive", reason: "Approved against the selected ColdLine quote and current capital plan", decidedAt: at(8, 9, 13, 50) },
  );

  // Store 112 preserves a complete rejected verification cycle before the
  // currently active return visit. The original visit and outcome stay intact.
  const rejectedVisitId = "visit-northline-112-rejected-1";
  visits.push({
    id: rejectedVisitId, organizationId: organization.id, storeId: "store-northline-112", providerKind: "outside_vendor",
    vendorId: "vendor-northline-cedar", workOrderId: "wo-northline-112", technicianName: "Sam Patel", crewCount: 1,
    providerName: "ClearFlow HVAC, Plumbing & Kitchen Repair", purpose: "Restore rooftop-unit cooling and confirm stable discharge temperature",
    status: "checked_out", startedChannel: "secure_link", endedChannel: "store_device", checkedInAt: at(8, 9, 16, 30), checkedOutAt: at(8, 9, 18),
    outcome: "resolved", outcomeNotes: "Replaced the failed contactor and recorded normal operation before departure.", observedDurationSeconds: 5_400,
  });
  visitEvidence.push(
    { id: `evidence-${rejectedVisitId}-in`, organizationId: organization.id, visitId: rejectedVisitId, kind: "check_in", channel: "secure_link", observedAt: at(8, 9, 16, 30), location: { result: "verified", accuracyM: 18, distanceM: 22, capturedAt: at(8, 9, 16, 30) }, payloadJson: JSON.stringify({ workOrderNumber: "CPS-2026-0112" }) },
    { id: `evidence-${rejectedVisitId}-out`, organizationId: organization.id, visitId: rejectedVisitId, kind: "check_out", channel: "store_device", observedAt: at(8, 9, 18), location: { result: "trusted_store_device", capturedAt: at(8, 9, 18) }, payloadJson: JSON.stringify({ outcome: "resolved" }) },
  );

  // Workflow tasks are the durable source for accountable next actions. The
  // legacy fields on work orders intentionally mirror the deterministic
  // primary task so the compatibility presenter remains truthful while it is
  // migrated to task-native reads.
  const taskPriority = (priority: WorkOrder["priority"]): WorkflowTask["priority"] => ({ emergency: "critical", urgent: "high", routine: "normal", planned: "low" })[priority] as WorkflowTask["priority"];
  const taskType = (workOrder: WorkOrder, followUp?: FollowUp): WorkflowTask["taskType"] => {
    if (followUp) return /review|confirm|verify/i.test(followUp.nextAction) ? "verify_repair" : "schedule_return_visit";
    if (workOrder.status === "awaiting_approval") return "approve_quote";
    if (workOrder.status === "approved") return "choose_service_provider";
    if (workOrder.status === "issued") return "vendor_response_required";
    if (workOrder.status === "accepted" || workOrder.status === "scheduled") return "confirm_store_access";
    if (workOrder.status === "in_progress") return "record_service_outcome";
    if (workOrder.status === "completed_pending_review") return "verify_repair";
    return "schedule_return_visit";
  };
  const slaClock = (type: WorkflowTask["taskType"]): WorkflowTask["applicableSlaClock"] => ({
    review_issue: "intake_review", approve_quote: "approval", vendor_response_required: "vendor_response",
    confirm_store_access: "scheduling", submit_quote: "vendor_response", choose_service_provider: "scheduling",
    schedule_service: "scheduling", record_service_outcome: "completion", schedule_return_visit: "scheduling",
    verify_repair: "verification", close_verified_work: "verification", review_warranty: "warranty_response", resolve_invoice_exception: "invoice_submission",
    respond_service_discrepancy: "service_discrepancy_response", other: "completion",
  })[type] as WorkflowTask["applicableSlaClock"];

  requests.forEach((request) => {
    const initial = requestImpactAssessments.find((assessment) => assessment.requestId === request.id && assessment.assessmentKind === "initial_report")!;
    const latest = requestImpactAssessments.filter((assessment) => assessment.requestId === request.id).at(-1)!;
    const status: WorkflowTask["status"] = request.status === "submitted" ? "open" : request.status === "under_review" ? "in_progress" : "completed";
    const dueHours = ({ emergency: 1, urgent: 4, routine: 24, planned: 72 } as const)[request.priority];
    workflowTasks.push({
      id: `workflow-task-${request.id}-review`, organizationId: request.organizationId, serviceRequestId: request.id,
      taskType: "review_issue", title: `Review ${request.reference} business impact`, reason: `Assess the reported operating impact before authorizing work: ${request.problem}`,
      assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities review", priority: taskPriority(request.priority), status,
      blocking: true, requiredForProgress: true, dueAt: new Date(Date.parse(request.submittedAt) + dueHours * 60 * 60_000).toISOString(), applicableSlaClock: "intake_review",
      completionCriteria: "Business impact is confirmed or revised and the issue is ready for an approval or work-order decision",
      escalationDestination: request.priority === "emergency" ? "Regional maintenance leader" : "Facilities director", escalationLevel: 0,
      createdByActorType: "user", createdByActorId: request.reporterEmployeeId, createdByActorName: request.reporterName, createdAt: initial.assessedAt,
      ...(status !== "open" ? { startedByActorType: "user" as const, startedByActorId: "membership-northline-facilities", startedByActorName: "Jordan Lee", startedAt: latest.assessedAt } : {}),
      ...(status === "completed" ? { completedByActorType: "user" as const, completedByActorId: "membership-northline-facilities", completedByActorName: "Jordan Lee", completedAt: latest.assessedAt, resolutionNote: request.status === "converted" ? "Impact reviewed and converted to the canonical work order" : "Impact reviewed; no work order required" } : {}),
    });
  });

  // Sales-demo Service Run: one reactive repair at Store 104 plus one immutable
  // PM obligation at Store 105. The recommendation is still awaiting a real
  // Vendor link response, so the guided demo can accept or counter it without
  // editing seed data.
  const serviceRunId = "service-run-summit-north-2026-08-24";
  const serviceRunReactiveWorkId = "wo-service-run-104-reactive";
  const serviceRunPmWorkId = "wo-service-run-105-pm";
  const serviceRunOccurrenceId = "pm-occurrence-105-service-run-2026-08";
  const serviceRunCreatedAt = at(8, 10, 16);
  workOrders.push(
    { id: serviceRunReactiveWorkId, organizationId: organization.id, number: "CPS-2026-0118", storeId: "store-northline-104", problem: "Beer-cave door is icing along the lower hinge and needs an approved seal adjustment", authorizedScope: "Inspect the hinge and seal, correct alignment, and document any part requirement or additional recommended work.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: "asset-104-beer-cave", priority: "routine", status: "accepted", version: 0, accountableParty: "ColdLine Refrigeration & HVAC", nextAction: "Respond to proposed Service Run", dueAt: at(8, 28, 16), escalationTo: "Facilities coordinator", nte: { amountMinor: 75_000, currency: "USD" }, createdAt: at(8, 10, 14) },
    { id: serviceRunPmWorkId, organizationId: organization.id, number: "CPS-2026-PM-105-5", storeId: "store-northline-105", problem: "Complete the quarterly refrigeration preventive-maintenance occurrence and asset checklist", authorizedScope: "Inspect, clean, measure, and document the Store 105 beer-cave refrigeration system under the approved PM Program.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: "asset-105-beer-cave", priority: "planned", status: "accepted", version: 0, accountableParty: "ColdLine Refrigeration & HVAC", nextAction: "Respond to proposed Service Run", dueAt: at(8, 28, 16), escalationTo: "Facilities coordinator", nte: { amountMinor: 50_000, currency: "USD" }, createdAt: at(8, 10, 14, 5) },
  );
  assignments.push(
    { id: "assignment-service-run-104", organizationId: organization.id, workOrderId: serviceRunReactiveWorkId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "accepted", assignedAt: at(8, 10, 14, 20) },
    { id: "assignment-service-run-105", organizationId: organization.id, workOrderId: serviceRunPmWorkId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "accepted", assignedAt: at(8, 10, 14, 25) },
  );
  pmOccurrences.push({ id: serviceRunOccurrenceId, organizationId: organization.id, planId: "pm-plan-105-refrigeration", storeId: "store-northline-105", assetId: "asset-105-beer-cave", workOrderId: serviceRunPmWorkId, programId: "maintenance-program-quarterly-refrigeration-v1", programVersion: 1, planVersion: 1, dueAt: at(8, 25, 12), windowStartsAt: at(8, 18, 12), windowEndsAt: at(9, 1, 12), proposedAt: at(8, 30, 13), status: "proposed", recurrenceKey: "pm-plan-105-refrigeration:2026-service-run-demo", createdAt: at(5, 27, 12) });
  pmWorkItems.push({ id: "pm-work-item-105-service-run-beer-cave", organizationId: organization.id, occurrenceId: serviceRunOccurrenceId, workOrderId: serviceRunPmWorkId, assetId: "asset-105-beer-cave", requiredTask: "Complete the full quarterly refrigeration checklist and capture required evidence", checklistTemplateId: "checklist-quarterly-refrigeration-v1", status: "pending", currency: "USD", createdAt: at(8, 10, 14, 5) });
  serviceRuns.push({ id: serviceRunId, organizationId: organization.id, vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", schedulingMode: "platform_proposed_vendor_confirmed", status: "proposed", proposedStartsAt: at(8, 30, 13), proposedEndsAt: at(8, 30, 17), responseDueAt: at(8, 28, 16), estimatedDriveMinutes: 66, estimatedServiceMinutes: 174, capacityUsedMinutes: 240, expectedWorkValue: { amountMinor: 125_000, currency: "USD" }, estimatedTripReduction: 1, estimatedOpportunity: { amountMinor: 11_250, currency: "USD" }, recommendationExplanation: "Combines one accepted reactive repair at Store 104 with the Store 105 PM obligation; stays inside the PM due window; uses ColdLine under the active refrigeration Contract Version; validates current insurance, license, EPA qualification, and North-region coverage; protects 65 minutes of stop, travel, documentation, and uncertainty buffer; consumes 240 of 420 protected crew minutes; and may avoid one separate truck roll and trip charge.", requiredQualifications: ["refrigeration:pm", "refrigeration:reactive", "equipment:refrigerant-recovery"], constraintsJson: JSON.stringify({ contractScope: true, geographicCoverage: true, qualifications: true, compliance: true, dueWindows: true, access: true, authorization: true, capacity: true, equipment: true, maximumUtilizationBps: 8000, buffers: { stopBufferMinutes: 30, travelBufferMinutes: 11, documentationMinutes: 20, uncertaintyMinutes: 4 } }), confidence: "medium", schedulerVersion: "directive-11.8-v1", originalRecommendationJson: JSON.stringify({ vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", proposedStartsAt: at(8, 30, 13), proposedEndsAt: at(8, 30, 17), stops: [{ storeId: "store-northline-104", sequence: 1, proposedArrivalAt: at(8, 30, 13, 30) }, { storeId: "store-northline-105", sequence: 2, proposedArrivalAt: at(8, 30, 15, 20) }], workOrders: [{ workOrderId: serviceRunReactiveWorkId, estimatedDurationMinutes: 60 }, { workOrderId: serviceRunPmWorkId, occurrenceId: serviceRunOccurrenceId, estimatedDurationMinutes: 90 }], expectedWorkValueMinor: 125_000, estimatedOpportunityMinor: 11_250, estimatedTripReduction: 1 }), createdByActorType: "user", createdByActorId: "membership-northline-facilities", createdByActorName: "Jordan Lee", createdAt: serviceRunCreatedAt });
  routeStops.push(
    { id: "route-stop-service-run-104", organizationId: organization.id, serviceRunId, storeId: "store-northline-104", sequence: 1, proposedArrivalAt: at(8, 30, 13, 30), estimatedDriveMinutes: 30, estimatedServiceMinutes: 85, accessRequirements: "Meet the Store 104 manager at the rear service entrance.", status: "planned" },
    { id: "route-stop-service-run-105", organizationId: organization.id, serviceRunId, storeId: "store-northline-105", sequence: 2, proposedArrivalAt: at(8, 30, 15, 20), estimatedDriveMinutes: 25, estimatedServiceMinutes: 115, accessRequirements: "Check in with the Store 105 manager and use the equipment-room access key.", status: "planned" },
  );
  serviceRunWorkOrders.push(
    { id: "service-run-work-104", organizationId: organization.id, serviceRunId, routeStopId: "route-stop-service-run-104", workOrderId: serviceRunReactiveWorkId, planned: true, estimatedDurationMinutes: 60, addressed: false },
    { id: "service-run-work-105", organizationId: organization.id, serviceRunId, routeStopId: "route-stop-service-run-105", workOrderId: serviceRunPmWorkId, occurrenceId: serviceRunOccurrenceId, planned: true, estimatedDurationMinutes: 90, addressed: false },
  );
  auditEvents.push({ id: "audit-service-run-summit-proposed", organizationId: organization.id, aggregateType: "service_run", aggregateId: serviceRunId, eventType: "service_run.proposed", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: serviceRunCreatedAt, payloadJson: JSON.stringify({ vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", workOrderIds: [serviceRunReactiveWorkId, serviceRunPmWorkId], estimatedTripReduction: 1, estimatedOpportunity: { amountMinor: 11_250, currency: "USD" }, estimatedValueCategory: "estimated_opportunity" }) });

  // Warranty + financial-control demo story. The original compressor repair
  // creates category-specific immutable coverage snapshots. A later exact
  // component callback is only flagged as potential coverage pending
  // diagnosis; it routes to the obligated Vendor and holds customer billing.
  const warrantyRepairItemId = "repair-item-104-compressor-2026-07";
  const warrantyCaseId = "warranty-case-104-compressor-callback";
  const warrantyCallbackWorkId = "wo-warranty-104-compressor-callback";
  const warrantyCallbackRequestId = "request-warranty-104-compressor-callback";
  const priorVisitWorkId = "site-visit-work-visit-northline-104-2-wo-northline-104";
  vendorWarrantyProfiles.push({ id: "warranty-profile-summit-v1", organizationId: organization.id, vendorId: "vendor-northline-summit", baseLaborDays: 90, basePartsDays: 365, baseTravelDays: 30, baseDiagnosticDays: 90, effectiveStartsAt: atYear(2026, 1, 1), effectiveEndsAt: atYear(2026, 12, 31, 23), status: "active", createdAt: atYear(2026, 1, 1) });
  warrantyRules.push({ id: "warranty-rule-summit-compressor-v1", organizationId: organization.id, vendorWarrantyProfileId: "warranty-profile-summit-v1", vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", tradeKey: "refrigeration", workType: "reactive_repair", serviceType: "compressor_replacement", assetType: "beer_cave", componentType: "compressor", manufacturer: "Copeland", vendorSuppliedPart: true, regionId: "region-northline-north", priority: 3, effectiveStartsAt: atYear(2026, 1, 1), effectiveEndsAt: atYear(2026, 12, 31, 23), status: "active", createdAt: atYear(2026, 1, 1) });
  warrantyCoverageLines.push(
    { id: "warranty-line-summit-compressor-labor", organizationId: organization.id, warrantyRuleId: "warranty-rule-summit-compressor-v1", coverageType: "labor", duration: 90, durationUnit: "days", startEvent: "store_verification", provider: "vendor", obligatedVendorId: "vendor-northline-summit", routingRule: "original_vendor_first_right_to_cure", deductible: { amountMinor: 0, currency: "USD" }, conditions: "Related compressor workmanship after verified completion", exclusions: "Damage caused by power-quality events or unauthorized alteration" },
    { id: "warranty-line-summit-compressor-part", organizationId: organization.id, warrantyRuleId: "warranty-rule-summit-compressor-v1", coverageType: "part", duration: 365, durationUnit: "days", startEvent: "store_verification", provider: "vendor", obligatedVendorId: "vendor-northline-summit", routingRule: "original_vendor_mandatory", deductible: { amountMinor: 0, currency: "USD" }, maximumCoverage: { amountMinor: 725_000, currency: "USD" }, conditions: "Vendor-supplied compressor and installed service parts", exclusions: "Consumables outside the diagnosed compressor failure" },
    { id: "warranty-line-summit-compressor-travel", organizationId: organization.id, warrantyRuleId: "warranty-rule-summit-compressor-v1", coverageType: "travel", duration: 30, durationUnit: "days", startEvent: "store_verification", provider: "vendor", obligatedVendorId: "vendor-northline-summit", routingRule: "original_vendor_first_right_to_cure", deductible: { amountMinor: 0, currency: "USD" } },
    { id: "warranty-line-summit-compressor-diagnostic", organizationId: organization.id, warrantyRuleId: "warranty-rule-summit-compressor-v1", coverageType: "diagnostic", duration: 90, durationUnit: "days", startEvent: "store_verification", provider: "vendor", obligatedVendorId: "vendor-northline-summit", routingRule: "original_vendor_first_right_to_cure", deductible: { amountMinor: 0, currency: "USD" } },
  );
  repairItems.push({ id: warrantyRepairItemId, organizationId: organization.id, workOrderId: "wo-northline-104", siteVisitWorkOrderId: priorVisitWorkId, vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", assetId: "asset-104-beer-cave", componentId: "component-104-compressor", failureCode: "compressor-ground-fault", repairAction: "Removed failed compressor; installed Copeland replacement; evacuated, charged, and commissioned the circuit", repairSeverity: "major", removedComponentId: "component-104-compressor-removed-2021", installedComponentId: "component-104-compressor", partManufacturer: "Copeland", partModel: "ZB38KCE-TFD", serialNumber: "CMP104-2026-0710", vendorSupplied: true, completionDate: visit104End.slice(0, 10), verificationDate: visit104End.slice(0, 10), laborCost: { amountMinor: 165_000, currency: "USD" }, partCost: { amountMinor: 725_000, currency: "USD" }, rootCause: "Internal winding insulation failure", createdAt: new Date(Date.parse(visit104End) + 45 * 60_000).toISOString() });
  componentLifecycleEvents.push({ id: "component-life-104-compressor-2026-07", organizationId: organization.id, assetId: "asset-104-beer-cave", removedComponentId: "component-104-compressor-removed-2021", installedComponentId: "component-104-compressor", repairItemId: warrantyRepairItemId, workOrderId: "wo-northline-104", vendorId: "vendor-northline-summit", partManufacturer: "Copeland", partModel: "ZB38KCE-TFD", serialNumber: "CMP104-2026-0710", removedAt: "2026-07-10", installedAt: "2026-07-10", failureMode: "compressor-ground-fault", rootCause: "Internal winding insulation failure", laborCost: { amountMinor: 165_000, currency: "USD" }, partCost: { amountMinor: 725_000, currency: "USD" }, replacementKind: "reactive", expectedLifeMonths: 96, warrantyEndsAt: "2028-07-10", createdAt: new Date(Date.parse(visit104End) + 46 * 60_000).toISOString() });
  const warrantyStartDate = visit104End.slice(0, 10);
  const immutableTerms = (coverageType: string, endDate: string, routingRule: string) => JSON.stringify({ resolutionPrecedence: "contract-specific component rule", coverageType, startDate: warrantyStartDate, endDate, routingRule, contractVersionId: "contract-version-summit-refrigeration-v1", ruleId: "warranty-rule-summit-compressor-v1", calculatedAt: new Date(Date.parse(visit104End) + 50 * 60_000).toISOString() });
  appliedWarranties.push(
    { id: "applied-warranty-104-compressor-labor", organizationId: organization.id, repairItemId: warrantyRepairItemId, coverageType: "labor", provider: "vendor", obligatedVendorId: "vendor-northline-summit", startDate: warrantyStartDate, endDate: "2026-10-08", coveredCharges: ["labor", "diagnostic"], routingRule: "original_vendor_first_right_to_cure", contractVersionId: "contract-version-summit-refrigeration-v1", policySource: "Contract-specific Component rule", ruleSource: "warranty-rule-summit-compressor-v1", originalCalculatedTermsJson: immutableTerms("labor", "2026-10-08", "original_vendor_first_right_to_cure"), createdAt: new Date(Date.parse(visit104End) + 50 * 60_000).toISOString() },
    { id: "applied-warranty-104-compressor-part", organizationId: organization.id, repairItemId: warrantyRepairItemId, coverageType: "part", provider: "vendor", obligatedVendorId: "vendor-northline-summit", startDate: warrantyStartDate, endDate: "2027-07-10", coveredCharges: ["vendor-supplied compressor", "installed service parts"], routingRule: "original_vendor_mandatory", contractVersionId: "contract-version-summit-refrigeration-v1", policySource: "Contract-specific Component rule", ruleSource: "warranty-rule-summit-compressor-v1", originalCalculatedTermsJson: immutableTerms("part", "2027-07-10", "original_vendor_mandatory"), createdAt: new Date(Date.parse(visit104End) + 50 * 60_000).toISOString() },
    { id: "applied-warranty-104-compressor-travel", organizationId: organization.id, repairItemId: warrantyRepairItemId, coverageType: "travel", provider: "vendor", obligatedVendorId: "vendor-northline-summit", startDate: warrantyStartDate, endDate: "2026-08-09", coveredCharges: ["callback travel"], routingRule: "original_vendor_first_right_to_cure", contractVersionId: "contract-version-summit-refrigeration-v1", policySource: "Contract-specific Component rule", ruleSource: "warranty-rule-summit-compressor-v1", originalCalculatedTermsJson: immutableTerms("travel", "2026-08-09", "original_vendor_first_right_to_cure"), createdAt: new Date(Date.parse(visit104End) + 50 * 60_000).toISOString() },
    { id: "applied-warranty-104-compressor-diagnostic", organizationId: organization.id, repairItemId: warrantyRepairItemId, coverageType: "diagnostic", provider: "vendor", obligatedVendorId: "vendor-northline-summit", startDate: warrantyStartDate, endDate: "2026-10-08", coveredCharges: ["diagnosis of related callback"], routingRule: "original_vendor_first_right_to_cure", contractVersionId: "contract-version-summit-refrigeration-v1", policySource: "Contract-specific Component rule", ruleSource: "warranty-rule-summit-compressor-v1", originalCalculatedTermsJson: immutableTerms("diagnostic", "2026-10-08", "original_vendor_first_right_to_cure"), createdAt: new Date(Date.parse(visit104End) + 50 * 60_000).toISOString() },
  );
  manufacturerWarranties.push({ id: "manufacturer-warranty-104-compressor", organizationId: organization.id, assetId: "asset-104-beer-cave", componentId: "component-104-compressor", manufacturer: "Copeland", model: "ZB38KCE-TFD", serialNumber: "CMP104-2026-0710", partsCoverage: "Replacement compressor part only", laborCoverage: "Not included", startDate: warrantyStartDate, expirationDate: "2028-07-10", authorizedProviderRule: "EPA-certified refrigeration provider approved by the manufacturer", claimRequirements: "Failure diagnosis, serial number, commissioning sheet, and returned compressor", installingVendorId: "vendor-northline-summit", administrator: "Fictional Copeland Demo Warranty Desk", supportingFileId: "file-104-service-report", createdAt: new Date(Date.parse(visit104End) + 55 * 60_000).toISOString() });
  requests.push({ id: warrantyCallbackRequestId, organizationId: organization.id, reference: "REQ-26-104W", storeId: "store-northline-104", reporterName: "Avery Johnson", reporterEmployeeId: "E3103", problem: "Beer-cave compressor is cycling on overload one month after replacement", priority: "urgent", status: "converted", version: 1, submittedAt: at(8, 10, 16, 30), convertedWorkOrderId: warrantyCallbackWorkId });
  requestImpactAssessments.push(
    { id: "impact-warranty-104-callback-initial", organizationId: organization.id, requestId: warrantyCallbackRequestId, storeId: "store-northline-104", assessmentKind: "initial_report", storeOperatingState: "partially_operational", safetyConcern: "none_reported", productInventoryRisk: "at_risk", productInventoryValue: { amountMinor: 285_000, currency: "USD" }, customersAffected: "yes", complianceImpact: "none_reported", capacityUnavailableBps: 5_000, redundantEquipment: "yes", revenueFunctionImpact: "refrigerated_merchandise", estimatedDailyRevenueExposure: { amountMinor: 475_000, currency: "USD" }, estimatedDowntimeMinutes: 240, confidence: "medium", source: "store_report", notes: "Compressor is cycling on overload; backup coolers are in use. Exposure is an estimate, not verified revenue loss.", assessedByActorType: "user", assessedByActorId: "E3103", assessedByActorName: "Avery Johnson", assessedAt: at(8, 10, 16, 30) },
    { id: "impact-warranty-104-callback-review", organizationId: organization.id, requestId: warrantyCallbackRequestId, storeId: "store-northline-104", assessmentKind: "review", reviewDisposition: "confirmed", storeOperatingState: "partially_operational", safetyConcern: "none_reported", productInventoryRisk: "at_risk", productInventoryValue: { amountMinor: 285_000, currency: "USD" }, customersAffected: "yes", complianceImpact: "none_reported", capacityUnavailableBps: 5_000, redundantEquipment: "yes", revenueFunctionImpact: "refrigerated_merchandise", estimatedDailyRevenueExposure: { amountMinor: 475_000, currency: "USD" }, estimatedDowntimeMinutes: 240, confidence: "high", source: "manager_review", notes: "Manager confirmed degraded operation and exact replaced compressor. Estimates remain unverified exposure.", assessedByActorType: "user", assessedByActorId: "membership-northline-facilities", assessedByActorName: "Jordan Lee", assessedAt: at(8, 10, 16, 38) },
  );
  workOrders.push({ id: warrantyCallbackWorkId, organizationId: organization.id, number: "CPS-2026-0119", storeId: "store-northline-104", requestId: warrantyCallbackRequestId, problem: "Beer-cave compressor is cycling on overload one month after replacement", authorizedScope: "Diagnose the exact replaced compressor and related installation; do not charge the customer or replace parts until warranty coverage is determined.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: "asset-104-beer-cave", componentId: "component-104-compressor", priority: "urgent", status: "approved", version: 0, accountableParty: "Warranty review", nextAction: "Confirm diagnosis and warranty coverage", dueAt: at(8, 10, 20), escalationTo: "Facilities director", nte: { amountMinor: 0, currency: "USD" }, createdAt: at(8, 10, 16, 40) });
  assignments.push({ id: "assignment-warranty-104-callback", organizationId: organization.id, workOrderId: warrantyCallbackWorkId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "pending", assignedAt: at(8, 10, 16, 45) });
  warrantyCases.push({ id: warrantyCaseId, organizationId: organization.id, requestId: warrantyCallbackRequestId, workOrderId: warrantyCallbackWorkId, assetId: "asset-104-beer-cave", componentId: "component-104-compressor", priorRepairItemId: warrantyRepairItemId, appliedWarrantyId: "applied-warranty-104-compressor-part", manufacturerWarrantyId: "manufacturer-warranty-104-compressor", status: "diagnosis_required", confidence: "high", detectionExplanation: "Potential warranty coverage found — diagnosis required. Exact Asset, Component, installed compressor serial, related symptom, prior Vendor, and active coverage dates match the July repair; liability is not determined.", diagnosisRequired: true, coverageDecision: "pending_diagnosis", customerChargeStatus: "undetermined", invoiceHold: true, routingRule: "original_vendor_mandatory", obligatedVendorId: "vendor-northline-summit", vendorResponseDueAt: at(8, 10, 18), createdAt: at(8, 10, 16, 41) });
  workOrderVerifications.push({ id: "verification-wo-northline-104-compressor", organizationId: organization.id, workOrderId: "wo-northline-104", siteVisitWorkOrderId: priorVisitWorkId, outcome: "completed", outcomeRecordedAt: visit104End, cycle: 1, decision: "verified", decidedByMembershipId: "membership-northline-facilities", decidedByName: "Jordan Lee", decidedAt: new Date(Date.parse(visit104End) + 40 * 60_000).toISOString() });

  quotes.push({ id: "quote-summit-104-compressor-v1", organizationId: organization.id, workOrderId: "wo-northline-104", vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", quoteNumber: "SUM-Q-104-2607", version: 1, scope: "Replace failed compressor, filter drier, refrigerant charge, evacuation, startup, and commissioning", subtotal: { amountMinor: 890_000, currency: "USD" }, tax: { amountMinor: 55_000, currency: "USD" }, fees: { amountMinor: 12_500, currency: "USD" }, total: { amountMinor: 957_500, currency: "USD" }, submittedAt: at(7, 8, 14), expiresAt: at(8, 7, 14) });
  authorizations.push({ id: "authorization-104-compressor-base", organizationId: organization.id, workOrderId: "wo-northline-104", authorizationType: "base", authorizedAmount: { amountMinor: 945_000, currency: "USD" }, authorizedScope: "Compressor replacement and commissioning under ColdLine Contract Version 1; trip charge is included in approved mobilization", approverMembershipId: "membership-northline-facilities", approverName: "Jordan Lee", approvalAuthority: "Major repair approval policy and delegated NTE", authorizedAt: at(7, 9, 10), reason: "Restore the Store 104 beer cave after diagnostic confirmation", contractVersionId: "contract-version-summit-refrigeration-v1" });
  invoices.push({ id: "invoice-summit-104-compressor", organizationId: organization.id, vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", vendorInvoiceNumber: "SUM-104-2607", invoiceDate: "2026-07-11", subtotal: { amountMinor: 1_102_500, currency: "USD" }, tax: { amountMinor: 55_000, currency: "USD" }, fees: { amountMinor: 0, currency: "USD" }, total: { amountMinor: 1_157_500, currency: "USD" }, approvedForPayment: { amountMinor: 0, currency: "USD" }, paidAmount: { amountMinor: 0, currency: "USD" }, status: "exception", exceptionReason: "The invoice is $2,125 above the latest immutable authorization after an added controls line. A reviewer must confirm a documented change order; no deduction has been made.", supportingFileId: "file-104-service-report", createdAt: at(7, 11, 14) });
  invoiceLines.push(
    { id: "invoice-line-104-labor", organizationId: organization.id, invoiceId: "invoice-summit-104-compressor", lineNumber: 1, category: "labor", description: "Compressor replacement labor and commissioning", quantityThousandths: 1_000, unitAmount: { amountMinor: 165_000, currency: "USD" }, lineAmount: { amountMinor: 165_000, currency: "USD" }, contractRateCardLineId: "rate-summit-labor", createdAt: at(7, 11, 14) },
    { id: "invoice-line-104-part", organizationId: organization.id, invoiceId: "invoice-summit-104-compressor", lineNumber: 2, category: "part", description: "Copeland compressor and installed service parts", quantityThousandths: 1_000, unitAmount: { amountMinor: 725_000, currency: "USD" }, lineAmount: { amountMinor: 725_000, currency: "USD" }, createdAt: at(7, 11, 14) },
    { id: "invoice-line-104-trip", organizationId: organization.id, invoiceId: "invoice-summit-104-compressor", lineNumber: 3, category: "travel", description: "Separate trip charge", quantityThousandths: 1_000, unitAmount: { amountMinor: 12_500, currency: "USD" }, lineAmount: { amountMinor: 12_500, currency: "USD" }, contractRateCardLineId: "rate-summit-trip", createdAt: at(7, 11, 14) },
    { id: "invoice-line-104-tax", organizationId: organization.id, invoiceId: "invoice-summit-104-compressor", lineNumber: 4, category: "tax", description: "Sales tax", quantityThousandths: 1_000, unitAmount: { amountMinor: 55_000, currency: "USD" }, lineAmount: { amountMinor: 55_000, currency: "USD" }, createdAt: at(7, 11, 14) },
    { id: "invoice-line-104-unapproved-controls", organizationId: organization.id, invoiceId: "invoice-summit-104-compressor", lineNumber: 5, category: "other_fee", description: "Added controls and refrigerant work without a linked change order", quantityThousandths: 1_000, unitAmount: { amountMinor: 200_000, currency: "USD" }, lineAmount: { amountMinor: 200_000, currency: "USD" }, createdAt: at(7, 11, 14) },
  );
  invoiceLines.forEach((line) => { if (line.invoiceId !== "invoice-summit-104-compressor") return; invoiceLineAllocations.push({ id: `allocation-${line.id}`, organizationId: organization.id, invoiceLineId: line.id, workOrderId: "wo-northline-104", repairItemId: line.category === "labor" || line.category === "part" ? warrantyRepairItemId : undefined, siteVisitWorkOrderId: priorVisitWorkId, assetId: "asset-104-beer-cave", componentId: line.category === "labor" || line.category === "part" ? "component-104-compressor" : undefined, storeId: "store-northline-104", tradeKey: "refrigeration", amount: line.lineAmount, method: "manual", confirmedByMembershipId: "membership-northline-finance", confirmedAt: at(7, 12, 14) }); });
  invoiceReferences.push({ id: "invoice-summit-104-compressor", organizationId: organization.id, vendorId: "vendor-northline-summit", invoiceNumber: "SUM-104-2607", invoiceDate: "2026-07-11", grossAmount: { amountMinor: 1_157_500, currency: "USD" }, operatorWorkOrderNumber: "CPS-2026-0104", matchStatus: "confirmed", createdAt: at(7, 11, 14) });
  invoiceAllocations.push({ id: "invoice-reference-allocation-summit-104-compressor", organizationId: organization.id, invoiceReferenceId: "invoice-summit-104-compressor", workOrderId: "wo-northline-104", amount: { amountMinor: 1_157_500, currency: "USD" }, confirmedByMembershipId: "membership-northline-finance", confirmedAt: at(7, 12, 14) });
  invoiceExceptions.push(
    { id: "invoice-exception-104-trip", organizationId: organization.id, invoiceId: "invoice-summit-104-compressor", invoiceLineId: "invoice-line-104-trip", kind: "unsupported_trip_charge", status: "waived", summary: "The separate $125 trip line was reviewed against the service agreement and kept on the record below the material review threshold.", amount: { amountMinor: 12_500, currency: "USD" }, detectedAt: at(7, 11, 14, 5), resolvedAt: at(7, 12, 15), resolutionReason: "Finance documented the low-dollar line as included in the vendor's final invoice; no exposure is claimed." },
    { id: "invoice-exception-104-authorization", organizationId: organization.id, invoiceId: "invoice-summit-104-compressor", invoiceLineId: "invoice-line-104-unapproved-controls", kind: "authorization", status: "open", summary: "Invoice total is $2,125 above the latest immutable authorization. The added controls line has no linked change order, so the variance requires human review before payment approval.", amount: { amountMinor: 212_500, currency: "USD" }, detectedAt: at(7, 11, 14, 6) },
  );

  // A callback invoice is deliberately held because the exact compressor,
  // serial, Vendor, and active coverage dates match the open warranty case.
  // This is evidence for review, not an automatic denial or savings claim.
  invoices.push({ id: "invoice-summit-104-warranty-callback", organizationId: organization.id, vendorId: "vendor-northline-summit", contractVersionId: "contract-version-summit-refrigeration-v1", vendorInvoiceNumber: "SUM-104-2611-W", invoiceDate: "2026-08-11", subtotal: { amountMinor: 890_000, currency: "USD" }, tax: { amountMinor: 0, currency: "USD" }, fees: { amountMinor: 0, currency: "USD" }, total: { amountMinor: 890_000, currency: "USD" }, approvedForPayment: { amountMinor: 0, currency: "USD" }, paidAmount: { amountMinor: 0, currency: "USD" }, status: "exception", exceptionReason: "The billed compressor callback matches an open exact-component warranty case. Diagnosis and coverage responsibility remain pending.", supportingFileId: "file-104-warranty", createdAt: at(8, 11, 14) });
  invoiceLines.push({ id: "invoice-line-104-warranty-callback", organizationId: organization.id, invoiceId: "invoice-summit-104-warranty-callback", lineNumber: 1, category: "part", description: "Compressor callback repair submitted while exact-component coverage is under review", quantityThousandths: 1_000, unitAmount: { amountMinor: 890_000, currency: "USD" }, lineAmount: { amountMinor: 890_000, currency: "USD" }, createdAt: at(8, 11, 14) });
  invoiceLineAllocations.push({ id: "allocation-invoice-line-104-warranty-callback", organizationId: organization.id, invoiceLineId: "invoice-line-104-warranty-callback", workOrderId: warrantyCallbackWorkId, repairItemId: warrantyRepairItemId, assetId: "asset-104-beer-cave", componentId: "component-104-compressor", storeId: "store-northline-104", tradeKey: "refrigeration", amount: { amountMinor: 890_000, currency: "USD" }, method: "manual", confirmedByMembershipId: "membership-northline-finance", confirmedAt: at(8, 11, 14, 10) });
  invoiceReferences.push({ id: "invoice-summit-104-warranty-callback", organizationId: organization.id, vendorId: "vendor-northline-summit", invoiceNumber: "SUM-104-2611-W", invoiceDate: "2026-08-11", grossAmount: { amountMinor: 890_000, currency: "USD" }, operatorWorkOrderNumber: "CPS-2026-0119", matchStatus: "confirmed", createdAt: at(8, 11, 14) });
  invoiceAllocations.push({ id: "invoice-reference-allocation-summit-104-warranty-callback", organizationId: organization.id, invoiceReferenceId: "invoice-summit-104-warranty-callback", workOrderId: warrantyCallbackWorkId, amount: { amountMinor: 890_000, currency: "USD" }, confirmedByMembershipId: "membership-northline-finance", confirmedAt: at(8, 11, 14, 10) });
  invoiceExceptions.push({ id: "invoice-exception-104-warranty-hold", organizationId: organization.id, invoiceId: "invoice-summit-104-warranty-callback", invoiceLineId: "invoice-line-104-warranty-callback", kind: "warranty_hold", status: "open", summary: "The billed $8,900 callback matches the exact compressor serial and active coverage dates in the open warranty case. Hold for diagnosis and a human coverage decision; liability is not determined.", amount: { amountMinor: 890_000, currency: "USD" }, detectedAt: at(8, 11, 14, 5) });

  // One source invoice lists four mobilizations, while two exact Visit / Work
  // Order links exist. The $2,100 difference is a review fact, not proof that
  // the remaining mobilizations were invalid.
  const billedTripInvoice = invoices.find((invoice) => invoice.id === "invoice-history-104-4")!;
  billedTripInvoice.status = "exception";
  billedTripInvoice.exceptionReason = "The source invoice lists four mobilizations while two exact Visit / Work Order links are recorded. A reviewer must reconcile the difference with ColdLine.";
  const billedTripBaseLine = invoiceLines.find((line) => line.invoiceId === billedTripInvoice.id)!;
  billedTripBaseLine.description = "Refrigeration repair labor and parts";
  billedTripBaseLine.unitAmount = { amountMinor: 452_500, currency: "USD" };
  billedTripBaseLine.lineAmount = { amountMinor: 452_500, currency: "USD" };
  const billedTripBaseAllocation = invoiceLineAllocations.find((allocation) => allocation.invoiceLineId === billedTripBaseLine.id)!;
  billedTripBaseAllocation.amount = { amountMinor: 452_500, currency: "USD" };
  invoiceLines.push({ id: "invoice-line-history-104-4-mobilizations", organizationId: organization.id, invoiceId: billedTripInvoice.id, lineNumber: 2, category: "travel", description: "Four mobilization charges at $1,050 each", quantityThousandths: 4_000, unitAmount: { amountMinor: 105_000, currency: "USD" }, lineAmount: { amountMinor: 420_000, currency: "USD" }, createdAt: billedTripInvoice.createdAt });
  invoiceLineAllocations.push({ id: "allocation-invoice-line-history-104-4-mobilizations", organizationId: organization.id, invoiceLineId: "invoice-line-history-104-4-mobilizations", workOrderId: "wo-history-104-4", siteVisitWorkOrderId: "site-visit-work-visit-history-104-4-wo-history-104-4", assetId: "asset-104-beer-cave", componentId: "component-104-compressor", storeId: "store-northline-104", tradeKey: "refrigeration", amount: { amountMinor: 420_000, currency: "USD" }, method: "manual", confirmedByMembershipId: "membership-northline-finance", confirmedAt: billedTripInvoice.createdAt });
  serviceDiscrepancies.push({ id: "service-discrepancy-history-104-4-trips", organizationId: organization.id, workOrderId: "wo-history-104-4", invoiceId: billedTripInvoice.id, discrepancyType: "visit_count", status: "open", factsJson: JSON.stringify({ billedMobilizations: 4, observedVisitWorkOrderLinks: 2, rateMinor: 105_000, reviewAmountMinor: 210_000, determination: "review_only" }), createdAt: billedTripInvoice.createdAt });
  invoiceExceptions.push({ id: "invoice-exception-history-104-4-trips", organizationId: organization.id, invoiceId: billedTripInvoice.id, invoiceLineId: "invoice-line-history-104-4-mobilizations", kind: "service_discrepancy_hold", status: "open", summary: "The invoice lists four $1,050 mobilizations, but two exact Visit / Work Order links are recorded. Review the two-trip, $2,100 difference with the vendor; observed visits are not automatic invoice proof.", amount: { amountMinor: 210_000, currency: "USD" }, detectedAt: billedTripInvoice.createdAt });

  // The same immutable source document is attached to a second invoice record.
  // It remains linked for investigation but is excluded from the lightweight
  // spend projection so the portfolio total cannot double count it.
  files.push({ id: "file-invoice-history-104-4", organizationId: organization.id, storageKey: "northline-demo/invoices/invoice-history-104-4/source-invoice.pdf", sha256: "f5c0b8e6d9ed63cc6572df4bdda92d02ce6de55a70012f93f426d99b5f991922", originalName: "COLDLINE-202603-104-4.pdf", contentType: "application/pdf", byteLength: 198_420, status: "available", createdAt: billedTripInvoice.createdAt });
  billedTripInvoice.supportingFileId = "file-invoice-history-104-4";
  invoices.push({ id: "invoice-history-104-4-duplicate", organizationId: organization.id, vendorId: billedTripInvoice.vendorId, vendorInvoiceNumber: "COLDLINE-202603-104-4-COPY", invoiceDate: billedTripInvoice.invoiceDate, subtotal: billedTripInvoice.subtotal, tax: billedTripInvoice.tax, fees: billedTripInvoice.fees, total: billedTripInvoice.total, approvedForPayment: { amountMinor: 0, currency: "USD" }, paidAmount: { amountMinor: 0, currency: "USD" }, status: "exception", exceptionReason: "The uploaded file has the same SHA-256 fingerprint as invoice COLDLINE-202603-104-4. Review before any payment approval.", supportingFileId: "file-invoice-history-104-4", createdAt: at(3, 20, 14) });
  invoiceLines.push({ id: "invoice-line-history-104-4-duplicate", organizationId: organization.id, invoiceId: "invoice-history-104-4-duplicate", lineNumber: 1, category: "labor", description: "Duplicate source invoice total", quantityThousandths: 1_000, unitAmount: { amountMinor: 872_500, currency: "USD" }, lineAmount: { amountMinor: 872_500, currency: "USD" }, createdAt: at(3, 20, 14) });
  invoiceLineAllocations.push({ id: "allocation-invoice-line-history-104-4-duplicate", organizationId: organization.id, invoiceLineId: "invoice-line-history-104-4-duplicate", workOrderId: "wo-history-104-4", assetId: "asset-104-beer-cave", componentId: "component-104-compressor", storeId: "store-northline-104", tradeKey: "refrigeration", amount: { amountMinor: 872_500, currency: "USD" }, method: "manual" });
  entityFiles.push(
    { id: "entity-file-invoice-history-104-4", organizationId: organization.id, fileId: "file-invoice-history-104-4", entityType: "invoice", entityId: "invoice-history-104-4", purpose: "invoice", visibility: "internal", createdAt: billedTripInvoice.createdAt },
    { id: "entity-file-invoice-history-104-4-duplicate", organizationId: organization.id, fileId: "file-invoice-history-104-4", entityType: "invoice", entityId: "invoice-history-104-4-duplicate", purpose: "invoice", visibility: "internal", createdAt: at(3, 20, 14) },
  );
  invoiceExceptions.push({ id: "invoice-exception-history-104-4-duplicate", organizationId: organization.id, invoiceId: "invoice-history-104-4-duplicate", invoiceLineId: "invoice-line-history-104-4-duplicate", kind: "duplicate_invoice", status: "open", summary: "Exact source-document fingerprint match to COLDLINE-202603-104-4. The second record is held for human review and is not included in the spend projection.", amount: { amountMinor: 872_500, currency: "USD" }, detectedAt: at(3, 20, 14, 1) });
  valueEvents.push(
    { id: "value-event-warranty-104-exposure", organizationId: organization.id, category: "identified_exposure", eventType: "potential_warranty", amount: { amountMinor: 890_000, currency: "USD" }, workOrderId: warrantyCallbackWorkId, invoiceLineId: "invoice-line-104-warranty-callback", warrantyCaseId, assetId: "asset-104-beer-cave", contractVersionId: "contract-version-summit-refrigeration-v1", sourceDecision: "Exact-component potential warranty detection; diagnosis and liability remain pending", deduplicationKey: `warranty-case:${warrantyCaseId}:potential`, occurredAt: at(8, 10, 16, 41) },
    { id: "value-event-invoice-104-authorization-review", organizationId: organization.id, category: "identified_exposure", eventType: "authorization_overage", amount: { amountMinor: 212_500, currency: "USD" }, workOrderId: "wo-northline-104", invoiceLineId: "invoice-line-104-unapproved-controls", contractVersionId: "contract-version-summit-refrigeration-v1", sourceDecision: "Invoice exceeds the latest immutable authorization; change-order evidence and validity require human review", deduplicationKey: "invoice:invoice-summit-104-compressor:authorization-overage", occurredAt: at(7, 11, 14, 6) },
    { id: "value-event-invoice-history-104-4-trip-review", organizationId: organization.id, category: "identified_exposure", eventType: "billed_trips_exceed_observed_visits", amount: { amountMinor: 210_000, currency: "USD" }, workOrderId: "wo-history-104-4", invoiceLineId: "invoice-line-history-104-4-mobilizations", sourceDecision: "Four billed mobilizations versus two observed Visit / Work Order links; validity requires human review", deduplicationKey: "invoice:invoice-history-104-4:visit-count", occurredAt: billedTripInvoice.createdAt },
    { id: "value-event-invoice-history-104-4-duplicate", organizationId: organization.id, category: "identified_exposure", eventType: "duplicate_document_fingerprint", amount: { amountMinor: 872_500, currency: "USD" }, workOrderId: "wo-history-104-4", invoiceLineId: "invoice-line-history-104-4-duplicate", sourceDecision: "Exact source-document match; the second invoice record is held for human review", deduplicationKey: "invoice-document-sha256:f5c0b8e6d9ed63cc6572df4bdda92d02ce6de55a70012f93f426d99b5f991922", occurredAt: at(3, 20, 14, 1) },
  );
  auditEvents.push(
    { id: "audit-warranty-case-104-detected", organizationId: organization.id, aggregateType: "warranty_case", aggregateId: warrantyCaseId, eventType: "warranty_case.detected", actorType: "system", actorName: "Warranty detection", occurredAt: at(8, 10, 16, 41), payloadJson: JSON.stringify({ confidence: "high", liabilityDetermined: false, invoiceHold: true, customerChargeStatus: "undetermined", routingRule: "original_vendor_mandatory", priorRepairItemId: warrantyRepairItemId }) },
    { id: "audit-invoice-104-exception-flagged", organizationId: organization.id, aggregateType: "invoice", aggregateId: "invoice-summit-104-compressor", eventType: "invoice.exception_flagged", actorType: "system", actorName: "Invoice safeguards", occurredAt: at(7, 11, 14, 5), payloadJson: JSON.stringify({ invoiceLineId: "invoice-line-104-trip", reviewOnly: true, validityDetermined: false, deductionMinor: 0, approvedForPaymentMinor: 0, paymentExecuted: false }) },
  );

  workOrders.filter((workOrder) => !["closed", "cancelled"].includes(workOrder.status)).forEach((workOrder) => {
    const openFollowUps = followUps.filter((followUp) => followUp.organizationId === workOrder.organizationId && followUp.workOrderId === workOrder.id && followUp.status === "open");
    const sources: Array<FollowUp | undefined> = openFollowUps.length ? openFollowUps : [undefined];
    sources.forEach((followUp, index) => {
      const assignment = assignments.filter((candidate) => candidate.organizationId === workOrder.organizationId && candidate.workOrderId === workOrder.id).at(-1);
      const assigneeName = followUp?.accountableParty ?? workOrder.accountableParty;
      const assignee = assignment?.kind === "outside_vendor" && assignment.vendorId
        ? { assigneeType: "vendor" as const, assigneeId: assignment.vendorId }
        : assignment?.kind === "internal" && assignment.internalMembershipId
          ? { assigneeType: "user" as const, assigneeId: assignment.internalMembershipId }
          : { assigneeType: "role" as const, assigneeRole: "facilities_admin" as const };
      const type = taskType(workOrder, followUp);
      workflowTasks.push({
        id: followUp ? `workflow-task-${followUp.id}` : `workflow-task-${workOrder.id}-${index + 1}`,
        organizationId: workOrder.organizationId,
        workOrderId: workOrder.id,
        taskType: type,
        title: followUp?.nextAction ?? workOrder.nextAction,
        reason: `Keep ${workOrder.number} moving: ${workOrder.problem}`,
        ...assignee,
        assigneeName,
        priority: taskPriority(workOrder.priority),
        status: workOrder.status === "in_progress" ? "in_progress" : "open",
        blocking: ["approved", "awaiting_approval", "waiting_on_vendor", "waiting_on_parts"].includes(workOrder.status),
        requiredForProgress: true,
        dueAt: followUp?.dueAt ?? workOrder.dueAt,
        noSlaReason: followUp?.dueAt || workOrder.dueAt ? undefined : "No SLA applies under the current service policy",
        applicableSlaClock: slaClock(type),
        completionCriteria: `Record evidence that the action is complete: ${followUp?.nextAction ?? workOrder.nextAction}`,
        escalationDestination: followUp?.escalationTo ?? workOrder.escalationTo ?? "Facilities director",
        escalationLevel: 0,
        sourceFollowUpId: followUp?.id,
        createdByActorType: "system",
        createdByActorName: "Deterministic demo fixture",
        createdAt: followUp?.createdAt ?? workOrder.createdAt,
        ...(workOrder.status === "in_progress" ? { startedByActorType: "system" as const, startedByActorName: "Deterministic demo fixture", startedAt: workOrder.createdAt } : {}),
      });
    });
  });
  const proposedDateReviewTask = workflowTasks.find((task) => task.workOrderId === scheduledWorkOrderId && ["open", "in_progress"].includes(task.status));
  if (proposedDateReviewTask) Object.assign(proposedDateReviewTask, {
    taskType: "schedule_service" as const,
    title: "Accept or counter ColdLine's proposed service date",
    reason: "ColdLine proposed a service window that needs an operator scheduling decision.",
    assigneeType: "role" as const,
    assigneeId: undefined,
    assigneeRole: "facilities_admin" as const,
    assigneeName: "Facilities coordinator",
    blocking: true,
    dueAt: at(8, 25, 17, 15),
    applicableSlaClock: "scheduling" as const,
    completionCriteria: "The proposed service date is accepted or a store-local counterproposal is sent.",
    escalationDestination: "Facilities director",
  });
  [serviceRunReactiveWorkId, serviceRunPmWorkId].forEach((workOrderId) => {
    const task = workflowTasks.find((candidate) => candidate.workOrderId === workOrderId && ["open", "in_progress"].includes(candidate.status));
    if (!task) return;
    Object.assign(task, {
      taskType: "schedule_service" as const,
      title: "Respond to proposed Service Run",
      reason: `Service Run ${serviceRunId} bundles this Work Order under the active ColdLine Contract Version.`,
      assigneeType: "vendor" as const,
      assigneeId: "vendor-northline-summit",
      assigneeRole: undefined,
      assigneeName: "ColdLine Refrigeration & HVAC",
      priority: "high" as const,
      blocking: true,
      dueAt: at(8, 28, 16),
      applicableSlaClock: "scheduling" as const,
      completionCriteria: "Vendor accepts, counters, requests a scoped change, reports insufficient capacity, or declines.",
      escalationDestination: "Facilities coordinator",
      createdAt: serviceRunCreatedAt,
    });
  });
  const warrantyReviewTask = workflowTasks.find((task) => task.workOrderId === warrantyCallbackWorkId && ["open", "in_progress"].includes(task.status));
  if (warrantyReviewTask) Object.assign(warrantyReviewTask, {
    taskType: "review_warranty" as const,
    title: "Confirm diagnosis and warranty coverage",
    reason: "Exact-component active coverage was found; liability remains undetermined until diagnosis.",
    assigneeType: "role" as const,
    assigneeId: undefined,
    assigneeRole: "facilities_admin" as const,
    assigneeName: "Warranty review",
    priority: "critical" as const,
    blocking: true,
    dueAt: at(8, 10, 20),
    applicableSlaClock: "warranty_review" as const,
    completionCriteria: "Diagnosis is recorded, each coverage category is decided independently, routing is confirmed, and billing hold is explicitly released or retained.",
    escalationDestination: "Facilities director",
    createdAt: at(8, 10, 16, 41),
  });

  // The active visit carries two real obligations at once: the technician
  // records the outcome while facilities prepares an independent verification.
  const activeVisitWorkOrder = workOrders.find((workOrder) => workOrder.id === "wo-northline-112");
  if (activeVisitWorkOrder) workflowTasks.push({
    id: "workflow-task-wo-northline-112-verification", organizationId: organization.id, workOrderId: activeVisitWorkOrder.id,
    taskType: "verify_repair", title: "Verify operating condition after technician checkout", reason: "Store operations must confirm the repair before service review is complete",
    assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator", priority: "high", status: "open", blocking: false, requiredForProgress: true,
    dueAt: at(8, 26, 16), applicableSlaClock: "verification", completionCriteria: "Store confirmation and service evidence are reviewed and the operating condition is recorded",
    escalationDestination: "Facilities director", escalationLevel: 0, createdByActorType: "system", createdByActorName: "Deterministic demo fixture", createdAt: at(8, 25, 17, 20),
  });

  // Preserve both a completed pause interval and the currently active hold;
  // resumption is append-only and never rewrites the original pause record.
  const waitingPartsTask = workflowTasks.find((task) => task.workOrderId === "wo-recent-aug-102-hvac");
  const waitingPartsWorkOrderId = waitingPartsTask?.workOrderId;
  if (waitingPartsTask && waitingPartsWorkOrderId) {
    workflowTaskSlaPauses.push(
      { id: "workflow-task-pause-102-diagnosis", organizationId: organization.id, workflowTaskId: waitingPartsTask.id, workOrderId: waitingPartsWorkOrderId, reasonCode: "external_dependency", reasonDetail: "Diagnostic evidence was under facilities review before the parts request was released", ownerType: "team", ownerId: "facilities", ownerName: "Clark Pump and Shop Facilities", affectedClocks: ["operational_restoration", "completion"], expectedResumeAt: at(8, 4, 16), pausedByActorType: "user", pausedByActorId: "membership-northline-facilities", pausedByActorName: "Jordan Lee", pausedAt: at(8, 3, 17) },
      { id: "workflow-task-pause-102-parts", organizationId: organization.id, workflowTaskId: waitingPartsTask.id, workOrderId: waitingPartsWorkOrderId, reasonCode: "awaiting_parts", reasonDetail: "Approved condenser-fan motor is awaiting confirmed distributor availability", ownerType: "vendor", ownerId: "vendor-northline-cedar", ownerName: "ClearFlow HVAC, Plumbing & Kitchen Repair", affectedClocks: ["operational_restoration", "completion"], expectedResumeAt: at(8, 12, 14), pausedByActorType: "user", pausedByActorId: "membership-northline-facilities", pausedByActorName: "Jordan Lee", pausedAt: at(8, 8, 15) },
    );
    workflowTaskSlaResumes.push({ id: "workflow-task-resume-102-diagnosis", organizationId: organization.id, workflowTaskId: waitingPartsTask.id, workOrderId: waitingPartsWorkOrderId, pauseId: "workflow-task-pause-102-diagnosis", resumedByActorType: "user", resumedByActorId: "membership-northline-facilities", resumedByActorName: "Jordan Lee", resumedAt: at(8, 4, 14), note: "Facilities review completed and the parts request was released" });
  }

  // Site/WO selection is the canonical relationship. Scalar visit fields are
  // retained only as a temporary projection for a genuinely single-WO visit.
  visits.filter((visit) => visit.workOrderId).forEach((visit) => {
    const workOrderId = visit.workOrderId!;
    const outcome = visit.outcome ? siteVisitOutcomeFromLegacy(visit.outcome) : undefined;
    const followUp = outcome && siteVisitOutcomeRequiresFollowUp(outcome)
      ? followUps.find((row) => row.organizationId === visit.organizationId && row.sourceVisitId === visit.id && row.workOrderId === workOrderId)
      : undefined;
    siteVisitWorkOrders.push({
      id: `site-visit-work-${visit.id}-${workOrderId}`,
      organizationId: visit.organizationId,
      visitId: visit.id,
      workOrderId,
      ordinal: 1,
      linkedByActorType: "system",
      linkedByActorName: "Deterministic demo fixture",
      linkedAt: visit.checkedInAt,
      outcome,
      outcomeNotes: outcome ? visit.outcomeNotes : undefined,
      outcomeRecordedByActorType: outcome ? (visit.providerKind === "internal" ? "user" : "technician") : undefined,
      outcomeRecordedByActorId: outcome ? visit.internalMembershipId : undefined,
      outcomeRecordedByActorName: outcome ? visit.technicianName : undefined,
      outcomeRecordedAt: outcome ? visit.checkedOutAt : undefined,
      followUpId: followUp?.id,
    });
  });

  // One shared ColdLine presence event covers two independently selected Store
  // 104 work orders, each with its own outcome record.
  const multiWorkVisit = visits.find((visit) => visit.id === "visit-northline-104-2")!;
  const multiWorkFirstLink = siteVisitWorkOrders.find((row) => row.visitId === multiWorkVisit.id)!;
  multiWorkVisit.crewCount = 2;
  multiWorkVisit.additionalTechnicianNames = ["Morgan Reed"];
  multiWorkVisit.vehicleIdentifier = "COLDLINE-TRUCK-14";
  multiWorkVisit.arrivalNote = "Return crew checked in with the replacement compressor and recovery equipment.";
  multiWorkVisit.workOrderId = undefined;
  multiWorkVisit.outcome = undefined;
  multiWorkVisit.outcomeNotes = undefined;
  siteVisitWorkOrders.push({
    id: `site-visit-work-${multiWorkVisit.id}-wo-history-104-4`,
    organizationId: organization.id,
    visitId: multiWorkVisit.id,
    workOrderId: "wo-history-104-4",
    ordinal: 2,
    linkedByActorType: "system",
    linkedByActorName: "Deterministic demo fixture",
    linkedAt: multiWorkVisit.checkedInAt,
    outcome: "completed",
    outcomeNotes: "Verified the previously serviced compressor circuit remained stable during the shared return visit.",
    outcomeRecordedByActorType: "technician",
    outcomeRecordedByActorName: multiWorkVisit.technicianName,
    outcomeRecordedAt: multiWorkVisit.checkedOutAt,
  });
  const multiWorkCheckoutEvidence = visitEvidence.find((row) => row.visitId === multiWorkVisit.id && row.kind === "check_out")!;
  multiWorkCheckoutEvidence.payloadJson = JSON.stringify({
    workOrderIds: [multiWorkFirstLink.workOrderId, "wo-history-104-4"],
    perWorkOrderOutcomes: [
      { workOrderId: multiWorkFirstLink.workOrderId, outcome: multiWorkFirstLink.outcome },
      { workOrderId: "wo-history-104-4", outcome: "completed" },
    ],
  });

  // Store 111 is verified and resolved, but deliberately remains open until a
  // separate close task is completed. This makes resolution distinct from
  // closure in the deterministic presentation data.
  const resolvedWork = workOrders.find((row) => row.id === "wo-recent-aug-111-plumbing")!;
  const resolvedOutcome = siteVisitWorkOrders.find((row) => row.workOrderId === resolvedWork.id && row.outcomeRecordedAt)!;
  const resolvedDecisionAt = at(8, 25, 14);
  const resolvedFollowUp = followUps.find((row) => row.workOrderId === resolvedWork.id && row.status === "open")!;
  const resolvedVerifyTask = workflowTasks.find((row) => row.workOrderId === resolvedWork.id && row.taskType === "verify_repair" && ["open", "in_progress"].includes(row.status))!;
  resolvedFollowUp.status = "completed";
  resolvedFollowUp.completedAt = resolvedDecisionAt;
  Object.assign(resolvedVerifyTask, {
    status: "completed", completedByActorType: "user", completedByActorId: "membership-northline-facilities",
    completedByActorName: "Jordan Lee", completedAt: resolvedDecisionAt,
    resolutionNote: "Store confirmation and the recorded repair outcome were accepted.",
  });
  Object.assign(resolvedWork, {
    status: "resolved", resolvedAt: resolvedDecisionAt, accountableParty: "Facilities coordinator",
    nextAction: "Close verified work", dueAt: at(8, 25, 17), escalationTo: "Facilities director",
  });
  workOrderVerifications.push({
    id: "verification-wo-recent-aug-111-plumbing-cycle-1", organizationId: organization.id, workOrderId: resolvedWork.id,
    siteVisitWorkOrderId: resolvedOutcome.id, outcome: resolvedOutcome.outcome!, outcomeRecordedAt: resolvedOutcome.outcomeRecordedAt!, cycle: 1,
    decision: "verified", reason: "Store confirmation and service evidence show the sink supply connection remains dry.",
    decidedByMembershipId: "membership-northline-facilities", decidedByName: "Jordan Lee", decidedAt: resolvedDecisionAt,
  });
  workflowTasks.push({
    id: "workflow-task-wo-recent-aug-111-plumbing-close", organizationId: organization.id, workOrderId: resolvedWork.id,
    taskType: "close_verified_work", title: "Close verified work", reason: "The current visit outcome was accepted and the resolved work remains open pending explicit closure.",
    assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator", priority: "normal", status: "open",
    blocking: true, requiredForProgress: true, dueAt: at(8, 25, 17), applicableSlaClock: "verification",
    completionCriteria: "Confirm no active visit, open follow-up, or other required task remains, then close the work order.",
    escalationDestination: "Facilities director", escalationLevel: 0, createdByActorType: "user", createdByActorId: "membership-northline-facilities",
    createdByActorName: "Jordan Lee", createdAt: resolvedDecisionAt,
  });

  // Store 112's rejected decision is append-only. A bounded return-work task
  // was completed by the later visit check-in; current service evidence is not
  // rewritten and the work order remains active.
  const rejectedOutcome = siteVisitWorkOrders.find((row) => row.visitId === rejectedVisitId && row.workOrderId === "wo-northline-112")!;
  const rejectedDecisionAt = at(8, 9, 19);
  workOrderVerifications.push({
    id: "verification-wo-northline-112-cycle-1", organizationId: organization.id, workOrderId: "wo-northline-112",
    siteVisitWorkOrderId: rejectedOutcome.id, outcome: rejectedOutcome.outcome!, outcomeRecordedAt: rejectedOutcome.outcomeRecordedAt!, cycle: 1,
    decision: "rejected", reason: "Store temperature rose again after the technician departed; return service is required.",
    decidedByMembershipId: "membership-northline-facilities", decidedByName: "Jordan Lee", decidedAt: rejectedDecisionAt,
  });
  workflowTasks.push(
    {
      id: "workflow-task-wo-northline-112-rejected-verification", organizationId: organization.id, workOrderId: "wo-northline-112",
      taskType: "verify_repair", title: "Verify operating condition after technician checkout", reason: "Store operations must confirm the repair before service review is complete.",
      assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator", priority: "high", status: "completed",
      blocking: true, requiredForProgress: true, dueAt: at(8, 10, 12), applicableSlaClock: "verification",
      completionCriteria: "Record an accepted or rejected decision against the exact visit outcome.", escalationDestination: "Facilities director", escalationLevel: 0,
      createdByActorType: "system", createdByActorName: "Deterministic demo fixture", createdAt: at(8, 9, 18),
      completedByActorType: "user", completedByActorId: "membership-northline-facilities", completedByActorName: "Jordan Lee", completedAt: rejectedDecisionAt,
      resolutionNote: "Rejected after the reported operating condition returned.",
    },
    {
      id: "workflow-task-wo-northline-112-return-cycle-1", organizationId: organization.id, workOrderId: "wo-northline-112",
      taskType: "schedule_return_visit", title: "Return to restore rooftop-unit cooling", reason: "The accepted-looking repair outcome was rejected after the store condition recurred.",
      assigneeType: "vendor", assigneeId: "vendor-northline-cedar", assigneeName: "ClearFlow HVAC, Plumbing & Kitchen Repair", priority: "high", status: "completed",
      blocking: true, requiredForProgress: true, dueAt: at(8, 10, 17, 15), applicableSlaClock: "scheduling",
      completionCriteria: "ClearFlow HVAC, Plumbing & Kitchen Repair begins the accountable return visit.", escalationDestination: "Facilities director", escalationLevel: 0,
      createdByActorType: "user", createdByActorId: "membership-northline-facilities", createdByActorName: "Jordan Lee", createdAt: rejectedDecisionAt,
      completedByActorType: "technician", completedByActorName: "ClearFlow HVAC, Plumbing & Kitchen Repair technician", completedAt: at(8, 25, 17, 15),
      resolutionNote: "Return visit checked in and service resumed.",
    },
  );

  // Audit and outbox facts are derived from the same deterministic source
  // records, so the showcase can demonstrate provenance and delivery state.
  const heldWorkSeed: Array<{ workOrder: WorkOrder; posture: "complete_using_professional_judgment" | "look_and_report"; threshold?: number }> = [
    { workOrder: { id: "wo-held-104-restroom-door", organizationId: organization.id, number: "CPS-2026-0401", storeId: "store-northline-104", problem: "Restroom door closer no longer pulls the door fully shut", authorizedScope: "Adjust or replace the door-closer hardware if the condition is minor; report back if the door or frame needs larger work.", categoryKey: "plumbing", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 22, 17), escalationTo: "Facilities director", createdAt: at(8, 23, 14) }, posture: "complete_using_professional_judgment", threshold: 25_000 },
    { workOrder: { id: "wo-held-104-canopy-light", organizationId: organization.id, number: "CPS-2026-0402", storeId: "store-northline-104", problem: "One canopy light over pump 6 is out", authorizedScope: "Inspect the light and restore it if routine parts and access are sufficient; report findings if fixture or circuit work is needed.", categoryKey: "electrical", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 12, 17), escalationTo: "Facilities director", createdAt: at(8, 24, 13) }, posture: "look_and_report" },
    { workOrder: { id: "wo-held-104-lot-sign", organizationId: organization.id, number: "CPS-2026-0403", storeId: "store-northline-104", problem: "Small parking-direction sign is leaning near the rear entrance", authorizedScope: "Reset and secure the sign if it can be completed with ordinary onsite materials.", categoryKey: "exterior", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(10, 1, 17), escalationTo: "Facilities director", createdAt: at(8, 24, 15) }, posture: "complete_using_professional_judgment", threshold: 20_000 },
    { workOrder: { id: "wo-held-104-prep-sink", organizationId: organization.id, number: "CPS-2026-0404", storeId: "store-northline-104", problem: "Prep-sink faucet drips after the handle is closed", authorizedScope: "Repair the faucet if the cause is a routine cartridge, seal, or adjustment; report back if larger plumbing work is needed.", categoryKey: "plumbing", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 29, 17), escalationTo: "Facilities director", createdAt: at(8, 20, 11) }, posture: "complete_using_professional_judgment", threshold: 22_500 },
    { workOrder: { id: "wo-held-107-curb-stop", organizationId: organization.id, number: "CPS-2026-0405", storeId: "store-northline-107", problem: "One concrete parking stop is loose near the side entrance", authorizedScope: "Reset and secure the parking stop if the existing concrete and hardware allow a routine repair.", categoryKey: "exterior", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 18, 17), escalationTo: "Facilities director", createdAt: at(8, 16, 10) }, posture: "complete_using_professional_judgment", threshold: 30_000 },
    { workOrder: { id: "wo-held-107-stockroom-light", organizationId: organization.id, number: "CPS-2026-0406", storeId: "store-northline-107", problem: "Stockroom ceiling light flickers after it has been on for several minutes", authorizedScope: "Inspect and restore the light if a routine lamp, driver, or connection repair is appropriate; report back on broader circuit work.", categoryKey: "electrical", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 15, 17), escalationTo: "Facilities director", createdAt: at(8, 18, 9) }, posture: "complete_using_professional_judgment", threshold: 27_500 },
    { workOrder: { id: "wo-held-107-restroom-faucet", organizationId: organization.id, number: "CPS-2026-0407", storeId: "store-northline-107", problem: "Public-restroom faucet has low flow compared with the other sink", authorizedScope: "Inspect the faucet and report the likely repair, parts, and urgency before completing work.", categoryKey: "plumbing", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(10, 6, 17), escalationTo: "Facilities director", createdAt: at(8, 22, 12) }, posture: "look_and_report" },
    { workOrder: { id: "wo-held-102-sidewalk-light", organizationId: organization.id, number: "CPS-2026-0408", storeId: "store-northline-102", problem: "Sidewalk light at the employee entrance does not turn on", authorizedScope: "Inspect and restore the light if the repair is routine; report back if underground wiring or a new fixture is needed.", categoryKey: "electrical", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 20, 17), escalationTo: "Facilities director", createdAt: at(8, 19, 15) }, posture: "complete_using_professional_judgment", threshold: 30_000 },
    { workOrder: { id: "wo-held-105-stockroom-door", organizationId: organization.id, number: "CPS-2026-0409", storeId: "store-northline-105", problem: "Stockroom door rubs the frame and is difficult to latch", authorizedScope: "Adjust the hinges, latch, or closer if this is routine door hardware work; report back if the frame is damaged.", categoryKey: "plumbing", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 30, 17), escalationTo: "Facilities director", createdAt: at(8, 21, 13) }, posture: "complete_using_professional_judgment", threshold: 25_000 },
    { workOrder: { id: "wo-held-109-curb-paint", organizationId: organization.id, number: "CPS-2026-0410", storeId: "store-northline-109", problem: "Yellow curb marking at the delivery entrance is worn and hard to see", authorizedScope: "Refresh the marked curb section using the existing layout and appropriate exterior coating.", categoryKey: "exterior", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(10, 10, 17), escalationTo: "Facilities director", createdAt: at(8, 17, 14) }, posture: "complete_using_professional_judgment", threshold: 35_000 },
    { workOrder: { id: "wo-held-112-rear-light", organizationId: organization.id, number: "CPS-2026-0411", storeId: "store-northline-112", problem: "Rear delivery-door wall light stays off after dark", authorizedScope: "Inspect and restore the wall light if routine fixture, photocell, or connection work is sufficient.", categoryKey: "electrical", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 16, 17), escalationTo: "Facilities director", createdAt: at(8, 22, 16) }, posture: "complete_using_professional_judgment", threshold: 30_000 },
    { workOrder: { id: "wo-held-114-landscape-edging", organizationId: organization.id, number: "CPS-2026-0412", storeId: "store-northline-114", problem: "Landscape edging is lifted beside the front sidewalk", authorizedScope: "Reset and secure the loose edging and remove any immediate trip exposure in the affected section.", categoryKey: "exterior", priority: "planned", status: "approved", version: 0, accountableParty: "Facilities coordinator", nextAction: "Wait for a matching vendor visit", dueAt: at(9, 24, 17), escalationTo: "Facilities director", createdAt: at(8, 20, 14) }, posture: "complete_using_professional_judgment", threshold: 20_000 },
  ];
  const workOrderVisitHolds: NonNullable<OpsFixture["workOrderVisitHolds"]> = heldWorkSeed.map(({ workOrder, posture, threshold }, index) => {
    workOrder.nextAction = "Approved for a future vendor visit";
    workOrders.push(workOrder);
    workflowTasks.push({ id: `workflow-task-${workOrder.id}-hold`, organizationId: organization.id, workOrderId: workOrder.id, taskType: "choose_service_provider", title: "Approved for a future vendor visit", reason: "A manager approved this low-priority item for another appropriate vendor visit or one combined visit with other approved jobs.", assigneeType: "role", assigneeRole: "facilities_admin", assigneeName: "Facilities coordinator", priority: "low", status: "open", blocking: true, requiredForProgress: true, dueAt: workOrder.dueAt!, applicableSlaClock: "scheduling", completionCriteria: "The job is included in an appropriate vendor visit, sent separately, or reviewed by facilities.", escalationDestination: "Facilities director", escalationLevel: 0, createdByActorType: "user", createdByActorId: "membership-northline-facilities", createdByActorName: "Jordan Lee", createdAt: workOrder.createdAt });
    return { id: `visit-hold-${index + 1}`, organizationId: organization.id, workOrderId: workOrder.id, posture, status: "active", internalReviewThreshold: threshold === undefined ? undefined : { amountMinor: threshold, currency: "USD" }, deadlineAt: workOrder.dueAt!, version: 0, createdByMembershipId: "membership-northline-facilities", createdByName: "Jordan Lee", createdAt: workOrder.createdAt, updatedAt: workOrder.createdAt };
  });
  const vendorComplianceAlerts: NonNullable<OpsFixture["vendorComplianceAlerts"]> = [
    { id: "compliance-alert-brightpath-insurance-30", organizationId: organization.id, vendorId: "vendor-northline-brightpath", documentId: "compliance-brightpath-insurance-2026", stage: "30_day", expiresAt: atYear(2026, 9, 15), reminderId: "vendor-reminder-brightpath-coi", createdAt: at(8, 25, 8) },
  ];

  const addAudit = (event: AuditEvent) => {
    if (!auditEvents.some((candidate) => candidate.aggregateId === event.aggregateId && candidate.eventType === event.eventType)) auditEvents.push(event);
  };
  requests.forEach((request) => addAudit({ id: `audit-source-request-${request.id}`, organizationId: organization.id, aggregateType: "service_request", aggregateId: request.id, eventType: "request.submitted", actorType: "user", actorName: request.reporterName, occurredAt: request.submittedAt, payloadJson: JSON.stringify({ storeId: request.storeId, reference: request.reference }) }));
  requestImpactAssessments.forEach((assessment) => addAudit({
    id: `audit-source-${assessment.id}`,
    organizationId: assessment.organizationId,
    aggregateType: "request",
    aggregateId: assessment.requestId,
    eventType: assessment.assessmentKind === "initial_report" ? "request.impact_assessed" : "request.impact_reviewed",
    actorType: assessment.assessedByActorType,
    actorId: assessment.assessedByActorId,
    actorName: assessment.assessedByActorName,
    occurredAt: assessment.assessedAt,
    payloadJson: JSON.stringify({ assessmentId: assessment.id, storeId: assessment.storeId, assessmentKind: assessment.assessmentKind, reviewDisposition: assessment.reviewDisposition, confidence: assessment.confidence, source: assessment.source, estimateCaveat: "Exposure and downtime estimates are not verified losses" }),
  }));
  workOrders.forEach((workOrder) => addAudit({ id: `audit-source-work-order-${workOrder.id}`, organizationId: organization.id, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "work_order.created", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: workOrder.createdAt, payloadJson: JSON.stringify({ storeId: workOrder.storeId, requestId: workOrder.requestId }) }));
  assignments.forEach((assignment) => addAudit({ id: `audit-source-assignment-${assignment.id}`, organizationId: organization.id, aggregateType: "work_order_assignment", aggregateId: assignment.id, eventType: "work_order.assigned", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: assignment.assignedAt, payloadJson: JSON.stringify({ workOrderId: assignment.workOrderId, kind: assignment.kind, vendorId: assignment.vendorId, internalMembershipId: assignment.internalMembershipId }) }));
  issuances.forEach((issuance) => addAudit({ id: `audit-source-issuance-${issuance.id}`, organizationId: organization.id, aggregateType: "work_order", aggregateId: issuance.workOrderId, eventType: `work_order.issued.r${issuance.revision}`, actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: issuance.issuedAt, payloadJson: JSON.stringify({ issuanceId: issuance.id, assignmentId: issuance.assignmentId, revision: issuance.revision, channel: issuance.channel }) }));
  vendorResponses.forEach((response) => addAudit({ id: `audit-source-response-${response.id}`, organizationId: organization.id, aggregateType: "vendor_response", aggregateId: response.id, eventType: "vendor.response_recorded", actorType: "vendor_link", actorName: response.responderName, occurredAt: response.respondedAt, payloadJson: JSON.stringify({ workOrderId: response.workOrderId, responseId: response.id, issuanceId: response.issuanceId, response: response.response }) }));
  visits.forEach((visit) => {
    const visitWork = siteVisitWorkOrders.filter((row) => row.organizationId === visit.organizationId && row.visitId === visit.id).sort((left, right) => left.ordinal - right.ordinal);
    addAudit({ id: `audit-source-visit-${visit.id}-in`, organizationId: organization.id, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_in", actorType: visit.providerKind === "internal" ? "user" : "technician", actorId: visit.internalMembershipId, actorName: visit.technicianName, occurredAt: visit.checkedInAt, payloadJson: JSON.stringify({ storeId: visit.storeId, workOrderId: visitWork.length === 1 ? visitWork[0].workOrderId : undefined, workOrderIds: visitWork.map((row) => row.workOrderId), vendorId: visit.vendorId, channel: visit.startedChannel, presenceBasis: "approximate_presence_not_labor" }) });
    if (visit.checkedOutAt) addAudit({ id: `audit-source-visit-${visit.id}-out`, organizationId: organization.id, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_out", actorType: visit.providerKind === "internal" ? "user" : "technician", actorId: visit.internalMembershipId, actorName: visit.technicianName, occurredAt: visit.checkedOutAt, payloadJson: JSON.stringify({ outcome: visitWork.length === 1 ? visit.outcome : undefined, workOrderIds: visitWork.map((row) => row.workOrderId), perWorkOrderOutcomes: visitWork.map((row) => ({ workOrderId: row.workOrderId, outcome: row.outcome, followUpId: row.followUpId })), observedDurationSeconds: visit.observedDurationSeconds, presenceBasis: "approximate_presence_not_labor" }) });
  });
  costLines.forEach((cost) => addAudit({ id: `audit-source-cost-${cost.id}`, organizationId: organization.id, aggregateType: "work_order", aggregateId: cost.workOrderId, eventType: "work_order.cost_recorded", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: cost.recordedAt, payloadJson: JSON.stringify({ costLineId: cost.id, kind: cost.kind, amountMinor: cost.amount.amountMinor, currency: cost.amount.currency }) }));
  invoiceReferences.forEach((invoice) => addAudit({ id: `audit-source-invoice-${invoice.id}`, organizationId: organization.id, aggregateType: "invoice_reference", aggregateId: invoice.id, eventType: "invoice_reference.recorded", actorType: "user", actorId: "membership-northline-finance", actorName: "Parker Shaw", occurredAt: invoice.createdAt, payloadJson: JSON.stringify({ vendorId: invoice.vendorId, invoiceNumber: invoice.invoiceNumber, matchStatus: invoice.matchStatus, operatorWorkOrderNumber: invoice.operatorWorkOrderNumber }) }));
  pmOccurrences.forEach((occurrence) => addAudit({ id: `audit-source-pm-${occurrence.id}`, organizationId: organization.id, aggregateType: "pm_occurrence", aggregateId: occurrence.id, eventType: `pm_occurrence.${occurrence.status}`, actorType: occurrence.status === "completed" ? "user" : "system", actorId: occurrence.status === "completed" ? "membership-northline-tech-1" : undefined, actorName: occurrence.status === "completed" ? "Clark Pump and Shop Maintenance" : "Automated PM schedule", occurredAt: occurrence.completedAt ?? (occurrence.status === "missed" ? occurrence.windowEndsAt : NORTHLINE_AS_OF), payloadJson: JSON.stringify({ planId: occurrence.planId, storeId: occurrence.storeId, workOrderId: occurrence.workOrderId, dueAt: occurrence.dueAt, windowStartsAt: occurrence.windowStartsAt, windowEndsAt: occurrence.windowEndsAt }) }));
  files.forEach((file) => addAudit({ id: `audit-source-file-${file.id}`, organizationId: organization.id, aggregateType: "file", aggregateId: file.id, eventType: "file.available", actorType: "technician", actorName: "Service technician", occurredAt: file.createdAt, payloadJson: JSON.stringify({ originalName: file.originalName, contentType: file.contentType, byteLength: file.byteLength }) }));
  exceptions.forEach((exception) => addAudit({ id: `audit-source-exception-${exception.id}`, organizationId: organization.id, aggregateType: "exception", aggregateId: exception.id, eventType: "exception.detected", actorType: "system", actorName: "Automated service rules", occurredAt: exception.detectedAt, payloadJson: JSON.stringify({ kind: exception.kind, storeId: exception.storeId, workOrderId: exception.workOrderId, visitId: exception.visitId, severity: exception.severity }) }));
  approvalRequests.forEach((request) => addAudit({ id: `audit-source-approval-request-${request.id}`, organizationId: organization.id, aggregateType: "approval_request", aggregateId: request.id, eventType: "approval.requested", actorType: "user", actorId: request.requestedByMembershipId, actorName: request.requestedByName, occurredAt: request.requestedAt, payloadJson: JSON.stringify({ subjectType: request.subjectType, subjectId: request.subjectId, policyId: request.policyId, policyVersion: request.policyVersion, requiredRole: request.requiredRole, amountMinor: request.amount.amountMinor, currency: request.amount.currency, parentApprovalRequestId: request.parentApprovalRequestId }) }));
  approvalDecisions.forEach((decision) => addAudit({ id: `audit-source-approval-decision-${decision.id}`, organizationId: organization.id, aggregateType: "approval_request", aggregateId: decision.approvalRequestId, eventType: `approval.${decision.decision}`, actorType: "user", actorId: decision.decidedByMembershipId, actorName: decision.decidedByName, occurredAt: decision.decidedAt, payloadJson: JSON.stringify({ decisionId: decision.id, decidedByRole: decision.decidedByRole, reason: decision.reason, escalatedToRole: decision.escalatedToRole }) }));
  workOrderVerifications.forEach((verification) => addAudit({ id: `audit-source-${verification.id}`, organizationId: verification.organizationId, aggregateType: "work_order", aggregateId: verification.workOrderId, eventType: verification.decision === "verified" ? "work_order.verified_and_resolved" : "work_order.verification_rejected", actorType: "user", actorId: verification.decidedByMembershipId, actorName: verification.decidedByName, occurredAt: verification.decidedAt, payloadJson: JSON.stringify({ verificationId: verification.id, siteVisitWorkOrderId: verification.siteVisitWorkOrderId, outcome: verification.outcome, outcomeRecordedAt: verification.outcomeRecordedAt, cycle: verification.cycle, decision: verification.decision, reason: verification.reason }) }));
  workflowTasks.forEach((task) => addAudit({ id: `audit-source-workflow-task-${task.id}`, organizationId: task.organizationId, aggregateType: "workflow_task", aggregateId: task.id, eventType: "workflow_task.created", actorType: task.createdByActorType, actorId: task.createdByActorId, actorName: task.createdByActorName, occurredAt: task.createdAt, payloadJson: JSON.stringify({ workOrderId: task.workOrderId, serviceRequestId: task.serviceRequestId, taskType: task.taskType, assigneeType: task.assigneeType, blocking: task.blocking, dueAt: task.dueAt, noSlaReason: task.noSlaReason }) }));
  workflowTaskSlaPauses.forEach((pause) => auditEvents.push({ id: `audit-source-workflow-pause-${pause.id}`, organizationId: pause.organizationId, aggregateType: "workflow_task", aggregateId: pause.workflowTaskId, eventType: "workflow_task.sla_paused", actorType: pause.pausedByActorType, actorId: pause.pausedByActorId, actorName: pause.pausedByActorName, occurredAt: pause.pausedAt, payloadJson: JSON.stringify({ pauseId: pause.id, workOrderId: pause.workOrderId, reasonCode: pause.reasonCode, ownerType: pause.ownerType, ownerId: pause.ownerId, affectedClocks: pause.affectedClocks, expectedResumeAt: pause.expectedResumeAt }) }));
  workflowTaskSlaResumes.forEach((resume) => auditEvents.push({ id: `audit-source-workflow-resume-${resume.id}`, organizationId: resume.organizationId, aggregateType: "workflow_task", aggregateId: resume.workflowTaskId, eventType: "workflow_task.sla_resumed", actorType: resume.resumedByActorType, actorId: resume.resumedByActorId, actorName: resume.resumedByActorName, occurredAt: resume.resumedAt, payloadJson: JSON.stringify({ resumeId: resume.id, pauseId: resume.pauseId, workOrderId: resume.workOrderId, note: resume.note }) }));

  issuances.forEach((issuance) => outboxMessages.push({ id: `outbox-issuance-${issuance.id}`, organizationId: organization.id, topic: "ops.work_order.issued", aggregateType: "work_order", aggregateId: issuance.workOrderId, payloadJson: JSON.stringify({ issuanceId: issuance.id, assignmentId: issuance.assignmentId, channel: issuance.channel }), status: "pending", availableAt: issuance.issuedAt, createdAt: issuance.issuedAt }));
  exceptions.filter((exception) => exception.status !== "resolved").forEach((exception) => outboxMessages.push({ id: `outbox-exception-${exception.id}`, organizationId: organization.id, topic: "ops.exception.detected", aggregateType: "exception", aggregateId: exception.id, payloadJson: JSON.stringify({ kind: exception.kind, storeId: exception.storeId, severity: exception.severity }), status: "delivered", availableAt: exception.detectedAt, createdAt: exception.detectedAt }));
  visits.filter((visit) => visit.status === "active").forEach((visit) => { const workOrderIds = siteVisitWorkOrders.filter((row) => row.organizationId === visit.organizationId && row.visitId === visit.id).sort((left, right) => left.ordinal - right.ordinal).map((row) => row.workOrderId); outboxMessages.push({ id: `outbox-active-visit-${visit.id}`, organizationId: organization.id, topic: "ops.visit.checked_in", aggregateType: "visit", aggregateId: visit.id, payloadJson: JSON.stringify({ storeId: visit.storeId, vendorId: visit.vendorId, workOrderId: workOrderIds.length === 1 ? workOrderIds[0] : undefined, workOrderIds }), status: "delivered", availableAt: visit.checkedInAt, createdAt: visit.checkedInAt }); });
  approvalRequests.filter((request) => !approvalDecisions.some((decision) => decision.approvalRequestId === request.id)).forEach((request) => outboxMessages.push({ id: `outbox-approval-request-${request.id}`, organizationId: organization.id, topic: "ops.approval.requested", aggregateType: "approval_request", aggregateId: request.id, payloadJson: JSON.stringify({ subjectType: request.subjectType, subjectId: request.subjectId, requiredRole: request.requiredRole, amountMinor: request.amount.amountMinor, currency: request.amount.currency }), status: "pending", availableAt: request.requestedAt, createdAt: request.requestedAt }));
  workOrderVerifications.forEach((verification) => outboxMessages.push({ id: `outbox-${verification.id}`, organizationId: verification.organizationId, topic: verification.decision === "verified" ? "ops.work_order.resolved" : "ops.work_order.verification_rejected", aggregateType: "work_order", aggregateId: verification.workOrderId, payloadJson: JSON.stringify({ verificationId: verification.id, siteVisitWorkOrderId: verification.siteVisitWorkOrderId, cycle: verification.cycle, decision: verification.decision }), status: "pending", availableAt: verification.decidedAt, createdAt: verification.decidedAt }));
  workflowTasks.forEach((task) => outboxMessages.push({ id: `outbox-workflow-task-${task.id}`, organizationId: task.organizationId, topic: "ops.workflow_task.created", aggregateType: "workflow_task", aggregateId: task.id, payloadJson: JSON.stringify({ workOrderId: task.workOrderId, serviceRequestId: task.serviceRequestId, taskType: task.taskType, assigneeType: task.assigneeType, blocking: task.blocking, dueAt: task.dueAt, noSlaReason: task.noSlaReason }), status: "pending", availableAt: task.createdAt, createdAt: task.createdAt }));

  const notificationRules: NonNullable<OpsFixture["notificationRules"]> = [
    { id: "notification-rule-vendor-response", organizationId: organization.id, eventKey: "vendor_response_received", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-vendor-commitment-facilities", organizationId: organization.id, eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-vendor-commitment-store", organizationId: organization.id, eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "store_manager", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-vendor-commitment-region", organizationId: organization.id, eventKey: "vendor_commitment_received", emailEnabled: true, recipientRole: "regional_manager", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-workflow-escalated", organizationId: organization.id, eventKey: "workflow_task_escalated", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-follow-up", organizationId: organization.id, eventKey: "follow_up_created", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-vendor-reminder", organizationId: organization.id, eventKey: "vendor_reminder_created", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-held-claimed-facilities", organizationId: organization.id, eventKey: "held_work_claimed", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-held-claimed-store", organizationId: organization.id, eventKey: "held_work_claimed", emailEnabled: true, recipientRole: "store_manager", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-held-outcomes-facilities", organizationId: organization.id, eventKey: "held_work_outcomes_recorded", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-held-outcomes-store", organizationId: organization.id, eventKey: "held_work_outcomes_recorded", emailEnabled: true, recipientRole: "store_manager", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
    { id: "notification-rule-compliance-facilities", organizationId: organization.id, eventKey: "vendor_compliance_due", emailEnabled: true, recipientRole: "facilities_admin", updatedByMembershipId: "membership-northline-facilities", createdAt: at(8, 1, 8), updatedAt: at(8, 1, 8) },
  ];

  const publicTokens: PublicActionToken[] = [
    { id: "public-token-northline-store-104", organizationId: organization.id, purpose: "store_gateway", subjectType: "store", subjectId: "store-northline-104", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.store104, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-service-104", organizationId: organization.id, purpose: "service_authorization", subjectType: "work_order_issuance", subjectId: publicIssuanceId, tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.serviceAuthorization104, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-upcoming-service-104", organizationId: organization.id, purpose: "service_authorization", subjectType: "work_order_issuance", subjectId: "issuance-upcoming-104-sign-lighting-r1", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.upcomingService104, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 24, 11, 12) },
    { id: "public-token-northline-visit-112", organizationId: organization.id, purpose: "active_visit", subjectType: "visit", subjectId: NORTHLINE_DEMO_HANDLES.activeVisitId, tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.activeVisit112, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-trusted-store-104", organizationId: organization.id, purpose: "trusted_store_device", subjectType: "store", subjectId: "store-northline-104", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.trustedStore104, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-estimate-105-summit", organizationId: organization.id, purpose: "vendor_estimate", subjectType: "work_order_estimate_request", subjectId: "estimate-request-105-summit", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.estimate105Summit, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 10, 14, 50) },
    { id: "public-token-northline-estimate-105-cedar", organizationId: organization.id, purpose: "vendor_estimate", subjectType: "work_order_estimate_request", subjectId: "estimate-request-105-cedar", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.estimate105Cedar, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 10, 14, 51) },
    { id: "public-token-northline-service-run-summit", organizationId: organization.id, purpose: "service_run_response", subjectType: "service_run", subjectId: "service-run-summit-north-2026-08-24", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.serviceRunSummit, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 10, 16) },
  ];

  return { asOf: NORTHLINE_AS_OF, organizations: [organization], divisions, regions, taxonomyNodes, equipmentTemplates, componentTemplates, stores, users, memberships, scopeGrants, vendors, vendorReminders, vendorSpecialties, vendorCoverage, vendorQualifications, vendorComplianceDocuments, vendorComplianceAlerts, vendorContracts, contractVersions, contractScopes, rateCardLines, serviceLevelPolicies, schedulingPolicies, vendorCapacity, requests, requestImpactAssessments, workOrders, workOrderVisitHolds, approvalPolicies, approvalRequests, approvalDecisions, assignments, issuances, vendorResponses, serviceAppointments, vendorContinuations, estimateRequests, estimateProposals, visits, siteVisitWorkOrders, workOrderVerifications, visitEvidence, files, entityFiles, followUps, workflowTasks, workflowTaskSlaPauses, workflowTaskSlaResumes, exceptions, assets, replacementProfiles, replacementBenchmarks, assetReplacementOverrides, replacementEvents, lifecycleRecommendations, components, componentLifecycleEvents, maintenancePrograms, checklistTemplates, pmPlans, pmOccurrences, pmWorkItems, checklistResponses, serviceRuns, routeStops, serviceRunWorkOrders, serviceRunResponses, vendorWarrantyProfiles, warrantyRules, warrantyCoverageLines, repairItems, appliedWarranties, warrantyAmendments, manufacturerWarranties, warrantyCases, quotes, authorizations, invoices, invoiceLines, invoiceLineAllocations, invoiceExceptions, invoiceAdjustments, serviceDiscrepancies, valueEvents, costLines, invoiceReferences, invoiceAllocations, auditEvents, notificationRules, outboxMessages, publicTokens };
}

const presentationFixture = buildFixture();

export function buildNorthlinePresentationFixture(): OpsFixture {
  return clone(presentationFixture);
}

export const NORTHLINE_PRESENTATION_FIXTURE: Readonly<OpsFixture> = presentationFixture;

export function buildSyntheticScaleFixture(storeCount = 65): OpsFixture {
  if (!Number.isInteger(storeCount) || storeCount < 1) throw new Error("storeCount must be a positive integer");
  const fixture = buildNorthlinePresentationFixture();
  const sourceStores = fixture.stores;
  fixture.stores = Array.from({ length: storeCount }, (_, index) => {
    const source = sourceStores[index % sourceStores.length];
    const storeNumber = String(2001 + index);
    return { ...source, id: `store-scale-${storeNumber}`, regionId: fixture.regions[index % fixture.regions.length].id, storeNumber, name: `Scale Fixture Store ${storeNumber}`, address1: `${500 + index} Load Test Avenue`, aliases: [`Store ${storeNumber}`], latitudeE6: source.latitudeE6! + index * 50, longitudeE6: source.longitudeE6! - index * 50 };
  });
  fixture.requests = [];
  fixture.requestImpactAssessments = [];
  fixture.workOrders = [];
  fixture.approvalPolicies = [];
  fixture.approvalRequests = [];
  fixture.vendorQualifications = [];
  fixture.vendorReminders = [];
  fixture.vendorComplianceDocuments = [];
  fixture.vendorContracts = [];
  fixture.contractVersions = [];
  fixture.contractScopes = [];
  fixture.rateCardLines = [];
  fixture.serviceLevelPolicies = [];
  fixture.schedulingPolicies = [];
  fixture.vendorCapacity = [];
  fixture.approvalDecisions = [];
  fixture.assignments = [];
  fixture.issuances = [];
  fixture.vendorResponses = [];
  fixture.estimateRequests = [];
  fixture.estimateProposals = [];
  fixture.visits = [];
  fixture.siteVisitWorkOrders = [];
  fixture.workOrderVerifications = [];
  fixture.visitEvidence = [];
  fixture.files = [];
  fixture.entityFiles = [];
  fixture.followUps = [];
  fixture.workflowTasks = [];
  fixture.workflowTaskSlaPauses = [];
  fixture.workflowTaskSlaResumes = [];
  fixture.exceptions = [];
  fixture.assets = [];
  fixture.replacementProfiles = [];
  fixture.replacementBenchmarks = [];
  fixture.assetReplacementOverrides = [];
  fixture.replacementEvents = [];
  fixture.lifecycleRecommendations = [];
  fixture.components = [];
  fixture.componentLifecycleEvents = [];
  fixture.maintenancePrograms = [];
  fixture.checklistTemplates = [];
  fixture.pmPlans = [];
  fixture.pmOccurrences = [];
  fixture.pmWorkItems = [];
  fixture.checklistResponses = [];
  fixture.serviceRuns = [];
  fixture.routeStops = [];
  fixture.serviceRunWorkOrders = [];
  fixture.serviceRunResponses = [];
  fixture.vendorWarrantyProfiles = [];
  fixture.warrantyRules = [];
  fixture.warrantyCoverageLines = [];
  fixture.repairItems = [];
  fixture.appliedWarranties = [];
  fixture.warrantyAmendments = [];
  fixture.manufacturerWarranties = [];
  fixture.warrantyCases = [];
  fixture.quotes = [];
  fixture.authorizations = [];
  fixture.invoices = [];
  fixture.invoiceLines = [];
  fixture.invoiceLineAllocations = [];
  fixture.invoiceExceptions = [];
  fixture.invoiceAdjustments = [];
  fixture.serviceDiscrepancies = [];
  fixture.valueEvents = [];
  fixture.costLines = [];
  fixture.invoiceReferences = [];
  fixture.invoiceAllocations = [];
  fixture.auditEvents = [];
  fixture.outboxMessages = [];
  fixture.publicTokens = [];
  return fixture;
}

/**
 * A deliberately dense analytics fixture. Unlike buildSyntheticScaleFixture,
 * this retains equipment structure and creates enough dated work and cost
 * history to exercise Trends at a regional-chain scale.
 */
export function buildSyntheticTrendScaleFixture(storeCount = 65, monthCount = 36): OpsFixture {
  if (!Number.isInteger(storeCount) || storeCount < 1) throw new Error("storeCount must be a positive integer");
  if (!Number.isInteger(monthCount) || monthCount < 18) throw new Error("monthCount must be an integer of at least 18");
  const source = buildNorthlinePresentationFixture();
  const fixture = buildSyntheticScaleFixture(storeCount);
  fixture.replacementProfiles = clone(source.replacementProfiles);
  fixture.asOf = source.asOf;

  const sourceAssetsByStore = new Map<string, Asset[]>();
  for (const asset of source.assets) sourceAssetsByStore.set(asset.storeId, [...(sourceAssetsByStore.get(asset.storeId) ?? []), asset]);
  const sourceComponentsByAsset = new Map<string, AssetComponent[]>();
  for (const component of source.components) sourceComponentsByAsset.set(component.assetId, [...(sourceComponentsByAsset.get(component.assetId) ?? []), component]);
  const assetIdsByStore = new Map<string, string[]>();

  fixture.assets = [];
  fixture.components = [];
  for (const [storeIndex, store] of fixture.stores.entries()) {
    const sourceStore = source.stores[storeIndex % source.stores.length];
    const sourceAssets = sourceAssetsByStore.get(sourceStore.id) ?? [];
    const ids: string[] = [];
    for (const [assetIndex, sourceAsset] of sourceAssets.entries()) {
      const assetId = `asset-scale-${storeIndex + 1}-${assetIndex + 1}`;
      ids.push(assetId);
      fixture.assets.push({
        ...sourceAsset,
        id: assetId,
        storeId: store.id,
        assetTag: `S${store.storeNumber}-${String(assetIndex + 1).padStart(2, "0")}`,
        serialNumber: `SCALE-${storeIndex + 1}-${assetIndex + 1}`,
      });
      for (const [componentIndex, sourceComponent] of (sourceComponentsByAsset.get(sourceAsset.id) ?? []).entries()) {
        fixture.components.push({
          ...sourceComponent,
          id: `component-scale-${storeIndex + 1}-${assetIndex + 1}-${componentIndex + 1}`,
          assetId,
          parentComponentId: undefined,
        });
      }
    }
    assetIdsByStore.set(store.id, ids);
  }

  const sourceWork = source.workOrders.find((row) => row.organizationId === source.organizations[0].id)!;
  const sourceCost = source.costLines[0]!;
  const asOfMonth = source.asOf.slice(0, 7);
  const [asOfYear, asOfMonthNumber] = asOfMonth.split("-").map(Number);
  fixture.workOrders = [];
  fixture.costLines = [];
  for (const [storeIndex, store] of fixture.stores.entries()) {
    const assetIds = assetIdsByStore.get(store.id) ?? [];
    for (let monthIndex = 0; monthIndex < monthCount; monthIndex += 1) {
      const date = new Date(Date.UTC(asOfYear, asOfMonthNumber - monthCount + monthIndex, 10, 12));
      const serviceDate = date.toISOString().slice(0, 10);
      const jobsThisMonth = 1 + ((storeIndex + monthIndex) % 2);
      for (let jobIndex = 0; jobIndex < jobsThisMonth; jobIndex += 1) {
        const assetId = assetIds[(monthIndex * 2 + jobIndex) % assetIds.length];
        const asset = fixture.assets.find((row) => row.id === assetId)!;
        const workOrderId = `work-scale-${storeIndex + 1}-${monthIndex + 1}-${jobIndex + 1}`;
        const createdAt = `${serviceDate}T13:00:00.000Z`;
        const seasonalFactor = [5, 6, 7].includes(date.getUTCMonth()) && (asset.categoryKey === "refrigeration" || asset.categoryKey === "hvac") ? 1.7 : 1;
        const baseAmountMinor = 38_000 + ((storeIndex * 17 + monthIndex * 29 + jobIndex * 11) % 190_000);
        const amountMinor = Math.round(baseAmountMinor * seasonalFactor * ((storeIndex + monthIndex) % 29 === 0 ? 2.6 : 1));
        fixture.workOrders.push({
          ...sourceWork,
          id: workOrderId,
          number: `SCALE-${store.storeNumber}-${String(monthIndex + 1).padStart(2, "0")}-${jobIndex + 1}`,
          storeId: store.id,
          requestId: undefined,
          problem: `${asset.name} service history`,
          authorizedScope: `Inspect and restore ${asset.name.toLocaleLowerCase("en-US")}`,
          categoryKey: asset.categoryKey,
          taxonomyNodeId: asset.taxonomyNodeId,
          assetId,
          componentId: undefined,
          status: "closed",
          accountableParty: "Closed",
          nextAction: "No action required",
          dueAt: undefined,
          escalationTo: undefined,
          createdAt,
          resolvedAt: createdAt,
          closedAt: createdAt,
        });
        fixture.costLines.push({
          ...sourceCost,
          id: `cost-scale-${storeIndex + 1}-${monthIndex + 1}-${jobIndex + 1}`,
          workOrderId,
          kind: jobIndex % 2 ? "parts" : "labor",
          description: `${asset.name} recorded service cost`,
          amount: { ...sourceCost.amount, amountMinor },
          serviceDate,
          recordedAt: createdAt,
        });
      }
    }
  }
  return fixture;
}

export function assertOpsFixture(fixture: OpsFixture) {
  const organizationIds = new Set(fixture.organizations.map((row) => row.id));
  const divisionIds = new Set(fixture.divisions.map((row) => row.id));
  const storeIds = new Set(fixture.stores.map((row) => row.id));
  const taxonomyNodeIds = new Set(fixture.taxonomyNodes.map((row) => row.id));
  const equipmentTemplateIds = new Set(fixture.equipmentTemplates.map((row) => row.id));
  const vendorIds = new Set(fixture.vendors.map((row) => row.id));
  const workOrderIds = new Set(fixture.workOrders.map((row) => row.id));
  const assignmentIds = new Set(fixture.assignments.map((row) => row.id));
  const issuanceIds = new Set(fixture.issuances.map((row) => row.id));
  const estimateRequestIds = new Set(fixture.estimateRequests.map((row) => row.id));
  const visitIds = new Set(fixture.visits.map((row) => row.id));
  const workflowTaskIds = new Set(fixture.workflowTasks.map((row) => row.id));
  const assetIds = new Set(fixture.assets.map((row) => row.id));
  const replacementProfileIds = new Set(fixture.replacementProfiles.map((row) => row.id));
  const replacementBenchmarkIds = new Set(fixture.replacementBenchmarks.map((row) => row.id));
  const fileIds = new Set(fixture.files.map((row) => row.id));
  const invoiceIds = new Set(fixture.invoiceReferences.map((row) => row.id));
  const ensureUnique = (name: string, rows: Array<{ id: string }>) => {
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error(`${name} contains duplicate ids`);
  };
  ([
    ["organizations", fixture.organizations], ["divisions", fixture.divisions], ["regions", fixture.regions], ["taxonomy nodes", fixture.taxonomyNodes], ["stores", fixture.stores], ["users", fixture.users], ["memberships", fixture.memberships], ["scope grants", fixture.scopeGrants], ["vendors", fixture.vendors], ["requests", fixture.requests], ["work orders", fixture.workOrders], ["approval policies", fixture.approvalPolicies], ["approval requests", fixture.approvalRequests], ["approval decisions", fixture.approvalDecisions], ["assignments", fixture.assignments], ["issuances", fixture.issuances], ["vendor responses", fixture.vendorResponses], ["estimate requests", fixture.estimateRequests], ["estimate proposals", fixture.estimateProposals], ["visits", fixture.visits], ["site visit work orders", fixture.siteVisitWorkOrders], ["work-order verifications", fixture.workOrderVerifications], ["visit evidence", fixture.visitEvidence], ["files", fixture.files], ["entity files", fixture.entityFiles], ["follow-ups", fixture.followUps], ["workflow tasks", fixture.workflowTasks], ["workflow task SLA pauses", fixture.workflowTaskSlaPauses], ["workflow task SLA resumes", fixture.workflowTaskSlaResumes], ["exceptions", fixture.exceptions], ["assets", fixture.assets], ["replacement profiles", fixture.replacementProfiles], ["replacement benchmarks", fixture.replacementBenchmarks], ["asset replacement overrides", fixture.assetReplacementOverrides], ["replacement events", fixture.replacementEvents], ["components", fixture.components], ["component lifecycle events", fixture.componentLifecycleEvents], ["PM plans", fixture.pmPlans], ["PM occurrences", fixture.pmOccurrences], ["cost lines", fixture.costLines], ["invoice references", fixture.invoiceReferences], ["invoice allocations", fixture.invoiceAllocations], ["audit events", fixture.auditEvents], ["outbox", fixture.outboxMessages], ["public tokens", fixture.publicTokens],
  ] as Array<[string, Array<{ id: string }>]>).forEach(([name, rows]) => ensureUnique(name, rows));
  ensureUnique("equipment templates", fixture.equipmentTemplates);
  ensureUnique("component templates", fixture.componentTemplates);
  ensureUnique("request impact assessments", fixture.requestImpactAssessments);
  ensureUnique("vendor reminders", fixture.vendorReminders);
  ([
    ["vendor qualifications", fixture.vendorQualifications], ["vendor compliance", fixture.vendorComplianceDocuments], ["vendor contracts", fixture.vendorContracts], ["contract versions", fixture.contractVersions], ["contract scopes", fixture.contractScopes], ["rate-card lines", fixture.rateCardLines], ["service-level policies", fixture.serviceLevelPolicies], ["scheduling policies", fixture.schedulingPolicies], ["vendor capacity", fixture.vendorCapacity], ["maintenance programs", fixture.maintenancePrograms], ["checklist templates", fixture.checklistTemplates], ["PM work items", fixture.pmWorkItems], ["checklist responses", fixture.checklistResponses], ["service runs", fixture.serviceRuns], ["route stops", fixture.routeStops], ["service-run work orders", fixture.serviceRunWorkOrders], ["service-run responses", fixture.serviceRunResponses], ["vendor warranty profiles", fixture.vendorWarrantyProfiles], ["warranty rules", fixture.warrantyRules], ["warranty coverage lines", fixture.warrantyCoverageLines], ["repair items", fixture.repairItems], ["applied warranties", fixture.appliedWarranties], ["warranty amendments", fixture.warrantyAmendments], ["manufacturer warranties", fixture.manufacturerWarranties], ["warranty cases", fixture.warrantyCases], ["quotes", fixture.quotes], ["authorizations", fixture.authorizations], ["invoices", fixture.invoices], ["invoice lines", fixture.invoiceLines], ["invoice line allocations", fixture.invoiceLineAllocations], ["invoice exceptions", fixture.invoiceExceptions], ["invoice adjustments", fixture.invoiceAdjustments], ["service discrepancies", fixture.serviceDiscrepancies], ["value events", fixture.valueEvents],
  ] as Array<[string, Array<{ id: string }>]>).forEach(([name, rows]) => ensureUnique(name, rows));
  const ensureTenant = (name: string, rows: Array<{ organizationId: string }>) => rows.forEach((row) => { if (!organizationIds.has(row.organizationId)) throw new Error(`${name} references an unknown organization`); });
  ([
    ["divisions", fixture.divisions], ["regions", fixture.regions], ["taxonomy nodes", fixture.taxonomyNodes], ["stores", fixture.stores], ["memberships", fixture.memberships], ["scope grants", fixture.scopeGrants], ["vendors", fixture.vendors], ["vendor specialties", fixture.vendorSpecialties], ["vendor coverage", fixture.vendorCoverage], ["requests", fixture.requests], ["work orders", fixture.workOrders], ["approval policies", fixture.approvalPolicies], ["approval requests", fixture.approvalRequests], ["approval decisions", fixture.approvalDecisions], ["assignments", fixture.assignments], ["issuances", fixture.issuances], ["vendor responses", fixture.vendorResponses], ["estimate requests", fixture.estimateRequests], ["estimate proposals", fixture.estimateProposals], ["visits", fixture.visits], ["site visit work orders", fixture.siteVisitWorkOrders], ["work-order verifications", fixture.workOrderVerifications], ["visit evidence", fixture.visitEvidence], ["files", fixture.files], ["entity files", fixture.entityFiles], ["follow-ups", fixture.followUps], ["workflow tasks", fixture.workflowTasks], ["workflow task SLA pauses", fixture.workflowTaskSlaPauses], ["workflow task SLA resumes", fixture.workflowTaskSlaResumes], ["exceptions", fixture.exceptions], ["assets", fixture.assets], ["replacement profiles", fixture.replacementProfiles], ["replacement benchmarks", fixture.replacementBenchmarks], ["asset replacement overrides", fixture.assetReplacementOverrides], ["replacement events", fixture.replacementEvents], ["components", fixture.components], ["PM plans", fixture.pmPlans], ["PM occurrences", fixture.pmOccurrences], ["cost lines", fixture.costLines], ["invoice references", fixture.invoiceReferences], ["invoice allocations", fixture.invoiceAllocations], ["audit events", fixture.auditEvents], ["outbox", fixture.outboxMessages], ["public tokens", fixture.publicTokens],
  ] as Array<[string, Array<{ organizationId: string }>]>).forEach(([name, rows]) => ensureTenant(name, rows));
  ensureTenant("equipment templates", fixture.equipmentTemplates);
  ensureTenant("component templates", fixture.componentTemplates);
  ensureTenant("request impact assessments", fixture.requestImpactAssessments);
  ensureTenant("vendor reminders", fixture.vendorReminders);
  ([
    ["vendor qualifications", fixture.vendorQualifications], ["vendor compliance", fixture.vendorComplianceDocuments], ["vendor contracts", fixture.vendorContracts], ["contract versions", fixture.contractVersions], ["contract scopes", fixture.contractScopes], ["rate-card lines", fixture.rateCardLines], ["service-level policies", fixture.serviceLevelPolicies], ["scheduling policies", fixture.schedulingPolicies], ["vendor capacity", fixture.vendorCapacity], ["maintenance programs", fixture.maintenancePrograms], ["checklist templates", fixture.checklistTemplates], ["PM work items", fixture.pmWorkItems], ["checklist responses", fixture.checklistResponses], ["service runs", fixture.serviceRuns], ["route stops", fixture.routeStops], ["service-run work orders", fixture.serviceRunWorkOrders], ["service-run responses", fixture.serviceRunResponses], ["vendor warranty profiles", fixture.vendorWarrantyProfiles], ["warranty rules", fixture.warrantyRules], ["warranty coverage lines", fixture.warrantyCoverageLines], ["repair items", fixture.repairItems], ["applied warranties", fixture.appliedWarranties], ["warranty amendments", fixture.warrantyAmendments], ["manufacturer warranties", fixture.manufacturerWarranties], ["warranty cases", fixture.warrantyCases], ["quotes", fixture.quotes], ["authorizations", fixture.authorizations], ["invoices", fixture.invoices], ["invoice lines", fixture.invoiceLines], ["invoice line allocations", fixture.invoiceLineAllocations], ["invoice exceptions", fixture.invoiceExceptions], ["invoice adjustments", fixture.invoiceAdjustments], ["service discrepancies", fixture.serviceDiscrepancies], ["value events", fixture.valueEvents],
  ] as Array<[string, Array<{ organizationId: string }>]>).forEach(([name, rows]) => ensureTenant(name, rows));
  fixture.regions.forEach((row) => { if (row.divisionId && !divisionIds.has(row.divisionId)) throw new Error(`Region ${row.id} has no division`); });
  fixture.vendorReminders.forEach((row) => {
    if (!fixture.vendors.some((vendor) => vendor.organizationId === row.organizationId && vendor.id === row.vendorId)) throw new Error(`Vendor reminder ${row.id} has no vendor`);
    if ((row.status === "completed") !== Boolean(row.completedAt)) throw new Error(`Vendor reminder ${row.id} has inconsistent completion state`);
  });
  fixture.stores.forEach((row) => {
    if (row.divisionId && !divisionIds.has(row.divisionId)) throw new Error(`Store ${row.id} has no division`);
    if (row.regionId) {
      const region = fixture.regions.find((item) => item.organizationId === row.organizationId && item.id === row.regionId);
      if (!region || row.divisionId && region.divisionId !== row.divisionId) throw new Error(`Store ${row.id} has an invalid division/region path`);
    }
  });
  fixture.taxonomyNodes.forEach((row) => {
    const parent = row.parentNodeId ? fixture.taxonomyNodes.find((item) => item.organizationId === row.organizationId && item.id === row.parentNodeId) : undefined;
    if (row.parentNodeId && !parent) throw new Error(`Taxonomy node ${row.id} has no parent`);
    if (row.depth !== (parent ? parent.depth + 1 : 0)) throw new Error(`Taxonomy node ${row.id} has an invalid depth`);
    if (!parent && row.nodeKind !== "category") throw new Error(`Root taxonomy node ${row.id} must be a category`);
    if (parent && row.nodeKind !== "group") throw new Error(`Nested taxonomy node ${row.id} must be a group`);
  });
  fixture.requests.forEach((row) => {
    if (!storeIds.has(row.storeId)) throw new Error(`Request ${row.id} has no store`);
    const convertedWorkOrder = row.convertedWorkOrderId ? fixture.workOrders.find((workOrder) => workOrder.organizationId === row.organizationId && workOrder.id === row.convertedWorkOrderId) : undefined;
    if (row.convertedWorkOrderId && !convertedWorkOrder) throw new Error(`Request ${row.id} has no converted work order`);
    if (row.status === "converted" && (!convertedWorkOrder || convertedWorkOrder.requestId !== row.id || convertedWorkOrder.storeId !== row.storeId)) throw new Error(`Converted request ${row.id} has an invalid work-order path`);
  });
  fixture.requestImpactAssessments.forEach((assessment) => {
    const request = fixture.requests.find((candidate) => candidate.organizationId === assessment.organizationId && candidate.id === assessment.requestId);
    if (!request || request.storeId !== assessment.storeId) throw new Error(`Impact assessment ${assessment.id} has an invalid request/store path`);
    if (Date.parse(assessment.assessedAt) < Date.parse(request.submittedAt) || !assessment.assessedByActorName.trim()) throw new Error(`Impact assessment ${assessment.id} has invalid provenance`);
    if (assessment.assessmentKind === "review" ? !assessment.reviewDisposition : assessment.reviewDisposition !== undefined) throw new Error(`Impact assessment ${assessment.id} has an invalid review shape`);
    if (assessment.capacityUnavailableBps !== undefined && (!Number.isSafeInteger(assessment.capacityUnavailableBps) || assessment.capacityUnavailableBps < 0 || assessment.capacityUnavailableBps > 10_000)) throw new Error(`Impact assessment ${assessment.id} has invalid unavailable capacity`);
    if (assessment.estimatedDowntimeMinutes !== undefined && (!Number.isSafeInteger(assessment.estimatedDowntimeMinutes) || assessment.estimatedDowntimeMinutes < 0)) throw new Error(`Impact assessment ${assessment.id} has invalid downtime exposure`);
    for (const estimate of [assessment.productInventoryValue, assessment.estimatedDailyRevenueExposure]) {
      if (estimate && (!Number.isSafeInteger(estimate.amountMinor) || estimate.amountMinor < 0 || !estimate.currency.trim())) throw new Error(`Impact assessment ${assessment.id} has an invalid exposure estimate`);
    }
  });
  fixture.requests.forEach((request) => {
    const assessments = fixture.requestImpactAssessments.filter((assessment) => assessment.organizationId === request.organizationId && assessment.requestId === request.id);
    if (assessments.filter((assessment) => assessment.assessmentKind === "initial_report").length !== 1) throw new Error(`Request ${request.id} must have exactly one initial impact assessment`);
    if (request.status !== "submitted" && !assessments.some((assessment) => assessment.assessmentKind === "review")) throw new Error(`Reviewed request ${request.id} has no manager impact review`);
  });
  fixture.workOrders.forEach((row) => {
    if (!storeIds.has(row.storeId)) throw new Error(`Work order ${row.id} has no store`);
    if (!row.problem.trim()) throw new Error(`Work order ${row.id} has no problem`);
    if (row.assetId) {
      const asset = fixture.assets.find((item) => item.organizationId === row.organizationId && item.id === row.assetId);
      if (!asset || asset.storeId !== row.storeId) throw new Error(`Work order ${row.id} has an invalid asset/store path`);
      if (row.componentId) {
        const component = fixture.components.find((item) => item.organizationId === row.organizationId && item.id === row.componentId);
        if (!component || component.assetId !== asset.id) throw new Error(`Work order ${row.id} has an invalid component/asset path`);
      }
    } else if (row.componentId) throw new Error(`Work order ${row.id} has a component without an asset`);
    if (row.repairEstimate && (!Number.isInteger(row.repairEstimate.amountMinor) || row.repairEstimate.amountMinor < 0)) throw new Error(`Work order ${row.id} has an invalid repair estimate`);
    if (row.estimatedServiceExtensionMonths !== undefined && (!Number.isInteger(row.estimatedServiceExtensionMonths) || row.estimatedServiceExtensionMonths < 1 || row.estimatedServiceExtensionMonths > 1_200)) throw new Error(`Work order ${row.id} has an invalid estimated service extension`);
    if ((row.repairEstimate || row.estimatedServiceExtensionMonths !== undefined) && !row.assetId) throw new Error(`Work order ${row.id} has repair planning inputs without an asset`);
    if (row.taxonomyNodeId && !taxonomyNodeIds.has(row.taxonomyNodeId)) throw new Error(`Work order ${row.id} has an invalid taxonomy node`);
    if (!["closed", "cancelled"].includes(row.status) && (!row.accountableParty.trim() || !row.nextAction.trim() || !row.dueAt || !row.escalationTo?.trim())) throw new Error(`Open work order ${row.id} has no complete accountability state`);
  });
  const approvalPolicyIds = new Set(fixture.approvalPolicies.map((row) => row.id));
  const policyVersionKeys = new Set<string>();
  fixture.approvalPolicies.forEach((row) => {
    const versionKey = `${row.organizationId}:${row.policyKey}:${row.version}`;
    if (policyVersionKeys.has(versionKey) || !Number.isInteger(row.version) || row.version < 1) throw new Error(`Approval policy ${row.id} has an invalid version`);
    policyVersionKeys.add(versionKey);
    if (!Number.isSafeInteger(row.minAmountMinor) || row.minAmountMinor < 0 || row.maxAmountMinor !== undefined && (!Number.isSafeInteger(row.maxAmountMinor) || row.maxAmountMinor < row.minAmountMinor)) throw new Error(`Approval policy ${row.id} has an invalid amount range`);
    if (row.scopeKind === "organization" && row.scopeId !== row.organizationId || row.scopeKind === "region" && !fixture.regions.some((region) => region.organizationId === row.organizationId && region.id === row.scopeId) || row.scopeKind === "store" && !fixture.stores.some((store) => store.organizationId === row.organizationId && store.id === row.scopeId)) throw new Error(`Approval policy ${row.id} has an invalid scope`);
    if (row.supersedesPolicyId && !approvalPolicyIds.has(row.supersedesPolicyId)) throw new Error(`Approval policy ${row.id} has an invalid predecessor`);
  });
  fixture.approvalRequests.forEach((row) => {
    const policy = fixture.approvalPolicies.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.policyId);
    const subject = row.subjectType === "work_order"
      ? fixture.workOrders.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.subjectId)
      : fixture.requests.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.subjectId);
    if (!policy || !subject || subject.storeId !== row.storeId || !storeIds.has(row.storeId)) throw new Error(`Approval request ${row.id} has an invalid subject, policy, or store`);
    if (policy.policyKey !== row.policyKey || policy.version !== row.policyVersion || policy.name !== row.policyName || policy.scopeKind !== row.policyScopeKind || policy.scopeId !== row.policyScopeId) throw new Error(`Approval request ${row.id} does not preserve its policy snapshot`);
    if (!Number.isSafeInteger(row.amount.amountMinor) || row.amount.amountMinor < 0 || !row.amount.currency.trim() || row.dueAt && row.dueAt < row.requestedAt) throw new Error(`Approval request ${row.id} has invalid commercial or timing facts`);
    if (row.parentApprovalRequestId) {
      const parent = fixture.approvalRequests.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.parentApprovalRequestId);
      if (!parent || parent.subjectType !== row.subjectType || parent.subjectId !== row.subjectId || parent.requestedAt > row.requestedAt) throw new Error(`Approval request ${row.id} has an invalid escalation parent`);
    }
  });
  const decidedApprovalRequests = new Set<string>();
  fixture.approvalDecisions.forEach((row) => {
    const request = fixture.approvalRequests.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.approvalRequestId);
    const membership = row.decidedByMembershipId ? fixture.memberships.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.decidedByMembershipId) : undefined;
    const key = `${row.organizationId}:${row.approvalRequestId}`;
    if (!request || decidedApprovalRequests.has(key) || row.decidedAt < request.requestedAt) throw new Error(`Approval decision ${row.id} has an invalid or duplicate request`);
    decidedApprovalRequests.add(key);
    if (membership && membership.role !== row.decidedByRole || row.decidedByRole !== request.requiredRole) throw new Error(`Approval decision ${row.id} was made by the wrong role`);
    if (row.decision === "escalated" && !row.escalatedToRole || row.decision !== "escalated" && row.escalatedToRole) throw new Error(`Approval decision ${row.id} has an invalid escalation shape`);
  });
  const openTaskStatuses = new Set<WorkflowTask["status"]>(["open", "in_progress"]);
  const sourceFollowUpIds = new Set<string>();
  const sourceApprovalRequestIds = new Set<string>();
  const priorityRank: Record<WorkflowTask["priority"], number> = { critical: 4, high: 3, normal: 2, low: 1 };
  const selectPrimaryTask = (tasks: WorkflowTask[]) => tasks.filter((task) => openTaskStatuses.has(task.status)).sort((left, right) =>
    Number(right.blocking) - Number(left.blocking)
    || Number(right.requiredForProgress) - Number(left.requiredForProgress)
    || priorityRank[right.priority] - priorityRank[left.priority]
    || (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999")
    || Number(right.status === "in_progress") - Number(left.status === "in_progress")
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id))[0];
  fixture.workflowTasks.forEach((task) => {
    const workOrder = task.workOrderId ? fixture.workOrders.find((candidate) => candidate.organizationId === task.organizationId && candidate.id === task.workOrderId) : undefined;
    const serviceRequest = task.serviceRequestId ? fixture.requests.find((candidate) => candidate.organizationId === task.organizationId && candidate.id === task.serviceRequestId) : undefined;
    if ((task.workOrderId ? 1 : 0) + (task.serviceRequestId ? 1 : 0) !== 1 || (!workOrder && !serviceRequest)) throw new Error(`Workflow task ${task.id} must have exactly one valid request or work-order subject`);
    if (!task.title.trim() || !task.reason.trim() || !task.assigneeName.trim() || !task.completionCriteria.trim() || !task.escalationDestination.trim()) throw new Error(`Workflow task ${task.id} is missing accountable task detail`);
    if ((task.dueAt ? 1 : 0) + (task.noSlaReason?.trim() ? 1 : 0) !== 1) throw new Error(`Workflow task ${task.id} requires a due date or one explicit no-SLA reason`);
    if (task.dueAt && Date.parse(task.dueAt) < Date.parse(task.createdAt) || !Number.isInteger(task.escalationLevel) || task.escalationLevel < 0) throw new Error(`Workflow task ${task.id} has invalid timing or escalation`);
    if (task.assigneeType === "role" ? !task.assigneeRole || task.assigneeId : !task.assigneeId || task.assigneeRole) throw new Error(`Workflow task ${task.id} has an invalid assignee shape`);
    if (task.assigneeType === "user" && !fixture.memberships.some((candidate) => candidate.organizationId === task.organizationId && candidate.id === task.assigneeId)) throw new Error(`Workflow task ${task.id} has an invalid user assignee`);
    if (task.assigneeType === "vendor" && !fixture.vendors.some((candidate) => candidate.organizationId === task.organizationId && candidate.id === task.assigneeId)) throw new Error(`Workflow task ${task.id} has an invalid vendor assignee`);
    if (task.status === "in_progress" && (!task.startedAt || !task.startedByActorType || !task.startedByActorName?.trim())) throw new Error(`Workflow task ${task.id} has no start evidence`);
    if (task.status === "completed" && (!task.completedAt || !task.completedByActorType || !task.completedByActorName?.trim() || !task.resolutionNote?.trim()) || task.status !== "completed" && task.completedAt) throw new Error(`Workflow task ${task.id} has an invalid completion shape`);
    if (task.status === "cancelled" && (!task.cancelledAt || !task.cancelledByActorType || !task.cancelledByActorName?.trim() || !task.resolutionNote?.trim()) || task.status !== "cancelled" && task.cancelledAt) throw new Error(`Workflow task ${task.id} has an invalid cancellation shape`);
    if (workOrder && ["closed", "cancelled"].includes(workOrder.status) && openTaskStatuses.has(task.status)) throw new Error(`Terminal work order ${workOrder.id} has open workflow task ${task.id}`);
    if (task.sourceFollowUpId) {
      const followUp = fixture.followUps.find((candidate) => candidate.organizationId === task.organizationId && candidate.id === task.sourceFollowUpId);
      if (!workOrder || !followUp || followUp.workOrderId !== task.workOrderId || sourceFollowUpIds.has(`${task.organizationId}:${task.sourceFollowUpId}`)) throw new Error(`Workflow task ${task.id} has an invalid or duplicate follow-up source`);
      sourceFollowUpIds.add(`${task.organizationId}:${task.sourceFollowUpId}`);
    }
    if (task.sourceApprovalRequestId) {
      const approval = fixture.approvalRequests.find((candidate) => candidate.organizationId === task.organizationId && candidate.id === task.sourceApprovalRequestId);
      const request = approval?.subjectType === "service_request" ? fixture.requests.find((candidate) => candidate.organizationId === task.organizationId && candidate.id === approval.subjectId) : undefined;
      const targetsSubject = approval?.subjectType === "work_order"
        ? approval.subjectId === task.workOrderId
        : task.serviceRequestId ? approval?.subjectId === task.serviceRequestId : request?.convertedWorkOrderId === task.workOrderId;
      if (!approval || !targetsSubject || sourceApprovalRequestIds.has(`${task.organizationId}:${task.sourceApprovalRequestId}`)) throw new Error(`Workflow task ${task.id} has an invalid or duplicate approval source`);
      sourceApprovalRequestIds.add(`${task.organizationId}:${task.sourceApprovalRequestId}`);
    }
  });
  fixture.workOrders.forEach((workOrder) => {
    const tasks = fixture.workflowTasks.filter((task) => task.organizationId === workOrder.organizationId && task.workOrderId === workOrder.id);
    const primary = selectPrimaryTask(tasks);
    if (!["closed", "cancelled"].includes(workOrder.status)) {
      if (!tasks.some((task) => openTaskStatuses.has(task.status) && task.requiredForProgress)) throw new Error(`Nonterminal work order ${workOrder.id} has no required open workflow task`);
      if (!primary || primary.assigneeName !== workOrder.accountableParty || primary.title !== workOrder.nextAction || primary.dueAt !== workOrder.dueAt || primary.escalationDestination !== workOrder.escalationTo) throw new Error(`Work order ${workOrder.id} accountability fields are not the deterministic workflow-task projection`);
    }
  });
  const resumedPauseIds = new Set<string>();
  fixture.workflowTaskSlaResumes.forEach((resume) => {
    const pause = fixture.workflowTaskSlaPauses.find((candidate) => candidate.organizationId === resume.organizationId && candidate.id === resume.pauseId);
    if (!pause || !workflowTaskIds.has(resume.workflowTaskId) || pause.workflowTaskId !== resume.workflowTaskId || pause.workOrderId !== resume.workOrderId || resumedPauseIds.has(`${resume.organizationId}:${resume.pauseId}`) || Date.parse(resume.resumedAt) < Date.parse(pause.pausedAt)) throw new Error(`Workflow SLA resume ${resume.id} has an invalid pause history`);
    resumedPauseIds.add(`${resume.organizationId}:${resume.pauseId}`);
  });
  const activePauseTasks = new Set<string>();
  fixture.workflowTaskSlaPauses.forEach((pause) => {
    const task = fixture.workflowTasks.find((candidate) => candidate.organizationId === pause.organizationId && candidate.id === pause.workflowTaskId);
    if (!task || task.workOrderId !== pause.workOrderId || !pause.reasonDetail.trim() || !pause.ownerName.trim() || pause.affectedClocks.length === 0 || new Set(pause.affectedClocks).size !== pause.affectedClocks.length || pause.expectedResumeAt && Date.parse(pause.expectedResumeAt) <= Date.parse(pause.pausedAt)) throw new Error(`Workflow SLA pause ${pause.id} is invalid`);
    if (pause.ownerType === "membership" && !fixture.memberships.some((candidate) => candidate.organizationId === pause.organizationId && candidate.id === pause.ownerId) || pause.ownerType === "vendor" && !fixture.vendors.some((candidate) => candidate.organizationId === pause.organizationId && candidate.id === pause.ownerId) || pause.ownerType === "store" && !fixture.stores.some((candidate) => candidate.organizationId === pause.organizationId && candidate.id === pause.ownerId)) throw new Error(`Workflow SLA pause ${pause.id} has an invalid owner`);
    const active = !resumedPauseIds.has(`${pause.organizationId}:${pause.id}`);
    const key = `${pause.organizationId}:${pause.workflowTaskId}`;
    if (active && activePauseTasks.has(key)) throw new Error(`Workflow task ${pause.workflowTaskId} has multiple active SLA pauses`);
    if (active) activePauseTasks.add(key);
  });
  fixture.assignments.forEach((row) => {
    if (!workOrderIds.has(row.workOrderId)) throw new Error(`Assignment ${row.id} has no work order`);
    if (row.vendorId && !vendorIds.has(row.vendorId)) throw new Error(`Assignment ${row.id} has no vendor`);
    if (row.kind === "outside_vendor" && !row.vendorId || row.kind === "internal" && !row.internalMembershipId || row.kind === "choose_later" && (row.vendorId || row.internalMembershipId)) throw new Error(`Assignment ${row.id} has an invalid provider shape`);
    if (row.supersedesAssignmentId) {
      const superseded = fixture.assignments.find((item) => item.organizationId === row.organizationId && item.id === row.supersedesAssignmentId);
      if (!superseded || superseded.workOrderId !== row.workOrderId || superseded.assignedAt > row.assignedAt) throw new Error(`Assignment ${row.id} has an invalid supersedes link`);
    }
  });
  const issuanceRevisionKeys = new Set<string>();
  fixture.issuances.forEach((row) => {
    const revisionKey = `${row.organizationId}:${row.workOrderId}:${row.revision}`;
    if (!Number.isInteger(row.revision) || row.revision < 1 || issuanceRevisionKeys.has(revisionKey)) throw new Error(`Issuance ${row.id} has an invalid or duplicate revision`);
    issuanceRevisionKeys.add(revisionKey);
    const assignment = fixture.assignments.find((item) => item.organizationId === row.organizationId && item.id === row.assignmentId);
    const workOrder = fixture.workOrders.find((item) => item.organizationId === row.organizationId && item.id === row.workOrderId);
    const store = workOrder ? fixture.stores.find((item) => item.organizationId === row.organizationId && item.id === workOrder.storeId) : undefined;
    if (!assignmentIds.has(row.assignmentId) || assignment?.workOrderId !== row.workOrderId || !workOrder || !store) throw new Error(`Issuance ${row.id} is not causal`);
    if (assignment.kind === "choose_later") throw new Error(`Issuance ${row.id} cannot target a choose-later assignment`);
    if (Date.parse(row.issuedAt) < Date.parse(assignment.assignedAt)) throw new Error(`Issuance ${row.id} predates assignment`);
    let snapshot: Record<string, unknown>;
    try { snapshot = JSON.parse(row.immutablePayloadJson) as Record<string, unknown>; } catch { throw new Error(`Issuance ${row.id} has invalid immutable JSON`); }
    const snapshotStore = snapshot.store as Record<string, unknown> | undefined;
    const snapshotProvider = snapshot.vendor as Record<string, unknown> | undefined;
    const expectedProviderId = assignment.kind === "outside_vendor" ? assignment.vendorId : assignment.internalMembershipId;
    if (snapshot.workOrderNumber !== workOrder.number || snapshot.problem !== workOrder.problem || snapshot.priority !== workOrder.priority || snapshotStore?.id !== store.id || snapshotProvider?.id !== expectedProviderId || typeof snapshot.billingInstruction !== "string" || !snapshot.billingInstruction.trim()) throw new Error(`Issuance ${row.id} has an incomplete immutable authorization snapshot`);
  });
  fixture.vendorResponses.forEach((row) => { const issuance = fixture.issuances.find((item) => item.organizationId === row.organizationId && item.id === row.issuanceId); if (!issuanceIds.has(row.issuanceId) || issuance?.assignmentId !== row.assignmentId || issuance.workOrderId !== row.workOrderId) throw new Error(`Vendor response ${row.id} has no matching issuance`); if (Date.parse(row.respondedAt) < Date.parse(issuance.issuedAt)) throw new Error(`Vendor response ${row.id} predates issuance`); });
  fixture.estimateRequests.forEach((row) => {
    const workOrder = fixture.workOrders.find((item) => item.organizationId === row.organizationId && item.id === row.workOrderId);
    const vendor = fixture.vendors.find((item) => item.organizationId === row.organizationId && item.id === row.vendorId);
    if (!workOrder || !vendor || vendor.status === "inactive" || !row.requestedScope.trim()) throw new Error(`Estimate request ${row.id} has an invalid work-order/vendor path`);
    if (Date.parse(row.requestedAt) < Date.parse(workOrder.createdAt)) throw new Error(`Estimate request ${row.id} predates its work order`);
    if (row.dueAt && Date.parse(row.dueAt) < Date.parse(row.requestedAt)) throw new Error(`Estimate request ${row.id} has an invalid due time`);
    if (row.openedAt && Date.parse(row.openedAt) < Date.parse(row.requestedAt)) throw new Error(`Estimate request ${row.id} opened before it was requested`);
    if (row.respondedAt && Date.parse(row.respondedAt) < Date.parse(row.requestedAt)) throw new Error(`Estimate request ${row.id} responded before it was requested`);
    if (["opened", "submitted", "declined", "selected", "not_selected"].includes(row.status) && !row.openedAt) throw new Error(`Estimate request ${row.id} has no opened time`);
    if (["submitted", "declined", "selected", "not_selected"].includes(row.status) && !row.respondedAt) throw new Error(`Estimate request ${row.id} has no response time`);
    if (["selected", "not_selected"].includes(row.status) && !row.decisionAt) throw new Error(`Estimate request ${row.id} has no decision time`);
    if (row.decisionAt && Date.parse(row.decisionAt) < Date.parse(row.respondedAt ?? row.requestedAt)) throw new Error(`Estimate request ${row.id} has an invalid decision time`);
  });
  fixture.equipmentTemplates.forEach((row) => { if (!taxonomyNodeIds.has(row.taxonomyNodeId)) throw new Error(`Equipment template ${row.id} has no equipment group`); });
  fixture.componentTemplates.forEach((row) => { if (!equipmentTemplateIds.has(row.equipmentTemplateId)) throw new Error(`Component template ${row.id} has no equipment template`); if (row.parentComponentTemplateId && !fixture.componentTemplates.some((candidate) => candidate.id === row.parentComponentTemplateId && candidate.equipmentTemplateId === row.equipmentTemplateId)) throw new Error(`Component template ${row.id} has an invalid parent`); });
  fixture.replacementProfiles.forEach((row) => {
    if (row.taxonomyNodeId && !taxonomyNodeIds.has(row.taxonomyNodeId)) throw new Error(`Replacement profile ${row.id} has an invalid taxonomy node`);
    if (!row.code.trim() || !row.name.trim() || row.matchKeys.some((key) => !key.trim())) throw new Error(`Replacement profile ${row.id} is incomplete`);
    if (!Number.isInteger(row.annualEscalationBps) || row.annualEscalationBps < -9_000 || row.annualEscalationBps > 50_000) throw new Error(`Replacement profile ${row.id} has invalid escalation`);
  });
  const publishedProfileIds = new Set<string>();
  fixture.replacementBenchmarks.forEach((row) => {
    if (!replacementProfileIds.has(row.profileId)) throw new Error(`Replacement benchmark ${row.id} has no profile`);
    if (row.totalAmount.amountMinor !== row.equipmentAmount.amountMinor + row.installationAmount.amountMinor + row.otherAmount.amountMinor) throw new Error(`Replacement benchmark ${row.id} does not reconcile`);
    if (row.status === "published") {
      const key = `${row.organizationId}:${row.profileId}`;
      if (publishedProfileIds.has(key)) throw new Error(`Replacement profile ${row.profileId} has multiple published benchmarks`);
      publishedProfileIds.add(key);
    }
  });
  const activeOverrideAssetIds = new Set<string>();
  fixture.assetReplacementOverrides.forEach((row) => {
    if (!assetIds.has(row.assetId) || row.sourceBenchmarkId && !replacementBenchmarkIds.has(row.sourceBenchmarkId)) throw new Error(`Replacement override ${row.id} has invalid evidence links`);
    if (row.status === "active") {
      const key = `${row.organizationId}:${row.assetId}`;
      if (activeOverrideAssetIds.has(key)) throw new Error(`Asset ${row.assetId} has multiple active replacement overrides`);
      activeOverrideAssetIds.add(key);
    }
  });
  fixture.assets.forEach((row) => {
    if (row.replacementProfileId && !replacementProfileIds.has(row.replacementProfileId)) throw new Error(`Asset ${row.id} has an invalid replacement profile`);
    if (row.replacementAttributes && Array.isArray(row.replacementAttributes)) throw new Error(`Asset ${row.id} has invalid replacement attributes`);
    if (row.replacedByAssetId && !assetIds.has(row.replacedByAssetId)) throw new Error(`Asset ${row.id} has an invalid successor`);
  });
  fixture.replacementEvents.forEach((row) => {
    if (!assetIds.has(row.assetId) || !workOrderIds.has(row.workOrderId) || !replacementProfileIds.has(row.profileId)) throw new Error(`Replacement event ${row.id} has invalid lifecycle links`);
    const proposal = fixture.estimateProposals.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.sourceEstimateProposalId);
    if (!proposal || proposal.workOrderId !== row.workOrderId || proposal.amount.amountMinor !== row.approvedAmount.amountMinor) throw new Error(`Replacement event ${row.id} has invalid approved quote evidence`);
    if (row.replacementAssetId && !assetIds.has(row.replacementAssetId)) throw new Error(`Replacement event ${row.id} has invalid replacement asset`);
  });
  const proposalRevisionKeys = new Set<string>();
  fixture.estimateProposals.forEach((row) => {
    const request = fixture.estimateRequests.find((item) => item.organizationId === row.organizationId && item.id === row.requestId);
    const revisionKey = `${row.organizationId}:${row.requestId}:${row.revision}`;
    if (!estimateRequestIds.has(row.requestId) || !request || request.workOrderId !== row.workOrderId || request.vendorId !== row.vendorId) throw new Error(`Estimate proposal ${row.id} has an invalid request path`);
    if (!Number.isInteger(row.revision) || row.revision < 1 || proposalRevisionKeys.has(revisionKey)) throw new Error(`Estimate proposal ${row.id} has an invalid or duplicate revision`);
    proposalRevisionKeys.add(revisionKey);
    if (!Number.isSafeInteger(row.amount.amountMinor) || row.amount.amountMinor < 0 || !row.amount.currency.trim() || !row.scope.trim()) throw new Error(`Estimate proposal ${row.id} has invalid commercial terms`);
    if (row.leadTimeDays !== undefined && (!Number.isInteger(row.leadTimeDays) || row.leadTimeDays < 0 || row.leadTimeDays > 3_650)) throw new Error(`Estimate proposal ${row.id} has an invalid lead time`);
    if (Date.parse(row.submittedAt) < Date.parse(request.requestedAt) || row.validUntil && Date.parse(row.validUntil) < Date.parse(row.submittedAt)) throw new Error(`Estimate proposal ${row.id} has invalid timing`);
  });
  const visitWorkSelectionKeys = new Set<string>();
  const visitWorkOrdinalKeys = new Set<string>();
  fixture.siteVisitWorkOrders.forEach((row) => {
    const visit = fixture.visits.find((item) => item.organizationId === row.organizationId && item.id === row.visitId);
    const workOrder = fixture.workOrders.find((item) => item.organizationId === row.organizationId && item.id === row.workOrderId);
    const selectionKey = `${row.organizationId}:${row.visitId}:${row.workOrderId}`;
    const ordinalKey = `${row.organizationId}:${row.visitId}:${row.ordinal}`;
    if (!visit || !workOrder || visit.storeId !== workOrder.storeId || visitWorkSelectionKeys.has(selectionKey) || visitWorkOrdinalKeys.has(ordinalKey) || !Number.isInteger(row.ordinal) || row.ordinal < 1) throw new Error(`Site visit work order ${row.id} has an invalid visit/work selection`);
    visitWorkSelectionKeys.add(selectionKey);
    visitWorkOrdinalKeys.add(ordinalKey);
    if (Date.parse(row.linkedAt) < Date.parse(workOrder.createdAt) || !row.linkedByActorName.trim()) throw new Error(`Site visit work order ${row.id} has invalid link provenance`);
    const providerMatches = fixture.assignments.some((assignment) => assignment.organizationId === row.organizationId && assignment.workOrderId === row.workOrderId && (visit.providerKind === "outside_vendor" ? assignment.kind === "outside_vendor" && assignment.vendorId === visit.vendorId : assignment.kind === "internal" && assignment.internalMembershipId === visit.internalMembershipId));
    if (!providerMatches) throw new Error(`Site visit work order ${row.id} has no matching provider assignment`);
    const hasOutcomeProvenance = Boolean(row.outcomeRecordedByActorType && row.outcomeRecordedByActorName?.trim() && row.outcomeRecordedAt);
    if (row.outcome ? !hasOutcomeProvenance : row.outcomeNotes !== undefined || row.outcomeRecordedByActorType !== undefined || row.outcomeRecordedByActorId !== undefined || row.outcomeRecordedByActorName !== undefined || row.outcomeRecordedAt !== undefined || row.followUpId !== undefined) throw new Error(`Site visit work order ${row.id} has an invalid outcome shape`);
    if (row.outcomeRecordedAt && (!visit.checkedOutAt || row.outcomeRecordedAt !== visit.checkedOutAt)) throw new Error(`Site visit work order ${row.id} outcome does not match checkout`);
    const followUp = row.followUpId ? fixture.followUps.find((item) => item.organizationId === row.organizationId && item.id === row.followUpId) : undefined;
    if (row.outcome && siteVisitOutcomeRequiresFollowUp(row.outcome) ? !followUp || followUp.workOrderId !== row.workOrderId || followUp.sourceVisitId !== row.visitId : row.followUpId !== undefined) throw new Error(`Site visit work order ${row.id} has an invalid follow-up obligation`);
  });
  const verifiedOutcomeKeys = new Set<string>();
  const verificationCycleKeys = new Set<string>();
  fixture.workOrderVerifications.forEach((verification) => {
    const workOrder = fixture.workOrders.find((row) => row.organizationId === verification.organizationId && row.id === verification.workOrderId);
    const outcome = fixture.siteVisitWorkOrders.find((row) => row.organizationId === verification.organizationId && row.id === verification.siteVisitWorkOrderId && row.workOrderId === verification.workOrderId);
    const membership = fixture.memberships.find((row) => row.organizationId === verification.organizationId && row.id === verification.decidedByMembershipId);
    const outcomeKey = `${verification.organizationId}:${verification.siteVisitWorkOrderId}`;
    const cycleKey = `${verification.organizationId}:${verification.workOrderId}:${verification.cycle}`;
    if (!workOrder || !outcome?.outcome || !outcome.outcomeRecordedAt || outcome.outcome !== verification.outcome || outcome.outcomeRecordedAt !== verification.outcomeRecordedAt) throw new Error(`Work-order verification ${verification.id} has stale or cross-work outcome evidence`);
    if (!membership || membership.status !== "active" || !["facilities_admin", "regional_manager", "store_manager"].includes(membership.role)) throw new Error(`Work-order verification ${verification.id} has an invalid decision membership`);
    if (!Number.isInteger(verification.cycle) || verification.cycle < 1 || verifiedOutcomeKeys.has(outcomeKey) || verificationCycleKeys.has(cycleKey)) throw new Error(`Work-order verification ${verification.id} has a duplicate outcome or cycle`);
    if (!verification.decidedByName.trim() || verification.decision === "rejected" && !verification.reason?.trim() || Date.parse(verification.decidedAt) < Date.parse(verification.outcomeRecordedAt)) throw new Error(`Work-order verification ${verification.id} has invalid decision provenance`);
    verifiedOutcomeKeys.add(outcomeKey);
    verificationCycleKeys.add(cycleKey);
  });
  fixture.workOrders.forEach((workOrder) => {
    const decisions = fixture.workOrderVerifications.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).sort((left, right) => left.cycle - right.cycle);
    if (decisions.some((row, index) => row.cycle !== index + 1)) throw new Error(`Work order ${workOrder.id} has a non-contiguous verification cycle`);
    const currentVisitWork = fixture.siteVisitWorkOrders.filter((row) => row.organizationId === workOrder.organizationId && row.workOrderId === workOrder.id).sort((left, right) => right.linkedAt.localeCompare(left.linkedAt) || (right.outcomeRecordedAt ?? "").localeCompare(left.outcomeRecordedAt ?? "") || right.id.localeCompare(left.id))[0];
    const latestOutcome = currentVisitWork?.outcome && currentVisitWork.outcomeRecordedAt ? currentVisitWork : undefined;
    const latestDecision = decisions.at(-1);
    if (workOrder.status === "resolved" && (!latestOutcome || latestDecision?.decision !== "verified" || latestDecision.siteVisitWorkOrderId !== latestOutcome.id || workOrder.resolvedAt !== latestDecision.decidedAt)) throw new Error(`Resolved work order ${workOrder.id} has no accepted current verification projection`);
    if (workOrder.status === "resolved") {
      const openRequiredTasks = fixture.workflowTasks.filter((task) => task.organizationId === workOrder.organizationId && task.workOrderId === workOrder.id && openTaskStatuses.has(task.status) && (task.blocking || task.requiredForProgress));
      const activeVisits = fixture.visits.filter((visit) => visit.organizationId === workOrder.organizationId && visit.status === "active" && fixture.siteVisitWorkOrders.some((link) => link.organizationId === workOrder.organizationId && link.visitId === visit.id && link.workOrderId === workOrder.id));
      const openFollowUps = fixture.followUps.filter((followUp) => followUp.organizationId === workOrder.organizationId && followUp.workOrderId === workOrder.id && followUp.status === "open");
      if (openRequiredTasks.length !== 1 || openRequiredTasks[0].taskType !== "close_verified_work" || activeVisits.length || openFollowUps.length) throw new Error(`Resolved work order ${workOrder.id} is not ready for bounded explicit closure`);
    }
    if (workOrder.resolvedAt && latestDecision?.decision !== "verified") throw new Error(`Work order ${workOrder.id} has a resolved time without accepted verification`);
  });
  fixture.visits.forEach((row) => {
    if (!storeIds.has(row.storeId)) throw new Error(`Visit ${row.id} has no store`);
    if (row.vendorId && !vendorIds.has(row.vendorId)) throw new Error(`Visit ${row.id} has no vendor`);
    const crewCount = row.crewCount ?? 1;
    const additionalTechnicianNames = row.additionalTechnicianNames ?? [];
    const crewNames = [row.technicianName, ...additionalTechnicianNames].map((name) => name.trim().toLocaleLowerCase("en-US"));
    if (!Number.isInteger(crewCount) || crewCount < 1 || crewCount > 100 || additionalTechnicianNames.length >= crewCount || crewNames.some((name) => !name) || new Set(crewNames).size !== crewNames.length) throw new Error(`Visit ${row.id} has invalid crew details`);
    if ([row.technicianPhoneOrPin, row.vehicleIdentifier, row.arrivalNote].some((value) => value !== undefined && !value.trim())) throw new Error(`Visit ${row.id} has blank optional arrival details`);
    const links = fixture.siteVisitWorkOrders.filter((link) => link.organizationId === row.organizationId && link.visitId === row.id).sort((left, right) => left.ordinal - right.ordinal);
    if (links.length === 0 ? !row.unmatchedReason?.trim() : row.unmatchedReason !== undefined) throw new Error(`Visit ${row.id} has an invalid matched/unmatched shape`);
    if (links.some((link, index) => link.ordinal !== index + 1)) throw new Error(`Visit ${row.id} has non-contiguous work-order ordinals`);
    if (links.length === 1 && row.workOrderId !== links[0].workOrderId || links.length > 1 && (row.workOrderId !== undefined || row.outcome !== undefined || row.outcomeNotes !== undefined) || links.length === 0 && row.workOrderId !== undefined) throw new Error(`Visit ${row.id} has an invalid scalar compatibility projection`);
    if (row.outcome && links[0]?.outcome !== siteVisitOutcomeFromLegacy(row.outcome)) throw new Error(`Visit ${row.id} scalar outcome does not match its work-order outcome`);
    if (row.status === "active" ? links.some((link) => link.outcome !== undefined) : links.some((link) => link.outcome === undefined)) throw new Error(`Visit ${row.id} has incomplete per-work-order outcomes`);
    if (row.checkedOutAt && Date.parse(row.checkedOutAt) < Date.parse(row.checkedInAt)) throw new Error(`Visit ${row.id} checkout predates check-in`);
  });
  fixture.visitEvidence.forEach((row) => { const visit = fixture.visits.find((item) => item.id === row.visitId); if (!visitIds.has(row.visitId) || !visit) throw new Error(`Evidence ${row.id} has no visit`); if (Date.parse(row.observedAt) < Date.parse(visit.checkedInAt)) throw new Error(`Evidence ${row.id} predates check-in`); });
  const assetTagKeys = new Set<string>();
  fixture.assets.forEach((row) => {
    if (!storeIds.has(row.storeId)) throw new Error(`Asset ${row.id} has no store`);
    if (row.taxonomyNodeId && !taxonomyNodeIds.has(row.taxonomyNodeId)) throw new Error(`Asset ${row.id} has an invalid taxonomy node`);
    if (Boolean(row.replacementPlanningExcludedAt) !== Boolean(row.replacementPlanningExclusionReason?.trim())) throw new Error(`Asset ${row.id} has an incomplete lifecycle-planning exclusion`);
    if (row.replacementPlanningExcludedAt && row.replacementProfileId) throw new Error(`Asset ${row.id} cannot be both lifecycle-planning excluded and assigned to a replacement profile`);
    const tagKey = `${row.organizationId}:${row.storeId}:${row.assetTag.trim().toLocaleLowerCase("en-US")}`;
    if (!row.assetTag.trim() || assetTagKeys.has(tagKey)) throw new Error(`Asset ${row.id} has a missing or duplicate store equipment tag`);
    assetTagKeys.add(tagKey);
  });
  fixture.components.forEach((row) => {
    if (!assetIds.has(row.assetId)) throw new Error(`Component ${row.id} has no asset`);
    if (row.parentComponentId) {
      const parent = fixture.components.find((candidate) => candidate.organizationId === row.organizationId && candidate.id === row.parentComponentId);
      if (!parent || parent.assetId !== row.assetId) throw new Error(`Component ${row.id} has an invalid component parent`);
    }
  });
  fixture.pmOccurrences.forEach((row) => {
    const plan = fixture.pmPlans.find((item) => item.organizationId === row.organizationId && item.id === row.planId);
    if (!plan || plan.storeId !== row.storeId || plan.assetId !== row.assetId) throw new Error(`PM occurrence ${row.id} does not match its plan target`);
    if (row.status === "completed" && (!row.completedAt || row.completedAt < row.windowStartsAt || row.completedAt > row.windowEndsAt)) throw new Error(`Completed PM occurrence ${row.id} is outside its evidence window`);
    if (row.status === "missed" && row.windowEndsAt >= fixture.asOf) throw new Error(`Missed PM occurrence ${row.id} still has an open completion window`);
    if (row.status === "due" && row.windowEndsAt < fixture.asOf) throw new Error(`Due PM occurrence ${row.id} is already outside its completion window`);
    if (row.workOrderId) {
      const workOrder = fixture.workOrders.find((item) => item.organizationId === row.organizationId && item.id === row.workOrderId);
      if (!workOrder || workOrder.storeId !== row.storeId || workOrder.assetId !== row.assetId) throw new Error(`PM occurrence ${row.id} has an invalid work order target`);
    }
  });
  fixture.costLines.forEach((row) => { const workOrder = fixture.workOrders.find((item) => item.organizationId === row.organizationId && item.id === row.workOrderId); if (!workOrder || row.amount.amountMinor < 0) throw new Error(`Cost line ${row.id} is invalid`); });
  fixture.invoiceReferences.forEach((row) => { if (!vendorIds.has(row.vendorId) || row.grossAmount.amountMinor < 0) throw new Error(`Invoice ${row.id} is invalid`); });
  fixture.invoiceAllocations.forEach((row) => { const invoice = fixture.invoiceReferences.find((item) => item.organizationId === row.organizationId && item.id === row.invoiceReferenceId); if (!workOrderIds.has(row.workOrderId) || !invoiceIds.has(row.invoiceReferenceId) || !invoice || row.amount.currency !== invoice.grossAmount.currency || row.amount.amountMinor < 0) throw new Error(`Invoice allocation ${row.id} is invalid`); });
  fixture.invoiceReferences.filter((invoice) => invoice.matchStatus === "confirmed").forEach((invoice) => { const allocated = fixture.invoiceAllocations.filter((item) => item.organizationId === invoice.organizationId && item.invoiceReferenceId === invoice.id).reduce((sum, item) => sum + item.amount.amountMinor, 0); if (allocated !== invoice.grossAmount.amountMinor) throw new Error(`Confirmed invoice ${invoice.id} does not reconcile`); });
  const entityIds: Record<EntityFileLink["entityType"], Set<string>> = { request: new Set(fixture.requests.map((row) => row.id)), work_order: workOrderIds, visit: visitIds, asset: assetIds, invoice_reference: invoiceIds, invoice: new Set(fixture.invoices.map((row) => row.id)) };
  fixture.files.forEach((row) => { if (!/^[a-f0-9]{64}$/i.test(row.sha256) || row.byteLength <= 0 || !row.storageKey.trim()) throw new Error(`File ${row.id} has invalid immutable metadata`); });
  fixture.entityFiles.forEach((row) => { if (!fileIds.has(row.fileId) || !entityIds[row.entityType].has(row.entityId)) throw new Error(`Entity file ${row.id} has an invalid target`); });
  [...fixture.auditEvents, ...fixture.outboxMessages].forEach((row) => { try { JSON.parse(row.payloadJson); } catch { throw new Error(`Event ${row.id} has invalid JSON`); } });
  return true;
}

assertOpsFixture(presentationFixture);
