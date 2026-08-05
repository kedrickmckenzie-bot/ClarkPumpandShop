import type {
  Asset,
  AuditEvent,
  Authorization,
  Component,
  CostAllocation,
  Credit,
  DemoData,
  DocumentRecord,
  EmployeeReport,
  FollowUp,
  Invoice,
  PmOccurrence,
  PmPlan,
  Quote,
  Region,
  ReportReview,
  ServiceCategory,
  ServiceVisit,
  Store,
  StoreSystem,
  Technician,
  Vendor,
  VendorResponse,
  WorkOrder,
  WorkOrderChecklistItem,
  WorkOrderNote,
  LaborEntry,
  PartUsage,
  WorkOrderStatus,
  WorkType,
} from "@/lib/domain/types";

export const DEMO_NOW = "2026-08-05T14:00:00.000Z";
export const STORY_WORK_ORDER_ID = "wo-0245";
export const STORY_REPORT_ID = "report-0671";
export const STORY_STORE_ID = "store-45";
export const STORY_SYSTEM_ID = "sys-45-ref";
export const STORY_ASSET_ID = "asset-45-ref-cu1";
export const STORY_COMPONENT_ID = "component-45-fan";
export const STORE_QR_TOKEN = "store_demo_45_Y8m4xB2p";
export const VENDOR_ACCEPT_TOKEN = "accept_demo_0245_K3p9nQ7w";

const regions: Region[] = [
  { id: "region-east", name: "Eastern Region" },
  { id: "region-central", name: "Central Region" },
  { id: "region-west", name: "Western Region" },
];

const baseStoreSeeds = [
  ["12", "Pine Valley", "region-east"],
  ["18", "Riverbend", "region-east"],
  ["23", "Oak Crossing", "region-east"],
  ["31", "Cedar Grove", "region-east"],
  ["38", "Lakeview", "region-east"],
  ["42", "Mill Creek", "region-central"],
  ["45", "North Ridge", "region-central"],
  ["51", "Maple Run", "region-central"],
  ["57", "Stonebridge", "region-central"],
  ["63", "Southgate", "region-central"],
  ["68", "Westfield", "region-west"],
  ["72", "Meadow Park", "region-west"],
  ["79", "Summit Point", "region-west"],
  ["84", "Hickory Lane", "region-west"],
  ["91", "Valley View", "region-west"],
] as const;

const expansionCities = [
  "Allegheny Heights", "Beaver Falls", "Butler Junction", "Canonsburg", "Carnegie", "Clarion", "Connellsville", "Cranberry", "Delmont", "DuBois",
  "East Liberty", "Ellwood City", "Erie South", "Franklin", "Greensburg", "Grove City", "Harmony", "Indiana", "Johnstown", "Kittanning",
  "Latrobe", "McKees Rocks", "Mercer", "Monroeville", "Murrysville", "New Castle", "Oil City", "Penn Hills", "Punxsutawney", "Robinson",
  "Sewickley", "Sharon", "Slippery Rock", "Somerset", "Tarentum", "Titusville", "Uniontown", "Vandergrift", "Warren", "Washington",
  "Waynesburg", "Wexford", "White Oak", "Wilkinsburg", "Zelienople", "Brookville", "Chambersburg", "Gettysburg", "Harrisburg West", "York North",
] as const;
const generatedStoreSeeds = expansionCities.map((city, index) => [String(101 + index), city, ["region-east", "region-central", "region-west"][index % 3]] as const);
const storeSeeds = [...baseStoreSeeds, ...generatedStoreSeeds];
const streetNames = ["Liberty Avenue", "Market Street", "State Route 8", "Main Street", "Commerce Drive", "Washington Pike", "Butler Road", "Broad Street"];

const stores: Store[] = storeSeeds.map(([code, city, regionId], index) => ({
  id: `store-${code}`,
  regionId,
  code,
  name: `Store ${code} - ${city}`,
  city,
  state: "PA",
  address1: `${110 + index * 17} ${streetNames[index % streetNames.length]}`,
  postalCode: String(15001 + ((index * 137) % 4998)).padStart(5, "0"),
  phone: `(724) 555-${String(1100 + index).slice(-4)}`,
  managerName: ["Jordan Lee", "Casey Wright", "Morgan Price", "Avery Scott", "Renee Foster", "Dylan Brooks"][index % 6],
  district: `District ${Math.floor(index / 8) + 1}`,
  status: index === 63 ? "opening" : "active",
  openedAt: `${2002 + (index % 23)}-${String((index % 9) + 1).padStart(2, "0")}-15`,
  squareFeet: 3_600 + (index % 7) * 450,
  latitude: 40.76 + index * 0.018,
  longitude: -80.18 + (index % 5) * 0.072,
  geofenceRadiusM: 200,
}));

const categories: ServiceCategory[] = [
  { id: "refrigeration", name: "Refrigeration", color: "#187c6d" },
  { id: "hvac", name: "HVAC", color: "#4e6f8e" },
  { id: "foodservice", name: "Foodservice Equipment", color: "#a96116" },
  { id: "plumbing", name: "Plumbing", color: "#2f6f9f" },
  { id: "electrical", name: "Electrical", color: "#8a6a12" },
  { id: "fuel", name: "Fuel & Forecourt", color: "#6d5d87" },
  { id: "building", name: "Building & Site", color: "#6f665e" },
  { id: "life-safety", name: "Life Safety", color: "#a33d32" },
];

const vendors: Vendor[] = [
  { id: "vendor-northstar", name: "NorthStar Mechanical Services", shortName: "NorthStar", trade: "HVAC & Refrigeration", dispatchEmail: "dispatch@northstar-demo.example", accent: "#116c5d" },
  { id: "vendor-keystone", name: "Keystone Climate Partners", shortName: "Keystone", trade: "HVAC", dispatchEmail: "service@keystone-demo.example", accent: "#496b8a" },
  { id: "vendor-valley", name: "Valley Refrigeration Group", shortName: "Valley", trade: "Refrigeration", dispatchEmail: "dispatch@valley-demo.example", accent: "#8c5c2e" },
  { id: "vendor-summit", name: "Summit Facility Service", shortName: "Summit", trade: "General facilities", dispatchEmail: "workorders@summit-demo.example", accent: "#685b86" },
  { id: "vendor-apex", name: "Apex Food Equipment Service", shortName: "Apex", trade: "Ovens, fryers & hot food", dispatchEmail: "dispatch@apex-demo.example", accent: "#a96116" },
  { id: "vendor-flowrite", name: "FlowRite Plumbing", shortName: "FlowRite", trade: "Plumbing", dispatchEmail: "service@flowrite-demo.example", accent: "#2f6f9f" },
  { id: "vendor-brightline", name: "BrightLine Electrical", shortName: "BrightLine", trade: "Electrical & controls", dispatchEmail: "dispatch@brightline-demo.example", accent: "#8a6a12" },
  { id: "vendor-forecourt", name: "Forecourt Systems Group", shortName: "FSG", trade: "Fuel systems", dispatchEmail: "service@forecourt-demo.example", accent: "#6d5d87" },
  { id: "vendor-safeguard", name: "SafeGuard Fire & Security", shortName: "SafeGuard", trade: "Fire and life safety", dispatchEmail: "dispatch@safeguard-demo.example", accent: "#a33d32" },
];

const systems: StoreSystem[] = stores.flatMap((store) => [
  {
    id: `sys-${store.code}-hvac`,
    storeId: store.id,
    categoryId: "hvac",
    name: "Store HVAC",
    type: "Comfort HVAC",
    code: `${store.code}-HVAC`,
    description: "Comfort heating, cooling and ventilation cost center.",
    location: "Roof and sales floor",
    glCode: "6100",
    annualBudgetCents: 1_800_000,
    ownerName: store.managerName,
    maintenanceStrategy: "preventive",
    state: store.code === "31" ? "watch" : "normal",
  },
  {
    id: `sys-${store.code}-ref`,
    storeId: store.id,
    categoryId: "refrigeration",
    name: store.code === "45" ? "Beer Cave Refrigeration" : "Cold Beverage Refrigeration",
    type: store.code === "45" ? "Beer Cave" : "Walk-In & Display",
    code: `${store.code}-REF`,
    description: "Cold storage, walk-in and beverage refrigeration cost center.",
    location: "Back room and sales floor",
    glCode: "6110",
    annualBudgetCents: 2_250_000,
    ownerName: store.managerName,
    maintenanceStrategy: "preventive",
    state: store.code === "45" ? "exception" : store.code === "57" ? "watch" : "normal",
  },
]);

