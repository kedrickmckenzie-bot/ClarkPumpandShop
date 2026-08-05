import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

const MAX_BYTES = 15 * 1024 * 1024;
const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain", "message/rfc822"]);

export async function POST(request: Request) {
  const body = await request.formData().catch(() => null);
  const file = body?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required" }, { status: 400 });
  if (!allowed.has(file.type) || file.size > MAX_BYTES) return NextResponse.json({ error: "Unsupported type or file exceeds 15 MB" }, { status: 415 });
  const bindings = env as unknown as { FILES?: R2Bucket };
  const key = `demo/${crypto.randomUUID()}`;
  if (!bindings.FILES) return NextResponse.json({ ok: true, stored: false, key, note: "Local preview session; R2 binding becomes active when hosted." });
  await bindings.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name.slice(0, 200), organizationId: "org-clarks-demo" } });
  return NextResponse.json({ ok: true, stored: true, key });
}

