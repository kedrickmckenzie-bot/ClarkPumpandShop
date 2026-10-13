import { AiUnavailableError } from "@/lib/ops/ai";
import { OpsDomainError } from "@/lib/ops/errors";
import { readEquipmentTag } from "@/lib/ops/refrigerant-tag";
import { getAiClient } from "@/lib/server/ai-provider";
import { internalDispatchScope } from "@/lib/server/internal-dispatch-context";
import { formText, getOpsRequestContext, opsApiError } from "@/lib/server/ops-request-context";
import { relativeRedirect303 } from "@/lib/server/relative-redirect";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Reads a photo of the equipment tag and sends the person back to the refrigerant form with the boxes filled in.
 * Nothing is saved here and the photo isn't kept; the person checks each box and saves.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, repository } = await getOpsRequestContext(["facilities", "regional", "technician", "store_manager"], undefined, request);
    const { id } = await params;
    const scope = session.role === "technician" ? await internalDispatchScope(repository, session) : session;
    if (!await repository.getAssetDetail(scope, id)) throw new OpsDomainError("NOT_FOUND", "Equipment not found.");
    const ai = getAiClient();
    if (!ai) throw new OpsDomainError("VALIDATION", "Photo reading isn't turned on. Type the details in instead.");
    const data = await request.formData();
    const photo = data.get("photo");
    if (!(photo instanceof File) || !photo.size) throw new OpsDomainError("VALIDATION", "Take or choose a photo of the tag.");
    const mediaType = TYPES.find((type) => type === photo.type);
    if (!mediaType) throw new OpsDomainError("VALIDATION", "Use a JPG, PNG or WebP photo.");
    if (photo.size > MAX_BYTES) throw new OpsDomainError("VALIDATION", "That photo is too large. Use one under 8 MB.");
    let reading;
    try { reading = await readEquipmentTag(ai, { mediaType, base64: Buffer.from(await photo.arrayBuffer()).toString("base64") }); }
    catch (error) { if (error instanceof AiUnavailableError) throw new OpsDomainError("VALIDATION", error.message); throw error; }
    const requestedReturn = formText(data, "returnTo", { max: 300 });
    const back = /^\/app\/[A-Za-z0-9/_%.-]*(\?[A-Za-z0-9=&_%.-]*)?$/u.test(requestedReturn) ? requestedReturn : `/app/equipment/${encodeURIComponent(id)}`;
    const query = new URLSearchParams({ tag: "1" });
    for (const [key, value] of Object.entries({ tagRefrigerant: reading.refrigerant, tagChargeLb: reading.chargeLb, tagMaker: reading.manufacturer, tagModel: reading.model, tagSerial: reading.serial, tagOther: reading.unrecognized })) if (value) query.set(key, value);
    if (reading.lowConfidence) query.set("tagUnsure", "1");
    return relativeRedirect303(`${back}${back.includes("?") ? "&" : "?"}${query}#refrigerant`);
  } catch (error) { return opsApiError(error); }
}
