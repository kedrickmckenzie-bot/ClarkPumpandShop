import type { Money } from "./types";

/** Approval is a pinned amount, even when a newer selected or reported price exists. */
export function selectLifecycleReplacementPrice(approved?: Money, selected?: Money, reported?: Money) {
  return {
    amount: approved ?? selected ?? reported,
    basis: approved ? "Approved replacement" : selected ? "Selected replacement quote" : reported ? "Reported replacement price" : "Replacement quote",
  };
}
