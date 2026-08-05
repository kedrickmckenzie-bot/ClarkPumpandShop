import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyGeofence } from "@/lib/domain/geofence";
import { demoData, STORE_QR_TOKEN, STORY_STORE_ID } from "@/lib/demo/data";

const schema = z.object({ token: z.string().min(10), workOrderId: z.string().min(1), latitude: z.number().optional(), longitude: z.number().optional(), accuracyM: z.number().nonnegative().optional(), state: z.enum(["verified", "outside_geofence", "inaccurate", "permission_denied", "exception"]).optional(), simulated: z.boolean().optional().default(false) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid visit payload", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.token !== STORE_QR_TOKEN) return NextResponse.json({ error: "Invalid store link" }, { status: 403 });
  if (parsed.data.simulated && parsed.data.state) return NextResponse.json({ ok: true, state: parsed.data.state, simulated: true, sessionId: "demo-visit-session" });
  const store = demoData.stores.find((item) => item.id === STORY_STORE_ID)!;
  const result = verifyGeofence({ latitude: store.latitude, longitude: store.longitude, radiusM: store.geofenceRadiusM }, { latitude: parsed.data.latitude, longitude: parsed.data.longitude, accuracyM: parsed.data.accuracyM });
  return NextResponse.json({ ok: true, ...result, simulated: false, sessionId: "live-preview-session" });
}

