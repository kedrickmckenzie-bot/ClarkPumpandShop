import { demoData } from "@/lib/demo/data";
import type {
  Asset,
  Component,
  CostAllocation,
  DemoData,
  Invoice,
  LaborEntry,
  PartUsage,
  ServiceCategory,
  StoreSystem,
  Vendor,
  WorkOrder,
} from "@/lib/domain/types";

export const PLATFORM_NOW = "2026-08-05T14:00:00.000Z";

const additionalCategories: ServiceCategory[] = [
  { id: "unclassified", name: "Unclassified / Needs Triage", color: "#7a8582" },
  { id: "grounds", name: "Landscaping & Grounds", color: "#4f7651" },
  { id: "snow", name: "Snow & Ice", color: "#5f7f9b" },
  { id: "janitorial", name: "Janitorial", color: "#7c6c96" },
  { id: "pest", name: "Pest Control", color: "#8a6f45" },
  { id: "signage", name: "Signage & Branding", color: "#a24d56" },
  { id: "waste", name: "Waste & Recycling", color: "#4e7470" },
];

const additionalVendors: Vendor[] = [
  { id: "vendor-evergreen", name: "Evergreen Grounds & Snow", shortName: "Evergreen", trade: "Landscaping, snow & ice", dispatchEmail: "dispatch@evergreen-demo.example", accent: "#4f7651" },
  { id: "vendor-cleansweep", name: "CleanSweep Facility Care", shortName: "CleanSweep", trade: "Janitorial", dispatchEmail: "service@cleansweep-demo.example", accent: "#7c6c96" },
  { id: "vendor-guardian-pest", name: "Guardian Pest Solutions", shortName: "Guardian Pest", trade: "Pest management", dispatchEmail: "service@guardianpest-demo.example", accent: "#8a6f45" },
  { id: "vendor-signworks", name: "SignWorks Brand Services", shortName: "SignWorks", trade: "Signage & lighting", dispatchEmail: "workorders@signworks-demo.example", accent: "#a24d56" },
  { id: "vendor-circular", name: "Circular Waste Services", shortName: "Circular", trade: "Waste & recycling", dispatchEmail: "dispatch@circular-demo.example", accent: "#4e7470" },
];

const systemDefinitions = [
  ["grounds", "GROUNDS", "Grounds & Landscape", "Landscape zones, turf and hardscape", "Exterior site", 6180, 640_000],
  ["snow", "SNOW", "Snow & Ice", "Plowing, salting and walkway treatment", "Parking and walks", 6185, 820_000],
  ["janitorial", "JAN", "Janitorial Services", "Interior cleaning and consumable service", "Whole store", 6190, 780_000],
  ["pest", "PEST", "Pest Management", "Inspection, prevention and response", "Interior and exterior", 6195, 260_000],
  ["signage", "SIGN", "Signage & Branding", "Canopy, pylon and building signs", "Building and forecourt", 6200, 520_000],
  ["waste", "WASTE", "Waste & Recycling", "Containers, compactors and scheduled service", "Service yard", 6205, 690_000],
] as const;

const additionalSystems: StoreSystem[] = demoData.stores.flatMap((store, storeIndex) =>
  systemDefinitions.map(([categoryId, suffix, name, type, location, glCode, budget], definitionIndex) => ({
    id: `sys-${store.code}-${categoryId}`,
    storeId: store.id,
    categoryId,
    name,
    type,
    code: `${store.code}-${suffix}`,
    description: `${name} service scope for ${store.name}.`,
    location,
    glCode: String(glCode),
    annualBudgetCents: budget + ((storeIndex + definitionIndex) % 5) * 35_000,
    ownerName: store.managerName,
    maintenanceStrategy: categoryId === "snow" || categoryId === "grounds" ? "condition_based" : "preventive",
    state: (storeIndex + definitionIndex) % 29 === 0 ? "watch" : "normal",
  })),
);

const configuredSystems = [...demoData.systems, ...additionalSystems];
const systemIdByStoreAndCategory = new Map<string, string>();

configuredSystems.forEach((system) => {
  const key = `${system.storeId}:${system.categoryId}`;
  if (systemIdByStoreAndCategory.has(key)) {
    throw new Error(`Expected one configured system for ${key}`);
  }
  systemIdByStoreAndCategory.set(key, system.id);
});

function systemIdFor(storeId: string, categoryId: string): string {
  const id = systemIdByStoreAndCategory.get(`${storeId}:${categoryId}`);
  if (!id) throw new Error(`Missing configured system for ${storeId}:${categoryId}`);
  return id;
}

