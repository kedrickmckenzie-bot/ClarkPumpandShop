import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { answerAsk, keepKnownLinks } from "@/lib/server/ask";
import { getNorthlineFixtureRepository, resetNorthlineFixtureRepository } from "@/lib/ops/fixture-repository";
import { NORTHLINE_ORGANIZATION_ID } from "@/lib/ops/fixtures";
import type { AiClient } from "@/lib/ops/ai";
import type { OperatorSession } from "@/components/ops/data-contract";

const session = { organizationId: NORTHLINE_ORGANIZATION_ID, organizationName: "Clark Pump and Shop", userId: "user-northline-facilities", membershipId: "membership-northline-facilities", displayName: "Jordan Lee", email: "j@x.test", scopeLabel: "Companywide", role: "facilities", demoEdition: "complete", accessMode: "preview" } as OperatorSession;

describe("Ask", () => {
  it("answers only from lookups and drops links no lookup returned", async () => {
    resetNorthlineFixtureRepository();
    let seen: Record<string, unknown> | undefined;
    const ai = { provider: "test", model: "test", json: async () => { throw new Error("unused"); },
      async toolChat({ runTool, tools, system }) {
        expect(tools.map(t => t.name)).toContain("spending");
        expect(system).toMatch(/never estimate/);
        seen = JSON.parse(await runTool("spending", { groupBy: "store", period: "12m" }));
        const row = (seen!.rows as Array<{ label: string; amount: string; href: string }>)[0]!;
        return `${row.label} spent the most: ${row.amount}. [see the jobs](${row.href}) [made up](/app/admin/secret)`;
      } } satisfies AiClient;
    const { answer, lookups } = await answerAsk(ai, getNorthlineFixtureRepository(), session, [{ role: "user", content: "Which store spent the most?" }]);
    expect(lookups).toEqual(["spending"]);
    expect(answer).toMatch(/\[see the jobs\]\(\/app\/work-orders\?/);
    expect(answer).not.toContain("/app/admin/secret");
    expect(answer).toContain("made up");
  });

  it("refuses an unknown lookup", async () => {
    const ai = { provider: "test", model: "test", json: async () => { throw new Error("unused"); },
      async toolChat({ runTool }) { await expect(runTool("delete_everything", {})).rejects.toThrow(/no lookup/); return "ok"; } } satisfies AiClient;
    await answerAsk(ai, getNorthlineFixtureRepository(), session, [{ role: "user", content: "hi" }]);
  });

  it("keeps known links and strips the rest", () => {
    expect(keepKnownLinks("[a](/app/x) [b](https://evil.example)", new Set(["/app/x"]))).toBe("[a](/app/x) b");
  });
});
