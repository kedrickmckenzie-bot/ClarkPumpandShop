import type { DemoEdition, OperatorRole } from "./data-contract";
import { DEFAULT_DEMO_EDITION, demoEditionAllowsPath } from "./demo-edition";
import {
  roleCanAccessListRoute,
  roleCanAccessProgramRoute,
  roleCanSeePrimaryNavigation,
  roleCanSeeWorkNavigation,
  type OperatorWorkNavigationId,
} from "./role-policy";

export type PrimaryNavigationId =
  | "compliance"
  | "overview"
  | "work"
  | "stores"
  | "equipment"
  | "vendors"
  | "planning"
  | "history"
  | "search";

export type NavigationGroupId = "work" | "equipment" | "planning" | "stores" | "vendors";

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

/** Six manager sections; related pages stay in their sidebar section. */
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
    href: "/app/work-orders?status=open",
    matchPrefixes: ["/app/compliance", "/app/tasks", "/app/action-center", "/app/requests", "/app/work-orders", "/app/estimates", "/app/visits", "/app/dispatch", "/app/my-work"],
    contextGroup: "work",
  },
  {
    id: "stores",
    label: "Stores",
    href: "/app/stores",
    matchPrefixes: ["/app/stores"], contextGroup:"stores",
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
    matchPrefixes: ["/app/vendors", "/app/vendors/scorecards"], contextGroup:"vendors",
  },
  {
    id: "planning",
    label: "Spend & planning",
    href: "/app/trends",
    matchPrefixes: ["/app/trends", "/app/spend", "/app/lifecycle", "/app/warranties", "/app/invoices", "/app/reports"],
    contextGroup: "planning",
  },
];

export const contextualNavigation: ContextualNavigationGroup[] = [
  {id:"stores",label:"Stores",items:[{id:"stores",label:"Stores",href:"/app/stores"}]},
  {id:"vendors",label:"Vendors",items:[{id:"vendors",label:"Vendors",href:"/app/vendors"},{id:"vendor-scorecards",label:"Scorecards",href:"/app/vendors/scorecards"}]},
  {
    id: "work",
    label: "Work",
    items: [
      { id: "needs-attention", label: "Review", href: "/app/action-center" },
      { id: "dispatch", label: "Dispatch", href: "/app/dispatch" },
      { id: "work-orders", label: "Work orders", href: "/app/work-orders" },
      { id: "requests", label: "Requests", href: "/app/requests" },
      { id: "estimates", label: "Quotes", href: "/app/estimates" },
      { id: "visits", label: "Service visits", href: "/app/visits" },
      { id: "tasks", label: "Tasks", href: "/app/tasks" },
      { id: "compliance", label: "Compliance", href: "/app/compliance" },
    ],
  },
  {
    id: "equipment",
    label: "Equipment",
    items: [
      { id: "equipment", label: "Equipment", href: "/app/equipment" },
      { id: "pm", label: "Preventive maintenance", href: "/app/pm" },
    ],
  },
  {
    id: "planning",
    label: "Spend & planning",
    items: [
      { id: "trends", label: "Trends", href: "/app/trends" },
      { id: "spend", label: "Spending", href: "/app/spend" },
      { id: "lifecycle", label: "Repair or replace", href: "/app/lifecycle" },
      { id: "warranties", label: "Warranties", href: "/app/warranties" },
      { id: "invoice-review", label: "Invoices", href: "/app/invoices" },
      { id: "value-ledger", label: "Savings", href: "/app/reports/value" },
      { id: "reports", label: "Reports", href: "/app/reports" },
    ],
  },
];

