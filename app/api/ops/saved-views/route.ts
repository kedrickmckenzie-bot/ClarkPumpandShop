import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const ALLOWED_ROLES = ["executive", "facilities", "regional", "store_manager", "finance"] as const;

export async function POST(request: Request) {
  try {
    const context = await getOpsRequestContext([...ALLOWED_ROLES]);
    const formData = await request.formData();
    const operation = formText(formData, "operation", { max: 10 }) || "save";
    const surface = formText(formData, "surface", { required: true, max: 40 });
    const returnTo = formText(formData, "returnTo", { max: 500 }) || "/app/work-orders";
    const membershipId = context.session.membershipId ?? "";

    if (operation === "delete") {
      const id = formText(formData, "id", { required: true, max: 80 });
      await context.repository.deleteSavedView(context.session.organizationId, membershipId, id);
      return relativeRedirect303(returnTo);
    }

    const name = formText(formData, "name", { required: true, max: 60 });
    const queryString = formText(formData, "query", { required: true, max: 1000 });
    // The stored query must be a well-formed URLSearchParams payload.
    const params = new URLSearchParams(queryString);
    if ([...params.keys()].length === 0) {
      return Response.json({ error: "A saved view needs at least one filter." }, { status: 422 });
    }
    await context.repository.putSavedView({
      organizationId: context.session.organizationId,
      id: `saved-view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ownerMembershipId: membershipId,
      surface,
      name,
      queryString,
      createdAt: new Date().toISOString(),
    });
    return relativeRedirect303(returnTo);
  } catch (error) {
    return opsApiError(error);
  }
}
