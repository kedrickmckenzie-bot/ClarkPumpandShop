import type { OperatorRole } from "./data-contract";
import {
  roleCanAccessListRoute,
  roleCanAccessProgramRoute,
  roleCanSeePrimaryNavigation,
  roleCanSeeWorkNavigation,
  type OperatorWorkNavigationId,
} from "./role-policy";

export type PrimaryNavigationId =
  | "overview"
  | "work"
  | "stores"
  | "equipment"
  | "vendors"
  | "planning";

export type NavigationGroupId = "work" | "equipment" | "planning";

export interface NavigationItem {
  id: PrimaryNavigationId;
  label: string;
  href: string;
  matchPrefixes: string[];
  contextGroup?: NavigationGroupId;
}

export interface ContextualNavigationItem {
  id: string;
  label: string;
  href: string;
}

export interface ContextualNavigationGroup {
  id: NavigationGroupId;
  label: string;
  items: ContextualNavigationItem[];
}

/** The operator application has one stable, six-destination enterprise frame. */
export const operatorNavigation: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/app/overview",
    matchPrefixes: ["/app/overview"],
  },
  {
    id: "work",
    label: "Work",
    href: "/app/action-center",
    matchPrefixes: ["/app/action-center", "/app/requests", "/app/work-orders", "/app/estimates", "/app/visits"],
    contextGroup: "work",
  },
  {
    id: "stores",
    label: "Stores",
    href: "/app/stores",
    matchPrefixes: ["/app/stores"],
  },
  {
    id: "equipment",
    label: "Equipment",
    href: "/app/equipment",
    matchPrefixes: ["/app/equipment", "/app/pm"],
    contextGroup: "equipment",
  },
  {
    id: "vendors",
    label: "Vendors",
    href: "/app/vendors",
    matchPrefixes: ["/app/vendors"],
  },
  {
    id: "planning",
    label: "Spend & planning",
    href: "/app/spend",
    matchPrefixes: ["/app/spend", "/app/lifecycle", "/app/invoices", "/app/reports"],
    contextGroup: "planning",
  },
];

export const contextualNavigation: ContextualNavigationGroup[] = [
  {
    id: "work",
    label: "Work",
    items: [
      { id: "needs-attention", label: "Action center", href: "/app/action-center" },
      { id: "requests", label: "Requests", href: "/app/requests" },
      { id: "work-orders", label: "Work orders", href: "/app/work-orders" },
      { id: "estimates", label: "Bid requests", href: "/app/estimates" },
      { id: "visits", label: "Service visits", href: "/app/visits" },
    ],
  },
  {
    id: "equipment",
    label: "Equipment",
    items: [
      { id: "equipment", label: "Asset register", href: "/app/equipment" },
      { id: "pm", label: "Preventive maintenance", href: "/app/pm" },
    ],
  },
  {
    id: "planning",
    label: "Spend & planning",
    items: [
      { id: "spend", label: "Recorded spend", href: "/app/spend" },
      { id: "lifecycle", label: "Lifecycle planning", href: "/app/lifecycle" },
      { id: "invoice-review", label: "Invoice safeguards", href: "/app/invoices" },
      { id: "reports", label: "Reports", href: "/app/reports" },
    ],
  },
];

export function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navigationItemIsActive(item: NavigationItem, pathname: string) {
  return item.matchPrefixes.some((prefix) => pathMatches(pathname, prefix));
}

function roleCanSeeNavigationItem(role: OperatorRole, item: NavigationItem) {
  switch (item.id) {
    case "overview":
      return roleCanSeePrimaryNavigation(role, "home");
    case "work":
      return roleCanSeePrimaryNavigation(role, "work");
    case "stores":
      return roleCanSeePrimaryNavigation(role, "stores") && roleCanAccessListRoute(role, "stores");
    case "equipment":
      return roleCanSeePrimaryNavigation(role, "insights") && roleCanAccessProgramRoute(role, "equipment");
    case "vendors":
      return roleCanSeePrimaryNavigation(role, "vendors") && roleCanAccessListRoute(role, "vendors");
    case "planning":
      return (
        roleCanSeePrimaryNavigation(role, "insights") ||
        roleCanSeePrimaryNavigation(role, "reports")
      ) && (
        roleCanAccessProgramRoute(role, "spend") ||
        roleCanAccessListRoute(role, "reports")
      );
  }
}

function roleCanSeeContextItem(role: OperatorRole, groupId: NavigationGroupId, item: ContextualNavigationItem) {
  if (groupId === "work") {
    return roleCanSeeWorkNavigation(role, item.id as OperatorWorkNavigationId);
  }

  if (groupId === "equipment") {
    return item.id === "equipment"
      ? roleCanAccessProgramRoute(role, "equipment")
      : roleCanAccessProgramRoute(role, "pm");
  }

  if (item.id === "spend") return roleCanAccessProgramRoute(role, "spend");
  if (item.id === "lifecycle") return roleCanAccessProgramRoute(role, "lifecycle");
  if (item.id === "invoice-review") return roleCanAccessListRoute(role, "invoices");
  return roleCanAccessListRoute(role, "reports");
}

function visibleContextGroup(role: OperatorRole, groupId: NavigationGroupId) {
  const group = contextualNavigation.find((candidate) => candidate.id === groupId);
  if (!group) return undefined;
  return {
    ...group,
    items: group.items.filter((item) => roleCanSeeContextItem(role, group.id, item)),
  };
}

export function navigationForRole(role: OperatorRole) {
  return operatorNavigation
    .filter((item) => roleCanSeeNavigationItem(role, item))
    .map((item) => {
      if (!item.contextGroup) return item;
      const firstVisibleItem = visibleContextGroup(role, item.contextGroup)?.items[0];
      return firstVisibleItem ? { ...item, href: firstVisibleItem.href } : item;
    });
}

export function contextualNavigationForPath(role: OperatorRole, pathname: string) {
  const primary = navigationForRole(role).find(
    (item) => item.contextGroup && navigationItemIsActive(item, pathname),
  );
  if (!primary?.contextGroup) return undefined;

  const group = visibleContextGroup(role, primary.contextGroup);
  return group?.items.length ? group : undefined;
}

export function roleLabel(role: OperatorRole) {
  const labels: Record<OperatorRole, string> = {
    executive: "Executive",
    facilities: "Facilities",
    regional: "Regional manager",
    store_manager: "Store manager",
    finance: "Finance reviewer",
  };
  return labels[role];
}
