import type { Metadata } from "next";
import { SchedulePage } from "@/components/maintenance-pages";
export const metadata: Metadata = { title: "Schedule & Dispatch" };
export default function Page() { return <SchedulePage />; }
