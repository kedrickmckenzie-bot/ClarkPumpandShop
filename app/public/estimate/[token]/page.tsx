import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import { VendorEstimatePage } from "@/components/ops-public/vendor-estimate-page";

export default async function PublicVendorEstimateRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let estimate = null;
  try {
    estimate = await getPublicOperationsGateway().loadVendorEstimate(token);
  } catch {
    return <PublicLinkUnavailable kind="quote request" />;
  }
  if (!estimate) return <PublicLinkUnavailable kind="quote request" />;
  return <VendorEstimatePage estimate={estimate} token={token} />;
}
