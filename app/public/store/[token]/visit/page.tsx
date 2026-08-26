import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { loadPendingVisitCheckout } from "@/components/ops-public/pending-visit-cookie";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { TechnicianVisitFlow } from "@/components/ops-public/technician-visit-flow";

function returnToken(href: string | undefined): string | null {
  if (!href) return null;
  const match = /^\/public\/store\/([A-Za-z0-9_-]{20,240})$/.exec(href);
  return match?.[1] ?? null;
}

export default async function PublicTechnicianVisitRoute({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { token } = await params;
  const requestedReturnTo = (await searchParams).returnTo;
  const returnHref = Array.isArray(requestedReturnTo) ? requestedReturnTo[0] : requestedReturnTo;
  let portal = null;
  try {
    portal = await getPublicOperationsGateway().loadStorePortal(token);
  } catch {
    portal = null;
  }
  if (!portal || (!portal.capabilities.startVisit && !portal.capabilities.finishVisit)) return <PublicLinkUnavailable kind="store link" />;
  const gateway = getPublicOperationsGateway();
  const candidateReturnToken = returnToken(returnHref);
  const candidatePortal = candidateReturnToken ? await gateway.loadStorePortal(candidateReturnToken).catch(() => null) : null;
  const verifiedReturnHref = candidatePortal
    && candidatePortal.organizationName === portal.organizationName
    && candidatePortal.store.number === portal.store.number
    ? returnHref
    : undefined;
  const storeOptionsHref = portal.capabilities.startVisit ? `/public/store/${encodeURIComponent(token)}` : verifiedReturnHref;
  const pendingVisit = await loadPendingVisitCheckout(portal, portal.capabilities.startVisit ? token : candidateReturnToken ?? undefined);
  return <TechnicianVisitFlow pendingVisit={pendingVisit} portal={portal} storeOptionsHref={storeOptionsHref} token={token} />;
}
