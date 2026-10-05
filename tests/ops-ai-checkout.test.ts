import { expect, it } from "vitest";
import { checkoutChatTurn, type CheckoutChatTurn } from "@/lib/ops/ai-checkout";
import { cleanChatMessages, saveAiConversation } from "@/lib/ops/ai-conversations";
import { AiUnavailableError, type AiClient } from "@/lib/ops/ai";
import { checkoutChoices } from "@/lib/ops/checkout-choices";
import { createOpsFixtureRepository } from "@/lib/ops/fixture-repository";
import { buildShowcaseFixture } from "@/lib/ops/showcase-fixture";

/** A stand-in AI that returns a fixed answer and records what it was asked. */
function fakeAi(answer: CheckoutChatTurn) {
  const calls: { system: string; prompt: string; effort?: string }[] = [];
  const ai: AiClient = { provider: "test", model: "test", async json(request) { calls.push(request); return request.schema.parse(answer); } };
  return { ai, calls };
}
const base = { problem: "Restroom faucet drips", store: "101 Cedar Grove", messages: [{ from: "ai" as const, text: "What did you do?" }, { from: "tech" as const, text: "swapped the cartridge, no more drip" }] };
const turn = (over: Partial<CheckoutChatTurn>): CheckoutChatTurn => ({ reply: "Swapped the cartridge, no drip. Is that right?", ready: true, outcome: "completed", notes: "Swapped the cartridge.", workingWhenLeft: "yes", ...over });

it("sends the job, equipment, allowed results and the whole chat, and keeps a ready summary", async () => {
  const { ai, calls } = fakeAi(turn({ notes: " Swapped the cartridge. " }));
  expect(await checkoutChatTurn(ai, { ...base, mode: "job", equipment: "Faucet · Delta" })).toEqual(turn({}));
  for (const text of ["Restroom faucet drips", "Faucet · Delta", "completed = Fixed", "Technician: swapped the cartridge", "You: What did you do?"]) expect(calls[0].prompt).toContain(text);
  expect(calls[0].effort).toBe("low");
  expect(calls[0].system).toContain("Never invent parts");
  expect(calls[0].system).toContain("ONE short question");
});

it("never claims ready while the form still needs an answer", async () => {
  const unknownWorking = await checkoutChatTurn(fakeAi(turn({ workingWhenLeft: "unknown" })).ai, { ...base, mode: "job" });
  expect(unknownWorking).toMatchObject({ ready: false, reply: "Was it working when you left?" });
  const noNotes = await checkoutChatTurn(fakeAi(turn({ outcome: "return_visit_required", notes: " " })).ai, { ...base, mode: "job" });
  expect(noNotes).toMatchObject({ ready: false, reply: "What still needs to be done?" });
  // Flag a problem does not ask whether it was working.
  expect((await checkoutChatTurn(fakeAi(turn({ outcome: checkoutChoices("problem")[0][0], workingWhenLeft: "unknown", notes: "Need a cartridge" })).ai, { ...base, mode: "problem" })).ready).toBe(true);
  // A question passes straight through.
  expect(await checkoutChatTurn(fakeAi(turn({ ready: false, reply: "Did the drip stop?" })).ai, { ...base, mode: "job" })).toMatchObject({ ready: false, reply: "Did the drip stop?" });
});

it("never returns a result the form cannot show", async () => {
  expect((await checkoutChatTurn(fakeAi(turn({ outcome: "parts_required", notes: "Need a cartridge", workingWhenLeft: "no" })).ai, { ...base, mode: "job" })).outcome).toBe("return_visit_required");
  expect((await checkoutChatTurn(fakeAi(turn({})).ai, { ...base, mode: "visit", lookAndReport: true })).outcome).toBe("return_visit_required");
  expect((await checkoutChatTurn(fakeAi(turn({ notes: "x" })).ai, { ...base, mode: "problem" })).outcome).toBe(checkoutChoices("problem")[0][0]);
});

