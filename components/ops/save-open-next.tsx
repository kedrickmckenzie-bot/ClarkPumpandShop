"use client";
import { useSyncExternalStore } from "react";
import styles from "./ops.module.css";

const subscribe = () => () => {};
const serverSnapshot = () => "";
const snapshot = () => window.location.search;

/** Ordinary submit semantics and validation; navigation happens only after the command succeeds. */
export function SaveOpenNext({ disabled }: { disabled?: boolean }) {
  const params = new URLSearchParams(useSyncExternalStore(subscribe, snapshot, serverSnapshot));
  if (!params.get("reviewQueue") || !params.get("reviewItem")) return null;
  return <button className={styles.secondaryButton} type="submit" name="afterSave" value="open-next" disabled={disabled}>Save and open next</button>;
}
