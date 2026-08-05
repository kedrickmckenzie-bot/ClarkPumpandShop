import { WorkOrderDetail } from "@/components/work-order-detail";
import { CreatedWorkOrderDetail } from "@/components/created-work-order-detail";
import { demoData } from "@/lib/demo/data";

export default async function Page({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const workOrder = demoData.workOrders.find((item) => item.id === workOrderId);
  if (!workOrder) return <CreatedWorkOrderDetail workOrderId={workOrderId} />;
  return <WorkOrderDetail workOrder={workOrder} />;
}
