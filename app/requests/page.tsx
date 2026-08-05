import type { Metadata } from "next";
import { RequestsCenter } from "@/components/maintenance-platform";
export const metadata: Metadata = { title: "Service Requests" };
export default function Page() { return <RequestsCenter />; }
