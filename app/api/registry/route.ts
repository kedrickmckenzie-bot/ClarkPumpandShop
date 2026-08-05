import { NextResponse } from "next/server";
import { z } from "zod";
import { getD1, newId, ORGANIZATION_ID } from "@/lib/server/d1";

const entitySchema = z.enum(["stores", "cost-centers", "assets", "components", "pm-plans", "work-orders"]);
const storeSchema = z.object({ code: z.string().trim().min(1).max(12), name: z.string().trim().min(2).max(120), regionId: z.string().optional(), address1: z.string().trim().min(3).max(160), city: z.string().trim().min(2).max(80), state: z.string().trim().length(2), postalCode: z.string().trim().min(5).max(10), phone: z.string().max(30).optional().default(""), managerName: z.string().max(100).optional().default(""), district: z.string().max(60).optional().default(""), squareFeet: z.coerce.number().int().min(0).max(500000).optional().default(0) });
const costCenterSchema = z.object({ storeId: z.string().min(1), categoryId: z.string().min(1), code: z.string().trim().min(1).max(30), name: z.string().trim().min(2).max(120), type: z.string().trim().min(2).max(100), description: z.string().max(1000).optional().default(""), location: z.string().max(120).optional().default(""), glCode: z.string().max(30).optional().default(""), annualBudgetCents: z.coerce.number().int().min(0).optional().default(0), ownerName: z.string().max(100).optional().default(""), maintenanceStrategy: z.enum(["run_to_failure", "preventive", "condition_based", "statutory"]).default("preventive") });
const assetSchema = z.object({ storeSystemId: z.string().min(1), assetClass: z.string().trim().min(2).max(100), assetTag: z.string().trim().min(1).max(40), name: z.string().trim().min(2).max(120), manufacturer: z.string().max(80).optional().default(""), model: z.string().max(80).optional().default(""), serial: z.string().max(100).optional().default(""), location: z.string().max(120).optional().default(""), installedAt: z.string().optional().default(""), replacementCostCents: z.coerce.number().int().min(0).optional().default(0), criticality: z.enum(["critical", "high", "standard"]).default("standard") });
const componentSchema = z.object({ assetId: z.string().min(1), type: z.string().trim().min(2).max(100), name: z.string().trim().min(2).max(120), partNumber: z.string().max(100).optional().default(""), serial: z.string().max(100).optional().default(""), quantity: z.coerce.number().positive().max(10000).default(1), unitCostCents: z.coerce.number().int().min(0).optional().default(0), criticalSpare: z.boolean().optional().default(false), installedAt: z.string().optional().default(""), warrantyEndsAt: z.string().optional().default("") });
const pmPlanSchema = z.object({ name: z.string().trim().min(3).max(160), description: z.string().max(1000).optional().default(""), categoryId: z.string().min(1), targetType: z.enum(["system", "asset"]), targetId: z.string().min(1), storeId: z.string().min(1), frequency: z.enum(["monthly", "quarterly", "semiannual", "annual"]), startAt: z.string().min(1), vendorId: z.string().optional(), requiredDocument: z.string().max(120).optional().default("Completed checklist and service evidence") });
const workOrderSchema = z.object({ storeId: z.string().min(1), categoryId: z.string().min(1), systemId: z.string().optional(), assetId: z.string().optional(), componentId: z.string().optional(), title: z.string().trim().min(3).max(160), description: z.string().trim().min(5).max(4000), location: z.string().max(160).optional().default(""), problemCode: z.string().max(80).optional().default(""), requestedBy: z.string().trim().min(2).max(100), priority: z.enum(["critical", "high", "routine", "low"]), workType: z.enum(["reactive", "preventive", "inspection", "emergency", "warranty", "capital", "internal"]), status: z.enum(["draft", "approved"]).optional().default("approved"), assignmentType: z.enum(["internal", "vendor", "blended", "unassigned"]), assignedToId: z.string().optional(), assignedToName: z.string().optional(), vendorId: z.string().optional(), dueAt: z.string().optional(), estimatedHours: z.coerce.number().min(0).max(999).optional().default(0), safetyRisk: z.enum(["none", "low", "moderate", "high"]).default("low"), accessInstructions: z.string().max(2000).optional().default(""), nteCents: z.coerce.number().int().min(0).optional().default(0) });

