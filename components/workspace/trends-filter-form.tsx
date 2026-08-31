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

const groups = [
  { id: "analysis", label: "What to compare", description: "Choose the result, dates, and comparison." },
  { id: "operating_scope", label: "Locations", description: "Use the whole company, one region, or one store." },
  { id: "maintenance_scope", label: "More filters", description: "Narrow by work, equipment, component, or vendor." },
] as const;

export function TrendsFilterForm({ action, activeView, clearHref, filters, scopeSummary }: TrendsFilterFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasMaintenanceScope = filters.some((filter) => filter.group === "maintenance_scope" && Boolean(filter.value));

  return (
    <details className={styles.scopeControl}>
      <summary>
        <span><SlidersHorizontal size={17} aria-hidden="true" /><span><small>Analysis scope</small><strong>{scopeSummary}</strong></span></span>
        <span className={styles.scopeChange}>{pending ? "Updating…" : "Change"}<ChevronRight size={16} aria-hidden="true" /></span>
      </summary>
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
        <header><span><Filter size={17} aria-hidden="true" />Change analysis</span><Link href={clearHref}><RotateCcw size={15} aria-hidden="true" />Reset all</Link></header>
        <div className={styles.filterGroups}>
          {groups.map((group) => group.id === "maintenance_scope" ? (
            <details className={styles.filterGroup} key={group.id} open={hasMaintenanceScope}>
              <summary><span><strong>{group.label}</strong><small>{group.description}</small></span><ChevronRight size={16} aria-hidden="true" /></summary>
              <div className={styles.filterGrid}>{filters.filter((filter) => filter.group === group.id).map((filter) => (
                <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
              ))}</div>
            </details>
          ) : (
            <fieldset className={styles.filterGroup} key={group.id}>
              <legend>{group.label}</legend><p>{group.description}</p>
              <div className={styles.filterGrid}>{filters.filter((filter) => filter.group === group.id).map((filter) => (
                <label key={`${filter.id}:${filter.value ?? ""}`}><span>{filter.label}</span><select defaultValue={filter.value} name={filter.id}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{filter.helperText ? <small>{filter.helperText}</small> : null}</label>
              ))}</div>
            </fieldset>
          ))}
        </div>
        <button type="submit" disabled={pending}><Filter size={16} aria-hidden="true" />{pending ? "Updating analysis…" : "Apply changes"}</button>
      </form>
    </details>
  );
}