const deepRefrigerationAssets: Asset[] = [
  {
    id: "asset-45-ref-beer-cave",
    storeSystemId: "sys-45-ref",
    assetClass: "Walk-In Cooler",
    name: "Beer Cave Walk-In Cooler",
    manufacturer: "Hussmann",
    model: "BCR-18X24",
    serial: "HUS-45-BC-2015",
    assetTag: "45-WIC-01",
    location: "Rear sales floor",
    condition: "poor",
    purchaseCostCents: 2_480_000,
    purchaseDate: "2015-04-28",
    supplierName: "Mid-Atlantic Refrigeration Supply",
    supplierContact: "equipment@midatlantic-demo.example · (412) 555-0194",
    lastServiceAt: "2026-05-24",
    maintenanceStrategy: "preventive",
    meterType: "runtime_hours",
    meterReading: 36_820,
    installedAt: "2015-05-18",
    expectedLifeYears: 15,
    replacementCostCents: 4_250_000,
    warrantyProvider: "Hussmann Commercial Products",
    warrantyReference: "HUS-WTY-BC-45018",
    warrantySummary: "Original five-year parts coverage expired. Compressor replacement carries a separate one-year parts warranty.",
    warrantyEndsAt: "2020-05-18",
    criticality: "critical",
    state: "watch",
  },
  {
    id: "asset-45-ref-reachin-01",
    storeSystemId: "sys-45-ref",
    assetClass: "Reach-In Cooler",
    name: "Beverage Cooler RC-1",
    manufacturer: "True",
    model: "GDM-72",
    serial: "TRU-45-RC1-2021",
    assetTag: "45-RIC-01",
    location: "Front sales floor",
    condition: "good",
    purchaseCostCents: 860_000,
    purchaseDate: "2021-03-22",
    supplierName: "Allegheny Food Equipment",
    supplierContact: "service@afe-demo.example · (724) 555-0148",
    lastServiceAt: "2026-06-19",
    maintenanceStrategy: "preventive",
    meterType: "runtime_hours",
    meterReading: 11_240,
    installedAt: "2021-04-09",
    expectedLifeYears: 12,
    replacementCostCents: 1_280_000,
    warrantyProvider: "True Manufacturing",
    warrantyReference: "TRUE-GDM72-4521",
    warrantySummary: "Five-year compressor coverage; labor coverage expired after year two.",
    warrantyEndsAt: "2026-04-09",
    criticality: "high",
    state: "operational",
  },
  {
    id: "asset-45-ref-freezer-01",
    storeSystemId: "sys-45-ref",
    assetClass: "Reach-In Freezer",
    name: "Frozen Foods Freezer FZ-1",
    manufacturer: "Hussmann",
    model: "RLN-3",
    serial: "HUS-45-FZ1-2019",
    assetTag: "45-FZR-01",
    location: "Center aisle",
    condition: "fair",
    purchaseCostCents: 1_180_000,
    purchaseDate: "2019-08-29",
    supplierName: "Mid-Atlantic Refrigeration Supply",
    supplierContact: "equipment@midatlantic-demo.example · (412) 555-0194",
    lastServiceAt: "2026-07-11",
    maintenanceStrategy: "preventive",
    meterType: "runtime_hours",
    meterReading: 18_760,
    installedAt: "2019-09-14",
    expectedLifeYears: 12,
    replacementCostCents: 1_780_000,
    warrantyProvider: "Hussmann Commercial Products",
    warrantyReference: "HUS-RLN3-4519",
    warrantySummary: "Standard parts and labor coverage expired; controller installed in 2025 remains under vendor parts warranty.",
    warrantyEndsAt: "2024-09-14",
    criticality: "critical",
    state: "service_due",
  },
  {
    id: "asset-45-ref-ice-01",
    storeSystemId: "sys-45-ref",
    assetClass: "Ice Machine",
    name: "Beverage Station Ice Machine IM-1",
    manufacturer: "Manitowoc",
    model: "IYT0750A",
    serial: "MAN-45-IM1-2022",
    assetTag: "45-ICE-01",
    location: "Beverage station",
    condition: "good",
    purchaseCostCents: 740_000,
    purchaseDate: "2022-01-30",
    supplierName: "Apex Food Equipment Service",
    supplierContact: "dispatch@apex-demo.example · (412) 555-0182",
    lastServiceAt: "2026-07-02",
    maintenanceStrategy: "preventive",
    meterType: "cycles",
    meterReading: 14_480,
    installedAt: "2022-02-18",
    expectedLifeYears: 10,
    replacementCostCents: 1_050_000,
    warrantyProvider: "Manitowoc Ice",
    warrantyReference: "MAN-IYT-4522",
    warrantySummary: "Parts-and-labor coverage through February 2027 when preventive cleaning records are maintained.",
    warrantyEndsAt: "2027-02-18",
    criticality: "high",
    state: "operational",
  },
];

