import type { Metadata } from "next";
import { InvoiceIntakeWorkspace } from "@/components/workspace/invoice-intake-workspace";
import { loadInvoiceIntake } from "../../_data/invoice-intake-loader";
export const metadata: Metadata = { title: "Receive invoice" };
export default async function ReceiveInvoicePage({ searchParams }: { searchParams?: Promise<Record<string,string|string[]|undefined>> }) { return <InvoiceIntakeWorkspace {...await loadInvoiceIntake(await searchParams ?? {})} />; }
