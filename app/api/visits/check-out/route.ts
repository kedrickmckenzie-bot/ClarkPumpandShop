import { NextResponse } from "next/server";
import { z } from "zod";
import { demoData, STORE_QR_TOKEN } from "@/lib/demo/data";
import { followUpForOutcome } from "@/lib/domain/workflow";

const schema = z.object({ token: z.string().min(10), workOrderId: z.string().min(1), outcome: z.enum(["resolved", "temporary", "diagnosed_unresolved", "unable_to_diagnose", "no_issue_found", "unable_to_perform"]), state: z.enum(["verified", "outside_geofence", "inaccurate", "permission_denied", "exception"]).nullable(), simulated: z.boolean().optional().default(false) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout payload", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.token !== STORE_QR_TOKEN) return NextResponse.json({ error: "Invalid store link" }, { status: 403 });
  const workOrder = demoData.workOrders.find((item) => item.id === parsed.data.workOrderId);
  if (!workOrder) return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  const at = new Date().toISOString();
  const visit = { id: "demo-checkout-visit", workOrderId: workOrder.id, vendorId: workOrder.vendorId ?? "unknown", technicianName: "Demo technician", sessionHash: "demo-session", checkedInAt: at, checkedOutAt: at, checkIn: { state: parsed.data.state ?? "exception", capturedAt: at }, outcome: parsed.data.outcome } as const;
  const followUp = followUpForOutcome(workOrder, visit, parsed.data.outcome, at);
  return NextResponse.json({ ok: true, visit, followUp, simulated: parsed.data.simulated });
}

