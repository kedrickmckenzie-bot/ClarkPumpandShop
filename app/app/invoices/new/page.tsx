import type { Metadata } from "next";
import { InvoiceReceiveWorkspace } from "@/components/ops/invoice-receive-workspace";
import { loadWarrantyFinanceWorkspace } from "../../_data/warranty-finance-loader";
export const metadata:Metadata={title:"Receive invoice"};
export default async function ReceiveInvoicePage(){const {fixture,session}=await loadWarrantyFinanceWorkspace();if(!["executive","facilities","finance"].includes(session.role))return null;return <InvoiceReceiveWorkspace fixture={fixture}/>}
