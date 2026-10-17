import "server-only";
import { assignmentForWork, scopeFixture } from "@/app/app/_data/operator-presenter";
import { getRequestOpsFixtureSnapshot } from "@/app/app/_data/request-data";
import type { OperatorSession } from "@/components/ops/data-contract";
import { AiUnavailableError, type AiClient } from "@/lib/ops/ai";
import { costWhileUnderWarranty, equipmentHistory, jobs, linksIn, repeatRepairs, spending, type AskContext } from "@/lib/ops/ask-lookups";
import { civilDate } from "@/lib/ops/dispatch-calendar";
import type { OpsRepository } from "@/lib/ops/repository";
import { attentionReason, storesNeedingAttention } from "@/lib/ops/stores-needing-attention";

/** Roles that can use Ask: people who run or pay for maintenance, not technicians or store staff. */
export const ASK_ROLES = ["executive", "facilities", "regional", "finance"] as const;

const period = { type: "string", enum: ["30d", "90d", "12m", "ytd", "last_year", "all"], description: "Time window. Default 12m." };
const date = (what: string) => ({ type: "string", description: `${what} as YYYY-MM-DD; overrides period.` });
const filters = {
  store: { type: "string", description: "Store number or name, e.g. 104 or Ridgeview." },
  category: { type: "string", description: "Work category, e.g. refrigeration, hvac, plumbing, fuel, electrical, doors, foodservice." },
  vendor: { type: "string", description: "Outside vendor name, e.g. ColdLine." },
  equipment: { type: "string", description: "Equipment name, tag or type, e.g. beer cave, ice machine." },
};

export const ASK_TOOLS = [
  { name: "spending", description: "Recorded maintenance cost (labor, parts, invoices matched to jobs) for a time window, grouped by store, category, vendor, region, month or equipment, with the previous period's total for comparison.",
    input_schema: { type: "object", properties: { period, from: date("Start"), to: date("End"), groupBy: { type: "string", enum: ["store", "category", "vendor", "region", "month", "equipment"] }, ...filters, top: { type: "integer", description: "How many groups, max 25." } } } },
  { name: "jobs", description: "Work orders matching filters: open, late (next step past its deadline), done or all. Newest first, with a count and links.",
    input_schema: { type: "object", properties: { status: { type: "string", enum: ["open", "late", "done", "all"] }, priority: { type: "string", enum: ["urgent", "routine"] }, period: { ...period, description: "Window for when jobs were opened. Leave out for any time." }, from: date("Opened from"), to: date("Opened to"), ...filters, limit: { type: "integer", description: "Max 20." } } } },
  { name: "repeat_repairs", description: "Repairs that came back: a new job on the same equipment within N days (default 30) after an earlier job on it finished. Group by equipment, vendor (who did the earlier job) or store.",
    input_schema: { type: "object", properties: { period, from: date("Start"), to: date("End"), groupBy: { type: "string", enum: ["equipment", "vendor", "store"] }, store: filters.store, vendor: filters.vendor, days: { type: "integer" } } } },
  { name: "equipment_history", description: "One piece of equipment: make, model, install date, warranty, all-time jobs and recorded cost, recent jobs.",
    input_schema: { type: "object", properties: { store: filters.store, equipment: filters.equipment }, required: ["equipment"] } },
  { name: "cost_while_under_warranty", description: "Recorded cost on jobs for equipment that was under warranty when the job was opened. A review list, not proof of overpayment.",
    input_schema: { type: "object", properties: { period, from: date("Start"), to: date("End"), store: filters.store } } },
  { name: "stores_needing_attention", description: "Stores right now with a can't-operate or partly-operating report, an urgent job past its deadline, or overdue compliance.",
    input_schema: { type: "object", properties: {} } },
];

