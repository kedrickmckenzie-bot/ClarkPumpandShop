import { OpsDomainError } from "./errors";

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function zonedParts(instant: number, timeZone: string): DateParts {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new OpsDomainError("VALIDATION", "The store time zone is invalid.");
  }
  const values = Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function sameParts(left: DateParts, right: DateParts) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

/**
 * Converts the wall-clock value produced by an HTML datetime-local input into
 * one unambiguous instant using the store's IANA time zone. Missing and
 * repeated daylight-saving clock times are rejected instead of silently
 * scheduling the vendor at a different hour.
 */
export function localDateTimeToIso(value: string, timeZone: string): string {
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (!match) throw new OpsDomainError("VALIDATION", "Enter a valid local date and time.");
  const target: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const nominal = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  const nominalDate = new Date(nominal);
  if (
    nominalDate.getUTCFullYear() !== target.year
    || nominalDate.getUTCMonth() + 1 !== target.month
    || nominalDate.getUTCDate() !== target.day
    || target.hour > 23
    || target.minute > 59
  ) {
    throw new OpsDomainError("VALIDATION", "Enter a valid local date and time.");
  }

  // All modern c-store operating zones are within 14 hours of UTC. Searching
  // the minute-aligned candidates also makes DST gaps and folds explicit.
  const matches: number[] = [];
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = nominal + offsetMinutes * 60_000;
    if (sameParts(zonedParts(candidate, timeZone), target)) matches.push(candidate);
  }
  if (matches.length === 0) {
    throw new OpsDomainError("VALIDATION", "That local time does not exist because of a daylight-saving clock change. Choose another time.");
  }
  if (matches.length > 1) {
    throw new OpsDomainError("VALIDATION", "That local time occurs twice because of a daylight-saving clock change. Choose a time outside the repeated hour.");
  }
  return new Date(matches[0]).toISOString();
}

export function formatInTimeZone(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
