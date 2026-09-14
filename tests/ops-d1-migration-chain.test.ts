import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildNorthlinePresentationFixture } from "@/lib/ops/fixtures";
import { buildOpsSeedStatements } from "@/lib/ops/seed";

function statementsIn(sql: string) {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe("D1 migration chain", () => {
  it("applies every migration in a foreign-key-enforced per-file transaction", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    const directory = resolve(process.cwd(), "drizzle");
    const migrations = readdirSync(directory)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    try {
      expect(migrations).toHaveLength(51);
      for (const migration of migrations) {
        database.exec("BEGIN");
        try {
          for (const statement of statementsIn(readFileSync(resolve(directory, migration), "utf8"))) {
            database.exec(statement);
          }
          database.exec("COMMIT");
        } catch (error) {
          database.exec("ROLLBACK");
          throw new Error(`D1 migration ${migration} failed`, { cause: error });
        }
      }

      const tables = database.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name IN (
            'ops_request_impact_assessments',
            'ops_workflow_tasks',
            'ops_site_visit_work_orders',
            'ops_work_order_verifications',
            'ops_warranty_cases',
            'ops_applied_warranties',
            'ops_invoices',
            'ops_value_events'
            ,'ops_component_lifecycle_events'
            ,'ops_notification_rules'
          )
        ORDER BY name
      `).all();
      expect(tables).toHaveLength(10);
      expect(database.prepare("PRAGMA table_info(ops_requests)").all())
        .toEqual(expect.arrayContaining([expect.objectContaining({ name: "version", notnull: 1, dflt_value: "0" })]));
      expect(database.prepare("PRAGMA table_info(ops_invoices)").all())
        .toEqual(expect.arrayContaining([expect.objectContaining({ name: "submitted_by_membership_id" })]));
      expect(database.prepare("PRAGMA table_info(ops_warranty_rules)").all())
        .toEqual(expect.arrayContaining([expect.objectContaining({ name: "quote_id" }),expect.objectContaining({ name: "authorization_id" })]));
      expect(database.prepare("PRAGMA table_info(ops_assets)").all())
        .toEqual(expect.arrayContaining([
          expect.objectContaining({ name: "replacement_planning_excluded_at" }),
          expect.objectContaining({ name: "replacement_planning_exclusion_reason" }),
        ]));
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

      database.exec("BEGIN");
      try {
        for (const statement of buildOpsSeedStatements(buildNorthlinePresentationFixture())) {
          const params = statement.params.map((value): SQLInputValue => (
            typeof value === "boolean" ? Number(value) : value as SQLInputValue
          ));
          database.prepare(statement.sql).run(...params);
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw new Error("D1 deterministic seed failed after the full migration chain", { cause: error });
      }
      expect(database.prepare("SELECT COUNT(*) AS count FROM ops_stores WHERE organization_id = ?").get("org-northline-demo"))
        .toMatchObject({ count: 15 });
      expect(database.prepare("SELECT version FROM ops_requests WHERE id = ? AND organization_id = ?").get("request-current-104-beer-cave-door", "org-northline-demo"))
        .toMatchObject({ version: 0 });
      expect(database.prepare("SELECT replacement_planning_exclusion_reason AS reason FROM ops_assets WHERE id = ? AND organization_id = ?").get("asset-101-rapid-cook-oven", "org-northline-demo"))
        .toMatchObject({ reason: "Landlord-owned foodservice equipment is outside Clark Pump and Shop's capital plan." });
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  it("upgrades populated work orders, visits and verifications without losing their references", () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    const directory = resolve(process.cwd(), "drizzle");
    const migrations = readdirSync(directory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
    const apply = (migration: string) => {
      database.exec("BEGIN");
      try { for (const statement of statementsIn(readFileSync(resolve(directory, migration), "utf8"))) database.exec(statement); database.exec("COMMIT"); }
      catch (error) { database.exec("ROLLBACK"); throw new Error(`Populated D1 upgrade failed at ${migration}`, { cause: error }); }
    };
    try {
      migrations.filter((name) => Number(name.slice(0, 4)) <= 14).forEach(apply);
      database.prepare("INSERT INTO ops_organizations (id,name,slug,time_zone,work_order_prefix,created_at) VALUES (?,?,?,?,?,?)").run("org-upgrade","Upgrade Tenant","upgrade","America/New_York","UP","2026-01-01T00:00:00.000Z");
      database.prepare("INSERT INTO ops_stores (id,organization_id,store_number,name,address_1,city,state,postal_code,search_text,time_zone,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run("store-upgrade","org-upgrade","001","Upgrade Store","1 Main St","Detroit","MI","48201","001 upgrade store","America/New_York","active","2026-01-01T00:00:00.000Z");
      database.prepare("INSERT INTO ops_vendors (id,organization_id,code,name,dispatch_email,status,preferred,search_text,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("vendor-upgrade","org-upgrade","vendor","Upgrade Vendor","upgrade@example.test","active",1,"upgrade vendor","2026-01-01T00:00:00.000Z");
      database.prepare("INSERT INTO ops_work_orders (id,organization_id,number,store_id,problem,priority,status,version,accountable_party,next_action,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("work-upgrade","org-upgrade","UP-2026-0001","store-upgrade","Populated upgrade proof","routine","approved",0,"Facilities","Request estimate","2026-01-01T00:00:00.000Z");
      database.prepare("INSERT INTO ops_work_order_estimate_requests (id,organization_id,work_order_id,vendor_id,kind,decision_kind,requested_scope,status,channel,requested_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("estimate-upgrade","org-upgrade","work-upgrade","vendor-upgrade","estimate_only","service_bid","Inspect and quote","requested","email","2026-01-01T01:00:00.000Z");
      migrations.filter((name) => Number(name.slice(0, 4)) >= 15 && Number(name.slice(0, 4)) <= 38).forEach(apply);
      database.exec(`
        INSERT INTO ops_memberships (id,organization_id,user_id,role,status,created_at)
          VALUES ('member-upgrade','org-upgrade','user-upgrade','facilities_admin','active','2026-01-01T00:00:00.000Z');
        INSERT INTO ops_visit_sessions (id,organization_id,store_id,provider_kind,vendor_id,technician_name,provider_name,purpose,status,started_channel,checked_in_at)
          VALUES ('visit-upgrade','org-upgrade','store-upgrade','outside_vendor','vendor-upgrade','Upgrade technician','Upgrade Vendor','Repair','checked_out','qr','2026-01-02T00:00:00.000Z');
        INSERT INTO ops_site_visit_work_orders (id,organization_id,visit_id,work_order_id,ordinal,linked_by_actor_type,linked_by_actor_name,linked_at,outcome,outcome_recorded_by_actor_type,outcome_recorded_by_actor_name,outcome_recorded_at)
          VALUES ('visit-work-upgrade','org-upgrade','visit-upgrade','work-upgrade',1,'technician','Upgrade technician','2026-01-02T00:00:00.000Z','completed','technician','Upgrade technician','2026-01-02T01:00:00.000Z');
        INSERT INTO ops_work_order_verifications (id,organization_id,work_order_id,site_visit_work_order_id,outcome,outcome_recorded_at,cycle,decision,decided_by_membership_id,decided_by_name,decided_at)
          VALUES ('verification-upgrade','org-upgrade','work-upgrade','visit-work-upgrade','completed','2026-01-02T01:00:00.000Z',1,'verified','member-upgrade','Upgrade manager','2026-01-02T02:00:00.000Z');
      `);
      const verificationBefore = database.prepare("SELECT * FROM ops_work_order_verifications WHERE id = ?").get("verification-upgrade");
      const visitWorkBefore = database.prepare("SELECT * FROM ops_site_visit_work_orders WHERE id = ?").get("visit-work-upgrade");
      migrations.filter((name) => Number(name.slice(0, 4)) >= 39).forEach((migration) => {
        apply(migration);
        expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
        expect(database.prepare("PRAGMA foreign_keys").get()).toMatchObject({ foreign_keys: 1 });
      });
      expect(database.prepare("SELECT problem, resolved_at FROM ops_work_orders WHERE id = ?").get("work-upgrade")).toMatchObject({ problem: "Populated upgrade proof", resolved_at: null });
      expect(database.prepare("SELECT work_order_id FROM ops_work_order_estimate_requests WHERE id = ?").get("estimate-upgrade")).toMatchObject({ work_order_id: "work-upgrade" });
      expect(database.prepare("SELECT site_visit_work_order_id,decision FROM ops_work_order_verifications WHERE id = ?").get("verification-upgrade"))
        .toMatchObject({ site_visit_work_order_id: "visit-work-upgrade", decision: "verified" });
      expect(database.prepare("SELECT * FROM ops_work_order_verifications WHERE id = ?").get("verification-upgrade")).toMatchObject(verificationBefore!);
      expect(database.prepare("SELECT * FROM ops_site_visit_work_orders WHERE id = ?").get("visit-work-upgrade")).toMatchObject(visitWorkBefore!);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE name LIKE '__migration_%'").all()).toEqual([]);
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { database.close(); }
  });
});
