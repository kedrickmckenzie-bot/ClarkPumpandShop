"use client";
import { StorePicker } from "./store-picker";
import type { CreateRequestPageViewModel } from "./data-contract";

export function RequestStorePicker({ model }: { model: CreateRequestPageViewModel }) {
  return <StorePicker initial={model.stores} defaultStoreId={model.defaultStoreId} searchable={model.storeLookup} initialCursor={model.storeNextCursor} />;
}
