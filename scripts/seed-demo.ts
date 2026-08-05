import { demoData } from "../lib/demo/data";

const summary = {
  organization: demoData.organization.name,
  regions: demoData.regions.length,
  stores: demoData.stores.length,
  systems: demoData.systems.length,
  assets: demoData.assets.length,
  components: demoData.components.length,
  workOrders: demoData.workOrders.length,
  pmOccurrences: demoData.pmOccurrences.length,
  invoices: demoData.invoices.length,
  documents: demoData.documents.length,
};

if (summary.stores !== 65 || summary.workOrders !== 536 || summary.pmOccurrences !== 64) throw new Error("Deterministic seed counts changed; update tests and demo guide intentionally.");
console.log("Clark's Operations deterministic fixture validated.");
console.table(summary);
console.log("The local UI imports this fixture directly. Hosted D1 tables are created by drizzle migrations; production ingestion should upsert these records with organization_id='org-clarks-demo'.");
