import { expect, it } from "vitest";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { resolveRouteLegs, type RoutingProvider } from "@/lib/ops/route-legs";
import { decodePolyline6 } from "@/components/workspace/dispatch-map";

it("decodes 6-digit road geometry into longitude, latitude pairs", () => {
  // Points (38.5, -120.2) → (40.7, -120.95) → (43.252, -126.453), encoded at 1e6 precision.
  expect(decodePolyline6("_izlhA~rlgdF_{geC~ywl@_kwzCn`{nI")).toEqual([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
});

it("looks up each store pair once, saves it, and skips lookups when routing is off", async () => {
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id;
  const repository = createOpsFixtureRepository(fixture);
  const [a, b, c] = fixture.stores.map(s => ({ latE6: s.latitudeE6!, lngE6: s.longitudeE6! }));
  let calls = 0;
  const provider: RoutingProvider = { name: "test", async route() { calls++; return { distanceM: 1609.3, durationS: 600.4, geometry: "_izlhA~rlgdF" }; } };
  let n = 0; const options = { now: "2026-10-05T12:00:00.000Z", newId: () => `leg-${++n}` };
  const pairs = [{ from: a, to: b }, { from: b, to: c }, { from: a, to: b }, { from: c, to: c }];
  expect(await resolveRouteLegs(repository, org, pairs, undefined, options)).toMatchObject({ legs: [], pending: 2, lookups: 0 });
  const first = await resolveRouteLegs(repository, org, pairs, provider, options);
  expect(first).toMatchObject({ pending: 0, lookups: 2 });
  expect(first.legs[0]).toMatchObject({ distanceM: 1609, durationS: 600, provider: "test" });
  const second = await resolveRouteLegs(repository, org, pairs, provider, options);
  expect(second).toMatchObject({ pending: 0, lookups: 0 });
  expect(calls).toBe(2);
  // Another organisation never sees these cached legs.
  expect(await repository.getRouteLegs("other-org", [{ fromLatE6: a.latE6, fromLngE6: a.lngE6, toLatE6: b.latE6, toLngE6: b.lngE6 }])).toEqual([]);
});

it("keeps going when the routing service fails for one pair", async () => {
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id;
  const repository = createOpsFixtureRepository(fixture);
  const [a, b, c] = fixture.stores.map(s => ({ latE6: s.latitudeE6!, lngE6: s.longitudeE6! }));
  const provider: RoutingProvider = { name: "test", async route(from) { if (from.latE6 === a.latE6) throw Error("down"); return { distanceM: 1, durationS: 1, geometry: "" }; } };
  const result = await resolveRouteLegs(repository, org, [{ from: a, to: b }, { from: b, to: c }], provider, { now: "2026-10-05T12:00:00.000Z", newId: () => crypto.randomUUID() });
  expect(result).toMatchObject({ failed: 1, pending: 1 });
  expect(result.legs).toHaveLength(1);
});

it("saves and reads route legs through the SQL repository", async () => {
  const { DatabaseSync } = await import("node:sqlite"), { readdirSync, readFileSync } = await import("node:fs");
  const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
  const fixture = buildNorthlinePresentationFixture(), org = fixture.organizations[0].id;
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
  db.prepare("INSERT INTO ops_organizations (id, name, slug, time_zone, work_order_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(org, "Test", "test", "America/New_York", "T", "2026-01-01T00:00:00.000Z");
  type Value = string | number | null;
  const repository = createOpsSqlRepository({ dialect: "sqlite", async query(s) { return { rows: db.prepare(s.sql).all(...s.params as Value[]) as never[], affectedRows: 0 }; }, async atomic(statements) { for (const s of statements) db.prepare(s.sql).run(...s.params as Value[]); } }, "d1");
  const a = { latE6: 41000000, lngE6: -85000000 }, b = { latE6: 41100000, lngE6: -85100000 };
  const provider: RoutingProvider = { name: "test", async route() { return { distanceM: 5000, durationS: 420, geometry: "abc" }; } };
  await resolveRouteLegs(repository, org, [{ from: a, to: b }], provider, { now: "2026-10-05T12:00:00.000Z", newId: () => "leg-sql-1" });
  // The second save of the same pair hits the unique index and is quietly kept as the first copy.
  const again = await resolveRouteLegs(repository, org, [{ from: a, to: b }, { from: b, to: a }], provider, { now: "2026-10-05T12:00:00.000Z", newId: () => "leg-sql-2" });
  expect(again.legs).toHaveLength(2);
  expect(await repository.getRouteLegs(org, [{ fromLatE6: a.latE6, fromLngE6: a.lngE6, toLatE6: b.latE6, toLngE6: b.lngE6 }])).toMatchObject([{ id: "leg-sql-1", distanceM: 5000, durationS: 420, geometry: "abc" }]);
  db.close();
});