const deepComponents: Component[] = [
  ["component-45-beer-compressor", "asset-45-ref-beer-cave", "Compressor", "Scroll Compressor A", "ZB45KCE-TFD", 565_000, false],
  ["component-45-beer-evapfan", "asset-45-ref-beer-cave", "Evaporator Fan", "Evaporator Fan Motor 1", "MTR-ECM-825", 142_000, true],
  ["component-45-beer-controller", "asset-45-ref-beer-cave", "Controller", "Temperature Controller", "DIX-XR60CX", 48_500, true],
  ["component-45-beer-door", "asset-45-ref-beer-cave", "Door Heater", "Entry Door Anti-Sweat Heater", "HTR-120-BC", 36_000, false],
  ["component-45-reachin-compressor", "asset-45-ref-reachin-01", "Compressor", "Self-Contained Compressor", "TUC-27-CMP", 188_000, false],
  ["component-45-freezer-controller", "asset-45-ref-freezer-01", "Controller", "Electronic Case Controller", "CPC-E2", 92_000, true],
  ["component-45-freezer-fan", "asset-45-ref-freezer-01", "Evaporator Fan", "Freezer Evaporator Fan", "ECM-FZ-220", 158_000, true],
  ["component-45-ice-pump", "asset-45-ref-ice-01", "Water Pump", "Recirculation Pump", "MAN-2007399", 64_000, true],
] .map(([id, assetId, type, name, partNumber, unitCostCents, criticalSpare], index) => ({
  id: String(id),
  assetId: String(assetId),
  type: String(type),
  name: String(name),
  partNumber: String(partNumber),
  serial: `C45-${index + 1}-2026`,
  quantity: 1,
  unitCostCents: Number(unitCostCents),
  criticalSpare: Boolean(criticalSpare),
  installedAt: index < 4 ? "2024-05-18" : "2022-04-09",
  warrantyEndsAt: index < 4 ? "2027-05-18" : "2026-12-31",
  vendorId: index % 2 ? "vendor-valley" : "vendor-northstar",
}));

type BroadStory = {
  id: string;
  number: string;
  storeId: string;
  categoryId: string;
  title: string;
  description: string;
  assignmentType: "internal" | "vendor" | "blended";
  assignedToId: string;
  assignedToName: string;
  vendorId?: string;
  status: WorkOrder["status"];
  priority: WorkOrder["priority"];
  createdAt: string;
  dueAt?: string;
  amountCents: number;
};

const broadStories: BroadStory[] = [
  { id: "wo-wide-snow-01", number: "CWO-0312", storeId: "store-12", categoryId: "snow", title: "Pretreat lot before overnight freeze", description: "Apply brine to drive lanes, ADA spaces and primary walkways before the forecast freeze.", assignmentType: "vendor", assignedToId: "vendor-evergreen", assignedToName: "Evergreen Grounds & Snow", vendorId: "vendor-evergreen", status: "accepted", priority: "high", createdAt: "2026-01-18T16:12:00.000Z", dueAt: "2026-01-18T23:00:00.000Z", amountCents: 164_000 },
  { id: "wo-wide-landscape-01", number: "CWO-0318", storeId: "store-45", categoryId: "grounds", title: "Replace failed parking-lot trees", description: "Remove three dead trees, verify utility markings and install approved replacements with mulch rings.", assignmentType: "vendor", assignedToId: "vendor-evergreen", assignedToName: "Evergreen Grounds & Snow", vendorId: "vendor-evergreen", status: "waiting_on_quote", priority: "routine", createdAt: "2026-07-27T13:25:00.000Z", dueAt: "2026-08-07T21:00:00.000Z", amountCents: 485_000 },
  { id: "wo-wide-jan-01", number: "CWO-0321", storeId: "store-72", categoryId: "janitorial", title: "Emergency floor recovery after cooler leak", description: "Extract standing water, clean affected aisle and document slip-hazard controls after refrigeration leak.", assignmentType: "blended", assignedToId: "vendor-cleansweep", assignedToName: "CleanSweep + Store Team", vendorId: "vendor-cleansweep", status: "completed_pending_verification", priority: "critical", createdAt: "2026-08-03T10:18:00.000Z", dueAt: "2026-08-03T15:00:00.000Z", amountCents: 128_000 },
  { id: "wo-wide-pest-01", number: "CWO-0324", storeId: "store-104", categoryId: "pest", title: "Investigate activity near receiving door", description: "Inspect receiving, waste and foodservice transition zones; document findings and corrective actions.", assignmentType: "vendor", assignedToId: "vendor-guardian-pest", assignedToName: "Guardian Pest Solutions", vendorId: "vendor-guardian-pest", status: "follow_up_required", priority: "high", createdAt: "2026-07-31T14:05:00.000Z", dueAt: "2026-08-04T18:00:00.000Z", amountCents: 76_000 },
  { id: "wo-wide-sign-01", number: "CWO-0327", storeId: "store-133", categoryId: "signage", title: "Pylon price digit module intermittent", description: "Diagnose intermittent LED module and verify cabinet seals, disconnect and controller communications.", assignmentType: "vendor", assignedToId: "vendor-signworks", assignedToName: "SignWorks Brand Services", vendorId: "vendor-signworks", status: "awaiting_vendor_acceptance", priority: "high", createdAt: "2026-08-05T11:04:00.000Z", dueAt: "2026-08-05T17:00:00.000Z", amountCents: 235_000 },
  { id: "wo-wide-waste-01", number: "CWO-0330", storeId: "store-150", categoryId: "waste", title: "Compactor will not cycle", description: "Inspect interlock, hydraulic power unit and container connection; restore safe operation or isolate.", assignmentType: "internal", assignedToId: "tech-eli", assignedToName: "Eli Turner", status: "visit_active", priority: "high", createdAt: "2026-08-05T12:41:00.000Z", dueAt: "2026-08-05T20:00:00.000Z", amountCents: 92_000 },
  { id: "wo-wide-plumbing-int", number: "CWO-0333", storeId: "store-57", categoryId: "plumbing", title: "Replace failed restroom flush valve", description: "Internal maintenance assignment with fixture isolation, replacement and leak verification checklist.", assignmentType: "internal", assignedToId: "tech-devon", assignedToName: "Devon Hayes", status: "completed_pending_verification", priority: "routine", createdAt: "2026-08-04T13:10:00.000Z", dueAt: "2026-08-05T16:00:00.000Z", amountCents: 38_500 },
  { id: "wo-wide-electrical-int", number: "CWO-0336", storeId: "store-31", categoryId: "electrical", title: "Replace canopy photocell", description: "Internal electrician to replace failed photocell and verify override and dusk operation.", assignmentType: "internal", assignedToId: "tech-tia", assignedToName: "Tia Bennett", status: "closed", priority: "routine", createdAt: "2026-07-18T12:30:00.000Z", amountCents: 24_800 },
];

