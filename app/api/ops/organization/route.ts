import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isFictionalPreview, trustsSitesIdentity, OPS_ORGANIZATION_COOKIE, OperatorAccessError } from "@/lib/server/operator-access";
import { resolveAuthenticatedOperatorSession } from "@/lib/server/operator-membership";
import { getServerOpsRepository } from "@/lib/server/ops-repository-provider";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";
import { isWorkspaceOrigin } from "@/lib/server/request-origin";

export async function POST(request: Request) {
  if (isFictionalPreview()) return relativeRedirect303("/app/overview");
  if (!trustsSitesIdentity()) return relativeRedirect303("/access?reason=configuration");
  if (!isWorkspaceOrigin(request)) return Response.json({ error: "Open this form from your workspace." }, { status: 403 });
  const identity = await getChatGPTUser();
  if (!identity) return relativeRedirect303("/access?reason=sign_in");
  const form = await request.formData();
  const organizationId = String(form.get("organizationId") ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(organizationId)) return relativeRedirect303("/access?reason=membership");
  try {
    await resolveAuthenticatedOperatorSession(await getServerOpsRepository(), { userId: `sites:${identity.userId}`, organizationId });
    const response = relativeRedirect303("/app/overview");
    response.headers.append("Set-Cookie", `${OPS_ORGANIZATION_COOKIE}=${encodeURIComponent(organizationId)}; Path=/; HttpOnly; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    if (error instanceof OperatorAccessError) return relativeRedirect303(`/access?reason=${error.reason}`);
    throw error;
  }
}
