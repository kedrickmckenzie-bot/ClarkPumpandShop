import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { StoreReportForm } from "@/components/ops-public/store-report-form";

export default async function PublicStoreReportRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let portal = null;
  try {
    portal = await getPublicOperationsGateway().loadStorePortal(token);
  } catch {
    portal = null;
  }
  if (!portal?.capabilities.reportIssue) return <PublicLinkUnavailable kind="store link" />;
  return <StoreReportForm portal={portal} token={token} />;
}
