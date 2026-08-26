import type { DemoEdition } from "./data-contract";

export const DEFAULT_DEMO_EDITION: DemoEdition = "complete";

export const demoEditionPresentation: Record<DemoEdition, {
  label: string;
  shortLabel: string;
  description: string;
}> = {
  accountability: {
    label: "Vendor accountability",
    shortLabel: "Accountability",
    description: "Create vendor work orders and record technician check-in and checkout.",
  },
  complete: {
    label: "Complete platform",
    shortLabel: "Complete",
    description: "The connected maintenance, equipment, spending, PM, and planning suite.",
  },
};

const accountabilityPaths = [
  "/app/overview",
  "/app/work-orders",
  "/app/visits",
  "/app/stores",
  "/app/vendors",
  "/app/search",
] as const;

export function isDemoEdition(value: string | undefined): value is DemoEdition {
  return value === "accountability" || value === "complete";
}

export function demoEditionAllowsPath(edition: DemoEdition, href: string) {
  if (edition === "complete" || !href.startsWith("/app")) return true;
  const path = href.split(/[?#]/, 1)[0];
  return accountabilityPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
