import type { OrganizationScope } from "../repository";
import type { OpsFixture } from "../types";
import type { ReportCatalogEntry } from "../report-catalog";
import { buildReportContext } from "./facts";
import type { ReportOptions } from "./options";
import { resolvePeriod } from "./period";
import type { ReportDoc } from "./doc";
import { buildOwnerSummary } from "./owner-summary";
import { buildVendorAp } from "./vendor-ap";
import { buildInHouseTeam, buildVendorPerformance } from "./team-and-vendors";
import { buildStoreReport } from "./store-report";
import { spendIn } from "./common";

/** Who may open a report: its named roles, or anyone who can open Reports. */
export function canOpenReport(entry: Pick<ReportCatalogEntry, "roles">, role: string) {
  return !entry.roles || (entry.roles as readonly string[]).includes(role);
}

/** Builds a purpose-built report from source records for one scope. Pure: same inputs, same report. */
export function buildReport(entry: ReportCatalogEntry, fixture: OpsFixture, scope: OrganizationScope, options: ReportOptions, now: string, today: string): ReportDoc {
  const period = resolvePeriod(options.period, today);
  const ctx = buildReportContext(fixture, scope, options, now, today);
  switch (entry.id) {
    case "owner-summary": return buildOwnerSummary(ctx, options, period);
    case "vendor-ap": return buildVendorAp(ctx, options, period);
    case "vendor-performance": return buildVendorPerformance(ctx, options, period);
    case "in-house-team": return buildInHouseTeam(ctx, options, period);
    case "store-report": return buildStoreReport(ctx, options, period, () => {
      // The average store across everything this person can see, not just the chosen store.
      const wide = buildReportContext(fixture, scope, { region: options.region }, now, today);
      return spendIn(wide, period, options.work) / Math.max(1, wide.stores.length);
    });
    default: throw new Error(`No builder for report ${entry.id}`);
  }
}
