import type { CostLine, WorkOrderAssignment } from "./types";

/** "vendor:<id>", "in_house" or "unmarked" (a vendor cost with no single vendor): who a recorded cost was paid to. */
export type CostProviderKey = string;

/**
 * Who a cost line belongs to, by the same rule as Spend totals and reports: the line's own marking wins; otherwise the
 * job's latest active assignment decides vendor or in-house. A vendor cost names the vendor only when it is plain
 * (the line's vendor, or the job's one outside vendor); anything else stays "unmarked" rather than guessed.
 * In-house money is entered by accounting on Spend totals, so "in_house" lines are not vendor spend.
 */
export function costProvider(line: Pick<CostLine, "providerType" | "vendorId">, assignments: readonly Pick<WorkOrderAssignment, "kind" | "vendorId" | "status" | "assignedAt">[]): CostProviderKey {
  if (line.providerType === "internal") return "in_house";
  const active = assignments.filter(row => row.kind !== "choose_later" && row.status !== "declined" && row.status !== "cancelled")
    .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
  if (!line.providerType && active.at(-1)?.kind === "internal") return "in_house";
  if (line.vendorId) return `vendor:${line.vendorId}`;
  const vendors = new Set(active.filter(row => row.kind === "outside_vendor").map(row => row.vendorId));
  if (vendors.size === 1) { const [id] = vendors; if (id) return `vendor:${id}`; }
  return "unmarked";
}
