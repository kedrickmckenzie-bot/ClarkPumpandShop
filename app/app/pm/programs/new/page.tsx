import type { Metadata } from "next";
import { CreatePmProgramSetupForm } from "@/components/ops/setup-forms";
import { loadCreatePmProgramSetupModel } from "../../../_data/setup-loader";

export const metadata: Metadata = { title: "Create company PM schedule" };

export default async function NewPmProgramPage() {
  return <CreatePmProgramSetupForm model={await loadCreatePmProgramSetupModel()} />;
}
