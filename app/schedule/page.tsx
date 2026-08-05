import type { Metadata } from "next";
import { ScheduleCenter } from "@/components/maintenance-platform";
export const metadata: Metadata = { title: "Due-date Schedule" };
export default function Page() { return <ScheduleCenter />; }
