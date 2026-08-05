import type { Metadata } from "next";
import { RequestsPage } from "@/components/maintenance-pages";
export const metadata: Metadata = { title: "Service Requests" };
export default function Page() { return <RequestsPage />; }