const assets: Asset[] = stores.flatMap((store, index) => {
  const base: Asset[] = [
    {
      id: `asset-${store.code}-hvac-rtu1`,
      storeSystemId: `sys-${store.code}-hvac`,
      assetClass: "Rooftop Unit",
      name: "Rooftop Unit RTU-1",
      manufacturer: index % 2 ? "Trane" : "Carrier",
      model: `RT-${40 + index}A`,
      serial: `D-${store.code}-RTU1-${2017 + (index % 5)}`,
      assetTag: `${store.code}-RTU1`, location: "Roof", condition: store.code === "31" ? "fair" : "good", purchaseCostCents: 1_420_000, lastServiceAt: "2026-06-12", maintenanceStrategy: "preventive", meterType: "runtime_hours", meterReading: 9_200 + index * 110,
      installedAt: `${2017 + (index % 5)}-04-12`,
      expectedLifeYears: 15,
      replacementCostCents: 2_250_000,
      warrantyEndsAt: `${2027 + (index % 4)}-04-12`,
      criticality: "high",
      state: store.code === "31" ? "watch" : "operational",
    },
    {
      id: `asset-${store.code}-ref-cu1`,
      storeSystemId: `sys-${store.code}-ref`,
      assetClass: "Condensing Unit",
      name: "Condensing Unit CU-1",
      manufacturer: store.code === "45" ? "Heatcraft" : index % 2 ? "Copeland" : "Russell",
      model: store.code === "45" ? "HCU-060L6" : `CU-${50 + index}R`,
      serial: store.code === "45" ? "HC15-45-7712" : `D-${store.code}-CU1-${2018 + (index % 4)}`,
      assetTag: `${store.code}-CU1`, location: "Exterior equipment pad", condition: store.code === "45" ? "poor" : "good", purchaseCostCents: 1_050_000, lastServiceAt: "2026-05-22", maintenanceStrategy: "preventive", meterType: "runtime_hours", meterReading: 10_450 + index * 120,
      installedAt: store.code === "45" ? "2015-05-18" : `${2018 + (index % 4)}-06-15`,
      expectedLifeYears: 13,
      replacementCostCents: store.code === "45" ? 1_750_000 : 1_620_000,
      warrantyEndsAt: store.code === "45" ? "2020-05-18" : `${2028 + (index % 3)}-06-15`,
      criticality: "critical",
      state: store.code === "45" ? "watch" : "operational",
    },
    {
      id: `asset-${store.code}-ref-ev1`,
      storeSystemId: `sys-${store.code}-ref`,
      assetClass: "Evaporator",
      name: "Evaporator EV-1",
      manufacturer: "Bohn",
      model: `EV-${30 + index}L`,
      serial: `D-${store.code}-EV1-${2019 + (index % 3)}`,
      assetTag: `${store.code}-EV1`, location: "Walk-in cooler", condition: "good", purchaseCostCents: 510_000, lastServiceAt: "2026-04-15", maintenanceStrategy: "preventive", meterType: "runtime_hours", meterReading: 8_200 + index * 90,
      installedAt: `${2019 + (index % 3)}-03-20`,
      expectedLifeYears: 15,
      replacementCostCents: 820_000,
      warrantyEndsAt: `${2027 + (index % 4)}-03-20`,
      criticality: "high",
      state: "operational",
    },
  ];
  if (["31", "45", "72"].includes(store.code)) {
    base.push({
      id: `asset-${store.code}-hvac-rtu2`,
      storeSystemId: `sys-${store.code}-hvac`,
      assetClass: "Rooftop Unit",
      name: "Rooftop Unit RTU-2",
      manufacturer: "Lennox",
      model: `LGA-${store.code}`,
      serial: `D-${store.code}-RTU2-2020`,
      assetTag: `${store.code}-RTU2`, location: "Roof", condition: "good", purchaseCostCents: 1_360_000, lastServiceAt: "2026-06-12", maintenanceStrategy: "preventive", meterType: "runtime_hours", meterReading: 6_900 + index * 80,
      installedAt: "2020-08-14",
      expectedLifeYears: 15,
      replacementCostCents: 2_180_000,
      warrantyEndsAt: "2030-08-14",
      criticality: "standard",
      state: "operational",
    });
  }
  return base;
});

const components: Component[] = [
  { id: STORY_COMPONENT_ID, assetId: STORY_ASSET_ID, type: "Fan Motor", name: "Condenser Fan Motor", partNumber: "MTR-PSC-825", serial: "FM-45-260522", quantity: 1, unitCostCents: 185_000, criticalSpare: true, installedAt: "2026-05-22", warrantyEndsAt: "2027-05-22", vendorId: "vendor-northstar" },
  { id: "component-45-compressor", assetId: STORY_ASSET_ID, type: "Scroll Compressor", name: "Compressor 1", partNumber: "ZB45KCE", serial: "ZB45-210804", quantity: 1, unitCostCents: 520_000, criticalSpare: false, installedAt: "2021-08-04", warrantyEndsAt: "2026-08-04", vendorId: "vendor-valley" },
  { id: "component-31-belt", assetId: "asset-31-hvac-rtu1", type: "Drive Belt", name: "Supply Fan Belt", partNumber: "BX-52", quantity: 1, unitCostCents: 8_500, criticalSpare: true, installedAt: "2026-03-16", warrantyEndsAt: "2026-09-16", vendorId: "vendor-keystone" },
  { id: "component-57-controller", assetId: "asset-57-ref-cu1", type: "Controller", name: "Digital Temperature Controller", partNumber: "DTC-220", quantity: 1, unitCostCents: 46_000, criticalSpare: true, installedAt: "2025-11-08", warrantyEndsAt: "2027-11-08", vendorId: "vendor-valley" },
  { id: "component-72-contactor", assetId: "asset-72-hvac-rtu1", type: "Contactor", name: "Compressor Contactor", partNumber: "CTR-3P-40", quantity: 1, unitCostCents: 12_500, criticalSpare: true, installedAt: "2025-09-12", warrantyEndsAt: "2026-09-12", vendorId: "vendor-keystone" },
  { id: "component-18-valve", assetId: "asset-18-ref-ev1", type: "Expansion Valve", name: "Thermostatic Expansion Valve", partNumber: "TXV-8", quantity: 1, unitCostCents: 22_000, criticalSpare: true, installedAt: "2025-04-03", warrantyEndsAt: "2026-10-03", vendorId: "vendor-northstar" },
  { id: "component-84-motor", assetId: "asset-84-hvac-rtu1", type: "Blower Motor", name: "Supply Blower Motor", partNumber: "BLW-5HP", quantity: 1, unitCostCents: 145_000, criticalSpare: false, installedAt: "2024-12-11", warrantyEndsAt: "2026-12-11", vendorId: "vendor-keystone" },
  { id: "component-23-sensor", assetId: "asset-23-ref-cu1", type: "Temperature Sensor", name: "Discharge Temperature Sensor", partNumber: "SNS-DT-14", quantity: 1, unitCostCents: 9_800, criticalSpare: true, installedAt: "2026-02-09", warrantyEndsAt: "2027-02-09", vendorId: "vendor-valley" },
];

const additionalCostCenters = [
  ["foodservice", "food", "Hot Food & Bakery", "Ovens, fryers & holding", "Foodservice line", "6120", 1_600_000],
  ["plumbing", "plumb", "Plumbing & Restrooms", "Domestic water & sanitary", "Restrooms and utility", "6130", 720_000],
  ["electrical", "elec", "Electrical Distribution", "Service, panels & lighting", "Electrical room", "6140", 880_000],
  ["fuel", "fuel", "Fuel & Forecourt", "Dispensers, canopy & containment", "Forecourt", "6150", 1_950_000],
  ["building", "site", "Building & Site", "Envelope, doors & parking", "Interior and exterior", "6160", 960_000],
  ["life-safety", "safety", "Life Safety", "Fire alarm, suppression & security", "Whole store", "6170", 650_000],
] as const;

systems.push(...stores.flatMap((store, storeIndex) => additionalCostCenters.map(([categoryId, suffix, name, type, location, glCode, budget], categoryIndex) => ({
  id: `sys-${store.code}-${suffix}`,
  storeId: store.id,
  categoryId,
  name,
  type,
  code: `${store.code}-${suffix.toUpperCase()}`,
  description: `${name} operating cost center for ${store.name}.`,
  location,
  glCode,
  annualBudgetCents: budget + (storeIndex % 5) * 55_000,
  ownerName: store.managerName,
  maintenanceStrategy: categoryId === "life-safety" ? "statutory" as const : (["foodservice", "fuel"].includes(categoryId) ? "preventive" as const : "condition_based" as const),
  state: (storeIndex + categoryIndex) % 23 === 0 ? "watch" as const : "normal" as const,
}))));

