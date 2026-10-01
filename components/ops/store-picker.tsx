"use client";
import { useCallback } from "react";
import type { SelectOptionViewModel } from "./data-contract";
import { SearchPicker, type PickOption } from "./search-picker";

const toPick = (store: SelectOptionViewModel): PickOption => ({ value: store.value, label: store.label, detail: store.description });

/** Store choice: a live-filtering, scrollable list of stores. Large tenants search on the server as you type. */
export function StorePicker({ initial, defaultStoreId, searchable = false, onSelect, name = "storeId", required = true, label = "Store" }: { name?: string; required?: boolean; initial: SelectOptionViewModel[]; defaultStoreId?: string; searchable?: boolean; initialCursor?: string; onSelect?: (id: string) => void; label?: string }) {
  const load = useCallback(async (query: string, signal: AbortSignal) => {
    const response = await fetch(`/api/ops/store-options?${new URLSearchParams({ q: query, limit: "100" })}`, { signal });
    const data = await response.json() as { items: SelectOptionViewModel[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Could not load stores.");
    return data.items.map(toPick);
  }, []);
  const options = initial.map(toPick);
  return <SearchPicker name={name} label={label} required={required} placeholder="Store number, name or address"
    options={options} load={searchable ? load : undefined}
    defaultOption={options.find((store) => store.value === defaultStoreId)}
    allowClear={!required} clearLabel="All permitted stores"
    onSelect={(store) => onSelect?.(store?.value ?? "")} />;
}
