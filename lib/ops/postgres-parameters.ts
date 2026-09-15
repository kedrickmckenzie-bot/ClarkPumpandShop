const BOOLEAN_COLUMNS = new Map<string, ReadonlySet<string>>([
  ["ops_stores", new Set(["location_policy_enabled"])],
  ["ops_notification_rules", new Set(["email_enabled"])],
  ["ops_taxonomy_nodes", new Set(["active"])],
  ["ops_equipment_templates", new Set(["active"])],
  ["ops_vendors", new Set(["preferred"])],
  ["ops_vendor_qualifications", new Set(["pm_work", "emergency_response", "warranty_work", "after_hours"])],
  ["ops_vendor_compliance_documents", new Set(["blocking"])],
  ["ops_contract_versions", new Set(["preferred_provider", "exclusive_provider", "reactive_work_allowed", "emergency_work_allowed", "pm_work_allowed"])],
  ["ops_contract_scopes", new Set(["included"])],
  ["ops_vendor_capacity", new Set(["blackout"])],
  ["ops_pm_plans", new Set(["active"])],
  ["ops_checklist_responses", new Set(["passed"])],
  ["ops_service_run_work_orders", new Set(["planned", "addressed"])],
  ["ops_repair_items", new Set(["vendor_supplied"])],
  ["ops_warranty_amendments", new Set(["applies_to_repair_only"])],
  ["ops_warranty_cases", new Set(["diagnosis_required", "invoice_hold"])],
  ["ops_replacement_profiles", new Set(["active"])],
]);

function replaceQuestionMarkParameters(sql: string) {
  let result = "";
  let parameter = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (quote) {
      result += character;
      if (character === quote) {
        if (next === quote) {
          result += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      result += character;
    } else if (character === "?") {
      parameter += 1;
      result += `$${parameter}`;
    } else {
      result += character;
    }
  }

  return result;
}

function booleanInsertValues(sql: string, values: readonly unknown[]) {
  const match = sql.match(/^\s*INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+([a-z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
  if (!match) return values;

  const booleanColumns = BOOLEAN_COLUMNS.get(match[1].toLocaleLowerCase("en-US"));
  if (!booleanColumns) return values;

  const columns = match[2].split(",").map((column) => column.trim().replace(/^['"]|['"]$/g, "").toLocaleLowerCase("en-US"));
  return values.map((value, index) => {
    if (!booleanColumns.has(columns[index]) || typeof value === "boolean" || value == null) return value;
    if (value === 0 || value === "0") return false;
    if (value === 1 || value === "1") return true;
    return value;
  });
}

export function bindPostgresStatement(sql: string, params: readonly unknown[] = []) {
  return { text: replaceQuestionMarkParameters(sql), values: booleanInsertValues(sql, params) };
}