const broadWorkOrders: WorkOrder[] = broadStories.map((story) => {
  const travelCostCents = story.vendorId ? Math.round(story.amountCents * 0.1) : 0;
  const laborCostCents = Math.round(
    story.amountCents * (story.assignmentType === "internal" ? 0.65 : 0.62),
  );
  const partsCostCents = story.amountCents - laborCostCents - travelCostCents;
  const completed = story.status === "closed" || story.status === "completed_pending_verification";
  const actualHours = completed
    ? story.assignmentType === "internal"
      ? laborCostCents / 9_500
      : 1.8
    : undefined;

  return {
    id: story.id,
    number: story.number,
    title: story.title,
    description: story.description,
    origin: "manager",
    storeId: story.storeId,
    categoryId: story.categoryId,
    systemId: systemIdFor(story.storeId, story.categoryId),
    priority: story.priority,
    workType: story.categoryId === "snow" || story.categoryId === "janitorial" ? "emergency" : story.assignmentType === "internal" ? "internal" : "reactive",
    status: story.status,
    accountableParty: story.assignedToName,
    assignmentType: story.assignmentType,
    assignedToId: story.assignedToId,
    assignedToName: story.assignedToName,
    nextAction: story.status === "waiting_on_quote" ? "Submit and review proposal" : story.status === "awaiting_vendor_acceptance" ? "Accept, decline or request clarification" : story.status === "completed_pending_verification" ? "Manager verifies completion" : story.status === "follow_up_required" ? "Complete corrective-action plan" : story.status === "closed" ? "Complete" : "Update work status",
    dueAt: story.dueAt,
    escalation: "Facilities Operations Manager",
    vendorId: story.vendorId,
    vendorAcceptance: story.vendorId ? (story.status === "awaiting_vendor_acceptance" ? "pending" : "accepted") : "not_issued",
    createdAt: story.createdAt,
    requestedServiceAt: story.createdAt,
    scheduledStartAt: story.dueAt,
    estimatedHours: story.assignmentType === "internal" ? 1.5 : 2.5,
    actualHours,
    laborCostCents,
    partsCostCents,
    travelCostCents,
    nteCents: Math.max(100_000, Math.ceil(story.amountCents / 50_000) * 50_000),
    costExposureCents: story.status === "closed" ? 0 : story.amountCents,
    reportIds: [],
  };
});

const completedInternalWorkOrders = broadWorkOrders.filter(
  (workOrder) =>
    workOrder.assignmentType === "internal" &&
    (workOrder.status === "closed" || workOrder.status === "completed_pending_verification"),
);

const broadInternalLaborEntries: LaborEntry[] = completedInternalWorkOrders.map((workOrder) => {
  const regularHours = workOrder.actualHours ?? 0;
  return {
    id: `labor-${workOrder.id}-internal`,
    workOrderId: workOrder.id,
    technicianId: workOrder.assignedToId!,
    technicianName: workOrder.assignedToName!,
    startedAt: workOrder.createdAt,
    endedAt: new Date(new Date(workOrder.createdAt).getTime() + regularHours * 3_600_000).toISOString(),
    regularHours,
    overtimeHours: 0,
    hourlyRateCents: 9_500,
    notes: "Internal maintenance labor recorded against the Clark's work order.",
  };
});

const broadInternalPartsUsed: PartUsage[] = completedInternalWorkOrders.map((workOrder) => {
  const categoryName = [...demoData.categories, ...additionalCategories].find(
    (category) => category.id === workOrder.categoryId,
  )?.name ?? workOrder.categoryId;
  return {
    id: `part-${workOrder.id}-internal-materials`,
    workOrderId: workOrder.id,
    partNumber: `INTERNAL-${workOrder.categoryId.toUpperCase()}`,
    description: `${categoryName} repair materials`,
    quantity: 1,
    unitCostCents: workOrder.partsCostCents ?? 0,
    source: "truck_stock",
    recordedBy: workOrder.assignedToName!,
    recordedAt: workOrder.dueAt ?? workOrder.createdAt,
  };
});

