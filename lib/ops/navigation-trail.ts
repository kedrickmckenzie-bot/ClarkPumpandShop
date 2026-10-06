/** A stable destination after streamed navigation, including on mobile. */
export function workspaceStartHref(href: string) {
  return href.startsWith("/app/") && !href.includes("#") ? `${href}#main-content` : href;
}

/** Pure record-link parsing shared by server-rendered tables and client review controls. */
export function workReviewTarget(href: string): string | undefined {
  const match = /^\/app\/work-orders\/([^/?#]+)(?:[?#]|$)/.exec(href);
  return match && match[1] !== "new" ? match[1] : undefined;
}
