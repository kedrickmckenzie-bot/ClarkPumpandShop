import type { VendorPerformanceDetailViewModel } from "@/components/ops/vendor-performance-contract";
import type { OperatorSearchParameters } from "./operator-presenter";

/** Page histories after aggregate calculations, so totals retain all evidence. */
export function paginateVendorEvidence(model: VendorPerformanceDetailViewModel, vendorId: string, query: OperatorSearchParameters) {
  const paged = { ...model, evidencePagination: { ...model.evidencePagination } };
  for (const [key, parameter, section] of [
    ["visitRows", "visitPage", "visit-evidence"],
    ["authorizationRows", "authorizationPage", "authorization-evidence"],
    ["repeatVisitRows", "repeatPage", "repeat-visits"],
    ["costRows", "costPage", "cost-evidence"],
  ] as const) {
    const total = model[key].length;
    const pages = Math.max(1, Math.ceil(total / 25));
    const requested = Number(Array.isArray(query[parameter]) ? query[parameter]?.[0] : query[parameter]);
    const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1;
    const href = (value: number) => {
      const params = new URLSearchParams();
      for (const name of ["visitPage", "authorizationPage", "repeatPage", "costPage"]) {
        const raw = Array.isArray(query[name]) ? query[name]?.[0] : query[name];
        if (raw) params.set(name, raw);
      }
      params.set(parameter, String(value));
      return `/app/vendors/${vendorId}?${params}#${section}`;
    };
    // Assign separately to retain each evidence array's concrete row type.
    if (key === "visitRows") paged.visitRows = model.visitRows.slice((page - 1) * 25, page * 25);
    if (key === "authorizationRows") paged.authorizationRows = model.authorizationRows.slice((page - 1) * 25, page * 25);
    if (key === "costRows") paged.costRows = model.costRows.slice((page - 1) * 25, page * 25);
    if (key === "repeatVisitRows") paged.repeatVisitRows = model.repeatVisitRows.slice((page - 1) * 25, page * 25);
    if (pages > 1) paged.evidencePagination[key] = {
      summary: `${total} records · 25 per page`, currentPage: page, totalPages: pages,
      pageLinks: [...new Set([1, page - 1, page, page + 1, pages])].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b).map((value) => ({ page: value, current: value === page, href: href(value) })),
      previousHref: page > 1 ? href(page - 1) : undefined, nextHref: page < pages ? href(page + 1) : undefined,
    };
  }
  return paged;
}
