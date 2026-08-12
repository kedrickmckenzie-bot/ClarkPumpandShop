"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import styles from "@/components/ops/ops.module.css";

export default function OperatorError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
      <AlertCircle aria-hidden="true" size={30} />
      <h2>We could not load this workspace</h2>
      <p>The source records were not changed. Try the request again, or return to the overview.</p>
      <div className={styles.pageActions}>
        <Link className={styles.secondaryButton} href="/app/overview">Return to overview</Link>
        <button className={styles.primaryButton} type="button" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
