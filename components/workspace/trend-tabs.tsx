import Link from "next/link";
import styles from "./in-house-trends.module.css";

export type TrendTabId = "overview" | "in_house" | "stores" | "vendors" | "planning" | "records";
const TABS: Array<{ id: TrendTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "in_house", label: "In-house vs vendors" },
  { id: "stores", label: "Stores" },
  { id: "vendors", label: "Vendors" },
  { id: "planning", label: "Plan ahead" },
  { id: "records", label: "Records" },
];

/** One short row of trend tabs. Links keep the chosen dates and locations; `hrefs` overrides a tab's link. */
export function TrendTabs({ active, query = {}, hrefs = {} }: { active: TrendTabId; query?: Record<string, string>; hrefs?: Partial<Record<TrendTabId, string>> }) {
  return (
    <nav className={styles.tabs} aria-label="Trend views">
      {TABS.map((tab) => (
        <Link key={tab.id} href={hrefs[tab.id] ?? `/app/trends?${new URLSearchParams({ ...query, view: tab.id })}`} aria-current={tab.id === active ? "page" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}
