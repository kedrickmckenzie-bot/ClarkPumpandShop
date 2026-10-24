"use client";
import { SearchPicker } from "@/components/ops/search-picker";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronRight, Filter, RotateCcw } from "lucide-react";
import type { TrendAnalysisPageViewModel } from "@/components/ops/data-contract";
import styles from "./trends-workspace.module.css";

interface TrendsFilterFormProps {
  action: string;
  activeView: TrendAnalysisPageViewModel["activeView"];
  clearHref: string;
  filters: TrendAnalysisPageViewModel["filters"];
  scopeSummary: string;
  scenarioQuery?: string;
}

const commonFilterIds = new Set(["metric", "period", "compare", "store"]);

export function TrendsFilterForm({ action, activeView, clearHref, filters, scopeSummary, scenarioQuery }: TrendsFilterFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasMaintenanceScope = filters.some((filter) => filter.group === "maintenance_scope" && Boolean(filter.value));
  const commonFilters = filters.filter((filter) => commonFilterIds.has(filter.id));
  const specialistFilters = filters.filter((filter) => !commonFilterIds.has(filter.id));
  const activeSpecialist = specialistFilters.filter((filter) => filter.id !== "breakdown" && filter.id !== "currency" && Boolean(filter.value)).length;

  return (
    <form
      className={`${styles.filters} ${styles.quickControls}`}
      action={action}
      method="get"
      onChange={(event) => { if (event.target instanceof HTMLSelectElement && event.target.closest(`.${styles.commonFilterGrid}`)) event.currentTarget.requestSubmit(); }}
      onSubmit={(event) => {
        event.preventDefault();
        const parameters = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget).entries()) {
          if (typeof value === "string" && value) parameters.set(key, value);
        }
        parameters.set("view", activeView);
        startTransition(() => router.push(`${action}?${parameters.toString()}`, { scroll: false }));
      }}
    >
      {activeView === "planning" ? ["planTarget", "planAllowance", "planContingency"].map((key) => <input type="hidden" name={key} value={new URLSearchParams(scenarioQuery).get(key) ?? ""} key={key} />) : null}
      <div className={`${styles.filterGrid} ${styles.commonFilterGrid}`}>
        {commonFilters.map((filter) => filter.options.length > 8 ? <FilterPicker key={`${filter.id}:${filter.value ?? ""}`} filter={filter} /> : (
          <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
        ))}
      </div>
      <details className={styles.filterGroup} open={hasMaintenanceScope}>
        <summary><span><strong>More filters{activeSpecialist ? ` · ${activeSpecialist} on` : ""}</strong><small>Region, who did the work, equipment, cost type, vendor</small></span><ChevronRight size={16} aria-hidden="true" /></summary>
        <div className={styles.filterGrid}>{specialistFilters.map((filter) => filter.options.length > 8 ? <FilterPicker key={`${filter.id}:${filter.value ?? ""}`} filter={filter} /> : (
          <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
        ))}</div>
      </details>
      <div className={styles.filterActions}>
        <button type="submit" disabled={pending}><Filter size={16} aria-hidden="true" />{pending ? "Updating…" : "Show"}</button>
        <Link href={clearHref} title={scopeSummary}><RotateCcw size={15} aria-hidden="true" />Reset</Link>
      </div>
    </form>
  );
}

/** Long filter lists (stores, vendors, equipment) are searched as you type instead of scrolled in a dropdown. */
function FilterPicker({ filter }: { filter: { id: string; label: string; value?: string; options: Array<{ value: string; label: string }> } }) {
  const all = filter.options.find((option) => !option.value);
  return <SearchPicker id={`trends-filter-${filter.id}`} compact name={filter.id} label={filter.label} placeholder={`Type to find ${filter.label.toLowerCase()}`}
    allowClear={Boolean(all)} clearLabel={all?.label ?? "Any"}
    options={filter.options.filter((option) => option.value).map((option) => ({ value: option.value, label: option.label }))} defaultValue={filter.value} />;
}
