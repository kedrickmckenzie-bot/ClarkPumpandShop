"use client";
import { useCallback, useState } from "react";
import { SearchPicker, type PickPage } from "@/components/ops/search-picker";
import type { InternalTarget } from "@/lib/ops/internal-dispatch";
import styles from "./internal-dispatch.module.css";

export function InternalAssignmentFields({ storeId, defaultTarget = "pool", defaultPerson, defaultManager }: {
  storeId: string; defaultTarget?: InternalTarget; defaultPerson?: { id: string; name: string }; defaultManager?: { id: string; name: string };
}) {
  const [target, setTarget] = useState<InternalTarget>(defaultTarget);
  const loader = useCallback(async (query: string, signal: AbortSignal, cursor: string | undefined, managers: boolean): Promise<PickPage> => {
    const params = new URLSearchParams({ store: storeId, q: query, kind: managers ? "manager" : "technician" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/ops/internal-dispatch/people?${params}`, { signal });
    if (!response.ok) throw new Error("Could not load people for this store. Try again.");
    const page = await response.json() as { items: { id: string; name: string; role: string }[]; nextCursor?: string };
    return { items: page.items.filter(p => managers ? p.role !== "internal_technician" : p.role === "internal_technician").map(p => ({ value: p.id, label: p.name })), next: page.nextCursor };
  }, [storeId]);
  const loadPeople = useCallback((q: string, s: AbortSignal, c?: string) => loader(q, s, c, false), [loader]);
  const loadManagers = useCallback((q: string, s: AbortSignal, c?: string) => loader(q, s, c, true), [loader]);
  return <div className={styles.assignmentFields}>
    <label>Who handles it?<select name="internalTarget" value={target} onChange={e => setTarget(e.target.value as InternalTarget)}>
      <option value="person">A specific technician</option><option value="pool">Any technician (first to take it)</option><option value="awaiting_allocation">A manager assigns it later</option>
    </select></label>
    {target === "person" ? <SearchPicker key={`technician-${storeId}`} name="internalMembershipId" label="Technician" required load={loadPeople} defaultValue={defaultPerson?.id} defaultOption={defaultPerson ? { value: defaultPerson.id, label: defaultPerson.name } : undefined} emptyText="No technician covers this store." /> : null}
    {target === "awaiting_allocation" ? <SearchPicker key={`manager-${storeId}`} name="managerId" label="Manager" required load={loadManagers} defaultValue={defaultManager?.id} defaultOption={defaultManager ? { value: defaultManager.id, label: defaultManager.name } : undefined} emptyText="No manager covers this store." /> : <p className={styles.muted}>Manager: {defaultManager?.name ?? "Facilities coordination"}{defaultManager ? `. If ${defaultManager.name} loses access to this store, Facilities coordination takes over.` : ""}</p>}
  </div>;
}
