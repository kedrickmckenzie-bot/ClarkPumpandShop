import { expect, it } from "vitest";
import { oneLine } from "@/lib/product/one-line";

it("keeps a visible separator where a report had line breaks, without changing single-line text", () => {
  expect(oneLine("Ice machine is leaking\n\nArea or equipment: Front door")).toBe("Ice machine is leaking · Area or equipment: Front door");
  expect(oneLine("Already one line")).toBe("Already one line");
  expect(oneLine("  first \n second  ")).toBe("first · second");
  expect(oneLine(undefined)).toBeUndefined();
});
