import { z } from "zod/v4";
import type { AiClient } from "./ai";
import type { AiChatMessage } from "./ai-conversations";
import type { OpsCommandServices } from "./commands";
import { OpsDomainError } from "./errors";
import type { ActorContext } from "./types";

/**
 * Detailed repair notes the AI writes from a technician's chat. They describe the equipment, never the
 * person, and are read by the AI for future diagnostics. People cannot browse them: only a top admin can
 * open them, one unit at a time, and every opening is recorded.
 */
export const equipmentNoteSchema = z.object({
  /** What the equipment was doing, in plain words. */
  symptoms: z.string(),
  /** Readings exactly as said, such as "box 41°F" or "suction 38 psi". */
  readings: z.array(z.string()),
  /** Each thing tried and what happened, so a later reader can compare conditions. */
  tried: z.array(z.object({ action: z.string(), result: z.enum(["fixed", "helped", "no_change", "unknown"]), detail: z.string() })),
  /** What fixed it, or empty when not fixed. */
  fixedBy: z.string(),
  parts: z.array(z.string()),
  /** What is still unknown or still needed. */
  stillOpen: z.string(),
  /** Anything else worth knowing next time. */
  other: z.string(),
});
export type EquipmentNoteBody = z.infer<typeof equipmentNoteSchema>;

export interface EquipmentNote extends EquipmentNoteBody {
  id: string;
  organizationId: string;
  workOrderId: string;
  conversationId: string;
  provider?: string;
  model?: string;
  createdByMembershipId?: string;
  createdByName: string;
  createdAt: string;
}

const NOTE_SYSTEM = `You write repair notes about a piece of equipment from a technician's chat, for future troubleshooting by an AI assistant.

Write about the equipment, never about people:
- No names, no "the tech", no praise or blame. Never write "missed", "should have", "failed to", "forgot" or similar.
- Never record what an earlier visit did not find, notice or catch. Record only work that was done and what was found on this visit. If an earlier visit's work is mentioned, record the work itself, not a judgment of it.
- Use only facts said in the chat. Never invent readings, parts, causes or results. Leave a field empty or the list empty when nothing was said.
- Keep numbers, units, part numbers and model numbers exactly as said.
- "tried": one entry per thing done or checked. result is "fixed" if it solved the problem, "helped" if it improved it, "no_change" if it made no difference, "unknown" if not said. Put the conditions in "detail" (what it was doing at the time) so a later reader can tell whether a new problem is the same or different.
- "parts": only parts put in on this visit. Work the technician says was done on an earlier visit goes in "tried" marked "(earlier visit, reported)".
- Short phrases, not paragraphs.`;

/** Turns a confirmed checkout chat into a structured equipment note. */
export async function writeEquipmentNote(ai: AiClient, input: { problem: string; store: string; equipment?: string; messages: AiChatMessage[] }) {
  const prompt = [
    `Job: ${input.problem}`,
    `Store: ${input.store}`,
    input.equipment ? `Equipment: ${input.equipment}` : "Equipment: not recorded",
    "",
    "Chat:",
    ...input.messages.map(message => `${message.from === "tech" ? "Technician" : "Assistant"}: ${message.text}`),
  ].join("\n");
  const note = await ai.json({ system: NOTE_SYSTEM, prompt, schema: equipmentNoteSchema, effort: "low", maxTokens: 3000, tier: "fast" });
  const short = (value: string, max = 600) => value.trim().slice(0, max);
  return {
    symptoms: short(note.symptoms),
    readings: note.readings.map(r => short(r, 120)).filter(Boolean).slice(0, 20),
    tried: note.tried.map(t => ({ action: short(t.action, 200), result: t.result, detail: short(t.detail, 400) })).filter(t => t.action).slice(0, 20),
    fixedBy: short(note.fixedBy),
    parts: note.parts.map(p => short(p, 160)).filter(Boolean).slice(0, 20),
    stillOpen: short(note.stillOpen),
    other: short(note.other),
  } satisfies EquipmentNoteBody;
}

export async function saveEquipmentNote(dependencies: OpsCommandServices, input: {
  organizationId: string;
  actor: ActorContext;
  workOrderId: string;
  conversationId: string;
  note: EquipmentNoteBody;
  provider?: string;
  model?: string;
}) {
  const now = dependencies.clock?.now() ?? new Date().toISOString();
  const ids = dependencies.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  if (input.actor.organizationId !== input.organizationId || input.actor.actorType !== "user") throw new OpsDomainError("FORBIDDEN", "Sign in to save notes.");
  const id = ids.next("equipment-note");
  await dependencies.repository.atomicWrite([{
    sql: "INSERT INTO ops_equipment_notes (id, organization_id, work_order_id, conversation_id, note_json, provider, model, created_by_membership_id, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    params: [id, input.organizationId, input.workOrderId, input.conversationId, JSON.stringify(input.note), input.provider ?? null, input.model ?? null, input.actor.actorId ?? null, input.actor.actorName ?? "Technician", now],
  }]);
  return { id };
}

/**
 * Opens the raw notes for one unit. Top admins only, and the opening is written to the audit log,
 * so the notes stay a way to check the AI rather than a way to review people.
 */
export async function openEquipmentNotes(dependencies: OpsCommandServices, input: { organizationId: string; actor: ActorContext; assetId: string }) {
  const { repository } = dependencies;
  const now = dependencies.clock?.now() ?? new Date().toISOString();
  const ids = dependencies.ids ?? { next: (prefix: string) => `${prefix}-${crypto.randomUUID()}` };
  const { actor } = input;
  if (actor.organizationId !== input.organizationId || actor.actorType !== "user" || !actor.actorId) throw new OpsDomainError("FORBIDDEN", "Only a top admin can open these notes.");
  const membership = await repository.getMembership(input.organizationId, actor.actorId);
  if (!membership || membership.status !== "active" || membership.role !== "facilities_admin") throw new OpsDomainError("FORBIDDEN", "Only a top admin can open these notes.");
  const asset = await repository.getAsset(input.organizationId, input.assetId);
  if (!asset) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
  const notes = await repository.listEquipmentNotes(input.organizationId, asset.id, 100);
  await repository.atomicWrite([{
    sql: "INSERT INTO ops_audit_events (id, organization_id, aggregate_type, aggregate_id, event_type, actor_type, actor_id, actor_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    params: [ids.next("audit"), input.organizationId, "asset", asset.id, "equipment_notes.opened", actor.actorType, actor.actorId, actor.actorName ?? null, now, JSON.stringify({ noteCount: notes.length })],
  }]);
  return { asset, notes };
}

const resultLabel = { fixed: "fixed it", helped: "helped", no_change: "no change", unknown: "result not said" } as const;

/** Plain text of past notes for the diagnostic AI: dated, newest first, no names. */
export function notesForAi(notes: EquipmentNote[]) {
  return notes.map(note => [
    `${note.createdAt.slice(0, 10)}:`,
    note.symptoms ? `  Symptoms: ${note.symptoms}` : undefined,
    note.readings.length ? `  Readings: ${note.readings.join("; ")}` : undefined,
    ...note.tried.map(t => `  Tried: ${t.action} → ${resultLabel[t.result]}${t.detail ? ` (${t.detail})` : ""}`),
    note.fixedBy ? `  Fixed by: ${note.fixedBy}` : undefined,
    note.parts.length ? `  Parts: ${note.parts.join("; ")}` : undefined,
    note.stillOpen ? `  Still open: ${note.stillOpen}` : undefined,
    note.other ? `  Other: ${note.other}` : undefined,
  ].filter(Boolean).join("\n")).join("\n");
}
