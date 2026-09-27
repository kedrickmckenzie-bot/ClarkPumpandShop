import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { ServiceAuthorizationPage } from "@/components/ops-public/service-authorization-page";
import { getPublicOperationsGateway,resolveInspectionMasterFiles } from "@/components/ops-public/server-gateway";

export default async function PublicServiceAuthorizationRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let authorization = null;
  try {
    authorization = await getPublicOperationsGateway().loadServiceAuthorization(token);
  } catch {
    return <PublicLinkUnavailable kind="service authorization" />;
  }
  if (!authorization) return <PublicLinkUnavailable kind="service authorization" />;
  const forms=(await resolveInspectionMasterFiles(token)).map(f=>({name:f.originalName,href:`/api/ops-public/service/${encodeURIComponent(token)}/files/${encodeURIComponent(f.id)}`}));
  return <ServiceAuthorizationPage forms={forms} authorization={authorization} token={token} />;
}