const additionalAssetTemplates: Record<string, [string, string, string, string, number, number]> = {
  foodservice: ["oven1", "Combi Oven", "Combi Oven OVEN-1", "Rational", 10, 1_480_000],
  plumbing: ["wh1", "Water Heater", "Domestic Water Heater WH-1", "A.O. Smith", 12, 640_000],
  electrical: ["panel1", "Electrical Panel", "Main Distribution Panel MDP-1", "Square D", 30, 1_250_000],
  fuel: ["disp1", "Fuel Dispenser", "Dispenser Bank DISP-1", "Gilbarco", 12, 2_900_000],
  building: ["door1", "Automatic Door", "Main Entry Door DOOR-1", "Stanley", 15, 780_000],
  "life-safety": ["fire1", "Fire Alarm Panel", "Fire Alarm Control Panel FACP-1", "Notifier", 15, 920_000],
};

assets.push(...systems.filter((system) => additionalAssetTemplates[system.categoryId]).map((system, index) => {
  const store = stores.find((item) => item.id === system.storeId)!;
  const [suffix, assetClass, name, manufacturer, expectedLifeYears, replacementCostCents] = additionalAssetTemplates[system.categoryId];
  const installedYear = 2016 + (index % 8);
  return {
    id: `asset-${store.code}-${system.id.split("-").at(-1)}-${suffix}`,
    storeSystemId: system.id,
    assetClass,
    name,
    manufacturer,
    model: `${manufacturer.slice(0, 3).toUpperCase()}-${store.code}`,
    serial: `SN-${store.code}-${suffix.toUpperCase()}-${installedYear}`,
    assetTag: `${store.code}-${suffix.toUpperCase()}`,
    location: system.location,
    condition: index % 21 === 0 ? "fair" as const : "good" as const,
    purchaseCostCents: Math.round(replacementCostCents * 0.62),
    lastServiceAt: `2026-${String((index % 7) + 1).padStart(2, "0")}-12`,
    maintenanceStrategy: system.maintenanceStrategy,
    meterType: ["foodservice", "fuel"].includes(system.categoryId) ? "runtime_hours" : undefined,
    meterReading: ["foodservice", "fuel"].includes(system.categoryId) ? 5_800 + index * 43 : undefined,
    installedAt: `${installedYear}-05-18`,
    expectedLifeYears,
    replacementCostCents,
    warrantyEndsAt: `${installedYear + Math.min(expectedLifeYears, 10)}-05-18`,
    criticality: ["fuel", "life-safety"].includes(system.categoryId) ? "critical" as const : "high" as const,
    state: system.state === "watch" ? "service_due" as const : "operational" as const,
  };
}));

assets.forEach((asset, assetIndex) => {
  if (components.some((item) => item.assetId === asset.id)) return;
  const labels = asset.assetClass.includes("Oven") ? [["Heating Element", "ELM-480-12"], ["Control Board", "PCB-OVN-22"]] : asset.assetClass.includes("Panel") ? [["Main Breaker", "BRK-400A"], ["Surge Protector", "SPD-3P"]] : [["Controller", "CTRL-24V"], ["Motor / Drive", "MTR-VFD-2"]];
  components.push(...labels.map(([name, partNumber], index) => ({ id: `component-${asset.id}-${index + 1}`, assetId: asset.id, type: name, name, partNumber, serial: `CP-${assetIndex}-${index + 1}`, quantity: 1, unitCostCents: 18_500 + index * 42_000, criticalSpare: index === 0 && asset.criticality === "critical", installedAt: asset.installedAt, warrantyEndsAt: asset.warrantyEndsAt, vendorId: "vendor-summit" })));
});

const technicians: Technician[] = [
  ["tech-sam", "Sam Rivera", "Senior Maintenance Technician", "region-east", ["HVAC", "Electrical"]],
  ["tech-devon", "Devon Hayes", "Maintenance Technician", "region-east", ["Foodservice", "Plumbing"]],
  ["tech-marcus", "Marcus Bell", "Senior Maintenance Technician", "region-central", ["Refrigeration", "HVAC"]],
  ["tech-tia", "Tia Bennett", "Maintenance Technician", "region-central", ["Electrical", "Life Safety"]],
  ["tech-eli", "Eli Turner", "Maintenance Technician", "region-central", ["Building", "Plumbing"]],
  ["tech-noah", "Noah Grant", "Senior Maintenance Technician", "region-west", ["Fuel", "Electrical"]],
  ["tech-lena", "Lena Price", "Maintenance Technician", "region-west", ["Foodservice", "Refrigeration"]],
  ["tech-jules", "Jules Carter", "Maintenance Planner", "region-west", ["PM", "Asset management"]],
] .map(([id, name, title, regionId, trades], index) => ({ id: id as string, name: name as string, title: title as string, email: `${String(name).toLowerCase().replace(" ", ".")}@clarks-demo.example`, phone: `(724) 555-${2200 + index}`, regionIds: [regionId as string], trades: trades as string[], certifications: index % 2 ? ["OSHA 10", "EPA 608"] : ["OSHA 30", "NFPA 70E"], employmentType: "internal", status: index % 3 === 0 ? "assigned" : "available", weeklyCapacityHours: 40 }));

const reports: EmployeeReport[] = [
  {
    id: STORY_REPORT_ID,
    reference: "RPT-0671",
    storeId: STORY_STORE_ID,
    reporterName: "Maya Collins",
    reporterRole: "Store Associate",
    area: "Beer cave",
    originalDescription: "Beer cave feels warm and the fans sound louder than usual. The thermometer near the door reads 49°F.",
    urgency: "high",
    submittedAt: "2026-05-18T11:42:00.000Z",
    photoDocumentId: "doc-employee-photo",
    status: "escalated",
  },
];

const reportReviews: ReportReview[] = [
  {
    id: "review-0671-store",
    reportId: STORY_REPORT_ID,
    reviewerName: "Jordan Lee",
    reviewerRole: "Store Manager",
    decision: "Confirmed · vendor escalation recommended",
    context: "Verified 48–50°F at two shelf locations. Product moved to backup cooler; facilities escalation requested.",
    createdAt: "2026-05-18T11:54:00.000Z",
  },
  {
    id: "review-0671-region",
    reportId: STORY_REPORT_ID,
    reviewerName: "Avery Brooks",
    reviewerRole: "Regional Manager",
    decision: "Approved urgent escalation",
    context: "Regional visibility began at submission. Approved same-day vendor issue due to food-safety and sales exposure.",
    createdAt: "2026-05-18T12:02:00.000Z",
  },
];

const workOrders: WorkOrder[] = [];
const vendorResponses: VendorResponse[] = [];
const visits: ServiceVisit[] = [];
const followUps: FollowUp[] = [];
const invoices: Invoice[] = [];
const allocations: CostAllocation[] = [];
const quotes: Quote[] = [];
const authorizations: Authorization[] = [];
const credits: Credit[] = [];
const checklistItems: WorkOrderChecklistItem[] = [];
const laborEntries: LaborEntry[] = [];
const partsUsed: PartUsage[] = [];
const workOrderNotes: WorkOrderNote[] = [];

const createdDates = [
  "2024-09-12T13:00:00.000Z",
  "2024-12-08T15:00:00.000Z",
  "2025-02-19T14:00:00.000Z",
  "2025-05-24T12:00:00.000Z",
  "2025-09-17T13:00:00.000Z",
  "2025-12-02T14:00:00.000Z",
  "2026-03-14T16:00:00.000Z",
  "2026-07-02T15:00:00.000Z",
];

const addHours = (value: string, hours: number) => new Date(new Date(value).getTime() + hours * 3_600_000).toISOString();
const addDays = (value: string, days: number) => addHours(value, days * 24);

function openStatus(index: number): WorkOrderStatus {
  return ["awaiting_vendor_acceptance", "follow_up_required", "waiting_on_quote", "completed_pending_invoice"][index % 4] as WorkOrderStatus;
}

function workClass(type: WorkType): CostAllocation["workClass"] {
  if (type === "preventive") return "planned_pm";
  if (type === "emergency") return "emergency";
  if (type === "warranty") return "warranty";
  if (type === "capital") return "capital";
  if (type === "internal") return "internal";
  return "reactive";
}

