"use client";

import { useState } from "react";
import { LocateFixed, RefreshCw } from "lucide-react";
import type { LocationEvidenceInput } from "./contracts";
import { captureCurrentLocation, describeLocationAttempt } from "./location-client";
import styles from "./public-workflows.module.css";

export function LocationEvidenceControl({
  actionLabel,
  value,
  onChange,
}: {
  actionLabel: "check-in" | "checkout";
  value: LocationEvidenceInput | null;
  onChange: (location: LocationEvidenceInput) => void;
}) {
  const [capturing, setCapturing] = useState(false);

  async function capture() {
    setCapturing(true);
    onChange(await captureCurrentLocation());
    setCapturing(false);
  }

  return (
    <div className={styles.locationBox}>
      <div className={styles.locationHeader}>
        <div>
          <strong>Location evidence</strong>
          <p>Your browser will ask before capturing one location point for this {actionLabel}. There is no continuous tracking.</p>
        </div>
        <span className={styles.statusPill}>{value ? (value.captureResult === "captured" ? "Captured" : "Unavailable") : "Not checked"}</span>
      </div>
      <p className={styles.helper} aria-live="polite">{describeLocationAttempt(value)}</p>
      <button className={styles.secondaryButton} disabled={capturing} onClick={capture} type="button">
        {value ? <RefreshCw aria-hidden="true" size={18} /> : <LocateFixed aria-hidden="true" size={18} />}
        {capturing ? "Checking location…" : value ? "Try location again" : "Check my location"}
      </button>
    </div>
  );
}
