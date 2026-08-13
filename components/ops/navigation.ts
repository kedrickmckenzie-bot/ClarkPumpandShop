import type { OperatorRole } from "./data-contract";

export type NavigationGroupId = "work" | "insights";

export interface NavigationItem {
  id: "home" | NavigationGroupId | "stores" | "vendors" | "reports";
  label: string;
  href: string;
  roles: OperatorRole[];
  matchPrefixes: string[];
}

export interface ContextualNavigationItem {
  id: string;
  label: string;
  href: string;
  roles: OperatorRole[];
}

export interface ContextualNavigationGroup {
  id: NavigationGroupId;
  label: string;
  items: ContextualNavigationItem[];
}

const allRoles: OperatorRole[] = [
  "executive",
  "facilities",
  "regional",
  "store_manager",
  "finance",
];

const operationsRoles: OperatorRole[] = [
  "executive",
  "facilities",
  "regional",
  "store_manager",
];

export const operatorNavigation: NavigationItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/app/overview",
    roles: allRoles,
    matchPrefixes: ["/app/overview"],
  },
  {
    id: "work",
    label: "Work",
    href: "/app/action-center",
    roles: allRoles,
    matchPrefixes: ["/app/action-center", "/app/requests", "/app/work-orders", "/app/visits"],
  },
  {
    id: "stores",
    label: "Stores",
    href: "/app/stores",
    roles: allRoles,
    matchPrefixes: ["/app/stores"],
  },
  {
    id: "vendors",
    label: "Vendors",
    href: "/app/vendors",
    roles: allRoles,
    matchPrefixes: ["/app/vendors"],
  },
  {
    id: "insights",
    label: "Insights",
    href: "/app/spend",
    roles: allRoles,
    matchPrefixes: ["/app/spend", "/app/equipment", "/app/pm", "/app/lifecycle", "/app/invoices"],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/app/reports",
    roles: allRoles,
    matchPrefixes: ["/app/reports"],
  },
];

export const contextualNavigation: ContextualNavigationGroup[] = [
  {
    id: "work",
    label: "Work",
    items: [
      { id: "needs-attention", label: "Needs attention", href: "/app/action-center", roles: allRoles },
      { id: "requests", label: "Requests", href: "/app/requests", roles: operationsRoles },
      { id: "work-orders", label: "Work orders", href: "/app/work-orders", roles: allRoles },
      { id: "visits", label: "Visits", href: "/app/visits", roles: operationsRoles },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { id: "spending", label: "Spending", href: "/app/spend", roles: allRoles },
      { id: "equipment", label: "Equipment", href: "/app/equipment", roles: [...operationsRoles, "finance"] },
      { id: "pm", label: "Preventive maintenance", href: "/app/pm", roles: operationsRoles },
      { id: "lifecycle", label: "Lifecycle & CapEx", href: "/app/lifecycle", roles: ["executive", "facilities", "regional", "finance"] },
    ],
  },
];

export function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navigationItemIsActive(item: NavigationItem, pathname: string) {
  return item.matchPrefixes.some((prefix) => pathMatches(pathname, prefix));
}

export function navigationForRole(role: OperatorRole) {
  return operatorNavigation.filter((item) => item.roles.includes(role));
}

export function contextualNavigationForPath(role: OperatorRole, pathname: string) {
  const primary = navigationForRole(role).find(
    (item) => (item.id === "work" || item.id === "insights") && navigationItemIsActive(item, pathname),
  );
  if (!primary || (primary.id !== "work" && primary.id !== "insights")) return undefined;

  const group = contextualNavigation.find((candidate) => candidate.id === primary.id);
  if (!group) return undefined;
  return {
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  };
}

export function roleLabel(role: OperatorRole) {
  const labels: Record<OperatorRole, string> = {
    executive: "Executive",
    facilities: "Facilities",
    regional: "Regional manager",
    store_manager: "Store manager",
    finance: "Finance",
  };
  return labels[role];
}