let runningNumber = 1100;
const workCategorySequence = ["refrigeration", "hvac", "foodservice", "plumbing", "electrical", "fuel", "building", "life-safety"];
const systemSuffix: Record<string, string> = { refrigeration: "ref", hvac: "hvac", foodservice: "food", plumbing: "plumb", electrical: "elec", fuel: "fuel", building: "site", "life-safety": "safety" };
const workTitles: Record<string, string[]> = {
  refrigeration: ["Walk-in temperature alarm", "Case temperature drifting"],
  hvac: ["Sales floor warm", "Supply fan vibration"],
  foodservice: ["Combi oven not reaching setpoint", "Fryer recovery time slow"],
  plumbing: ["Restroom fixture leaking", "Low hot-water temperature"],
  electrical: ["Exterior lighting circuit fault", "Panel breaker nuisance trip"],
  fuel: ["Dispenser offline", "Sump sensor alarm"],
  building: ["Entry door not closing", "Parking lot trip hazard"],
  "life-safety": ["Fire panel supervisory signal", "Kitchen suppression inspection due"],
};
const categoryVendor: Record<string, string> = { refrigeration: "vendor-northstar", hvac: "vendor-keystone", foodservice: "vendor-apex", plumbing: "vendor-flowrite", electrical: "vendor-brightline", fuel: "vendor-forecourt", building: "vendor-summit", "life-safety": "vendor-safeguard" };
stores.filter((store) => store.id !== STORY_STORE_ID).forEach((store, storeIndex) => {
  for (let itemIndex = 0; itemIndex < 8; itemIndex += 1) {
    runningNumber += 1;
    const categoryId = workCategorySequence[itemIndex];
    const isRefrigeration = categoryId === "refrigeration";
    const systemId = `sys-${store.code}-${systemSuffix[categoryId]}`;
    const assetId = assets.find((asset) => asset.storeSystemId === systemId)?.id;
    const classificationDepth = (storeIndex + itemIndex) % 5;
    const component = components.find((candidate) => candidate.assetId === assetId);
    const status = itemIndex >= 6 ? openStatus(storeIndex + itemIndex) : "closed";
    const vendor = vendors.find((item) => item.id === categoryVendor[categoryId])!;
    const createdAt = createdDates[itemIndex];
    const type: WorkType = itemIndex === 3 ? "preventive" : itemIndex === 7 && storeIndex % 4 === 0 ? "emergency" : "reactive";
    const isOpen = status !== "closed";
    const workOrder: WorkOrder = {
      id: `wo-${store.code}-${itemIndex + 1}`,
      number: `CWO-${runningNumber}`,
      title: workTitles[categoryId][(storeIndex + itemIndex) % 2],
      description: `Store reported a ${categories.find((item) => item.id === categoryId)?.name.toLowerCase()} exception requiring diagnosis, a safe work plan and documented resolution.`,
      origin: itemIndex === 3 ? "pm" : itemIndex % 3 === 0 ? "employee_report" : "manager",
      storeId: store.id,
      categoryId,
      systemId: classificationDepth >= 1 ? systemId : undefined,
      assetId: classificationDepth >= 2 ? assetId : undefined,
      componentId: classificationDepth >= 4 && component ? component.id : undefined,
      priority: itemIndex === 7 && storeIndex % 5 === 0 ? "critical" : itemIndex >= 6 ? "high" : "routine",
      workType: type,
      status,
      accountableParty: isOpen ? (status === "awaiting_vendor_acceptance" ? vendor.shortName : "Clark's Facilities") : "Clark's Facilities",
      nextAction: isOpen
        ? status === "awaiting_vendor_acceptance"
          ? "Vendor accept or decline"
          : status === "follow_up_required"
            ? "Confirm repair plan"
            : status === "waiting_on_quote"
              ? "Review expected quote"
              : "Review invoice package"
        : "Complete",
      dueAt: isOpen ? addDays(DEMO_NOW, storeIndex % 3 === 0 ? -1 : 2 + (storeIndex % 4)) : undefined,
      escalation: isOpen ? (storeIndex < 5 ? "Eastern Regional Manager" : "Facilities Director") : "Facilities Director",
      vendorId: vendor.id,
      vendorAcceptance: status === "awaiting_vendor_acceptance" ? "pending" : "accepted",
      createdAt,
      requestedServiceAt: addDays(createdAt, 1),
      closedAt: status === "closed" ? addDays(createdAt, 3 + (itemIndex % 3)) : undefined,
      nteCents: 350_000,
      costExposureCents: isOpen ? 260_000 + storeIndex * 12_000 : 0,
      reportIds: [],
    };
    workOrders.push(workOrder);

    if (status !== "awaiting_vendor_acceptance") {
      vendorResponses.push({
        id: `response-${workOrder.id}`,
        workOrderId: workOrder.id,
        vendorId: vendor.id,
        response: "accepted",
        responder: `${vendor.shortName} Dispatch`,
        issuedAt: addHours(createdAt, 1),
        respondedAt: addHours(createdAt, 2 + ((storeIndex + itemIndex) % 9)),
      });
    }

    if (status === "closed") {
      const visitCount = (storeIndex + itemIndex) % 7 === 0 ? 2 : 1;
      for (let visitIndex = 0; visitIndex < visitCount; visitIndex += 1) {
        const checkInAt = addDays(createdAt, 1 + visitIndex * 2);
        const verified = (storeIndex + itemIndex + visitIndex) % 13 !== 0;
        visits.push({
          id: `visit-${workOrder.id}-${visitIndex + 1}`,
          workOrderId: workOrder.id,
          vendorId: vendor.id,
          technicianName: ["Riley Morgan", "Cameron Wells", "Taylor Reed", "Drew Parker"][(storeIndex + itemIndex) % 4],
          sessionHash: `session-${store.code}-${itemIndex}`,
          checkedInAt: checkInAt,
          checkedOutAt: addHours(checkInAt, 1.4 + visitIndex * 0.4),
          checkIn: { state: verified ? "verified" : "exception", distanceM: verified ? 48 + storeIndex : 318, accuracyM: verified ? 24 : 185, capturedAt: checkInAt },
          checkOut: { state: verified ? "verified" : "exception", distanceM: verified ? 43 + storeIndex : 295, accuracyM: verified ? 28 : 172, capturedAt: addHours(checkInAt, 1.4 + visitIndex * 0.4) },
          outcome: visitIndex + 1 === visitCount ? "resolved" : "diagnosed_unresolved",
        });
      }

      let amountCents: number;
      if (isRefrigeration && itemIndex === 4) amountCents = 235_000 + storeIndex * 3_000;
      else if (isRefrigeration && itemIndex === 6) amountCents = 290_000 + storeIndex * 3_000;
      else if (isRefrigeration) amountCents = 185_000 + itemIndex * 14_000 + storeIndex * 2_000;
      else if (type === "preventive") amountCents = 72_000 + storeIndex * 2_000;
      else amountCents = 128_000 + itemIndex * 12_000 + storeIndex * 2_500;

      const invoice: Invoice = {
        id: `invoice-${workOrder.id}`,
        workOrderId: workOrder.id,
        vendorId: vendor.id,
        number: `INV-${store.code}${itemIndex + 1}-${24 + itemIndex}`,
        totalCents: amountCents,
        status: itemIndex === 6 && storeIndex % 5 === 2 ? "review" : "paid",
        issuedAt: addDays(createdAt, 5 + (itemIndex % 3)),
        paidAt: itemIndex === 6 && storeIndex % 5 === 2 ? undefined : addDays(createdAt, 20 + itemIndex),
      };
      invoices.push(invoice);
      allocations.push({
        id: `allocation-${invoice.id}`,
        invoiceId: invoice.id,
        workOrderId: workOrder.id,
        storeId: store.id,
        categoryId,
        systemId: workOrder.systemId,
        assetId: workOrder.assetId,
        componentId: workOrder.componentId,
        amountCents,
        workClass: workClass(type),
        costCategory: type === "preventive" ? "labor" : itemIndex % 3 === 0 ? "parts" : "labor",
      });
    }

    if (status === "follow_up_required") {
      followUps.push({
        id: `followup-${workOrder.id}`,
        workOrderId: workOrder.id,
        accountableParty: "Clark's Facilities",
        nextAction: "Confirm repair plan with vendor",
        dueAt: workOrder.dueAt!,
        escalation: workOrder.escalation,
        status: "open",
        createdAt: addDays(createdAt, 2),
      });
    }
  }
});

