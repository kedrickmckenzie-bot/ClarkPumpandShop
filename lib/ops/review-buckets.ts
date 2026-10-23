import type { OrganizationRole, WorkflowTask } from "./types";

/**
 * Where a Review item belongs for the person looking at it:
 * - mine: assigned to them or to their role.
 * - help: someone else's, but they are allowed to do it and it can be done from anywhere.
 * - onsite: needs someone at the store (checking a repair, store access, recording the visit).
 * - waiting: a vendor's move, something upcoming, or an approval above their limit.
 */
export type ReviewBucket = "mine" | "help" | "onsite" | "waiting";

/** Work that needs a person physically at the store. */
export const ON_SITE_TASK_TYPES: ReadonlySet<string> = new Set(["verify_repair", "confirm_store_access", "record_service_outcome"]);

/** Approval authority, low to high; matches the approval limits (store, regional, facilities, owner). */
const AUTHORITY: Partial<Record<OrganizationRole, number>> = { store_manager: 1, field_manager: 2, regional_manager: 2, facilities_admin: 3, executive: 4 };
const APPROVAL_TASK_TYPES: ReadonlySet<string> = new Set(["approve_quote"]);
const FINANCE_TASK_TYPES: ReadonlySet<string> = new Set(["resolve_invoice_exception", "respond_service_discrepancy"]);

export interface ReviewBucketInput {
  lane: "mine" | "team" | "waiting" | "upcoming" | "history";
  taskType?: string;
  /** The task behind the row, when it is a task. */
  assignee?: Pick<WorkflowTask, "assigneeType" | "assigneeRole">;
  /** The row opens an inspection: reviewing its findings and paperwork can be done from anywhere. */
  inspectionReview?: boolean;
}

export function reviewBucket(row: ReviewBucketInput, viewer: OrganizationRole): ReviewBucket {
  if (row.lane === "mine") return "mine";
  if (row.lane === "upcoming" || row.lane === "history") return "waiting";
  if (row.taskType && ON_SITE_TASK_TYPES.has(row.taskType) && !row.inspectionReview) return "onsite";
  if (row.assignee?.assigneeType === "vendor") return "waiting";
  if (row.taskType && FINANCE_TASK_TYPES.has(row.taskType) && viewer !== "facilities_admin" && viewer !== "executive") return "waiting";
  // An approval set for a higher level stays with that level.
  if (row.taskType && APPROVAL_TASK_TYPES.has(row.taskType) && row.assignee?.assigneeRole
    && (AUTHORITY[row.assignee.assigneeRole] ?? 0) > (AUTHORITY[viewer] ?? 0)) return "waiting";
  // A quote round still collecting quotes, or other rows only a vendor can move.
  if (row.lane === "waiting" && !row.assignee) return "waiting";
  return "help";
}

const ROLE_NAMES: Partial<Record<OrganizationRole, string>> = {
  store_manager: "Store manager", regional_manager: "Regional manager", field_manager: "Field manager",
  facilities_admin: "Facilities", executive: "Owner", finance_reviewer: "Finance", internal_technician: "Technician",
};

/** "Store manager", "Facilities", a person's or vendor's name: who the item is waiting on. */
export function waitingOn(owner: string, assignee?: Pick<WorkflowTask, "assigneeType" | "assigneeRole">) {
  if (assignee?.assigneeType === "role" && assignee.assigneeRole) return ROLE_NAMES[assignee.assigneeRole] ?? owner;
  return owner;
}
