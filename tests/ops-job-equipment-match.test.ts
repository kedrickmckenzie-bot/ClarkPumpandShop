import { describe, expect, it } from "vitest";
import { matchJobEquipment } from "@/lib/ops/job-equipment-match";
import type { Asset } from "@/lib/ops/types";

const unit = (id: string, name: string, categoryKey = "refrigeration", status: Asset["status"] = "operational") =>
  ({ id, name, categoryKey, status, assetTag: id.toUpperCase(), storeId: "s", organizationId: "o", groupPath: [] }) as unknown as Asset;

describe("matching an unlinked job to the store's equipment", () => {
  const units = [unit("104-ref-01", "Beer cave - rear sales floor"), unit("104-ref-02", "Walk-in cooler - back room"), unit("104-hvac-01", "Rooftop unit 1", "hvac")];

  it("uses the one unit the report names", () => {
    expect(matchJobEquipment("The beer cave is above temperature and the evaporator fan stops.", "refrigeration", units).unit?.id).toBe("104-ref-01");
  });

  it("lists same-category units when the report names none", () => {
    const match = matchJobEquipment("Cooler warm", "refrigeration", units);
    expect(match.unit).toBeUndefined();
    expect(match.candidates.map(u => u.id)).toEqual(["104-ref-01", "104-ref-02"]);
  });

  it("never picks between two units with the same name, and skips retired ones", () => {
    const twins = [unit("a", "Reach-in cooler - front"), unit("b", "Reach-in cooler - deli"), unit("c", "Beer cave", "refrigeration", "retired")];
    expect(matchJobEquipment("Reach-in cooler is warm", "refrigeration", twins).unit).toBeUndefined();
    expect(matchJobEquipment("Beer cave warm", "refrigeration", twins).unit).toBeUndefined();
  });
});
