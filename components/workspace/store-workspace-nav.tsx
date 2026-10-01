import Link from "next/link";
import styles from "./compliance.module.css";

/** Store record sections shown as tabs on the store page (`?section=`). */
export const STORE_SECTION_TABS = [
  { id: "work-history", label: "Work & visits" },
  { id: "upcoming-visits", label: "Upcoming visits" },
  { id: "ready-to-bundle", label: "Saved jobs" },
  { id: "equipment", label: "Equipment" },
  { id: "preventive-maintenance-plans", label: "PM" },
  { id: "service-areas", label: "Spending" },
] as const;
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
