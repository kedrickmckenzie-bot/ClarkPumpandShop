import type {
  Asset,
  AssetComponent,
  AssetReplacementOverride,
  AuditEvent,
  CostLine,
  ComponentTemplate,
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
  ScopeGrant,
  ServiceRequest,
  Store,
  TaxonomyNode,
  User,
  Vendor,
  VendorCoverage,
  VendorEstimateProposal,
  VendorResponse,
  VendorSpecialty,
  VisitEvidence,
  VisitSession,
  WorkOrder,
  WorkOrderAssignment,
  WorkOrderEstimateRequest,
  WorkOrderIssuance,
  FollowUp,
  StoredFile,
  EntityFileLink,
} from "./types";

export const NORTHLINE_ORGANIZATION_ID = "org-northline-demo";
export const NORTHLINE_AS_OF = "2026-08-10T18:00:00.000Z";

export const NORTHLINE_DEMO_ENTRY_TOKENS = {
  store104: "yxXEL85UZIlTAPwVDanaA1n5n2O0Sx5cmQc2s3TQYUM",
  serviceAuthorization104: "zdRfp4QemuXSqKVoHtsMHuwXGz4wlruU89tmDjNk7Ts",
  activeVisit112: "L0HMN2vA08eONSnasubFYbEiklRGSjpQQpbP6Ld6vMo",
  trustedStore104: "wjru_t6__2kW59QM_kQw62VgYgeNZporOvMEzA1Sf5w",
  estimate105Summit: "LvS1x4HpenFPweeAyDmSa4ZRo-zemfa_sZpZrnlQWbw",
  estimate105Cedar: "Sq3z2tPc9fnBoy7K_qr3caQzey4BSWhGNGZD9o8Xp4E",
} as const;

export const NORTHLINE_DEMO_TOKEN_HASHES = {
  store104: "380a766b446fd70df62f1707d101e515b07fb211397c65b5a2f3a26864f79db1",
  serviceAuthorization104: "5682e8cb6a878b9abb5c7b0cfd870af97c933cd79ce9fb2bcb9d8b88ccf20fa8",
  activeVisit112: "1934698154df94b020ccec22c3cab4023bcd4b0b2c6a5ac62c914d42b395832d",
  trustedStore104: "04ba6edfb1020edc3253848bacd7bf9441371f1dde84d8b4a079f8e0f8b94046",
  estimate105Summit: "1d82353ab0ce89b2414d3763529186420dad5ca03d48b77b39f91113baa1b81a",
  estimate105Cedar: "2a1e058b63bbae4102b951756a71a0ed25176e69aba067bca2101475b7184c2a",
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
  ["summit", "Summit Refrigeration", "service@summit-demo.example", "(555) 010-2201", true],
  ["cedar", "Cedar Mechanical", "dispatch@cedar-demo.example", "(555) 010-2202", true],
  ["forecourt", "Forecourt Systems Group", "dispatch@forecourt-demo.example", "(555) 010-2203", true],
  ["brightpath", "BrightPath Electrical", "service@brightpath-demo.example", "(555) 010-2204", false],
  ["four-seasons", "Four Seasons Site Services", "dispatch@fourseasons-demo.example", "(555) 010-2205", false],
] as const;

