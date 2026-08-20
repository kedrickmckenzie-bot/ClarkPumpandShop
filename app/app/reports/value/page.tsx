import type { Metadata } from "next";
import { ValueLedgerWorkspace } from "@/components/ops/value-ledger-workspace";
import type { ValueEventCategory } from "@/lib/ops/types";
import { loadValueLedgerWorkspace } from "../../_data/value-ledger-loader";
export const metadata:Metadata={title:"Value ledger"};
const categories=new Set<ValueEventCategory>(["realized_verified","identified_exposure","estimated_opportunity"]);
export default async function ValueLedgerPage({searchParams}:{searchParams:Promise<{category?:string}>}){const query=await searchParams;const category=categories.has(query.category as ValueEventCategory)?query.category as ValueEventCategory:undefined;const model=await loadValueLedgerWorkspace(category);return <ValueLedgerWorkspace {...model}/>}
