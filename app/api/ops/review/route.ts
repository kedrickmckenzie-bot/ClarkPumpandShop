import { localDateTimeToIso } from "@/lib/ops/local-date-time";
import {
  getOpsRequestContext,
  assertStoreInSessionScope,
  opsApiError,
} from "@/lib/server/ops-request-context";
import {
  routeReviewItem,
  type ReviewRouteInput,
} from "@/lib/ops/review-routing";
import { markInternalWorkReady } from "@/lib/ops/internal-execution";
import { OpsDomainError } from "@/lib/ops/errors";
export async function GET(request: Request) {
  try {
    const c = await getOpsRequestContext(
        ["facilities", "regional"],
        "assign_internal_work",
        request,
      ),
      r = c.repository,
      org = c.session.organizationId;
    const q = new URL(request.url).searchParams,
      id = q.get("id") ?? "",
      kind = q.get("kind");
    if (kind !== "request" && kind !== "work")
      throw new OpsDomainError("VALIDATION", "Choose a review item.");
    const item =
      kind === "request"
        ? await r.getRequest(org, id)
        : await r.getWorkOrder(org, id);
    if (!item) throw new OpsDomainError("NOT_FOUND", "Review item not found.");
    const store = await assertStoreInSessionScope(c.session, item.storeId);
    const [vendors, results, assignment, detail] = await Promise.all([
      r.listVendors(
        { organizationId: org, storeIds: [item.storeId] },
        q.get("vendorSearch") ?? "",
        { limit: 25 },
      ),
      kind === "work" ? r.listWorkResults(org, id) : [],
      kind === "work" ? r.getActiveAssignment(org, id) : null,
      kind === "work"
        ? r.getWorkOrderDetail(
            { organizationId: org, storeIds: [item.storeId] },
            id,
          )
        : null,
    ]);
    const approved = (
      await Promise.all(
        vendors.items.map(async (vendor) => ({
          ...vendor,
          covers: await r.vendorCoversStore(org, vendor.id, item.storeId),
        })),
      )
    )
      .filter((v) => v.status === "approved" && v.covers)
      .map((v) => ({ id: v.id, name: v.name }));
    return Response.json(
      {
        kind,
        item,
        storeLabel: `${store.storeNumber} · ${store.name}`,
        vendors: approved,
        assignmentId: assignment?.id,
        latestUpdate: results[0]?.outcomeNotes,
        canReady: Boolean(
          assignment?.kind === "internal" &&
          assignment.internalMembershipId &&
          results[0]?.followUpId &&
          !["completed", "no_issue_found", "quote_required"].includes(
            results[0].outcome,
          ) &&
          results[0].blocker !== "vendor" &&
          detail?.followUps.some(
            (f) => f.id === results[0].followUpId && f.status === "open",
          ),
        ),
        needsManagerReview:
          kind === "request" && item.status !== "under_review",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return opsApiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const c = await getOpsRequestContext(
      ["facilities", "regional"],
      "assign_internal_work",
      request,
    );
    const input = (await request.json()) as Omit<
      ReviewRouteInput,
      "actor" | "organizationId"
    > & {
      decision: ReviewRouteInput["decision"] | "ready";
      assignmentId?: string;
    };
    const item =
      input.kind === "request"
        ? await c.repository.getRequest(c.session.organizationId, input.id)
        : await c.repository.getWorkOrder(c.session.organizationId, input.id);
    if (!item) throw new OpsDomainError("NOT_FOUND", "Review item not found.");
    const store = await assertStoreInSessionScope(c.session, item.storeId);
    if (input.holdDeadlineAt)
      input.holdDeadlineAt = localDateTimeToIso(
        `${input.holdDeadlineAt}T17:00`,
        store.timeZone ?? "UTC",
      );
    if ((input.decision as string) === "ready") {
      await markInternalWorkReady(
        { repository: c.repository },
        {
          organizationId: c.session.organizationId,
          workOrderId: input.id,
          actor: c.actor,
          expectedVersion: input.expectedVersion,
          expectedAssignmentId: input.assignmentId!,
          key: input.key,
          notes: input.reason,
        },
      );
      return Response.json({
        id: input.id,
        href: "/app/dispatch?view=plan",
        message: "Saved · Ready for a technician",
      });
    }
    return Response.json(
      await routeReviewItem(
        { repository: c.repository },
        { ...input, organizationId: c.session.organizationId, actor: c.actor },
      ),
    );
  } catch (error) {
    return opsApiError(error);
  }
}
