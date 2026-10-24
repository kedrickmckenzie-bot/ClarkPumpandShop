import type { CostLine, WorkOrderAssignment } from "./types";

/** "vendor:<id>", "in_house" or "unmarked": who a recorded cost was paid to. */
export type CostProviderKey = string;
const INACTIVE = new Set(["cancelled", "declined", "superseded"]);

/**
 * Who a cost line belongs to. A line that says so wins. Otherwise the job decides only when it is plain:
 * one outside vendor and nobody else, or in-house only. Anything else stays "unmarked" rather than guessed.
 */
export function costProvider(line: Pick<CostLine, "providerType" | "vendorId">, assignments: readonly Pick<WorkOrderAssignment, "kind" | "vendorId" | "status">[]): CostProviderKey {
  if (line.providerType === "internal") return "in_house";
  if (line.vendorId) return `vendor:${line.vendorId}`;
  const active = assignments.filter(row => !INACTIVE.has(row.status));
  const vendors = new Set(active.filter(row => row.kind === "outside_vendor").map(row => row.vendorId));
  const internal = active.some(row => row.kind === "internal");
  if (line.providerType !== "vendor" && internal && !vendors.size) return "in_house";
  if (!internal && vendors.size === 1) { const [id] = vendors; if (id) return `vendor:${id}`; }
  return "unmarked";
}
