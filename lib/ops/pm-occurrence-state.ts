import type { PmOccurrence } from "./types";

export function effectivePmStatus(occurrence: PmOccurrence, asOf: string): PmOccurrence["status"] {
  if (occurrence.status === "completed" || occurrence.completedAt) return "completed";
  if (occurrence.status === "waived") return "waived";
  if (Date.parse(occurrence.windowEndsAt) < Date.parse(asOf)) return "missed";
  if (Date.parse(occurrence.windowStartsAt) > Date.parse(asOf)) return "scheduled";
  return occurrence.status === "scheduled" ? "scheduled" : "due";
}
