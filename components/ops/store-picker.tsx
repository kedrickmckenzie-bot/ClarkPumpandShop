"use client";
import { useEffect, useRef, useState } from "react";
import type { SelectOptionViewModel } from "./data-contract";
import styles from "./ops.module.css";
export function StorePicker({ initial, defaultStoreId, searchable = false, initialCursor, onSelect }: { initial: SelectOptionViewModel[]; defaultStoreId?: string; searchable?: boolean; initialCursor?: string; onSelect?: (id: string) => void }) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState(initial.find(s => s.value === defaultStoreId));
  const [query, setQuery] = useState("");
  const [next, setNext] = useState(initialCursor);
  const [cursor, setCursor] = useState("");
  const [trail, setTrail] = useState([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const touched = useRef(false);
  useEffect(() => {
    if (!searchable || !touched.current) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/ops/store-options?${new URLSearchParams({ q: query, ...(cursor ? { cursor } : {}) })}`, { signal: controller.signal });
        const data = await response.json() as { items: SelectOptionViewModel[]; nextCursor?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load stores.");
        if (controller.signal.aborted) return;
        setItems(data.items); setNext(data.nextCursor); setError("");
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load stores."); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, cursor, searchable]);
  const matches = searchable ? items : items.filter(s => `${s.label} ${s.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const choices = selected && !matches.some(s => s.value === selected.value) ? [selected, ...matches] : matches;
  function page(value: string, history: string[]) { touched.current = true; setBusy(true); setCursor(value); setTrail(history); }
  return <div>
    <label className={styles.field}><span>Find a store</span><input type="search" value={query} placeholder="Store number, name or address" maxLength={160} onChange={e => { touched.current = true; setQuery(e.target.value); setCursor(""); setTrail([""]); setBusy(searchable); }} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} /></label>
    <label className={styles.field} htmlFor="request-store"><span>Store <em>Required</em></span><select id="request-store" name="storeId" required value={selected?.value ?? ""} onChange={e => { setSelected(choices.find(s => s.value === e.target.value)); onSelect?.(e.target.value); }}><option value="" disabled>Choose a store</option>{choices.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
    {error ? <p role="alert">{error}</p> : null}
    <p role="status">{busy ? "Searching…" : query ? `${matches.length} matching stores${selected && !matches.some(s => s.value === selected.value) ? " · Current selection kept" : ""}` : ""}</p>
    {searchable && trail.length > 1 ? <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => page(trail[trail.length - 2], trail.slice(0, -1))}>Back</button> : null}
    {searchable && next ? <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => page(next, [...trail, next])}>More stores</button> : null}
  </div>;
}
