"use client";
import { useRef, useEffect, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";

/** Reuses each list's server filtering, scope and pagination rather than filtering a loaded page. */
export function LiveSearchForm(props: ComponentProps<"form">) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => () => clearTimeout(timer.current), []);
  function search(form: HTMLFormElement) {
    clearTimeout(timer.current);
    const url = new URL(form.action, window.location.origin);
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => { if (typeof value === "string" && value && !["page", "cursor", "offset"].includes(key)) params.append(key, value); });
    startTransition(() => router.replace(`${url.pathname}?${params}`, { scroll: false }));
  }
  return <form {...props} aria-busy={pending} onSubmit={e => { e.preventDefault(); search(e.currentTarget); }} onCompositionStart={() => { composing.current = true; clearTimeout(timer.current); }} onCompositionEnd={e => { composing.current = false; const form = e.currentTarget; clearTimeout(timer.current); timer.current = setTimeout(() => search(form), 250); }} onChange={e => {
    if (!(e.target instanceof HTMLInputElement) || e.target.type !== "search" || composing.current) return;
    const form = e.currentTarget; clearTimeout(timer.current); timer.current = setTimeout(() => search(form), 250);
  }} />;
}
