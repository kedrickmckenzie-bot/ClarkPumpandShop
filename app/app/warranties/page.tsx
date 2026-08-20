import type { Metadata } from "next";
import { WarrantyQueueWorkspace } from "@/components/ops/warranty-finance-workspace";
import { loadWarrantyFinanceWorkspace } from "../_data/warranty-finance-loader";
import { CreateWarrantyRuleLink } from "@/components/ops/warranty-rule-workspace";
export const metadata:Metadata={title:"Warranty center"};
export default async function WarrantyCenterPage(){const {fixture,warrantyCases,session}=await loadWarrantyFinanceWorkspace();return <>{["executive","facilities"].includes(session.role)?<CreateWarrantyRuleLink/>:null}<WarrantyQueueWorkspace fixture={fixture} cases={warrantyCases}/></>}
