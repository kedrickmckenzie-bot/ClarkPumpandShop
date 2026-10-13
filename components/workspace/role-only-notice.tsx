import Link from "next/link";
import styles from "@/components/ops/ops.module.css";

/** A plain page instead of an error when someone opens a screen meant for another role. */
export function RoleOnlyNotice({ title, message, href, label }: { title: string; message: string; href: string; label: string }) {
  return (
    <div className={styles.accessUnavailable}>
      <div>
        <p className={styles.eyebrow}>Not for your role</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <Link className={styles.primaryButton} href={href}>{label}</Link>
      </div>
    </div>
  );
}

/** Where a manager sees the same work: Dispatch for those who plan the team, otherwise the Overview. */
export function technicianOnlyNotice(role: string) {
  const plans = role === "facilities" || role === "regional";
  return <RoleOnlyNotice title="This page is for technicians" message={plans ? "You can see the team's jobs and plan the day on Dispatch." : "Open work is on the Overview and in Work orders."} href={plans ? "/app/dispatch" : "/app/overview"} label={plans ? "Open Dispatch" : "Go to Overview"} />;
}
