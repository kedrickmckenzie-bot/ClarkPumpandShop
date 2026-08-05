import { NextResponse } from "next/server";
import { z } from "zod";
import { platformData } from "@/lib/platform/data";
import {
  isRuntimeCreatedId,
  isRuntimeRegistryRecord,
  registryEntityPrefixes,
  showcaseIdPrefix,
  type RegistryEntity,
} from "@/lib/platform/registry";
import { getD1, newId, ORGANIZATION_ID } from "@/lib/server/d1";

const entitySchema = z.enum(["requests", "stores", "cost-centers", "assets", "components", "pm-plans", "work-orders"]);
const requestSchema = z.object({ storeId: z.string().min(1), area: z.string().trim().min(2).max(120), description: z.string().trim().min(5).max(4000), urgency: z.enum(["critical", "high", "routine", "low"]), reporterName: z.string().trim().min(2).max(100).optional().default("Store team member") });
const storeSchema = z.object({ code: z.string().trim().min(1).max(12), name: z.string().trim().min(2).max(120), regionId: z.string().optional(), address1: z.string().trim().min(3).max(160), city: z.string().trim().min(2).max(80), state: z.string().trim().length(2), postalCode: z.string().trim().min(5).max(10), phone: z.string().max(30).optional().default(""), managerName: z.string().max(100).optional().default(""), district: z.string().max(60).optional().default(""), squareFeet: z.coerce.number().int().min(0).max(500000).optional().default(0) });
const costCenterSchema = z.object({ storeId: z.string().min(1), categoryId: z.string().min(1), code: z.string().trim().min(1).max(30), name: z.string().trim().min(2).max(120), type: z.string().trim().min(2).max(100), description: z.string().max(1000).optional().default(""), location: z.string().max(120).optional().default(""), glCode: z.string().max(30).optional().default(""), annualBudgetCents: z.coerce.number().int().min(0).optional().default(0), ownerName: z.string().max(100).optional().default(""), maintenanceStrategy: z.enum(["run_to_failure", "preventive", "condition_based", "statutory"]).default("preventive") });
const assetSchema = z.object({ storeSystemId: z.string().min(1), assetClass: z.string().trim().min(2).max(100), assetTag: z.string().trim().min(1).max(40), name: z.string().trim().min(2).max(120), manufacturer: z.string().max(80).optional().default(""), model: z.string().max(80).optional().default(""), serial: z.string().max(100).optional().default(""), location: z.string().max(120).optional().default(""), purchaseCostCents: z.coerce.number().int().min(0).optional().default(0), purchaseDate: z.string().optional().default(""), supplierName: z.string().max(120).optional().default(""), supplierContact: z.string().max(200).optional().default(""), installedAt: z.string().optional().default(""), maintenanceStrategy: z.enum(["run_to_failure", "preventive", "condition_based", "statutory"]).optional().default("preventive"), meterType: z.string().max(80).optional().default(""), meterReading: z.coerce.number().int().min(0).optional().default(0), expectedLifeYears: z.coerce.number().int().min(0).max(100).optional().default(0), replacementCostCents: z.coerce.number().int().min(0).optional().default(0), warrantyProvider: z.string().max(120).optional().default(""), warrantyReference: z.string().max(120).optional().default(""), warrantySummary: z.string().max(1000).optional().default(""), warrantyEndsAt: z.string().optional().default(""), criticality: z.enum(["critical", "high", "standard"]).default("standard") });
const componentSchema = z.object({ assetId: z.string().min(1), type: z.string().trim().min(2).max(100), name: z.string().trim().min(2).max(120), partNumber: z.string().max(100).optional().default(""), serial: z.string().max(100).optional().default(""), quantity: z.coerce.number().positive().max(10000).default(1), unitCostCents: z.coerce.number().int().min(0).optional().default(0), criticalSpare: z.boolean().optional().default(false), installedAt: z.string().optional().default(""), warrantyEndsAt: z.string().optional().default("") });
const pmPlanSchema = z.object({ name: z.string().trim().min(3).max(160), description: z.string().max(1000).optional().default(""), categoryId: z.string().min(1), targetType: z.enum(["system", "asset"]), targetId: z.string().min(1), storeId: z.string().min(1), frequency: z.enum(["monthly", "quarterly", "semiannual", "annual"]), startAt: z.string().min(1), vendorId: z.string().optional(), requiredDocument: z.string().max(120).optional().default("Completed checklist and service evidence") });
const workOrderSchema = z.object({ reportId: z.string().optional(), storeId: z.string().min(1), categoryId: z.string().min(1), systemId: z.string().optional(), assetId: z.string().optional(), componentId: z.string().optional(), title: z.string().trim().min(3).max(160), description: z.string().trim().min(5).max(4000), location: z.string().max(160).optional().default(""), problemCode: z.string().max(80).optional().default(""), requestedBy: z.string().trim().min(2).max(100), priority: z.enum(["critical", "high", "routine", "low"]), workType: z.enum(["reactive", "preventive", "inspection", "emergency", "warranty", "capital", "internal"]), status: z.enum(["draft", "approved"]).optional().default("approved"), assignmentType: z.enum(["internal", "vendor", "blended", "unassigned"]), assignedToId: z.string().optional(), assignedToName: z.string().optional(), vendorId: z.string().optional(), dueAt: z.string().optional(), estimatedHours: z.coerce.number().min(0).max(999).optional().default(0), safetyRisk: z.enum(["none", "low", "moderate", "high"]).default("low"), accessInstructions: z.string().max(2000).optional().default(""), nteCents: z.coerce.number().int().min(0).optional().default(0) });

