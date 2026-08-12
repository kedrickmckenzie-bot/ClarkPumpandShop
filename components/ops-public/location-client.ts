"use client";

import type { LocationEvidenceInput } from "./contracts";

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 12_000,
};

export function captureCurrentLocation(): Promise<LocationEvidenceInput> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ captureResult: "unsupported" });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          captureResult: "captured",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      (error) => {
        const captureResult =
          error.code === error.PERMISSION_DENIED
            ? "permission_denied"
            : error.code === error.TIMEOUT
              ? "timeout"
              : "position_unavailable";
        resolve({ captureResult });
      },
      LOCATION_OPTIONS,
    );
  });
}

export function describeLocationAttempt(location: LocationEvidenceInput | null): string {
  if (!location) return "Location has not been checked yet.";
  if (location.captureResult === "captured") {
    return `Location captured once for this event${
      location.accuracyM ? ` with approximately ${Math.round(location.accuracyM)} m accuracy` : ""
    }.`;
  }
  const labels: Record<Exclude<LocationEvidenceInput["captureResult"], "captured">, string> = {
    permission_denied: "Location permission was declined. You can continue; the visit will show that no location evidence was available.",
    position_unavailable: "Your device could not determine its location. You can continue with that limitation recorded.",
    timeout: "The location request timed out. Try once more or continue with that limitation recorded.",
    unsupported: "This device or browser does not provide location. You can continue with that limitation recorded.",
    not_requested: "This operator does not require location evidence for this visit.",
  };
  return labels[location.captureResult];
}
