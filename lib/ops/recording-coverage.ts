import type { OpsFixture } from "./types";

export const RECORDING_COVERAGE_EVENT = "recording.coverage_attested";

/** Explicit recording assertion, independent of asset lifecycle and activity.
 * The manifest detects incomplete snapshots/imports; it does not establish coverage.
 * A store-wide assertion includes all equipment/taxonomy/provider subsets.
 */
export interface RecordingCoverage {
  measure: string;
  storeId: string;
  startsOn: string;
  endsOn: string;
  sourceIds: string[];
}

export function supportedRecordingCoverage(fixture: OpsFixture, organizationId: string, measure: string, records: Array<{ id: string; storeId: string }>): RecordingCoverage[] {
  const sourceStores = new Map(records.map((row) => [row.id, row.storeId]));
  return fixture.auditEvents.filter((event) => event.organizationId === organizationId && event.eventType === RECORDING_COVERAGE_EVENT).flatMap((event) => {
    try {
      const coverage = JSON.parse(event.payloadJson) as RecordingCoverage;
      if (event.aggregateType !== "store" || event.aggregateId !== coverage.storeId || coverage.measure !== measure
        || !/^\d{4}-\d{2}-\d{2}$/.test(coverage.startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(coverage.endsOn)
        || coverage.startsOn > coverage.endsOn || !Array.isArray(coverage.sourceIds)
        || !coverage.sourceIds.every((id) => typeof id === "string" && sourceStores.get(id) === coverage.storeId)) return [];
      return [coverage];
    } catch { return []; }
  });
}

/** Only deterministic fixture authors call this. Real imports need explicit attestation. */
export function attestDemoRecordingCoverage(fixture: OpsFixture, startsOn: string, endsOn: string) {
  fixture.auditEvents = fixture.auditEvents.filter((event) => event.eventType !== RECORDING_COVERAGE_EVENT);
  for (const store of fixture.stores) {
    const workIds = new Set(fixture.workOrders.filter((row) => row.organizationId === store.organizationId && row.storeId === store.id).map((row) => row.id));
    const sources = {
      recorded_cost: fixture.costLines.filter((row) => row.organizationId === store.organizationId && workIds.has(row.workOrderId)).map((row) => row.id),
      work_orders: [...workIds],
      service_visits: fixture.visits.filter((row) => row.organizationId === store.organizationId && row.storeId === store.id).map((row) => row.id),
      linked_invoice: fixture.invoiceAllocations.filter((row) => row.organizationId === store.organizationId && workIds.has(row.workOrderId) && row.confirmedAt && fixture.invoiceReferences.some((invoice) => invoice.organizationId === store.organizationId && invoice.id === row.invoiceReferenceId && invoice.matchStatus === "confirmed")).map((row) => row.id),
    };
    for (const [measure, sourceIds] of Object.entries(sources)) fixture.auditEvents.push({
      id: `coverage-${store.id}-${measure}`, organizationId: store.organizationId,
      aggregateType: "store", aggregateId: store.id, eventType: RECORDING_COVERAGE_EVENT,
      actorType: "system", actorName: "Deterministic fixture recording declaration", occurredAt: fixture.asOf,
      payloadJson: JSON.stringify({ measure, storeId: store.id, startsOn, endsOn, sourceIds } satisfies RecordingCoverage),
    });
  }
}