const specialtySeeds: Record<string, Array<[string, string, string[]]>> = {
  summit: [["refrigeration", "Refrigeration", ["beer cave", "walk-in cooler", "freezer", "ice machine", "cooler"]], ["hvac", "HVAC", ["rooftop unit", "air conditioning", "heat"]]],
  cedar: [["hvac", "HVAC", ["rooftop unit", "air conditioning"]], ["plumbing", "Plumbing", ["plumber", "drain", "leak"]], ["foodservice", "Foodservice equipment", ["oven", "fryer", "hot case"]]],
  forecourt: [["forecourt", "Fuel and forecourt", ["dispenser", "pump", "payment terminal", "fuel system"]]],
  brightpath: [["electrical", "Electrical", ["electrician", "canopy lighting", "sign", "low voltage", "security"]]],
  "four-seasons": [["exterior", "Exterior and grounds", ["landscaping", "snow", "parking lot", "striping", "lot"]]],
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
  const organization = { id: NORTHLINE_ORGANIZATION_ID, name: "Northline Fuel & Market", slug: "northline-demo", timeZone: "America/New_York", workOrderPrefix: "NL", createdAt: at(1, 2, 14) };
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
    ["fuel-dispenser", "taxonomy-northline-dispensers", "Two-sided fuel dispenser", 15],
    ["rapid-cook-oven", "taxonomy-northline-ovens", "Rapid-cook oven", 8],
  ].map(([key, taxonomyNodeId, name, life]) => ({ id: `equipment-template-${key}`, organizationId: organization.id, taxonomyNodeId: String(taxonomyNodeId), name: String(name), defaultExpectedLifeYears: Number(life), active: true, createdAt: organization.createdAt }));
  const componentTemplates: ComponentTemplate[] = [];
  const addTemplateComponents = (equipmentKey: string, rows: Array<[string, string, string?]>) => rows.forEach(([key, name, parentKey], sortOrder) => componentTemplates.push({ id: `component-template-${equipmentKey}-${key}`, organizationId: organization.id, equipmentTemplateId: `equipment-template-${equipmentKey}`, parentComponentTemplateId: parentKey ? `component-template-${equipmentKey}-${parentKey}` : undefined, name, sortOrder, createdAt: organization.createdAt }));
  addTemplateComponents("beer-cave", [["condensing-unit", "Condensing unit"], ["compressor", "Compressor", "condensing-unit"], ["condenser-fan", "Condenser fan motor", "condensing-unit"], ["evaporator", "Evaporator"], ["evaporator-fan", "Evaporator fan motor", "evaporator"], ["controller", "Temperature controller"], ["shelving", "Shelving"]]);
  addTemplateComponents("walk-in-freezer", [["condensing-unit", "Condensing unit"], ["compressor", "Compressor", "condensing-unit"], ["evaporator", "Evaporator"], ["evaporator-fan", "Evaporator fan motor", "evaporator"], ["defrost", "Defrost system"], ["controller", "Temperature controller"], ["door-heater", "Door heater"]]);
  addTemplateComponents("ice-machine", [["compressor", "Compressor"], ["water-pump", "Water pump"], ["evaporator", "Evaporator plate"], ["control-board", "Control board"], ["bin", "Storage bin"]]);
  addTemplateComponents("rtu-5ton", [["compressor", "Compressor"], ["supply-fan", "Supply fan motor"], ["condenser-fan", "Condenser fan motor"], ["heat-exchanger", "Heat exchanger"], ["controls", "Controls"], ["thermostat", "Thermostat", "controls"]]);
  addTemplateComponents("fuel-dispenser", [["payment-terminal", "Payment terminal"], ["meter", "Meter"], ["display", "Display"], ["hose", "Hose"], ["nozzle", "Nozzle", "hose"], ["breakaway", "Breakaway", "hose"]]);
  addTemplateComponents("rapid-cook-oven", [["control-board", "Control board"], ["magnetron", "Magnetron"], ["blower-motor", "Blower motor"], ["door-switch", "Door switch"], ["temperature-probe", "Temperature probe"]]);
  const stores: Store[] = storeSeeds.map(([number, name, address1, city, state, postalCode, latitudeE6, longitudeE6], index) => ({
    id: `store-northline-${number}`, organizationId: organization.id, divisionId: divisions[0].id, regionId: regions[Math.floor(index / 5)].id,
    storeNumber: number, name: `Northline ${name}`, address1, city, state, postalCode,
    aliases: [name, `Store ${number}`, `${number} ${city}`], latitudeE6, longitudeE6, geofenceRadiusM: index === 6 ? 125 : 180, locationPolicyEnabled: true, timeZone: "America/New_York", status: "active", createdAt: at(1, 3, 14),
  }));

  const users: User[] = [
    { id: "user-northline-executive", email: "alex.morgan@northline-demo.example", displayName: "Alex Morgan", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-facilities", email: "jordan.lee@northline-demo.example", displayName: "Jordan Lee", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-tech-1", email: "maria.santos@northline-demo.example", displayName: "Maria Santos", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-tech-2", email: "devon.price@northline-demo.example", displayName: "Devon Price", status: "active", createdAt: at(1, 2, 15) },
    ...regions.map((region, index) => ({ id: `user-northline-regional-${index + 1}`, email: `regional${index + 1}@northline-demo.example`, displayName: ["Taylor Reed", "Morgan Hayes", "Casey Brooks"][index], status: "active" as const, createdAt: at(1, 2, 15) })),
    { id: "user-northline-store-104", email: "store104.manager@northline-demo.example", displayName: "Robin Carter", status: "active", createdAt: at(1, 2, 15) },
    { id: "user-northline-finance", email: "finance.review@northline-demo.example", displayName: "Parker Shaw", status: "active", createdAt: at(1, 2, 15) },
  ];
  const memberships: Membership[] = [
    { id: "membership-northline-executive", organizationId: organization.id, userId: users[0].id, role: "executive", status: "active", createdAt: users[0].createdAt },
    { id: "membership-northline-facilities", organizationId: organization.id, userId: users[1].id, role: "facilities_admin", status: "active", createdAt: users[1].createdAt },
    { id: "membership-northline-tech-1", organizationId: organization.id, userId: users[2].id, role: "internal_technician", status: "active", createdAt: users[2].createdAt },
    { id: "membership-northline-tech-2", organizationId: organization.id, userId: users[3].id, role: "internal_technician", status: "active", createdAt: users[3].createdAt },
    ...regions.map((region, index) => ({ id: `membership-northline-regional-${index + 1}`, organizationId: organization.id, userId: users[index + 4].id, role: "regional_manager" as const, status: "active" as const, createdAt: users[index + 4].createdAt })),
    { id: "membership-northline-store-104", organizationId: organization.id, userId: "user-northline-store-104", role: "store_manager", status: "active", createdAt: at(1, 2, 15) },
    { id: "membership-northline-finance", organizationId: organization.id, userId: "user-northline-finance", role: "finance_reviewer", status: "active", createdAt: at(1, 2, 15) },
  ];
  const scopeGrants: ScopeGrant[] = [
    ...memberships.slice(0, 4).map((membership) => ({ id: `scope-${membership.id}`, organizationId: organization.id, membershipId: membership.id, scopeKind: "organization" as const, scopeId: organization.id, permission: "ops:*", createdAt: membership.createdAt })),
    ...regions.map((region, index) => ({ id: `scope-northline-regional-${index + 1}`, organizationId: organization.id, membershipId: `membership-northline-regional-${index + 1}`, scopeKind: "region" as const, scopeId: region.id, permission: "ops:read_write", createdAt: at(1, 2, 15) })),
    { id: "scope-membership-northline-store-104", organizationId: organization.id, membershipId: "membership-northline-store-104", scopeKind: "store", scopeId: "store-northline-104", permission: "ops:store_manage", createdAt: at(1, 2, 15) },
    { id: "scope-membership-northline-finance", organizationId: organization.id, membershipId: "membership-northline-finance", scopeKind: "organization", scopeId: organization.id, permission: "ops:finance_read", createdAt: at(1, 2, 15) },
  ];

  const vendors: Vendor[] = vendorSeeds.map(([code, name, email, phone, preferred]) => ({ id: `vendor-northline-${code}`, organizationId: organization.id, code, name, dispatchEmail: email, dispatchPhone: phone, status: "approved", preferred, createdAt: at(1, 4, 14) }));
  const vendorSpecialties: VendorSpecialty[] = vendors.flatMap((vendor) => specialtySeeds[vendor.code].map(([canonicalKey, displayName, searchAliases]) => ({ id: `specialty-${vendor.code}-${canonicalKey}`, organizationId: organization.id, vendorId: vendor.id, canonicalKey, displayName, searchAliases })));
  const vendorCoverage: VendorCoverage[] = vendors.map((vendor, index) => ({ id: `coverage-${vendor.code}-all`, organizationId: organization.id, vendorId: vendor.id, scopeKind: "organization", scopeId: organization.id, preferredRank: index < 3 ? 1 : 2 }));

  const replacementProfiles: ReplacementProfile[] = [
    { id: "replacement-profile-beer-cave-medium", organizationId: organization.id, code: "REF-BEER-CAVE-MED", name: "Medium beer cave refrigeration system", description: "Functionally equivalent medium beer-cave condensing system, independent of manufacturer or installer.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", matchKeys: ["application", "capacity_band", "refrigerant"], attributes: { application: "beer_cave", capacity_band: "medium", refrigerant: "r448a" }, expectedLifeYears: 12, annualEscalationBps: 350, lowVarianceBps: 1000, highVarianceBps: 1800, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-rtu-5ton", organizationId: organization.id, code: "HVAC-RTU-5T", name: "5-ton sales-floor rooftop unit", description: "Packaged rooftop HVAC replacement including standard curb adaptation and controls.", categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", matchKeys: ["equipment_type", "capacity_tons", "heat_type"], attributes: { equipment_type: "packaged_rtu", capacity_tons: "5", heat_type: "gas" }, expectedLifeYears: 15, annualEscalationBps: 300, lowVarianceBps: 1200, highVarianceBps: 2200, active: true, createdAt: at(1, 5, 13) },
    { id: "replacement-profile-dispenser-two-sided", organizationId: organization.id, code: "FUEL-DISP-2S", name: "Two-sided retail fuel dispenser", description: "Two-sided dispenser replacement with payment hardware and standard commissioning.", categoryKey: "forecourt", taxonomyNodeId: "taxonomy-northline-dispensers", matchKeys: ["equipment_type", "sides", "payment_enabled"], attributes: { equipment_type: "fuel_dispenser", sides: "2", payment_enabled: "yes" }, expectedLifeYears: 15, annualEscalationBps: 275, lowVarianceBps: 800, highVarianceBps: 1500, active: true, createdAt: at(1, 5, 13) },
  ];

  const assets: Asset[] = stores.flatMap((store): Asset[] => [
    { id: `asset-${store.id.slice(-3)}-beer-cave`, organizationId: organization.id, storeId: store.id, categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", groupPath: ["Refrigeration", "Walk-in refrigeration", "Coolers", "Beer caves"], assetTag: `${store.storeNumber}-REF-01`, name: "Beer cave condensing unit", manufacturer: store.storeNumber === "104" ? "Heatcraft" : "Copeland", model: store.storeNumber === "104" ? "LHT040L6C" : "M4FH-A050", serialNumber: `NL${store.storeNumber}REF01`, supplier: "Regional Equipment Supply", installedAt: atYear(store.storeNumber === "115" ? 2019 : 2017 + (Number(store.storeNumber) % 5), 4, 12), expectedLifeYears: 12, warrantyEndsAt: atYear(store.storeNumber === "115" ? 2024 : 2022 + (Number(store.storeNumber) % 5), 4, 12), replacementProfileId: "replacement-profile-beer-cave-medium", replacementAttributes: { application: "beer_cave", capacity_band: "medium", refrigerant: "r448a" }, replacementAdjustmentBps: store.storeNumber === "104" ? 500 : undefined, replacementEstimate: { amountMinor: 2_800_000 + Number(store.storeNumber) * 1000, currency: "USD" }, status: store.storeNumber === "115" ? "watch" : "operational", createdAt: at(1, 5, 14) },
    { id: `asset-${store.id.slice(-3)}-rtu-1`, organizationId: organization.id, storeId: store.id, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", groupPath: ["HVAC", "Rooftop units"], assetTag: `${store.storeNumber}-HVAC-01`, name: "Sales floor rooftop unit", manufacturer: "Trane", model: "Precedent YSC", serialNumber: `NL${store.storeNumber}HVAC01`, supplier: "Cedar Mechanical", installedAt: atYear(2018 + (Number(store.storeNumber) % 4), 6, 1), expectedLifeYears: 15, warrantyEndsAt: atYear(2023 + (Number(store.storeNumber) % 4), 6, 1), replacementProfileId: "replacement-profile-rtu-5ton", replacementAttributes: { equipment_type: "packaged_rtu", capacity_tons: "5", heat_type: "gas" }, replacementEstimate: { amountMinor: 1_950_000, currency: "USD" }, status: store.storeNumber === "112" ? "watch" : "operational", createdAt: at(1, 5, 14) },
    { id: `asset-${store.id.slice(-3)}-dispenser-4`, organizationId: organization.id, storeId: store.id, categoryKey: "forecourt", taxonomyNodeId: "taxonomy-northline-dispensers", groupPath: ["Fuel and forecourt", "Dispensers"], assetTag: `${store.storeNumber}-FUEL-04`, name: "Fuel dispenser 4", manufacturer: "Gilbarco", model: "Encore 700 S", serialNumber: `NL${store.storeNumber}FUEL04`, supplier: "Forecourt Systems Group", installedAt: atYear(2019 + (Number(store.storeNumber) % 3), 9, 15), expectedLifeYears: 15, warrantyEndsAt: atYear(2024 + (Number(store.storeNumber) % 3), 9, 15), replacementProfileId: "replacement-profile-dispenser-two-sided", replacementAttributes: { equipment_type: "fuel_dispenser", sides: "2", payment_enabled: "yes" }, replacementEstimate: { amountMinor: 2_250_000, currency: "USD" }, status: store.storeNumber === "109" ? "watch" : "operational", createdAt: at(1, 5, 14) },
  ]);
  const replacementBenchmarks: ReplacementBenchmark[] = [
    { id: "replacement-benchmark-beer-cave-2024", organizationId: organization.id, profileId: "replacement-profile-beer-cave-medium", sourceType: "manual", equipmentAmount: { amountMinor: 1_920_000, currency: "USD" }, installationAmount: { amountMinor: 730_000, currency: "USD" }, otherAmount: { amountMinor: 0, currency: "USD" }, totalAmount: { amountMinor: 2_650_000, currency: "USD" }, effectiveAt: atYear(2024, 2, 15), status: "published", notes: "Original planning benchmark entered from the 2024 refrigeration refresh.", createdAt: atYear(2024, 2, 15) },
    { id: "replacement-benchmark-rtu-2025", organizationId: organization.id, profileId: "replacement-profile-rtu-5ton", sourceType: "catalog", equipmentAmount: { amountMinor: 1_420_000, currency: "USD" }, installationAmount: { amountMinor: 610_000, currency: "USD" }, otherAmount: { amountMinor: 120_000, currency: "USD" }, totalAmount: { amountMinor: 2_150_000, currency: "USD" }, effectiveAt: atYear(2025, 10, 1), status: "published", notes: "Budgetary replacement benchmark reviewed with facilities.", createdAt: atYear(2025, 10, 1) },
    { id: "replacement-benchmark-dispenser-2025", organizationId: organization.id, profileId: "replacement-profile-dispenser-two-sided", sourceType: "catalog", equipmentAmount: { amountMinor: 2_150_000, currency: "USD" }, installationAmount: { amountMinor: 480_000, currency: "USD" }, otherAmount: { amountMinor: 170_000, currency: "USD" }, totalAmount: { amountMinor: 2_800_000, currency: "USD" }, effectiveAt: atYear(2025, 11, 1), status: "published", notes: "Budgetary dispenser benchmark including payment commissioning.", createdAt: atYear(2025, 11, 1) },
  ];
  const assetReplacementOverrides: AssetReplacementOverride[] = [
    { id: "replacement-override-104-beer-cave", organizationId: organization.id, assetId: "asset-104-beer-cave", amount: { amountMinor: 3_480_000, currency: "USD" }, effectiveAt: atYear(2026, 5, 1), reason: "Store 104 requires a longer line set and rooftop crane access.", status: "active", createdAt: atYear(2026, 5, 1) },
  ];
  const replacementEvents: ReplacementEvent[] = [];
  const components: AssetComponent[] = [
    { id: "component-104-compressor", organizationId: organization.id, assetId: "asset-104-beer-cave", name: "Compressor", partNumber: "ZB38KCE-TFD", serialNumber: "CMP104-88214", installedAt: atYear(2021, 5, 6), warrantyEndsAt: atYear(2026, 5, 6), createdAt: at(1, 5, 14) },
    { id: "component-104-controller", organizationId: organization.id, assetId: "asset-104-beer-cave", name: "Temperature controller", partNumber: "XR60CX", serialNumber: "CTL104-44310", installedAt: atYear(2023, 3, 12), warrantyEndsAt: atYear(2025, 3, 12), createdAt: at(1, 5, 14) },
    { id: "component-104-evaporator-fan", organizationId: organization.id, assetId: "asset-104-beer-cave", name: "Evaporator fan motor", partNumber: "ECM-5108", installedAt: atYear(2024, 8, 18), warrantyEndsAt: atYear(2026, 8, 18), createdAt: at(1, 5, 14) },
  ];

  const requests: ServiceRequest[] = [];
  const workOrders: WorkOrder[] = [];
  const assignments: WorkOrderAssignment[] = [];
  const issuances: WorkOrderIssuance[] = [];
  const vendorResponses: VendorResponse[] = [];
  const estimateRequests: WorkOrderEstimateRequest[] = [];
  const estimateProposals: VendorEstimateProposal[] = [];
  const visits: VisitSession[] = [];
  const visitEvidence: VisitEvidence[] = [];
  const followUps: FollowUp[] = [];
  const files: StoredFile[] = [];
  const entityFiles: EntityFileLink[] = [];
  const exceptions: OpsException[] = [];
  const costLines: CostLine[] = [];
  const invoiceReferences: InvoiceReference[] = [];
  const invoiceAllocations: InvoiceAllocation[] = [];
  const auditEvents: AuditEvent[] = [];
  const outboxMessages: OutboxMessage[] = [];

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
    workOrders.push({ id: workOrderId, organizationId: organization.id, number: `NL-2026-${String(101 + index).padStart(4, "0")}`, storeId: store.id, requestId, problem, authorizedScope: `Diagnose and complete repairs necessary to restore ${categoryKey} operation; call before exceeding authorization.`, categoryKey, taxonomyNodeId: assetId ? (categoryKey === "refrigeration" ? "taxonomy-northline-beer_caves" : categoryKey === "hvac" ? "taxonomy-northline-rooftop_units" : "taxonomy-northline-dispensers") : `taxonomy-northline-${categoryKey}`, assetId, componentId: store.storeNumber === "104" ? "component-104-compressor" : undefined, priority: store.storeNumber === "104" || currentActive ? "urgent" : "routine", status: chooseLater ? "approved" : currentActive ? "in_progress" : "closed", accountableParty: chooseLater ? "Facilities coordinator" : currentActive ? "Cedar Mechanical" : "Facilities", nextAction: chooseLater ? "Choose service provider" : currentActive ? "Record service outcome" : "No action required", dueAt: chooseLater ? at(8, 12, 16) : currentActive ? at(8, 10, 22) : undefined, escalationTo: chooseLater || currentActive ? "Facilities director" : undefined, nte: !chooseLater ? { amountMinor: 125_000 + index * 5_000, currency: "USD" } : undefined, repairEstimate: store.storeNumber === "115" ? { amountMinor: 1_800_000, currency: "USD" } : undefined, estimatedServiceExtensionMonths: store.storeNumber === "115" ? 60 : undefined, vendorServiceTicketNumber: vendorId ? `SV-${26000 + index}` : undefined, createdAt: workTime, closedAt: !chooseLater && !currentActive ? at(7, 7 + index, 18) : undefined });
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
      issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: issuedWork.number, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: assignedVendor ? { id: assignedVendor.id, name: assignedVendor.name } : { id: internalMember?.id ?? "internal-maintenance", name: internalUser?.displayName ?? "Northline Internal Maintenance" }, problem, priority: issuedWork.priority, authorizedScope: issuedWork.authorizedScope, categoryKey, asset: issuedAsset ? { id: issuedAsset.id, name: issuedAsset.name, assetTag: issuedAsset.assetTag } : undefined, requestedTiming: issuedWork.dueAt, nte: issuedWork.nte, billingInstruction: `Reference operator work order ${issuedWork.number} on all service paperwork and invoices.` }), channel: internal ? "manual" : "email", issuedAt });
      if (vendorId) vendorResponses.push({ id: `response-northline-${store.storeNumber}`, organizationId: organization.id, workOrderId, assignmentId, issuanceId, response: "accepted", responderName: "Vendor dispatch", respondedAt: new Date(Date.parse(issuedAt) + 25 * 60_000).toISOString(), proposedAt: currentActive ? at(8, 10, 17) : undefined });
    }
    if (!chooseLater) {
      const providerKind = internal ? "internal" as const : "outside_vendor" as const;
      const providerName = internal ? "Northline Internal Maintenance" : vendors.find((vendor) => vendor.id === vendorId)!.name;
      const start = currentActive ? at(8, 10, 17, 15) : at(7, 6 + index, 14);
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
          invoiceReferences.push({ id: invoiceId, organizationId: organization.id, vendorId, invoiceNumber: `INV-${store.storeNumber}-26`, invoiceDate: end!.slice(0, 10), grossAmount: { amountMinor: total, currency: "USD" }, operatorWorkOrderNumber: matchStatus === "unmatched" ? undefined : `NL-2026-${String(101 + index).padStart(4, "0")}`, matchStatus, createdAt: new Date(Date.parse(end!) + 86_400_000).toISOString() });
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
      const providerName = internal ? "Northline Internal Maintenance" : assignedVendor.name;
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
      const workOrderNumber = `NL-${visitStart.slice(0, 4)}-${String(20 + storeIndex * 4 + historyIndex).padStart(4, "0")}`;
      const problem = store.storeNumber === "104" && categoryKey === "refrigeration"
        ? "Beer cave compressor is short-cycling and tripping on high head pressure"
        : problemByCategory[categoryKey];
      const baseCost = historicalCostByCategory[categoryKey];
      const variance = 90 + ((storeIndex * 11 + historyIndex * 7) % 31);
      let labor = Math.round(baseCost.labor * variance / 100);
      let parts = Math.round(baseCost.parts * variance / 100);
      if (store.storeNumber === "104" && categoryKey === "refrigeration") {
        labor = 95_000;
        parts = 365_000;
      }
      const travel = internal ? 0 : (storeIndex + historyIndex) % 3 === 0 ? 12_500 : 0;
      const recordedTotal = labor + parts + travel;
      const nteAmountMinor = recordedTotal + 30_000;

      requests.push({ id: requestId, organizationId: organization.id, reference: `REQ-${visitStart.slice(2, 4)}-${idSuffix}`, storeId: store.id, reporterName: ["Avery Johnson", "Jamie Cole", "Riley Adams"][historyIndex % 3], reporterEmployeeId: `E${4000 + storeIndex * 4 + historyIndex}`, problem, priority: historyIndex === 0 && storeIndex % 5 === 0 ? "urgent" : "routine", status: "converted", submittedAt: requestTime, convertedWorkOrderId: workOrderId });
      workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: store.id, requestId, problem, authorizedScope: `Diagnose the reported ${categoryKey} issue, complete repairs within the authorization limit, and document the outcome.`, categoryKey, taxonomyNodeId: taxonomyByCategory[categoryKey], assetId, componentId, priority: historyIndex === 0 && storeIndex % 5 === 0 ? "urgent" : "routine", status: "closed", accountableParty: providerName, nextAction: "No action required", nte: { amountMinor: nteAmountMinor, currency: "USD" }, vendorServiceTicketNumber: internal ? undefined : `${assignedVendor.code.toUpperCase()}-${visitStart.slice(2, 4)}${String(5000 + storeIndex * 4 + historyIndex)}`, createdAt: workTime, closedAt: visitEnd });
      assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: internal ? "internal" : "outside_vendor", vendorId: internal ? undefined : vendorId, internalMembershipId, status: "completed", assignedAt });
      issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: internal ? { id: internalMembershipId ?? "internal-maintenance", name: internalUser?.displayName ?? "Northline Internal Maintenance" } : { id: assignedVendor.id, name: assignedVendor.name }, problem, priority: historyIndex === 0 && storeIndex % 5 === 0 ? "urgent" : "routine", authorizedScope: `Diagnose the reported ${categoryKey} issue, complete repairs within the authorization limit, and document the outcome.`, categoryKey, asset: asset ? { id: asset.id, name: asset.name, assetTag: asset.assetTag } : undefined, requestedTiming: visitStart, nte: { amountMinor: nteAmountMinor, currency: "USD" }, billingInstruction: `Reference operator work order ${workOrderNumber} on all service paperwork and invoices.` }), channel: internal ? "manual" : "email", issuedAt });
      if (!internal) vendorResponses.push({ id: `response-history-${idSuffix}`, organizationId: organization.id, workOrderId, assignmentId, issuanceId, response: "accepted", responderName: `${assignedVendor.name} dispatch`, respondedAt: new Date(Date.parse(issuedAt) + 20 * 60_000).toISOString(), proposedAt: visitStart });
      visits.push({ id: visitId, organizationId: organization.id, storeId: store.id, providerKind: internal ? "internal" : "outside_vendor", vendorId: internal ? undefined : vendorId, internalMembershipId, workOrderId, technicianName: internal ? (internalUser?.displayName ?? "Northline technician") : ["Chris Walker", "Sam Patel", "Drew Miller", "Dana Ruiz"][historyIndex], providerName, purpose: problem, status: "checked_out", startedChannel: internal ? "store_device" : historyIndex % 2 ? "secure_link" : "qr", endedChannel: internal ? "store_device" : historyIndex % 2 ? "qr" : "secure_link", checkedInAt: visitStart, checkedOutAt: visitEnd, outcome: "resolved", outcomeNotes: historicalOutcomeByCategory[categoryKey], observedDurationSeconds: durationSeconds(visitStart, visitEnd) });
      visitEvidence.push(
        { id: `evidence-${visitId}-in`, organizationId: organization.id, visitId, kind: "check_in", channel: internal ? "store_device" : historyIndex % 2 ? "secure_link" : "qr", observedAt: visitStart, location: internal ? { result: "trusted_store_device", capturedAt: visitStart } : { result: "verified", accuracyM: 14 + historyIndex * 3, distanceM: 18 + storeIndex, capturedAt: visitStart }, payloadJson: JSON.stringify({ workOrderNumber }) },
        { id: `evidence-${visitId}-out`, organizationId: organization.id, visitId, kind: "check_out", channel: internal ? "store_device" : historyIndex % 2 ? "qr" : "secure_link", observedAt: visitEnd, location: internal ? { result: "trusted_store_device", capturedAt: visitEnd } : { result: "verified", accuracyM: 17 + historyIndex * 3, distanceM: 21 + storeIndex, capturedAt: visitEnd }, payloadJson: JSON.stringify({ outcome: "resolved" }) },
      );
      const recordedAt = new Date(Date.parse(visitEnd) + 45 * 60_000).toISOString();
      costLines.push(
        { id: `cost-history-${idSuffix}-labor`, organizationId: organization.id, workOrderId, kind: "labor", description: `${providerName} service labor`, amount: { amountMinor: labor, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt },
        { id: `cost-history-${idSuffix}-${baseCost.partsKind}`, organizationId: organization.id, workOrderId, kind: baseCost.partsKind, description: categoryKey === "exterior" ? "Site repair materials" : "Repair parts and materials", amount: { amountMinor: parts, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt },
      );
      if (travel) costLines.push({ id: `cost-history-${idSuffix}-travel`, organizationId: organization.id, workOrderId, kind: "travel", description: "Recorded service-call travel charge", amount: { amountMinor: travel, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt });

      if (!internal && (storeIndex + historyIndex) % 3 === 0) {
        const invoiceId = `invoice-history-${idSuffix}`;
        const matchRoll = (storeIndex + historyIndex) % 9;
        const matchStatus: InvoiceReference["matchStatus"] = matchRoll === 0 ? "unmatched" : matchRoll === 1 ? "suggested" : matchRoll === 2 ? "rejected" : "confirmed";
        const invoiceTotal = matchStatus === "unmatched" ? recordedTotal + 50_000 : recordedTotal;
        invoiceReferences.push({ id: invoiceId, organizationId: organization.id, vendorId, invoiceNumber: `${assignedVendor.code.toUpperCase()}-${visitStart.slice(0, 7).replace("-", "")}-${store.storeNumber}-${historyIndex + 1}`, invoiceDate: visitEnd.slice(0, 10), grossAmount: { amountMinor: invoiceTotal, currency: "USD" }, operatorWorkOrderNumber: matchStatus === "unmatched" ? undefined : workOrderNumber, matchStatus, createdAt: new Date(Date.parse(visitEnd) + 2 * 86_400_000).toISOString() });
        if (matchStatus === "confirmed") invoiceAllocations.push({ id: `allocation-history-${idSuffix}`, organizationId: organization.id, invoiceReferenceId: invoiceId, workOrderId, amount: { amountMinor: invoiceTotal, currency: "USD" }, confirmedByMembershipId: "membership-northline-finance", confirmedAt: new Date(Date.parse(visitEnd) + 3 * 86_400_000).toISOString() });
        if (matchStatus === "unmatched") exceptions.push({ id: `exception-${invoiceId}-unmatched`, organizationId: organization.id, kind: "unmatched_invoice", storeId: store.id, vendorId, severity: "attention", status: "resolved", summary: `Invoice ${invoiceId} arrived without an operator work-order reference`, detectedAt: new Date(Date.parse(visitEnd) + 2 * 86_400_000).toISOString() });
      }
    }
  });

  // A separate, current Store 104 authorization powers the account-free
  // accept/decline/propose/question flow without rewriting the closed
  // compressor history used for lifecycle drill-down.
  const publicRequestId = "request-northline-104-new";
  const publicWorkOrderId = NORTHLINE_DEMO_HANDLES.publicServiceWorkOrderId;
  const publicAssignmentId = "assignment-northline-104-issued";
  const publicIssuanceId = "issuance-northline-104-issued-r1";
  const publicProblem = "Evaporator fan in the beer cave is cycling intermittently and making a grinding noise";
  requests.push({ id: publicRequestId, organizationId: organization.id, reference: "REQ-26-104B", storeId: "store-northline-104", reporterName: "Avery Johnson", reporterEmployeeId: "E3103", problem: publicProblem, priority: "urgent", status: "converted", submittedAt: at(8, 10, 14), convertedWorkOrderId: publicWorkOrderId });
  workOrders.push({ id: publicWorkOrderId, organizationId: organization.id, number: "NL-2026-0116", storeId: "store-northline-104", requestId: publicRequestId, problem: publicProblem, authorizedScope: "Inspect the evaporator fan assembly, diagnose the noise, and restore normal operation. Call before exceeding authorization.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: "asset-104-beer-cave", componentId: "component-104-evaporator-fan", priority: "urgent", status: "issued", accountableParty: "Summit Refrigeration", nextAction: "Respond to service authorization", dueAt: at(8, 10, 23), escalationTo: "Northline Facilities", nte: { amountMinor: 175_000, currency: "USD" }, repairEstimate: { amountMinor: 125_000, currency: "USD" }, estimatedServiceExtensionMonths: 12, createdAt: at(8, 10, 14, 10) });
  assignments.push({ id: publicAssignmentId, organizationId: organization.id, workOrderId: publicWorkOrderId, kind: "outside_vendor", vendorId: "vendor-northline-summit", status: "issued", assignedAt: at(8, 10, 14, 20) });
  issuances.push({ id: publicIssuanceId, organizationId: organization.id, workOrderId: publicWorkOrderId, assignmentId: publicAssignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: "NL-2026-0116", store: { id: "store-northline-104", storeNumber: "104", name: "Northline Ridgeview", formattedAddress: "104 Ridgeview Drive, Ridgeview, MI 49031" }, vendor: { id: "vendor-northline-summit", name: "Summit Refrigeration" }, problem: publicProblem, priority: "urgent", authorizedScope: "Inspect the evaporator fan assembly, diagnose the noise, and restore normal operation. Call before exceeding authorization.", categoryKey: "refrigeration", asset: { id: "asset-104-beer-cave", name: "Beer cave condensing unit", assetTag: "104-REF-01" }, requestedTiming: at(8, 10, 23), nte: { amountMinor: 175_000, currency: "USD" }, billingInstruction: "Reference operator work order NL-2026-0116 on all service tickets and invoices." }), channel: "email", issuedAt: at(8, 10, 14, 30) });
  auditEvents.push({ id: "audit-wo-northline-104-issued", organizationId: organization.id, aggregateType: "work_order", aggregateId: publicWorkOrderId, eventType: "work_order.issued", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: at(8, 10, 14, 30), payloadJson: JSON.stringify({ assignmentId: publicAssignmentId, issuanceId: publicIssuanceId }) });

  // One canonical Store 105 HVAC repair decision can collect comparable pricing
  // from multiple vendors without fabricating duplicate work orders or costs.
  const priceCheckRequestId = "request-northline-105-price-check";
  const priceCheckWorkOrderId = "wo-northline-105-price-check";
  const priceCheckAssignmentId = "assignment-northline-105-price-check";
  const estimateScope = "Replace the failing rooftop-unit condenser fan motor and capacitor, verify rotation and amperage, and confirm the sales floor reaches setpoint. Include labor, materials, travel, and earliest available service date.";
  const priceCheckProblem = "Sales-floor rooftop unit is cooling intermittently and the condenser fan motor is overheating";
  requests.push({ id: priceCheckRequestId, organizationId: organization.id, reference: "REQ-26-105C", storeId: "store-northline-105", reporterName: "Jamie Collins", reporterEmployeeId: "E4105", problem: priceCheckProblem, priority: "routine", status: "converted", submittedAt: at(8, 10, 14, 40), convertedWorkOrderId: priceCheckWorkOrderId });
  workOrders.push({ id: priceCheckWorkOrderId, organizationId: organization.id, number: "NL-2026-0117", storeId: "store-northline-105", requestId: priceCheckRequestId, problem: priceCheckProblem, categoryKey: "hvac", taxonomyNodeId: "taxonomy-northline-rooftop_units", assetId: "asset-105-rtu-1", priority: "routine", status: "awaiting_approval", accountableParty: "Facilities coordinator", nextAction: "Compare vendor bids and choose the service provider", dueAt: at(8, 10, 20), escalationTo: "Facilities director", createdAt: at(8, 10, 14, 45) });
  assignments.push({ id: priceCheckAssignmentId, organizationId: organization.id, workOrderId: priceCheckWorkOrderId, kind: "choose_later", status: "pending", assignedAt: at(8, 10, 14, 46) });
  estimateRequests.push(
    { id: "estimate-request-105-summit", organizationId: organization.id, workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-summit", kind: "estimate_only", requestedScope: estimateScope, status: "submitted", channel: "email", requestedAt: at(8, 10, 14, 50), dueAt: at(8, 11, 16), openedAt: at(8, 10, 15, 2), respondedAt: at(8, 10, 15, 31) },
    { id: "estimate-request-105-cedar", organizationId: organization.id, workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-cedar", kind: "estimate_only", requestedScope: estimateScope, status: "submitted", channel: "email", requestedAt: at(8, 10, 14, 51), dueAt: at(8, 11, 16), openedAt: at(8, 10, 15, 11), respondedAt: at(8, 10, 16, 4) },
  );
  estimateProposals.push(
    { id: "estimate-proposal-105-summit-r1", organizationId: organization.id, requestId: "estimate-request-105-summit", workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-summit", revision: 1, amount: { amountMinor: 245_000, currency: "USD" }, scope: "Replace the rooftop-unit condenser fan motor and matched capacitor; verify amperage, refrigerant pressures, and supply-air temperature.", exclusions: "Controls, refrigerant leak repair, and after-hours work are excluded.", leadTimeDays: 2, validUntil: at(9, 9, 15, 31), submittedAt: at(8, 10, 15, 31) },
    { id: "estimate-proposal-105-cedar-r1", organizationId: organization.id, requestId: "estimate-request-105-cedar", workOrderId: priceCheckWorkOrderId, vendorId: "vendor-northline-cedar", revision: 1, amount: { amountMinor: 178_000, currency: "USD" }, scope: "Replace the condenser fan motor and capacitor, commission the rooftop unit, and document final amperage and temperature split.", exclusions: "Refrigerant-system repairs and additional failed components require approval.", leadTimeDays: 3, validUntil: at(9, 9, 16, 4), submittedAt: at(8, 10, 16, 4) },
  );
  estimateRequests.forEach((estimateRequest) => auditEvents.push({ id: `audit-${estimateRequest.id}-requested`, organizationId: organization.id, aggregateType: "work_order_estimate_request", aggregateId: estimateRequest.id, eventType: "work_order_estimate.requested", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: estimateRequest.requestedAt, payloadJson: JSON.stringify({ workOrderId: priceCheckWorkOrderId, vendorId: estimateRequest.vendorId, kind: estimateRequest.kind, channel: estimateRequest.channel }) }));
  estimateProposals.forEach((proposal) => auditEvents.push({ id: `audit-${proposal.id}-submitted`, organizationId: organization.id, aggregateType: "vendor_estimate_proposal", aggregateId: proposal.id, eventType: "vendor_estimate.submitted", actorType: "vendor_link", actorName: vendors.find((vendor) => vendor.id === proposal.vendorId)!.name, occurredAt: proposal.submittedAt, payloadJson: JSON.stringify({ requestId: proposal.requestId, workOrderId: proposal.workOrderId, vendorId: proposal.vendorId, revision: proposal.revision, amountMinor: proposal.amount.amountMinor, currency: proposal.amount.currency }) }));

  // Store 115 demonstrates the capital path: two replacement quotes stay on
  // one canonical work order, the selected quote publishes a dated functional
  // benchmark, and no technician assignment or billable visit is created.
  const replacementWork = workOrders.find((row) => row.id === "wo-northline-115")!;
  replacementWork.status = "awaiting_approval";
  replacementWork.accountableParty = "Facilities coordinator";
  replacementWork.nextAction = "Schedule the approved beer-cave replacement and record final installed cost";
  replacementWork.dueAt = at(8, 20, 16);
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
  auditEvents.push({ id: "audit-replacement-event-115-approved", organizationId: organization.id, aggregateType: "asset", aggregateId: "asset-115-beer-cave", eventType: "asset.replacement_approved", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: at(8, 9, 14), payloadJson: JSON.stringify({ replacementEventId: "replacement-event-115-approved", profileId: "replacement-profile-beer-cave-medium", sourceEstimateProposalId: "estimate-proposal-115-summit-r1", benchmarkId: "replacement-benchmark-beer-cave-2026-quote" }) });

  // Store 104 has a second visit to make the linked repeat-work story real at
  // the exact compressor level rather than relying on a generic repeat flag.
  const first104 = visits.find((visit) => visit.id === "visit-northline-104-1")!;
  first104.outcome = "diagnosed_waiting_parts";
  first104.outcomeNotes = "Compressor is drawing high amperage; replacement required. Unit left in temporary operation.";
  const evidence104 = visitEvidence.find((event) => event.id === "evidence-visit-northline-104-1-out")!;
  evidence104.payloadJson = JSON.stringify({ outcome: "diagnosed_waiting_parts" });
  const followUp104: FollowUp = { id: "follow-up-northline-104-parts", organizationId: organization.id, workOrderId: "wo-northline-104", sourceVisitId: first104.id, accountableParty: "Summit Refrigeration", nextAction: "Return with compressor and complete replacement", dueAt: at(7, 10, 20), escalationTo: "Northline Facilities", status: "completed", createdAt: first104.checkedOutAt!, completedAt: at(7, 10, 17, 10) };
  followUps.push(followUp104);
  const visit104Start = at(7, 10, 14); const visit104End = at(7, 10, 17);
  visits.push({ id: "visit-northline-104-2", organizationId: organization.id, storeId: "store-northline-104", providerKind: "outside_vendor", vendorId: "vendor-northline-summit", workOrderId: "wo-northline-104", technicianName: "Chris Walker", providerName: "Summit Refrigeration", purpose: "Return with approved compressor and complete replacement", status: "checked_out", startedChannel: "secure_link", endedChannel: "qr", checkedInAt: visit104Start, checkedOutAt: visit104End, outcome: "resolved", outcomeNotes: "Compressor replaced, system evacuated and charged, beer cave pulled down to 36°F.", observedDurationSeconds: durationSeconds(visit104Start, visit104End) });
  visitEvidence.push({ id: "evidence-visit-northline-104-2-in", organizationId: organization.id, visitId: "visit-northline-104-2", kind: "check_in", channel: "secure_link", observedAt: visit104Start, location: { result: "verified", accuracyM: 16, distanceM: 21, capturedAt: visit104Start }, payloadJson: "{}" }, { id: "evidence-visit-northline-104-2-out", organizationId: organization.id, visitId: "visit-northline-104-2", kind: "check_out", channel: "qr", observedAt: visit104End, location: { result: "verified", accuracyM: 19, distanceM: 25, capturedAt: visit104End }, payloadJson: JSON.stringify({ outcome: "resolved" }) });

  costLines.push(
    { id: "cost-104-compressor-labor", organizationId: organization.id, workOrderId: "wo-northline-104", kind: "labor", description: "Compressor replacement labor, evacuation, and commissioning", amount: { amountMinor: 165_000, currency: "USD" }, serviceDate: visit104End.slice(0, 10), recordedAt: new Date(Date.parse(visit104End) + 30 * 60_000).toISOString() },
    { id: "cost-104-compressor-parts", organizationId: organization.id, workOrderId: "wo-northline-104", kind: "parts", description: "Replacement compressor, filter drier, refrigerant, and electrical kit", amount: { amountMinor: 725_000, currency: "USD" }, serviceDate: visit104End.slice(0, 10), recordedAt: new Date(Date.parse(visit104End) + 30 * 60_000).toISOString() },
  );
  files.push(
    { id: "file-104-compressor-before", organizationId: organization.id, storageKey: "northline-demo/visits/visit-northline-104-2/compressor-before.jpg", sha256: "a".repeat(64), originalName: "compressor-before.jpg", contentType: "image/jpeg", byteLength: 1_284_112, status: "available", createdAt: visit104Start },
    { id: "file-104-compressor-after", organizationId: organization.id, storageKey: "northline-demo/visits/visit-northline-104-2/compressor-after.jpg", sha256: "b".repeat(64), originalName: "compressor-after.jpg", contentType: "image/jpeg", byteLength: 1_117_804, status: "available", createdAt: visit104End },
    { id: "file-104-service-report", organizationId: organization.id, storageKey: "northline-demo/work-orders/wo-northline-104/summit-service-report.pdf", sha256: "c".repeat(64), originalName: "Summit-service-report-SV-26003.pdf", contentType: "application/pdf", byteLength: 284_612, status: "available", createdAt: new Date(Date.parse(visit104End) + 20 * 60_000).toISOString() },
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
  // reviewable because unscheduled dispenser access is security-sensitive.
  const noWoStart = at(8, 10, 16, 20);
  visits.push({ id: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, organizationId: organization.id, storeId: "store-northline-107", providerKind: "outside_vendor", vendorId: "vendor-northline-forecourt", unmatchedReason: "Vendor dispatch did not provide an operator work-order number", technicianName: "Dana Ruiz", providerName: "Forecourt Systems Group", purpose: "Inspect intermittent card-reader failure at dispenser 4", status: "active", startedChannel: "qr", checkedInAt: noWoStart });
  visitEvidence.push({ id: "evidence-visit-northline-107-no-wo-in", organizationId: organization.id, visitId: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, kind: "check_in", channel: "qr", observedAt: noWoStart, location: { result: "outside_geofence", accuracyM: 20, distanceM: 171, capturedAt: noWoStart }, payloadJson: "{}" });
  exceptions.push({ id: "exception-northline-107-no-wo", organizationId: organization.id, kind: "no_work_order", storeId: "store-northline-107", visitId: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, vendorId: "vendor-northline-forecourt", severity: "urgent", status: "open", summary: "Unscheduled forecourt technician visit has no operator work order", detectedAt: noWoStart }, { id: "exception-northline-107-location", organizationId: organization.id, kind: "outside_geofence", storeId: "store-northline-107", visitId: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, vendorId: "vendor-northline-forecourt", severity: "attention", status: "open", summary: "Forecourt visit check-in was 171 m from the store geofence center", detectedAt: noWoStart }, { id: "exception-northline-107-high-risk", organizationId: organization.id, kind: "high_risk_service", storeId: "store-northline-107", visitId: NORTHLINE_DEMO_HANDLES.unmatchedVisitId, vendorId: "vendor-northline-forecourt", severity: "urgent", status: "open", summary: "Unexpected access to payment-enabled fuel equipment requires manager review", detectedAt: noWoStart });

  // A past unclosed visit is an exception; no checkout time is invented.
  const staleStart = at(8, 9, 13, 40);
  const reopened109 = workOrders.find((row) => row.organizationId === organization.id && row.id === "wo-northline-109")!;
  reopened109.status = "in_progress";
  reopened109.accountableParty = "Forecourt Systems Group";
  reopened109.nextAction = "Record return-visit outcome";
  reopened109.dueAt = at(8, 10, 22);
  reopened109.escalationTo = "Northline Facilities";
  reopened109.closedAt = undefined;
  const return109AssignmentId = "assignment-northline-109-return";
  const return109IssuanceId = "issuance-northline-109-return-r2";
  assignments.push({ id: return109AssignmentId, organizationId: organization.id, workOrderId: reopened109.id, kind: "outside_vendor", vendorId: "vendor-northline-forecourt", status: "accepted", assignedAt: at(8, 9, 12, 30), supersedesAssignmentId: "assignment-northline-109" });
  issuances.push({ id: return109IssuanceId, organizationId: organization.id, workOrderId: reopened109.id, assignmentId: return109AssignmentId, revision: 2, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber: reopened109.number, store: { id: "store-northline-109", storeNumber: "109", name: "Northline Lakeview", formattedAddress: "9 Lakeview Lane, Lakeview, IN 46738" }, vendor: { id: "vendor-northline-forecourt", name: "Forecourt Systems Group" }, problem: reopened109.problem, priority: reopened109.priority, authorizedScope: "Recheck dispenser 4 communication and record the return-visit outcome.", categoryKey: "forecourt", asset: { id: "asset-109-dispenser-4", name: "Fuel dispenser 4", assetTag: "109-FUEL-04" }, requestedTiming: staleStart, nte: reopened109.nte, billingInstruction: `Reference operator work order ${reopened109.number} on all service paperwork and invoices.` }), channel: "email", issuedAt: at(8, 9, 12, 45) });
  vendorResponses.push({ id: "response-northline-109-return", organizationId: organization.id, workOrderId: reopened109.id, assignmentId: return109AssignmentId, issuanceId: return109IssuanceId, response: "accepted", responderName: "Forecourt Systems Group dispatch", proposedAt: staleStart, respondedAt: at(8, 9, 13) });
  visits.push({ id: "visit-northline-109-stale", organizationId: organization.id, storeId: "store-northline-109", providerKind: "outside_vendor", vendorId: "vendor-northline-forecourt", workOrderId: "wo-northline-109", technicianName: "Eli Thompson", providerName: "Forecourt Systems Group", purpose: "Recheck the intermittent payment terminal connection at dispenser 4", status: "active", startedChannel: "store_device", checkedInAt: staleStart });
  visitEvidence.push({ id: "evidence-visit-northline-109-stale-in", organizationId: organization.id, visitId: "visit-northline-109-stale", kind: "check_in", channel: "store_device", observedAt: staleStart, location: { result: "trusted_store_device", capturedAt: staleStart }, payloadJson: "{}" });
  exceptions.push({ id: "exception-northline-109-missing-checkout", organizationId: organization.id, kind: "missing_checkout", storeId: "store-northline-109", workOrderId: "wo-northline-109", visitId: "visit-northline-109-stale", vendorId: "vendor-northline-forecourt", severity: "attention", status: "open", summary: "Visit remains open more than 24 hours after check-in", detectedAt: at(8, 10, 13, 40) });

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
    { key: "aug-101-refrigeration", storeNumber: "101", categoryKey: "refrigeration", problem: "Beer cave temperature climbed to 44°F during the afternoon rush", providerKind: "outside_vendor", vendorId: "vendor-northline-summit", technicianName: "Chris Walker", providerName: "Summit Refrigeration", priority: "urgent", submittedAt: at(8, 1, 19, 20), checkedInAt: at(8, 2, 13, 10), durationMinutes: 112, startedChannel: "qr", endedChannel: "secure_link", locationResult: "verified", outcome: "resolved", outcomeNotes: "Cleared a blocked condensate path, replaced the failed controller probe, and documented a stable 36°F box temperature.", workStatus: "closed", nteAmountMinor: 185_000, laborAmountMinor: 46_000, materialsAmountMinor: 31_500 },
    { key: "aug-102-hvac", storeNumber: "102", categoryKey: "hvac", problem: "Sales floor rooftop unit runs continuously but cannot hold setpoint", providerKind: "outside_vendor", vendorId: "vendor-northline-cedar", technicianName: "Sam Patel", providerName: "Cedar Mechanical", priority: "urgent", submittedAt: at(8, 2, 21, 5), checkedInAt: at(8, 3, 14, 35), durationMinutes: 86, startedChannel: "secure_link", endedChannel: "qr", locationResult: "verified", outcome: "diagnosed_waiting_parts", outcomeNotes: "Confirmed a failed condenser-fan motor. The unit is safe to remain off until the approved motor arrives.", workStatus: "waiting_on_parts", nteAmountMinor: 240_000, laborAmountMinor: 39_500, materialsAmountMinor: 0, followUpAction: "Confirm motor availability and schedule the approved return visit", followUpDueAt: at(8, 12, 16) },
    { key: "aug-103-electrical", storeNumber: "103", categoryKey: "electrical", problem: "Manager reported intermittent power loss at the stockroom receptacles", providerKind: "internal", internalMembershipId: "membership-northline-tech-1", technicianName: "Maria Santos", providerName: "Northline Internal Maintenance", priority: "routine", submittedAt: at(8, 4, 11), checkedInAt: at(8, 4, 14, 5), durationMinutes: 54, startedChannel: "store_device", endedChannel: "store_device", locationResult: "trusted_store_device", outcome: "no_issue_found", outcomeNotes: "Tested the receptacles under load and checked the panel; no fault recurred. Store will monitor and photograph the next event.", workStatus: "closed", nteAmountMinor: 60_000, laborAmountMinor: 21_500, materialsAmountMinor: 0 },
    { key: "aug-105-forecourt", storeNumber: "105", categoryKey: "forecourt", problem: "Dispenser 4 card reader reboots during some contactless transactions", providerKind: "outside_vendor", vendorId: "vendor-northline-forecourt", technicianName: "Dana Ruiz", providerName: "Forecourt Systems Group", priority: "urgent", submittedAt: at(8, 4, 18, 40), checkedInAt: at(8, 5, 12, 50), durationMinutes: 74, startedChannel: "qr", endedChannel: "store_device", locationResult: "verified", outcome: "return_required", outcomeNotes: "Isolated the fault to the payment-terminal communication board. Dispenser remains available for chip transactions pending replacement.", workStatus: "waiting_on_vendor", nteAmountMinor: 275_000, laborAmountMinor: 48_000, materialsAmountMinor: 0, followUpAction: "Provide board availability and a return-service date", followUpDueAt: at(8, 11, 18) },
    { key: "aug-106-exterior", storeNumber: "106", categoryKey: "exterior", problem: "Standing water is forming beside the west parking-lot drain", providerKind: "outside_vendor", vendorId: "vendor-northline-four-seasons", technicianName: "Lena Brooks", providerName: "Four Seasons Site Services", priority: "routine", submittedAt: at(8, 5, 15, 25), checkedInAt: at(8, 6, 13, 20), durationMinutes: 63, startedChannel: "vendor_portal", endedChannel: "qr", locationResult: "verified", outcome: "inspection_complete", outcomeNotes: "Cleared surface debris, photographed settled pavement, and submitted measurements for a separate repair estimate.", workStatus: "closed", nteAmountMinor: 95_000, laborAmountMinor: 32_000, materialsAmountMinor: 7_500 },
    { key: "aug-108-electrical", storeNumber: "108", categoryKey: "electrical", problem: "Two canopy-lighting circuits remain dark after lamp replacement", providerKind: "outside_vendor", vendorId: "vendor-northline-brightpath", technicianName: "Nolan Reed", providerName: "BrightPath Electrical", priority: "routine", submittedAt: at(8, 6, 20, 10), checkedInAt: at(8, 7, 15, 15), durationMinutes: 91, startedChannel: "secure_link", endedChannel: "store_device", locationResult: "low_accuracy", outcome: "unable_to_complete", outcomeNotes: "Confirmed an underground-feed fault. A lift and utility locate are required before repair can proceed safely.", workStatus: "waiting_on_vendor", nteAmountMinor: 225_000, laborAmountMinor: 44_500, materialsAmountMinor: 0, followUpAction: "Submit the lift plan, utility-locate confirmation, and revised estimate", followUpDueAt: at(8, 12, 20) },
    { key: "aug-110-refrigeration", storeNumber: "110", categoryKey: "refrigeration", problem: "Walk-in cooler evaporator is icing and airflow is dropping", providerKind: "outside_vendor", vendorId: "vendor-northline-summit", technicianName: "Drew Miller", providerName: "Summit Refrigeration", priority: "urgent", submittedAt: at(8, 7, 22, 15), checkedInAt: at(8, 8, 11, 40), durationMinutes: 128, startedChannel: "qr", endedChannel: "vendor_portal", locationResult: "permission_denied", outcome: "temporary_repair", outcomeNotes: "Defrosted the coil and restored airflow. A failed defrost-termination control requires an approved return repair.", workStatus: "waiting_on_parts", nteAmountMinor: 210_000, laborAmountMinor: 53_000, materialsAmountMinor: 12_500, followUpAction: "Price the defrost control and schedule the permanent repair", followUpDueAt: at(8, 13, 16) },
    { key: "aug-111-plumbing", storeNumber: "111", categoryKey: "plumbing", problem: "Restroom hand-sink supply connection is leaking into the cabinet", providerKind: "outside_vendor", vendorId: "vendor-northline-cedar", technicianName: "Imani Lewis", providerName: "Cedar Mechanical", priority: "routine", submittedAt: at(8, 9, 16, 45), checkedInAt: at(8, 10, 12, 15), durationMinutes: 82, startedChannel: "vendor_portal", endedChannel: "store_device", locationResult: "verified", outcome: "resolved", outcomeNotes: "Replaced the supply stop and flex connector, dried the cabinet, and verified no leakage under repeated use.", workStatus: "closed", nteAmountMinor: 125_000, laborAmountMinor: 37_500, materialsAmountMinor: 18_900 },
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
    const workOrderNumber = `NL-2026-${String(201 + index).padStart(4, "0")}`;
    const nte = { amountMinor: story.nteAmountMinor, currency: "USD" };
    const open = !["closed", "cancelled"].includes(story.workStatus);

    requests.push({ id: requestId, organizationId: organization.id, reference: `REQ-26-AUG-${story.storeNumber}-${index + 1}`, storeId: store.id, reporterName: ["Taylor Kim", "Morgan Wells", "Avery Johnson", "Jamie Cole"][index % 4], reporterEmployeeId: `E${5200 + index}`, problem: story.problem, priority: story.priority, status: "converted", submittedAt: story.submittedAt, convertedWorkOrderId: workOrderId });
    workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: store.id, requestId, problem: story.problem, authorizedScope: `Diagnose the reported ${story.categoryKey} issue, complete authorized work, and record the observed outcome.`, categoryKey: story.categoryKey, taxonomyNodeId: taxonomyByCategory[story.categoryKey], assetId, priority: story.priority, status: story.workStatus, accountableParty: story.providerName, nextAction: open ? story.followUpAction! : "No action required", dueAt: open ? story.followUpDueAt : undefined, escalationTo: open ? "Northline Facilities" : undefined, nte, vendorServiceTicketNumber: vendor ? `${vendor.code.toUpperCase()}-AUG-${story.storeNumber}-${index + 1}` : undefined, createdAt, closedAt: open ? undefined : checkedOutAt });
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
    if (open) followUps.push({ id: `follow-up-recent-${story.key}`, organizationId: organization.id, workOrderId, sourceVisitId: visitId, accountableParty: story.providerName, nextAction: story.followUpAction!, dueAt: story.followUpDueAt!, escalationTo: "Northline Facilities", status: "open", createdAt: checkedOutAt });
    if (story.locationResult === "low_accuracy") exceptions.push({ id: `exception-recent-${story.key}-location`, organizationId: organization.id, kind: "low_accuracy_location", storeId: store.id, workOrderId, visitId, vendorId: story.vendorId, severity: "attention", status: "acknowledged", summary: "Technician check-in location was captured with low GPS accuracy", detectedAt: story.checkedInAt });
  });

  const pmPlans: PmPlan[] = stores.map((store) => ({ id: `pm-plan-${store.storeNumber}-refrigeration`, organizationId: organization.id, name: "Quarterly refrigeration inspection", storeId: store.id, assetId: `asset-${store.storeNumber}-beer-cave`, categoryKey: "refrigeration", cadenceDays: 90, completionWindowDays: 7, active: true, createdAt: at(1, 6, 14) }));
  const pmOccurrences: PmOccurrence[] = [];
  const pmPeriods = [
    { key: "2025-q4", year: 2025, month: 11, linkWorkOrder: true },
    { key: "2026-q1", year: 2026, month: 2, linkWorkOrder: true },
    { key: "2026-q2", year: 2026, month: 5, linkWorkOrder: false },
    { key: "2026-q3", year: 2026, month: 8, linkWorkOrder: false },
  ] as const;
  pmPlans.forEach((plan, storeIndex) => {
    const store = stores[storeIndex];
    const asset = assets.find((candidate) => candidate.id === plan.assetId)!;
    pmPeriods.forEach((period, periodIndex) => {
      const due = new Date(Date.UTC(period.year, period.month - 1, period.month === 8 ? 1 + (storeIndex % 10) : 14 + (storeIndex % 5), 12)).toISOString();
      const windowStartsAt = new Date(Date.parse(due) - 7 * 86_400_000).toISOString();
      const windowEndsAt = new Date(Date.parse(due) + 7 * 86_400_000).toISOString();
      const currentPeriod = period.key === "2026-q3";
      const status: PmOccurrence["status"] = currentPeriod
        ? storeIndex < 11
          ? "completed"
          : Date.parse(windowEndsAt) < Date.parse(NORTHLINE_AS_OF)
            ? "missed"
            : "due"
        : "completed";
      const completedAt = status === "completed" ? new Date(Date.parse(due) + ((storeIndex + periodIndex) % 3 - 1) * 86_400_000).toISOString() : undefined;
      const occurrenceId = `pm-occurrence-${store.storeNumber}-${period.key}`;
      const workOrderId = period.linkWorkOrder ? `wo-pm-${store.storeNumber}-${period.key}` : undefined;
      pmOccurrences.push({ id: occurrenceId, organizationId: organization.id, planId: plan.id, storeId: store.id, assetId: plan.assetId, workOrderId, dueAt: due, windowStartsAt, windowEndsAt, status, completedAt });

      if (!workOrderId) return;
      const workOrderNumber = `NL-${period.year}-PM-${store.storeNumber}-${periodIndex + 1}`;
      const createdAt = new Date(Date.parse(due) - 5 * 86_400_000).toISOString();
      const assignedAt = new Date(Date.parse(createdAt) + 30 * 60_000).toISOString();
      const issuedAt = new Date(Date.parse(assignedAt) + 15 * 60_000).toISOString();
      const visitStart = completedAt!;
      const visitEnd = new Date(Date.parse(visitStart) + (55 + storeIndex % 5 * 8) * 60_000).toISOString();
      const internalMembershipId = storeIndex % 2 ? "membership-northline-tech-2" : "membership-northline-tech-1";
      const internalMember = memberships.find((membership) => membership.id === internalMembershipId)!;
      const internalUser = users.find((user) => user.id === internalMember.userId)!;
      const assignmentId = `assignment-pm-${store.storeNumber}-${period.key}`;
      const issuanceId = `issuance-pm-${store.storeNumber}-${period.key}-r1`;
      const visitId = `visit-pm-${store.storeNumber}-${period.key}`;
      const problem = "Quarterly refrigeration inspection and documented operating check";
      const nte = { amountMinor: 45_000, currency: "USD" };
      workOrders.push({ id: workOrderId, organizationId: organization.id, number: workOrderNumber, storeId: store.id, problem, authorizedScope: "Inspect the beer cave refrigeration system, clean accessible coils, record operating condition, and identify follow-up needs.", categoryKey: "refrigeration", taxonomyNodeId: "taxonomy-northline-beer_caves", assetId: plan.assetId, priority: "planned", status: "closed", accountableParty: "Northline Internal Maintenance", nextAction: "No action required", nte, createdAt, closedAt: visitEnd });
      assignments.push({ id: assignmentId, organizationId: organization.id, workOrderId, kind: "internal", internalMembershipId, status: "completed", assignedAt });
      issuances.push({ id: issuanceId, organizationId: organization.id, workOrderId, assignmentId, revision: 1, immutablePayloadJson: JSON.stringify({ organizationName: organization.name, workOrderNumber, store: { id: store.id, storeNumber: store.storeNumber, name: store.name, formattedAddress: [store.address1, `${store.city}, ${store.state} ${store.postalCode}`].join(", ") }, vendor: { id: internalMembershipId, name: internalUser.displayName }, problem, priority: "planned", authorizedScope: "Inspect the beer cave refrigeration system, clean accessible coils, record operating condition, and identify follow-up needs.", categoryKey: "refrigeration", asset: { id: asset.id, name: asset.name, assetTag: asset.assetTag }, requestedTiming: due, nte, billingInstruction: `Reference operator work order ${workOrderNumber} on any related service paperwork.` }), channel: "manual", issuedAt });
      visits.push({ id: visitId, organizationId: organization.id, storeId: store.id, providerKind: "internal", internalMembershipId, workOrderId, technicianName: internalUser.displayName, providerName: "Northline Internal Maintenance", purpose: problem, status: "checked_out", startedChannel: "store_device", endedChannel: "store_device", checkedInAt: visitStart, checkedOutAt: visitEnd, outcome: "pm_complete", outcomeNotes: "Inspection completed; temperatures, coil condition, and controller operation documented.", observedDurationSeconds: durationSeconds(visitStart, visitEnd) });
      visitEvidence.push(
        { id: `evidence-${visitId}-in`, organizationId: organization.id, visitId, kind: "check_in", channel: "store_device", observedAt: visitStart, location: { result: "trusted_store_device", capturedAt: visitStart }, payloadJson: JSON.stringify({ occurrenceId }) },
        { id: `evidence-${visitId}-out`, organizationId: organization.id, visitId, kind: "check_out", channel: "store_device", observedAt: visitEnd, location: { result: "trusted_store_device", capturedAt: visitEnd }, payloadJson: JSON.stringify({ outcome: "pm_complete", occurrenceId }) },
      );
      costLines.push({ id: `cost-pm-${store.storeNumber}-${period.key}`, organizationId: organization.id, workOrderId, kind: "labor", description: "Internal preventive-maintenance labor", amount: { amountMinor: 18_500 + storeIndex * 250, currency: "USD" }, serviceDate: visitEnd.slice(0, 10), recordedAt: new Date(Date.parse(visitEnd) + 30 * 60_000).toISOString() });
    });
  });
  exceptions.push(
    { id: "exception-northline-112-overdue-pm", organizationId: organization.id, kind: "overdue_pm", storeId: "store-northline-112", severity: "attention", status: "open", summary: "Quarterly refrigeration inspection is outside its completion window", detectedAt: NORTHLINE_AS_OF },
    { id: "exception-northline-113-overdue-pm", organizationId: organization.id, kind: "overdue_pm", storeId: "store-northline-113", severity: "attention", status: "open", summary: "Quarterly refrigeration inspection is outside its completion window", detectedAt: NORTHLINE_AS_OF },
  );

  const currentUnmatchedInvoice = invoiceReferences.find((invoice) => invoice.id === "invoice-northline-109");
  if (currentUnmatchedInvoice) {
    exceptions.push({ id: "exception-invoice-northline-109-unmatched", organizationId: organization.id, kind: "unmatched_invoice", storeId: "store-northline-109", vendorId: currentUnmatchedInvoice.vendorId, severity: "attention", status: "open", summary: "Forecourt invoice does not include an operator work-order reference", detectedAt: currentUnmatchedInvoice.createdAt });
  }

  // Audit and outbox facts are derived from the same deterministic source
  // records, so the showcase can demonstrate provenance and delivery state.
  const addAudit = (event: AuditEvent) => {
    if (!auditEvents.some((candidate) => candidate.aggregateId === event.aggregateId && candidate.eventType === event.eventType)) auditEvents.push(event);
  };
  requests.forEach((request) => addAudit({ id: `audit-source-request-${request.id}`, organizationId: organization.id, aggregateType: "service_request", aggregateId: request.id, eventType: "request.submitted", actorType: "user", actorName: request.reporterName, occurredAt: request.submittedAt, payloadJson: JSON.stringify({ storeId: request.storeId, reference: request.reference }) }));
  workOrders.forEach((workOrder) => addAudit({ id: `audit-source-work-order-${workOrder.id}`, organizationId: organization.id, aggregateType: "work_order", aggregateId: workOrder.id, eventType: "work_order.created", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: workOrder.createdAt, payloadJson: JSON.stringify({ storeId: workOrder.storeId, requestId: workOrder.requestId }) }));
  assignments.forEach((assignment) => addAudit({ id: `audit-source-assignment-${assignment.id}`, organizationId: organization.id, aggregateType: "work_order_assignment", aggregateId: assignment.id, eventType: "work_order.assigned", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: assignment.assignedAt, payloadJson: JSON.stringify({ workOrderId: assignment.workOrderId, kind: assignment.kind, vendorId: assignment.vendorId, internalMembershipId: assignment.internalMembershipId }) }));
  issuances.forEach((issuance) => addAudit({ id: `audit-source-issuance-${issuance.id}`, organizationId: organization.id, aggregateType: "work_order", aggregateId: issuance.workOrderId, eventType: `work_order.issued.r${issuance.revision}`, actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: issuance.issuedAt, payloadJson: JSON.stringify({ issuanceId: issuance.id, assignmentId: issuance.assignmentId, revision: issuance.revision, channel: issuance.channel }) }));
  vendorResponses.forEach((response) => addAudit({ id: `audit-source-response-${response.id}`, organizationId: organization.id, aggregateType: "work_order", aggregateId: response.workOrderId, eventType: "vendor.response_recorded", actorType: "vendor_link", actorName: response.responderName, occurredAt: response.respondedAt, payloadJson: JSON.stringify({ responseId: response.id, issuanceId: response.issuanceId, response: response.response }) }));
  visits.forEach((visit) => {
    addAudit({ id: `audit-source-visit-${visit.id}-in`, organizationId: organization.id, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_in", actorType: visit.providerKind === "internal" ? "user" : "technician", actorId: visit.internalMembershipId, actorName: visit.technicianName, occurredAt: visit.checkedInAt, payloadJson: JSON.stringify({ storeId: visit.storeId, workOrderId: visit.workOrderId, vendorId: visit.vendorId, channel: visit.startedChannel, presenceBasis: "approximate_presence_not_labor" }) });
    if (visit.checkedOutAt) addAudit({ id: `audit-source-visit-${visit.id}-out`, organizationId: organization.id, aggregateType: "visit", aggregateId: visit.id, eventType: "visit.checked_out", actorType: visit.providerKind === "internal" ? "user" : "technician", actorId: visit.internalMembershipId, actorName: visit.technicianName, occurredAt: visit.checkedOutAt, payloadJson: JSON.stringify({ outcome: visit.outcome, observedDurationSeconds: visit.observedDurationSeconds, presenceBasis: "approximate_presence_not_labor" }) });
  });
  costLines.forEach((cost) => addAudit({ id: `audit-source-cost-${cost.id}`, organizationId: organization.id, aggregateType: "work_order", aggregateId: cost.workOrderId, eventType: "work_order.cost_recorded", actorType: "user", actorId: "membership-northline-facilities", actorName: "Jordan Lee", occurredAt: cost.recordedAt, payloadJson: JSON.stringify({ costLineId: cost.id, kind: cost.kind, amountMinor: cost.amount.amountMinor, currency: cost.amount.currency }) }));
  invoiceReferences.forEach((invoice) => addAudit({ id: `audit-source-invoice-${invoice.id}`, organizationId: organization.id, aggregateType: "invoice_reference", aggregateId: invoice.id, eventType: "invoice_reference.recorded", actorType: "user", actorId: "membership-northline-finance", actorName: "Parker Shaw", occurredAt: invoice.createdAt, payloadJson: JSON.stringify({ vendorId: invoice.vendorId, invoiceNumber: invoice.invoiceNumber, matchStatus: invoice.matchStatus, operatorWorkOrderNumber: invoice.operatorWorkOrderNumber }) }));
  pmOccurrences.forEach((occurrence) => addAudit({ id: `audit-source-pm-${occurrence.id}`, organizationId: organization.id, aggregateType: "pm_occurrence", aggregateId: occurrence.id, eventType: `pm_occurrence.${occurrence.status}`, actorType: occurrence.status === "completed" ? "user" : "system", actorId: occurrence.status === "completed" ? "membership-northline-tech-1" : undefined, actorName: occurrence.status === "completed" ? "Northline Internal Maintenance" : "TraceOps schedule", occurredAt: occurrence.completedAt ?? (occurrence.status === "missed" ? occurrence.windowEndsAt : NORTHLINE_AS_OF), payloadJson: JSON.stringify({ planId: occurrence.planId, storeId: occurrence.storeId, workOrderId: occurrence.workOrderId, dueAt: occurrence.dueAt, windowStartsAt: occurrence.windowStartsAt, windowEndsAt: occurrence.windowEndsAt }) }));
  files.forEach((file) => addAudit({ id: `audit-source-file-${file.id}`, organizationId: organization.id, aggregateType: "file", aggregateId: file.id, eventType: "file.available", actorType: "technician", actorName: "Service technician", occurredAt: file.createdAt, payloadJson: JSON.stringify({ originalName: file.originalName, contentType: file.contentType, byteLength: file.byteLength }) }));
  exceptions.forEach((exception) => addAudit({ id: `audit-source-exception-${exception.id}`, organizationId: organization.id, aggregateType: "exception", aggregateId: exception.id, eventType: "exception.detected", actorType: "system", actorName: "TraceOps rules", occurredAt: exception.detectedAt, payloadJson: JSON.stringify({ kind: exception.kind, storeId: exception.storeId, workOrderId: exception.workOrderId, visitId: exception.visitId, severity: exception.severity }) }));

  issuances.forEach((issuance) => outboxMessages.push({ id: `outbox-issuance-${issuance.id}`, organizationId: organization.id, topic: "ops.work_order.issued", aggregateType: "work_order", aggregateId: issuance.workOrderId, payloadJson: JSON.stringify({ issuanceId: issuance.id, assignmentId: issuance.assignmentId, channel: issuance.channel }), status: Date.parse(issuance.issuedAt) >= Date.parse(at(8, 10, 0)) ? "pending" : "delivered", availableAt: issuance.issuedAt, createdAt: issuance.issuedAt }));
  exceptions.filter((exception) => exception.status !== "resolved").forEach((exception) => outboxMessages.push({ id: `outbox-exception-${exception.id}`, organizationId: organization.id, topic: "ops.exception.detected", aggregateType: "exception", aggregateId: exception.id, payloadJson: JSON.stringify({ kind: exception.kind, storeId: exception.storeId, severity: exception.severity }), status: "delivered", availableAt: exception.detectedAt, createdAt: exception.detectedAt }));
  visits.filter((visit) => visit.status === "active").forEach((visit) => outboxMessages.push({ id: `outbox-active-visit-${visit.id}`, organizationId: organization.id, topic: "ops.visit.checked_in", aggregateType: "visit", aggregateId: visit.id, payloadJson: JSON.stringify({ storeId: visit.storeId, vendorId: visit.vendorId, workOrderId: visit.workOrderId }), status: "delivered", availableAt: visit.checkedInAt, createdAt: visit.checkedInAt }));

  const publicTokens: PublicActionToken[] = [
    { id: "public-token-northline-store-104", organizationId: organization.id, purpose: "store_gateway", subjectType: "store", subjectId: "store-northline-104", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.store104, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-service-104", organizationId: organization.id, purpose: "service_authorization", subjectType: "work_order_issuance", subjectId: publicIssuanceId, tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.serviceAuthorization104, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-visit-112", organizationId: organization.id, purpose: "active_visit", subjectType: "visit", subjectId: NORTHLINE_DEMO_HANDLES.activeVisitId, tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.activeVisit112, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-trusted-store-104", organizationId: organization.id, purpose: "trusted_store_device", subjectType: "store", subjectId: "store-northline-104", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.trustedStore104, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 1, 12) },
    { id: "public-token-northline-estimate-105-summit", organizationId: organization.id, purpose: "vendor_estimate", subjectType: "work_order_estimate_request", subjectId: "estimate-request-105-summit", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.estimate105Summit, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 10, 14, 50) },
    { id: "public-token-northline-estimate-105-cedar", organizationId: organization.id, purpose: "vendor_estimate", subjectType: "work_order_estimate_request", subjectId: "estimate-request-105-cedar", tokenHash: NORTHLINE_DEMO_TOKEN_HASHES.estimate105Cedar, expiresAt: atYear(2027, 8, 10), createdAt: at(8, 10, 14, 51) },
  ];

  return { asOf: NORTHLINE_AS_OF, organizations: [organization], divisions, regions, taxonomyNodes, equipmentTemplates, componentTemplates, stores, users, memberships, scopeGrants, vendors, vendorSpecialties, vendorCoverage, requests, workOrders, assignments, issuances, vendorResponses, estimateRequests, estimateProposals, visits, visitEvidence, files, entityFiles, followUps, exceptions, assets, replacementProfiles, replacementBenchmarks, assetReplacementOverrides, replacementEvents, components, pmPlans, pmOccurrences, costLines, invoiceReferences, invoiceAllocations, auditEvents, outboxMessages, publicTokens };
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
  fixture.workOrders = [];
  fixture.assignments = [];
  fixture.issuances = [];
  fixture.vendorResponses = [];
  fixture.estimateRequests = [];
  fixture.estimateProposals = [];
  fixture.visits = [];
  fixture.visitEvidence = [];
  fixture.files = [];
  fixture.entityFiles = [];
  fixture.followUps = [];
  fixture.exceptions = [];
  fixture.assets = [];
  fixture.replacementProfiles = [];
  fixture.replacementBenchmarks = [];
  fixture.assetReplacementOverrides = [];
  fixture.replacementEvents = [];
  fixture.components = [];
  fixture.pmPlans = [];
  fixture.pmOccurrences = [];
  fixture.costLines = [];
  fixture.invoiceReferences = [];
  fixture.invoiceAllocations = [];
  fixture.auditEvents = [];
  fixture.outboxMessages = [];
  fixture.publicTokens = [];
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
  const assetIds = new Set(fixture.assets.map((row) => row.id));
  const replacementProfileIds = new Set(fixture.replacementProfiles.map((row) => row.id));
  const replacementBenchmarkIds = new Set(fixture.replacementBenchmarks.map((row) => row.id));
  const fileIds = new Set(fixture.files.map((row) => row.id));
  const invoiceIds = new Set(fixture.invoiceReferences.map((row) => row.id));
  const ensureUnique = (name: string, rows: Array<{ id: string }>) => {
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error(`${name} contains duplicate ids`);
  };
  ([
    ["organizations", fixture.organizations], ["divisions", fixture.divisions], ["regions", fixture.regions], ["taxonomy nodes", fixture.taxonomyNodes], ["stores", fixture.stores], ["users", fixture.users], ["memberships", fixture.memberships], ["scope grants", fixture.scopeGrants], ["vendors", fixture.vendors], ["requests", fixture.requests], ["work orders", fixture.workOrders], ["assignments", fixture.assignments], ["issuances", fixture.issuances], ["vendor responses", fixture.vendorResponses], ["estimate requests", fixture.estimateRequests], ["estimate proposals", fixture.estimateProposals], ["visits", fixture.visits], ["visit evidence", fixture.visitEvidence], ["files", fixture.files], ["entity files", fixture.entityFiles], ["follow-ups", fixture.followUps], ["exceptions", fixture.exceptions], ["assets", fixture.assets], ["replacement profiles", fixture.replacementProfiles], ["replacement benchmarks", fixture.replacementBenchmarks], ["asset replacement overrides", fixture.assetReplacementOverrides], ["replacement events", fixture.replacementEvents], ["components", fixture.components], ["PM plans", fixture.pmPlans], ["PM occurrences", fixture.pmOccurrences], ["cost lines", fixture.costLines], ["invoice references", fixture.invoiceReferences], ["invoice allocations", fixture.invoiceAllocations], ["audit events", fixture.auditEvents], ["outbox", fixture.outboxMessages], ["public tokens", fixture.publicTokens],
  ] as Array<[string, Array<{ id: string }>]>).forEach(([name, rows]) => ensureUnique(name, rows));
  ensureUnique("equipment templates", fixture.equipmentTemplates);
  ensureUnique("component templates", fixture.componentTemplates);
  const ensureTenant = (name: string, rows: Array<{ organizationId: string }>) => rows.forEach((row) => { if (!organizationIds.has(row.organizationId)) throw new Error(`${name} references an unknown organization`); });
  ([
    ["divisions", fixture.divisions], ["regions", fixture.regions], ["taxonomy nodes", fixture.taxonomyNodes], ["stores", fixture.stores], ["memberships", fixture.memberships], ["scope grants", fixture.scopeGrants], ["vendors", fixture.vendors], ["vendor specialties", fixture.vendorSpecialties], ["vendor coverage", fixture.vendorCoverage], ["requests", fixture.requests], ["work orders", fixture.workOrders], ["assignments", fixture.assignments], ["issuances", fixture.issuances], ["vendor responses", fixture.vendorResponses], ["estimate requests", fixture.estimateRequests], ["estimate proposals", fixture.estimateProposals], ["visits", fixture.visits], ["visit evidence", fixture.visitEvidence], ["files", fixture.files], ["entity files", fixture.entityFiles], ["follow-ups", fixture.followUps], ["exceptions", fixture.exceptions], ["assets", fixture.assets], ["replacement profiles", fixture.replacementProfiles], ["replacement benchmarks", fixture.replacementBenchmarks], ["asset replacement overrides", fixture.assetReplacementOverrides], ["replacement events", fixture.replacementEvents], ["components", fixture.components], ["PM plans", fixture.pmPlans], ["PM occurrences", fixture.pmOccurrences], ["cost lines", fixture.costLines], ["invoice references", fixture.invoiceReferences], ["invoice allocations", fixture.invoiceAllocations], ["audit events", fixture.auditEvents], ["outbox", fixture.outboxMessages], ["public tokens", fixture.publicTokens],
  ] as Array<[string, Array<{ organizationId: string }>]>).forEach(([name, rows]) => ensureTenant(name, rows));
  ensureTenant("equipment templates", fixture.equipmentTemplates);
  ensureTenant("component templates", fixture.componentTemplates);
  fixture.regions.forEach((row) => { if (row.divisionId && !divisionIds.has(row.divisionId)) throw new Error(`Region ${row.id} has no division`); });
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
  fixture.requests.forEach((row) => { if (!storeIds.has(row.storeId)) throw new Error(`Request ${row.id} has no store`); if (row.convertedWorkOrderId && !workOrderIds.has(row.convertedWorkOrderId)) throw new Error(`Request ${row.id} has no converted work order`); });
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
  fixture.visits.forEach((row) => { if (!storeIds.has(row.storeId)) throw new Error(`Visit ${row.id} has no store`); if (row.vendorId && !vendorIds.has(row.vendorId)) throw new Error(`Visit ${row.id} has no vendor`); if (row.workOrderId) { const workOrder = fixture.workOrders.find((item) => item.organizationId === row.organizationId && item.id === row.workOrderId); if (!workOrder || workOrder.storeId !== row.storeId) throw new Error(`Visit ${row.id} has an invalid work-order/store path`); if (Date.parse(row.checkedInAt) < Date.parse(workOrder.createdAt)) throw new Error(`Visit ${row.id} predates its work order`); const providerMatches = fixture.assignments.some((assignment) => assignment.organizationId === row.organizationId && assignment.workOrderId === row.workOrderId && (row.providerKind === "outside_vendor" ? assignment.kind === "outside_vendor" && assignment.vendorId === row.vendorId : assignment.kind === "internal" && assignment.internalMembershipId === row.internalMembershipId)); if (!providerMatches) throw new Error(`Visit ${row.id} has no matching work-order provider assignment`); } else if (!row.unmatchedReason) throw new Error(`No-WO visit ${row.id} requires a reason`); if (row.checkedOutAt && Date.parse(row.checkedOutAt) < Date.parse(row.checkedInAt)) throw new Error(`Visit ${row.id} checkout predates check-in`); });
  fixture.visitEvidence.forEach((row) => { const visit = fixture.visits.find((item) => item.id === row.visitId); if (!visitIds.has(row.visitId) || !visit) throw new Error(`Evidence ${row.id} has no visit`); if (Date.parse(row.observedAt) < Date.parse(visit.checkedInAt)) throw new Error(`Evidence ${row.id} predates check-in`); });
  fixture.assets.forEach((row) => { if (!storeIds.has(row.storeId)) throw new Error(`Asset ${row.id} has no store`); if (row.taxonomyNodeId && !taxonomyNodeIds.has(row.taxonomyNodeId)) throw new Error(`Asset ${row.id} has an invalid taxonomy node`); });
  fixture.components.forEach((row) => { if (!assetIds.has(row.assetId)) throw new Error(`Component ${row.id} has no asset`); });
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
  const entityIds: Record<EntityFileLink["entityType"], Set<string>> = { request: new Set(fixture.requests.map((row) => row.id)), work_order: workOrderIds, visit: visitIds, asset: assetIds, invoice_reference: invoiceIds };
  fixture.files.forEach((row) => { if (!/^[a-f0-9]{64}$/i.test(row.sha256) || row.byteLength <= 0 || !row.storageKey.trim()) throw new Error(`File ${row.id} has invalid immutable metadata`); });
  fixture.entityFiles.forEach((row) => { if (!fileIds.has(row.fileId) || !entityIds[row.entityType].has(row.entityId)) throw new Error(`Entity file ${row.id} has an invalid target`); });
  [...fixture.auditEvents, ...fixture.outboxMessages].forEach((row) => { try { JSON.parse(row.payloadJson); } catch { throw new Error(`Event ${row.id} has invalid JSON`); } });
  return true;
}

assertOpsFixture(presentationFixture);
