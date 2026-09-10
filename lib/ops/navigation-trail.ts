export interface NavigationStop { href: string; label: string }

/** A stable destination after streamed navigation, including on mobile. */
export function workspaceStartHref(href: string) {
  return href.startsWith("/app/") && !href.includes("#") ? `${href}#main-content` : href;
}

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
/** Pure record-link parsing shared by server-rendered tables and client review controls. */
export function workReviewTarget(href: string): string | undefined {
  const match = /^\/app\/work-orders\/([^/?#]+)(?:[?#]|$)/.exec(href);
  return match && match[1] !== "new" ? match[1] : undefined;
}
