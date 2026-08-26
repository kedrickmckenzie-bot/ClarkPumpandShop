import type { Metadata } from "next";
import { PmPlanScheduleSetupForm } from "@/components/ops/setup-forms";
import { loadPmPlanScheduleSetupModel } from "../../../_data/setup-loader";

export const metadata: Metadata = { title: "Adjust store PM schedule" };

export default async function PmPlanSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PmPlanScheduleSetupForm model={await loadPmPlanScheduleSetupModel(id)} />;
}
