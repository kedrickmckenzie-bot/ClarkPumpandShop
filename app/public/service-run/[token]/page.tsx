import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { buildServiceRunPublicView } from "@/lib/ops/service-run-presenter";
import { PublicLinkUnavailable } from "@/components/ops-public/public-ui";
import { ServiceRunResponsePage } from "@/components/ops-public/service-run-response-page";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default async function PublicServiceRunRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadPublicServiceRun(token);
  if (!view) return <PublicLinkUnavailable />;
  return <ServiceRunResponsePage token={token} view={view} />;
}

async function loadPublicServiceRun(token: string) {
  try {
    const repository = await getServerOpsRepository();
    return await buildServiceRunPublicView({ repository, tokenHash: await sha256Hex(token), now: new Date().toISOString() });
  } catch {
    return null;
  }
}