export function askSystemPrompt(session: OperatorSession, today: string) {
  return [
    `You answer questions about ${session.organizationName}'s store maintenance for ${session.displayName} (${session.scopeLabel}). Today is ${today}.`,
    "Use only the lookups. Every number you state must come from a lookup result; never estimate, add up or invent numbers yourself. If no lookup covers the question, say plainly that you can't answer it from the records and suggest what you can answer.",
    "Never say money was saved or lost; say what was recorded. Repeat repairs and warranty cost are facts to review, not proof of a bad repair or overpayment.",
    "Write for a busy owner: 1–4 short sentences, plain words, no jargon, no headings, no tables. Use at most 5 short bullet points only for lists.",
    "Link the records behind each number with markdown links, using only the exact /app/... links from the lookup results, e.g. [see the 7 jobs](/app/work-orders?...). Name the time window and that amounts are recorded work cost.",
    "If a name doesn't match (see notes), say so and ask which one they meant. Don't answer questions about anything other than this company's maintenance records.",
  ].join("\n");
}

export interface AskTurn { role: "user" | "assistant"; content: string }

/** Answers one question in a conversation. Links in the answer that no lookup returned are removed. */
export async function answerAsk(ai: AiClient, repository: OpsRepository, session: OperatorSession, messages: AskTurn[]) {
  if (!ai.toolChat) throw new AiUnavailableError("Ask isn't available with this AI connection.");
  const organization = await repository.getOrganization(session.organizationId);
  const now = new Date().toISOString(), today = civilDate(now, organization?.timeZone ?? "America/New_York");
  const fixture = await getRequestOpsFixtureSnapshot(session.organizationId);
  const scoped = scopeFixture(fixture, session);
  const ctx: AskContext = { fixture, scope: scoped, today, now, vendorOf: id => { const a = assignmentForWork(fixture, session.organizationId, id); return a?.kind === "outside_vendor" ? a.vendorId : undefined; } };
  const allowed = new Set<string>(["/app/stores?attention=1", "/app/warranties", "/app/work-orders", "/app/spend"]);
  const used: string[] = [];
  const runTool = async (name: string, input: Record<string, unknown>) => {
    const text = (key: string) => typeof input[key] === "string" ? input[key] as string : undefined;
    const num = (key: string) => typeof input[key] === "number" ? input[key] as number : undefined;
    let result: unknown;
    if (name === "spending") result = spending(ctx, { period: text("period") as never, from: text("from"), to: text("to"), groupBy: text("groupBy") as never, store: text("store"), category: text("category"), vendor: text("vendor"), equipment: text("equipment"), top: num("top") });
    else if (name === "jobs") result = jobs(ctx, { status: text("status") as never, priority: text("priority") as never, period: text("period") as never, from: text("from"), to: text("to"), store: text("store"), category: text("category"), vendor: text("vendor"), equipment: text("equipment"), limit: num("limit") });
    else if (name === "repeat_repairs") result = repeatRepairs(ctx, { period: text("period") as never, from: text("from"), to: text("to"), groupBy: text("groupBy") as never, store: text("store"), vendor: text("vendor"), days: num("days") });
    else if (name === "equipment_history") result = equipmentHistory(ctx, { store: text("store"), equipment: text("equipment") ?? "" });
    else if (name === "cost_while_under_warranty") result = costWhileUnderWarranty(ctx, { period: text("period") as never, from: text("from"), to: text("to"), store: text("store") });
    else if (name === "stores_needing_attention") {
      const rows = await storesNeedingAttention(repository, { organizationId: session.organizationId, storeIds: [...scoped.storeIds] }, now);
      result = { count: rows.length, href: "/app/stores?attention=1", stores: rows.map(row => { const store = scoped.stores.find(s => s.id === row.storeId); return { store: `Store ${store?.storeNumber} · ${store?.name.replace(/^.* - /, "")}`, why: attentionReason(row), href: `/app/stores/${encodeURIComponent(row.storeId)}` }; }) };
    } else throw new Error(`There is no lookup called ${name}.`);
    linksIn(result, allowed);
    used.push(name);
    return JSON.stringify(result);
  };
  const raw = await ai.toolChat({ system: askSystemPrompt(session, today), messages: messages.slice(-10), tools: ASK_TOOLS, runTool });
  return { answer: keepKnownLinks(raw, allowed), lookups: used };
}

/** Removes any markdown link whose target a lookup didn't return, keeping its text. */
export function keepKnownLinks(answer: string, allowed: Set<string>) {
  return answer.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => allowed.has(href) ? whole : label);
}
