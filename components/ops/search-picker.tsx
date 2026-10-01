"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import styles from "./search-picker.module.css";

export interface PickOption { value: string; label: string; detail?: string; tag?: string }
/** One page of server results; `next` means more matches exist beyond this page. */
export interface PickPage { items: PickOption[]; next?: string; total?: number }
/** Server search. Return a plain list only when it is the complete set of matches. */
export type PickLoader = (query: string, signal: AbortSignal, cursor?: string) => Promise<PickOption[] | PickPage>;
const asPage = (result: PickOption[] | PickPage): PickPage => Array.isArray(result) ? { items: result } : result;

/** Adds a further page to what is shown, without repeating an option already listed. */
export function mergePickPage(shown: readonly PickOption[], page: readonly PickOption[]) {
  const seen = new Set(shown.map((item) => item.value));
  return [...shown, ...page.filter((item) => !seen.has(item.value))];
}

/** The count line under the list. Never implies the list is complete when more matches exist. */
export function pickerCountText({ shown, total, next, serverTotal, query }: { shown: number; total?: number; next?: string; serverTotal?: number; query: string }) {
  const noun = shown === 1 ? "match" : "matches";
  if (total !== undefined) return query ? `${shown} of ${total} shown` : `${total} to choose from · type to narrow`;
  if (next) return serverTotal !== undefined ? `Showing ${shown} of ${serverTotal} ${serverTotal === 1 ? "match" : "matches"} · load more or type to narrow` : `Showing the first ${shown} ${noun} · more available`;
  return `${shown} ${noun}${query ? "" : " · type to narrow"}`;
}

