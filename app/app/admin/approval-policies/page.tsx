import type { Metadata } from "next";
import { DetailView } from "@/components/ops/views";
import { loadApprovalPolicyWorkspaceModel } from "../../_data/operator-loader";

export const metadata: Metadata = { title: "Approval policies" };

export default async function ApprovalPoliciesPage() {
  return <DetailView model={await loadApprovalPolicyWorkspaceModel()} />;
}
