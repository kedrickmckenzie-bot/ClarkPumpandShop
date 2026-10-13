import { oneLine } from "./one-line";

/**
 * A problem as a page title: one line, cut at a word near 110 characters.
 * `cut` says whether the full text still needs to appear below the title.
 */
export function problemTitle(text: string | undefined, max = 110) {
  const full = oneLine(text)?.trim() ?? "";
  if (full.length <= max) return { title: full, cut: false };
  const at = full.lastIndexOf(" ", max - 3);
  return { title: `${full.slice(0, at > max / 2 ? at : max - 3)}…`, cut: true };
}
