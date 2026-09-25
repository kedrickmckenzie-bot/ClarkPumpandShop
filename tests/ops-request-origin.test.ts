import { expect, it } from "vitest";
import { isWorkspaceOrigin } from "@/lib/server/request-origin";

it.each([
  [{origin:"https://app.example", "sec-fetch-site":"same-origin"}, true],
  [{origin:"http://localhost:10000"}, true],
  [{origin:"https://app.example"}, false],
  [{origin:"https://app.example", "sec-fetch-site":"same-site"}, false],
  [{origin:"http://localhost:10000", "sec-fetch-site":"cross-site"}, false],
  [{"sec-fetch-site":"cross-site"}, false],
  [{origin:"null", "sec-fetch-site":"same-origin"}, false],
  [{origin:"not-an-origin", "sec-fetch-site":"same-origin"}, false],
  [{origin:"https://evil.example", "x-forwarded-host":"evil.example", "x-forwarded-proto":"https"}, false],
] as const)("checks browser origin evidence: %j", (headers, expected) => {
  expect(isWorkspaceOrigin(new Request("http://localhost:10000/api/ops/stores", {method:"POST", headers}))).toBe(expected);
});