const broadInvoices: Invoice[] = broadStories
  .filter(
    (story): story is BroadStory & { vendorId: string } =>
      Boolean(story.vendorId) && ["closed", "completed_pending_verification"].includes(story.status),
  )
  .map((story, index) => ({
    id: `invoice-${story.id}`,
    workOrderId: story.id,
    vendorId: story.vendorId,
    number: `RMI-${20260 + index}`,
    totalCents: story.amountCents,
    status: story.status === "closed" ? "paid" : "review",
    issuedAt: story.createdAt,
    paidAt: story.status === "closed" ? "2026-08-01T14:00:00.000Z" : undefined,
  }));

const broadAllocations: CostAllocation[] = broadInvoices.map((invoice) => {
  const story = broadStories.find((candidate) => candidate.id === invoice.workOrderId)!;
  return {
    id: `allocation-${invoice.id}`,
    invoiceId: invoice.id,
    workOrderId: story.id,
    storeId: story.storeId,
    categoryId: story.categoryId,
    systemId: systemIdFor(story.storeId, story.categoryId),
    amountCents: story.amountCents,
    workClass: story.assignmentType === "internal" ? "internal" : story.categoryId === "janitorial" ? "emergency" : "reactive",
    costCategory: story.assignmentType === "internal" ? "parts" : "labor",
  };
});

const deepAssetWork: WorkOrder[] = [
  {
    id: "wo-45-beer-cave-2026",
    number: "CWO-0301",
    title: "Beer cave temperature recovery slow",
    description: "Trend temperature recovery, inspect door seals and confirm controller setpoint before component replacement.",
    origin: "manager",
    storeId: "store-45",
    categoryId: "refrigeration",
    systemId: "sys-45-ref",
    assetId: "asset-45-ref-beer-cave",
    componentId: "component-45-beer-controller",
    priority: "high",
    workType: "reactive",
    status: "closed",
    accountableParty: "NorthStar",
    assignmentType: "vendor",
    assignedToId: "vendor-northstar",
    assignedToName: "NorthStar Mechanical Services",
    nextAction: "Complete",
    escalation: "Facilities Director",
    vendorId: "vendor-northstar",
    vendorAcceptance: "accepted",
    createdAt: "2026-06-18T13:10:00.000Z",
    closedAt: "2026-06-19T19:35:00.000Z",
    actualHours: 2.3,
    laborCostCents: 172_000,
    partsCostCents: 48_500,
    travelCostCents: 35_000,
    nteCents: 300_000,
    costExposureCents: 0,
    reportIds: [],
  },
  {
    id: "wo-45-freezer-controller",
    number: "CWO-0307",
    title: "Freezer FZ-1 controller alarm",
    description: "Intermittent probe alarm. Verify sensor resistance, controller inputs and case temperature before replacement.",
    origin: "employee_report",
    storeId: "store-45",
    categoryId: "refrigeration",
    systemId: "sys-45-ref",
    assetId: "asset-45-ref-freezer-01",
    componentId: "component-45-freezer-controller",
    priority: "critical",
    workType: "emergency",
    status: "follow_up_required",
    accountableParty: "Marcus Bell",
    assignmentType: "blended",
    assignedToId: "tech-marcus",
    assignedToName: "Marcus Bell + Valley Refrigeration",
    nextAction: "Confirm controller availability and return date",
    dueAt: "2026-08-05T18:00:00.000Z",
    escalation: "Facilities Director",
    vendorId: "vendor-valley",
    vendorAcceptance: "accepted",
    createdAt: "2026-08-02T12:46:00.000Z",
    requestedServiceAt: "2026-08-02T13:00:00.000Z",
    estimatedHours: 3,
    laborCostCents: 0,
    partsCostCents: 0,
    travelCostCents: 0,
    nteCents: 450_000,
    costExposureCents: 388_000,
    reportIds: [],
  },
];

const deepInvoices: Invoice[] = [{ id: "invoice-wo-45-beer-cave-2026", workOrderId: "wo-45-beer-cave-2026", vendorId: "vendor-northstar", number: "NS-90112", totalCents: 255_500, status: "paid", issuedAt: "2026-06-20T13:00:00.000Z", paidAt: "2026-07-15T13:00:00.000Z" }];
const deepAllocations: CostAllocation[] = [
  { id: "allocation-wo-45-beer-cave-labor", invoiceId: "invoice-wo-45-beer-cave-2026", workOrderId: "wo-45-beer-cave-2026", storeId: "store-45", categoryId: "refrigeration", systemId: "sys-45-ref", assetId: "asset-45-ref-beer-cave", amountCents: 207_000, workClass: "reactive", costCategory: "labor" },
  { id: "allocation-wo-45-beer-cave-part", invoiceId: "invoice-wo-45-beer-cave-2026", workOrderId: "wo-45-beer-cave-2026", storeId: "store-45", categoryId: "refrigeration", systemId: "sys-45-ref", assetId: "asset-45-ref-beer-cave", componentId: "component-45-beer-controller", amountCents: 48_500, workClass: "reactive", costCategory: "parts" },
];

/**
 * The product is sized for the pilot operator's 65 locations, but the public
 * showcase intentionally uses a smaller, story-rich portfolio. This keeps the
 * demo easy to understand while retaining three regions, every maintenance
 * trade, internal/vendor/blended fulfillment, and deep HVAC/R history.
 */
