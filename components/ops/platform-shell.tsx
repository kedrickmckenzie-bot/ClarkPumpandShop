"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ChevronDown,
  FileBarChart,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  Store,
  Truck,
  UsersRound,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OperatorRole, OperatorSession } from "./data-contract";
import {
  contextualNavigationForPath,
  navigationForRole,
  navigationItemIsActive,
  pathMatches,
  roleLabel,
  type NavigationItem,
} from "./navigation";
import { PreviewRoleSwitcher } from "./preview-role-switcher";
import { roleCan, type OperatorCapability } from "./role-policy";
import styles from "./ops.module.css";

const iconByNavigationId: Record<NavigationItem["id"], LucideIcon> = {
  home: LayoutDashboard,
  work: Wrench,
  stores: Store,
  vendors: Truck,
  insights: BarChart3,
  reports: FileBarChart,
};

const createActions: Array<{
  label: string;
  description: string;
  href: string;
  capability: OperatorCapability;
}> = [
  {
    label: "Report an issue",
    description: "Capture a store problem",
    href: "/app/requests/new",
    capability: "create_request",
  },
  {
    label: "Create work order",
    description: "Authorize internal or vendor work",
    href: "/app/work-orders/new",
    capability: "create_work_order",
  },
  {
    label: "Add store",
    description: "Create a new location",
    href: "/app/stores/new",
    capability: "create_store",
  },
  {
    label: "Add vendor",
    description: "Onboard an approved provider",
    href: "/app/vendors/new",
    capability: "onboard_vendor",
  },
];

interface PlatformShellProps {
  session: OperatorSession;
  children: React.ReactNode;
}

function NavigationLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const Icon = iconByNavigationId[item.id];
  const active = navigationItemIsActive(item, pathname);

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

function PrimaryNavigation({ session, pathname }: { session: OperatorSession; pathname: string }) {
  return (
    <nav aria-label="Primary navigation" className={styles.navGroups}>
      {navigationForRole(session.role).map((item) => (
        <NavigationLink item={item} pathname={pathname} key={item.id} />
      ))}
    </nav>
  );
}

function ContextualNavigation({ session, pathname }: { session: OperatorSession; pathname: string }) {
  const group = contextualNavigationForPath(session.role, pathname);
  if (!group) return null;

  return (
    <div className={styles.contextNavBar}>
      <nav aria-label={`${group.label} sections`} className={styles.contextNav}>
        {group.items.map((item) => {
          const active = pathMatches(pathname, item.href);
          return (
            <Link
              className={`${styles.contextNavLink} ${active ? styles.contextNavLinkActive : ""}`}
              href={item.href}
              aria-current={active ? "page" : undefined}
              key={item.id}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
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

function ProfileFooter({ session }: { session: OperatorSession }) {
  return (
    <div className={styles.sidebarFooter}>
      {roleCan(session.role, "administer") ? (
        <Link className={styles.supportLink} href="/app/admin">
          <Settings2 aria-hidden="true" size={18} /> Administration
        </Link>
      ) : null}
      <div className={styles.profilePanel}>
        <UserSummary session={session} />
        <PreviewRoleSwitcher role={session.role} />
      </div>
    </div>
  );
}

function CreateMenu({ role }: { role: OperatorRole }) {
  const actions = createActions.filter((action) => roleCan(role, action.capability));
  if (!actions.length) return null;

  return (
    <details className={styles.createMenu}>
      <summary>
        <Plus aria-hidden="true" size={18} />
        <span>Create</span>
        <ChevronDown aria-hidden="true" size={16} className={styles.createMenuChevron} />
      </summary>
      <nav aria-label="Create a record" className={styles.createMenuPanel}>
        {actions.map((action) => (
          <Link href={action.href} key={action.href}>
            <strong>{action.label}</strong>
            <small>{action.description}</small>
          </Link>
        ))}
      </nav>
    </details>
  );
}

export function PlatformShell({ session, children }: PlatformShellProps) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>

      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/app/overview" aria-label="TraceOps home">
          <span className={styles.brandMark}><Building2 aria-hidden="true" size={21} /></span>
          <span><strong>TraceOps</strong><small>Convenience Suite</small></span>
        </Link>

        <div className={styles.organizationContext}>
          <span>Organization</span>
          <strong>{session.organizationName}</strong>
          <small>{session.scopeLabel}</small>
        </div>

        <PrimaryNavigation session={session} pathname={pathname} />
        <ProfileFooter session={session} />
      </aside>

      <div className={styles.contentColumn}>
        <div className={styles.topbarFrame}>
          <header className={styles.topbar}>
            <details className={styles.mobileMenu} key={pathname}>
              <summary aria-label="Toggle navigation menu"><Menu aria-hidden="true" size={22} /> Menu</summary>
              <div className={styles.mobileMenuPanel}>
                <div className={styles.mobileMenuHeading}>
                  <span><strong>{session.organizationName}</strong><small>{session.scopeLabel}</small></span>
                </div>
                <PrimaryNavigation session={session} pathname={pathname} />
                <ProfileFooter session={session} />
              </div>
            </details>

            <form className={styles.globalSearch} action="/app/search" method="get" role="search">
              <Search aria-hidden="true" size={19} />
              <label className={styles.visuallyHidden} htmlFor="global-platform-search">Search TraceOps</label>
              <input
                id="global-platform-search"
                name="q"
                type="search"
                placeholder="Search stores, work orders, vendors, or equipment"
                autoComplete="off"
              />
              <button type="submit">Search</button>
            </form>

            <div className={styles.topbarContext} aria-label="Current access scope">
              <UsersRound aria-hidden="true" size={18} />
              <span><strong>{roleLabel(session.role)}</strong><small>{session.scopeLabel}</small></span>
            </div>
            <CreateMenu role={session.role} />
          </header>
          <ContextualNavigation session={session} pathname={pathname} />
        </div>

        <main className={styles.main} id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
