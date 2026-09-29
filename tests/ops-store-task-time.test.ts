import {describe,it,expect} from "vitest";
import {cameraTime,cameraInput,formatCameraTime} from "@/lib/ops/store-task-time";
import {localDateTimeToIso} from "@/lib/ops/local-date-time";
describe("Camera clocks and store deadlines",()=>{
 it("retains literal camera times across store zones, including clock changes",()=>{
  const value="2026-11-01T01:30";
  expect(cameraTime(value)).toBe(value);
  expect(formatCameraTime(value,"America/New_York")).toBe(formatCameraTime(value,"America/Chicago"));
  expect(formatCameraTime("2026-09-28T13:00","America/Chicago")).toContain("1:00 PM");
  expect(()=>cameraTime("2026-02-30T13:00")).toThrow();
 });
 it("prefills visit instants in store clock time and converts deadlines separately",()=>{
  expect(cameraInput("2026-09-28T17:00:00Z","America/New_York")).toBe("2026-09-28T13:00");
  expect(cameraInput("2026-09-28T17:00:00Z","America/Chicago")).toBe("2026-09-28T12:00");
  expect(localDateTimeToIso("2026-09-28T13:00","America/Chicago")).toBe("2026-09-28T18:00:00.000Z");
 });
});
