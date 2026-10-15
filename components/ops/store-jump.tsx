"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { SearchPicker, type PickPage } from "./search-picker";
import styles from "./store-jump.module.css";

/** Query keys that point at a page of results; they reset when the store changes. */
const PAGING = ["page", "offset", "cursor", "from", "sourcePage", "driverPage", "drillPage"];
/** Pages whose records can be narrowed to one store with `?store=`. Elsewhere the box stays hidden. */
const STORE_PAGES = ["/app/work-orders", "/app/requests", "/app/estimates", "/app/visits", "/app/tasks", "/app/equipment", "/app/invoices", "/app/warranties", "/app/pm", "/app/spend", "/app/action-center", "/app/compliance/refrigerant"];

/**
 * "Jump to a store" on list pages: type a store number or name, pick it, and the page shows only that store.
 * The page itself does the filtering through its `store` link parameter, so links and refreshes keep the choice.
 */
export function StoreJump({ param = "store", label = "Store", always = false }: { param?: string; label?: string; always?: boolean }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const shown = always || STORE_PAGES.includes(pathname);
  const current = params.get(param) ?? "";
  const [name, setName] = useState<{ id: string; label: string }>();
  useEffect(() => {
    if (!shown || !current || name?.id === current) return;
    const controller = new AbortController();
    fetch(`/api/ops/store-options?${new URLSearchParams({ id: current })}`, { signal: controller.signal })
      .then(async (response) => (response.ok ? await response.json() : { items: [] }) as { items: Array<{ value: string; label: string }> })
      .then((data) => setName({ id: current, label: data.items[0]?.label ?? "Selected store" }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [shown, current, name?.id]);
  const go = (id: string | undefined) => {
    const next = new URLSearchParams(params.toString());
    for (const key of PAGING) next.delete(key);
    if (id) next.set(param, id); else next.delete(param);
    router.push(`${pathname}${next.size ? `?${next}` : ""}`);
  };
  const load = useCallback(async (query: string, signal: AbortSignal, cursor?: string): Promise<PickPage> => {
    const response = await fetch(`/api/ops/store-options?${new URLSearchParams({ q: query, limit: "25", ...(cursor ? { cursor } : {}) })}`, { signal });
    const data = await response.json() as { items: Array<{ value: string; label: string; description?: string }>; nextCursor?: string; totalCount?: number; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Could not load stores.");
    return { items: data.items.map((store) => ({ value: store.value, label: store.label, detail: store.description })), next: data.nextCursor, total: data.totalCount };
  }, []);
  if (!shown) return null;
  if (current) return (
    <div className={styles.chosen} role="status">
      <span><small>{label}</small><strong>{name?.id === current ? name.label.replace(/ · .+ - /u, " · ") : "Loading…"}</strong></span>
      <button type="button" onClick={() => go(undefined)} aria-label="Show all stores"><X size={15} aria-hidden="true" />All stores</button>
    </div>
  );
  return (
    <div className={styles.jump}>
      <SearchPicker key={current} label={label} compact placeholder="Jump to a store" load={load} allowClear clearLabel="All stores"
        onSelect={(store) => { if (store?.value) go(store.value); }} />
    </div>
  );
}
