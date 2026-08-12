import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { TechnicianVisitFlow } from "@/components/ops-public/technician-visit-flow";

export default async function PublicTechnicianVisitRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let portal = null;
  try {
    portal = await getPublicOperationsGateway().loadStorePortal(token);
  } catch {
    portal = null;
  }
  if (!portal || (!portal.capabilities.startVisit && !portal.capabilities.finishVisit)) return <PublicLinkUnavailable kind="store link" />;
  return <TechnicianVisitFlow portal={portal} token={token} />;
}
