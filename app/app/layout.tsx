import {getServerOpsRepository} from "@/lib/server/ops-repository-provider";
import {attentionAccess} from "./_data/attention-presenter";
import type { Metadata } from "next";
import { PlatformShell } from "@/components/ops/platform-shell";
import { WorkReviewProvider } from "@/components/workspace/work-review";
import { productPresentation } from "@/lib/product/presentation";
import { loadOperatorSession } from "./_data/operator-loader";
import { redirect } from "next/navigation";
import { OperatorAccessError } from "@/lib/server/operator-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Operator workspace",
    template: `%s | ${productPresentation.identity.workingName}`,
  },
  robots: { index: false, follow: false },
};

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const session = await loadOperatorSession().catch(error => {
    if (error instanceof OperatorAccessError) redirect(`/access?reason=${error.reason}`);
    throw error;
  });
  const reviewCount=["facilities","regional","executive"].includes(session.role)?(await (await getServerOpsRepository()).listAttention(session,attentionAccess(session),{asOf:new Date().toISOString(),stage:"decide",limit:1})).totalCount:undefined;
  return <WorkReviewProvider key={JSON.stringify([session.organizationId, session.membershipId, session.role, session.storeIds, session.regionIds, session.demoEdition])}><PlatformShell session={session} reviewCount={reviewCount}>{children}</PlatformShell></WorkReviewProvider>;
}
