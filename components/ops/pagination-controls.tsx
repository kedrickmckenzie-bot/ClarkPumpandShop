import { Fragment } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationViewModel } from "./data-contract";
import styles from "./pagination-controls.module.css";

export function PaginationControls({
  pagination,
  label = "Result pages",
}: {
  pagination: PaginationViewModel;
  label?: string;
}) {
  return (
    <nav className={styles.pagination} aria-label={label}>
      <span className={styles.summary}>{pagination.summary}</span>
      <div className={styles.controls}>
        {pagination.previousHref
          ? <Link className={styles.direction} href={pagination.previousHref}><ChevronLeft size={15} aria-hidden="true" />Previous</Link>
          : <span className={styles.direction} aria-disabled="true"><ChevronLeft size={15} aria-hidden="true" />Previous</span>}
        <span className={styles.pageIndex} aria-label={`Page ${pagination.currentPage} of ${pagination.totalPages}`}>
          {pagination.pageLinks.map((page, index) => {
            const previousPage = pagination.pageLinks[index - 1]?.page;
            return (
              <Fragment key={page.page}>
                {previousPage !== undefined && page.page - previousPage > 1 ? <span className={styles.gap} aria-hidden="true">…</span> : null}
                {page.current
                  ? <span className={styles.current} aria-current="page" aria-label={`Page ${page.page}, current page`}>{page.page}</span>
                  : <Link className={styles.page} href={page.href} aria-label={`Go to page ${page.page}`}>{page.page}</Link>}
              </Fragment>
            );
          })}
        </span>
        {pagination.nextHref
          ? <Link className={styles.direction} href={pagination.nextHref}>Next<ChevronRight size={15} aria-hidden="true" /></Link>
          : <span className={styles.direction} aria-disabled="true">Next<ChevronRight size={15} aria-hidden="true" /></span>}
      </div>
    </nav>
  );
}
