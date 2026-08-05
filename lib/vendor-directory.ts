import type { Vendor } from "@/lib/domain/types";

export type VendorDirectoryProfile = {
  serviceGroup: string;
  summary: string;
  services: string[];
  aliases: string[];
  coverage: string;
};

const vendorProfiles: Record<string, VendorDirectoryProfile> = {
  "vendor-northstar": {
    serviceGroup: "HVAC & Refrigeration",
    summary: "Commercial climate and refrigeration service for critical store equipment.",
    services: ["HVAC repair", "Refrigeration repair", "Preventive maintenance", "Emergency service"],
    aliases: [
      "HVAC contractor",
      "air conditioning",
      "AC",
      "heating",
      "rooftop unit",
      "RTU",
      "cooler",
      "freezer",
      "beer cave",
      "walk-in",
      "reach-in",
      "compressor",
    ],
    coverage: "All operating regions · emergency response available",
  },
  "vendor-keystone": {
    serviceGroup: "HVAC",
    summary: "Comfort heating, cooling and ventilation service for retail facilities.",
    services: ["Air-conditioning repair", "Heating service", "RTU maintenance", "Controls and thermostats"],
    aliases: [
      "HVAC contractor",
      "air conditioning",
      "AC",
      "heating",
      "furnace",
      "ventilation",
      "rooftop unit",
      "RTU",
      "thermostat",
    ],
    coverage: "Eastern and Central regions",
  },
  "vendor-valley": {
    serviceGroup: "Refrigeration",
    summary: "Commercial refrigeration repair and planned service for cold-storage equipment.",
    services: ["Walk-in service", "Reach-in service", "Rack and condensing units", "Refrigeration PM"],
    aliases: [
      "refrigeration contractor",
      "refrigerator",
      "cooler",
      "freezer",
      "beer cave",
      "walk-in",
      "reach-in",
      "cold case",
      "compressor",
      "ice machine",
    ],
    coverage: "Central and Western regions",
  },
  "vendor-summit": {
    serviceGroup: "General Facilities",
    summary: "General building repairs and small facility projects across store interiors and exteriors.",
    services: ["Doors and hardware", "Walls and ceilings", "Carpentry", "General repairs"],
    aliases: [
      "facility contractor",
      "handyman",
      "building repair",
      "door repair",
      "lock",
      "drywall",
      "ceiling",
      "carpenter",
    ],
    coverage: "All operating regions",
  },
  "vendor-apex": {
    serviceGroup: "Foodservice Equipment",
    summary: "Repair and planned service for commercial hot-food and preparation equipment.",
    services: ["Ovens", "Fryers", "Grills and roller grills", "Hot-holding equipment"],
    aliases: [
      "food equipment",
      "kitchen equipment",
      "cooking equipment",
      "oven repair",
      "fryer repair",
      "grill repair",
      "warmer",
      "hot case",
    ],
    coverage: "All operating regions",
  },
  "vendor-flowrite": {
    serviceGroup: "Plumbing",
    summary: "Commercial plumbing service for water, waste and fixture problems.",
    services: ["Leak repair", "Drain clearing", "Fixture repair", "Water-heater service"],
    aliases: [
      "plumber",
      "plumbers",
      "plumbing contractor",
      "drain",
      "clogged drain",
      "leak",
      "leaking pipe",
      "toilet",
      "sink",
      "faucet",
      "sewer",
      "water heater",
    ],
    coverage: "All operating regions · urgent leak response",
  },
  "vendor-brightline": {
    serviceGroup: "Electrical & Controls",
    summary: "Commercial electrical, lighting and equipment-control troubleshooting.",
    services: ["Electrical repair", "Interior and exterior lighting", "Panels and breakers", "Equipment controls"],
    aliases: [
      "electrician",
      "electricians",
      "electrical contractor",
      "lights",
      "lighting",
      "outlet",
      "breaker",
      "electrical panel",
      "wiring",
      "controls",
    ],
    coverage: "All operating regions",
  },
  "vendor-forecourt": {
    serviceGroup: "Fuel & Forecourt",
    summary: "Specialized service for fuel-dispensing and forecourt equipment.",
    services: ["Fuel dispensers", "Pump controls", "Leak-detection equipment", "Forecourt diagnostics"],
    aliases: [
      "fuel contractor",
      "gas pump",
      "fuel pump",
      "dispenser",
      "forecourt",
      "fuel island",
      "pump not working",
      "tank monitor",
      "UST",
    ],
    coverage: "All operating regions · qualified fuel-system technicians",
  },
  "vendor-safeguard": {
    serviceGroup: "Fire & Life Safety",
    summary: "Inspection and service for fire protection, alarms and life-safety systems.",
    services: ["Fire alarms", "Fire extinguishers", "Suppression systems", "Emergency lighting"],
    aliases: [
      "fire protection",
      "life safety",
      "fire alarm",
      "fire extinguisher",
      "hood suppression",
      "security alarm",
      "emergency light",
      "annual inspection",
    ],
    coverage: "All operating regions",
  },
  "vendor-evergreen": {
    serviceGroup: "Grounds, Snow & Ice",
    summary: "Year-round exterior grounds care with seasonal snow and ice service.",
    services: ["Landscaping", "Mowing and grounds care", "Snow plowing", "Ice treatment"],
    aliases: [
      "landscaper",
      "landscaping contractor",
      "lawn care",
      "mowing",
      "trees",
      "shrubs",
      "snow removal",
      "snow plow",
      "salting",
      "ice",
      "sidewalk",
    ],
    coverage: "All operating regions · seasonal route coverage",
  },
  "vendor-cleansweep": {
    serviceGroup: "Janitorial",
    summary: "Routine and responsive cleaning for stores and support areas.",
    services: ["Janitorial service", "Floor care", "Spill response", "Deep cleaning"],
    aliases: [
      "janitor",
      "cleaner",
      "cleaning company",
      "custodial",
      "floor cleaning",
      "restroom cleaning",
      "spill cleanup",
      "pressure washing",
    ],
    coverage: "All operating regions",
  },
  "vendor-guardian-pest": {
    serviceGroup: "Pest Management",
    summary: "Inspection, prevention and corrective treatment for commercial pest activity.",
    services: ["Routine pest control", "Rodent control", "Insect treatment", "Corrective inspections"],
    aliases: [
      "exterminator",
      "pest control",
      "pest company",
      "rodent",
      "mice",
      "rat",
      "roach",
      "ants",
      "flies",
      "insects",
    ],
    coverage: "All operating regions",
  },
  "vendor-signworks": {
    serviceGroup: "Signage & Lighting",
    summary: "Repair and maintenance for exterior identity, pricing and illuminated signs.",
    services: ["Pylon signs", "Canopy signs", "LED modules", "Price displays"],
    aliases: [
      "sign company",
      "sign repair",
      "signage",
      "pylon",
      "canopy sign",
      "price sign",
      "LED sign",
      "sign lighting",
      "brand sign",
    ],
    coverage: "All operating regions",
  },
  "vendor-circular": {
    serviceGroup: "Waste & Recycling",
    summary: "Scheduled and responsive waste, recycling and container service.",
    services: ["Waste collection", "Recycling", "Dumpster service", "Compactor service"],
    aliases: [
      "waste company",
      "trash",
      "garbage",
      "trash pickup",
      "dumpster",
      "compactor",
      "recycling pickup",
      "missed pickup",
    ],
    coverage: "All operating regions",
  },
};

export function vendorDirectoryProfile(vendor: Vendor): VendorDirectoryProfile {
  const profile = vendorProfiles[vendor.id];
  if (profile) return profile;

  const trade = vendor.trade.trim() || "General maintenance";
  return {
    serviceGroup: trade,
    summary: `${vendor.name} provides ${trade.toLocaleLowerCase()} services.`,
    services: [trade],
    aliases: [vendor.shortName, `${trade} contractor`],
    coverage: "Coverage confirmed when service is requested",
  };
}

export function vendorSearchText(vendor: Vendor): string {
  const profile = vendorDirectoryProfile(vendor);
  return [
    vendor.name,
    vendor.shortName,
    vendor.trade,
    vendor.dispatchEmail,
    profile.serviceGroup,
    profile.summary,
    profile.coverage,
    ...profile.services,
    ...profile.aliases,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

export function vendorServiceGroups(vendors: Vendor[]): string[] {
  return [...new Set(vendors.map((vendor) => vendorDirectoryProfile(vendor).serviceGroup))].sort((left, right) =>
    left.localeCompare(right),
  );
}
