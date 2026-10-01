import Link from "next/link";
import styles from "./compliance.module.css";

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

/** One row of store tabs: overview, record sections, then the store's own pages. */
export function StoreWorkspaceNav({ id, active = "overview" }: { id: string; active?: StoreTab }) {
  const base = `/app/stores/${encodeURIComponent(id)}`;
  const tabs = [
    { id: "overview", label: "Overview", href: base },
    ...STORE_SECTION_TABS.map((tab) => ({ ...tab, href: `${base}?section=${tab.id}` })),
    ...STORE_PAGES.map((tab) => ({ ...tab, href: `${base}/${tab.id}` })),
  ];
  return <nav className={styles.filters} aria-label="Store pages">{tabs.map((tab) => <Link key={tab.id} aria-current={tab.id === active ? "page" : undefined} href={tab.href}>{tab.label}</Link>)}</nav>;
}
