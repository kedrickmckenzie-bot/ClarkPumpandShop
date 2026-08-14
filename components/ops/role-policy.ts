import type { OperatorRole } from "./data-contract";

export type OperatorCapability =
  | "create_request"
  | "review_request"
  | "create_work_order"
  | "control_work_order"
  | "classify_work_order"
  | "record_work_cost"
  | "review_attention"
  | "create_store"
  | "onboard_vendor"
  | "setup_equipment"
  | "setup_pm"
  | "request_estimate"
  | "select_estimate"
  | "issue_work_order"
  | "administer";

export type OperatorListRoutePolicyId =
  | "action-center"
  | "requests"
  | "work-orders"
  | "visits"
  | "stores"
  | "vendors"
  | "invoices"
  | "reports"
  | "admin";

export type OperatorProgramRoutePolicyId = "spend" | "equipment" | "pm" | "lifecycle";
export type OperatorDetailRoutePolicyId =
  | "request"
  | "work-order"
  | "visit"
  | "store"
  | "vendor"
  | "equipment"
  | "invoice";

export type OperatorPrimaryNavigationId = "home" | "work" | "stores" | "vendors" | "insights" | "reports";
export type OperatorWorkNavigationId = "needs-attention" | "requests" | "work-orders" | "visits" | "invoice-review";
export type OperatorInsightsNavigationId = "spend" | "equipment" | "pm" | "lifecycle";

interface DemoOperatorRolePolicy {
  readonly capabilities: readonly OperatorCapability[];
  readonly listRoutes: readonly OperatorListRoutePolicyId[];
  readonly programRoutes: readonly OperatorProgramRoutePolicyId[];
  readonly detailRoutes: readonly OperatorDetailRoutePolicyId[];
  readonly primaryNavigation: readonly OperatorPrimaryNavigationId[];
  readonly workNavigation: readonly OperatorWorkNavigationId[];
  readonly insightsNavigation: readonly OperatorInsightsNavigationId[];
}

/**
 * One policy for the visible demo roles.
 *
 * This is intentionally separate from production authorization: server commands
 * still enforce organization and scope grants. It keeps route guards, navigation,
 * and visible actions from promising different access in the role preview.
 */
