"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  HardHat,
  Landmark,
  Menu,
  Plus,
  Search,
  Settings2,
  Store,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import Link from "@/components/site-link";
import { platformData, platformSummary } from "@/lib/platform/data";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type SearchResult = {
  id: string;
  kind: "Store" | "Work order" | "Equipment" | "Provider";
  title: string;
  detail: string;
  href: string;
  search: string;
};

const navGroups = [
  {
    label: "Control",
    items: [
      { href: "/", label: "Portfolio overview", icon: Gauge },
      { href: "/stores", label: "Stores", icon: Store },
      { href: "/accountability", label: "Accountability", icon: AlertTriangle },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/maintenance", label: "Maintenance", icon: ClipboardList },
      { href: "/equipment", label: "Equipment", icon: Wrench },
    ],
  },
  {
    label: "Financial control",
    items: [
      { href: "/financials", label: "Accounting", icon: Landmark },
      { href: "/providers", label: "Providers", icon: UsersRound },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

function buildSearchIndex(extraStores: Array<Record<string, unknown>>): SearchResult[] {
  const stores: SearchResult[] = platformData.stores.map((store) => ({
    id: store.id,
    kind: "Store",
    title: `Store ${store.code} · ${store.city}`,
    detail: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`,
    href: `/stores/${store.id}`,
    search: `${store.code} ${store.name} ${store.address1} ${store.city} ${store.state} ${store.postalCode}`.toLowerCase(),
  }));
  for (const store of extraStores) {
    if (!store.id || stores.some((candidate) => candidate.id === store.id)) continue;
    const code = String(store.code ?? "New");
    const city = String(store.city ?? "New location");
    const address = `${String(store.address1 ?? "")}, ${city}, ${String(store.state ?? "")} ${String(store.postalCode ?? "")}`.trim();
    stores.push({ id: String(store.id), kind: "Store", title: `Store ${code} · ${city}`, detail: address, href: `/stores/${String(store.id)}`, search: `${code} ${String(store.name ?? "")} ${address}`.toLowerCase() });
  }
  const workOrders: SearchResult[] = platformData.workOrders.map((workOrder) => {
    const store = platformData.stores.find((candidate) => candidate.id === workOrder.storeId);
    return {
      id: workOrder.id,
      kind: "Work order",
      title: `${workOrder.number} · ${workOrder.title}`,
      detail: `${store ? `Store ${store.code}` : "Unknown store"} · ${workOrder.status.replaceAll("_", " ")}`,
      href: `/work-orders/${workOrder.id}`,
      search: `${workOrder.number} ${workOrder.title} ${workOrder.description} ${store?.code ?? ""} ${store?.address1 ?? ""}`.toLowerCase(),
    };
  });
  const assets: SearchResult[] = platformData.assets.map((asset) => {
    const system = platformData.systems.find((candidate) => candidate.id === asset.storeSystemId);
    const store = platformData.stores.find((candidate) => candidate.id === system?.storeId);
    return {
      id: asset.id,
      kind: "Equipment",
      title: `${asset.assetTag} · ${asset.name}`,
      detail: `${store ? `Store ${store.code}` : "Unknown store"} · ${asset.manufacturer} ${asset.model}`,
      href: `/assets/${asset.id}`,
      search: `${asset.assetTag} ${asset.name} ${asset.assetClass} ${asset.manufacturer} ${asset.model} ${asset.serial} ${store?.code ?? ""}`.toLowerCase(),
    };
  });
  const providers: SearchResult[] = platformData.vendors.map((vendor) => ({
    id: vendor.id,
    kind: "Provider",
    title: vendor.name,
    detail: `${vendor.trade} · ${vendor.dispatchEmail}`,
    href: `/providers/${vendor.id}`,
    search: `${vendor.name} ${vendor.shortName} ${vendor.trade} ${vendor.dispatchEmail}`.toLowerCase(),
  }));
  return [...stores, ...workOrders, ...assets, ...providers];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [extraStores, setExtraStores] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    fetch("/api/registry?entity=stores")
      .then((response) => response.json())
      .then((raw) => {
        const result = raw as { ok?: boolean; records?: Array<Record<string, unknown>> };
        if (result.ok) setExtraStores(result.records ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "Escape") {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timeout);
  }, [searchOpen]);

  const searchIndex = useMemo(() => buildSearchIndex(extraStores), [extraStores]);
  const results = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return searchIndex.filter((item) => item.kind === "Store").slice(0, 8);
    return searchIndex
      .filter((item) => tokens.every((token) => item.search.includes(token)))
      .sort((a, b) => (a.kind === "Store" ? -1 : b.kind === "Store" ? 1 : a.title.localeCompare(b.title)))
      .slice(0, 18);
  }, [query, searchIndex]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/maintenance") return pathname.startsWith("/maintenance") || pathname.startsWith("/work-orders") || pathname.startsWith("/requests") || pathname.startsWith("/pm") || pathname.startsWith("/my-work") || pathname.startsWith("/schedule");
    if (href === "/equipment") return pathname.startsWith("/equipment") || pathname.startsWith("/systems") || pathname.startsWith("/assets") || pathname.startsWith("/components");
    if (href === "/providers") return pathname.startsWith("/providers") || pathname.startsWith("/vendors");
    return pathname.startsWith(href);
  }

  function chooseResult(result: SearchResult) {
    setSearchOpen(false);
    setQuery("");
    router.push(result.href);
  }

  return (
    <div className="platform-shell">
      <aside className={`platform-sidebar ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
        <div className="platform-brand">
          <div className="platform-brand-mark" aria-hidden="true"><CircleDollarSign /></div>
          <div><strong>R&amp;M Control</strong><span>Clark&apos;s pilot workspace</span></div>
        </div>
        <button className="scope-card" type="button">
          <span className="scope-card-icon"><Building2 /></span>
          <span><small>Operating company</small><strong>Clark&apos;s Stores</strong><em>{platformSummary.stores} locations · all regions</em></span>
          <ChevronDown />
        </button>
        {navGroups.map((group) => (
          <div className="platform-nav-group" key={group.label}>
            <p>{group.label}</p>
            <nav>
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link key={href} className={`platform-nav-link ${isActive(href) ? "active" : ""}`} href={href} onClick={() => setMenuOpen(false)}>
                  <Icon aria-hidden="true" /><span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        ))}
        <div className="platform-sidebar-spacer" />
        <div className="platform-nav-group platform-nav-bottom">
          <nav><Link className={`platform-nav-link ${pathname.startsWith("/setup") ? "active" : ""}`} href="/setup"><Settings2 /><span>Administration</span></Link></nav>
        </div>
        <div className="data-health-card">
          <div><span>Portfolio data</span><strong>92% classified</strong></div>
          <div className="mini-progress"><i style={{ width: "92%" }} /></div>
          <small>Unclassified costs stay visible</small>
        </div>
      </aside>

      <div className="platform-stage">
        <header className="platform-topbar">
          <button className="topbar-menu" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          <button className="global-search-trigger" type="button" onClick={() => setSearchOpen(true)}>
            <Search /><span>Search store number, address, work order, equipment or provider</span><kbd>⌘ K</kbd>
          </button>
          <div className="topbar-actions">
            <Link className="primary-action" href="/work-orders/new"><Plus />New work order</Link>
            <button className="topbar-icon" type="button" aria-label="Notifications"><Bell /><span>7</span></button>
            <div className="account-chip"><span>KM</span><div><strong>Kedrick</strong><small>Portfolio administrator</small></div></div>
          </div>
        </header>
        <main className="platform-main">{children}</main>
      </div>

      {menuOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      {searchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search the platform">
          <button className="search-backdrop" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} />
          <section className="search-panel">
            <div className="search-input-row"><Search /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “45”, “Main Street”, “CWO-0245” or “compressor”…" /><button type="button" onClick={() => setSearchOpen(false)}>Esc</button></div>
            <div className="search-panel-head"><span>{query ? `${results.length} matching records` : "Recently viewed stores"}</span><small>Search includes aliases, legacy identifiers and full addresses</small></div>
            <div className="search-results">
              {results.map((result) => (
                <button type="button" key={`${result.kind}-${result.id}`} onClick={() => chooseResult(result)}>
                  <span className={`search-kind ${result.kind.toLowerCase().replace(" ", "-")}`}>{result.kind === "Store" ? <Store /> : result.kind === "Work order" ? <ClipboardList /> : result.kind === "Equipment" ? <Wrench /> : <HardHat />}</span>
                  <span><strong>{result.title}</strong><small>{result.detail}</small></span>
                  <em>{result.kind}</em>
                </button>
              ))}
              {!results.length && <div className="search-empty"><Search /><strong>No matching records</strong><span>Try a store number, city, address, work-order number, asset tag or provider.</span></div>}
            </div>
            <footer><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></footer>
          </section>
        </div>
      )}
    </div>
  );
}
