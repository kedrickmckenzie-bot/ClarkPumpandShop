import type { Metadata } from "next";

import { ExternalWorkOrderClient } from "./external-work-order-client";

export const metadata: Metadata = {
  title: "External Work Order | TraceOps",
  description: "Review and respond to a customer work order and service authorization.",
  robots: { index: false, follow: false },
};

type QueryValue = string | string[] | undefined;

interface ExternalWorkOrderPageProps {
  searchParams: Promise<Record<string, QueryValue>>;
}

function firstValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

function bounded(value: string | undefined, fallback: string, maxLength = 800) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function queryValue(
  query: Record<string, QueryValue>,
  keys: string[],
  fallback: string,
  maxLength?: number,
) {
  for (const key of keys) {
    const value = firstValue(query[key]);
    if (value?.trim()) return bounded(value, fallback, maxLength);
  }
  return fallback;
}

export default async function ExternalWorkOrderPage({
  searchParams,
}: ExternalWorkOrderPageProps) {
  const query = await searchParams;

  return (
    <ExternalWorkOrderClient
      authorization={{
        scenarioId: queryValue(query, ["scenarioId", "scenario"], "guided-vendor-demo", 120),
        workOrderNumber: queryValue(
          query,
          ["wo", "workOrderNumber", "workOrder"],
          "WO-104-000318",
          100,
        ),
        store: queryValue(query, ["store"], "Store 104 · Northline Markets", 240),
        address: queryValue(
          query,
          ["address", "storeAddress"],
          "2840 Ridge Road, Dayton, OH 45424",
          320,
        ),
        vendor: queryValue(query, ["vendor"], "Summit Refrigeration", 240),
        problem: queryValue(
          query,
          ["problem"],
          "The beer cave is warm. The display reads 48°F and product temperature is rising.",
        ),
        scope: queryValue(
          query,
          ["scope"],
          "Diagnose the reported refrigeration condition and restore safe, normal operation. Contact the customer before performing work outside this authorization.",
        ),
        nte: queryValue(query, ["nte"], "", 80),
        nteMinor: queryValue(query, ["nteMinor", "nteMinorUnits"], "", 80),
        requestedWindow: queryValue(
          query,
          ["requestedWindow", "window"],
          "Service requested within 24 hours",
          240,
        ),
        accessInstructions: queryValue(
          query,
          ["access", "accessInstructions"],
          "Check in when you arrive using the store QR, vendor app, secure link, or store service desk. Ask for the manager on duty if equipment access is needed.",
        ),
      }}
    />
  );
}
