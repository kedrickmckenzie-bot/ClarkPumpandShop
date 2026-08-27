"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => undefined;
}

function browserSnapshot() {
  return window.location.origin;
}

function serverSnapshot() {
  return undefined;
}

/** Returns the origin that is actually serving the hydrated application. */
export function useBrowserOrigin(): string | undefined {
  return useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
}
