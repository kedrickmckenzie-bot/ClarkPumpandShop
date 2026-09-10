import { describe, expect, it } from "vitest";
import { reviewItemHref, safeReviewQueue, savedReviewHref, selectNextReview } from "@/lib/ops/review-navigation";

describe("sequential review navigation", () => {
  it("preserves exact filters, page, source anchor and original order", () => {
    const queue = "/app/action-center?store=store-northline-104&lane=mine&q=door&page=2";
    const href = reviewItemHref("/app/work-orders/wo-1?view=accountability#workflow-task-task-1", queue, "task-1", ["task-2", "task-3"]);
    const url = new URL(href, "https://local.test");
    expect(url.hash).toBe("#workflow-task-task-1");
    expect(url.searchParams.get("view")).toBe("accountability");
    const saved = new URL(savedReviewHref(url.href), url.origin);
    expect(saved.searchParams.get("queue")).toBe(queue);
    expect(selectNextReview([{ id: "task-3" }, { id: "task-2" }], "task-1", saved.searchParams.get("following")!)).toEqual({ id: "task-2" });
  });

  it("skips concurrently completed or inaccessible items without restarting earlier work", () => {
    const eligible = [{ id: "earlier" }, { id: "task-3" }, { id: "other-store" }];
    expect(selectNextReview(eligible, "task-1", "task-2,task-3")).toEqual({ id: "task-3" });
    expect(selectNextReview(eligible, "task-3", "task-2")).toBeUndefined();
    expect(selectNextReview(eligible, "task-3", "")).toBeUndefined();
    expect(safeReviewQueue("https://foreign.test/app/action-center")).toBe("/app/action-center");
    expect(safeReviewQueue("http://[")).toBe("/app/action-center");
    expect(safeReviewQueue("/app/invoices")).toBe("/app/action-center");
  });
});
