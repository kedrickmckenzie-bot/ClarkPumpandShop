import type { Metadata } from "next";
import { WorkOrderList } from "@/components/work-order-list";

export const metadata: Metadata = { title: "Work Orders" };
export default function Page() { return <WorkOrderList />; }

