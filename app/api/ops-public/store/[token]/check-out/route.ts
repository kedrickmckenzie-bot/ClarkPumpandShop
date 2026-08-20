import { z } from "zod";
import { getPublicOperationsGateway } from "@/components/ops-public/server-gateway";
import {
  locationEvidenceSchema,
  parseJsonFormField,
  publicApiError,
  publicApiSuccess,
  readPublicUploads,
  readPublicIdempotencyKey,
} from "@/components/ops-public/server-http";

const followUpSchema = z.object({
  accountableParty: z.string().min(1).max(160),
  nextAction: z.string().min(1).max(1000),
  dueAt: z.string().datetime(),
  escalationTo: z.string().min(1).max(160),
});

const workOrderOutcomeSchema = z.object({
  workOrderId: z.string().min(1).max(120),
  outcome: z.enum(["completed", "diagnosis_only", "quote_required", "parts_required", "return_visit_required", "no_issue_found", "store_access_unavailable", "work_not_authorized", "not_addressed"]),
  outcomeNotes: z.string().max(2000).optional(),
  followUp: followUpSchema.optional(),
});

const checkOutSchema = z.object({
  vendorId: z.string().min(1).max(120).optional(),
  visitId: z.string().min(1).max(120),
  perWorkOrderOutcomes: z.array(workOrderOutcomeSchema).min(1).max(100).optional(),
  outcome: z.enum(["resolved", "temporary_repair", "diagnosed_waiting_parts", "return_required", "unable_to_complete", "unable_to_reproduce", "other"]).optional(),
  outcomeNotes: z.string().max(2000).optional(),
  location: locationEvidenceSchema,
}).superRefine((value, context) => {
  if (Boolean(value.perWorkOrderOutcomes?.length) === Boolean(value.outcome)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide per-work-order outcomes or one unmatched visit outcome." });
  }
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const submissionKey = readPublicIdempotencyKey(request);
    const formData = await request.formData();
    const command = parseJsonFormField(formData, "command", checkOutSchema);
    const evidence = await readPublicUploads(formData);
    return publicApiSuccess(await getPublicOperationsGateway().checkOut(token, { ...command, evidence, submissionKey }), 201);
  } catch (error) {
    return publicApiError(error);
  }
}
