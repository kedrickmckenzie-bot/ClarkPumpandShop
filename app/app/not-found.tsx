import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import styles from "@/components/ops/ops.module.css";

export default function OperatorNotFound() {
  return (
    <div className={styles.accessUnavailable}>
      <div>
        <span><ShieldAlert aria-hidden="true" size={26} /></span>
        <p className={styles.eyebrow}>Not available</p>
        <h1>You can&apos;t open this page</h1>
        <p>It may be for a different role, belong to stores you don&apos;t cover, or no longer exist. Ask your facilities lead if you need it.</p>
        <Link className={styles.primaryButton} href="/app/overview">Go to Overview</Link>
      </div>
    </div>
  );
}
