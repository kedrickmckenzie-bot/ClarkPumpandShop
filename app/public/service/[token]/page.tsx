import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { ServiceAuthorizationPage } from "@/components/ops-public/service-authorization-page";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";

export default async function PublicServiceAuthorizationRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let authorization = null;
  try {
    authorization = await getPublicOperationsGateway().loadServiceAuthorization(token);
  } catch {
    return <PublicLinkUnavailable kind="service authorization" />;
  }
  if (!authorization) return <PublicLinkUnavailable kind="service authorization" />;
  return <ServiceAuthorizationPage authorization={authorization} token={token} />;
}
