import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { loadPendingVisitCheckout } from "@/components/ops-public/pending-visit-cookie";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { StorePortalHome } from "@/components/ops-public/store-portal-home";

export default async function PublicStorePortalRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let portal = null;
  try {
    portal = await getPublicOperationsGateway().loadStorePortal(token);
  } catch {
    portal = null;
  }
  if (!portal) return <PublicLinkUnavailable kind="store link" />;
  const pendingVisit = await loadPendingVisitCheckout(portal, token);
  return <StorePortalHome pendingVisit={pendingVisit} portal={portal} publicOrigin={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"} token={token} />;
}
