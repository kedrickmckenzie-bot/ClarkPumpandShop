import {
  NORTHLINE_PRESENTATION_FIXTURE,
  assertOpsFixture,
  buildNorthlinePresentationFixture,
  buildSyntheticScaleFixture,
} from "../lib/ops/fixtures";
import { buildOpsSeedStatements } from "../lib/ops/seed";

const presentation = buildNorthlinePresentationFixture();
const scale = buildSyntheticScaleFixture(65);
assertOpsFixture(presentation);
assertOpsFixture(scale);

const summary = {
  organization: NORTHLINE_PRESENTATION_FIXTURE.organizations[0].name,
  asOf: presentation.asOf,
  stores: presentation.stores.length,
  regions: presentation.regions.length,
  vendors: presentation.vendors.length,
  internalTechnicians: presentation.memberships.filter((row) => row.role === "internal_technician").length,
  requests: presentation.requests.length,
  workOrders: presentation.workOrders.length,
  visits: presentation.visits.length,
  assets: presentation.assets.length,
  pmOccurrences: presentation.pmOccurrences.length,
  seedStatements: buildOpsSeedStatements(presentation).length,
  scaleFixtureStores: scale.stores.length,
};

if (summary.stores !== 15 || summary.regions !== 3 || summary.vendors !== 5 || summary.scaleFixtureStores !== 65) {
  throw new Error("Ops showcase/scale fixture contract changed; update intentionally.");
}

console.log("Northline operations fixture is deterministic and causally valid.");
console.log(JSON.stringify(summary, null, 2));
