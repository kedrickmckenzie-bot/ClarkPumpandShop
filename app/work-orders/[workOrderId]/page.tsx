import { notFound } from "next/navigation";
import { WorkOrderDetail } from "@/components/work-order-detail";
import { demoData } from "@/lib/demo/data";

export default async function Page({ params }: { params: Promise<{ workOrderId: string }> }) {
  const { workOrderId } = await params;
  const workOrder = demoData.workOrders.find((item) => item.id === workOrderId);
  if (!workOrder) notFound();
  return <WorkOrderDetail workOrder={workOrder} />;
}

