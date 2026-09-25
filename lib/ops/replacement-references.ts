import type { OrganizationScope } from "./repository";
import type { Asset, Money, OpsFixture } from "./types";
import { priceLabel } from "./lifecycle-price-evidence";

export interface ReplacementReference {
  id: string; date: string; kind: string; amount: string; equipment: string; store: string;
  match: string; installation: string; status: string; scope: string; href: string;
}
/** Source prices only. No inflation, inferred condition, currency pooling or repair-to-replacement conversion. */
export function replacementReferences(fixture: OpsFixture, scope: OrganizationScope, asset: Asset, componentId?: string) {
  const org = scope.organizationId;
  const allowedStores = new Set(fixture.stores.filter(s => s.organizationId === org && (!scope.storeIds || scope.storeIds.includes(s.id)) && (!scope.regionIds || !!s.regionId && scope.regionIds.includes(s.regionId))).map(s => s.id));
  if (asset.organizationId !== org || !allowedStores.has(asset.storeId)) return [];
  const components = fixture.components.filter(c => c.organizationId === org);
  const selected = componentId ? components.find(c => c.assetId === asset.id && c.id === componentId) : undefined;
  if (componentId && !selected) return [];
  const normalized = (s?: string) => s?.trim().toLowerCase();
  const profile = fixture.replacementProfiles.find(p => p.organizationId === org && p.id === asset.replacementProfileId);
  const peers = fixture.assets.filter(a => a.organizationId === org && allowedStores.has(a.storeId) && (a.id === asset.id || a.categoryKey === asset.categoryKey && (
    profile && a.replacementProfileId === profile.id && profile.matchKeys.every(key => normalized(a.replacementAttributes?.[key] ?? profile.attributes[key]) === normalized(asset.replacementAttributes?.[key] ?? profile.attributes[key])) ||
    !profile && !!asset.manufacturer && !!asset.model && normalized(a.manufacturer) === normalized(asset.manufacturer) && normalized(a.model) === normalized(asset.model)
  )));
  const byAsset = new Map(peers.map(a => [a.id, a]));
  const sameComponent = (id?: string) => {
    if (!selected) return !id;
    const other = components.find(c => c.id === id);
    return !!other && (other.id === selected.id || !!selected.partNumber && normalized(other.partNumber) === normalized(selected.partNumber) && normalized(other.name) === normalized(selected.name));
  };
  const events = fixture.replacementEvents.filter(e => e.organizationId === org && e.status !== "cancelled" && byAsset.has(e.assetId));
  const componentEvents = fixture.componentLifecycleEvents.filter(e => e.organizationId === org && byAsset.has(e.assetId) && selected && (sameComponent(e.removedComponentId) || sameComponent(e.installedComponentId)));
  const work = fixture.workOrders.filter(w => w.organizationId === org && !!w.assetId && byAsset.has(w.assetId) && allowedStores.has(w.storeId));
  const rows: ReplacementReference[] = [];
  const add = (id: string, workId: string, date: string, kind: string, amount: Money, status: string, text: string, href: string, installation = "Not itemized — check source") => {
    const job = work.find(w => w.id === workId); const source = job?.assetId && byAsset.get(job.assetId);
    if (!job || !source || !Number.isFinite(Date.parse(date)) || date.slice(0,10) > fixture.asOf.slice(0,10)) return;
    rows.push({ id, date: date.slice(0,10), kind, amount: priceLabel(amount), status, scope: text, href, installation,
      equipment: `${source.name}${source.manufacturer || source.model ? ` · ${[source.manufacturer, source.model].filter(Boolean).join(" ")}` : ""}${selected ? ` · ${selected.name}` : ""}`,
      store: `Store ${fixture.stores.find(s => s.organizationId === org && s.id === job.storeId)?.storeNumber ?? "Unknown"}`,
      match: source.id === asset.id ? "This equipment" : selected ? "Same component name and part number" : profile ? `Same planning group · ${profile.name}` : "Same manufacturer and model",
    });
  };
  for (const request of fixture.estimateRequests.filter(r => r.organizationId === org && r.decisionKind === "replacement_quote" && !["withdrawn", "declined"].includes(r.status))) {
    const job = work.find(w => w.id === request.workOrderId); if (!job) continue;
    if (selected ? !sameComponent(job.componentId) || events.some(e => e.workOrderId === job.id) : !!job.componentId && !events.some(e => e.workOrderId === job.id)) continue;
    const quote = fixture.estimateProposals.filter(p => p.organizationId === org && p.requestId === request.id && p.vendorId === request.vendorId).sort((a,b) => b.revision-a.revision)[0];
    if (!quote) continue;
    const expired = request.status === "expired" || !!quote.validUntil && quote.validUntil.slice(0,10) < fixture.asOf.slice(0,10);
    const benchmark = fixture.replacementBenchmarks.find(b => b.organizationId === org && b.sourceEstimateProposalId === quote.id && b.totalAmount.currency === quote.amount.currency && b.totalAmount.amountMinor === quote.amount.amountMinor);
    const installation = benchmark?.installationAmount ? `Installation ${priceLabel(benchmark.installationAmount)}${benchmark.equipmentAmount ? ` · Equipment ${priceLabel(benchmark.equipmentAmount)}` : ""}${benchmark.otherAmount ? ` · Other ${priceLabel(benchmark.otherAmount)}` : ""}` : "Not itemized — check quote scope";
    add(`quote:${quote.id}`, job.id, quote.submittedAt, selected ? "Component-linked quote" : "Replacement quote", quote.amount, expired ? "Expired quote" : quote.validUntil ? `Valid through ${quote.validUntil.slice(0,10)}` : "Validity not recorded", `${fixture.vendors.find(v => v.organizationId === org && v.id === quote.vendorId)?.name ?? "Vendor"} · ${quote.scope}`, `/app/work-orders/${job.id}?view=service&path=bids#quote-proposal-${quote.id}`, installation);
  }
  const replacementWork = new Set(selected ? componentEvents.map(e => e.workOrderId) : events.map(e => e.workOrderId));
  // Invoice allocations are separate evidence; never add them to quotes or recorded final costs.
  for (const invoice of fixture.invoiceReferences.filter(i => i.organizationId === org && !selected)) {
    for (const workId of replacementWork) {
      const allocations = fixture.invoiceAllocations.filter(a => a.organizationId === org && a.invoiceReferenceId === invoice.id && a.workOrderId === workId && !!a.confirmedAt && a.amount.currency === invoice.grossAmount.currency);
      if (allocations.length) add(`invoice:${invoice.id}:${workId}`, workId, invoice.invoiceDate, "Linked invoice amount", { amountMinor: allocations.reduce((sum,a) => sum+a.amount.amountMinor,0), currency: invoice.grossAmount.currency }, "Historical price", `Invoice ${invoice.invoiceNumber} · confirmed amount linked to this replacement work`, `/app/invoices/${invoice.id}`);
    }
  }
  for (const invoice of fixture.invoices.filter(i => i.organizationId === org && i.status !== "void")) {
    const lines = new Set(fixture.invoiceLines.filter(l => l.organizationId === org && l.invoiceId === invoice.id).map(l => l.id));
    for (const workId of replacementWork) {
      const allocations = fixture.invoiceLineAllocations.filter(a => a.organizationId === org && lines.has(a.invoiceLineId) && a.workOrderId === workId && !!a.confirmedAt && a.amount.currency === invoice.total.currency && (!selected || !!a.componentId && sameComponent(a.componentId)));
      if (allocations.length) add(`invoice-lines:${invoice.id}:${workId}`, workId, invoice.invoiceDate, "Linked invoice amount", { amountMinor: allocations.reduce((sum,a) => sum+a.amount.amountMinor,0), currency: invoice.total.currency }, "Historical price", `Invoice ${invoice.vendorInvoiceNumber} · confirmed allocations to replacement work`, `/app/invoices/${invoice.id}`);
    }
  }
  for (const event of events.filter(e => !selected && e.status === "completed" && e.finalAmount && e.completedAt)) add(`final:${event.id}`, event.workOrderId, event.completedAt!, "Recorded final cost", event.finalAmount!, "Historical price", "Completed whole-equipment replacement", `/app/work-orders/${event.workOrderId}?view=cost`);
  for (const event of componentEvents) {
    if (event.laborCost.currency !== event.partCost.currency) continue;
    add(`component:${event.id}`, event.workOrderId, event.installedAt, "Recorded component cost", { amountMinor: event.laborCost.amountMinor+event.partCost.amountMinor, currency: event.partCost.currency }, "Historical price", `${event.partManufacturer} ${event.partModel} · ${event.failureMode}`, `/app/equipment/${event.assetId}/components/${event.installedComponentId}`, `Parts ${priceLabel(event.partCost)} + labor ${priceLabel(event.laborCost)}; other charges not included`);
  }
  return rows.sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
