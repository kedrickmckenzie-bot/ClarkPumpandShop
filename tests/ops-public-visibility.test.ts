import { describe, expect, it } from "vitest";
import { vendorFacingScope } from "@/lib/ops/public-visibility";

const hiddenControl = /not[- ]?to[- ]?exceed|\bNTE\b|authorization limit|authorization ceiling|exceeding authorization/iu;

describe("vendor-facing financial-control boundary", () => {
  it("removes legacy hidden-threshold instructions without losing the operational scope", () => {
    const visible = vendorFacingScope("Inspect the evaporator fan assembly, diagnose the noise, and restore normal operation. Call before exceeding authorization.");
    expect(visible).toContain("Inspect the evaporator fan assembly");
    expect(visible).toContain("restore normal operation");
    expect(visible).not.toMatch(hiddenControl);
  });

  it("removes embedded limit language from older scope sentences", () => {
    const visible = vendorFacingScope("Diagnose the defrost-cycle alarm, restore stable freezer operation within the authorization limit, and document controller readings.");
    expect(visible).toContain("restore stable freezer operation");
    expect(visible).toContain("document controller readings");
    expect(visible).not.toMatch(hiddenControl);
  });
});
