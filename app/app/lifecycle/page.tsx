import type { Metadata } from "next";
import { ProgramView } from "@/components/ops/views";
import { loadProgramModel } from "../_data/operator-loader";

export const metadata: Metadata = { title: "Lifecycle & CapEx" };
type Query = Record<string, string | string[] | undefined>;
export default async function LifecyclePage({ searchParams }: { searchParams: Promise<Query> }) { return <ProgramView model={await loadProgramModel("lifecycle", await searchParams)} />; }