class ShowcaseReferenceError extends Error {}

const seededRegistryIds: Record<RegistryEntity, Set<string>> = {
  requests: new Set(platformData.reports.map((record) => record.id)),
  stores: new Set(platformData.stores.map((record) => record.id)),
  "cost-centers": new Set(platformData.systems.map((record) => record.id)),
  assets: new Set(platformData.assets.map((record) => record.id)),
  components: new Set(platformData.components.map((record) => record.id)),
  "pm-plans": new Set(platformData.pmPlans.map((record) => record.id)),
  "work-orders": new Set(platformData.workOrders.map((record) => record.id)),
};

const categoryIds = new Set(platformData.categories.map((record) => record.id));
const vendorIds = new Set(platformData.vendors.map((record) => record.id));

function assertShowcaseReference(entity: RegistryEntity, value: string | undefined, label: string) {
  if (!value) return;
  if (seededRegistryIds[entity].has(value) || isRuntimeCreatedId(value, registryEntityPrefixes[entity])) return;
  throw new ShowcaseReferenceError(`${label} is not available in this showcase`);
}

function assertCategory(value: string) {
  if (!categoryIds.has(value)) throw new ShowcaseReferenceError("Service category is not available in this showcase");
}

function assertVendor(value: string | undefined) {
  if (value && !vendorIds.has(value)) throw new ShowcaseReferenceError("Provider is not available in this showcase");
}