export const SHOWCASE_STORE_IDS = [
  "store-12",
  "store-18",
  "store-31",
  "store-45",
  "store-57",
  "store-63",
  "store-72",
  "store-84",
  "store-91",
  "store-104",
  "store-133",
  "store-150",
] as const;

const showcaseStoreIds = new Set<string>(SHOWCASE_STORE_IDS);
const showcaseStores = demoData.stores.filter((store) => showcaseStoreIds.has(store.id));
const showcaseSystems = configuredSystems.filter((system) =>
  showcaseStoreIds.has(system.storeId),
);
const showcaseSystemIds = new Set(showcaseSystems.map((system) => system.id));
const showcaseAssets = [...demoData.assets, ...deepRefrigerationAssets].filter((asset) =>
  showcaseSystemIds.has(asset.storeSystemId),
);
const showcaseAssetIds = new Set(showcaseAssets.map((asset) => asset.id));
const showcaseComponents = [...demoData.components, ...deepComponents].filter((component) =>
  showcaseAssetIds.has(component.assetId),
);
const showcaseComponentIds = new Set(showcaseComponents.map((component) => component.id));
const showcaseWorkOrders = [...demoData.workOrders, ...broadWorkOrders, ...deepAssetWork].filter(
  (workOrder) => showcaseStoreIds.has(workOrder.storeId),
);
const showcaseWorkOrderIds = new Set(showcaseWorkOrders.map((workOrder) => workOrder.id));
const showcaseReports = demoData.reports.filter((report) => showcaseStoreIds.has(report.storeId));
const showcaseReportIds = new Set(showcaseReports.map((report) => report.id));
const showcaseVisits = demoData.visits.filter((visit) => showcaseWorkOrderIds.has(visit.workOrderId));
const showcaseVisitIds = new Set(showcaseVisits.map((visit) => visit.id));
const showcaseFollowUps = demoData.followUps.filter((followUp) =>
  showcaseWorkOrderIds.has(followUp.workOrderId),
);
const showcaseFollowUpIds = new Set(showcaseFollowUps.map((followUp) => followUp.id));
const showcasePmOccurrences = demoData.pmOccurrences.filter((occurrence) =>
  showcaseStoreIds.has(occurrence.storeId),
);
const showcasePmIds = new Set([
  ...showcasePmOccurrences.map((occurrence) => occurrence.id),
  ...showcasePmOccurrences.map((occurrence) => occurrence.planId),
]);
const showcasePmPlans = demoData.pmPlans.filter((plan) =>
  showcasePmIds.has(plan.id) ||
  (plan.targetType === "store" && showcaseStoreIds.has(plan.targetId)) ||
  (plan.targetType === "system" && showcaseSystemIds.has(plan.targetId)) ||
  (["asset", "asset_class"].includes(plan.targetType) && showcaseAssetIds.has(plan.targetId)),
);
const showcaseInvoices = [...demoData.invoices, ...broadInvoices, ...deepInvoices].filter((invoice) =>
  showcaseWorkOrderIds.has(invoice.workOrderId),
);
const showcaseInvoiceIds = new Set(showcaseInvoices.map((invoice) => invoice.id));

export const platformData: DemoData = {
  ...demoData,
  stores: showcaseStores,
  categories: [...demoData.categories, ...additionalCategories],
  vendors: [...demoData.vendors, ...additionalVendors],
  systems: showcaseSystems,
  assets: showcaseAssets,
  components: showcaseComponents,
  reports: showcaseReports,
  reportReviews: demoData.reportReviews.filter((review) => showcaseReportIds.has(review.reportId)),
  workOrders: showcaseWorkOrders,
  checklistItems: demoData.checklistItems.filter((item) => showcaseWorkOrderIds.has(item.workOrderId)),
  laborEntries: [...demoData.laborEntries, ...broadInternalLaborEntries].filter((item) =>
    showcaseWorkOrderIds.has(item.workOrderId),
  ),
  partsUsed: [...demoData.partsUsed, ...broadInternalPartsUsed].filter((item) =>
    showcaseWorkOrderIds.has(item.workOrderId),
  ),
  workOrderNotes: demoData.workOrderNotes.filter((item) => showcaseWorkOrderIds.has(item.workOrderId)),
  vendorResponses: demoData.vendorResponses.filter((response) => showcaseWorkOrderIds.has(response.workOrderId)),
  visits: showcaseVisits,
  followUps: showcaseFollowUps,
  pmPlans: showcasePmPlans,
  pmOccurrences: showcasePmOccurrences,
  quotes: demoData.quotes.filter((quote) => showcaseWorkOrderIds.has(quote.workOrderId)),
  authorizations: demoData.authorizations.filter((authorization) => showcaseWorkOrderIds.has(authorization.workOrderId)),
  invoices: showcaseInvoices,
  credits: demoData.credits.filter((credit) => showcaseInvoiceIds.has(credit.invoiceId)),
  allocations: [...demoData.allocations, ...broadAllocations, ...deepAllocations].filter((allocation) =>
    showcaseWorkOrderIds.has(allocation.workOrderId),
  ),
  documents: demoData.documents.filter((document) =>
    (document.workOrderId ? showcaseWorkOrderIds.has(document.workOrderId) : false) ||
    (document.storeId ? showcaseStoreIds.has(document.storeId) : false) ||
    (document.systemId ? showcaseSystemIds.has(document.systemId) : false) ||
    (document.assetId ? showcaseAssetIds.has(document.assetId) : false) ||
    (document.componentId ? showcaseComponentIds.has(document.componentId) : false) ||
    (document.visitId ? showcaseVisitIds.has(document.visitId) : false),
  ),
  auditEvents: demoData.auditEvents.filter((event) =>
    (event.entityType === "report" && showcaseReportIds.has(event.entityId)) ||
    (event.entityType === "work_order" && showcaseWorkOrderIds.has(event.entityId)) ||
    (event.entityType === "visit" && showcaseVisitIds.has(event.entityId)) ||
    (event.entityType === "follow_up" && showcaseFollowUpIds.has(event.entityId)) ||
    (event.entityType === "pm" && showcasePmIds.has(event.entityId)) ||
    (event.entityType === "invoice" && showcaseInvoiceIds.has(event.entityId)) ||
    (event.entityType === "asset" && showcaseAssetIds.has(event.entityId)),
  ),
};

