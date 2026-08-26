"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { DemoEdition } from "./data-contract";
import { demoEditionPresentation } from "./demo-edition";
import styles from "./platform-shell.module.css";

const editions: DemoEdition[] = ["accountability", "complete"];

export function PreviewEditionSwitcher({ edition }: { edition: DemoEdition }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <section className={styles.previewEdition} aria-label="Demo package">
      <div className={styles.previewEditionHeading}>
        <span>Demo package</span>
        <strong>{demoEditionPresentation[edition].label}</strong>
      </div>
      <form method="post" action="/api/ops/preview-edition">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className={styles.previewEditionOptions} role="group" aria-label="Choose a demo package">
          {editions.map((value) => (
            <button
              type="submit"
              name="edition"
              value={value}
              aria-pressed={edition === value}
              data-active={edition === value}
              key={value}
            >
              {demoEditionPresentation[value].shortLabel}
            </button>
          ))}
        </div>
      </form>
      <p>{demoEditionPresentation[edition].description}</p>
    </section>
  );
}
