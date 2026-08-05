"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronDown,
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

const primaryNavItems = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/maintenance", label: "Maintenance", icon: ClipboardList },
  { href: "/financials", label: "Spending & bills", icon: Landmark },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

const moreNavItems = [
  { href: "/accountability", label: "What needs attention", icon: AlertTriangle },
  { href: "/work-orders", label: "All work orders", icon: ClipboardList },
  { href: "/requests", label: "Problems reported", icon: AlertTriangle },
  { href: "/pm", label: "Scheduled maintenance", icon: Wrench },
  { href: "/my-work", label: "My assigned work", icon: HardHat },
  { href: "/schedule", label: "Work calendar", icon: ClipboardList },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/providers", label: "Service companies", icon: UsersRound },
  { href: "/vendor-portal", label: "What vendors see", icon: Building2 },
  { href: "/setup", label: "Settings & setup", icon: Settings2 },
];

const moreRoutePrefixes = [
  ...moreNavItems.map((item) => item.href),
  "/systems",
  "/assets",
  "/components",
  "/cost-centers",
];

function isMoreRoute(pathname: string) {
  return moreRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function buildSearchIndex(extraStores: Array<Record<string, unknown>>): SearchResult[] {
  const stores: SearchResult[] = platformData.stores.map((store) => ({
    id: store.id,
    kind: "Store",
    title: `Store ${store.code} - ${store.city}`,
    detail: `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`,
    href: `/stores/${store.id}`,
    search: `${store.code} ${store.name} ${store.address1} ${store.city} ${store.state} ${store.postalCode}`.toLowerCase(),
  }));
  for (const store of extraStores) {
    if (!store.id || stores.some((candidate) => candidate.id === store.id)) continue;
    const code = String(store.code ?? "New");
    const city = String(store.city ?? "New location");
    const address = `${String(store.address1 ?? "")}, ${city}, ${String(store.state ?? "")} ${String(store.postalCode ?? "")}`.trim();
    stores.push({ id: String(store.id), kind: "Store", title: `Store ${code} - ${city}`, detail: address, href: `/stores/${String(store.id)}`, search: `${code} ${String(store.name ?? "")} ${address}`.toLowerCase() });
  }
  const workOrders: SearchResult[] = platformData.workOrders.map((workOrder) => {
    const store = platformData.stores.find((candidate) => candidate.id === workOrder.storeId);
    return {
      id: workOrder.id,
      kind: "Work order",
      title: `${workOrder.number} - ${workOrder.title}`,
      detail: `${store ? `Store ${store.code}` : "Store not selected"} - ${workOrder.status.replaceAll("_", " ")}`,
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
      title: `${asset.assetTag} - ${asset.name}`,
      detail: `${store ? `Store ${store.code}` : "Store not selected"} - ${asset.manufacturer} ${asset.model}`,
      href: `/assets/${asset.id}`,
      search: `${asset.assetTag} ${asset.name} ${asset.assetClass} ${asset.manufacturer} ${asset.model} ${asset.serial} ${store?.code ?? ""}`.toLowerCase(),
    };
  });
  const providers: SearchResult[] = platformData.vendors.map((vendor) => ({
    id: vendor.id,
    kind: "Provider",
    title: vendor.name,
    detail: `${vendor.trade} - ${vendor.dispatchEmail}`,
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
  const [moreOpen, setMoreOpen] = useState(false);
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
    if (href === "/maintenance") return pathname.startsWith("/maintenance");
    if (href === "/equipment") return pathname.startsWith("/equipment") || pathname.startsWith("/systems") || pathname.startsWith("/assets") || pathname.startsWith("/components");
    if (href === "/providers") return pathname.startsWith("/providers") || pathname.startsWith("/vendors");
    return pathname.startsWith(href);
  }

  function chooseResult(result: SearchResult) {
    setSearchOpen(false);
    setQuery("");
    router.push(result.href);
  }

  const showMoreItems = moreOpen || isMoreRoute(pathname);

  return (
    <div className="platform-shell">
      <aside className={`platform-sidebar ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
        <div className="platform-brand">
          <div className="platform-brand-mark" aria-hidden="true"><Wrench /></div>
          <div><strong>Clark&apos;s Maintenance</strong><span>Demo workspace</span></div>
        </div>
        <div className="scope-card">
          <span className="scope-card-icon"><Building2 /></span>
          <span><small>Demo company</small><strong>Clark&apos;s Stores</strong><em>{platformSummary.stores} example locations</em></span>
        </div>
        <div className="platform-nav-group">
          <p>Main menu</p>
          <nav>
            {primaryNavItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} className={`platform-nav-link ${isActive(href) ? "active" : ""}`} href={href} onClick={() => setMenuOpen(false)}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="platform-nav-group">
          <nav>
            <button
              className={`platform-nav-link ${isMoreRoute(pathname) ? "active" : ""}`}
              type="button"
              aria-expanded={showMoreItems}
              style={{ width: "100%", border: 0, background: isMoreRoute(pathname) ? undefined : "transparent", textAlign: "left", font: "inherit", cursor: "pointer" }}
              onClick={() => setMoreOpen((value) => !value)}
            >
              <Settings2 aria-hidden="true" /><span>More tools</span><ChevronDown aria-hidden="true" style={{ marginLeft: "auto", transform: showMoreItems ? "rotate(180deg)" : undefined }} />
            </button>
            {showMoreItems && moreNavItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} className={`platform-nav-link ${isActive(href) ? "active" : ""}`} href={href} onClick={() => setMenuOpen(false)}>
                <Icon aria-hidden="true" /><span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="platform-sidebar-spacer" />
      </aside>

      <div className="platform-stage">
        <header className="platform-topbar">
          <button className="topbar-menu" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <Menu />}</button>
          <button className="global-search-trigger" type="button" onClick={() => setSearchOpen(true)}>
            <Search /><span>Search stores, work orders, or equipment</span><kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            <Link className="primary-action" href="/work-orders/new"><Plus />Create work order</Link>
          </div>
        </header>
        <main className="platform-main">{children}</main>
      </div>

      {menuOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      {searchOpen && (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search stores and maintenance records">
          <button className="search-backdrop" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} />
          <section className="search-panel">
            <div className="search-input-row"><Search /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a store number, street, work order number, or equipment name" /><button type="button" onClick={() => setSearchOpen(false)}>Close</button></div>
            <div className="search-panel-head"><span>{query ? `${results.length} results` : "Demo stores"}</span><small>Start with a store number or address</small></div>
            <div className="search-results">
              {results.map((result) => (
                <button type="button" key={`${result.kind}-${result.id}`} onClick={() => chooseResult(result)}>
                  <span className={`search-kind ${result.kind.toLowerCase().replace(" ", "-")}`}>{result.kind === "Store" ? <Store /> : result.kind === "Work order" ? <ClipboardList /> : result.kind === "Equipment" ? <Wrench /> : <HardHat />}</span>
                  <span><strong>{result.title}</strong><small>{result.detail}</small></span>
                  <em>{result.kind === "Provider" ? "Service company" : result.kind}</em>
                </button>
              ))}
              {!results.length && <div className="search-empty"><Search /><strong>Nothing matched that search</strong><span>Try a store number, city, street, work order number, or equipment name.</span></div>}
            </div>
            <footer><span>Select a result to open it</span><span><kbd>Esc</kbd> closes search</span></footer>
          </section>
        </div>
      )}
    </div>
  );
}
