import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import styles from "@/components/ops/ops.module.css";

export default function OperatorNotFound() {
  return (
    <div className={styles.accessUnavailable}>
      <div>
        <span><ShieldAlert aria-hidden="true" size={26} /></span>
        <p className={styles.eyebrow}>Not available in this role</p>
        <h1>This record or workspace is outside your current access scope.</h1>
        <p>Use the visible navigation for this role, or switch the fictional demo persona to preview another authorized experience.</p>
        <Link className={styles.primaryButton} href="/app/overview">Return to overview</Link>
      </div>
    </div>
  );
}
