import type { Metadata } from "next";
import { EquipmentCenter } from "@/components/equipment-platform";

export const metadata: Metadata = { title: "Equipment", description: "Progressive equipment hierarchy, service history, and cost intelligence." };
export default function Page() { return <EquipmentCenter />; }
