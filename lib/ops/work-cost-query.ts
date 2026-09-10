import type { WorkOrderListQuery } from "./repository";
import type { Asset, CostLine } from "./types";

export function hasWorkCostFilter(query: WorkOrderListQuery) {
  return Boolean(query.hasCost || query.costFrom || query.costTo || query.costMonth);
}

export function matchesWorkCost(line: CostLine, query: WorkOrderListQuery) {
  const day = line.serviceDate.slice(0, 10);
  return (!query.costFrom || day >= query.costFrom.slice(0, 10))
    && (!query.costTo || day <= query.costTo.slice(0, 10))
    && (!query.costMonth || day.slice(0, 7) === query.costMonth.slice(0, 7))
    && (!hasWorkCostFilter(query) && !query.currency || line.amount.currency === (query.currency ?? "USD"));
}

export function matchesWorkCategoryPath(asset: Asset | undefined, path: readonly string[] = []) {
  if (!path.length) return true;
  if (!asset) return false;
  const category = asset.categoryKey.replaceAll("_", " ").toLocaleLowerCase("en-US");
  const group = asset.groupPath;
  const hierarchy = group[0]?.toLocaleLowerCase("en-US") === category ? group : [category, ...group];
  return path.every((segment, index) => index === 0
    ? hierarchy[index]?.toLocaleLowerCase("en-US") === segment.toLocaleLowerCase("en-US")
    : hierarchy[index] === segment);
}

export function workCostSql(alias: string, query: WorkOrderListQuery) {
  const clauses: string[] = [];
  const params: string[] = [];
  for (const [value, expression] of [
    [query.costFrom?.slice(0, 10), `substr(CAST(${alias}.service_date AS TEXT), 1, 10) >= ?`],
    [query.costTo?.slice(0, 10), `substr(CAST(${alias}.service_date AS TEXT), 1, 10) <= ?`],
    [query.costMonth?.slice(0, 7), `substr(CAST(${alias}.service_date AS TEXT), 1, 7) = ?`],
    [hasWorkCostFilter(query) || query.currency ? query.currency ?? "USD" : undefined, `${alias}.currency = ?`],
  ]) if (value) { clauses.push(expression!); params.push(value); }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}
