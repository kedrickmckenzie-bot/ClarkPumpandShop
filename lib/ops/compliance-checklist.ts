import { OpsDomainError } from "./errors";

/** Quick yes/no checks a schedule can ask on every inspection, such as a 30-day tank walkthrough. */
export function parseChecklist(json: string | undefined | null): string[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 12) : [];
  } catch { return []; }
}

export function checklistJson(items: unknown): string | undefined {
  if (items === undefined || items === null || items === "") return undefined;
  const list = typeof items === "string" ? parseChecklist(items) : Array.isArray(items) ? items : [];
  const clean = list.map((item) => String(item).trim()).filter(Boolean);
  if (clean.length > 12 || clean.some((item) => item.length > 200)) throw new OpsDomainError("VALIDATION", "Keep the checklist to 12 short items.");
  return clean.length ? JSON.stringify(clean) : undefined;
}

/**
 * Reads the yes/no answers (check-0, check-1, …) from a submitted form. Every item must be answered.
 * The answers become the start of the result note, and any "No" means issues were found.
 */
export function checklistAnswers(items: readonly string[], form: FormData, notes: string) {
  if (!items.length) return { note: notes, anyNo: false };
  const answers = items.map((item, index) => {
    const value = form.get(`check-${index}`);
    if (value !== "yes" && value !== "no") throw new OpsDomainError("VALIDATION", "Answer every check with Yes or No.");
    return { item, ok: value === "yes" };
  });
  const lines = answers.map((answer) => `${answer.ok ? "Yes" : "No"} · ${answer.item}`);
  return { note: [...lines, notes.trim()].filter(Boolean).join("\n"), anyNo: answers.some((answer) => !answer.ok) };
}
