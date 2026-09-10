"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { advanceNavigationTrail, type NavigationStop } from "@/lib/ops/navigation-trail";
import styles from "./navigation-trail.module.css";

const empty: NavigationStop[] = [];
let activeScope = "";
let stops = empty;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const serverSnapshot = () => empty;
const storageKey = "ops.navigation-trail";
function publishTrail(scopeKey: string, next: NavigationStop[]) {
  activeScope = scopeKey;
  stops = next;
  try { sessionStorage.setItem(storageKey, JSON.stringify({ scopeKey, stops })); } catch { /* Optional session memory. */ }
  listeners.forEach((listener) => listener());
}
function restoreTrail(scopeKey: string): NavigationStop[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (saved?.scopeKey !== scopeKey || !Array.isArray(saved.stops)) return empty;
    return saved.stops.slice(-6).reduce((trail: NavigationStop[], stop: NavigationStop) =>
      typeof stop?.href === "string" && typeof stop?.label === "string"
        ? advanceNavigationTrail(trail, stop) : trail, empty);
  } catch { return empty; }
}

/** Per-tab session history. A role or tenant change discards the previous trail. */
export function NavigationTrail({ scopeKey }: { scopeKey: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    const reveal = () => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      let parent: HTMLElement | null = target;
      let expanded = false;
      while (parent) {
        if (parent instanceof HTMLDetailsElement && !parent.open) { parent.open = true; expanded = true; }
        parent = parent.parentElement;
      }
      if (expanded) target.scrollIntoView({ block: "start" });
    };
    const frame = requestAnimationFrame(reveal);
    window.addEventListener("hashchange", reveal);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", reveal); };
  }, [pathname, query]);
  const trail = useSyncExternalStore(subscribe, () => activeScope === scopeKey ? stops : empty, serverSnapshot);
  useEffect(() => {
    const parameters = new URLSearchParams(query);
    // Mutation receipts are transient; filters, pagination and selected sections are retained.
    for (const key of ["saved", "updated", "error", "success", "created", "notice"]) parameters.delete(key);
    const href = `${pathname}${parameters.size ? `?${parameters}` : ""}`;
    const record = () => {
      const title = document.querySelector("main h1")?.textContent?.trim();
      if (!title) return false;
      const section = parameters.get("view") || parameters.get("section");
      const label = `${title}${section ? ` · ${section.replaceAll("-", " ")}` : parameters.size && !pathname.endsWith("/new") ? " · filtered view" : ""}`;
      const next = advanceNavigationTrail(activeScope === scopeKey ? stops : restoreTrail(scopeKey), { href, label });
      if (next !== stops || activeScope !== scopeKey) {
        publishTrail(scopeKey, next);
      }
      return true;
    };
    if (record()) return;
    // Streamed routes may commit their loading surface before the record heading arrives.
    const observer = new MutationObserver(() => { if (record()) observer.disconnect(); });
    const main = document.querySelector("main");
    if (main) observer.observe(main, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname, query, scopeKey]);
  const returnToStop = (index: number) => {
    publishTrail(scopeKey, trail.slice(0, index + 1));
  };
  if (trail.length < 2) return null;
  return <nav className={styles.trail} aria-label="Your navigation path"><span>Your path</span><ol>{trail.map((stop, index) => <li key={`${index}:${stop.href}`}>{index > 0 ? <ChevronRight aria-hidden="true" size={14} /> : null}{index === trail.length - 1 ? <span aria-current="page">{stop.label}</span> : <Link href={stop.href} onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) returnToStop(index); }}>{stop.label}</Link>}</li>)}</ol></nav>;
}
