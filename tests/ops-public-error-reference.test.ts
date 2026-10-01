import { afterEach, expect, it, vi } from "vitest";
import { publicApiError } from "@/components/ops-public/server-http";

afterEach(() => vi.restoreAllMocks());
it("correlates unexpected public failures without exposing database details or tokens", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = publicApiError(Object.assign(new Error("secret token and query values"), {
    code: "23514", constraint: "chk_ops_site_visit_work_followup_outcome", table: "ops_site_visit_work_orders",
    detail: "private customer data", query: "secret query",
  }));
  const body = await response.json() as { reference: string; error: string };
  expect(response.status).toBe(500);
  expect(body.reference).toMatch(/^[a-f0-9-]{36}$/);
  expect(body.error).toContain(body.reference);
  expect(log).toHaveBeenCalledWith("Public workflow failed", expect.objectContaining({ reference: body.reference, code: "23514", constraint: "chk_ops_site_visit_work_followup_outcome" }));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|private customer/);
  expect(JSON.stringify(body)).not.toMatch(/23514|chk_ops|secret/);
});