const store45Stories = [
  ["wo-45-prior-1", "CWO-0181", "2024-09-15T13:00:00.000Z", 210_000, "Low suction pressure callback", "reactive"],
  ["wo-45-prior-2", "CWO-0198", "2024-12-03T14:00:00.000Z", 140_000, "Beer cave coil icing", "reactive"],
  ["wo-45-prior-3", "CWO-0216", "2025-03-22T12:00:00.000Z", 340_000, "Compressor cycling fault", "emergency"],
  ["wo-45-current-1", "CWO-0227", "2025-08-20T14:00:00.000Z", 180_000, "Head-pressure diagnostic", "reactive"],
  ["wo-45-current-2", "CWO-0233", "2025-11-10T15:00:00.000Z", 220_000, "Repeat high-temperature alarm", "emergency"],
  ["wo-45-current-3", "CWO-0240", "2026-02-06T13:00:00.000Z", 290_000, "Condenser fan intermittent", "reactive"],
  [STORY_WORK_ORDER_ID, "CWO-0245", "2026-05-18T12:08:00.000Z", 495_000, "Beer cave warm · fan motor failure", "emergency"],
] as const;

store45Stories.forEach(([id, number, createdAt, amountCents, title, type], index) => {
  const story = id === STORY_WORK_ORDER_ID;
  const workOrder: WorkOrder = {
    id,
    number,
    title,
    description: story ? "Beer cave above target temperature; internal WO created from cashier report and progressively classified after diagnosis." : "Recurring service on Beer Cave Condensing Unit CU-1.",
    origin: story ? "employee_report" : index % 3 === 2 ? "emergency" : "manager",
    storeId: STORY_STORE_ID,
    categoryId: "refrigeration",
    systemId: STORY_SYSTEM_ID,
    assetId: STORY_ASSET_ID,
    componentId: story ? STORY_COMPONENT_ID : index >= 5 ? STORY_COMPONENT_ID : undefined,
    priority: story || type === "emergency" ? "critical" : "high",
    workType: type,
    status: "closed",
    accountableParty: "Clark's Facilities",
    nextAction: "Complete",
    escalation: "Facilities Director",
    vendorId: index === 1 ? "vendor-valley" : "vendor-northstar",
    vendorAcceptance: "accepted",
    createdAt,
    requestedServiceAt: addHours(createdAt, 2),
    closedAt: story ? "2026-05-24T16:30:00.000Z" : addDays(createdAt, 4),
    nteCents: story ? 500_000 : 400_000,
    costExposureCents: 0,
    reportIds: story ? [STORY_REPORT_ID] : [],
    demoStory: story,
  };
  workOrders.push(workOrder);
  const vendorId = workOrder.vendorId!;
  vendorResponses.push({
    id: `response-${id}`,
    workOrderId: id,
    vendorId,
    response: "accepted",
    responder: story ? "Morgan Ellis · NorthStar Dispatch" : `${vendors.find((vendor) => vendor.id === vendorId)?.shortName} Dispatch`,
    issuedAt: addHours(createdAt, story ? 0.2 : 1),
    respondedAt: story ? "2026-05-18T12:31:00.000Z" : addHours(createdAt, 3 + index),
  });

  if (story) {
    visits.push(
      {
        id: "visit-0245-1",
        workOrderId: id,
        vendorId,
        technicianName: "Evan Torres",
        sessionHash: "session-demo-45-a7f2",
        checkedInAt: "2026-05-18T14:15:00.000Z",
        checkedOutAt: "2026-05-18T15:02:00.000Z",
        checkIn: { latitude: 40.8682, longitude: -79.7482, accuracyM: 19, distanceM: 42, state: "verified", capturedAt: "2026-05-18T14:15:00.000Z" },
        checkOut: { latitude: 40.8681, longitude: -79.7484, accuracyM: 24, distanceM: 37, state: "verified", capturedAt: "2026-05-18T15:02:00.000Z" },
        outcome: "diagnosed_unresolved",
      },
      {
        id: "visit-0245-2",
        workOrderId: id,
        vendorId,
        technicianName: "Evan Torres",
        sessionHash: "session-demo-45-a7f2",
        checkedInAt: "2026-05-22T12:00:00.000Z",
        checkedOutAt: "2026-05-22T14:06:00.000Z",
        checkIn: { latitude: 40.8683, longitude: -79.7481, accuracyM: 17, distanceM: 31, state: "verified", capturedAt: "2026-05-22T12:00:00.000Z" },
        checkOut: { latitude: 40.8682, longitude: -79.7483, accuracyM: 21, distanceM: 35, state: "verified", capturedAt: "2026-05-22T14:06:00.000Z" },
        outcome: "resolved",
      },
    );
  } else {
    const checkInAt = addDays(createdAt, 1);
    visits.push({
      id: `visit-${id}-1`,
      workOrderId: id,
      vendorId,
      technicianName: index % 2 ? "Taylor Reed" : "Evan Torres",
      sessionHash: `session-${id}`,
      checkedInAt: checkInAt,
      checkedOutAt: addHours(checkInAt, 1.8),
      checkIn: { accuracyM: 25, distanceM: 41, state: "verified", capturedAt: checkInAt },
      checkOut: { accuracyM: 29, distanceM: 46, state: "verified", capturedAt: addHours(checkInAt, 1.8) },
      outcome: index === 4 ? "diagnosed_unresolved" : "resolved",
    });
    if (index === 4) {
      const returnCheckIn = addDays(checkInAt, 3);
      visits.push({
        id: `visit-${id}-2`,
        workOrderId: id,
        vendorId,
        technicianName: "Evan Torres",
        sessionHash: `session-${id}`,
        checkedInAt: returnCheckIn,
        checkedOutAt: addHours(returnCheckIn, 2.1),
        checkIn: { accuracyM: 18, distanceM: 34, state: "verified", capturedAt: returnCheckIn },
        checkOut: { accuracyM: 22, distanceM: 39, state: "verified", capturedAt: addHours(returnCheckIn, 2.1) },
        outcome: "resolved",
      });
    }
  }

  const invoice: Invoice = {
    id: `invoice-${id}`,
    workOrderId: id,
    vendorId,
    number: story ? "NS-88421" : `NS-${7300 + index}`,
    totalCents: amountCents,
    status: "paid",
    issuedAt: story ? "2026-05-23T15:20:00.000Z" : addDays(createdAt, 6),
    paidAt: story ? "2026-06-12T15:20:00.000Z" : addDays(createdAt, 22),
  };
  invoices.push(invoice);
  if (story) {
    allocations.push(
      { id: "allocation-0245-labor", invoiceId: invoice.id, workOrderId: id, storeId: STORY_STORE_ID, categoryId: "refrigeration", systemId: STORY_SYSTEM_ID, assetId: STORY_ASSET_ID, amountCents: 310_000, workClass: "emergency", costCategory: "labor" },
      { id: "allocation-0245-part", invoiceId: invoice.id, workOrderId: id, storeId: STORY_STORE_ID, categoryId: "refrigeration", systemId: STORY_SYSTEM_ID, assetId: STORY_ASSET_ID, componentId: STORY_COMPONENT_ID, amountCents: 185_000, workClass: "emergency", costCategory: "parts" },
    );
    quotes.push({ id: "quote-0245", workOrderId: id, vendorId, number: "Q-NS-4418", amountCents: 495_000, status: "approved", submittedAt: "2026-05-19T13:16:00.000Z" });
    authorizations.push({ id: "auth-0245", workOrderId: id, quoteId: "quote-0245", amountCents: 495_000, status: "approved", approvedAt: "2026-05-19T14:05:00.000Z" });
  } else {
    allocations.push({
      id: `allocation-${invoice.id}`,
      invoiceId: invoice.id,
      workOrderId: id,
      storeId: STORY_STORE_ID,
      categoryId: "refrigeration",
      systemId: STORY_SYSTEM_ID,
      assetId: STORY_ASSET_ID,
      componentId: index >= 5 ? STORY_COMPONENT_ID : undefined,
      amountCents,
      workClass: type === "emergency" ? "emergency" : "reactive",
      costCategory: index % 2 ? "parts" : "labor",
    });
  }
});

