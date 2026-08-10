import { assertDemoDataset, findLifecycleCandidates, getSpendSourceRows } from "../lib/cstore/analytics";
import { demoData } from "../lib/cstore/demo-data";

assertDemoDataset(demoData, demoData.organization.id);

const invoicedSpendMinor = getSpendSourceRows(demoData, demoData.organization.id, {
  basis: "invoiced",
}).reduce((sum, row) => sum + row.amountMinor, 0);

const summary = {
  organization: demoData.organization.displayName,
  asOf: demoData.asOf,
  stores: demoData.stores.length,
  regions: demoData.regions.length,
  vendors: demoData.vendors.length,
  assets: demoData.assets.length,
  workOrders: demoData.workOrders.length,
  visits: demoData.visits.length,
  invoices: demoData.invoices.length,
  invoicedSpendMinor,
  lifecycleCandidates: findLifecycleCandidates(
    demoData,
    demoData.organization.id,
  ).map((candidate) => candidate.asset.assetCode),
};

console.log("TraceOps deterministic demo fixture is valid.");
console.log(JSON.stringify(summary, null, 2));
