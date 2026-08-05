import { WorkOrderRecord } from "@/components/maintenance-platform";

export default async function Page({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  return <WorkOrderRecord workOrderId={workOrderId} />;
}
