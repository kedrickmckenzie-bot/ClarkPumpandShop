import Link from "next/link";
import styles from "./compliance.module.css";
import type { OperatorRole } from "@/components/ops/data-contract";
import { roleCanAccessListRoute, roleCanAccessProgramRoute } from "@/components/ops/role-policy";
import { loadOperatorSession } from "@/app/app/_data/operator-loader";

/** Store tabs that show record sections; each groups the sections it lists (`?section=`). */
export const STORE_SECTION_TABS = [
  { id: "work", label: "Work", sections: ["upcoming-visits", "ready-to-bundle", "work-history"] },
  { id: "equipment", label: "Equipment & PM", sections: ["equipment", "preventive-maintenance-plans"] },
  { id: "spending", label: "Spending", sections: ["service-areas"] },
] as const;

/** The tab for a `?section=` value: a tab id, or any section a tab groups (older links). */
export function storeSectionTab(section?: string) {
  return section ? STORE_SECTION_TABS.find((tab) => tab.id === section || (tab.sections as readonly string[]).includes(section)) : undefined;
}
const STORE_PAGES = [
  { id: "tasks", label: "Tasks" },
  { id: "compliance", label: "Compliance" },
  { id: "warranties", label: "Warranties" },
  { id: "vendors", label: "Vendors" },
] as const;

type StoreTab = "overview" | (typeof STORE_SECTION_TABS)[number]["id"] | (typeof STORE_PAGES)[number]["id"];

/** Whether a role may open a store tab; tabs a role cannot use are not shown at all. */
export function roleCanSeeStoreTab(role: OperatorRole, tab: StoreTab) {
  if (tab === "tasks" || tab === "compliance") return role !== "technician";
  if (tab === "spending") return roleCanAccessProgramRoute(role, "spend");
  if (tab === "warranties") return roleCanAccessListRoute(role, "warranties");
  if (tab === "vendors") return roleCanAccessListRoute(role, "vendors");
  if (tab === "equipment") return roleCanAccessProgramRoute(role, "equipment");
  return true;
}

/** One row of store tabs: overview, record sections, then the store's own pages. */
export async function StoreWorkspaceNav({ id, active = "overview" }: { id: string; active?: StoreTab }) {
  const { role } = await loadOperatorSession();
  const base = `/app/stores/${encodeURIComponent(id)}`;
  const tabs = [
    { id: "overview" as const, label: "Overview", href: base },
    ...STORE_SECTION_TABS.map((tab) => ({ ...tab, href: `${base}?section=${tab.id}` })),
    ...STORE_PAGES.map((tab) => ({ ...tab, href: `${base}/${tab.id}` })),
  ].filter((tab) => roleCanSeeStoreTab(role, tab.id));
  return <nav className={styles.filters} aria-label="Store pages">{tabs.map((tab) => <Link key={tab.id} aria-current={tab.id === active ? "page" : undefined} href={tab.href}>{tab.label}</Link>)}</nav>;
}
