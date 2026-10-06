import { mondayOf } from "./dispatch-calendar";
import { addCalendarDays } from "./internal-schedule-types";
import type { EquipmentNoteBody } from "./equipment-notes";
import type { OpsFixture } from "./types";

/**
 * Fictional in-house jobs on equipment with history, plus earlier AI repair notes, so the troubleshooting
 * assistant has a full story in the demo. Stable IDs; persisted facts win during insert-only backfill.
 */
const jobs = [
  { key: "104-cave", store: 104, assetId: "asset-104-beer-cave", tech: 1, categoryKey: "refrigeration", number: 8501, minutes: 120,
    problem: "Beer cave creeps up to 44°F in the afternoons and the compressor seems to run without stopping." },
  { key: "101-cave", store: 101, assetId: "asset-101-beer-cave", tech: 5, categoryKey: "refrigeration", number: 8502, minutes: 90,
    problem: "Beer cave evaporator coil is icing over again; product near the back wall is getting warm." },
  { key: "102-rtu", store: 102, assetId: "asset-102-rtu-1", tech: 1, categoryKey: "hvac", number: 8503, minutes: 90,
    problem: "Sales floor rooftop unit starts and stops every few minutes; the store is warm by mid-afternoon." },
] as const;

/** Earlier repair chats on these units, written the way the AI writes notes: about the equipment, no names. */
const history: { id: string; workOrderId: string; daysAgo: number; tech: number; chat: [string, string][]; note: EquipmentNoteBody }[] = [
  { id: "101-cave-defrost", workOrderId: "wo-history-101-1", daysAgo: 120, tech: 5,
    chat: [["ai", "What did you do?"], ["tech", "Coil was a solid block of ice. Defrost heater checked good at 6.2 amps. Termination switch was ending defrost after 4 minutes, replaced it. Manual defrost, box back to 36 in about an hour."], ["ai", "Replaced the defrost termination switch after finding a solid iced coil; heater checked good; box back to 36°F. Is that right?"], ["tech", "Yes, that's right."]],
    note: { symptoms: "Evaporator coil solid with ice; box warm", readings: ["Defrost heater 6.2 A", "Defrost ending after about 4 minutes", "Box 36°F about an hour after manual defrost"],
      tried: [{ action: "Checked defrost heater", result: "no_change", detail: "Heater drew 6.2 A, working" }, { action: "Replaced defrost termination switch", result: "fixed", detail: "Switch was ending defrost after about 4 minutes; coil fully iced at the time" }],
      fixedBy: "New defrost termination switch, then a manual defrost", parts: ["Defrost termination switch"], stillOpen: "", other: "" } },
  { id: "101-cave-gasket", workOrderId: "wo-pm-101-2025-q4", daysAgo: 60, tech: 5,
    chat: [["ai", "What did you do?"], ["tech", "Quarterly PM. Light frost on the coil near the door side. Bottom door gasket torn about 6 inches, warm air getting in. Taped it for now, need a 30x76 gasket."], ["ai", "PM done; light frost on the door side of the coil from a torn bottom door gasket, temporarily taped; needs a 30x76 gasket. Is that right?"], ["tech", "Yes, that's right."]],
    note: { symptoms: "Light frost on the door side of the evaporator coil", readings: [],
      tried: [{ action: "Temporary tape repair on torn bottom door gasket", result: "helped", detail: "Gasket torn about 6 inches, letting warm moist air in; frost limited to door side, not a solid block" }],
      fixedBy: "", parts: [], stillOpen: "Needs a 30x76 door gasket", other: "Different from the earlier solid-ice event: frost only near the door." } },
  { id: "104-cave-terminals", workOrderId: "wo-pm-104-2026-q1", daysAgo: 30, tech: 1,
    chat: [["ai", "What did you do?"], ["tech", "PM on the beer cave. New compressor from this year. Retorqued the compressor terminals like the install notes say, one was a bit loose. Condenser coil was dirty, cleaned it. Box at 35 when I left."], ["ai", "PM done; retorqued compressor terminals (one slightly loose) and cleaned a dirty condenser coil; box 35°F. Is that right?"], ["tech", "Yes, that's right."]],
    note: { symptoms: "Routine PM; no complaint", readings: ["Box 35°F at departure"],
      tried: [{ action: "Retorqued compressor terminals", result: "unknown", detail: "One terminal slightly loose on the compressor installed this year" }, { action: "Cleaned condenser coil", result: "unknown", detail: "Coil dirty at PM" }],
      fixedBy: "", parts: [], stillOpen: "", other: "Loose terminals have caused repeat callbacks on this unit before." } },
];

