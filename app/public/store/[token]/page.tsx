import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
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
  return <StorePortalHome portal={portal} token={token} />;
}
