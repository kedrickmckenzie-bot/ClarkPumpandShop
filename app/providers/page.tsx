import type { Metadata } from "next";
import { ProviderDirectory } from "@/components/provider-platform";

export const metadata: Metadata = { title: "Providers", description: "Unified accountability for internal maintenance and outside vendors." };
export default function Page() { return <ProviderDirectory />; }
