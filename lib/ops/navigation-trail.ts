export interface NavigationStop { href: string; label: string }

/** Navigation only: never used as an authorization or record-association source. */
export function advanceNavigationTrail(trail: NavigationStop[], next: NavigationStop): NavigationStop[] {
  if (!next.href.startsWith("/app") || !/^\/app(?:[/?#]|$)/.test(next.href)) return trail;
  const last = trail.at(-1);
  if (last?.href === next.href) {
    if (last.label === next.label) return trail;
    return [...trail.slice(0, -1), next];
  }
  return [...trail, next].slice(-6);
}
