import { CreatePmProgramSetupForm } from "@/components/ops/setup-forms";
import { loadCreatePmProgramSetupModel } from "../../../_data/setup-loader";
export default async function EditPmSchedule({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreatePmProgramSetupForm model={await loadCreatePmProgramSetupModel(id)} />;
}
