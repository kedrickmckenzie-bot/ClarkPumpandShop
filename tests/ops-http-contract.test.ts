import { describe, expect, it } from "vitest";
import {
  isOpsClientRequest,
  OPS_CLIENT_HEADER,
} from "@/lib/ops/http-contract";

describe("operator HTTP client contract", () => {
  it("uses the product-name-neutral client header", () => {
    const request = new Request("https://operations.test/api/ops/taxonomy", {
      headers: { [OPS_CLIENT_HEADER]: "taxonomy-manager" },
    });

    expect(OPS_CLIENT_HEADER).toBe("x-ops-client");
    expect(isOpsClientRequest(request, "taxonomy-manager")).toBe(true);
  });

  it("accepts the legacy client header during rolling deployments", () => {
    const request = new Request("https://operations.test/api/ops/taxonomy", {
      headers: { "x-traceops-client": "taxonomy-manager" },
    });

    expect(isOpsClientRequest(request, "taxonomy-manager")).toBe(true);
    expect(isOpsClientRequest(request, "replacement-intelligence")).toBe(false);
  });
});
