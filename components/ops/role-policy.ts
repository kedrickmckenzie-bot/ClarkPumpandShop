import type { OperatorRole, OperatorSession } from "./data-contract";

export type OperatorCapability =
  | "create_request"
  | "review_request"
  | "create_work_order"
  | "control_work_order"
  | "manage_workflow_tasks"
  | "classify_work_order"
  | "record_work_cost"
  | "review_attention"
  | "create_store"
  | "onboard_vendor"
  | "setup_equipment"
  | "setup_pm"
  | "manage_lifecycle"
  | "request_estimate"
  | "select_estimate"
  | "issue_work_order"
  | "confirm_observable_result"
  | "administer";

export type OperatorListRoutePolicyId =
  | "action-center"
  | "requests"
  | "work-orders"
  | "estimates"
  | "visits"
  | "stores"
  | "vendors"
  | "warranties"
  | "invoices"
  | "reports"
  | "admin";

export type OperatorProgramRoutePolicyId = "trends" | "spend" | "equipment" | "pm" | "lifecycle";
export type OperatorDetailRoutePolicyId =
  | "request"
  | "work-order"
  | "visit"
  | "store"
  | "vendor"
  | "equipment"
  | "warranty"
  | "invoice";

export type OperatorPrimaryNavigationId = "home" | "work" | "stores" | "vendors" | "insights" | "reports";
export type OperatorWorkNavigationId = "needs-attention" | "requests" | "work-orders" | "estimates" | "visits" | "invoice-review";
export type OperatorInsightsNavigationId = "trends" | "spend" | "equipment" | "pm" | "lifecycle";

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
      "manage_workflow_tasks",
      "classify_work_order",
      "record_work_cost",
      "review_attention",
      "create_store",
      "onboard_vendor",
      "setup_equipment",
      "setup_pm",
      "manage_lifecycle",
      "request_estimate",
      "select_estimate",
      "issue_work_order",
      "confirm_observable_result",
      "administer",
    ],
    listRoutes: ["action-center", "requests", "work-orders", "estimates", "visits", "stores", "vendors", "warranties", "invoices", "reports", "admin"],
    programRoutes: ["trends", "spend", "equipment", "pm", "lifecycle"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment", "warranty", "invoice"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["needs-attention", "requests", "work-orders", "estimates", "visits", "invoice-review"],
    insightsNavigation: ["trends", "spend", "equipment", "pm", "lifecycle"],
  },
  regional: {
    capabilities: ["create_request", "review_request", "create_work_order", "control_work_order", "manage_workflow_tasks", "classify_work_order", "record_work_cost", "review_attention", "setup_equipment", "setup_pm", "manage_lifecycle", "request_estimate", "select_estimate", "issue_work_order", "confirm_observable_result"],
    listRoutes: ["action-center", "requests", "work-orders", "estimates", "visits", "stores", "vendors", "warranties", "invoices", "reports"],
    programRoutes: ["trends", "spend", "equipment", "pm", "lifecycle"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment", "warranty", "invoice"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["needs-attention", "requests", "work-orders", "estimates", "visits", "invoice-review"],
    insightsNavigation: ["trends", "spend", "equipment", "pm", "lifecycle"],
  },
  store_manager: {
    capabilities: ["create_request", "review_request", "setup_equipment", "setup_pm", "confirm_observable_result"],
    listRoutes: ["action-center", "requests", "work-orders", "visits", "stores", "vendors", "reports"],
    programRoutes: ["trends", "spend", "equipment", "pm"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["requests", "work-orders", "visits"],
    insightsNavigation: ["trends", "spend", "equipment", "pm"],
  },
  executive: {
    capabilities: [],
    listRoutes: ["action-center", "requests", "work-orders", "estimates", "visits", "stores", "vendors", "warranties", "invoices", "reports"],
    programRoutes: ["trends", "spend", "equipment", "pm", "lifecycle"],
    detailRoutes: ["request", "work-order", "visit", "store", "vendor", "equipment", "warranty", "invoice"],
    primaryNavigation: ["home", "stores", "vendors", "insights", "reports"],
    workNavigation: [],
    insightsNavigation: ["trends", "spend", "equipment", "pm", "lifecycle"],
  },
  finance: {
    capabilities: ["record_work_cost"],
    listRoutes: ["action-center", "work-orders", "estimates", "stores", "vendors", "warranties", "invoices", "reports"],
    programRoutes: ["trends", "spend", "equipment", "lifecycle"],
    detailRoutes: ["work-order", "visit", "store", "vendor", "equipment", "warranty", "invoice"],
    primaryNavigation: ["home", "work", "stores", "vendors", "insights", "reports"],
    workNavigation: ["needs-attention", "work-orders", "estimates", "invoice-review"],
    insightsNavigation: ["trends", "spend", "equipment", "lifecycle"],
  },
};

export function roleCan(subject: OperatorRole | Pick<OperatorSession, "role" | "effectiveCapabilities">, capability: OperatorCapability) {
  if (typeof subject !== "string" && subject.effectiveCapabilities) {
    return subject.effectiveCapabilities.includes(capability);
  }
  const role = typeof subject === "string" ? subject : subject.role;
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
  if (area === "trends") return roleCanAccessProgramRoute(role, "trends");
  if (area === "action-center") return roleCanAccessListRoute(role, "action-center");
  if (area === "requests") {
    if (record === "new") return roleCan(role, "create_request");
    return record ? roleCanAccessDetailRoute(role, "request") : roleCanAccessListRoute(role, "requests");
  }
  if (area === "work-orders") {
    if (record === "new") return roleCan(role, "create_work_order");
    return record ? roleCanAccessDetailRoute(role, "work-order") : roleCanAccessListRoute(role, "work-orders");
  }
  if (area === "estimates") return roleCanAccessListRoute(role, "estimates");
  if (area === "visits") return record ? roleCanAccessDetailRoute(role, "visit") : roleCanAccessListRoute(role, "visits");
  // Route-planning internals are not part of the customer-facing c-store suite.
  // The domain can retain them without teaching a two-person facilities team a
  // second dispatch vocabulary or exposing dead-end links from normal records.
  if (area === "service-runs") return false;
  if (area === "store-sweeps") return roleCan(role, "issue_work_order");
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
  if (area === "warranties") {
    return record ? roleCanAccessDetailRoute(role, "warranty") : roleCanAccessListRoute(role, "warranties");
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
