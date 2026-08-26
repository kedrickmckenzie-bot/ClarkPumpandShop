import type { OpsFixture } from "./types";

export type ImportEntity = "stores" | "vendors" | "equipment";
export interface ImportPreviewRow { rowNumber: number; status: "ready" | "warning" | "error"; values: Record<string, string>; errors: string[]; warnings: string[] }
export interface ImportPreview { entity: ImportEntity; headers: string[]; rows: ImportPreviewRow[]; summary: { total: number; ready: number; warning: number; error: number }; writesPerformed: false }

const templates: Record<ImportEntity, string[]> = {
  stores: ["store_number", "name", "address_1", "address_2", "city", "state", "postal_code", "region_code", "aliases"],
  vendors: ["vendor_code", "name", "dispatch_email", "dispatch_phone", "specialties", "coverage"],
  equipment: ["store_number", "equipment_type", "quantity", "name_prefix", "location_notes"],
};
export function importTemplate(entity: ImportEntity) { return `${templates[entity].join(",")}\r\n`; }

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) { if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = false; else cell += char; continue; }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell.trim()); cell = ""; }
    else if (char === "\n") { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalized(value: string) { return value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim(); }
function emailValid(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function previewImport(entity: ImportEntity, text: string, fixture: OpsFixture, organizationId: string): ImportPreview {
  if (text.length > 2_000_000) throw new Error("CSV files must be 2 MB or smaller.");
  const parsed = parseCsv(text);
  if (!parsed.length) throw new Error("The CSV file is empty.");
  const headers = parsed[0].map((header) => header.trim().toLocaleLowerCase("en-US"));
  const missing = templates[entity].filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required template columns: ${missing.join(", ")}. Download the current template and try again.`);
  if (parsed.length > 5_001) throw new Error("A preview supports up to 5,000 data rows.");
  const stores = fixture.stores.filter((item) => item.organizationId === organizationId);
  const vendors = fixture.vendors.filter((item) => item.organizationId === organizationId);
  const regions = fixture.regions.filter((item) => item.organizationId === organizationId);
  const equipmentTypes = fixture.equipmentTemplates.filter((item) => item.organizationId === organizationId && item.active);
  const seen = new Set<string>();
  const rows = parsed.slice(1).map<ImportPreviewRow>((cells, offset) => {
    const values = Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
    const errors: string[] = []; const warnings: string[] = [];
    if (cells.length > headers.length) errors.push("Row contains more values than the template header.");
    if (entity === "stores") {
      for (const key of ["store_number", "name", "address_1", "city", "state", "postal_code", "region_code"]) if (!values[key]) errors.push(`${key} is required.`);
      const key = normalized(values.store_number); if (seen.has(key)) errors.push("Store number is duplicated in this file."); seen.add(key);
      if (stores.some((store) => normalized(store.storeNumber) === key)) errors.push("Store number already exists.");
      if (values.region_code && !regions.some((region) => normalized(region.code) === normalized(values.region_code))) errors.push("Region code does not match a configured region.");
      if (stores.some((store) => normalized(`${store.address1} ${store.city} ${store.state} ${store.postalCode}`) === normalized(`${values.address_1} ${values.city} ${values.state} ${values.postal_code}`))) warnings.push("Address resembles an existing store; review before applying.");
    } else if (entity === "vendors") {
      for (const key of ["vendor_code", "name", "dispatch_email", "specialties", "coverage"]) if (!values[key]) errors.push(`${key} is required.`);
      const key = normalized(values.vendor_code); if (seen.has(key)) errors.push("Vendor code is duplicated in this file."); seen.add(key);
      if (vendors.some((vendor) => normalized(vendor.code) === key || normalized(vendor.name) === normalized(values.name))) errors.push("Vendor code or name already exists.");
      if (values.dispatch_email && !emailValid(values.dispatch_email)) errors.push("Dispatch email is invalid.");
      if (values.coverage && values.coverage !== "all" && !values.coverage.split(";").every((code) => regions.some((region) => normalized(region.code) === normalized(code)))) errors.push("Coverage must be 'all' or semicolon-separated configured region codes.");
    } else {
      for (const key of ["store_number", "equipment_type", "quantity"]) if (!values[key]) errors.push(`${key} is required.`);
      if (values.store_number && !stores.some((store) => normalized(store.storeNumber) === normalized(values.store_number))) errors.push("Store number does not exist.");
      if (values.equipment_type && !equipmentTypes.some((template) => normalized(template.id) === normalized(values.equipment_type) || normalized(template.name) === normalized(values.equipment_type))) errors.push("Equipment type does not match a configured company template.");
      const quantity = Number(values.quantity); if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.push("Quantity must be a whole number from 1 to 100.");
      if (quantity > 1 && !values.name_prefix) warnings.push("Name prefix is blank; generated names will use the equipment type.");
    }
    return { rowNumber: offset + 2, status: errors.length ? "error" : warnings.length ? "warning" : "ready", values, errors, warnings };
  });
  return { entity, headers, rows, summary: { total: rows.length, ready: rows.filter((row) => row.status === "ready").length, warning: rows.filter((row) => row.status === "warning").length, error: rows.filter((row) => row.status === "error").length }, writesPerformed: false };
}
