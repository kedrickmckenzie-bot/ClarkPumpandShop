"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  PackageSearch,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  UsersRound,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OperatorSession } from "./data-contract";
import { navigationForRole, roleLabel, type NavigationItem } from "./navigation";
import { PreviewRoleSwitcher } from "./preview-role-switcher";
import styles from "./ops.module.css";

const iconByNavigationId: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  actions: ClipboardCheck,
  requests: ClipboardList,
  work: Wrench,
  visits: ShieldCheck,
  stores: Store,
  vendors: Truck,
  spend: ReceiptText,
  equipment: PackageSearch,
  pm: CalendarCheck2,
  lifecycle: Gauge,
  reports: FileBarChart,
  admin: Settings2,
};

interface PlatformShellProps {
  session: OperatorSession;
  children: React.ReactNode;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const Icon = iconByNavigationId[item.id] ?? BarChart3;
  const active = isActive(pathname, item.href);

  return (
    <Link
      className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
      href={item.href}
      aria-current={active ? "page" : undefined}
    >
      <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

function NavigationGroups({ session, pathname }: { session: OperatorSession; pathname: string }) {
  const navigation = navigationForRole(session.role);
  const groups: Array<{ id: NavigationItem["section"]; label: string }> = [
    { id: "workspace", label: "Operate" },
    { id: "intelligence", label: "Understand" },
    { id: "manage", label: "Manage" },
  ];

  return (
    <nav aria-label="Operator navigation" className={styles.navGroups}>
      {groups.map((group) => {
        const items = navigation.filter((item) => item.section === group.id);
        if (items.length === 0) return null;
        return (
          <div className={styles.navGroup} key={group.id}>
            <p className={styles.navGroupLabel}>{group.label}</p>
            {items.map((item) => (
              <NavigationLink item={item} pathname={pathname} key={item.id} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

function UserSummary({ session }: { session: OperatorSession }) {
  const initials = session.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className={styles.userSummary}>
      <span className={styles.avatar} aria-hidden="true">{initials || "OP"}</span>
      <span className={styles.userCopy}>
        <strong>{session.displayName}</strong>
        <span>{roleLabel(session.role)}</span>
      </span>
    </div>
  );
}

export function PlatformShell({ session, children }: PlatformShellProps) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>

      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/app/overview" aria-label="TraceOps overview">
          <span className={styles.brandMark}><Building2 aria-hidden="true" size={21} /></span>
          <span><strong>TraceOps</strong><small>Convenience Suite</small></span>
        </Link>

        <div className={styles.organizationContext}>
          <span>Organization</span>
          <strong>{session.organizationName}</strong>
          <small>{session.scopeLabel}</small>
        </div>

        <NavigationGroups session={session} pathname={pathname} />

        <div className={styles.sidebarFooter}>
          <Link className={styles.supportLink} href="/app/action-center?view=help">
            <LifeBuoy aria-hidden="true" size={18} /> Support & guidance
          </Link>
          <UserSummary session={session} />
        </div>
      </aside>

      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          <details className={styles.mobileMenu} key={pathname}>
            <summary aria-label="Toggle navigation menu"><Menu aria-hidden="true" size={22} /> Menu</summary>
            <div className={styles.mobileMenuPanel}>
              <div className={styles.mobileMenuHeading}>
                <span><strong>{session.organizationName}</strong><small>{session.scopeLabel}</small></span>
              </div>
              <NavigationGroups session={session} pathname={pathname} />
              <UserSummary session={session} />
            </div>
          </details>

          <form className={styles.globalSearch} action="/app/stores" method="get" role="search">
            <Search aria-hidden="true" size={19} />
            <label className={styles.visuallyHidden} htmlFor="global-store-search">Search stores</label>
            <input
              id="global-store-search"
              name="q"
              type="search"
              placeholder="Search store number, name, or address"
              autoComplete="off"
            />
            <button type="submit">Search</button>
          </form>

          <div className={styles.topbarContext} aria-label="Current access scope">
            <UsersRound aria-hidden="true" size={18} />
            <span><strong>{roleLabel(session.role)}</strong><small>{session.scopeLabel}</small></span>
          </div>
          <PreviewRoleSwitcher role={session.role} />
        </header>

        <main className={styles.main} id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
