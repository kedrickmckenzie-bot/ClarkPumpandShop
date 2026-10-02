"use client";
import { useCallback } from "react";
import type { SelectOptionViewModel } from "./data-contract";
import { SearchPicker, type PickOption, type PickPage } from "./search-picker";

const toPick = (store: SelectOptionViewModel): PickOption => ({ value: store.value, label: store.label, detail: store.description });

/** Store choice: a live-filtering, scrollable list of stores. Large tenants search on the server as you type. */
export function StorePicker({ initial, defaultStoreId, searchable = false, onSelect, name = "storeId", required = true, label = "Store", compact = false }: { name?: string; required?: boolean; initial: SelectOptionViewModel[]; defaultStoreId?: string; searchable?: boolean; initialCursor?: string; onSelect?: (id: string) => void; label?: string; compact?: boolean }) {
  // Server search, 25 stores at a time; "Load more" continues from the cursor.
  const load = useCallback(async (query: string, signal: AbortSignal, cursor?: string): Promise<PickPage> => {
    const response = await fetch(`/api/ops/store-options?${new URLSearchParams({ q: query, limit: "25", ...(cursor ? { cursor } : {}) })}`, { signal });
    const data = await response.json() as { items: SelectOptionViewModel[]; nextCursor?: string; totalCount?: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Could not load stores.");
    return { items: data.items.map(toPick), next: data.nextCursor, total: data.totalCount };
  }, []);
  const options = initial.map(toPick);
  return <SearchPicker name={name} label={label} required={required} placeholder="Store number, name or address"
    options={options} load={searchable ? load : undefined}
    defaultOption={options.find((store) => store.value === defaultStoreId)}
    allowClear={!required} clearLabel="All permitted stores" compact={compact}
    onSelect={(store) => onSelect?.(store?.value ?? "")} />;
}
