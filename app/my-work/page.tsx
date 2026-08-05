import type { Metadata } from "next";
import { InternalWorkQueue } from "@/components/maintenance-platform";

export const metadata: Metadata = { title: "My Work" };

export default function Page() { return <InternalWorkQueue />; }
