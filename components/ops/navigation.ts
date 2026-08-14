import type { OperatorRole } from "./data-contract";
import {
  roleCanSeeInsightsNavigation,
  roleCanSeePrimaryNavigation,
  roleCanSeeWorkNavigation,
  type OperatorInsightsNavigationId,
  type OperatorPrimaryNavigationId,
  type OperatorWorkNavigationId,
} from "./role-policy";

export type NavigationGroupId = "work" | "insights";

export interface NavigationItem {
  id: OperatorPrimaryNavigationId;
  label: string;
  href: string;
  matchPrefixes: string[];
}

export interface ContextualNavigationItem {
  id: OperatorWorkNavigationId | OperatorInsightsNavigationId;
  label: string;
  href: string;
}

export interface ContextualNavigationGroup {
  id: NavigationGroupId;
  label: string;
  items: ContextualNavigationItem[];
}

export const operatorNavigation: NavigationItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/app/overview",
    matchPrefixes: ["/app/overview"],
  },
  {
    id: "work",
    label: "Work",
    href: "/app/action-center",
    matchPrefixes: ["/app/action-center", "/app/requests", "/app/work-orders", "/app/visits", "/app/invoices"],
  },
  {
    id: "stores",
    label: "Stores",
    href: "/app/stores",
    matchPrefixes: ["/app/stores"],
  },
  {
    id: "vendors",
    label: "Vendors",
    href: "/app/vendors",
    matchPrefixes: ["/app/vendors"],
  },
  {
    id: "insights",
    label: "Insights",
    href: "/app/spend",
    matchPrefixes: ["/app/spend", "/app/equipment", "/app/pm", "/app/lifecycle"],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/app/reports",
    matchPrefixes: ["/app/reports"],
  },
];

export const contextualNavigation: ContextualNavigationGroup[] = [
  {
    id: "work",
    label: "Work",
    items: [
      { id: "needs-attention", label: "Needs attention", href: "/app/action-center" },
      { id: "requests", label: "Requests", href: "/app/requests" },
      { id: "work-orders", label: "Work orders", href: "/app/work-orders" },
      { id: "visits", label: "Visits", href: "/app/visits" },
      { id: "invoice-review", label: "Invoice review", href: "/app/invoices" },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    items: [
      { id: "spend", label: "Spend", href: "/app/spend" },
      { id: "equipment", label: "Equipment", href: "/app/equipment" },
      { id: "pm", label: "Preventive maintenance", href: "/app/pm" },
      { id: "lifecycle", label: "Lifecycle & CapEx", href: "/app/lifecycle" },
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
  return operatorNavigation
    .filter((item) => roleCanSeePrimaryNavigation(role, item.id))
    .map((item) => {
      if (item.id !== "work") return item;
      const firstWorkItem = contextualNavigation
        .find((group) => group.id === "work")
        ?.items.find((candidate) => roleCanSeeWorkNavigation(role, candidate.id as OperatorWorkNavigationId));
      return firstWorkItem ? { ...item, href: firstWorkItem.href } : item;
    });
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
    items: group.items.filter((item) => group.id === "work"
      ? roleCanSeeWorkNavigation(role, item.id as OperatorWorkNavigationId)
      : roleCanSeeInsightsNavigation(role, item.id as OperatorInsightsNavigationId)),
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
