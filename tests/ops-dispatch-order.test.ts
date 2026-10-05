import { expect, it, vi } from "vitest";
import { stopOrders } from "@/components/workspace/dispatch-plan";
import { orderedStops, type DispatchJob } from "@/lib/ops/dispatch-board";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const job = (id: string, stopOrder?: number, movable = true) => ({ id, movable, schedule: { id: `plan-${id}`, precision: "day", planningZone: "America/New_York", week: "2026-10-05", day: "2026-10-05", tentative: false, stopOrder } }) as unknown as DispatchJob & { movable: boolean };
const movable = (j: DispatchJob) => (j as DispatchJob & { movable: boolean }).movable;
/** Applies the computed numbers and returns the order the board would show. */
const shown = (list: DispatchJob[]) => {
  const orders = stopOrders(list, movable);
  return orderedStops(list.map((j, i) => ({ ...j, schedule: { ...j.schedule!, stopOrder: orders[i] } }))).map(j => j.id);
};

it("numbers a day so the board shows exactly the chosen order", () => {
  expect(shown([job("b"), job("a"), job("c")])).toEqual(["b", "a", "c"]);
  expect(shown([job("c", 2), job("a", 0), job("b", 1)])).toEqual(["c", "a", "b"]);
});

it("keeps jobs that cannot move in place and orders the others around them", () => {
  // A started job with no number sorts last on the board; movable jobs can still go before or after it.
  const started = job("started", undefined, false);
  expect(shown([job("a"), started, job("b")])).toEqual(["a", "started", "b"]);
  expect(shown([started, job("a"), job("b")])).toEqual(["started", "a", "b"]);
  const numbered = job("parts", 5, false);
  expect(shown([job("a", 9), numbered, job("b", 1)])).toEqual(["a", "parts", "b"]);
  expect(stopOrders([job("a", 9), numbered, job("b", 1)], movable)[1]).toBe(5);
});