workOrders.push({
  id: "wo-45-hvac-open",
  number: "CWO-0279",
  title: "RTU-1 compressor lockout",
  description: "Sales-floor RTU enters intermittent lockout during afternoon peak.",
  origin: "manager",
  storeId: STORY_STORE_ID,
  categoryId: "hvac",
  systemId: "sys-45-hvac",
  assetId: "asset-45-hvac-rtu1",
  priority: "critical",
  workType: "reactive",
  status: "waiting_on_parts",
  accountableParty: "NorthStar",
  nextAction: "Confirm compressor lead time",
  dueAt: "2026-08-04T21:00:00.000Z",
  escalation: "Facilities Director",
  vendorId: "vendor-northstar",
  vendorAcceptance: "accepted",
  createdAt: "2026-07-28T17:24:00.000Z",
  requestedServiceAt: "2026-07-29T13:00:00.000Z",
  nteCents: 450_000,
  costExposureCents: 680_000,
  reportIds: [],
});

followUps.push({
  id: "followup-0245-repair-plan",
  workOrderId: STORY_WORK_ORDER_ID,
  sourceVisitId: "visit-0245-1",
  accountableParty: "Clark's Facilities",
  nextAction: "Contact vendor and document repair plan",
  dueAt: "2026-05-18T21:00:00.000Z",
  escalation: "Facilities Director",
  status: "completed",
  createdAt: "2026-05-18T15:02:00.000Z",
  completedAt: "2026-05-18T16:11:00.000Z",
});

const extraWorkSeeds = [
  ["wo-pm-45", "CWO-0264", "45", "refrigeration", "waiting_on_vendor", "Quarterly refrigeration PM recovery"],
  ["wo-extra-31", "CWO-0267", "31", "hvac", "completed_pending_verification", "RTU-1 economizer repair"],
  ["wo-extra-57", "CWO-0269", "57", "refrigeration", "awaiting_vendor_acceptance", "Display case temperature variance"],
  ["wo-extra-63", "CWO-0271", "63", "hvac", "visit_active", "No cooling at sales floor"],
  ["wo-extra-72", "CWO-0273", "72", "refrigeration", "waiting_on_quote", "Freezer evaporator leak"],
  ["wo-extra-84", "CWO-0275", "84", "hvac", "follow_up_required", "Supply airflow remains low"],
  ["wo-extra-18", "CWO-0276", "18", "refrigeration", "completed_pending_invoice", "TXV replacement verification"],
  ["wo-extra-91", "CWO-0278", "91", "hvac", "awaiting_vendor_acceptance", "Rooftop unit breaker trip"],
] as const;

extraWorkSeeds.forEach(([id, number, code, categoryId, status, title], index) => {
  const ref = categoryId === "refrigeration";
  const vendor = ref ? vendors[(index + 2) % 3] : vendors[(index + 1) % 2];
  workOrders.push({
    id,
    number,
    title,
    description: id === "wo-pm-45" ? "Generated from the missed April beer-cave PM occurrence; documentation and completion recovery remain open." : "Operational exception requiring controlled follow-through.",
    origin: id === "wo-pm-45" ? "pm" : "manager",
    storeId: `store-${code}`,
    categoryId,
    systemId: `sys-${code}-${ref ? "ref" : "hvac"}`,
    assetId: index % 3 === 0 ? (ref ? `asset-${code}-ref-cu1` : `asset-${code}-hvac-rtu1`) : undefined,
    priority: index === 3 ? "critical" : "high",
    workType: id === "wo-pm-45" ? "preventive" : index % 4 === 0 ? "emergency" : "reactive",
    status,
    accountableParty: status === "awaiting_vendor_acceptance" ? vendor.shortName : index % 2 ? "Clark's Facilities" : vendor.shortName,
    nextAction: status === "awaiting_vendor_acceptance" ? "Vendor accept or decline" : id === "wo-pm-45" ? "Vendor confirm recovery visit" : "Complete current control action",
    dueAt: addDays(DEMO_NOW, index % 3 === 0 ? -2 : 1 + index),
    escalation: index < 4 ? "Regional Manager" : "Facilities Director",
    vendorId: vendor.id,
    vendorAcceptance: status === "awaiting_vendor_acceptance" ? "pending" : "accepted",
    createdAt: addDays("2026-07-15T13:00:00.000Z", index * 2),
    requestedServiceAt: addDays("2026-07-16T13:00:00.000Z", index * 2),
    nteCents: 400_000,
    costExposureCents: 180_000 + index * 48_000,
    reportIds: [],
  });
  if (status === "follow_up_required") {
    followUps.push({ id: `followup-${id}`, workOrderId: id, accountableParty: "Clark's Facilities", nextAction: "Document alternate repair path", dueAt: addDays(DEMO_NOW, -1), escalation: "Facilities Director", status: "open", createdAt: "2026-08-01T15:00:00.000Z" });
  }
});

authorizations.push(
  { id: "auth-extra-31", workOrderId: "wo-extra-31", amountCents: 625_000, status: "committed", approvedAt: "2026-07-24T16:10:00.000Z" },
  { id: "auth-extra-72", workOrderId: "wo-extra-72", amountCents: 840_000, status: "approved", approvedAt: "2026-07-28T18:05:00.000Z" },
  { id: "auth-45-hvac", workOrderId: "wo-45-hvac-open", amountCents: 680_000, status: "committed", approvedAt: "2026-07-30T15:35:00.000Z" },
);

technicians.forEach((technician, index) => {
  const store = stores[(index * 7 + 3) % stores.length];
  const categoryId = ["hvac", "foodservice", "electrical", "plumbing", "building", "fuel", "refrigeration", "life-safety"][index];
  const system = systems.find((item) => item.storeId === store.id && item.categoryId === categoryId)!;
  const asset = assets.find((item) => item.storeSystemId === system.id)!;
  const component = components.find((item) => item.assetId === asset.id);
  const workOrder: WorkOrder = {
    id: `wo-internal-${index + 1}`,
    number: `CWO-${1701 + index}`,
    title: ["RTU belt and sheave inspection", "Oven door seal replacement", "Parking lot pole light repair", "Restroom flush valve rebuild", "Entry door closer adjustment", "Dispenser printer repair", "Evaporator drain clearing", "Exit light battery replacement"][index],
    description: "Internal maintenance assignment with a defined scope, safety review, checklist, labor capture, parts usage and completion evidence.",
    location: system.location,
    problemCode: `${categoryId.toUpperCase()}-SERVICE`,
    requestedBy: store.managerName,
    origin: "facilities",
    storeId: store.id,
    categoryId,
    systemId: system.id,
    assetId: asset.id,
    componentId: component?.id,
    priority: index % 4 === 0 ? "high" : "routine",
    workType: "internal",
    status: index < 3 ? "visit_active" : index < 6 ? "approved" : "waiting_on_parts",
    accountableParty: technician.name,
    assignmentType: "internal",
    assignedToId: technician.id,
    assignedToName: technician.name,
    nextAction: index < 3 ? "Complete work plan and record outcome" : index < 6 ? "Start scheduled assignment" : "Receive required part",
    dueAt: addDays(DEMO_NOW, index - 2),
    escalation: "Maintenance Supervisor",
    vendorAcceptance: "not_issued",
    createdAt: addDays("2026-07-28T13:00:00.000Z", index),
    requestedServiceAt: addDays("2026-07-29T13:00:00.000Z", index),
    targetResponseAt: addHours(addDays("2026-07-28T13:00:00.000Z", index), 4),
    targetCompletionAt: addDays(DEMO_NOW, index - 2),
    scheduledStartAt: addHours(DEMO_NOW, index * 3),
    estimatedHours: 2 + (index % 3),
    actualHours: index < 3 ? 1.25 + index * 0.5 : 0,
    downtimeMinutes: index % 3 === 0 ? 45 : 0,
    safetyRisk: ["moderate", "low", "high", "low"][index % 4] as WorkOrder["safetyRisk"],
    accessInstructions: `Check in with ${store.managerName}. Lockout/tagout where energized work is involved.`,
    laborCostCents: index < 3 ? 8_500 + index * 4_200 : 0,
    partsCostCents: index < 3 ? 4_800 + index * 6_400 : 0,
    travelCostCents: 0,
    tags: ["internal-maintenance", store.district.toLowerCase().replace(" ", "-")],
    nteCents: 95_000,
    costExposureCents: 24_000 + index * 3_500,
    reportIds: [],
  };
  workOrders.push(workOrder);
});

