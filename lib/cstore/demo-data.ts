import type {
  Asset,
  AssetComponent,
  AuditEvent,
  CostLine,
  DemoDataset,
  Division,
  EvidenceDocument,
  ExceptionRecord,
  FulfillmentMode,
  InternalTeam,
  Invoice,
  InvoiceLineItem,
  InvoiceWorkLink,
  MaintenanceCategory,
  MaintenanceCategoryKey,
  Organization,
  Person,
  PmOccurrence,
  PreventiveMaintenancePlan,
  Region,
  ServiceRequest,
  Store,
  TaxonomyNode,
  Vendor,
  VendorIssuance,
  Visit,
  WorkAssignment,
  WorkOrder,
  WorkPriority,
  WorkStatus,
} from "./types";

export const DEMO_NOW = "2026-08-10T18:00:00.000Z";
export const DEMO_ORGANIZATION_ID = "org-northline-markets";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DEMO_NOW_MS = Date.parse(DEMO_NOW);

function daysAgo(days: number, hourAdjustment = 0): string {
  return new Date(DEMO_NOW_MS - days * DAY_MS + hourAdjustment * HOUR_MS).toISOString();
}

function shiftHours(timestamp: string, hours: number): string {
  return new Date(Date.parse(timestamp) + hours * HOUR_MS).toISOString();
}

