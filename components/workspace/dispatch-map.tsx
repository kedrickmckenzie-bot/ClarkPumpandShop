"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { DispatchJob } from "@/lib/ops/dispatch-board";
import { jobShortName } from "@/lib/ops/short-name";
import styles from "./dispatch-map.module.css";

/** Six tech colours, checked for colour-blind separation; pins also carry numbers and names. */
export const TECH_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7", "#e87ba4", "#eda100"];
const SHOW_HELD_KEY = "dispatch-map-show-held";
const noSubscription = () => () => {};
/** The saved map choice; private browsing or blocked storage falls back to off. */
function readShowHeld() {
  try { return localStorage.getItem(SHOW_HELD_KEY) === "1"; } catch { return false; }
}
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export interface MapTech {
  id: string;
  name: string;
  color: string;
  stops: DispatchJob[];
  /** Store the tech is checked in at right now, if any. */
  currentStoreId?: string;
}
type StorePoint = { id: string; number: string; name: string; latE6: number | null; lngE6: number | null };
type Leg = { fromLatE6: number; fromLngE6: number; toLatE6: number; toLngE6: number; distanceM: number; durationS: number; geometry: string };
type Routes = { enabled: boolean; stores: StorePoint[]; legs: Leg[]; pending: number };

/** Decodes an encoded polyline (6-digit precision) into [lng, lat] pairs. */
export function decodePolyline6(text: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  const next = () => {
    let result = 0, shift = 0, byte: number;
    do { byte = text.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < text.length) { lat += next(); lng += next(); points.push([lng / 1e6, lat / 1e6]); }
  return points;
}
/** A focusable pin that opens with a click, Enter or Space. */
function clickablePin(open: () => void) {
  const pin = document.createElement("span");
  pin.setAttribute("role", "button");
  pin.tabIndex = 0;
  pin.addEventListener("click", open);
  pin.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  return pin;
}
const minutes = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
};
const miles = (meters: number) => `${Math.round(meters / 160.934) / 10} mi`;

