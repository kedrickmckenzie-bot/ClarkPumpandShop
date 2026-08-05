import type { Metadata } from "next";
import { PartsPage } from "@/components/maintenance-pages";
export const metadata: Metadata = { title: "Parts & Inventory" };
export default function Page() { return <PartsPage />; }
