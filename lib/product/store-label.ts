/** Scope already names the organization; keep the location distinct in compact rankings. */
export function compactStoreLabel(label: string, organizationName?: string): string {
  if (!organizationName) return label;
  const separator = label.indexOf(" · ");
  if (separator < 0) return label;
  const location = label.slice(separator + 3);
  for (const dash of [" - ", " – ", " — "]) {
    const prefix = organizationName + dash;
    if (location.toLowerCase().startsWith(prefix.toLowerCase()) && location.length > prefix.length) return label.slice(0, separator + 3) + location.slice(prefix.length);
  }
  return label;
}
