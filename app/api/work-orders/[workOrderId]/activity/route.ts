import { NextResponse } from "next/server";
import { z } from "zod";
import { platformData } from "@/lib/platform/data";
import { isRuntimeCreatedId, registryEntityPrefixes } from "@/lib/platform/registry";
import { getD1, newId, ORGANIZATION_ID } from "@/lib/server/d1";

const activitySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("note"), author: z.string().min(2).max(100), authorRole: z.string().max(100).default("Maintenance"), body: z.string().min(2).max(4000), visibility: z.enum(["internal", "store", "vendor"]).default("internal") }),
  z.object({ type: z.literal("labor"), technicianId: z.string().min(1), technicianName: z.string().min(2), startedAt: z.string(), endedAt: z.string(), regularHours: z.coerce.number().min(0).max(24), overtimeHours: z.coerce.number().min(0).max(24).default(0), hourlyRateCents: z.coerce.number().int().min(0).default(0), notes: z.string().max(2000).default("") }),
  z.object({ type: z.literal("part"), partNumber: z.string().max(100).default(""), description: z.string().min(2).max(300), quantity: z.coerce.number().positive().max(10000), unitCostCents: z.coerce.number().int().min(0), source: z.enum(["truck_stock", "storeroom", "purchased", "vendor_supplied"]), recordedBy: z.string().min(2).max(100) }),
  z.object({ type: z.literal("status"), priorStatus: z.string().optional(), newStatus: z.string().min(2).max(80), reason: z.string().min(2).max(1000), actorName: z.string().min(2).max(100) }),
  z.object({ type: z.literal("checklist"), itemId: z.string().min(1), completed: z.boolean(), completedBy: z.string().min(2).max(100) }),
]);

const seededWorkOrderIds = new Set(platformData.workOrders.map((workOrder) => workOrder.id));

function isShowcaseWorkOrder(workOrderId: string) {
  return seededWorkOrderIds.has(workOrderId)
    || isRuntimeCreatedId(workOrderId, registryEntityPrefixes["work-orders"]);
}

export async function GET(_: Request, { params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  if (!isShowcaseWorkOrder(workOrderId)) return NextResponse.json({ ok: false, error: "Work order not found" }, { status: 404 });
  try {
    const db = getD1();
    const [notes, labor, parts, checklist, statuses] = await Promise.all([
      db.prepare(`SELECT id, author_name AS author, author_role AS authorRole, body, visibility, created_at AS createdAt FROM work_order_notes WHERE organization_id = ? AND work_order_id = ? ORDER BY created_at DESC`).bind(ORGANIZATION_ID, workOrderId).all(),
      db.prepare(`SELECT id, technician_id AS technicianId, technician_name AS technicianName, started_at AS startedAt, ended_at AS endedAt, regular_minutes AS regularMinutes, overtime_minutes AS overtimeMinutes, hourly_rate_cents AS hourlyRateCents, notes FROM labor_entries WHERE organization_id = ? AND work_order_id = ? ORDER BY started_at DESC`).bind(ORGANIZATION_ID, workOrderId).all(),
      db.prepare(`SELECT id, part_number AS partNumber, description, quantity_milli AS quantityMilli, unit_cost_cents AS unitCostCents, source, recorded_by_name AS recordedBy, recorded_at AS recordedAt FROM parts_used WHERE organization_id = ? AND work_order_id = ? ORDER BY recorded_at DESC`).bind(ORGANIZATION_ID, workOrderId).all(),
      db.prepare(`SELECT id, sequence, label, required, completed, completed_at AS completedAt, completed_by_name AS completedBy FROM work_order_checklist_items WHERE organization_id = ? AND work_order_id = ? ORDER BY sequence`).bind(ORGANIZATION_ID, workOrderId).all(),
      db.prepare(`SELECT id, prior_status AS priorStatus, new_status AS newStatus, reason, actor_name AS actorName, occurred_at AS occurredAt FROM work_order_status_events WHERE organization_id = ? AND work_order_id = ? ORDER BY occurred_at DESC`).bind(ORGANIZATION_ID, workOrderId).all(),
    ]);
    return NextResponse.json({ ok: true, notes: notes.results, labor: labor.results, parts: parts.results, checklist: checklist.results, statuses: statuses.results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Activity unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  if (!isShowcaseWorkOrder(workOrderId)) return NextResponse.json({ ok: false, error: "Work order not found" }, { status: 404 });
  const parsed = activitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid activity", issues: parsed.error.issues }, { status: 400 });
  const db = getD1(); const now = new Date().toISOString(); const data = parsed.data;
  try {
    if (data.type === "note") await db.prepare(`INSERT INTO work_order_notes (id, organization_id, work_order_id, author_name, author_role, body, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId("note"), ORGANIZATION_ID, workOrderId, data.author, data.authorRole, data.body, data.visibility, now).run();
    if (data.type === "labor") await db.prepare(`INSERT INTO labor_entries (id, organization_id, work_order_id, technician_id, technician_name, started_at, ended_at, regular_minutes, overtime_minutes, hourly_rate_cents, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId("labor"), ORGANIZATION_ID, workOrderId, data.technicianId, data.technicianName, data.startedAt, data.endedAt, Math.round(data.regularHours * 60), Math.round(data.overtimeHours * 60), data.hourlyRateCents, data.notes, now).run();
    if (data.type === "part") await db.prepare(`INSERT INTO parts_used (id, organization_id, work_order_id, part_number, description, quantity_milli, unit_cost_cents, source, recorded_by_name, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId("part"), ORGANIZATION_ID, workOrderId, data.partNumber, data.description, Math.round(data.quantity * 1000), data.unitCostCents, data.source, data.recordedBy, now).run();
    if (data.type === "status") await db.batch([
      db.prepare(`INSERT INTO work_order_status_events (id, organization_id, work_order_id, prior_status, new_status, reason, actor_name, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId("status"), ORGANIZATION_ID, workOrderId, data.priorStatus || null, data.newStatus, data.reason, data.actorName, now),
      db.prepare(`UPDATE work_orders SET status = ?, next_action = ? WHERE organization_id = ? AND id = ?`).bind(data.newStatus, data.reason, ORGANIZATION_ID, workOrderId),
    ]);
    if (data.type === "checklist") await db.prepare(`UPDATE work_order_checklist_items SET completed = ?, completed_at = ?, completed_by_name = ? WHERE organization_id = ? AND work_order_id = ? AND id = ?`).bind(data.completed ? 1 : 0, data.completed ? now : null, data.completed ? data.completedBy : null, ORGANIZATION_ID, workOrderId, data.itemId).run();
    return NextResponse.json({ ok: true, type: data.type, recordedAt: now }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to record activity" }, { status: 500 });
  }
}
