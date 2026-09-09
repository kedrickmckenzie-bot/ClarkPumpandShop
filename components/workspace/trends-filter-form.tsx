"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronRight, Filter, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { TrendAnalysisPageViewModel } from "@/components/ops/data-contract";
import styles from "./trends-workspace.module.css";

interface TrendsFilterFormProps {
  action: string;
  activeView: TrendAnalysisPageViewModel["activeView"];
  clearHref: string;
  filters: TrendAnalysisPageViewModel["filters"];
  scopeSummary: string;
}

const commonFilterIds = new Set(["metric", "period", "compare", "region", "store"]);

export function TrendsFilterForm({ action, activeView, clearHref, filters, scopeSummary }: TrendsFilterFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasMaintenanceScope = filters.some((filter) => filter.group === "maintenance_scope" && Boolean(filter.value));
  const commonFilters = filters.filter((filter) => commonFilterIds.has(filter.id));
  const specialistFilters = filters.filter((filter) => !commonFilterIds.has(filter.id));

  return (
    <form
      className={styles.filters}
      action={action}
      method="get"
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
      <header>
        <span><SlidersHorizontal size={17} aria-hidden="true" /><span><strong>Analysis context</strong><small>{scopeSummary}</small></span></span>
        <Link href={clearHref}><RotateCcw size={15} aria-hidden="true" />Reset all</Link>
      </header>
      <div className={`${styles.filterGrid} ${styles.commonFilterGrid}`}>
        {commonFilters.map((filter) => (
          <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
        ))}
      </div>
      <details className={styles.filterGroup} open={hasMaintenanceScope}>
        <summary><span><strong>Specialist filters</strong><small>Break down the result or narrow by work, equipment, component, cost type, or vendor.</small></span><ChevronRight size={16} aria-hidden="true" /></summary>
        <div className={styles.filterGrid}>{specialistFilters.map((filter) => (
          <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
        ))}</div>
      </details>
      <button type="submit" disabled={pending}><Filter size={16} aria-hidden="true" />{pending ? "Updating analysis…" : "Apply changes"}</button>
    </form>
  );
}