workOrders.forEach((workOrder, index) => {
  const store = stores.find((item) => item.id === workOrder.storeId)!;
  const system = systems.find((item) => item.id === workOrder.systemId);
  workOrder.location ??= system?.location ?? "Store - location to be confirmed";
  workOrder.problemCode ??= `${workOrder.categoryId.toUpperCase()}-${workOrder.workType.toUpperCase()}`;
  workOrder.requestedBy ??= index % 3 === 0 ? store.managerName : "Facilities Service Desk";
  workOrder.assignmentType ??= workOrder.vendorId ? "vendor" : "unassigned";
  workOrder.assignedToName ??= workOrder.vendorId ? vendors.find((item) => item.id === workOrder.vendorId)?.name : undefined;
  workOrder.targetResponseAt ??= addHours(workOrder.createdAt, workOrder.priority === "critical" ? 1 : workOrder.priority === "high" ? 4 : 24);
  workOrder.targetCompletionAt ??= workOrder.dueAt ?? addDays(workOrder.createdAt, workOrder.priority === "critical" ? 1 : 5);
  workOrder.estimatedHours ??= workOrder.priority === "critical" ? 4 : 2;
  workOrder.actualHours ??= workOrder.closedAt ? 1.5 + (index % 5) * 0.4 : 0;
  workOrder.downtimeMinutes ??= workOrder.priority === "critical" ? 120 + (index % 6) * 30 : index % 4 === 0 ? 30 : 0;
  workOrder.safetyRisk ??= ["electrical", "fuel", "life-safety"].includes(workOrder.categoryId) ? "high" : workOrder.priority === "critical" ? "moderate" : "low";
  workOrder.accessInstructions ??= `Check in with ${store.managerName}; use the service entrance and follow store lockout/tagout procedures.`;
  workOrder.laborCostCents ??= Math.round((workOrder.actualHours ?? 0) * 9_500);
  workOrder.partsCostCents ??= workOrder.closedAt && index % 3 === 0 ? 42_000 + index * 120 : 0;
  workOrder.travelCostCents ??= workOrder.vendorId ? 12_500 : 0;
  workOrder.tags ??= [workOrder.categoryId, workOrder.workType, store.district.toLowerCase().replace(" ", "-")];
  const checklist = ["Review scope, hazards and store access", "Verify equipment identity and isolate energy", "Complete diagnosis and corrective work", "Test operation and clean the work area", "Record outcome, parts, labor and photos"];
  checklistItems.push(...checklist.map((label, sequence) => ({ id: `check-${workOrder.id}-${sequence + 1}`, workOrderId: workOrder.id, sequence: sequence + 1, label, required: sequence !== 1, completed: workOrder.status === "closed" || (workOrder.status === "visit_active" && sequence < 2), completedAt: workOrder.status === "closed" ? workOrder.closedAt : undefined, completedBy: workOrder.status === "closed" ? (workOrder.assignedToName ?? workOrder.accountableParty) : undefined })));
  workOrderNotes.push({ id: `note-${workOrder.id}-1`, workOrderId: workOrder.id, author: workOrder.requestedBy, authorRole: workOrder.origin === "employee_report" ? "Store team" : "Operations", body: workOrder.description, visibility: "internal", createdAt: workOrder.createdAt });
});

workOrders.filter((item) => item.assignmentType === "internal").forEach((workOrder, index) => {
  const technician = technicians.find((item) => item.id === workOrder.assignedToId)!;
  workOrderNotes.push({ id: `note-${workOrder.id}-tech`, workOrderId: workOrder.id, author: technician.name, authorRole: technician.title, body: index < 3 ? "Arrived onsite, reviewed hazards and began diagnosis. Store contact has been notified." : "Assignment reviewed; parts and access requirements confirmed.", visibility: "store", createdAt: addHours(workOrder.createdAt, 5) });
  if (index < 3) {
    laborEntries.push({ id: `labor-${workOrder.id}-1`, workOrderId: workOrder.id, technicianId: technician.id, technicianName: technician.name, startedAt: addHours(workOrder.createdAt, 5), endedAt: addHours(workOrder.createdAt, 6.25 + index * 0.5), regularHours: 1.25 + index * 0.5, overtimeHours: 0, hourlyRateCents: 6_800, notes: "Diagnosis, corrective work and operational test." });
    partsUsed.push({ id: `part-${workOrder.id}-1`, workOrderId: workOrder.id, partNumber: `STK-${400 + index}`, description: ["Belt and fastener kit", "High-temperature door gasket", "LED driver assembly"][index], quantity: 1, unitCostCents: 4_800 + index * 6_400, source: "truck_stock", recordedBy: technician.name, recordedAt: addHours(workOrder.createdAt, 6) });
  }
});

const planSeeds = [
  ["pm-beer-cave", "Quarterly Beer Cave Refrigeration PM", "refrigeration", "Store 45 · Beer Cave Refrigeration", "system", STORY_SYSTEM_ID, STORY_STORE_ID, "vendor-northstar"],
  ["pm-31-hvac", "Quarterly RTU Inspection", "hvac", "Store 31 · Store HVAC", "system", "sys-31-hvac", "store-31", "vendor-keystone"],
  ["pm-72-ref", "Quarterly Refrigeration PM", "refrigeration", "Store 72 · Cold Beverage", "system", "sys-72-ref", "store-72", "vendor-valley"],
  ["pm-18-hvac", "Semiannual Comfort HVAC PM", "hvac", "Store 18 · Store HVAC", "system", "sys-18-hvac", "store-18", "vendor-keystone"],
  ["pm-57-ref", "Quarterly Condenser Cleaning", "refrigeration", "Store 57 · Refrigeration", "asset", "asset-57-ref-cu1", "store-57", "vendor-valley"],
  ["pm-84-hvac", "Quarterly RTU Inspection", "hvac", "Store 84 · Store HVAC", "asset", "asset-84-hvac-rtu1", "store-84", "vendor-keystone"],
  ["pm-63-ref", "Quarterly Refrigeration PM", "refrigeration", "Store 63 · Refrigeration", "system", "sys-63-ref", "store-63", "vendor-northstar"],
  ["pm-23-hvac", "Semiannual RTU Service", "hvac", "Store 23 · Store HVAC", "asset", "asset-23-hvac-rtu1", "store-23", "vendor-keystone"],
] as const;

const pmPlans: PmPlan[] = planSeeds.map(([id, name, categoryId, scopeLabel, targetType, targetId, , vendorId]) => ({
  id,
  name,
  categoryId,
  scopeLabel,
  targetType,
  targetId,
  frequency: id.includes("18") || id.includes("23") ? "semiannual" : "quarterly",
  earlyWindowDays: 15,
  lateWindowDays: 15,
  vendorId,
  requiredDocument: "Vendor service ticket",
  active: true,
}));

const occurrenceDates = ["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15", "2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"];
const pmOccurrences: PmOccurrence[] = [];
planSeeds.forEach(([planId, , , , targetType, targetId, storeId], planIndex) => {
  occurrenceDates.forEach((date, occurrenceIndex) => {
    const dueAt = `${date}T17:00:00.000Z`;
    const isFuture = occurrenceIndex === 7;
    const isMissed = (planId === "pm-beer-cave" && occurrenceIndex === 5) || (planIndex === 4 && occurrenceIndex === 3) || (planIndex === 6 && occurrenceIndex === 6);
    const isLate = !isFuture && !isMissed && (planIndex + occurrenceIndex) % 13 === 0;
    const status = isFuture ? "scheduled" : isMissed ? "missed" : isLate ? "completed_late" : "completed_on_time";
    pmOccurrences.push({
      id: `occ-${planId}-${date}`,
      planId,
      storeId,
      systemId: targetType === "system" ? targetId : assets.find((asset) => asset.id === targetId)?.storeSystemId,
      assetId: targetType === "asset" ? targetId : undefined,
      dueAt,
      windowStart: addDays(dueAt, -15),
      windowEnd: addDays(dueAt, 15),
      completedAt: isFuture || isMissed ? undefined : addDays(dueAt, isLate ? 19 : ((planIndex + occurrenceIndex) % 11) - 5),
      status,
      workOrderId: planId === "pm-beer-cave" && occurrenceIndex === 5 ? "wo-pm-45" : undefined,
      verified: !isFuture && !isMissed,
    });
  });
});

