import { describe, expect, it } from "vitest";
import { localDateTimeToIso } from "@/lib/ops/local-date-time";

describe("store-local scheduling time", () => {
  it("converts a store wall-clock value with the store's summer offset", () => {
    expect(localDateTimeToIso("2026-08-28T14:00", "America/New_York"))
      .toBe("2026-08-28T18:00:00.000Z");
  });

  it("rejects daylight-saving gaps and repeated hours rather than guessing", () => {
    expect(() => localDateTimeToIso("2026-03-08T02:30", "America/New_York"))
      .toThrow(/does not exist/i);
    expect(() => localDateTimeToIso("2026-11-01T01:30", "America/New_York"))
      .toThrow(/occurs twice/i);
  });

  it("rejects invalid calendar values and time zones", () => {
    expect(() => localDateTimeToIso("2026-02-30T09:00", "America/New_York"))
      .toThrow(/valid local date/i);
    expect(() => localDateTimeToIso("2026-08-28T14:00", "Not/AZone"))
      .toThrow(/time zone/i);
  });
});
