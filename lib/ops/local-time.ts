import { cachedDateTimeFormat } from "./intl-format-cache";

export const DEFAULT_OPERATIONS_TIME_ZONE = "America/New_York";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const validTimeZones = new Map<string, boolean>();

export function operationsTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_OPERATIONS_TIME_ZONE;
  let valid = validTimeZones.get(timeZone);
  if (valid === undefined) {
    try {
      cachedDateTimeFormat("en-US", { timeZone }).format(new Date(0));
      valid = true;
    } catch {
      valid = false;
    }
    validTimeZones.set(timeZone, valid);
  }
  return valid ? timeZone : DEFAULT_OPERATIONS_TIME_ZONE;
}

export function formatOperationsDate(value: string, timeZone?: string | null): string {
  const calendarOnly = DATE_ONLY_PATTERN.test(value);
  const instant = new Date(calendarOnly ? `${value}T12:00:00.000Z` : value);
  if (!Number.isFinite(instant.getTime())) return "Not recorded";
  return cachedDateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: calendarOnly ? "UTC" : operationsTimeZone(timeZone),
  }).format(instant);
}

export function formatOperationsDateTime(
  value: string,
  timeZone?: string | null,
  options: { seconds?: boolean; year?: boolean } = {},
): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "Not recorded";
  return cachedDateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(options.year === false ? {} : { year: "numeric" as const }),
    hour: "numeric",
    minute: "2-digit",
    ...(options.seconds ? { second: "2-digit" as const } : {}),
    timeZone: operationsTimeZone(timeZone),
    timeZoneName: "short",
  }).format(instant);
}
