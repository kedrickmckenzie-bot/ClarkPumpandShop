/**
 * Shows multi-line text (for example a store report's problem followed by
 * "Area or equipment: …") on one line, with a visible separator where the
 * lines were. Display only: the saved text is never changed.
 */
export function oneLine(text: string): string;
export function oneLine(text: string | undefined): string | undefined;
export function oneLine(text: string | undefined) {
  return text?.split("\n").map((part) => part.trim()).filter(Boolean).join(" · ");
}