const selectSql: Record<z.infer<typeof entitySchema>, string> = {
  stores: `SELECT id, region_id AS regionId, code, name, address_1 AS address1, city, state, postal_code AS postalCode, phone, manager_name AS managerName, district, status, square_feet AS squareFeet, created_at AS createdAt FROM stores WHERE organization_id = ? ORDER BY created_at DESC`,
  "cost-centers": `SELECT id, store_id AS storeId, service_category_id AS categoryId, code, name, description, location, gl_code AS glCode, annual_budget_cents AS annualBudgetCents, owner_name AS ownerName, maintenance_strategy AS maintenanceStrategy, state, created_at AS createdAt FROM store_systems WHERE organization_id = ? ORDER BY created_at DESC`,
  assets: `SELECT id, store_system_id AS storeSystemId, asset_class_id AS assetClass, asset_tag AS assetTag, name, manufacturer, model, serial, location, condition, installed_at AS installedAt, replacement_cost_cents AS replacementCostCents, criticality, state, created_at AS createdAt FROM assets WHERE organization_id = ? ORDER BY created_at DESC`,
  components: `SELECT id, asset_id AS assetId, component_type_id AS type, name, part_number AS partNumber, serial, quantity, unit_cost_cents AS unitCostCents, critical_spare AS criticalSpare, installed_at AS installedAt, warranty_ends_at AS warrantyEndsAt, created_at AS createdAt FROM components WHERE organization_id = ? ORDER BY created_at DESC`,
  "pm-plans": `SELECT id, name, description, service_category_id AS categoryId, scope_type AS scopeType, frequency, start_at AS startAt, early_window_days AS earlyWindowDays, late_window_days AS lateWindowDays, vendor_id AS vendorId, required_document AS requiredDocument, active FROM pm_plans WHERE organization_id = ? ORDER BY start_at DESC`,
  "work-orders": `SELECT id, number, title, description, location, requested_by AS requestedBy, origin, store_id AS storeId, service_category_id AS categoryId, store_system_id AS systemId, asset_id AS assetId, component_id AS componentId, priority, work_type AS workType, status, accountable_party AS accountableParty, assignment_type AS assignmentType, assigned_to_id AS assignedToId, assigned_to_name AS assignedToName, next_action AS nextAction, due_at AS dueAt, safety_risk AS safetyRisk, access_instructions AS accessInstructions, vendor_id AS vendorId, vendor_acceptance AS vendorAcceptance, estimated_minutes AS estimatedMinutes, nte_cents AS nteCents, cost_exposure_cents AS costExposureCents, created_at AS createdAt, closed_at AS closedAt FROM work_orders WHERE organization_id = ? ORDER BY created_at DESC`,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = entitySchema.safeParse(url.searchParams.get("entity"));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Unknown registry entity" }, { status: 400 });
  try {
    const result = await getD1().prepare(selectSql[parsed.data]).bind(ORGANIZATION_ID).all();
    return NextResponse.json({ ok: true, records: result.results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Registry unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { entity?: unknown; data?: unknown } | null;
  const entity = entitySchema.safeParse(body?.entity);
  if (!entity.success) return NextResponse.json({ ok: false, error: "Unknown registry entity" }, { status: 400 });
  const now = new Date().toISOString();
  const db = getD1();
  try {
    if (entity.data === "stores") {
      const data = storeSchema.parse(body?.data); const id = newId("store");
      await db.prepare(`INSERT INTO stores (id, organization_id, region_id, code, name, address_1, city, state, postal_code, phone, manager_name, district, status, square_feet, geofence_radius_m, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 200, 1, ?)`).bind(id, ORGANIZATION_ID, data.regionId || null, data.code, data.name, data.address1, data.city, data.state.toUpperCase(), data.postalCode, data.phone, data.managerName, data.district, data.squareFeet, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "cost-centers") {
      const data = costCenterSchema.parse(body?.data); const id = newId("cost-center");
      await db.prepare(`INSERT INTO store_systems (id, organization_id, store_id, service_category_id, code, name, description, location, gl_code, annual_budget_cents, owner_name, maintenance_strategy, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', ?)`).bind(id, ORGANIZATION_ID, data.storeId, data.categoryId, data.code, data.name, data.description, data.location, data.glCode, data.annualBudgetCents, data.ownerName, data.maintenanceStrategy, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "assets") {
      const data = assetSchema.parse(body?.data); const id = newId("asset");
      await db.prepare(`INSERT INTO assets (id, organization_id, store_system_id, asset_class_id, asset_tag, name, manufacturer, model, serial, location, condition, installed_at, replacement_cost_cents, criticality, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'good', ?, ?, ?, 'operational', ?)`).bind(id, ORGANIZATION_ID, data.storeSystemId, data.assetClass, data.assetTag, data.name, data.manufacturer, data.model, data.serial, data.location, data.installedAt || null, data.replacementCostCents, data.criticality, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "components") {
      const data = componentSchema.parse(body?.data); const id = newId("component");
      await db.prepare(`INSERT INTO components (id, organization_id, asset_id, component_type_id, name, part_number, serial, quantity, unit_cost_cents, critical_spare, installed_at, warranty_ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, ORGANIZATION_ID, data.assetId, data.type, data.name, data.partNumber, data.serial, Math.round(data.quantity), data.unitCostCents, data.criticalSpare ? 1 : 0, data.installedAt || null, data.warrantyEndsAt || null, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "pm-plans") {
      const data = pmPlanSchema.parse(body?.data); const id = newId("pm"); const occurrenceId = newId("pm-occurrence");
      const due = new Date(data.startAt); const windowStart = new Date(due.getTime() - 15 * 86_400_000).toISOString(); const windowEnd = new Date(due.getTime() + 15 * 86_400_000).toISOString();
      await db.batch([
        db.prepare(`INSERT INTO pm_plans (id, organization_id, name, description, service_category_id, scope_type, frequency, start_at, early_window_days, late_window_days, vendor_id, required_document, authorization_policy, escalation_rule, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 15, 15, ?, ?, 'standard', 'Maintenance Supervisor', 1)`).bind(id, ORGANIZATION_ID, data.name, data.description, data.categoryId, data.targetType, data.frequency, data.startAt, data.vendorId || null, data.requiredDocument),
        db.prepare(`INSERT INTO pm_plan_targets (organization_id, pm_plan_id, target_type, target_id) VALUES (?, ?, ?, ?)`).bind(ORGANIZATION_ID, id, data.targetType, data.targetId),
        db.prepare(`INSERT INTO pm_occurrences (id, organization_id, pm_plan_id, target_type, target_id, store_id, due_at, window_start, window_end, status, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 0)`).bind(occurrenceId, ORGANIZATION_ID, id, data.targetType, data.targetId, data.storeId, data.startAt, windowStart, windowEnd),
      ]);
      return NextResponse.json({ ok: true, entity: entity.data, id, occurrenceId, createdAt: now }, { status: 201 });
    }
    const data = workOrderSchema.parse(body?.data); const id = newId("wo"); const number = `CWO-${String(Date.now()).slice(-7)}`;
    const accountableParty = data.assignmentType === "unassigned" ? "Maintenance Dispatch" : data.assignedToName || (data.assignmentType === "vendor" ? "Vendor Dispatch" : "Maintenance Supervisor");
    const nextAction = data.status === "draft" ? "Review scope and issue work order" : data.assignmentType === "unassigned" ? "Assign maintenance owner" : "Begin assignment and document progress";
    const statusReason = data.status === "draft" ? "Work order draft saved" : "Work order issued";
    const checklist = ["Review scope, hazards and access", "Verify equipment identity and isolate energy", "Complete diagnosis and corrective work", "Test operation and clean work area", "Record outcome, parts, labor and photos"];
    const statements = [
      db.prepare(`INSERT INTO work_orders (id, organization_id, number, title, description, location, problem_code, requested_by, origin, store_id, service_category_id, store_system_id, asset_id, component_id, priority, work_type, status, accountable_party, assignment_type, assigned_to_id, assigned_to_name, next_action, due_at, target_completion_at, estimated_minutes, safety_risk, access_instructions, escalation, vendor_id, vendor_acceptance, nte_cents, cost_exposure_cents, created_at, tags_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'facilities', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Maintenance Supervisor', ?, ?, ?, ?, ?, '[]')`).bind(id, ORGANIZATION_ID, number, data.title, data.description, data.location, data.problemCode, data.requestedBy, data.storeId, data.categoryId, data.systemId || null, data.assetId || null, data.componentId || null, data.priority, data.workType, data.status, accountableParty, data.assignmentType, data.assignedToId || null, data.assignedToName || null, nextAction, data.dueAt || null, data.dueAt || null, Math.round(data.estimatedHours * 60), data.safetyRisk, data.accessInstructions, data.vendorId || null, data.vendorId ? "pending" : "not_issued", data.nteCents, data.nteCents, now),
      ...checklist.map((label, index) => db.prepare(`INSERT INTO work_order_checklist_items (id, organization_id, work_order_id, sequence, label, required, completed) VALUES (?, ?, ?, ?, ?, 1, 0)`).bind(newId("check"), ORGANIZATION_ID, id, index + 1, label)),
      db.prepare(`INSERT INTO work_order_status_events (id, organization_id, work_order_id, new_status, reason, actor_name, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(newId("status"), ORGANIZATION_ID, id, data.status, statusReason, data.requestedBy, now),
    ];
    await db.batch(statements);
    return NextResponse.json({ ok: true, entity: entity.data, id, number, createdAt: now }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: "Invalid fields", issues: error.issues }, { status: 400 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create record" }, { status: 500 });
  }
}
