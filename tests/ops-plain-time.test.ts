import { describe, expect, it } from "vitest";
import { plainClock, plainDay, plainDayTime, plainDue } from "@/lib/ops/plain-time";

const zone = "America/New_York";
const now = "2026-10-13T16:00:00.000Z"; // Tuesday, Oct 13, 2026, noon in New York

describe("plain dates", () => {
  it("reads clock times the way people say them", () => {
    expect(plainClock("2026-10-13T13:00:00.000Z", zone)).toBe("9 AM");
    expect(plainClock("2026-10-13T17:15:00.000Z", zone)).toBe("1:15 PM");
    expect(plainClock("2026-10-13T16:00:00.000Z", zone)).toBe("noon");
  });

  it("names nearby days and drops the year when it is this year", () => {
    expect(plainDay("2026-10-13T20:00:00.000Z", now, zone)).toBe("today");
    expect(plainDay("2026-10-14T20:00:00.000Z", now, zone)).toBe("tomorrow");
    expect(plainDay("2026-10-12T20:00:00.000Z", now, zone)).toBe("yesterday");
    expect(plainDay("2026-10-15T20:00:00.000Z", now, zone)).toBe("Thu");
    expect(plainDay("2026-10-03T20:00:00.000Z", now, zone)).toBe("Oct 3");
    expect(plainDay("2027-01-05T15:00:00.000Z", now, zone)).toBe("Jan 5, 2027");
    expect(plainDayTime("2026-10-20T18:00:00.000Z", now, zone)).toBe("Oct 20, 2 PM");
  });

  it("says how late or when due", () => {
    expect(plainDue("2026-10-13T17:15:00.000Z", now, zone)).toEqual({ text: "Due today 1:15 PM", late: false });
    expect(plainDue("2026-10-14T18:00:00.000Z", now, zone)).toEqual({ text: "Due tomorrow 2 PM", late: false });
    expect(plainDue("2026-10-15T16:00:00.000Z", now, zone)).toEqual({ text: "Due Thu noon", late: false });
    expect(plainDue("2027-01-05T15:00:00.000Z", now, zone)).toEqual({ text: "Due Jan 5, 2027", late: false });
    expect(plainDue("2026-10-13T13:00:00.000Z", now, zone)).toEqual({ text: "Late · was due today 9 AM", late: true });
    expect(plainDue("2026-10-12T20:00:00.000Z", now, zone)).toEqual({ text: "Late · was due yesterday 4 PM", late: true });
    expect(plainDue("2026-09-28T20:00:00.000Z", now, zone)).toEqual({ text: "15 days late", late: true });
    expect(plainDue(undefined, now, zone)).toEqual({ text: "No due date", late: false });
  });

  it("counts days in the store's zone, not UTC", () => {
    // 10 PM Tuesday in New York is already Wednesday in UTC; 9 AM Wednesday is still "tomorrow" for the store.
    expect(plainDue("2026-10-14T13:00:00.000Z", "2026-10-14T02:00:00.000Z", zone)).toEqual({ text: "Due tomorrow 9 AM", late: false });
  });
});