export const demoOperatorRolePolicy: Record<OperatorRole, DemoOperatorRolePolicy> = {
  facilities: {
    capabilities: [
      "create_request",
      "review_request",
      "create_work_order",
      "control_work_order",
      "classify_work_order",
      "record_work_cost",
      "review_attention",
      "create_store",
      "onboard_vendor",
      "setup_equipment",
      "setup_pm",
      "request_estimate",
      "select_estimate",
      "issue_work_order",
      "administer",
    ],
    listRoutes: ["action-center", "requests", "work-orders", "visits", "stores", "vendors", "invoices", "reports", "admin"],
    programRoutes: ["spend", "equipment", "pm", "lifecycle"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment", "invoice"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["needs-attention", "requests", "work-orders", "visits", "invoice-review"],
    insightsNavigation: ["spend", "equipment", "pm", "lifecycle"],
  },
  regional: {
    capabilities: ["create_request", "review_request", "create_work_order", "control_work_order", "classify_work_order", "record_work_cost", "review_attention", "setup_equipment", "setup_pm", "request_estimate", "select_estimate", "issue_work_order"],
    listRoutes: ["action-center", "requests", "work-orders", "visits", "stores", "vendors", "invoices", "reports"],
    programRoutes: ["spend", "equipment", "pm", "lifecycle"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment", "invoice"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["needs-attention", "requests", "work-orders", "visits", "invoice-review"],
    insightsNavigation: ["spend", "equipment", "pm", "lifecycle"],
  },
  store_manager: {
    capabilities: ["create_request", "review_request", "setup_equipment", "setup_pm"],
    listRoutes: ["action-center", "requests", "work-orders", "visits", "stores", "vendors", "reports"],
    programRoutes: ["spend", "equipment", "pm"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["requests", "work-orders", "visits"],
    insightsNavigation: ["spend", "equipment", "pm"],
  },
  executive: {
    capabilities: [],
    listRoutes: ["action-center", "requests", "work-orders", "visits", "stores", "vendors", "invoices", "reports"],
    programRoutes: ["spend", "equipment", "pm", "lifecycle"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment", "invoice"],
    primaryNavigation: ["home", "stores", "vendors", "insights", "reports"],
    workNavigation: [],
    insightsNavigation: ["spend", "equipment", "pm", "lifecycle"],
  },
  finance: {
    capabilities: ["record_work_cost"],
    listRoutes: ["action-center", "work-orders", "stores", "vendors", "invoices", "reports"],
    programRoutes: ["spend", "equipment", "lifecycle"],
    detailRoutes: ["work-order", "visit", "store", "vendor", "equipment", "invoice"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["needs-attention", "work-orders", "invoice-review"],
    insightsNavigation: ["spend", "equipment", "lifecycle"],
  },
};

export function roleCan(role: OperatorRole, capability: OperatorCapability) {
  return demoOperatorRolePolicy[role].capabilities.includes(capability);
}

export function roleCanAccessListRoute(role: OperatorRole, route: OperatorListRoutePolicyId) {
  return demoOperatorRolePolicy[role].listRoutes.includes(route);
}

export function roleCanAccessProgramRoute(role: OperatorRole, route: OperatorProgramRoutePolicyId) {
  return demoOperatorRolePolicy[role].programRoutes.includes(route);
}

export function roleCanAccessDetailRoute(role: OperatorRole, route: OperatorDetailRoutePolicyId) {
  return demoOperatorRolePolicy[role].detailRoutes.includes(route);
}

export function roleCanSeePrimaryNavigation(role: OperatorRole, item: OperatorPrimaryNavigationId) {
  return demoOperatorRolePolicy[role].primaryNavigation.includes(item);
}

export function roleCanSeeWorkNavigation(role: OperatorRole, item: OperatorWorkNavigationId) {
  return demoOperatorRolePolicy[role].workNavigation.includes(item);
}

export function roleCanSeeInsightsNavigation(role: OperatorRole, item: OperatorInsightsNavigationId) {
  return demoOperatorRolePolicy[role].insightsNavigation.includes(item);
}

/** Returns whether an in-app link resolves to a route or mutation available to the role. */
export function roleCanOpenOperatorHref(role: OperatorRole, href: string) {
  if (!href.startsWith("/app/")) return true;
  const path = href.split(/[?#]/, 1)[0];
  const segments = path.split("/").filter(Boolean);
  const area = segments[1];
  const record = segments[2];

  if (area === "overview" || area === "search") return true;
  if (area === "action-center") return roleCanAccessListRoute(role, "action-center");
  if (area === "requests") {
    if (record === "new") return roleCan(role, "create_request");
    return record ? roleCanAccessDetailRoute(role, "request") : roleCanAccessListRoute(role, "requests");
  }
  if (area === "work-orders") {
    if (record === "new") return roleCan(role, "create_work_order");
    return record ? roleCanAccessDetailRoute(role, "work-order") : roleCanAccessListRoute(role, "work-orders");
  }
  if (area === "visits") return record ? roleCanAccessDetailRoute(role, "visit") : roleCanAccessListRoute(role, "visits");
  if (area === "stores") {
    if (record === "new") return roleCan(role, "create_store");
    return record ? roleCanAccessDetailRoute(role, "store") : roleCanAccessListRoute(role, "stores");
  }
  if (area === "vendors") {
    if (record === "new") return roleCan(role, "onboard_vendor");
    return record ? roleCanAccessDetailRoute(role, "vendor") : roleCanAccessListRoute(role, "vendors");
  }
  if (area === "invoices") {
    return record ? roleCanAccessDetailRoute(role, "invoice") : roleCanAccessListRoute(role, "invoices");
  }
  if (area === "reports") return roleCanAccessListRoute(role, "reports");
  if (area === "admin") return roleCanAccessListRoute(role, "admin");
  if (area === "spend") return roleCanAccessProgramRoute(role, "spend");
  if (area === "equipment") {
    if (record === "new" || segments.includes("new")) return roleCan(role, "setup_equipment");
    return record ? roleCanAccessDetailRoute(role, "equipment") : roleCanAccessProgramRoute(role, "equipment");
  }
  if (area === "pm") {
    if (record === "new") return roleCan(role, "setup_pm");
    return roleCanAccessProgramRoute(role, "pm");
  }
  if (area === "lifecycle") return roleCanAccessProgramRoute(role, "lifecycle");
  return false;
}