const assertUniqueIds = (
  label: string,
  records: readonly { id: string }[],
): void => {
  const ids = new Set<string>();
  records.forEach((record) => {
    if (!record.id || ids.has(record.id)) {
      throw new Error(`${label} requires a unique non-empty id; received ${record.id}`);
    }
    ids.add(record.id);
  });
};

const validatePlatformSeed = (): void => {
  const idCollections: ReadonlyArray<readonly [string, readonly { id: string }[]]> = [
    ["regions", platformData.regions],
    ["stores", platformData.stores],
    ["categories", platformData.categories],
    ["systems", platformData.systems],
    ["assets", platformData.assets],
    ["components", platformData.components],
    ["vendors", platformData.vendors],
    ["technicians", platformData.technicians],
    ["work orders", platformData.workOrders],
    ["labor entries", platformData.laborEntries],
    ["part usages", platformData.partsUsed],
    ["invoices", platformData.invoices],
    ["allocations", platformData.allocations],
  ];
  idCollections.forEach(([label, records]) => assertUniqueIds(label, records));

  const storeIds = new Set(platformData.stores.map((record) => record.id));
  const categoryIds = new Set(platformData.categories.map((record) => record.id));
  const vendorIds = new Set(platformData.vendors.map((record) => record.id));
  const technicianIds = new Set(platformData.technicians.map((record) => record.id));
  const reportIds = new Set(platformData.reports.map((record) => record.id));
  const systemById = new Map(platformData.systems.map((record) => [record.id, record]));
  const assetById = new Map(platformData.assets.map((record) => [record.id, record]));
  const componentById = new Map(platformData.components.map((record) => [record.id, record]));
  const workOrderById = new Map(platformData.workOrders.map((record) => [record.id, record]));
  const invoiceById = new Map(platformData.invoices.map((record) => [record.id, record]));

  platformData.systems.forEach((system) => {
    if (!storeIds.has(system.storeId) || !categoryIds.has(system.categoryId)) {
      throw new Error(`${system.id} has an invalid store or category parent`);
    }
  });
  platformData.assets.forEach((asset) => {
    if (!systemById.has(asset.storeSystemId)) {
      throw new Error(`${asset.id} has invalid system ${asset.storeSystemId}`);
    }
  });
  platformData.components.forEach((component) => {
    if (!assetById.has(component.assetId) || !vendorIds.has(component.vendorId)) {
      throw new Error(`${component.id} has an invalid asset or vendor parent`);
    }
  });

  const validateClassification = (
    label: string,
    storeId: string,
    categoryId: string,
    systemId?: string,
    assetId?: string,
    componentId?: string,
  ): void => {
    const system = systemId ? systemById.get(systemId) : undefined;
    const asset = assetId ? assetById.get(assetId) : undefined;
    const component = componentId ? componentById.get(componentId) : undefined;
    const physicalSystem = asset ? systemById.get(asset.storeSystemId) : system;

    if (!storeIds.has(storeId) || !categoryIds.has(categoryId)) {
      throw new Error(`${label} has an invalid store or category`);
    }
    if (systemId && !system) throw new Error(`${label} has invalid system ${systemId}`);
    if (assetId && !asset) throw new Error(`${label} has invalid asset ${assetId}`);
    if (componentId && !component) {
      throw new Error(`${label} has invalid component ${componentId}`);
    }
    if (system && (system.storeId !== storeId || system.categoryId !== categoryId)) {
      throw new Error(`${label} system does not belong to its store and category`);
    }
    if (
      physicalSystem &&
      (physicalSystem.storeId !== storeId || physicalSystem.categoryId !== categoryId)
    ) {
      throw new Error(`${label} asset does not belong to its store and category`);
    }
    if (system && asset && asset.storeSystemId !== system.id) {
      throw new Error(`${label} asset does not belong to its selected system`);
    }
    if (component && asset && component.assetId !== asset.id) {
      throw new Error(`${label} component does not belong to its selected asset`);
    }
    if (component && !asset) {
      const componentAsset = assetById.get(component.assetId);
      const componentSystem = componentAsset
        ? systemById.get(componentAsset.storeSystemId)
        : undefined;
      if (
        !componentSystem ||
        componentSystem.storeId !== storeId ||
        componentSystem.categoryId !== categoryId ||
        (system && componentSystem.id !== system.id)
      ) {
        throw new Error(`${label} component does not belong to its store and category`);
      }
    }
  };

  platformData.workOrders.forEach((workOrder) => {
    validateClassification(
      workOrder.id,
      workOrder.storeId,
      workOrder.categoryId,
      workOrder.systemId,
      workOrder.assetId,
      workOrder.componentId,
    );
    if (workOrder.vendorId && !vendorIds.has(workOrder.vendorId)) {
      throw new Error(`${workOrder.id} has invalid vendor ${workOrder.vendorId}`);
    }
    if (workOrder.assignmentType === "internal" && workOrder.vendorId) {
      throw new Error(`${workOrder.id} cannot assign internal work to a vendor`);
    }
    if (workOrder.reportIds.some((reportId) => !reportIds.has(reportId))) {
      throw new Error(`${workOrder.id} references a report outside the showcase`);
    }
  });
  platformData.laborEntries.forEach((entry) => {
    if (!workOrderById.has(entry.workOrderId) || !technicianIds.has(entry.technicianId)) {
      throw new Error(`${entry.id} has an invalid work order or technician parent`);
    }
  });
  platformData.partsUsed.forEach((usage) => {
    if (!workOrderById.has(usage.workOrderId)) {
      throw new Error(`${usage.id} has invalid work order ${usage.workOrderId}`);
    }
  });
  platformData.workOrders
    .filter(
      (workOrder) =>
        workOrder.assignmentType === "internal" &&
        (workOrder.status === "closed" ||
          workOrder.status === "completed_pending_verification"),
    )
    .forEach((workOrder) => {
      const laborCents = Math.round(
        platformData.laborEntries
          .filter((entry) => entry.workOrderId === workOrder.id)
          .reduce(
            (total, entry) =>
              total + (entry.regularHours + entry.overtimeHours) * entry.hourlyRateCents,
            0,
          ),
      );
      const materialsCents = platformData.partsUsed
        .filter((usage) => usage.workOrderId === workOrder.id)
        .reduce((total, usage) => total + usage.quantity * usage.unitCostCents, 0);
      if (
        laborCents !== (workOrder.laborCostCents ?? 0) ||
        materialsCents !== (workOrder.partsCostCents ?? 0)
      ) {
        throw new Error(`${workOrder.id} internal labor/material records do not reconcile`);
      }
    });
  platformData.invoices.forEach((invoice) => {
    const workOrder = workOrderById.get(invoice.workOrderId);
    if (!workOrder || !vendorIds.has(invoice.vendorId)) {
      throw new Error(`${invoice.id} has an invalid work order or vendor parent`);
    }
    if (workOrder.vendorId !== invoice.vendorId) {
      throw new Error(`${invoice.id} vendor does not match ${workOrder.id}`);
    }
  });
  platformData.allocations.forEach((allocation) => {
    const invoice = invoiceById.get(allocation.invoiceId);
    const workOrder = workOrderById.get(allocation.workOrderId);
    if (!invoice || !workOrder || invoice.workOrderId !== workOrder.id) {
      throw new Error(`${allocation.id} has an invalid invoice/work-order parent chain`);
    }
    if (
      allocation.storeId !== workOrder.storeId ||
      allocation.categoryId !== workOrder.categoryId
    ) {
      throw new Error(`${allocation.id} dimensions do not match ${workOrder.id}`);
    }
    validateClassification(
      allocation.id,
      allocation.storeId,
      allocation.categoryId,
      allocation.systemId,
      allocation.assetId,
      allocation.componentId,
    );
  });
};

