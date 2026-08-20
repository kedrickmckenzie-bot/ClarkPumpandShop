import type { Metadata } from "next";
import { WarrantyCaseWorkspace } from "@/components/ops/warranty-finance-workspace";
import { loadWarrantyFinanceWorkspace } from "../../_data/warranty-finance-loader";
export const metadata:Metadata={title:"Warranty case"};
export default async function WarrantyCasePage({params}:{params:Promise<{id:string}>}){const {id}=await params;const {fixture,selectedWarrantyCase,canManageWarranty}=await loadWarrantyFinanceWorkspace({warrantyCaseId:id});return <WarrantyCaseWorkspace fixture={fixture} warrantyCase={selectedWarrantyCase!} canManage={canManageWarranty}/>}
