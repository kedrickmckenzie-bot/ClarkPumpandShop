"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { StorePicker } from "./store-picker";
import type { CreateRequestPageViewModel } from "./data-contract";
import styles from "./ops.module.css";

type Work = { id: string; number: string; problem: string; owner: string; nextAction: string };
export function RequestStorePicker({ model }: { model: CreateRequestPageViewModel }) {
  const [store, setStore] = useState(model.defaultStoreId ?? "");
  const [result, setResult] = useState<{ store: string; items?: Work[]; error?: string }>();
  useEffect(() => {
    if (!store) return;
    const controller = new AbortController();
    fetch(`/api/ops/store-work?${new URLSearchParams({ store })}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("Could not load existing work."); return response.json() as Promise<{ items: Work[] }>; })
      .then(data => { if (!controller.signal.aborted) setResult({ store, items: data.items }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ store, error: "Could not load existing work. You can still report this issue." }); });
    return () => controller.abort();
  }, [store]);
  return <>
    <StorePicker initial={model.stores} defaultStoreId={model.defaultStoreId} searchable={model.storeLookup} initialCursor={model.storeNextCursor} onSelect={setStore} />
    {store ? <section className={styles.subControlPanel} aria-label="Existing store work">
      <h3>Already being handled?</h3>
      {result?.store !== store ? <p role="status">Checking open work…</p> : result.error ? <p role="status">{result.error}</p> : result.items?.length ? <ul>{result.items.map(work => <li key={work.id}><Link href={`/app/work-orders/${work.id}`}>{work.problem}</Link><p>{work.number} · {work.owner} · {work.nextAction}</p></li>)}</ul> : <p>No open work recorded.</p>}
      <Link href={`/app/work-orders?store=${encodeURIComponent(store)}&status=open`}>All open work at this store</Link>
    </section> : null}
  </>;
}
