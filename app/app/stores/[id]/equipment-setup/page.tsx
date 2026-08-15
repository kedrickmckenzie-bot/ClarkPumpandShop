import type { Metadata } from "next";
import { StoreEquipmentSetup } from "@/components/ops/store-equipment-setup";
import { loadStoreEquipmentSetupModel } from "../../../_data/store-equipment-loader";

export const metadata: Metadata = { title: "Set up store equipment" };
export default async function StoreEquipmentSetupPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <StoreEquipmentSetup model={await loadStoreEquipmentSetupModel(id)} />; }
