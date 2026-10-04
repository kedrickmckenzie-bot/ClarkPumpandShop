"use client";
import { useCallback, useState } from "react";
import { SearchPicker, type PickPage } from "@/components/ops/search-picker";
import type { InternalTarget } from "@/lib/ops/internal-dispatch";
import styles from "./internal-dispatch.module.css";

export function InternalAssignmentFields({ storeId, defaultTarget = "pool", defaultPerson, defaultManager, onSelectionChange, requireChangeReason = false, compact = false }: {
  storeId: string; defaultTarget?: InternalTarget; defaultPerson?: { id: string; name: string }; defaultManager?: { id: string; name: string };
  onSelectionChange?: (selection: { target: InternalTarget; personId?: string; managerId?: string }) => void;
  compact?: boolean; requireChangeReason?: boolean;
}) {
  const [target, setTarget] = useState<InternalTarget>(defaultTarget);
  const [personId, setPersonId] = useState(defaultPerson?.id);
  const [managerId, setManagerId] = useState(defaultManager?.id);
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
    <label>Who handles it?<select name="internalTarget" value={target} onChange={e => { const next=e.target.value as InternalTarget; setTarget(next); onSelectionChange?.({target:next,personId,managerId}); }}>
      <option value="person">A specific technician</option><option value="pool">Any technician (first to take it)</option><option value="awaiting_allocation">A manager assigns it later</option>
    </select></label>
    {target === "person" ? <SearchPicker key={`technician-${storeId}`} name="internalMembershipId" label="Technician" required load={loadPeople} defaultValue={defaultPerson?.id} defaultOption={defaultPerson ? { value: defaultPerson.id, label: defaultPerson.name } : undefined} emptyText="No technician covers this store." onSelect={option=>{setPersonId(option?.value);onSelectionChange?.({target,personId:option?.value,managerId});}} /> : null}
    {target === "awaiting_allocation" ? <SearchPicker key={`manager-${storeId}`} name="managerId" label="Manager" required load={loadManagers} defaultValue={defaultManager?.id} defaultOption={defaultManager ? { value: defaultManager.id, label: defaultManager.name } : undefined} emptyText="No manager covers this store." onSelect={option=>{setManagerId(option?.value);onSelectionChange?.({target,personId,managerId:option?.value});}} /> : <p className={styles.muted}>Manager: {defaultManager?.name ?? "Facilities coordination"}{defaultManager && !compact ? `. If ${defaultManager.name} loses access to this store, Facilities coordination takes over.` : ""}</p>}
    {requireChangeReason && (target!==defaultTarget || (target==="person" && personId!==defaultPerson?.id) || (target==="awaiting_allocation" && managerId!==defaultManager?.id)) ? <label>Why change who handles this?<textarea name="reason" required rows={2} maxLength={1000}/></label> : null}
  </div>;
}
