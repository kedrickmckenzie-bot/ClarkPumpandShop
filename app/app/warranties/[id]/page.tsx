import { safeReviewQueue } from "@/lib/ops/review-navigation";
import type { Metadata } from "next";
import { WarrantyCaseWorkspace } from "@/components/ops/warranty-finance-workspace";
import { loadWarrantyFinanceWorkspace } from "../../_data/warranty-finance-loader";
export const metadata:Metadata={title:"Warranty case"};
export default async function WarrantyCasePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {id}=await params;const query=await searchParams??{};const queue=Array.isArray(query.reviewQueue)?query.reviewQueue[0]:query.reviewQueue;const {fixture,selectedWarrantyCase,canManageWarranty}=await loadWarrantyFinanceWorkspace({warrantyCaseId:id});return <WarrantyCaseWorkspace returnQueue={queue?safeReviewQueue(queue):undefined} updated={query.updated==="coverage"} fixture={fixture} warrantyCase={selectedWarrantyCase!} canManage={canManageWarranty}/>}
