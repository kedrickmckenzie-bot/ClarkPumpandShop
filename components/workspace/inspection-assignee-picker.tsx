"use client";
import { useCallback } from "react";
import { SearchPicker, type PickOption, type PickPage } from "@/components/ops/search-picker";

type Option = { id: string; name: string; kind: "internal" | "vendor" };

/** Live list of the people and vendors who can handle an inspection at one store. */
export function InspectionAssigneePicker({ storeId, only, label = "Assigned to", name }: { storeId: string; only?: "vendor"; label?: string; name?: string }) {
  const load = useCallback(async (query: string, signal: AbortSignal, cursor?: string): Promise<PickPage> => {
    const response = await fetch(`/api/ops/compliance/assignees?${new URLSearchParams({ store: storeId, q: query, ...(cursor ? { cursor } : {}) })}`, { signal });
    const data = await response.json() as { items: Option[]; next?: string; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Could not find people or vendors.");
    return { items: data.items.filter((item) => !only || item.kind === only).map((item) => ({ value: `${item.kind}:${item.id}`, label: item.name, tag: item.kind === "vendor" ? "Vendor" : "Person" })), next: data.next };
  }, [storeId, only]);
  const parts = (option?: PickOption) => { const value = option?.value ?? "", at = value.indexOf(":"); return at < 0 ? { kind: "", id: "" } : { kind: value.slice(0, at), id: value.slice(at + 1) }; };
  return <SearchPicker label={label} required placeholder={only ? "Type a vendor name" : "Type a name or vendor"} load={storeId ? load : undefined} disabled={!storeId} disabledText="Choose a store first"
    hidden={(option) => { const { kind, id } = parts(option); return name ? { [name]: id } : { handler: kind, membershipId: kind === "internal" ? id : "", vendorId: kind === "vendor" ? id : "" }; }} />;
}
