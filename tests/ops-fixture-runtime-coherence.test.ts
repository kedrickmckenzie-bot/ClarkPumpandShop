import { afterEach, describe, expect, it, vi } from "vitest";

describe("local fixture runtime coherence", () => {
  afterEach(async () => {
    const fixtureModule = await import("@/lib/ops/fixture-repository");
    fixtureModule.resetNorthlineFixtureRepository();
  });

  it("shares one process repository across separately evaluated server modules", async () => {
    const firstModule = await import("@/lib/ops/fixture-repository");
    const firstRepository = firstModule.resetNorthlineFixtureRepository();

    vi.resetModules();
    const secondModule = await import("@/lib/ops/fixture-repository");

    expect(secondModule.getNorthlineFixtureRepository()).toBe(firstRepository);
  });
});
