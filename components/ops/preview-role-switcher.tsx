"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { OperatorRole } from "./data-contract";
import styles from "./ops.module.css";

const roles: Array<{ value: OperatorRole; label: string }> = [
  { value: "facilities", label: "Facilities" },
  { value: "executive", label: "Executive" },
  { value: "regional", label: "Regional manager" },
  { value: "store_manager", label: "Store manager" },
  { value: "finance", label: "Finance reviewer" },
];

export function PreviewRoleSwitcher({ role }: { role: OperatorRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;

  return (
    <form className={styles.previewRole} method="post" action="/api/ops/preview-role">
      <span>Demo view</span>
      <label>
        <span className={styles.visuallyHidden}>View workspace as</span>
        <select name="role" defaultValue={role} aria-label="View workspace as a different role">
          {roles.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit">Apply</button>
    </form>
  );
}
