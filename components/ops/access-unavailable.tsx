import { LockKeyhole } from "lucide-react";
import styles from "./ops.module.css";

export function OperatorAccessUnavailable() {
  return (
    <main className={styles.accessUnavailable}>
      <div>
        <span><LockKeyhole aria-hidden="true" size={24} /></span>
        <p className={styles.eyebrow}>Operator workspace</p>
        <h1>Authorized access is not connected</h1>
        <p>This protected surface requires a server-verified organization membership, role, and operating scope. It will not fall back to a browser-selected role or expose unscoped data.</p>
      </div>
    </main>
  );
}
