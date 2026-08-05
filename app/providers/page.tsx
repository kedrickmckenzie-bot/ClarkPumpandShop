import type { Metadata } from "next";
import { ProviderDirectory } from "@/components/provider-platform";

export const metadata: Metadata = { title: "Teams & vendors", description: "Internal maintenance teams and outside vendors in one place." };
export default function Page() { return <ProviderDirectory />; }
