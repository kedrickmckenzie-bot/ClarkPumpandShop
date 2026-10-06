"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Opens any collapsed section that holds the #target of a link, then scrolls to it. Renders nothing. */
export function RevealHashTarget() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    const reveal = () => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      let parent: HTMLElement | null = target;
      let expanded = false;
      while (parent) {
        if (parent instanceof HTMLDetailsElement && !parent.open) { parent.open = true; expanded = true; }
        parent = parent.parentElement;
      }
      if (expanded) target.scrollIntoView({ block: "start" });
    };
    const frame = requestAnimationFrame(reveal);
    window.addEventListener("hashchange", reveal);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", reveal); };
  }, [pathname, query]);
  return null;
}
