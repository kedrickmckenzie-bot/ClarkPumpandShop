"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import styles from "./workspace-search.module.css";
type Group = { id: string; label: string; rows: { id: string; href: string; label: string; detail?: string }[] };
export function WorkspaceSearch({ placeholder }: { placeholder: string }) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("ready");
  const sequence = useRef(0);
  useEffect(() => {
    const id = ++sequence.current, controller = new AbortController();
    if (!query.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/ops/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json() as { groups: Group[] };
        if (sequence.current === id) { setGroups(data.groups); setState("ready"); }
      } catch { if (!controller.signal.aborted && sequence.current === id) setState("error"); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <div role="search" className={styles.root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <form action="/app/search" method="get" role="search" className={styles.form}>
      <Search size={18} aria-hidden="true" />
      <input onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} id="global-platform-search" aria-label="Search the workspace" name="q" type="search" autoComplete="off" placeholder={placeholder} value={query} maxLength={160} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setGroups([]); setState(e.target.value.trim() ? "loading" : "ready"); setOpen(true); }} />
      <button type="submit">Search</button>
    </form>
    {open && query.trim() ? <section className={styles.results} aria-label="Live search results">
      <p role="status">{state === "loading" ? "Searching…" : state === "error" ? "Search is unavailable. Try again." : groups.some(g => g.rows.length) ? "Matching records" : "No matching records"}</p>
      {state === "ready" ? groups.filter(g => g.rows.length).map(g => <div key={g.id}><h3>{g.label}</h3>{g.rows.map(r => <Link key={r.id} href={r.href} onClick={() => setOpen(false)}><strong>{r.label}</strong>{r.detail ? <small>{r.detail}</small> : null}</Link>)}</div>) : null}
      <Link href={`/app/search?q=${encodeURIComponent(query)}`} onClick={() => setOpen(false)}>See all results →</Link>
    </section> : null}
  </div>;
}
