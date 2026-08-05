import { NextResponse } from "next/server";
import { z } from "zod";
import { VENDOR_ACCEPT_TOKEN } from "@/lib/demo/data";

const schema = z.object({ token: z.string().min(20).max(160), response: z.enum(["accepted", "declined", "clarification"]), note: z.string().max(2000).optional().default("") }).superRefine((value, context) => { if (value.response !== "accepted" && !value.note.trim()) context.addIssue({ code: "custom", path: ["note"], message: "A reason or question is required" }); });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid vendor response", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.token !== VENDOR_ACCEPT_TOKEN) return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 403 });
  return NextResponse.json({ ok: true, audit: { type: `vendor.${parsed.data.response}`, recordedAt: new Date().toISOString(), simulated: true } });
}