it("waits for the technician to say something before calling the AI", async () => {
  const { ai, calls } = fakeAi(turn({}));
  await expect(checkoutChatTurn(ai, { ...base, mode: "job", messages: [{ from: "ai", text: "What did you do?" }] })).rejects.toBeInstanceOf(AiUnavailableError);
  expect(calls).toHaveLength(0);
});

it("checks chats from the browser", () => {
  expect(cleanChatMessages([{ from: "tech", text: " fixed it " }, { from: "ai", text: "" }])).toEqual([{ from: "tech", text: "fixed it" }]);
  expect(() => cleanChatMessages([{ from: "manager", text: "x" }])).toThrow(/plain text/);
  expect(() => cleanChatMessages([{ from: "tech", text: "x".repeat(2001) }])).toThrow(/plain text/);
  expect(() => cleanChatMessages(Array.from({ length: 31 }, () => ({ from: "tech", text: "x" })))).toThrow(/too long/);
  expect(() => cleanChatMessages("hello")).toThrow(/too long/);
});

it("saves the conversation with its job and reads it back the same way in SQL", async () => {
  const org = "org-northline-demo", now = "2026-10-05T12:00:00.000Z";
  const fixture = buildShowcaseFixture(now), work = fixture.workOrders[0];
  const actor = { organizationId: org, actorType: "user" as const, actorId: "membership-northline-tech-1", actorName: "Maria" };
  const messages = [{ from: "ai" as const, text: "What did you do?" }, { from: "tech" as const, text: "Cleaned the coil, box at 36." }];
  const repository = createOpsFixtureRepository(fixture);
  const services = { repository, clock: { now: () => now }, ids: { next: (p: string) => `${p}-1` } };
  await expect(saveAiConversation(services, { organizationId: org, actor: { ...actor, organizationId: "other" }, workOrderId: work.id, kind: "checkout", messages })).rejects.toThrow(/Sign in/);
  await expect(saveAiConversation(services, { organizationId: org, actor, workOrderId: "missing", kind: "checkout", messages })).rejects.toThrow(/not found/);
  await expect(saveAiConversation(services, { organizationId: org, actor, workOrderId: work.id, kind: "checkout", messages: [] })).rejects.toThrow(/nothing/);
  await saveAiConversation(services, { organizationId: org, actor, workOrderId: work.id, kind: "checkout", messages, summary: "Cleaned coil", provider: "anthropic", model: "m" });
  const saved = await repository.listAiConversations(org, work.id);
  expect(saved).toEqual([expect.objectContaining({ id: "ai-conversation-1", kind: "checkout", messages, summary: "Cleaned coil", createdByName: "Maria", createdByMembershipId: "membership-northline-tech-1" })]);
  expect(await repository.listAiConversations("another-org", work.id)).toEqual([]);

  const { DatabaseSync } = await import("node:sqlite"), { readdirSync, readFileSync } = await import("node:fs");
  const { createOpsSqlRepository } = await import("@/lib/ops/sql-repository");
  const { buildOpsSeedStatements } = await import("@/lib/ops/seed");
  const db = new DatabaseSync(":memory:");
  type Value = string | number | null;
  try {
    for (const f of readdirSync("drizzle").filter(f => /^\d.*\.sql$/.test(f)).sort()) db.exec(readFileSync(`drizzle/${f}`, "utf8"));
    for (const s of buildOpsSeedStatements(buildShowcaseFixture(now))) db.prepare(s.sql).run(...s.params.map(v => typeof v === "boolean" ? Number(v) : v ?? null) as Value[]);
    const sql = createOpsSqlRepository({ dialect: "sqlite", async query(s) { return { rows: db.prepare(s.sql).all(...s.params as Value[]) as never[], affectedRows: 0 }; }, async atomic(statements) { for (const s of statements) db.prepare(s.sql).run(...s.params as Value[]); } }, "d1");
    await saveAiConversation({ ...services, repository: sql }, { organizationId: org, actor, workOrderId: work.id, kind: "checkout", messages, summary: "Cleaned coil", provider: "anthropic", model: "m" });
    expect(await sql.listAiConversations(org, work.id)).toEqual(saved);
    expect(await sql.listAiConversations("another-org", work.id)).toEqual([]);
  } finally { db.close(); }
}, 60_000);
