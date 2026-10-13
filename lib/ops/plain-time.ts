import { cachedDateTimeFormat } from "./intl-format-cache";
import { operationsTimeZone } from "./local-time";

/**
 * Short, human dates for scanning lists: "today 1:15 PM", "tomorrow 2 PM", "Thu 2 PM", "Oct 20, 2 PM", "Oct 20, 2027".
 * Calendar days are counted in the store's time zone, so "today" means the store's today.
 */

const DAY_MS = 86_400_000;

function civil(instant: Date, zone: string) {
  return cachedDateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function dayNumber(isoDate: string) {
  return Math.round(Date.parse(`${isoDate}T12:00:00Z`) / DAY_MS);
}

/** "9 AM", "1:15 PM", "noon" — the clock time in the store's zone. */
export function plainClock(value: string | Date, timeZone?: string | null) {
  const instant = value instanceof Date ? value : new Date(value);
  const text = cachedDateTimeFormat("en-US", { timeZone: operationsTimeZone(timeZone), hour: "numeric", minute: "2-digit" }).format(instant);
  return text.replace(":00", "").replace(/^12 PM$/u, "noon");
}

/** Calendar days from `now` to `value` in the store's zone (negative = in the past). */
export function calendarDaysFrom(value: string, now: string, timeZone?: string | null) {
  const zone = operationsTimeZone(timeZone);
  return dayNumber(civil(new Date(value), zone)) - dayNumber(civil(new Date(now), zone));
}

/** "today", "tomorrow", "yesterday", "Thu", "Oct 20" or "Oct 20, 2027" — no time. */
export function plainDay(value: string, now: string, timeZone?: string | null) {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "not set";
  const zone = operationsTimeZone(timeZone);
  const days = calendarDaysFrom(value, now, zone);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 7) return cachedDateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(instant);
  const sameYear = civil(instant, zone).slice(0, 4) === civil(new Date(now), zone).slice(0, 4);
  return cachedDateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" as const }) }).format(instant);
}

/** A day plus clock time when the year is current: "today 1:15 PM", "Oct 20, 2 PM", "Oct 20, 2027". */
export function plainDayTime(value: string, now: string, timeZone?: string | null) {
  const day = plainDay(value, now, timeZone);
  if (/\d{4}$/u.test(day) || day === "not set") return day;
  return `${day}${/^[A-Z][a-z]{2} \d/u.test(day) ? "," : ""} ${plainClock(value, timeZone)}`;
}

/** A due date read at a glance: "Due today 1:15 PM", "Due tomorrow 2 PM", "Late · was due today 9 AM", "3 days late". */
export function plainDue(value: string | undefined, now: string, timeZone?: string | null): { text: string; late: boolean } {
  if (!value || !Number.isFinite(Date.parse(value))) return { text: "No due date", late: false };
  if (Date.parse(value) >= Date.parse(now)) return { text: `Due ${plainDayTime(value, now, timeZone)}`, late: false };
  const days = -calendarDaysFrom(value, now, timeZone);
  if (days <= 1) return { text: `Late · was due ${plainDayTime(value, now, timeZone)}`, late: true };
  return { text: `${days} days late`, late: true };
}
