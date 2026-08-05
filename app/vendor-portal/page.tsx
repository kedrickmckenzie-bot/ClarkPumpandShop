import type { Metadata } from "next";
import { VendorPortalDemo } from "@/components/provider-platform";

export const metadata: Metadata = { title: "Vendor Workspace", description: "Optional low-friction provider access to assigned work." };
export default function Page() { return <VendorPortalDemo />; }
