import type { Money } from "./types";

/** A price reported by a person. It is neither a charge nor permission to work. */
export interface WorkPrice {
  id: string;
  organizationId: string;
  workOrderId: string;
  storeId: string;
  assetId?: string;
  componentId?: string;
  profileId?: string;
  profileFingerprint?: string;
  vendorId: string;
  kind: "repair" | "replace";
  scopeKind: "whole" | "part" | "job";
  scope: string;
  amount: Money;
  recordedAt: string;
  recordedBy: string;
}

export interface WorkPriceQuery {
  workOrderId?: string;
  assetId?: string;
  profileId?: string;
  storeIds?: string[];
  kind?: "repair" | "replace";
  offset?: number;
  limit?: number;
}

export function workPriceFrom(row: Record<string, unknown>): WorkPrice {
  const value = Object.fromEntries(Object.entries(row).map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), item]));
  return { id: String(value.id), organizationId: String(value.organizationId), workOrderId: String(value.workOrderId), storeId: String(value.storeId),
    vendorId: String(value.vendorId), kind: value.kind, scopeKind: value.scopeKind, scope: String(value.scope), recordedBy: String(value.recordedBy),
    assetId: value.assetId ?? undefined, componentId: value.componentId ?? undefined, profileId: value.profileId ?? undefined, profileFingerprint: value.profileFingerprint ?? undefined,
    amount: { amountMinor: Number(value.amountMinor), currency: String(value.currency) },
    recordedAt: value.recordedAt instanceof Date ? value.recordedAt.toISOString() : String(value.recordedAt),
  } as WorkPrice;
}