export function addAiDiagnosticDemo(f: OpsFixture): OpsFixture {
  const org = f.organizations[0].id, date = f.asOf.slice(0, 10), createdAt = `${addCalendarDays(date, -1)}T12:00:00.000Z`;
  const facility = "membership-northline-facilities", manager = "membership-northline-field-manager";
  const nameOf = (membershipId: string) => f.users.find(u => u.id === f.memberships.find(m => m.id === membershipId)?.userId)?.displayName ?? "Technician";
  const managerName = nameOf(manager), facilityName = nameOf(facility);
  // Only the Clark Pump and Shop presentation gets this story; other fixtures (such as the 65-store scale test) don't.
  const ready = (job: (typeof jobs)[number]) => f.assets.some(a => a.id === job.assetId) && f.stores.some(s => s.id === `store-northline-${job.store}`) && f.memberships.some(m => m.id === `membership-northline-tech-${job.tech}`);
  if (!jobs.every(ready) || !f.memberships.some(m => m.id === manager) || !f.memberships.some(m => m.id === facility)) return f;
  for (const job of jobs) {
    const id = `ai-demo-job-${job.key}`, assignmentId = `${id}-assignment`, membershipId = `membership-northline-tech-${job.tech}`, who = nameOf(membershipId);
    const dueAt = `${addCalendarDays(date, 1)}T16:00:00.000Z`, scheduleId = `${id}-schedule`;
    f.workOrders.push({ id, organizationId: org, number: `CPS-2026-${job.number}`, storeId: `store-northline-${job.store}`, assetId: job.assetId, problem: job.problem, categoryKey: job.categoryKey, priority: "routine", status: "approved", version: 0, internalAccountableType: "membership", internalAccountableId: manager, internalAccountableParty: managerName, accountableParty: who, nextAction: "Begin internal work", dueAt, escalationTo: "Facilities leadership", createdAt, internalScheduleId: scheduleId });
    f.assignments.push({ id: assignmentId, organizationId: org, workOrderId: id, kind: "internal", internalTarget: "person", internalMembershipId: membershipId, status: "accepted", assignedAt: createdAt });
    (f.internalSchedules ??= []).push({ id: scheduleId, organizationId: org, workOrderId: id, assignmentId, revision: 1, attempt: 1, precision: "day", planningZone: f.organizations[0].timeZone, week: mondayOf(date), day: date, durationMinutes: job.minutes, tentative: false, recordedBy: facility, recordedByName: facilityName, recordedAt: createdAt });
    f.workflowTasks.push({ id: `${id}-task`, organizationId: org, workOrderId: id, taskType: "other", title: "Begin internal work", reason: job.problem, assigneeType: "user", assigneeId: membershipId, assigneeName: who, priority: "normal", status: "open", blocking: true, requiredForProgress: true, dueAt, completionCriteria: "Arrange internal service and record its outcome", escalationDestination: "Facilities leadership", escalationLevel: 0, createdByActorType: "user", createdByActorId: facility, createdByActorName: facilityName, createdAt });
    f.auditEvents.push({ id: `${id}-audit`, organizationId: org, aggregateType: "work_order", aggregateId: id, eventType: "internal_dispatch.seeded", actorType: "system", actorName: "Fictional AI demo", occurredAt: createdAt, payloadJson: JSON.stringify({ meaning: "fictional_example", internalTarget: "person" }) });
  }
  for (const item of history) {
    if (!f.workOrders.some(w => w.id === item.workOrderId)) continue;
    const at = `${addCalendarDays(date, -item.daysAgo)}T15:00:00.000Z`, membershipId = `membership-northline-tech-${item.tech}`, conversationId = `ai-demo-chat-${item.id}`;
    (f.aiConversations ??= []).push({ id: conversationId, organizationId: org, workOrderId: item.workOrderId, kind: "checkout", messages: item.chat.map(([from, text]) => ({ from: from as "tech" | "ai", text })), summary: item.note.fixedBy || item.note.stillOpen || item.note.symptoms, provider: "demo", model: "fictional", createdByMembershipId: membershipId, createdByName: nameOf(membershipId), createdAt: at });
    (f.equipmentNotes ??= []).push({ ...item.note, id: `ai-demo-note-${item.id}`, organizationId: org, workOrderId: item.workOrderId, conversationId, provider: "demo", model: "fictional", createdByMembershipId: membershipId, createdByName: nameOf(membershipId), createdAt: at });
  }
  return f;
}