export function DispatchMap({ techs, queue, held = [], onOpen, onPickHeld, onMove, canMove, busy = false, shortStore }: {
  techs: MapTech[];
  queue: DispatchJob[];
  /** Small jobs set aside for a future visit; shown only when the manager switches them on. */
  held?: DispatchJob[];
  onOpen: (job: DispatchJob) => void;
  /** Called with every next-visit job at the store whose dot was tapped. */
  onPickHeld?: (jobs: DispatchJob[]) => void;
  /** Reorders a tech's day from the side list; the board saves it like any other move. */
  onMove?: (job: DispatchJob, techId: string, toIndex: number) => void;
  canMove?: (job: DispatchJob) => boolean;
  /** True while a move is saving, so arrows can't be pressed twice. */
  busy?: boolean;
  shortStore: (job: DispatchJob) => string;
}) {
  const box = useRef<HTMLDivElement>(null), map = useRef<MapLibreMap | null>(null), markers = useRef<Marker[]>([]), fitted = useRef("");
  const [routes, setRoutes] = useState<Routes>(), [error, setError] = useState(""), [only, setOnly] = useState<string>();
  const [ready, setReady] = useState(false), [openTech, setOpenTech] = useState<string>();
  // Remembered per browser; off by default so the map stays about today's real work.
  const storedShowHeld = useSyncExternalStore(noSubscription, readShowHeld, () => false);
  const [showHeldChoice, setShowHeldChoice] = useState<boolean>();
  const showHeld = showHeldChoice ?? storedShowHeld;
  const toggleHeld = () => {
    const next = !showHeld;
    setShowHeldChoice(next);
    try { localStorage.setItem(SHOW_HELD_KEY, next ? "1" : "0"); } catch { /* Not saved; still works this visit. */ }
  };
  const sequences = useMemo(() => [
    ...techs.map(t => t.stops.map(j => j.storeId)),
    ...queue.map(j => [j.storeId]),
    ...techs.flatMap(t => t.currentStoreId ? [[t.currentStoreId]] : []),
    ...(showHeld ? [...new Set(held.map(j => j.storeId))].map(id => [id]) : []),
  ], [techs, queue, held, showHeld]);
  const sequenceKey = JSON.stringify(sequences);

  // Ask the server for store locations and road routes; it looks up a few missing pairs per call.
  useEffect(() => {
    let stop = false, timer: ReturnType<typeof setTimeout> | undefined;
    const load = async (attempt: number) => {
      try {
        const response = await fetch("/api/ops/internal-dispatch/routes", { method: "POST", headers: { "Content-Type": "application/json" }, body: sequenceKey ? JSON.stringify({ sequences: JSON.parse(sequenceKey) }) : "{}" });
        const body = await response.json() as Routes & { error?: string };
        if (!response.ok) throw Error(body.error ?? "Could not load the map.");
        if (stop) return;
        setRoutes(body); setError("");
        if (body.enabled && body.pending > 0 && attempt < 10) timer = setTimeout(() => void load(attempt + 1), 1500);
      } catch (reason) {
        if (!stop) setError(reason instanceof Error ? reason.message : "Could not load the map.");
      }
    };
    void load(0);
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [sequenceKey]);

  // Create the map once.
  useEffect(() => {
    let disposed = false;
    void import("maplibre-gl").then(({ default: maplibre }) => {
      if (disposed || !box.current) return;
      const created = new maplibre.Map({ container: box.current, style: MAP_STYLE, center: [-83, 40], zoom: 8, attributionControl: { compact: true, customAttribution: "Routes: OSRM · © OpenStreetMap" } });
      created.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      created.on("load", () => { if (!disposed) setReady(true); });
      map.current = created;
    }).catch(() => setError("The map could not start in this browser."));
    return () => { disposed = true; map.current?.remove(); map.current = null; };
  }, []);

  const located = useMemo(() => new Map((routes?.stores ?? []).filter(s => s.latE6 != null && s.lngE6 != null).map(s => [s.id, s])), [routes]);
  const legFor = (from: StorePoint, to: StorePoint) => routes?.legs.find(l => l.fromLatE6 === from.latE6 && l.fromLngE6 === from.lngE6 && l.toLatE6 === to.latE6 && l.toLngE6 === to.lngE6);
  const summary = (tech: MapTech) => {
    let distance = 0, duration = 0, missing = 0;
    tech.stops.slice(1).forEach((job, i) => {
      const from = located.get(tech.stops[i].storeId), to = located.get(job.storeId);
      if (!from || !to || from.id === to.id) return;
      const leg = legFor(from, to);
      if (leg) { distance += leg.distanceM; duration += leg.durationS; } else missing++;
    });
    return { distance, duration, missing };
  };

  // Draw pins and road lines whenever the data or the chosen tech changes.
  useEffect(() => {
    const current = map.current;
    if (!current || !ready || !routes) return;
    void import("maplibre-gl").then(({ default: maplibre }) => {
      markers.current.forEach(m => m.remove()); markers.current = [];
      for (const layer of current.getStyle().layers ?? []) if (layer.id.startsWith("tech-route")) current.removeLayer(layer.id);
      for (const source of Object.keys(current.getStyle().sources ?? {})) if (source.startsWith("tech-route")) current.removeSource(source);
      const bounds = new maplibre.LngLatBounds();
      const lngLat = (s: StorePoint): [number, number] => [s.lngE6! / 1e6, s.latE6! / 1e6];
      const shown = techs.filter(t => !only || t.id === only);
      const seen = new Map<string, number>();
      const place = (store: StorePoint) => {
        const n = seen.get(store.id) ?? 0; seen.set(store.id, n + 1);
        const [lng, lat] = lngLat(store);
        return [lng + n * 0.0016, lat - n * 0.0010] as [number, number];
      };
      // One hollow dot per store with next-visit work; they never widen the view, so far-away ones don't pull the map out.
      if (showHeld && !only) for (const [storeId, jobs] of held.reduce((byStore, job) => byStore.set(job.storeId, [...(byStore.get(job.storeId) ?? []), job]), new Map<string, DispatchJob[]>())) {
        const store = located.get(storeId);
        if (!store) continue;
        const dot = clickablePin(() => onPickHeld?.(jobs));
        dot.className = styles.held;
        dot.textContent = jobs.length > 1 ? String(jobs.length) : "";
        dot.title = `Next-visit ${jobs.length === 1 ? "job" : "jobs"} · ${shortStore(jobs[0])} · ${jobs.map(jobShortName).join(", ")}`;
        dot.setAttribute("aria-label", dot.title);
        markers.current.push(new maplibre.Marker({ element: dot }).setLngLat(lngLat(store)).setOffset([-15, -15]).addTo(current));
      }
      if (!only) for (const job of queue) {
        const store = located.get(job.storeId);
        if (!store) continue;
        const pin = clickablePin(() => onOpen(job));
        pin.className = styles.waiting;
        pin.title = `Needs a tech · ${jobShortName(job)} · ${shortStore(job)}`;
        pin.setAttribute("aria-label", pin.title);
        const at = lngLat(store);
        // Waiting jobs sit just beside the store and under any numbered stop there.
        markers.current.push(new maplibre.Marker({ element: pin }).setLngLat(at).setOffset([15, -15]).addTo(current));
        bounds.extend(at);
      }
      shown.forEach((tech, techIndex) => {
        const lines = tech.stops.slice(1).flatMap((job, i) => {
          const from = located.get(tech.stops[i].storeId), to = located.get(job.storeId);
          const leg = from && to && from.id !== to.id ? legFor(from, to) : undefined;
          return leg ? [decodePolyline6(leg.geometry)] : [];
        });
        if (lines.length) {
          const id = `tech-route-${techIndex}`;
          current.addSource(id, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } } });
          current.addLayer({ id: `${id}-casing`, type: "line", source: id, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 } });
          current.addLayer({ id, type: "line", source: id, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": tech.color, "line-width": 4.5 } });
          lines.flat().forEach(point => bounds.extend(point));
        }
        tech.stops.forEach((job, i) => {
          const store = located.get(job.storeId);
          if (!store) return;
          const pin = clickablePin(() => onOpen(job));
          pin.className = styles.pin; pin.style.borderColor = tech.color; pin.textContent = String(i + 1);
          pin.title = `${tech.name} · stop ${i + 1} · ${jobShortName(job)} · ${shortStore(job)}`;
          pin.setAttribute("aria-label", pin.title);
          const at = place(store);
          markers.current.push(new maplibre.Marker({ element: pin }).setLngLat(at).addTo(current));
          bounds.extend(at);
        });
        const here = tech.currentStoreId ? located.get(tech.currentStoreId) : undefined;
        if (here) {
          const badge = document.createElement("span");
          badge.className = styles.here; badge.style.background = tech.color;
          badge.textContent = tech.name.split(" ").map(part => part[0]).join("").slice(0, 2);
          badge.title = `${tech.name} is checked in here`;
          const [lng, lat] = lngLat(here);
          markers.current.push(new maplibre.Marker({ element: badge, anchor: "bottom" }).setLngLat([lng, lat]).setOffset([0, -16]).addTo(current));
          bounds.extend([lng, lat]);
        }
      });
      // Re-centre only when the set of pins changes, so a refresh never undoes the user's zoom.
      const fitKey = bounds.isEmpty() ? "" : bounds.toArray().flat().map(n => n.toFixed(4)).join(",");
      if (fitKey && fitKey !== fitted.current) { fitted.current = fitKey; current.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 0 }); }
    });
    // legFor/located derive from routes; techs and queue identity come from the board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routes, techs, queue, only, showHeld, held]);

  return (
    <div className={styles.wrap}>
      <div className={styles.mapBox}>
        <div ref={box} className={styles.map} role="region" aria-label="Map of today's jobs" />
        {error ? <p className={styles.notice} role="alert">{error}</p>
          : routes && !routes.enabled ? <p className={styles.notice}>Driving routes are not set up yet. Pins show where each job is.</p>
          : routes && routes.pending > 0 ? <p className={styles.notice}>Loading driving routes…</p> : null}
      </div>
      <aside className={styles.legend} aria-label="Technicians on the map">
        {/* Next-visit jobs sit at the top so they're easy to find. */}
        {held.length ? (
          <label className={styles.heldToggle}>
            <input type="checkbox" checked={showHeld} onChange={toggleHeld} />
            <span>
              <span className={styles.held} aria-hidden="true" /> Show next-visit small jobs ({held.length})
              <small>Look along a route and add one to a tech&apos;s day.</small>
            </span>
          </label>
        ) : null}
        <h2>Technicians</h2>
        <ul>
          {techs.map(tech => {
            const s = summary(tech);
            return (
              <li key={tech.id}>
                <div className={styles.techRow}>
                  <button aria-pressed={only === tech.id} onClick={() => setOnly(only === tech.id ? undefined : tech.id)}>
                    <span className={styles.swatch} style={{ background: tech.color }} />
                    <span>
                      <strong>{tech.name}</strong>
                      <small>
                        {tech.stops.length ? `${tech.stops.length} ${tech.stops.length === 1 ? "stop" : "stops"}` : "Nothing planned"}
                        {s.duration ? ` · ${minutes(s.duration)} driving · ${miles(s.distance)}` : ""}
                      </small>
                    </span>
                  </button>
                  {tech.stops.length ? (
                    <button className={styles.more} aria-expanded={openTech === tech.id} aria-label={`${openTech === tech.id ? "Hide" : "Show"} ${tech.name}'s jobs`} title="Jobs and order" onClick={() => { setOpenTech(openTech === tech.id ? undefined : tech.id); setOnly(tech.id); }}>⋯</button>
                  ) : null}
                </div>
                {openTech === tech.id ? (
                  <ol className={styles.stopList}>
                    {tech.stops.map((job, i) => {
                      const movable = Boolean(onMove && canMove?.(job));
                      return (
                        <li key={job.id}>
                          <span className={styles.stopNumber} style={{ borderColor: tech.color }}>{i + 1}</span>
                          <button className={styles.stopName} onClick={() => onOpen(job)} title={job.problem}>
                            <strong>{jobShortName(job)}</strong>
                            <small>{shortStore(job)}</small>
                          </button>
                          {movable ? (
                            <span className={styles.arrows}>
                              <button aria-label={`Move ${jobShortName(job)} earlier`} disabled={busy || i === 0} onClick={() => onMove?.(job, tech.id, i - 1)}>↑</button>
                              <button aria-label={`Move ${jobShortName(job)} later`} disabled={busy || i === tech.stops.length - 1} onClick={() => onMove?.(job, tech.id, i + 1)}>↓</button>
                            </span>
                          ) : onMove ? <small className={styles.fixed}>{job.status === "in_progress" ? "Working now" : "Can't move"}</small> : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ul>
        {only ? <button className={styles.showAll} onClick={() => setOnly(undefined)}>Show everyone</button> : null}
        {queue.length ? <p className={styles.waitingKey}><span className={styles.waiting} aria-hidden="true" /> {queue.length} {queue.length === 1 ? "job needs" : "jobs need"} a tech</p> : null}
        <p className={styles.fine}>Drive times are for a typical day, not live traffic.</p>
      </aside>
    </div>
  );
}
