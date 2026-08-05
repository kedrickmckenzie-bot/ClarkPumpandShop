"use client";

import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  FileStack,
  Inbox,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Plus,
  QrCode,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import Link from "@/components/site-link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navGroups = [
  {
    label: "Maintenance",
    items: [
      { href: "/", label: "Maintenance Home", icon: LayoutDashboard },
      { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
      { href: "/my-work", label: "My Work", icon: UserRound },
      { href: "/requests", label: "Service Requests", icon: Inbox },
      { href: "/schedule", label: "Schedule & Dispatch", icon: CalendarDays },
      { href: "/pm", label: "Preventive Maintenance", icon: ShieldCheck },
    ],
  },
  {
    label: "Equipment & parts",
    items: [
      { href: "/stores", label: "Stores & Locations", icon: Store },
      { href: "/systems/refrigeration", label: "Cost Centers & Assets", icon: Wrench },
      { href: "/parts", label: "Parts & Inventory", icon: PackageSearch },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/vendors", label: "Vendors", icon: Truck },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/files", label: "Files & Costs", icon: FileStack },
      { href: "/setup", label: "Portfolio Setup", icon: Settings2 },
    ],
  },
];

const fieldItems = [
  { href: "/reports/new", label: "Report a Problem", icon: Plus },
  { href: "/technician/store_demo_45_Y8m4xB2p", label: "Technician QR", icon: QrCode },
];

const roles = [
  "Owner / Executive",
  "Facilities Manager",
  "Regional Manager",
  "Store Manager",
  "Frontline Employee",
  "Vendor Office",
  "Vendor Technician",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState("Facilities Manager");

  useEffect(() => {
    const saved = window.localStorage.getItem("clarks-demo-role");
    const timer = window.setTimeout(() => {
      if (saved && roles.includes(saved)) setRole(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateRole(nextRole: string) {
    setRole(nextRole);
    window.localStorage.setItem("clarks-demo-role", nextRole);
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">CO</div>
          <div className="brand-copy"><strong>Clark&apos;s Maintenance</strong><span>CMMS workspace</span></div>
        </div>
        {navGroups.map((group) => <div key={group.label}>
          <div className="nav-label">{group.label}</div>
          <nav className="nav-list">
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} className={`nav-link ${isActive(href) ? "active" : ""}`} href={href} onClick={() => setMenuOpen(false)}>
                <Icon aria-hidden="true" />{label}
              </Link>
            ))}
          </nav>
        </div>)}
        <div className="nav-label">Field access</div>
        <nav className="nav-list">
          {fieldItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} className={`nav-link ${isActive(href) ? "active" : ""}`} href={href} onClick={() => setMenuOpen(false)}>
              <Icon aria-hidden="true" />{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="pilot-note"><span className="pilot-dot" /><span>One maintenance hierarchy for a single store, a region, or all 65 pilot locations.</span></div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div className="scope-control">
            <button className="icon-button mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={17} /> : <Menu size={17} />}</button>
            <div className="scope-icon"><Building2 size={15} /></div>
            <div><strong>Clark&apos;s Operations</strong><span>65 stores · maintenance operations</span></div>
          </div>
          <div className="top-actions">
            <Link className="button primary small top-create" href="/work-orders/new"><Plus size={14} />Create work order</Link>
            <span className="demo-badge top-demo"><Boxes size={12} />Pilot workspace · Aug 5, 2026</span>
            <button className="icon-button notifications" aria-label="Notifications"><Bell size={16} /></button>
            <label className="sr-only" htmlFor="demo-role">Preview role</label>
            <select className="role-select" id="demo-role" value={role} onChange={(event) => updateRole(event.target.value)} aria-label="Preview as role">
              {roles.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