function dateOnly(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export const demoOrganization: Organization = {
  id: DEMO_ORGANIZATION_ID,
  displayName: "Northline Fuel & Market",
  legalName: "Northline Fuel & Market Demo LLC",
  timezone: "America/New_York",
  currency: "USD",
  demoMode: true,
  storeLabel: "Store",
  workOrderPrefix: "NLM",
};

export const demoDivisions: Division[] = [
  {
    id: "division-retail-operations",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Retail Operations",
    code: "RETAIL",
    status: "active",
  },
];

export const demoRegions: Region[] = [
  {
    id: "region-central-ohio",
    organizationId: DEMO_ORGANIZATION_ID,
    divisionId: "division-retail-operations",
    name: "Central Ohio",
    code: "COH",
    managerPersonId: "person-maya-chen",
    description: "Columbus metro and surrounding communities",
    sortOrder: 1,
  },
  {
    id: "region-miami-valley",
    organizationId: DEMO_ORGANIZATION_ID,
    divisionId: "division-retail-operations",
    name: "Miami Valley",
    code: "MV",
    managerPersonId: "person-jordan-ellis",
    description: "Dayton, Springfield, and the I-75 corridor",
    sortOrder: 2,
  },
  {
    id: "region-northern-kentucky",
    organizationId: DEMO_ORGANIZATION_ID,
    divisionId: "division-retail-operations",
    name: "Northern Kentucky",
    code: "NKY",
    managerPersonId: "person-avery-brooks",
    description: "Greater Cincinnati's Kentucky communities",
    sortOrder: 3,
  },
];

export const demoCategories: MaintenanceCategory[] = [
  {
    id: "category-refrigeration",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "refrigeration",
    label: "Refrigeration",
    description: "Walk-ins, beer caves, reach-ins, ice and refrigeration controls",
    aliases: ["coolers", "freezers", "beer cave", "cold storage"],
    color: "#217A67",
    sortOrder: 1,
  },
  {
    id: "category-hvac",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "hvac",
    label: "HVAC",
    description: "Rooftop units, thermostats, ventilation and comfort systems",
    aliases: ["air conditioning", "heat", "rtu", "comfort"],
    color: "#3674B5",
    sortOrder: 2,
  },
  {
    id: "category-fuel-forecourt",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "fuel_forecourt",
    label: "Fuel & Forecourt",
    description: "Dispensers, controllers, canopy and forecourt systems",
    aliases: ["pumps", "dispensers", "gas", "forecourt"],
    color: "#CA6B2B",
    sortOrder: 3,
  },
  {
    id: "category-foodservice",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "foodservice",
    label: "Foodservice",
    description: "Ovens, warmers, beverage and prepared-food equipment",
    aliases: ["kitchen", "oven", "roller grill", "coffee"],
    color: "#9B5AA5",
    sortOrder: 4,
  },
  {
    id: "category-electrical-lighting",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "electrical_lighting",
    label: "Electrical & Lighting",
    description: "Interior, exterior and canopy lighting plus electrical distribution",
    aliases: ["electrician", "lights", "sign", "power"],
    color: "#D59D25",
    sortOrder: 5,
  },
  {
    id: "category-plumbing",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "plumbing",
    label: "Plumbing",
    description: "Restrooms, drains, sinks, water heaters and piping",
    aliases: ["plumber", "drain", "leak", "toilet"],
    color: "#2783A5",
    sortOrder: 6,
  },
  {
    id: "category-building-exterior",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "building_exterior",
    label: "Building & Exterior",
    description: "Roof, doors, walls, glazing and exterior envelope",
    aliases: ["roofing", "door", "building", "glass"],
    color: "#7A6651",
    sortOrder: 7,
  },
  {
    id: "category-grounds",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "grounds",
    label: "Site & Grounds",
    description: "Parking lots, landscaping, snow, waste and pest services",
    aliases: ["landscaping", "snow", "pothole", "pest", "waste"],
    color: "#668B45",
    sortOrder: 8,
  },
  {
    id: "category-fire-life-safety",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "fire_life_safety",
    label: "Fire & Life Safety",
    description: "Fire protection, alarms, emergency lighting and inspections",
    aliases: ["fire alarm", "extinguisher", "life safety", "emergency light"],
    color: "#B34545",
    sortOrder: 9,
  },
  {
    id: "category-security",
    organizationId: DEMO_ORGANIZATION_ID,
    key: "security",
    label: "Security",
    description: "Cameras, intrusion, access and panic systems",
    aliases: ["camera", "alarm", "access control", "panic button"],
    color: "#5B5E8C",
    sortOrder: 10,
  },
];

const categoryIdByKey: Record<MaintenanceCategoryKey, string> = Object.fromEntries(
  demoCategories.map((category) => [category.key, category.id]),
) as Record<MaintenanceCategoryKey, string>;

export const demoTaxonomyNodes: TaxonomyNode[] = [
  ["tax-refrigeration-walkins", "refrigeration", undefined, "walk_ins", "Walk-In Refrigeration", ["walk ins"], "group", 1],
  ["tax-refrigeration-beer-cave", "refrigeration", "tax-refrigeration-walkins", "beer_cave", "Beer Cave", ["beer cooler"], "system", 1],
  ["tax-refrigeration-freezer", "refrigeration", "tax-refrigeration-walkins", "walk_in_freezer", "Walk-In Freezer", ["freezer box"], "system", 2],
  ["tax-hvac-rooftop", "hvac", undefined, "rooftop_units", "Rooftop Units", ["RTUs"], "equipment_type", 1],
  ["tax-fuel-dispensers", "fuel_forecourt", undefined, "dispensers", "Fuel Dispensers", ["pumps"], "system", 1],
  ["tax-foodservice-hot", "foodservice", undefined, "hot_food", "Hot Food Equipment", ["kitchen equipment"], "group", 1],
  ["tax-foodservice-ovens", "foodservice", "tax-foodservice-hot", "rapid_ovens", "Rapid-Cook Ovens", ["high speed oven"], "equipment_type", 1],
  ["tax-electrical-canopy", "electrical_lighting", undefined, "canopy_lighting", "Canopy Lighting", ["fuel island lights"], "system", 1],
  ["tax-plumbing-store", "plumbing", undefined, "store_plumbing", "Store Plumbing", ["restroom and sinks"], "system", 1],
  ["tax-building-envelope", "building_exterior", undefined, "building_envelope", "Building Envelope", ["roof and doors"], "group", 1],
  ["tax-grounds-site", "grounds", undefined, "site_services", "Site Services", ["exterior services"], "group", 1],
  ["tax-fire-systems", "fire_life_safety", undefined, "fire_systems", "Fire Systems", ["alarms and suppression"], "system", 1],
  ["tax-security-systems", "security", undefined, "security_systems", "Security Systems", ["cameras and alarms"], "system", 1],
].map(([id, categoryKey, parentId, canonicalKey, label, aliases, kind, sortOrder]) => ({
  id: id as string,
  organizationId: DEMO_ORGANIZATION_ID,
  categoryId: categoryIdByKey[categoryKey as MaintenanceCategoryKey],
  parentId: parentId as string | undefined,
  canonicalKey: canonicalKey as string,
  label: label as string,
  aliases: aliases as string[],
  kind: kind as TaxonomyNode["kind"],
  sortOrder: sortOrder as number,
}));

interface StoreSeed {
  number: string;
  shortName: string;
  regionId: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  format: Store["format"];
  open24Hours: boolean;
  openedOn: string;
  squareFeet: number;
}

const storeSeeds: StoreSeed[] = [
  { number: "101", shortName: "Easton Gateway", regionId: "region-central-ohio", line1: "4180 Meridian Pike", city: "Columbus", state: "OH", postalCode: "43219", latitude: 40.0517, longitude: -82.9192, format: "fuel_and_market", open24Hours: true, openedOn: "2015-04-18", squareFeet: 4800 },
  { number: "104", shortName: "West Broad", regionId: "region-central-ohio", line1: "2875 West Broad Street", city: "Columbus", state: "OH", postalCode: "43204", latitude: 39.9545, longitude: -83.0782, format: "fuel_and_market", open24Hours: true, openedOn: "2008-09-12", squareFeet: 4300 },
  { number: "108", shortName: "Dublin North", regionId: "region-central-ohio", line1: "7042 Sawmill Parkway", city: "Dublin", state: "OH", postalCode: "43017", latitude: 40.1123, longitude: -83.0921, format: "fuel_and_market", open24Hours: true, openedOn: "2018-06-22", squareFeet: 5200 },
  { number: "112", shortName: "Grove City", regionId: "region-central-ohio", line1: "1930 Stringtown Road", city: "Grove City", state: "OH", postalCode: "43123", latitude: 39.8772, longitude: -83.0717, format: "fuel_and_market", open24Hours: true, openedOn: "2012-11-03", squareFeet: 4600 },
  { number: "115", shortName: "Lancaster Bypass", regionId: "region-central-ohio", line1: "1515 Memorial Drive", city: "Lancaster", state: "OH", postalCode: "43130", latitude: 39.7273, longitude: -82.6174, format: "travel_center", open24Hours: true, openedOn: "2021-02-19", squareFeet: 6700 },
  { number: "201", shortName: "Miller Lane", regionId: "region-miami-valley", line1: "6930 Miller Lane", city: "Dayton", state: "OH", postalCode: "45414", latitude: 39.8508, longitude: -84.1912, format: "travel_center", open24Hours: true, openedOn: "2022-08-05", squareFeet: 7100 },
  { number: "204", shortName: "Beavercreek", regionId: "region-miami-valley", line1: "3310 New Germany Trebein Road", city: "Beavercreek", state: "OH", postalCode: "45431", latitude: 39.7471, longitude: -84.0549, format: "fuel_and_market", open24Hours: true, openedOn: "2017-10-14", squareFeet: 5100 },
  { number: "207", shortName: "Springfield South", regionId: "region-miami-valley", line1: "2145 Limestone Street", city: "Springfield", state: "OH", postalCode: "45505", latitude: 39.8963, longitude: -83.8089, format: "fuel_and_market", open24Hours: false, openedOn: "2011-03-26", squareFeet: 4200 },
  { number: "211", shortName: "Troy Market", regionId: "region-miami-valley", line1: "1340 West Main Street", city: "Troy", state: "OH", postalCode: "45373", latitude: 40.0394, longitude: -84.2263, format: "fuel_and_market", open24Hours: true, openedOn: "2014-07-11", squareFeet: 4700 },
  { number: "214", shortName: "Xenia Station", regionId: "region-miami-valley", line1: "775 West Main Street", city: "Xenia", state: "OH", postalCode: "45385", latitude: 39.6849, longitude: -83.9454, format: "market_only", open24Hours: false, openedOn: "2009-05-02", squareFeet: 3900 },
  { number: "301", shortName: "Florence Crossing", regionId: "region-northern-kentucky", line1: "8190 Burlington Pike", city: "Florence", state: "KY", postalCode: "41042", latitude: 39.0001, longitude: -84.6499, format: "travel_center", open24Hours: true, openedOn: "2019-09-21", squareFeet: 6900 },
  { number: "304", shortName: "Covington Riverfront", regionId: "region-northern-kentucky", line1: "620 Madison Avenue", city: "Covington", state: "KY", postalCode: "41011", latitude: 39.0836, longitude: -84.5108, format: "market_only", open24Hours: false, openedOn: "2007-01-17", squareFeet: 3600 },
  { number: "308", shortName: "Independence", regionId: "region-northern-kentucky", line1: "2040 Declaration Drive", city: "Independence", state: "KY", postalCode: "41051", latitude: 38.9514, longitude: -84.5474, format: "fuel_and_market", open24Hours: true, openedOn: "2016-12-02", squareFeet: 4900 },
  { number: "312", shortName: "Erlanger Terminal", regionId: "region-northern-kentucky", line1: "1870 Dixie Highway", city: "Erlanger", state: "KY", postalCode: "41018", latitude: 39.0168, longitude: -84.5981, format: "fuel_and_market", open24Hours: true, openedOn: "2013-04-05", squareFeet: 4500 },
  { number: "315", shortName: "Alexandria Pike", regionId: "region-northern-kentucky", line1: "9310 Alexandria Pike", city: "Alexandria", state: "KY", postalCode: "41001", latitude: 38.9651, longitude: -84.3891, format: "fuel_and_market", open24Hours: true, openedOn: "2020-11-13", squareFeet: 5300 },
];

const allCategoryIds = demoCategories.map((category) => category.id);

export const demoStores: Store[] = storeSeeds.map((seed) => ({
  id: `store-${seed.number}`,
  organizationId: DEMO_ORGANIZATION_ID,
  divisionId: "division-retail-operations",
  regionId: seed.regionId,
  storeNumber: seed.number,
  name: `Northline ${seed.shortName}`,
  normalizedAddress: `${seed.line1}, ${seed.city}, ${seed.state} ${seed.postalCode}`.toLowerCase(),
  address: {
    line1: seed.line1,
    city: seed.city,
    state: seed.state,
    postalCode: seed.postalCode,
    country: "US",
  },
  coordinates: { latitude: seed.latitude, longitude: seed.longitude },
  externalIdentifiers: { legacyStoreId: `LEG-${seed.number}`, costCenter: `CC-${seed.number}` },
  aliases: [
    { type: "alternate_name", value: seed.shortName },
    { type: "legacy_id", value: `NM-${seed.number}` },
  ],
  phone: `(555) 4${seed.number.slice(0, 2)}-${seed.number.padStart(4, "0")}`,
  managerPersonId: `person-manager-${seed.number}`,
  format: seed.format,
  open24Hours: seed.open24Hours,
  openedOn: seed.openedOn,
  squareFeet: seed.squareFeet,
  activeCategoryIds: allCategoryIds,
  status: "open",
  searchTerms: [seed.number, seed.shortName, seed.city, seed.line1, seed.postalCode],
}));

const storeManagers = [
  "Jamie Carter", "Robin Flores", "Taylor Kim", "Morgan Reed", "Casey Ward",
  "Drew Simmons", "Riley Price", "Parker Nguyen", "Cameron Bell", "Quinn Foster",
  "Ari Jackson", "Skyler Adams", "Reese Turner", "Hayden Ross", "Emerson Diaz",
];

const storeEmployees = [
  "Sam Greene", "Lee Bryant", "Alexis Murphy", "Devon King", "Bailey Cox",
  "Kendall Hughes", "Marley Long", "Sage Perry", "Rowan Powell", "Finley Howard",
  "Dakota Russell", "Micah Jenkins", "Sydney Patterson", "Blake Coleman", "Shawn Rivera",
];

const makePerson = (
  id: string,
  displayName: string,
  employeeNumber: string,
  roles: Person["roles"],
  scopeIds: string[],
): Person => {
  const [firstName, ...lastParts] = displayName.split(" ");
  const lastName = lastParts.join(" ");
  return {
    id,
    organizationId: DEMO_ORGANIZATION_ID,
    firstName,
    lastName,
    displayName,
    email: `${firstName}.${lastName}`.toLowerCase().replaceAll(" ", ".") + "@northline.demo",
    phone: `(555) 800-${employeeNumber.slice(-4).padStart(4, "0")}`,
    employeeNumber,
    roles,
    scopeIds,
    active: true,
  };
};

export const demoPeople: Person[] = [
  makePerson("person-alex-morgan", "Alex Morgan", "E0001", ["owner"], [DEMO_ORGANIZATION_ID]),
  makePerson("person-dana-brooks", "Dana Brooks", "E0010", ["facilities_manager"], [DEMO_ORGANIZATION_ID]),
  makePerson("person-evan-rhodes", "Evan Rhodes", "E0012", ["finance_reviewer"], [DEMO_ORGANIZATION_ID]),
  makePerson("person-maya-chen", "Maya Chen", "E0021", ["regional_manager"], ["region-central-ohio"]),
  makePerson("person-jordan-ellis", "Jordan Ellis", "E0022", ["regional_manager"], ["region-miami-valley"]),
  makePerson("person-avery-brooks", "Avery Brooks", "E0023", ["regional_manager"], ["region-northern-kentucky"]),
  makePerson("person-noah-bennett", "Noah Bennett", "E0041", ["internal_technician"], [DEMO_ORGANIZATION_ID]),
  makePerson("person-priya-shah", "Priya Shah", "E0042", ["internal_technician"], [DEMO_ORGANIZATION_ID]),
  ...demoStores.flatMap((store, index) => [
    makePerson(`person-manager-${store.storeNumber}`, storeManagers[index], `E1${store.storeNumber}`, ["store_manager"], [store.id]),
    makePerson(`person-employee-${store.storeNumber}`, storeEmployees[index], `E2${store.storeNumber}`, ["store_employee"], [store.id]),
  ]),
];

export const demoTeams: InternalTeam[] = [
  {
    id: "team-facilities-coordination",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Facilities Coordination",
    description: "Reviews requests, issues vendor work and owns exceptions",
    memberPersonIds: ["person-dana-brooks"],
    categoryIds: allCategoryIds,
    regionIds: demoRegions.map((region) => region.id),
  },
  {
    id: "team-mobile-maintenance",
    organizationId: DEMO_ORGANIZATION_ID,
    name: "Mobile Maintenance",
    description: "Two-person internal team for minor repairs, inspections and first looks",
    memberPersonIds: ["person-noah-bennett", "person-priya-shah"],
    categoryIds: [
      categoryIdByKey.hvac,
      categoryIdByKey.foodservice,
      categoryIdByKey.electrical_lighting,
      categoryIdByKey.plumbing,
      categoryIdByKey.building_exterior,
    ],
    regionIds: demoRegions.map((region) => region.id),
  },
];

const allRegionIds = demoRegions.map((region) => region.id);

export const demoVendors: Vendor[] = [
  {
    id: "vendor-summit-refrigeration",
    organizationId: DEMO_ORGANIZATION_ID,
    legalName: "Summit Commercial Refrigeration LLC",
    displayName: "Summit Refrigeration",
    customerVendorNumber: "V-1007",
    description: "24/7 commercial refrigeration and HVAC service for walk-ins, beer caves and rooftop equipment.",
    aliases: ["Summit", "Summit HVAC", "Summit Commercial"],
    specialties: [
      { categoryId: categoryIdByKey.refrigeration, label: "Commercial Refrigeration", aliases: ["refrigeration tech", "cooler repair", "beer cave", "freezer"], equipmentTypes: ["Beer cave", "Walk-in freezer", "Reach-in cooler", "Condensing unit"] },
      { categoryId: categoryIdByKey.hvac, label: "Commercial HVAC", aliases: ["AC", "air conditioning", "RTU"], equipmentTypes: ["Rooftop unit", "Thermostat", "Make-up air"] },
    ],
    searchTerms: ["refrigeration", "hvac", "cooler", "freezer", "beer cave", "walk in", "compressor", "24 hour"],
    coverageRegionIds: allRegionIds,
    preferredStoreIds: demoStores.map((store) => store.id),
    contacts: [
      { id: "contact-summit-dispatch", name: "Summit Dispatch", role: "dispatch", email: "dispatch@summit-refrigeration.demo", phone: "(555) 310-2200", preferredChannel: "email" },
      { id: "contact-summit-billing", name: "Monica Hale", role: "billing", email: "billing@summit-refrigeration.demo", phone: "(555) 310-2211", preferredChannel: "email" },
      { id: "contact-summit-afterhours", name: "After-Hours Desk", role: "after_hours", email: "afterhours@summit-refrigeration.demo", phone: "(555) 310-2299", preferredChannel: "phone" },
    ],
    afterHoursAvailable: true,
    status: "preferred",
    insuranceExpiresOn: "2027-04-30",
    portalEnabled: true,
  },
  {
    id: "vendor-cedar-mechanical",
    organizationId: DEMO_ORGANIZATION_ID,
    legalName: "Cedar Mechanical Services Inc.",
    displayName: "Cedar Mechanical",
    customerVendorNumber: "V-1014",
    description: "Commercial HVAC, plumbing and foodservice equipment diagnostics throughout the operating footprint.",
    aliases: ["Cedar", "CMS", "Cedar Plumbing"],
    specialties: [
      { categoryId: categoryIdByKey.hvac, label: "HVAC", aliases: ["heating", "AC", "rooftop unit"], equipmentTypes: ["Rooftop unit", "Split system", "Thermostat"] },
      { categoryId: categoryIdByKey.plumbing, label: "Commercial Plumbing", aliases: ["plumber", "drain service", "water heater"], equipmentTypes: ["Drain", "Sink", "Restroom fixture", "Water heater"] },
      { categoryId: categoryIdByKey.foodservice, label: "Foodservice Equipment", aliases: ["oven tech", "kitchen repair"], equipmentTypes: ["Rapid-cook oven", "Roller grill", "Hot holding"] },
    ],
    searchTerms: ["plumber", "plumbing", "hvac", "oven", "kitchen", "drain", "water leak", "heat"],
    coverageRegionIds: allRegionIds,
    preferredStoreIds: demoStores.filter((_, index) => index % 3 !== 2).map((store) => store.id),
    contacts: [
      { id: "contact-cedar-dispatch", name: "Nina Alvarez", role: "dispatch", email: "dispatch@cedar-mechanical.demo", phone: "(555) 321-4100", preferredChannel: "sms" },
      { id: "contact-cedar-billing", name: "Cedar Billing", role: "billing", email: "ar@cedar-mechanical.demo", phone: "(555) 321-4110", preferredChannel: "email" },
    ],
    afterHoursAvailable: true,
    status: "approved",
    insuranceExpiresOn: "2026-12-31",
    portalEnabled: false,
  },
  {
    id: "vendor-forecourt-systems",
    organizationId: DEMO_ORGANIZATION_ID,
    legalName: "Forecourt Systems Group LLC",
    displayName: "Forecourt Systems Group",
    customerVendorNumber: "V-1021",
    description: "Certified dispenser, payment-terminal and fuel-system service with regional emergency coverage.",
    aliases: ["FSG", "Forecourt", "Pump Tech"],
    specialties: [
      { categoryId: categoryIdByKey.fuel_forecourt, label: "Fuel Systems", aliases: ["gas pump repair", "dispenser tech", "fuel controller"], equipmentTypes: ["Fuel dispenser", "Site controller", "Card reader", "Submersible pump"] },
    ],
    searchTerms: ["fuel", "pump", "dispenser", "forecourt", "card reader", "gas", "site controller"],
    coverageRegionIds: allRegionIds,
    preferredStoreIds: demoStores.filter((store) => store.format !== "market_only").map((store) => store.id),
    contacts: [
      { id: "contact-forecourt-dispatch", name: "Service Desk", role: "dispatch", email: "service@forecourt-systems.demo", phone: "(555) 334-7300", preferredChannel: "email" },
      { id: "contact-forecourt-billing", name: "Owen Grant", role: "billing", email: "billing@forecourt-systems.demo", phone: "(555) 334-7310", preferredChannel: "email" },
    ],
    afterHoursAvailable: true,
    status: "preferred",
    insuranceExpiresOn: "2027-02-28",
    portalEnabled: true,
  },
  {
    id: "vendor-brightpath-electrical",
    organizationId: DEMO_ORGANIZATION_ID,
    legalName: "BrightPath Electrical & Controls LLC",
    displayName: "BrightPath Electrical",
    customerVendorNumber: "V-1036",
    description: "Commercial electrical, canopy lighting, signage, controls and low-voltage security service.",
    aliases: ["BrightPath", "BPE", "Bright Path Electric"],
    specialties: [
      { categoryId: categoryIdByKey.electrical_lighting, label: "Electrical & Lighting", aliases: ["electrician", "lighting contractor", "sign repair"], equipmentTypes: ["Canopy lighting", "Panel", "Exterior sign", "Emergency lighting"] },
      { categoryId: categoryIdByKey.security, label: "Low-Voltage Security", aliases: ["camera tech", "alarm contractor"], equipmentTypes: ["Camera", "NVR", "Panic button", "Access control"] },
    ],
    searchTerms: ["electrician", "lighting", "canopy", "sign", "camera", "security", "power", "controls"],
    coverageRegionIds: allRegionIds,
    preferredStoreIds: demoStores.map((store) => store.id),
    contacts: [
      { id: "contact-brightpath-dispatch", name: "Grace Lin", role: "dispatch", email: "dispatch@brightpath-electric.demo", phone: "(555) 348-1500", preferredChannel: "sms" },
      { id: "contact-brightpath-billing", name: "BrightPath Billing", role: "billing", email: "billing@brightpath-electric.demo", phone: "(555) 348-1510", preferredChannel: "email" },
    ],
    afterHoursAvailable: false,
    status: "approved",
    insuranceExpiresOn: "2026-11-15",
    portalEnabled: false,
  },
  {
    id: "vendor-four-seasons-site",
    organizationId: DEMO_ORGANIZATION_ID,
    legalName: "Four Seasons Site Services LLC",
    displayName: "Four Seasons Site Services",
    customerVendorNumber: "V-1042",
    description: "Multi-site landscaping, snow and ice, parking-lot, pest and exterior facility services.",
    aliases: ["Four Seasons", "4S Site", "FSSS"],
    specialties: [
      { categoryId: categoryIdByKey.grounds, label: "Site & Grounds", aliases: ["landscaper", "snow removal", "pothole", "pest control"], equipmentTypes: ["Parking lot", "Landscape", "Snow and ice", "Waste enclosure"] },
      { categoryId: categoryIdByKey.building_exterior, label: "Exterior Facility Services", aliases: ["door repair", "roof patch", "bollard"], equipmentTypes: ["Door", "Roof", "Bollard", "Exterior wall"] },
    ],
    searchTerms: ["landscaping", "snow", "pest", "parking lot", "pothole", "roof", "door", "exterior"],
    coverageRegionIds: allRegionIds,
    preferredStoreIds: demoStores.map((store) => store.id),
    contacts: [
      { id: "contact-four-seasons-dispatch", name: "Regional Service Desk", role: "dispatch", email: "dispatch@fourseasons-site.demo", phone: "(555) 359-8800", preferredChannel: "email" },
      { id: "contact-four-seasons-billing", name: "Tara Owens", role: "billing", email: "billing@fourseasons-site.demo", phone: "(555) 359-8810", preferredChannel: "email" },
    ],
    afterHoursAvailable: true,
    status: "approved",
    insuranceExpiresOn: "2027-01-31",
    portalEnabled: true,
  },
];

interface AssetTemplate {
  slug: string;
  code: string;
  categoryKey: MaintenanceCategoryKey;
  taxonomyNodeId: string;
  path: string[];
  name: string;
  assetType: string;
  locationDetail: string;
  manufacturers: string[];
  models: string[];
  expectedLifeYears: number;
  replacementEstimateMinor: number;
  supplierVendorId: string;
  criticality: Asset["criticality"];
}

const assetTemplates: AssetTemplate[] = [
  { slug: "rtu-1", code: "RTU-1", categoryKey: "hvac", taxonomyNodeId: "tax-hvac-rooftop", path: ["tax-hvac-rooftop"], name: "Sales Floor Rooftop Unit 1", assetType: "Packaged rooftop unit", locationDetail: "Roof — west curb", manufacturers: ["Carrier", "Trane", "Lennox"], models: ["48TCED12", "YSC120", "LGA120"], expectedLifeYears: 15, replacementEstimateMinor: 2_450_000, supplierVendorId: "vendor-cedar-mechanical", criticality: "important" },
  { slug: "beer-cave", code: "REF-BC-1", categoryKey: "refrigeration", taxonomyNodeId: "tax-refrigeration-beer-cave", path: ["tax-refrigeration-walkins", "tax-refrigeration-beer-cave"], name: "Beer Cave Refrigeration System", assetType: "Remote condensing system", locationDetail: "Rear beer cave / roof condensing rack", manufacturers: ["Heatcraft", "Russell", "Bohn"], models: ["H-CHX035", "R-WM045", "B-CLD040"], expectedLifeYears: 12, replacementEstimateMinor: 1_850_000, supplierVendorId: "vendor-summit-refrigeration", criticality: "critical" },
  { slug: "walkin-freezer", code: "REF-WF-1", categoryKey: "refrigeration", taxonomyNodeId: "tax-refrigeration-freezer", path: ["tax-refrigeration-walkins", "tax-refrigeration-freezer"], name: "Walk-In Freezer System", assetType: "Low-temperature condensing system", locationDetail: "Back room walk-in freezer", manufacturers: ["Hussmann", "Heatcraft", "Bally"], models: ["HUS-LT030", "H-LTX032", "BAL-LT28"], expectedLifeYears: 14, replacementEstimateMinor: 2_200_000, supplierVendorId: "vendor-summit-refrigeration", criticality: "critical" },
  { slug: "fuel-controller", code: "FUEL-SC-1", categoryKey: "fuel_forecourt", taxonomyNodeId: "tax-fuel-dispensers", path: ["tax-fuel-dispensers"], name: "Forecourt Site Controller", assetType: "Fuel site controller", locationDetail: "Manager office communications cabinet", manufacturers: ["Gilbarco", "Verifone", "Wayne"], models: ["Passport PX60", "Commander Site", "Fusion 6000"], expectedLifeYears: 10, replacementEstimateMinor: 1_350_000, supplierVendorId: "vendor-forecourt-systems", criticality: "critical" },
  { slug: "oven-1", code: "FS-OV-1", categoryKey: "foodservice", taxonomyNodeId: "tax-foodservice-ovens", path: ["tax-foodservice-hot", "tax-foodservice-ovens"], name: "Rapid-Cook Oven 1", assetType: "Ventless rapid-cook oven", locationDetail: "Prepared food counter", manufacturers: ["TurboChef", "Merrychef", "Amana Commercial"], models: ["SOTA", "eikon e4", "MXP22"], expectedLifeYears: 8, replacementEstimateMinor: 1_150_000, supplierVendorId: "vendor-cedar-mechanical", criticality: "important" },
];

export const demoAssets: Asset[] = demoStores.flatMap((store, storeIndex) =>
  assetTemplates.map((template, templateIndex) => {
    const installedYear = 2011 + ((storeIndex * 2 + templateIndex) % 13);
    const installedOn = `${installedYear}-${String(((storeIndex + templateIndex) % 12) + 1).padStart(2, "0")}-15`;
    const warrantyEndYear = installedYear + (template.categoryKey === "refrigeration" ? 5 : 3);
    return {
      id: `asset-${store.storeNumber}-${template.slug}`,
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: store.id,
      categoryId: categoryIdByKey[template.categoryKey],
      taxonomyNodeId: template.taxonomyNodeId,
      taxonomyPathIds: template.path,
      assetCode: `${store.storeNumber}-${template.code}`,
      name: template.name,
      assetType: template.assetType,
      locationDetail: template.locationDetail,
      manufacturer: template.manufacturers[(storeIndex + templateIndex) % template.manufacturers.length],
      model: template.models[(storeIndex + templateIndex) % template.models.length],
      serialNumber: `NL${store.storeNumber}${templateIndex + 1}${installedYear}${String(storeIndex + 17).padStart(3, "0")}`,
      installedOn,
      expectedLifeYears: template.expectedLifeYears,
      replacementEstimateMinor: template.replacementEstimateMinor + (storeIndex % 3) * 75_000,
      currency: "USD",
      supplierVendorId: template.supplierVendorId,
      warranty: {
        provider: template.manufacturers[(storeIndex + templateIndex) % template.manufacturers.length],
        startsOn: installedOn,
        endsOn: `${warrantyEndYear}-${installedOn.slice(5)}`,
        coverage: "Parts; compressor coverage where applicable",
        reference: `WR-${store.storeNumber}-${template.code.replaceAll("-", "")}`,
      },
      status: "active",
      criticality: template.criticality,
      searchTerms: [template.name, template.assetType, template.code, store.storeNumber],
    } satisfies Asset;
  }),
);

const componentsByTemplate: Record<string, Array<[string, string, string]>> = {
  "RTU-1": [
    ["COMP-1", "Compressor 1", "Scroll compressor"],
    ["BLWR-1", "Supply Blower Motor", "Blower motor"],
    ["CTRL-1", "Unit Controller", "HVAC controller"],
  ],
  "REF-BC-1": [
    ["COMP-1", "Primary Compressor", "Semi-hermetic compressor"],
    ["CFAN-1", "Condenser Fan Motor", "Fan motor"],
    ["EVAP-1", "Evaporator Controller", "Electronic controller"],
  ],
  "REF-WF-1": [
    ["COMP-1", "Low-Temperature Compressor", "Scroll compressor"],
    ["EFAN-1", "Evaporator Fan Assembly", "Fan assembly"],
    ["DEF-1", "Defrost Controller", "Defrost control"],
  ],
  "FUEL-SC-1": [
    ["CPU-1", "Controller Processor", "Controller board"],
    ["NET-1", "Forecourt Network Module", "Communications module"],
  ],
  "FS-OV-1": [
    ["CTRL-1", "Oven Control Board", "Control board"],
    ["MAG-1", "Microwave Power Module", "Magnetron module"],
  ],
};

export const demoAssetComponents: AssetComponent[] = demoAssets.flatMap((asset) => {
  const baseCode = asset.assetCode.slice(4);
  const templates = componentsByTemplate[baseCode] ?? [];
  const components = templates.map(([componentCode, name, componentType], index) => ({
    id: `component-${asset.id.slice(6)}-${componentCode.toLowerCase()}`,
    organizationId: DEMO_ORGANIZATION_ID,
    assetId: asset.id,
    componentCode: `${asset.assetCode}-${componentCode}`,
    name,
    componentType,
    manufacturer: asset.manufacturer,
    model: `${asset.model}-${String(index + 1).padStart(2, "0")}`,
    serialNumber: `${asset.serialNumber}-C${index + 1}`,
    installedOn: asset.installedOn,
    status: "active",
  } satisfies AssetComponent));

  if (asset.id !== "asset-104-beer-cave") return components;

  const originalCompressorId = "component-104-beer-cave-comp-1";
  return [
    ...components.map((component) => component.id === originalCompressorId
      ? {
          ...component,
          name: "Primary Compressor (original)",
          manufacturer: "Copeland",
          model: "3DA3-0750-TFC",
          status: "replaced" as const,
        }
      : component),
    {
      id: "component-104-beer-cave-comp-2",
      organizationId: DEMO_ORGANIZATION_ID,
      assetId: asset.id,
      componentCode: "104-REF-BC-1-COMP-2",
      name: "Primary Compressor (replacement)",
      componentType: "Semi-hermetic compressor",
      manufacturer: "Copeland",
      model: "3DA3-0750-TFC",
      serialNumber: "CP20260509NLM104",
      installedOn: "2026-05-09",
      status: "active",
    },
  ];
});

function assetId(store: Store, slug: string): string {
  return `asset-${store.storeNumber}-${slug}`;
}

function assetComponentId(store: Store, assetSlug: string, componentSlug: string): string {
  return `component-${store.storeNumber}-${assetSlug}-${componentSlug.toLowerCase()}`;
}

const pmLinkedStoreNumbers = new Set(["101", "108", "201", "207", "301", "308"]);

export const demoPmPlans: PreventiveMaintenancePlan[] = demoStores.flatMap((store, index) => {
  const refrigerationDue = daysAgo(index % 5 === 0 ? 6 : -(5 + (index % 11)));
  const hvacDue = daysAgo(index % 6 === 2 ? 9 : -(8 + (index % 9)));
  return [
    {
      id: `pm-plan-${store.storeNumber}-refrigeration`,
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: store.id,
      categoryId: categoryIdByKey.refrigeration,
      assetId: assetId(store, "beer-cave"),
      name: "Monthly refrigeration condition check",
      description: "Inspect temperatures, coils, fans, door seals and visible refrigerant concerns.",
      cadence: "monthly",
      fulfillmentMode: "external",
      assignedPartyType: "vendor",
      assignedPartyId: "vendor-summit-refrigeration",
      active: true,
      nextDueAt: refrigerationDue,
      requiredEvidence: ["checklist", "reading", "visit"],
    },
    {
      id: `pm-plan-${store.storeNumber}-hvac`,
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: store.id,
      categoryId: categoryIdByKey.hvac,
      assetId: assetId(store, "rtu-1"),
      name: "Quarterly rooftop unit service",
      description: "Inspect filters, belts, drain, coils, electrical connections and operating temperatures.",
      cadence: "quarterly",
      fulfillmentMode: index % 3 === 0 ? "internal" : "external",
      assignedPartyType: index % 3 === 0 ? "team" : "vendor",
      assignedPartyId: index % 3 === 0 ? "team-mobile-maintenance" : "vendor-cedar-mechanical",
      active: true,
      nextDueAt: hvacDue,
      requiredEvidence: ["checklist", "photo", "visit"],
    },
  ];
});

export const demoPmOccurrences: PmOccurrence[] = demoPmPlans.flatMap((plan) => {
  const store = demoStores.find((candidate) => candidate.id === plan.storeId)!;
  const isHvac = plan.categoryId === categoryIdByKey.hvac;
  const previousId = `pm-occ-${store.storeNumber}-${isHvac ? "hvac" : "refrigeration"}-previous`;
  const linked = pmLinkedStoreNumbers.has(store.storeNumber) &&
    ((isHvac && Number(store.storeNumber) % 2 === 0) || (!isHvac && Number(store.storeNumber) % 2 === 1));
  const currentDueMs = Date.parse(plan.nextDueAt);
  const currentStatus: PmOccurrence["status"] = currentDueMs < DEMO_NOW_MS ? "overdue" : "upcoming";
  return [
    {
      id: previousId,
      organizationId: DEMO_ORGANIZATION_ID,
      pmPlanId: plan.id,
      storeId: plan.storeId,
      workOrderId: linked ? `wo-pm-${store.storeNumber}-${isHvac ? "hvac" : "refrigeration"}` : undefined,
      dueAt: daysAgo(isHvac ? 92 : 36),
      status: "completed",
      completedAt: daysAgo(isHvac ? 89 : 34),
      completedByPartyId: plan.assignedPartyId,
      completionNote: isHvac ? "Filters and belt condition documented; drain cleared." : "Temperatures and fan operation verified.",
    },
    {
      id: `pm-occ-${store.storeNumber}-${isHvac ? "hvac" : "refrigeration"}-current`,
      organizationId: DEMO_ORGANIZATION_ID,
      pmPlanId: plan.id,
      storeId: plan.storeId,
      dueAt: plan.nextDueAt,
      status: currentStatus,
    },
  ];
});

interface WorkSeedSpec {
  slug: string;
  store: Store;
  categoryKey?: MaintenanceCategoryKey;
  taxonomyNodeId?: string;
  assetSlug?: string;
  componentSlug?: string;
  title: string;
  problem: string;
  scope: string;
  priority: WorkPriority;
  source: WorkOrder["source"];
  fulfillmentMode: FulfillmentMode;
  vendorId?: string;
  internalPartyId?: string;
  status: WorkStatus;
  ageDays: number;
  spendMinor: number;
  nteMinor?: number;
  invoice: boolean;
  visitCount?: number;
  outcome?: WorkOrder["outcome"];
  pmOccurrenceId?: string;
  classificationDeferred?: boolean;
  invoiceOverNte?: boolean;
  invoiceMissingReference?: boolean;
  duplicateInvoiceReference?: string;
  outsideGeofence?: boolean;
  missingCheckout?: boolean;
  reportedArrival?: boolean;
  reissued?: boolean;
}

const refrigerationSpend = [64_200, 378_000, 51_000, 82_500, 74_500, 126_000, 69_000, 58_500, 92_000, 112_000, 64_000, 76_000, 89_500, 212_000, 53_000];
const hvacSpend = [98_000, 42_000, 123_000, 74_000, 396_000, 85_000, 67_500, 143_000, 59_000, 82_000, 110_000, 51_000, 97_000, 246_000, 62_000];
const otherSpend = [61_000, 87_500, 128_000, 46_000, 72_000, 55_000, 39_500, 165_000, 58_000, 42_500, 94_000, 77_000, 138_000, 52_000, 69_000];

const refrigerationStatuses: WorkStatus[] = ["closed", "invoice_received", "awaiting_invoice", "invoice_received", "waiting_parts", "closed", "completed", "invoice_received", "closed", "scheduled", "awaiting_vendor_response", "closed", "closed", "invoice_received", "accepted"];
const hvacStatuses: WorkStatus[] = ["closed", "completed", "invoice_received", "closed", "scheduled", "invoice_received", "closed", "waiting_parts", "completed", "closed", "awaiting_invoice", "closed", "accepted", "invoice_received", "closed"];
const otherStatuses: WorkStatus[] = ["closed", "invoice_received", "completed", "closed", "issued", "closed", "invoice_received", "completed", "awaiting_vendor_response", "closed", "closed", "scheduled", "invoice_received", "closed", "closed"];

const ageForStatus = (status: WorkStatus, index: number): number => {
  if (["issued", "awaiting_vendor_response", "accepted", "scheduled", "onsite"].includes(status)) return index % 3;
  if (["waiting_parts", "unresolved"].includes(status)) return 7 + (index % 5);
  return 18 + ((index * 11) % 74);
};

const invoiceForStatus = (status: WorkStatus): boolean => ["invoice_received", "closed"].includes(status);

const refrigerationTitles = [
  "Beer cave temperature above setpoint",
  "Walk-in freezer evaporator icing",
  "Beer cave cycling and short-running",
  "Beer cave compressor trip",
  "Walk-in freezer not holding temperature",
];

const hvacTitles = [
  "Sales floor warm near checkout",
  "Rooftop unit making belt noise",
  "RTU 1 not cooling during afternoon",
  "Condensate dripping near sales floor",
  "Thermostat intermittently blank",
];

interface OtherTemplate {
  categoryKey: MaintenanceCategoryKey;
  taxonomyNodeId?: string;
  assetSlug?: string;
  title: string;
  problem: string;
  scope: string;
  vendorId: string;
}

const otherTemplates: OtherTemplate[] = [
  { categoryKey: "fuel_forecourt", taxonomyNodeId: "tax-fuel-dispensers", assetSlug: "fuel-controller", title: "Dispenser communication dropping offline", problem: "Two dispensers intermittently show controller unavailable and recover after a restart.", scope: "Diagnose the controller network and restore reliable dispenser communications.", vendorId: "vendor-forecourt-systems" },
  { categoryKey: "electrical_lighting", taxonomyNodeId: "tax-electrical-canopy", title: "Canopy lighting section out", problem: "The north fuel island has a dark three-fixture section after sunset.", scope: "Troubleshoot the circuit and restore the affected canopy fixtures.", vendorId: "vendor-brightpath-electrical" },
  { categoryKey: "grounds", taxonomyNodeId: "tax-grounds-site", title: "Pothole forming at main entrance", problem: "A growing pothole in the entrance lane is causing vehicles to swerve.", scope: "Make a durable patch and document the repaired area.", vendorId: "vendor-four-seasons-site" },
  { categoryKey: "plumbing", taxonomyNodeId: "tax-plumbing-store", title: "Mop sink draining slowly", problem: "The back-room mop sink backs up during normal use but has not overflowed.", scope: "Clear the restriction, test flow and report any underlying pipe concern.", vendorId: "vendor-cedar-mechanical" },
  { categoryKey: "foodservice", taxonomyNodeId: "tax-foodservice-ovens", assetSlug: "oven-1", title: "Rapid-cook oven fault code", problem: "Oven 1 stops midway through a cook cycle and displays an airflow fault.", scope: "Diagnose the fault, clean or repair airflow components and test a full cycle.", vendorId: "vendor-cedar-mechanical" },
];

const baseWorkSpecs: WorkSeedSpec[] = demoStores.flatMap((store, index) => {
  const refrigerationStatus = refrigerationStatuses[index];
  const hvacStatus = hvacStatuses[index];
  const otherStatus = otherStatuses[index];
  const other = otherTemplates[index % otherTemplates.length];
  const refrigerationAsset = index === 1 ? "beer-cave" : index % 3 === 1 ? "walkin-freezer" : "beer-cave";
  const refrigerationTaxonomy = refrigerationAsset === "beer-cave" ? "tax-refrigeration-beer-cave" : "tax-refrigeration-freezer";
  const hvacInternal = index % 4 === 1;
  const hvacBlended = index % 7 === 3;
  return [
    {
      slug: `${store.storeNumber}-refrigeration-main`,
      store,
      categoryKey: "refrigeration",
      taxonomyNodeId: refrigerationTaxonomy,
      assetSlug: refrigerationAsset,
      componentSlug: index === 1 ? "comp-1" : undefined,
      title: index === 1 ? "Beer cave compressor tripping intermittently" : refrigerationTitles[index % refrigerationTitles.length],
      problem: index === 1
        ? "Beer cave reached 47°F overnight. Staff reset the controller once, but the compressor tripped again."
        : `${refrigerationTitles[index % refrigerationTitles.length]}. Store staff confirmed product temperature is being monitored.`,
      scope: index === 1
        ? "Diagnose the original beer cave compressor, restore safe operation if possible, and document electrical and temperature readings."
        : "Diagnose the refrigeration system, restore safe operation and document readings and work performed.",
      priority: index === 1 || index === 13 ? "emergency" : index % 4 === 0 ? "urgent" : "soon",
      source: "employee_request",
      fulfillmentMode: "external",
      vendorId: "vendor-summit-refrigeration",
      status: refrigerationStatus,
      ageDays: index === 1 ? 117 : ageForStatus(refrigerationStatus, index),
      spendMinor: refrigerationSpend[index],
      nteMinor: index === 1 ? 250_000 : undefined,
      invoice: invoiceForStatus(refrigerationStatus),
      visitCount: index === 1 ? 2 : 1,
      outcome: refrigerationStatus === "waiting_parts" ? "diagnosed_waiting_parts" : "resolved",
      invoiceOverNte: index === 1,
      invoiceMissingReference: index === 7,
      outsideGeofence: index === 6,
      reportedArrival: index === 11,
      reissued: index === 1,
    },
    {
      slug: `${store.storeNumber}-hvac-main`,
      store,
      categoryKey: "hvac",
      taxonomyNodeId: "tax-hvac-rooftop",
      assetSlug: "rtu-1",
      title: hvacTitles[index % hvacTitles.length],
      problem: `${hvacTitles[index % hvacTitles.length]}. The store remains open and staff have not observed smoke or electrical odor.`,
      scope: "Inspect RTU 1, document operating readings and complete the authorized repair or diagnosis.",
      priority: index === 13 ? "emergency" : index % 5 === 0 ? "urgent" : "soon",
      source: index % 3 === 0 ? "manager_direct" : "employee_request",
      fulfillmentMode: hvacBlended ? "blended" : hvacInternal ? "internal" : "external",
      vendorId: hvacInternal ? undefined : index >= 10 ? "vendor-summit-refrigeration" : "vendor-cedar-mechanical",
      internalPartyId: hvacInternal || hvacBlended ? "team-mobile-maintenance" : undefined,
      status: hvacStatus,
      ageDays: ageForStatus(hvacStatus, index + 2),
      spendMinor: hvacSpend[index],
      invoice: !hvacInternal && invoiceForStatus(hvacStatus),
      visitCount: hvacBlended ? 2 : 1,
      outcome: hvacStatus === "waiting_parts" ? "diagnosed_waiting_parts" : hvacStatus === "completed" ? "resolved" : "resolved",
    },
    {
      slug: `${store.storeNumber}-${other.categoryKey}-main`,
      store,
      categoryKey: other.categoryKey,
      taxonomyNodeId: other.taxonomyNodeId,
      assetSlug: other.assetSlug,
      title: other.title,
      problem: other.problem,
      scope: other.scope,
      priority: index % 6 === 0 ? "urgent" : "routine",
      source: index % 2 === 0 ? "manager_direct" : "employee_request",
      fulfillmentMode: index === 7 ? "internal" : "external",
      vendorId: index === 7 ? undefined : other.vendorId,
      internalPartyId: index === 7 ? "team-mobile-maintenance" : undefined,
      status: otherStatus,
      ageDays: ageForStatus(otherStatus, index + 5),
      spendMinor: otherSpend[index],
      invoice: index !== 7 && invoiceForStatus(otherStatus),
      outcome: "resolved",
    },
  ];
});

const linkedPmOccurrences = demoPmOccurrences.filter((occurrence) => occurrence.workOrderId);
const pmWorkSpecs: WorkSeedSpec[] = linkedPmOccurrences.map((occurrence, index) => {
  const store = demoStores.find((candidate) => candidate.id === occurrence.storeId)!;
  const plan = demoPmPlans.find((candidate) => candidate.id === occurrence.pmPlanId)!;
  const isHvac = plan.categoryId === categoryIdByKey.hvac;
  const internal = plan.fulfillmentMode === "internal";
  return {
    slug: `pm-${store.storeNumber}-${isHvac ? "hvac" : "refrigeration"}`,
    store,
    categoryKey: isHvac ? "hvac" : "refrigeration",
    taxonomyNodeId: isHvac ? "tax-hvac-rooftop" : "tax-refrigeration-beer-cave",
    assetSlug: isHvac ? "rtu-1" : "beer-cave",
    title: isHvac ? "Quarterly RTU preventive service" : "Monthly refrigeration condition check",
    problem: `Scheduled preventive maintenance from ${plan.name}.`,
    scope: plan.description,
    priority: "routine",
    source: "pm",
    fulfillmentMode: plan.fulfillmentMode,
    vendorId: internal ? undefined : plan.assignedPartyId,
    internalPartyId: internal ? plan.assignedPartyId : undefined,
    status: index % 2 === 0 ? "closed" : "completed",
    ageDays: 34 + index,
    spendMinor: 24_500 + index * 3_250,
    invoice: !internal && index % 2 === 0,
    visitCount: 1,
    outcome: "preventive_complete",
    pmOccurrenceId: occurrence.id,
  };
});

const specialWorkSpecs: WorkSeedSpec[] = [
  {
    slug: "104-refrigeration-callback-1",
    store: demoStores[1],
    categoryKey: "refrigeration",
    taxonomyNodeId: "tax-refrigeration-beer-cave",
    assetSlug: "beer-cave",
    componentSlug: "comp-1",
    title: "Original beer cave compressor callback",
    problem: "The original beer cave compressor tripped again six days after the prior service visit and the temperature began rising.",
    scope: "Recheck the original compressor, document the recurring electrical failure and stabilize operation pending permanent replacement.",
    priority: "emergency",
    source: "manager_direct",
    fulfillmentMode: "external",
    vendorId: "vendor-summit-refrigeration",
    status: "closed",
    ageDays: 108,
    spendMinor: 195_000,
    invoice: true,
    visitCount: 1,
    outcome: "temporary_repair",
    duplicateInvoiceReference: "SUM-260187",
  },
  {
    slug: "104-refrigeration-compressor-replacement",
    store: demoStores[1],
    categoryKey: "refrigeration",
    taxonomyNodeId: "tax-refrigeration-beer-cave",
    assetSlug: "beer-cave",
    componentSlug: "comp-1",
    title: "Original beer cave compressor replacement",
    problem: "Compressor failed megohm test after two prior service calls and can no longer be returned to reliable operation.",
    scope: "Replace the primary compressor, filter-drier and contactor; evacuate, charge and document final temperatures.",
    priority: "emergency",
    source: "manager_direct",
    fulfillmentMode: "external",
    vendorId: "vendor-summit-refrigeration",
    status: "closed",
    ageDays: 96,
    spendMinor: 468_000,
    nteMinor: 475_000,
    invoice: true,
    visitCount: 2,
    outcome: "resolved",
  },
  {
    slug: "112-water-source-unclassified",
    store: demoStores[3],
    title: "Water pooling beside rear cooler",
    problem: "Staff found a shallow puddle beside the rear cooler. The source is not yet clear.",
    scope: "Inspect the area, make it safe and identify whether refrigeration, plumbing or the building is responsible.",
    priority: "urgent",
    source: "employee_request",
    fulfillmentMode: "internal",
    internalPartyId: "team-mobile-maintenance",
    status: "unresolved",
    ageDays: 3,
    spendMinor: 12_500,
    invoice: false,
    visitCount: 1,
    outcome: "unresolved",
    classificationDeferred: true,
  },
  {
    slug: "315-emergency-rtu-onsite",
    store: demoStores[14],
    categoryKey: "hvac",
    taxonomyNodeId: "tax-hvac-rooftop",
    assetSlug: "rtu-1",
    title: "RTU 1 compressor lockout",
    problem: "Sales-floor RTU locked out during afternoon peak with indoor temperature at 82°F.",
    scope: "Diagnose the lockout, restore cooling if safely possible and report any major component requirement.",
    priority: "emergency",
    source: "employee_request",
    fulfillmentMode: "external",
    vendorId: "vendor-summit-refrigeration",
    status: "onsite",
    ageDays: 0,
    spendMinor: 680_000,
    nteMinor: 850_000,
    invoice: false,
    visitCount: 1,
    missingCheckout: true,
  },
];

const workSpecs = [...baseWorkSpecs, ...pmWorkSpecs, ...specialWorkSpecs];

const terminalStatuses = new Set<WorkStatus>(["closed", "cancelled"]);
const completedStatuses = new Set<WorkStatus>(["completed", "awaiting_invoice", "invoice_received", "closed"]);
const visitStatuses = new Set<WorkStatus>(["onsite", "waiting_parts", "unresolved", "completed", "awaiting_invoice", "invoice_received", "closed"]);

const workOrderNumberBySlug = new Map<string, string>();
workSpecs.forEach((spec, index) => {
  workOrderNumberBySlug.set(spec.slug, `NLM-2026-${String(index + 1).padStart(4, "0")}`);
});

export const demoRequests: ServiceRequest[] = workSpecs.flatMap((spec, index) => {
  if (spec.source !== "employee_request") return [];
  const requestId = `request-${spec.slug}`;
  const hasPhoto = index % 3 === 0;
  return [{
    id: requestId,
    organizationId: DEMO_ORGANIZATION_ID,
    storeId: spec.store.id,
    workOrderId: `wo-${spec.slug}`,
    submittedByPersonId: `person-employee-${spec.store.storeNumber}`,
    submittedAt: daysAgo(spec.ageDays, -1),
    immutableDescription: spec.problem,
    reportedLocation: spec.assetSlug === "beer-cave" ? "Beer cave" : spec.assetSlug === "rtu-1" ? "Sales floor / rooftop unit" : "Store property",
    urgency: spec.priority,
    categoryHint: spec.categoryKey?.replaceAll("_", " "),
    attachmentDocumentIds: hasPhoto ? [`document-request-${spec.slug}-photo`] : [],
    reviewStatus: "converted",
  }];
});

export const demoWorkOrders: WorkOrder[] = workSpecs.map((spec, index) => {
  const createdAt = daysAgo(spec.ageDays);
  const isCompleted = completedStatuses.has(spec.status);
  const isClosed = spec.status === "closed";
  const categoryId = spec.categoryKey ? categoryIdByKey[spec.categoryKey] : undefined;
  const deepAssetId = spec.assetSlug ? assetId(spec.store, spec.assetSlug) : undefined;
  const deepComponentId = spec.assetSlug && spec.componentSlug
    ? assetComponentId(spec.store, spec.assetSlug, spec.componentSlug)
    : undefined;
  const expectedPartyType = spec.vendorId ? "vendor" : spec.internalPartyId?.startsWith("team-") ? "team" : "person";
  const expectedPartyId = spec.vendorId ?? spec.internalPartyId ?? "team-facilities-coordination";
  const defaultNte = spec.nteMinor ?? (spec.vendorId ? Math.ceil((spec.spendMinor * 1.2) / 10_000) * 10_000 : undefined);
  return {
    id: `wo-${spec.slug}`,
    organizationId: DEMO_ORGANIZATION_ID,
    number: workOrderNumberBySlug.get(spec.slug)!,
    storeId: spec.store.id,
    requestId: spec.source === "employee_request" ? `request-${spec.slug}` : undefined,
    pmOccurrenceId: spec.pmOccurrenceId,
    categoryId,
    taxonomyNodeId: spec.taxonomyNodeId,
    assetId: deepAssetId,
    componentId: deepComponentId,
    title: spec.title,
    problemDescription: spec.problem,
    scopeOfWork: spec.scope,
    priority: spec.priority,
    source: spec.source,
    fulfillmentMode: spec.fulfillmentMode,
    status: spec.status,
    createdByPersonId: spec.source === "employee_request" ? "person-dana-brooks" : spec.internalPartyId ? "person-dana-brooks" : spec.store.managerPersonId,
    createdAt,
    requestedWindow: {
      startsAt: shiftHours(createdAt, spec.priority === "emergency" ? 1 : 8),
      endsAt: shiftHours(createdAt, spec.priority === "emergency" ? 6 : spec.priority === "urgent" ? 24 : 72),
    },
    scheduledWindow: ["accepted", "scheduled", "onsite", "waiting_parts", "unresolved", "completed", "awaiting_invoice", "invoice_received", "closed"].includes(spec.status)
      ? { startsAt: shiftHours(createdAt, 22), endsAt: shiftHours(createdAt, 28) }
      : undefined,
    accountable: terminalStatuses.has(spec.status) ? undefined : {
      partyType: expectedPartyType,
      partyId: expectedPartyId,
      nextAction: spec.status === "waiting_parts"
        ? "Confirm parts ETA and return date"
        : spec.status === "awaiting_invoice"
          ? "Submit or link vendor invoice"
          : spec.status === "onsite"
            ? "Complete work and check out"
            : spec.status === "unresolved"
              ? "Review diagnosis and choose next action"
              : spec.status === "awaiting_vendor_response"
                ? "Accept or decline the service authorization"
                : "Advance the work order",
      dueAt: spec.status === "waiting_parts" || spec.status === "unresolved" ? daysAgo(1) : shiftHours(DEMO_NOW, 24 + (index % 3) * 24),
      escalationPartyId: "person-dana-brooks",
    },
    notToExceedMinor: defaultNte,
    currency: "USD",
    outcome: isCompleted || ["waiting_parts", "unresolved"].includes(spec.status) ? spec.outcome : undefined,
    completedAt: isCompleted ? shiftHours(createdAt, 30 + (spec.visitCount ?? 1) * 3) : undefined,
    closedAt: isClosed ? shiftHours(createdAt, 96) : undefined,
    classificationDeferred: spec.classificationDeferred ?? false,
    tags: [spec.priority, spec.source, spec.categoryKey ?? "classify-later"],
  };
});

const assignmentStatusForWork = (status: WorkStatus): WorkAssignment["status"] => {
  if (["closed", "completed", "awaiting_invoice", "invoice_received"].includes(status)) return "completed";
  if (["onsite", "waiting_parts", "unresolved"].includes(status)) return "active";
  if (["accepted", "scheduled"].includes(status)) return "accepted";
  if (["issued", "awaiting_vendor_response"].includes(status)) return "offered";
  return "acknowledged";
};

export const demoAssignments: WorkAssignment[] = workSpecs.flatMap((spec) => {
  const workOrderId = `wo-${spec.slug}`;
  const assignedAt = shiftHours(daysAgo(spec.ageDays), 1);
  const status = assignmentStatusForWork(spec.status);
  const assignments: WorkAssignment[] = [];
  if (spec.internalPartyId) {
    assignments.push({
      id: `assignment-${spec.slug}-internal`,
      organizationId: DEMO_ORGANIZATION_ID,
      workOrderId,
      partyType: spec.internalPartyId.startsWith("team-") ? "team" : "person",
      partyId: spec.internalPartyId,
      status,
      assignedAt,
      acknowledgedAt: shiftHours(assignedAt, 1),
      completedAt: status === "completed" ? shiftHours(assignedAt, 30) : undefined,
      assignmentNote: spec.fulfillmentMode === "blended" ? "Complete first-look inspection before vendor service." : "Complete the work within the requested window.",
    });
  }
  if (spec.vendorId) {
    assignments.push({
      id: `assignment-${spec.slug}-vendor`,
      organizationId: DEMO_ORGANIZATION_ID,
      workOrderId,
      partyType: "vendor",
      partyId: spec.vendorId,
      status,
      assignedAt,
      acknowledgedAt: status === "offered" ? undefined : shiftHours(assignedAt, 2),
      completedAt: status === "completed" ? shiftHours(assignedAt, 34) : undefined,
      assignmentNote: "Customer work-order number must be included on service documentation and invoice.",
    });
  }
  return assignments;
});

const vendorPrefix: Record<string, string> = {
  "vendor-summit-refrigeration": "SUM",
  "vendor-cedar-mechanical": "CED",
  "vendor-forecourt-systems": "FSG",
  "vendor-brightpath-electrical": "BPE",
  "vendor-four-seasons-site": "FSS",
};

export const demoVendorIssuances: VendorIssuance[] = workSpecs.flatMap((spec, index) => {
  if (!spec.vendorId) return [];
  const createdAt = daysAgo(spec.ageDays);
  const assignmentId = `assignment-${spec.slug}-vendor`;
  const vendor = demoVendors.find((candidate) => candidate.id === spec.vendorId)!;
  const contact = vendor.contacts.find((candidate) => candidate.role === "dispatch")!;
  const responsePending = ["issued", "awaiting_vendor_response"].includes(spec.status);
  const base: VendorIssuance = {
    id: `issuance-${spec.slug}-v1`,
    organizationId: DEMO_ORGANIZATION_ID,
    workOrderId: `wo-${spec.slug}`,
    vendorId: spec.vendorId,
    assignmentId,
    version: 1,
    issuedAt: shiftHours(createdAt, 1.25),
    issuedByPersonId: "person-dana-brooks",
    channels: ["email", "sms"],
    recipientContactIds: [contact.id],
    deliveryStatus: "delivered",
    viewedAt: responsePending && spec.status === "issued" ? undefined : shiftHours(createdAt, 1.75),
    response: responsePending ? undefined : "accepted",
    respondedAt: responsePending ? undefined : shiftHours(createdAt, 2.2),
    proposedArrivalAt: responsePending ? undefined : shiftHours(createdAt, 22),
    vendorReference: `${vendorPrefix[spec.vendorId]}-26-${String(index + 701).padStart(4, "0")}`,
    customerBillingInstruction: `Include customer work order ${workOrderNumberBySlug.get(spec.slug)} on all invoices and service documentation.`,
    scopeSnapshot: spec.scope,
    notToExceedMinor: spec.reissued && spec.nteMinor
      ? Math.round(spec.nteMinor * 0.6)
      : spec.nteMinor ?? Math.ceil((spec.spendMinor * 1.2) / 10_000) * 10_000,
    currency: "USD",
  };
  if (!spec.reissued) return [base];
  return [
    base,
    {
      ...base,
      id: `issuance-${spec.slug}-v2`,
      version: 2,
      issuedAt: shiftHours(createdAt, 4),
      viewedAt: shiftHours(createdAt, 4.2),
      respondedAt: shiftHours(createdAt, 4.5),
      scopeSnapshot: `${spec.scope} Amendment: authorization increased after compressor electrical testing.`,
      notToExceedMinor: spec.nteMinor,
    },
  ];
});

const vendorTechnician: Record<string, [string, string]> = {
  "vendor-summit-refrigeration": ["Marcus Hill", "SUM-TECH-041"],
  "vendor-cedar-mechanical": ["Elena Torres", "CED-TECH-118"],
  "vendor-forecourt-systems": ["Ryan Patel", "FSG-TECH-209"],
  "vendor-brightpath-electrical": ["Chris Brennan", "BPE-TECH-077"],
  "vendor-four-seasons-site": ["Luis Ortega", "FSS-TECH-315"],
};

export const demoVisits: Visit[] = workSpecs.flatMap((spec, specIndex) => {
  if (!visitStatuses.has(spec.status)) return [];
  const count = Math.max(spec.visitCount ?? 1, spec.fulfillmentMode === "blended" ? 2 : 1);
  const createdAt = daysAgo(spec.ageDays);
  return Array.from({ length: count }, (_, visitIndex) => {
    const useInternal = spec.fulfillmentMode === "internal" || (spec.fulfillmentMode === "blended" && visitIndex === 0);
    const vendorId = useInternal ? undefined : spec.vendorId;
    const [technicianName, technicianIdentifier] = vendorId
      ? vendorTechnician[vendorId]
      : visitIndex % 2 === 0
        ? ["Noah Bennett", "E0041"]
        : ["Priya Shah", "E0042"];
    const checkedInAt = spec.status === "onsite"
      ? daysAgo(0, -1.3)
      : shiftHours(createdAt, 24 + visitIndex * 46);
    const missingCheckout = spec.missingCheckout && visitIndex === count - 1;
    const channelStarted: Visit["channelStarted"] = useInternal
      ? "secure_work_link"
      : (["qr_mobile_web", "vendor_app", "store_kiosk"] as const)[(specIndex + visitIndex) % 3];
    const outside = Boolean(spec.outsideGeofence && visitIndex === 0);
    const reportedArrivalAt = spec.reportedArrival && visitIndex === 0 ? shiftHours(checkedInAt, -1) : undefined;
    const visitId = `visit-${spec.slug}-${visitIndex + 1}`;
    return {
      id: visitId,
      organizationId: DEMO_ORGANIZATION_ID,
      storeId: spec.store.id,
      workOrderId: `wo-${spec.slug}`,
      vendorId,
      internalPersonId: useInternal ? (visitIndex % 2 === 0 ? "person-noah-bennett" : "person-priya-shah") : undefined,
      technicianName,
      technicianIdentifier,
      channelStarted,
      channelEnded: missingCheckout ? undefined : visitIndex % 2 === 0 ? "qr_mobile_web" : channelStarted,
      checkedInAt,
      checkedOutAt: missingCheckout ? undefined : shiftHours(checkedInAt, 1.25 + ((specIndex + visitIndex) % 5) * 0.45),
      reportedArrivalAt,
      evidenceStrength: outside ? "manual_unverified" : channelStarted === "store_kiosk" ? "store_kiosk" : "location_verified",
      locationEvidence: {
        required: channelStarted !== "store_kiosk",
        consented: channelStarted !== "store_kiosk",
        capturedAt: channelStarted !== "store_kiosk" ? checkedInAt : undefined,
        coordinates: channelStarted !== "store_kiosk" ? {
          latitude: spec.store.coordinates.latitude + (outside ? 0.021 : 0.00008),
          longitude: spec.store.coordinates.longitude + (outside ? 0.017 : -0.00005),
        } : undefined,
        accuracyMeters: channelStarted !== "store_kiosk" ? 18 + ((specIndex + visitIndex) % 14) : undefined,
        distanceFromStoreMeters: channelStarted !== "store_kiosk" ? (outside ? 2_640 : 14 + ((specIndex + visitIndex) % 35)) : undefined,
        verification: channelStarted === "store_kiosk" ? "not_collected" : outside ? "outside_geofence" : "inside_geofence",
      },
      outcome: missingCheckout ? undefined : visitIndex < count - 1 ? "diagnosed_waiting_parts" : spec.outcome ?? "resolved",
      checkoutNote: missingCheckout
        ? undefined
        : visitIndex < count - 1
          ? "Diagnosis completed; return visit required after parts arrive."
          : spec.outcome === "preventive_complete"
            ? "Checklist completed and final operating readings documented."
            : "Work completed; equipment observed operating normally at departure.",
      documentIds: missingCheckout ? [] : [`document-${visitId}-ticket`, `document-${visitId}-after`],
    } satisfies Visit;
  });
});

const unmatchedVisit: Visit = {
  id: "visit-unmatched-207-sign-repair",
  organizationId: DEMO_ORGANIZATION_ID,
  storeId: "store-207",
  vendorId: "vendor-brightpath-electrical",
  technicianName: "Chris Brennan",
  technicianIdentifier: "BPE-TECH-077",
  purposeWhenUnmatched: "Investigate flickering monument sign after a vendor-office phone request; technician did not receive a Northline work-order number.",
  channelStarted: "qr_mobile_web",
  channelEnded: "qr_mobile_web",
  checkedInAt: daysAgo(2, -2),
  checkedOutAt: daysAgo(2, 0.2),
  evidenceStrength: "location_verified",
  locationEvidence: {
    required: true,
    consented: true,
    capturedAt: daysAgo(2, -2),
    coordinates: { latitude: 39.89635, longitude: -83.80886 },
    accuracyMeters: 21,
    distanceFromStoreMeters: 9,
    verification: "inside_geofence",
  },
  outcome: "unresolved",
  checkoutNote: "Ballast and water intrusion found; vendor office will send quote.",
  documentIds: ["document-visit-unmatched-207-sign-repair-ticket"],
};
demoVisits.push(unmatchedVisit);

function splitInvoiceLines(spec: WorkSeedSpec, invoiceId: string): InvoiceLineItem[] {
  const labor = Math.round(spec.spendMinor * 0.58);
  const materials = Math.round(spec.spendMinor * 0.32);
  const trip = spec.spendMinor - labor - materials;
  const workOrderId = `wo-${spec.slug}`;
  return [
    { id: `${invoiceId}-line-labor`, workOrderId, description: "Onsite diagnostic and repair labor", costType: "labor", quantity: 1, unitAmountMinor: labor, amountMinor: labor },
    { id: `${invoiceId}-line-materials`, workOrderId, description: "Parts and consumable materials", costType: "materials", quantity: 1, unitAmountMinor: materials, amountMinor: materials },
    { id: `${invoiceId}-line-trip`, workOrderId, description: "Service call / vehicle charge", costType: "trip", quantity: 1, unitAmountMinor: trip, amountMinor: trip },
  ];
}

const invoiceSpecs = workSpecs.filter((spec) => spec.invoice && spec.vendorId);

export const demoInvoices: Invoice[] = invoiceSpecs.map((spec, index) => {
  const invoiceId = `invoice-${spec.slug}`;
  const workOrderNumber = workOrderNumberBySlug.get(spec.slug)!;
  const invoiceNumber = spec.duplicateInvoiceReference ?? (spec.slug === "104-refrigeration-main" ? "SUM-260187" : `${vendorPrefix[spec.vendorId!]}-26-${String(170 + index).padStart(4, "0")}`);
  return {
    id: invoiceId,
    organizationId: DEMO_ORGANIZATION_ID,
    vendorId: spec.vendorId!,
    invoiceNumber,
    customerWorkOrderReferences: spec.invoiceMissingReference ? [] : [workOrderNumber],
    vendorServiceReferences: [`${vendorPrefix[spec.vendorId!]}-26-${String(workSpecs.indexOf(spec) + 701).padStart(4, "0")}`],
    invoiceDate: dateOnly(shiftHours(daysAgo(spec.ageDays), 78)),
    receivedAt: shiftHours(daysAgo(spec.ageDays), 84),
    status: spec.invoiceOverNte || spec.invoiceMissingReference || Boolean(spec.duplicateInvoiceReference) ? "needs_review" : index % 4 === 0 ? "approved" : "received",
    currency: "USD",
    lineItems: splitInvoiceLines(spec, invoiceId),
    documentId: `document-${invoiceId}`,
  };
});

export const demoInvoiceWorkLinks: InvoiceWorkLink[] = demoInvoices.map((invoice) => {
  const spec = invoiceSpecs.find((candidate) => `invoice-${candidate.slug}` === invoice.id)!;
  const workOrder = demoWorkOrders.find((candidate) => candidate.id === `wo-${spec.slug}`)!;
  return {
    id: `invoice-link-${spec.slug}`,
    organizationId: DEMO_ORGANIZATION_ID,
    invoiceId: invoice.id,
    workOrderId: workOrder.id,
    storeId: workOrder.storeId,
    categoryId: workOrder.categoryId,
    assetId: workOrder.assetId,
    attributedAmountMinor: invoice.lineItems.reduce((sum, line) => sum + line.amountMinor, 0),
    currency: "USD",
    matchMethod: spec.invoiceMissingReference ? "suggested" : "work_order_reference",
    matchStatus: spec.invoiceMissingReference || spec.invoiceOverNte || Boolean(spec.duplicateInvoiceReference) ? "review_needed" : "matched",
    linkedAt: shiftHours(invoice.receivedAt, 1),
    linkedByPersonId: spec.invoiceMissingReference ? "person-evan-rhodes" : "person-dana-brooks",
  };
});

export const demoCostLines: CostLine[] = workSpecs.flatMap((spec) => {
  const workOrderId = `wo-${spec.slug}`;
  const categoryId = spec.categoryKey ? categoryIdByKey[spec.categoryKey] : undefined;
  const deepAssetId = spec.assetSlug ? assetId(spec.store, spec.assetSlug) : undefined;
  const createdAt = daysAgo(spec.ageDays);
  const lines: CostLine[] = [
    {
      id: `cost-${spec.slug}-requested`,
      organizationId: DEMO_ORGANIZATION_ID,
      workOrderId,
      storeId: spec.store.id,
      categoryId,
      assetId: deepAssetId,
      vendorId: spec.vendorId,
      basis: "requested",
      costType: "miscellaneous",
      description: "Initial service estimate for planning",
      amountMinor: Math.max(5_000, Math.round(spec.spendMinor * 0.82)),
      currency: "USD",
      recordedAt: createdAt,
      source: "requester_estimate",
    },
  ];
  if (spec.vendorId) {
    lines.push({
      id: `cost-${spec.slug}-approved`,
      organizationId: DEMO_ORGANIZATION_ID,
      workOrderId,
      storeId: spec.store.id,
      categoryId,
      assetId: deepAssetId,
      vendorId: spec.vendorId,
      basis: "approved",
      costType: "miscellaneous",
      description: "Current service authorization / not-to-exceed amount",
      amountMinor: spec.nteMinor ?? Math.ceil((spec.spendMinor * 1.2) / 10_000) * 10_000,
      currency: "USD",
      recordedAt: shiftHours(createdAt, spec.reissued ? 4 : 1),
      source: "manager_authorization",
    });
  }
  if (completedStatuses.has(spec.status)) {
    const latestCompletedVisit = demoVisits
      .filter((visit) => visit.workOrderId === workOrderId && visit.checkedOutAt)
      .sort((left, right) => right.checkedOutAt!.localeCompare(left.checkedOutAt!))[0];
    lines.push({
      id: `cost-${spec.slug}-recorded`,
      organizationId: DEMO_ORGANIZATION_ID,
      workOrderId,
      storeId: spec.store.id,
      categoryId,
      assetId: deepAssetId,
      vendorId: spec.vendorId,
      basis: "recorded",
      costType: spec.fulfillmentMode === "internal" ? "labor" : "miscellaneous",
      description: spec.fulfillmentMode === "internal"
        ? "Manager-recorded internal labor and materials for completed work"
        : "Manager-recorded completed-work cost from the vendor service record",
      amountMinor: spec.spendMinor,
      currency: "USD",
      recordedAt: latestCompletedVisit?.checkedOutAt ?? shiftHours(createdAt, 36),
      source: "internal_entry",
    });
  }
  return lines;
});

const requestDocuments: EvidenceDocument[] = demoRequests.flatMap((request) => request.attachmentDocumentIds.map((documentId) => ({
  id: documentId,
  organizationId: DEMO_ORGANIZATION_ID,
  storeId: request.storeId,
  workOrderId: request.workOrderId,
  kind: "request_photo" as const,
  fileName: `${request.id}-reported-condition.jpg`,
  mediaType: "image/jpeg",
  createdAt: request.submittedAt,
  createdByLabel: "Store employee",
  visibility: "engagement_parties" as const,
})));

const visitDocuments: EvidenceDocument[] = demoVisits.flatMap((visit) => visit.documentIds.map((documentId, index) => ({
  id: documentId,
  organizationId: DEMO_ORGANIZATION_ID,
  storeId: visit.storeId,
  workOrderId: visit.workOrderId,
  visitId: visit.id,
  kind: index === 0 ? "service_ticket" as const : "after_photo" as const,
  fileName: index === 0 ? `${visit.id}-service-ticket.pdf` : `${visit.id}-after.jpg`,
  mediaType: index === 0 ? "application/pdf" : "image/jpeg",
  createdAt: visit.checkedOutAt ?? visit.checkedInAt,
  createdByLabel: visit.technicianName,
  visibility: "engagement_parties" as const,
})));

const invoiceDocuments: EvidenceDocument[] = demoInvoices.map((invoice) => {
  const link = demoInvoiceWorkLinks.find((candidate) => candidate.invoiceId === invoice.id);
  return {
    id: invoice.documentId,
    organizationId: DEMO_ORGANIZATION_ID,
    storeId: link?.storeId,
    workOrderId: link?.workOrderId,
    invoiceId: invoice.id,
    kind: "invoice",
    fileName: `${invoice.invoiceNumber}.pdf`,
    mediaType: "application/pdf",
    createdAt: invoice.receivedAt,
    createdByLabel: demoVendors.find((vendor) => vendor.id === invoice.vendorId)?.displayName ?? "Vendor",
    visibility: "operator_only",
  };
});

export const demoDocuments: EvidenceDocument[] = [...requestDocuments, ...visitDocuments, ...invoiceDocuments];

const pmExceptions: ExceptionRecord[] = demoPmOccurrences
  .filter((occurrence) => occurrence.status === "overdue")
  .map((occurrence, index) => {
    const plan = demoPmPlans.find((candidate) => candidate.id === occurrence.pmPlanId)!;
    const store = demoStores.find((candidate) => candidate.id === occurrence.storeId)!;
    return {
      id: `exception-pm-${occurrence.id}`,
      organizationId: DEMO_ORGANIZATION_ID,
      type: "pm_overdue",
      severity: index % 3 === 0 ? "warning" : "info",
      status: "open",
      title: `${plan.name} is overdue`,
      description: `${store.name} missed the scheduled due date; the original due time remains visible.`,
      storeId: store.id,
      assetId: plan.assetId,
      sourceRecordIds: [plan.id, occurrence.id],
      assignedPersonId: "person-dana-brooks",
      openedAt: occurrence.dueAt,
      dueAt: shiftHours(occurrence.dueAt, 48),
    } satisfies ExceptionRecord;
  });

const overNteSpec = workSpecs.find((spec) => spec.invoiceOverNte)!;
const missingReferenceSpec = workSpecs.find((spec) => spec.invoiceMissingReference)!;
const duplicateInvoices = demoInvoices.filter((invoice) => invoice.invoiceNumber === "SUM-260187");
const missingCheckoutVisit = demoVisits.find((visit) => !visit.checkedOutAt)!;
const outsideVisit = demoVisits.find((visit) => visit.locationEvidence.verification === "outside_geofence")!;
const unclassifiedWork = demoWorkOrders.find((workOrder) => workOrder.classificationDeferred)!;

export const demoExceptions: ExceptionRecord[] = [
  ...pmExceptions,
  {
    id: "exception-invoice-over-nte-104",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "invoice_over_nte",
    severity: "critical",
    status: "open",
    title: "Invoice exceeds current authorization",
    description: `Invoice is $${((overNteSpec.spendMinor - (overNteSpec.nteMinor ?? 0)) / 100).toLocaleString("en-US")} over the issued not-to-exceed amount. Review the amendment and supporting work before approval.`,
    storeId: overNteSpec.store.id,
    workOrderId: `wo-${overNteSpec.slug}`,
    invoiceId: `invoice-${overNteSpec.slug}`,
    assetId: assetId(overNteSpec.store, overNteSpec.assetSlug!),
    vendorId: overNteSpec.vendorId,
    sourceRecordIds: [`wo-${overNteSpec.slug}`, `invoice-${overNteSpec.slug}`, `issuance-${overNteSpec.slug}-v2`],
    assignedPersonId: "person-evan-rhodes",
    openedAt: shiftHours(daysAgo(overNteSpec.ageDays), 85),
    dueAt: shiftHours(DEMO_NOW, 24),
  },
  {
    id: "exception-invoice-missing-work-order-207",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "invoice_missing_work_order",
    severity: "warning",
    status: "open",
    title: "Invoice omits the customer work-order number",
    description: "Vendor, store and service date suggest a likely match, but a finance reviewer must confirm it.",
    storeId: missingReferenceSpec.store.id,
    workOrderId: `wo-${missingReferenceSpec.slug}`,
    invoiceId: `invoice-${missingReferenceSpec.slug}`,
    vendorId: missingReferenceSpec.vendorId,
    sourceRecordIds: [`invoice-${missingReferenceSpec.slug}`, `wo-${missingReferenceSpec.slug}`],
    assignedPersonId: "person-evan-rhodes",
    openedAt: shiftHours(daysAgo(missingReferenceSpec.ageDays), 85),
    dueAt: shiftHours(DEMO_NOW, 48),
  },
  {
    id: "exception-duplicate-invoice-reference",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "duplicate_invoice_reference",
    severity: "critical",
    status: "open",
    title: "Duplicate vendor invoice reference",
    description: "Summit Refrigeration used SUM-260187 on both the initial compressor service and its callback invoice. Review whether the vendor reused the reference or a duplicate was entered; this is not a payment decision.",
    vendorId: "vendor-summit-refrigeration",
    sourceRecordIds: duplicateInvoices.map((invoice) => invoice.id),
    assignedPersonId: "person-evan-rhodes",
    openedAt: daysAgo(4),
    dueAt: shiftHours(DEMO_NOW, 24),
  },
  {
    id: "exception-repeat-repair-store-104-beer-cave",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "repeat_repair",
    severity: "critical",
    status: "acknowledged",
    title: "Store 104 original beer cave compressor had repeat failures",
    description: "Three corrective work orders in a 21-day service sequence were classified to the original Primary Compressor: initial service, a six-day callback, and permanent replacement.",
    storeId: "store-104",
    assetId: "asset-104-beer-cave",
    vendorId: "vendor-summit-refrigeration",
    sourceRecordIds: ["wo-104-refrigeration-main", "wo-104-refrigeration-callback-1", "wo-104-refrigeration-compressor-replacement"],
    assignedPersonId: "person-dana-brooks",
    openedAt: daysAgo(8),
    dueAt: shiftHours(DEMO_NOW, 72),
  },
  {
    id: "exception-warranty-review-store-201",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "warranty_review",
    severity: "warning",
    status: "open",
    title: "Refrigeration work may fall within warranty",
    description: "The Store 201 beer cave warranty remains active. Confirm coverage before approving non-warranty parts.",
    storeId: "store-201",
    workOrderId: "wo-201-refrigeration-main",
    assetId: "asset-201-beer-cave",
    vendorId: "vendor-summit-refrigeration",
    sourceRecordIds: ["asset-201-beer-cave", "wo-201-refrigeration-main"],
    assignedPersonId: "person-dana-brooks",
    openedAt: daysAgo(6),
    dueAt: shiftHours(DEMO_NOW, 48),
  },
  {
    id: "exception-unmatched-visit-207",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "visit_without_work_order",
    severity: "warning",
    status: "open",
    title: "Vendor visit needs a work-order match",
    description: "BrightPath checked in for monument-sign work without a Northline work-order number.",
    storeId: unmatchedVisit.storeId,
    visitId: unmatchedVisit.id,
    vendorId: unmatchedVisit.vendorId,
    sourceRecordIds: [unmatchedVisit.id],
    assignedPersonId: "person-dana-brooks",
    openedAt: unmatchedVisit.checkedOutAt!,
    dueAt: shiftHours(DEMO_NOW, 24),
  },
  {
    id: "exception-missing-checkout-315",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "missing_checkout",
    severity: "warning",
    status: "open",
    title: "Technician remains checked in",
    description: "The active visit has no checkout. Confirm whether the technician remains onsite before making any correction.",
    storeId: missingCheckoutVisit.storeId,
    workOrderId: missingCheckoutVisit.workOrderId,
    visitId: missingCheckoutVisit.id,
    vendorId: missingCheckoutVisit.vendorId,
    sourceRecordIds: [missingCheckoutVisit.id],
    assignedPersonId: "person-dana-brooks",
    openedAt: shiftHours(missingCheckoutVisit.checkedInAt, 4),
    dueAt: shiftHours(missingCheckoutVisit.checkedInAt, 6),
  },
  {
    id: "exception-outside-geofence-204",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "outside_geofence",
    severity: "warning",
    status: "acknowledged",
    title: "Visit location could not be verified",
    description: "The captured point was outside the store geofence. The visit remains recorded and visibly unverified.",
    storeId: outsideVisit.storeId,
    workOrderId: outsideVisit.workOrderId,
    visitId: outsideVisit.id,
    vendorId: outsideVisit.vendorId,
    sourceRecordIds: [outsideVisit.id],
    assignedPersonId: "person-dana-brooks",
    openedAt: outsideVisit.checkedInAt,
    dueAt: shiftHours(outsideVisit.checkedInAt, 24),
  },
  {
    id: "exception-classification-store-112",
    organizationId: DEMO_ORGANIZATION_ID,
    type: "classification_incomplete",
    severity: "info",
    status: "open",
    title: "Classify the rear-cooler water issue",
    description: "Work was allowed to begin at store level. Category and equipment can be added after diagnosis.",
    storeId: unclassifiedWork.storeId,
    workOrderId: unclassifiedWork.id,
    sourceRecordIds: [unclassifiedWork.id],
    assignedPersonId: "person-dana-brooks",
    openedAt: unclassifiedWork.createdAt,
    dueAt: shiftHours(DEMO_NOW, 48),
  },
  ...demoWorkOrders
    .filter((workOrder) => workOrder.status === "waiting_parts" || workOrder.status === "unresolved")
    .map((workOrder) => ({
      id: `exception-follow-up-${workOrder.id}`,
      organizationId: DEMO_ORGANIZATION_ID,
      type: "follow_up_overdue" as const,
      severity: workOrder.priority === "emergency" ? "critical" as const : "warning" as const,
      status: "open" as const,
      title: `${workOrder.number} needs a next-step update`,
      description: workOrder.accountable?.nextAction ?? "An accountable follow-up remains open.",
      storeId: workOrder.storeId,
      workOrderId: workOrder.id,
      assetId: workOrder.assetId,
      sourceRecordIds: [workOrder.id],
      assignedPersonId: "person-dana-brooks",
      openedAt: workOrder.accountable?.dueAt ?? workOrder.createdAt,
      dueAt: workOrder.accountable?.dueAt ?? shiftHours(workOrder.createdAt, 24),
    })),
];

const auditEvents: AuditEvent[] = [];

for (const workOrder of demoWorkOrders) {
  auditEvents.push({
    id: `audit-${workOrder.id}-created`,
    organizationId: DEMO_ORGANIZATION_ID,
    entityType: "work_order",
    entityId: workOrder.id,
    eventType: "work.created",
    actorType: "person",
    actorId: workOrder.createdByPersonId,
    channel: "manager_web",
    occurredAt: workOrder.createdAt,
    summary: `${workOrder.number} created in Demo Mode`,
    payloadSnapshot: {
      number: workOrder.number,
      status: workOrder.status,
      storeId: workOrder.storeId,
      assetId: workOrder.assetId ?? null,
      componentId: workOrder.componentId ?? null,
      classificationDeferred: workOrder.classificationDeferred,
    },
    demoMode: true,
  });
}

for (const issuance of demoVendorIssuances) {
  auditEvents.push({
    id: `audit-${issuance.id}-issued`,
    organizationId: DEMO_ORGANIZATION_ID,
    entityType: "vendor_issuance",
    entityId: issuance.id,
    eventType: issuance.version === 1 ? "vendor_issuance.sent" : "vendor_issuance.amended",
    actorType: "person",
    actorId: issuance.issuedByPersonId,
    channel: "manager_web",
    occurredAt: issuance.issuedAt,
    summary: `Service authorization version ${issuance.version} sent to vendor`,
    payloadSnapshot: { workOrderId: issuance.workOrderId, vendorId: issuance.vendorId, version: issuance.version, nteMinor: issuance.notToExceedMinor ?? null },
    demoMode: true,
  });
}

for (const visit of demoVisits) {
  auditEvents.push({
    id: `audit-${visit.id}-checkin`,
    organizationId: DEMO_ORGANIZATION_ID,
    entityType: "visit",
    entityId: visit.id,
    eventType: "visit.checked_in",
    actorType: visit.vendorId ? "technician" : "person",
    actorId: visit.internalPersonId,
    channel: visit.channelStarted === "store_kiosk" ? "kiosk" : visit.channelStarted === "qr_mobile_web" ? "qr" : "vendor_app",
    occurredAt: visit.checkedInAt,
    summary: `${visit.technicianName} checked in`,
    payloadSnapshot: { storeId: visit.storeId, workOrderId: visit.workOrderId ?? null, evidenceStrength: visit.evidenceStrength },
    demoMode: true,
  });
  if (visit.checkedOutAt) {
    auditEvents.push({
      id: `audit-${visit.id}-checkout`,
      organizationId: DEMO_ORGANIZATION_ID,
      entityType: "visit",
      entityId: visit.id,
      eventType: "visit.checked_out",
      actorType: visit.vendorId ? "technician" : "person",
      actorId: visit.internalPersonId,
      channel: visit.channelEnded === "store_kiosk" ? "kiosk" : visit.channelEnded === "qr_mobile_web" ? "qr" : "vendor_app",
      occurredAt: visit.checkedOutAt,
      summary: `${visit.technicianName} checked out`,
      payloadSnapshot: { outcome: visit.outcome ?? null, documentCount: visit.documentIds.length },
      demoMode: true,
    });
  }
}

for (const invoice of demoInvoices) {
  auditEvents.push({
    id: `audit-${invoice.id}-received`,
    organizationId: DEMO_ORGANIZATION_ID,
    entityType: "invoice",
    entityId: invoice.id,
    eventType: "invoice.received",
    actorType: "system",
    channel: "system",
    occurredAt: invoice.receivedAt,
    summary: `${invoice.invoiceNumber} received in Demo Mode`,
    payloadSnapshot: { vendorId: invoice.vendorId, status: invoice.status, lineCount: invoice.lineItems.length },
    demoMode: true,
  });
}

for (const exception of demoExceptions) {
  auditEvents.push({
    id: `audit-${exception.id}-opened`,
    organizationId: DEMO_ORGANIZATION_ID,
    entityType: "exception",
    entityId: exception.id,
    eventType: "exception.opened",
    actorType: "system",
    channel: "system",
    occurredAt: exception.openedAt,
    summary: `${exception.title} opened in Demo Mode`,
    payloadSnapshot: { type: exception.type, severity: exception.severity, sourceCount: exception.sourceRecordIds.length },
    demoMode: true,
  });
}

const store104CompressorReplacementVisit = demoVisits
  .filter((visit) => visit.workOrderId === "wo-104-refrigeration-compressor-replacement" && visit.checkedOutAt)
  .sort((left, right) => right.checkedOutAt!.localeCompare(left.checkedOutAt!))[0];

auditEvents.push({
  id: "audit-asset-104-beer-cave-original-compressor-replaced",
  organizationId: DEMO_ORGANIZATION_ID,
  entityType: "asset",
  entityId: "asset-104-beer-cave",
  eventType: "asset.component_replaced",
  actorType: "person",
  actorId: "person-dana-brooks",
  channel: "manager_web",
  occurredAt: store104CompressorReplacementVisit?.checkedOutAt ?? shiftHours(daysAgo(96), 72),
  summary: "Original beer cave compressor replaced and successor component installed",
  payloadSnapshot: {
    workOrderId: "wo-104-refrigeration-compressor-replacement",
    replacedComponentId: "component-104-beer-cave-comp-1",
    replacementComponentId: "component-104-beer-cave-comp-2",
    installedOn: "2026-05-09",
  },
  demoMode: true,
});

export const demoAuditEvents = auditEvents;

export const demoData: DemoDataset = {
  asOf: DEMO_NOW,
  organization: demoOrganization,
  divisions: demoDivisions,
  regions: demoRegions,
  stores: demoStores,
  categories: demoCategories,
  taxonomyNodes: demoTaxonomyNodes,
  assets: demoAssets,
  assetComponents: demoAssetComponents,
  people: demoPeople,
  teams: demoTeams,
  vendors: demoVendors,
  requests: demoRequests,
  workOrders: demoWorkOrders,
  assignments: demoAssignments,
  vendorIssuances: demoVendorIssuances,
  visits: demoVisits,
  costLines: demoCostLines,
  invoices: demoInvoices,
  invoiceWorkLinks: demoInvoiceWorkLinks,
  pmPlans: demoPmPlans,
  pmOccurrences: demoPmOccurrences,
  documents: demoDocuments,
  exceptions: demoExceptions,
  auditEvents: demoAuditEvents,
};
