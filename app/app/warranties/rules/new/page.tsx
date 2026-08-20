import type { Metadata } from "next";
import { WarrantyRuleCreateWorkspace } from "@/components/ops/warranty-rule-workspace";
import { loadWarrantyFinanceWorkspace } from "../../../_data/warranty-finance-loader";
export const metadata:Metadata={title:"Create future warranty rule"};
export default async function NewWarrantyRulePage(){const{fixture,session}=await loadWarrantyFinanceWorkspace();if(!["executive","facilities"].includes(session.role))return null;return <WarrantyRuleCreateWorkspace fixture={fixture}/>}