const selectSql: Record<z.infer<typeof entitySchema>, string> = {
  requests: `SELECT id, reference, store_id AS storeId, store_area_id AS area, reporter_name AS reporterName, original_description AS originalDescription, urgency, status, submitted_at AS submittedAt FROM employee_reports WHERE organization_id = ? ORDER BY submitted_at DESC`,
  stores: `SELECT id, region_id AS regionId, code, name, address_1 AS address1, city, state, postal_code AS postalCode, phone, manager_name AS managerName, district, status, square_feet AS squareFeet, created_at AS createdAt FROM stores WHERE organization_id = ? ORDER BY created_at DESC`,
  "cost-centers": `SELECT id, store_id AS storeId, service_category_id AS categoryId, code, name, description, location, gl_code AS glCode, annual_budget_cents AS annualBudgetCents, owner_name AS ownerName, maintenance_strategy AS maintenanceStrategy, state, created_at AS createdAt FROM store_systems WHERE organization_id = ? ORDER BY created_at DESC`,
  assets: `SELECT id, store_system_id AS storeSystemId, asset_class_id AS assetClass, asset_tag AS assetTag, name, manufacturer, model, serial, location, condition, purchase_cost_cents AS purchaseCostCents, purchase_date AS purchaseDate, supplier_name AS supplierName, supplier_contact AS supplierContact, installed_at AS installedAt, last_service_at AS lastServiceAt, maintenance_strategy AS maintenanceStrategy, meter_type AS meterType, meter_reading AS meterReading, expected_life_years AS expectedLifeYears, replacement_cost_cents AS replacementCostCents, warranty_provider AS warrantyProvider, warranty_reference AS warrantyReference, warranty_summary AS warrantySummary, warranty_ends_at AS warrantyEndsAt, criticality, state, created_at AS createdAt FROM assets WHERE organization_id = ? ORDER BY created_at DESC`,
  components: `SELECT id, asset_id AS assetId, component_type_id AS type, name, part_number AS partNumber, serial, quantity, unit_cost_cents AS unitCostCents, critical_spare AS criticalSpare, installed_at AS installedAt, warranty_ends_at AS warrantyEndsAt, created_at AS createdAt FROM components WHERE organization_id = ? ORDER BY created_at DESC`,
  "pm-plans": `SELECT p.id, p.name, p.description, p.service_category_id AS categoryId, p.scope_type AS scopeType, p.frequency, p.start_at AS startAt, p.early_window_days AS earlyWindowDays, p.late_window_days AS lateWindowDays, p.vendor_id AS vendorId, p.required_document AS requiredDocument, p.active, t.target_type AS targetType, t.target_id AS targetId, COALESCE((SELECT s.name FROM store_systems s WHERE s.organization_id = p.organization_id AND t.target_type = 'system' AND s.id = t.target_id), (SELECT a.name FROM assets a WHERE a.organization_id = p.organization_id AND t.target_type = 'asset' AND a.id = t.target_id), 'Configured maintenance target') AS targetLabel, o.id AS occurrenceId, o.store_id AS occurrenceStoreId, o.work_order_id AS occurrenceWorkOrderId, o.due_at AS occurrenceDueAt, o.window_start AS occurrenceWindowStart, o.window_end AS occurrenceWindowEnd, o.status AS occurrenceStatus, o.completed_at AS occurrenceCompletedAt, o.verified AS occurrenceVerified, o.waiver_reason AS occurrenceWaiverReason FROM pm_plans p LEFT JOIN pm_plan_targets t ON t.organization_id = p.organization_id AND t.pm_plan_id = p.id LEFT JOIN pm_occurrences o ON o.organization_id = p.organization_id AND o.pm_plan_id = p.id AND o.target_type = t.target_type AND o.target_id = t.target_id WHERE p.organization_id = ? ORDER BY p.start_at DESC, o.due_at DESC`,
  "work-orders": `SELECT w.id, w.number, w.title, w.description, w.location, w.requested_by AS requestedBy, w.origin, w.store_id AS storeId, w.service_category_id AS categoryId, w.store_system_id AS systemId, w.asset_id AS assetId, w.component_id AS componentId, w.priority, w.work_type AS workType, w.status, w.accountable_party AS accountableParty, w.assignment_type AS assignmentType, w.assigned_to_id AS assignedToId, w.assigned_to_name AS assignedToName, w.next_action AS nextAction, w.due_at AS dueAt, w.safety_risk AS safetyRisk, w.access_instructions AS accessInstructions, w.vendor_id AS vendorId, w.vendor_acceptance AS vendorAcceptance, w.estimated_minutes AS estimatedMinutes, w.nte_cents AS nteCents, w.cost_exposure_cents AS costExposureCents, w.created_at AS createdAt, w.closed_at AS closedAt, (SELECT group_concat(link.report_id, ',') FROM work_order_reports link WHERE link.organization_id = w.organization_id AND link.work_order_id = w.id) AS reportIds FROM work_orders w WHERE w.organization_id = ? ORDER BY w.created_at DESC`,
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = entitySchema.safeParse(url.searchParams.get("entity"));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Unknown registry entity" }, { status: 400 });
  try {
    const result = await getD1().prepare(selectSql[parsed.data]).bind(ORGANIZATION_ID).all();
    // The current showcase is code-backed and intentionally concise. D1 may still
    // contain a larger legacy seed, so this endpoint exposes only records a user
    // created through the live demo. Seeded showcase records come from platformData.
    const records = result.results.filter((record) => isRuntimeRegistryRecord(parsed.data, record));
    return NextResponse.json({ ok: true, records });
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
    if (entity.data === "requests") {
      const data = requestSchema.parse(body?.data); assertShowcaseReference("stores", data.storeId, "Store"); const id = newId(showcaseIdPrefix("report")); const reference = `RPT-${String(Date.now()).slice(-7)}`;
      await db.prepare(`INSERT INTO employee_reports (id, organization_id, reference, store_id, store_area_id, reporter_name, original_description, urgency, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`).bind(id, ORGANIZATION_ID, reference, data.storeId, data.area, data.reporterName, data.description, data.urgency, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, reference, createdAt: now }, { status: 201 });
    }
    if (entity.data === "stores") {
      const data = storeSchema.parse(body?.data); const id = newId(showcaseIdPrefix("store"));
      await db.prepare(`INSERT INTO stores (id, organization_id, region_id, code, name, address_1, city, state, postal_code, phone, manager_name, district, status, square_feet, geofence_radius_m, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 200, 1, ?)`).bind(id, ORGANIZATION_ID, data.regionId || null, data.code, data.name, data.address1, data.city, data.state.toUpperCase(), data.postalCode, data.phone, data.managerName, data.district, data.squareFeet, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "cost-centers") {
      const data = costCenterSchema.parse(body?.data); assertShowcaseReference("stores", data.storeId, "Store"); assertCategory(data.categoryId); const id = newId(showcaseIdPrefix("cost-center"));
      await db.prepare(`INSERT INTO store_systems (id, organization_id, store_id, service_category_id, code, name, description, location, gl_code, annual_budget_cents, owner_name, maintenance_strategy, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', ?)`).bind(id, ORGANIZATION_ID, data.storeId, data.categoryId, data.code, data.name, data.description, data.location, data.glCode, data.annualBudgetCents, data.ownerName, data.maintenanceStrategy, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "assets") {
      const data = assetSchema.parse(body?.data); assertShowcaseReference("cost-centers", data.storeSystemId, "Equipment group");
      if (isRuntimeCreatedId(data.storeSystemId, registryEntityPrefixes["cost-centers"])) {
        const parent = await db.prepare(`SELECT id FROM store_systems WHERE organization_id = ? AND id = ? LIMIT 1`).bind(ORGANIZATION_ID, data.storeSystemId).all();
        if (parent.results.length !== 1) throw new ShowcaseReferenceError("Equipment group is not available in this showcase");
      }
      const id = newId(showcaseIdPrefix("asset"));
      await db.prepare(`INSERT INTO assets (id, organization_id, store_system_id, asset_class_id, asset_tag, name, manufacturer, model, serial, location, condition, purchase_cost_cents, purchase_date, supplier_name, supplier_contact, installed_at, maintenance_strategy, meter_type, meter_reading, expected_life_years, replacement_cost_cents, warranty_provider, warranty_reference, warranty_summary, warranty_ends_at, criticality, state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'good', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'operational', ?)`).bind(id, ORGANIZATION_ID, data.storeSystemId, data.assetClass, data.assetTag, data.name, data.manufacturer, data.model, data.serial, data.location, data.purchaseCostCents, data.purchaseDate || null, data.supplierName, data.supplierContact, data.installedAt || null, data.maintenanceStrategy, data.meterType, data.meterReading, data.expectedLifeYears, data.replacementCostCents, data.warrantyProvider, data.warrantyReference, data.warrantySummary, data.warrantyEndsAt || null, data.criticality, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "components") {
      const data = componentSchema.parse(body?.data); assertShowcaseReference("assets", data.assetId, "Asset");
      if (isRuntimeCreatedId(data.assetId, registryEntityPrefixes.assets)) {
        const parent = await db.prepare(`SELECT id FROM assets WHERE organization_id = ? AND id = ? LIMIT 1`).bind(ORGANIZATION_ID, data.assetId).all();
        if (parent.results.length !== 1) throw new ShowcaseReferenceError("Asset is not available in this showcase");
      }
      const id = newId(showcaseIdPrefix("component"));
      await db.prepare(`INSERT INTO components (id, organization_id, asset_id, component_type_id, name, part_number, serial, quantity, unit_cost_cents, critical_spare, installed_at, warranty_ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, ORGANIZATION_ID, data.assetId, data.type, data.name, data.partNumber, data.serial, Math.round(data.quantity), data.unitCostCents, data.criticalSpare ? 1 : 0, data.installedAt || null, data.warrantyEndsAt || null, now).run();
      return NextResponse.json({ ok: true, entity: entity.data, id, createdAt: now }, { status: 201 });
    }
    if (entity.data === "pm-plans") {
      const data = pmPlanSchema.parse(body?.data);
      assertShowcaseReference("stores", data.storeId, "Store");
      assertCategory(data.categoryId);
      assertShowcaseReference(data.targetType === "asset" ? "assets" : "cost-centers", data.targetId, "Maintenance target");
      assertVendor(data.vendorId);
      const id = newId(showcaseIdPrefix("pm")); const occurrenceId = newId(showcaseIdPrefix("pm-occurrence"));
      const due = new Date(data.startAt); const windowStart = new Date(due.getTime() - 15 * 86_400_000).toISOString(); const windowEnd = new Date(due.getTime() + 15 * 86_400_000).toISOString();
      await db.batch([
        db.prepare(`INSERT INTO pm_plans (id, organization_id, name, description, service_category_id, scope_type, frequency, start_at, early_window_days, late_window_days, vendor_id, required_document, authorization_policy, escalation_rule, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 15, 15, ?, ?, 'standard', 'Maintenance Supervisor', 1)`).bind(id, ORGANIZATION_ID, data.name, data.description, data.categoryId, data.targetType, data.frequency, data.startAt, data.vendorId || null, data.requiredDocument),
        db.prepare(`INSERT INTO pm_plan_targets (organization_id, pm_plan_id, target_type, target_id) VALUES (?, ?, ?, ?)`).bind(ORGANIZATION_ID, id, data.targetType, data.targetId),
        db.prepare(`INSERT INTO pm_occurrences (id, organization_id, pm_plan_id, target_type, target_id, store_id, due_at, window_start, window_end, status, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', 0)`).bind(occurrenceId, ORGANIZATION_ID, id, data.targetType, data.targetId, data.storeId, data.startAt, windowStart, windowEnd),
      ]);
      return NextResponse.json({ ok: true, entity: entity.data, id, occurrenceId, createdAt: now }, { status: 201 });
    }
    const data = workOrderSchema.parse(body?.data);
    assertShowcaseReference("stores", data.storeId, "Store");
    assertCategory(data.categoryId);
    assertShowcaseReference("cost-centers", data.systemId, "Equipment group");
    assertShowcaseReference("assets", data.assetId, "Asset");
    assertShowcaseReference("components", data.componentId, "Component");
    assertShowcaseReference("requests", data.reportId, "Source report");
    assertVendor(data.vendorId);
    const id = newId(showcaseIdPrefix("wo")); const number = `CWO-${String(Date.now()).slice(-7)}`;
    const accountableParty = data.assignmentType === "unassigned" ? "Maintenance Dispatch" : data.assignedToName || (data.assignmentType === "vendor" ? "Vendor Dispatch" : "Maintenance Supervisor");
    const nextAction = data.status === "draft" ? "Review scope and issue work order" : data.assignmentType === "unassigned" ? "Assign maintenance owner" : "Begin assignment and document progress";
    const statusReason = data.status === "draft" ? "Work order draft saved" : "Work order issued";
    const checklist = ["Review scope, hazards and access", "Verify equipment identity and isolate energy", "Complete diagnosis and corrective work", "Test operation and clean work area", "Record outcome, parts, labor and photos"];
    const statements = [
      db.prepare(`INSERT INTO work_orders (id, organization_id, number, title, description, location, problem_code, requested_by, origin, store_id, service_category_id, store_system_id, asset_id, component_id, priority, work_type, status, accountable_party, assignment_type, assigned_to_id, assigned_to_name, next_action, due_at, target_completion_at, estimated_minutes, safety_risk, access_instructions, escalation, vendor_id, vendor_acceptance, nte_cents, cost_exposure_cents, created_at, tags_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Maintenance Supervisor', ?, ?, ?, ?, ?, '[]')`).bind(id, ORGANIZATION_ID, number, data.title, data.description, data.location, data.problemCode, data.requestedBy, data.reportId ? "employee_report" : "facilities", data.storeId, data.categoryId, data.systemId || null, data.assetId || null, data.componentId || null, data.priority, data.workType, data.status, accountableParty, data.assignmentType, data.assignedToId || null, data.assignedToName || null, nextAction, data.dueAt || null, data.dueAt || null, Math.round(data.estimatedHours * 60), data.safetyRisk, data.accessInstructions, data.vendorId || null, data.vendorId ? "pending" : "not_issued", data.nteCents, data.nteCents, now),
      ...checklist.map((label, index) => db.prepare(`INSERT INTO work_order_checklist_items (id, organization_id, work_order_id, sequence, label, required, completed) VALUES (?, ?, ?, ?, ?, 1, 0)`).bind(newId("check"), ORGANIZATION_ID, id, index + 1, label)),
      db.prepare(`INSERT INTO work_order_status_events (id, organization_id, work_order_id, new_status, reason, actor_name, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(newId("status"), ORGANIZATION_ID, id, data.status, statusReason, data.requestedBy, now),
      ...(data.reportId ? [
        db.prepare(`INSERT INTO work_order_reports (organization_id, work_order_id, report_id) VALUES (?, ?, ?)`).bind(ORGANIZATION_ID, id, data.reportId),
        db.prepare(`UPDATE employee_reports SET status = 'reviewed' WHERE organization_id = ? AND id = ?`).bind(ORGANIZATION_ID, data.reportId),
      ] : []),
    ];
    await db.batch(statements);
    return NextResponse.json({ ok: true, entity: entity.data, id, number, createdAt: now }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, error: "Invalid fields", issues: error.issues }, { status: 400 });
    if (error instanceof ShowcaseReferenceError) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create record" }, { status: 500 });
  }
}
