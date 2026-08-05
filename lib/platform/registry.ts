export const registryEntityPrefixes = {
  requests: "report",
  stores: "store",
  "cost-centers": "cost-center",
  assets: "asset",
  components: "component",
  "pm-plans": "pm",
  "work-orders": "wo",
} as const;

export type RegistryEntity = keyof typeof registryEntityPrefixes;

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isRuntimeCreatedId(value: unknown, prefix: string) {
  if (typeof value !== "string") return false;
  const escapedPrefix = escapeRegularExpression(prefix);
  return new RegExp(
    `^${escapedPrefix}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
    "i",
  ).test(value);
}

export function isRuntimeRegistryRecord(entity: RegistryEntity, record: unknown) {
  if (!record || typeof record !== "object" || !("id" in record)) return false;
  return isRuntimeCreatedId(record.id, registryEntityPrefixes[entity]);
}
