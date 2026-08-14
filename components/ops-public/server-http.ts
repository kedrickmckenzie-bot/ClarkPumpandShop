import { z } from "zod";
import type { PublicUpload } from "./contracts";
import { PublicWorkflowError } from "./contracts";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,120}$/;

export function readPublicIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new PublicWorkflowError("This action needs a valid retry key. Refresh and try again.", 422, "invalid_idempotency_key");
  }
  return key;
}

export const locationEvidenceSchema = z
  .object({
    captureResult: z.enum(["captured", "permission_denied", "position_unavailable", "timeout", "unsupported", "not_requested"]),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    accuracyM: z.number().finite().nonnegative().max(100_000).optional(),
    capturedAt: z.string().datetime().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.captureResult === "captured" &&
      (value.latitude === undefined || value.longitude === undefined || value.accuracyM === undefined || !value.capturedAt)
    ) {
      context.addIssue({ code: "custom", message: "Coordinates, accuracy, and capture time are required when location was captured." });
    }
  });

export function publicApiError(error: unknown): Response {
  if (error instanceof PublicWorkflowError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "cache-control": "no-store" } });
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: "Check the highlighted information and try again.", code: "invalid_request", issues: error.issues },
      { status: 422, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: "The request could not be completed. Try again.", code: "unexpected_error" },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export function publicApiSuccess<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function readPublicUploads(
  formData: FormData,
  options: { field?: string; maxFiles?: number; maxFileBytes?: number; allowedMediaTypes?: readonly string[] } = {},
): Promise<PublicUpload[]> {
  const field = options.field ?? "evidence";
  const maxFiles = options.maxFiles ?? 4;
  const maxFileBytes = options.maxFileBytes ?? 15 * 1024 * 1024;
  const allowed = options.allowedMediaTypes ?? ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
  const entries = formData.getAll(field).filter((entry): entry is File => typeof entry !== "string" && entry.size > 0);
  if (entries.length > maxFiles) {
    throw new PublicWorkflowError(`Attach no more than ${maxFiles} files.`, 413, "too_many_files");
  }
  const uploads: PublicUpload[] = [];
  for (const file of entries) {
    if (file.size > maxFileBytes) {
      throw new PublicWorkflowError(`${file.name} is larger than ${Math.round(maxFileBytes / 1024 / 1024)} MB.`, 413, "file_too_large");
    }
    if (!allowed.includes(file.type)) {
      throw new PublicWorkflowError(`${file.name} is not an accepted file type.`, 422, "file_type_not_allowed");
    }
    uploads.push({ name: file.name.slice(0, 180), mediaType: file.type, size: file.size, bytes: await file.arrayBuffer() });
  }
  return uploads;
}

export function parseJsonFormField<T>(formData: FormData, field: string, schema: z.ZodType<T>): T {
  const value = formData.get(field);
  if (typeof value !== "string") throw new PublicWorkflowError("The submitted form is incomplete.", 422, "missing_form_data");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new PublicWorkflowError("The submitted form could not be read.", 422, "invalid_form_data");
  }
  return schema.parse(parsed);
}