/** Every typed word must appear somewhere in the option's text. */
export function matchesQuery(option: PickOption, query: string) {
  const text = `${option.label} ${option.detail ?? ""} ${option.tag ?? ""}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
}

/**
 * One control for choosing a store, vendor or person: a search box over a
 * scrollable list. The list shows everything at once, narrows as you type,
 * and a click selects. Pass `options` to filter in the browser, or `load` to
 * ask the server (results update as you type).
 */
export function SearchPicker({ name, label, options, load, required = false, placeholder = "Type to search", defaultValue, defaultOption, onSelect, emptyText = "No matches. Try fewer letters.", disabled = false, disabledText, hidden, allowClear = false, clearLabel = "Any", submitOnSelect = false }: {
  name?: string;
  label: string;
  options?: PickOption[];
  load?: PickLoader;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  defaultOption?: PickOption;
  onSelect?: (option: PickOption | undefined) => void;
  emptyText?: string;
  disabled?: boolean;
  disabledText?: string;
  /** Extra hidden fields to submit for the chosen option. */
  hidden?: (option: PickOption | undefined) => Record<string, string>;
  /** Adds a first row that clears the choice (for filters such as "All stores"). */
  allowClear?: boolean;
  clearLabel?: string;
  /** Filters: apply the choice at once by submitting the surrounding form. */
  submitOnSelect?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState<PickOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PickOption | undefined>(() => defaultOption ?? options?.find((option) => option.value === defaultValue));
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const validity = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const [next, setNext] = useState<string | undefined>(undefined);
  const [serverTotal, setServerTotal] = useState<number | undefined>(undefined);
  // Ignores a page that arrives after the search text changed.
  const generation = useRef(0);

  useEffect(() => {
    if (!load || disabled) return;
    const controller = new AbortController();
    const current = ++generation.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const page = asPage(await load(query, controller.signal));
        if (controller.signal.aborted || current !== generation.current) return;
        setLoaded(page.items); setNext(page.next); setServerTotal(page.total); setError("");
        // A preset choice (for example, today's assignee) is shown once the list arrives.
        if (defaultValue) setSelected((chosen) => chosen ?? page.items.find((item) => item.value === defaultValue));
      }
      catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Search is unavailable. Try again."); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load, query, disabled, defaultValue]);

  async function loadMore() {
    if (!load || !next || busy) return;
    const current = generation.current, controller = new AbortController();
    setBusy(true);
    try {
      const page = asPage(await load(query, controller.signal, next));
      if (current !== generation.current) return;
      setLoaded((shown) => mergePickPage(shown ?? [], page.items));
      setNext(page.next); if (page.total !== undefined) setServerTotal(page.total); setError("");
      if (defaultValue) setSelected((chosen) => chosen ?? page.items.find((item) => item.value === defaultValue));
    }
    catch (caught) { if (current === generation.current) setError(caught instanceof Error ? caught.message : "Could not load more. Try again."); }
    finally { if (current === generation.current) setBusy(false); }
  }

  const results = useMemo(() => {
    const source = load ? loaded ?? options ?? [] : options ?? [];
    return load ? source : source.filter((option) => matchesQuery(option, query));
  }, [load, loaded, options, query]);
  const rows: Array<PickOption | null> = allowClear ? [null, ...results] : results;
  const activeIndex = Math.min(active, rows.length - 1);

  function choose(option: PickOption | undefined) {
    setSelected(option);
    onSelect?.(option);
    validity.current?.setCustomValidity("");
    // Wait for the hidden field to carry the new value, then apply the filter.
    if (submitOnSelect) setTimeout(() => root.current?.closest("form")?.requestSubmit(), 0);
  }
  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(0, Math.min(rows.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1)));
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (rows.length) choose(rows[Math.max(0, activeIndex)] ?? undefined);
    }
  }

  const total = load ? undefined : options?.length;
  const countText = () => pickerCountText({ shown: results.length, total, next, serverTotal, query });
  const extra = hidden?.(selected) ?? {};
  return <div className={styles.picker} ref={root}>
    <label className={styles.label} htmlFor={`${id}-search`}>{label}{required ? <em>Required</em> : null}</label>
    {selected ? <p className={styles.selected} role="status"><Check aria-hidden="true" size={16} /><span><strong>{selected.label}</strong>{selected.detail ? <small>{selected.detail}</small> : null}</span></p> : null}
    <div className={styles.searchWrap}>
      <input id={`${id}-search`} className={styles.search} type="search" role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined} autoComplete="off" maxLength={160}
        placeholder={disabled ? disabledText ?? placeholder : placeholder} disabled={disabled} value={query}
        onChange={(event) => { setQuery(event.target.value); setActive(event.target.value ? 0 : -1); }} onKeyDown={onKey} />
      {/* Carries "required" so the browser stops the form and points here when nothing is chosen. */}
      {required ? <input ref={validity} className={styles.validity} tabIndex={-1} aria-hidden="true" required value={selected?.value ?? ""} onChange={() => {}} onInvalid={(event) => event.currentTarget.setCustomValidity(`Choose ${label.toLowerCase()} from the list.`)} /> : null}
    </div>
    {name ? <input type="hidden" name={name} value={selected?.value ?? ""} /> : null}
    {Object.entries(extra).map(([field, value]) => <input key={field} type="hidden" name={field} value={value} />)}
    {disabled ? null : <>
      <ul ref={listRef} id={`${id}-list`} className={styles.list} role="listbox" aria-label={label}>
        {rows.map((option, index) => {
          const isSelected = option ? option.value === selected?.value : !selected;
          return <li key={option?.value ?? "__clear"} id={`${id}-option-${index}`} role="option" aria-selected={isSelected} data-active={index === activeIndex || undefined}
            onMouseDown={(event) => event.preventDefault()} onClick={() => { setActive(index); choose(option ?? undefined); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(option ?? undefined); } }}>
            <span><strong>{option ? option.label : clearLabel}</strong>{option?.detail ? <small>{option.detail}</small> : null}</span>
            {option?.tag ? <em>{option.tag}</em> : null}
            {isSelected ? <Check aria-hidden="true" size={16} /> : null}
          </li>;
        })}
        {!rows.length && !busy ? <li className={styles.empty}>{emptyText}</li> : null}
      </ul>
      <div className={styles.footer}>
        <p className={styles.count} aria-live="polite">{error ? <span role="alert">{error}</span> : busy ? "Searching…" : countText()}</p>
        {load && next ? <button type="button" className={styles.more} disabled={busy} onClick={loadMore}>Load more</button> : null}
      </div>
    </>}
  </div>;
}