validatePlatformSeed();

export const taxonomyConfiguration = {
  levelLabels: [
    { key: "category", defaultLabel: "Service category", organizationLabel: "Service category", example: "Refrigeration" },
    { key: "system", defaultLabel: "System / equipment group", organizationLabel: "Cost center", example: "Coolers & freezers" },
    { key: "asset", defaultLabel: "Asset", organizationLabel: "Equipment", example: "Beer Cave Walk-In Cooler" },
    { key: "component", defaultLabel: "Component", organizationLabel: "Serviceable component", example: "Temperature controller" },
  ],
  aliases: [
    { canonical: "Walk-In Cooler", aliases: ["Beer Cave", "Cold Box", "Walk-In", "WIC"] },
    { canonical: "Reach-In Cooler", aliases: ["Merchandiser", "Beverage Box", "RIC"] },
    { canonical: "Rooftop Unit", aliases: ["RTU", "Packaged Unit", "Roof Unit"] },
    { canonical: "Landscaping & Grounds", aliases: ["Grounds", "Landscape", "Exterior Care"] },
  ],
};

export const platformSummary = {
  stores: platformData.stores.length,
  pilotScaleStores: 65,
  categories: platformData.categories.length,
  systems: platformData.systems.length,
  assets: platformData.assets.length,
  components: platformData.components.length,
  workOrders: platformData.workOrders.length,
  vendors: platformData.vendors.length,
};
