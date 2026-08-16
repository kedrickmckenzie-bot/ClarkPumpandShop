"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
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
import { productPresentation, productThemeVariables } from "@/lib/product/presentation";
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
import styles from "./platform-shell.module.css";

const iconByNavigationId: Record<NavigationItem["id"], LucideIcon> = {
  overview: LayoutDashboard,
  work: ClipboardList,
  stores: Store,
  equipment: Wrench,
  vendors: Truck,
  planning: BarChart3,
};

const createActions: Array<{
  label: string;
  description: string;
  href: string;
  capability: OperatorCapability;
}> = [
  {
    label: "Report an issue",
    description: "Capture a problem at a store",
    href: "/app/requests/new",
    capability: "create_request",
  },
  {
    label: "Create work order",
    description: "Authorize internal or outside work",
    href: "/app/work-orders/new",
    capability: "create_work_order",
  },
  {
    label: "Add equipment",
    description: "Register an asset at a store",
    href: "/app/equipment/new",
    capability: "setup_equipment",
  },
  {
    label: "Add store",
    description: "Create a new operating location",
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

function ProductIdentity({ compact = false }: { compact?: boolean }) {
  const { identity, assets, links } = productPresentation;

  return (
    <Link
      className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}
      href={links.workspaceHome}
      aria-label={`${identity.workingName} workspace home`}
    >
      <span className={styles.brandMark} aria-hidden="true">
        {assets.logoPath ? (
          <Image src={assets.logoPath} alt="" width={32} height={32} priority />
        ) : (
          identity.monogram
        )}
      </span>
      <span className={styles.brandCopy}>
        <strong>{identity.workingName}</strong>
        <small>{identity.suiteLabel}</small>
      </span>
    </Link>
  );
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

function SidebarFooter({ session }: { session: OperatorSession }) {
  return (
    <div className={styles.sidebarFooter}>
      <nav aria-label="Workspace settings" className={styles.secondaryNavigation}>
        {roleCan(session.role, "administer") ? (
          <Link className={styles.setupLink} href="/app/admin">
            <Settings2 aria-hidden="true" size={18} />
            <span>Setup</span>
          </Link>
        ) : null}
        {productPresentation.links.support ? (
          <a className={styles.setupLink} href={productPresentation.links.support}>Support</a>
        ) : null}
      </nav>
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
        <ChevronDown aria-hidden="true" size={15} className={styles.createMenuChevron} />
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
    <div className={styles.shell} style={productThemeVariables}>
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>

      <aside className={styles.sidebar}>
        <ProductIdentity />

        <div className={styles.organizationContext} aria-label="Current organization and scope">
          <span>Organization</span>
          <strong>{session.organizationName}</strong>
          <small>{session.scopeLabel}</small>
        </div>

        <PrimaryNavigation session={session} pathname={pathname} />
        <SidebarFooter session={session} />
      </aside>

      <div className={styles.contentColumn}>
        <div className={styles.topbarFrame}>
          <header className={styles.topbar}>
            <details className={styles.mobileMenu} key={pathname}>
              <summary aria-label="Open navigation">
                <Menu aria-hidden="true" size={22} />
                <span className={styles.visuallyHidden}>Menu</span>
              </summary>
              <div className={styles.mobileMenuPanel}>
                <div className={styles.mobileMenuHeading}>
                  <ProductIdentity />
                  <p>
                    <strong>{session.organizationName}</strong>
                    <span>{session.scopeLabel}</span>
                  </p>
                </div>
                <PrimaryNavigation session={session} pathname={pathname} />
                <SidebarFooter session={session} />
              </div>
            </details>

            <div className={styles.mobileBrand}><ProductIdentity compact /></div>

            <form className={styles.globalSearch} action="/app/search" method="get" role="search">
              <Search aria-hidden="true" size={18} />
              <label className={styles.visuallyHidden} htmlFor="global-platform-search">
                Search the workspace
              </label>
              <input
                id="global-platform-search"
                name="q"
                type="search"
                placeholder="Search store number, address, work order, vendor, or equipment"
                autoComplete="off"
              />
              <button type="submit">Search</button>
            </form>

            <div className={styles.topbarContext} aria-label="Current preview role and access scope">
              <UsersRound aria-hidden="true" size={18} />
              <span>
                <strong>{roleLabel(session.role)}</strong>
                <small>{session.scopeLabel}</small>
              </span>
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
