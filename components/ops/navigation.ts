import type { OperatorRole } from "./data-contract";

export interface NavigationItem {
  id: string;
  label: string;
  shortLabel?: string;
  href: string;
  section: "workspace" | "intelligence" | "manage";
  roles: OperatorRole[];
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
  { id: "overview", label: "Overview", href: "/app/overview", section: "workspace", roles: allRoles },
  { id: "actions", label: "Action center", href: "/app/action-center", section: "workspace", roles: allRoles },
  { id: "requests", label: "Requests", href: "/app/requests", section: "workspace", roles: operationsRoles },
  { id: "work", label: "Work orders", shortLabel: "Work", href: "/app/work-orders", section: "workspace", roles: allRoles },
  { id: "visits", label: "Service visits", shortLabel: "Visits", href: "/app/visits", section: "workspace", roles: operationsRoles },
  { id: "stores", label: "Stores", href: "/app/stores", section: "workspace", roles: allRoles },
  { id: "vendors", label: "Vendors", href: "/app/vendors", section: "workspace", roles: allRoles },
  { id: "spend", label: "Spend", href: "/app/spend", section: "intelligence", roles: allRoles },
  { id: "equipment", label: "Equipment", href: "/app/equipment", section: "intelligence", roles: [...operationsRoles, "finance"] },
  { id: "pm", label: "Preventive maintenance", shortLabel: "PM", href: "/app/pm", section: "intelligence", roles: operationsRoles },
  { id: "lifecycle", label: "Lifecycle & CapEx", shortLabel: "Lifecycle", href: "/app/lifecycle", section: "intelligence", roles: ["executive", "facilities", "regional", "finance"] },
  { id: "reports", label: "Reports", href: "/app/reports", section: "intelligence", roles: allRoles },
  { id: "admin", label: "Administration", shortLabel: "Admin", href: "/app/admin", section: "manage", roles: ["facilities"] },
];

export function navigationForRole(role: OperatorRole) {
  return operatorNavigation.filter((item) => item.roles.includes(role));
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