export function pathMatches(pathname: string, href: string) {
  if(href === "/app/reports" && pathname.startsWith("/app/reports/value")) return false;
  if(href === "/app/vendors" && pathname.startsWith("/app/vendors/scorecards")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navigationItemIsActive(item: NavigationItem, pathname: string) {
  return item.matchPrefixes.some((prefix) => pathMatches(pathname, prefix));
}

function roleCanSeeNavigationItem(role: OperatorRole, item: NavigationItem) {
  if (role === "store_manager" && ["vendors", "planning", "compliance"].includes(item.id)) return false;
  switch (item.id) {
    case "history": case "search": return role==="technician";
    case "compliance":
      return ["facilities","regional","store_manager","executive","finance"].includes(role);
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
  if(groupId==="stores")return roleCanAccessListRoute(role,"stores");
  if(groupId==="vendors")return item.id==="vendor-scorecards" ? ["executive","facilities","regional"].includes(role) : roleCanAccessListRoute(role,"vendors");
  if (groupId === "work") {
    if(item.id==="compliance")return ["facilities","regional","executive","finance"].includes(role);
    return roleCanSeeWorkNavigation(role, item.id as OperatorWorkNavigationId);
  }

  if (groupId === "equipment") {
    return item.id === "equipment"
      ? roleCanAccessProgramRoute(role, "equipment")
      : roleCanAccessProgramRoute(role, "pm");
  }

  if (item.id === "spend") return roleCanAccessProgramRoute(role, "spend");
  if (item.id === "lifecycle") return roleCanAccessProgramRoute(role, "lifecycle");
  if (item.id === "warranties") return roleCanAccessListRoute(role, "warranties");
  if (item.id === "invoice-review") return roleCanAccessListRoute(role, "invoices");
  if (item.id === "value-ledger") return roleCanAccessListRoute(role, "reports");
  return roleCanAccessListRoute(role, "reports");
}

function visibleContextGroup(role: OperatorRole, groupId: NavigationGroupId, edition: DemoEdition) {
  const group = contextualNavigation.find((candidate) => candidate.id === groupId);
  if (!group) return undefined;
  return {
    ...group,
    items: group.items.filter((item) => {
      if (edition === "accountability" && group.id === "work" && !["work-orders", "visits"].includes(item.id)) {
        return false;
      }
      return roleCanSeeContextItem(role, group.id, item) && demoEditionAllowsPath(edition, item.href);
    }),
  };
}

export function navigationForRole(role: OperatorRole, edition: DemoEdition = DEFAULT_DEMO_EDITION) {
  if(role==="technician" && edition==="complete")return [
    {id:"work",label:"My work",href:"/app/my-work",matchPrefixes:["/app/my-work","/app/work-orders"]},
    {id:"stores",label:"Stores",href:"/app/stores",matchPrefixes:["/app/stores"]},
    {id:"equipment",label:"Equipment",href:"/app/equipment",matchPrefixes:["/app/equipment"]},
    {id:"history",label:"Work history",href:"/app/work-history",matchPrefixes:["/app/work-history"]},
    {id:"search",label:"Search",href:"/app/search",matchPrefixes:["/app/search"]},
  ] as NavigationItem[];
  return operatorNavigation
    .filter((item) => roleCanSeeNavigationItem(role, item) && (
      (edition === "accountability" && item.id === "work") || demoEditionAllowsPath(edition, item.href)
    ))
    .map((item) => {
      if (item.id === "overview" && role === "executive" && edition === "complete") {
        // One role-aware Overview slot: executives land on the Owner Brief.
        // /app/brief stays reachable for other roles via its secondary route.
        return { ...item, href: "/app/brief", matchPrefixes: ["/app/overview", "/app/brief"] };
      }
      if (item.id === "work" && edition === "accountability") {
        return {
          ...item,
          label: "Work orders",
          href: "/app/work-orders",
          matchPrefixes: ["/app/work-orders", "/app/visits"],
        };
      }
      // Technicians open Work on their own jobs.
      if (item.id === "work" && role === "technician") return { ...item, label: "My work", href: "/app/my-work" };
      if (item.id === "work" && roleCanAccessListRoute(role, "work-orders")) return item;
      if (!item.contextGroup) return item;
      const firstVisibleItem = visibleContextGroup(role, item.contextGroup, edition)?.items[0];
      return firstVisibleItem ? { ...item, href: firstVisibleItem.href } : item;
    });
}

export function navigationChildren(role:OperatorRole,item:NavigationItem,edition:DemoEdition) {
  return item.contextGroup ? visibleContextGroup(role,item.contextGroup,edition)?.items ?? [] : [];
}

export function contextualNavigationForPath(
  role: OperatorRole,
  pathname: string,
  edition: DemoEdition = DEFAULT_DEMO_EDITION,
) {
  const primary = navigationForRole(role, edition).find(
    (item) => item.contextGroup && navigationItemIsActive(item, pathname),
  );
  if (!primary?.contextGroup) return undefined;

  const group = visibleContextGroup(role, primary.contextGroup, edition);
  return group?.items.length ? group : undefined;
}

export function roleLabel(role: OperatorRole) {
  const labels: Record<OperatorRole, string> = {
    executive: "Owner / leadership",
    facilities: "Maintenance / facilities",
    regional: "Regional manager",
    store_manager: "Store manager",
    finance: "Invoice reviewer",
    technician: "Technician",
  };
  return labels[role];
}

/** The job name people see: a persona (for example "Field manager") wins over its underlying role. */
export function sessionRoleLabel(session: { role: OperatorRole; persona?: "field_manager" }) {
  return session.persona === "field_manager" ? "Field manager" : roleLabel(session.role);
}
