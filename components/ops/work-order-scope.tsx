"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { CreateWorkOrderPageViewModel } from "./data-contract";
import { StorePicker } from "./store-picker";
import { WorkOrderLifecycleFields } from "./work-order-lifecycle-fields";
import styles from "./ops.module.css";
const Scope = createContext({ storeId: "", setStoreId: (() => {}) as (id: string) => void });
export function WorkOrderScope({ defaultStoreId, children }: { defaultStoreId?: string; children: ReactNode }) {
  const [storeId, setStoreId] = useState(defaultStoreId ?? "");
  return <Scope.Provider value={{ storeId, setStoreId }}>{children}</Scope.Provider>;
}
export function WorkOrderStore({ model, locked }: { model: CreateWorkOrderPageViewModel; locked: boolean }) {
  const { storeId, setStoreId } = useContext(Scope);
  if (locked) return <label className={styles.field}><span>Store</span><input type="hidden" name="storeId" value={storeId} /><input readOnly value={model.stores.find(s => s.value === storeId)?.label ?? "Selected store"} /></label>;
  return <StorePicker initial={model.stores} defaultStoreId={storeId} onSelect={setStoreId} />;
}
export function WorkOrderEquipment({ model }: { model: CreateWorkOrderPageViewModel }) {
  const { storeId } = useContext(Scope);
  return <EquipmentAtStore key={storeId} model={model} storeId={storeId} />;
}
function EquipmentAtStore({ model, storeId }: { model: CreateWorkOrderPageViewModel; storeId: string }) {
  const initial = storeId === model.defaults?.storeId;
  const [category, setCategory] = useState(initial ? model.defaults?.categoryKey ?? "" : "");
  const assets = model.assetLifecycleInputs.filter(a => a.storeId === storeId && (!category || a.categoryKey === category));
  return <div className={styles.optionalFormBody}>
    <label className={styles.field}><span>Category <small>Optional</small></span><select name="categoryKey" value={category} onChange={e => setCategory(e.target.value)}><option value="">Classify later</option>{model.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    {!storeId ? <p>Choose a store to see its equipment.</p> : <WorkOrderLifecycleFields key={category} assets={assets} asOf={model.lifecycleAsOf} defaultAssetId={initial && assets.some(a => a.id === model.defaults?.assetId) ? model.defaults?.assetId : undefined} />}
    {storeId && !assets.length ? <p>No equipment listed for this selection. You can still create the work order.</p> : null}
  </div>;
}