const documents: DocumentRecord[] = [
  { id: "doc-employee-photo", name: "beer-cave-thermometer.jpg", classification: "employee_photo", mimeType: "image/jpeg", bytes: 842_118, uploadedBy: "Maya Collins", uploadedAt: "2026-05-18T11:42:00.000Z", workOrderId: STORY_WORK_ORDER_ID, storeId: STORY_STORE_ID, href: "/demo-files/beer-cave-photo.txt", visibility: "store_shared" },
  { id: "doc-email", name: "vendor-work-order-email.eml", classification: "correspondence", mimeType: "message/rfc822", bytes: 18_220, uploadedBy: "Clark's Operations", uploadedAt: "2026-05-18T12:12:00.000Z", workOrderId: STORY_WORK_ORDER_ID, vendorId: "vendor-northstar", href: "/email-outbox", visibility: "vendor_shared" },
  { id: "doc-ticket-1", name: "NS-service-ticket-44312.pdf", classification: "service_ticket", mimeType: "application/pdf", bytes: 285_442, uploadedBy: "NorthStar Dispatch", uploadedAt: "2026-05-18T16:02:00.000Z", workOrderId: STORY_WORK_ORDER_ID, visitId: "visit-0245-1", assetId: STORY_ASSET_ID, href: "/demo-files/service-ticket.txt", visibility: "vendor_shared" },
  { id: "doc-quote", name: "Q-NS-4418-fan-motor.pdf", classification: "quote", mimeType: "application/pdf", bytes: 194_120, uploadedBy: "Morgan Ellis", uploadedAt: "2026-05-19T13:16:00.000Z", workOrderId: STORY_WORK_ORDER_ID, assetId: STORY_ASSET_ID, href: "/demo-files/quote.txt", visibility: "vendor_shared" },
  { id: "doc-approval", name: "repair-authorization-0245.pdf", classification: "correspondence", mimeType: "application/pdf", bytes: 102_610, uploadedBy: "Samira Patel", uploadedAt: "2026-05-19T14:05:00.000Z", workOrderId: STORY_WORK_ORDER_ID, href: "/demo-files/authorization.txt", visibility: "internal" },
  { id: "doc-proof", name: "cu1-fan-motor-complete.jpg", classification: "proof", mimeType: "image/jpeg", bytes: 1_248_550, uploadedBy: "NorthStar Dispatch", uploadedAt: "2026-05-22T14:22:00.000Z", workOrderId: STORY_WORK_ORDER_ID, visitId: "visit-0245-2", assetId: STORY_ASSET_ID, componentId: STORY_COMPONENT_ID, href: "/demo-files/proof-of-work.txt", visibility: "store_shared" },
  { id: "doc-invoice", name: "NS-88421.pdf", classification: "invoice", mimeType: "application/pdf", bytes: 238_041, uploadedBy: "NorthStar Billing", uploadedAt: "2026-05-23T15:20:00.000Z", workOrderId: STORY_WORK_ORDER_ID, vendorId: "vendor-northstar", href: "/demo-files/invoice.txt", visibility: "vendor_shared" },
  { id: "doc-manual", name: "HCU-060L6-service-manual.pdf", classification: "manual", mimeType: "application/pdf", bytes: 3_845_112, uploadedBy: "Samira Patel", uploadedAt: "2026-05-20T17:00:00.000Z", assetId: STORY_ASSET_ID, storeId: STORY_STORE_ID, href: "/demo-files/manual.txt", visibility: "vendor_shared" },
];

const auditEvents: AuditEvent[] = [
  { id: "audit-1", entityType: "report", entityId: STORY_REPORT_ID, type: "report.submitted", actor: "Maya Collins · Store Associate", at: "2026-05-18T11:42:00.000Z", summary: "Original employee report permanently recorded", detail: "Beer cave feels warm; thermometer reads 49°F." },
  { id: "audit-2", entityType: "report", entityId: STORY_REPORT_ID, type: "report.reviewed", actor: "Jordan Lee · Store Manager", at: "2026-05-18T11:54:00.000Z", summary: "Store review confirmed issue", detail: "Product moved; vendor escalation recommended." },
  { id: "audit-3", entityType: "report", entityId: STORY_REPORT_ID, type: "report.escalated", actor: "Avery Brooks · Regional Manager", at: "2026-05-18T12:02:00.000Z", summary: "Urgent escalation approved" },
  { id: "audit-4", entityType: "work_order", entityId: STORY_WORK_ORDER_ID, type: "work_order.created", actor: "Samira Patel · Facilities", at: "2026-05-18T12:08:00.000Z", summary: "CWO-0245 created at Store + Refrigeration depth", detail: "No system, asset or component was required at creation." },
  { id: "audit-5", entityType: "work_order", entityId: STORY_WORK_ORDER_ID, type: "vendor.email_created", actor: "Clark's Operations", at: "2026-05-18T12:12:00.000Z", summary: "Vendor work-order email created in outbox" },
  { id: "audit-6", entityType: "work_order", entityId: STORY_WORK_ORDER_ID, type: "vendor.accepted", actor: "Morgan Ellis · NorthStar Dispatch", at: "2026-05-18T12:31:00.000Z", summary: "Vendor accepted Clark's work order", detail: "No technician assignment was requested." },
  { id: "audit-7", entityType: "visit", entityId: "visit-0245-1", type: "visit.check_in", actor: "Evan Torres · entered name", at: "2026-05-18T14:15:00.000Z", summary: "Verified QR check-in · 42 m from store", detail: "Browser accuracy 19 m." },
  { id: "audit-8", entityType: "visit", entityId: "visit-0245-1", type: "visit.check_out", actor: "Evan Torres · entered name", at: "2026-05-18T15:02:00.000Z", summary: "Diagnosed — unresolved", detail: "Verified checkout · 47 minute onsite span." },
  { id: "audit-9", entityType: "follow_up", entityId: "followup-0245-repair-plan", type: "follow_up.created", actor: "Clark's Operations rule", at: "2026-05-18T15:02:00.000Z", summary: "Facilities follow-up created automatically", detail: "Contact vendor and document repair plan · due 5:00 PM." },
  { id: "audit-10", entityType: "follow_up", entityId: "followup-0245-repair-plan", type: "follow_up.completed", actor: "Samira Patel · Facilities", at: "2026-05-18T16:11:00.000Z", summary: "Repair plan documented; quote requested" },
  { id: "audit-11", entityType: "work_order", entityId: STORY_WORK_ORDER_ID, type: "work_order.reclassified", actor: "Samira Patel · Facilities", at: "2026-05-18T16:14:00.000Z", summary: "Mapped to Beer Cave Refrigeration", detail: "Prior: Store 45 + Refrigeration · New: Beer Cave Refrigeration." },
  { id: "audit-12", entityType: "work_order", entityId: STORY_WORK_ORDER_ID, type: "work_order.reclassified", actor: "Samira Patel · Facilities", at: "2026-05-18T16:16:00.000Z", summary: "Mapped to Condensing Unit CU-1", detail: "Diagnostic visit supplied the physical asset." },
  { id: "audit-13", entityType: "work_order", entityId: STORY_WORK_ORDER_ID, type: "work_order.reclassified", actor: "Samira Patel · Facilities", at: "2026-05-19T13:20:00.000Z", summary: "Mapped to Condenser Fan Motor", detail: "Quote identified the component; prior mappings remain in audit history." },
  { id: "audit-14", entityType: "visit", entityId: "visit-0245-2", type: "visit.check_out", actor: "Evan Torres · entered name", at: "2026-05-22T14:06:00.000Z", summary: "Completed — issue resolved", detail: "Verified return visit · 2 hour 6 minute onsite span." },
  { id: "audit-15", entityType: "invoice", entityId: "invoice-wo-0245", type: "invoice.allocated", actor: "Nora Chen · AP Review", at: "2026-05-24T14:30:00.000Z", summary: "$4,950 invoice fully allocated", detail: "$3,100 to CU-1 labor; $1,850 to fan motor parts. Company, store, system, asset and component rollups updated." },
  { id: "audit-16", entityType: "work_order", entityId: STORY_WORK_ORDER_ID, type: "work_order.closed", actor: "Jordan Lee · Store Manager", at: "2026-05-24T16:30:00.000Z", summary: "Store verified temperature restored; work order closed" },
];

credits.push({ id: "credit-57-1", invoiceId: "invoice-wo-57-7", amountCents: 38_000, status: "potential", issuedAt: "2026-07-22T14:00:00.000Z" });

export const demoData: DemoData = {
  organization: { id: "org-clarks", name: "Clark's Operations" },
  regions,
  stores,
  categories,
  systems,
  assets,
  components,
  vendors,
  technicians,
  reports,
  reportReviews,
  workOrders,
  checklistItems,
  laborEntries,
  partsUsed,
  workOrderNotes,
  vendorResponses,
  visits,
  followUps,
  pmPlans,
  pmOccurrences,
  quotes,
  authorizations,
  invoices,
  credits,
  allocations,
  documents,
  auditEvents,
};

if (demoData.stores.length !== 65 || demoData.workOrders.length !== 536) {
  throw new Error(`Deterministic seed expected 65 stores and 536 work orders; received ${demoData.stores.length} stores and ${demoData.workOrders.length} work orders`);
}
